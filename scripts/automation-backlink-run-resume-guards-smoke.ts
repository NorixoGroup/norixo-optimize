import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";

import { createBacklinkRunResumeHandler } from "../app/api/internal/automation/backlinks/runs/resume/route";
import { runScheduledBacklinkDiscovery, type ScheduledDiscoveryDependencies } from "../lib/automation/backlink-scheduled-discovery";
import { resumeBacklinksDryRun, type ResumeBacklinksDryRunResult } from "../lib/automation/run-resume";
import type { AutomationRun, AutomationTask } from "../lib/automation/types";
import { executeAutomationWorkerOnce } from "../lib/automation/worker";

// Guard-level regression tests for the run resume. The in-memory store mirrors the SQL contracts of
// claim_next_automation_task (ordering, available_at, attempt limit, run status and NO dependency check),
// complete/fail (backoff, dead letter) and reclaim, and drives the REAL worker. It is not a database test.

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const uuid = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const WORKSPACE = uuid(1);
const OTHER_WORKSPACE = uuid(9);
const RUN = uuid(3);
const NOW = "2026-10-12T10:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const iso = (offsetSeconds: number) => new Date(NOW_MS + offsetSeconds * 1000).toISOString();

const DISCOVERY = "backlinks.discovery.preview";
const QUALIFICATION = "backlinks.qualification.preview";
const PROMOTION = "backlinks.promotion.preview";
const DISCOVERY_ID = uuid(2), QUALIFICATION_ID = uuid(4), PROMOTION_ID = uuid(5);

function makeTask(overrides: Partial<AutomationTask> & Pick<AutomationTask, "id" | "taskKind">): AutomationTask {
  return {
    workspaceId: WORKSPACE, runId: RUN, dependsOnTaskId: null, system: "backlinks", taskKey: overrides.taskKind, status: "queued",
    priority: overrides.taskKind === DISCOVERY ? 10 : overrides.taskKind === QUALIFICATION ? 20 : 30,
    scheduledAt: iso(-3600), availableAt: iso(-3000), claimedAt: null, startedAt: null, heartbeatAt: null, leaseExpiresAt: null, completedAt: null, failedAt: null,
    cancelledAt: null, workerId: null, attemptCount: 0, maxAttempts: 3, backoffBaseSeconds: 60, input: {}, output: null, errorCode: null, errorMessage: null,
    createdAt: iso(-3600), updatedAt: iso(-3000), ...overrides,
  } as AutomationTask;
}
function makeRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: RUN, workspaceId: WORKSPACE, system: "backlinks", runKind: "backlinks.daily_preview", idempotencyKey: "manual-ui:abc", status: "running", mode: "dry_run",
    triggerSource: "manual", requestedBy: uuid(7), scheduledAt: iso(-3600), startedAt: iso(-3500), completedAt: null, failedAt: null, cancelledAt: null,
    heartbeatAt: null, leaseExpiresAt: null, workerId: null, attemptCount: 1, maxAttempts: 3, input: {}, summary: null, errorCode: null, errorMessage: null,
    createdAt: iso(-3600), updatedAt: iso(-3000), ...overrides,
  } as AutomationRun;
}

/** The production-shaped state: discovery done, qualification failed once (retry due), promotion not yet run. */
function productionTasks(overrides: { qualification?: Partial<AutomationTask>; promotion?: Partial<AutomationTask>; discovery?: Partial<AutomationTask> } = {}): AutomationTask[] {
  return [
    makeTask({ id: DISCOVERY_ID, taskKind: DISCOVERY, status: "completed", attemptCount: 1, completedAt: iso(-3400), output: { kind: DISCOVERY }, ...overrides.discovery }),
    makeTask({ id: QUALIFICATION_ID, taskKind: QUALIFICATION, dependsOnTaskId: DISCOVERY_ID, attemptCount: 1, availableAt: iso(-3300), errorCode: "AUTOMATION_TASK_HANDLER_FAILED", ...overrides.qualification }),
    makeTask({ id: PROMOTION_ID, taskKind: PROMOTION, dependsOnTaskId: QUALIFICATION_ID, ...overrides.promotion }),
  ];
}

type World = ReturnType<typeof makeWorld>;
function makeWorld(options: { run?: AutomationRun | null; tasks?: AutomationTask[]; qualificationFailures?: number } = {}) {
  const state = {
    run: options.run === undefined ? makeRun() : options.run,
    tasks: options.tasks ?? productionTasks(),
    qualificationFailuresLeft: options.qualificationFailures ?? 0,
  };
  const calls = { discovery: 0, qualification: 0, promotion: 0, brave: 0, outreach: 0, promotionsApplied: 0, completeRun: 0, failRun: 0, claims: 0, promotionOutOfOrder: 0, created: 0 };
  const yieldTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
  const find = (id: string) => state.tasks.find((task) => task.id === id);
  const replace = (task: AutomationTask) => { state.tasks = state.tasks.map((existing) => (existing.id === task.id ? task : existing)); return task; };

  const taskDeps = {
    createOrGetTask: async () => { calls.created += 1; throw new Error("resume must never create tasks"); },
    heartbeatTask: async () => null,
    cancelTask: async () => null,
    claimNextTask: async (input: { workspaceId: string; runId: string; workerId: string; claimedAt: string; leaseDurationSeconds: number }) => {
      await yieldTurn();
      calls.claims += 1;
      if (state.run === null || !["queued", "running"].includes(state.run.status)) return null;
      const eligible = state.tasks
        .filter((t) => t.workspaceId === input.workspaceId && t.runId === input.runId && t.status === "queued" && Date.parse(t.availableAt) <= Date.parse(input.claimedAt) && t.attemptCount < t.maxAttempts)
        .sort((a, b) => a.priority - b.priority || Date.parse(a.availableAt) - Date.parse(b.availableAt) || Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
      const task = eligible[0];
      if (task === undefined) return null;
      return replace({ ...task, status: "running", attemptCount: task.attemptCount + 1, workerId: input.workerId, claimedAt: input.claimedAt, startedAt: input.claimedAt, leaseExpiresAt: new Date(Date.parse(input.claimedAt) + input.leaseDurationSeconds * 1000).toISOString() });
    },
    completeTask: async (input: { taskId: string; workerId: string; completedAt: string; output: AutomationTask["output"] }) => {
      await yieldTurn();
      const task = find(input.taskId);
      if (task === undefined || task.status !== "running" || task.workerId !== input.workerId || Date.parse(task.leaseExpiresAt ?? "") <= Date.parse(input.completedAt)) return null;
      return replace({ ...task, status: "completed", completedAt: input.completedAt, output: input.output, leaseExpiresAt: null });
    },
    failTask: async (input: { taskId: string; workerId: string; failedAt: string; errorCode: string; errorMessage: string }) => {
      await yieldTurn();
      const task = find(input.taskId);
      if (task === undefined || task.status !== "running" || task.workerId !== input.workerId) return null;
      const retry = task.attemptCount < task.maxAttempts;
      return replace({
        ...task, status: retry ? "queued" : "dead_letter", workerId: retry ? null : task.workerId, leaseExpiresAt: null, errorCode: input.errorCode, errorMessage: input.errorMessage,
        availableAt: retry ? new Date(Date.parse(input.failedAt) + Math.min(86400, task.backoffBaseSeconds * 2 ** (task.attemptCount - 1)) * 1000).toISOString() : task.availableAt,
      });
    },
    reclaimExpiredTasks: async (input: { reclaimedAt: string }) => {
      const reclaimed: AutomationTask[] = [];
      for (const task of state.tasks.filter((t) => t.status === "running" && Date.parse(t.leaseExpiresAt ?? "") <= Date.parse(input.reclaimedAt))) {
        reclaimed.push(replace({ ...task, status: task.attemptCount < task.maxAttempts ? "queued" : "dead_letter", workerId: null, leaseExpiresAt: null, availableAt: input.reclaimedAt }));
      }
      return reclaimed;
    },
  };

  // Handlers mirror the real ones' preconditions: promotion needs a completed qualification.
  const executeHandler = async (input: { taskKind: string }) => {
    if (input.taskKind === DISCOVERY) { calls.discovery += 1; calls.brave += 1; return { output: { kind: DISCOVERY } }; }
    if (input.taskKind === QUALIFICATION) {
      calls.qualification += 1;
      if (state.qualificationFailuresLeft > 0) { state.qualificationFailuresLeft -= 1; throw new Error("Qualification dependency output is invalid"); }
      return { output: { kind: QUALIFICATION } };
    }
    if (input.taskKind === PROMOTION) {
      if (find(QUALIFICATION_ID)?.status !== "completed") { calls.promotionOutOfOrder += 1; throw new Error("Promotion qualification dependency is not completed"); }
      calls.promotion += 1;
      return { output: { kind: PROMOTION } };
    }
    throw new Error("unexpected task kind");
  };

  const deps = {
    getRun: async (scope: { workspaceId: string; runId: string }) => { await yieldTurn(); return state.run !== null && state.run.workspaceId === scope.workspaceId && state.run.id === scope.runId ? state.run : null; },
    listTasks: async (scope: { workspaceId: string; runId: string }) => { await yieldTurn(); return state.tasks.filter((t) => t.workspaceId === scope.workspaceId && t.runId === scope.runId).map((t) => ({ ...t })); },
    reclaimExpiredTasks: (input: { reclaimedAt: string }) => taskDeps.reclaimExpiredTasks(input),
    executeWorkerOnce: (input: Parameters<typeof executeAutomationWorkerOnce>[1]) => executeAutomationWorkerOnce({ ...taskDeps, executeHandler: executeHandler as never } as never, input),
    completeRun: async () => { calls.completeRun += 1; if (state.run === null || state.run.status !== "running") return { kind: "rejected" as const }; state.run = { ...state.run, status: "completed" }; return { kind: "transitioned" as const }; },
    failRun: async () => { calls.failRun += 1; if (state.run === null || state.run.status !== "running") return { kind: "rejected" as const }; state.run = { ...state.run, status: "failed" }; return { kind: "transitioned" as const }; },
  };
  const resume = (overrides: Partial<Parameters<typeof resumeBacklinksDryRun>[1]> = {}) =>
    resumeBacklinksDryRun(deps as never, { workspaceId: WORKSPACE, runId: RUN, workerId: "resume-worker", now: NOW, leaseDurationSeconds: 120, ...overrides });
  return { state, calls, deps, resume, find };
}

const rejected = (result: ResumeBacklinksDryRunResult) => (result.kind === "rejected" ? result.reason : `not rejected: ${result.kind}`);
function assertNothingExecuted(world: World, label: string): void {
  assert(world.calls.discovery === 0 && world.calls.brave === 0, `${label}: discovery/Brave must not run`);
  assert(world.calls.qualification === 0 && world.calls.promotion === 0 && world.calls.claims === 0, `${label}: no task may be claimed or executed`);
  assert(world.calls.completeRun === 0 && world.calls.failRun === 0, `${label}: the run must not change`);
}

async function main(): Promise<void> {
  // 1. Production-shaped resume: only qualification and promotion-preview run; the run completes.
  {
    const world = makeWorld();
    const result = await world.resume();
    assert(result.kind === "completed" && result.completedTasks === 2, `happy path: ${JSON.stringify(result)}`);
    assert(world.calls.discovery === 0 && world.calls.brave === 0, "zero discovery / Brave calls during resume");
    assert(world.calls.qualification === 1 && world.calls.promotion === 1 && world.calls.promotionOutOfOrder === 0, "each remaining task runs exactly once, in order");
    assert(world.find(QUALIFICATION_ID)!.attemptCount === 2 && world.find(PROMOTION_ID)!.attemptCount === 1, "attempt counters advance by one");
    assert(world.state.run!.status === "completed" && world.calls.completeRun === 1, "the run is completed once");
    assert(world.calls.outreach === 0 && world.calls.promotionsApplied === 0 && world.calls.created === 0, "no outreach, no actual promotion, no new task");
    const again = await world.resume();
    assert(rejected(again) === "run_not_running" && world.calls.qualification === 1 && world.calls.promotion === 1, "a completed run cannot be resumed again");
  }

  // 2. A promotion that already burned an attempt before the fix still resumes in order.
  {
    const world = makeWorld({ tasks: productionTasks({ promotion: { attemptCount: 1, availableAt: iso(-3200), errorCode: "AUTOMATION_TASK_HANDLER_FAILED" } }) });
    const result = await world.resume();
    assert(result.kind === "completed" && world.find(PROMOTION_ID)!.attemptCount === 2, "promotion with a prior attempt resumes");
  }

  // 3. Workspace scope and run status.
  {
    const other = makeWorld();
    assert(rejected(await other.resume({ workspaceId: OTHER_WORKSPACE })) === "run_not_found", "another workspace cannot see the run");
    assertNothingExecuted(other, "wrong workspace");
    // Defense in depth: even if the repository returned another workspace's run, the service refuses it.
    const unscoped = makeWorld();
    unscoped.deps.getRun = (async () => unscoped.state.run) as never;
    assert(rejected(await unscoped.resume({ workspaceId: OTHER_WORKSPACE })) === "run_not_found", "a run from another workspace is refused even if the read is unscoped");
    assertNothingExecuted(unscoped, "unscoped read");
    const missing = makeWorld({ run: null });
    assert(rejected(await missing.resume()) === "run_not_found", "unknown run");
    for (const status of ["queued", "completed", "failed", "cancelled"] as const) {
      const world = makeWorld({ run: makeRun({ status }) });
      assert(rejected(await world.resume()) === "run_not_running", `status ${status} is refused`);
      assertNothingExecuted(world, `status ${status}`);
    }
    const wrongKind = makeWorld({ run: makeRun({ runKind: "backlinks.other" }) });
    assert(rejected(await wrongKind.resume()) === "run_kind_unsupported", "only the preview run kind is resumable");
    assertNothingExecuted(wrongKind, "wrong kind");
  }

  // 4. Discovery must be completed; discovery never executes.
  for (const status of ["queued", "running", "dead_letter"] as const) {
    const world = makeWorld({ tasks: productionTasks({ discovery: { status, attemptCount: status === "dead_letter" ? 3 : 0 } }) });
    const reason = rejected(await world.resume());
    assert(reason === "discovery_not_completed" || reason === "dead_letter_present", `discovery ${status}: ${reason}`);
    assertNothingExecuted(world, `discovery ${status}`);
  }
  {
    const noDiscovery = makeWorld({ tasks: productionTasks().slice(1) });
    assert(rejected(await noDiscovery.resume()) === "discovery_not_completed", "a run without a discovery task is refused");
    assertNothingExecuted(noDiscovery, "no discovery task");
  }

  // 5. Dead-letter / cancelled / unsupported tasks.
  {
    const dead = makeWorld({ tasks: productionTasks({ qualification: { status: "dead_letter", attemptCount: 3 } }) });
    assert(rejected(await dead.resume()) === "dead_letter_present", "dead-letter task refuses the resume");
    assertNothingExecuted(dead, "dead letter");
    const cancelled = makeWorld({ tasks: productionTasks({ promotion: { status: "cancelled" } }) });
    assert(rejected(await cancelled.resume()) === "cancelled_task_present", "cancelled task refuses the resume");
    const extra = makeWorld({ tasks: [...productionTasks(), makeTask({ id: uuid(6), taskKind: "backlinks.outreach.follow_up_due" })] });
    assert(rejected(await extra.resume()) === "unsupported_tasks", "a run with any other task kind is refused");
    assertNothingExecuted(extra, "unsupported task kind");
  }

  // 6. Retry delay is respected: nothing is claimed, no attempt is consumed.
  {
    const world = makeWorld({ tasks: productionTasks({ qualification: { availableAt: iso(45) } }) });
    const result = await world.resume();
    assert(result.kind === "pending_retry" && result.waitingFor === "retry_delay" && result.retryAt === iso(45), `retry delay: ${JSON.stringify(result)}`);
    assert(world.calls.claims === 0 && world.find(QUALIFICATION_ID)!.attemptCount === 1 && world.calls.completeRun === 0, "no claim, no attempt used, run left running");
    const later = await world.resume({ now: iso(60) });
    assert(later.kind === "completed", "once the delay has elapsed the resume proceeds");
  }

  // 7. A failing qualification is retried with backoff; promotion is NOT claimed out of order.
  {
    const world = makeWorld({ qualificationFailures: 1 });
    const result = await world.resume();
    assert(result.kind === "pending_retry", `failure then wait: ${JSON.stringify(result)}`);
    assert(world.calls.qualification === 1 && world.calls.promotion === 0 && world.calls.promotionOutOfOrder === 0, "promotion must not run (or burn an attempt) before qualification completes");
    assert(world.find(PROMOTION_ID)!.attemptCount === 0, "promotion attempt counter untouched");
    assert(world.find(QUALIFICATION_ID)!.attemptCount === 2 && world.find(QUALIFICATION_ID)!.status === "queued", "qualification is queued with backoff");
    assert(world.state.run!.status === "running", "run stays running while a retry is pending");
    const next = await world.resume({ now: iso(130) });
    assert(next.kind === "completed" && world.calls.discovery === 0, "the next resume after the backoff completes the run, still without discovery");
  }

  // 8. Attempt limits are preserved: the last allowed attempt failing dead-letters and fails the run.
  {
    const world = makeWorld({ tasks: productionTasks({ qualification: { attemptCount: 2 } }), qualificationFailures: 5 });
    const result = await world.resume();
    assert(result.kind === "failed", `limit reached: ${JSON.stringify(result)}`);
    assert(world.find(QUALIFICATION_ID)!.status === "dead_letter" && world.find(QUALIFICATION_ID)!.attemptCount === 3, "attempt limit of 3 is not exceeded");
    assert(world.state.run!.status === "failed" && world.calls.failRun === 1 && world.calls.promotion === 0, "run fails, promotion never runs");
    assert(rejected(await world.resume()) === "run_not_running", "a failed run is not resumed");
    const exhausted = makeWorld({ tasks: productionTasks({ qualification: { attemptCount: 3 } }) });
    const stuck = await exhausted.resume();
    assert(stuck.kind === "pending_retry" && exhausted.calls.claims === 0, "a queued task with no attempts left is never claimed");
  }

  // 9. Concurrency: same-instance double submit, live lease, crash recovery.
  {
    const world = makeWorld();
    const [first, second] = await Promise.all([world.resume(), world.resume()]);
    const reasons = [first, second].map((r) => (r.kind === "rejected" ? r.reason : r.kind));
    assert(reasons.includes("completed") && reasons.includes("resume_in_progress"), `concurrent submits: ${reasons.join(",")}`);
    assert(world.calls.qualification === 1 && world.calls.promotion === 1 && world.calls.completeRun === 1, "tasks executed once and the run completed once");

    const leased = makeWorld({ tasks: productionTasks({ qualification: { status: "running", workerId: "another-worker", attemptCount: 2, leaseExpiresAt: iso(60) } }) });
    assert(rejected(await leased.resume()) === "resume_in_progress", "a task with a live lease blocks a second resume");
    assert(leased.calls.claims === 0 && leased.calls.qualification === 0, "nothing is claimed while a lease is live");

    const crashed = makeWorld({ tasks: productionTasks({ qualification: { status: "running", workerId: "dead-worker", attemptCount: 2, leaseExpiresAt: iso(-30) } }) });
    const recovered = await crashed.resume();
    assert(recovered.kind === "completed" && crashed.calls.discovery === 0, "an expired lease is reclaimed through the existing primitive, then the run completes");
    assert(crashed.find(QUALIFICATION_ID)!.attemptCount === 3, "reclaim + claim stays within the attempt limit");
  }

  // 10. Scheduled-run compatibility (P1b): the same resume continues a scheduled run, never discovery.
  {
    const scheduled = makeWorld({ run: makeRun({ triggerSource: "scheduled", requestedBy: null, idempotencyKey: "scheduled-discovery:2026-10-12" }) });
    const result = await scheduled.resume();
    assert(result.kind === "completed" && scheduled.calls.discovery === 0 && scheduled.calls.brave === 0, "a scheduled run resumes without discovery");

    // P1b pending_retry runs stay `running`; the scheduled workflow does not restart them (it would re-run discovery).
    const existing = makeRun({ triggerSource: "scheduled", idempotencyKey: "scheduled-discovery:2026-10-12" });
    let ticks = 0;
    let generated = 0;
    const p1b: ScheduledDiscoveryDependencies = {
      isEnabled: () => true,
      getBraveLimits: () => ({ maxSearchesPerRun: 5, maxResultsPerSearch: 5 }),
      listEligibleWorkspaceIds: async () => [WORKSPACE],
      getRunByKey: async () => existing,
      listRecentQueries: async () => [],
      generateQueries: (async () => { generated += 1; return { suggestions: [], rejected: [], providerId: "x", model: "x" }; }) as ScheduledDiscoveryDependencies["generateQueries"],
      runTick: async () => { ticks += 1; return { kind: "completed" }; },
    };
    const outcome = await runScheduledBacklinkDiscovery(p1b, { now: new Date("2026-10-12T07:30:00.000Z") });
    assert(outcome.disposition === "completed" && outcome.workspaces[0]?.outcome === "skipped_window_exists" && ticks === 0 && generated === 0, "P1b skips a running (pending_retry) run: no second discovery, no AI call");
  }

  // 11. Route: authentication, admin gate, workspace from context, strict body, safe errors.
  {
    const resumeCalls: unknown[] = [];
    const build = (context: unknown, resume: () => Promise<ResumeBacklinksDryRunResult> = async () => ({ kind: "completed", workerInvocations: 2, completedTasks: 2 }), isAdmin = true) =>
      createBacklinkRunResumeHandler({
        getContext: async () => context as never,
        isAdmin: () => isAdmin,
        resume: async (input) => { resumeCalls.push(input); return resume(); },
        now: () => new Date(NOW),
      });
    const request = (body: unknown) => new NextRequest("http://localhost/api/internal/automation/backlinks/runs/resume", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
    const okContext = { status: "ok", user: { email: "admin@example.com" }, workspace: { id: WORKSPACE } };

    assert((await build({ status: "unauthenticated" })(request({ runId: RUN }))).status === 401, "unauthenticated -> 401");
    assert((await build({ status: "workspace_forbidden" })(request({ runId: RUN }))).status === 403, "workspace forbidden -> 403");
    assert((await build(okContext, undefined, false)(request({ runId: RUN }))).status === 403, "non-admin -> 403");
    assert(resumeCalls.length === 0, "no resume attempt before authorization");
    for (const body of [{}, { runId: "not-a-uuid" }, { runId: RUN, workspaceId: OTHER_WORKSPACE }, { runId: RUN, force: true }, [RUN], null]) {
      assert((await build(okContext)(request(body))).status === 400, `invalid body ${JSON.stringify(body)}`);
    }
    assert(resumeCalls.length === 0, "invalid bodies never reach resume");

    const ok = await build(okContext)(request({ runId: RUN }));
    assert(ok.status === 200 && (await ok.json()).ok === true, "authorized admin resumes");
    assert((resumeCalls[0] as { workspaceId: string }).workspaceId === WORKSPACE, "the workspace comes from the authenticated context");
    assert((await build(okContext, async () => ({ kind: "rejected", reason: "run_not_found" }))(request({ runId: RUN }))).status === 404, "unknown run -> 404");
    assert((await build(okContext, async () => ({ kind: "rejected", reason: "discovery_not_completed" }))(request({ runId: RUN }))).status === 409, "not resumable -> 409");
    assert((await build(okContext, async () => ({ kind: "rejected", reason: "resume_in_progress" }))(request({ runId: RUN }))).status === 409, "in progress -> 409");
    const failed = await build(okContext, async () => { throw new Error("db password leaked"); })(request({ runId: RUN }));
    assert(failed.status === 500 && !JSON.stringify(await failed.json()).includes("leaked"), "failures are generic");
  }

  // 12. Static scope checks: no Brave, outreach, promotion application, contacts or run creation in the resume path.
  {
    const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const [service, repository, route] = (await Promise.all(["lib/automation/run-resume.ts", "lib/automation/repositories/automationRunResumeRepository.ts", "app/api/internal/automation/backlinks/runs/resume/route.ts"].map((file) => readFile(file, "utf8")))).map(strip);
    const forbiddenReach = /brave|resend|zerobounce|outreach|contactResolution|contactForm|applyBacklinkPromotion|promotions\/apply|campaigns\/apply|prepareBacklinksDryRun|startRun|createOrGetTask|createOrGetRun|\.insert\(|\.update\(|\.upsert\(|\.rpc\(/i;
    for (const [name, code] of [["service", service], ["repository", repository], ["route", route]] as const) {
      assert(!forbiddenReach.test(code), `resume ${name} must not reach Brave, outreach, promotion application, run/task creation or writes`);
    }
    // The only database access in the resume path is the read-only task listing: no write verb of any kind.
    assert(/\.select\(/.test(repository) && !/\.(insert|update|delete|upsert|rpc)\(/.test(repository), "the resume repository is read-only");
    const composition = await readFile("lib/automation/production-composition.ts", "utf8");
    assert(composition.includes("BACKLINK_RESUME_TASK_KIND_FORBIDDEN") && composition.includes("BACKLINK_RESUME_DEPENDENCY_NOT_COMPLETED"), "composition wrapper guards task kind and dependency");
    assert(/executeHandler: resumeExecuteHandler/.test(composition) && /const resumeExecuteHandler[\s\S]*?"backlinks\.qualification\.preview"[\s\S]*?"backlinks\.promotion\.preview"/.test(composition), "resume worker only uses the restricted handler");
    assert(!/resumeBacklinksDryRunService\([\s\S]{0,400}executeWorkerOnce,/.test(composition), "resume must not use the unrestricted worker");
  }

  console.log("PASS — Automation backlink run resume guards smoke");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

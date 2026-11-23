import assert from "node:assert/strict";
import test from "node:test";

import {
  resumeBacklinkAutonomyCompletedRun,
  type BacklinkAutonomyTerminalRunResumeContact,
  type BacklinkAutonomyTerminalRunResumeDependencies,
} from "@/lib/automation/backlink-autonomy-terminal-run-resume";
import type { AutomationRun, AutomationTask } from "@/lib/automation/types";
import type { BacklinkAutonomyControl } from "@/lib/automation/backlink-master-autonomy-orchestrator";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_WORKSPACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SOURCE_RUN_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_TASK_ID = "33333333-3333-4333-8333-333333333333";
const CONTACT_ID = "44444444-4444-4444-8444-444444444444";
const DOMAIN_ID = "66666666-6666-4666-8666-666666666666";
const OPPORTUNITY_ID = "77777777-7777-4777-8777-777777777777";
const OPERATOR_ID = "88888888-8888-4888-8888-888888888888";

const AUTHORIZED_CONTROL: BacklinkAutonomyControl = {
  backlinksEnabled: true,
  disabledReason: null,
  dryRunOnly: true,
  backlinkAutonomyEnabled: true,
  liveExecutionAuthorized: false,
  campaignApplyAuthorized: true,
};
const UNAUTHORIZED_CONTROL: BacklinkAutonomyControl = { ...AUTHORIZED_CONTROL, campaignApplyAuthorized: false };

function completedRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: SOURCE_RUN_ID,
    workspaceId: WORKSPACE_ID,
    system: "backlinks",
    runKind: "backlinks.autonomy",
    idempotencyKey: "backlinks-autonomy:promotion:app-1:paid-mailbox:blocked",
    status: "completed",
    mode: "dry_run",
    triggerSource: "internal",
    requestedBy: null,
    scheduledAt: "2026-11-20T06:15:00.000Z",
    startedAt: "2026-11-20T06:15:01.000Z",
    completedAt: "2026-11-20T06:15:05.000Z",
    failedAt: null,
    cancelledAt: null,
    heartbeatAt: null,
    leaseExpiresAt: null,
    workerId: null,
    attemptCount: 1,
    maxAttempts: 1,
    input: { version: 1, domainId: DOMAIN_ID, opportunityId: OPPORTUNITY_ID },
    summary: { version: 1, taskCounts: { queued: 0, running: 0, completed: 1, failed: 0, deadLetter: 0, cancelled: 0 } },
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-11-20T06:15:00.000Z",
    updatedAt: "2026-11-20T06:15:05.000Z",
    ...overrides,
  };
}

function contactValidationTask(overrides: Partial<AutomationTask> = {}): AutomationTask {
  return {
    id: SOURCE_TASK_ID,
    workspaceId: WORKSPACE_ID,
    runId: SOURCE_RUN_ID,
    dependsOnTaskId: null,
    system: "backlinks",
    taskKind: "backlinks.contact_validation",
    taskKey: `contact-validation:${OPPORTUNITY_ID}:${CONTACT_ID}`,
    status: "completed",
    priority: 40,
    scheduledAt: "2026-11-20T06:15:00.000Z",
    availableAt: "2026-11-20T06:15:00.000Z",
    claimedAt: "2026-11-20T06:15:01.000Z",
    startedAt: "2026-11-20T06:15:01.000Z",
    heartbeatAt: "2026-11-20T06:15:01.000Z",
    leaseExpiresAt: null,
    completedAt: "2026-11-20T06:15:04.000Z",
    failedAt: null,
    cancelledAt: null,
    workerId: "worker-1",
    attemptCount: 1,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: { version: 1, domainId: DOMAIN_ID, opportunityId: OPPORTUNITY_ID, contactId: CONTACT_ID },
    output: {
      status: "unverified",
      domainId: DOMAIN_ID,
      opportunityId: OPPORTUNITY_ID,
      contactId: CONTACT_ID,
      contactStatus: "unverified",
      currentNormalizedEmail: null,
      suppressed: false,
      email: null,
      contactForm: "unverified",
      linkedin: null,
      statusTransition: "none",
      manualReviewRequired: false,
      reasons: ["CONTACT_FORM_REQUIRES_EXISTING_APPROVAL_GATE"],
    },
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-11-20T06:15:00.000Z",
    updatedAt: "2026-11-20T06:15:04.000Z",
    ...overrides,
  };
}

function eligibleContact(overrides: Partial<BacklinkAutonomyTerminalRunResumeContact> = {}): BacklinkAutonomyTerminalRunResumeContact {
  return { id: CONTACT_ID, workspaceId: WORKSPACE_ID, contactStatus: "unverified", ...overrides };
}

function neverCalled(name: string) {
  return async () => { throw new Error(`must not be called: ${name}`); };
}

/**
 * Emulates the real repositories' race-safe create-or-get semantics (an
 * optimistic unique-constraint conflict falls back to a re-read) with a
 * deliberate double await, so two concurrently started calls genuinely
 * interleave instead of resolving synchronously in call order. Mirrors
 * scripts/backlink-contact-selection-resume-service.test.ts.
 */
function makeRaceSafeStore<V extends { id: string }>(makeValue: (seq: number) => V) {
  const byKey = new Map<string, V>();
  let seq = 0;
  return {
    byKey,
    async createOrGet(key: string): Promise<{ kind: "created" | "existing"; value: V }> {
      await Promise.resolve();
      let value = byKey.get(key);
      if (value != null) return { kind: "existing", value };
      await Promise.resolve();
      value = byKey.get(key);
      if (value != null) return { kind: "existing", value };
      value = makeValue(++seq);
      byKey.set(key, value);
      return { kind: "created", value };
    },
  };
}

function makeRunStore() {
  const store = makeRaceSafeStore((seq) => ({ id: `run-${seq}`, input: undefined as unknown }));
  return {
    all: store.byKey,
    createOrGetRun: async (input: { idempotencyKey: string; input: unknown }) => {
      const result = await store.createOrGet(input.idempotencyKey);
      if (result.kind === "created") store.byKey.set(input.idempotencyKey, { ...result.value, input: input.input });
      return { kind: result.kind, run: result.value };
    },
  };
}

function makeTaskStore() {
  const store = makeRaceSafeStore((seq) => ({ id: `task-${seq}` }));
  return {
    all: store.byKey,
    createOrGetTask: async (input: { taskKey: string }) => {
      const result = await store.createOrGet(input.taskKey);
      return { kind: result.kind, task: result.value };
    },
  };
}

function baseDeps(overrides: Partial<BacklinkAutonomyTerminalRunResumeDependencies> = {}): BacklinkAutonomyTerminalRunResumeDependencies {
  const runs = makeRunStore();
  const tasks = makeTaskStore();
  return {
    getRun: async () => completedRun(),
    listTasks: async () => [contactValidationTask()],
    getContact: async () => eligibleContact(),
    isAuthorizedOperator: async () => true,
    getControl: async () => AUTHORIZED_CONTROL,
    createOrGetRun: runs.createOrGetRun,
    createOrGetTask: tasks.createOrGetTask,
    ...overrides,
  };
}

function baseInput(overrides: Partial<Parameters<typeof resumeBacklinkAutonomyCompletedRun>[1]> = {}) {
  return {
    workspaceId: WORKSPACE_ID,
    sourceRunId: SOURCE_RUN_ID,
    stage: "contact_validation" as const,
    requestedBy: OPERATOR_ID,
    scheduledAt: "2026-11-23T08:00:00.000Z",
    ...overrides,
  };
}

test("valid, authorized source run resumes into a sibling run with a fresh campaign_prepare task, tracing back to the source", async () => {
  const runs = makeRunStore();
  const tasks = makeTaskStore();
  const result = await resumeBacklinkAutonomyCompletedRun(baseDeps({ createOrGetRun: runs.createOrGetRun, createOrGetTask: tasks.createOrGetTask }), baseInput());
  assert.equal(result.outcome, "resumed");
  assert.equal(result.sourceRunId, SOURCE_RUN_ID);
  assert.equal(result.sourceTaskId, SOURCE_TASK_ID);
  assert.ok(result.runId != null && result.taskId != null);
  const runRow = runs.all.get(`backlinks-autonomy:terminal-resume:${SOURCE_RUN_ID}:contact_validation`) as { input: Record<string, unknown> } | undefined;
  assert.equal(runRow?.input.sourceAutonomyRunId, SOURCE_RUN_ID);
  assert.equal(runRow?.input.sourceTaskId, SOURCE_TASK_ID);
  assert.equal(runRow?.input.resumedStage, "contact_validation");
  const createdTaskKey = [...tasks.all.keys()][0];
  assert.equal(createdTaskKey, `campaign-prepare:${OPPORTUNITY_ID}:${CONTACT_ID}`);
});

test("protections preserved: the sibling run is always created in dry_run mode, never live", async () => {
  const runs = makeRunStore();
  let capturedMode: string | null = null;
  const createOrGetRun = async (input: { idempotencyKey: string; mode: string; input: unknown }) => {
    capturedMode = input.mode;
    return runs.createOrGetRun(input);
  };
  const tasks = makeTaskStore();
  await resumeBacklinkAutonomyCompletedRun(baseDeps({ createOrGetRun, createOrGetTask: tasks.createOrGetTask }), baseInput());
  assert.equal(capturedMode, "dry_run");
});

test("only contact_validation is a resumable stage: any other stage is rejected before any read", async () => {
  const result = await resumeBacklinkAutonomyCompletedRun(
    { getRun: neverCalled("getRun"), listTasks: neverCalled("listTasks"), getContact: neverCalled("getContact"), isAuthorizedOperator: neverCalled("isAuthorizedOperator"), getControl: neverCalled("getControl"), createOrGetRun: neverCalled("createOrGetRun"), createOrGetTask: neverCalled("createOrGetTask") },
    baseInput({ stage: "campaign_prepare" as unknown as "contact_validation" }),
  );
  assert.equal(result.outcome, "not_eligible");
  assert.deepEqual(result.reasonCodes, ["STAGE_NOT_RESUMABLE"]);
});

test("access control: an empty or malformed requestedBy is rejected before the authorization dependency is even called", async () => {
  for (const requestedBy of ["", "not-a-uuid", "  ", OPERATOR_ID.slice(0, -1)]) {
    const result = await resumeBacklinkAutonomyCompletedRun(
      baseDeps({ getRun: neverCalled("getRun"), isAuthorizedOperator: neverCalled("isAuthorizedOperator"), createOrGetRun: neverCalled("createOrGetRun"), createOrGetTask: neverCalled("createOrGetTask") }),
      baseInput({ requestedBy }),
    );
    assert.equal(result.outcome, "not_eligible");
    assert.deepEqual(result.reasonCodes, ["OPERATOR_IDENTITY_INVALID"]);
  }
});

test("access control: requestedBy alone is never trusted as proof of authorization — a well-formed but unauthorized identity is rejected", async () => {
  let checkedInput: { workspaceId: string; requestedBy: string } | null = null;
  const result = await resumeBacklinkAutonomyCompletedRun(
    baseDeps({
      isAuthorizedOperator: async (input) => { checkedInput = input; return false; },
      getRun: neverCalled("getRun"),
      createOrGetRun: neverCalled("createOrGetRun"),
      createOrGetTask: neverCalled("createOrGetTask"),
    }),
    baseInput(),
  );
  assert.equal(result.outcome, "not_eligible");
  assert.deepEqual(result.reasonCodes, ["OPERATOR_NOT_AUTHORIZED"]);
  assert.deepEqual(checkedInput, { workspaceId: WORKSPACE_ID, requestedBy: OPERATOR_ID });
});

test("access control: an exception thrown by the authorization dependency fails closed exactly like an explicit false", async () => {
  const result = await resumeBacklinkAutonomyCompletedRun(
    baseDeps({
      isAuthorizedOperator: async () => { throw new Error("transient authz backend failure"); },
      getRun: neverCalled("getRun"),
      createOrGetRun: neverCalled("createOrGetRun"),
      createOrGetTask: neverCalled("createOrGetTask"),
    }),
    baseInput(),
  );
  assert.equal(result.outcome, "not_eligible");
  assert.deepEqual(result.reasonCodes, ["OPERATOR_NOT_AUTHORIZED"]);
});

test("source run missing, belonging to another workspace, or not completed is rejected without creating anything", async () => {
  const cases: Array<[AutomationRun | null, string]> = [
    [null, "SOURCE_RUN_NOT_FOUND"],
    [completedRun({ workspaceId: OTHER_WORKSPACE_ID }), "SOURCE_RUN_NOT_FOUND"],
    [completedRun({ status: "running", startedAt: "2026-11-20T06:15:01.000Z", completedAt: null }), "SOURCE_RUN_NOT_TERMINAL_COMPLETED"],
    [completedRun({ status: "failed", completedAt: null, failedAt: "2026-11-20T06:15:05.000Z", errorCode: "X", errorMessage: "x" }), "SOURCE_RUN_NOT_TERMINAL_COMPLETED"],
  ];
  for (const [run, reason] of cases) {
    const result = await resumeBacklinkAutonomyCompletedRun(
      baseDeps({ getRun: async () => run, listTasks: neverCalled("listTasks"), getContact: neverCalled("getContact"), createOrGetRun: neverCalled("createOrGetRun"), createOrGetTask: neverCalled("createOrGetTask") }),
      baseInput(),
    );
    assert.equal(result.outcome, "not_eligible");
    assert.deepEqual(result.reasonCodes, [reason]);
    assert.equal(result.runId, null);
  }
});

test("missing, wrong-kind, non-completed, or malformed-scope source task blocks resume without creating anything", async () => {
  const cases: Array<AutomationTask[]> = [
    [],
    [contactValidationTask({ status: "running" })],
    [contactValidationTask({ taskKind: "backlinks.contact_resolution" })],
    [contactValidationTask({ input: { version: 1, domainId: "not-a-uuid", opportunityId: OPPORTUNITY_ID, contactId: CONTACT_ID } })],
  ];
  for (const tasks of cases) {
    const result = await resumeBacklinkAutonomyCompletedRun(
      baseDeps({ listTasks: async () => tasks, getContact: neverCalled("getContact"), createOrGetRun: neverCalled("createOrGetRun"), createOrGetTask: neverCalled("createOrGetTask") }),
      baseInput(),
    );
    assert.equal(result.outcome, "not_eligible");
    assert.ok(["SOURCE_TASK_NOT_FOUND_OR_NOT_COMPLETED", "SOURCE_TASK_SCOPE_INVALID"].includes(result.reasonCodes[0]!));
  }
});

test("malformed or missing task output (business result) blocks resume without creating anything", async () => {
  const cases: Array<unknown> = [null, {}, { status: "not-a-real-status", suppressed: false, email: null, contactStatus: null, currentNormalizedEmail: null, reasons: [] }];
  for (const output of cases) {
    const result = await resumeBacklinkAutonomyCompletedRun(
      baseDeps({ listTasks: async () => [contactValidationTask({ output: output as never })], getContact: neverCalled("getContact"), createOrGetRun: neverCalled("createOrGetRun"), createOrGetTask: neverCalled("createOrGetTask") }),
      baseInput(),
    );
    assert.equal(result.outcome, "not_eligible");
    assert.deepEqual(result.reasonCodes, ["SOURCE_TASK_OUTPUT_INVALID"]);
  }
});

test("a suppressed, archived, do_not_contact, or cross-workspace contact blocks resume without creating anything", async () => {
  const cases: Array<[BacklinkAutonomyTerminalRunResumeContact | null, string]> = [
    [null, "CONTACT_SCOPE_INVALID"],
    [eligibleContact({ workspaceId: OTHER_WORKSPACE_ID }), "CONTACT_SCOPE_INVALID"],
    [eligibleContact({ contactStatus: "do_not_contact" }), "CONTACT_NO_LONGER_ELIGIBLE"],
    [eligibleContact({ contactStatus: "archived" }), "CONTACT_NO_LONGER_ELIGIBLE"],
  ];
  for (const [contact, reason] of cases) {
    const result = await resumeBacklinkAutonomyCompletedRun(
      baseDeps({ getContact: async () => contact, createOrGetRun: neverCalled("createOrGetRun"), createOrGetTask: neverCalled("createOrGetTask") }),
      baseInput(),
    );
    assert.equal(result.outcome, "not_eligible");
    assert.deepEqual(result.reasonCodes, [reason]);
  }
});

test("missing campaign-apply authorization blocks resume and creates no run at all (fail closed, no side effect)", async () => {
  const runs = makeRunStore();
  const tasks = makeTaskStore();
  const result = await resumeBacklinkAutonomyCompletedRun(
    baseDeps({ getControl: async () => UNAUTHORIZED_CONTROL, createOrGetRun: runs.createOrGetRun, createOrGetTask: tasks.createOrGetTask }),
    baseInput(),
  );
  assert.equal(result.outcome, "not_eligible");
  assert.deepEqual(result.reasonCodes, ["CAMPAIGN_APPLY_AUTHORIZATION_REQUIRED"]);
  assert.equal(result.runId, null);
  assert.equal(result.taskId, null);
  assert.equal(runs.all.size, 0);
  assert.equal(tasks.all.size, 0);
});

test("a contact still needing contact_form human approval is never bypassed: resume only ever reaches campaign_prepare, never contact_form_prepare directly", async () => {
  const tasks = makeTaskStore();
  const result = await resumeBacklinkAutonomyCompletedRun(baseDeps({ createOrGetTask: tasks.createOrGetTask }), baseInput());
  assert.equal(result.outcome, "resumed");
  const createdTaskKey = [...tasks.all.keys()][0]!;
  assert.ok(createdTaskKey.startsWith("campaign-prepare:"));
  assert.ok(!createdTaskKey.startsWith("contact-form-prepare:"));
});

test("repeating the same resume request is idempotent: the second call reuses the same sibling run and task", async () => {
  const deps = baseDeps();
  const first = await resumeBacklinkAutonomyCompletedRun(deps, baseInput());
  const second = await resumeBacklinkAutonomyCompletedRun(deps, baseInput({ scheduledAt: "2026-11-23T09:00:00.000Z" }));
  assert.equal(first.outcome, "resumed");
  assert.equal(second.outcome, "resumed");
  assert.equal(second.runId, first.runId);
  assert.equal(second.taskId, first.taskId);
});

test("idempotency key is derived internally and never taken from the caller: two legacy free-form keys simulated by a rogue caller still converge to one sibling run", async () => {
  const runs = makeRunStore();
  const tasks = makeTaskStore();
  const deps = baseDeps({ createOrGetRun: runs.createOrGetRun, createOrGetTask: tasks.createOrGetTask });
  // Simulates a caller still built against the old (removed) public shape
  // that used to accept a free-form idempotencyKey: the extra field is not
  // part of the type anymore and must have zero effect on deduplication.
  const legacyInputA = { ...baseInput(), idempotencyKey: "legacy-key-one" } as Parameters<typeof resumeBacklinkAutonomyCompletedRun>[1];
  const legacyInputB = { ...baseInput(), idempotencyKey: "legacy-key-two" } as Parameters<typeof resumeBacklinkAutonomyCompletedRun>[1];
  const first = await resumeBacklinkAutonomyCompletedRun(deps, legacyInputA);
  const second = await resumeBacklinkAutonomyCompletedRun(deps, legacyInputB);
  assert.equal(first.outcome, "resumed");
  assert.equal(second.outcome, "resumed");
  assert.equal(second.runId, first.runId);
  assert.equal(second.taskId, first.taskId);
  assert.equal(runs.all.size, 1);
  assert.equal(tasks.all.size, 1);
  assert.deepEqual([...runs.all.keys()], [`backlinks-autonomy:terminal-resume:${SOURCE_RUN_ID}:contact_validation`]);
});

test("concurrent resume attempts for the same request converge to exactly one sibling run and task", async () => {
  const runs = makeRunStore();
  const tasks = makeTaskStore();
  const deps = baseDeps({ createOrGetRun: runs.createOrGetRun, createOrGetTask: tasks.createOrGetTask });
  const input = baseInput();
  const [a, b] = await Promise.all([
    resumeBacklinkAutonomyCompletedRun(deps, input),
    resumeBacklinkAutonomyCompletedRun(deps, input),
  ]);
  assert.equal(a.outcome, "resumed");
  assert.equal(b.outcome, "resumed");
  assert.equal(a.runId, b.runId);
  assert.equal(a.taskId, b.taskId);
  assert.equal(runs.all.size, 1);
  assert.equal(tasks.all.size, 1);
});

test("the source run and its task are never mutated: no write-capable dependency is ever offered or invoked on them", async () => {
  const sourceRunSnapshot = completedRun();
  const sourceTaskSnapshot = contactValidationTask();
  let getRunCalls = 0;
  let listTasksCalls = 0;
  const result = await resumeBacklinkAutonomyCompletedRun(
    baseDeps({
      getRun: async (input) => { getRunCalls += 1; assert.deepEqual(input, { workspaceId: WORKSPACE_ID, runId: SOURCE_RUN_ID }); return sourceRunSnapshot; },
      listTasks: async (input) => { listTasksCalls += 1; assert.deepEqual(input, { workspaceId: WORKSPACE_ID, runId: SOURCE_RUN_ID }); return [sourceTaskSnapshot]; },
    }),
    baseInput(),
  );
  assert.equal(result.outcome, "resumed");
  assert.equal(getRunCalls, 1);
  assert.equal(listTasksCalls, 1);
  assert.deepEqual(sourceRunSnapshot, completedRun());
  assert.deepEqual(sourceTaskSnapshot, contactValidationTask());
});

test("authorization revoked between the Phase A preview and the Phase B apply re-read blocks task creation, leaving only a taskless sibling run", async () => {
  const runs = makeRunStore();
  const tasks = makeTaskStore();
  let controlCalls = 0;
  // First read (Phase A preview) sees campaignApplyAuthorized=true; the
  // re-read immediately before Phase B apply sees it revoked. This is the
  // exact staleness window Phase B's second getControl() call is meant to
  // close.
  const getControl = async () => { controlCalls += 1; return controlCalls === 1 ? AUTHORIZED_CONTROL : UNAUTHORIZED_CONTROL; };
  const result = await resumeBacklinkAutonomyCompletedRun(
    baseDeps({ getControl, createOrGetRun: runs.createOrGetRun, createOrGetTask: tasks.createOrGetTask }),
    baseInput(),
  );
  assert.equal(controlCalls, 2);
  assert.equal(result.outcome, "not_eligible");
  assert.deepEqual(result.reasonCodes, ["CAMPAIGN_APPLY_AUTHORIZATION_REQUIRED"]);
  assert.ok(result.runId != null, "the sibling run is still created before the re-read, per the documented non-transactional limit");
  assert.equal(result.taskId, null);
  assert.equal(runs.all.size, 1);
  assert.equal(tasks.all.size, 0);
});

test("a partial failure (sibling run created, task creation throws) reports the existing sibling run id instead of propagating, and a retry safely completes the missing task without a duplicate run", async () => {
  const runs = makeRunStore();
  let taskCreationAttempts = 0;
  const createOrGetTask = async (input: { taskKey: string }) => {
    taskCreationAttempts += 1;
    if (taskCreationAttempts === 1) throw new Error("simulated infrastructure failure after the sibling run was created");
    const realTasks = makeTaskStore();
    return realTasks.createOrGetTask(input);
  };
  const deps = baseDeps({ createOrGetRun: runs.createOrGetRun, createOrGetTask });

  const first = await resumeBacklinkAutonomyCompletedRun(deps, baseInput());
  assert.equal(first.outcome, "not_eligible");
  assert.deepEqual(first.reasonCodes, ["SIBLING_TASK_CREATION_FAILED"]);
  assert.ok(first.runId != null);
  assert.equal(first.taskId, null);
  assert.equal(runs.all.size, 1, "no duplicate sibling run was created by the failed attempt");

  const retryTasks = makeTaskStore();
  const second = await resumeBacklinkAutonomyCompletedRun(
    baseDeps({ createOrGetRun: runs.createOrGetRun, createOrGetTask: retryTasks.createOrGetTask }),
    baseInput(),
  );
  assert.equal(second.outcome, "resumed");
  assert.equal(second.runId, first.runId, "the retry reuses the exact same sibling run, never a new one");
  assert.ok(second.taskId != null);
  assert.equal(runs.all.size, 1);
  assert.equal(retryTasks.all.size, 1);
});

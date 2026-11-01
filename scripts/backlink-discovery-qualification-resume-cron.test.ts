import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  hasValidBacklinkDiscoveryQualificationResumeCronAuthorization,
  isBacklinkDiscoveryQualificationResumeCronEnabled,
} from "@/lib/automation/backlink-discovery-qualification-resume-cron-config";
import { isBacklinkDiscoveryQualificationResumeCandidateTask } from "@/lib/automation/repositories/backlinkDiscoveryQualificationResumeCandidatesRepository";
import { runBacklinkDiscoveryQualificationResumeCron } from "@/lib/automation/backlink-discovery-qualification-resume-cron-service";
import { createDryRunAutomationTaskHandlers } from "@/lib/automation/dry-run-handlers";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const NOW_MS = NOW.getTime();

function minutesAgo(minutes: number): string {
  return new Date(NOW_MS - minutes * 60 * 1000).toISOString();
}
function minutesFromNow(minutes: number): string {
  return new Date(NOW_MS + minutes * 60 * 1000).toISOString();
}

type ResumeCandidateTaskFixture = Parameters<typeof isBacklinkDiscoveryQualificationResumeCandidateTask>[0];
function taskRow(
  fields: Pick<ResumeCandidateTaskFixture, "status" | "available_at" | "lease_expires_at" | "attempt_count" | "max_attempts">,
): ResumeCandidateTaskFixture {
  return { id: "task-1", workspace_id: "ws-1", run_id: "run-1", task_kind: "backlinks.qualification.preview", ...fields };
}

// -- 1. Kill switch: absent/disabled/enabled --------------------------------------------------

test("config: switch absent or any value other than the literal string 'true' is disabled", () => {
  assert.equal(isBacklinkDiscoveryQualificationResumeCronEnabled({}), false);
  assert.equal(
    isBacklinkDiscoveryQualificationResumeCronEnabled({ BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_ENABLED: "false" }),
    false,
  );
  assert.equal(
    isBacklinkDiscoveryQualificationResumeCronEnabled({ BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_ENABLED: "TRUE" }),
    false,
  );
  assert.equal(
    isBacklinkDiscoveryQualificationResumeCronEnabled({ BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_ENABLED: "1" }),
    false,
  );
});

test("config: switch is enabled only for the exact literal 'true'", () => {
  assert.equal(
    isBacklinkDiscoveryQualificationResumeCronEnabled({ BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_ENABLED: "true" }),
    true,
  );
});

// -- 2. Invalid authentication ------------------------------------------------------------------

test("config: authentication rejects a missing header, empty CRON_SECRET, or a mismatched secret", () => {
  assert.equal(hasValidBacklinkDiscoveryQualificationResumeCronAuthorization(null, { CRON_SECRET: "s" }), false);
  assert.equal(hasValidBacklinkDiscoveryQualificationResumeCronAuthorization("Bearer s", { CRON_SECRET: "" }), false);
  assert.equal(hasValidBacklinkDiscoveryQualificationResumeCronAuthorization("Bearer wrong", { CRON_SECRET: "s" }), false);
  assert.equal(hasValidBacklinkDiscoveryQualificationResumeCronAuthorization("s", { CRON_SECRET: "s" }), false);
});

test("config: authentication accepts the exact Bearer secret", () => {
  assert.equal(hasValidBacklinkDiscoveryQualificationResumeCronAuthorization("Bearer s", { CRON_SECRET: "s" }), true);
});

// -- 3/4. Not-yet-due task vs. due (backoff elapsed) task -----------------------------------------

test("candidate predicate: a queued task whose backoff has not elapsed is not a candidate", () => {
  const notDue = taskRow({ status: "queued", available_at: minutesFromNow(5), lease_expires_at: null, attempt_count: 1, max_attempts: 3 });
  assert.equal(isBacklinkDiscoveryQualificationResumeCandidateTask(notDue, NOW_MS), false);
});

test("candidate predicate: a queued task whose backoff has elapsed is a candidate", () => {
  const due = taskRow({ status: "queued", available_at: minutesAgo(5), lease_expires_at: null, attempt_count: 1, max_attempts: 3 });
  assert.equal(isBacklinkDiscoveryQualificationResumeCandidateTask(due, NOW_MS), true);
});

test("candidate predicate: a queued task that has exhausted its attempts is never a candidate", () => {
  const exhausted = taskRow({ status: "queued", available_at: minutesAgo(5), lease_expires_at: null, attempt_count: 3, max_attempts: 3 });
  assert.equal(isBacklinkDiscoveryQualificationResumeCandidateTask(exhausted, NOW_MS), false);
});

// -- 5. Expired lease vs. live lease --------------------------------------------------------------

test("candidate predicate: a running task with an expired lease is a candidate", () => {
  const expired = taskRow({ status: "running", available_at: minutesAgo(30), lease_expires_at: minutesAgo(1), attempt_count: 1, max_attempts: 3 });
  assert.equal(isBacklinkDiscoveryQualificationResumeCandidateTask(expired, NOW_MS), true);
});

test("candidate predicate: a running task with a live lease is never a candidate", () => {
  const live = taskRow({ status: "running", available_at: minutesAgo(30), lease_expires_at: minutesFromNow(1), attempt_count: 1, max_attempts: 3 });
  assert.equal(isBacklinkDiscoveryQualificationResumeCandidateTask(live, NOW_MS), false);
});

// -- 6. Concurrent invocations -------------------------------------------------------------------

test("cron service: a concurrent resume of the same run is rejected, not executed twice", async () => {
  const candidate = { workspaceId: "ws-1", runId: "run-1", taskId: "task-1", taskKind: "backlinks.qualification.preview" as const };
  let inFlight = false;
  let executedCount = 0;
  const deps = {
    listCandidates: async () => [candidate],
    reclaimExpiredTasks: async () => { throw new Error("must not be called for a qualification candidate"); },
    resumeDiscoveryTask: async () => { throw new Error("must not be called for a qualification candidate"); },
    resumeRun: async () => {
      if (inFlight) return { kind: "rejected" };
      inFlight = true;
      await new Promise((resolve) => setTimeout(resolve, 10));
      executedCount += 1;
      inFlight = false;
      return { kind: "completed" };
    },
    now: () => NOW.toISOString(),
  };
  const [first, second] = await Promise.all([
    runBacklinkDiscoveryQualificationResumeCron(deps),
    runBacklinkDiscoveryQualificationResumeCron(deps),
  ]);
  assert.equal(executedCount, 1, "the run must be resumed exactly once across both overlapping invocations");
  assert.equal(first.runsResumed + second.runsResumed, 1);
  assert.equal(first.skipped + second.skipped, 1);
});

// -- 7. Retryable vs. non-retryable provider error, and error isolation --------------------------

test("cron service: a retryable provider error (pending_retry) counts as handled, not as an error", async () => {
  const deps = {
    listCandidates: async () => [{ workspaceId: "ws-1", runId: "run-1", taskId: "task-1", taskKind: "backlinks.qualification.preview" as const }],
    reclaimExpiredTasks: async () => { throw new Error("must not be called for a qualification candidate"); },
    resumeDiscoveryTask: async () => { throw new Error("must not be called"); },
    resumeRun: async () => ({ kind: "pending_retry" }),
    now: () => NOW.toISOString(),
  };
  const result = await runBacklinkDiscoveryQualificationResumeCron(deps);
  assert.equal(result.runsResumed, 1);
  assert.equal(result.errorCount, 0);
});

test("cron service: a non-retryable provider error (failed / dead-lettered) is reported, not thrown", async () => {
  const deps = {
    listCandidates: async () => [{ workspaceId: "ws-1", runId: "run-1", taskId: "task-1", taskKind: "backlinks.discovery.preview" as const }],
    reclaimExpiredTasks: async () => {},
    resumeDiscoveryTask: async () => ({ kind: "dead_letter" }),
    resumeRun: async () => { throw new Error("must not be called"); },
    now: () => NOW.toISOString(),
  };
  const result = await runBacklinkDiscoveryQualificationResumeCron(deps);
  assert.equal(result.discoveryResumed, 1);
  assert.equal(result.errorCount, 0);
});

test("cron service: an unexpected exception for one candidate is isolated and does not block the others", async () => {
  const candidates = [
    { workspaceId: "ws-1", runId: "run-1", taskId: "task-1", taskKind: "backlinks.qualification.preview" as const },
    { workspaceId: "ws-2", runId: "run-2", taskId: "task-2", taskKind: "backlinks.qualification.preview" as const },
  ];
  let calls = 0;
  const deps = {
    listCandidates: async () => candidates,
    reclaimExpiredTasks: async () => { throw new Error("must not be called for a qualification candidate"); },
    resumeDiscoveryTask: async () => { throw new Error("must not be called"); },
    resumeRun: async () => {
      calls += 1;
      if (calls === 1) throw new Error("unexpected provider crash");
      return { kind: "completed" };
    },
    now: () => NOW.toISOString(),
  };
  const result = await runBacklinkDiscoveryQualificationResumeCron(deps);
  assert.equal(calls, 2, "the second candidate must still be processed after the first one throws");
  assert.equal(result.errorCount, 1);
  assert.equal(result.runsResumed, 1);
});

test("cron service: a discovery candidate always reclaims an expired lease before resuming, so it is never rejected forever", async () => {
  let reclaimCalls = 0;
  const deps = {
    listCandidates: async () => [{ workspaceId: "ws-1", runId: "run-1", taskId: "task-1", taskKind: "backlinks.discovery.preview" as const }],
    reclaimExpiredTasks: async (input: { workspaceId: string; runId: string }) => {
      reclaimCalls += 1;
      assert.equal(input.workspaceId, "ws-1");
      assert.equal(input.runId, "run-1");
    },
    resumeDiscoveryTask: async () => ({ kind: "retried" }),
    resumeRun: async () => { throw new Error("must not be called for a discovery candidate"); },
    now: () => NOW.toISOString(),
  };
  const result = await runBacklinkDiscoveryQualificationResumeCron(deps);
  assert.equal(reclaimCalls, 1, "an expired lease must be reclaimed before resumeDiscoveryTask is attempted");
  assert.equal(result.discoveryResumed, 1);
});

// -- Contract regression: completeRun/failRun must go through the transition-service adapter ----
// failAutomationRun/completeAutomationRun in automationRunsRepository.ts return
// AutomationRun | null, but resumeDiscovery/resumeBacklinksDryRun require the
// {kind:"transitioned"|"rejected"} shape that only transition-service.ts's null -> "rejected"
// adaptation produces. Passing the raw repository function directly compiles in a worktree
// without node_modules (tsx does not type-check) but fails `tsc` in CI/Vercel.

test("static: the route adapts completeRun/failRun through transition-service, never the raw repository function", async () => {
  const route = await readFile(
    new URL("../app/api/internal/cron/backlinks/discovery-qualification-resume/route.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(route, /failRun:\s*\(runInput\)\s*=>\s*failAutomationRun\(client/);
  assert.doesNotMatch(route, /completeRun:\s*\(runInput\)\s*=>\s*completeAutomationRun\(client/);
  assert.match(route, /failAutomationRunTransition\(runTransitionDependencies/);
  assert.match(route, /completeAutomationRunTransition\(runTransitionDependencies/);
});

// -- 8. Outbound executor protection --------------------------------------------------------------

const OUTBOUND_EXECUTOR_PATTERN = /sendApprovedBacklinkOutreachEmail|runBacklinkOutreachLiveAutoSendCron|createEnvironmentOutreachEmailProvider|\bResend\b|markBacklinkOutreachFollowUpAttemptRequested|claimNextContactFormRun|transitionContactFormRun|confirmContactFormSubmission|retryContactFormPreSubmitRun|approveContactFormInitial/i;

test("static: the new route and service never import an outbound-executor identifier", async () => {
  const route = await readFile(
    new URL("../app/api/internal/cron/backlinks/discovery-qualification-resume/route.ts", import.meta.url),
    "utf8",
  );
  const service = await readFile(
    new URL("../lib/automation/backlink-discovery-qualification-resume-cron-service.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(route, OUTBOUND_EXECUTOR_PATTERN);
  assert.doesNotMatch(service, OUTBOUND_EXECUTOR_PATTERN);
});

test("real registry: backlinks.outreach.follow_up_due resolves to a dry-run preview, never a real send, inside the shared dry-run handler registry this route also builds its executeHandler from", async () => {
  const handlers = createDryRunAutomationTaskHandlers({
    providers: {},
  });
  const output = await handlers.execute({
    workspaceId: "ws-1",
    runId: "run-1",
    taskId: "task-1",
    taskKind: "backlinks.outreach.follow_up_due",
    input: { outreachId: "out-1", nextFollowUpAt: NOW.toISOString() },
    attemptedAt: NOW.toISOString(),
  });
  assert.equal((output.output as { dryRun: boolean }).dryRun, true);
});

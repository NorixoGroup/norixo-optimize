import assert from "node:assert/strict";

import {
  buildPublicationEventIdempotencyKey,
  parsePublicationEventEnvelope,
} from "../lib/intelligencePublishing/eventContracts";
import { resolveImpact } from "../lib/intelligencePublishing/impactResolver";
import {
  abandonOrchestrationRun,
  cancelOrchestrationRun,
  completeOrchestrationRun,
  createOrchestrationRun,
  failOrchestrationRun,
  heartbeatOrchestrationRun,
  markActionCompleted,
  markActionFailed,
  markActionSkipped,
  markRunPlanned,
  moveRunToPlanning,
  parseOrchestrationRun,
  partiallyCompleteOrchestrationRun,
  resetActionToPending,
  resumeRunAfterReview,
  startRunExecution,
  startRunPublishing,
  supersedeOrchestrationRun,
  waitForRunReview,
  type OrchestrationRun,
  type OrchestrationRunTransitionError,
} from "../lib/intelligencePublishing/orchestrationRun";

function buildEvent() {
  return parsePublicationEventEnvelope({
    eventId: "evt_run_001",
    eventType: "public_overview_approved",
    occurredAt: "2026-07-20T10:00:00.000Z",
    sourceSystem: "public_intelligence",
    subjectType: "public_overview",
    subjectId: "overview:paris",
    subjectFingerprint: "overview_fp_v2",
    policyVersions: {
      publicMarketOverviewContractVersion: "pmo_v1",
    },
    priority: "P1",
    visibility: "public",
    metadata: {
      approvalStatus: "internal_approved",
    },
  });
}

function buildContext() {
  return Object.freeze({
    assets: Object.freeze([
      Object.freeze({
        assetId: "asset_report_paris",
        assetType: "market_report",
        templateId: "market_report_v1",
        visibility: "public" as const,
        freshnessExpiryBehavior: "keep_visible" as const,
      }),
    ]),
    assetVersions: Object.freeze([
      Object.freeze({
        assetVersionId: "asset_version_report_paris_v1",
        assetId: "asset_report_paris",
      }),
    ]),
    artifactReferences: Object.freeze([
      Object.freeze({
        assetId: "asset_report_paris",
        assetVersionId: "asset_version_report_paris_v1",
        referenceType: "source_subject" as const,
        subjectType: "public_overview" as const,
        subjectId: "overview:paris",
      }),
    ]),
    activeVersions: Object.freeze({
      asset_report_paris: "asset_version_report_paris_v1",
    }),
    availableLocales: Object.freeze({
      asset_report_paris: Object.freeze(["fr", "en"]),
    }),
    availableChannels: Object.freeze({
      asset_report_paris: Object.freeze(["web"]),
    }),
    currentPolicyVersions: Object.freeze({}),
    currentFingerprints: Object.freeze({
      "public_overview:overview:paris": "overview_fp_v1",
    }),
    currentApprovalStates: Object.freeze({}),
    now: () => "2026-07-20T11:00:00.000Z",
  });
}

function buildImpactPlan() {
  return resolveImpact(buildEvent(), buildContext());
}

function buildRun(overrides: Partial<Parameters<typeof createOrchestrationRun>[0]> = {}) {
  const event = buildEvent();
  const impactPlan = buildImpactPlan();
  return createOrchestrationRun({
    runId: "run_001",
    event,
    eventIdempotencyKey: buildPublicationEventIdempotencyKey(event),
    impactPlan,
    now: () => "2026-07-20T11:00:00.000Z",
    ...overrides,
  });
}

function snapshot<T>(value: T): string {
  return JSON.stringify(value);
}

function expectTransitionError(fn: () => unknown): OrchestrationRunTransitionError {
  try {
    fn();
  } catch (error) {
    return error as OrchestrationRunTransitionError;
  }
  throw new Error("Expected a transition error.");
}

{
  const event = buildEvent();
  const impactPlan = buildImpactPlan();
  const eventBefore = snapshot(event);
  const planBefore = snapshot(impactPlan);
  const run = createOrchestrationRun({
    runId: "run_initial",
    event,
    eventIdempotencyKey: buildPublicationEventIdempotencyKey(event),
    impactPlan,
    now: () => "2026-07-20T11:00:00.000Z",
  });
  assert.equal(run.status, "queued");
  assert.equal(run.currentStep, "receive_event");
  assert.deepEqual(run.completedActions, []);
  assert.deepEqual(run.pendingActions, ["generate_asset_version", "republish"]);
  assert.deepEqual(run.failedActions, []);
  assert.deepEqual(run.skippedActions, []);
  assert.equal(run.startedAt, null);
  assert.equal(run.finishedAt, null);
  assert.equal(snapshot(event), eventBefore);
  assert.equal(snapshot(impactPlan), planBefore);
}

{
  const run = moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z");
  assert.equal(run.status, "planning");
  assert.equal(run.currentStep, "validate_event");
  assert.equal(run.startedAt, "2026-07-20T11:01:00.000Z");
}

{
  const planning = moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z");
  const planned = markRunPlanned(planning, "2026-07-20T11:02:00.000Z");
  assert.equal(planned.status, "planned");
  assert.equal(planned.currentStep, "prepare_execution");
}

{
  const planning = moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z");
  const planned = markRunPlanned(planning, "2026-07-20T11:02:00.000Z");
  const executing = startRunExecution(planned, "2026-07-20T11:03:00.000Z");
  assert.equal(executing.status, "executing");
  assert.equal(executing.currentStep, "execute_actions");
}

{
  const executing = startRunExecution(
    markRunPlanned(
      moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
      "2026-07-20T11:02:00.000Z",
    ),
    "2026-07-20T11:03:00.000Z",
  );
  const waiting = waitForRunReview(executing, "2026-07-20T11:04:00.000Z");
  assert.equal(waiting.status, "waiting_review");
  assert.equal(waiting.currentStep, "wait_for_review");
}

{
  const waiting = waitForRunReview(
    startRunExecution(
      markRunPlanned(
        moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
        "2026-07-20T11:02:00.000Z",
      ),
      "2026-07-20T11:03:00.000Z",
    ),
    "2026-07-20T11:04:00.000Z",
  );
  const publishing = resumeRunAfterReview(
    waiting,
    "2026-07-20T11:05:00.000Z",
  );
  assert.equal(publishing.status, "publishing");
  assert.equal(publishing.currentStep, "publish");
}

{
  const publishing = startRunPublishing(
    startRunExecution(
      markRunPlanned(
        moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
        "2026-07-20T11:02:00.000Z",
      ),
      "2026-07-20T11:03:00.000Z",
    ),
    "2026-07-20T11:04:00.000Z",
  );
  const completed = completeOrchestrationRun(
    publishing,
    "2026-07-20T11:05:00.000Z",
  );
  assert.equal(completed.status, "completed");
  assert.equal(completed.currentStep, "done");
  assert.equal(completed.finishedAt, "2026-07-20T11:05:00.000Z");
}

{
  const executing = startRunExecution(
    markRunPlanned(
      moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
      "2026-07-20T11:02:00.000Z",
    ),
    "2026-07-20T11:03:00.000Z",
  );
  const completed = completeOrchestrationRun(
    executing,
    "2026-07-20T11:04:00.000Z",
  );
  assert.equal(completed.status, "completed");
}

{
  const error = expectTransitionError(() =>
    completeOrchestrationRun(buildRun(), "2026-07-20T11:01:00.000Z"),
  );
  assert.equal(error.code, "invalid_transition");
}

{
  const completed = completeOrchestrationRun(
    startRunExecution(
      markRunPlanned(
        moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
        "2026-07-20T11:02:00.000Z",
      ),
      "2026-07-20T11:03:00.000Z",
    ),
    "2026-07-20T11:04:00.000Z",
  );
  const error = expectTransitionError(() =>
    startRunExecution(completed, "2026-07-20T11:05:00.000Z"),
  );
  assert.equal(error.code, "terminal_run");
}

{
  const cancelled = cancelOrchestrationRun(
    moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
    "2026-07-20T11:02:00.000Z",
    "user_cancelled",
  );
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancellationReason, "user_cancelled");
}

{
  const error = expectTransitionError(() =>
    failOrchestrationRun(
      moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
      "2026-07-20T11:02:00.000Z",
      "",
    ),
  );
  assert.equal(error.code, "missing_reason");
}

{
  const failed = failOrchestrationRun(
    moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
    "2026-07-20T11:02:00.000Z",
    "execution_failed",
  );
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureReason, "execution_failed");
}

{
  const error = expectTransitionError(() =>
    supersedeOrchestrationRun(
      moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
      "2026-07-20T11:02:00.000Z",
      "",
    ),
  );
  assert.equal(error.code, "missing_superseding_run");
}

{
  const superseded = supersedeOrchestrationRun(
    moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
    "2026-07-20T11:02:00.000Z",
    "run_002",
  );
  assert.equal(superseded.status, "superseded");
  assert.equal(superseded.supersededByRunId, "run_002");
}

{
  const abandoned = abandonOrchestrationRun(
    moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
    "2026-07-20T11:02:00.000Z",
    "stale_lock_detected",
  );
  assert.equal(abandoned.status, "abandoned");
  assert.equal(abandoned.abandonedReason, "stale_lock_detected");
}

{
  const run = moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z");
  const heartbeated = heartbeatOrchestrationRun(
    run,
    "2026-07-20T11:02:00.000Z",
  );
  assert.equal(heartbeated.lastHeartbeatAt, "2026-07-20T11:02:00.000Z");
  assert.equal(heartbeated.updatedAt, "2026-07-20T11:02:00.000Z");
}

{
  const run = heartbeatOrchestrationRun(
    moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
    "2026-07-20T11:02:00.000Z",
  );
  const sameHeartbeat = heartbeatOrchestrationRun(
    run,
    "2026-07-20T11:02:00.000Z",
  );
  assert.equal(sameHeartbeat, run);
}

{
  const run = buildRun();
  const completed = markActionCompleted(
    run,
    "generate_asset_version",
    "2026-07-20T11:01:00.000Z",
  );
  assert.ok(completed.completedActions.includes("generate_asset_version"));
  assert.ok(!completed.pendingActions.includes("generate_asset_version"));
}

{
  const run = buildRun();
  const failed = markActionFailed(
    run,
    "generate_asset_version",
    "2026-07-20T11:01:00.000Z",
  );
  assert.ok(failed.failedActions.includes("generate_asset_version"));
  assert.ok(!failed.pendingActions.includes("generate_asset_version"));
}

{
  const run = markActionFailed(
    buildRun(),
    "generate_asset_version",
    "2026-07-20T11:01:00.000Z",
  );
  const reset = resetActionToPending(
    run,
    "generate_asset_version",
    "2026-07-20T11:02:00.000Z",
  );
  assert.ok(reset.pendingActions.includes("generate_asset_version"));
  assert.ok(!reset.failedActions.includes("generate_asset_version"));
}

{
  const run = markActionCompleted(
    buildRun(),
    "generate_asset_version",
    "2026-07-20T11:01:00.000Z",
  );
  const noop = markActionCompleted(
    run,
    "generate_asset_version",
    "2026-07-20T11:02:00.000Z",
  );
  assert.equal(noop, run);
}

{
  const error = expectTransitionError(() =>
    markActionSkipped(
      buildRun(),
      "rollback",
      "2026-07-20T11:01:00.000Z",
    ),
  );
  assert.equal(error.code, "unknown_action");
}

{
  const run = markActionSkipped(
    markActionCompleted(
      buildRun(),
      "generate_asset_version",
      "2026-07-20T11:01:00.000Z",
    ),
    "republish",
    "2026-07-20T11:02:00.000Z",
  );
  const memberships = new Map<string, string>();
  for (const [bucketName, actions] of [
    ["completed", run.completedActions],
    ["pending", run.pendingActions],
    ["failed", run.failedActions],
    ["skipped", run.skippedActions],
  ] as const) {
    for (const action of actions) {
      const existing = memberships.get(action);
      assert.equal(existing, undefined, `Action ${action} appears twice`);
      memberships.set(action, bucketName);
    }
  }
}

{
  const run = markActionCompleted(
    buildRun(),
    "generate_asset_version",
    "2026-07-20T11:01:00.000Z",
  );
  const noop = markActionCompleted(
    run,
    "generate_asset_version",
    "2026-07-20T11:02:00.000Z",
  );
  assert.equal(noop.updatedAt, run.updatedAt);
}

{
  const partiallyCompleted = partiallyCompleteOrchestrationRun(
    startRunExecution(
      markRunPlanned(
        moveRunToPlanning(buildRun(), "2026-07-20T11:01:00.000Z"),
        "2026-07-20T11:02:00.000Z",
      ),
      "2026-07-20T11:03:00.000Z",
    ),
    "2026-07-20T11:04:00.000Z",
    "one_channel_failed",
  );
  assert.equal(partiallyCompleted.finishedAt, "2026-07-20T11:04:00.000Z");
}

{
  const run = buildRun();
  assert.deepEqual(run.pendingActions, ["generate_asset_version", "republish"]);
  assert.deepEqual(run.allPlannedActions, ["generate_asset_version", "republish"]);
}

{
  const runA = buildRun();
  const runB = buildRun();
  assert.deepEqual(runA, runB);
}

{
  const parsed = parseOrchestrationRun(buildRun());
  assert.equal(parsed.runId, "run_001");
}

console.log("PASS — Intelligence Publishing orchestration run smoke");

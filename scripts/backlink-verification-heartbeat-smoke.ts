import { setTimeout as delay } from "node:timers/promises";

import {
  executeClaimedBacklinkVerificationJob,
  type BacklinkVerificationJob,
  type BacklinkVerificationRunResult,
  type ExecuteClaimedBacklinkVerificationJobDependencies,
} from "../lib/backlinks/verification";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const workspaceId = "00000000-0000-4000-8000-000000000001";
const linkId = "00000000-0000-4000-8000-000000000002";

const job: BacklinkVerificationJob = {
  id: "00000000-0000-4000-8000-000000000003",
  workspaceId,
  linkId,
  jobKey: "scheduler:00000000-0000-4000-8000-000000000002:heartbeat",
  triggerSource: "scheduler",
  status: "running",
  policy: {},
  http: { timeoutMs: 10_000, maxRedirects: 3, maxResponseBytes: 1_048_576 },
  attemptCount: 1,
  maxAttempts: 1,
  queuedAt: "2026-08-29T10:00:00.000Z",
  startedAt: "2026-08-29T10:00:00.000Z",
  completedAt: null,
  failedAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  resultSummary: null,
  createdAt: "2026-08-29T10:00:00.000Z",
  updatedAt: "2026-08-29T10:00:00.000Z",
  workerId: "worker-heartbeat",
  claimedAt: "2026-08-29T10:00:00.000Z",
  leaseExpiresAt: "2026-08-29T10:02:00.000Z",
  heartbeatAt: "2026-08-29T10:00:00.000Z",
};

const link = {
  id: linkId,
  workspace_id: workspaceId,
  outreach_id: "00000000-0000-4000-8000-000000000004",
  opportunity_id: "00000000-0000-4000-8000-000000000005",
  domain_id: "00000000-0000-4000-8000-000000000006",
  asset_id: "00000000-0000-4000-8000-000000000007",
  backlink_key: "BL-LNK-HEARTBEAT",
  source_url: "https://publisher.example/resource",
  target_url: "https://norixo.example/",
  anchor_text: null,
  rel_type: null,
  link_location: null,
  status: "active" as const,
  acquired_at: "2026-08-29T09:00:00.000Z",
  first_verified_at: null,
  last_verified_at: null,
  last_seen_at: null,
  lost_at: null,
  lost_reason: null,
  verification_source: null,
  verification_evidence: null,
  created_by: null,
  created_at: "2026-08-29T09:00:00.000Z",
  updated_at: "2026-08-29T09:00:00.000Z",
};

const run: BacklinkVerificationRunResult = {
  link,
  runtimeResult: {
    kind: "verified",
    response: {
      requestedUrl: link.source_url,
      finalUrl: link.source_url,
      status: 200,
      contentType: "text/html",
      redirectCount: 0,
      fetchedAt: "2026-08-29T10:00:00.000Z",
    },
    verification: {
      status: "FOUND",
      verifiedAt: "2026-08-29T10:00:00.000Z",
      issues: [],
      evidence: { checkedAt: "2026-08-29T10:00:00.000Z" },
    },
  },
  attempt: {
    id: "00000000-0000-4000-8000-000000000004",
    workspaceId,
    linkId,
    attemptedAt: "2026-08-29T10:00:00.000Z",
    sourceUrl: link.source_url,
    targetUrl: link.target_url,
    runtimeKind: "verified",
    runtimeReason: null,
    verificationStatus: "FOUND",
    requestedUrl: link.source_url,
    finalUrl: link.source_url,
    httpStatus: 200,
    contentType: "text/html",
    redirectCount: 0,
    fetchErrorCode: null,
    fetchErrorMessage: null,
    verificationResult: {},
    createdAt: "2026-08-29T10:00:00.000Z",
  },
  persistenceResult: { kind: "persisted", link },
};

async function main(): Promise<void> {
  let heartbeatCalls = 0;
  let completed = false;
  const dependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    claimNextJob: async () => ({ kind: "claimed", job }),
    executeRun: async () => {
      await delay(5);
      return run;
    },
    runDependencies: {
      getLink: async () => link,
      executeRuntime: async () => run.runtimeResult,
      recordAttempt: async () => run.attempt,
      recordAttemptDependencies: { createAttempt: async () => run.attempt },
      persistCurrentState: async () => run.persistenceResult,
      persistenceDependencies: {
        getLink: async () => link,
        updateVerification: async () => link,
      },
    },
    completeJob: async () => {
      completed = true;
      return { kind: "completed", job };
    },
    failJob: async () => ({ kind: "failed", job }),
    extendLease: async (input) => {
      heartbeatCalls += 1;
      assert(input.jobId === job.id, "Heartbeat must target the claimed job.");
      assert(input.workerId === "worker-heartbeat", "Heartbeat must preserve worker ownership.");
      assert(input.leaseDurationSeconds === 120, "Heartbeat must preserve lease duration.");
      return { kind: "extended", job };
    },
    heartbeatIntervalMs: 1,
  };

  const result = await executeClaimedBacklinkVerificationJob(dependencies, {
    workspaceId,
    workerId: "worker-heartbeat",
    claimedAt: "2026-08-29T10:00:00.000Z",
    attemptedAt: "2026-08-29T10:00:00.000Z",
    leaseDurationSeconds: 120,
  });

  assert(result.kind === "completed", "Expected completed job.");
  assert(completed, "Completion must still run.");
  assert(heartbeatCalls > 0, "Heartbeat must run while the verification is active.");
  const callsAfterCompletion = heartbeatCalls;
  await delay(5);
  assert(heartbeatCalls === callsAfterCompletion, "Heartbeat timer must stop after completion.");

  let failureHeartbeatCalls = 0;
  const failureDependencies: ExecuteClaimedBacklinkVerificationJobDependencies = {
    ...dependencies,
    executeRun: async () => {
      await delay(5);
      throw new Error("boom");
    },
    failJob: async () => ({ kind: "failed", job }),
    extendLease: async () => {
      failureHeartbeatCalls += 1;
      return { kind: "extended", job };
    },
  };
  const failure = await executeClaimedBacklinkVerificationJob(failureDependencies, {
    workspaceId,
    workerId: "worker-heartbeat",
    claimedAt: "2026-08-29T10:00:00.000Z",
    attemptedAt: "2026-08-29T10:00:00.000Z",
    leaseDurationSeconds: 120,
  });
  assert(failure.kind === "failed", "Expected failed job.");
  const failureCallsAfterReturn = failureHeartbeatCalls;
  await delay(5);
  assert(failureHeartbeatCalls === failureCallsAfterReturn, "Heartbeat timer must stop after failure.");

  console.log("PASS — Backlink verification heartbeat smoke");
}

void main();

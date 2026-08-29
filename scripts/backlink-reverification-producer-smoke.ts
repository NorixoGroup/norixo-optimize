import assert from "node:assert/strict";

import type {
  CreateBacklinkVerificationJobInput,
  CreateOrGetBacklinkVerificationJobDependencies,
  BacklinkVerificationJob,
} from "../lib/backlinks/verification";
import { buildScheduledBacklinkVerificationJobInput, runBacklinkReverificationProducer } from "../lib/backlinks/verification";
import type { BacklinkReverificationCandidate, BacklinkReverificationWorkspaceControl } from "../lib/backlinks/verification/reverification-producer";

function job(input: CreateBacklinkVerificationJobInput): BacklinkVerificationJob {
  return {
    id: `job-${input.linkId}`,
    workspaceId: input.workspaceId,
    linkId: input.linkId,
    jobKey: input.jobKey,
    triggerSource: input.triggerSource,
    status: "queued",
    policy: input.policy,
    http: input.http,
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? 1,
    queuedAt: input.queuedAt,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    resultSummary: null,
    createdAt: input.queuedAt,
    updatedAt: input.queuedAt,
    workerId: null,
    claimedAt: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
  };
}

async function main(): Promise<void> {
  const workspaceRows: BacklinkReverificationWorkspaceControl[] = [
    { workspaceId: "00000000-0000-4000-8000-000000000001", backlinksEnabled: true, disabledReason: null },
    { workspaceId: "00000000-0000-4000-8000-000000000002", backlinksEnabled: false, disabledReason: null },
    { workspaceId: "00000000-0000-4000-8000-000000000003", backlinksEnabled: true, disabledReason: "maintenance" },
  ];
  const candidates: Record<string, BacklinkReverificationCandidate[]> = {
    "00000000-0000-4000-8000-000000000001": [
      { id: "00000000-0000-4000-8000-000000000101", workspace_id: "00000000-0000-4000-8000-000000000001", status: "active", acquired_at: "2026-07-01T00:00:00.000Z", last_verified_at: "2026-07-26T00:00:00.000Z" },
      { id: "00000000-0000-4000-8000-000000000102", workspace_id: "00000000-0000-4000-8000-000000000001", status: "draft", acquired_at: "2026-07-01T00:00:00.000Z", last_verified_at: null },
      { id: "00000000-0000-4000-8000-000000000103", workspace_id: "00000000-0000-4000-8000-000000000001", status: "lost", acquired_at: "2026-06-01T00:00:00.000Z", last_verified_at: null },
    ],
  };
  const reads: string[] = [];
  const created: string[] = [];
  const deps: CreateOrGetBacklinkVerificationJobDependencies = {
    getJobByKey: async (_workspaceId, jobKey) => {
      reads.push(jobKey);
      return null;
    },
    createJob: async (input) => {
      assert.equal(input.maxAttempts, 2);
      created.push(input.jobKey);
      return job(input);
    },
  };

  const summary = await runBacklinkReverificationProducer(
    {
      listEligibleWorkspaces: async () => workspaceRows,
      listCandidates: async (workspaceId) => candidates[workspaceId] ?? [],
      getJobByKey: deps.getJobByKey,
      createJob: deps.createJob,
      now: () => "2026-08-26T00:00:00.000Z",
    },
    { cadenceDays: 30, workspaceLimit: 10, candidateLimitPerWorkspace: 10, now: "2026-08-26T00:00:00.000Z" },
  );

  assert.equal(summary.workspacesScanned, 1);
  assert.equal(summary.workspacesSucceeded, 1);
  assert.equal(summary.workspacesFailed, 0);
  assert.equal(summary.candidatesScanned, 2);
  assert.equal(summary.jobsCreated, 2);
  assert.equal(summary.jobsExisting, 0);
  assert.equal(summary.jobsSkipped, 0);
  assert.equal(reads.length, 2);
  assert.ok(reads.every((key) => key.startsWith("scheduled:")));
  assert.equal(created.length, 2);

  const scheduledInput = buildScheduledBacklinkVerificationJobInput({
    workspaceId: "00000000-0000-4000-8000-000000000001",
    linkId: "00000000-0000-4000-8000-000000000101",
    queuedAt: "2026-08-26T00:00:00.000Z",
    anchorAt: "2026-07-26T00:00:00.000Z",
    cadenceDays: 30,
    policy: { strictAnchor: false, strictRel: false, followRedirects: true, maxRedirects: 3, acceptCanonical: false },
    http: { timeoutMs: 10000, maxRedirects: 3, maxResponseBytes: 1048576, userAgent: "Norixo-Backlink-Reverification/1.0" },
  });
  assert.equal(scheduledInput.triggerSource, "scheduler");
  assert.equal(scheduledInput.maxAttempts, 2);
  assert.match(scheduledInput.jobKey, /^scheduled:[0-9a-f-]{36}:[0-9a-z]+$/);

  console.log("PASS — Backlink reverification producer smoke");
}

void main();

import assert from "node:assert/strict";

import { runBacklinkReverificationAutomation, runBacklinkReverificationProducer, type BacklinkVerificationJob, type CreateBacklinkVerificationJobInput } from "../lib/backlinks/verification";
import type { BacklinkReverificationCandidate, BacklinkReverificationProducerDependencies, BacklinkReverificationWorkspaceControl } from "../lib/backlinks/verification/reverification-producer";

function job(input: { workspaceId: string; linkId: string; jobKey: string; triggerSource: "scheduler"; queuedAt: string }): BacklinkVerificationJob {
  return {
    id: `job-${input.linkId}`,
    workspaceId: input.workspaceId,
    linkId: input.linkId,
    jobKey: input.jobKey,
    triggerSource: input.triggerSource,
    status: "queued",
    policy: { strictAnchor: false, strictRel: false, followRedirects: true, maxRedirects: 3, acceptCanonical: false },
    http: { timeoutMs: 10_000, maxRedirects: 3, maxResponseBytes: 1_048_576, userAgent: "Norixo-Backlink-Reverification/1.0" },
    attemptCount: 0,
    maxAttempts: 1,
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
  const now = "2026-08-27T12:00:00.000Z";
  const controlLinkId = "5d1bb663-b79c-48bd-a425-3b7c9a547d07";
  const otherDueLinkId = "9790ff2f-7ba1-46be-b847-25e2074494cf";
  const workspaceA = "00000000-0000-4000-8000-000000000001";
  const workspaceB = "00000000-0000-4000-8000-000000000002";

  const workspaceRows: BacklinkReverificationWorkspaceControl[] = [
    { workspaceId: workspaceA, backlinksEnabled: true, disabledReason: null },
    { workspaceId: workspaceB, backlinksEnabled: true, disabledReason: null },
  ];

  const candidateRows: Record<string, BacklinkReverificationCandidate[]> = {
    [workspaceA]: [
      { id: controlLinkId, workspace_id: workspaceA, status: "active", acquired_at: "2026-08-25T00:00:00.000Z", last_verified_at: "2026-08-26T11:19:44.981Z" },
      { id: "11111111-1111-4111-8111-111111111111", workspace_id: workspaceA, status: "active", acquired_at: "2026-08-26T00:00:00.000Z", last_verified_at: "2026-08-26T23:59:00.000Z" },
      { id: "22222222-2222-4222-8222-222222222222", workspace_id: workspaceA, status: "archived", acquired_at: "2026-08-24T00:00:00.000Z", last_verified_at: "2026-08-24T00:00:00.000Z" },
    ],
    [workspaceB]: [
      { id: otherDueLinkId, workspace_id: workspaceB, status: "active", acquired_at: "2026-08-25T00:00:00.000Z", last_verified_at: "2026-08-26T21:38:10.313Z" },
    ],
  };

  const listCalls: Array<{ workspaceId: string; linkId: string | undefined }> = [];
  const getJobByKey = async () => null;
  const createdJobs: string[] = [];
  const createJob: BacklinkReverificationProducerDependencies["createJob"] = async (input: CreateBacklinkVerificationJobInput) => {
    createdJobs.push(input.jobKey);
    return job({
      workspaceId: input.workspaceId,
      linkId: input.linkId,
      jobKey: input.jobKey,
      triggerSource: "scheduler",
      queuedAt: input.queuedAt,
    });
  };

  const producerDue = await runBacklinkReverificationProducer(
    {
      listEligibleWorkspaces: async () => workspaceRows,
      listCandidates: async (workspaceId, _limit, linkId) => {
        listCalls.push({ workspaceId, linkId });
        const rows = candidateRows[workspaceId] ?? [];
        return linkId == null ? rows : rows.filter((row) => row.id === linkId);
      },
      getJobByKey,
      createJob,
      now: () => now,
    },
    { cadenceDays: 1, workspaceLimit: 10, candidateLimitPerWorkspace: 10, now, linkId: controlLinkId },
  );

  assert.equal(producerDue.jobsCreated, 1);
  assert.equal(producerDue.jobsExisting, 0);
  assert.equal(producerDue.jobsSkipped, 0);
  assert.equal(producerDue.scopedJob?.linkId, controlLinkId);
  assert(listCalls.every((call) => call.linkId === controlLinkId), "Scoped producer must pass the exact link filter to every candidate lookup.");

  const producerNotDue = await runBacklinkReverificationProducer(
    {
      listEligibleWorkspaces: async () => workspaceRows,
      listCandidates: async () => [
        { id: controlLinkId, workspace_id: workspaceA, status: "active", acquired_at: "2026-08-25T00:00:00.000Z", last_verified_at: "2026-08-27T11:59:30.000Z" },
      ],
      getJobByKey,
      createJob,
      now: () => now,
    },
    { cadenceDays: 1, workspaceLimit: 10, candidateLimitPerWorkspace: 10, now, linkId: controlLinkId },
  );
  assert.equal(producerNotDue.jobsCreated, 0);
  assert.equal(producerNotDue.scopedJob, null);

  const producerUnknown = await runBacklinkReverificationProducer(
    {
      listEligibleWorkspaces: async () => workspaceRows,
      listCandidates: async () => [],
      getJobByKey,
      createJob,
      now: () => now,
    },
    { cadenceDays: 1, workspaceLimit: 10, candidateLimitPerWorkspace: 10, now, linkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  );
  assert.equal(producerUnknown.jobsCreated, 0);
  assert.equal(producerUnknown.scopedJob, null);

  const producerCrossWorkspace = await runBacklinkReverificationProducer(
    {
      listEligibleWorkspaces: async () => [workspaceRows[0]],
      listCandidates: async (_workspaceId, _limit, linkId) => (linkId === controlLinkId ? candidateRows[workspaceB] : []),
      getJobByKey,
      createJob,
      now: () => now,
    },
    { cadenceDays: 1, workspaceLimit: 10, candidateLimitPerWorkspace: 10, now, linkId: controlLinkId },
  );
  assert.equal(producerCrossWorkspace.jobsCreated, 0);
  assert.equal(producerCrossWorkspace.scopedJob, null);

  const producerArchived = await runBacklinkReverificationProducer(
    {
      listEligibleWorkspaces: async () => workspaceRows,
      listCandidates: async (_workspaceId, _limit, linkId) => [
        { id: "22222222-2222-4222-8222-222222222222", workspace_id: workspaceA, status: "archived", acquired_at: "2026-08-24T00:00:00.000Z", last_verified_at: "2026-08-24T00:00:00.000Z" },
      ].filter((row) => linkId == null || row.id === linkId),
      getJobByKey,
      createJob,
      now: () => now,
    },
    { cadenceDays: 1, workspaceLimit: 10, candidateLimitPerWorkspace: 10, now, linkId: "22222222-2222-4222-8222-222222222222" },
  );
  assert.equal(producerArchived.jobsCreated, 0);
  assert.equal(producerArchived.scopedJob, null);

  const producerUnscoped = await runBacklinkReverificationProducer(
    {
      listEligibleWorkspaces: async () => [workspaceRows[0]],
      listCandidates: async () => candidateRows[workspaceA],
      getJobByKey,
      createJob,
      now: () => now,
    },
    { cadenceDays: 1, workspaceLimit: 10, candidateLimitPerWorkspace: 10, now },
  );
  assert.equal(producerUnscoped.jobsCreated, 1);
  assert.equal(producerUnscoped.scopedJob, null);

  let targetedJobCalls = 0;
  let schedulerCalls = 0;
  const scopedAutomation = await runBacklinkReverificationAutomation(
    {
      listEligibleWorkspaces: async () => workspaceRows,
      listCandidates: async (workspaceId, _limit, linkId) =>
        workspaceId === workspaceA && linkId === controlLinkId ? [candidateRows[workspaceA][0]] : [],
      getJobByKey,
      createJob,
      runTargetedJob: async (input) => {
        targetedJobCalls += 1;
        return { kind: "completed", jobId: input.jobId };
      },
      runSchedulerTick: async () => {
        schedulerCalls += 1;
        return { kind: "empty", iterations: 1, lastResult: { kind: "empty" } };
      },
    },
    {
      config: { enabled: true, cadenceDays: 1 },
      workerId: "worker",
      leaseDurationSeconds: 120,
      now,
      linkId: controlLinkId,
    },
  );
  assert.equal(targetedJobCalls, 1);
  assert.equal(schedulerCalls, 0);
  assert.equal(scopedAutomation.scheduler, null);
  assert.equal((scopedAutomation.scopedExecution as { kind?: string } | null)?.kind, "completed");

  targetedJobCalls = 0;
  schedulerCalls = 0;
  const unscopedAutomation = await runBacklinkReverificationAutomation(
    {
      listEligibleWorkspaces: async () => workspaceRows,
      listCandidates: async () => candidateRows[workspaceA],
      getJobByKey,
      createJob,
      runTargetedJob: async () => {
        targetedJobCalls += 1;
        return { kind: "completed", jobId: controlLinkId };
      },
      runSchedulerTick: async () => {
        schedulerCalls += 1;
        return { kind: "empty", iterations: 1, lastResult: { kind: "empty" } };
      },
    },
    {
      config: { enabled: true, cadenceDays: 1 },
      workerId: "worker",
      leaseDurationSeconds: 120,
      now,
    },
  );
  assert.equal(targetedJobCalls, 0);
  assert.equal(schedulerCalls, 2);
  assert.notEqual(unscopedAutomation.scheduler, null);
  assert.equal(unscopedAutomation.scopedExecution, null);

  console.log("PASS — Backlink reverification link-scope smoke");
}

void main();

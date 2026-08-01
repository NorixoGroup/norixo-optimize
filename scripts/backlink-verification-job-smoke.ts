import assert from "node:assert/strict";

import { BacklinkRepositoryError } from "../lib/backlinks/repositories/errors";
import {
  createOrGetBacklinkVerificationJob,
  type BacklinkVerificationJob,
  type CreateBacklinkVerificationJobInput,
} from "../lib/backlinks/verification";

const baseInput: CreateBacklinkVerificationJobInput = {
  workspaceId: "00000000-0000-4000-8000-000000000001", linkId: "00000000-0000-4000-8000-000000000002",
  jobKey: "manual:request-1", triggerSource: "manual", policy: { strictAnchor: true },
  http: { timeoutMs: 1000, maxRedirects: 3, maxResponseBytes: 10000, userAgent: "smoke" }, queuedAt: "2026-07-31T10:00:00.000Z",
};
function job(input: CreateBacklinkVerificationJobInput): BacklinkVerificationJob { return { id: `job-${input.workspaceId}`, workspaceId: input.workspaceId, linkId: input.linkId, jobKey: input.jobKey, triggerSource: input.triggerSource, status: "queued", policy: input.policy, http: input.http, attemptCount: 0, maxAttempts: 1, queuedAt: input.queuedAt, startedAt: null, completedAt: null, failedAt: null, lastErrorCode: null, lastErrorMessage: null, createdAt: input.queuedAt, updatedAt: input.queuedAt, workerId: null, claimedAt: null, leaseExpiresAt: null, heartbeatAt: null }; }
async function main(): Promise<void> {
  let reads = 0, inserts = 0;
  const created = await createOrGetBacklinkVerificationJob(baseInput, { getJobByKey: async () => { reads++; return null; }, createJob: async (input) => { inserts++; return job(input); } });
  assert.equal(created.kind, "created"); assert.equal(created.job.status, "queued"); assert.equal(created.job.attemptCount, 0); assert.equal(reads, 1); assert.equal(inserts, 1);
  const existing = job(baseInput); reads = 0; inserts = 0;
  const reused = await createOrGetBacklinkVerificationJob(baseInput, { getJobByKey: async () => { reads++; return existing; }, createJob: async () => { inserts++; return existing; } });
  assert.equal(reused.kind, "existing"); assert.equal(inserts, 0); assert.equal(reads, 1);
  reads = 0; inserts = 0;
  const concurrent = await createOrGetBacklinkVerificationJob(baseInput, { getJobByKey: async () => { reads++; return reads === 1 ? null : existing; }, createJob: async () => { inserts++; throw new BacklinkRepositoryError({ code: "CONFLICT", operation: "create", message: "conflict" }); } });
  assert.equal(concurrent.kind, "existing"); assert.equal(reads, 2); assert.equal(inserts, 1);
  await assert.rejects(createOrGetBacklinkVerificationJob(baseInput, { getJobByKey: async () => null, createJob: async () => { throw new BacklinkRepositoryError({ code: "DATABASE", operation: "create", message: "db" }); } }), /db/);
  await assert.rejects(createOrGetBacklinkVerificationJob(baseInput, { getJobByKey: async () => null, createJob: async () => { throw new BacklinkRepositoryError({ code: "CONFLICT", operation: "create", message: "conflict" }); } }), /conflicts/);
  let called = false; await assert.rejects(createOrGetBacklinkVerificationJob({ ...baseInput, jobKey: "" }, { getJobByKey: async () => { called = true; return null; }, createJob: async (input) => job(input) }), /invalid/); assert.equal(called, false);
  const secondWorkspace = await createOrGetBacklinkVerificationJob({ ...baseInput, workspaceId: "00000000-0000-4000-8000-000000000099" }, { getJobByKey: async () => null, createJob: async (input) => job(input) }); assert.equal(secondWorkspace.kind, "created");
  const snapshot = JSON.stringify(baseInput); const immutable = await createOrGetBacklinkVerificationJob(baseInput, { getJobByKey: async () => null, createJob: async (input) => job(input) }); assert.equal(JSON.stringify(baseInput), snapshot); assert.equal(immutable.job.jobKey, baseInput.jobKey);
  console.log("PASS — Backlink verification job smoke");
}
void main();

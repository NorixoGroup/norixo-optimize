import assert from "node:assert/strict";

import type { BacklinkLinkRow } from "../lib/backlinks/repositories/linksRepository";
import {
  buildBacklinkVerificationAttempt,
  executeBacklinkVerificationRun,
  type BacklinkVerificationRunResult,
  type BacklinkVerificationRuntimeResult,
  type ExecuteBacklinkVerificationRunDependencies,
  type PersistBacklinkVerificationResult,
} from "../lib/backlinks/verification";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const linkId = "00000000-0000-4000-8000-000000000002";
const sourceUrl = "https://publisher.example/resources";
const targetUrl = "https://norixo.example/revpar";

const link: BacklinkLinkRow = {
  id: linkId,
  workspace_id: workspaceId,
  outreach_id: "00000000-0000-4000-8000-000000000003",
  opportunity_id: "00000000-0000-4000-8000-000000000004",
  domain_id: "00000000-0000-4000-8000-000000000005",
  asset_id: "00000000-0000-4000-8000-000000000006",
  backlink_key: "BL-LNK-000001",
  source_url: sourceUrl,
  target_url: targetUrl,
  anchor_text: null,
  rel_type: null,
  link_location: null,
  status: "observed",
  acquired_at: "2026-07-31T09:00:00.000Z",
  first_verified_at: null,
  last_verified_at: null,
  last_seen_at: null,
  lost_at: null,
  lost_reason: null,
  verification_source: null,
  verification_evidence: null,
  created_by: null,
  created_at: "2026-07-31T09:00:00.000Z",
  updated_at: "2026-07-31T09:00:00.000Z",
};

function response(status = 200) {
  return {
    requestedUrl: sourceUrl,
    finalUrl: "https://publisher.example/final-resources",
    status,
    contentType: "text/html",
    redirectCount: 1,
    fetchedAt: "2026-07-31T10:00:00.000Z",
  };
}

function verified(status: "FOUND" | "NOT_FOUND"): BacklinkVerificationRuntimeResult {
  return {
    kind: "verified",
    response: response(),
    verification: {
      status,
      verifiedAt: "2026-07-31T10:01:00.000Z",
      evidence: { checkedAt: "2026-07-31T10:01:00.000Z", sourceUrl, targetUrl },
      issues: [],
    },
  };
}

function skipped(reason: "fetch_error" | "http_unusable" | "stale_result"): PersistBacklinkVerificationResult {
  return { kind: "skipped", reason };
}

function createDependencies(
  runtimeResult: BacklinkVerificationRuntimeResult,
  persistenceResult: PersistBacklinkVerificationResult,
  calls: string[],
): ExecuteBacklinkVerificationRunDependencies {
  return {
    getLink: async (receivedWorkspaceId, receivedLinkId) => {
      calls.push("getLink");
      assert.equal(receivedWorkspaceId, workspaceId);
      assert.equal(receivedLinkId, linkId);
      return link;
    },
    executeRuntime: async (input) => {
      calls.push("runtime");
      assert.equal(input.sourceUrl, sourceUrl);
      assert.equal(input.targetUrl, targetUrl);
      assert.equal(input.checkedAt, "2026-07-31T10:01:00.000Z");
      return runtimeResult;
    },
    recordAttempt: async (input) => {
      calls.push("attempt");
      return {
        ...buildBacklinkVerificationAttempt(input),
        id: "attempt-1",
        createdAt: "2026-07-31T10:02:00.000Z",
      };
    },
    recordAttemptDependencies: {
      createAttempt: async () => {
        throw new Error("The run smoke must inject recordAttempt directly.");
      },
    },
    persistCurrentState: async (input) => {
      calls.push("persistence");
      assert.equal(input.workspaceId, workspaceId);
      assert.equal(input.linkId, linkId);
      assert.equal(input.runtimeResult, runtimeResult);
      return persistenceResult;
    },
    persistenceDependencies: {
      getLink: async () => link,
      updateVerification: async () => link,
    },
  };
}

async function run(
  runtimeResult: BacklinkVerificationRuntimeResult,
  persistenceResult: PersistBacklinkVerificationResult,
): Promise<{ calls: string[]; result: BacklinkVerificationRunResult }> {
  const calls: string[] = [];
  const input = {
    workspaceId,
    linkId,
    triggerSource: "manual" as const,
    attemptedAt: "2026-07-31T10:01:00.000Z",
    policy: { strictAnchor: true },
    http: {
      timeoutMs: 1_000,
      maxRedirects: 3,
      maxResponseBytes: 10_000,
      userAgent: "Norixo verification smoke",
    },
  };
  const inputSnapshot = JSON.stringify(input);
  const linkSnapshot = JSON.stringify(link);
  const runtimeSnapshot = JSON.stringify(runtimeResult);
  const result = await executeBacklinkVerificationRun(
    input,
    createDependencies(runtimeResult, persistenceResult, calls),
  );

  assert.deepEqual(calls, ["getLink", "runtime", "attempt", "persistence"]);
  assert.equal(JSON.stringify(input), inputSnapshot);
  assert.equal(JSON.stringify(link), linkSnapshot);
  assert.equal(JSON.stringify(runtimeResult), runtimeSnapshot);
  assert.equal(result.runtimeResult, runtimeResult);
  assert.equal(result.attempt.linkId, linkId);
  assert.equal(result.persistenceResult, persistenceResult);
  return { calls, result };
}

async function main(): Promise<void> {
  const found = await run(verified("FOUND"), { kind: "persisted", link });
  assert.equal(found.result.attempt.verificationStatus, "FOUND");

  const notFound = await run(verified("NOT_FOUND"), { kind: "persisted", link });
  assert.equal(notFound.result.attempt.verificationStatus, "NOT_FOUND");

  const http404 = await run(
    { kind: "http_unusable", reason: "http_client_error", response: response(404) },
    skipped("http_unusable"),
  );
  assert.equal(http404.result.attempt.verificationStatus, null);
  assert.equal(http404.result.persistenceResult.kind, "skipped");

  const http500 = await run(
    { kind: "http_unusable", reason: "http_server_error", response: response(500) },
    skipped("http_unusable"),
  );
  assert.equal(http500.result.attempt.httpStatus, 500);

  const timeout = await run(
    { kind: "fetch_error", error: { code: "AbortError", message: "Request timed out" } },
    skipped("fetch_error"),
  );
  assert.equal(timeout.result.attempt.runtimeKind, "fetch_error");

  const stale = await run(verified("FOUND"), skipped("stale_result"));
  assert.equal(stale.result.persistenceResult.kind, "skipped");
  if (stale.result.persistenceResult.kind === "skipped") {
    assert.equal(stale.result.persistenceResult.reason, "stale_result");
  }

  const historyFailureCalls: string[] = [];
  const historyFailureDependencies = createDependencies(verified("FOUND"), { kind: "persisted", link }, historyFailureCalls);
  historyFailureDependencies.recordAttempt = async () => {
    historyFailureCalls.push("attempt");
    throw new Error("attempt write failed");
  };
  await assert.rejects(
    executeBacklinkVerificationRun(
      {
        workspaceId,
        linkId,
        triggerSource: "manual",
        attemptedAt: "2026-07-31T10:01:00.000Z",
        policy: {},
        http: { timeoutMs: 1_000, maxRedirects: 3, maxResponseBytes: 10_000, userAgent: "smoke" },
      },
      historyFailureDependencies,
    ),
    /attempt write failed/,
  );
  assert.deepEqual(historyFailureCalls, ["getLink", "runtime", "attempt"]);

  const stateFailureCalls: string[] = [];
  const stateFailureDependencies = createDependencies(verified("FOUND"), { kind: "persisted", link }, stateFailureCalls);
  stateFailureDependencies.persistCurrentState = async () => {
    stateFailureCalls.push("persistence");
    throw new Error("state update failed");
  };
  await assert.rejects(
    executeBacklinkVerificationRun(
      {
        workspaceId,
        linkId,
        triggerSource: "manual",
        attemptedAt: "2026-07-31T10:01:00.000Z",
        policy: {},
        http: { timeoutMs: 1_000, maxRedirects: 3, maxResponseBytes: 10_000, userAgent: "smoke" },
      },
      stateFailureDependencies,
    ),
    /state update failed/,
  );
  assert.deepEqual(stateFailureCalls, ["getLink", "runtime", "attempt", "persistence"]);

  const loadFailureCalls: string[] = [];
  const loadFailureDependencies = createDependencies(verified("FOUND"), { kind: "persisted", link }, loadFailureCalls);
  loadFailureDependencies.getLink = async () => {
    loadFailureCalls.push("getLink");
    throw new Error("link not found");
  };
  await assert.rejects(
    executeBacklinkVerificationRun(
      {
        workspaceId,
        linkId,
        triggerSource: "manual",
        attemptedAt: "2026-07-31T10:01:00.000Z",
        policy: {},
        http: { timeoutMs: 1_000, maxRedirects: 3, maxResponseBytes: 10_000, userAgent: "smoke" },
      },
      loadFailureDependencies,
    ),
    /link not found/,
  );
  assert.deepEqual(loadFailureCalls, ["getLink"]);

  console.log("PASS — Backlink verification run smoke");
}

void main();

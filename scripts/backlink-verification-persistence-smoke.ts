import assert from "node:assert/strict";

import { persistBacklinkVerificationResult } from "../lib/backlinks/verification";
import type { BacklinkVerificationRuntimeResult } from "../lib/backlinks/verification";
import type { BacklinkLinkRow } from "../lib/backlinks/repositories/linksRepository";
import type { UpdateLinkVerificationInput } from "../lib/backlinks/services/linkService";

const workspaceId = "00000000-0000-0000-0000-000000000001";
const linkId = "00000000-0000-0000-0000-000000000002";
const checkedAt = "2026-07-31T12:00:00.000Z";
const verifiedResponse = {
  requestedUrl: "https://publisher.example/resources",
  finalUrl: "https://publisher.example/resources",
  status: 200,
  contentType: "text/html",
  redirectCount: 0,
  fetchedAt: checkedAt,
};

function linkFixture(overrides: Partial<BacklinkLinkRow> = {}): BacklinkLinkRow {
  return {
    acquired_at: "2026-07-01T12:00:00.000Z",
    anchor_text: null,
    asset_id: "00000000-0000-0000-0000-000000000003",
    backlink_key: "BL-LNK-000001",
    created_at: "2026-07-01T12:00:00.000Z",
    created_by: null,
    domain_id: "00000000-0000-0000-0000-000000000004",
    first_verified_at: null,
    id: linkId,
    last_seen_at: null,
    last_verified_at: null,
    link_location: null,
    lost_at: null,
    lost_reason: null,
    opportunity_id: "00000000-0000-0000-0000-000000000005",
    outreach_id: "00000000-0000-0000-0000-000000000006",
    rel_type: null,
    source_url: "https://publisher.example/resources",
    status: "observed",
    target_url: "https://norixo.io/calculators/revpar",
    updated_at: "2026-07-01T12:00:00.000Z",
    verification_evidence: null,
    verification_source: null,
    workspace_id: workspaceId,
    ...overrides,
  };
}

function runtimeResult(
  status: "FOUND" | "NOT_FOUND" | "UNKNOWN",
): Extract<BacklinkVerificationRuntimeResult, { kind: "verified" }> {
  return {
    kind: "verified",
    response: verifiedResponse,
    verification: {
      status,
      issues: [],
      evidence: { checkedAt },
      verifiedAt: checkedAt,
    },
  };
}

function createDependencies(existingLink: BacklinkLinkRow) {
  const updates: UpdateLinkVerificationInput[] = [];

  return {
    updates,
    dependencies: {
      getLink: async () => existingLink,
      updateVerification: async (
        _workspaceId: string,
        _linkId: string,
        update: UpdateLinkVerificationInput,
      ) => {
        updates.push(update);
        return { ...existingLink, ...update };
      },
    },
  };
}

async function main(): Promise<void> {
  const foundLink = linkFixture();
  const foundRuntimeResult = runtimeResult("FOUND");
  const foundInput = { workspaceId, linkId, runtimeResult: foundRuntimeResult };
  const foundSetup = createDependencies(foundLink);
  const found = await persistBacklinkVerificationResult(
    foundInput,
    foundSetup.dependencies,
  );
  assert.equal(found.kind, "persisted");
  assert.equal(foundSetup.updates.length, 1);
  assert.deepEqual(foundSetup.updates[0]?.status, "active");
  assert.deepEqual(foundSetup.updates[0]?.first_verified_at, checkedAt);
  assert.deepEqual(foundSetup.updates[0]?.last_seen_at, checkedAt);
  assert.deepEqual(foundSetup.updates[0]?.lost_at, null);
  assert.deepEqual(foundSetup.updates[0]?.lost_reason, null);
  assert.equal(foundLink.first_verified_at, null);
  assert.equal(foundLink.lost_at, null);
  assert.equal(foundRuntimeResult.verification.status, "FOUND");
  assert.equal(foundInput.linkId, linkId);

  const missingSetup = createDependencies(linkFixture());
  const missing = await persistBacklinkVerificationResult(
    { workspaceId, linkId, runtimeResult: runtimeResult("NOT_FOUND") },
    missingSetup.dependencies,
  );
  assert.equal(missing.kind, "persisted");
  assert.equal(missingSetup.updates[0]?.status, "lost");
  assert.equal(missingSetup.updates[0]?.lost_at, checkedAt);
  assert.equal(missingSetup.updates[0]?.lost_reason, "link_not_found");

  const skippedSetup = createDependencies(linkFixture());
  for (const result of [
    { kind: "http_unusable", reason: "http_client_error" as const, response: verifiedResponse },
    { kind: "http_unusable", reason: "http_server_error" as const, response: verifiedResponse },
    { kind: "fetch_error", error: { code: "FETCH_ERROR", message: "Timed out" } },
  ] as BacklinkVerificationRuntimeResult[]) {
    const skipped = await persistBacklinkVerificationResult({ workspaceId, linkId, runtimeResult: result }, skippedSetup.dependencies);
    assert.equal(skipped.kind, "skipped");
  }
  assert.equal(skippedSetup.updates.length, 0);

  const staleSetup = createDependencies(linkFixture({ last_verified_at: checkedAt }));
  const stale = await persistBacklinkVerificationResult(
    { workspaceId, linkId, runtimeResult: runtimeResult("FOUND") },
    staleSetup.dependencies,
  );
  assert.deepEqual(stale, { kind: "skipped", reason: "stale_result" });
  assert.equal(staleSetup.updates.length, 0);

  const recoveredSetup = createDependencies(linkFixture({
    status: "lost",
    first_verified_at: "2026-07-10T12:00:00.000Z",
    lost_at: "2026-07-20T12:00:00.000Z",
    lost_reason: "link_not_found",
  }));
  await persistBacklinkVerificationResult(
    { workspaceId, linkId, runtimeResult: runtimeResult("FOUND") },
    recoveredSetup.dependencies,
  );
  assert.equal(recoveredSetup.updates[0]?.first_verified_at, "2026-07-10T12:00:00.000Z");
  assert.equal(recoveredSetup.updates[0]?.lost_at, null);
  assert.equal(recoveredSetup.updates[0]?.lost_reason, null);

  const unknownSetup = createDependencies(linkFixture());
  const unknown = await persistBacklinkVerificationResult(
    { workspaceId, linkId, runtimeResult: runtimeResult("UNKNOWN") },
    unknownSetup.dependencies,
  );
  assert.deepEqual(unknown, { kind: "skipped", reason: "unresolved_verification" });
  assert.equal(unknownSetup.updates.length, 0);

  console.info("PASS — Backlink verification persistence smoke");
}

void main();

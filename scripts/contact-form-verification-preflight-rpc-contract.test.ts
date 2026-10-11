import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { BacklinkRepositoryClient } from "../lib/backlinks/repositories/repositoryClient";
import type { ContactFormVerificationPreflight } from "../lib/backlinks/repositories/contactFormVerificationPreflightRepository";
import { claimContactFormVerificationPreflight, completeVerifiedContactFormVerificationPreflightAtomically, reconcileAbandonedContactFormVerificationPreflight } from "../lib/backlinks/repositories/contactFormVerificationPreflightRepository";

const row: ContactFormVerificationPreflight = {
  id: "preflight-id", workspace_id: "workspace-id", contact_id: "contact-id", form_url: "https://example.test/contact", idempotency_key: "key", status: "running", attempt_count: 1,
  requested_by: "user-id", requested_at: "2026-10-09T12:00:00.000Z", started_at: "2026-10-09T12:00:00.000Z", completed_at: null, cooldown_until: null, worker_id: "worker-id", safe_error_code: null, created_at: "2026-10-09T12:00:00.000Z", updated_at: "2026-10-09T12:00:00.000Z",
};

function clientFor(data: unknown, calls: Array<{ name: string; args: unknown }> = []) {
  return {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data, error: null };
    },
  } as unknown as BacklinkRepositoryClient;
}

const claimInput = { workspaceId: "workspace-id", preflightId: "preflight-id", workerId: "worker-id", startedAt: "2026-10-09T12:00:00.000Z" };

void (async () => {
  const claimed = await claimContactFormVerificationPreflight(clientFor({ claimed: true, preflight: row }), claimInput);
  assert.equal(claimed.claimed, true); assert.deepEqual(claimed.preflight, row);

  const notClaimed = await claimContactFormVerificationPreflight(clientFor({ claimed: false, preflight: row }), claimInput);
  assert.equal(notClaimed.claimed, false); assert.deepEqual(notClaimed.preflight, row);

  for (const malformed of [{ claimed: true }, { claimed: "true", preflight: row }, { claimed: true, preflight: { ...row, status: "unknown" } }]) {
    await assert.rejects(() => claimContactFormVerificationPreflight(clientFor(malformed), claimInput), /invalid preflight response/i);
  }

  const atomicCalls: Array<{ name: string; args: unknown }> = [];
  const atomic = await completeVerifiedContactFormVerificationPreflightAtomically(clientFor({ ...row, status: "verified" }, atomicCalls), {
    workspaceId: "workspace-id", preflightId: "preflight-id", workerId: "worker-id", contactId: "contact-id", formUrl: "https://example.test/contact", verifiedAt: "2026-10-09T12:00:00.000Z", evidenceVersion: "cfv1", safeEvidence: {}, completedAt: "2026-10-09T12:00:01.000Z",
  });
  assert.equal(atomic.status, "verified"); assert.equal(atomicCalls[0]?.name, "complete_verified_backlink_contact_form_preflight_atomic");
  await assert.rejects(() => completeVerifiedContactFormVerificationPreflightAtomically(clientFor({ ...row, status: "unknown" }), {
    workspaceId: "workspace-id", preflightId: "preflight-id", workerId: "worker-id", contactId: "contact-id", formUrl: "https://example.test/contact", verifiedAt: "2026-10-09T12:00:00.000Z", evidenceVersion: "cfv1", safeEvidence: {}, completedAt: "2026-10-09T12:00:01.000Z",
  }), /invalid preflight response/i);

  const reconciliationCalls: Array<{ name: string; args: unknown }> = [];
  const reconciled = await reconcileAbandonedContactFormVerificationPreflight(clientFor({ ...row, status: "failed" }, reconciliationCalls), { workspaceId: "workspace-id", preflightId: "preflight-id", reconciledBy: "admin-id" });
  assert.equal(reconciled.status, "failed"); assert.deepEqual(reconciliationCalls[0], { name: "reconcile_abandoned_backlink_contact_form_preflight", args: { p_workspace_id: "workspace-id", p_preflight_id: "preflight-id", p_reconciled_by: "admin-id" } });
  await assert.rejects(() => reconcileAbandonedContactFormVerificationPreflight(clientFor({ ...row, status: "unknown" }), { workspaceId: "workspace-id", preflightId: "preflight-id", reconciledBy: "admin-id" }), /invalid preflight response/i);

  const types = readFileSync("types/database.types.ts", "utf8");
  const repository = readFileSync("lib/backlinks/repositories/contactFormVerificationPreflightRepository.ts", "utf8");
  const worker = readFileSync("lib/backlinks/services/contactFormVerificationPreflightWorker.ts", "utf8");
  const claimMigration = readFileSync("supabase/migrations/20261009170000_make_contact_form_preflight_claims_exclusive.sql", "utf8");
  const preflightMigration = readFileSync("supabase/migrations/20261009120000_add_backlink_contact_form_verification_preflights.sql", "utf8");
  const atomicMigration = readFileSync("supabase/migrations/20261009130000_add_atomic_contact_form_preflight_completion.sql", "utf8");
  for (const token of ["backlink_contact_form_preflight_reconciliations:", "complete_verified_backlink_contact_form_preflight_atomic:", "reconcile_abandoned_backlink_contact_form_preflight:", "Returns: Json"]) assert(types.includes(token), `missing database type ${token}`);
  assert(!types.includes("p_reconciled_at"), "removed four-argument reconciliation signature must not be typed");
  assert(!repository.includes("as never") && !repository.includes("as any"), "A4-D8 repository RPC calls must not hide missing contracts");
  assert(claimMigration.includes("claimed_at := clock_timestamp();"), "claim must capture a database-authoritative timestamp after locking");
  assert(claimMigration.includes("r.cooldown_until > claimed_at"), "claim cooldown must use the database timestamp");
  assert(claimMigration.includes("started_at=claimed_at"), "claim must persist the database timestamp");
  assert(!claimMigration.includes("r.cooldown_until > p_started_at"), "caller timestamp must not control cooldown");
  assert(preflightMigration.includes("p_status not in ('manual_review','failed','blocked')"), "legacy completion must reject verified status");
  assert(preflightMigration.includes("CONTACT_FORM_PREFLIGHT_LEGACY_VERIFIED_FORBIDDEN"), "legacy verified rejection must be explicit");
  assert(preflightMigration.includes("completed_time := clock_timestamp();"), "legacy completion must capture a database-authoritative timestamp after locking");
  assert(preflightMigration.includes("completed_at=completed_time"), "legacy completion must persist the database timestamp");
  assert(preflightMigration.includes("completed_time + interval '15 minutes'"), "legacy completion cooldown must derive from the database timestamp");
  assert(!preflightMigration.includes("completed_at=p_completed_at"), "caller completion timestamp must not be persisted");
  assert(atomicMigration.includes("completed_time := clock_timestamp();"), "atomic completion must capture a database-authoritative completion timestamp");
  assert(atomicMigration.includes("p_verified_at > completed_time"), "atomic completion must reject future evidence timestamps");
  assert(atomicMigration.includes("completed_at=completed_time"), "atomic completion must persist the database timestamp");
  assert(!worker.includes('status: "verified" | "manual_review" | "failed" | "blocked"'), "worker legacy completion contract must not permit verified");
  console.log("PASS — contact-form verification preflight RPC contracts");
})().catch((error) => { console.error(error); process.exitCode = 1; });

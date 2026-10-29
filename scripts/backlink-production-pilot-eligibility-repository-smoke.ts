import assert from "node:assert/strict";

import {
  approveProductionPilotEligibility,
  getProductionPilotEligibility,
  revokeProductionPilotEligibility,
  type ProductionPilotEligibilityRpcClient,
} from "../lib/backlinks/repositories/productionPilotEligibilityRepository";

const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
const client: ProductionPilotEligibilityRpcClient = {
  async rpc(name: string, args: Record<string, unknown>) {
    calls.push({ name, args });
    if (name === "get_backlink_production_pilot_eligibility") {
      return { data: [{ eligibility_id: "eligibility-1", origin_kind: "real", status: "approved", source_reference: "https://source.example/proof", review_reason: "Verified editorial relevance and provenance.", reviewed_by: "admin-1", reviewed_at: "2026-10-28T10:00:00Z", created_by: "admin-1", created_at: "2026-10-28T10:00:00Z", updated_at: "2026-10-28T10:00:00Z", audit_history: [{ action: "approved", reason: "Verified editorial relevance and provenance.", actor_user_id: "admin-1", created_at: "2026-10-28T10:00:00Z" }] }], error: null } as never;
    }
    return { data: [{ eligibility_id: "eligibility-1", status: name.startsWith("approve") ? "approved" : "revoked", disposition: name.startsWith("approve") ? "approved" : "revoked" }], error: null } as never;
  },
};

const base = { workspaceId: "workspace-1", contactId: "contact-1", opportunityId: "opportunity-1", actorUserId: "admin-1" };
async function main() {
  const approval = await approveProductionPilotEligibility(client, { ...base, sourceReference: "https://source.example/provenance", reason: "Verified editorial relevance and authentic source." });
  assert.equal(approval.status, "approved");
  assert.equal(calls[0]?.name, "approve_backlink_production_pilot_eligibility");
  const state = await getProductionPilotEligibility(client, base);
  assert.equal(state?.auditHistory.length, 1);
  assert.equal(state?.originKind, "real");
  const revocation = await revokeProductionPilotEligibility(client, { ...base, reason: "Pilot cancelled before any provider operation." });
  assert.equal(revocation.status, "revoked");
  const beforeInvalid = calls.length;
  await assert.rejects(approveProductionPilotEligibility(client, { ...base, sourceReference: "short", reason: "short" }));
  assert.equal(calls.length, beforeInvalid, "invalid input must never reach the RPC");
  console.log("PASS backlink production pilot eligibility repository smoke");
}

void main();

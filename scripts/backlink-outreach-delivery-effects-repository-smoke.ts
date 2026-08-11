import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

import {
  applyBacklinkOutreachProviderComplaint,
  applyBacklinkOutreachProviderPermanentBounce,
  getBacklinkOutreachDeliveryEffectByDeliveryEventId,
  type ApplyBacklinkOutreachProviderComplaintRpcClient,
  type ApplyBacklinkOutreachProviderPermanentBounceRpcClient,
  type BacklinkOutreachDeliveryEffectRow,
  type BacklinkOutreachDeliveryEffectsReadClient,
} from "../lib/backlinks/repositories/outreachDeliveryEffectsRepository";

const effect: BacklinkOutreachDeliveryEffectRow = {
  id: "effect-1", workspace_id: "workspace-1", delivery_event_id: "delivery-event-1", outreach_id: "outreach-1", contact_id: "contact-1", effect_kind: "provider_complaint_stop", status: "applied", applied_at: "2026-08-11T12:00:00.000Z", created_at: "2026-08-11T12:00:00.000Z",
};

function readClient(result: BacklinkOutreachDeliveryEffectRow | null, error: unknown = null): BacklinkOutreachDeliveryEffectsReadClient {
  return {
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => {
          assert.equal(table, "backlink_outreach_delivery_effects");
          assert.equal(columns, "*");
          assert.equal(column, "delivery_event_id");
          assert.equal(value, "delivery-event-1");
          return { maybeSingle: async () => ({ data: result, error }) };
        },
      }),
    }),
  };
}

function rpcClient(disposition: "applied" | "existing", error: unknown = null): ApplyBacklinkOutreachProviderComplaintRpcClient {
  return {
    rpc: async (name, args) => {
      assert.equal(name, "apply_backlink_outreach_provider_complaint");
      assert.deepEqual(args, { p_delivery_event_id: "delivery-event-1", p_applied_at: "2026-08-11T12:00:00.000Z" });
      return {
        data: error == null ? [{ disposition, delivery_event_id: "delivery-event-1", outreach_id: "outreach-1", contact_id: "contact-1", contact_status: "do_not_contact", outreach_status: "closed", applied_at: "2026-08-11T12:00:00.000Z" }] : null,
        error,
      };
    },
  };
}

function permanentBounceRpcClient(disposition: "applied" | "existing", error: unknown = null): ApplyBacklinkOutreachProviderPermanentBounceRpcClient {
  return {
    rpc: async (name, args) => {
      assert.equal(name, "apply_backlink_outreach_provider_permanent_bounce");
      assert.deepEqual(args, { p_delivery_event_id: "delivery-event-1", p_applied_at: "2026-08-11T12:00:00.000Z" });
      return {
        data: error == null ? [{ disposition, delivery_event_id: "delivery-event-1", outreach_id: "outreach-1", contact_id: "contact-1", contact_status: "do_not_contact", outreach_status: "closed", applied_at: "2026-08-11T12:00:00.000Z" }] : null,
        error,
      };
    },
  };
}

async function main() {
  const source = readFileSync(new URL("../lib/backlinks/repositories/outreachDeliveryEffectsRepository.ts", import.meta.url), "utf8");
  for (const forbidden of ['.from("backlink_contacts")', '.from("backlink_outreach")', '.from("backlink_outreach_attempts")', ".insert(", ".update(", ".delete(", "outreachEmailProvider", "sendTransactionalEmail"]) {
    assert(!source.includes(forbidden), `Delivery Effect repository must not use ${forbidden}`);
  }

  assert.deepEqual(await getBacklinkOutreachDeliveryEffectByDeliveryEventId(readClient(effect), "delivery-event-1"), effect);
  assert.equal(await getBacklinkOutreachDeliveryEffectByDeliveryEventId(readClient(null), "delivery-event-1"), null);

  const input = { deliveryEventId: "delivery-event-1", appliedAt: "2026-08-11T12:00:00.000Z" };
  const applied = await applyBacklinkOutreachProviderComplaint(rpcClient("applied"), input);
  assert.deepEqual(applied, { disposition: "applied", deliveryEventId: "delivery-event-1", outreachId: "outreach-1", contactId: "contact-1", contactStatus: "do_not_contact", outreachStatus: "closed", appliedAt: "2026-08-11T12:00:00.000Z" });
  const existing = await applyBacklinkOutreachProviderComplaint(rpcClient("existing"), input);
  assert.equal(existing.disposition, "existing");
  await assert.rejects(() => applyBacklinkOutreachProviderComplaint(rpcClient("applied", { code: "P0001", message: "BACKLINK_OUTREACH_PROVIDER_COMPLAINT_EVENT_TYPE_INVALID" }), input), { code: "VALIDATION" });

  const permanentApplied = await applyBacklinkOutreachProviderPermanentBounce(permanentBounceRpcClient("applied"), input);
  assert.deepEqual(permanentApplied, { disposition: "applied", deliveryEventId: "delivery-event-1", outreachId: "outreach-1", contactId: "contact-1", contactStatus: "do_not_contact", outreachStatus: "closed", appliedAt: "2026-08-11T12:00:00.000Z" });
  assert.equal((await applyBacklinkOutreachProviderPermanentBounce(permanentBounceRpcClient("existing"), input)).disposition, "existing");
  await assert.rejects(() => applyBacklinkOutreachProviderPermanentBounce(permanentBounceRpcClient("applied", { code: "P0001", message: "BACKLINK_OUTREACH_PROVIDER_PERMANENT_BOUNCE_EVENT_INVALID" }), input), { code: "VALIDATION" });

  console.log("PASS — Backlink outreach delivery effects repository smoke");
}

void main();

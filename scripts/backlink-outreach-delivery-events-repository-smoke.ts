import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const source = await readFile("lib/backlinks/repositories/outreachDeliveryEventsRepository.ts", "utf8");
  const getStart = source.indexOf("export async function getBacklinkOutreachDeliveryEventByProviderEventId");
  const listStart = source.indexOf("export async function listBacklinkOutreachDeliveryEventsForOutreach");
  const createStart = source.indexOf("export async function createBacklinkOutreachDeliveryEvent");
  assert(getStart >= 0 && listStart > getStart && createStart > listStart, "Delivery Event repository functions are missing.");
  const lookup = source.slice(getStart, createStart);
  const list = source.slice(listStart, createStart);
  const create = source.slice(createStart);
  for (const value of ['.from("backlink_outreach_delivery_events")', '.eq("provider", normalizedProvider)', '.eq("provider_event_id", normalizedProviderEventId)', ".maybeSingle()"])
    assert(lookup.includes(value), `Missing provider event lookup invariant: ${value}`);
  for (const value of [
    "workspace_id:",
    "outreach_id:",
    "attempt_id:",
    "provider_event_id:",
    "provider_message_id:",
    "event_type:",
    "bounce_type:",
    "occurred_at:",
    "received_at:",
    ".insert(payload)",
    'disposition: "created"',
    'normalized.code !== "CONFLICT"',
    "getBacklinkOutreachDeliveryEventByProviderEventId",
    'disposition: "existing"',
  ]) assert(create.includes(value), `Missing create idempotence invariant: ${value}`);
  for (const value of ["BacklinkResendBounceType", "bounceType: BacklinkResendBounceType | null", "bounce_type: input.bounceType"]) assert(source.includes(value), `Missing canonical bounce persistence invariant: ${value}`);
  for (const value of ['.from("backlink_outreach_delivery_events")', '.eq("workspace_id", workspaceId)', '.eq("outreach_id", outreachId)', '.order("occurred_at", { ascending: false })', '.order("id", { ascending: false })']) assert(list.includes(value), `Missing Outreach Delivery Event read invariant: ${value}`);
  for (const forbidden of ["raw_payload", "recipient", "subject", "body", ".update(", ".delete(", "fetch(", "outreachEmailProvider"]) assert(!source.includes(forbidden), `Forbidden Delivery Event repository behavior: ${forbidden}`);
  console.log("PASS — Backlink outreach delivery events repository smoke");
}

void main();

import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main(): Promise<void> {
  const page = await readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8");

  for (const value of [
    "Enregistrer le backlink",
    "getConversationOpenLinkPrefill(outreach)",
    "openConversationOpenLinkEditor(outreach)",
    'openEditor("links", null, prefill)',
    "backlink_key",
    "outreach_id",
    "opportunity_id",
    "domain_id",
    "asset_id",
    "source_url",
    "target_url",
    "acquired_at",
    'openEditor(activeSection, null)',
  ]) {
    assert(page.includes(value), `Missing bridge invariant: ${value}`);
  }

  for (const forbidden of [
    "auto-create",
    "sendEmail",
    "Resend",
    "apiRequest(\"/api/backlinks/links\"",
    "createBacklinkLink",
    "POST /api/backlinks/links",
  ]) {
    assert(!page.includes(forbidden), `Forbidden bridge behavior: ${forbidden}`);
  }

  console.log("PASS — Backlink conversation_open link bridge UI smoke");
}

void main();

import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const source = await readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8");
  const start = source.indexOf("export async function getBacklinkOutreachAttemptByProviderMessageId");
  const end = source.indexOf("export async function listBacklinkOutreachAttemptsForOutreach", start);
  assert(start >= 0 && end > start, "Provider message lookup is missing.");
  const lookup = source.slice(start, end);
  for (const value of [
    'normalizedProvider !== "resend"',
    "providerMessageId.trim()",
    '.from("backlink_outreach_attempts")',
    '.eq("provider", normalizedProvider)',
    '.eq("provider_message_id", normalizedProviderMessageId)',
    ".maybeSingle()",
    "normalizeBacklinkRepositoryError",
  ]) assert(lookup.includes(value), `Missing Attempt provider-message lookup invariant: ${value}`);
  for (const forbidden of ["workspaceId", "recipient", "requested_at", ".update(", "fetch(", "resend"]) assert(forbidden === "resend" || !lookup.includes(forbidden), `Forbidden lookup heuristic or mutation: ${forbidden}`);
  console.log("PASS — Backlink outreach Attempt provider-message lookup smoke");
}

void main();

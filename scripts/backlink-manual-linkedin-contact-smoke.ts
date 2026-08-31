import { readFile } from "node:fs/promises";
import { recordBacklinkManualLinkedInInitialContact } from "@/lib/backlinks/repositories/outreachAttemptsRepository";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function mustReject(name: string, mutate: (source: string) => string, source: string) {
  try {
    validateMigration(mutate(source));
  } catch {
    return;
  }
  throw new Error(`Mutation was not rejected: ${name}`);
}

function validateMigration(source: string) {
  for (const required of [
    "create function public.record_backlink_manual_linkedin_initial_contact",
    "security definer",
    "set search_path = public",
    "for update",
    "outreach.channel <> 'linkedin'",
    "contact.contact_status = 'do_not_contact'",
    "contact.contact_status = 'archived'",
    "linkedin_recipient := nullif(trim(coalesce(contact.linkedin_url, '')), '')",
    "outreach.status = 'active' and outreach.current_attempt = 1",
    "outreach.status <> 'draft' or outreach.current_attempt <> 0",
    "attempt_kind = 'initial'",
    "'linkedin', 'manual', linkedin_recipient",
    "'initial', 'accepted'",
    "recorded_at_value, recorded_at_value, recorded_at_value",
    "status = 'active'",
    "current_attempt = 1",
    "first_contact_at = recorded_at_value",
    "last_attempt_at = recorded_at_value",
    "'existing'",
    "revoke all on function",
    "grant execute on function public.record_backlink_manual_linkedin_initial_contact(uuid, uuid, uuid) to service_role",
  ]) assert(source.includes(required), `Missing migration invariant: ${required}`);
  for (const forbidden of ["resend", "approve_backlink_outreach_initial_send", "snapshot", "email_normalized", "p_channel", "p_contact_id", "p_linkedin_url", "p_provider", "p_recorded_at"]) assert(!source.includes(forbidden), `Forbidden migration content: ${forbidden}`);
}

async function main() {
  const [migration, route, page, followUp] = await Promise.all([
    readFile("supabase/migrations/20260831160000_add_backlink_manual_linkedin_initial_contact.sql", "utf8"),
    readFile("app/api/backlinks/outreach/[id]/manual-contact/route.ts", "utf8"),
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    readFile("lib/backlinks/services/outreachFollowUpEligibilityService.ts", "utf8"),
  ]);
  validateMigration(migration);
  for (const required of ["export async function POST", "getRequestUserAndWorkspace(request)", "isAdminPrivateEmail(auth.user.email)", "Object.keys(body).length === 1", "body.confirm === true", "recordManualLinkedInInitialContact", "workspaceId: auth.workspace.id", "actorUserId: auth.user.id", "outreachId: id"]) assert(route.includes(required), `Missing route invariant: ${required}`);
  for (const forbidden of [".from(", "resend", "send", "linkedin_url", "workspaceId:", "actorUserId:", "outreachId:"]) {
    if (["workspaceId:", "actorUserId:", "outreachId:"].includes(forbidden)) continue;
    assert(!route.toLowerCase().includes(forbidden), `Forbidden route content: ${forbidden}`);
  }
  assert(page.includes('row.status === "draft" && row.channel === "email"'), "Email ready action is not channel-bound.");
  assert(page.includes('row.status === "draft" && row.channel === "linkedin" && row.current_attempt === 0'), "LinkedIn manual action predicate is missing.");
  assert(page.includes("Enregistrer le contact LinkedIn"), "LinkedIn manual action label is missing.");
  assert(page.includes('/manual-contact`'), "Manual contact route is not used by the UI.");
  assert(page.includes('JSON.stringify({ confirm: true })'), "Manual contact confirmation payload is missing.");
  assert(followUp.includes('outreach.channel !== "email"'), "Active LinkedIn may be included in automatic follow-up.");
  mustReject("row lock", (source) => source.replaceAll("for update", ""), migration);
  mustReject("service role grant", (source) => source.replace("to service_role", "to authenticated"), migration);
  mustReject("idempotent existing", (source) => source.replace("'existing'", "'changed'"), migration);
  mustReject("manual provider", (source) => source.replace("'linkedin', 'manual', linkedin_recipient", "'linkedin', 'resend', linkedin_recipient"), migration);
  const created = await recordBacklinkManualLinkedInInitialContact({ rpc: async () => ({ data: [{ disposition: "created", outreach_id: "outreach", attempt_id: "attempt", attempt_number: 1, recorded_at: "2026-08-31T00:00:00.000Z" }], error: null }) }, { workspaceId: "workspace", outreachId: "outreach", actorUserId: "actor" });
  assert(created.disposition === "created" && created.attemptNumber === 1, "Created RPC response did not normalize.");
  const existing = await recordBacklinkManualLinkedInInitialContact({ rpc: async () => ({ data: [{ disposition: "existing", outreach_id: "outreach", attempt_id: "attempt", attempt_number: 1, recorded_at: "2026-08-31T00:00:00.000Z" }], error: null }) }, { workspaceId: "workspace", outreachId: "outreach", actorUserId: "actor" });
  assert(existing.disposition === "existing", "Existing RPC response did not normalize.");
  await recordBacklinkManualLinkedInInitialContact({ rpc: async () => ({ data: [{ disposition: "created", outreach_id: "outreach", attempt_id: "attempt", attempt_number: 2, recorded_at: "2026-08-31T00:00:00.000Z" }], error: null }) }, { workspaceId: "workspace", outreachId: "outreach", actorUserId: "actor" }).then(() => { throw new Error("Malformed RPC response was accepted."); }, () => undefined);
  console.log("PASS — Manual LinkedIn contact static safety smoke");
}

void main();

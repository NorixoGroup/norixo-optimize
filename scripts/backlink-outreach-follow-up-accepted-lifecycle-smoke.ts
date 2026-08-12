import { readFile } from "node:fs/promises";

import { applyBacklinkOutreachFollowUpAccepted, type ApplyBacklinkOutreachFollowUpAcceptedRpcClient } from "../lib/backlinks/repositories/outreachAttemptsRepository";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const [migration, repository, types] = await Promise.all([
    readFile("supabase/migrations/20260811160000_add_backlink_outreach_follow_up_accepted_lifecycle_effect.sql", "utf8"),
    readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);
  for (const value of [
    "create table public.backlink_outreach_attempt_lifecycle_effects",
    "unique (attempt_id)",
    "effect_kind = 'follow_up_accepted'",
    "create function public.apply_backlink_outreach_follow_up_accepted",
    "attempt.attempt_kind <> 'follow_up'",
    "attempt.status not in ('requested', 'unknown', 'accepted')",
    "attempt.provider_message_id is distinct from normalized_provider_message_id",
    "outreach.current_attempt >= outreach.max_attempts",
    "status = 'accepted'",
    "current_attempt = current_attempt + 1",
    "last_attempt_at = p_accepted_at",
    "next_follow_up_at = null",
    "'existing'",
    "'applied'",
    "security definer",
    "set search_path = public",
    "grant execute",
  ]) assert(migration.includes(value), `Missing follow-up accepted invariant: ${value}`);
  for (const forbidden of ["outreachEmailProvider", "sendTransactionalEmail", "outreachEmailSendService", "scheduler", "first_contact_at =", "status = 'active'", "closed_at =", "stop_reason =", "last_response_type ="]) assert(!migration.includes(forbidden), `Forbidden follow-up accepted behavior: ${forbidden}`);
  for (const value of ["applyBacklinkOutreachFollowUpAccepted", "apply_backlink_outreach_follow_up_accepted", "p_provider_message_id: input.providerMessageId", "p_accepted_at: required(input.acceptedAt", "disposition !== \"applied\" && disposition !== \"existing\""]) assert(repository.includes(value), `Missing wrapper invariant: ${value}`);
  for (const value of ["apply_backlink_outreach_follow_up_accepted:", "p_provider_message_id: string | null", "current_attempt: number", "last_attempt_at: string | null"]) assert(types.includes(value), `Missing database type invariant: ${value}`);

  const client: ApplyBacklinkOutreachFollowUpAcceptedRpcClient = { rpc: async (name, args) => { assert(name === "apply_backlink_outreach_follow_up_accepted", "Wrapper must call the accepted follow-up RPC."); assert(args.p_workspace_id === "workspace" && args.p_outreach_id === "outreach" && args.p_attempt_id === "attempt" && args.p_provider_message_id === "message" && args.p_accepted_at === "2026-08-12T10:00:00.000Z", "Wrapper must pass bounded server arguments."); return { data: [{ disposition: "applied", attempt_status: "accepted", outreach_status: "active", current_attempt: 2, last_attempt_at: "2026-08-12T10:00:00.000Z" }], error: null }; } };
  const result = await applyBacklinkOutreachFollowUpAccepted(client, { workspaceId: "workspace", outreachId: "outreach", attemptId: "attempt", providerMessageId: "message", acceptedAt: "2026-08-12T10:00:00.000Z" });
  assert(result.disposition === "applied" && result.currentAttempt === 2 && result.lastAttemptAt === "2026-08-12T10:00:00.000Z", "Wrapper result must be normalized.");
  console.log("PASS — Backlink outreach follow-up accepted lifecycle smoke");
}

void main();

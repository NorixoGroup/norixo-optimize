import { readFile } from "node:fs/promises";
import { applyBacklinkOutreachFinalNoResponse } from "../lib/backlinks/services/outreachFinalNoResponseService";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const [migration, repository, types] = await Promise.all([
    readFile("supabase/migrations/20260811167000_add_backlink_outreach_final_no_response.sql", "utf8"),
    readFile("lib/backlinks/repositories/outreachRepository.ts", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);

  for (const value of [
    "create or replace function public.apply_backlink_outreach_final_no_response",
    "p_workspace_id uuid",
    "p_outreach_id uuid",
    "p_applied_at timestamptz",
    "status = 'no_response'",
    "last_response_type = null",
    "closed_at = p_applied_at",
    "stop_reason = 'attempt_limit'",
    "next_follow_up_at = null",
    "response_deadline_at = null",
    "outreach.status <> 'active'",
    "status in ('prepared', 'requested', 'unknown')",
    "effect_kind = 'reply_received_stop'",
    "contact.contact_status in ('do_not_contact', 'archived')",
    "nullif(trim(contact.email_normalized), '') is null",
    "revoke all on function public.apply_backlink_outreach_final_no_response(uuid, uuid, timestamptz) from public, anon, authenticated",
    "grant execute on function public.apply_backlink_outreach_final_no_response(uuid, uuid, timestamptz) to service_role",
    "security definer",
    "set search_path = public",
  ]) assert(migration.includes(value), `Missing final no-response invariant: ${value}`);

  for (const forbidden of [
    "outreachEmailProvider",
    "sendTransactionalEmail",
    "scheduler",
    "idempotencyKey",
    "confirmation",
    "providerMessageId",
    "errorCode",
    "errorMessage",
  ]) assert(!migration.includes(forbidden), `Forbidden final no-response behavior: ${forbidden}`);

  for (const value of [
    "applyBacklinkOutreachFinalNoResponse",
    "apply_backlink_outreach_final_no_response",
    "p_workspace_id: workspaceId",
    "p_outreach_id: outreachId",
    "p_applied_at: appliedAt",
  ]) assert(repository.includes(value), `Missing final no-response repository invariant: ${value}`);

  for (const value of [
    "apply_backlink_outreach_final_no_response: {",
    "p_workspace_id: string",
    "p_outreach_id: string",
    "p_applied_at: string",
    "outreach_status: string",
    "response_deadline_at: string | null",
  ]) assert(types.includes(value), `Missing final no-response database type invariant: ${value}`);

  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      assert(name === "apply_backlink_outreach_final_no_response", "RPC wrapper must call the final no-response RPC.");
      assert(args.p_workspace_id === "workspace" && args.p_outreach_id === "outreach", "RPC wrapper must scope workspace and outreach.");
      assert(args.p_applied_at === "2026-08-12T10:00:00.000Z", "RPC wrapper must pass the applied timestamp.");
      return {
        data: [{
          disposition: "applied",
          outreach_id: "outreach",
          outreach_status: "no_response",
          closed_at: "2026-08-12T10:00:00.000Z",
          stop_reason: "attempt_limit",
          next_follow_up_at: null,
          response_deadline_at: null,
        }],
        error: null,
      };
    },
  };

  const result = await applyBacklinkOutreachFinalNoResponse(client as never)({
    workspaceId: "workspace",
    actorUserId: "actor",
    outreachId: "outreach",
    appliedAt: "2026-08-12T10:00:00.000Z",
  });

  assert(JSON.stringify(result) === JSON.stringify({
    disposition: "applied",
    outreachId: "outreach",
    outreachStatus: "no_response",
    closedAt: "2026-08-12T10:00:00.000Z",
    stopReason: "attempt_limit",
    nextFollowUpAt: null,
    responseDeadlineAt: null,
  }), "Final no-response service must normalize the canonical result.");

  console.log("PASS — Backlink outreach final no-response RPC smoke");
}

void main();

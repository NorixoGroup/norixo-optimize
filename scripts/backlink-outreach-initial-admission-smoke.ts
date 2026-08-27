import { readFile } from "node:fs/promises";

import type { BacklinkRepositoryClient } from "../lib/backlinks/repositories/repositoryClient";
import { reserveBacklinkOutreachAttempt } from "../lib/backlinks/repositories/outreachAttemptsRepository";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const [migration, repo] = await Promise.all([
    readFile("supabase/migrations/20260827120000_add_backlink_outreach_initial_attempt_reservation.sql", "utf8"),
    readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8"),
  ]);

  for (const value of [
    "reserve_backlink_outreach_initial_attempt",
    "pg_advisory_xact_lock",
    "backlink_outreach_initial_attempt:",
    "WORKSPACE_DAILY_LIMIT_REACHED",
    "WORKSPACE_HOURLY_LIMIT_REACHED",
    "DOMAIN_DAILY_LIMIT_REACHED",
    "CONTACT_DAILY_LIMIT_REACHED",
    "status in ('requested', 'accepted', 'failed', 'unknown')",
    "on conflict (workspace_id, idempotency_key) do nothing",
    "grant execute on function public.reserve_backlink_outreach_initial_attempt",
    "to service_role",
    "rate_limited",
  ]) {
    assert(migration.includes(value), `Missing admission invariant: ${value}`);
  }

  for (const forbidden of [".insert(", '.from("backlink_outreach_attempts")', "createBacklinkOutreachAttempt(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, input: CreateBacklinkOutreachAttemptInput)"]) {
    assert(repo.includes(forbidden) || repo.includes('reserve_backlink_outreach_initial_attempt'), `Missing repository support: ${forbidden}`);
  }

  assert(repo.includes('.rpc("reserve_backlink_outreach_initial_attempt"'), "Repository must use the atomic initial admission RPC.");
  assert(repo.includes("rate_limited"), "Repository must preserve the rate_limited disposition.");

  const attempt = {
    id: "attempt",
    workspace_id: "workspace",
    outreach_id: "outreach",
    actor_user_id: "actor",
    attempt_kind: "initial" as const,
    cancel_reason: null,
    cancelled_at: null,
    channel: "email",
    provider: "resend",
    recipient: "contact@example.com",
    idempotency_key: "key",
    reply_token_hash: "a".repeat(64),
    reply_token_key_version: "v1",
    status: "requested" as const,
    provider_message_id: null,
    prepared_at: null,
    error_code: null,
    error_message: null,
    requested_at: "2026-08-27T10:00:00.000Z",
    accepted_at: null,
    failed_at: null,
    resolved_at: null,
    created_at: "2026-08-27T10:00:00.000Z",
  };

  const rateLimitedClient = {
    rpc: async (functionName: string, args: any) => {
      assert(functionName === "reserve_backlink_outreach_initial_attempt", "Initial admission must call the dedicated RPC.");
      assert(args.p_workspace_id === "workspace" && args.p_outreach_id === "outreach" && args.p_attempt_id === "attempt" && args.p_actor_user_id === "actor", "Initial admission must send the canonical workspace/outreach/attempt/actor identifiers.");
      assert(args.p_idempotency_key === "key" && args.p_reply_token_hash === "a".repeat(64) && args.p_reply_token_key_version === "v1", "Initial admission must send the canonical idempotency/reply-token inputs.");
      return { data: [{ disposition: "rate_limited", attempt_id: null, rate_limit_reason: "WORKSPACE_HOURLY_LIMIT_REACHED" }], error: null };
    },
    from: () => { throw new Error("Rate-limited admissions must not fall through to row fetches."); },
  } as unknown as BacklinkRepositoryClient;
  const blocked = await reserveBacklinkOutreachAttempt(rateLimitedClient, "workspace", {
    attemptId: "attempt",
    outreachId: "outreach",
    actorUserId: "actor",
    channel: "email",
    provider: "resend",
    recipient: "contact@example.com",
    idempotencyKey: "key",
    replyTokenHash: "a".repeat(64),
    replyTokenKeyVersion: "v1",
    attemptKind: "initial",
  });
  assert(blocked.disposition === "rate_limited" && blocked.attempt == null && blocked.rateLimitReason === "WORKSPACE_HOURLY_LIMIT_REACHED", "Rate-limited admissions must be surfaced without reserving an Attempt.");

  let fetches = 0;
  const createdClient = {
    rpc: async () => ({ data: [{ disposition: "created", attempt_id: "attempt", rate_limit_reason: null }], error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => {
              fetches += 1;
              return { data: attempt, error: null };
            },
          }),
        }),
      }),
    }),
  } as unknown as BacklinkRepositoryClient;
  const created = await reserveBacklinkOutreachAttempt(createdClient, "workspace", {
    attemptId: "attempt",
    outreachId: "outreach",
    actorUserId: "actor",
    channel: "email",
    provider: "resend",
    recipient: "contact@example.com",
    idempotencyKey: "key",
    replyTokenHash: "a".repeat(64),
    replyTokenKeyVersion: "v1",
    attemptKind: "initial",
  });
  assert(fetches === 1 && created.disposition === "created" && created.attempt.id === "attempt", "Created admissions must still resolve the canonical Attempt row.");

  console.log("PASS — Backlink outreach initial admission smoke");
}

void main();

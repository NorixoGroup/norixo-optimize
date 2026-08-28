import { readFile } from "node:fs/promises";

import type { BacklinkRepositoryClient } from "../lib/backlinks/repositories/repositoryClient";
import {
  reserveBacklinkOutreachApprovedInitialAttempt,
} from "../lib/backlinks/repositories/outreachAttemptsRepository";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const [migration, repo] = await Promise.all([
    readFile(
      "supabase/migrations/20260828120000_add_backlink_outreach_approval_aware_initial_attempt_reservation.sql",
      "utf8",
    ),
    readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8"),
  ]);

  for (const value of [
    "reserve_backlink_outreach_initial_attempt_for_approved_auto_send",
    "backlink_outreach_initial_attempt_snapshots",
    "live_initial_send_enabled",
    "auto_send_approved_at",
    "auto_send_approval_fingerprint",
    "approval_stale",
    "campaign_disabled",
    "not_approved",
    "missing_approved_content",
    "invalid_recipient",
    "ineligible",
    "grant execute on function public.reserve_backlink_outreach_initial_attempt_for_approved_auto_send",
    "to service_role",
  ]) {
    assert(migration.includes(value), `Missing approved-admission invariant: ${value}`);
  }

  assert(
    repo.includes("reserve_backlink_outreach_initial_attempt_for_approved_auto_send"),
    "Repository must use the approved initial admission RPC.",
  );
  assert(
    repo.includes("backlink_outreach_initial_attempt_snapshots"),
    "Repository must fetch the approved initial attempt snapshot.",
  );

  const snapshot = {
    attempt_id: "attempt",
    workspace_id: "workspace",
    idempotency_key: "key",
    outreach_id: "outreach",
    campaign_id: "campaign",
    opportunity_id: "opportunity",
    contact_id: "contact",
    recipient_email: "contact@example.com",
    subject: "Subject",
    body: "Body",
    channel: "email",
    target_url: "https://example.com/page",
    approved_at: "2026-08-28T10:00:00.000Z",
    approved_by: "actor",
    approval_fingerprint: "bl1_deadbeef",
    created_at: "2026-08-28T10:00:00.000Z",
  };
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
    requested_at: "2026-08-28T10:00:00.000Z",
    accepted_at: null,
    failed_at: null,
    resolved_at: null,
    created_at: "2026-08-28T10:00:00.000Z",
  };

  const client = {
    rpc: async (functionName: string, args: Record<string, unknown>) => {
      assert(
        functionName === "reserve_backlink_outreach_initial_attempt_for_approved_auto_send",
        "Approved initial admission must call the dedicated RPC.",
      );
      assert(
        args.p_workspace_id === "workspace" &&
          args.p_campaign_id === "campaign" &&
          args.p_outreach_id === "outreach" &&
          args.p_attempt_id === "attempt" &&
          args.p_actor_user_id === "actor",
        "Approved initial admission must pass the canonical identifiers.",
      );
      return { data: [{ disposition: "created", attempt_id: "attempt", rate_limit_reason: null }], error: null };
    },
    from: (table: string) => {
      const data = table === "backlink_outreach_attempts" ? attempt : snapshot;
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data, error: null }),
            }),
          }),
        }),
      };
    },
  } as unknown as BacklinkRepositoryClient;

  const created = await reserveBacklinkOutreachApprovedInitialAttempt(client, {
    workspaceId: "workspace",
    campaignId: "campaign",
    outreachId: "outreach",
    attemptId: "attempt",
    actorUserId: "actor",
    idempotencyKey: "key",
    replyTokenHash: "a".repeat(64),
    replyTokenKeyVersion: "v1",
    requestedAt: "2026-08-28T10:00:00.000Z",
  });

  assert(created.disposition === "created", "Approved initial admissions must create successfully.");
  assert(created.attempt.id === "attempt", "Approved initial admission must resolve the canonical attempt.");
  assert(created.snapshot.approval_fingerprint === "bl1_deadbeef", "Approved initial admission must resolve the canonical snapshot.");

  console.log("PASS — Backlink outreach approved initial admission smoke");
}

void main();

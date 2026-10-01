import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createOutreachEmailProvider } from "../lib/backlinks/providers/outreachEmailProvider";
import {
  isBacklinkEmailSuppressed,
  type BacklinkEmailSuppressionReadClient,
} from "../lib/backlinks/repositories/emailSuppressionsRepository";
import { reserveBacklinkOutreachApprovedInitialAttempt } from "../lib/backlinks/repositories/outreachAttemptsRepository";
import { sendApprovedBacklinkOutreachEmail } from "../lib/backlinks/services/outreachApprovedAutoSendService";
import { BacklinkOutreachEmailSendError } from "../lib/backlinks/services/outreachEmailSendService";
import { deriveBacklinkOutreachReplyCorrelationIdentity } from "../lib/backlinks/services/outreachReplyCorrelationIdentity";

/**
 * Pure smoke for A2 (G03 workspace gates, G04 campaign gate, pre-Resend suppression recheck).
 * No database, no network, no provider: `fetch` is a tripwire and the Resend client is never
 * built because `send` is always injected. Reservation-side SQL behaviour is covered by
 * scripts/backlink-send-gates-a2-sql-check.sql (disposable local database only).
 */

let networkCalls = 0;
globalThis.fetch = (async () => {
  networkCalls += 1;
  throw new Error("NETWORK_FORBIDDEN_IN_SMOKE");
}) as typeof fetch;

type Disposition =
  | "created"
  | "existing"
  | "workspace_controls_missing"
  | "workspace_backlinks_disabled"
  | "workspace_dry_run"
  | "campaign_not_active"
  | "campaign_disabled";

const WORKSPACE = "workspace";
const keyring = { activeKeyVersion: "v1", secrets: { v1: "a2-smoke-secret-0123456789" } };
const identity = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId: "550e8400-e29b-41d4-a716-446655440000", keyring });
const attempt = {
  id: identity.attemptId,
  workspace_id: WORKSPACE, outreach_id: "outreach", actor_user_id: "actor", attempt_kind: "initial",
  cancel_reason: null, cancelled_at: null, channel: "email", provider: "resend", recipient: "Snapshot@Example.com ",
  idempotency_key: "key", reply_token_hash: identity.tokenHash, reply_token_key_version: "v1", status: "requested",
  provider_message_id: null, prepared_at: null, error_code: null, error_message: null,
  requested_at: "2026-10-01T10:00:00.000Z", accepted_at: null, failed_at: null, resolved_at: null,
  created_at: "2026-10-01T10:00:00.000Z",
} as const;
const snapshot = {
  attempt_id: attempt.id, workspace_id: WORKSPACE, idempotency_key: "key", outreach_id: "outreach", campaign_id: "campaign",
  opportunity_id: "opportunity", contact_id: "contact", recipient_email: "Snapshot@Example.com ", subject: "Approved subject",
  body: "Approved body", channel: "email", target_url: "https://example.com", approved_at: "2026-10-01T09:00:00.000Z",
  approved_by: "actor", approval_fingerprint: "bl1_valid", created_at: "2026-10-01T10:00:00.000Z",
} as const;

function harness(options: {
  control: { backlinksEnabled: boolean; dryRunOnly: boolean } | null;
  disposition?: Disposition;
  providerSend: (input: { to: string; context?: { workspaceId: string; outreachId: string } }) => Promise<{ status: "accepted" | "failed" | "unknown"; provider: "resend"; providerMessageId: string | null; errorCode: string | null; errorMessage: string | null }>;
}) {
  const calls = { reserve: 0, provider: 0, accepted: 0, failed: [] as string[], activated: 0 };
  const service = sendApprovedBacklinkOutreachEmail({
    getWorkspaceControl: async () => options.control,
    getOutreach: async () => ({
      id: "outreach", campaign_id: "campaign", opportunity_id: "opportunity", contact_id: "contact", channel: "email",
      status: "ready", subject: "Mutable", body: "Mutable", current_attempt: 0, max_attempts: 3, first_contact_at: null, last_attempt_at: null,
    }),
    reserveApprovedInitialAttempt: async () => {
      calls.reserve += 1;
      const disposition = options.disposition ?? "created";
      if (disposition !== "created" && disposition !== "existing") return { attempt: null, snapshot: null, disposition, rateLimitReason: null } as const;
      return { attempt, snapshot, disposition, rateLimitReason: null } as const;
    },
    markAttemptAccepted: async () => { calls.accepted += 1; },
    markAttemptFailed: async (input) => { calls.failed.push(input.errorCode); },
    markAttemptUnknown: async () => undefined,
    sendEmail: async (input) => { calls.provider += 1; return options.providerSend(input); },
    activateOutreach: async (_workspaceId, _outreachId, activation) => {
      calls.activated += 1;
      return { id: "outreach", campaign_id: "campaign", opportunity_id: "opportunity", contact_id: "contact", channel: "email", status: activation.status, subject: null, body: null, current_attempt: activation.currentAttempt, max_attempts: 3, first_contact_at: activation.firstContactAt, last_attempt_at: activation.lastAttemptAt };
    },
    inboundReplyDomain: "inbound.norixo.io",
    replyTokenKeyring: keyring,
    createAttemptId: () => attempt.id,
    now: () => "2026-10-01T10:00:00.000Z",
  });
  return { service, calls };
}
const input = { workspaceId: WORKSPACE, actorUserId: "actor", outreachId: "outreach", idempotencyKey: "key" };
const accepted = async () => ({ status: "accepted" as const, provider: "resend" as const, providerMessageId: "m1", errorCode: null, errorMessage: null });

async function expectCode(operation: () => Promise<unknown>, code: string) {
  await assert.rejects(operation, (error: unknown) => error instanceof BacklinkOutreachEmailSendError && error.code === code, `expected ${code}`);
}

async function main() {
  // G03: workspace controls fail closed (checked before any reservation or provider call) -----------------
  for (const [name, control, code] of [
    ["1 missing control row", null, "OUTREACH_SEND_WORKSPACE_CONTROL_MISSING"],
    ["2 backlinks_enabled=false", { backlinksEnabled: false, dryRunOnly: false }, "OUTREACH_SEND_BACKLINKS_DISABLED"],
    ["3 dry_run_only=true", { backlinksEnabled: true, dryRunOnly: true }, "OUTREACH_SEND_DISABLED_BY_DRY_RUN"],
    ["3b malformed control (undefined flags)", { backlinksEnabled: undefined, dryRunOnly: undefined } as never, "OUTREACH_SEND_BACKLINKS_DISABLED"],
  ] as const) {
    const h = harness({ control, providerSend: accepted });
    await expectCode(() => h.service(input), code);
    assert.equal(h.calls.reserve, 0, `${name}: reservation never attempted`);
    assert.equal(h.calls.provider, 0, `${name}: provider never called`);
  }
  {
    // 4 valid controls: gate passes, reservation reached, provider reached once.
    const h = harness({ control: { backlinksEnabled: true, dryRunOnly: false }, providerSend: accepted });
    const sent = await h.service(input);
    assert.equal(sent.disposition, "sent");
    assert.equal(h.calls.reserve, 1);
    assert.equal(h.calls.provider, 1);
    assert.equal(h.calls.activated, 1);
  }

  // The schedule-apply capability is a scheduling gate: it is not part of the send control shape.
  const serviceSource = readFileSync(join(process.cwd(), "lib/backlinks/services/outreachApprovedAutoSendService.ts"), "utf8");
  assert.ok(!/ScheduleApply|schedule_apply/.test(serviceSource.replace(/\/\/[^\n]*/g, "")), "manual/approved send does not require the scheduling capability");

  // G03/G04 dispositions raised by the reservation-side trigger map to deterministic reasons -------------------
  for (const [disposition, code] of [
    ["workspace_controls_missing", "OUTREACH_SEND_WORKSPACE_CONTROL_MISSING"],
    ["workspace_backlinks_disabled", "OUTREACH_SEND_BACKLINKS_DISABLED"],
    ["workspace_dry_run", "OUTREACH_SEND_DISABLED_BY_DRY_RUN"],
    ["campaign_not_active", "OUTREACH_CAMPAIGN_NOT_ACTIVE"], // 5 draft campaign + live=true
    ["campaign_disabled", "OUTREACH_CAMPAIGN_DISABLED"], // 6 active campaign + live=false
  ] as const) {
    const h = harness({ control: { backlinksEnabled: true, dryRunOnly: false }, disposition, providerSend: accepted });
    await expectCode(() => h.service(input), code);
    assert.equal(h.calls.provider, 0, `${disposition}: provider never called`);
  }

  // Repository: trigger exceptions become dispositions; anything else stays a hard error ----------------------
  const rpcClient = (message: string) => ({
    rpc: async () => ({ data: null, error: { message } }),
  }) as never;
  const reserveInput = { workspaceId: WORKSPACE, campaignId: "c", outreachId: "o", attemptId: "a", actorUserId: "u", idempotencyKey: "k", replyTokenHash: "h", replyTokenKeyVersion: "v1", requestedAt: "2026-10-01T10:00:00.000Z" };
  for (const [message, disposition] of [
    ["BACKLINK_SEND_WORKSPACE_CONTROL_MISSING", "workspace_controls_missing"],
    ["BACKLINK_SEND_BACKLINKS_DISABLED", "workspace_backlinks_disabled"],
    ["BACKLINK_SEND_DRY_RUN", "workspace_dry_run"],
    ["BACKLINK_SEND_CAMPAIGN_NOT_ACTIVE", "campaign_not_active"],
    ["BACKLINK_SEND_CAMPAIGN_LIVE_DISABLED", "campaign_disabled"],
  ] as const) {
    const result = await reserveBacklinkOutreachApprovedInitialAttempt(rpcClient(message), reserveInput);
    assert.equal(result.disposition, disposition);
    assert.equal(result.attempt, null);
  }
  const originalError = console.error;
  console.error = () => undefined;
  try {
    await assert.rejects(() => reserveBacklinkOutreachApprovedInitialAttempt(rpcClient("some other database failure"), reserveInput));
    await assert.rejects(() => reserveBacklinkOutreachApprovedInitialAttempt(rpcClient("BACKLINK_EMAIL_SUPPRESSED"), reserveInput), "suppression remains a hard refusal, not a gate disposition");
  } finally {
    console.error = originalError;
  }

  // Recipient suppression lookup ---------------------------------------------------------------------------------
  const lookups: Array<[string, string]> = [];
  const lookupClient = (result: { data: unknown[] | null; error: unknown }): BacklinkEmailSuppressionReadClient => ({
    from: () => ({ select: () => ({ eq: (_c, workspace) => ({ eq: (_d, email) => ({ limit: async () => { lookups.push([workspace, email]); return result; } }) }) }) }),
  });
  assert.equal(await isBacklinkEmailSuppressed(lookupClient({ data: [{ id: "x" }], error: null }), " W1 ", "  Mixed@Case.Example "), true);
  assert.deepEqual(lookups[0], ["W1", "mixed@case.example"], "lookup uses the canonical lower(trim()) identity");
  assert.equal(await isBacklinkEmailSuppressed(lookupClient({ data: [], error: null }), "W1", "a@b.example"), false);
  await assert.rejects(() => isBacklinkEmailSuppressed(lookupClient({ data: null, error: { message: "boom" } }), "W1", "a@b.example"), /LOOKUP_FAILED/);
  await assert.rejects(() => isBacklinkEmailSuppressed(lookupClient({ data: null, error: null }), "W1", "a@b.example"), /LOOKUP_INVALID/);
  await assert.rejects(() => isBacklinkEmailSuppressed(lookupClient({ data: [], error: null }), "W1", "   "), /LOOKUP_INVALID/);

  // Pre-Resend recheck at the provider (single choke point for every outreach send) -------------------------------
  type Payload = { to: string; text: string; headers?: Record<string, string> };
  function provider(isEmailSuppressed: (w: string, e: string) => Promise<boolean>) {
    const sent: Payload[] = [];
    const checks: Array<[string, string]> = [];
    const send = createOutreachEmailProvider({
      apiKey: "test-key",
      from: "Norixo <hello@example.test>",
      send: async (payload) => { sent.push(payload); return { data: { id: "msg_1" }, error: null }; },
      unsubscribeUrlFor: () => "https://norixo.io/unsubscribe/test-token",
      isEmailSuppressed: async (w, e) => { checks.push([w, e]); return isEmailSuppressed(w, e); },
    });
    return { send, sent, checks };
  }
  const context = { workspaceId: WORKSPACE, outreachId: "outreach" };
  const base = { to: "Snapshot@Example.com", subject: "S", body: "B", replyTo: "r@reply.example.test", idempotencyKey: "k1", context };
  {
    const p = provider(async () => false); // 12 unsuppressed: provider path remains reachable, no duplicate call
    const result = await p.send(base);
    assert.equal(result.status, "accepted");
    assert.equal(p.sent.length, 1, "exactly one provider call");
    assert.equal(p.checks.length, 1, "exactly one recheck");
    assert.deepEqual(p.checks[0], [WORKSPACE, "Snapshot@Example.com"]);
  }
  {
    // 10 suppressed AFTER reservation, BEFORE the provider call: Resend is not called.
    let suppressed = false;
    const p = provider(async () => suppressed);
    const h = harness({ control: { backlinksEnabled: true, dryRunOnly: false }, providerSend: (i) => p.send({ ...base, to: i.to, context: i.context }) });
    suppressed = false; // reservation phase saw no suppression (A1 trigger passes)
    const reservedThenUnsubscribed = (async () => { suppressed = true; })(); // the unsubscribe commits right after the reservation
    await reservedThenUnsubscribed;
    const outcome = await h.service(input);
    assert.equal(outcome.disposition, "failed");
    assert.equal(outcome.errorCode, "BACKLINK_EMAIL_SUPPRESSED");
    assert.equal(p.sent.length, 0, "Resend was NOT called");
    assert.deepEqual(h.calls.failed, ["BACKLINK_EMAIL_SUPPRESSED"], "attempt persisted as failed (no provider contact)");
    assert.equal(h.calls.accepted, 0, "no false provider acceptance");
    assert.equal(h.calls.activated, 0, "outreach not activated");
  }
  {
    // 11 lookup error immediately before the provider call: fail closed.
    const p = provider(async () => { throw new Error("lookup down"); });
    const result = await p.send(base);
    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, "OUTREACH_EMAIL_SUPPRESSION_CHECK_UNAVAILABLE");
    assert.equal(p.sent.length, 0);
    const h = harness({ control: { backlinksEnabled: true, dryRunOnly: false }, providerSend: (i) => p.send({ ...base, to: i.to, context: i.context }) });
    const outcome = await h.service(input);
    assert.equal(outcome.disposition, "failed");
    assert.deepEqual(h.calls.failed, ["OUTREACH_EMAIL_SUPPRESSION_CHECK_UNAVAILABLE"]);
    assert.equal(h.calls.accepted, 0);
  }
  {
    const p = provider(async () => false);
    const noContext = await p.send({ ...base, context: undefined });
    assert.equal(noContext.status, "failed", "no context => no recheck possible => fail closed");
    assert.equal(p.sent.length, 0);
  }
  {
    // The recheck is the last step before the external call: it runs after the opt-out footer is built.
    const order: string[] = [];
    const send = createOutreachEmailProvider({
      apiKey: "k", from: "Norixo <hello@example.test>",
      unsubscribeUrlFor: () => { order.push("footer"); return "https://norixo.io/unsubscribe/t"; },
      isEmailSuppressed: async () => { order.push("recheck"); return false; },
      send: async () => { order.push("send"); return { data: { id: "m" }, error: null }; },
    });
    await send(base);
    assert.deepEqual(order, ["footer", "recheck", "send"]);
  }

  // 13: transactional / non-outreach email is untouched ---------------------------------------------------------
  const transactional = readFileSync(join(process.cwd(), "lib/email/sendTransactionalEmail.ts"), "utf8");
  assert.ok(!/suppress|backlink/i.test(transactional), "transactional email does not know about outreach suppression");
  const changed = execFileSync("git", ["diff", "--name-only", "HEAD", "--", "lib/email"], { encoding: "utf8" }).trim();
  assert.equal(changed, "", "lib/email has no changes");
  const sources = ["app/api/backlinks/outreach/[id]/send/route.ts", "app/api/internal/automation/backlinks/outreach/send-one/route.ts", "app/api/backlinks/outreach/[id]/attempts/[attemptId]/follow-up-send/route.ts", "lib/automation/production-composition.ts"];
  for (const file of sources) {
    assert.ok(readFileSync(join(process.cwd(), file), "utf8").includes("createEnvironmentOutreachEmailProvider()"), `${file} sends through the guarded provider`);
  }

  // Migration static assertions (G03/G04 reservation-side; follow-up lifecycle unchanged) ----------------------------
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261001150000_enforce_backlink_initial_email_send_gates.sql"), "utf8");
  for (const needle of [
    "before insert on public.backlink_outreach_attempts",
    "new.channel <> 'email' or new.attempt_kind <> 'initial' or new.status <> 'requested'",
    "BACKLINK_SEND_WORKSPACE_CONTROL_MISSING",
    "control.backlinks_enabled is not true",
    "control.dry_run_only is not false",
    "campaign.status <> 'active'",
    "campaign.live_initial_send_enabled is not true",
    "for share",
  ]) {
    assert.ok(migration.includes(needle), `migration contains: ${needle}`);
  }
  assert.ok(!/before insert or update/i.test(migration), "gate runs on INSERT only, so follow-up transitions are not redefined");
  assert.ok(!/follow_up/.test(migration.replace(/--[^\n]*/g, "")), "migration SQL does not touch follow-up objects");
  assert.ok(!/schedule_apply_enabled/.test(migration.replace(/--[^\n]*/g, "")), "migration SQL does not require the scheduling capability");
  assert.ok(!/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|\bupdate\s+public\./i.test(migration), "migration is not destructive");

  assert.equal(networkCalls, 0, "no network call happened");
  console.log("PASS — Backlink send gates A2 smoke (pure: no DB, no network, no provider)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

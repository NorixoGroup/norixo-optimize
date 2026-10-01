import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createOutreachEmailProvider } from "../lib/backlinks/providers/outreachEmailProvider";
import {
  appendOutreachComplianceFooter,
  buildListUnsubscribeHeaders,
} from "../lib/backlinks/services/outreachEmailCompliance";
import {
  confirmHostedUnsubscribe,
  previewHostedUnsubscribe,
} from "../lib/backlinks/services/outreachUnsubscribeService";
import {
  buildBacklinkUnsubscribeUrl,
  createBacklinkUnsubscribeToken,
  verifyBacklinkUnsubscribeToken,
} from "../lib/backlinks/services/outreachUnsubscribeToken";

/**
 * Pure smoke for A1. No database, no network, no provider: `fetch` is replaced by a
 * tripwire and the Resend client is never constructed because `send` is injected.
 * SQL behaviour is covered by scripts/backlink-email-suppression-a1-sql-check.sql
 * (disposable local database only) and by static assertions on the migration below.
 */

let networkCalls = 0;
globalThis.fetch = (async () => {
  networkCalls += 1;
  throw new Error("NETWORK_FORBIDDEN_IN_SMOKE");
}) as typeof fetch;

async function main() {
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const OUTREACH_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_OUTREACH_ID = "33333333-3333-4333-8333-333333333333";
const keyring = { activeKeyVersion: "v1", secrets: { v1: "test-secret-one-0123456789", v2: "test-secret-two-0123456789" } } as const;

// 10 + 11: hosted unsubscribe token ------------------------------------------------------
const token = createBacklinkUnsubscribeToken({ workspaceId: WORKSPACE_ID, outreachId: OUTREACH_ID }, keyring);
assert.deepEqual(verifyBacklinkUnsubscribeToken(token, keyring), { workspaceId: WORKSPACE_ID, outreachId: OUTREACH_ID });
assert.equal(
  createBacklinkUnsubscribeToken({ workspaceId: WORKSPACE_ID, outreachId: OUTREACH_ID }, keyring),
  token,
  "token is deterministic so repeated sends reuse one stable link",
);
const [payloadSegment, signatureSegment] = token.split(".");
const decoded = Buffer.from(payloadSegment, "base64url").toString("utf8");
assert.ok(!decoded.includes("@"), "no email address in the token");
assert.deepEqual(Object.keys(JSON.parse(decoded)).sort(), ["k", "o", "v", "w"]);
assert.ok(/^[A-Za-z0-9_.-]+$/.test(token), "token is URL-path safe");

const forgedPayload = Buffer.from(JSON.stringify({ v: 1, w: WORKSPACE_ID, o: OTHER_OUTREACH_ID, k: "v1" })).toString("base64url");
const invalidTokens = [
  `${forgedPayload}.${signatureSegment}`, // payload edited, signature reused
  `${payloadSegment}.${signatureSegment.slice(0, -2)}AA`, // signature edited
  `${payloadSegment}.`,
  `.${signatureSegment}`,
  payloadSegment,
  `${payloadSegment}.${signatureSegment}.x`,
  "",
  "not-a-token",
  `${payloadSegment}.${signatureSegment}`.slice(0, 20),
  "a".repeat(600),
];
for (const candidate of invalidTokens) {
  assert.throws(() => verifyBacklinkUnsubscribeToken(candidate, keyring), /UNSUBSCRIBE_TOKEN_INVALID/, `rejects ${candidate.slice(0, 24)}`);
}
// Signed with the right secret but WITHOUT the domain-separation label (e.g. a reply-token style MAC) is rejected.
const unlabelled = createHmac("sha256", keyring.secrets.v1).update(payloadSegment).digest("base64url");
assert.throws(() => verifyBacklinkUnsubscribeToken(`${payloadSegment}.${unlabelled}`, keyring), /UNSUBSCRIBE_TOKEN_INVALID/);
// Wrong secret / unknown key version / rotation.
assert.throws(() => verifyBacklinkUnsubscribeToken(token, { activeKeyVersion: "v1", secrets: { v1: "different-secret-0123456789" } }), /UNSUBSCRIBE_TOKEN_INVALID/);
assert.throws(() => verifyBacklinkUnsubscribeToken(token, { activeKeyVersion: "v2", secrets: { v2: keyring.secrets.v2 } }), /UNSUBSCRIBE_TOKEN_INVALID/);
assert.deepEqual(verifyBacklinkUnsubscribeToken(token, { activeKeyVersion: "v2", secrets: keyring.secrets }).outreachId, OUTREACH_ID, "old key version still verifies while its secret is configured");
// A payload that tries to smuggle extra claims is rejected even with a valid-looking structure.
const extraPayload = Buffer.from(JSON.stringify({ v: 1, w: WORKSPACE_ID, o: OUTREACH_ID, k: "v1", e: "victim@example.com" })).toString("base64url");
const extraSignature = createHmac("sha256", keyring.secrets.v1).update(`norixo:backlink-unsubscribe:v1:${extraPayload}`).digest("base64url");
assert.throws(() => verifyBacklinkUnsubscribeToken(`${extraPayload}.${extraSignature}`, keyring), /UNSUBSCRIBE_TOKEN_INVALID/);
assert.throws(() => createBacklinkUnsubscribeToken({ workspaceId: "not-a-uuid", outreachId: OUTREACH_ID }, keyring), /UNSUBSCRIBE_TOKEN_INVALID/);
assert.throws(() => createBacklinkUnsubscribeToken({ workspaceId: WORKSPACE_ID, outreachId: OUTREACH_ID }, { activeKeyVersion: "v1", secrets: {} }), /UNSUBSCRIBE_TOKEN_UNAVAILABLE/);

const unsubscribeUrl = buildBacklinkUnsubscribeUrl("https://norixo.io/", token);
assert.equal(unsubscribeUrl, `https://norixo.io/unsubscribe/${token}`);

// 12: email content ---------------------------------------------------------------------
const approvedBody = "Hello Sam,\n\nI wrote a resource you may like.\n\nBest,\nNorixo";
const withFooter = appendOutreachComplianceFooter(approvedBody, unsubscribeUrl);
assert.ok(withFooter.startsWith(approvedBody), "approved body is preserved verbatim");
assert.ok(withFooter.includes("\nNorixo\n"), "Norixo identity present");
assert.ok(/unsubscribe/i.test(withFooter) && withFooter.includes(unsubscribeUrl), "opt-out instruction + link present");
assert.ok(/reply to this message with "unsubscribe"/.test(withFooter), "reply opt-out instruction present");
assert.equal(appendOutreachComplianceFooter(withFooter, unsubscribeUrl), withFooter, "footer is idempotent");
assert.ok(!/(street|avenue|registration|vat|siret|llc|ltd|inc\.)/i.test(withFooter.slice(approvedBody.length)), "no invented legal identity");
const headers = buildListUnsubscribeHeaders(unsubscribeUrl);
assert.deepEqual(headers, { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
assert.throws(() => buildListUnsubscribeHeaders("http://norixo.io/unsubscribe/x"), /NOT_HTTPS/);

// 13: provider behaviour with an injected sender (no real provider) ---------------------------
type Payload = { from: string; replyTo: string; to: string; subject: string; text: string; headers?: Record<string, string> };
async function runProvider(options: { unsubscribeUrlFor?: (c: { workspaceId: string; outreachId: string }) => string; context?: { workspaceId: string; outreachId: string } }) {
  const sent: Payload[] = [];
  const provider = createOutreachEmailProvider({
    apiKey: "test-key",
    from: "Norixo <hello@example.test>",
    send: async (payload) => {
      sent.push(payload);
      return { data: { id: "msg_1" }, error: null };
    },
    unsubscribeUrlFor: options.unsubscribeUrlFor,
  });
  const result = await provider({ to: "sam@example.test", subject: "Hi", body: approvedBody, replyTo: "r@reply.example.test", idempotencyKey: "k1", context: options.context });
  return { result, sent };
}
{
  const ok = await runProvider({
    unsubscribeUrlFor: (c) => buildBacklinkUnsubscribeUrl("https://norixo.io", createBacklinkUnsubscribeToken(c, keyring)),
    context: { workspaceId: WORKSPACE_ID, outreachId: OUTREACH_ID },
  });
  assert.equal(ok.result.status, "accepted");
  assert.equal(ok.sent.length, 1);
  assert.ok(ok.sent[0].text.includes("Norixo") && ok.sent[0].text.includes(unsubscribeUrl));
  assert.equal(ok.sent[0].headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.equal(ok.sent[0].headers?.["List-Unsubscribe"], `<${unsubscribeUrl}>`);
  assert.ok(!JSON.stringify(ok.sent[0].headers).includes("sam@example.test"), "no recipient address in the headers");

  const missingContext = await runProvider({ unsubscribeUrlFor: () => unsubscribeUrl });
  assert.equal(missingContext.result.status, "failed");
  assert.equal(missingContext.result.errorCode, "OUTREACH_EMAIL_UNSUBSCRIBE_UNAVAILABLE");
  assert.equal(missingContext.sent.length, 0, "fail closed: nothing sent without context");

  const resolverFails = await runProvider({
    unsubscribeUrlFor: () => {
      throw new Error("OUTREACH_REPLY_TOKEN_SECRET_INVALID");
    },
    context: { workspaceId: WORKSPACE_ID, outreachId: OUTREACH_ID },
  });
  assert.equal(resolverFails.result.status, "failed");
  assert.equal(resolverFails.sent.length, 0, "fail closed: nothing sent when the opt-out link cannot be produced");

  const http = await runProvider({ unsubscribeUrlFor: () => "http://insecure.example/unsubscribe/x", context: { workspaceId: WORKSPACE_ID, outreachId: OUTREACH_ID } });
  assert.equal(http.sent.length, 0, "fail closed: non-https opt-out link is rejected");

  const legacy = await runProvider({});
  assert.equal(legacy.result.status, "accepted");
  assert.deepEqual(Object.keys(legacy.sent[0]).sort(), ["from", "replyTo", "subject", "text", "to"], "provider without resolver keeps the legacy payload (used only by tests)");
}

// 10 + 11: hosted unsubscribe service semantics -------------------------------------------------
{
  const applied: unknown[] = [];
  let calls = 0;
  const deps = {
    getKeyring: () => keyring,
    applyUnsubscribe: async (input: { workspaceId: string; outreachId: string; source: string }) => {
      applied.push(input);
      calls += 1;
      return { disposition: calls === 1 ? ("applied" as const) : ("existing" as const), outreachId: input.outreachId, outreachStatus: "closed", emailSuppressed: true as const, closedOutreachCount: calls === 1 ? 1 : 0, appliedAt: "2026-10-01T00:00:00.000Z" };
    },
  };
  assert.deepEqual(previewHostedUnsubscribe(deps)(token), { kind: "valid" });
  assert.deepEqual(previewHostedUnsubscribe(deps)(`${forgedPayload}.${signatureSegment}`), { kind: "invalid" });
  assert.equal(applied.length, 0, "GET/preview has no side effect (scanners cannot unsubscribe anyone)");

  const first = await confirmHostedUnsubscribe(deps)(token);
  const second = await confirmHostedUnsubscribe(deps)(token);
  assert.deepEqual(first, { kind: "unsubscribed", disposition: "applied" });
  assert.deepEqual(second, { kind: "unsubscribed", disposition: "existing" });
  assert.deepEqual(applied[0], { workspaceId: WORKSPACE_ID, outreachId: OUTREACH_ID, source: "hosted_unsubscribe" });
  assert.equal(applied.length, 2);

  const tampered = await confirmHostedUnsubscribe(deps)(`${forgedPayload}.${signatureSegment}`);
  assert.deepEqual(tampered, { kind: "invalid" });
  assert.equal(applied.length, 2, "tampered token never reaches the database");

  assert.deepEqual(await confirmHostedUnsubscribe({ ...deps, getKeyring: () => { throw new Error("no secret"); } })(token), { kind: "unavailable" });
  assert.deepEqual(await confirmHostedUnsubscribe({ ...deps, applyUnsubscribe: async () => { throw new Error("db down"); } })(token), { kind: "unavailable" });
}

// Static assertions on the migration (SQL behaviour is executed in the disposable-DB check) ------------
const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261001090000_add_backlink_email_suppression_and_unsubscribe.sql"), "utf8");
for (const needle of [
  "create table if not exists public.backlink_email_suppressions",
  "backlink_email_suppressions_workspace_email_unique",
  "unique (workspace_id, email_normalized)",
  "email_normalized = lower(trim(email_normalized))",
  "enable row level security",
  "trg_backlink_outreach_attempts_block_suppressed_email",
  "before insert or update of status on public.backlink_outreach_attempts",
  "raise exception 'BACKLINK_EMAIL_SUPPRESSED'",
  "trg_backlink_contacts_sync_email_suppression",
  "trg_backlink_outreach_unsubscribed_response_suppression",
  "when (new.last_response_type = 'unsubscribed'",
  "apply_backlink_outreach_unsubscribe",
  "on conflict (workspace_id, email_normalized) do nothing",
  "revoke all on function public.apply_backlink_outreach_unsubscribe",
  "grant execute on function public.apply_backlink_outreach_unsubscribe(uuid, uuid, text, timestamptz) to service_role",
  "'unsubscribed'",
]) {
  assert.ok(migration.includes(needle), `migration contains: ${needle}`);
}
assert.ok(!/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i.test(migration), "migration is not destructive");
assert.ok(!/domain/i.test(migration.split("create or replace function public.backlink_apply_email_suppression")[1]?.split("$$;")[0] ?? ""), "suppression helper never works at domain scope");
assert.ok(!/last_response_type\s*=\s*'negative'/.test(migration), "negative responses never create suppression");

// Source hygiene ----------------------------------------------------------------------------------------
for (const file of ["app/unsubscribe/[token]/route.ts", "app/api/backlinks/outreach/[id]/unsubscribe/route.ts", "lib/backlinks/services/outreachUnsubscribeService.ts"]) {
  const source = readFileSync(join(process.cwd(), file), "utf8");
  for (const line of source.split("\n").filter((entry) => /console\.(log|info|warn|error)/.test(entry))) {
    assert.ok(!/token|email|outreach.?id|workspace.?id/i.test(line), `${file}: log line must not include token/email/ids: ${line.trim()}`);
  }
}
const getHandler = readFileSync(join(process.cwd(), "app/unsubscribe/[token]/route.ts"), "utf8").split("export async function POST")[0];
assert.ok(!/applyBacklinkOutreachUnsubscribe|createSupabaseAdminClient\(/.test(getHandler.split("export async function GET")[1] ?? ""), "GET handler performs no database operation");
for (const file of [
  "lib/backlinks/services/outreachApprovedAutoSendService.ts",
  "lib/backlinks/services/outreachEmailSendService.ts",
  "lib/backlinks/services/outreachFollowUpEmailSendService.ts",
]) {
  assert.ok(readFileSync(join(process.cwd(), file), "utf8").includes("context: { workspaceId: input.workspaceId, outreachId: input.outreachId }"), `${file} passes the unsubscribe context to the provider`);
}

assert.equal(networkCalls, 0, "no network call happened");
console.log("PASS — Backlink email suppression A1 smoke (pure: no DB, no network, no provider)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

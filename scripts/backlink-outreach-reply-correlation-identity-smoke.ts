import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

import { BacklinkOutreachReplyCorrelationIdentityError, createBacklinkOutreachReplyToken, deriveBacklinkOutreachReplyCorrelationIdentity, deriveBacklinkOutreachReplyTo, getBacklinkOutreachReplyTokenKeyring, hashBacklinkOutreachReplyToken, reconstructBacklinkOutreachReplyToForAttempt, requireBacklinkOutreachReplyIdentityKeyVersion } from "../lib/backlinks/services/outreachReplyCorrelationIdentity";

async function main() {
  const token = createBacklinkOutreachReplyToken();
  assert.match(token, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert(!token.includes("workspace") && !token.includes("outreach") && !token.includes("contact"), "Reply token must be opaque.");
  const hash = hashBacklinkOutreachReplyToken(token);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashBacklinkOutreachReplyToken(token), hash, "Token hash must be deterministic.");
  assert.notEqual(hashBacklinkOutreachReplyToken("550e8400-e29b-41d4-a716-446655440000"), hashBacklinkOutreachReplyToken("550e8400-e29b-41d4-a716-446655440001"), "Distinct tokens must have distinct hashes.");
  assert.equal(deriveBacklinkOutreachReplyTo("550e8400-e29b-41d4-a716-446655440000", " Inbound.Norixo.io "), "reply+550e8400-e29b-41d4-a716-446655440000@inbound.norixo.io");
  for (const domain of ["", "https://inbound.norixo.io", "@inbound.norixo.io", "inbound", "inbound.norixo.io/path"]) {
    assert.throws(() => deriveBacklinkOutreachReplyTo("550e8400-e29b-41d4-a716-446655440000", domain), BacklinkOutreachReplyCorrelationIdentityError);
  }

  const attemptId = "550e8400-e29b-41d4-a716-446655440000";
  const keyring = { activeKeyVersion: "v2", secrets: { v1: "old-secret", v2: "active-secret" } };
  const v2 = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId, keyring });
  const v2Again = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId, keyring });
  const v1 = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId, keyring, keyVersion: "v1" });
  const anotherAttempt = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId: "550e8400-e29b-41d4-a716-446655440001", keyring });
  assert.deepEqual(v2Again, v2, "Same Attempt and key version must deterministically reconstruct the same identity.");
  assert.notEqual(v2.token, v1.token, "Different key versions must yield distinct tokens.");
  assert.notEqual(v2.token, anotherAttempt.token, "Different Attempts must yield distinct tokens.");
  assert.match(v2.token, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(v2.tokenHash, hashBacklinkOutreachReplyToken(v2.token));
  assert.equal(deriveBacklinkOutreachReplyTo(v2.token, "Inbound.Norixo.io"), `reply+${v2.token}@inbound.norixo.io`);
  assert.deepEqual(
    reconstructBacklinkOutreachReplyToForAttempt({ attemptId, replyTokenHash: v2.tokenHash, replyTokenKeyVersion: "v2", keyring, inboundReplyDomain: "Inbound.Norixo.io" }),
    { replyTo: `reply+${v2.token}@inbound.norixo.io`, tokenHash: v2.tokenHash, keyVersion: "v2" },
    "Persisted hash and key version must reconstruct the exact Reply-To for an initial Attempt.",
  );
  const followUpAttemptId = "550e8400-e29b-41d4-a716-446655440010";
  const followUpIdentity = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId: followUpAttemptId, keyring });
  assert.equal(
    reconstructBacklinkOutreachReplyToForAttempt({ attemptId: followUpAttemptId, replyTokenHash: followUpIdentity.tokenHash, replyTokenKeyVersion: "v2", keyring, inboundReplyDomain: "inbound.norixo.io" }).replyTo,
    deriveBacklinkOutreachReplyTo(followUpIdentity.token, "inbound.norixo.io"),
    "Follow-up Attempts must be reconstructible from their persisted identity fields.",
  );
  assert.throws(() => reconstructBacklinkOutreachReplyToForAttempt({ attemptId, replyTokenHash: "0".repeat(64), replyTokenKeyVersion: "v2", keyring, inboundReplyDomain: "inbound.norixo.io" }), (error: unknown) => error instanceof BacklinkOutreachReplyCorrelationIdentityError && error.code === "OUTREACH_REPLY_IDENTITY_MISMATCH");
  assert.throws(() => reconstructBacklinkOutreachReplyToForAttempt({ attemptId, replyTokenHash: v2.tokenHash, replyTokenKeyVersion: "v2", keyring: { activeKeyVersion: "v2", secrets: { v2: "wrong-secret" } }, inboundReplyDomain: "inbound.norixo.io" }), (error: unknown) => error instanceof BacklinkOutreachReplyCorrelationIdentityError && error.code === "OUTREACH_REPLY_IDENTITY_MISMATCH");
  assert.throws(() => reconstructBacklinkOutreachReplyToForAttempt({ attemptId, replyTokenHash: v2.tokenHash, replyTokenKeyVersion: null, keyring, inboundReplyDomain: "inbound.norixo.io" }), (error: unknown) => error instanceof BacklinkOutreachReplyCorrelationIdentityError && error.code === "OUTREACH_REPLY_IDENTITY_LEGACY_NOT_RECONSTRUCTIBLE");
  assert(!v2.token.includes("workspace") && !v2.token.includes("outreach") && !v2.token.includes("contact"), "Derived tokens must not encode business identifiers.");
  assert.equal(requireBacklinkOutreachReplyIdentityKeyVersion("v1"), "v1");
  assert.throws(() => requireBacklinkOutreachReplyIdentityKeyVersion(null), (error: unknown) => error instanceof BacklinkOutreachReplyCorrelationIdentityError && error.code === "OUTREACH_REPLY_IDENTITY_LEGACY_NOT_RECONSTRUCTIBLE");
  assert.throws(() => deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId, keyring: { activeKeyVersion: "v1", secrets: {} } }), (error: unknown) => error instanceof BacklinkOutreachReplyCorrelationIdentityError && error.code === "OUTREACH_REPLY_TOKEN_KEY_VERSION_UNAVAILABLE");
  assert.throws(() => getBacklinkOutreachReplyTokenKeyring({ OUTREACH_REPLY_TOKEN_ACTIVE_KEY_VERSION: "v1" }), (error: unknown) => error instanceof BacklinkOutreachReplyCorrelationIdentityError && error.code === "OUTREACH_REPLY_TOKEN_SECRET_INVALID");
  const configured = getBacklinkOutreachReplyTokenKeyring({ OUTREACH_REPLY_TOKEN_ACTIVE_KEY_VERSION: "v2", OUTREACH_REPLY_TOKEN_SECRET_V1: "old-secret", OUTREACH_REPLY_TOKEN_SECRET_V2: "active-secret" });
  assert.equal(configured.activeKeyVersion, "v2");
  assert.equal(deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId, keyring: configured, keyVersion: "v1" }).token, v1.token, "Old identities must remain reconstructible while their key remains configured.");
  assert.throws(() => deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId, keyring: { activeKeyVersion: "v2", secrets: { v2: "active-secret" } }, keyVersion: "v1" }), (error: unknown) => error instanceof BacklinkOutreachReplyCorrelationIdentityError && error.code === "OUTREACH_REPLY_TOKEN_KEY_VERSION_UNAVAILABLE");

  const [migration, keyVersionMigration, types, repository] = await Promise.all([
    readFile("supabase/migrations/20260811130000_add_backlink_outreach_attempt_reply_token_hash.sql", "utf8"),
    readFile("supabase/migrations/20260811158000_add_backlink_outreach_attempt_reply_token_key_version.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
    readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8"),
  ]);
  for (const value of ["add column reply_token_hash text", "on public.backlink_outreach_attempts (reply_token_hash)", "where reply_token_hash is not null", "raw token is never persisted"]) assert(migration.toLowerCase().includes(value), `Missing migration contract: ${value}`);
  assert(keyVersionMigration.includes("add column reply_token_key_version text"), "Reply-token key version migration must be present.");
  assert(!/\breply_token\s+text\b/.test(migration), "Raw reply token must not have a database column.");
  for (const value of ["reply_token_hash: string | null", "reply_token_hash?: string | null", "reply_token_key_version: string | null", "reply_token_key_version?: string | null", "attemptId: string", "replyTokenHash: string", "replyTokenKeyVersion: string", "id: required(input.attemptId", "reply_token_hash: required(input.replyTokenHash", "reply_token_key_version: required(input.replyTokenKeyVersion", "normalized.code !== \"CONFLICT\""]) assert(repository.includes(value) || types.includes(value), `Missing persistence contract: ${value}`);
  console.log("PASS — Backlink outreach reply correlation identity smoke");
}

void main();

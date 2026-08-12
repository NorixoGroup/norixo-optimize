import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

import {
  BacklinkOutreachReplyCorrelationIdentityError,
  deriveBacklinkOutreachReplyCorrelationIdentity,
  deriveBacklinkOutreachReplyTo,
  hashBacklinkOutreachReplyToken,
  reconstructBacklinkOutreachReplyToForAttempt,
  type BacklinkOutreachReplyTokenKeyring,
} from "../lib/backlinks/services/outreachReplyCorrelationIdentity";

type AttemptIdentityRow = {
  id: string;
  attemptKind: "initial" | "follow_up";
  status: "requested" | "prepared";
  idempotencyKey: string;
  replyTokenHash: string | null;
  replyTokenKeyVersion: string | null;
};

function tokenFromReplyTo(replyTo: string): string {
  const match = /^reply\+([0-9a-f-]{36})@inbound\.norixo\.io$/i.exec(replyTo);
  assert(match != null, "Reply-To must use only the configured inbound domain and UUID token.");
  return match[1].toLowerCase();
}

function assertIdentityError(operation: () => unknown, code: BacklinkOutreachReplyCorrelationIdentityError["code"]) {
  assert.throws(operation, (error: unknown) => error instanceof BacklinkOutreachReplyCorrelationIdentityError && error.code === code);
}

function createAttempt(input: { attemptId: string; attemptKind: AttemptIdentityRow["attemptKind"]; keyring: BacklinkOutreachReplyTokenKeyring; idempotencyKey: string }): AttemptIdentityRow {
  const identity = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId: input.attemptId, keyring: input.keyring });
  return { id: identity.attemptId, attemptKind: input.attemptKind, status: input.attemptKind === "follow_up" ? "prepared" : "requested", idempotencyKey: input.idempotencyKey, replyTokenHash: identity.tokenHash, replyTokenKeyVersion: identity.keyVersion };
}

function reconstruct(row: AttemptIdentityRow, keyring: BacklinkOutreachReplyTokenKeyring): string {
  return reconstructBacklinkOutreachReplyToForAttempt({ attemptId: row.id, replyTokenHash: row.replyTokenHash, replyTokenKeyVersion: row.replyTokenKeyVersion, keyring, inboundReplyDomain: "inbound.norixo.io" }).replyTo;
}

async function main() {
  const v1Only = { activeKeyVersion: "v1", secrets: { v1: "secret-one" } };
  const rotated = { activeKeyVersion: "v2", secrets: { v1: "secret-one", v2: "secret-two" } };
  const initialA = createAttempt({ attemptId: "550e8400-e29b-41d4-a716-446655440001", attemptKind: "initial", keyring: v1Only, idempotencyKey: "initial-a" });
  const followUpA = createAttempt({ attemptId: "550e8400-e29b-41d4-a716-446655440002", attemptKind: "follow_up", keyring: v1Only, idempotencyKey: "follow-up-a" });
  const initialB = createAttempt({ attemptId: "550e8400-e29b-41d4-a716-446655440003", attemptKind: "initial", keyring: rotated, idempotencyKey: "initial-b" });
  assert.equal(initialA.replyTokenKeyVersion, "v1", "Initial A must persist the active v1 version.");
  assert.equal(followUpA.replyTokenKeyVersion, "v1", "Follow-up A must persist the active v1 version.");
  assert.equal(initialB.replyTokenKeyVersion, "v2", "Initial B must persist the rotated active v2 version.");
  assert.equal(initialA.attemptKind, "initial");
  assert.equal(followUpA.attemptKind, "follow_up");
  assert.equal(followUpA.status, "prepared");

  const initialAReplyTo = reconstruct(initialA, rotated);
  const followUpAReplyTo = reconstruct(followUpA, rotated);
  const initialBReplyTo = reconstruct(initialB, rotated);
  assert.equal(hashBacklinkOutreachReplyToken(tokenFromReplyTo(initialAReplyTo)), initialA.replyTokenHash, "Initial Reply-To token must hash to the DB hash.");
  assert.equal(hashBacklinkOutreachReplyToken(tokenFromReplyTo(followUpAReplyTo)), followUpA.replyTokenHash, "Follow-up Reply-To token must hash to the DB hash.");
  assert.equal(hashBacklinkOutreachReplyToken(tokenFromReplyTo(initialBReplyTo)), initialB.replyTokenHash, "Rotated Reply-To token must hash to the DB hash.");
  assert.notEqual(initialA.replyTokenHash, initialB.replyTokenHash, "Rotation and distinct Attempts must produce distinct hashes.");
  assert.equal(reconstruct(initialA, rotated), initialAReplyTo, "Active v2 must not rewrite historical v1 identity.");
  assert.equal(reconstruct(initialB, rotated), initialBReplyTo, "Active v2 Attempts must reconstruct with v2.");

  assertIdentityError(() => reconstruct(initialA, { activeKeyVersion: "v2", secrets: { v1: "wrong-secret", v2: "secret-two" } }), "OUTREACH_REPLY_IDENTITY_MISMATCH");
  assertIdentityError(() => reconstruct({ ...initialA, replyTokenHash: "0".repeat(64) }, rotated), "OUTREACH_REPLY_IDENTITY_MISMATCH");
  assertIdentityError(() => reconstruct(initialA, { activeKeyVersion: "v2", secrets: { v2: "secret-two" } }), "OUTREACH_REPLY_TOKEN_KEY_VERSION_UNAVAILABLE");
  assertIdentityError(() => reconstruct({ ...initialA, replyTokenKeyVersion: null }, rotated), "OUTREACH_REPLY_IDENTITY_LEGACY_NOT_RECONSTRUCTIBLE");
  assertIdentityError(() => reconstructBacklinkOutreachReplyToForAttempt({ attemptId: initialA.id, replyTokenHash: initialA.replyTokenHash, replyTokenKeyVersion: "v1", keyring: rotated, inboundReplyDomain: "https://inbound.norixo.io" }), "OUTREACH_INBOUND_REPLY_DOMAIN_INVALID");

  const byHash = new Map<string, AttemptIdentityRow>([initialA, followUpA, initialB].map((row) => [row.replyTokenHash ?? "", row]));
  assert.equal(byHash.get(hashBacklinkOutreachReplyToken(tokenFromReplyTo(initialAReplyTo)))?.id, initialA.id, "Inbound roundtrip must find the exact initial Attempt by hash without a keyring.");
  assert.equal(byHash.get(hashBacklinkOutreachReplyToken(tokenFromReplyTo(followUpAReplyTo)))?.id, followUpA.id, "Inbound roundtrip must find the exact follow-up Attempt by hash without a keyring.");

  const existingInitial = { ...initialA };
  const candidateInitial = createAttempt({ attemptId: "550e8400-e29b-41d4-a716-446655440004", attemptKind: "initial", keyring: rotated, idempotencyKey: existingInitial.idempotencyKey });
  assert.notEqual(candidateInitial.replyTokenHash, existingInitial.replyTokenHash, "A newly generated candidate would differ.");
  assert.deepEqual(existingInitial, initialA, "Existing initial must remain canonical and unchanged.");
  const existingFollowUp = { ...followUpA };
  const candidateFollowUp = createAttempt({ attemptId: "550e8400-e29b-41d4-a716-446655440005", attemptKind: "follow_up", keyring: rotated, idempotencyKey: existingFollowUp.idempotencyKey });
  assert.notEqual(candidateFollowUp.id, existingFollowUp.id, "Existing follow-up must ignore a newly generated candidate Attempt ID.");
  assert.deepEqual(existingFollowUp, followUpA, "Existing follow-up hash and key version must remain canonical.");
  const failedRetry = createAttempt({ attemptId: "550e8400-e29b-41d4-a716-446655440006", attemptKind: "initial", keyring: rotated, idempotencyKey: "failed-retry" });
  assert.equal(failedRetry.attemptKind, "initial", "Failed human retry remains an initial Attempt, not a follow-up.");
  assert.equal(failedRetry.replyTokenKeyVersion, "v2", "Failed human retry must use the active version.");

  for (const token of [tokenFromReplyTo(initialAReplyTo), tokenFromReplyTo(followUpAReplyTo), tokenFromReplyTo(initialBReplyTo), tokenFromReplyTo(reconstruct(failedRetry, rotated))]) {
    assert.match(token, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert(!token.includes("workspace") && !token.includes("outreach") && !token.includes("contact"), "UUID token must not expose business identifiers.");
  }

  const [repository, service, route, migration, types] = await Promise.all([
    readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8"),
    readFile("lib/backlinks/services/outreachEmailSendService.ts", "utf8"),
    readFile("app/api/backlinks/outreach/[id]/send/route.ts", "utf8"),
    readFile("supabase/migrations/20260811159000_adopt_backlink_outreach_attempt_reconstructible_reply_identity.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
  ]);
  for (const value of ["reply_token_hash", "reply_token_key_version"]) assert(repository.includes(value) && migration.includes(value) && types.includes(value), `Missing DB identity field ${value}.`);
  for (const forbidden of ["reply_token text", "reply_to_address", "encrypted raw token", "token: required", "replyTo: required", "secret: required", "console.log(identity", "console.log(replyTo", "console.log(tokenHash"]) assert(!repository.includes(forbidden) && !service.includes(forbidden) && !route.includes(forbidden) && !migration.includes(forbidden), `Forbidden identity leakage: ${forbidden}`);
  assert(!migration.includes("gen_random_uuid()") && migration.includes("values (p_attempt_id"), "Follow-up reservation must use the preallocated Attempt ID.");
  const handler = service.slice(service.indexOf("return async (input:"), service.lastIndexOf("};"));
  assert(handler.includes("getAttemptByIdempotencyKey") && handler.indexOf("getAttemptByIdempotencyKey") < handler.indexOf("deriveBacklinkOutreachReplyCorrelationIdentity"), "Initial existing lookup must happen before new identity derivation.");
  assert(!repository.includes("createHmac") && !migration.includes("createHmac"), "Repositories and SQL must not generate cryptographic identities.");
  assert(route.includes("getBacklinkOutreachReplyTokenKeyring()"), "Initial Send route must use the server keyring.");
  assert(route.includes("process.env.OUTREACH_INBOUND_REPLY_DOMAIN"), "Initial Send route must use OUTREACH_INBOUND_REPLY_DOMAIN.");
  assert(!migration.includes("outreachEmailProvider") && !migration.includes("sendTransactionalEmail"), "Follow-up reservation must never call a provider.");
  console.log("PASS — Backlink outreach reply identity roundtrip smoke");
}

void main();

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

import { BacklinkOutreachReplyCorrelationIdentityError, createBacklinkOutreachReplyToken, deriveBacklinkOutreachReplyTo, hashBacklinkOutreachReplyToken } from "../lib/backlinks/services/outreachReplyCorrelationIdentity";

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

  const [migration, types, repository] = await Promise.all([
    readFile("supabase/migrations/20260811130000_add_backlink_outreach_attempt_reply_token_hash.sql", "utf8"),
    readFile("types/database.types.ts", "utf8"),
    readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8"),
  ]);
  for (const value of ["add column reply_token_hash text", "on public.backlink_outreach_attempts (reply_token_hash)", "where reply_token_hash is not null", "raw token is never persisted"]) assert(migration.toLowerCase().includes(value), `Missing migration contract: ${value}`);
  assert(!/\breply_token\s+text\b/.test(migration), "Raw reply token must not have a database column.");
  for (const value of ["reply_token_hash: string | null", "reply_token_hash?: string | null", "replyTokenHash: string", "reply_token_hash: required(input.replyTokenHash", "normalized.code !== \"CONFLICT\""]) assert(repository.includes(value) || types.includes(value), `Missing persistence contract: ${value}`);
  console.log("PASS — Backlink outreach reply correlation identity smoke");
}

void main();

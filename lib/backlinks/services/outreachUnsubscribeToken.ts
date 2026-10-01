import { createHmac, timingSafeEqual } from "node:crypto";

import type { BacklinkOutreachReplyTokenKeyring } from "./outreachReplyCorrelationIdentity";

/**
 * Signed hosted-unsubscribe token.
 *
 * It reuses the versioned HMAC secrets already used for reply correlation
 * (OUTREACH_REPLY_TOKEN_SECRET_*), with a distinct domain-separation label so a
 * reply token can never be replayed as an unsubscribe token or vice versa.
 *
 * The token binds exactly (workspace, outreach). The recipient address is never
 * part of the token: it is always resolved server-side from the outreach contact,
 * so a token cannot be edited to suppress an arbitrary address or workspace.
 * Tokens do not expire, because an unsubscribe link must keep working.
 */

export class BacklinkUnsubscribeTokenError extends Error {
  constructor(public readonly code: "UNSUBSCRIBE_TOKEN_INVALID" | "UNSUBSCRIBE_TOKEN_UNAVAILABLE") {
    super(code);
    this.name = "BacklinkUnsubscribeTokenError";
  }
}

export type BacklinkUnsubscribeTokenPayload = { workspaceId: string; outreachId: string };

const SIGNING_LABEL = "norixo:backlink-unsubscribe:v1:";
const MAX_TOKEN_LENGTH = 512;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KEY_VERSION_PATTERN = /^[a-z0-9]{1,16}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function sign(secret: string, payloadSegment: string): Buffer {
  return createHmac("sha256", secret).update(`${SIGNING_LABEL}${payloadSegment}`).digest();
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

export function createBacklinkUnsubscribeToken(
  payload: BacklinkUnsubscribeTokenPayload,
  keyring: BacklinkOutreachReplyTokenKeyring,
): string {
  const workspaceId = payload.workspaceId.trim().toLowerCase();
  const outreachId = payload.outreachId.trim().toLowerCase();
  const keyVersion = keyring.activeKeyVersion.trim().toLowerCase();
  const secret = keyring.secrets[keyVersion]?.trim();
  if (!UUID_PATTERN.test(workspaceId) || !UUID_PATTERN.test(outreachId) || !KEY_VERSION_PATTERN.test(keyVersion)) {
    throw new BacklinkUnsubscribeTokenError("UNSUBSCRIBE_TOKEN_INVALID");
  }
  if (!secret) throw new BacklinkUnsubscribeTokenError("UNSUBSCRIBE_TOKEN_UNAVAILABLE");
  const payloadSegment = toBase64Url(JSON.stringify({ v: 1, w: workspaceId, o: outreachId, k: keyVersion }));
  return `${payloadSegment}.${toBase64Url(sign(secret, payloadSegment))}`;
}

export function verifyBacklinkUnsubscribeToken(
  token: string,
  keyring: BacklinkOutreachReplyTokenKeyring,
): BacklinkUnsubscribeTokenPayload {
  const fail = (): never => {
    throw new BacklinkUnsubscribeTokenError("UNSUBSCRIBE_TOKEN_INVALID");
  };
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return fail();
  const parts = token.split(".");
  if (parts.length !== 2) return fail();
  const [payloadSegment, signatureSegment] = parts;
  if (!BASE64URL_PATTERN.test(payloadSegment) || !BASE64URL_PATTERN.test(signatureSegment)) return fail();

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  } catch {
    return fail();
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return fail();
  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record).sort().join(",");
  if (keys !== "k,o,v,w" || record.v !== 1) return fail();
  const { w, o, k } = record;
  if (typeof w !== "string" || typeof o !== "string" || typeof k !== "string") return fail();
  if (!UUID_PATTERN.test(w) || !UUID_PATTERN.test(o) || !KEY_VERSION_PATTERN.test(k)) return fail();

  const secret = keyring.secrets[k]?.trim();
  if (!secret) return fail();
  const expected = sign(secret, payloadSegment);
  const provided = Buffer.from(signatureSegment, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return fail();
  return { workspaceId: w, outreachId: o };
}

export function buildBacklinkUnsubscribeUrl(siteUrl: string, token: string): string {
  return `${siteUrl.trim().replace(/\/+$/, "")}/unsubscribe/${token}`;
}

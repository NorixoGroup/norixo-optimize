import { createHash, createHmac, randomUUID } from "node:crypto";

const replyTokenKeyVersionPattern = /^v[1-9][0-9]{0,15}$/;
const replyTokenSecretPrefix = "OUTREACH_REPLY_TOKEN_SECRET_";

export class BacklinkOutreachReplyCorrelationIdentityError extends Error {
  constructor(
    public readonly code:
      | "OUTREACH_INBOUND_REPLY_DOMAIN_INVALID"
      | "OUTREACH_REPLY_TOKEN_ATTEMPT_ID_INVALID"
      | "OUTREACH_REPLY_TOKEN_KEY_VERSION_INVALID"
      | "OUTREACH_REPLY_TOKEN_KEY_VERSION_UNAVAILABLE"
      | "OUTREACH_REPLY_TOKEN_SECRET_INVALID"
      | "OUTREACH_REPLY_IDENTITY_MISMATCH"
      | "OUTREACH_REPLY_IDENTITY_LEGACY_NOT_RECONSTRUCTIBLE" = "OUTREACH_INBOUND_REPLY_DOMAIN_INVALID",
  ) {
    super(code);
    this.name = "BacklinkOutreachReplyCorrelationIdentityError";
  }
}

export type BacklinkOutreachReplyTokenKeyring = {
  activeKeyVersion: string;
  secrets: Readonly<Record<string, string | undefined>>;
};

export type BacklinkOutreachReplyCorrelationIdentity = {
  attemptId: string;
  keyVersion: string;
  token: string;
  tokenHash: string;
};

function normalizedToken(token: string): string {
  const value = token.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BacklinkOutreachReplyCorrelationIdentityError();
  }
  return value.toLowerCase();
}

function normalizedAttemptId(attemptId: string): string {
  const value = attemptId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BacklinkOutreachReplyCorrelationIdentityError("OUTREACH_REPLY_TOKEN_ATTEMPT_ID_INVALID");
  }
  return value.toLowerCase();
}

function normalizedKeyVersion(keyVersion: string): string {
  const value = keyVersion.trim().toLowerCase();
  if (!replyTokenKeyVersionPattern.test(value)) {
    throw new BacklinkOutreachReplyCorrelationIdentityError("OUTREACH_REPLY_TOKEN_KEY_VERSION_INVALID");
  }
  return value;
}

function requiredSecret(keyring: BacklinkOutreachReplyTokenKeyring, keyVersion: string): string {
  const secret = keyring.secrets[keyVersion]?.trim();
  if (!secret) {
    throw new BacklinkOutreachReplyCorrelationIdentityError("OUTREACH_REPLY_TOKEN_KEY_VERSION_UNAVAILABLE");
  }
  return secret;
}

function normalizedDomain(domain: string): string {
  const value = domain.trim().toLowerCase();
  const labels = value.split(".");
  if (
    value.length > 253 ||
    labels.length < 2 ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    throw new BacklinkOutreachReplyCorrelationIdentityError();
  }
  return value;
}

export function createBacklinkOutreachReplyToken(): string {
  return randomUUID();
}

/**
 * Reads versioned HMAC secrets from server-only environment variables such as
 * OUTREACH_REPLY_TOKEN_SECRET_V1. The active version must have a configured secret.
 */
export function getBacklinkOutreachReplyTokenKeyring(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): BacklinkOutreachReplyTokenKeyring {
  const activeKeyVersion = normalizedKeyVersion(
    environment.OUTREACH_REPLY_TOKEN_ACTIVE_KEY_VERSION ?? "",
  );
  const secrets: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith(replyTokenSecretPrefix)) continue;
    const suffix = name.slice(replyTokenSecretPrefix.length).toLowerCase();
    if (!replyTokenKeyVersionPattern.test(suffix)) continue;
    secrets[suffix] = value;
  }
  if (!secrets[activeKeyVersion]?.trim()) {
    throw new BacklinkOutreachReplyCorrelationIdentityError("OUTREACH_REPLY_TOKEN_SECRET_INVALID");
  }
  return { activeKeyVersion, secrets };
}

/**
 * Derives a UUID v8 from the first 128 HMAC-SHA-256 bits. RFC version and
 * variant consume six bits, leaving 122 pseudorandom bits without truncation.
 */
export function deriveBacklinkOutreachReplyCorrelationIdentity(input: {
  attemptId: string;
  keyring: BacklinkOutreachReplyTokenKeyring;
  keyVersion?: string;
}): BacklinkOutreachReplyCorrelationIdentity {
  const attemptId = normalizedAttemptId(input.attemptId);
  const keyVersion = normalizedKeyVersion(input.keyVersion ?? input.keyring.activeKeyVersion);
  const secret = requiredSecret(input.keyring, keyVersion);
  const bytes = createHmac("sha256", secret)
    .update(`backlink-outreach-reply:v1:${attemptId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  const token = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { attemptId, keyVersion, token, tokenHash: hashBacklinkOutreachReplyToken(token) };
}

export function requireBacklinkOutreachReplyIdentityKeyVersion(
  keyVersion: string | null,
): string {
  if (keyVersion == null) {
    throw new BacklinkOutreachReplyCorrelationIdentityError(
      "OUTREACH_REPLY_IDENTITY_LEGACY_NOT_RECONSTRUCTIBLE",
    );
  }
  return normalizedKeyVersion(keyVersion);
}

export function reconstructBacklinkOutreachReplyToForAttempt(input: {
  attemptId: string;
  replyTokenHash: string | null;
  replyTokenKeyVersion: string | null;
  keyring: BacklinkOutreachReplyTokenKeyring;
  inboundReplyDomain: string;
}): { replyTo: string; tokenHash: string; keyVersion: string } {
  const identity = deriveBacklinkOutreachReplyCorrelationIdentity({
    attemptId: input.attemptId,
    keyring: input.keyring,
    keyVersion: requireBacklinkOutreachReplyIdentityKeyVersion(input.replyTokenKeyVersion),
  });
  if (input.replyTokenHash?.trim().toLowerCase() !== identity.tokenHash) {
    throw new BacklinkOutreachReplyCorrelationIdentityError("OUTREACH_REPLY_IDENTITY_MISMATCH");
  }
  return { replyTo: deriveBacklinkOutreachReplyTo(identity.token, input.inboundReplyDomain), tokenHash: identity.tokenHash, keyVersion: identity.keyVersion };
}

export function hashBacklinkOutreachReplyToken(token: string): string {
  return createHash("sha256").update(normalizedToken(token)).digest("hex");
}

export function deriveBacklinkOutreachReplyTo(token: string, inboundReplyDomain: string): string {
  return `reply+${normalizedToken(token)}@${normalizedDomain(inboundReplyDomain)}`;
}

import { createHash, randomUUID } from "node:crypto";

export class BacklinkOutreachReplyCorrelationIdentityError extends Error {
  constructor() {
    super("OUTREACH_INBOUND_REPLY_DOMAIN_INVALID");
    this.name = "BacklinkOutreachReplyCorrelationIdentityError";
  }
}

function normalizedToken(token: string): string {
  const value = token.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BacklinkOutreachReplyCorrelationIdentityError();
  }
  return value.toLowerCase();
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

export function hashBacklinkOutreachReplyToken(token: string): string {
  return createHash("sha256").update(normalizedToken(token)).digest("hex");
}

export function deriveBacklinkOutreachReplyTo(token: string, inboundReplyDomain: string): string {
  return `reply+${normalizedToken(token)}@${normalizedDomain(inboundReplyDomain)}`;
}

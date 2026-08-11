import type { ResendWebhookVerify } from "./resendWebhookAdapter";
import { normalizeInboundEmailAddress, normalizeMessageId } from "./resendInboundEmailNormalization";

export type ResendInboundWebhookHeaders = { svixId: string | null | undefined; svixTimestamp: string | null | undefined; svixSignature: string | null | undefined };
export type ResendInboundWebhookResult =
  | { disposition: "ignored"; eventType: string }
  | { disposition: "received"; provider: "resend"; providerEventId: string; emailId: string; inboundMessageId: string; sender: string; recipients: string[]; subject: string | null; occurredAt: string };
export type ResendInboundWebhookAdapterErrorCode = "RESEND_INBOUND_WEBHOOK_SECRET_MISSING" | "RESEND_INBOUND_WEBHOOK_HEADERS_MISSING" | "RESEND_INBOUND_WEBHOOK_SIGNATURE_INVALID" | "RESEND_INBOUND_WEBHOOK_EVENT_INVALID";

export class ResendInboundWebhookAdapterError extends Error {
  constructor(public readonly code: ResendInboundWebhookAdapterErrorCode) {
    super(code);
    this.name = "ResendInboundWebhookAdapterError";
  }
}

function record(value: unknown): Record<string, unknown> | null { return typeof value === "object" && value != null && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function nonEmpty(value: string | null | undefined): string | null { const normalized = value?.trim(); return normalized || null; }

export function verifyAndNormalizeResendInboundWebhook(input: { payload: string; headers: ResendInboundWebhookHeaders; webhookSecret: string | null | undefined; verify: ResendWebhookVerify }): ResendInboundWebhookResult {
  const webhookSecret = nonEmpty(input.webhookSecret);
  if (!webhookSecret) throw new ResendInboundWebhookAdapterError("RESEND_INBOUND_WEBHOOK_SECRET_MISSING");
  const id = nonEmpty(input.headers.svixId);
  const timestamp = nonEmpty(input.headers.svixTimestamp);
  const signature = nonEmpty(input.headers.svixSignature);
  if (!id || !timestamp || !signature) throw new ResendInboundWebhookAdapterError("RESEND_INBOUND_WEBHOOK_HEADERS_MISSING");
  let verified: unknown;
  try { verified = input.verify({ payload: input.payload, headers: { id, timestamp, signature }, webhookSecret }); } catch { throw new ResendInboundWebhookAdapterError("RESEND_INBOUND_WEBHOOK_SIGNATURE_INVALID"); }
  const event = record(verified);
  if (event == null || typeof event.type !== "string") throw new ResendInboundWebhookAdapterError("RESEND_INBOUND_WEBHOOK_EVENT_INVALID");
  if (event.type !== "email.received") return { disposition: "ignored", eventType: event.type };
  const data = record(event.data);
  const emailId = data != null && typeof data.email_id === "string" ? nonEmpty(data.email_id) : null;
  const inboundMessageId = data != null && typeof data.message_id === "string" ? normalizeMessageId(data.message_id) : null;
  const sender = data != null && typeof data.from === "string" ? normalizeInboundEmailAddress(data.from) : null;
  const recipients = data != null && Array.isArray(data.to) ? data.to.map((value) => typeof value === "string" ? normalizeInboundEmailAddress(value) : null).filter((value): value is string => value != null) : [];
  const occurredAt = typeof event.created_at === "string" ? nonEmpty(event.created_at) : null;
  const subject = data != null && typeof data.subject === "string" ? nonEmpty(data.subject) : null;
  if (!emailId || !inboundMessageId || !sender || recipients.length === 0 || !occurredAt || Number.isNaN(Date.parse(occurredAt))) throw new ResendInboundWebhookAdapterError("RESEND_INBOUND_WEBHOOK_EVENT_INVALID");
  return { disposition: "received", provider: "resend", providerEventId: id, emailId, inboundMessageId, sender, recipients, subject, occurredAt };
}

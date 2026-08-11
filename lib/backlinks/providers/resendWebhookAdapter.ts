export type ResendWebhookHeaders = {
  svixId: string | null | undefined;
  svixTimestamp: string | null | undefined;
  svixSignature: string | null | undefined;
};

export type ResendWebhookVerify = (input: {
  payload: string;
  headers: { id: string; timestamp: string; signature: string };
  webhookSecret: string;
}) => unknown;

export type ResendOutreachWebhookEventType = "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained";
export type BacklinkResendBounceType = "permanent" | "transient" | "undetermined" | "unknown";
export type ResendOutreachWebhookResult =
  | { disposition: "ignored"; eventType: string }
  | { disposition: "normalized"; provider: "resend"; providerEventId: string; providerMessageId: string; eventType: "email.bounced"; occurredAt: string; bounceType: BacklinkResendBounceType }
  | { disposition: "normalized"; provider: "resend"; providerEventId: string; providerMessageId: string; eventType: Exclude<ResendOutreachWebhookEventType, "email.bounced">; occurredAt: string };
export type ResendWebhookAdapterErrorCode = "RESEND_WEBHOOK_SECRET_MISSING" | "RESEND_WEBHOOK_HEADERS_MISSING" | "RESEND_WEBHOOK_SIGNATURE_INVALID" | "RESEND_WEBHOOK_EVENT_INVALID";

export class ResendWebhookAdapterError extends Error {
  constructor(public readonly code: ResendWebhookAdapterErrorCode) {
    super(code);
    this.name = "ResendWebhookAdapterError";
  }
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) output[key] = entry;
  return output;
}

function nonEmpty(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function supportedEventType(value: string): value is ResendOutreachWebhookEventType {
  return value === "email.delivered" || value === "email.delivery_delayed" || value === "email.bounced" || value === "email.complained";
}

export function normalizeResendBounceType(value: unknown): BacklinkResendBounceType {
  if (value === "Permanent") return "permanent";
  if (value === "Transient" || value === "Temporary") return "transient";
  if (value === "Undetermined") return "undetermined";
  return "unknown";
}

export function verifyAndNormalizeResendOutreachWebhook(input: { payload: string; headers: ResendWebhookHeaders; webhookSecret: string | null | undefined; verify: ResendWebhookVerify }): ResendOutreachWebhookResult {
  const webhookSecret = nonEmpty(input.webhookSecret);
  if (!webhookSecret) throw new ResendWebhookAdapterError("RESEND_WEBHOOK_SECRET_MISSING");
  const id = nonEmpty(input.headers.svixId);
  const timestamp = nonEmpty(input.headers.svixTimestamp);
  const signature = nonEmpty(input.headers.svixSignature);
  if (!id || !timestamp || !signature) throw new ResendWebhookAdapterError("RESEND_WEBHOOK_HEADERS_MISSING");
  let verified: unknown;
  try {
    verified = input.verify({ payload: input.payload, headers: { id, timestamp, signature }, webhookSecret });
  } catch {
    throw new ResendWebhookAdapterError("RESEND_WEBHOOK_SIGNATURE_INVALID");
  }
  const event = record(verified);
  if (event == null) throw new ResendWebhookAdapterError("RESEND_WEBHOOK_EVENT_INVALID");
  const eventType = typeof event.type === "string" ? nonEmpty(event.type) : null;
  if (!eventType) throw new ResendWebhookAdapterError("RESEND_WEBHOOK_EVENT_INVALID");
  if (!supportedEventType(eventType)) return { disposition: "ignored", eventType };
  const occurredAt = typeof event.created_at === "string" ? nonEmpty(event.created_at) : null;
  const data = record(event.data);
  const providerMessageId = data != null && typeof data.email_id === "string" ? nonEmpty(data.email_id) : null;
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt)) || !providerMessageId) throw new ResendWebhookAdapterError("RESEND_WEBHOOK_EVENT_INVALID");
  if (eventType === "email.bounced") {
    const bounce = data == null ? null : record(data.bounce);
    return { disposition: "normalized", provider: "resend", providerEventId: id, providerMessageId, eventType, occurredAt, bounceType: normalizeResendBounceType(bounce?.type) };
  }
  return { disposition: "normalized", provider: "resend", providerEventId: id, providerMessageId, eventType, occurredAt };
}

import type { Database } from "@/types/database.types";

import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";
import type { BacklinkRepositoryClient } from "./repositoryClient";

export type BacklinkOutreachInboundMessageRow = Database["public"]["Tables"]["backlink_outreach_inbound_messages"]["Row"];
type BacklinkOutreachInboundMessageInsert = Database["public"]["Tables"]["backlink_outreach_inbound_messages"]["Insert"];
export type BacklinkOutreachInboundCorrelationStatus = "correlated" | "unmatched" | "ambiguous" | "ignored";
export type CreateBacklinkOutreachInboundMessageInput = {
  workspaceId: string | null;
  outreachId: string | null;
  attemptId: string | null;
  contactId: string | null;
  provider: "resend";
  providerEventId: string;
  inboundMessageId: string;
  correlationStatus: BacklinkOutreachInboundCorrelationStatus;
  correlationMethod: "reply_token" | null;
  sender: string;
  recipient: string;
  subject: string | null;
  textBody: string | null;
  inReplyTo: string | null;
  referencesHeader: string | null;
  receivedAt: string;
  occurredAt: string;
};
export type BacklinkOutreachInboundMessageReservation = { message: BacklinkOutreachInboundMessageRow; disposition: "created" | "existing" };

function required(operation: string, value: string, field: string): string { const normalized = value.trim(); if (!normalized) throw new BacklinkRepositoryError({ code: "VALIDATION", operation, message: `${field} is required.` }); return normalized; }

export async function getBacklinkOutreachInboundMessageByProviderEventId(client: BacklinkRepositoryClient, provider: string, providerEventId: string): Promise<BacklinkOutreachInboundMessageRow | null> {
  const operation = "getBacklinkOutreachInboundMessageByProviderEventId";
  const normalizedProvider = required(operation, provider, "provider");
  if (normalizedProvider !== "resend") throw new BacklinkRepositoryError({ code: "VALIDATION", operation, message: "The provided data is invalid." });
  const { data, error } = await client.from("backlink_outreach_inbound_messages").select("*").eq("provider", normalizedProvider).eq("provider_event_id", required(operation, providerEventId, "providerEventId")).maybeSingle();
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return data;
}

export async function createBacklinkOutreachInboundMessage(client: BacklinkRepositoryClient, input: CreateBacklinkOutreachInboundMessageInput): Promise<BacklinkOutreachInboundMessageReservation> {
  const operation = "createBacklinkOutreachInboundMessage";
  const providerEventId = required(operation, input.providerEventId, "providerEventId");
  const payload: BacklinkOutreachInboundMessageInsert = {
    workspace_id: input.workspaceId,
    outreach_id: input.outreachId,
    attempt_id: input.attemptId,
    contact_id: input.contactId,
    provider: input.provider,
    provider_event_id: providerEventId,
    inbound_message_id: required(operation, input.inboundMessageId, "inboundMessageId"),
    correlation_status: input.correlationStatus,
    correlation_method: input.correlationMethod,
    sender: required(operation, input.sender, "sender"),
    recipient: required(operation, input.recipient, "recipient"),
    subject: input.subject,
    text_body: input.textBody,
    in_reply_to: input.inReplyTo,
    references_header: input.referencesHeader,
    received_at: required(operation, input.receivedAt, "receivedAt"),
    occurred_at: required(operation, input.occurredAt, "occurredAt"),
  };
  const { data, error } = await client.from("backlink_outreach_inbound_messages").insert(payload).select("*").single();
  if (error == null) return { message: data, disposition: "created" };
  const normalized = normalizeBacklinkRepositoryError(operation, error);
  if (normalized.code !== "CONFLICT") throw normalized;
  const existing = await getBacklinkOutreachInboundMessageByProviderEventId(client, input.provider, providerEventId);
  if (existing != null) return { message: existing, disposition: "existing" };
  throw normalized;
}

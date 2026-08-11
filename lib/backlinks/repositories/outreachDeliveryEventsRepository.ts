import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { WorkspaceId } from "./types";
import type { Database } from "@/types/database.types";
import type { BacklinkResendBounceType } from "../providers/resendWebhookAdapter";

export type BacklinkOutreachDeliveryEventRow = Database["public"]["Tables"]["backlink_outreach_delivery_events"]["Row"];
export type BacklinkOutreachDeliveryEventInsert = Database["public"]["Tables"]["backlink_outreach_delivery_events"]["Insert"];
export type BacklinkOutreachDeliveryEventType = "email.delivered" | "email.delivery_delayed" | "email.bounced" | "email.complained";
export type CreateBacklinkOutreachDeliveryEventInput = {
  workspaceId: string;
  outreachId: string;
  attemptId: string;
  provider: "resend";
  providerEventId: string;
  providerMessageId: string;
  eventType: BacklinkOutreachDeliveryEventType;
  bounceType: BacklinkResendBounceType | null;
  occurredAt: string;
  receivedAt: string;
};
export type BacklinkOutreachDeliveryEventReservation = { event: BacklinkOutreachDeliveryEventRow; disposition: "created" | "existing" };

function required(operation: string, value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new BacklinkRepositoryError({ code: "VALIDATION", operation, message: `${field} is required.` });
  return normalized;
}

export async function getBacklinkOutreachDeliveryEventByProviderEventId(client: BacklinkRepositoryClient, provider: string, providerEventId: string): Promise<BacklinkOutreachDeliveryEventRow | null> {
  const operation = "getBacklinkOutreachDeliveryEventByProviderEventId";
  const normalizedProvider = required(operation, provider, "provider");
  const normalizedProviderEventId = required(operation, providerEventId, "providerEventId");
  if (normalizedProvider !== "resend") throw new BacklinkRepositoryError({ code: "VALIDATION", operation, message: "The provided data is invalid." });
  const { data, error } = await client.from("backlink_outreach_delivery_events").select("*").eq("provider", normalizedProvider).eq("provider_event_id", normalizedProviderEventId).maybeSingle();
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return data;
}

export async function listBacklinkOutreachDeliveryEventsForOutreach(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, outreachId: string): Promise<BacklinkOutreachDeliveryEventRow[]> {
  const { data, error } = await client.from("backlink_outreach_delivery_events").select("*").eq("workspace_id", workspaceId).eq("outreach_id", outreachId).order("occurred_at", { ascending: false }).order("id", { ascending: false });
  if (error != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachDeliveryEventsForOutreach", error);
  return data ?? [];
}

export async function createBacklinkOutreachDeliveryEvent(client: BacklinkRepositoryClient, input: CreateBacklinkOutreachDeliveryEventInput): Promise<BacklinkOutreachDeliveryEventReservation> {
  const operation = "createBacklinkOutreachDeliveryEvent";
  const providerEventId = required(operation, input.providerEventId, "providerEventId");
  const payload: BacklinkOutreachDeliveryEventInsert = {
    workspace_id: required(operation, input.workspaceId, "workspaceId"),
    outreach_id: required(operation, input.outreachId, "outreachId"),
    attempt_id: required(operation, input.attemptId, "attemptId"),
    provider: input.provider,
    provider_event_id: providerEventId,
    provider_message_id: required(operation, input.providerMessageId, "providerMessageId"),
    event_type: input.eventType,
    bounce_type: input.bounceType,
    occurred_at: required(operation, input.occurredAt, "occurredAt"),
    received_at: required(operation, input.receivedAt, "receivedAt"),
  };
  const { data, error } = await client.from("backlink_outreach_delivery_events").insert(payload).select("*").single();
  if (error == null) return { event: data, disposition: "created" };
  const normalized = normalizeBacklinkRepositoryError(operation, error);
  if (normalized.code !== "CONFLICT") throw normalized;
  const existing = await getBacklinkOutreachDeliveryEventByProviderEventId(client, input.provider, providerEventId);
  if (existing != null) return { event: existing, disposition: "existing" };
  throw normalized;
}

import type { Database } from "@/types/database.types";

import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkOutreachInboundMessageRow } from "./outreachInboundMessagesRepository";

type RpcName = "classify_backlink_outreach_inbound_reply";
type RpcArgs = Database["public"]["Functions"][RpcName]["Args"];
type RpcRow = Database["public"]["Functions"][RpcName]["Returns"][number];

export type BacklinkOutreachInboundReplyClassification = "positive" | "negative";
export type ClassifyBacklinkOutreachInboundReplyRpcClient = { rpc(name: RpcName, args: RpcArgs): PromiseLike<{ data: RpcRow[] | null; error: unknown }> };
export type ClassifyBacklinkOutreachInboundReplyInput = { inboundMessageId: string; classification: BacklinkOutreachInboundReplyClassification; classifiedBy: string; classifiedAt: string };
export type ClassifyBacklinkOutreachInboundReplyResult = { disposition: "applied" | "existing"; inboundMessageId: string; outreachId: string; contactId: string; classification: BacklinkOutreachInboundReplyClassification; outreachStatus: string; classifiedAt: string };
export type BacklinkOutreachInboundReply = { id: string; sender: string; recipient: string; subject: string | null; textBody: string | null; occurredAt: string; receivedAt: string; correlationMethod: "reply_token"; effectApplied: boolean; classification: { value: BacklinkOutreachInboundReplyClassification; classifiedAt: string } | null };
export type BacklinkOutreachInboundReplySummary = { correlatedCount: number; unclassifiedCount: number; latestReceivedAt: string | null };

function required(operation: string, value: string, field: string) { const normalized = value.trim(); if (!normalized) throw new BacklinkRepositoryError({ code: "VALIDATION", operation, message: `${field} is required.` }); return normalized; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function invalid(operation: string): never { throw new BacklinkRepositoryError({ code: "DATABASE", operation, message: "The database returned an invalid inbound reply classification result." }); }
function stableMessage(error: unknown) { return isRecord(error) && typeof error.message === "string" ? error.message : null; }

function normalizeRpcError(operation: string, error: unknown): BacklinkRepositoryError {
  const message = stableMessage(error);
  if (message === "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_MESSAGE_NOT_FOUND") return new BacklinkRepositoryError({ code: "NOT_FOUND", operation, message: "The requested inbound message was not found." });
  if (message === "BACKLINK_OUTREACH_INBOUND_REPLY_STOP_REQUIRED" || message === "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_OUTREACH_NOT_ACTIVE" || message === "BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_CONFLICT") return new BacklinkRepositoryError({ code: "CONFLICT", operation, message: message === "BACKLINK_OUTREACH_INBOUND_REPLY_STOP_REQUIRED" ? "The inbound reply stop signal has not been applied yet." : "The inbound reply cannot be classified." });
  if (message?.startsWith("BACKLINK_OUTREACH_INBOUND_REPLY_CLASSIFICATION_")) return new BacklinkRepositoryError({ code: "VALIDATION", operation, message: "The inbound reply cannot be classified." });
  return normalizeBacklinkRepositoryError(operation, error);
}

function mapResult(value: unknown, operation: string): ClassifyBacklinkOutreachInboundReplyResult {
  if (!isRecord(value)) return invalid(operation);
  const { disposition, inbound_message_id: inboundMessageId, outreach_id: outreachId, contact_id: contactId, classification, outreach_status: outreachStatus, classified_at: classifiedAt } = value;
  if ((disposition !== "applied" && disposition !== "existing") || typeof inboundMessageId !== "string" || typeof outreachId !== "string" || typeof contactId !== "string" || (classification !== "positive" && classification !== "negative") || typeof outreachStatus !== "string" || typeof classifiedAt !== "string") return invalid(operation);
  return { disposition, inboundMessageId, outreachId, contactId, classification, outreachStatus, classifiedAt };
}

export async function getBacklinkOutreachInboundMessageById(client: BacklinkRepositoryClient, inboundMessageId: string): Promise<BacklinkOutreachInboundMessageRow> {
  const operation = "getBacklinkOutreachInboundMessageById";
  const { data, error } = await client.from("backlink_outreach_inbound_messages").select("*").eq("id", required(operation, inboundMessageId, "inboundMessageId")).maybeSingle();
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  if (data == null) throw new BacklinkRepositoryError({ code: "NOT_FOUND", operation, message: "The requested inbound message was not found." });
  return data;
}

export async function classifyBacklinkOutreachInboundReply(client: ClassifyBacklinkOutreachInboundReplyRpcClient, input: ClassifyBacklinkOutreachInboundReplyInput): Promise<ClassifyBacklinkOutreachInboundReplyResult> {
  const operation = "classifyBacklinkOutreachInboundReply";
  const { data, error } = await client.rpc("classify_backlink_outreach_inbound_reply", { p_inbound_message_id: required(operation, input.inboundMessageId, "inboundMessageId"), p_classification: input.classification, p_classified_by: required(operation, input.classifiedBy, "classifiedBy"), p_classified_at: required(operation, input.classifiedAt, "classifiedAt") });
  if (error != null) throw normalizeRpcError(operation, error);
  if (!Array.isArray(data) || data.length !== 1) return invalid(operation);
  return mapResult(data[0], operation);
}

export async function listBacklinkOutreachInboundRepliesForOutreach(client: BacklinkRepositoryClient, workspaceId: string, outreachId: string): Promise<BacklinkOutreachInboundReply[]> {
  const { data: messages, error } = await client.from("backlink_outreach_inbound_messages").select("id,sender,recipient,subject,text_body,occurred_at,received_at,correlation_method").eq("workspace_id", workspaceId).eq("outreach_id", outreachId).eq("correlation_status", "correlated").order("occurred_at", { ascending: false }).order("id", { ascending: false });
  if (error != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachInboundRepliesForOutreach", error);
  const ids = (messages ?? []).map((message) => message.id);
  if (ids.length === 0) return [];
  const [{ data: classifications, error: classificationsError }, { data: effects, error: effectsError }] = await Promise.all([
    client.from("backlink_outreach_inbound_reply_classifications").select("inbound_message_id,classification,classified_at").in("inbound_message_id", ids),
    client.from("backlink_outreach_inbound_effects").select("inbound_message_id").in("inbound_message_id", ids).eq("effect_kind", "reply_received_stop").eq("status", "applied"),
  ]);
  if (classificationsError != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachInboundRepliesForOutreach", classificationsError);
  if (effectsError != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachInboundRepliesForOutreach", effectsError);
  const classificationByMessage = new Map((classifications ?? []).map((row) => [row.inbound_message_id, row]));
  const effectsByMessage = new Set((effects ?? []).map((row) => row.inbound_message_id));
  return (messages ?? []).map((message) => { const classification = classificationByMessage.get(message.id); return { id: message.id, sender: message.sender, recipient: message.recipient, subject: message.subject, textBody: message.text_body, occurredAt: message.occurred_at, receivedAt: message.received_at, correlationMethod: "reply_token", effectApplied: effectsByMessage.has(message.id), classification: classification != null && (classification.classification === "positive" || classification.classification === "negative") ? { value: classification.classification, classifiedAt: classification.classified_at } : null }; });
}

export async function listBacklinkOutreachInboundReplySummariesForOutreachIds(client: BacklinkRepositoryClient, workspaceId: string, outreachIds: readonly string[]): Promise<Map<string, BacklinkOutreachInboundReplySummary>> {
  if (outreachIds.length === 0) return new Map();
  const { data: messages, error } = await client.from("backlink_outreach_inbound_messages").select("id,outreach_id,received_at").eq("workspace_id", workspaceId).eq("correlation_status", "correlated").in("outreach_id", outreachIds);
  if (error != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachInboundReplySummariesForOutreachIds", error);
  const ids = (messages ?? []).map((message) => message.id);
  const { data: classifications, error: classificationsError } = ids.length === 0 ? { data: [], error: null } : await client.from("backlink_outreach_inbound_reply_classifications").select("inbound_message_id").in("inbound_message_id", ids);
  if (classificationsError != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachInboundReplySummariesForOutreachIds", classificationsError);
  const classified = new Set((classifications ?? []).map((row) => row.inbound_message_id)); const summaries = new Map<string, BacklinkOutreachInboundReplySummary>();
  for (const message of messages ?? []) { if (message.outreach_id == null) continue; const current = summaries.get(message.outreach_id) ?? { correlatedCount: 0, unclassifiedCount: 0, latestReceivedAt: null }; summaries.set(message.outreach_id, { correlatedCount: current.correlatedCount + 1, unclassifiedCount: current.unclassifiedCount + (classified.has(message.id) ? 0 : 1), latestReceivedAt: current.latestReceivedAt == null || message.received_at > current.latestReceivedAt ? message.received_at : current.latestReceivedAt }); }
  return summaries;
}

import type { Database } from "@/types/database.types";

import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";

type ApplyBacklinkOutreachInboundReplyStopRpcName = "apply_backlink_outreach_inbound_reply_stop";
type ApplyBacklinkOutreachInboundReplyStopRpcArgs = Database["public"]["Functions"][ApplyBacklinkOutreachInboundReplyStopRpcName]["Args"];
type ApplyBacklinkOutreachInboundReplyStopRpcRow = Database["public"]["Functions"][ApplyBacklinkOutreachInboundReplyStopRpcName]["Returns"][number];

export type ApplyBacklinkOutreachInboundReplyStopRpcClient = {
  rpc(
    functionName: ApplyBacklinkOutreachInboundReplyStopRpcName,
    args: ApplyBacklinkOutreachInboundReplyStopRpcArgs,
  ): PromiseLike<{ data: ApplyBacklinkOutreachInboundReplyStopRpcRow[] | null; error: unknown }>;
};

export type ApplyBacklinkOutreachInboundReplyStopInput = {
  inboundMessageId: string;
  appliedAt: string;
};

export type ApplyBacklinkOutreachInboundReplyStopResult = {
  disposition: "applied" | "existing";
  inboundMessageId: string;
  outreachId: string;
  contactId: string;
  outreachStatus: string;
  appliedAt: string;
};

function required(operation: string, value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new BacklinkRepositoryError({ code: "VALIDATION", operation, message: `${field} is required.` });
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function throwInvalidResult(operation: string): never {
  throw new BacklinkRepositoryError({ code: "DATABASE", operation, message: "The database returned an invalid inbound reply stop result." });
}

function mapResult(value: unknown, operation: string): ApplyBacklinkOutreachInboundReplyStopResult {
  if (!isRecord(value)) return throwInvalidResult(operation);
  const {
    disposition,
    inbound_message_id: inboundMessageId,
    outreach_id: outreachId,
    contact_id: contactId,
    outreach_status: outreachStatus,
    applied_at: appliedAt,
  } = value;
  if (
    (disposition !== "applied" && disposition !== "existing") ||
    typeof inboundMessageId !== "string" ||
    typeof outreachId !== "string" ||
    typeof contactId !== "string" ||
    typeof outreachStatus !== "string" ||
    typeof appliedAt !== "string"
  ) return throwInvalidResult(operation);
  return { disposition, inboundMessageId, outreachId, contactId, outreachStatus, appliedAt };
}

function stableRpcErrorMessage(error: unknown): string | null {
  if (!isRecord(error) || !("message" in error) || typeof error.message !== "string") return null;
  return error.message;
}

function normalizeInboundReplyStopRpcError(operation: string, error: unknown): BacklinkRepositoryError {
  const stableMessage = stableRpcErrorMessage(error);
  if (stableMessage === "BACKLINK_OUTREACH_INBOUND_REPLY_MESSAGE_NOT_FOUND") {
    return new BacklinkRepositoryError({ code: "NOT_FOUND", operation, message: "The requested inbound message was not found." });
  }
  if (
    stableMessage === "BACKLINK_OUTREACH_INBOUND_REPLY_APPLIED_AT_REQUIRED" ||
    stableMessage === "BACKLINK_OUTREACH_INBOUND_REPLY_SOURCE_INVALID" ||
    stableMessage === "BACKLINK_OUTREACH_INBOUND_REPLY_OUTREACH_MISMATCH" ||
    stableMessage === "BACKLINK_OUTREACH_INBOUND_REPLY_CONTACT_MISMATCH" ||
    stableMessage === "BACKLINK_OUTREACH_INBOUND_REPLY_INTEGRITY_MISMATCH" ||
    stableMessage === "BACKLINK_OUTREACH_INBOUND_REPLY_ATTEMPT_MISMATCH"
  ) return new BacklinkRepositoryError({ code: "VALIDATION", operation, message: "The inbound message cannot apply a reply stop effect." });
  return normalizeBacklinkRepositoryError(operation, error);
}

export async function applyBacklinkOutreachInboundReplyStop(
  client: ApplyBacklinkOutreachInboundReplyStopRpcClient,
  input: ApplyBacklinkOutreachInboundReplyStopInput,
): Promise<ApplyBacklinkOutreachInboundReplyStopResult> {
  const operation = "applyBacklinkOutreachInboundReplyStop";
  const { data, error } = await client.rpc("apply_backlink_outreach_inbound_reply_stop", {
    p_inbound_message_id: required(operation, input.inboundMessageId, "inboundMessageId"),
    p_applied_at: required(operation, input.appliedAt, "appliedAt"),
  });
  if (error != null) throw normalizeInboundReplyStopRpcError(operation, error);
  if (!Array.isArray(data) || data.length !== 1) return throwInvalidResult(operation);
  return mapResult(data[0], operation);
}

import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { WorkspaceId } from "./types";
import type { Database } from "@/types/database.types";

export type BacklinkOutreachAttemptRow = Database["public"]["Tables"]["backlink_outreach_attempts"]["Row"];
type BacklinkOutreachAttemptInsert = Database["public"]["Tables"]["backlink_outreach_attempts"]["Insert"];
type ReserveBacklinkOutreachFollowUpAttemptRpcName = "reserve_backlink_outreach_follow_up_attempt";
type ReserveBacklinkOutreachFollowUpAttemptRpcArgs = Database["public"]["Functions"][ReserveBacklinkOutreachFollowUpAttemptRpcName]["Args"];
type ReserveBacklinkOutreachFollowUpAttemptRpcRow = Database["public"]["Functions"][ReserveBacklinkOutreachFollowUpAttemptRpcName]["Returns"][number];
type ReserveBacklinkOutreachInitialAttemptRpcName = "reserve_backlink_outreach_initial_attempt";
type ReserveBacklinkOutreachInitialAttemptRpcArgs = Database["public"]["Functions"][ReserveBacklinkOutreachInitialAttemptRpcName]["Args"];
type ReserveBacklinkOutreachInitialAttemptRpcRow = Database["public"]["Functions"][ReserveBacklinkOutreachInitialAttemptRpcName]["Returns"][number];
type ReserveBacklinkOutreachApprovedInitialAttemptRpcName =
  "reserve_backlink_approved_initial_attempt_v2";
type ReserveBacklinkOutreachApprovedInitialAttemptRpcArgs =
  Database["public"]["Functions"][ReserveBacklinkOutreachApprovedInitialAttemptRpcName]["Args"];
type ReserveBacklinkOutreachApprovedInitialAttemptRpcRow =
  Database["public"]["Functions"][ReserveBacklinkOutreachApprovedInitialAttemptRpcName]["Returns"][number];
type CancelBacklinkOutreachPreparedFollowUpAttemptRpcName = "cancel_backlink_outreach_prepared_follow_up_attempt";
type CancelBacklinkOutreachPreparedFollowUpAttemptRpcArgs = Database["public"]["Functions"][CancelBacklinkOutreachPreparedFollowUpAttemptRpcName]["Args"];
type CancelBacklinkOutreachPreparedFollowUpAttemptRpcRow = Database["public"]["Functions"][CancelBacklinkOutreachPreparedFollowUpAttemptRpcName]["Returns"][number];
type ApplyBacklinkOutreachFollowUpAcceptedRpcName = "apply_backlink_outreach_follow_up_accepted";
type ApplyBacklinkOutreachFollowUpAcceptedRpcArgs = Database["public"]["Functions"][ApplyBacklinkOutreachFollowUpAcceptedRpcName]["Args"];
type ApplyBacklinkOutreachFollowUpAcceptedRpcRow = Database["public"]["Functions"][ApplyBacklinkOutreachFollowUpAcceptedRpcName]["Returns"][number];
type MarkBacklinkOutreachFollowUpAttemptRequestedRpcName = "mark_backlink_outreach_follow_up_attempt_requested";
type MarkBacklinkOutreachFollowUpAttemptRequestedRpcArgs = Database["public"]["Functions"][MarkBacklinkOutreachFollowUpAttemptRequestedRpcName]["Args"];
type MarkBacklinkOutreachFollowUpAttemptRequestedRpcRow = Database["public"]["Functions"][MarkBacklinkOutreachFollowUpAttemptRequestedRpcName]["Returns"][number];
export type BacklinkOutreachAttemptKind = "initial" | "follow_up";
export type CreateBacklinkOutreachAttemptInput = { attemptId: string; outreachId: string; actorUserId: string; channel: string; provider: string; recipient: string; idempotencyKey: string; replyTokenHash: string; replyTokenKeyVersion: string; attemptKind: BacklinkOutreachAttemptKind };
export type BacklinkOutreachAttemptStatePatch = Pick<BacklinkOutreachAttemptInsert, "status" | "provider_message_id" | "error_code" | "error_message" | "accepted_at" | "failed_at" | "resolved_at">;
export type BacklinkOutreachAttemptRateLimitReason =
  | "WORKSPACE_DAILY_LIMIT_REACHED"
  | "WORKSPACE_HOURLY_LIMIT_REACHED"
  | "DOMAIN_DAILY_LIMIT_REACHED"
  | "CONTACT_DAILY_LIMIT_REACHED";
export type BacklinkOutreachAttemptReservation =
  | { attempt: BacklinkOutreachAttemptRow; disposition: "created" | "existing"; rateLimitReason: null }
  | { attempt: null; disposition: "rate_limited"; rateLimitReason: BacklinkOutreachAttemptRateLimitReason };
export type BacklinkOutreachApprovedInitialAttemptSnapshotRow =
  Database["public"]["Tables"]["backlink_outreach_initial_attempt_snapshots"]["Row"];
export type BacklinkOutreachApprovedInitialAttemptResult =
  | {
      attempt: BacklinkOutreachAttemptRow;
      snapshot: BacklinkOutreachApprovedInitialAttemptSnapshotRow;
      disposition: "created" | "existing";
      rateLimitReason: null;
    }
  | {
      attempt: null;
      snapshot: null;
      disposition:
        | "not_approved"
        | "approval_stale"
        | "campaign_disabled"
        | "not_ready"
        | "invalid_recipient"
        | "missing_approved_content"
        | "ineligible";
      rateLimitReason: null;
    }
  | {
      attempt: null;
      snapshot: null;
      disposition: "rate_limited";
      rateLimitReason: BacklinkOutreachAttemptRateLimitReason;
    };
export type BacklinkOutreachAttemptSummary = {
  latestStatus: BacklinkOutreachAttemptRow["status"] | null;
  latestOpenAttemptId: string | null;
  latestOpenStatus: BacklinkOutreachAttemptRow["status"] | null;
  hasOpenAttempt: boolean;
};
export type BacklinkOutreachAttemptSendWindowRow = Pick<BacklinkOutreachAttemptRow, "outreach_id" | "requested_at" | "status">;
export type ReserveBacklinkOutreachFollowUpAttemptInput = { workspaceId: string; outreachId: string; attemptId: string; actorUserId: string; idempotencyKey: string; replyTokenHash: string; replyTokenKeyVersion: string; reservedAt: string };
export type ReserveBacklinkOutreachFollowUpAttemptResult = { disposition: "reserved" | "existing"; attemptId: string; outreachId: string; attemptStatus: "prepared" | "cancelled"; attemptKind: "follow_up"; preparedAt: string | null; requestedAt: string | null };
export type CancelBacklinkOutreachPreparedFollowUpAttemptInput = { workspaceId: string; outreachId: string; attemptId: string; cancelReason: "inbound_reply" | "provider_complaint" | "provider_permanent_bounce" | "contact_unavailable" | "admin_cancelled"; cancelledAt: string };
export type CancelBacklinkOutreachPreparedFollowUpAttemptResult = { disposition: "cancelled" | "existing"; attemptId: string; outreachId: string; attemptStatus: "cancelled"; cancelReason: CancelBacklinkOutreachPreparedFollowUpAttemptInput["cancelReason"]; cancelledAt: string };
export type ApplyBacklinkOutreachFollowUpAcceptedInput = { workspaceId: string; outreachId: string; attemptId: string; providerMessageId: string | null; acceptedAt: string };
export type ApplyBacklinkOutreachFollowUpAcceptedResult = { disposition: "applied" | "existing"; attemptStatus: "accepted"; outreachStatus: string; currentAttempt: number; lastAttemptAt: string | null };
export type MarkBacklinkOutreachFollowUpAttemptRequestedInput = { workspaceId: string; outreachId: string; attemptId: string; actorUserId: string; requestedAt: string };
export type MarkBacklinkOutreachFollowUpAttemptRequestedResult = { disposition: "requested_now" | "existing"; attemptId: string; outreachId: string; recipient: string; subject: string; body: string; replyTokenHash: string; replyTokenKeyVersion: string; requestedAt: string };
export type ReserveBacklinkOutreachFollowUpAttemptRpcClient = { rpc(functionName: ReserveBacklinkOutreachFollowUpAttemptRpcName, args: ReserveBacklinkOutreachFollowUpAttemptRpcArgs): PromiseLike<{ data: ReserveBacklinkOutreachFollowUpAttemptRpcRow[] | null; error: unknown }> };
export type ReserveBacklinkOutreachInitialAttemptRpcClient = BacklinkRepositoryClient;
export type CancelBacklinkOutreachPreparedFollowUpAttemptRpcClient = { rpc(functionName: CancelBacklinkOutreachPreparedFollowUpAttemptRpcName, args: CancelBacklinkOutreachPreparedFollowUpAttemptRpcArgs): PromiseLike<{ data: CancelBacklinkOutreachPreparedFollowUpAttemptRpcRow[] | null; error: unknown }> };
export type ApplyBacklinkOutreachFollowUpAcceptedRpcClient = { rpc(functionName: ApplyBacklinkOutreachFollowUpAcceptedRpcName, args: ApplyBacklinkOutreachFollowUpAcceptedRpcArgs): PromiseLike<{ data: ApplyBacklinkOutreachFollowUpAcceptedRpcRow[] | null; error: unknown }> };
export type MarkBacklinkOutreachFollowUpAttemptRequestedRpcClient = { rpc(functionName: MarkBacklinkOutreachFollowUpAttemptRequestedRpcName, args: MarkBacklinkOutreachFollowUpAttemptRequestedRpcArgs): PromiseLike<{ data: MarkBacklinkOutreachFollowUpAttemptRequestedRpcRow[] | null; error: unknown }> };

function required(value: string | null | undefined, field: string): string { const normalized = value?.trim(); if (!normalized) throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "createBacklinkOutreachAttempt", message: `${field} is required.` }); return normalized; }
function mapInitialAttemptReservation(value: unknown): {
  disposition: "created" | "existing" | "rate_limited";
  attemptId: string | null;
  rateLimitReason: BacklinkOutreachAttemptRateLimitReason | null;
} {
  if (!isRecord(value)) {
    throw new BacklinkRepositoryError({ code: "DATABASE", operation: "reserveBacklinkOutreachAttempt", message: "The database returned an invalid initial attempt reservation." });
  }

  const { disposition, attempt_id: attemptId, rate_limit_reason: rateLimitReason } = value;
  if (disposition === "rate_limited") {
    if (
      typeof rateLimitReason !== "string" ||
      (rateLimitReason !== "WORKSPACE_DAILY_LIMIT_REACHED" &&
        rateLimitReason !== "WORKSPACE_HOURLY_LIMIT_REACHED" &&
        rateLimitReason !== "DOMAIN_DAILY_LIMIT_REACHED" &&
        rateLimitReason !== "CONTACT_DAILY_LIMIT_REACHED")
    ) {
      throw new BacklinkRepositoryError({ code: "DATABASE", operation: "reserveBacklinkOutreachAttempt", message: "The database returned an invalid initial attempt reservation." });
    }
    return { disposition, attemptId: null, rateLimitReason };
  }

  if ((disposition !== "created" && disposition !== "existing") || typeof attemptId !== "string") {
    throw new BacklinkRepositoryError({ code: "DATABASE", operation: "reserveBacklinkOutreachAttempt", message: "The database returned an invalid initial attempt reservation." });
  }

  return { disposition, attemptId, rateLimitReason: null };
}
export async function getBacklinkOutreachAttemptById(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, attemptId: string): Promise<BacklinkOutreachAttemptRow> { const { data, error } = await client.from("backlink_outreach_attempts").select("*").eq("workspace_id", workspaceId).eq("id", attemptId).maybeSingle(); if (error != null) throw normalizeBacklinkRepositoryError("getBacklinkOutreachAttemptById", error); if (data == null) throw new BacklinkRepositoryError({ code: "NOT_FOUND", operation: "getBacklinkOutreachAttemptById", message: "The requested record was not found." }); return data; }
export async function getBacklinkOutreachAttemptByIdempotencyKey(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, idempotencyKey: string): Promise<BacklinkOutreachAttemptRow | null> { const { data, error } = await client.from("backlink_outreach_attempts").select("*").eq("workspace_id", workspaceId).eq("idempotency_key", idempotencyKey.trim()).maybeSingle(); if (error != null) throw normalizeBacklinkRepositoryError("getBacklinkOutreachAttemptByIdempotencyKey", error); return data; }
export async function getBacklinkOutreachAttemptByProviderMessageId(client: BacklinkRepositoryClient, provider: string, providerMessageId: string): Promise<BacklinkOutreachAttemptRow | null> { const normalizedProvider = provider.trim(); const normalizedProviderMessageId = providerMessageId.trim(); if (normalizedProvider !== "resend" || !normalizedProviderMessageId) throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "getBacklinkOutreachAttemptByProviderMessageId", message: "The provided data is invalid." }); const { data, error } = await client.from("backlink_outreach_attempts").select("*").eq("provider", normalizedProvider).eq("provider_message_id", normalizedProviderMessageId).maybeSingle(); if (error != null) throw normalizeBacklinkRepositoryError("getBacklinkOutreachAttemptByProviderMessageId", error); return data; }
export async function getBacklinkOutreachAttemptByReplyTokenHash(client: BacklinkRepositoryClient, replyTokenHash: string): Promise<BacklinkOutreachAttemptRow | null> { const normalizedReplyTokenHash = replyTokenHash.trim(); if (!/^[0-9a-f]{64}$/i.test(normalizedReplyTokenHash)) throw new BacklinkRepositoryError({ code: "VALIDATION", operation: "getBacklinkOutreachAttemptByReplyTokenHash", message: "The provided data is invalid." }); const { data, error } = await client.from("backlink_outreach_attempts").select("*").eq("reply_token_hash", normalizedReplyTokenHash.toLowerCase()).maybeSingle(); if (error != null) throw normalizeBacklinkRepositoryError("getBacklinkOutreachAttemptByReplyTokenHash", error); return data; }
export async function listBacklinkOutreachAttemptsForOutreach(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, outreachId: string): Promise<BacklinkOutreachAttemptRow[]> { const { data, error } = await client.from("backlink_outreach_attempts").select("*").eq("workspace_id", workspaceId).eq("outreach_id", outreachId).order("requested_at", { ascending: false }); if (error != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachAttemptsForOutreach", error); return data ?? []; }
export async function getLatestBacklinkOutreachAttemptForOutreach(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, outreachId: string): Promise<BacklinkOutreachAttemptRow | null> { const { data, error } = await client.from("backlink_outreach_attempts").select("*").eq("workspace_id", workspaceId).eq("outreach_id", outreachId).order("created_at", { ascending: false }).order("id", { ascending: false }).maybeSingle(); if (error != null) throw normalizeBacklinkRepositoryError("getLatestBacklinkOutreachAttemptForOutreach", error); return data; }
export async function listBacklinkOutreachAttemptSummariesForOutreachIds(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, outreachIds: readonly string[]): Promise<Map<string, BacklinkOutreachAttemptSummary>> { if (outreachIds.length === 0) return new Map(); const { data, error } = await client.from("backlink_outreach_attempts").select("outreach_id,status,id").eq("workspace_id", workspaceId).in("outreach_id", outreachIds).order("created_at", { ascending: false }).order("id", { ascending: false }); if (error != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachAttemptSummariesForOutreachIds", error); const summaries = new Map<string, BacklinkOutreachAttemptSummary>(); for (const attempt of data ?? []) { const current = summaries.get(attempt.outreach_id); const isOpen = attempt.status === "prepared" || attempt.status === "requested" || attempt.status === "unknown"; summaries.set(attempt.outreach_id, { latestStatus: current?.latestStatus ?? attempt.status, latestOpenAttemptId: current?.latestOpenAttemptId ?? (isOpen ? attempt.id : null), latestOpenStatus: current?.latestOpenStatus ?? (isOpen ? attempt.status : null), hasOpenAttempt: Boolean(current?.hasOpenAttempt || isOpen) }); } return summaries; }
export async function getOpenBacklinkOutreachAttemptForOutreach(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, outreachId: string): Promise<BacklinkOutreachAttemptRow | null> { const { data, error } = await client.from("backlink_outreach_attempts").select("*").eq("workspace_id", workspaceId).eq("outreach_id", outreachId).in("status", ["prepared", "requested", "unknown"]).order("created_at", { ascending: false }).maybeSingle(); if (error != null) throw normalizeBacklinkRepositoryError("getOpenBacklinkOutreachAttemptForOutreach", error); return data; }
export async function listBacklinkOutreachAttemptSendWindowRows(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, since: string): Promise<BacklinkOutreachAttemptSendWindowRow[]> { const { data, error } = await client.from("backlink_outreach_attempts").select("outreach_id, requested_at, status").eq("workspace_id", workspaceId).eq("channel", "email").in("status", ["requested", "accepted", "failed", "unknown"]).gte("requested_at", since).order("requested_at", { ascending: false }).order("id", { ascending: false }); if (error != null) throw normalizeBacklinkRepositoryError("listBacklinkOutreachAttemptSendWindowRows", error); return data ?? []; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function mapFollowUpReservation(value: unknown): ReserveBacklinkOutreachFollowUpAttemptResult { if (!isRecord(value)) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "reserveBacklinkOutreachFollowUpAttempt", message: "The database returned an invalid follow-up reservation." }); const { disposition, attempt_id: attemptId, outreach_id: outreachId, attempt_status: attemptStatus, attempt_kind: attemptKind, prepared_at: preparedAt, requested_at: requestedAt } = value; if ((disposition !== "reserved" && disposition !== "existing") || typeof attemptId !== "string" || typeof outreachId !== "string" || (attemptStatus !== "prepared" && attemptStatus !== "cancelled") || attemptKind !== "follow_up" || (typeof preparedAt !== "string" && preparedAt !== null) || (typeof requestedAt !== "string" && requestedAt !== null)) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "reserveBacklinkOutreachFollowUpAttempt", message: "The database returned an invalid follow-up reservation." }); return { disposition, attemptId, outreachId, attemptStatus, attemptKind, preparedAt, requestedAt }; }
function normalizeFollowUpReservationError(error: unknown): BacklinkRepositoryError { if (typeof error === "object" && error != null && "message" in error && typeof error.message === "string" && error.message.startsWith("FOLLOW_UP_")) { const code = error.message === "FOLLOW_UP_IDEMPOTENCY_CONFLICT" ? "CONFLICT" : "VALIDATION"; return new BacklinkRepositoryError({ code, operation: "reserveBacklinkOutreachFollowUpAttempt", message: error.message }); } return normalizeBacklinkRepositoryError("reserveBacklinkOutreachFollowUpAttempt", error); }
export async function reserveBacklinkOutreachFollowUpAttempt(client: ReserveBacklinkOutreachFollowUpAttemptRpcClient, input: ReserveBacklinkOutreachFollowUpAttemptInput): Promise<ReserveBacklinkOutreachFollowUpAttemptResult> { const { data, error } = await client.rpc("reserve_backlink_outreach_follow_up_attempt", { p_workspace_id: required(input.workspaceId, "workspaceId"), p_outreach_id: required(input.outreachId, "outreachId"), p_attempt_id: required(input.attemptId, "attemptId"), p_actor_user_id: required(input.actorUserId, "actorUserId"), p_idempotency_key: required(input.idempotencyKey, "idempotencyKey"), p_reply_token_hash: required(input.replyTokenHash, "replyTokenHash"), p_reply_token_key_version: required(input.replyTokenKeyVersion, "replyTokenKeyVersion"), p_reserved_at: required(input.reservedAt, "reservedAt") }); if (error != null) throw normalizeFollowUpReservationError(error); if (!Array.isArray(data) || data.length !== 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "reserveBacklinkOutreachFollowUpAttempt", message: "The database returned an invalid follow-up reservation." }); return mapFollowUpReservation(data[0]); }
function mapFollowUpAccepted(value: unknown): ApplyBacklinkOutreachFollowUpAcceptedResult { if (!isRecord(value)) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "applyBacklinkOutreachFollowUpAccepted", message: "The database returned an invalid follow-up accepted result." }); const { disposition, attempt_status: attemptStatus, outreach_status: outreachStatus, current_attempt: currentAttempt, last_attempt_at: lastAttemptAt } = value; if ((disposition !== "applied" && disposition !== "existing") || attemptStatus !== "accepted" || typeof outreachStatus !== "string" || typeof currentAttempt !== "number" || (typeof lastAttemptAt !== "string" && lastAttemptAt !== null)) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "applyBacklinkOutreachFollowUpAccepted", message: "The database returned an invalid follow-up accepted result." }); return { disposition, attemptStatus, outreachStatus, currentAttempt, lastAttemptAt }; }
function normalizeFollowUpAcceptedError(error: unknown): BacklinkRepositoryError { if (typeof error === "object" && error != null && "message" in error && typeof error.message === "string" && error.message.startsWith("FOLLOW_UP_ACCEPTED_")) return new BacklinkRepositoryError({ code: error.message.includes("CONFLICT") ? "CONFLICT" : "VALIDATION", operation: "applyBacklinkOutreachFollowUpAccepted", message: error.message }); return normalizeBacklinkRepositoryError("applyBacklinkOutreachFollowUpAccepted", error); }
export async function applyBacklinkOutreachFollowUpAccepted(client: ApplyBacklinkOutreachFollowUpAcceptedRpcClient, input: ApplyBacklinkOutreachFollowUpAcceptedInput): Promise<ApplyBacklinkOutreachFollowUpAcceptedResult> { const { data, error } = await client.rpc("apply_backlink_outreach_follow_up_accepted", { p_workspace_id: required(input.workspaceId, "workspaceId"), p_outreach_id: required(input.outreachId, "outreachId"), p_attempt_id: required(input.attemptId, "attemptId"), p_provider_message_id: input.providerMessageId, p_accepted_at: required(input.acceptedAt, "acceptedAt") }); if (error != null) throw normalizeFollowUpAcceptedError(error); if (!Array.isArray(data) || data.length !== 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "applyBacklinkOutreachFollowUpAccepted", message: "The database returned an invalid follow-up accepted result." }); return mapFollowUpAccepted(data[0]); }
function mapFollowUpRequested(value: unknown): MarkBacklinkOutreachFollowUpAttemptRequestedResult { if (!isRecord(value)) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "markBacklinkOutreachFollowUpAttemptRequested", message: "The database returned an invalid follow-up pre-send result." }); const { disposition, attempt_id: attemptId, outreach_id: outreachId, recipient, subject, body, reply_token_hash: replyTokenHash, reply_token_key_version: replyTokenKeyVersion, requested_at: requestedAt } = value; if ((disposition !== "requested_now" && disposition !== "existing") || typeof attemptId !== "string" || typeof outreachId !== "string" || typeof recipient !== "string" || typeof subject !== "string" || typeof body !== "string" || typeof replyTokenHash !== "string" || typeof replyTokenKeyVersion !== "string" || typeof requestedAt !== "string") throw new BacklinkRepositoryError({ code: "DATABASE", operation: "markBacklinkOutreachFollowUpAttemptRequested", message: "The database returned an invalid follow-up pre-send result." }); return { disposition, attemptId, outreachId, recipient, subject, body, replyTokenHash, replyTokenKeyVersion, requestedAt }; }
function normalizeFollowUpRequestedError(error: unknown): BacklinkRepositoryError { if (typeof error === "object" && error != null && "message" in error && typeof error.message === "string" && error.message.startsWith("FOLLOW_UP_SEND_")) return new BacklinkRepositoryError({ code: error.message.includes("CONFLICT") ? "CONFLICT" : "VALIDATION", operation: "markBacklinkOutreachFollowUpAttemptRequested", message: error.message }); return normalizeBacklinkRepositoryError("markBacklinkOutreachFollowUpAttemptRequested", error); }
export async function markBacklinkOutreachFollowUpAttemptRequested(client: MarkBacklinkOutreachFollowUpAttemptRequestedRpcClient, input: MarkBacklinkOutreachFollowUpAttemptRequestedInput): Promise<MarkBacklinkOutreachFollowUpAttemptRequestedResult> { const { data, error } = await client.rpc("mark_backlink_outreach_follow_up_attempt_requested", { p_workspace_id: required(input.workspaceId, "workspaceId"), p_outreach_id: required(input.outreachId, "outreachId"), p_attempt_id: required(input.attemptId, "attemptId"), p_actor_user_id: required(input.actorUserId, "actorUserId"), p_requested_at: required(input.requestedAt, "requestedAt") }); if (error != null) throw normalizeFollowUpRequestedError(error); if (!Array.isArray(data) || data.length !== 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "markBacklinkOutreachFollowUpAttemptRequested", message: "The database returned an invalid follow-up pre-send result." }); return mapFollowUpRequested(data[0]); }
function mapFollowUpCancellation(value: unknown): CancelBacklinkOutreachPreparedFollowUpAttemptResult { if (!isRecord(value)) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "cancelBacklinkOutreachPreparedFollowUpAttempt", message: "The database returned an invalid follow-up cancellation." }); const { disposition, attempt_id: attemptId, outreach_id: outreachId, attempt_status: attemptStatus, cancel_reason: cancelReason, cancelled_at: cancelledAt } = value; if ((disposition !== "cancelled" && disposition !== "existing") || typeof attemptId !== "string" || typeof outreachId !== "string" || attemptStatus !== "cancelled" || (cancelReason !== "inbound_reply" && cancelReason !== "provider_complaint" && cancelReason !== "provider_permanent_bounce" && cancelReason !== "contact_unavailable" && cancelReason !== "admin_cancelled") || typeof cancelledAt !== "string") throw new BacklinkRepositoryError({ code: "DATABASE", operation: "cancelBacklinkOutreachPreparedFollowUpAttempt", message: "The database returned an invalid follow-up cancellation." }); return { disposition, attemptId, outreachId, attemptStatus, cancelReason, cancelledAt }; }
export async function cancelBacklinkOutreachPreparedFollowUpAttempt(client: CancelBacklinkOutreachPreparedFollowUpAttemptRpcClient, input: CancelBacklinkOutreachPreparedFollowUpAttemptInput): Promise<CancelBacklinkOutreachPreparedFollowUpAttemptResult> { const { data, error } = await client.rpc("cancel_backlink_outreach_prepared_follow_up_attempt", { p_workspace_id: required(input.workspaceId, "workspaceId"), p_outreach_id: required(input.outreachId, "outreachId"), p_attempt_id: required(input.attemptId, "attemptId"), p_cancel_reason: input.cancelReason, p_cancelled_at: required(input.cancelledAt, "cancelledAt") }); if (error != null) throw normalizeFollowUpReservationError(error); if (!Array.isArray(data) || data.length !== 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "cancelBacklinkOutreachPreparedFollowUpAttempt", message: "The database returned an invalid follow-up cancellation." }); return mapFollowUpCancellation(data[0]); }
export async function createBacklinkOutreachAttempt(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, input: CreateBacklinkOutreachAttemptInput): Promise<BacklinkOutreachAttemptRow> { const idempotencyKey = required(input.idempotencyKey, "idempotencyKey"); const payload: BacklinkOutreachAttemptInsert = { id: required(input.attemptId, "attemptId"), workspace_id: workspaceId, outreach_id: input.outreachId, actor_user_id: input.actorUserId, channel: input.channel, provider: required(input.provider, "provider"), recipient: required(input.recipient, "recipient"), idempotency_key: idempotencyKey, reply_token_hash: required(input.replyTokenHash, "replyTokenHash"), reply_token_key_version: required(input.replyTokenKeyVersion, "replyTokenKeyVersion"), attempt_kind: input.attemptKind, status: "requested" }; const { data, error } = await client.from("backlink_outreach_attempts").insert(payload).select("*").single(); if (error == null) return data; const normalized = normalizeBacklinkRepositoryError("createBacklinkOutreachAttempt", error); if (normalized.code !== "CONFLICT") throw normalized; const existing = await getBacklinkOutreachAttemptByIdempotencyKey(client, workspaceId, idempotencyKey); if (existing != null) return existing; throw normalized; }
export async function reserveBacklinkOutreachAttempt(client: ReserveBacklinkOutreachInitialAttemptRpcClient, workspaceId: WorkspaceId, input: CreateBacklinkOutreachAttemptInput): Promise<BacklinkOutreachAttemptReservation> {
  const { data, error } = await client.rpc("reserve_backlink_outreach_initial_attempt", {
    p_workspace_id: workspaceId,
    p_outreach_id: required(input.outreachId, "outreachId"),
    p_attempt_id: required(input.attemptId, "attemptId"),
    p_actor_user_id: required(input.actorUserId, "actorUserId"),
    p_idempotency_key: required(input.idempotencyKey, "idempotencyKey"),
    p_reply_token_hash: required(input.replyTokenHash, "replyTokenHash"),
    p_reply_token_key_version: required(input.replyTokenKeyVersion, "replyTokenKeyVersion"),
    p_requested_at: new Date().toISOString(),
  });
  if (error != null) throw normalizeBacklinkRepositoryError("reserveBacklinkOutreachAttempt", error);
  if (!Array.isArray(data) || data.length !== 1) throw new BacklinkRepositoryError({ code: "DATABASE", operation: "reserveBacklinkOutreachAttempt", message: "The database returned an invalid initial attempt reservation." });
  const mapped = mapInitialAttemptReservation(data[0]);
  if (mapped.disposition === "rate_limited") {
    return { attempt: null, disposition: "rate_limited", rateLimitReason: mapped.rateLimitReason! };
  }
  const existing = await getBacklinkOutreachAttemptByIdempotencyKey(client, workspaceId, required(input.idempotencyKey, "idempotencyKey"));
  if (existing != null) {
    return { attempt: existing, disposition: mapped.disposition, rateLimitReason: null };
  }
  throw new BacklinkRepositoryError({ code: "DATABASE", operation: "reserveBacklinkOutreachAttempt", message: "The database returned an invalid initial attempt reservation." });
}
function mapApprovedInitialAttemptReservation(value: unknown): {
  disposition:
    | "created"
    | "existing"
    | "rate_limited"
    | "not_approved"
    | "approval_stale"
    | "campaign_disabled"
    | "not_ready"
    | "invalid_recipient"
    | "missing_approved_content"
    | "ineligible";
  attemptId: string | null;
  rateLimitReason: BacklinkOutreachAttemptRateLimitReason | null;
} {
  if (!isRecord(value)) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "reserveBacklinkOutreachAttemptForApprovedAutoSend",
      message: "The database returned an invalid approved initial attempt reservation.",
    });
  }

  const { disposition, attempt_id: attemptId, rate_limit_reason: rateLimitReason } = value;
  if (disposition === "rate_limited") {
    if (
      typeof rateLimitReason !== "string" ||
      (rateLimitReason !== "WORKSPACE_DAILY_LIMIT_REACHED" &&
        rateLimitReason !== "WORKSPACE_HOURLY_LIMIT_REACHED" &&
        rateLimitReason !== "DOMAIN_DAILY_LIMIT_REACHED" &&
        rateLimitReason !== "CONTACT_DAILY_LIMIT_REACHED")
    ) {
      throw new BacklinkRepositoryError({
        code: "DATABASE",
        operation: "reserveBacklinkOutreachAttemptForApprovedAutoSend",
        message: "The database returned an invalid approved initial attempt reservation.",
      });
    }
    return { disposition, attemptId: null, rateLimitReason };
  }

  if (
    disposition !== "created" &&
    disposition !== "existing" &&
    disposition !== "not_approved" &&
    disposition !== "approval_stale" &&
    disposition !== "campaign_disabled" &&
    disposition !== "not_ready" &&
    disposition !== "invalid_recipient" &&
    disposition !== "missing_approved_content" &&
    disposition !== "ineligible"
  ) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "reserveBacklinkOutreachAttemptForApprovedAutoSend",
      message: "The database returned an invalid approved initial attempt reservation.",
    });
  }

  if ((disposition === "created" || disposition === "existing") && typeof attemptId !== "string") {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "reserveBacklinkOutreachAttemptForApprovedAutoSend",
      message: "The database returned an invalid approved initial attempt reservation.",
    });
  }

  if (disposition !== "created" && disposition !== "existing") {
    return { disposition, attemptId: null, rateLimitReason: null };
  }

  return { disposition, attemptId: attemptId as string, rateLimitReason: null };
}

export async function getBacklinkOutreachInitialAttemptSnapshotByAttemptId(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  attemptId: string,
): Promise<BacklinkOutreachApprovedInitialAttemptSnapshotRow | null> {
  const operation = "getBacklinkOutreachInitialAttemptSnapshotByAttemptId";
  const { data, error } = await client
    .from("backlink_outreach_initial_attempt_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("attempt_id", attemptId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function reserveBacklinkOutreachApprovedInitialAttempt(
  client: ReserveBacklinkOutreachInitialAttemptRpcClient,
  input: {
    workspaceId: WorkspaceId;
    campaignId: string;
    outreachId: string;
    attemptId: string;
    actorUserId: string;
    idempotencyKey: string;
    replyTokenHash: string;
    replyTokenKeyVersion: string;
    requestedAt: string;
  },
): Promise<BacklinkOutreachApprovedInitialAttemptResult> {
  const { data, error } = await client.rpc(
    "reserve_backlink_approved_initial_attempt_v2",
    {
      p_workspace_id: required(input.workspaceId, "workspaceId"),
      p_campaign_id: required(input.campaignId, "campaignId"),
      p_outreach_id: required(input.outreachId, "outreachId"),
      p_attempt_id: required(input.attemptId, "attemptId"),
      p_actor_user_id: required(input.actorUserId, "actorUserId"),
      p_idempotency_key: required(input.idempotencyKey, "idempotencyKey"),
      p_reply_token_hash: required(input.replyTokenHash, "replyTokenHash"),
      p_reply_token_key_version: required(input.replyTokenKeyVersion, "replyTokenKeyVersion"),
      p_requested_at: required(input.requestedAt, "requestedAt"),
    },
  );

  if (error != null) {
    const diagnostic = typeof error === "object" && error != null ? error as unknown as Record<string, unknown> : null;
    const diagnosticString = (key: string) => typeof diagnostic?.[key] === "string" ? diagnostic[key] : null;
    console.error("[backlinks-approved-initial-reservation-error]", {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      outreachId: input.outreachId,
      errorCode: diagnosticString("code"),
      errorMessage: diagnosticString("message"),
      errorDetails: diagnosticString("details"),
      errorHint: diagnosticString("hint"),
    });
    throw normalizeBacklinkRepositoryError(
      "reserveBacklinkOutreachAttemptForApprovedAutoSend",
      error,
    );
  }

  if (!Array.isArray(data) || data.length !== 1) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "reserveBacklinkOutreachAttemptForApprovedAutoSend",
      message: "The database returned an invalid approved initial attempt reservation.",
    });
  }

  const mapped = mapApprovedInitialAttemptReservation(data[0]);
  if (mapped.disposition === "rate_limited") {
    return { attempt: null, snapshot: null, disposition: "rate_limited", rateLimitReason: mapped.rateLimitReason! };
  }

  if (
    mapped.disposition === "not_approved" ||
    mapped.disposition === "approval_stale" ||
    mapped.disposition === "campaign_disabled" ||
    mapped.disposition === "not_ready" ||
    mapped.disposition === "invalid_recipient" ||
    mapped.disposition === "missing_approved_content" ||
    mapped.disposition === "ineligible"
  ) {
    return { attempt: null, snapshot: null, disposition: mapped.disposition, rateLimitReason: null };
  }

  const attempt = await getBacklinkOutreachAttemptById(
    client,
    input.workspaceId,
    required(mapped.attemptId, "attemptId"),
  );
  if (attempt == null) {
    throw new BacklinkRepositoryError({
      code: "NOT_FOUND",
      operation: "reserveBacklinkOutreachAttemptForApprovedAutoSend",
      message: "The requested record was not found.",
    });
  }
  const snapshot = await getBacklinkOutreachInitialAttemptSnapshotByAttemptId(
    client,
    input.workspaceId,
    attempt.id,
  );
  if (snapshot == null) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "reserveBacklinkOutreachAttemptForApprovedAutoSend",
      message: "The database returned an invalid approved initial attempt snapshot.",
    });
  }

  return { attempt, snapshot, disposition: mapped.disposition, rateLimitReason: null };
}
export async function updateBacklinkOutreachAttemptState(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, attemptId: string, patch: BacklinkOutreachAttemptStatePatch): Promise<BacklinkOutreachAttemptRow> { const { data, error } = await client.from("backlink_outreach_attempts").update(patch).eq("workspace_id", workspaceId).eq("id", attemptId).select("*").maybeSingle(); if (error != null) throw normalizeBacklinkRepositoryError("updateBacklinkOutreachAttemptState", error); if (data == null) throw new BacklinkRepositoryError({ code: "NOT_FOUND", operation: "updateBacklinkOutreachAttemptState", message: "The requested record was not found." }); return data; }
export async function resolveUnknownBacklinkOutreachAttemptState(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, attemptId: string, patch: BacklinkOutreachAttemptStatePatch): Promise<BacklinkOutreachAttemptRow | null> { const { data, error } = await client.from("backlink_outreach_attempts").update(patch).eq("workspace_id", workspaceId).eq("id", attemptId).eq("status", "unknown").select("*").maybeSingle(); if (error != null) throw normalizeBacklinkRepositoryError("resolveUnknownBacklinkOutreachAttemptState", error); return data; }
export async function recoverRequestedBacklinkOutreachAttemptAsUnknown(client: BacklinkRepositoryClient, workspaceId: WorkspaceId, attemptId: string, patch: BacklinkOutreachAttemptStatePatch): Promise<BacklinkOutreachAttemptRow | null> { const { data, error } = await client.from("backlink_outreach_attempts").update(patch).eq("workspace_id", workspaceId).eq("id", attemptId).eq("status", "requested").select("*").maybeSingle(); if (error != null) throw normalizeBacklinkRepositoryError("recoverRequestedBacklinkOutreachAttemptAsUnknown", error); return data; }

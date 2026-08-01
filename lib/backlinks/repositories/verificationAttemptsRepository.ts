import { BacklinkRepositoryError, normalizeBacklinkRepositoryError } from "./errors";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, WorkspaceId } from "./types";

import type {
  BacklinkVerificationAttempt,
  CreateBacklinkVerificationAttemptInput,
} from "../verification/attempt-types";
import type { VerificationStatus } from "../verification/types";

export type BacklinkVerificationAttemptRow = BacklinkRow<"backlink_verification_attempts">;
type BacklinkVerificationAttemptInsert = BacklinkInsert<"backlink_verification_attempts">;

function isVerificationStatus(value: string | null): value is VerificationStatus {
  return (
    value === "FOUND" ||
    value === "NOT_FOUND" ||
    value === "ANCHOR_CHANGED" ||
    value === "REL_CHANGED" ||
    value === "TARGET_CHANGED" ||
    value === "UNKNOWN"
  );
}

function isHttpUnusableReason(
  value: string | null,
): value is "http_client_error" | "http_server_error" | "unsupported_content_type" | "empty_document" {
  return (
    value === "http_client_error" ||
    value === "http_server_error" ||
    value === "unsupported_content_type" ||
    value === "empty_document"
  );
}

function toAttempt(input: BacklinkVerificationAttemptRow): BacklinkVerificationAttempt {
  const base = {
    id: input.id,
    workspaceId: input.workspace_id,
    linkId: input.link_id,
    attemptedAt: input.attempted_at,
    sourceUrl: input.source_url,
    targetUrl: input.target_url,
    createdAt: input.created_at,
  };

  if (
    input.runtime_kind === "verified" &&
    isVerificationStatus(input.verification_status) &&
    input.verification_result != null &&
    input.requested_url != null &&
    input.final_url != null &&
    input.http_status != null &&
    input.redirect_count != null
  ) {
    return {
      ...base,
      runtimeKind: "verified",
      runtimeReason: null,
      verificationStatus: input.verification_status,
      requestedUrl: input.requested_url,
      finalUrl: input.final_url,
      httpStatus: input.http_status,
      contentType: input.content_type,
      redirectCount: input.redirect_count,
      fetchErrorCode: null,
      fetchErrorMessage: null,
      verificationResult: input.verification_result,
    };
  }

  if (
    input.runtime_kind === "http_unusable" &&
    isHttpUnusableReason(input.runtime_reason) &&
    input.requested_url != null &&
    input.final_url != null &&
    input.http_status != null &&
    input.redirect_count != null
  ) {
    return {
      ...base,
      runtimeKind: "http_unusable",
      runtimeReason: input.runtime_reason,
      verificationStatus: null,
      requestedUrl: input.requested_url,
      finalUrl: input.final_url,
      httpStatus: input.http_status,
      contentType: input.content_type,
      redirectCount: input.redirect_count,
      fetchErrorCode: null,
      fetchErrorMessage: null,
      verificationResult: null,
    };
  }

  if (
    input.runtime_kind === "fetch_error" &&
    input.fetch_error_code != null &&
    input.fetch_error_message != null
  ) {
    return {
      ...base,
      runtimeKind: "fetch_error",
      runtimeReason: null,
      verificationStatus: null,
      requestedUrl: null,
      finalUrl: null,
      httpStatus: null,
      contentType: null,
      redirectCount: null,
      fetchErrorCode: input.fetch_error_code,
      fetchErrorMessage: input.fetch_error_message,
      verificationResult: null,
    };
  }

  throw new BacklinkRepositoryError({
    code: "DATABASE",
    operation: "createBacklinkVerificationAttempt",
    message: "The database returned an invalid verification attempt.",
  });
}

function toInsert(input: CreateBacklinkVerificationAttemptInput): BacklinkVerificationAttemptInsert {
  return {
    workspace_id: input.workspaceId,
    link_id: input.linkId,
    attempted_at: input.attemptedAt,
    runtime_kind: input.runtimeKind,
    runtime_reason: input.runtimeReason,
    verification_status: input.verificationStatus,
    source_url: input.sourceUrl,
    target_url: input.targetUrl,
    requested_url: input.requestedUrl,
    final_url: input.finalUrl,
    http_status: input.httpStatus,
    content_type: input.contentType,
    redirect_count: input.redirectCount,
    fetch_error_code: input.fetchErrorCode,
    fetch_error_message: input.fetchErrorMessage,
    verification_result: input.verificationResult,
  };
}

export async function createBacklinkVerificationAttempt(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkVerificationAttemptInput,
): Promise<BacklinkVerificationAttempt> {
  const operation = "createBacklinkVerificationAttempt";
  const { data, error } = await client
    .from("backlink_verification_attempts")
    .insert({ ...toInsert(input), workspace_id: workspaceId })
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return toAttempt(data);
}

import type { Database } from "@/types/database.types";

import {
  BacklinkPromotionApplicationRepositoryError,
  type ApplyBacklinkPromotionProposalRepositoryInput,
  type ApplyBacklinkPromotionProposalRepositoryResult,
  type BacklinkPromotionApplicationRepositoryErrorCode,
} from "../backlink-promotion-application-types";

type PromotionApplicationRpcName = "apply_backlink_promotion_proposal";
type PromotionApplicationRpcArgs = Database["public"]["Functions"][PromotionApplicationRpcName]["Args"];

type PromotionApplicationRpcClient = {
  rpc: (
    functionName: PromotionApplicationRpcName,
    args: PromotionApplicationRpcArgs,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKnownRpcCode(value: string): value is BacklinkPromotionApplicationRepositoryErrorCode {
  switch (value) {
    case "PROMOTION_UNAUTHORIZED":
    case "PROMOTION_TASK_NOT_FOUND":
    case "PROMOTION_TASK_KIND_INVALID":
    case "PROMOTION_TASK_NOT_COMPLETED":
    case "PROMOTION_APPLICATION_MISMATCH":
    case "PROMOTION_ASSET_NOT_FOUND":
    case "PROMOTION_ASSET_NOT_ACTIVE":
    case "PROMOTION_DOMAIN_ARCHIVED":
    case "PROMOTION_DOMAIN_RESOLUTION_FAILED":
    case "PROMOTION_OPPORTUNITY_RESOLUTION_FAILED":
    case "PROMOTION_ACTIVITY_WRITE_FAILED":
    case "PROMOTION_APPLICATION_FAILED":
      return true;
    default:
      return false;
  }
}

function readErrorCode(error: unknown): BacklinkPromotionApplicationRepositoryErrorCode | null {
  if (!isRecord(error)) {
    return null;
  }

  const code = error.code;
  if (typeof code === "string" && isKnownRpcCode(code)) {
    return code;
  }

  const message = error.message;
  if (typeof message === "string" && isKnownRpcCode(message)) {
    return message;
  }

  return null;
}

function safeErrorString(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value.replace(/[\r\n]+/g, " ").slice(0, maximumLength);
}

function logApplyPromotionRpcError(error: unknown): void {
  if (process.env.DEBUG_BACKLINK_PROMOTION_APPLY !== "true" || !isRecord(error)) {
    return;
  }

  console.error("[automation/backlinks/promotions/apply-rpc] failed", {
    code: safeErrorString(error.code, 100),
    message: safeErrorString(error.message, 500),
    details: safeErrorString(error.details ?? error.detail, 500),
    hint: safeErrorString(error.hint, 300),
  });
}

function assertUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_INVALID");
  }
}

function assertNonEmpty(value: string): void {
  if (value.trim().length === 0) {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_INVALID");
  }
}

function assertInput(input: ApplyBacklinkPromotionProposalRepositoryInput): void {
  const value: unknown = input;
  if (!isRecord(value)) {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_INVALID");
  }

  for (const identifier of [input.workspaceId, input.actorUserId, input.runId, input.promotionTaskId, input.assetId]) {
    assertUuid(identifier);
  }

  for (const text of [
    input.proposalKey,
    input.candidateKey,
    input.hostname,
    input.targetPageUrl,
    input.targetPageTitle,
    input.opportunityType,
    input.pageType,
    input.evidenceSummary,
    input.promotionPolicyVersion,
  ]) {
    assertNonEmpty(text);
  }

  if (!Number.isInteger(input.qualificationScore) || input.qualificationScore < 0 || input.qualificationScore > 100) {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_INVALID");
  }
  if (input.priority !== "Tier A" && input.priority !== "Tier B" && input.priority !== "Tier C") {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_INVALID");
  }
  if (input.qualificationConfidence !== "low" && input.qualificationConfidence !== "medium") {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_INVALID");
  }
}

function mapResult(value: unknown): ApplyBacklinkPromotionProposalRepositoryResult {
  if (!isRecord(value)) {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_INVALID");
  }

  const {
    application_id: applicationId,
    domain_id: domainId,
    opportunity_id: opportunityId,
    domain_disposition: domainDisposition,
    opportunity_disposition: opportunityDisposition,
    audit_written: auditWritten,
  } = value;

  if (
    typeof applicationId !== "string" ||
    typeof domainId !== "string" ||
    typeof opportunityId !== "string" ||
    (domainDisposition !== "created" && domainDisposition !== "existing") ||
    (opportunityDisposition !== "created" && opportunityDisposition !== "existing") ||
    auditWritten !== true
  ) {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_INVALID");
  }

  assertUuid(applicationId);
  assertUuid(domainId);
  assertUuid(opportunityId);

  return {
    applicationId,
    domainId,
    opportunityId,
    domainDisposition,
    opportunityDisposition,
    auditWritten: true,
  };
}

function toRpcArgs(input: ApplyBacklinkPromotionProposalRepositoryInput): PromotionApplicationRpcArgs {
  return {
    p_workspace_id: input.workspaceId,
    p_actor_user_id: input.actorUserId,
    p_run_id: input.runId,
    p_promotion_task_id: input.promotionTaskId,
    p_proposal_key: input.proposalKey,
    p_candidate_key: input.candidateKey,
    p_hostname: input.hostname,
    p_target_page_url: input.targetPageUrl,
    p_target_page_title: input.targetPageTitle,
    p_opportunity_type: input.opportunityType,
    p_page_type: input.pageType,
    p_priority: input.priority,
    p_evidence_summary: input.evidenceSummary,
    p_asset_id: input.assetId,
    p_qualification_score: input.qualificationScore,
    p_qualification_confidence: input.qualificationConfidence,
    p_promotion_policy_version: input.promotionPolicyVersion,
  };
}

export async function applyBacklinkPromotionProposalTransaction(
  client: PromotionApplicationRpcClient,
  input: ApplyBacklinkPromotionProposalRepositoryInput,
): Promise<ApplyBacklinkPromotionProposalRepositoryResult> {
  assertInput(input);

  const { data, error } = await client.rpc(
    "apply_backlink_promotion_proposal",
    toRpcArgs(input),
  );

  if (error !== null) {
    logApplyPromotionRpcError(error);
    const code = readErrorCode(error);
    throw new BacklinkPromotionApplicationRepositoryError(
      code === null ? "PROMOTION_APPLICATION_RPC_FAILED" : code,
    );
  }
  if (!Array.isArray(data)) {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_INVALID");
  }
  if (data.length === 0) {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_MISSING");
  }
  if (data.length > 1) {
    throw new BacklinkPromotionApplicationRepositoryError("PROMOTION_APPLICATION_RESULT_MULTIPLE");
  }

  return mapResult(data[0]);
}

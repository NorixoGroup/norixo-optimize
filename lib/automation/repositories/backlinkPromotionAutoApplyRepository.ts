import type { Database } from "@/types/database.types";

import {
  BacklinkPromotionAutoApplyRepositoryError,
  type ApplyBacklinkPromotionProposalAutoInput,
  type ApplyBacklinkPromotionProposalAutoResult,
  type BacklinkPromotionAutoApplyRepositoryErrorCode,
} from "../backlink-promotion-auto-apply-types";

type AutoApplyRpcName = "apply_backlink_promotion_proposal_auto";
type AutoApplyRpcArgs = Database["public"]["Functions"][AutoApplyRpcName]["Args"];

type AutoApplyRpcClient = {
  rpc: (
    functionName: AutoApplyRpcName,
    args: AutoApplyRpcArgs,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const KNOWN_CODES: readonly BacklinkPromotionAutoApplyRepositoryErrorCode[] = [
  "PROMOTION_AUTO_APPLY_INVALID_INPUT",
  "PROMOTION_AUTO_APPLY_NOT_AUTHORIZED",
  "PROMOTION_AUTO_APPLY_AUTHORIZATION_STALE",
  "PROMOTION_AUTO_APPLY_APPLICATION_MISMATCH",
  "PROMOTION_AUTO_APPLY_TASK_NOT_FOUND",
  "PROMOTION_AUTO_APPLY_TASK_KIND_INVALID",
  "PROMOTION_AUTO_APPLY_TASK_NOT_COMPLETED",
  "PROMOTION_AUTO_APPLY_POLICY_VERSION_INVALID",
  "PROMOTION_AUTO_APPLY_PROPOSAL_NOT_FOUND",
  "PROMOTION_AUTO_APPLY_PROPOSAL_NOT_ELIGIBLE",
  "PROMOTION_AUTO_APPLY_CONFLICTING_PROPOSAL",
  "PROMOTION_AUTO_APPLY_ASSET_NOT_FOUND",
  "PROMOTION_AUTO_APPLY_WORKSPACE_LIMIT_REACHED",
  "PROMOTION_AUTO_APPLY_DOMAIN_ARCHIVED",
  "PROMOTION_AUTO_APPLY_APPLICATION_FAILED",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKnownCode(value: string): value is BacklinkPromotionAutoApplyRepositoryErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(value);
}

function readErrorCode(error: unknown): BacklinkPromotionAutoApplyRepositoryErrorCode | null {
  if (!isRecord(error)) return null;
  const message = error.message;
  if (typeof message === "string" && isKnownCode(message)) return message;
  const code = error.code;
  if (typeof code === "string" && isKnownCode(code)) return code;
  return null;
}

function assertInput(input: ApplyBacklinkPromotionProposalAutoInput): void {
  for (const value of [input.workspaceId, input.runId, input.promotionTaskId]) {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
      throw new BacklinkPromotionAutoApplyRepositoryError("PROMOTION_AUTO_APPLY_INVALID_INPUT");
    }
  }
  if (
    typeof input.proposalKey !== "string" ||
    input.proposalKey.trim().length === 0 ||
    input.proposalKey.length > 160
  ) {
    throw new BacklinkPromotionAutoApplyRepositoryError("PROMOTION_AUTO_APPLY_INVALID_INPUT");
  }
}

function mapResult(value: unknown): ApplyBacklinkPromotionProposalAutoResult {
  if (!isRecord(value)) {
    throw new BacklinkPromotionAutoApplyRepositoryError("PROMOTION_AUTO_APPLY_RESULT_INVALID");
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
    typeof applicationId !== "string" || !UUID_PATTERN.test(applicationId) ||
    typeof domainId !== "string" || !UUID_PATTERN.test(domainId) ||
    typeof opportunityId !== "string" || !UUID_PATTERN.test(opportunityId) ||
    (domainDisposition !== "created" && domainDisposition !== "existing") ||
    (opportunityDisposition !== "created" && opportunityDisposition !== "existing") ||
    auditWritten !== true
  ) {
    throw new BacklinkPromotionAutoApplyRepositoryError("PROMOTION_AUTO_APPLY_RESULT_INVALID");
  }

  return {
    applicationId,
    domainId,
    opportunityId,
    domainDisposition,
    opportunityDisposition,
    auditWritten: true,
  };
}

/**
 * Calls the service_role-only, unattended auto-apply RPC. Only references are
 * sent — never a proposal's content — so there is nothing here for a caller
 * to misrepresent; every eligibility fact is re-derived by the RPC itself.
 */
export async function applyBacklinkPromotionProposalAuto(
  client: AutoApplyRpcClient,
  input: ApplyBacklinkPromotionProposalAutoInput,
): Promise<ApplyBacklinkPromotionProposalAutoResult> {
  assertInput(input);

  const { data, error } = await client.rpc("apply_backlink_promotion_proposal_auto", {
    p_workspace_id: input.workspaceId,
    p_run_id: input.runId,
    p_promotion_task_id: input.promotionTaskId,
    p_proposal_key: input.proposalKey,
  });

  if (error !== null) {
    const code = readErrorCode(error);
    throw new BacklinkPromotionAutoApplyRepositoryError(code ?? "PROMOTION_AUTO_APPLY_RPC_FAILED");
  }
  if (!Array.isArray(data) || data.length !== 1) {
    throw new BacklinkPromotionAutoApplyRepositoryError("PROMOTION_AUTO_APPLY_RESULT_INVALID");
  }

  return mapResult(data[0]);
}

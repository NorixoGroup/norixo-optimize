export type ApplyBacklinkPromotionProposalAutoInput = {
  workspaceId: string;
  runId: string;
  promotionTaskId: string;
  proposalKey: string;
};

export type ApplyBacklinkPromotionProposalAutoResult = {
  applicationId: string;
  domainId: string;
  opportunityId: string;
  domainDisposition: "created" | "existing";
  opportunityDisposition: "created" | "existing";
  auditWritten: true;
};

export type BacklinkPromotionAutoApplyRepositoryErrorCode =
  | "PROMOTION_AUTO_APPLY_RPC_FAILED"
  | "PROMOTION_AUTO_APPLY_RESULT_INVALID"
  | "PROMOTION_AUTO_APPLY_INVALID_INPUT"
  | "PROMOTION_AUTO_APPLY_NOT_AUTHORIZED"
  | "PROMOTION_AUTO_APPLY_AUTHORIZATION_STALE"
  | "PROMOTION_AUTO_APPLY_APPLICATION_MISMATCH"
  | "PROMOTION_AUTO_APPLY_TASK_NOT_FOUND"
  | "PROMOTION_AUTO_APPLY_TASK_KIND_INVALID"
  | "PROMOTION_AUTO_APPLY_TASK_NOT_COMPLETED"
  | "PROMOTION_AUTO_APPLY_POLICY_VERSION_INVALID"
  | "PROMOTION_AUTO_APPLY_PROPOSAL_NOT_FOUND"
  | "PROMOTION_AUTO_APPLY_PROPOSAL_NOT_ELIGIBLE"
  | "PROMOTION_AUTO_APPLY_CONFLICTING_PROPOSAL"
  | "PROMOTION_AUTO_APPLY_ASSET_NOT_FOUND"
  | "PROMOTION_AUTO_APPLY_WORKSPACE_LIMIT_REACHED"
  | "PROMOTION_AUTO_APPLY_DOMAIN_ARCHIVED"
  | "PROMOTION_AUTO_APPLY_APPLICATION_FAILED";

export class BacklinkPromotionAutoApplyRepositoryError extends Error {
  readonly code: BacklinkPromotionAutoApplyRepositoryErrorCode;

  constructor(code: BacklinkPromotionAutoApplyRepositoryErrorCode) {
    super("The promotion auto-apply repository operation could not be completed.");
    this.name = "BacklinkPromotionAutoApplyRepositoryError";
    this.code = code;
  }
}

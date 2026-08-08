export type ApplyBacklinkPromotionProposalRepositoryInput = {
  workspaceId: string;
  actorUserId: string;
  runId: string;
  promotionTaskId: string;
  proposalKey: string;
  candidateKey: string;
  hostname: string;
  targetPageUrl: string;
  targetPageTitle: string;
  opportunityType: string;
  pageType: string;
  priority: "Tier A" | "Tier B" | "Tier C";
  evidenceSummary: string;
  assetId: string;
  qualificationScore: number;
  qualificationConfidence: "low" | "medium";
  promotionPolicyVersion: string;
};

export type ApplyBacklinkPromotionProposalRepositoryResult = {
  applicationId: string;
  domainId: string;
  opportunityId: string;
  domainDisposition: "created" | "existing";
  opportunityDisposition: "created" | "existing";
  auditWritten: true;
};

export type BacklinkPromotionApplicationRepositoryErrorCode =
  | "PROMOTION_APPLICATION_RPC_FAILED"
  | "PROMOTION_APPLICATION_RESULT_INVALID"
  | "PROMOTION_APPLICATION_RESULT_MISSING"
  | "PROMOTION_APPLICATION_RESULT_MULTIPLE"
  | "PROMOTION_UNAUTHORIZED"
  | "PROMOTION_TASK_NOT_FOUND"
  | "PROMOTION_TASK_KIND_INVALID"
  | "PROMOTION_TASK_NOT_COMPLETED"
  | "PROMOTION_APPLICATION_MISMATCH"
  | "PROMOTION_ASSET_NOT_FOUND"
  | "PROMOTION_ASSET_NOT_ACTIVE"
  | "PROMOTION_DOMAIN_ARCHIVED"
  | "PROMOTION_DOMAIN_RESOLUTION_FAILED"
  | "PROMOTION_OPPORTUNITY_RESOLUTION_FAILED"
  | "PROMOTION_ACTIVITY_WRITE_FAILED"
  | "PROMOTION_APPLICATION_FAILED";

export class BacklinkPromotionApplicationRepositoryError extends Error {
  readonly code: BacklinkPromotionApplicationRepositoryErrorCode;

  constructor(code: BacklinkPromotionApplicationRepositoryErrorCode) {
    super("The promotion application repository operation could not be completed.");
    this.name = "BacklinkPromotionApplicationRepositoryError";
    this.code = code;
  }
}

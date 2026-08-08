import type {
  ApplyBacklinkPromotionProposalRepositoryInput,
  ApplyBacklinkPromotionProposalRepositoryResult,
} from "./backlink-promotion-application-types";
import type {
  ReadBacklinkPromotionProposalInput,
  ReadBacklinkPromotionProposalResult,
} from "./backlink-promotion-proposal-reader-types";

export type BacklinkAsset = {
  id: string;
  workspaceId: string;
  lifecycleStatus: string;
};

export type ApplyBacklinkPromotionProposalInput = {
  workspaceId: string;
  actorUserId: string;
  runId: string;
  promotionTaskId: string;
  proposalKey: string;
  assetId: string;
};

export type ApplyBacklinkPromotionProposalDependencies = {
  readPromotionProposal: (
    input: ReadBacklinkPromotionProposalInput,
  ) => Promise<ReadBacklinkPromotionProposalResult>;
  getAssetById: (input: {
    workspaceId: string;
    assetId: string;
  }) => Promise<BacklinkAsset | null>;
  applyPromotionTransaction: (
    input: ApplyBacklinkPromotionProposalRepositoryInput,
  ) => Promise<ApplyBacklinkPromotionProposalRepositoryResult>;
};

export type ApplyBacklinkPromotionProposalResult = {
  kind: "applied";
  disposition: "created" | "existing";
  domainDisposition: "created" | "existing";
  applicationId: string;
  domainId: string;
  opportunityId: string;
  auditWritten: true;
};

export type BacklinkPromotionApplyServiceErrorCode =
  | "INVALID_PROMOTION_APPLY_INPUT"
  | "PROMOTION_HOSTNAME_INVALID"
  | "PROMOTION_TARGET_URL_INVALID"
  | "PROMOTION_HOSTNAME_URL_MISMATCH"
  | "PROMOTION_ASSET_NOT_FOUND"
  | "PROMOTION_ASSET_NOT_ACTIVE"
  | "PROMOTION_ASSET_WORKSPACE_MISMATCH"
  | "PROMOTION_PROPOSAL_INVALID";

export class BacklinkPromotionApplyServiceError extends Error {
  readonly code: BacklinkPromotionApplyServiceErrorCode;

  constructor(code: BacklinkPromotionApplyServiceErrorCode) {
    super("The promotion proposal could not be applied.");
    this.name = "BacklinkPromotionApplyServiceError";
    this.code = code;
  }
}

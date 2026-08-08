import type { BacklinkDiscoveryPreviewCandidate } from "./backlink-discovery-handler-types";
import type {
  BacklinkQualificationOpportunityType,
  BacklinkQualificationPageType,
  BacklinkQualificationResult,
} from "./backlink-qualification-types";
import type {
  BacklinkPromotionOpportunityType,
  BacklinkPromotionPageType,
  BacklinkPromotionPriority,
  BacklinkPromotionSkipCode,
} from "./backlink-promotion-types";

export type BacklinkPromotionPolicy = {
  version: "backlink-promotion-v1";
  includeDecisions: readonly ["qualified"];
  minimumQualificationScore: number;
  tierAThreshold: number;
  tierBThreshold: number;
  requirePageTitle: boolean;
  requireSupportedOpportunityType: boolean;
  requireSupportedPageType: boolean;
  requirePromotionEvidence: boolean;
  requireAssetSuggestion: boolean;
};

export type BacklinkPromotionPolicyErrorCode =
  | "INVALID_PROMOTION_POLICY"
  | "PROMOTION_POLICY_THRESHOLD_INVALID";

export class BacklinkPromotionPolicyError extends Error {
  readonly code: BacklinkPromotionPolicyErrorCode;

  constructor(code: BacklinkPromotionPolicyErrorCode, message: string) {
    super(message);
    this.name = "BacklinkPromotionPolicyError";
    this.code = code;
  }
}

export type BacklinkPromotionMappingErrorCode =
  | "PROMOTION_CANDIDATE_KEY_MISMATCH"
  | "INVALID_PROMOTION_CANDIDATE_KEY"
  | "INVALID_PROMOTION_MAPPING_INPUT";

export class BacklinkPromotionMappingError extends Error {
  readonly code: BacklinkPromotionMappingErrorCode;

  constructor(code: BacklinkPromotionMappingErrorCode, message: string) {
    super(message);
    this.name = "BacklinkPromotionMappingError";
    this.code = code;
  }
}

export type EvaluateBacklinkPromotionEligibilityInput = {
  candidate: BacklinkDiscoveryPreviewCandidate;
  qualificationResult: BacklinkQualificationResult;
  policy: BacklinkPromotionPolicy;
};

export type BacklinkPromotionEligibilityResult =
  | {
      eligible: true;
      opportunityType: BacklinkPromotionOpportunityType;
      pageType: BacklinkPromotionPageType;
      priority: BacklinkPromotionPriority;
    }
  | {
      eligible: false;
      skipCode: BacklinkPromotionSkipCode;
      evidence: string;
    };

export type BuildBacklinkPromotionEvidenceSummaryInput = {
  candidate: BacklinkDiscoveryPreviewCandidate;
  qualificationResult: BacklinkQualificationResult;
};

export type MapQualificationOpportunityTypeToPromotionInput =
  | BacklinkQualificationOpportunityType
  | null;

export type MapQualificationPageTypeToPromotionInput = BacklinkQualificationPageType;

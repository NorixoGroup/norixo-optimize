import type { Json } from "@/types/database.types";

import type { BacklinkDiscoveryPreviewCandidate } from "./backlink-discovery-handler-types";
import type {
  BacklinkQualificationConfidence,
  BacklinkQualificationResult,
} from "./backlink-qualification-types";

export const BACKLINK_PROMOTION_INPUT_VERSION = 1;
export const BACKLINK_PROMOTION_POLICY_VERSION = "backlink-promotion-v1";
export const BACKLINK_PROMOTION_MAX_CANDIDATES = 50;
export const BACKLINK_PROMOTION_MAX_PROPOSALS = 50;
export const BACKLINK_PROMOTION_MAX_INPUT_BYTES = 64 * 1024;
export const BACKLINK_PROMOTION_MAX_OUTPUT_BYTES = 64 * 1024;
export const BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH = 500;
export const BACKLINK_PROMOTION_MAX_TITLE_LENGTH = 300;
export const BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH = 128;

export type BacklinkPromotionIncludeDecision = "qualified";

export type BacklinkPromotionPreviewInputV1 = {
  version: 1;
  source: "automation_qualification";
  policyVersion: "backlink-promotion-v1";
  candidates: BacklinkDiscoveryPreviewCandidate[];
  qualificationResults: BacklinkQualificationResult[];
  includeDecisions: BacklinkPromotionIncludeDecision[];
  maxProposals: number;
};

export type BacklinkPromotionDecision = "propose" | "skip";

export type BacklinkPromotionSkipCode =
  | "QUALIFICATION_NOT_INCLUDED"
  | "QUALIFICATION_REJECTED"
  | "QUALIFICATION_REVIEW_REQUIRED"
  | "DISCOVERY_CANDIDATE_NOT_FOUND"
  | "DUPLICATE_CANDIDATE"
  | "DUPLICATE_URL"
  | "UNSUPPORTED_OPPORTUNITY_TYPE"
  | "UNSUPPORTED_PAGE_TYPE"
  | "MISSING_PAGE_TITLE"
  | "MISSING_ASSET_SUGGESTION"
  | "INSUFFICIENT_PROMOTION_EVIDENCE"
  | "PROPOSAL_LIMIT_REACHED";

export type BacklinkPromotionPriority = "Tier A" | "Tier B" | "Tier C";

export type BacklinkPromotionOpportunityType =
  | "Resource Page"
  | "Guest Post"
  | "Tools List"
  | "Comparison"
  | "Directory"
  | "Partnership"
  | "Editorial Mention"
  | "Other";

export type BacklinkPromotionPageType =
  | "Resource Page"
  | "Guide"
  | "Best Tools List"
  | "Directory"
  | "Blog Article"
  | "Knowledge Base";

export type BacklinkPromotionProposal = Record<string, Json> & {
  proposalKey: string;
  candidateKey: string;
  hostname: string;
  targetPageUrl: string;
  targetPageTitle: string;
  opportunityType: BacklinkPromotionOpportunityType;
  pageType: BacklinkPromotionPageType;
  priority: BacklinkPromotionPriority;
  qualificationScore: number;
  qualificationConfidence: BacklinkQualificationConfidence;
  evidenceSummary: string;
  suggestedAssetKey: string | null;
  promotionDecision: "propose";
};

export type BacklinkPromotionSkippedItem = Record<string, Json> & {
  candidateKey: string;
  promotionDecision: "skip";
  skipCode: BacklinkPromotionSkipCode;
  evidence: string;
};

export type BacklinkPromotionPreviewSummary = Record<string, Json> & {
  qualificationResults: number;
  eligible: number;
  proposed: number;
  skipped: number;
  duplicates: number;
};

export type BacklinkPromotionPreviewOutputV1 = Record<string, Json> & {
  version: 1;
  kind: "backlinks.promotion.preview";
  dryRun: true;
  policyVersion: "backlink-promotion-v1";
  summary: BacklinkPromotionPreviewSummary;
  proposals: BacklinkPromotionProposal[];
  skippedItems: BacklinkPromotionSkippedItem[];
};

export type BacklinkPromotionValidationErrorCode =
  | "INVALID_PROMOTION_INPUT"
  | "PROMOTION_INPUT_TOO_LARGE"
  | "DUPLICATE_PROMOTION_CANDIDATE"
  | "DUPLICATE_PROMOTION_QUALIFICATION_RESULT"
  | "PROMOTION_CANDIDATE_RESULT_MISMATCH"
  | "INVALID_PROMOTION_OUTPUT";

export class BacklinkPromotionValidationError extends Error {
  readonly code: BacklinkPromotionValidationErrorCode;

  constructor(code: BacklinkPromotionValidationErrorCode, message: string) {
    super(message);
    this.name = "BacklinkPromotionValidationError";
    this.code = code;
  }
}

import type { Json } from "@/types/database.types";

export const BACKLINK_QUALIFICATION_INPUT_VERSION = 1;
export const BACKLINK_QUALIFICATION_POLICY_VERSION = "backlink-qualification-v1";
export const BACKLINK_QUALIFICATION_MAX_QUERIES = 10;
export const BACKLINK_QUALIFICATION_MAX_CANDIDATES = 50;
export const BACKLINK_QUALIFICATION_MAX_INPUT_BYTES = 64 * 1024;

export type BacklinkQualificationQueryInput = {
  query: string;
  countryCode: string | null;
  languageCode: string | null;
};

export type BacklinkQualificationCandidateInput = {
  candidateKey: string;
  hostname: string;
  sourceUrl: string;
  pageTitle: string | null;
  snippet: string | null;
  queryIndex: number;
  rank: number;
  countryCode: string | null;
  languageCode: string | null;
  suggestedAssetKey: string | null;
  evidenceSummary: string;
  discoveryScore: number;
};

export type BacklinkQualificationPreviewInputV1 = {
  version: 1;
  source: "automation_discovery";
  policyVersion: "backlink-qualification-v1";
  queries: readonly BacklinkQualificationQueryInput[];
  candidates: readonly BacklinkQualificationCandidateInput[];
  maxCandidates: number;
};

export type LegacyBacklinkQualificationPreviewInput = {
  source: "manual_dashboard";
  requestedScope: "preview";
};

export type ValidateBacklinkQualificationPreviewInputResult =
  | { kind: "valid_v1"; input: BacklinkQualificationPreviewInputV1 }
  | { kind: "legacy_preview"; input: LegacyBacklinkQualificationPreviewInput };

export type BacklinkQualificationDecision = "qualified" | "review" | "rejected";
export type BacklinkQualificationConfidence = "low" | "medium";

export type BacklinkQualificationReasonCode =
  | "TOPICAL_RELEVANCE_STRONG"
  | "TOPICAL_RELEVANCE_PARTIAL"
  | "RESOURCE_PAGE_SIGNAL"
  | "TOOLS_LIST_SIGNAL"
  | "GUIDE_SIGNAL"
  | "GUEST_POST_SIGNAL"
  | "HOSPITALITY_AUDIENCE"
  | "VACATION_RENTAL_AUDIENCE"
  | "LANGUAGE_MATCH"
  | "COUNTRY_MATCH"
  | "HIGH_SERP_POSITION"
  | "SELF_DOMAIN"
  | "PLATFORM_OWNER_DOMAIN"
  | "DIRECT_COMPETITOR"
  | "SOCIAL_NETWORK"
  | "SEARCH_ENGINE"
  | "VIDEO_PLATFORM"
  | "LOGIN_PAGE"
  | "LEGAL_PAGE"
  | "SUPPORT_ONLY_PAGE"
  | "IRRELEVANT_TOPIC"
  | "UNSAFE_TOPIC"
  | "INSUFFICIENT_EVIDENCE"
  | "DUPLICATE_CANDIDATE";

export type BacklinkQualificationFlag =
  | "blocking"
  | "requires_review"
  | "insufficient_evidence";

export type BacklinkQualificationOpportunityType =
  | "Resource Page"
  | "Guest Post"
  | "Tools List"
  | "Comparison"
  | "Directory"
  | "Partnership"
  | "Editorial Mention"
  | "Other";

export type BacklinkQualificationPageType =
  | "resource_page"
  | "guide"
  | "tools_list"
  | "comparison"
  | "directory"
  | "blog_post"
  | "support_page"
  | "unknown";

export type BacklinkQualificationReason = Record<string, Json> & {
  code: BacklinkQualificationReasonCode;
  impact: number;
  evidence: string;
};

export type BacklinkQualificationResult = Record<string, Json> & {
  candidateKey: string;
  decision: BacklinkQualificationDecision;
  qualificationScore: number;
  confidence: BacklinkQualificationConfidence;
  reasons: BacklinkQualificationReason[];
  flags: BacklinkQualificationFlag[];
  proposedOpportunityType: BacklinkQualificationOpportunityType | null;
  proposedPageType: BacklinkQualificationPageType;
};

export type BacklinkQualificationPreviewSummary = Record<string, Json> & {
  candidatesEvaluated: number;
  qualified: number;
  review: number;
  rejected: number;
};

export type BacklinkQualificationPreviewOutputV1 = Record<string, Json> & {
  version: 1;
  kind: "backlinks.qualification.preview";
  dryRun: true;
  policyVersion: "backlink-qualification-v1";
  summary: BacklinkQualificationPreviewSummary;
  results: BacklinkQualificationResult[];
};

export type BacklinkQualificationPolicy = {
  version: "backlink-qualification-v1";
  selfHostnames: readonly string[];
  blockedHostnames: readonly string[];
  platformOwnerHostnames: readonly string[];
  directCompetitorHostnames: readonly string[];
  socialHostnames: readonly string[];
  searchEngineHostnames: readonly string[];
  videoHostnames: readonly string[];
  unsafeTerms: readonly string[];
  relevantTerms: readonly string[];
  editorialSignals: readonly string[];
};

export type BacklinkQualificationValidationErrorCode =
  | "INVALID_QUALIFICATION_INPUT"
  | "QUALIFICATION_INPUT_TOO_LARGE"
  | "DUPLICATE_QUALIFICATION_CANDIDATE"
  | "INVALID_QUALIFICATION_POLICY";

export class BacklinkQualificationValidationError extends Error {
  readonly code: BacklinkQualificationValidationErrorCode;

  constructor(code: BacklinkQualificationValidationErrorCode, message: string) {
    super(message);
    this.name = "BacklinkQualificationValidationError";
    this.code = code;
  }
}

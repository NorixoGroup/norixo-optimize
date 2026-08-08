import {
  BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH,
  type BacklinkPromotionOpportunityType,
  type BacklinkPromotionPageType,
  type BacklinkPromotionPriority,
  type BacklinkPromotionSkipCode,
} from "./backlink-promotion-types";
import { validateBacklinkPromotionPolicy } from "./backlink-promotion-policy";
import type {
  BacklinkPromotionEligibilityResult,
  BacklinkPromotionPolicy,
  BuildBacklinkPromotionEvidenceSummaryInput,
  EvaluateBacklinkPromotionEligibilityInput,
  MapQualificationOpportunityTypeToPromotionInput,
  MapQualificationPageTypeToPromotionInput,
} from "./backlink-promotion-policy-types";
import { BacklinkPromotionMappingError } from "./backlink-promotion-policy-types";

const MAX_SKIPPED_EVIDENCE_LENGTH = 300;

function mappingError(code: BacklinkPromotionMappingError["code"]): never {
  const message =
    code === "PROMOTION_CANDIDATE_KEY_MISMATCH"
      ? "Promotion candidate and qualification result do not match"
      : code === "INVALID_PROMOTION_CANDIDATE_KEY"
        ? "Promotion candidate key is invalid"
        : "Promotion mapping input is invalid";
  throw new BacklinkPromotionMappingError(code, message);
}

function hasCleanText(value: string | null, maximum: number): value is string {
  return value !== null && value.length > 0 && value === value.trim() && value.length <= maximum;
}

function hasSufficientPromotionEvidence(input: BuildBacklinkPromotionEvidenceSummaryInput): boolean {
  return (
    hasCleanText(input.candidate.evidenceSummary, BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH) ||
    input.qualificationResult.reasons.some((reason) => hasCleanText(reason.evidence, 200)) ||
    (input.candidate.pageTitle !== null && Number.isInteger(input.qualificationResult.qualificationScore))
  );
}

function skip(skipCode: BacklinkPromotionSkipCode, evidence: string): BacklinkPromotionEligibilityResult {
  return { eligible: false, skipCode, evidence: evidence.slice(0, MAX_SKIPPED_EVIDENCE_LENGTH) };
}

function redactUrls(value: string): string {
  return value.replace(/https?:\/\/[^\s]+/giu, "URL");
}

export function mapQualificationOpportunityTypeToPromotion(
  value: MapQualificationOpportunityTypeToPromotionInput,
): BacklinkPromotionOpportunityType | null {
  switch (value) {
    case "Resource Page":
    case "Guest Post":
    case "Tools List":
    case "Comparison":
    case "Directory":
    case "Partnership":
    case "Editorial Mention":
    case "Other":
      return value;
    case null:
    default:
      return null;
  }
}

export function mapQualificationPageTypeToPromotion(
  value: MapQualificationPageTypeToPromotionInput,
): BacklinkPromotionPageType | null {
  switch (value) {
    case "resource_page":
      return "Resource Page";
    case "guide":
      return "Guide";
    case "tools_list":
      return "Best Tools List";
    case "directory":
      return "Directory";
    case "blog_post":
      return "Blog Article";
    case "support_page":
      return "Knowledge Base";
    case "comparison":
    case "unknown":
    default:
      return null;
  }
}

export function mapQualificationScoreToPromotionPriority(
  qualificationScore: number,
  policy: BacklinkPromotionPolicy,
): BacklinkPromotionPriority {
  validateBacklinkPromotionPolicy(policy);
  if (!Number.isInteger(qualificationScore) || qualificationScore < 0 || qualificationScore > 100) {
    return mappingError("INVALID_PROMOTION_MAPPING_INPUT");
  }
  if (qualificationScore >= policy.tierAThreshold) return "Tier A";
  if (qualificationScore >= policy.tierBThreshold) return "Tier B";
  return "Tier C";
}

export function buildBacklinkPromotionProposalKey(candidateKey: string): string {
  if (candidateKey.length === 0 || candidateKey !== candidateKey.trim()) {
    return mappingError("INVALID_PROMOTION_CANDIDATE_KEY");
  }
  const proposalKey = `promotion:${candidateKey}`;
  if (proposalKey.length > 160) {
    return mappingError("INVALID_PROMOTION_CANDIDATE_KEY");
  }
  return proposalKey;
}

export function buildBacklinkPromotionEvidenceSummary(
  input: BuildBacklinkPromotionEvidenceSummaryInput,
): string {
  if (!hasSufficientPromotionEvidence(input)) return "";
  const opportunity = input.qualificationResult.proposedOpportunityType ?? "unspecified opportunity";
  const reasonCodes = input.qualificationResult.reasons
    .filter((reason) => hasCleanText(reason.evidence, 200))
    .slice(0, 2)
    .map((reason) => reason.code);
  const parts = [
    `Qualified at ${input.qualificationResult.qualificationScore}/100 for ${opportunity}.`,
  ];
  if (hasCleanText(input.candidate.evidenceSummary, BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH)) {
    parts.push(`Discovery evidence: ${redactUrls(input.candidate.evidenceSummary)}.`);
  }
  if (reasonCodes.length > 0) {
    parts.push(`Reasons: ${reasonCodes.join("; ")}.`);
  }
  return parts.join(" ").slice(0, BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH);
}

export function evaluateBacklinkPromotionEligibility(
  input: EvaluateBacklinkPromotionEligibilityInput,
): BacklinkPromotionEligibilityResult {
  validateBacklinkPromotionPolicy(input.policy);
  if (input.candidate.candidateKey !== input.qualificationResult.candidateKey) {
    return mappingError("PROMOTION_CANDIDATE_KEY_MISMATCH");
  }
  if (input.qualificationResult.decision !== "qualified") {
    if (input.qualificationResult.decision === "review") {
      return skip("QUALIFICATION_REVIEW_REQUIRED", "Qualification requires human review before promotion.");
    }
    if (input.qualificationResult.decision === "rejected") {
      return skip("QUALIFICATION_REJECTED", "Qualification rejected this candidate for promotion.");
    }
    return skip("QUALIFICATION_NOT_INCLUDED", "Qualification decision is not included by the promotion policy.");
  }
  if (input.qualificationResult.qualificationScore < input.policy.minimumQualificationScore) {
    return skip("QUALIFICATION_NOT_INCLUDED", "Qualification score is below the promotion policy minimum.");
  }
  if (input.policy.requirePageTitle && input.candidate.pageTitle === null) {
    return skip("MISSING_PAGE_TITLE", "The candidate has no validated page title.");
  }
  const opportunityType = mapQualificationOpportunityTypeToPromotion(
    input.qualificationResult.proposedOpportunityType,
  );
  if (input.policy.requireSupportedOpportunityType && opportunityType === null) {
    return skip("UNSUPPORTED_OPPORTUNITY_TYPE", "The proposed opportunity type has no safe Backlinks mapping.");
  }
  const pageType = mapQualificationPageTypeToPromotion(input.qualificationResult.proposedPageType);
  if (input.policy.requireSupportedPageType && pageType === null) {
    return skip("UNSUPPORTED_PAGE_TYPE", "The proposed page type has no safe Backlinks mapping.");
  }
  if (input.policy.requireAssetSuggestion && input.candidate.suggestedAssetKey === null) {
    return skip("MISSING_ASSET_SUGGESTION", "The candidate has no suggested asset for promotion.");
  }
  if (input.policy.requirePromotionEvidence && !hasSufficientPromotionEvidence(input)) {
    return skip("INSUFFICIENT_PROMOTION_EVIDENCE", "The candidate has insufficient promotion evidence.");
  }
  if (opportunityType === null || pageType === null) {
    return mappingError("INVALID_PROMOTION_MAPPING_INPUT");
  }
  return {
    eligible: true,
    opportunityType,
    pageType,
    priority: mapQualificationScoreToPromotionPriority(
      input.qualificationResult.qualificationScore,
      input.policy,
    ),
  };
}

import {
  BACKLINK_PROMOTION_INPUT_VERSION,
  BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH,
  BACKLINK_PROMOTION_MAX_CANDIDATES,
  BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH,
  BACKLINK_PROMOTION_MAX_INPUT_BYTES,
  BACKLINK_PROMOTION_MAX_OUTPUT_BYTES,
  BACKLINK_PROMOTION_MAX_PROPOSALS,
  BACKLINK_PROMOTION_MAX_TITLE_LENGTH,
  BACKLINK_PROMOTION_POLICY_VERSION,
  BacklinkPromotionValidationError,
  type BacklinkPromotionPreviewInputV1,
  type BacklinkPromotionPreviewOutputV1,
  type BacklinkPromotionValidationErrorCode,
} from "./backlink-promotion-types";
import type { BacklinkDiscoveryPreviewCandidate } from "./backlink-discovery-handler-types";
import type {
  BacklinkQualificationResult,
  BacklinkQualificationReason,
} from "./backlink-qualification-types";

const INPUT_KEYS = [
  "version",
  "source",
  "policyVersion",
  "candidates",
  "qualificationResults",
  "includeDecisions",
  "maxProposals",
] as const;
const CANDIDATE_KEYS = [
  "candidateKey",
  "hostname",
  "sourceUrl",
  "pageTitle",
  "snippet",
  "queryIndex",
  "rank",
  "countryCode",
  "languageCode",
  "proposedOpportunityType",
  "proposedPageType",
  "suggestedAssetKey",
  "evidenceSummary",
  "discoveryScore",
] as const;
const QUALIFICATION_KEYS = [
  "candidateKey",
  "decision",
  "qualificationScore",
  "confidence",
  "reasons",
  "flags",
  "proposedOpportunityType",
  "proposedPageType",
] as const;
const REASON_KEYS = ["code", "impact", "evidence"] as const;
const OUTPUT_KEYS = [
  "version",
  "kind",
  "dryRun",
  "policyVersion",
  "summary",
  "proposals",
  "skippedItems",
] as const;
const SUMMARY_KEYS = ["qualificationResults", "eligible", "proposed", "skipped", "duplicates"] as const;
const PROPOSAL_KEYS = [
  "proposalKey",
  "candidateKey",
  "hostname",
  "targetPageUrl",
  "targetPageTitle",
  "opportunityType",
  "pageType",
  "priority",
  "qualificationScore",
  "qualificationConfidence",
  "evidenceSummary",
  "suggestedAssetKey",
  "promotionDecision",
] as const;
const SKIPPED_KEYS = ["candidateKey", "promotionDecision", "skipCode", "evidence"] as const;

const qualificationReasonCodes = new Set([
  "TOPICAL_RELEVANCE_STRONG",
  "TOPICAL_RELEVANCE_PARTIAL",
  "RESOURCE_PAGE_SIGNAL",
  "TOOLS_LIST_SIGNAL",
  "GUIDE_SIGNAL",
  "GUEST_POST_SIGNAL",
  "HOSPITALITY_AUDIENCE",
  "VACATION_RENTAL_AUDIENCE",
  "LANGUAGE_MATCH",
  "COUNTRY_MATCH",
  "HIGH_SERP_POSITION",
  "SELF_DOMAIN",
  "PLATFORM_OWNER_DOMAIN",
  "DIRECT_COMPETITOR",
  "SOCIAL_NETWORK",
  "SEARCH_ENGINE",
  "VIDEO_PLATFORM",
  "LOGIN_PAGE",
  "LEGAL_PAGE",
  "SUPPORT_ONLY_PAGE",
  "IRRELEVANT_TOPIC",
  "UNSAFE_TOPIC",
  "INSUFFICIENT_EVIDENCE",
  "DUPLICATE_CANDIDATE",
]);
const qualificationFlags = new Set(["blocking", "requires_review", "insufficient_evidence"]);
const opportunityTypes = new Set([
  "Resource Page",
  "Guest Post",
  "Tools List",
  "Comparison",
  "Directory",
  "Partnership",
  "Editorial Mention",
  "Other",
]);
const qualificationPageTypes = new Set([
  "resource_page",
  "guide",
  "tools_list",
  "comparison",
  "directory",
  "blog_post",
  "support_page",
  "unknown",
]);
const promotionPageTypes = new Set([
  "Resource Page",
  "Guide",
  "Best Tools List",
  "Directory",
  "Blog Article",
  "Knowledge Base",
]);
const promotionPriorities = new Set(["Tier A", "Tier B", "Tier C"]);
const promotionSkipCodes = new Set([
  "QUALIFICATION_NOT_INCLUDED",
  "QUALIFICATION_REJECTED",
  "QUALIFICATION_REVIEW_REQUIRED",
  "DISCOVERY_CANDIDATE_NOT_FOUND",
  "DUPLICATE_CANDIDATE",
  "DUPLICATE_URL",
  "UNSUPPORTED_OPPORTUNITY_TYPE",
  "UNSUPPORTED_PAGE_TYPE",
  "MISSING_PAGE_TITLE",
  "MISSING_ASSET_SUGGESTION",
  "INSUFFICIENT_PROMOTION_EVIDENCE",
  "PROPOSAL_LIMIT_REACHED",
]);

function fail(code: BacklinkPromotionValidationErrorCode): never {
  const message =
    code === "PROMOTION_INPUT_TOO_LARGE"
      ? "Backlink promotion input is too large"
      : code === "DUPLICATE_PROMOTION_CANDIDATE"
        ? "Backlink promotion candidates must be unique"
        : code === "DUPLICATE_PROMOTION_QUALIFICATION_RESULT"
          ? "Backlink promotion qualification results must be unique"
          : code === "PROMOTION_CANDIDATE_RESULT_MISMATCH"
            ? "Backlink promotion candidates and results do not match"
            : code === "INVALID_PROMOTION_OUTPUT"
              ? "Backlink promotion output is invalid"
              : "Backlink promotion input is invalid";
  throw new BacklinkPromotionValidationError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key));
}

function isCleanText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim() && value.length <= maximum;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isOptionalCleanText(value: unknown, maximum: number): boolean {
  return value === null || isCleanText(value, maximum);
}

function isCountryCode(value: unknown): boolean {
  return value === null || (typeof value === "string" && /^[A-Z]{2}$/.test(value));
}

function isLanguageCode(value: unknown): boolean {
  return value === null || (typeof value === "string" && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(value));
}

function parseHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function assertSerializedSize(value: unknown, maximum: number, code: BacklinkPromotionValidationErrorCode): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    fail(code);
  }

  if (new TextEncoder().encode(serialized).length > maximum) {
    fail(code);
  }
}

function isCandidate(value: unknown): value is BacklinkDiscoveryPreviewCandidate {
  if (!isRecord(value) || !hasExactKeys(value, CANDIDATE_KEYS)) {
    return false;
  }
  const url = parseHttpUrl(value.sourceUrl);
  return (
    isCleanText(value.candidateKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH) &&
    typeof value.hostname === "string" &&
    value.hostname.length > 0 &&
    value.hostname === value.hostname.toLowerCase() &&
    value.hostname === value.hostname.trim() &&
    url !== null &&
    url.hash.length === 0 &&
    url.hostname.toLowerCase() === value.hostname &&
    isOptionalCleanText(value.pageTitle, BACKLINK_PROMOTION_MAX_TITLE_LENGTH) &&
    isOptionalCleanText(value.snippet, BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH) &&
    isIntegerInRange(value.queryIndex, 0, Number.MAX_SAFE_INTEGER) &&
    isIntegerInRange(value.rank, 1, Number.MAX_SAFE_INTEGER) &&
    isCountryCode(value.countryCode) &&
    isLanguageCode(value.languageCode) &&
    value.proposedOpportunityType === null &&
    value.proposedPageType === null &&
    isOptionalCleanText(value.suggestedAssetKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH) &&
    isCleanText(value.evidenceSummary, BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH) &&
    isIntegerInRange(value.discoveryScore, 0, 100)
  );
}

function isQualificationReason(value: unknown): value is BacklinkQualificationReason {
  return (
    isRecord(value) &&
    hasExactKeys(value, REASON_KEYS) &&
    typeof value.code === "string" &&
    qualificationReasonCodes.has(value.code) &&
    isIntegerInRange(value.impact, -100, 100) &&
    isCleanText(value.evidence, 200)
  );
}

function isQualificationResult(value: unknown): value is BacklinkQualificationResult {
  if (!isRecord(value) || !hasExactKeys(value, QUALIFICATION_KEYS)) {
    return false;
  }
  if (!Array.isArray(value.reasons) || !value.reasons.every(isQualificationReason)) {
    return false;
  }
  if (!Array.isArray(value.flags) || value.flags.some((flag) => typeof flag !== "string" || !qualificationFlags.has(flag))) {
    return false;
  }
  const flags = new Set(value.flags);
  return (
    isCleanText(value.candidateKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH) &&
    (value.decision === "qualified" || value.decision === "review" || value.decision === "rejected") &&
    isIntegerInRange(value.qualificationScore, 0, 100) &&
    (value.confidence === "low" || value.confidence === "medium") &&
    flags.size === value.flags.length &&
    (value.proposedOpportunityType === null ||
      (typeof value.proposedOpportunityType === "string" && opportunityTypes.has(value.proposedOpportunityType))) &&
    typeof value.proposedPageType === "string" &&
    qualificationPageTypes.has(value.proposedPageType)
  );
}

function isInput(value: unknown): value is BacklinkPromotionPreviewInputV1 {
  return (
    isRecord(value) &&
    hasExactKeys(value, INPUT_KEYS) &&
    value.version === BACKLINK_PROMOTION_INPUT_VERSION &&
    value.source === "automation_qualification" &&
    value.policyVersion === BACKLINK_PROMOTION_POLICY_VERSION &&
    Array.isArray(value.candidates) &&
    Array.isArray(value.qualificationResults) &&
    Array.isArray(value.includeDecisions) &&
    isIntegerInRange(value.maxProposals, 1, BACKLINK_PROMOTION_MAX_PROPOSALS)
  );
}

export function validateBacklinkPromotionPreviewInput(input: unknown): BacklinkPromotionPreviewInputV1 {
  if (!isInput(input)) {
    return fail("INVALID_PROMOTION_INPUT");
  }
  assertSerializedSize(input, BACKLINK_PROMOTION_MAX_INPUT_BYTES, "PROMOTION_INPUT_TOO_LARGE");
  if (
    input.candidates.length > BACKLINK_PROMOTION_MAX_CANDIDATES ||
    input.qualificationResults.length > BACKLINK_PROMOTION_MAX_CANDIDATES ||
    input.includeDecisions.length !== 1 ||
    input.includeDecisions[0] !== "qualified"
  ) {
    return fail("INVALID_PROMOTION_INPUT");
  }

  const candidateKeys = new Set<string>();
  const sourceUrls = new Set<string>();
  for (const candidate of input.candidates) {
    if (!isCandidate(candidate)) {
      return fail("INVALID_PROMOTION_INPUT");
    }
    const url = parseHttpUrl(candidate.sourceUrl);
    if (url === null || candidateKeys.has(candidate.candidateKey) || sourceUrls.has(url.toString())) {
      return fail("DUPLICATE_PROMOTION_CANDIDATE");
    }
    candidateKeys.add(candidate.candidateKey);
    sourceUrls.add(url.toString());
  }

  const qualificationKeys = new Set<string>();
  for (const result of input.qualificationResults) {
    if (!isQualificationResult(result)) {
      return fail("INVALID_PROMOTION_INPUT");
    }
    if (qualificationKeys.has(result.candidateKey)) {
      return fail("DUPLICATE_PROMOTION_QUALIFICATION_RESULT");
    }
    if (!candidateKeys.has(result.candidateKey)) {
      return fail("PROMOTION_CANDIDATE_RESULT_MISMATCH");
    }
    qualificationKeys.add(result.candidateKey);
  }
  return input;
}

function isProposal(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, PROPOSAL_KEYS)) {
    return false;
  }
  const url = parseHttpUrl(value.targetPageUrl);
  return (
    isCleanText(value.proposalKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH) &&
    isCleanText(value.candidateKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH) &&
    typeof value.hostname === "string" &&
    value.hostname.length > 0 &&
    value.hostname === value.hostname.toLowerCase() &&
    url !== null &&
    url.hash.length === 0 &&
    url.hostname.toLowerCase() === value.hostname &&
    isCleanText(value.targetPageTitle, BACKLINK_PROMOTION_MAX_TITLE_LENGTH) &&
    typeof value.opportunityType === "string" &&
    opportunityTypes.has(value.opportunityType) &&
    typeof value.pageType === "string" &&
    promotionPageTypes.has(value.pageType) &&
    typeof value.priority === "string" &&
    promotionPriorities.has(value.priority) &&
    isIntegerInRange(value.qualificationScore, 0, 100) &&
    (value.qualificationConfidence === "low" || value.qualificationConfidence === "medium") &&
    isCleanText(value.evidenceSummary, BACKLINK_PROMOTION_MAX_EVIDENCE_LENGTH) &&
    isOptionalCleanText(value.suggestedAssetKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH) &&
    value.promotionDecision === "propose"
  );
}

function isSkippedItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, SKIPPED_KEYS) &&
    isCleanText(value.candidateKey, BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH) &&
    value.promotionDecision === "skip" &&
    typeof value.skipCode === "string" &&
    promotionSkipCodes.has(value.skipCode) &&
    isCleanText(value.evidence, 300)
  );
}

function isOutput(value: unknown): value is BacklinkPromotionPreviewOutputV1 {
  return (
    isRecord(value) &&
    hasExactKeys(value, OUTPUT_KEYS) &&
    value.version === BACKLINK_PROMOTION_INPUT_VERSION &&
    value.kind === "backlinks.promotion.preview" &&
    value.dryRun === true &&
    value.policyVersion === BACKLINK_PROMOTION_POLICY_VERSION &&
    isRecord(value.summary) &&
    hasExactKeys(value.summary, SUMMARY_KEYS) &&
    Array.isArray(value.proposals) &&
    Array.isArray(value.skippedItems)
  );
}

export function validateBacklinkPromotionPreviewOutput(output: unknown): BacklinkPromotionPreviewOutputV1 {
  if (!isOutput(output)) {
    return fail("INVALID_PROMOTION_OUTPUT");
  }
  assertSerializedSize(output, BACKLINK_PROMOTION_MAX_OUTPUT_BYTES, "INVALID_PROMOTION_OUTPUT");
  const { summary } = output;
  if (
    !Object.values(summary).every((value) => isIntegerInRange(value, 0, Number.MAX_SAFE_INTEGER)) ||
    output.proposals.length > BACKLINK_PROMOTION_MAX_PROPOSALS ||
    output.skippedItems.length > BACKLINK_PROMOTION_MAX_CANDIDATES ||
    summary.proposed !== output.proposals.length ||
    summary.skipped !== output.skippedItems.length ||
    summary.qualificationResults !== summary.proposed + summary.skipped ||
    summary.eligible < summary.proposed ||
    summary.duplicates > summary.skipped
  ) {
    return fail("INVALID_PROMOTION_OUTPUT");
  }
  const proposalKeys = new Set<string>();
  const candidateKeys = new Set<string>();
  for (const proposal of output.proposals) {
    if (!isProposal(proposal) || proposalKeys.has(proposal.proposalKey) || candidateKeys.has(proposal.candidateKey)) {
      return fail("INVALID_PROMOTION_OUTPUT");
    }
    proposalKeys.add(proposal.proposalKey);
    candidateKeys.add(proposal.candidateKey);
  }
  if (!output.skippedItems.every(isSkippedItem)) {
    return fail("INVALID_PROMOTION_OUTPUT");
  }
  return output;
}

import {
  BACKLINK_PROMOTION_POLICY_VERSION,
} from "./backlink-promotion-types";
import {
  BacklinkPromotionPolicyError,
  type BacklinkPromotionPolicy,
} from "./backlink-promotion-policy-types";

const policyKeys = [
  "version",
  "includeDecisions",
  "minimumQualificationScore",
  "tierAThreshold",
  "tierBThreshold",
  "requirePageTitle",
  "requireSupportedOpportunityType",
  "requireSupportedPageType",
  "requirePromotionEvidence",
  "requireAssetSuggestion",
] as const;

const defaultIncludeDecisions: ["qualified"] = ["qualified"];

export const DEFAULT_BACKLINK_PROMOTION_POLICY_V1: BacklinkPromotionPolicy = Object.freeze({
  version: BACKLINK_PROMOTION_POLICY_VERSION,
  includeDecisions: Object.freeze(defaultIncludeDecisions),
  minimumQualificationScore: 70,
  tierAThreshold: 85,
  tierBThreshold: 70,
  requirePageTitle: true,
  requireSupportedOpportunityType: true,
  requireSupportedPageType: true,
  requirePromotionEvidence: true,
  requireAssetSuggestion: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === policyKeys.length && actualKeys.every((key) => policyKeys.some((policyKey) => policyKey === key));
}

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

function policyError(code: BacklinkPromotionPolicyError["code"]): never {
  const message =
    code === "PROMOTION_POLICY_THRESHOLD_INVALID"
      ? "Backlink promotion policy thresholds are invalid"
      : "Backlink promotion policy is invalid";
  throw new BacklinkPromotionPolicyError(code, message);
}

function isPolicyShape(value: unknown): value is BacklinkPromotionPolicy {
  if (!isRecord(value) || !hasExactKeys(value)) return false;
  return (
    value.version === BACKLINK_PROMOTION_POLICY_VERSION &&
    Array.isArray(value.includeDecisions) &&
    value.includeDecisions.length === 1 &&
    value.includeDecisions[0] === "qualified" &&
    isScore(value.minimumQualificationScore) &&
    isScore(value.tierAThreshold) &&
    isScore(value.tierBThreshold) &&
    typeof value.requirePageTitle === "boolean" &&
    typeof value.requireSupportedOpportunityType === "boolean" &&
    typeof value.requireSupportedPageType === "boolean" &&
    typeof value.requirePromotionEvidence === "boolean" &&
    typeof value.requireAssetSuggestion === "boolean"
  );
}

export function validateBacklinkPromotionPolicy(policy: unknown): BacklinkPromotionPolicy {
  if (!isPolicyShape(policy)) return policyError("INVALID_PROMOTION_POLICY");
  if (
    policy.tierAThreshold <= policy.tierBThreshold ||
    policy.tierBThreshold < policy.minimumQualificationScore
  ) {
    return policyError("PROMOTION_POLICY_THRESHOLD_INVALID");
  }
  return policy;
}

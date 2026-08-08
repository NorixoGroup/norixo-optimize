import type {
  BacklinkCampaignEngineReason,
} from "./backlink-campaign-engine-types";
import {
  BacklinkCampaignEngineEligibilityError,
  type BacklinkCampaignEngineEligibilityErrorCode,
  type BacklinkCampaignOpportunityEligibilityResult,
  type EvaluateBacklinkCampaignOpportunityInput,
} from "./backlink-campaign-engine-eligibility-types";

export function evaluateBacklinkCampaignOpportunity(
  input: EvaluateBacklinkCampaignOpportunityInput,
): BacklinkCampaignOpportunityEligibilityResult {
  assertContext(input);

  if (!input.policy.eligibleCampaignStatuses.includes(input.campaign.status)) {
    return skipped("CAMPAIGN_NOT_DRAFT");
  }
  if (input.context.duplicateOpportunity) return skipped("DUPLICATE_OPPORTUNITY");
  if (input.context.duplicateTarget) {
    if (input.policy.duplicateTargetPolicy !== "skip") {
      fail("CAMPAIGN_ELIGIBILITY_INVARIANT_FAILED");
    }
    return skipped("DUPLICATE_TARGET");
  }
  if (
    !input.policy.eligibleOpportunityLifecycleStatuses.includes(
      input.opportunity.lifecycleStatus,
    )
  ) {
    return skipped("OPPORTUNITY_NOT_ACTIVE");
  }
  if (
    !input.policy.eligibleQualificationStatuses.includes(
      input.opportunity.qualificationStatus,
    )
  ) {
    return review("OPPORTUNITY_NOT_QUALIFIED");
  }
  if (
    !input.policy.eligibleEditorialStatuses.includes(
      input.opportunity.editorialStatus,
    )
  ) {
    return review("OPPORTUNITY_EDITORIAL_NOT_READY");
  }
  if (input.context.selectedCount >= input.policy.maxSelectedOpportunities) {
    return skipped("CAMPAIGN_LIMIT_REACHED");
  }
  if (input.context.selectedForDomainCount >= input.policy.maxPerDomain) {
    return skipped("DOMAIN_LIMIT_REACHED");
  }
  return {
    decision: "selected",
    reasons: ["ELIGIBLE"],
    proposedMembershipStatus: "planned",
    proposedPriority: input.opportunity.priority,
  };
}

function assertContext(input: EvaluateBacklinkCampaignOpportunityInput): void {
  if (
    !Number.isSafeInteger(input.context.selectedCount) ||
    input.context.selectedCount < 0 ||
    !Number.isSafeInteger(input.context.selectedForDomainCount) ||
    input.context.selectedForDomainCount < 0 ||
    typeof input.context.duplicateOpportunity !== "boolean" ||
    typeof input.context.duplicateTarget !== "boolean"
  ) {
    fail("INVALID_CAMPAIGN_ELIGIBILITY_INPUT");
  }
  if (
    !Number.isSafeInteger(input.policy.maxSelectedOpportunities) ||
    input.policy.maxSelectedOpportunities < 1 ||
    !Number.isSafeInteger(input.policy.maxPerDomain) ||
    input.policy.maxPerDomain < 1 ||
    input.policy.maxPerDomain > input.policy.maxSelectedOpportunities
  ) {
    fail("CAMPAIGN_ELIGIBILITY_INVARIANT_FAILED");
  }
}

function skipped(
  reason: Exclude<BacklinkCampaignEngineReason, "ELIGIBLE">,
): BacklinkCampaignOpportunityEligibilityResult {
  return {
    decision: "skipped",
    reasons: [reason],
    proposedMembershipStatus: null,
    proposedPriority: null,
  };
}

function review(
  reason:
    | "OPPORTUNITY_NOT_QUALIFIED"
    | "OPPORTUNITY_EDITORIAL_NOT_READY",
): BacklinkCampaignOpportunityEligibilityResult {
  return {
    decision: "review",
    reasons: [reason],
    proposedMembershipStatus: null,
    proposedPriority: null,
  };
}

function fail(code: BacklinkCampaignEngineEligibilityErrorCode): never {
  throw new BacklinkCampaignEngineEligibilityError(code);
}

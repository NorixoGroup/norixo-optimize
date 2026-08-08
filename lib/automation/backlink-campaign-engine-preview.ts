import {
  BACKLINK_CAMPAIGN_ENGINE_OUTPUT_VERSION,
  type BacklinkCampaignEnginePreviewOutputV1,
  type BacklinkCampaignEngineReason,
} from "./backlink-campaign-engine-types";
import { evaluateBacklinkCampaignOpportunity } from "./backlink-campaign-engine-eligibility";
import { normalizeBacklinkDiscoveryUrl } from "./backlink-discovery-normalization";
import {
  validateBacklinkCampaignEnginePolicy,
  validateBacklinkCampaignEnginePreviewInput,
  validateBacklinkCampaignEnginePreviewOutput,
} from "./backlink-campaign-engine-validation";
import {
  BacklinkCampaignEnginePreviewError,
  type ExecuteBacklinkCampaignEnginePreviewInput,
} from "./backlink-campaign-engine-preview-types";

export function executeBacklinkCampaignEnginePreview(
  executionInput: ExecuteBacklinkCampaignEnginePreviewInput,
): BacklinkCampaignEnginePreviewOutputV1 {
  const policy = validateBacklinkCampaignEnginePolicy(executionInput.policy);
  const input = validateBacklinkCampaignEnginePreviewInput(executionInput.input);
  const effectiveMaxSelectedOpportunities = Math.min(
    policy.maxSelectedOpportunities,
    input.requestedLimits.maxSelectedOpportunities,
  );
  const effectiveMaxPerDomain = Math.min(
    policy.maxPerDomain,
    input.requestedLimits.maxPerDomain,
    effectiveMaxSelectedOpportunities,
  );
  const effectivePolicy = {
    ...policy,
    maxSelectedOpportunities: effectiveMaxSelectedOpportunities,
    maxPerDomain: effectiveMaxPerDomain,
  };

  const seenOpportunityIds = new Set<string>();
  const seenOpportunityKeys = new Set<string>();
  const seenCanonicalTargets = new Set<string>();
  const selectedCountByDomain = new Map<string, number>();
  let selectedCount = 0;
  const results: BacklinkCampaignEnginePreviewOutputV1["results"] = [];

  for (const opportunity of input.opportunities) {
    if (seenOpportunityIds.has(opportunity.opportunityId)) {
      failInvariant();
    }
    if (seenOpportunityKeys.has(opportunity.opportunityKey)) {
      failInvariant();
    }
    const canonicalTarget = canonicalizeTarget(opportunity.targetPageUrl);
    const duplicateTarget = seenCanonicalTargets.has(canonicalTarget);
    const selectedForDomainCount = selectedCountByDomain.get(opportunity.domainId) ?? 0;
    const eligibility = evaluateBacklinkCampaignOpportunity({
      campaign: input.campaign,
      opportunity,
      policy: effectivePolicy,
      context: {
        selectedCount,
        selectedForDomainCount,
        duplicateOpportunity: false,
        duplicateTarget,
      },
    });
    assertEligibilityResult(eligibility);

    seenOpportunityIds.add(opportunity.opportunityId);
    seenOpportunityKeys.add(opportunity.opportunityKey);
    seenCanonicalTargets.add(canonicalTarget);
    results.push({
      opportunityId: opportunity.opportunityId,
      opportunityKey: opportunity.opportunityKey,
      decision: eligibility.decision,
      reasons: [...eligibility.reasons],
      proposedMembershipStatus: eligibility.proposedMembershipStatus,
      proposedPriority: eligibility.proposedPriority,
    });
    if (eligibility.decision === "selected") {
      selectedCount += 1;
      selectedCountByDomain.set(opportunity.domainId, selectedForDomainCount + 1);
    }
  }

  const summary = summarize(results);
  const output: BacklinkCampaignEnginePreviewOutputV1 = {
    version: BACKLINK_CAMPAIGN_ENGINE_OUTPUT_VERSION,
    policyVersion: policy.version,
    workspaceId: input.workspaceId,
    runId: input.runId,
    campaignId: input.campaign.campaignId,
    mode: input.mode,
    source: input.source,
    summary,
    results,
  };
  return validateBacklinkCampaignEnginePreviewOutput(output);
}

function canonicalizeTarget(targetPageUrl: string): string {
  try {
    return normalizeBacklinkDiscoveryUrl(targetPageUrl).sourceUrl;
  } catch {
    failInvariant();
  }
}

function summarize(
  results: BacklinkCampaignEnginePreviewOutputV1["results"],
): BacklinkCampaignEnginePreviewOutputV1["summary"] {
  let selected = 0;
  let review = 0;
  let skipped = 0;
  let eligible = 0;
  let duplicateOpportunities = 0;
  let duplicateTargets = 0;
  let domainLimited = 0;
  let campaignLimited = 0;

  for (const result of results) {
    if (result.decision === "selected") selected += 1;
    if (result.decision === "review") review += 1;
    if (result.decision === "skipped") skipped += 1;
    const reason = onlyReason(result.reasons);
    if (reason === "ELIGIBLE") eligible += 1;
    if (reason === "DUPLICATE_OPPORTUNITY") duplicateOpportunities += 1;
    if (reason === "DUPLICATE_TARGET") duplicateTargets += 1;
    if (reason === "DOMAIN_LIMIT_REACHED") domainLimited += 1;
    if (reason === "CAMPAIGN_LIMIT_REACHED") campaignLimited += 1;
  }

  return {
    inputOpportunities: results.length,
    selected,
    review,
    skipped,
    eligible,
    duplicateOpportunities,
    duplicateTargets,
    domainLimited,
    campaignLimited,
  };
}

function assertEligibilityResult(
  result: ReturnType<typeof evaluateBacklinkCampaignOpportunity>,
): void {
  if (
    result.reasons.length !== 1 ||
    (result.decision === "selected" &&
      (result.reasons[0] !== "ELIGIBLE" ||
        result.proposedMembershipStatus !== "planned" ||
        result.proposedPriority === null)) ||
    (result.decision !== "selected" &&
      (result.reasons[0] === "ELIGIBLE" ||
        result.proposedMembershipStatus !== null ||
        result.proposedPriority !== null))
  ) {
    failInvariant();
  }
}

function onlyReason(reasons: BacklinkCampaignEngineReason[]): BacklinkCampaignEngineReason {
  if (reasons.length !== 1) {
    failInvariant();
  }
  const [reason] = reasons;
  if (reason === undefined) {
    failInvariant();
  }
  return reason;
}

function failInvariant(): never {
  throw new BacklinkCampaignEnginePreviewError(
    "CAMPAIGN_ENGINE_INTERNAL_INVARIANT",
  );
}

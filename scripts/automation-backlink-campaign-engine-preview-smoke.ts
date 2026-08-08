import type { Json } from "@/types/database.types";
import {
  BacklinkCampaignEnginePreviewError,
  BacklinkCampaignEngineValidationError,
  DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
  executeBacklinkCampaignEnginePreview,
  type BacklinkCampaignEngineOpportunityInputV1,
  type ExecuteBacklinkCampaignEnginePreviewInput,
} from "@/lib/automation";

const base: ExecuteBacklinkCampaignEnginePreviewInput = {
  input: {
    version: 1,
    workspaceId: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000002",
    mode: "preview",
    source: "manual_dashboard",
    campaign: {
      campaignId: "00000000-0000-4000-8000-000000000003",
      campaignKey: "BL-CAM-2026-001",
      name: "Campaign preview",
      objective: "Preview candidates",
      status: "draft",
    },
    opportunities: [
      opportunity(4, "Tier A"),
      opportunity(5, "Tier B"),
      opportunity(6, "Tier C"),
      opportunity(7, "Tier A", { qualificationStatus: "Needs Review" }),
      opportunity(8, "Tier A", { editorialStatus: "Page Identified" }),
      opportunity(9, "Tier A", { lifecycleStatus: "closed" }),
    ],
    requestedLimits: { maxSelectedOpportunities: 50, maxPerDomain: 3 },
  },
  policy: DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
};

const before = JSON.stringify(base);
const nominal = executeBacklinkCampaignEnginePreview(base);
const persistedJson: Json = nominal;
assert(persistedJson === nominal, "output must be JSON assignable");
assert(nominal.workspaceId === base.input.workspaceId, "workspaceId must propagate");
assert(nominal.runId === base.input.runId, "runId must propagate");
assert(nominal.source === base.input.source, "source must propagate");
assert(nominal.campaignId === base.input.campaign.campaignId, "campaignId must propagate");
assert(nominal.mode === base.input.mode, "mode must propagate");
assert(!("kind" in nominal) && !("dryRun" in nominal), "output must not add legacy fields");
assertEqual(nominal.results.map((result) => result.opportunityKey), base.input.opportunities.map((item) => item.opportunityKey), "input order");
assertEqual(nominal.results.map((result) => result.decision), ["selected", "selected", "selected", "review", "review", "skipped"], "nominal decisions");
assertEqual(nominal.results.map((result) => result.reasons[0]), ["ELIGIBLE", "ELIGIBLE", "ELIGIBLE", "OPPORTUNITY_NOT_QUALIFIED", "OPPORTUNITY_EDITORIAL_NOT_READY", "OPPORTUNITY_NOT_ACTIVE"], "nominal reasons");
assertEqual(nominal.results.map((result) => result.proposedMembershipStatus), ["planned", "planned", "planned", null, null, null], "membership status must follow decisions");
assertEqual(nominal.results.slice(0, 3).map((result) => result.proposedPriority), ["Tier A", "Tier B", "Tier C"], "priority must propagate");
assert(nominal.results.every((result) => !("proposedCampaignPriority" in result)), "legacy priority must be absent");
assertEqual(nominal.summary, { inputOpportunities: 6, selected: 3, review: 2, skipped: 1, eligible: 3, duplicateOpportunities: 0, duplicateTargets: 0, domainLimited: 0, campaignLimited: 0 }, "nominal summary");
assert(JSON.stringify(base) === before, "input and policy must not mutate");

const zero = executeBacklinkCampaignEnginePreview({ ...base, input: { ...base.input, opportunities: [] } });
assertEqual(zero.summary, { inputOpportunities: 0, selected: 0, review: 0, skipped: 0, eligible: 0, duplicateOpportunities: 0, duplicateTargets: 0, domainLimited: 0, campaignLimited: 0 }, "zero summary");
assert(zero.results.length === 0, "zero results");

const nonDraft = executeBacklinkCampaignEnginePreview({ ...base, input: { ...base.input, campaign: { ...base.input.campaign, status: "active" } } });
assert(nonDraft.results.every((result) => result.decision === "skipped" && result.reasons[0] === "CAMPAIGN_NOT_DRAFT"), "non-draft campaign must skip every opportunity");
assert(nonDraft.summary.selected === 0 && nonDraft.summary.eligible === 0, "non-draft counters");

const domainLimited = executeBacklinkCampaignEnginePreview({
  ...base,
  input: { ...base.input, opportunities: [opportunity(10, "Tier A", { domainId: "00000000-0000-4000-8000-000000000010" }), opportunity(11, "Tier A", { domainId: "00000000-0000-4000-8000-000000000010" }), opportunity(12, "Tier A", { domainId: "00000000-0000-4000-8000-000000000010" })], requestedLimits: { maxSelectedOpportunities: 10, maxPerDomain: 2 } },
});
assertEqual(domainLimited.results.map((result) => result.reasons[0]), ["ELIGIBLE", "ELIGIBLE", "DOMAIN_LIMIT_REACHED"], "domain limit order");
assertEqual(domainLimited.summary, { inputOpportunities: 3, selected: 2, review: 0, skipped: 1, eligible: 2, duplicateOpportunities: 0, duplicateTargets: 0, domainLimited: 1, campaignLimited: 0 }, "domain limit summary");

const sameHostnameDifferentDomains = executeBacklinkCampaignEnginePreview({
  ...base,
  input: { ...base.input, opportunities: [opportunity(13, "Tier A", { domain: "shared.example", domainId: "00000000-0000-4000-8000-000000000013" }), opportunity(14, "Tier A", { domain: "shared.example", domainId: "00000000-0000-4000-8000-000000000014" })], requestedLimits: { maxSelectedOpportunities: 10, maxPerDomain: 1 } },
});
assert(sameHostnameDifferentDomains.summary.selected === 2, "domainId, not hostname, must scope limits");

const campaignLimited = executeBacklinkCampaignEnginePreview({
  ...base,
  input: { ...base.input, opportunities: [opportunity(15, "Tier A"), opportunity(16, "Tier A"), opportunity(17, "Tier A")], requestedLimits: { maxSelectedOpportunities: 2, maxPerDomain: 2 } },
});
assertEqual(campaignLimited.results.map((result) => result.reasons[0]), ["ELIGIBLE", "ELIGIBLE", "CAMPAIGN_LIMIT_REACHED"], "campaign limit order");
assert(campaignLimited.summary.campaignLimited === 1 && campaignLimited.summary.eligible === 2, "campaign limit summary");

const lowerRequested = executeBacklinkCampaignEnginePreview({ ...base, input: { ...base.input, opportunities: [opportunity(18, "Tier A"), opportunity(19, "Tier A")], requestedLimits: { maxSelectedOpportunities: 1, maxPerDomain: 1 } } });
assert(lowerRequested.summary.selected === 1 && lowerRequested.summary.campaignLimited === 1, "requested limit must apply");
const lowerPolicy = executeBacklinkCampaignEnginePreview({ ...base, input: { ...base.input, opportunities: [opportunity(20, "Tier A"), opportunity(21, "Tier A")], requestedLimits: { maxSelectedOpportunities: 10, maxPerDomain: 10 } }, policy: { ...DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1, maxSelectedOpportunities: 1, maxPerDomain: 1 } });
assert(lowerPolicy.summary.selected === 1 && lowerPolicy.summary.campaignLimited === 1, "policy limit must apply");

const lowerRequestedPerDomain = executeBacklinkCampaignEnginePreview({
  ...base,
  input: {
    ...base.input,
    opportunities: [
      opportunity(28, "Tier A", { domainId: "00000000-0000-4000-8000-000000000028" }),
      opportunity(29, "Tier A", { domainId: "00000000-0000-4000-8000-000000000028" }),
    ],
    requestedLimits: { maxSelectedOpportunities: 3, maxPerDomain: 1 },
  },
  policy: {
    ...DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
    maxSelectedOpportunities: 3,
    maxPerDomain: 3,
  },
});
assertEqual(lowerRequestedPerDomain.results.map((result) => result.reasons[0]), ["ELIGIBLE", "DOMAIN_LIMIT_REACHED"], "requested per-domain limit must apply");

const reviewThenSelected = executeBacklinkCampaignEnginePreview({ ...base, input: { ...base.input, opportunities: [opportunity(22, "Tier A", { qualificationStatus: "Needs Review" }), opportunity(23, "Tier A")], requestedLimits: { maxSelectedOpportunities: 1, maxPerDomain: 1 } } });
assertEqual(reviewThenSelected.results.map((result) => result.decision), ["review", "selected"], "review must not consume a limit");
const skippedThenSelected = executeBacklinkCampaignEnginePreview({ ...base, input: { ...base.input, opportunities: [opportunity(24, "Tier A", { lifecycleStatus: "closed" }), opportunity(25, "Tier A")], requestedLimits: { maxSelectedOpportunities: 1, maxPerDomain: 1 } } });
assertEqual(skippedThenSelected.results.map((result) => result.decision), ["skipped", "selected"], "skipped must not consume a limit");

const canonicalDuplicates = executeBacklinkCampaignEnginePreview({ ...base, input: { ...base.input, opportunities: [opportunity(26, "Tier A", { targetPageUrl: "https://example.com/tracked?utm_source=one" }), opportunity(27, "Tier A", { targetPageUrl: "https://example.com/tracked" })] } });
assertEqual(canonicalDuplicates.results.map((result) => result.reasons[0]), ["ELIGIBLE", "DUPLICATE_TARGET"], "canonical duplicate target");
assert(canonicalDuplicates.summary.duplicateTargets === 1, "duplicate target counter");

const duplicateKeyInput: ExecuteBacklinkCampaignEnginePreviewInput = {
  ...base,
  input: {
    ...base.input,
    opportunities: [
      opportunity(30, "Tier A", { opportunityKey: "shared-opportunity-key" }),
      opportunity(31, "Tier B", { opportunityKey: "shared-opportunity-key" }),
    ],
  },
};
assertPreviewInvariant(
  () => executeBacklinkCampaignEnginePreview(duplicateKeyInput),
  "shared-opportunity-key",
);

const duplicateIdInput: ExecuteBacklinkCampaignEnginePreviewInput = {
  ...base,
  input: {
    ...base.input,
    opportunities: [opportunity(32, "Tier A"), opportunity(32, "Tier B")],
  },
};
assertValidationError(() => executeBacklinkCampaignEnginePreview(duplicateIdInput));

const duplicateRawTargetInput: ExecuteBacklinkCampaignEnginePreviewInput = {
  ...base,
  input: {
    ...base.input,
    opportunities: [
      opportunity(33, "Tier A", { targetPageUrl: "https://example.com/same" }),
      opportunity(34, "Tier B", { targetPageUrl: "https://example.com/same" }),
    ],
  },
};
assertValidationError(() => executeBacklinkCampaignEnginePreview(duplicateRawTargetInput));

assertValidationError(() =>
  executeBacklinkCampaignEnginePreview({
    ...base,
    policy: { ...DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1, maxSelectedOpportunities: 0 },
  }),
);

const first = executeBacklinkCampaignEnginePreview(base);
const second = executeBacklinkCampaignEnginePreview(base);
assert(first !== second && first.results !== second.results, "outputs must be independent");
assertEqual(first, second, "preview must be deterministic");

console.log("PASS — Automation backlink campaign engine preview smoke");

function opportunity(
  number: number,
  priority: "Tier A" | "Tier B" | "Tier C",
  overrides: Partial<BacklinkCampaignEngineOpportunityInputV1> = {},
): BacklinkCampaignEngineOpportunityInputV1 {
  const identifier = String(number).padStart(12, "0");
  return {
    opportunityId: `00000000-0000-4000-8000-${identifier}`,
    opportunityKey: `OP-${String(number).padStart(6, "0")}`,
    domainId: `00000000-0000-4000-8000-${identifier}`,
    domain: `example-${number}.com`,
    targetPageUrl: `https://example-${number}.com/resource`,
    title: `Resource ${number}`,
    priority,
    qualificationStatus: "Qualified",
    editorialStatus: "Not Started",
    lifecycleStatus: "active",
    ...overrides,
  };
}

function assertEqual(value: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(value) === JSON.stringify(expected), message);
}

function assertPreviewInvariant(action: () => void, forbidden: string): void {
  try {
    action();
  } catch (error) {
    assert(error instanceof BacklinkCampaignEnginePreviewError, "expected preview invariant");
    assert(error.code === "CAMPAIGN_ENGINE_INTERNAL_INVARIANT", "expected invariant code");
    assert(!error.message.includes(forbidden), "invariant message must be safe");
    return;
  }
  throw new Error("expected preview invariant");
}

function assertValidationError(action: () => void): void {
  try {
    action();
  } catch (error) {
    assert(error instanceof BacklinkCampaignEngineValidationError, "expected validation error");
    return;
  }
  throw new Error("expected validation error");
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

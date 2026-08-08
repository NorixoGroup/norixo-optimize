import {
  BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION,
  BacklinkCampaignEngineEligibilityError,
  DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
  evaluateBacklinkCampaignOpportunity,
  validateBacklinkCampaignEnginePolicy,
  type EvaluateBacklinkCampaignOpportunityInput,
} from "@/lib/automation";

const input: EvaluateBacklinkCampaignOpportunityInput = {
  campaign: {
    campaignId: "00000000-0000-4000-8000-000000000001",
    campaignKey: "BL-CAM-2026-001",
    name: "Campaign",
    objective: "Objective",
    status: "draft",
  },
  opportunity: {
    opportunityId: "00000000-0000-4000-8000-000000000002",
    opportunityKey: "OP-000001",
    domainId: "00000000-0000-4000-8000-000000000003",
    domain: "example.com",
    targetPageUrl: "https://example.com/resources",
    title: "Resources",
    priority: "Tier A",
    qualificationStatus: "Qualified",
    editorialStatus: "Not Started",
    lifecycleStatus: "active",
  },
  policy: DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
  context: {
    selectedCount: 0,
    selectedForDomainCount: 0,
    duplicateOpportunity: false,
    duplicateTarget: false,
  },
};

const policyBefore = JSON.stringify(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1);
const inputBefore = JSON.stringify(input);

assert(
  validateBacklinkCampaignEnginePolicy(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1) ===
    DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
  "default policy reference must be preserved",
);
assert(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1.version === BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION, "policy version");
assertEqual(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1.eligibleCampaignStatuses, ["draft"], "campaign statuses");
assertEqual(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1.eligibleOpportunityLifecycleStatuses, ["active"], "lifecycle statuses");
assertEqual(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1.eligibleQualificationStatuses, ["Qualified"], "qualification statuses");
assertEqual(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1.eligibleEditorialStatuses, ["Not Started", "Ready for Contact"], "editorial statuses");
assert(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1.maxSelectedOpportunities === 50, "campaign limit");
assert(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1.maxPerDomain === 3, "domain limit");
assert(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1.duplicateTargetPolicy === "skip", "duplicate target policy");
assert(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1.initialMembershipStatus === "planned", "membership status");
assert(JSON.stringify(DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1) === policyBefore, "policy must not mutate");

assertResult(evaluateBacklinkCampaignOpportunity(input), "selected", "ELIGIBLE", "Tier A");
for (const priority of ["Tier A", "Tier B", "Tier C"] as const) {
  assertResult(evaluateBacklinkCampaignOpportunity({ ...input, opportunity: { ...input.opportunity, priority } }), "selected", "ELIGIBLE", priority);
}

for (const status of ["active", "paused", "completed", "archived"] as const) {
  assertResult(evaluateBacklinkCampaignOpportunity({ ...input, campaign: { ...input.campaign, status } }), "skipped", "CAMPAIGN_NOT_DRAFT");
}
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, context: { ...input.context, duplicateOpportunity: true, duplicateTarget: true } }), "skipped", "DUPLICATE_OPPORTUNITY");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, context: { ...input.context, duplicateTarget: true } }), "skipped", "DUPLICATE_TARGET");
for (const lifecycleStatus of ["closed", "archived"] as const) {
  assertResult(evaluateBacklinkCampaignOpportunity({ ...input, opportunity: { ...input.opportunity, lifecycleStatus } }), "skipped", "OPPORTUNITY_NOT_ACTIVE");
}
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, opportunity: { ...input.opportunity, qualificationStatus: "Needs Review", editorialStatus: "Closed" } }), "review", "OPPORTUNITY_NOT_QUALIFIED");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, opportunity: { ...input.opportunity, editorialStatus: "Page Identified" } }), "review", "OPPORTUNITY_EDITORIAL_NOT_READY");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, context: { ...input.context, selectedCount: 49 } }), "selected", "ELIGIBLE", "Tier A");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, context: { ...input.context, selectedCount: 50 } }), "skipped", "CAMPAIGN_LIMIT_REACHED");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, context: { ...input.context, selectedCount: 50, selectedForDomainCount: 3 } }), "skipped", "CAMPAIGN_LIMIT_REACHED");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, context: { ...input.context, selectedForDomainCount: 2 } }), "selected", "ELIGIBLE", "Tier A");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, context: { ...input.context, selectedForDomainCount: 3 } }), "skipped", "DOMAIN_LIMIT_REACHED");

assertResult(evaluateBacklinkCampaignOpportunity({ ...input, campaign: { ...input.campaign, status: "active" }, context: { ...input.context, duplicateOpportunity: true } }), "skipped", "CAMPAIGN_NOT_DRAFT");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, context: { ...input.context, duplicateOpportunity: true, duplicateTarget: true } }), "skipped", "DUPLICATE_OPPORTUNITY");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, opportunity: { ...input.opportunity, lifecycleStatus: "closed" }, context: { ...input.context, duplicateTarget: true } }), "skipped", "DUPLICATE_TARGET");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, opportunity: { ...input.opportunity, lifecycleStatus: "closed", qualificationStatus: "Needs Review" } }), "skipped", "OPPORTUNITY_NOT_ACTIVE");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, opportunity: { ...input.opportunity, qualificationStatus: "Needs Review", editorialStatus: "Closed" } }), "review", "OPPORTUNITY_NOT_QUALIFIED");
assertResult(evaluateBacklinkCampaignOpportunity({ ...input, opportunity: { ...input.opportunity, editorialStatus: "Closed" }, context: { ...input.context, selectedCount: 50 } }), "review", "OPPORTUNITY_EDITORIAL_NOT_READY");

assertThrows(() => evaluateBacklinkCampaignOpportunity({ ...input, context: { ...input.context, selectedCount: -1 } }), "INVALID_CAMPAIGN_ELIGIBILITY_INPUT");
assertThrows(() => evaluateBacklinkCampaignOpportunity({ ...input, context: { ...input.context, selectedForDomainCount: 1.5 } }), "INVALID_CAMPAIGN_ELIGIBILITY_INPUT");
const first = evaluateBacklinkCampaignOpportunity(input);
const second = evaluateBacklinkCampaignOpportunity(input);
assert(first !== second, "result roots must be independent");
assertEqual(first, second, "same input must yield same content");
assert(JSON.stringify(input) === inputBefore, "input must not mutate");

console.log("PASS — Automation backlink campaign engine policy smoke");

function assertResult(
  result: ReturnType<typeof evaluateBacklinkCampaignOpportunity>,
  decision: "selected" | "review" | "skipped",
  reason: string,
  priority?: "Tier A" | "Tier B" | "Tier C",
): void {
  assert(result.decision === decision, `expected ${decision}`);
  assert(result.reasons.length === 1 && result.reasons[0] === reason, `expected ${reason}`);
  if (decision === "selected") {
    assert(result.proposedMembershipStatus === "planned", "selected membership");
    assert(result.proposedPriority === priority, "selected priority");
    return;
  }
  assert(result.proposedMembershipStatus === null, "non-selected membership");
  assert(result.proposedPriority === null, "non-selected priority");
}

function assertThrows(run: () => unknown, code: string): void {
  try {
    run();
  } catch (error) {
    assert(error instanceof BacklinkCampaignEngineEligibilityError, "expected eligibility error");
    assert(error.code === code, `expected ${code}`);
    return;
  }
  throw new Error(`expected ${code}`);
}

function assertEqual(value: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(value) === JSON.stringify(expected), message);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

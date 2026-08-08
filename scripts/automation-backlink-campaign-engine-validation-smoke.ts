import type { Json } from "@/types/database.types";
import {
  BACKLINK_CAMPAIGN_ENGINE_INPUT_VERSION,
  BACKLINK_CAMPAIGN_ENGINE_MAX_OPPORTUNITIES,
  BACKLINK_CAMPAIGN_ENGINE_MAX_OUTPUT_BYTES,
  BACKLINK_CAMPAIGN_ENGINE_OUTPUT_VERSION,
  BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION,
  BacklinkCampaignEngineValidationError,
  type BacklinkCampaignEnginePolicyV1,
  type BacklinkCampaignEnginePreviewInputV1,
  type BacklinkCampaignEnginePreviewOutputV1,
  validateBacklinkCampaignEnginePolicy,
  validateBacklinkCampaignEnginePreviewInput,
  validateBacklinkCampaignEnginePreviewOutput,
} from "@/lib/automation";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const campaignId = "00000000-0000-4000-8000-000000000003";
const opportunityId = "00000000-0000-4000-8000-000000000004";

const input: BacklinkCampaignEnginePreviewInputV1 = {
  version: BACKLINK_CAMPAIGN_ENGINE_INPUT_VERSION,
  workspaceId,
  runId,
  mode: "preview",
  source: "manual_dashboard",
  campaign: {
    campaignId,
    campaignKey: "BL-CAM-2026-001",
    name: "Host resources",
    objective: "Find relevant editorial placements",
    status: "draft",
  },
  opportunities: [{
    opportunityId,
    opportunityKey: "OPP-001",
    domainId: "00000000-0000-4000-8000-000000000005",
    domain: "example.com",
    targetPageUrl: "https://example.com/host-resources?topic=airbnb",
    title: "Host resources",
    priority: "Tier A",
    qualificationStatus: "Qualified",
    editorialStatus: "ready",
    lifecycleStatus: "active",
  }],
  requestedLimits: { maxSelectedOpportunities: 10, maxPerDomain: 2 },
};

const policy: BacklinkCampaignEnginePolicyV1 = {
  version: BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION,
  eligibleCampaignStatuses: ["draft"],
  eligibleOpportunityLifecycleStatuses: ["active"],
  eligibleQualificationStatuses: ["Qualified"],
  eligibleEditorialStatuses: ["ready"],
  maxSelectedOpportunities: 10,
  maxPerDomain: 2,
  duplicateTargetPolicy: "skip",
  initialMembershipStatus: "planned",
};

const output: BacklinkCampaignEnginePreviewOutputV1 = {
  version: BACKLINK_CAMPAIGN_ENGINE_OUTPUT_VERSION,
  policyVersion: BACKLINK_CAMPAIGN_ENGINE_POLICY_VERSION,
  workspaceId,
  runId,
  campaignId,
  mode: "preview",
  source: "manual_dashboard",
  summary: {
    inputOpportunities: 1,
    selected: 1,
    review: 0,
    skipped: 0,
    eligible: 1,
    duplicateOpportunities: 0,
    duplicateTargets: 0,
    domainLimited: 0,
    campaignLimited: 0,
  },
  results: [{
    opportunityId,
    opportunityKey: "OPP-001",
    decision: "selected",
    reasons: ["ELIGIBLE"],
    proposedMembershipStatus: "planned",
    proposedPriority: "Tier A",
  }],
};

const inputBefore = JSON.stringify(input);
const policyBefore = JSON.stringify(policy);
const outputBefore = JSON.stringify(output);

assert(validateBacklinkCampaignEnginePreviewInput(input) === input, "input reference must be preserved");
assert(validateBacklinkCampaignEnginePolicy(policy) === policy, "policy reference must be preserved");
assert(validateBacklinkCampaignEnginePreviewOutput(output) === output, "output reference must be preserved");
const persistedOutput: Json = output;
assert(persistedOutput === output, "output must remain directly JSON assignable");
assert(JSON.stringify(input) === inputBefore, "input must not be mutated");
assert(JSON.stringify(policy) === policyBefore, "policy must not be mutated");
assert(JSON.stringify(output) === outputBefore, "output must not be mutated");

assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, version: 2 }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, workspaceId: "not-a-uuid" }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, mode: "execute" }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, source: "provider" }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, campaign: { ...input.campaign, status: "unknown" } }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, opportunities: [{ ...input.opportunities[0], domain: "localhost" }] }), "INVALID_CAMPAIGN_ENGINE_INPUT");
const { domainId: ignoredDomainId, ...opportunityWithoutDomainId } = input.opportunities[0];
assert(ignoredDomainId.length > 0, "fixture domainId must remain populated");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, opportunities: [opportunityWithoutDomainId] }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, opportunities: [{ ...input.opportunities[0], domainId: null }] }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, opportunities: [{ ...input.opportunities[0], domainId: "not-a-uuid" }] }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, opportunities: [{ ...input.opportunities[0], domainId: 42 }] }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, opportunities: [{ ...input.opportunities[0], extra: "not allowed" }] }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, opportunities: [{ ...input.opportunities[0], targetPageUrl: "http://192.168.1.1/private" }] }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, opportunities: [{ ...input.opportunities[0] }, { ...input.opportunities[0] }] }), "CAMPAIGN_ENGINE_DUPLICATE_OPPORTUNITY");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, opportunities: [{ ...input.opportunities[0] }, { ...input.opportunities[0], opportunityId: "00000000-0000-4000-8000-000000000005", opportunityKey: "OPP-002" }] }), "CAMPAIGN_ENGINE_DUPLICATE_TARGET");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, requestedLimits: { maxSelectedOpportunities: 2, maxPerDomain: 3 } }), "INVALID_CAMPAIGN_ENGINE_INPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({ ...input, opportunities: Array.from({ length: BACKLINK_CAMPAIGN_ENGINE_MAX_OPPORTUNITIES + 1 }, () => input.opportunities[0]) }), "CAMPAIGN_ENGINE_TOO_MANY_OPPORTUNITIES");
assertThrows(() => validateBacklinkCampaignEnginePreviewInput({
  ...input,
  opportunities: Array.from({ length: BACKLINK_CAMPAIGN_ENGINE_MAX_OPPORTUNITIES }, (_, index) => ({
    ...input.opportunities[0],
    opportunityId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
    opportunityKey: `OPP-${index}`,
    targetPageUrl: `https://example.com/${index}/${"x".repeat(1950)}`,
    title: "x".repeat(500),
  })),
}), "CAMPAIGN_ENGINE_INPUT_TOO_LARGE");

assertThrows(() => validateBacklinkCampaignEnginePolicy({ ...policy, version: "other" }), "INVALID_CAMPAIGN_ENGINE_POLICY");
assertThrows(() => validateBacklinkCampaignEnginePolicy({ ...policy, eligibleCampaignStatuses: [] }), "INVALID_CAMPAIGN_ENGINE_POLICY");
assertThrows(() => validateBacklinkCampaignEnginePolicy({ ...policy, eligibleCampaignStatuses: ["unknown"] }), "INVALID_CAMPAIGN_ENGINE_POLICY");
assertThrows(() => validateBacklinkCampaignEnginePolicy({ ...policy, maxSelectedOpportunities: 0 }), "INVALID_CAMPAIGN_ENGINE_POLICY");
assertThrows(() => validateBacklinkCampaignEnginePolicy({ ...policy, maxSelectedOpportunities: 1.5 }), "INVALID_CAMPAIGN_ENGINE_POLICY");
assertThrows(() => validateBacklinkCampaignEnginePolicy({ ...policy, maxPerDomain: 11 }), "INVALID_CAMPAIGN_ENGINE_POLICY");
assertThrows(() => validateBacklinkCampaignEnginePolicy({ ...policy, duplicateTargetPolicy: "allow" }), "INVALID_CAMPAIGN_ENGINE_POLICY");
assertThrows(() => validateBacklinkCampaignEnginePolicy({ ...policy, initialMembershipStatus: "active" }), "INVALID_CAMPAIGN_ENGINE_POLICY");

assertThrows(() => validateBacklinkCampaignEnginePreviewOutput({ ...output, version: 2 }), "INVALID_CAMPAIGN_ENGINE_OUTPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewOutput({ ...output, policyVersion: "other" }), "INVALID_CAMPAIGN_ENGINE_OUTPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewOutput({ ...output, results: [{ ...output.results[0], proposedMembershipStatus: null }] }), "INVALID_CAMPAIGN_ENGINE_OUTPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewOutput({ ...output, summary: { ...output.summary, selected: 0 } }), "INVALID_CAMPAIGN_ENGINE_OUTPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewOutput({ ...output, results: [{ ...output.results[0] }, { ...output.results[0] }] }), "INVALID_CAMPAIGN_ENGINE_OUTPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewOutput({ ...output, results: [{ ...output.results[0], reasons: ["NOT_A_REASON"] }] }), "INVALID_CAMPAIGN_ENGINE_OUTPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewOutput({ ...output, results: [{ ...output.results[0], reasons: ["ELIGIBLE", "ELIGIBLE"] }] }), "INVALID_CAMPAIGN_ENGINE_OUTPUT");
assertThrows(() => validateBacklinkCampaignEnginePreviewOutput({ ...output, results: [], summary: { ...output.summary, inputOpportunities: 0, selected: 0, eligible: 0 }, extra: "not allowed" }), "INVALID_CAMPAIGN_ENGINE_OUTPUT");
assert(BACKLINK_CAMPAIGN_ENGINE_MAX_OUTPUT_BYTES === 128 * 1024, "output byte limit must remain explicit");

console.log("PASS — Automation Backlink Campaign Engine validation smoke");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(run: () => unknown, code: string): void {
  try {
    run();
  } catch (error) {
    assert(error instanceof BacklinkCampaignEngineValidationError, "expected validation error");
    assert(error.code === code, `expected ${code}, received ${error.code}`);
    return;
  }
  throw new Error(`expected ${code}`);
}

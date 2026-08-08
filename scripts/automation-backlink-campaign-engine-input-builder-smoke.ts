import {
  BacklinkCampaignEngineInputBuilderError,
  buildBacklinkCampaignEnginePreviewInput,
  type BuildBacklinkCampaignEnginePreviewInput,
  type BuildBacklinkCampaignEnginePreviewInputDependencies,
} from "@/lib/automation";

type Campaign = NonNullable<
  Awaited<ReturnType<BuildBacklinkCampaignEnginePreviewInputDependencies["getCampaignById"]>>
>;
type Opportunity = NonNullable<
  Awaited<ReturnType<BuildBacklinkCampaignEnginePreviewInputDependencies["getOpportunityById"]>>
>;
type Domain = NonNullable<
  Awaited<ReturnType<BuildBacklinkCampaignEnginePreviewInputDependencies["getDomainById"]>>
>;

const workspaceId = id(1);
const runId = id(2);
const campaignId = id(3);
const sharedDomainId = id(4);
const otherDomainId = id(5);
const opportunityA = opportunity(10, sharedDomainId, "shared.example.com");
const opportunityB = opportunity(11, sharedDomainId, "shared.example.com");
const opportunityC = opportunity(12, otherDomainId, "other.example.com");
const baseInput: BuildBacklinkCampaignEnginePreviewInput = {
  workspaceId,
  runId,
  campaignId,
  source: "manual_dashboard",
  opportunityIds: [opportunityB.id, opportunityA.id, opportunityC.id],
  requestedLimits: { maxSelectedOpportunities: 50, maxPerDomain: 3 },
};

async function main(): Promise<void> {
const nominalCalls: string[] = [];
const nominalDependencies = dependencies({
  campaign: campaign(),
  opportunities: [opportunityA, opportunityB, opportunityC],
  domains: [domain(sharedDomainId, "shared.example.com"), domain(otherDomainId, "other.example.com")],
  calls: nominalCalls,
});
const beforeInput = JSON.stringify(baseInput);
const beforeCampaign = JSON.stringify(campaign());
const beforeOpportunity = JSON.stringify(opportunityA);
const beforeDomain = JSON.stringify(domain(sharedDomainId, "shared.example.com"));
const nominal = await buildBacklinkCampaignEnginePreviewInput(baseInput, nominalDependencies);
assertEqual(nominalCalls, [
  `campaign:${campaignId}`,
  `opportunity:${opportunityB.id}`,
  `domain:${sharedDomainId}`,
  `opportunity:${opportunityA.id}`,
  `opportunity:${opportunityC.id}`,
  `domain:${otherDomainId}`,
], "reads must be sequential and ordered");
assert(nominal.campaign === nominalDependencies.campaign, "campaign reference must be preserved");
assertEqual(nominal.opportunities.map((item) => item.id), baseInput.opportunityIds, "opportunity result order");
assertEqual(nominal.domains.map((item) => item.id), [sharedDomainId, sharedDomainId, otherDomainId], "domains must align with opportunities");
assertEqual(nominal.previewInput, {
  version: 1,
  workspaceId,
  runId,
  mode: "preview",
  source: "manual_dashboard",
  campaign: {
    campaignId,
    campaignKey: "CAM-001",
    name: "Campaign",
    objective: "Preview",
    status: "draft",
  },
  opportunities: [
    mapped(opportunityB, "shared.example.com"),
    mapped(opportunityA, "shared.example.com"),
    mapped(opportunityC, "other.example.com"),
  ],
  requestedLimits: { maxSelectedOpportunities: 50, maxPerDomain: 3 },
}, "preview input mapping");
assert(!("ownerId" in nominal.previewInput.campaign), "campaign mapping must stay public");
assert(nominal.previewInput.opportunities.every((item) => !("assetId" in item) && !("evidence" in item)), "opportunity mapping must stay public");
assert(JSON.stringify(baseInput) === beforeInput, "input must not mutate");
assert(JSON.stringify(nominalDependencies.campaign) === beforeCampaign, "campaign must not mutate");
assert(JSON.stringify(opportunityA) === beforeOpportunity, "opportunity must not mutate");
assert(JSON.stringify(domain(sharedDomainId, "shared.example.com")) === beforeDomain, "domain must not mutate");

const zeroCalls: string[] = [];
const zeroDependencies = dependencies({ campaign: campaign(), opportunities: [], domains: [], calls: zeroCalls });
const zero = await buildBacklinkCampaignEnginePreviewInput(
  { ...baseInput, opportunityIds: [] },
  zeroDependencies,
);
assertEqual(zeroCalls, [`campaign:${campaignId}`], "zero must only read campaign");
assert(zero.previewInput.opportunities.length === 0, "zero opportunities must be valid");

for (const invalidInput of invalidInputs()) {
  const calls: string[] = [];
  await expectBuilderError(
    () => buildBacklinkCampaignEnginePreviewInput(invalidInput, dependencies({ campaign: campaign(), opportunities: [], domains: [], calls })),
    undefined,
  );
  assert(calls.length === 0, "invalid input must not read dependencies");
}

await expectBuilderError(
  () => buildBacklinkCampaignEnginePreviewInput(baseInput, dependencies({ campaign: null, opportunities: [], domains: [], calls: [] })),
  "CAMPAIGN_ENGINE_CAMPAIGN_NOT_FOUND",
);
const campaignDependencyError = new Error("campaign dependency failure");
await expectSameError(
  () => buildBacklinkCampaignEnginePreviewInput(baseInput, dependencies({ campaignError: campaignDependencyError, opportunities: [], domains: [], calls: [] })),
  campaignDependencyError,
);
for (const invalidCampaign of [
  { ...campaign(), id: id(40) },
  { ...campaign(), workspace_id: id(41) },
  { ...campaign(), campaign_key: "" },
  { ...campaign(), name: "" },
  { ...campaign(), status: "unknown" },
]) {
  const calls: string[] = [];
  await expectBuilderError(
    () => buildBacklinkCampaignEnginePreviewInput(baseInput, dependencies({ campaign: invalidCampaign, opportunities: [], domains: [], calls })),
    invalidCampaign.workspace_id === workspaceId ? "CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED" : "CAMPAIGN_ENGINE_CAMPAIGN_SCOPE_MISMATCH",
  );
  assert(calls.length === 1, "invalid campaign must stop before opportunities");
}

const firstOpportunityOnly = { ...baseInput, opportunityIds: [opportunityA.id] };
await expectBuilderError(
  () => buildBacklinkCampaignEnginePreviewInput(firstOpportunityOnly, dependencies({ campaign: campaign(), opportunities: [], domains: [], calls: [] })),
  "CAMPAIGN_ENGINE_OPPORTUNITY_NOT_FOUND",
);
const opportunityDependencyError = new Error("opportunity dependency failure");
await expectSameError(
  () => buildBacklinkCampaignEnginePreviewInput(firstOpportunityOnly, dependencies({ campaign: campaign(), opportunityError: opportunityDependencyError, domains: [], calls: [] })),
  opportunityDependencyError,
);
for (const invalidOpportunity of [
  { ...opportunityA, id: id(42) },
  { ...opportunityA, workspace_id: id(43) },
  { ...opportunityA, domain_id: "invalid" },
  { ...opportunityA, opportunity_key: "" },
  { ...opportunityA, target_page_url: "not-a-url" },
  { ...opportunityA, priority: "unknown" },
]) {
  const calls: string[] = [];
  await expectBuilderError(
    () => buildBacklinkCampaignEnginePreviewInput(firstOpportunityOnly, dependencies({ campaign: campaign(), opportunityResult: invalidOpportunity, domains: [], calls })),
    invalidOpportunity.workspace_id === workspaceId ? "CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED" : "CAMPAIGN_ENGINE_OPPORTUNITY_SCOPE_MISMATCH",
  );
  assert(calls.length === 2, "invalid opportunity must stop before domain reads");
}

await expectBuilderError(
  () => buildBacklinkCampaignEnginePreviewInput(firstOpportunityOnly, dependencies({ campaign: campaign(), opportunities: [opportunityA], domains: [], calls: [] })),
  "CAMPAIGN_ENGINE_DOMAIN_NOT_FOUND",
);
const domainDependencyError = new Error("domain dependency failure");
await expectSameError(
  () => buildBacklinkCampaignEnginePreviewInput(firstOpportunityOnly, dependencies({ campaign: campaign(), opportunities: [opportunityA], domainError: domainDependencyError, calls: [] })),
  domainDependencyError,
);
for (const invalidDomain of [
  { ...domain(sharedDomainId, "shared.example.com"), id: id(44) },
  { ...domain(sharedDomainId, "shared.example.com"), workspace_id: id(45) },
  { ...domain(sharedDomainId, "shared.example.com"), hostname: "UPPER.EXAMPLE.COM" },
  { ...domain(sharedDomainId, "different.example.com") },
]) {
  await expectBuilderError(
    () => buildBacklinkCampaignEnginePreviewInput(firstOpportunityOnly, dependencies({ campaign: campaign(), opportunities: [opportunityA], domainResult: invalidDomain, calls: [] })),
    invalidDomain.workspace_id === workspaceId ? "CAMPAIGN_ENGINE_DATA_INVARIANT_FAILED" : "CAMPAIGN_ENGINE_DOMAIN_SCOPE_MISMATCH",
  );
}

const nonDraft = await buildBacklinkCampaignEnginePreviewInput(
  firstOpportunityOnly,
  dependencies({ campaign: { ...campaign(), status: "active" }, opportunities: [{ ...opportunityA, qualification_status: "Needs Review", lifecycle_status: "closed" }], domains: [domain(sharedDomainId, "shared.example.com")], calls: [] }),
);
assert(nonDraft.previewInput.campaign.status === "active", "builder must not filter campaign status");
assert(nonDraft.previewInput.opportunities[0]?.qualificationStatus === "Needs Review", "builder must not filter qualification");
assert(nonDraft.previewInput.opportunities[0]?.lifecycleStatus === "closed", "builder must not filter lifecycle");

const deterministicFirst = await buildBacklinkCampaignEnginePreviewInput(baseInput, dependencies({ campaign: campaign(), opportunities: [opportunityA, opportunityB, opportunityC], domains: [domain(sharedDomainId, "shared.example.com"), domain(otherDomainId, "other.example.com")], calls: [] }));
const deterministicSecond = await buildBacklinkCampaignEnginePreviewInput(baseInput, dependencies({ campaign: campaign(), opportunities: [opportunityA, opportunityB, opportunityC], domains: [domain(sharedDomainId, "shared.example.com"), domain(otherDomainId, "other.example.com")], calls: [] }));
assert(deterministicFirst.previewInput !== deterministicSecond.previewInput, "preview inputs must be independent");
assertEqual(deterministicFirst.previewInput, deterministicSecond.previewInput, "builder must be deterministic");

console.log("PASS — Automation backlink campaign engine input builder smoke");
}

void main();

function dependencies(options: {
  campaign?: Campaign | null;
  campaignError?: Error;
  opportunities?: Opportunity[];
  opportunityResult?: Opportunity | null;
  opportunityError?: Error;
  domains?: Domain[];
  domainResult?: Domain | null;
  domainError?: Error;
  calls: string[];
}): BuildBacklinkCampaignEnginePreviewInputDependencies & { campaign?: Campaign | null } {
  return {
    campaign: options.campaign,
    async getCampaignById(input) {
      options.calls.push(`campaign:${input.campaignId}`);
      if (options.campaignError !== undefined) throw options.campaignError;
      return options.campaign ?? null;
    },
    async getOpportunityById(input) {
      options.calls.push(`opportunity:${input.opportunityId}`);
      if (options.opportunityError !== undefined) throw options.opportunityError;
      if (options.opportunityResult !== undefined) return options.opportunityResult;
      return options.opportunities?.find((item) => item.id === input.opportunityId) ?? null;
    },
    async getDomainById(input) {
      options.calls.push(`domain:${input.domainId}`);
      if (options.domainError !== undefined) throw options.domainError;
      if (options.domainResult !== undefined) return options.domainResult;
      return options.domains?.find((item) => item.id === input.domainId) ?? null;
    },
  };
}

function invalidInputs(): unknown[] {
  return [
    null,
    [],
    { ...baseInput, extra: true },
    { ...baseInput, workspaceId: "invalid" },
    { ...baseInput, source: "invalid" },
    { ...baseInput, opportunityIds: [opportunityA.id, opportunityA.id] },
    { ...baseInput, opportunityIds: Array.from({ length: 101 }, (_, index) => id(index + 100)) },
    { ...baseInput, requestedLimits: { maxSelectedOpportunities: 0, maxPerDomain: 1 } },
    { ...baseInput, requestedLimits: { maxSelectedOpportunities: 1, maxPerDomain: 2 } },
  ];
}

function campaign(): Campaign {
  return {
    id: campaignId,
    workspace_id: workspaceId,
    campaign_key: "CAM-001",
    name: "Campaign",
    objective: "Preview",
    status: "draft",
    owner_id: id(6),
    archived_at: null,
    created_at: "2026-08-04T00:00:00.000Z",
    created_by: id(7),
    end_at: null,
    start_at: null,
    updated_at: "2026-08-04T00:00:00.000Z",
  };
}

function opportunity(number: number, domainId: string, hostname: string): Opportunity {
  return {
    id: id(number),
    workspace_id: workspaceId,
    opportunity_key: `OP-${number}`,
    domain_id: domainId,
    target_page_url: `https://${hostname}/resource-${number}`,
    target_page_title: `Resource ${number}`,
    priority: "Tier A",
    qualification_status: "Qualified",
    editorial_status: "Not Started",
    lifecycle_status: "active",
    asset_id: id(number + 50),
    assigned_to: null,
    archived_at: null,
    closed_at: null,
    closed_reason: null,
    convention_risk: false,
    created_at: "2026-08-04T00:00:00.000Z",
    created_by: id(8),
    discovery_status: "discovered",
    editorial_angle: null,
    evidence_summary: "Evidence",
    last_reviewed_at: null,
    next_review_at: null,
    opportunity_type: "editorial",
    page_type: "resource",
    updated_at: "2026-08-04T00:00:00.000Z",
  };
}

function domain(domainId: string, hostname: string): Domain {
  return {
    id: domainId,
    workspace_id: workspaceId,
    domain_key: hostname,
    hostname,
    archived_at: null,
    country_code: null,
    created_at: "2026-08-04T00:00:00.000Z",
    created_by: id(9),
    display_name: null,
    editorial_category: null,
    editorial_compatibility: null,
    estimated_difficulty: null,
    lifecycle_status: "active",
    primary_language: null,
    region: null,
    updated_at: "2026-08-04T00:00:00.000Z",
  };
}

function mapped(opportunityValue: Opportunity, hostname: string): Record<string, unknown> {
  return {
    opportunityId: opportunityValue.id,
    opportunityKey: opportunityValue.opportunity_key,
    domainId: opportunityValue.domain_id,
    domain: hostname,
    targetPageUrl: opportunityValue.target_page_url,
    title: opportunityValue.target_page_title,
    priority: opportunityValue.priority,
    qualificationStatus: opportunityValue.qualification_status,
    editorialStatus: opportunityValue.editorial_status,
    lifecycleStatus: opportunityValue.lifecycle_status,
  };
}

function id(number: number): string {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

async function expectBuilderError(
  action: () => Promise<unknown>,
  expectedCode: string | undefined,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error instanceof BacklinkCampaignEngineInputBuilderError, "expected builder error");
    if (expectedCode !== undefined) assert(error.code === expectedCode, "unexpected builder error code");
    return;
  }
  throw new Error("expected builder error");
}

async function expectSameError(action: () => Promise<unknown>, expected: Error): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error === expected, "dependency error identity must be preserved");
    return;
  }
  throw new Error("expected dependency error");
}

function assertEqual(value: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(value) === JSON.stringify(expected), message);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

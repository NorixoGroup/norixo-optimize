import type { Json } from "@/types/database.types";
import {
  BacklinkCampaignEnginePreviewError,
  BacklinkCampaignEngineValidationError,
  DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
  buildBacklinkCampaignEnginePreviewInput,
  executeBacklinkCampaignEnginePreviewHandler,
  type BuildBacklinkCampaignEnginePreviewInputDependencies,
  type ExecuteBacklinkCampaignEnginePreviewHandlerDependencies,
  type ExecuteBacklinkCampaignEnginePreviewHandlerInput,
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
const domainId = id(4);
const secondDomainId = id(5);
const firstOpportunity = opportunity(10, domainId, "first.example.com");
const secondOpportunity = opportunity(11, secondDomainId, "second.example.com");
const input: ExecuteBacklinkCampaignEnginePreviewHandlerInput = {
  workspaceId,
  runId,
  campaignId,
  source: "manual_dashboard",
  opportunityIds: [firstOpportunity.id, secondOpportunity.id],
  requestedLimits: { maxSelectedOpportunities: 2, maxPerDomain: 1 },
};

async function main(): Promise<void> {
  const calls: string[] = [];
  let receivedBuilderInput: ExecuteBacklinkCampaignEnginePreviewHandlerInput | null = null;
  const dependencies = createDependencies({
    calls,
    onBuild(inputValue) {
      receivedBuilderInput = inputValue;
    },
  });
  const before = JSON.stringify({ input, policy: dependencies.policy });
  const output = await executeBacklinkCampaignEnginePreviewHandler(input, dependencies);
  const persistedJson: Json = output;
  assert(persistedJson === output, "output must be JSON assignable");
  assert(calls[0] === "builder", "builder must run first");
  assert(calls.length === 1, "handler must call only the injected builder");
  assert(
    receivedBuilderInput !== null && receivedBuilderInput === input,
    "handler must forward the exact command",
  );
  assertEqual(output.results.map((result) => result.decision), ["selected", "selected"], "engine output");
  assertEqual(output.summary, { inputOpportunities: 2, selected: 2, review: 0, skipped: 0, eligible: 2, duplicateOpportunities: 0, duplicateTargets: 0, domainLimited: 0, campaignLimited: 0 }, "output summary");
  assert(!("campaign" in output) && !("opportunities" in output) && !("domains" in output), "sources must not be exposed");
  assert(JSON.stringify({ input, policy: dependencies.policy }) === before, "handler input and policy must not mutate");

  const reducedPolicyOutput = await executeBacklinkCampaignEnginePreviewHandler(
    input,
    createDependencies({
      policy: {
        ...DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
        maxSelectedOpportunities: 1,
        maxPerDomain: 1,
      },
    }),
  );
  assertEqual(reducedPolicyOutput.results.map((result) => result.reasons[0]), ["ELIGIBLE", "CAMPAIGN_LIMIT_REACHED"], "injected policy must control output");

  const zero = await executeBacklinkCampaignEnginePreviewHandler(
    { ...input, opportunityIds: [] },
    createDependencies(),
  );
  assert(zero.results.length === 0 && zero.summary.inputOpportunities === 0, "zero opportunities must be valid");

  for (const source of ["manual_dashboard", "automation_campaign"] as const) {
    const sourceCalls: string[] = [];
    await executeBacklinkCampaignEnginePreviewHandler(
      { ...input, source },
      createDependencies({ calls: sourceCalls }),
    );
    assertEqual(sourceCalls, ["builder"], "source must pass through the builder unchanged");
  }

  const builderError = new Error("builder failure");
  await expectSameError(
    () => executeBacklinkCampaignEnginePreviewHandler(input, {
      buildPreviewInput: async () => {
        throw builderError;
      },
      policy: DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
    }),
    builderError,
  );

  await expectValidationError(() => executeBacklinkCampaignEnginePreviewHandler(
    input,
    createDependencies({
      policy: { ...DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1, maxSelectedOpportunities: 0 },
    }),
  ));

  await expectPreviewError(() => executeBacklinkCampaignEnginePreviewHandler(
    { ...input, opportunityIds: [firstOpportunity.id, duplicateKeyOpportunity().id] },
    createDependencies({ opportunities: [firstOpportunity, duplicateKeyOpportunity()] }),
  ));

  const first = await executeBacklinkCampaignEnginePreviewHandler(input, createDependencies());
  const second = await executeBacklinkCampaignEnginePreviewHandler(input, createDependencies());
  assert(first !== second && first.results !== second.results, "outputs must be independent");
  assertEqual(first, second, "handler must be deterministic");

  console.log("PASS — Automation backlink campaign engine handler smoke");
}

void main();

function createDependencies(options: {
  calls?: string[];
  onBuild?: (inputValue: ExecuteBacklinkCampaignEnginePreviewHandlerInput) => void;
  policy?: ExecuteBacklinkCampaignEnginePreviewHandlerDependencies["policy"];
  opportunities?: Opportunity[];
} = {}): ExecuteBacklinkCampaignEnginePreviewHandlerDependencies {
  const opportunities = options.opportunities ?? [firstOpportunity, secondOpportunity];
  const domains = [domain(domainId, "first.example.com"), domain(secondDomainId, "second.example.com")];
  const sourceDependencies: BuildBacklinkCampaignEnginePreviewInputDependencies = {
    async getCampaignById() {
      return campaign();
    },
    async getOpportunityById(inputValue) {
      return opportunities.find((item) => item.id === inputValue.opportunityId) ?? null;
    },
    async getDomainById(inputValue) {
      return domains.find((item) => item.id === inputValue.domainId) ?? null;
    },
  };
  return {
    async buildPreviewInput(inputValue) {
      options.calls?.push("builder");
      options.onBuild?.(inputValue);
      return buildBacklinkCampaignEnginePreviewInput(inputValue, sourceDependencies);
    },
    policy: options.policy ?? DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
  };
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

function opportunity(number: number, currentDomainId: string, hostname: string): Opportunity {
  return {
    id: id(number),
    workspace_id: workspaceId,
    opportunity_key: `OP-${number}`,
    domain_id: currentDomainId,
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

function duplicateKeyOpportunity(): Opportunity {
  return {
    ...opportunity(12, secondDomainId, "second.example.com"),
    opportunity_key: firstOpportunity.opportunity_key,
  };
}

function domain(currentDomainId: string, hostname: string): Domain {
  return {
    id: currentDomainId,
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

function id(number: number): string {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

async function expectSameError(action: () => Promise<unknown>, expected: Error): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error === expected, "error identity must be preserved");
    return;
  }
  throw new Error("expected error");
}

async function expectValidationError(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error instanceof BacklinkCampaignEngineValidationError, "expected validation error");
    return;
  }
  throw new Error("expected validation error");
}

async function expectPreviewError(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error instanceof BacklinkCampaignEnginePreviewError, "expected preview error");
    assert(error.code === "CAMPAIGN_ENGINE_INTERNAL_INVARIANT", "expected preview invariant");
    return;
  }
  throw new Error("expected preview error");
}

function assertEqual(value: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(value) === JSON.stringify(expected), message);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

import type { Json } from "../types/database.types";
import type { BacklinkCampaignRow } from "../lib/backlinks/repositories/campaignsRepository";
import type { BacklinkOpportunityRow } from "../lib/backlinks/repositories/opportunitiesRepository";
import type { BacklinkDomainRow } from "../lib/backlinks/repositories/domainsRepository";
import type { BuildBacklinkCampaignEnginePreviewInputResult } from "../lib/automation/backlink-campaign-engine-input-builder-types";
import type { BacklinkCampaignEnginePreviewInputV1 } from "../lib/automation/backlink-campaign-engine-types";
import {
  createDryRunAutomationTaskHandlers,
  DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
  validateBacklinkCampaignEnginePreviewOutput,
  type AutomationTask,
  type ExecuteAutomationTaskHandlerInput,
} from "../lib/automation";
import { executeBacklinkCampaignEngineTaskHandler } from "../lib/automation/backlink-campaign-engine-task-handler";
import {
  BacklinkCampaignEngineTaskValidationError,
  validateBacklinkCampaignEngineTaskInput,
} from "../lib/automation/backlink-campaign-engine-task-validation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const RUN_ID = "00000000-0000-4000-8000-000000000002";
const TASK_ID = "00000000-0000-4000-8000-000000000007";
const CAMPAIGN_ID = "00000000-0000-4000-8000-000000000010";
const OPPORTUNITY_ID = "00000000-0000-4000-8000-000000000011";
const DOMAIN_ID = "00000000-0000-4000-8000-000000000012";
const ACTOR_ID = "00000000-0000-4000-8000-000000000013";
const NOW = "2026-08-03T10:00:00.000Z";

const campaignFixture: BacklinkCampaignRow = {
  archived_at: null,
  campaign_key: "campaign-key",
  created_at: NOW,
  created_by: ACTOR_ID,
  end_at: null,
  id: CAMPAIGN_ID,
  live_initial_send_enabled: false,
  name: "Campaign",
  objective: "Build links",
  owner_id: ACTOR_ID,
  start_at: null,
  status: "draft",
  updated_at: NOW,
  workspace_id: WORKSPACE_ID,
};

const opportunityFixture: BacklinkOpportunityRow = {
  archived_at: null,
  asset_id: "00000000-0000-4000-8000-000000000014",
  assigned_to: null,
  closed_at: null,
  closed_reason: null,
  convention_risk: false,
  created_at: NOW,
  created_by: ACTOR_ID,
  discovery_status: "Identified",
  domain_id: DOMAIN_ID,
  editorial_angle: null,
  editorial_status: "Ready for Contact",
  evidence_summary: "Relevant editorial opportunity.",
  id: OPPORTUNITY_ID,
  last_reviewed_at: null,
  lifecycle_status: "active",
  next_review_at: null,
  opportunity_key: "opportunity-key",
  opportunity_type: "Resource Page",
  page_type: "Resource Page",
  priority: "Tier A",
  qualification_status: "Qualified",
  target_page_title: "Guide",
  target_page_url: "https://example.com/guide",
  updated_at: NOW,
  workspace_id: WORKSPACE_ID,
};

const domainFixture: BacklinkDomainRow = {
  archived_at: null,
  country_code: null,
  created_at: NOW,
  created_by: ACTOR_ID,
  display_name: "Example",
  domain_key: "BK-0001",
  editorial_category: null,
  editorial_compatibility: null,
  estimated_difficulty: null,
  hostname: "example.com",
  id: DOMAIN_ID,
  lifecycle_status: "active",
  primary_language: "en",
  region: null,
  updated_at: NOW,
  workspace_id: WORKSPACE_ID,
};

const previewInputFixture: BacklinkCampaignEnginePreviewInputV1 = {
  version: 1,
  workspaceId: WORKSPACE_ID,
  runId: RUN_ID,
  mode: "preview",
  source: "automation_campaign",
  campaign: {
    campaignId: CAMPAIGN_ID,
    campaignKey: "campaign-key",
    name: "Campaign",
    objective: "Build links",
    status: "draft",
  },
  opportunities: [
    {
      opportunityId: OPPORTUNITY_ID,
      opportunityKey: "opportunity-key",
      domainId: DOMAIN_ID,
      domain: "example.com",
      targetPageUrl: "https://example.com/guide",
      title: "Guide",
      priority: "Tier A",
      qualificationStatus: "Qualified",
      editorialStatus: "Ready for Contact",
      lifecycleStatus: "active",
    },
  ],
  requestedLimits: {
    maxSelectedOpportunities: 5,
    maxPerDomain: 2,
  },
};

function buildPreviewInputResult(): BuildBacklinkCampaignEnginePreviewInputResult {
  return {
    campaign: campaignFixture,
    opportunities: [opportunityFixture],
    domains: [domainFixture],
    previewInput: {
      ...previewInputFixture,
      campaign: { ...previewInputFixture.campaign },
      opportunities: previewInputFixture.opportunities.map((opportunity) => ({
        ...opportunity,
      })),
      requestedLimits: { ...previewInputFixture.requestedLimits },
    },
  };
}

function buildTask(input: Json): AutomationTask {
  return {
    id: TASK_ID,
    workspaceId: WORKSPACE_ID,
    runId: RUN_ID,
    dependsOnTaskId: null,
    system: "backlinks",
    taskKind: "backlinks.campaign.preview",
    taskKey: "campaign-preview",
    status: "running",
    priority: 40,
    scheduledAt: "2026-08-03T10:00:00.000Z",
    availableAt: "2026-08-03T10:00:00.000Z",
    claimedAt: "2026-08-03T10:00:00.000Z",
    startedAt: "2026-08-03T10:00:00.000Z",
    heartbeatAt: "2026-08-03T10:00:00.000Z",
    leaseExpiresAt: "2026-08-03T10:02:00.000Z",
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    workerId: "smoke",
    attemptCount: 1,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input,
    output: null,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-03T10:00:00.000Z",
    updatedAt: "2026-08-03T10:00:00.000Z",
  };
}

async function main(): Promise<void> {
  const taskInput = {
    version: 1,
    campaignId: "00000000-0000-4000-8000-000000000010",
    source: "automation_campaign" as const,
    opportunityIds: ["00000000-0000-4000-8000-000000000011"],
    requestedLimits: {
      maxSelectedOpportunities: 5,
      maxPerDomain: 2,
    },
  };
  const task = buildTask(taskInput);

  const validated = validateBacklinkCampaignEngineTaskInput(taskInput);
  assert(validated.campaignId === taskInput.campaignId, "Task input validation should preserve campaign id");

  const result = await executeBacklinkCampaignEngineTaskHandler(
    {
      workspaceId: task.workspaceId,
      runId: task.runId,
      task,
    },
    {
      buildPreviewInput: async () => buildPreviewInputResult(),
      policy: DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
    },
  );
  assert(result.summary.selected === 1, "Campaign task should yield a selected opportunity");

  const invalidTask = buildTask({
    version: 2,
    campaignId: "not-a-uuid",
    source: "automation_campaign",
    opportunityIds: [],
    requestedLimits: { maxSelectedOpportunities: 0, maxPerDomain: 0 },
  });
  try {
    validateBacklinkCampaignEngineTaskInput(invalidTask.input);
    throw new Error("Expected validation failure");
  } catch (error) {
    assert(
      error instanceof BacklinkCampaignEngineTaskValidationError,
      "Invalid task input should use the expected validation error",
    );
    assert(
      error.code === "INVALID_CAMPAIGN_ENGINE_TASK_INPUT",
      "Invalid task input should be rejected",
    );
  }

  const dryRunHandlers = createDryRunAutomationTaskHandlers({
    providers: {},
    buildCampaignPreviewInput: async () => buildPreviewInputResult(),
    campaignPolicy: DEFAULT_BACKLINK_CAMPAIGN_ENGINE_POLICY_V1,
  });
  const registryResult = await dryRunHandlers.execute({
    workspaceId: task.workspaceId,
    runId: task.runId,
    taskId: task.id,
    taskKind: "backlinks.campaign.preview",
    input: task.input as ExecuteAutomationTaskHandlerInput["input"],
    attemptedAt: task.startedAt ?? task.createdAt,
    task,
  });
  const registryOutput =
    validateBacklinkCampaignEnginePreviewOutput(registryResult.output);

  assert(
    registryOutput.campaignId === CAMPAIGN_ID,
    "Dry-run registry should return the Campaign Preview output",
  );
  assert(
    registryOutput.workspaceId === WORKSPACE_ID,
    "Dry-run registry should preserve the task workspace",
  );
  assert(
    registryOutput.runId === RUN_ID,
    "Dry-run registry should preserve the task run",
  );
  assert(
    registryOutput.summary.selected === 1,
    "Dry-run registry should execute the real Campaign handler",
  );
  assert(
    !Object.prototype.hasOwnProperty.call(registryOutput, "kind") &&
      !Object.prototype.hasOwnProperty.call(registryOutput, "dryRun"),
    "Campaign Preview output must not use the obsolete wrapper",
  );

  console.log("PASS — Campaign preview task handler smoke");
}

void main();

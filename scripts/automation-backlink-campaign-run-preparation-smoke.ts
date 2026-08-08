import { prepareBacklinkCampaignPreviewRun } from "../lib/automation/backlink-campaign-run-preparation";
import type {
  PrepareBacklinkCampaignPreviewRunDependencies,
  PrepareBacklinkCampaignPreviewRunInput,
} from "../lib/automation/backlink-campaign-run-preparation-types";
import type {
  CreateAutomationRunResult,
  CreateAutomationTaskResult,
} from "../lib/automation/types";
import { validateBacklinkCampaignEngineTaskInput } from "../lib/automation/backlink-campaign-engine-task-validation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createMockDependencies(
  runResult: CreateAutomationRunResult,
  taskResult?: CreateAutomationTaskResult,
): PrepareBacklinkCampaignPreviewRunDependencies {
  return {
    createRun: async () => runResult,
    createTask: async () => {
      if (!taskResult) {
        throw new Error("createTask should not be called");
      }
      return taskResult;
    },
  };
}

function buildInput(): PrepareBacklinkCampaignPreviewRunInput {
  return {
    workspaceId: "00000000-0000-4000-8000-000000000001",
    requestedBy: "00000000-0000-4000-8000-000000000003",
    idempotencyKey: "campaign-preview-123",
    triggerSource: "manual",
    scheduledAt: "2026-08-05T10:00:00.000Z",
    campaignTaskInput: {
      version: 1,
      campaignId: "00000000-0000-4000-8000-000000000010",
      source: "automation_campaign",
      opportunityIds: ["00000000-0000-4000-8000-000000000011"],
      requestedLimits: {
        maxSelectedOpportunities: 5,
        maxPerDomain: 2,
      },
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);

    for (const nestedValue of Object.values(
      value as Record<string, unknown>,
    )) {
      deepFreeze(nestedValue);
    }
  }

  return value;
}

async function main(): Promise<void> {
  const input = buildInput();
  validateBacklinkCampaignEngineTaskInput(input.campaignTaskInput);

  const runCreated: CreateAutomationRunResult = {
    kind: "created" as const,
    run: {
      id: "00000000-0000-4000-8000-000000000002",
      workspaceId: input.workspaceId,
      system: "backlinks",
      runKind: "backlinks.campaign.preview",
      idempotencyKey: input.idempotencyKey,
      status: "queued" as const,
      mode: "dry_run",
      triggerSource: input.triggerSource,
      requestedBy: input.requestedBy,
      scheduledAt: input.scheduledAt,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      heartbeatAt: null,
      leaseExpiresAt: null,
      workerId: null,
      attemptCount: 0,
      maxAttempts: 3,
      input: { campaign: input.campaignTaskInput },
      summary: null,
      errorCode: null,
      errorMessage: null,
      createdAt: input.scheduledAt,
      updatedAt: input.scheduledAt,
    },
  };

  const taskExisting: CreateAutomationTaskResult = {
    kind: "existing" as const,
    task: {
      id: "00000000-0000-4000-8000-000000000004",
      workspaceId: input.workspaceId,
      runId: runCreated.run.id,
      dependsOnTaskId: null,
      system: "backlinks",
      taskKind: "backlinks.campaign.preview",
      taskKey: "campaign-preview",
      status: "queued" as const,
      priority: 100,
      scheduledAt: input.scheduledAt,
      availableAt: input.scheduledAt,
      claimedAt: null,
      startedAt: null,
      heartbeatAt: null,
      leaseExpiresAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      workerId: null,
      attemptCount: 0,
      maxAttempts: 3,
      backoffBaseSeconds: 60,
      input: input.campaignTaskInput,
      output: null,
      errorCode: null,
      errorMessage: null,
      createdAt: input.scheduledAt,
      updatedAt: input.scheduledAt,
    },
  };

  const taskCreated: CreateAutomationTaskResult = {
    kind: "created" as const,
    task: { ...taskExisting.task, id: "00000000-0000-4000-8000-000000000005" },
  };

  const nominal = await prepareBacklinkCampaignPreviewRun(
    createMockDependencies(runCreated, taskCreated),
    input,
  );

  assert(nominal.kind === "prepared", "Nominal result must be prepared");
  assert(nominal.run === runCreated.run, "run reference must be preserved");
  assert(nominal.task === taskCreated.task, "task reference must be preserved");
  assert(nominal.runDisposition === "created", "runDisposition must be created");
  assert(nominal.taskDisposition === "created", "taskDisposition must be created");
  assert(nominal.task.dependsOnTaskId === null, "dependsOnTaskId must be null");
  assert(nominal.task.taskKind === "backlinks.campaign.preview", "taskKind must be backlinks.campaign.preview");
  assert(nominal.task.taskKey === "campaign-preview", "taskKey must be campaign-preview");
  assert(nominal.task.priority === 100, "task priority must be 100");
  assert(nominal.task.scheduledAt === input.scheduledAt, "task scheduledAt must match input");
  assert(nominal.task.availableAt === input.scheduledAt, "task availableAt must equal scheduledAt");
  assert(nominal.run.input === runCreated.run.input, "run input reference must be preserved");
  const nominalRunInput = nominal.run.input;

  assert(
    typeof nominalRunInput === "object" &&
      nominalRunInput !== null &&
      !Array.isArray(nominalRunInput),
    "run input must be a JSON object",
  );
  assert(
    nominalRunInput.campaign === input.campaignTaskInput,
    "run input campaign reference must be preserved",
  );
  assert(nominal.task.input === input.campaignTaskInput, "task input reference must be preserved");

  const createdExisting = await prepareBacklinkCampaignPreviewRun(
    createMockDependencies(runCreated, taskExisting),
    input,
  );
  assert(createdExisting.kind === "prepared", "Result must be prepared for created run existing task");
  assert(createdExisting.taskDisposition === "existing", "taskDisposition must be existing");

  const existingRun: CreateAutomationRunResult = {
    kind: "existing" as const,
    run: { ...runCreated.run, idempotencyKey: input.idempotencyKey },
  };
  const createdTaskWithExistingRun = await prepareBacklinkCampaignPreviewRun(
    createMockDependencies(existingRun, taskCreated),
    input,
  );
  assert(createdTaskWithExistingRun.kind === "prepared", "Result must be prepared for existing run created task");
  assert(createdTaskWithExistingRun.runDisposition === "existing", "runDisposition must be existing");

  const existingBoth = await prepareBacklinkCampaignPreviewRun(
    createMockDependencies(existingRun, taskExisting),
    input,
  );
  assert(existingBoth.kind === "prepared", "Result must be prepared for existing run existing task");
  assert(existingBoth.taskDisposition === "existing", "taskDisposition must be existing");

  const rejectedRun = { kind: "rejected" as const, reason: "automation_disabled" as const };
  const rejectedResult = await prepareBacklinkCampaignPreviewRun(createMockDependencies(rejectedRun), input);
  assert(rejectedResult.kind === "rejected", "Rejected run must return rejected");
  assert(rejectedResult.reason === "automation_disabled", "Rejected reason must be automation_disabled");

  const invalidInput = { ...input, idempotencyKey: " " } as PrepareBacklinkCampaignPreviewRunInput;
  try {
    await prepareBacklinkCampaignPreviewRun(createMockDependencies(runCreated, taskCreated), invalidInput);
    throw new Error("Expected invalid input to reject");
  } catch (error) {
    assert(error instanceof Error, "Invalid input must throw an error");
  }

  const noTaskCallDependencies: PrepareBacklinkCampaignPreviewRunDependencies = {
    createRun: async () => rejectedRun,
    createTask: async () => {
      throw new Error("createTask must not be called");
    },
  };
  await prepareBacklinkCampaignPreviewRun(noTaskCallDependencies, input);

  const frozenInput = deepFreeze(input);
  await prepareBacklinkCampaignPreviewRun(createMockDependencies(runCreated, taskExisting), frozenInput);

  console.log("PASS — Automation backlink campaign run preparation smoke");
}

void main();

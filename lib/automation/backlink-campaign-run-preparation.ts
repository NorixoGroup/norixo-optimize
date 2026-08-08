import type { Json } from "@/types/database.types";
import { buildBacklinkCampaignRunPlan } from "./backlink-campaign-run-plan";
import { validateBacklinkCampaignEngineTaskInput } from "./backlink-campaign-engine-task-validation";
import { BacklinkCampaignRunPreparationError } from "./backlink-campaign-run-preparation-types";
import type {
  PrepareBacklinkCampaignPreviewRunDependencies,
  PrepareBacklinkCampaignPreviewRunInput,
  PrepareBacklinkCampaignPreviewRunResult,
} from "./backlink-campaign-run-preparation-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRIGGER_SOURCES = ["manual", "scheduled", "internal"] as const;
const BACKLINK_CAMPAIGN_RUN_KIND = "backlinks.campaign.preview" as const;

function assertUuid(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid UUID`);
  }
}

function assertNonEmptyTrimmed(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim() || value.length > 255) {
    throw new Error(`${name} must be trimmed and at most 255 characters`);
  }
}

function assertTriggerSource(value: unknown): asserts value is "manual" | "scheduled" | "internal" {
  if (value !== "manual" && value !== "scheduled" && value !== "internal") {
    throw new Error("triggerSource must be valid");
  }
}

function assertDateString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${name} must be a valid date`);
  }
}

function validateInput(input: PrepareBacklinkCampaignPreviewRunInput): void {
  assertUuid(input.workspaceId, "workspaceId");
  if (input.requestedBy !== null) {
    assertUuid(input.requestedBy, "requestedBy");
  }
  assertNonEmptyTrimmed(input.idempotencyKey, "idempotencyKey");
  assertTriggerSource(input.triggerSource);
  assertDateString(input.scheduledAt, "scheduledAt");
  validateBacklinkCampaignEngineTaskInput(input.campaignTaskInput);
}

function assertRunInvariant(run: { id: string; workspaceId: string; system: string; runKind: string; idempotencyKey: string; mode: string }, input: PrepareBacklinkCampaignPreviewRunInput): void {
  if (
    !UUID_PATTERN.test(run.id) ||
    run.workspaceId !== input.workspaceId ||
    run.system !== "backlinks" ||
    run.runKind !== BACKLINK_CAMPAIGN_RUN_KIND ||
    run.idempotencyKey !== input.idempotencyKey ||
    run.mode !== "dry_run"
  ) {
    throw new BacklinkCampaignRunPreparationError();
  }
}

function assertTaskInvariant(task: { id: string; workspaceId: string; runId: string; system: string; taskKind: string; taskKey: string; dependsOnTaskId: string | null }, runId: string, input: PrepareBacklinkCampaignPreviewRunInput): void {
  if (
    !UUID_PATTERN.test(task.id) ||
    task.workspaceId !== input.workspaceId ||
    task.runId !== runId ||
    task.system !== "backlinks" ||
    task.taskKind !== BACKLINK_CAMPAIGN_RUN_KIND ||
    task.taskKey !== "campaign-preview" ||
    task.dependsOnTaskId !== null
  ) {
    throw new BacklinkCampaignRunPreparationError();
  }
}

export async function prepareBacklinkCampaignPreviewRun(
  dependencies: PrepareBacklinkCampaignPreviewRunDependencies,
  input: PrepareBacklinkCampaignPreviewRunInput,
): Promise<PrepareBacklinkCampaignPreviewRunResult> {
  validateInput(input);

  const createdRun = await dependencies.createRun({
    workspaceId: input.workspaceId,
    system: "backlinks",
    runKind: BACKLINK_CAMPAIGN_RUN_KIND,
    idempotencyKey: input.idempotencyKey,
    mode: "dry_run",
    triggerSource: input.triggerSource,
    requestedBy: input.requestedBy,
    scheduledAt: input.scheduledAt,
    input: { campaign: input.campaignTaskInput },
  });

  if (createdRun.kind === "rejected") {
    return createdRun;
  }

  assertRunInvariant(createdRun.run, input);

  const plan = buildBacklinkCampaignRunPlan({
    workspaceId: input.workspaceId,
    runId: createdRun.run.id,
    scheduledAt: input.scheduledAt,
    campaignTaskInput: input.campaignTaskInput,
  });

  if (plan.tasks.length !== 1) {
    throw new BacklinkCampaignRunPreparationError();
  }

  const plannedTask = plan.tasks[0];
  if (
    plannedTask.workspaceId !== input.workspaceId ||
    plannedTask.runId !== createdRun.run.id ||
    plannedTask.taskKind !== BACKLINK_CAMPAIGN_RUN_KIND ||
    plannedTask.taskKey !== "campaign-preview" ||
    plannedTask.dependsOnTaskKey !== null ||
    plannedTask.input !== input.campaignTaskInput
  ) {
    throw new BacklinkCampaignRunPreparationError();
  }

  const createdTask = await dependencies.createTask({
    workspaceId: plannedTask.workspaceId,
    runId: plannedTask.runId,
    dependsOnTaskId: null,
    system: "backlinks",
    taskKind: plannedTask.taskKind,
    taskKey: plannedTask.taskKey,
    priority: plannedTask.priority,
    scheduledAt: plannedTask.scheduledAt,
    availableAt: plannedTask.availableAt,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: plannedTask.input,
  });

  assertTaskInvariant(createdTask.task, createdRun.run.id, input);

  return {
    kind: "prepared",
    run: createdRun.run,
    runDisposition: createdRun.kind,
    task: createdTask.task,
    taskDisposition: createdTask.kind,
  };
}

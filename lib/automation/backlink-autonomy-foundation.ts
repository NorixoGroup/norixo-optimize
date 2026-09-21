import type { Json } from "@/types/database.types";
import type { CreateAutomationTaskInput, CreateAutomationTaskResult } from "./types";

export type BacklinkContactResolutionTaskKind = "backlinks.contact_resolution";
export type BacklinkContactValidationTaskKind = "backlinks.contact_validation";
export type BacklinkDownstreamTaskKind = "backlinks.campaign_prepare" | "backlinks.draft_prepare" | "backlinks.outreach_decision";

/**
 * Produces an idempotent task request only. The handler is intentionally not
 * registered with the production worker or any scheduler in this phase.
 */
export function buildContactResolutionTask(input: {
  workspaceId: string;
  runId: string;
  dependsOnTaskId?: string | null;
  domainId: string;
  opportunityId: string;
  actorUserId: string;
  scheduledAt: string;
  promotionProvenance?: {
    promotionApplicationId: string;
    promotionRunId: string;
    promotionTaskId: string;
  };
}): CreateAutomationTaskInput {
  return {
    workspaceId: input.workspaceId,
    runId: input.runId,
    dependsOnTaskId: input.dependsOnTaskId,
    system: "backlinks",
    taskKind: "backlinks.contact_resolution",
    taskKey: `contact-resolution:${input.opportunityId}:${input.domainId}`,
    priority: 40,
    scheduledAt: input.scheduledAt,
    availableAt: input.scheduledAt,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: {
      version: 1,
      domainId: input.domainId,
      opportunityId: input.opportunityId,
      actorUserId: input.actorUserId,
      ...(input.promotionProvenance == null ? {} : input.promotionProvenance),
    } as Json,
  };
}

export async function enqueueContactResolutionTask(
  createTask: (input: CreateAutomationTaskInput) => Promise<CreateAutomationTaskResult>,
  input: Parameters<typeof buildContactResolutionTask>[0],
): Promise<CreateAutomationTaskResult> {
  return createTask(buildContactResolutionTask(input));
}

/** Pure descriptor builder; validation tasks are not enqueued by this module. */
export function buildContactValidationTask(input: {
  workspaceId: string;
  runId: string;
  dependsOnTaskId: string;
  domainId: string;
  opportunityId: string;
  contactId: string;
  scheduledAt: string;
}): CreateAutomationTaskInput {
  return {
    workspaceId: input.workspaceId,
    runId: input.runId,
    dependsOnTaskId: input.dependsOnTaskId,
    system: "backlinks",
    taskKind: "backlinks.contact_validation",
    taskKey: `contact-validation:${input.opportunityId}:${input.contactId}`,
    priority: 40,
    scheduledAt: input.scheduledAt,
    availableAt: input.scheduledAt,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: { version: 1, domainId: input.domainId, opportunityId: input.opportunityId, contactId: input.contactId } as Json,
  };
}

export function buildContactValidationTasksForResolution(input: {
  workspaceId: string;
  runId: string;
  resolutionTaskId: string;
  domainId: string;
  opportunityId: string;
  contactIds: readonly string[];
  scheduledAt: string;
}): CreateAutomationTaskInput[] {
  return [...new Set(input.contactIds)].map((contactId) => buildContactValidationTask({
    workspaceId: input.workspaceId,
    runId: input.runId,
    dependsOnTaskId: input.resolutionTaskId,
    domainId: input.domainId,
    opportunityId: input.opportunityId,
    contactId,
    scheduledAt: input.scheduledAt,
  }));
}

function buildDownstreamTask(input: {
  workspaceId: string;
  runId: string;
  dependsOnTaskId: string;
  domainId: string;
  opportunityId: string;
  contactId: string;
  scheduledAt: string;
  taskKind: BacklinkDownstreamTaskKind;
  taskKeyPrefix: string;
}): CreateAutomationTaskInput {
  return {
    workspaceId: input.workspaceId,
    runId: input.runId,
    dependsOnTaskId: input.dependsOnTaskId,
    system: "backlinks",
    taskKind: input.taskKind,
    taskKey: `${input.taskKeyPrefix}:${input.opportunityId}:${input.contactId}`,
    priority: 50,
    scheduledAt: input.scheduledAt,
    availableAt: input.scheduledAt,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: { version: 1, domainId: input.domainId, opportunityId: input.opportunityId, contactId: input.contactId } as Json,
  };
}

export function buildCampaignPrepareTask(input: Omit<Parameters<typeof buildDownstreamTask>[0], "taskKind" | "taskKeyPrefix">): CreateAutomationTaskInput {
  return buildDownstreamTask({ ...input, taskKind: "backlinks.campaign_prepare", taskKeyPrefix: "campaign-prepare" });
}

export function buildDraftPrepareTask(input: Omit<Parameters<typeof buildDownstreamTask>[0], "taskKind" | "taskKeyPrefix">): CreateAutomationTaskInput {
  return buildDownstreamTask({ ...input, taskKind: "backlinks.draft_prepare", taskKeyPrefix: "draft-prepare" });
}

export function buildOutreachDecisionTask(input: Omit<Parameters<typeof buildDownstreamTask>[0], "taskKind" | "taskKeyPrefix">): CreateAutomationTaskInput {
  return buildDownstreamTask({ ...input, taskKind: "backlinks.outreach_decision", taskKeyPrefix: "outreach-decision" });
}

import type { Json } from "@/types/database.types";
import { createHash } from "node:crypto";
import type { CreateAutomationTaskInput, CreateAutomationTaskResult } from "./types";

export type BacklinkContactResolutionTaskKind = "backlinks.contact_resolution";
export type BacklinkContactValidationTaskKind = "backlinks.contact_validation";
export type BacklinkMailboxVerificationTaskKind = "backlinks.mailbox_verification";
export type BacklinkContactFormPrepareTaskKind = "backlinks.contact_form_prepare";
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

/**
 * The task key contains only an email fingerprint. The canonical normalized
 * email remains in the minimal task input because the coordinator must detect
 * a stale contact email before it can call a provider.
 */
export function buildMailboxVerificationTask(input: {
  workspaceId: string;
  runId: string;
  dependsOnTaskId: string;
  domainId: string;
  opportunityId: string;
  contactId: string;
  currentNormalizedEmail: string;
  scheduledAt: string;
}): CreateAutomationTaskInput {
  const emailFingerprint = createHash("sha256").update(input.currentNormalizedEmail, "utf8").digest("hex");
  return {
    workspaceId: input.workspaceId,
    runId: input.runId,
    dependsOnTaskId: input.dependsOnTaskId,
    system: "backlinks",
    taskKind: "backlinks.mailbox_verification",
    taskKey: `mailbox-verification:${input.opportunityId}:${input.contactId}:${emailFingerprint}`,
    priority: 45,
    scheduledAt: input.scheduledAt,
    availableAt: input.scheduledAt,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: {
      version: 1,
      domainId: input.domainId,
      opportunityId: input.opportunityId,
      contactId: input.contactId,
      currentNormalizedEmail: input.currentNormalizedEmail,
    } as Json,
  };
}

/** A closed handoff to the canonical human approval/queue contract. */
export function buildContactFormPrepareTask(input: {
  workspaceId: string;
  runId: string;
  dependsOnTaskId: string;
  domainId: string;
  opportunityId: string;
  contactId: string;
  outreachId: string;
  scheduledAt: string;
}): CreateAutomationTaskInput {
  return {
    workspaceId: input.workspaceId,
    runId: input.runId,
    dependsOnTaskId: input.dependsOnTaskId,
    system: "backlinks",
    taskKind: "backlinks.contact_form_prepare",
    taskKey: `contact-form-prepare:${input.outreachId}`,
    priority: 60,
    scheduledAt: input.scheduledAt,
    availableAt: input.scheduledAt,
    maxAttempts: 1,
    backoffBaseSeconds: 60,
    input: {
      version: 1,
      domainId: input.domainId,
      opportunityId: input.opportunityId,
      contactId: input.contactId,
      outreachId: input.outreachId,
      executionKind: "contact_form_worker",
    } as Json,
  };
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

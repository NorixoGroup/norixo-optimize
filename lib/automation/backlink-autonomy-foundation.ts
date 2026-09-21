import type { Json } from "@/types/database.types";
import type { CreateAutomationTaskInput, CreateAutomationTaskResult } from "./types";

export type BacklinkAutonomyFoundationTaskKind = "backlinks.contact_resolution.disabled";

/**
 * Produces an idempotent task request only. No worker, route, cron, persistence,
 * contact mutation, form submission, or provider invocation is introduced here.
 */
export function buildDisabledContactResolutionTask(input: {
  workspaceId: string;
  runId: string;
  dependsOnTaskId: string;
  domainId: string;
  opportunityId: string;
  scheduledAt: string;
}): CreateAutomationTaskInput {
  return {
    workspaceId: input.workspaceId,
    runId: input.runId,
    dependsOnTaskId: input.dependsOnTaskId,
    system: "backlinks",
    taskKind: "backlinks.contact_resolution.disabled",
    taskKey: `contact-resolution:${input.opportunityId}:${input.domainId}`,
    priority: 40,
    scheduledAt: input.scheduledAt,
    availableAt: input.scheduledAt,
    maxAttempts: 3,
    backoffBaseSeconds: 60,
    input: { version: 1, disabled: true, domainId: input.domainId, opportunityId: input.opportunityId } as Json,
  };
}

export async function enqueueDisabledContactResolutionTask(
  createTask: (input: CreateAutomationTaskInput) => Promise<CreateAutomationTaskResult>,
  input: Parameters<typeof buildDisabledContactResolutionTask>[0],
): Promise<CreateAutomationTaskResult> {
  return createTask(buildDisabledContactResolutionTask(input));
}

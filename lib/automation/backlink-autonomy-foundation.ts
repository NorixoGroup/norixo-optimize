import type { Json } from "@/types/database.types";
import type { CreateAutomationTaskInput, CreateAutomationTaskResult } from "./types";

export type BacklinkContactResolutionTaskKind = "backlinks.contact_resolution";

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
    input: { version: 1, domainId: input.domainId, opportunityId: input.opportunityId, actorUserId: input.actorUserId } as Json,
  };
}

export async function enqueueContactResolutionTask(
  createTask: (input: CreateAutomationTaskInput) => Promise<CreateAutomationTaskResult>,
  input: Parameters<typeof buildContactResolutionTask>[0],
): Promise<CreateAutomationTaskResult> {
  return createTask(buildContactResolutionTask(input));
}

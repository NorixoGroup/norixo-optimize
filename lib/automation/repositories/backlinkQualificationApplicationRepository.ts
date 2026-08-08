import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import { getAutomationTaskByIdInRun } from "./automationTasksRepository";
import { getBacklinkOpportunityById, updateBacklinkOpportunity } from "@/lib/backlinks/repositories/opportunitiesRepository";
import type { BacklinkQualificationPreviewOutputV1, BacklinkQualificationPreviewInputV1 } from "../backlink-qualification-types";
import { BacklinkQualificationApplyServiceError } from "../backlink-qualification-application-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQualificationPreviewOutput(value: unknown): value is BacklinkQualificationPreviewOutputV1 {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (value.kind !== "backlinks.qualification.preview") return false;
  if (value.dryRun !== true) return false;
  if (!Array.isArray((value as any).results)) return false;
  return true;
}

function isQualificationPreviewInput(value: unknown): value is BacklinkQualificationPreviewInputV1 {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (value.source !== "automation_discovery") return false;
  if (value.policyVersion !== "backlink-qualification-v1") return false;
  if (!Array.isArray((value as any).candidates)) return false;
  return true;
}

export async function readCompletedQualificationTask(
  client: BacklinkRepositoryClient,
  input: { workspaceId: string; runId: string; taskId: string },
): Promise<{ input: BacklinkQualificationPreviewInputV1; output: BacklinkQualificationPreviewOutputV1 }> {
  const task = await getAutomationTaskByIdInRun(client, { workspaceId: input.workspaceId, runId: input.runId, taskId: input.taskId });
  if (task === null) {
    throw new BacklinkQualificationApplyServiceError(
      "QUALIFICATION_PREVIEW_TASK_NOT_FOUND",
      "Qualification preview task not found",
    );
  }
  if (task.workspaceId !== input.workspaceId || task.runId !== input.runId) {
    throw new BacklinkQualificationApplyServiceError(
      "QUALIFICATION_PREVIEW_SCOPE_MISMATCH",
      "Qualification preview task scope mismatch",
    );
  }
  if (task.status !== "completed") {
    throw new BacklinkQualificationApplyServiceError(
      "QUALIFICATION_PREVIEW_TASK_NOT_COMPLETED",
      "Qualification preview task is not completed",
    );
  }
  if (task.taskKind !== "backlinks.qualification.preview") {
    throw new BacklinkQualificationApplyServiceError(
      "QUALIFICATION_PREVIEW_TASK_KIND_INVALID",
      "Qualification preview task kind is invalid",
    );
  }
  if (!isQualificationPreviewOutput(task.output)) {
    throw new BacklinkQualificationApplyServiceError(
      "QUALIFICATION_PREVIEW_OUTPUT_INVALID",
      "Qualification preview output is invalid",
    );
  }
  if (!isQualificationPreviewInput(task.input)) {
    throw new BacklinkQualificationApplyServiceError(
      "QUALIFICATION_PREVIEW_OUTPUT_INVALID",
      "Qualification task input is invalid",
    );
  }

  return { input: task.input as BacklinkQualificationPreviewInputV1, output: task.output as BacklinkQualificationPreviewOutputV1 };
}

export async function getOpportunityRow(
  client: BacklinkRepositoryClient,
  workspaceId: string,
  opportunityId: string,
) {
  try {
    return await getBacklinkOpportunityById(client, workspaceId, opportunityId);
  } catch (error) {
    // Normalize repository not-found into a domain error
    throw new BacklinkQualificationApplyServiceError(
      "QUALIFICATION_OPPORTUNITY_NOT_FOUND",
      "Opportunity not found",
    );
  }
}

export async function updateOpportunityQualificationStatusRow(
  client: BacklinkRepositoryClient,
  workspaceId: string,
  opportunityId: string,
  qualificationStatus: string,
) {
  return updateBacklinkOpportunity(client, workspaceId, opportunityId, { qualification_status: qualificationStatus });
}

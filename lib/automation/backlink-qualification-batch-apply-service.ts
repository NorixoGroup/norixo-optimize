import {
  applyQualificationFromValidatedPreview,
  validateQualificationPreview,
} from "./backlink-qualification-apply-service";
import { BacklinkQualificationApplyServiceError } from "./backlink-qualification-application-types";
import type { ApplyQualificationInput } from "./backlink-qualification-application-types";
import {
  BACKLINK_QUALIFICATION_BATCH_MAX_ITEMS,
  BacklinkQualificationBatchApplyServiceError,
  type ApplyQualificationBatchDependencies,
  type ApplyQualificationBatchInput,
  type ApplyQualificationBatchItemResult,
  type ApplyQualificationBatchResult,
} from "./backlink-qualification-batch-application-types";

export async function applyBacklinkQualificationBatch(
  deps: ApplyQualificationBatchDependencies,
  input: ApplyQualificationBatchInput,
): Promise<ApplyQualificationBatchResult> {
  validateInput(input);

  const task = await deps.readQualificationTask(input);
  const preview = validateQualificationPreview(task);
  const mappings = preview.discoveryTaskId
    ? await deps.listDiscoveryIntakeApplications({
        workspaceId: input.workspaceId,
        discoveryTaskId: preview.discoveryTaskId,
      })
    : [];
  const mappingsByCandidateKey = new Map<string, { opportunityId: string }[]>();
  for (const mapping of mappings) {
    const values = mappingsByCandidateKey.get(mapping.candidateKey) ?? [];
    values.push({ opportunityId: mapping.opportunityId });
    mappingsByCandidateKey.set(mapping.candidateKey, values);
  }

  const items: ApplyQualificationBatchItemResult[] = [];
  for (const opportunityId of input.opportunityIds) {
    const itemInput: ApplyQualificationInput = {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      runId: input.runId,
      taskId: input.taskId,
      opportunityId,
    };
    try {
      const result = await applyQualificationFromValidatedPreview(
        deps,
        itemInput,
        preview,
        preview.discoveryTaskId
          ? async (candidateKey) => mappingsByCandidateKey.get(candidateKey) ?? []
          : undefined,
      );
      items.push({
        opportunityId: result.opportunityId,
        candidateKey: result.candidateKey ?? null,
        decision: result.decision,
        previousQualificationStatus: result.previousQualificationStatus,
        qualificationStatus: result.qualificationStatus,
        disposition: result.disposition,
        reasonCode: result.reasonCode,
      });
    } catch (error) {
      items.push(failedItem(opportunityId, error));
    }
  }

  return {
    runId: input.runId,
    taskId: input.taskId,
    total: items.length,
    updated: items.filter((item) => item.disposition === "updated").length,
    existing: items.filter((item) => item.disposition === "existing").length,
    notApplicable: items.filter((item) => item.disposition === "not_applicable").length,
    failed: items.filter((item) => item.disposition === "failed").length,
    items,
  };
}

function validateInput(input: ApplyQualificationBatchInput): void {
  if (
    !isNonEmptyString(input.workspaceId) ||
    !isNonEmptyString(input.actorUserId) ||
    !isNonEmptyString(input.runId) ||
    !isNonEmptyString(input.taskId) ||
    !Array.isArray(input.opportunityIds) ||
    input.opportunityIds.length === 0
  ) {
    throw new BacklinkQualificationBatchApplyServiceError("QUALIFICATION_BATCH_INPUT_INVALID");
  }
  if (input.opportunityIds.length > BACKLINK_QUALIFICATION_BATCH_MAX_ITEMS) {
    throw new BacklinkQualificationBatchApplyServiceError("QUALIFICATION_BATCH_TOO_MANY_OPPORTUNITIES");
  }
  const seen = new Set<string>();
  for (const opportunityId of input.opportunityIds) {
    if (!isNonEmptyString(opportunityId)) {
      throw new BacklinkQualificationBatchApplyServiceError("QUALIFICATION_BATCH_INPUT_INVALID");
    }
    if (seen.has(opportunityId)) {
      throw new BacklinkQualificationBatchApplyServiceError("QUALIFICATION_BATCH_DUPLICATE_OPPORTUNITY_ID");
    }
    seen.add(opportunityId);
  }
}

function failedItem(opportunityId: string, error: unknown): ApplyQualificationBatchItemResult {
  const code = error instanceof BacklinkQualificationApplyServiceError
    ? error.code
    : "QUALIFICATION_APPLICATION_FAILED";
  const message = error instanceof BacklinkQualificationApplyServiceError
    ? safeQualificationMessage(error.code)
    : "Qualification could not be applied.";
  return {
    opportunityId,
    candidateKey: null,
    decision: null,
    previousQualificationStatus: null,
    qualificationStatus: null,
    disposition: "failed",
    error: { code, message },
  };
}

function safeQualificationMessage(code: BacklinkQualificationApplyServiceError["code"]): string {
  if (code === "QUALIFICATION_OPPORTUNITY_NOT_FOUND") return "Opportunity not found.";
  if (code === "QUALIFICATION_INTAKE_MAPPING_MISMATCH" || code === "QUALIFICATION_PREVIEW_OPPORTUNITY_MISMATCH") {
    return "Qualification preview does not match this opportunity.";
  }
  return "Qualification could not be applied.";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

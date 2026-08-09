import type { BacklinkQualificationPreviewInputV1, BacklinkQualificationPreviewOutputV1, BacklinkQualificationDecision } from "./backlink-qualification-types";
import type { ApplyQualificationInput, ApplyQualificationResult, ApplyServiceDependencies } from "./backlink-qualification-application-types";
import { BacklinkQualificationApplyServiceError } from "./backlink-qualification-application-types";

function mapDecisionToQualificationStatus(decision: BacklinkQualificationDecision): string | null {
  if (decision === "qualified") return "Qualified";
  if (decision === "review") return "Needs Review";
  // No persistent mapping for 'rejected' in domain migrations — handle as not applicable
  return null;
}

function assertValidInput(input: ApplyQualificationInput): void {
  if (!input || typeof input !== "object") throw new BacklinkQualificationApplyServiceError("QUALIFICATION_APPLY_INPUT_INVALID", "Invalid input");
  const record = input as Record<string, unknown>;
  for (const key of ["workspaceId", "runId", "taskId", "opportunityId", "actorUserId"]) {
    const value = record[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new BacklinkQualificationApplyServiceError("QUALIFICATION_APPLY_INPUT_INVALID", "Invalid input");
    }
  }
}

export async function applyBacklinkQualificationFromTask(
  deps: ApplyServiceDependencies<
    BacklinkQualificationPreviewInputV1,
    { id: string; target_page_url: string; qualification_status: string | null }
  >,
  input: ApplyQualificationInput,
): Promise<ApplyQualificationResult> {
  assertValidInput(input);

  const { workspaceId, runId, taskId, opportunityId } = input;

  // Read and validate the qualification preview task (input + output)
  const { input: taskInput, output: taskOutput, discoveryTaskId } = await deps.readQualificationTask({ workspaceId, runId, taskId });

  // Find which result in the preview corresponds to the requested opportunity
  // Match by candidateKey -> candidate.sourceUrl === opportunity.target_page_url
  const opportunity = await deps.getOpportunityById(workspaceId, opportunityId);
  if (opportunity == null) {
    throw new BacklinkQualificationApplyServiceError("QUALIFICATION_OPPORTUNITY_NOT_FOUND", "Opportunity not found");
  }

  const candidates = (taskInput as BacklinkQualificationPreviewInputV1).candidates;
  const results = (taskOutput as BacklinkQualificationPreviewOutputV1).results;

  if (
    !Array.isArray(candidates) ||
    !Array.isArray(results)
  ) {
    throw new BacklinkQualificationApplyServiceError(
      "QUALIFICATION_PREVIEW_OUTPUT_INVALID",
      "Qualification preview output is invalid",
    );
  }

  let matchedResultIndex: number | null = null;
  let hasPersistentMapping = false;
  if (discoveryTaskId && deps.listDiscoveryIntakeApplicationsForCandidate) {
    for (let i = 0; i < results.length; i += 1) {
      const mappings = await deps.listDiscoveryIntakeApplicationsForCandidate({ workspaceId, discoveryTaskId, candidateKey: results[i].candidateKey });
      if (mappings.length === 0) continue;
      hasPersistentMapping = true;
      if (mappings.some((mapping) => mapping.opportunityId === opportunityId)) {
        if (matchedResultIndex !== null) throw new BacklinkQualificationApplyServiceError("QUALIFICATION_PREVIEW_SCOPE_MISMATCH", "Multiple intake mappings match the opportunity");
        matchedResultIndex = i;
      }
    }
    if (hasPersistentMapping && matchedResultIndex === null) {
      throw new BacklinkQualificationApplyServiceError("QUALIFICATION_INTAKE_MAPPING_MISMATCH", "Qualification intake mapping does not concern the requested opportunity");
    }
  }
  if (!hasPersistentMapping) {
    for (let i = 0; i < results.length; i += 1) {
      const candidate = candidates.find((value) => value.candidateKey === results[i].candidateKey);
      if (candidate?.sourceUrl !== opportunity.target_page_url) continue;
      if (matchedResultIndex !== null) throw new BacklinkQualificationApplyServiceError("QUALIFICATION_PREVIEW_SCOPE_MISMATCH", "Multiple preview candidates match the opportunity");
      matchedResultIndex = i;
    }
  }

  if (matchedResultIndex === null) {
    throw new BacklinkQualificationApplyServiceError(
      "QUALIFICATION_PREVIEW_OPPORTUNITY_MISMATCH",
      "Qualification preview does not concern the requested opportunity",
    );
  }

  const matchedResult = results[matchedResultIndex];
  const decision = matchedResult.decision as BacklinkQualificationDecision;

  const targetQualificationStatus = mapDecisionToQualificationStatus(decision);
  if (targetQualificationStatus === null) {
    // No persistent mapping defined for 'rejected'
    return {
      opportunityId,
      runId,
      taskId,
      decision,
      previousQualificationStatus: opportunity.qualification_status ?? null,
      qualificationStatus: null,
      disposition: "not_applicable",
      reasonCode: "REJECTED_DECISION",
    };
  }

  const previous = opportunity.qualification_status ?? null;
  if (previous === "Blocked" || previous === "Not Suitable") {
    return {
      opportunityId,
      runId,
      taskId,
      decision,
      previousQualificationStatus: previous,
      qualificationStatus: previous,
      disposition: "not_applicable",
      reasonCode: "OPPORTUNITY_STATUS_PROTECTED",
    };
  }
  if (previous === targetQualificationStatus) {
    return {
      opportunityId,
      runId,
      taskId,
      decision,
      previousQualificationStatus: previous,
      qualificationStatus: targetQualificationStatus,
      disposition: "existing",
    };
  }

  // Perform the durable update (idempotent by design)
  const updated = await deps.updateOpportunityQualificationStatus(workspaceId, opportunityId, targetQualificationStatus);

  return {
    opportunityId,
    runId,
    taskId,
    decision,
    previousQualificationStatus: previous,
    qualificationStatus: updated.qualification_status ?? targetQualificationStatus,
    disposition: "updated",
  };
}

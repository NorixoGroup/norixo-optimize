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
  for (const key of ["workspaceId", "runId", "taskId", "opportunityId", "actorUserId"]) {
    if (typeof (input as any)[key] !== "string" || (input as any)[key].trim() === "") {
      throw new BacklinkQualificationApplyServiceError("QUALIFICATION_APPLY_INPUT_INVALID", "Invalid input");
    }
  }
}

export async function applyBacklinkQualificationFromTask(
  deps: ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, any>,
  input: ApplyQualificationInput,
): Promise<ApplyQualificationResult> {
  assertValidInput(input);

  const { workspaceId, runId, taskId, opportunityId } = input;

  // Read and validate the qualification preview task (input + output)
  const { input: taskInput, output: taskOutput } = await deps.readQualificationTask({ workspaceId, runId, taskId });

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
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const candidate = candidates.find((c) => c.candidateKey === result.candidateKey);
    if (!candidate) continue;
    if (candidate.sourceUrl === opportunity.target_page_url) {
      if (matchedResultIndex !== null) {
        throw new BacklinkQualificationApplyServiceError(
          "QUALIFICATION_PREVIEW_SCOPE_MISMATCH",
          "Multiple preview candidates match the opportunity",
        );
      }
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
    };
  }

  const previous = opportunity.qualification_status ?? null;
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

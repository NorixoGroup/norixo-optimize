import type { BacklinkQualificationPreviewInputV1, BacklinkQualificationPreviewOutputV1, BacklinkQualificationDecision } from "./backlink-qualification-types";
import type { ApplyQualificationInput, ApplyQualificationResult, ApplyServiceDependencies } from "./backlink-qualification-application-types";
import { BacklinkQualificationApplyServiceError } from "./backlink-qualification-application-types";

type QualificationOpportunity = {
  id: string;
  target_page_url: string;
  qualification_status: string | null;
};

export type ValidatedQualificationPreview = {
  input: BacklinkQualificationPreviewInputV1;
  output: BacklinkQualificationPreviewOutputV1;
  discoveryTaskId: string | null;
};

export type QualificationApplicationDependencies = Pick<
  ApplyServiceDependencies<BacklinkQualificationPreviewInputV1, QualificationOpportunity>,
  "getOpportunityById" | "updateOpportunityQualificationStatus"
>;

type MappingLoader = (candidateKey: string) => Promise<readonly { opportunityId: string }[]>;

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
  const task = await deps.readQualificationTask({ workspaceId, runId, taskId });
  const preview = validateQualificationPreview(task);

  return applyQualificationFromValidatedPreview(
    deps,
    input,
    preview,
    deps.listDiscoveryIntakeApplicationsForCandidate
      ? (candidateKey) => deps.listDiscoveryIntakeApplicationsForCandidate!({
          workspaceId,
          discoveryTaskId: preview.discoveryTaskId ?? "",
          candidateKey,
        })
      : undefined,
  );
}

export function validateQualificationPreview(
  task: { input: BacklinkQualificationPreviewInputV1; output: unknown; discoveryTaskId?: string | null },
): ValidatedQualificationPreview {
  if (!Array.isArray(task.input.candidates) || !isQualificationPreviewOutput(task.output)) {
    throw new BacklinkQualificationApplyServiceError(
      "QUALIFICATION_PREVIEW_OUTPUT_INVALID",
      "Qualification preview output is invalid",
    );
  }

  return {
    input: task.input,
    output: task.output,
    discoveryTaskId: task.discoveryTaskId ?? null,
  };
}

export async function applyQualificationFromValidatedPreview(
  deps: QualificationApplicationDependencies,
  input: ApplyQualificationInput,
  preview: ValidatedQualificationPreview,
  mappingLoader?: MappingLoader,
): Promise<ApplyQualificationResult> {
  const { workspaceId, runId, taskId, opportunityId } = input;

  // Find which result in the preview corresponds to the requested opportunity
  // Match by candidateKey -> candidate.sourceUrl === opportunity.target_page_url
  const opportunity = await deps.getOpportunityById(workspaceId, opportunityId);
  if (opportunity == null) {
    throw new BacklinkQualificationApplyServiceError("QUALIFICATION_OPPORTUNITY_NOT_FOUND", "Opportunity not found");
  }

  const candidates = preview.input.candidates;
  const results = preview.output.results;

  let matchedResultIndex: number | null = null;
  let hasPersistentMapping = false;
  if (preview.discoveryTaskId && mappingLoader) {
    for (let i = 0; i < results.length; i += 1) {
      const mappings = await mappingLoader(results[i].candidateKey);
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
      candidateKey: matchedResult.candidateKey,
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
      candidateKey: matchedResult.candidateKey,
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
      candidateKey: matchedResult.candidateKey,
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
    candidateKey: matchedResult.candidateKey,
    runId,
    taskId,
    decision,
    previousQualificationStatus: previous,
    qualificationStatus: updated.qualification_status ?? targetQualificationStatus,
    disposition: "updated",
  };
}

function isQualificationPreviewOutput(value: unknown): value is BacklinkQualificationPreviewOutputV1 {
  return isRecord(value) && Array.isArray(value.results);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

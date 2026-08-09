import type {
  BacklinkDiscoveryPreviewCandidate,
  BacklinkDiscoveryPreviewOutputV1,
} from "./backlink-discovery-handler-types";
import type {
  BacklinkQualificationPreviewOutputV1,
  BacklinkQualificationResult,
} from "./backlink-qualification-types";
import {
  BACKLINK_PROMOTION_INPUT_VERSION,
  BACKLINK_PROMOTION_POLICY_VERSION,
  type BacklinkPromotionPreviewInputV1,
} from "./backlink-promotion-types";
import { validateBacklinkPromotionPreviewInput } from "./backlink-promotion-validation";
import {
  BacklinkPromotionDependencyError,
  type BuildBacklinkPromotionInputFromDependenciesDependencies,
  type BuildBacklinkPromotionInputFromDependenciesInput,
  type BuildBacklinkPromotionInputFromDependenciesResult,
} from "./backlink-promotion-input-builder-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function dependencyError(
  code: BacklinkPromotionDependencyError["code"],
  message: string,
): never {
  throw new BacklinkPromotionDependencyError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDiscoveryCandidate(value: unknown): value is BacklinkDiscoveryPreviewCandidate {
  return (
    isRecord(value) &&
    typeof value.candidateKey === "string" &&
    typeof value.hostname === "string" &&
    typeof value.sourceUrl === "string" &&
    (typeof value.pageTitle === "string" || value.pageTitle === null) &&
    (typeof value.snippet === "string" || value.snippet === null) &&
    typeof value.queryIndex === "number" &&
    typeof value.rank === "number" &&
    (typeof value.countryCode === "string" || value.countryCode === null) &&
    (typeof value.languageCode === "string" || value.languageCode === null) &&
    value.proposedOpportunityType === null &&
    value.proposedPageType === null &&
    (value.intakeEligibility === undefined || isRecord(value.intakeEligibility)) &&
    (typeof value.suggestedAssetKey === "string" || value.suggestedAssetKey === null) &&
    typeof value.evidenceSummary === "string" &&
    typeof value.discoveryScore === "number"
  );
}

function isQualificationResult(value: unknown): value is BacklinkQualificationResult {
  return (
    isRecord(value) &&
    typeof value.candidateKey === "string" &&
    (value.decision === "qualified" || value.decision === "review" || value.decision === "rejected") &&
    typeof value.qualificationScore === "number" &&
    (value.confidence === "low" || value.confidence === "medium") &&
    Array.isArray(value.reasons) &&
    Array.isArray(value.flags) &&
    (typeof value.proposedOpportunityType === "string" || value.proposedOpportunityType === null) &&
    typeof value.proposedPageType === "string"
  );
}

function isQualificationOutput(value: unknown): value is BacklinkQualificationPreviewOutputV1 {
  return (
    isRecord(value) &&
    value.version === 1 &&
    value.kind === "backlinks.qualification.preview" &&
    value.dryRun === true &&
    value.policyVersion === "backlink-qualification-v1" &&
    isRecord(value.summary) &&
    Array.isArray(value.results) &&
    value.results.every(isQualificationResult)
  );
}

function isDiscoveryOutput(value: unknown): value is BacklinkDiscoveryPreviewOutputV1 {
  return (
    isRecord(value) &&
    value.version === 1 &&
    value.kind === "backlinks.discovery.preview" &&
    value.dryRun === true &&
    (typeof value.provider === "string" || value.provider === null) &&
    isRecord(value.summary) &&
    Array.isArray(value.candidates) &&
    Array.isArray(value.rejections) &&
    value.candidates.every(isDiscoveryCandidate)
  );
}

function assertPromotionTask(task: BuildBacklinkPromotionInputFromDependenciesInput["promotionTask"]): string {
  if (
    task.taskKind !== "backlinks.promotion.preview" ||
    task.status !== "running" ||
    task.dependsOnTaskId === null ||
    !UUID_PATTERN.test(task.workspaceId) ||
    !UUID_PATTERN.test(task.runId) ||
    !UUID_PATTERN.test(task.id) ||
    !UUID_PATTERN.test(task.dependsOnTaskId)
  ) {
    return dependencyError("BACKLINK_PROMOTION_TASK_INVALID", "Promotion task dependency is invalid");
  }
  return task.dependsOnTaskId;
}

export async function buildBacklinkPromotionInputFromDependencies(
  input: BuildBacklinkPromotionInputFromDependenciesInput,
  dependencies: BuildBacklinkPromotionInputFromDependenciesDependencies,
): Promise<BuildBacklinkPromotionInputFromDependenciesResult> {
  const qualificationTaskId = assertPromotionTask(input.promotionTask);
  const qualificationTask = await dependencies.getTaskByIdInRun({
    workspaceId: input.promotionTask.workspaceId,
    runId: input.promotionTask.runId,
    taskId: qualificationTaskId,
  });
  if (qualificationTask === null) {
    return dependencyError("BACKLINK_PROMOTION_QUALIFICATION_DEPENDENCY_NOT_FOUND", "Promotion qualification dependency was not found");
  }
  if (
    qualificationTask.id !== qualificationTaskId ||
    qualificationTask.workspaceId !== input.promotionTask.workspaceId ||
    qualificationTask.runId !== input.promotionTask.runId
  ) {
    return dependencyError("BACKLINK_PROMOTION_QUALIFICATION_SCOPE_MISMATCH", "Promotion qualification dependency scope is invalid");
  }
  if (qualificationTask.taskKind !== "backlinks.qualification.preview") {
    return dependencyError("BACKLINK_PROMOTION_QUALIFICATION_KIND_INVALID", "Promotion qualification dependency kind is invalid");
  }
  if (qualificationTask.status !== "completed") {
    return dependencyError("BACKLINK_PROMOTION_QUALIFICATION_NOT_COMPLETED", "Promotion qualification dependency is not completed");
  }
  if (!isQualificationOutput(qualificationTask.output)) {
    return dependencyError("BACKLINK_PROMOTION_QUALIFICATION_OUTPUT_INVALID", "Promotion qualification dependency output is invalid");
  }
  if (qualificationTask.dependsOnTaskId === null || !UUID_PATTERN.test(qualificationTask.dependsOnTaskId)) {
    return dependencyError("BACKLINK_PROMOTION_DISCOVERY_REFERENCE_MISSING", "Promotion discovery dependency reference is missing");
  }

  const discoveryTaskId = qualificationTask.dependsOnTaskId;
  const discoveryTask = await dependencies.getTaskByIdInRun({
    workspaceId: input.promotionTask.workspaceId,
    runId: input.promotionTask.runId,
    taskId: discoveryTaskId,
  });
  if (discoveryTask === null) {
    return dependencyError("BACKLINK_PROMOTION_DISCOVERY_DEPENDENCY_NOT_FOUND", "Promotion discovery dependency was not found");
  }
  if (
    discoveryTask.id !== discoveryTaskId ||
    discoveryTask.workspaceId !== input.promotionTask.workspaceId ||
    discoveryTask.runId !== input.promotionTask.runId
  ) {
    return dependencyError("BACKLINK_PROMOTION_DISCOVERY_SCOPE_MISMATCH", "Promotion discovery dependency scope is invalid");
  }
  if (discoveryTask.taskKind !== "backlinks.discovery.preview") {
    return dependencyError("BACKLINK_PROMOTION_DISCOVERY_KIND_INVALID", "Promotion discovery dependency kind is invalid");
  }
  if (discoveryTask.status !== "completed") {
    return dependencyError("BACKLINK_PROMOTION_DISCOVERY_NOT_COMPLETED", "Promotion discovery dependency is not completed");
  }
  if (!isDiscoveryOutput(discoveryTask.output)) {
    return dependencyError("BACKLINK_PROMOTION_DISCOVERY_OUTPUT_INVALID", "Promotion discovery dependency output is invalid");
  }

  const promotionInput: BacklinkPromotionPreviewInputV1 = {
    version: BACKLINK_PROMOTION_INPUT_VERSION,
    source: "automation_qualification",
    policyVersion: BACKLINK_PROMOTION_POLICY_VERSION,
    candidates: discoveryTask.output.candidates,
    qualificationResults: qualificationTask.output.results,
    includeDecisions: ["qualified"],
    maxProposals: Math.max(1, Math.min(50, qualificationTask.output.results.length)),
  };
  const validatedPromotionInput = validateBacklinkPromotionPreviewInput(promotionInput);
  if (validatedPromotionInput !== promotionInput) {
    return dependencyError("BACKLINK_PROMOTION_QUALIFICATION_OUTPUT_INVALID", "Promotion input validation is inconsistent");
  }
  return { qualificationTask, discoveryTask, promotionInput };
}

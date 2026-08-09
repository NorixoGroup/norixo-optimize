import { validateBacklinkDiscoveryRequest } from "./backlink-discovery-validation";
import type {
  BacklinkDiscoveryPreviewCandidate,
  BacklinkDiscoveryPreviewOutputV1,
} from "./backlink-discovery-handler-types";
import {
  BACKLINK_QUALIFICATION_INPUT_VERSION,
  BACKLINK_QUALIFICATION_POLICY_VERSION,
  type BacklinkQualificationPreviewInputV1,
} from "./backlink-qualification-types";
import { validateBacklinkQualificationPreviewInput } from "./backlink-qualification-validation";
import {
  BacklinkQualificationDependencyError,
  type BuildBacklinkQualificationInputFromDependencyDependencies,
  type BuildBacklinkQualificationInputFromDependencyInput,
  type BuildBacklinkQualificationInputFromDependencyResult,
} from "./backlink-qualification-input-builder-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providers = new Set(["mock", "brave_search", "dataforseo_serp"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCandidate(value: unknown): value is BacklinkDiscoveryPreviewCandidate {
  return isRecord(value) &&
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
    typeof value.discoveryScore === "number";
}

function isDiscoveryOutput(value: unknown): value is BacklinkDiscoveryPreviewOutputV1 {
  if (!isRecord(value) || value.version !== 1 || value.kind !== "backlinks.discovery.preview" || value.dryRun !== true || typeof value.provider !== "string" || !providers.has(value.provider) || !isRecord(value.summary) || !Array.isArray(value.candidates) || !Array.isArray(value.rejections)) return false;
  return typeof value.summary.searchesRequested === "number" && typeof value.summary.resultsReceived === "number" && typeof value.summary.candidatesAccepted === "number" && typeof value.summary.candidatesRejected === "number" && typeof value.summary.truncated === "boolean" && value.candidates.every(isCandidate);
}

function dependencyError(code: BacklinkQualificationDependencyError["code"], message: string): never {
  throw new BacklinkQualificationDependencyError(code, message);
}

function assertQualificationTask(task: BuildBacklinkQualificationInputFromDependencyInput["qualificationTask"]): string {
  if (task.taskKind !== "backlinks.qualification.preview" || task.status !== "running" || task.dependsOnTaskId === null || !UUID_PATTERN.test(task.workspaceId) || !UUID_PATTERN.test(task.runId) || !UUID_PATTERN.test(task.id) || !UUID_PATTERN.test(task.dependsOnTaskId)) {
    return dependencyError("BACKLINK_QUALIFICATION_TASK_INVALID", "Qualification task dependency is invalid");
  }
  return task.dependsOnTaskId;
}

export async function buildBacklinkQualificationInputFromDependency(input: BuildBacklinkQualificationInputFromDependencyInput, dependencies: BuildBacklinkQualificationInputFromDependencyDependencies): Promise<BuildBacklinkQualificationInputFromDependencyResult> {
  const dependencyTaskId = assertQualificationTask(input.qualificationTask);
  const discoveryTask = await dependencies.getTaskByIdInRun({ workspaceId: input.qualificationTask.workspaceId, runId: input.qualificationTask.runId, taskId: dependencyTaskId });
  if (discoveryTask === null) return dependencyError("BACKLINK_QUALIFICATION_DEPENDENCY_NOT_FOUND", "Qualification dependency was not found");
  if (discoveryTask.id !== dependencyTaskId || discoveryTask.workspaceId !== input.qualificationTask.workspaceId || discoveryTask.runId !== input.qualificationTask.runId) return dependencyError("BACKLINK_QUALIFICATION_DEPENDENCY_SCOPE_MISMATCH", "Qualification dependency scope is invalid");
  if (discoveryTask.taskKind !== "backlinks.discovery.preview") return dependencyError("BACKLINK_QUALIFICATION_DEPENDENCY_KIND_INVALID", "Qualification dependency kind is invalid");
  if (discoveryTask.status !== "completed") return dependencyError("BACKLINK_QUALIFICATION_DEPENDENCY_NOT_COMPLETED", "Qualification dependency is not completed");
  if (!isDiscoveryOutput(discoveryTask.output)) return dependencyError("BACKLINK_QUALIFICATION_DEPENDENCY_OUTPUT_INVALID", "Qualification dependency output is invalid");

  const discoveryInput = discoveryTask.input;
  try {
    validateBacklinkDiscoveryRequest(discoveryInput);
  } catch {
    return dependencyError("BACKLINK_QUALIFICATION_DISCOVERY_INPUT_INVALID", "Qualification discovery input is invalid");
  }
  const qualificationInput: BacklinkQualificationPreviewInputV1 = {
    version: BACKLINK_QUALIFICATION_INPUT_VERSION,
    source: "automation_discovery",
    policyVersion: BACKLINK_QUALIFICATION_POLICY_VERSION,
    queries: discoveryInput.searches.map((search) => ({ query: search.query, countryCode: search.countryCode ?? null, languageCode: search.languageCode ?? null })),
    candidates: discoveryTask.output.candidates.map((candidate) => ({ candidateKey: candidate.candidateKey, hostname: candidate.hostname, sourceUrl: candidate.sourceUrl, pageTitle: candidate.pageTitle, snippet: candidate.snippet, queryIndex: candidate.queryIndex, rank: candidate.rank, countryCode: candidate.countryCode, languageCode: candidate.languageCode, suggestedAssetKey: candidate.suggestedAssetKey, evidenceSummary: candidate.evidenceSummary, discoveryScore: candidate.discoveryScore })),
    maxCandidates: Math.max(1, discoveryTask.output.candidates.length),
  };
  let validated;
  try {
    validated = validateBacklinkQualificationPreviewInput(qualificationInput);
  } catch {
    return dependencyError("BACKLINK_QUALIFICATION_DEPENDENCY_OUTPUT_INVALID", "Qualification dependency output is invalid");
  }
  if (validated.kind !== "valid_v1") return dependencyError("BACKLINK_QUALIFICATION_INTERNAL_INVARIANT", "Qualification input validation is inconsistent");
  return { discoveryTask, qualificationInput };
}

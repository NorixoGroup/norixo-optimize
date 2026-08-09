import type {
  BacklinkDiscoveryPreviewCandidate,
  BacklinkDiscoveryPreviewOutputV1,
  BacklinkDiscoveryRejectionSummary,
} from "./backlink-discovery-handler-types";
import {
  BacklinkDiscoveryCandidateReaderError,
  type ReadBacklinkDiscoveryCandidateDependencies,
  type ReadBacklinkDiscoveryCandidateInput,
  type ReadBacklinkDiscoveryCandidateResult,
} from "./backlink-discovery-candidate-reader-types";

const rejectionCodes = new Set([
  "invalid_url",
  "unsupported_protocol",
  "private_host",
  "duplicate_url",
  "candidate_limit",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isIntakeEligibility(value: unknown): boolean {
  return value === undefined || (
    isRecord(value) && (
      (value.status === "eligible" && typeof value.opportunityType === "string" && typeof value.pageType === "string") ||
      (value.status === "review_only" && typeof value.reason === "string" && ["missing_page_title", "unsupported_opportunity_type", "unsupported_page_type"].includes(value.reason))
    )
  );
}

function isCandidate(value: unknown): value is BacklinkDiscoveryPreviewCandidate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.candidateKey === "string" &&
    typeof value.hostname === "string" &&
    typeof value.sourceUrl === "string" &&
    isNullableString(value.pageTitle) &&
    isNullableString(value.snippet) &&
    typeof value.queryIndex === "number" &&
    typeof value.rank === "number" &&
    isNullableString(value.countryCode) &&
    isNullableString(value.languageCode) &&
    value.proposedOpportunityType === null &&
    value.proposedPageType === null &&
    isIntakeEligibility(value.intakeEligibility) &&
    isNullableString(value.suggestedAssetKey) &&
    typeof value.evidenceSummary === "string" &&
    typeof value.discoveryScore === "number"
  );
}

function isRejection(value: unknown): value is BacklinkDiscoveryRejectionSummary {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    rejectionCodes.has(value.code) &&
    typeof value.count === "number"
  );
}

function isDiscoveryOutput(value: unknown): value is BacklinkDiscoveryPreviewOutputV1 {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.kind !== "backlinks.discovery.preview" ||
    value.dryRun !== true ||
    !isNullableString(value.provider) ||
    !isRecord(value.summary) ||
    !Array.isArray(value.candidates) ||
    !Array.isArray(value.rejections) ||
    (value.skipped !== undefined && value.skipped !== "no_searches")
  ) {
    return false;
  }

  const { summary } = value;
  if (
    typeof summary.searchesRequested !== "number" ||
    typeof summary.resultsReceived !== "number" ||
    typeof summary.candidatesAccepted !== "number" ||
    typeof summary.candidatesRejected !== "number" ||
    typeof summary.truncated !== "boolean" ||
    !value.candidates.every(isCandidate) ||
    !value.rejections.every(isRejection)
  ) {
    return false;
  }

  return new Set(value.candidates.map((candidate) => candidate.candidateKey)).size === value.candidates.length;
}

function fail(code: ConstructorParameters<typeof BacklinkDiscoveryCandidateReaderError>[0]): never {
  throw new BacklinkDiscoveryCandidateReaderError(code);
}

export async function readBacklinkDiscoveryCandidate(
  dependencies: ReadBacklinkDiscoveryCandidateDependencies,
  input: ReadBacklinkDiscoveryCandidateInput,
): Promise<ReadBacklinkDiscoveryCandidateResult> {
  const run = await dependencies.getRunById({
    workspaceId: input.workspaceId,
    runId: input.runId,
  });
  if (run === null || run.id !== input.runId || run.workspaceId !== input.workspaceId) {
    return fail("RUN_NOT_FOUND");
  }

  const task = await dependencies.getTaskByIdInRun({
    workspaceId: input.workspaceId,
    runId: input.runId,
    taskId: input.taskId,
  });
  if (
    task === null ||
    task.id !== input.taskId ||
    task.workspaceId !== input.workspaceId ||
    task.runId !== input.runId
  ) {
    return fail("TASK_NOT_FOUND");
  }
  if (task.taskKind !== "backlinks.discovery.preview") {
    return fail("TASK_KIND_INVALID");
  }
  if (task.status !== "completed") {
    return fail("TASK_NOT_COMPLETED");
  }
  if (!isDiscoveryOutput(task.output)) {
    return fail("OUTPUT_INVALID");
  }

  const candidate = task.output.candidates.find(
    (item) => item.candidateKey === input.candidateKey,
  );
  if (candidate === undefined) {
    return fail("CANDIDATE_NOT_FOUND");
  }

  return { run, task, candidate };
}

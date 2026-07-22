import {
  validateIntelligencePublishingExecutionProvenance,
  type IntelligencePublishingExecutionProvenance,
} from "./executionProvenance";

import {
  validateIntelligencePublishingApprovedExecutionBundle,
  type IntelligencePublishingApprovedExecutionBundle,
} from "./approvedExecution";

import {
  validateIntelligencePublishingOrchestrationResult,
  type IntelligencePublishingOrchestrationResult,
} from "./orchestrator";

import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  type RegistrySnapshot,
} from "./registryAdapter";

import {
  buildRegistryBatchCandidatesFromSnapshot,
} from "./registryBatchRuntime";

export const INTELLIGENCE_PUBLISHING_REPLAY_VERIFICATION_SCHEMA_VERSION =
  "ipp_execution_replay_verification_v1" as const;

export const INTELLIGENCE_PUBLISHING_REPLAY_VERIFICATION_VERSION =
  "ipp_execution_replay_verification_v1" as const;

export type IntelligencePublishingReplayVerificationStatus =
  | "verified"
  | "rejected";

export type IntelligencePublishingReplayVerificationCheck =
  Readonly<{
    code: string;
    passed: boolean;
    message: string;
  }>;

export type IntelligencePublishingExecutionReplayVerification =
  Readonly<{
    schemaVersion:
      typeof INTELLIGENCE_PUBLISHING_REPLAY_VERIFICATION_SCHEMA_VERSION;

    verificationVersion:
      typeof INTELLIGENCE_PUBLISHING_REPLAY_VERIFICATION_VERSION;

    campaignKey: string;

    provenanceFingerprint: string;
    approvedExecutionBundleFingerprint: string;
    approvalPreparationBundleFingerprint: string;
    approvalGrantFingerprint: string;
    publicationPlanFingerprint: string;
    executionRequestFingerprint: string;
    registryFingerprint: string;
    gateDecisionFingerprint: string;
    orchestrationResultFingerprint: string;

    expectedCandidateCount: number;
    reconstructedCandidateCount: number;

    expectedCandidateFingerprintsInOrder: readonly string[];
    reconstructedCandidateFingerprintsInOrder: readonly string[];

    expectedReportKeysInOrder: readonly string[];
    reconstructedReportKeysInOrder: readonly string[];

    expectedRequestedActions: readonly string[];
    reconstructedRequestedActions: readonly string[];

    expectedExecutionMode: string;
    reconstructedExecutionMode: string;

    status: IntelligencePublishingReplayVerificationStatus;

    checks: readonly IntelligencePublishingReplayVerificationCheck[];

    warnings: readonly string[];
    diagnostics: readonly string[];

    replayVerificationFingerprint: string;

    verifiedAt: string;
  }>;

export type VerifyIntelligencePublishingExecutionReplayInput =
  Readonly<{
    executionProvenance: IntelligencePublishingExecutionProvenance;
    approvedExecutionBundle: unknown;
    registrySnapshot: RegistrySnapshot;
    orchestrationResult: unknown;
    verifiedAt?: string;
  }>;

export class IntelligencePublishingExecutionReplayVerificationError extends Error {}


import { createHash } from "node:crypto";

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
    return Object.freeze(value);
  }

  if (typeof value === "object" && value != null) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    return Object.freeze(value);
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stable(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(stable).join(",") + "]";
  }

  const object = value as Record<string, unknown>;

  return (
    "{" +
    Object.keys(object)
      .sort(compareStrings)
      .map((key) => JSON.stringify(key) + ":" + stable(object[key]))
      .join(",") +
    "}"
  );
}

function buildReplayVerificationFingerprint(
  value: unknown,
): string {
  return (
    "ipp_execution_replay_" +
    createHash("sha256")
      .update(stable(value))
      .digest("hex")
  );
}


function hasExactStringArrayMatch(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function requireApprovedOrchestratorInput(
  bundle: IntelligencePublishingApprovedExecutionBundle,
): NonNullable<IntelligencePublishingApprovedExecutionBundle["orchestratorInput"]> {
  if (bundle.orchestratorInput == null) {
    throw new IntelligencePublishingExecutionReplayVerificationError(
      "Replay verification requires a materialized approved orchestratorInput.",
    );
  }

  if (bundle.orchestratorInput.mode !== "execute") {
    throw new IntelligencePublishingExecutionReplayVerificationError(
      "Replay verification supports approved execute mode only.",
    );
  }

  return bundle.orchestratorInput;
}


export function verifyIntelligencePublishingExecutionReplay(
  input: VerifyIntelligencePublishingExecutionReplayInput,
): IntelligencePublishingExecutionReplayVerification {
  const provenanceValidation =
    validateIntelligencePublishingExecutionProvenance(
      input.executionProvenance,
    );

  if (!provenanceValidation.ok) {
    throw new IntelligencePublishingExecutionReplayVerificationError(
      `Execution provenance validation failed: ${provenanceValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }

  const bundleValidation =
    validateIntelligencePublishingApprovedExecutionBundle(
      input.approvedExecutionBundle,
    );

  if (!bundleValidation.ok) {
    throw new IntelligencePublishingExecutionReplayVerificationError(
      `Approved execution bundle validation failed: ${bundleValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }

  const orchestrationValidation =
    validateIntelligencePublishingOrchestrationResult(
      input.orchestrationResult,
    );

  if (!orchestrationValidation.ok) {
    throw new IntelligencePublishingExecutionReplayVerificationError(
      `Orchestration result validation failed: ${orchestrationValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    );
  }

  assertRegistrySnapshotPublicSafe(input.registrySnapshot);

  const registryFingerprint =
    buildRegistrySnapshotFingerprint(input.registrySnapshot);

  const provenance = provenanceValidation.provenance;
  const bundle = bundleValidation.bundle;
  const orchestrationResult = orchestrationValidation.result;
  const orchestratorInput = requireApprovedOrchestratorInput(bundle);

  if (bundle.executionRequest.mode !== "execute") {
    throw new IntelligencePublishingExecutionReplayVerificationError(
      "Replay verification requires an execute executionRequest.",
    );
  }

  if (orchestrationResult.mode !== "execute") {
    throw new IntelligencePublishingExecutionReplayVerificationError(
      "Replay verification requires an execute orchestration result.",
    );
  }

  const candidatePreview =
    buildRegistryBatchCandidatesFromSnapshot({
      registrySnapshot: input.registrySnapshot,
      approvedCandidates: orchestratorInput.candidates,
    });

  const reconstructedCandidateFingerprintsInOrder = Object.freeze(
    candidatePreview.candidates.map((candidate) =>
      candidate.sourceFingerprint ?? "",
    ),
  );

  const reconstructedReportKeysInOrder = Object.freeze(
    candidatePreview.candidates.map((candidate) => candidate.reportKey),
  );

  const reconstructedRequestedActions = Object.freeze(
    candidatePreview.candidates.map(
      (candidate) => candidate.requestedAction ?? "publish",
    ),
  );

  if (candidatePreview.snapshotFingerprint !== registryFingerprint) {
    throw new IntelligencePublishingExecutionReplayVerificationError(
      "Reconstructed candidate preview returned an unexpected registry fingerprint.",
    );
  }

  if (
    !hasExactStringArrayMatch(
      orchestratorInput.reportKeysInOrder,
      reconstructedReportKeysInOrder,
    )
  ) {
    throw new IntelligencePublishingExecutionReplayVerificationError(
      "Reconstructed report key order does not match the approved orchestrator scope.",
    );
  }

  const verifiedAt = input.verifiedAt ?? provenance.createdAt;

  const candidateCountMatches =
    orchestratorInput.candidateCount ===
    candidatePreview.candidates.length;

  const candidateFingerprintsMatch =
    hasExactStringArrayMatch(
      orchestratorInput.candidateFingerprintsInOrder,
      reconstructedCandidateFingerprintsInOrder,
    );

  const reportKeysMatch =
    hasExactStringArrayMatch(
      orchestratorInput.reportKeysInOrder,
      reconstructedReportKeysInOrder,
    );

  const requestedActionsMatch =
    hasExactStringArrayMatch(
      orchestratorInput.requestedActions,
      reconstructedRequestedActions,
    );

  const executionModeMatches =
    orchestratorInput.mode === orchestrationResult.mode;

  const allChecksPass =
    candidateCountMatches &&
    candidateFingerprintsMatch &&
    reportKeysMatch &&
    requestedActionsMatch &&
    executionModeMatches;

  const temporaryVerificationBase: Omit<
    IntelligencePublishingExecutionReplayVerification,
    "replayVerificationFingerprint"
  > = {
    schemaVersion:
      INTELLIGENCE_PUBLISHING_REPLAY_VERIFICATION_SCHEMA_VERSION,
    verificationVersion:
      INTELLIGENCE_PUBLISHING_REPLAY_VERIFICATION_VERSION,

    campaignKey: provenance.campaignKey,

    provenanceFingerprint: provenance.provenanceFingerprint,
    approvedExecutionBundleFingerprint:
      bundle.approvedExecutionBundleFingerprint,
    approvalPreparationBundleFingerprint:
      bundle.approvalPreparationBundleFingerprint,
    approvalGrantFingerprint:
      bundle.approvalGrantFingerprint ?? "",
    publicationPlanFingerprint:
      provenance.publicationPlanFingerprint,
    executionRequestFingerprint:
      bundle.executionRequestFingerprint,
    registryFingerprint,
    gateDecisionFingerprint:
      orchestrationResult.gateDecision.fingerprint,
    orchestrationResultFingerprint:
      provenance.orchestrationResultFingerprint,

    expectedCandidateCount: orchestratorInput.candidateCount,
    reconstructedCandidateCount: candidatePreview.candidates.length,

    expectedCandidateFingerprintsInOrder:
      orchestratorInput.candidateFingerprintsInOrder,
    reconstructedCandidateFingerprintsInOrder,

    expectedReportKeysInOrder:
      orchestratorInput.reportKeysInOrder,
    reconstructedReportKeysInOrder,

    expectedRequestedActions:
      orchestratorInput.requestedActions,
    reconstructedRequestedActions,

    expectedExecutionMode: orchestratorInput.mode,
    reconstructedExecutionMode: orchestrationResult.mode,

    status: (allChecksPass
      ? "verified"
      : "rejected") satisfies IntelligencePublishingReplayVerificationStatus,

    checks: Object.freeze([
      Object.freeze({
        code: "candidate_count_matches",
        passed: candidateCountMatches,
        message: candidateCountMatches
          ? "Reconstructed candidate count matches the approved scope."
          : "Reconstructed candidate count differs from the approved scope.",
      }),
      Object.freeze({
        code: "candidate_fingerprints_match",
        passed: candidateFingerprintsMatch,
        message: candidateFingerprintsMatch
          ? "Candidate fingerprint order matches the approved scope."
          : "Candidate fingerprint order differs from the approved scope.",
      }),
      Object.freeze({
        code: "report_keys_match",
        passed: reportKeysMatch,
        message: reportKeysMatch
          ? "Report key order matches the approved scope."
          : "Report key order differs from the approved scope.",
      }),
      Object.freeze({
        code: "requested_actions_match",
        passed: requestedActionsMatch,
        message: requestedActionsMatch
          ? "Requested actions match the approved scope."
          : "Requested actions differ from the approved scope.",
      }),
      Object.freeze({
        code: "execution_mode_matches",
        passed: executionModeMatches,
        message: executionModeMatches
          ? "Execution mode matches the approved orchestrator scope."
          : "Execution mode differs from the approved orchestrator scope.",
      }),
    ]),

    warnings: Object.freeze([
      ...bundle.warnings,
      "P3-I12 final deterministic replay verification remains pending.",
    ]),

    diagnostics: Object.freeze([
      "Execution provenance validated.",
      "Approved execution bundle validated.",
      "Orchestration result validated.",
      "Registry candidate scope reconstructed without execution.",
    ]),

    verifiedAt,
  };

  const replayVerificationFingerprint =
    buildReplayVerificationFingerprint(temporaryVerificationBase);

  return deepFreeze({
    ...temporaryVerificationBase,
    replayVerificationFingerprint,
  });
}

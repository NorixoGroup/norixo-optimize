import {
  buildIntelligencePublishingExecutionApprovalRequest,
  validateIntelligencePublishingExecutionApprovalRequest,
  type VerifyIntelligencePublishingApprovalGrantOptions,
} from "./approvalGrant";
import { buildIntelligencePublishingPublicationPlanCandidateFingerprint } from "./campaignPlanning";
import {
  validateIntelligencePublishingApprovedExecutionBundle,
  type IntelligencePublishingApprovedExecutionBundle,
  type IntelligencePublishingApprovedExecutionDiagnostic,
  type IntelligencePublishingApprovedExecutionDiagnosticCode,
  type IntelligencePublishingApprovedExecutionDiagnosticSeverity,
} from "./approvedExecution";
import type { CoordinationJsonObject } from "./distributedCoordination";
import {
  buildRegistryBatchCandidatesFromSnapshot,
  type ExecuteRegistrySnapshotBatchInput,
  type RegistryBatchRuntimeChannel,
} from "./registryBatchRuntime";
import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
  type RegistryAssetType,
  type RegistrySnapshot,
} from "./registryAdapter";
import {
  orchestrateIntelligencePublishing,
  validateIntelligencePublishingOrchestrationResult,
  type IntelligencePublishingOrchestrationInput,
  type IntelligencePublishingOrchestrationResult,
} from "./orchestrator";

export const INTELLIGENCE_PUBLISHING_APPROVED_ORCHESTRATOR_ERROR_CODES =
  Object.freeze([
    "invalid_approved_execution_bundle",
    "missing_orchestrator_input",
    "missing_approval_grant",
    "missing_approval_verification",
    "gate_decision_not_allowed",
    "unsupported_execution_mode",
    "unsupported_candidate_channel",
    "mixed_candidate_channels",
    "mixed_candidate_priorities",
    "mixed_candidate_actions",
    "missing_snapshot_source",
    "conflicting_snapshot_sources",
    "registry_snapshot_fingerprint_mismatch",
    "approved_candidate_order_mismatch",
    "approved_candidate_fingerprint_mismatch",
    "approved_candidate_scope_mismatch",
    "approval_request_mismatch",
    "orchestration_result_invalid",
  ] as const);

export type IntelligencePublishingApprovedOrchestratorErrorCode =
  (typeof INTELLIGENCE_PUBLISHING_APPROVED_ORCHESTRATOR_ERROR_CODES)[number];

export class IntelligencePublishingApprovedOrchestratorError extends Error {
  readonly code: IntelligencePublishingApprovedOrchestratorErrorCode;
  readonly diagnostics: readonly IntelligencePublishingApprovedExecutionDiagnostic[];

  constructor(
    input: Readonly<{
      code: IntelligencePublishingApprovedOrchestratorErrorCode;
      message: string;
      diagnostics?: readonly IntelligencePublishingApprovedExecutionDiagnostic[];
    }>,
  ) {
    super(input.message);
    this.name = "IntelligencePublishingApprovedOrchestratorError";
    this.code = input.code;
    this.diagnostics = Object.freeze([...(input.diagnostics ?? [])]);
  }
}

export type ExecuteApprovedIntelligencePublishingInput = Readonly<{
  approvedExecutionBundle: unknown;
  registrySnapshot?: unknown;
  getRegistrySnapshot?: () => unknown | Promise<unknown>;
  now: () => string;
  executeItem?: ExecuteRegistrySnapshotBatchInput["executeItem"];
  sourceSystem?: string;
  eventPriority?: IntelligencePublishingOrchestrationInput["eventPriority"];
  eventVisibility?: IntelligencePublishingOrchestrationInput["eventVisibility"];
  requestedBy?: string;
  reason?: string;
  metadata?: IntelligencePublishingOrchestrationInput["metadata"];
  approvalVerification?: VerifyIntelligencePublishingApprovalGrantOptions;
}>;

type ApprovedExecutionCandidates =
  IntelligencePublishingApprovedExecutionBundle["executionRequest"]["candidates"];

type ParsedCandidateId = Readonly<{
  assetId: string;
  assetVersionId: string;
  locale: string;
  channel: RegistryBatchRuntimeChannel;
}>;

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
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

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString() === value;
}

function parseApprovedCandidateId(candidateId: string): ParsedCandidateId | null {
  const parts = candidateId.split("|");
  if (
    parts.length !== 5 ||
    parts[0] !== "registry_batch_candidate" ||
    (parts[4] !== "web" && parts[4] !== "newsletter")
  ) {
    return null;
  }
  return Object.freeze({
    assetId: parts[1]!,
    assetVersionId: parts[2]!,
    locale: parts[3]!,
    channel: parts[4] as RegistryBatchRuntimeChannel,
  });
}

function buildDiagnostic(
  input: Readonly<{
    code: IntelligencePublishingApprovedExecutionDiagnosticCode;
    severity: IntelligencePublishingApprovedExecutionDiagnosticSeverity;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): IntelligencePublishingApprovedExecutionDiagnostic {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    message: input.message,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

function createError(
  code: IntelligencePublishingApprovedOrchestratorErrorCode,
  message: string,
  diagnostics: readonly IntelligencePublishingApprovedExecutionDiagnostic[],
): IntelligencePublishingApprovedOrchestratorError {
  return new IntelligencePublishingApprovedOrchestratorError({
    code,
    message,
    diagnostics,
  });
}

async function loadRegistrySnapshot(
  input: ExecuteApprovedIntelligencePublishingInput,
): Promise<RegistrySnapshot> {
  if (input.registrySnapshot != null && input.getRegistrySnapshot != null) {
    throw new Error(
      "Provide either registrySnapshot or getRegistrySnapshot, but not both.",
    );
  }
  if (input.registrySnapshot == null && input.getRegistrySnapshot == null) {
    throw new Error(
      "An approved orchestration run requires a registrySnapshot or getRegistrySnapshot source.",
    );
  }
  const raw =
    input.registrySnapshot ??
    (await input.getRegistrySnapshot!());
  return normalizeRegistrySnapshot(parseRegistrySnapshot(raw));
}

function inferCandidateChannel(
  bundle: IntelligencePublishingApprovedExecutionBundle,
): RegistryBatchRuntimeChannel {
  const channels = new Set<RegistryBatchRuntimeChannel>();
  for (const candidate of bundle.executionRequest.candidates) {
    const parsed = parseApprovedCandidateId(candidate.candidateId);
    if (parsed == null) {
      throw new Error(
        `Unsupported candidateId format: ${candidate.candidateId}.`,
      );
    }
    channels.add(parsed.channel);
  }
  if (channels.size !== 1) {
    throw new Error("Approved execution requires exactly one candidate channel.");
  }
  return [...channels][0]!;
}

function inferCandidatePriority(
  bundle: IntelligencePublishingApprovedExecutionBundle,
): number {
  const priorities = new Set(
    bundle.executionRequest.candidates.map((candidate) => candidate.priority ?? 100),
  );
  if (priorities.size !== 1) {
    throw new Error(
      "Approved execution requires a single normalized candidate priority.",
    );
  }
  return [...priorities][0]!;
}

function inferRequestedAction(
  bundle: IntelligencePublishingApprovedExecutionBundle,
): IntelligencePublishingOrchestrationInput["requestedAction"] {
  const actions = new Set(
    bundle.executionRequest.candidates.map(
      (candidate) => candidate.requestedAction ?? bundle.executionRequest.requestedAction,
    ),
  );
  if (actions.size !== 1) {
    throw new Error(
      "Approved execution requires all candidates to share one requestedAction.",
    );
  }
  return [...actions][0]!;
}

function inferAssetTypes(
  snapshot: RegistrySnapshot,
  bundle: IntelligencePublishingApprovedExecutionBundle,
): readonly RegistryAssetType[] {
  const assetIds = new Set(
    bundle.executionRequest.candidates.map((candidate) => {
      const parsed = parseApprovedCandidateId(candidate.candidateId);
      if (parsed == null) {
        throw new Error(
          `Unsupported candidateId format: ${candidate.candidateId}.`,
        );
      }
      return parsed.assetId;
    }),
  );

  const assetTypes = new Set<RegistryAssetType>();
  for (const asset of snapshot.assets) {
    if (assetIds.has(asset.assetId)) {
      assetTypes.add(asset.assetType);
    }
  }

  return Object.freeze([...assetTypes].sort(compareStrings));
}

function hasExactCandidateMatch(
  left: ApprovedExecutionCandidates,
  right: ApprovedExecutionCandidates,
): boolean {
  return (
    left.length === right.length &&
    left.every((candidate, index) => {
      const other = right[index];
      if (other == null) {
        return false;
      }
      return (
        candidate.candidateId === other.candidateId &&
        candidate.reportKey === other.reportKey &&
        normalizeText(candidate.locale) === normalizeText(other.locale) &&
        normalizeText(candidate.country) === normalizeText(other.country) &&
        normalizeText(candidate.city) === normalizeText(other.city) &&
        normalizeText(candidate.platform) === normalizeText(other.platform) &&
        normalizeText(candidate.propertyType) ===
          normalizeText(other.propertyType) &&
        (candidate.priority ?? 100) === (other.priority ?? 100) &&
        normalizeText(candidate.requestedAction ?? "publish") ===
          normalizeText(other.requestedAction ?? "publish") &&
        (candidate.sourceFingerprint ?? null) ===
          (other.sourceFingerprint ?? null)
      );
    })
  );
}

function buildCandidateFingerprintsInOrder(
  candidates: ApprovedExecutionCandidates,
): readonly string[] {
  return Object.freeze(
    candidates.map((candidate) =>
      buildIntelligencePublishingPublicationPlanCandidateFingerprint({
        reportKey: candidate.reportKey,
        requestedAction: candidate.requestedAction ?? "publish",
        locale: candidate.locale,
        country: candidate.country,
        city: candidate.city,
        platform: candidate.platform,
        propertyType: candidate.propertyType,
        sourceFingerprint: candidate.sourceFingerprint ?? null,
      }),
    ),
  );
}

function isApprovedVerificationOptions(
  value: VerifyIntelligencePublishingApprovalGrantOptions | undefined,
): value is VerifyIntelligencePublishingApprovalGrantOptions {
  return (
    value != null &&
    typeof value.secret === "string" &&
    value.secret.length > 0 &&
    typeof value.now === "string" &&
    isCanonicalIsoTimestamp(value.now)
  );
}

export async function executeApprovedIntelligencePublishing(
  input: ExecuteApprovedIntelligencePublishingInput,
): Promise<IntelligencePublishingOrchestrationResult> {
  const validation = validateIntelligencePublishingApprovedExecutionBundle(
    input.approvedExecutionBundle,
  );
  if (!validation.ok) {
    throw new IntelligencePublishingApprovedOrchestratorError({
      code: "invalid_approved_execution_bundle",
      message: `Approved execution bundle validation failed: ${validation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
    });
  }

  const bundle = validation.bundle;
  const diagnostics: IntelligencePublishingApprovedExecutionDiagnostic[] = [
    ...bundle.diagnostics,
  ];

  if (bundle.gateDecision.decision !== "allowed") {
    throw createError(
      "gate_decision_not_allowed",
      `Approved execution requires an allowed gateDecision, received ${bundle.gateDecision.decision}.`,
      diagnostics,
    );
  }

  if (bundle.orchestratorInput == null) {
    throw createError(
      "missing_orchestrator_input",
      "Approved execution bundle is missing orchestratorInput.",
      diagnostics,
    );
  }

  if (bundle.orchestratorInput.mode !== "execute") {
    throw createError(
      "unsupported_execution_mode",
      `Unsupported approved orchestrator mode ${bundle.orchestratorInput.mode}.`,
      diagnostics,
    );
  }

  if (bundle.approvalGrant == null) {
    throw createError(
      "missing_approval_grant",
      "Approved execution bundle is missing approvalGrant.",
      diagnostics,
    );
  }

  if (
    bundle.orchestratorInput.gateConfig.approvalRequired &&
    !isApprovedVerificationOptions(input.approvalVerification)
  ) {
    throw createError(
      "missing_approval_verification",
      "approvalVerification is required to preserve the orchestrator approval gate.",
      diagnostics,
    );
  }

  let snapshot: RegistrySnapshot;
  try {
    snapshot = await loadRegistrySnapshot(input);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("either registrySnapshot or getRegistrySnapshot")) {
        throw createError("conflicting_snapshot_sources", error.message, diagnostics);
      }
      if (error.message.includes("requires a registrySnapshot")) {
        throw createError("missing_snapshot_source", error.message, diagnostics);
      }
    }
    throw error;
  }

  assertRegistrySnapshotPublicSafe(snapshot);
  const snapshotFingerprint = buildRegistrySnapshotFingerprint(snapshot);
  if (snapshotFingerprint !== bundle.orchestratorInput.registryFingerprint) {
    throw createError(
      "registry_snapshot_fingerprint_mismatch",
      "The provided registry snapshot fingerprint does not match the approved execution bundle.",
      diagnostics,
    );
  }

  let channel: RegistryBatchRuntimeChannel;
  let priority: number;
  let requestedAction: IntelligencePublishingOrchestrationInput["requestedAction"];
  let assetTypes: readonly RegistryAssetType[];
  try {
    channel = inferCandidateChannel(bundle);
  } catch (error) {
    throw createError(
      error instanceof Error &&
        error.message.includes("exactly one candidate channel")
        ? "mixed_candidate_channels"
        : "unsupported_candidate_channel",
      error instanceof Error ? error.message : "Unsupported candidate channel.",
      diagnostics,
    );
  }
  try {
    priority = inferCandidatePriority(bundle);
  } catch (error) {
    throw createError(
      "mixed_candidate_priorities",
      error instanceof Error ? error.message : "Mixed candidate priorities.",
      diagnostics,
    );
  }
  try {
    requestedAction = inferRequestedAction(bundle);
  } catch (error) {
    throw createError(
      "mixed_candidate_actions",
      error instanceof Error ? error.message : "Mixed candidate actions.",
      diagnostics,
    );
  }
  assetTypes = inferAssetTypes(snapshot, bundle);

  const fullCandidatePreview = buildRegistryBatchCandidatesFromSnapshot({
    registrySnapshot: snapshot,
    assetTypes,
    channel,
    requestedAction,
    priority,
  });
  const approvedCandidateFingerprints = buildCandidateFingerprintsInOrder(
    bundle.orchestratorInput.candidates,
  );
  if (
    !hasExactStringArrayMatch(
      approvedCandidateFingerprints,
      bundle.orchestratorInput.candidateFingerprintsInOrder,
    )
  ) {
    throw createError(
      "approved_candidate_fingerprint_mismatch",
      "Approved execution candidateFingerprintsInOrder does not match the approved candidate payload.",
      diagnostics,
    );
  }
  if (
    !hasExactStringArrayMatch(
      bundle.orchestratorInput.candidates.map((candidate) => candidate.reportKey),
      bundle.orchestratorInput.reportKeysInOrder,
    )
  ) {
    throw createError(
      "approved_candidate_order_mismatch",
      "Approved execution reportKeysInOrder does not match the approved candidate order.",
      diagnostics,
    );
  }
  const candidatePreview = buildRegistryBatchCandidatesFromSnapshot({
    registrySnapshot: snapshot,
    approvedCandidates: bundle.orchestratorInput.candidates,
    assetTypes,
    channel,
    requestedAction,
    priority,
  });
  if (
    !hasExactCandidateMatch(
      bundle.orchestratorInput.candidates,
      candidatePreview.candidates,
    )
  ) {
    throw createError(
      "approved_candidate_scope_mismatch",
      "The approved candidate scope does not match the candidate preview generated from the registry snapshot.",
      diagnostics,
    );
  }

  const approvalRequest = buildIntelligencePublishingExecutionApprovalRequest({
    registryFingerprint: snapshotFingerprint,
    mode: "execute",
    candidates: candidatePreview.candidates,
    gatePolicy: bundle.orchestratorInput.gatePolicy,
  });
  const approvalRequestValidation =
    validateIntelligencePublishingExecutionApprovalRequest(approvalRequest);
  if (!approvalRequestValidation.ok) {
    throw createError(
      "approval_request_mismatch",
      `Approval request validation failed: ${approvalRequestValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
      diagnostics,
    );
  }
  if (
    JSON.stringify(approvalRequestValidation.request) !==
    JSON.stringify(bundle.orchestratorInput.approvalRequest)
  ) {
    throw createError(
      "approval_request_mismatch",
      "The approval request regenerated for the orchestrator does not match the approved execution bundle.",
      diagnostics,
    );
  }

  const result = await orchestrateIntelligencePublishing({
    mode: "execute",
    createdAt: bundle.orchestratorInput.createdAt,
    now: input.now,
    registrySnapshot: snapshot,
    approvedCandidates: candidatePreview.candidates,
    preserveCandidateOrder: true,
    assetTypes,
    channel,
    requestedAction,
    priority,
    executeItem: input.executeItem,
    sourceSystem: input.sourceSystem,
    eventPriority: input.eventPriority,
    eventVisibility: input.eventVisibility,
    requestedBy: input.requestedBy,
    reason: input.reason,
    gateConfig: bundle.orchestratorInput.gateConfig,
    approvalGrant: bundle.approvalGrant,
    approvalVerification: input.approvalVerification,
    metadata: input.metadata,
  });

  const resultValidation = validateIntelligencePublishingOrchestrationResult(result);
  if (!resultValidation.ok) {
    throw createError(
      "orchestration_result_invalid",
      `Orchestrator returned an invalid result: ${resultValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ")}`,
      diagnostics,
    );
  }

  diagnostics.push(
    buildDiagnostic({
      code: "approved_orchestrator_input_materialized",
      severity: "info",
      message:
        "Approved execution bundle was validated and adapted to the official orchestrator call.",
      metadata: {
        registryFingerprint: snapshotFingerprint,
        fullCandidateCount: fullCandidatePreview.candidates.length,
        candidateCount: candidatePreview.candidates.length,
        planFingerprint: result.planFingerprint,
        resultFingerprint: result.resultFingerprint,
      },
    }),
  );

  return result;
}

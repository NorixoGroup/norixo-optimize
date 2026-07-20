import { createHash } from "node:crypto";

/**
 * Canonical event contract for the Intelligence Publishing Platform.
 *
 * Design goals:
 * - keep the envelope independent from orchestrators, storage and workers;
 * - make event identity deterministic and portable across systems;
 * - validate strictly enough for safe orchestration, while leaving room to add
 *   future event types without rewriting the existing contract model.
 */

export const PUBLICATION_EVENT_TYPES = Object.freeze([
  "benchmark_created",
  "benchmark_updated",
  "benchmark_superseded",
  "public_overview_approved",
  "public_overview_suppressed",
  "confidence_changed",
  "freshness_expired",
  "policy_version_changed",
  "manual_republish_requested",
] as const);

export type PublicationEventType = (typeof PUBLICATION_EVENT_TYPES)[number];

export const PUBLICATION_EVENT_SUBJECT_TYPES = Object.freeze([
  "benchmark",
  "public_overview",
  "asset",
  "asset_version",
  "policy",
  "template",
] as const);

export type PublicationEventSubjectType =
  (typeof PUBLICATION_EVENT_SUBJECT_TYPES)[number];

export const PUBLICATION_EVENT_PRIORITIES = Object.freeze([
  "P0",
  "P1",
  "P2",
  "P3",
] as const);

export type PublicationEventPriority =
  (typeof PUBLICATION_EVENT_PRIORITIES)[number];

export const PUBLICATION_EVENT_VISIBILITIES = Object.freeze([
  "private",
  "internal",
  "partner",
  "public",
] as const);

export type PublicationEventVisibility =
  (typeof PUBLICATION_EVENT_VISIBILITIES)[number];

export const PUBLICATION_EVENT_CONFIDENCE_LEVELS = Object.freeze([
  "unknown",
  "low",
  "moderate",
  "high",
  "very_high",
] as const);

export type PublicationEventConfidenceLevel =
  (typeof PUBLICATION_EVENT_CONFIDENCE_LEVELS)[number];

export type PublicationEventPolicyVersions = Readonly<
  Record<string, string>
>;

type BenchmarkCreatedMetadata = Readonly<{
  benchmarkType: string;
}>;

type BenchmarkUpdatedMetadata = Readonly<{
  benchmarkType: string;
  changeSummary: string;
}>;

type BenchmarkSupersededMetadata = Readonly<{
  benchmarkType: string;
  supersededBySubjectId: string;
}>;

type PublicOverviewApprovedMetadata = Readonly<{
  approvalStatus: string;
}>;

type PublicOverviewSuppressedMetadata = Readonly<{
  suppressionReason: string;
}>;

type ConfidenceChangedMetadata = Readonly<{
  previousConfidence: PublicationEventConfidenceLevel;
  nextConfidence: PublicationEventConfidenceLevel;
}>;

type FreshnessExpiredMetadata = Readonly<{
  expiredAt: string;
}>;

type PolicyVersionChangedMetadata = Readonly<{
  policyName: string;
  previousVersion: string;
  nextVersion: string;
}>;

type ManualRepublishRequestedMetadata = Readonly<{
  reason: string;
  requestedBy: string;
}>;

export type PublicationEventMetadataByType = Readonly<{
  benchmark_created: BenchmarkCreatedMetadata;
  benchmark_updated: BenchmarkUpdatedMetadata;
  benchmark_superseded: BenchmarkSupersededMetadata;
  public_overview_approved: PublicOverviewApprovedMetadata;
  public_overview_suppressed: PublicOverviewSuppressedMetadata;
  confidence_changed: ConfidenceChangedMetadata;
  freshness_expired: FreshnessExpiredMetadata;
  policy_version_changed: PolicyVersionChangedMetadata;
  manual_republish_requested: ManualRepublishRequestedMetadata;
}>;

export type PublicationEventSubjectTypeByType = Readonly<{
  benchmark_created: "benchmark";
  benchmark_updated: "benchmark";
  benchmark_superseded: "benchmark";
  public_overview_approved: "public_overview";
  public_overview_suppressed: "public_overview";
  confidence_changed: "benchmark" | "public_overview" | "asset_version";
  freshness_expired: "benchmark" | "public_overview" | "asset_version";
  policy_version_changed: "policy";
  manual_republish_requested: "asset" | "asset_version" | "template";
}>;

type PublicationEventEnvelopeBase<
  TType extends PublicationEventType,
  TSubjectType extends PublicationEventSubjectType,
  TMetadata,
> = Readonly<{
  /**
   * Stable event identifier supplied by the producer.
   * This is transport identity, not idempotence identity.
   */
  eventId: string;
  /**
   * Canonical event type used by the IPP execution layer.
   */
  eventType: TType;
  /**
   * Canonical ISO timestamp for causal ordering and observability.
   */
  occurredAt: string;
  /**
   * Human-readable producer system name.
   * Example: intelligence_v2, public_market_overview_builder, admin_console.
   */
  sourceSystem: string;
  /**
   * Canonical subject family constrained by event type.
   */
  subjectType: TSubjectType;
  /**
   * Subject identifier inside the producer domain.
   */
  subjectId: string;
  /**
   * Deterministic subject snapshot hash or revision marker.
   * When it changes, orchestration should treat the event as new work.
   */
  subjectFingerprint: string;
  /**
   * Policy version snapshot carried with the event so downstream systems can
   * reason about compatibility without querying the source of truth again.
   */
  policyVersions: PublicationEventPolicyVersions;
  priority: PublicationEventPriority;
  visibility: PublicationEventVisibility;
  /**
   * Optional external request or command identifier. When present it becomes
   * part of idempotence identity for manual or replayed actions.
   */
  requestId?: string;
  /**
   * Event-specific minimal payload. The orchestrator should be able to decide
   * whether to plan work from this payload alone.
   */
  metadata: TMetadata;
}>;

type PublicationEventEnvelopeByType = {
  [K in PublicationEventType]: PublicationEventEnvelopeBase<
    K,
    PublicationEventSubjectTypeByType[K],
    PublicationEventMetadataByType[K]
  >;
};

export type PublicationEventEnvelope<
  TType extends PublicationEventType = PublicationEventType,
> = PublicationEventEnvelopeByType[TType];

export type PublicationEventValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type PublicationEventValidationResult<
  TType extends PublicationEventType = PublicationEventType,
> =
  | Readonly<{
      ok: true;
      event: PublicationEventEnvelope<TType>;
    }>
  | Readonly<{
      ok: false;
      issues: readonly PublicationEventValidationIssue[];
    }>;

type PublicationEventIdentityFields = Readonly<{
  eventType: PublicationEventType;
  subjectType: PublicationEventSubjectType;
  subjectId: string;
  subjectFingerprint: string;
  requestId?: string;
}>;

const ALLOWED_SUBJECT_TYPES_BY_EVENT_TYPE: Readonly<
  Record<PublicationEventType, readonly PublicationEventSubjectType[]>
> = Object.freeze({
  benchmark_created: Object.freeze(["benchmark"] as const),
  benchmark_updated: Object.freeze(["benchmark"] as const),
  benchmark_superseded: Object.freeze(["benchmark"] as const),
  public_overview_approved: Object.freeze(["public_overview"] as const),
  public_overview_suppressed: Object.freeze(["public_overview"] as const),
  confidence_changed: Object.freeze([
    "benchmark",
    "public_overview",
    "asset_version",
  ] as const),
  freshness_expired: Object.freeze([
    "benchmark",
    "public_overview",
    "asset_version",
  ] as const),
  policy_version_changed: Object.freeze(["policy"] as const),
  manual_republish_requested: Object.freeze([
    "asset",
    "asset_version",
    "template",
  ] as const),
});

const CRITICAL_EVENT_TYPES: ReadonlySet<PublicationEventType> = new Set([
  "public_overview_suppressed",
]);

const REPUBLISH_EVENT_TYPES: ReadonlySet<PublicationEventType> = new Set([
  "benchmark_created",
  "benchmark_updated",
  "public_overview_approved",
  "confidence_changed",
  "policy_version_changed",
  "manual_republish_requested",
]);

const SUPPRESSION_EVENT_TYPES: ReadonlySet<PublicationEventType> = new Set([
  "public_overview_suppressed",
]);

const REVIEW_EVENT_TYPES: ReadonlySet<PublicationEventType> = new Set([
  "confidence_changed",
  "policy_version_changed",
  "manual_republish_requested",
]);

const POLICY_EVENT_TYPES: ReadonlySet<PublicationEventType> = new Set([
  "policy_version_changed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString() === value;
}

function hasOwnKey<T extends string>(
  value: string,
  allowed: readonly T[],
): value is T {
  return (allowed as readonly string[]).includes(value);
}

function freezeEvent<TType extends PublicationEventType>(
  event: PublicationEventEnvelope<TType>,
): PublicationEventEnvelope<TType> {
  return Object.freeze(event) as PublicationEventEnvelope<TType>;
}

function cloneIssues(
  issues: PublicationEventValidationIssue[],
): readonly PublicationEventValidationIssue[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
}

function readRequiredString(
  record: Record<string, unknown>,
  field: string,
  issues: PublicationEventValidationIssue[],
  pathPrefix = "",
): string | null {
  const path = pathPrefix ? `${pathPrefix}.${field}` : field;
  const value = record[field];
  if (!isNonEmptyString(value)) {
    issues.push({
      path,
      message: "Expected a non-empty string.",
    });
    return null;
  }

  return value.trim();
}

function readRequiredConfidence(
  record: Record<string, unknown>,
  field: string,
  issues: PublicationEventValidationIssue[],
  pathPrefix = "",
): PublicationEventConfidenceLevel | null {
  const value = readRequiredString(record, field, issues, pathPrefix);
  if (value == null) {
    return null;
  }

  if (!hasOwnKey(value, PUBLICATION_EVENT_CONFIDENCE_LEVELS)) {
    issues.push({
      path: pathPrefix ? `${pathPrefix}.${field}` : field,
      message: `Expected one of: ${PUBLICATION_EVENT_CONFIDENCE_LEVELS.join(", ")}.`,
    });
    return null;
  }

  return value;
}

function validatePolicyVersions(
  value: unknown,
  issues: PublicationEventValidationIssue[],
): PublicationEventPolicyVersions | null {
  if (!isRecord(value)) {
    issues.push({
      path: "policyVersions",
      message: "Expected a record of non-empty version strings.",
    });
    return null;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    issues.push({
      path: "policyVersions",
      message: "Expected at least one policy version entry.",
    });
    return null;
  }

  const normalized: Record<string, string> = {};
  for (const [key, entryValue] of entries) {
    if (!isNonEmptyString(key)) {
      issues.push({
        path: "policyVersions",
        message: "Policy version keys must be non-empty strings.",
      });
      continue;
    }

    if (!isNonEmptyString(entryValue)) {
      issues.push({
        path: `policyVersions.${key}`,
        message: "Expected a non-empty version string.",
      });
      continue;
    }

    normalized[key.trim()] = entryValue.trim();
  }

  return Object.freeze(normalized);
}

function validateMetadataByEventType<TType extends PublicationEventType>(
  eventType: TType,
  value: unknown,
  issues: PublicationEventValidationIssue[],
): PublicationEventMetadataByType[TType] | null {
  if (!isRecord(value)) {
    issues.push({
      path: "metadata",
      message: "Expected an object matching the event type contract.",
    });
    return null;
  }

  switch (eventType) {
    case "benchmark_created": {
      const benchmarkType = readRequiredString(
        value,
        "benchmarkType",
        issues,
        "metadata",
      );
      if (benchmarkType == null) {
        return null;
      }

      return Object.freeze({
        benchmarkType,
      }) as PublicationEventMetadataByType[TType];
    }

    case "benchmark_updated": {
      const benchmarkType = readRequiredString(
        value,
        "benchmarkType",
        issues,
        "metadata",
      );
      const changeSummary = readRequiredString(
        value,
        "changeSummary",
        issues,
        "metadata",
      );
      if (benchmarkType == null || changeSummary == null) {
        return null;
      }

      return Object.freeze({
        benchmarkType,
        changeSummary,
      }) as PublicationEventMetadataByType[TType];
    }

    case "benchmark_superseded": {
      const benchmarkType = readRequiredString(
        value,
        "benchmarkType",
        issues,
        "metadata",
      );
      const supersededBySubjectId = readRequiredString(
        value,
        "supersededBySubjectId",
        issues,
        "metadata",
      );
      if (benchmarkType == null || supersededBySubjectId == null) {
        return null;
      }

      return Object.freeze({
        benchmarkType,
        supersededBySubjectId,
      }) as PublicationEventMetadataByType[TType];
    }

    case "public_overview_approved": {
      const approvalStatus = readRequiredString(
        value,
        "approvalStatus",
        issues,
        "metadata",
      );
      if (approvalStatus == null) {
        return null;
      }

      return Object.freeze({
        approvalStatus,
      }) as PublicationEventMetadataByType[TType];
    }

    case "public_overview_suppressed": {
      const suppressionReason = readRequiredString(
        value,
        "suppressionReason",
        issues,
        "metadata",
      );
      if (suppressionReason == null) {
        return null;
      }

      return Object.freeze({
        suppressionReason,
      }) as PublicationEventMetadataByType[TType];
    }

    case "confidence_changed": {
      const previousConfidence = readRequiredConfidence(
        value,
        "previousConfidence",
        issues,
        "metadata",
      );
      const nextConfidence = readRequiredConfidence(
        value,
        "nextConfidence",
        issues,
        "metadata",
      );
      if (previousConfidence == null || nextConfidence == null) {
        return null;
      }

      return Object.freeze({
        previousConfidence,
        nextConfidence,
      }) as PublicationEventMetadataByType[TType];
    }

    case "freshness_expired": {
      const expiredAt = readRequiredString(
        value,
        "expiredAt",
        issues,
        "metadata",
      );
      if (expiredAt == null) {
        return null;
      }

      if (!isCanonicalIsoTimestamp(expiredAt)) {
        issues.push({
          path: "metadata.expiredAt",
          message: "Expected a canonical ISO timestamp.",
        });
        return null;
      }

      return Object.freeze({
        expiredAt,
      }) as PublicationEventMetadataByType[TType];
    }

    case "policy_version_changed": {
      const policyName = readRequiredString(
        value,
        "policyName",
        issues,
        "metadata",
      );
      const previousVersion = readRequiredString(
        value,
        "previousVersion",
        issues,
        "metadata",
      );
      const nextVersion = readRequiredString(
        value,
        "nextVersion",
        issues,
        "metadata",
      );
      if (
        policyName == null ||
        previousVersion == null ||
        nextVersion == null
      ) {
        return null;
      }

      return Object.freeze({
        policyName,
        previousVersion,
        nextVersion,
      }) as PublicationEventMetadataByType[TType];
    }

    case "manual_republish_requested": {
      const reason = readRequiredString(value, "reason", issues, "metadata");
      const requestedBy = readRequiredString(
        value,
        "requestedBy",
        issues,
        "metadata",
      );
      if (reason == null || requestedBy == null) {
        return null;
      }

      return Object.freeze({
        reason,
        requestedBy,
      }) as PublicationEventMetadataByType[TType];
    }
  }
}

export function buildPublicationEventIdempotencyKey(
  input: PublicationEventIdentityFields,
): string {
  const normalizedParts = [
    input.eventType.trim(),
    input.subjectType.trim(),
    input.subjectId.trim(),
    input.subjectFingerprint.trim(),
    input.requestId?.trim() ?? "",
  ];

  const hash = createHash("sha256")
    .update(normalizedParts.join("|"))
    .digest("hex");

  return `ipp_evt_${hash}`;
}

export function validatePublicationEventEnvelope<
  TType extends PublicationEventType = PublicationEventType,
>(input: unknown): PublicationEventValidationResult<TType> {
  const issues: PublicationEventValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      issues: cloneIssues([
        {
          path: "",
          message: "Expected an event object.",
        },
      ]),
    };
  }

  const eventId = readRequiredString(input, "eventId", issues);
  const rawEventType = readRequiredString(input, "eventType", issues);
  const occurredAt = readRequiredString(input, "occurredAt", issues);
  const sourceSystem = readRequiredString(input, "sourceSystem", issues);
  const rawSubjectType = readRequiredString(input, "subjectType", issues);
  const subjectId = readRequiredString(input, "subjectId", issues);
  const subjectFingerprint = readRequiredString(
    input,
    "subjectFingerprint",
    issues,
  );
  const priority = readRequiredString(input, "priority", issues);
  const visibility = readRequiredString(input, "visibility", issues);

  const requestIdValue = input.requestId;
  let requestId: string | undefined;
  if (requestIdValue != null) {
    if (!isNonEmptyString(requestIdValue)) {
      issues.push({
        path: "requestId",
        message: "Expected an optional non-empty string.",
      });
    } else {
      requestId = requestIdValue.trim();
    }
  }

  if (occurredAt != null && !isCanonicalIsoTimestamp(occurredAt)) {
    issues.push({
      path: "occurredAt",
      message: "Expected a canonical ISO timestamp.",
    });
  }

  let eventType: PublicationEventType | null = null;
  if (rawEventType != null) {
    if (!hasOwnKey(rawEventType, PUBLICATION_EVENT_TYPES)) {
      issues.push({
        path: "eventType",
        message: `Expected one of: ${PUBLICATION_EVENT_TYPES.join(", ")}.`,
      });
    } else {
      eventType = rawEventType;
    }
  }

  let subjectType: PublicationEventSubjectType | null = null;
  if (rawSubjectType != null) {
    if (!hasOwnKey(rawSubjectType, PUBLICATION_EVENT_SUBJECT_TYPES)) {
      issues.push({
        path: "subjectType",
        message: `Expected one of: ${PUBLICATION_EVENT_SUBJECT_TYPES.join(", ")}.`,
      });
    } else {
      subjectType = rawSubjectType;
    }
  }

  let normalizedPriority: PublicationEventPriority | null = null;
  if (priority != null) {
    if (!hasOwnKey(priority, PUBLICATION_EVENT_PRIORITIES)) {
      issues.push({
        path: "priority",
        message: `Expected one of: ${PUBLICATION_EVENT_PRIORITIES.join(", ")}.`,
      });
    } else {
      normalizedPriority = priority;
    }
  }

  let normalizedVisibility: PublicationEventVisibility | null = null;
  if (visibility != null) {
    if (!hasOwnKey(visibility, PUBLICATION_EVENT_VISIBILITIES)) {
      issues.push({
        path: "visibility",
        message: `Expected one of: ${PUBLICATION_EVENT_VISIBILITIES.join(", ")}.`,
      });
    } else {
      normalizedVisibility = visibility;
    }
  }

  if (eventType != null && subjectType != null) {
    const allowedSubjectTypes = ALLOWED_SUBJECT_TYPES_BY_EVENT_TYPE[eventType];
    if (!allowedSubjectTypes.includes(subjectType)) {
      issues.push({
        path: "subjectType",
        message: `Subject type ${subjectType} is not allowed for event type ${eventType}.`,
      });
    }
  }

  const policyVersions = validatePolicyVersions(input.policyVersions, issues);
  const metadata =
    eventType == null
      ? null
      : validateMetadataByEventType(eventType, input.metadata, issues);

  if (
    issues.length > 0 ||
    eventId == null ||
    eventType == null ||
    occurredAt == null ||
    sourceSystem == null ||
    subjectType == null ||
    subjectId == null ||
    subjectFingerprint == null ||
    normalizedPriority == null ||
    normalizedVisibility == null ||
    policyVersions == null ||
    metadata == null
  ) {
    return {
      ok: false,
      issues: cloneIssues(issues),
    };
  }

  return {
    ok: true,
    event: freezeEvent({
      eventId,
      eventType,
      occurredAt,
      sourceSystem,
      subjectType,
      subjectId,
      subjectFingerprint,
      policyVersions,
      priority: normalizedPriority,
      visibility: normalizedVisibility,
      ...(requestId == null ? {} : { requestId }),
      metadata,
    } as PublicationEventEnvelope<TType>),
  };
}

export function parsePublicationEventEnvelope<
  TType extends PublicationEventType = PublicationEventType,
>(input: unknown): PublicationEventEnvelope<TType> {
  const result = validatePublicationEventEnvelope<TType>(input);
  if (!result.ok) {
    const message = result.issues
      .map((issue) =>
        issue.path.length > 0
          ? `${issue.path}: ${issue.message}`
          : issue.message,
      )
      .join(" | ");
    throw new Error(`Invalid publication event envelope. ${message}`);
  }

  return result.event;
}

export function isCriticalEvent(
  event: Pick<PublicationEventEnvelope, "eventType" | "priority">,
): boolean {
  return event.priority === "P0" || CRITICAL_EVENT_TYPES.has(event.eventType);
}

export function isRepublishEvent(
  event: Pick<PublicationEventEnvelope, "eventType">,
): boolean {
  return REPUBLISH_EVENT_TYPES.has(event.eventType);
}

export function isSuppressionEvent(
  event: Pick<PublicationEventEnvelope, "eventType">,
): boolean {
  return SUPPRESSION_EVENT_TYPES.has(event.eventType);
}

export function isReviewEvent(
  event: Pick<PublicationEventEnvelope, "eventType">,
): boolean {
  return REVIEW_EVENT_TYPES.has(event.eventType);
}

export function isPolicyEvent(
  event: Pick<PublicationEventEnvelope, "eventType">,
): boolean {
  return POLICY_EVENT_TYPES.has(event.eventType);
}

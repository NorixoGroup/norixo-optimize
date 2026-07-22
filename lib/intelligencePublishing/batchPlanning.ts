import { createHash } from "node:crypto";

import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";

export const INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION =
  "ipp_batch_plan_v1" as const;
export const INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION =
  "ipp_batch_planner_v1" as const;

export const INTELLIGENCE_PUBLISHING_BATCH_MODES = Object.freeze([
  "dry_run",
  "execute",
] as const);

export type IntelligencePublishingBatchMode =
  (typeof INTELLIGENCE_PUBLISHING_BATCH_MODES)[number];

export const INTELLIGENCE_PUBLISHING_BATCH_ACTIONS = Object.freeze([
  "generate",
  "publish",
  "refresh",
] as const);

export type IntelligencePublishingBatchAction =
  (typeof INTELLIGENCE_PUBLISHING_BATCH_ACTIONS)[number];

export const INTELLIGENCE_PUBLISHING_BATCH_PLANNED_ITEM_STATUSES = Object.freeze([
  "planned",
  "blocked_input",
] as const);

export type IntelligencePublishingBatchPlannedItemStatus =
  (typeof INTELLIGENCE_PUBLISHING_BATCH_PLANNED_ITEM_STATUSES)[number];

export const INTELLIGENCE_PUBLISHING_BATCH_ITEM_RESULT_STATUSES = Object.freeze([
  "dry_run_validated",
  "skipped_duplicate",
  "skipped_ineligible",
  "blocked",
  "succeeded",
  "failed",
] as const);

export type IntelligencePublishingBatchItemResultStatus =
  (typeof INTELLIGENCE_PUBLISHING_BATCH_ITEM_RESULT_STATUSES)[number];

export const INTELLIGENCE_PUBLISHING_BATCH_STATUSES = Object.freeze([
  "dry_run_completed",
  "completed",
  "completed_with_failures",
  "blocked",
  "failed_validation",
] as const);

export type IntelligencePublishingBatchStatus =
  (typeof INTELLIGENCE_PUBLISHING_BATCH_STATUSES)[number];

export const INTELLIGENCE_PUBLISHING_BATCH_DIAGNOSTIC_CODES = Object.freeze([
  "candidate_normalized",
  "invalid_candidate",
  "blocked_input",
  "duplicate_exact",
  "identity_collision",
  "private_field_detected",
  "unsupported_schema_version",
  "unsupported_planner_version",
  "plan_fingerprint_mismatch",
  "duplicate_item_key",
  "duplicate_sequence",
  "non_contiguous_sequence",
  "item_handler_failed",
  "item_handler_blocked",
  "item_handler_skipped",
  "item_handler_succeeded",
  "dry_run_validated",
  "retry_plan_created",
  "batch_completed",
  "batch_completed_with_failures",
  "batch_blocked",
  "all_items_failed",
] as const);

export type IntelligencePublishingBatchDiagnosticCode =
  (typeof INTELLIGENCE_PUBLISHING_BATCH_DIAGNOSTIC_CODES)[number];

export type IntelligencePublishingBatchDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export type IntelligencePublishingBatchDiagnostic = Readonly<{
  code: IntelligencePublishingBatchDiagnosticCode;
  severity: IntelligencePublishingBatchDiagnosticSeverity;
  candidateId: string | null;
  itemKey: string | null;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type IntelligencePublishingBatchCandidate = Readonly<{
  candidateId: string;
  reportKey: string;
  locale: string;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  priority?: number;
  requestedAction?: IntelligencePublishingBatchAction;
  sourceFingerprint?: string | null;
}>;

export type NormalizedIntelligencePublishingBatchCandidate = Readonly<{
  candidateId: string;
  reportKey: string;
  locale: string;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  priority: number;
  requestedAction: IntelligencePublishingBatchAction;
  sourceFingerprint: string | null;
  candidateFingerprint: string;
  identityFingerprint: string;
}>;

export type IntelligencePublishingBatchPlanItem = Readonly<{
  itemKey: string;
  sequence: number;
  candidate: NormalizedIntelligencePublishingBatchCandidate;
  requestedAction: IntelligencePublishingBatchAction;
  plannedStatus: IntelligencePublishingBatchPlannedItemStatus;
  executable: boolean;
  blockedReasons: readonly string[];
  warningReasons: readonly string[];
  diagnostics: readonly IntelligencePublishingBatchDiagnostic[];
}>;

export type IntelligencePublishingBatchPlan = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION;
  plannerVersion: typeof INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION;
  planFingerprint: string;
  createdAt: string;
  mode: IntelligencePublishingBatchMode;
  candidateCount: number;
  itemCount: number;
  duplicateCount: number;
  items: readonly IntelligencePublishingBatchPlanItem[];
  diagnostics: readonly IntelligencePublishingBatchDiagnostic[];
}>;

export type IntelligencePublishingBatchPlanValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type IntelligencePublishingBatchPlanValidationResult =
  | Readonly<{
      ok: true;
      plan: IntelligencePublishingBatchPlan;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IntelligencePublishingBatchPlanValidationIssue[];
    }>;

export type IntelligencePublishingBatchHandlerResult = Readonly<{
  status: "succeeded" | "blocked" | "skipped" | "failed";
  message?: string;
  retryable?: boolean;
  metadata?: CoordinationJsonObject;
}>;

export type IntelligencePublishingBatchItemResult = Readonly<{
  itemKey: string;
  sequence: number;
  status: IntelligencePublishingBatchItemResultStatus;
  attempted: boolean;
  retryable: boolean;
  requestedAction: IntelligencePublishingBatchAction;
  startedAt: string | null;
  finishedAt: string | null;
  diagnostics: readonly IntelligencePublishingBatchDiagnostic[];
  metadata: CoordinationJsonObject;
}>;

export type IntelligencePublishingBatchResultSummary = Readonly<{
  totalItems: number;
  executableItems: number;
  succeededItems: number;
  failedItems: number;
  blockedItems: number;
  skippedItems: number;
  dryRunItems: number;
  duplicateCandidates: number;
  durationMs: number | null;
}>;

export type IntelligencePublishingBatchResult = Readonly<{
  schemaVersion: typeof INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION;
  plannerVersion: typeof INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION;
  planFingerprint: string;
  resultFingerprint: string;
  createdAt: string;
  status: IntelligencePublishingBatchStatus;
  mode: IntelligencePublishingBatchMode;
  itemResults: readonly IntelligencePublishingBatchItemResult[];
  summary: IntelligencePublishingBatchResultSummary;
  diagnostics: readonly IntelligencePublishingBatchDiagnostic[];
}>;

export type BuildIntelligencePublishingBatchPlanInput = Readonly<{
  candidates: readonly unknown[];
  mode: IntelligencePublishingBatchMode;
  createdAt: string;
}>;

export type ExecuteIntelligencePublishingBatchInput = Readonly<{
  plan: unknown;
  executeItem?: (
    item: IntelligencePublishingBatchPlanItem,
  ) =>
    | IntelligencePublishingBatchHandlerResult
    | Promise<IntelligencePublishingBatchHandlerResult>;
  now: () => string;
}>;

export type BuildRetryBatchPlanInput = Readonly<{
  previousPlan: unknown;
  previousResult: unknown;
  createdAt: string;
  mode?: IntelligencePublishingBatchMode;
  includeBlocked?: boolean;
}>;

export type BuildRetryBatchPlanResult = Readonly<{
  plan: IntelligencePublishingBatchPlan;
  retriedItemKeys: readonly string[];
}>;

export class IntelligencePublishingBatchError extends Error {
  readonly code:
    | "invalid_candidate"
    | "private_field_detected"
    | "identity_collision"
    | "invalid_plan"
    | "handler_missing";
  readonly diagnostics: readonly IntelligencePublishingBatchDiagnostic[];

  constructor(
    input: Readonly<{
      code:
        | "invalid_candidate"
        | "private_field_detected"
        | "identity_collision"
        | "invalid_plan"
        | "handler_missing";
      message: string;
      diagnostics?: readonly IntelligencePublishingBatchDiagnostic[];
    }>,
  ) {
    super(input.message);
    this.name = "IntelligencePublishingBatchError";
    this.code = input.code;
    this.diagnostics = Object.freeze([...(input.diagnostics ?? [])]);
  }
}

const FORBIDDEN_PRIVATE_KEYS = new Set([
  "userid",
  "workspaceid",
  "auditid",
  "listingurl",
  "rawpayload",
  "rawobservation",
  "secret",
  "token",
  "localpath",
  "filepath",
  "pathname",
]);

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreeze(entry));
    return Object.freeze(value);
  }
  if (typeof value === "object" && value != null) {
    Object.values(value as Record<string, unknown>).forEach((entry) =>
      deepFreeze(entry),
    );
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString() === value;
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
}

function isJsonSafe(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): value is CoordinationJsonValue {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (
    typeof value === "undefined" ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.every((entry) => isJsonSafe(entry, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every((entry) =>
      isJsonSafe(entry, seen),
    );
  }
  return false;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): CoordinationJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "undefined") {
    throw new Error("Undefined values are not JSON-safe.");
  }
  if (typeof value === "number") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => sortJsonValue(entry)));
  }
  if (!isPlainObject(value)) {
    throw new Error("Expected a plain JSON-safe object.");
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value)
        .sort((left, right) => compareStrings(left[0], right[0]))
        .map(([key, entry]) => [key, sortJsonValue(entry)]),
    ),
  );
}

function buildStableHash(prefix: string, value: unknown): string {
  return `${prefix}${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function assertNoForbiddenPrivateKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoForbiddenPrivateKeys(entry, `${path}[${index}]`),
    );
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (FORBIDDEN_PRIVATE_KEYS.has(normalizedKey)) {
      throw new Error(`Forbidden private field detected at ${path}.${key}`);
    }
    assertNoForbiddenPrivateKeys(child, `${path}.${key}`);
  }
}

function freezeMetadata(value: CoordinationJsonObject): CoordinationJsonObject {
  if (!isJsonSafe(value)) {
    throw new Error("Expected a JSON-safe metadata object.");
  }
  assertNoForbiddenPrivateKeys(value, "metadata");
  return deepFreeze(sortJsonValue(value) as CoordinationJsonObject);
}

function buildDiagnostic(
  input: Readonly<{
    code: IntelligencePublishingBatchDiagnosticCode;
    severity: IntelligencePublishingBatchDiagnosticSeverity;
    candidateId?: string | null;
    itemKey?: string | null;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): IntelligencePublishingBatchDiagnostic {
  const metadata = freezeMetadata(input.metadata ?? {});
  return deepFreeze({
    code: input.code,
    severity: input.severity,
    candidateId: input.candidateId ?? null,
    itemKey: input.itemKey ?? null,
    message: input.message,
    metadata,
  });
}

function normalizeAction(
  value: unknown,
): IntelligencePublishingBatchAction | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  const normalized = normalizeText(value);
  return INTELLIGENCE_PUBLISHING_BATCH_ACTIONS.includes(
    normalized as IntelligencePublishingBatchAction,
  )
    ? (normalized as IntelligencePublishingBatchAction)
    : null;
}

function normalizeCandidate(
  input: unknown,
): Readonly<{
  ok: true;
  candidate: NormalizedIntelligencePublishingBatchCandidate;
}> | Readonly<{
  ok: false;
  code: "invalid_candidate" | "private_field_detected";
  rawFingerprint: string;
  candidateId: string | null;
  issues: readonly string[];
}> {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      code: "invalid_candidate",
      rawFingerprint: buildStableHash("ipp_batch_invalid_candidate_", { input }),
      candidateId: null,
      issues: Object.freeze(["Expected a plain candidate object."]),
    };
  }
  try {
    assertNoForbiddenPrivateKeys(input, "candidate");
  } catch (error) {
    return {
      ok: false,
      code: "private_field_detected",
      rawFingerprint: buildStableHash("ipp_batch_invalid_candidate_", input),
      candidateId: isNonEmptyString(input.candidateId) ? input.candidateId : null,
      issues: Object.freeze([
        error instanceof Error ? error.message : "Forbidden private field detected.",
      ]),
    };
  }

  const issues: string[] = [];
  const candidateId = isNonEmptyString(input.candidateId)
    ? input.candidateId.trim()
    : null;
  const reportKey = isNonEmptyString(input.reportKey)
    ? normalizeText(input.reportKey)
    : null;
  const locale = isNonEmptyString(input.locale)
    ? normalizeText(input.locale)
    : null;
  const country = isNonEmptyString(input.country)
    ? normalizeText(input.country)
    : null;
  const city = isNonEmptyString(input.city)
    ? normalizeText(input.city)
    : null;
  const platform = isNonEmptyString(input.platform)
    ? normalizeText(input.platform)
    : null;
  const propertyType = isNonEmptyString(input.propertyType)
    ? normalizeText(input.propertyType)
    : null;
  const priority =
    typeof input.priority === "number" && Number.isFinite(input.priority)
      ? input.priority
      : 100;
  const requestedAction =
    normalizeAction(input.requestedAction) ?? ("publish" as const);
  const sourceFingerprint =
    input.sourceFingerprint == null
      ? null
      : isNonEmptyString(input.sourceFingerprint)
        ? input.sourceFingerprint.trim()
        : null;

  if (candidateId == null) {
    issues.push("candidateId must be a non-empty string.");
  }
  if (reportKey == null) {
    issues.push("reportKey must be a non-empty string.");
  }
  if (locale == null) {
    issues.push("locale must be a non-empty string.");
  }
  if (country == null) {
    issues.push("country must be a non-empty string.");
  }
  if (city == null) {
    issues.push("city must be a non-empty string.");
  }
  if (platform == null) {
    issues.push("platform must be a non-empty string.");
  }
  if (propertyType == null) {
    issues.push("propertyType must be a non-empty string.");
  }
  if (!Number.isFinite(priority)) {
    issues.push("priority must be a finite number when provided.");
  }
  if (input.requestedAction != null && normalizeAction(input.requestedAction) == null) {
    issues.push("requestedAction must be generate, publish or refresh.");
  }
  if (
    input.sourceFingerprint != null &&
    !isNonEmptyString(input.sourceFingerprint)
  ) {
    issues.push("sourceFingerprint must be null or a non-empty string.");
  }

  if (issues.length > 0) {
    return {
      ok: false,
      code: "invalid_candidate",
      rawFingerprint: buildStableHash("ipp_batch_invalid_candidate_", {
        candidateId,
        reportKey,
        locale,
        country,
        city,
        platform,
        propertyType,
        priority,
        requestedAction,
        sourceFingerprint,
      }),
      candidateId,
      issues: Object.freeze(issues),
    };
  }

  const identityFingerprint = buildStableHash("ipp_batch_identity_", {
    reportKey,
    locale,
    country,
    city,
    platform,
    propertyType,
    requestedAction,
    sourceFingerprint,
  });
  const candidateFingerprint = buildStableHash("ipp_batch_candidate_", {
    reportKey,
    locale,
    country,
    city,
    platform,
    propertyType,
    priority,
    requestedAction,
    sourceFingerprint,
  });

  return {
    ok: true,
    candidate: deepFreeze({
      candidateId: candidateId!,
      reportKey: reportKey!,
      locale: locale!,
      country: country!,
      city: city!,
      platform: platform!,
      propertyType: propertyType!,
      priority,
      requestedAction,
      sourceFingerprint,
      candidateFingerprint,
      identityFingerprint,
    }),
  };
}

function compareCandidates(
  left: NormalizedIntelligencePublishingBatchCandidate,
  right: NormalizedIntelligencePublishingBatchCandidate,
): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }
  const localeOrder = compareStrings(left.locale, right.locale);
  if (localeOrder !== 0) {
    return localeOrder;
  }
  const countryOrder = compareStrings(left.country, right.country);
  if (countryOrder !== 0) {
    return countryOrder;
  }
  const cityOrder = compareStrings(left.city, right.city);
  if (cityOrder !== 0) {
    return cityOrder;
  }
  const platformOrder = compareStrings(left.platform, right.platform);
  if (platformOrder !== 0) {
    return platformOrder;
  }
  const propertyTypeOrder = compareStrings(left.propertyType, right.propertyType);
  if (propertyTypeOrder !== 0) {
    return propertyTypeOrder;
  }
  const reportKeyOrder = compareStrings(left.reportKey, right.reportKey);
  if (reportKeyOrder !== 0) {
    return reportKeyOrder;
  }
  const actionOrder = compareStrings(left.requestedAction, right.requestedAction);
  if (actionOrder !== 0) {
    return actionOrder;
  }
  const identityOrder = compareStrings(
    left.identityFingerprint,
    right.identityFingerprint,
  );
  if (identityOrder !== 0) {
    return identityOrder;
  }
  return compareStrings(left.candidateId, right.candidateId);
}

function buildItemKey(
  candidate: NormalizedIntelligencePublishingBatchCandidate,
): string {
  return buildStableHash("ipp_batch_item_", {
    reportKey: candidate.reportKey,
    locale: candidate.locale,
    country: candidate.country,
    city: candidate.city,
    platform: candidate.platform,
    propertyType: candidate.propertyType,
    requestedAction: candidate.requestedAction,
    sourceFingerprint: candidate.sourceFingerprint,
  });
}

function buildPlanFingerprint(input: Readonly<{
  mode: IntelligencePublishingBatchMode;
  candidateCount: number;
  duplicateCount: number;
  items: readonly IntelligencePublishingBatchPlanItem[];
  diagnostics: readonly IntelligencePublishingBatchDiagnostic[];
}>): string {
  return buildStableHash("ipp_batch_plan_", {
    schemaVersion: INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION,
    plannerVersion: INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION,
    mode: input.mode,
    candidateCount: input.candidateCount,
    duplicateCount: input.duplicateCount,
    items: input.items.map((item) => ({
      itemKey: item.itemKey,
      sequence: item.sequence,
      plannedStatus: item.plannedStatus,
      candidate: {
        reportKey: item.candidate.reportKey,
        locale: item.candidate.locale,
        country: item.candidate.country,
        city: item.candidate.city,
        platform: item.candidate.platform,
        propertyType: item.candidate.propertyType,
        priority: item.candidate.priority,
        requestedAction: item.candidate.requestedAction,
        sourceFingerprint: item.candidate.sourceFingerprint,
      },
      blockedReasons: item.blockedReasons,
      warningReasons: item.warningReasons,
    })),
    diagnostics: input.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      itemKey: diagnostic.itemKey,
      message: diagnostic.message,
      metadata: diagnostic.metadata,
    })),
  });
}

export function recomputeIntelligencePublishingBatchPlanFingerprint(input: Readonly<{
  mode: IntelligencePublishingBatchMode;
  candidateCount: number;
  duplicateCount: number;
  items: readonly IntelligencePublishingBatchPlanItem[];
  diagnostics: readonly IntelligencePublishingBatchDiagnostic[];
}>): string {
  return buildPlanFingerprint(input);
}

function deriveBatchStatus(
  mode: IntelligencePublishingBatchMode,
  itemResults: readonly IntelligencePublishingBatchItemResult[],
): IntelligencePublishingBatchStatus {
  if (mode === "dry_run") {
    return "dry_run_completed";
  }
  if (itemResults.length === 0) {
    return "blocked";
  }
  const failedCount = itemResults.filter((item) => item.status === "failed").length;
  const succeededCount = itemResults.filter((item) => item.status === "succeeded").length;
  const blockedCount = itemResults.filter((item) => item.status === "blocked").length;
  if (failedCount > 0) {
    return "completed_with_failures";
  }
  if (succeededCount === 0 && blockedCount === itemResults.length) {
    return "blocked";
  }
  return "completed";
}

function buildResultFingerprint(input: Readonly<{
  planFingerprint: string;
  status: IntelligencePublishingBatchStatus;
  itemResults: readonly IntelligencePublishingBatchItemResult[];
  summary: IntelligencePublishingBatchResultSummary;
}>): string {
  return buildStableHash("ipp_batch_result_", {
    schemaVersion: INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION,
    plannerVersion: INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION,
    planFingerprint: input.planFingerprint,
    status: input.status,
    itemResults: input.itemResults.map((item) => ({
      itemKey: item.itemKey,
      sequence: item.sequence,
      status: item.status,
      attempted: item.attempted,
      retryable: item.retryable,
      requestedAction: item.requestedAction,
      diagnostics: item.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        itemKey: diagnostic.itemKey,
        message: diagnostic.message,
        metadata: diagnostic.metadata,
      })),
      metadata: item.metadata,
    })),
    summary: {
      totalItems: input.summary.totalItems,
      executableItems: input.summary.executableItems,
      succeededItems: input.summary.succeededItems,
      failedItems: input.summary.failedItems,
      blockedItems: input.summary.blockedItems,
      skippedItems: input.summary.skippedItems,
      dryRunItems: input.summary.dryRunItems,
      duplicateCandidates: input.summary.duplicateCandidates,
    },
  });
}

function freezePlanItem(item: IntelligencePublishingBatchPlanItem): IntelligencePublishingBatchPlanItem {
  return deepFreeze({
    ...item,
    blockedReasons: Object.freeze([...item.blockedReasons]),
    warningReasons: Object.freeze([...item.warningReasons]),
    diagnostics: Object.freeze([...item.diagnostics]),
  });
}

function freezeItemResult(
  item: IntelligencePublishingBatchItemResult,
): IntelligencePublishingBatchItemResult {
  return deepFreeze({
    ...item,
    diagnostics: Object.freeze([...item.diagnostics]),
    metadata: freezeMetadata(item.metadata),
  });
}

export function buildIntelligencePublishingBatchPlan(
  input: BuildIntelligencePublishingBatchPlanInput,
): IntelligencePublishingBatchPlan {
  if (!INTELLIGENCE_PUBLISHING_BATCH_MODES.includes(input.mode)) {
    throw new IntelligencePublishingBatchError({
      code: "invalid_plan",
      message: `Unsupported batch mode ${String(input.mode)}.`,
    });
  }
  if (!isCanonicalIsoTimestamp(input.createdAt)) {
    throw new IntelligencePublishingBatchError({
      code: "invalid_plan",
      message: "createdAt must be a canonical ISO timestamp.",
    });
  }

  const diagnostics: IntelligencePublishingBatchDiagnostic[] = [];
  const normalizedCandidates: NormalizedIntelligencePublishingBatchCandidate[] = [];

  for (const candidateInput of input.candidates) {
    const normalized = normalizeCandidate(candidateInput);
    if (!normalized.ok) {
      if (normalized.code === "private_field_detected") {
        throw new IntelligencePublishingBatchError({
          code: "private_field_detected",
          message: normalized.issues.join(" | "),
          diagnostics: [
            buildDiagnostic({
              code: "private_field_detected",
              severity: "error",
              candidateId: normalized.candidateId,
              message: normalized.issues.join(" | "),
              metadata: freezeMetadata({
                rawFingerprint: normalized.rawFingerprint,
              }),
            }),
          ],
        });
      }
      diagnostics.push(
        buildDiagnostic({
          code: normalized.code,
          severity: "error",
          candidateId: normalized.candidateId,
          message: normalized.issues.join(" | "),
          metadata: freezeMetadata({
            rawFingerprint: normalized.rawFingerprint,
          }),
        }),
      );
      continue;
    }
    diagnostics.push(
      buildDiagnostic({
        code: "candidate_normalized",
        severity: "info",
        candidateId: normalized.candidate.candidateId,
        message: "A public-safe candidate was normalized for batch planning.",
        metadata: freezeMetadata({
          identityFingerprint: normalized.candidate.identityFingerprint,
        }),
      }),
    );
    normalizedCandidates.push(normalized.candidate);
  }

  const groupsByItemKey = new Map<
    string,
    readonly NormalizedIntelligencePublishingBatchCandidate[]
  >();
  for (const candidate of normalizedCandidates) {
    const itemKey = buildItemKey(candidate);
    const current = groupsByItemKey.get(itemKey) ?? [];
    groupsByItemKey.set(itemKey, [...current, candidate]);
  }

  const keptCandidates: NormalizedIntelligencePublishingBatchCandidate[] = [];
  let duplicateCount = 0;

  for (const [itemKey, group] of [...groupsByItemKey.entries()].sort((left, right) =>
    compareStrings(left[0], right[0]),
  )) {
    const sortedGroup = [...group].sort(compareCandidates);
    const canonical = sortedGroup[0]!;
    const canonicalFingerprint = canonical.candidateFingerprint;
    const contradictory = sortedGroup.filter(
      (candidate) => candidate.candidateFingerprint !== canonicalFingerprint,
    );
    if (contradictory.length > 0) {
      const collisionDiagnostics = sortedGroup.map((candidate) =>
        buildDiagnostic({
          code: "identity_collision",
          severity: "error",
          candidateId: candidate.candidateId,
          itemKey,
          message:
            "Candidates share the same logical identity but carry contradictory normalized payloads.",
          metadata: freezeMetadata({
            candidateFingerprint: candidate.candidateFingerprint,
            identityFingerprint: candidate.identityFingerprint,
          }),
        }),
      );
      throw new IntelligencePublishingBatchError({
        code: "identity_collision",
        message: `Contradictory candidates share the same item identity ${itemKey}.`,
        diagnostics: collisionDiagnostics,
      });
    }
    keptCandidates.push(canonical);
    const duplicates = sortedGroup.slice(1);
    duplicateCount += duplicates.length;
    if (duplicates.length > 0) {
      diagnostics.push(
        buildDiagnostic({
          code: "duplicate_exact",
          severity: "warning",
          candidateId: canonical.candidateId,
          itemKey,
          message:
            "Exact duplicate candidates were deduplicated before batch execution.",
          metadata: freezeMetadata({
            duplicateCount: duplicates.length,
            duplicateCandidateIds: duplicates
              .map((candidate) => candidate.candidateId)
              .sort(compareStrings),
          }),
        }),
      );
    }
  }

  const sortedCandidates = [...keptCandidates].sort(compareCandidates);
  const items = sortedCandidates.map((candidate, index) =>
    freezePlanItem({
      itemKey: buildItemKey(candidate),
      sequence: index + 1,
      candidate,
      requestedAction: candidate.requestedAction,
      plannedStatus: "planned",
      executable: true,
      blockedReasons: Object.freeze([]),
      warningReasons: Object.freeze([]),
      diagnostics: Object.freeze([]),
    }),
  );

  const planDiagnostics = deepFreeze(
    diagnostics.sort((left, right) => {
      const codeOrder = compareStrings(left.code, right.code);
      if (codeOrder !== 0) {
        return codeOrder;
      }
      const itemOrder = compareStrings(left.itemKey ?? "", right.itemKey ?? "");
      if (itemOrder !== 0) {
        return itemOrder;
      }
      return compareStrings(left.candidateId ?? "", right.candidateId ?? "");
    }),
  );

  const plan = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION,
    plannerVersion: INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION,
    planFingerprint: "",
    createdAt: input.createdAt,
    mode: input.mode,
    candidateCount: input.candidates.length,
    itemCount: items.length,
    duplicateCount,
    items,
    diagnostics: planDiagnostics,
  });

  const finalized = deepFreeze({
    ...plan,
    planFingerprint: buildPlanFingerprint({
      mode: plan.mode,
      candidateCount: plan.candidateCount,
      duplicateCount: plan.duplicateCount,
      items: plan.items,
      diagnostics: plan.diagnostics,
    }),
  });

  const validation = validateIntelligencePublishingBatchPlan(finalized);
  if (!validation.ok) {
    throw new IntelligencePublishingBatchError({
      code: "invalid_plan",
      message: validation.issues.map((issue) => issue.message).join(" | "),
    });
  }

  return validation.plan;
}

export function validateIntelligencePublishingBatchPlan(
  input: unknown,
): IntelligencePublishingBatchPlanValidationResult {
  const issues: IntelligencePublishingBatchPlanValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          path: "",
          message: "Expected a batch plan object.",
        },
      ]),
    };
  }

  try {
    assertNoForbiddenPrivateKeys(input, "plan");
  } catch (error) {
    issues.push({
      path: "",
      message: error instanceof Error ? error.message : "Forbidden private field detected.",
    });
  }

  const candidate = input as Partial<IntelligencePublishingBatchPlan>;
  if (candidate.schemaVersion !== INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION) {
    issues.push({
      path: "schemaVersion",
      message: "Unsupported schemaVersion.",
    });
  }
  if (candidate.plannerVersion !== INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION) {
    issues.push({
      path: "plannerVersion",
      message: "Unsupported plannerVersion.",
    });
  }
  if (!isCanonicalIsoTimestamp(candidate.createdAt ?? "")) {
    issues.push({
      path: "createdAt",
      message: "createdAt must be a canonical ISO timestamp.",
    });
  }
  if (!INTELLIGENCE_PUBLISHING_BATCH_MODES.includes(candidate.mode as IntelligencePublishingBatchMode)) {
    issues.push({
      path: "mode",
      message: "mode must be dry_run or execute.",
    });
  }
  for (const field of ["candidateCount", "itemCount", "duplicateCount"] as const) {
    if (!isFiniteInteger(candidate[field])) {
      issues.push({
        path: field,
        message: `${field} must be a finite integer.`,
      });
    }
  }
  if (!Array.isArray(candidate.items)) {
    issues.push({
      path: "items",
      message: "items must be an array.",
    });
  }
  if (!Array.isArray(candidate.diagnostics)) {
    issues.push({
      path: "diagnostics",
      message: "diagnostics must be an array.",
    });
  }
  if (!isNonEmptyString(candidate.planFingerprint)) {
    issues.push({
      path: "planFingerprint",
      message: "planFingerprint must be a non-empty string.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  const items = candidate.items as readonly IntelligencePublishingBatchPlanItem[];
  const seenItemKeys = new Set<string>();
  const seenSequences = new Set<number>();

  items.forEach((item, index) => {
    if (!isNonEmptyString(item.itemKey)) {
      issues.push({
        path: `items.${index}.itemKey`,
        message: "itemKey must be a non-empty string.",
      });
      return;
    }
    if (seenItemKeys.has(item.itemKey)) {
      issues.push({
        path: `items.${index}.itemKey`,
        message: "itemKey must be unique.",
      });
    }
    seenItemKeys.add(item.itemKey);
    if (!isFiniteInteger(item.sequence) || item.sequence <= 0) {
      issues.push({
        path: `items.${index}.sequence`,
        message: "sequence must be a positive integer.",
      });
    } else if (seenSequences.has(item.sequence)) {
      issues.push({
        path: `items.${index}.sequence`,
        message: "sequence must be unique.",
      });
    } else {
      seenSequences.add(item.sequence);
    }
    if (
      !INTELLIGENCE_PUBLISHING_BATCH_PLANNED_ITEM_STATUSES.includes(
        item.plannedStatus,
      )
    ) {
      issues.push({
        path: `items.${index}.plannedStatus`,
        message: "plannedStatus is invalid.",
      });
    }
    if (!isJsonSafe(item.candidate) || !isJsonSafe(item.diagnostics)) {
      issues.push({
        path: `items.${index}`,
        message: "item payload must be JSON-safe.",
      });
    }
  });

  const orderedSequences = [...seenSequences].sort((left, right) => left - right);
  orderedSequences.forEach((sequence, index) => {
    if (sequence !== index + 1) {
      issues.push({
        path: "items",
        message: "Item sequences must be continuous starting at 1.",
      });
    }
  });

  if (candidate.itemCount !== items.length) {
    issues.push({
      path: "itemCount",
      message: "itemCount must equal items.length.",
    });
  }

  const recomputedFingerprint = buildPlanFingerprint({
    mode: candidate.mode as IntelligencePublishingBatchMode,
    candidateCount: candidate.candidateCount as number,
    duplicateCount: candidate.duplicateCount as number,
    items,
    diagnostics:
      (candidate.diagnostics as readonly IntelligencePublishingBatchDiagnostic[]) ?? [],
  });
  if (candidate.planFingerprint !== recomputedFingerprint) {
    issues.push({
      path: "planFingerprint",
      message: "planFingerprint does not match the normalized plan payload.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues),
    };
  }

  return {
    ok: true,
    plan: deepFreeze(input as IntelligencePublishingBatchPlan),
  };
}

export async function executeIntelligencePublishingBatch(
  input: ExecuteIntelligencePublishingBatchInput,
): Promise<IntelligencePublishingBatchResult> {
  const validation = validateIntelligencePublishingBatchPlan(input.plan);
  if (!validation.ok) {
    throw new IntelligencePublishingBatchError({
      code: "invalid_plan",
      message: validation.issues.map((issue) => issue.message).join(" | "),
    });
  }
  const plan = validation.plan;
  if (plan.mode === "execute" && typeof input.executeItem !== "function") {
    throw new IntelligencePublishingBatchError({
      code: "handler_missing",
      message: "executeItem must be provided when plan.mode is execute.",
    });
  }

  const resultDiagnostics: IntelligencePublishingBatchDiagnostic[] = [];
  const itemResults: IntelligencePublishingBatchItemResult[] = [];
  const startedAt = input.now();

  for (const item of [...plan.items].sort((left, right) => left.sequence - right.sequence)) {
    if (item.plannedStatus !== "planned") {
      const blockedDiagnostic = buildDiagnostic({
        code: "blocked_input",
        severity: "warning",
        candidateId: item.candidate.candidateId,
        itemKey: item.itemKey,
        message: "The item is blocked before execution and will not call the handler.",
      });
      resultDiagnostics.push(blockedDiagnostic);
      itemResults.push(
        freezeItemResult({
          itemKey: item.itemKey,
          sequence: item.sequence,
          status: "blocked",
          attempted: false,
          retryable: false,
          requestedAction: item.requestedAction,
          startedAt: null,
          finishedAt: null,
          diagnostics: Object.freeze([blockedDiagnostic]),
          metadata: freezeMetadata({}),
        }),
      );
      continue;
    }

    if (plan.mode === "dry_run") {
      const dryRunDiagnostic = buildDiagnostic({
        code: "dry_run_validated",
        severity: "info",
        candidateId: item.candidate.candidateId,
        itemKey: item.itemKey,
        message: "The item was validated in dry-run mode without executing the handler.",
      });
      resultDiagnostics.push(dryRunDiagnostic);
      itemResults.push(
        freezeItemResult({
          itemKey: item.itemKey,
          sequence: item.sequence,
          status: "dry_run_validated",
          attempted: false,
          retryable: false,
          requestedAction: item.requestedAction,
          startedAt: null,
          finishedAt: null,
          diagnostics: Object.freeze([dryRunDiagnostic]),
          metadata: freezeMetadata({}),
        }),
      );
      continue;
    }

    const itemStartedAt = input.now();
    try {
      const handlerResult = await input.executeItem!(item);
      const metadata = freezeMetadata(handlerResult.metadata ?? {});
      let status: IntelligencePublishingBatchItemResultStatus;
      let retryable = false;
      let code: IntelligencePublishingBatchDiagnosticCode;
      let severity: IntelligencePublishingBatchDiagnosticSeverity;

      switch (handlerResult.status) {
        case "succeeded":
          status = "succeeded";
          code = "item_handler_succeeded";
          severity = "info";
          break;
        case "blocked":
          status = "blocked";
          code = "item_handler_blocked";
          severity = "warning";
          break;
        case "skipped":
          status = "skipped_ineligible";
          code = "item_handler_skipped";
          severity = "warning";
          break;
        case "failed":
        default:
          status = "failed";
          retryable = handlerResult.retryable ?? false;
          code = "item_handler_failed";
          severity = "error";
          break;
      }

      const diagnostic = buildDiagnostic({
        code,
        severity,
        candidateId: item.candidate.candidateId,
        itemKey: item.itemKey,
        message:
          handlerResult.message ??
          `The item completed with status ${handlerResult.status}.`,
        metadata,
      });
      resultDiagnostics.push(diagnostic);
      itemResults.push(
        freezeItemResult({
          itemKey: item.itemKey,
          sequence: item.sequence,
          status,
          attempted: true,
          retryable,
          requestedAction: item.requestedAction,
          startedAt: itemStartedAt,
          finishedAt: input.now(),
          diagnostics: Object.freeze([diagnostic]),
          metadata,
        }),
      );
    } catch (error) {
      const diagnostic = buildDiagnostic({
        code: "item_handler_failed",
        severity: "error",
        candidateId: item.candidate.candidateId,
        itemKey: item.itemKey,
        message:
          error instanceof Error ? error.message : "The item handler threw an exception.",
        metadata: freezeMetadata({
          thrown: true,
        }),
      });
      resultDiagnostics.push(diagnostic);
      itemResults.push(
        freezeItemResult({
          itemKey: item.itemKey,
          sequence: item.sequence,
          status: "failed",
          attempted: true,
          retryable: true,
          requestedAction: item.requestedAction,
          startedAt: itemStartedAt,
          finishedAt: input.now(),
          diagnostics: Object.freeze([diagnostic]),
          metadata: freezeMetadata({ thrown: true }),
        }),
      );
    }
  }

  const summary = deepFreeze({
    totalItems: itemResults.length,
    executableItems: plan.items.filter((item) => item.executable).length,
    succeededItems: itemResults.filter((item) => item.status === "succeeded").length,
    failedItems: itemResults.filter((item) => item.status === "failed").length,
    blockedItems: itemResults.filter((item) => item.status === "blocked").length,
    skippedItems: itemResults.filter((item) =>
      item.status === "skipped_duplicate" || item.status === "skipped_ineligible",
    ).length,
    dryRunItems: itemResults.filter((item) => item.status === "dry_run_validated").length,
    duplicateCandidates: plan.duplicateCount,
    durationMs:
      Date.parse(startedAt) <= Date.parse(input.now())
        ? Date.parse(input.now()) - Date.parse(startedAt)
        : null,
  });

  const status = deriveBatchStatus(plan.mode, itemResults);
  resultDiagnostics.push(
    buildDiagnostic({
      code:
        status === "completed"
          ? "batch_completed"
          : status === "completed_with_failures"
            ? "batch_completed_with_failures"
            : status === "blocked"
              ? "batch_blocked"
              : "batch_completed",
      severity: status === "completed_with_failures" ? "warning" : "info",
      message: `Batch finished with status ${status}.`,
      metadata: freezeMetadata({
        totalItems: summary.totalItems,
        failedItems: summary.failedItems,
      }),
    }),
  );
  if (
    plan.mode === "execute" &&
    summary.totalItems > 0 &&
    summary.failedItems === summary.totalItems
  ) {
    resultDiagnostics.push(
      buildDiagnostic({
        code: "all_items_failed",
        severity: "warning",
        message: "Every executable item failed during batch execution.",
        metadata: freezeMetadata({
          totalItems: summary.totalItems,
        }),
      }),
    );
  }

  const finalizedItemResults = deepFreeze(
    [...itemResults].sort((left, right) => left.sequence - right.sequence),
  );
  const finalizedDiagnostics = deepFreeze(resultDiagnostics);

  const result = deepFreeze({
    schemaVersion: INTELLIGENCE_PUBLISHING_BATCH_PLAN_SCHEMA_VERSION,
    plannerVersion: INTELLIGENCE_PUBLISHING_BATCH_PLANNER_VERSION,
    planFingerprint: plan.planFingerprint,
    resultFingerprint: "",
    createdAt: startedAt,
    status,
    mode: plan.mode,
    itemResults: finalizedItemResults,
    summary,
    diagnostics: finalizedDiagnostics,
  });

  return deepFreeze({
    ...result,
    resultFingerprint: buildResultFingerprint({
      planFingerprint: plan.planFingerprint,
      status,
      itemResults: finalizedItemResults,
      summary,
    }),
  });
}

export function buildRetryIntelligencePublishingBatchPlan(
  input: BuildRetryBatchPlanInput,
): BuildRetryBatchPlanResult {
  const planValidation = validateIntelligencePublishingBatchPlan(input.previousPlan);
  if (!planValidation.ok) {
    throw new IntelligencePublishingBatchError({
      code: "invalid_plan",
      message: planValidation.issues.map((issue) => issue.message).join(" | "),
    });
  }

  const result = input.previousResult as Partial<IntelligencePublishingBatchResult>;
  if (!isPlainObject(result) || !Array.isArray(result.itemResults)) {
    throw new IntelligencePublishingBatchError({
      code: "invalid_plan",
      message: "previousResult must contain an itemResults array.",
    });
  }
  if (result.planFingerprint !== planValidation.plan.planFingerprint) {
    throw new IntelligencePublishingBatchError({
      code: "invalid_plan",
      message: "previousResult.planFingerprint must match previousPlan.planFingerprint.",
    });
  }

  const retryableStatuses = new Set<IntelligencePublishingBatchItemResultStatus>([
    "failed",
    ...(input.includeBlocked ? (["blocked"] as const) : []),
  ]);
  const retryItems = (result.itemResults as readonly IntelligencePublishingBatchItemResult[])
    .filter((item) => retryableStatuses.has(item.status))
    .map((item) =>
      planValidation.plan.items.find((planItem) => planItem.itemKey === item.itemKey) ?? null,
    )
    .filter((item): item is IntelligencePublishingBatchPlanItem => item != null);

  const retryPlan = buildIntelligencePublishingBatchPlan({
    candidates: retryItems.map((item) => ({
      candidateId: item.candidate.candidateId,
      reportKey: item.candidate.reportKey,
      locale: item.candidate.locale,
      country: item.candidate.country,
      city: item.candidate.city,
      platform: item.candidate.platform,
      propertyType: item.candidate.propertyType,
      priority: item.candidate.priority,
      requestedAction: item.candidate.requestedAction,
      sourceFingerprint: item.candidate.sourceFingerprint,
    })),
    mode: input.mode ?? "execute",
    createdAt: input.createdAt,
  });

  return deepFreeze({
    plan: retryPlan,
    retriedItemKeys: Object.freeze(
      retryPlan.items.map((item) => item.itemKey).sort(compareStrings),
    ),
  });
}

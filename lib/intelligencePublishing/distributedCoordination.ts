export type CoordinationJsonPrimitive = string | number | boolean | null;

export type CoordinationJsonValue =
  | CoordinationJsonPrimitive
  | Readonly<{ [key: string]: CoordinationJsonValue }>
  | readonly CoordinationJsonValue[];

export type CoordinationJsonObject = Readonly<{
  [key: string]: CoordinationJsonValue;
}>;

export const LOCK_RESOURCE_TYPES = Object.freeze([
  "event",
  "impact_plan",
  "orchestration_run",
  "job",
  "asset",
  "asset_version",
  "publication_destination",
] as const);

export type LockResourceType = (typeof LOCK_RESOURCE_TYPES)[number];

export type LockResource = Readonly<{
  resourceType: LockResourceType;
  resourceId: string;
  scope: string | null;
  partitionKey: string | null;
}>;

export const DISTRIBUTED_LOCK_STATUSES = Object.freeze([
  "active",
  "expired",
  "released",
  "superseded",
] as const);

export type DistributedLockStatus =
  (typeof DISTRIBUTED_LOCK_STATUSES)[number];

export type DistributedLock = Readonly<{
  lockKey: string;
  resourceType: LockResourceType;
  resourceId: string;
  ownerId: string;
  ownerEpoch: number;
  fencingToken: number;
  acquiredAt: string;
  renewedAt: string;
  expiresAt: string;
  releasedAt: string | null;
  status: DistributedLockStatus;
  metadata: CoordinationJsonObject;
}>;

export const IDEMPOTENCY_STATUSES = Object.freeze([
  "pending",
  "in_progress",
  "completed",
  "failed_retryable",
  "failed_permanent",
  "expired",
  "superseded",
] as const);

export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUSES)[number];

export type IdempotencyRecord = Readonly<{
  idempotencyKey: string;
  operationType: string;
  subjectType: string;
  subjectId: string;
  requestFingerprint: string;
  status: IdempotencyStatus;
  ownerId: string;
  ownerEpoch: number;
  fencingToken: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  resultFingerprint: string | null;
  failureCode: string | null;
  metadata: CoordinationJsonObject;
}>;

export type LockAcquisitionOutcome =
  | "acquired"
  | "renewed"
  | "rejected_active_owner"
  | "rejected_stale_owner_epoch"
  | "takeover_expired_lock"
  | "idempotent_owner_noop";

export type LockRenewalOutcome =
  | "renewed"
  | "idempotent_noop"
  | "rejected_not_owner"
  | "rejected_fencing_token"
  | "rejected_expired"
  | "rejected_inactive";

export type LockReleaseOutcome =
  | "released"
  | "idempotent_noop"
  | "rejected_not_owner"
  | "rejected_fencing_token"
  | "rejected_expired"
  | "rejected_inactive";

export type FencingValidationOutcome =
  | "valid"
  | "invalid_owner"
  | "invalid_epoch"
  | "stale_fencing_token"
  | "inactive_lock"
  | "expired_lock";

export type IdempotencyStartOutcome =
  | "start_new"
  | "resume_same_owner"
  | "return_completed_result"
  | "reject_fingerprint_conflict"
  | "reject_active_other_owner"
  | "retry_failed_operation"
  | "reject_permanent_failure"
  | "restart_expired"
  | "reject_stale_fencing_token";

export type DistributedCoordinationErrorCode =
  | "invalid_lock"
  | "invalid_idempotency_record"
  | "fingerprint_conflict"
  | "stale_fencing_token"
  | "lock_not_owned"
  | "lock_expired"
  | "invalid_transition"
  | "result_conflict"
  | "compare_and_set_required";

export class DistributedCoordinationError extends Error {
  readonly code: DistributedCoordinationErrorCode;
  readonly resourceKey?: string;
  readonly idempotencyKey?: string;
  readonly ownerId?: string;
  readonly expectedFencingToken?: number;
  readonly presentedFencingToken?: number;

  constructor(
    input: Readonly<{
      code: DistributedCoordinationErrorCode;
      message: string;
      resourceKey?: string;
      idempotencyKey?: string;
      ownerId?: string;
      expectedFencingToken?: number;
      presentedFencingToken?: number;
    }>,
  ) {
    super(input.message);
    this.name = "DistributedCoordinationError";
    this.code = input.code;
    this.resourceKey = input.resourceKey;
    this.idempotencyKey = input.idempotencyKey;
    this.ownerId = input.ownerId;
    this.expectedFencingToken = input.expectedFencingToken;
    this.presentedFencingToken = input.presentedFencingToken;
  }
}

export type LockResourceValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type LockResourceValidationResult =
  | Readonly<{
      ok: true;
      resource: LockResource;
    }>
  | Readonly<{
      ok: false;
      issues: readonly LockResourceValidationIssue[];
    }>;

export type DistributedLockValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type DistributedLockValidationResult =
  | Readonly<{
      ok: true;
      lock: DistributedLock;
    }>
  | Readonly<{
      ok: false;
      issues: readonly DistributedLockValidationIssue[];
    }>;

export type IdempotencyRecordValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type IdempotencyRecordValidationResult =
  | Readonly<{
      ok: true;
      record: IdempotencyRecord;
    }>
  | Readonly<{
      ok: false;
      issues: readonly IdempotencyRecordValidationIssue[];
    }>;

export type DistributedCoordinationDecisionValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type LockAcquisitionDecisionValidationResult =
  | Readonly<{
      ok: true;
      decision: LockAcquisitionDecision;
    }>
  | Readonly<{
      ok: false;
      issues: readonly DistributedCoordinationDecisionValidationIssue[];
    }>;

export type LockRenewalDecisionValidationResult =
  | Readonly<{
      ok: true;
      decision: LockRenewalDecision;
    }>
  | Readonly<{
      ok: false;
      issues: readonly DistributedCoordinationDecisionValidationIssue[];
    }>;

export type LockReleaseDecisionValidationResult =
  | Readonly<{
      ok: true;
      decision: LockReleaseDecision;
    }>
  | Readonly<{
      ok: false;
      issues: readonly DistributedCoordinationDecisionValidationIssue[];
    }>;

export type FencingValidationDecisionValidationResult =
  | Readonly<{
      ok: true;
      decision: FencingValidationDecision;
    }>
  | Readonly<{
      ok: false;
      issues: readonly DistributedCoordinationDecisionValidationIssue[];
    }>;

export type IdempotencyStartDecisionValidationResult =
  | Readonly<{
      ok: true;
      decision: IdempotencyStartDecision;
    }>
  | Readonly<{
      ok: false;
      issues: readonly DistributedCoordinationDecisionValidationIssue[];
    }>;

export type LockAcquisitionDecision = Readonly<{
  outcome: LockAcquisitionOutcome;
  reason: string;
  nextLock: DistributedLock | null;
  previousLock: DistributedLock | null;
  fencingToken: number;
  isTakeover: boolean;
  isIdempotentNoop: boolean;
}>;

export type LockRenewalDecision = Readonly<{
  outcome: LockRenewalOutcome;
  reason: string;
  nextLock: DistributedLock | null;
  previousLock: DistributedLock | null;
  fencingToken: number | null;
  isIdempotentNoop: boolean;
}>;

export type LockReleaseDecision = Readonly<{
  outcome: LockReleaseOutcome;
  reason: string;
  nextLock: DistributedLock | null;
  previousLock: DistributedLock | null;
  fencingToken: number | null;
  isIdempotentNoop: boolean;
}>;

export type FencingValidationDecision = Readonly<{
  outcome: FencingValidationOutcome;
  reason: string;
  currentLock: DistributedLock | null;
}>;

export type IdempotencyStartDecision = Readonly<{
  outcome: IdempotencyStartOutcome;
  reason: string;
  nextRecord: IdempotencyRecord | null;
  previousRecord: IdempotencyRecord | null;
  resultFingerprint: string | null;
  isIdempotentNoop: boolean;
}>;

export type LockAcquisitionInput = Readonly<{
  existingLock: DistributedLock | null;
  requestedResource: LockResource;
  requestedOwnerId: string;
  requestedOwnerEpoch: number;
  now: string;
  ttlMs: number;
  metadata?: CoordinationJsonObject;
}>;

export type LockRenewalInput = Readonly<{
  currentLock: DistributedLock | null;
  requestedOwnerId: string;
  requestedOwnerEpoch: number;
  presentedFencingToken: number;
  now: string;
  ttlMs: number;
  metadata?: CoordinationJsonObject;
}>;

export type LockReleaseInput = Readonly<{
  currentLock: DistributedLock | null;
  presentedOwnerId: string;
  presentedOwnerEpoch: number;
  presentedFencingToken: number;
  now: string;
}>;

export type FencingValidationInput = Readonly<{
  currentLock: DistributedLock | null;
  presentedOwnerId: string;
  presentedOwnerEpoch: number;
  presentedFencingToken: number;
  now: string;
}>;

export type IdempotencyStartInput = Readonly<{
  existingRecord: IdempotencyRecord | null;
  idempotencyKey: string;
  operationType: string;
  subjectType: string;
  subjectId: string;
  requestFingerprint: string;
  ownerId: string;
  ownerEpoch: number;
  fencingToken: number;
  now: string;
  expiresAt: string;
  metadata?: CoordinationJsonObject;
}>;

export type IdempotencyMutationInput = Readonly<{
  record: IdempotencyRecord;
  ownerId: string;
  ownerEpoch: number;
  fencingToken: number;
  now: string;
}>;

export type CompleteIdempotencyRecordInput = IdempotencyMutationInput &
  Readonly<{
    resultFingerprint: string;
  }>;

export type FailIdempotencyRecordInput = IdempotencyMutationInput &
  Readonly<{
    failureCode: string;
  }>;

export type CompareAndSetResult<T> = Readonly<{
  applied: boolean;
  current: T | null;
}>;

export interface DistributedCoordinationStore {
  readLock(lockKey: string): Promise<DistributedLock | null>;
  compareAndSetLock(
    expected: DistributedLock | null,
    next: DistributedLock | null,
  ): Promise<CompareAndSetResult<DistributedLock>>;
  readIdempotencyRecord(
    idempotencyKey: string,
  ): Promise<IdempotencyRecord | null>;
  compareAndSetIdempotencyRecord(
    expected: IdempotencyRecord | null,
    next: IdempotencyRecord | null,
  ): Promise<CompareAndSetResult<IdempotencyRecord>>;
}

function freezeMetadata(
  metadata: CoordinationJsonObject | undefined,
): CoordinationJsonObject {
  return Object.freeze({ ...(metadata ?? {}) });
}

function freezeLockResource(resource: LockResource): LockResource {
  return Object.freeze({
    resourceType: resource.resourceType,
    resourceId: resource.resourceId,
    scope: resource.scope,
    partitionKey: resource.partitionKey,
  });
}

function freezeDistributedLock(lock: DistributedLock): DistributedLock {
  return Object.freeze({
    ...lock,
    metadata: freezeMetadata(lock.metadata),
  });
}

function freezeIdempotencyRecord(
  record: IdempotencyRecord,
): IdempotencyRecord {
  return Object.freeze({
    ...record,
    metadata: freezeMetadata(record.metadata),
  });
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString() === value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1;
}

function isLockResourceType(value: unknown): value is LockResourceType {
  return (
    typeof value === "string" &&
    (LOCK_RESOURCE_TYPES as readonly string[]).includes(value)
  );
}

function isDistributedLockStatus(
  value: unknown,
): value is DistributedLockStatus {
  return (
    typeof value === "string" &&
    (DISTRIBUTED_LOCK_STATUSES as readonly string[]).includes(value)
  );
}

function isIdempotencyStatus(value: unknown): value is IdempotencyStatus {
  return (
    typeof value === "string" &&
    (IDEMPOTENCY_STATUSES as readonly string[]).includes(value)
  );
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

function addMsToIso(baseTimestamp: string, ttlMs: number): string {
  return new Date(new Date(baseTimestamp).getTime() + ttlMs).toISOString();
}

function compareIso(left: string, right: string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}

function ensureCanonicalTimestamp(
  value: string,
  fieldName: string,
  code:
    | "invalid_lock"
    | "invalid_idempotency_record"
    | "invalid_transition",
  context: Readonly<{ resourceKey?: string; idempotencyKey?: string }>,
): void {
  if (!isCanonicalIsoTimestamp(value)) {
    throw new DistributedCoordinationError({
      code,
      message: `${fieldName} must be a canonical ISO UTC timestamp.`,
      resourceKey: context.resourceKey,
      idempotencyKey: context.idempotencyKey,
    });
  }
}

function normalizeOptionalString(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  return value.trim();
}

function buildFrozenLockResource(
  input: Readonly<{
    resourceType: LockResourceType;
    resourceId: string;
    scope?: string | null;
    partitionKey?: string | null;
  }>,
): LockResource {
  return freezeLockResource({
    resourceType: input.resourceType,
    resourceId: input.resourceId.trim(),
    scope: input.scope?.trim() ?? null,
    partitionKey: input.partitionKey?.trim() ?? null,
  });
}

export function buildLockResourceKey(resource: LockResource): string {
  const parsed = parseLockResource(resource);
  const optionalEntries: ReadonlyArray<
    readonly [string, string | null]
  > = Object.freeze([
    ["partitionKey", parsed.partitionKey],
    ["scope", parsed.scope],
  ]);
  const suffix = optionalEntries
    .filter(
      (
        entry,
      ): entry is readonly [string, string] => entry[1] != null,
    )
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(
      ([key, value]) => `${key}=${encodeURIComponent(value)}`,
    );

  return [
    `resourceType=${parsed.resourceType}`,
    `resourceId=${encodeURIComponent(parsed.resourceId)}`,
    ...suffix,
  ].join("|");
}

function buildLock(
  resource: LockResource,
  input: Readonly<{
    ownerId: string;
    ownerEpoch: number;
    fencingToken: number;
    acquiredAt: string;
    renewedAt: string;
    expiresAt: string;
    releasedAt?: string | null;
    status: DistributedLockStatus;
    metadata?: CoordinationJsonObject;
  }>,
): DistributedLock {
  return freezeDistributedLock({
    lockKey: buildLockResourceKey(resource),
    resourceType: resource.resourceType,
    resourceId: resource.resourceId,
    ownerId: input.ownerId.trim(),
    ownerEpoch: input.ownerEpoch,
    fencingToken: input.fencingToken,
    acquiredAt: input.acquiredAt,
    renewedAt: input.renewedAt,
    expiresAt: input.expiresAt,
    releasedAt: input.releasedAt ?? null,
    status: input.status,
    metadata: freezeMetadata(input.metadata),
  });
}

function buildIdempotencyRecord(
  input: Readonly<{
    idempotencyKey: string;
    operationType: string;
    subjectType: string;
    subjectId: string;
    requestFingerprint: string;
    status: IdempotencyStatus;
    ownerId: string;
    ownerEpoch: number;
    fencingToken: number;
    createdAt: string;
    updatedAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    expiresAt: string;
    resultFingerprint?: string | null;
    failureCode?: string | null;
    metadata?: CoordinationJsonObject;
  }>,
): IdempotencyRecord {
  return freezeIdempotencyRecord({
    idempotencyKey: input.idempotencyKey.trim(),
    operationType: input.operationType.trim(),
    subjectType: input.subjectType.trim(),
    subjectId: input.subjectId.trim(),
    requestFingerprint: input.requestFingerprint.trim(),
    status: input.status,
    ownerId: input.ownerId.trim(),
    ownerEpoch: input.ownerEpoch,
    fencingToken: input.fencingToken,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    expiresAt: input.expiresAt,
    resultFingerprint: input.resultFingerprint ?? null,
    failureCode: input.failureCode ?? null,
    metadata: freezeMetadata(input.metadata),
  });
}

function materializeLockState(
  lock: DistributedLock,
  now: string,
): DistributedLock {
  if (lock.status !== "active") {
    return lock;
  }

  if (compareIso(now, lock.expiresAt) < 0) {
    return lock;
  }

  return freezeDistributedLock({
    ...lock,
    status: "expired",
  });
}

function materializeIdempotencyState(
  record: IdempotencyRecord,
  now: string,
): IdempotencyRecord {
  if (
    record.status === "completed" ||
    record.status === "failed_permanent" ||
    record.status === "expired" ||
    record.status === "superseded"
  ) {
    return record;
  }

  if (compareIso(now, record.expiresAt) < 0) {
    return record;
  }

  return freezeIdempotencyRecord({
    ...record,
    status: "expired",
  });
}

function assertResourceMatchesLock(
  resource: LockResource,
  lock: DistributedLock,
): void {
  if (buildLockResourceKey(resource) !== lock.lockKey) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "existingLock does not match requestedResource.",
      resourceKey: lock.lockKey,
    });
  }
}

function assertLockOwnership(
  lock: DistributedLock,
  input: Readonly<{
    ownerId: string;
    ownerEpoch: number;
    fencingToken: number;
  }>,
): void {
  if (lock.ownerId !== input.ownerId.trim() || lock.ownerEpoch !== input.ownerEpoch) {
    throw new DistributedCoordinationError({
      code: "lock_not_owned",
      message: "The current lock is not owned by the presented owner identity.",
      resourceKey: lock.lockKey,
      ownerId: input.ownerId,
      expectedFencingToken: lock.fencingToken,
      presentedFencingToken: input.fencingToken,
    });
  }

  if (lock.fencingToken !== input.fencingToken) {
    throw new DistributedCoordinationError({
      code: "stale_fencing_token",
      message: "Presented fencing token does not match the durable lock token.",
      resourceKey: lock.lockKey,
      ownerId: input.ownerId,
      expectedFencingToken: lock.fencingToken,
      presentedFencingToken: input.fencingToken,
    });
  }
}

function assertIdempotencyOwnership(
  record: IdempotencyRecord,
  input: Readonly<{
    ownerId: string;
    ownerEpoch: number;
    fencingToken: number;
  }>,
): void {
  if (
    record.ownerId !== input.ownerId.trim() ||
    record.ownerEpoch !== input.ownerEpoch
  ) {
    throw new DistributedCoordinationError({
      code: "invalid_transition",
      message:
        "The idempotency record is not owned by the presented owner identity.",
      idempotencyKey: record.idempotencyKey,
      ownerId: input.ownerId,
      expectedFencingToken: record.fencingToken,
      presentedFencingToken: input.fencingToken,
    });
  }

  if (record.fencingToken !== input.fencingToken) {
    throw new DistributedCoordinationError({
      code: "stale_fencing_token",
      message:
        "Presented fencing token does not match the durable idempotency token.",
      idempotencyKey: record.idempotencyKey,
      ownerId: input.ownerId,
      expectedFencingToken: record.fencingToken,
      presentedFencingToken: input.fencingToken,
    });
  }
}

function buildLockDecision(
  input: Readonly<{
    outcome: LockAcquisitionOutcome;
    reason: string;
    nextLock: DistributedLock | null;
    previousLock: DistributedLock | null;
    fencingToken: number;
    isTakeover: boolean;
    isIdempotentNoop: boolean;
  }>,
): LockAcquisitionDecision {
  return Object.freeze({
    ...input,
    nextLock: input.nextLock,
    previousLock: input.previousLock,
  });
}

function buildRenewalDecision(
  input: Readonly<{
    outcome: LockRenewalOutcome;
    reason: string;
    nextLock: DistributedLock | null;
    previousLock: DistributedLock | null;
    fencingToken: number | null;
    isIdempotentNoop: boolean;
  }>,
): LockRenewalDecision {
  return Object.freeze({
    ...input,
    nextLock: input.nextLock,
    previousLock: input.previousLock,
  });
}

function buildReleaseDecision(
  input: Readonly<{
    outcome: LockReleaseOutcome;
    reason: string;
    nextLock: DistributedLock | null;
    previousLock: DistributedLock | null;
    fencingToken: number | null;
    isIdempotentNoop: boolean;
  }>,
): LockReleaseDecision {
  return Object.freeze({
    ...input,
    nextLock: input.nextLock,
    previousLock: input.previousLock,
  });
}

function buildStartDecision(
  input: Readonly<{
    outcome: IdempotencyStartOutcome;
    reason: string;
    nextRecord: IdempotencyRecord | null;
    previousRecord: IdempotencyRecord | null;
    resultFingerprint: string | null;
    isIdempotentNoop: boolean;
  }>,
): IdempotencyStartDecision {
  return Object.freeze({
    ...input,
    nextRecord: input.nextRecord,
    previousRecord: input.previousRecord,
  });
}

export function validateLockResource(
  input: unknown,
): LockResourceValidationResult {
  const issues: LockResourceValidationIssue[] = [];

  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a lock resource object.",
        }),
      ]),
    };
  }

  const candidate = input as Record<string, unknown>;

  if (!isLockResourceType(candidate.resourceType)) {
    issues.push({
      path: "resourceType",
      message: `Expected one of: ${LOCK_RESOURCE_TYPES.join(", ")}.`,
    });
  }

  if (!isNonEmptyString(candidate.resourceId)) {
    issues.push({
      path: "resourceId",
      message: "Expected a non-empty string.",
    });
  }

  for (const field of ["scope", "partitionKey"] as const) {
    const value = candidate[field];
    if (value != null && !isNonEmptyString(value)) {
      issues.push({
        path: field,
        message: "Expected null or a non-empty string.",
      });
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    resource: buildFrozenLockResource({
      resourceType: candidate.resourceType as LockResourceType,
      resourceId: candidate.resourceId as string,
      scope: normalizeOptionalString(candidate.scope),
      partitionKey: normalizeOptionalString(candidate.partitionKey),
    }),
  };
}

export function parseLockResource(input: unknown): LockResource {
  const result = validateLockResource(input);
  if (!result.ok) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | "),
    });
  }

  return result.resource;
}

export function validateDistributedLock(
  input: unknown,
): DistributedLockValidationResult {
  const issues: DistributedLockValidationIssue[] = [];

  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a distributed lock object.",
        }),
      ]),
    };
  }

  const candidate = input as Record<string, unknown>;

  if (!isNonEmptyString(candidate.lockKey)) {
    issues.push({
      path: "lockKey",
      message: "Expected a non-empty string.",
    });
  }

  if (!isLockResourceType(candidate.resourceType)) {
    issues.push({
      path: "resourceType",
      message: `Expected one of: ${LOCK_RESOURCE_TYPES.join(", ")}.`,
    });
  }

  if (!isNonEmptyString(candidate.resourceId)) {
    issues.push({
      path: "resourceId",
      message: "Expected a non-empty string.",
    });
  }

  if (!isNonEmptyString(candidate.ownerId)) {
    issues.push({
      path: "ownerId",
      message: "Expected a non-empty string.",
    });
  }

  for (const field of ["ownerEpoch", "fencingToken"] as const) {
    if (!isPositiveInteger(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected an integer >= 1.",
      });
    }
  }

  if (!isDistributedLockStatus(candidate.status)) {
    issues.push({
      path: "status",
      message: `Expected one of: ${DISTRIBUTED_LOCK_STATUSES.join(", ")}.`,
    });
  }

  for (const field of ["acquiredAt", "renewedAt", "expiresAt"] as const) {
    const value = candidate[field];
    if (!isNonEmptyString(value) || !isCanonicalIsoTimestamp(value)) {
      issues.push({
        path: field,
        message: "Expected a canonical ISO timestamp.",
      });
    }
  }

  if (
    candidate.releasedAt != null &&
    (!isNonEmptyString(candidate.releasedAt) ||
      !isCanonicalIsoTimestamp(candidate.releasedAt))
  ) {
    issues.push({
      path: "releasedAt",
      message: "Expected null or a canonical ISO timestamp.",
    });
  }

  if (
    isCanonicalIsoTimestamp(candidate.acquiredAt as string) &&
    isCanonicalIsoTimestamp(candidate.renewedAt as string) &&
    compareIso(candidate.renewedAt as string, candidate.acquiredAt as string) < 0
  ) {
    issues.push({
      path: "renewedAt",
      message: "renewedAt must be greater than or equal to acquiredAt.",
    });
  }

  if (
    isCanonicalIsoTimestamp(candidate.acquiredAt as string) &&
    isCanonicalIsoTimestamp(candidate.expiresAt as string) &&
    compareIso(candidate.expiresAt as string, candidate.acquiredAt as string) <= 0
  ) {
    issues.push({
      path: "expiresAt",
      message: "expiresAt must be later than acquiredAt.",
    });
  }

  if ((candidate.status as DistributedLockStatus) === "released") {
    if (!isNonEmptyString(candidate.releasedAt)) {
      issues.push({
        path: "releasedAt",
        message: "releasedAt is required for released locks.",
      });
    }
  } else if (candidate.releasedAt != null) {
    issues.push({
      path: "releasedAt",
      message: "releasedAt must be null unless the lock is released.",
    });
  }

  if (
    candidate.metadata != null &&
    !isJsonSafe(candidate.metadata)
  ) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  }

  if (
    isLockResourceType(candidate.resourceType) &&
    isNonEmptyString(candidate.resourceId) &&
    isNonEmptyString(candidate.lockKey)
  ) {
    const expectedKey = buildLockResourceKey({
      resourceType: candidate.resourceType,
      resourceId: candidate.resourceId,
      scope: null,
      partitionKey: null,
    });
    if (
      candidate.lockKey !== expectedKey &&
      !candidate.lockKey.startsWith(expectedKey)
    ) {
      issues.push({
        path: "lockKey",
        message: "lockKey must be consistent with resourceType and resourceId.",
      });
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    lock: freezeDistributedLock(candidate as DistributedLock),
  };
}

export function parseDistributedLock(input: unknown): DistributedLock {
  const result = validateDistributedLock(input);
  if (!result.ok) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | "),
      resourceKey:
        typeof input === "object" && input != null && "lockKey" in input
          ? String((input as Record<string, unknown>).lockKey)
          : undefined,
    });
  }

  return result.lock;
}

export function validateIdempotencyRecord(
  input: unknown,
): IdempotencyRecordValidationResult {
  const issues: IdempotencyRecordValidationIssue[] = [];

  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected an idempotency record object.",
        }),
      ]),
    };
  }

  const candidate = input as Record<string, unknown>;

  for (const field of [
    "idempotencyKey",
    "operationType",
    "subjectType",
    "subjectId",
    "requestFingerprint",
    "ownerId",
  ] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected a non-empty string.",
      });
    }
  }

  for (const field of ["ownerEpoch", "fencingToken"] as const) {
    if (!isPositiveInteger(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected an integer >= 1.",
      });
    }
  }

  if (!isIdempotencyStatus(candidate.status)) {
    issues.push({
      path: "status",
      message: `Expected one of: ${IDEMPOTENCY_STATUSES.join(", ")}.`,
    });
  }

  for (const field of ["createdAt", "updatedAt", "expiresAt"] as const) {
    const value = candidate[field];
    if (!isNonEmptyString(value) || !isCanonicalIsoTimestamp(value)) {
      issues.push({
        path: field,
        message: "Expected a canonical ISO timestamp.",
      });
    }
  }

  for (const field of ["startedAt", "completedAt"] as const) {
    const value = candidate[field];
    if (
      value != null &&
      (!isNonEmptyString(value) || !isCanonicalIsoTimestamp(value))
    ) {
      issues.push({
        path: field,
        message: "Expected null or a canonical ISO timestamp.",
      });
    }
  }

  if (
    isCanonicalIsoTimestamp(candidate.createdAt as string) &&
    isCanonicalIsoTimestamp(candidate.expiresAt as string) &&
    compareIso(candidate.expiresAt as string, candidate.createdAt as string) <= 0
  ) {
    issues.push({
      path: "expiresAt",
      message: "expiresAt must be later than createdAt.",
    });
  }

  if ((candidate.status as IdempotencyStatus) === "completed") {
    if (!isNonEmptyString(candidate.resultFingerprint)) {
      issues.push({
        path: "resultFingerprint",
        message: "resultFingerprint is required for completed records.",
      });
    }
    if (!isNonEmptyString(candidate.completedAt)) {
      issues.push({
        path: "completedAt",
        message: "completedAt is required for completed records.",
      });
    }
  } else {
    if (candidate.completedAt != null) {
      issues.push({
        path: "completedAt",
        message: "completedAt must be null unless the record is completed.",
      });
    }
    if (
      candidate.resultFingerprint != null &&
      !isNonEmptyString(candidate.resultFingerprint)
    ) {
      issues.push({
        path: "resultFingerprint",
        message: "resultFingerprint must be null or a non-empty string.",
      });
    }
  }

  if (
    (candidate.status as IdempotencyStatus) === "failed_retryable" ||
    (candidate.status as IdempotencyStatus) === "failed_permanent"
  ) {
    if (!isNonEmptyString(candidate.failureCode)) {
      issues.push({
        path: "failureCode",
        message: "failureCode is required for failed records.",
      });
    }
  } else if (candidate.failureCode != null) {
    issues.push({
      path: "failureCode",
      message: "failureCode must be null unless the record is failed.",
    });
  }

  if (
    (candidate.status as IdempotencyStatus) === "in_progress" &&
    !isNonEmptyString(candidate.startedAt)
  ) {
    issues.push({
      path: "startedAt",
      message: "startedAt is required for in_progress records.",
    });
  }

  if (candidate.metadata != null && !isJsonSafe(candidate.metadata)) {
    issues.push({
      path: "metadata",
      message: "metadata must be JSON-safe.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    record: freezeIdempotencyRecord(candidate as IdempotencyRecord),
  };
}

export function parseIdempotencyRecord(input: unknown): IdempotencyRecord {
  const result = validateIdempotencyRecord(input);
  if (!result.ok) {
    throw new DistributedCoordinationError({
      code: "invalid_idempotency_record",
      message: result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | "),
      idempotencyKey:
        typeof input === "object" && input != null && "idempotencyKey" in input
          ? String((input as Record<string, unknown>).idempotencyKey)
          : undefined,
    });
  }

  return result.record;
}

function validateDecisionBase(
  input: unknown,
): {
  candidate: Record<string, unknown> | null;
  issues: DistributedCoordinationDecisionValidationIssue[];
} {
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      candidate: null,
      issues: [
        Object.freeze({
          path: "",
          message: "Expected a decision object.",
        }),
      ],
    };
  }

  return {
    candidate: input as Record<string, unknown>,
    issues: [],
  };
}

export function validateLockAcquisitionDecision(
  input: unknown,
): LockAcquisitionDecisionValidationResult {
  const { candidate, issues } = validateDecisionBase(input);
  if (candidate == null) {
    return { ok: false, issues: Object.freeze(issues) };
  }

  if (
    ![
      "acquired",
      "renewed",
      "rejected_active_owner",
      "rejected_stale_owner_epoch",
      "takeover_expired_lock",
      "idempotent_owner_noop",
    ].includes(String(candidate.outcome))
  ) {
    issues.push({
      path: "outcome",
      message: "Invalid lock acquisition outcome.",
    });
  }

  if (!isNonEmptyString(candidate.reason)) {
    issues.push({
      path: "reason",
      message: "Expected a non-empty reason string.",
    });
  }

  if (!Number.isInteger(candidate.fencingToken) || Number(candidate.fencingToken) < 1) {
    issues.push({
      path: "fencingToken",
      message: "Expected an integer >= 1.",
    });
  }

  if (
    typeof candidate.isTakeover !== "boolean" ||
    typeof candidate.isIdempotentNoop !== "boolean"
  ) {
    issues.push({
      path: "flags",
      message: "Decision booleans are required.",
    });
  }

  if (candidate.nextLock != null && !validateDistributedLock(candidate.nextLock).ok) {
    issues.push({
      path: "nextLock",
      message: "nextLock must be a valid DistributedLock or null.",
    });
  }

  if (
    candidate.previousLock != null &&
    !validateDistributedLock(candidate.previousLock).ok
  ) {
    issues.push({
      path: "previousLock",
      message: "previousLock must be a valid DistributedLock or null.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    decision: Object.freeze(candidate as LockAcquisitionDecision),
  };
}

export function validateLockRenewalDecision(
  input: unknown,
): LockRenewalDecisionValidationResult {
  const { candidate, issues } = validateDecisionBase(input);
  if (candidate == null) {
    return { ok: false, issues: Object.freeze(issues) };
  }

  if (
    ![
      "renewed",
      "idempotent_noop",
      "rejected_not_owner",
      "rejected_fencing_token",
      "rejected_expired",
      "rejected_inactive",
    ].includes(String(candidate.outcome))
  ) {
    issues.push({
      path: "outcome",
      message: "Invalid lock renewal outcome.",
    });
  }

  if (!isNonEmptyString(candidate.reason)) {
    issues.push({
      path: "reason",
      message: "Expected a non-empty reason string.",
    });
  }

  if (
    candidate.fencingToken != null &&
    (!Number.isInteger(candidate.fencingToken) || Number(candidate.fencingToken) < 1)
  ) {
    issues.push({
      path: "fencingToken",
      message: "fencingToken must be null or an integer >= 1.",
    });
  }

  if (typeof candidate.isIdempotentNoop !== "boolean") {
    issues.push({
      path: "isIdempotentNoop",
      message: "Expected a boolean.",
    });
  }

  if (candidate.nextLock != null && !validateDistributedLock(candidate.nextLock).ok) {
    issues.push({
      path: "nextLock",
      message: "nextLock must be a valid DistributedLock or null.",
    });
  }

  if (
    candidate.previousLock != null &&
    !validateDistributedLock(candidate.previousLock).ok
  ) {
    issues.push({
      path: "previousLock",
      message: "previousLock must be a valid DistributedLock or null.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    decision: Object.freeze(candidate as LockRenewalDecision),
  };
}

export function validateLockReleaseDecision(
  input: unknown,
): LockReleaseDecisionValidationResult {
  const { candidate, issues } = validateDecisionBase(input);
  if (candidate == null) {
    return { ok: false, issues: Object.freeze(issues) };
  }

  if (
    ![
      "released",
      "idempotent_noop",
      "rejected_not_owner",
      "rejected_fencing_token",
      "rejected_expired",
      "rejected_inactive",
    ].includes(String(candidate.outcome))
  ) {
    issues.push({
      path: "outcome",
      message: "Invalid lock release outcome.",
    });
  }

  if (!isNonEmptyString(candidate.reason)) {
    issues.push({
      path: "reason",
      message: "Expected a non-empty reason string.",
    });
  }

  if (
    candidate.fencingToken != null &&
    (!Number.isInteger(candidate.fencingToken) || Number(candidate.fencingToken) < 1)
  ) {
    issues.push({
      path: "fencingToken",
      message: "fencingToken must be null or an integer >= 1.",
    });
  }

  if (typeof candidate.isIdempotentNoop !== "boolean") {
    issues.push({
      path: "isIdempotentNoop",
      message: "Expected a boolean.",
    });
  }

  if (candidate.nextLock != null && !validateDistributedLock(candidate.nextLock).ok) {
    issues.push({
      path: "nextLock",
      message: "nextLock must be a valid DistributedLock or null.",
    });
  }

  if (
    candidate.previousLock != null &&
    !validateDistributedLock(candidate.previousLock).ok
  ) {
    issues.push({
      path: "previousLock",
      message: "previousLock must be a valid DistributedLock or null.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    decision: Object.freeze(candidate as LockReleaseDecision),
  };
}

export function validateFencingValidationDecision(
  input: unknown,
): FencingValidationDecisionValidationResult {
  const { candidate, issues } = validateDecisionBase(input);
  if (candidate == null) {
    return { ok: false, issues: Object.freeze(issues) };
  }

  if (
    ![
      "valid",
      "invalid_owner",
      "invalid_epoch",
      "stale_fencing_token",
      "inactive_lock",
      "expired_lock",
    ].includes(String(candidate.outcome))
  ) {
    issues.push({
      path: "outcome",
      message: "Invalid fencing validation outcome.",
    });
  }

  if (!isNonEmptyString(candidate.reason)) {
    issues.push({
      path: "reason",
      message: "Expected a non-empty reason string.",
    });
  }

  if (
    candidate.currentLock != null &&
    !validateDistributedLock(candidate.currentLock).ok
  ) {
    issues.push({
      path: "currentLock",
      message: "currentLock must be a valid DistributedLock or null.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    decision: Object.freeze(candidate as FencingValidationDecision),
  };
}

export function validateIdempotencyStartDecision(
  input: unknown,
): IdempotencyStartDecisionValidationResult {
  const { candidate, issues } = validateDecisionBase(input);
  if (candidate == null) {
    return { ok: false, issues: Object.freeze(issues) };
  }

  if (
    ![
      "start_new",
      "resume_same_owner",
      "return_completed_result",
      "reject_fingerprint_conflict",
      "reject_active_other_owner",
      "retry_failed_operation",
      "reject_permanent_failure",
      "restart_expired",
      "reject_stale_fencing_token",
    ].includes(String(candidate.outcome))
  ) {
    issues.push({
      path: "outcome",
      message: "Invalid idempotency start outcome.",
    });
  }

  if (!isNonEmptyString(candidate.reason)) {
    issues.push({
      path: "reason",
      message: "Expected a non-empty reason string.",
    });
  }

  if (candidate.resultFingerprint != null && !isNonEmptyString(candidate.resultFingerprint)) {
    issues.push({
      path: "resultFingerprint",
      message: "resultFingerprint must be null or a non-empty string.",
    });
  }

  if (typeof candidate.isIdempotentNoop !== "boolean") {
    issues.push({
      path: "isIdempotentNoop",
      message: "Expected a boolean.",
    });
  }

  if (
    candidate.nextRecord != null &&
    !validateIdempotencyRecord(candidate.nextRecord).ok
  ) {
    issues.push({
      path: "nextRecord",
      message: "nextRecord must be a valid IdempotencyRecord or null.",
    });
  }

  if (
    candidate.previousRecord != null &&
    !validateIdempotencyRecord(candidate.previousRecord).ok
  ) {
    issues.push({
      path: "previousRecord",
      message: "previousRecord must be a valid IdempotencyRecord or null.",
    });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    };
  }

  return {
    ok: true,
    decision: Object.freeze(candidate as IdempotencyStartDecision),
  };
}

export function decideLockAcquisition(
  input: LockAcquisitionInput,
): LockAcquisitionDecision {
  const resource = parseLockResource(input.requestedResource);
  const lockKey = buildLockResourceKey(resource);

  if (!isNonEmptyString(input.requestedOwnerId)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "requestedOwnerId must be a non-empty string.",
      resourceKey: lockKey,
    });
  }
  if (!isPositiveInteger(input.requestedOwnerEpoch)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "requestedOwnerEpoch must be an integer >= 1.",
      resourceKey: lockKey,
    });
  }
  ensureCanonicalTimestamp(input.now, "now", "invalid_lock", { resourceKey: lockKey });
  if (!Number.isInteger(input.ttlMs) || input.ttlMs < 1) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "ttlMs must be an integer >= 1.",
      resourceKey: lockKey,
    });
  }
  if (input.metadata != null && !isJsonSafe(input.metadata)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "metadata must be JSON-safe.",
      resourceKey: lockKey,
    });
  }

  const existing =
    input.existingLock == null
      ? null
      : materializeLockState(parseDistributedLock(input.existingLock), input.now);

  if (existing != null) {
    assertResourceMatchesLock(resource, existing);
  }

  const nextExpiresAt = addMsToIso(input.now, input.ttlMs);

  if (existing == null) {
    return buildLockDecision({
      outcome: "acquired",
      reason: "no_existing_lock",
      nextLock: buildLock(resource, {
        ownerId: input.requestedOwnerId,
        ownerEpoch: input.requestedOwnerEpoch,
        fencingToken: 1,
        acquiredAt: input.now,
        renewedAt: input.now,
        expiresAt: nextExpiresAt,
        status: "active",
        metadata: input.metadata,
      }),
      previousLock: null,
      fencingToken: 1,
      isTakeover: false,
      isIdempotentNoop: false,
    });
  }

  if (input.requestedOwnerEpoch < existing.ownerEpoch) {
    return buildLockDecision({
      outcome: "rejected_stale_owner_epoch",
      reason: "requested_owner_epoch_is_stale",
      nextLock: null,
      previousLock: existing,
      fencingToken: existing.fencingToken,
      isTakeover: false,
      isIdempotentNoop: false,
    });
  }

  if (existing.status === "active") {
    if (
      existing.ownerId === input.requestedOwnerId.trim() &&
      existing.ownerEpoch === input.requestedOwnerEpoch
    ) {
      if (compareIso(nextExpiresAt, existing.expiresAt) <= 0) {
        return buildLockDecision({
          outcome: "idempotent_owner_noop",
          reason: "same_owner_same_epoch_no_longer_extension_requested",
          nextLock: existing,
          previousLock: existing,
          fencingToken: existing.fencingToken,
          isTakeover: false,
          isIdempotentNoop: true,
        });
      }

      return buildLockDecision({
        outcome: "renewed",
        reason: "same_owner_same_epoch_requested_extension",
        nextLock: buildLock(resource, {
          ownerId: existing.ownerId,
          ownerEpoch: existing.ownerEpoch,
          fencingToken: existing.fencingToken,
          acquiredAt: existing.acquiredAt,
          renewedAt: input.now,
          expiresAt: nextExpiresAt,
          status: "active",
          metadata: input.metadata ?? existing.metadata,
        }),
        previousLock: existing,
        fencingToken: existing.fencingToken,
        isTakeover: false,
        isIdempotentNoop: false,
      });
    }

    return buildLockDecision({
      outcome: "rejected_active_owner",
      reason: "another_active_owner_holds_the_lock",
      nextLock: null,
      previousLock: existing,
      fencingToken: existing.fencingToken,
      isTakeover: false,
      isIdempotentNoop: false,
    });
  }

  const nextFencingToken = existing.fencingToken + 1;
  const outcome =
    existing.status === "expired"
      ? "takeover_expired_lock"
      : "acquired";

  return buildLockDecision({
    outcome,
    reason:
      existing.status === "expired"
        ? "takeover_after_expiration"
        : existing.status === "released"
          ? "reacquire_after_release"
          : "reacquire_after_superseded",
    nextLock: buildLock(resource, {
      ownerId: input.requestedOwnerId,
      ownerEpoch: input.requestedOwnerEpoch,
      fencingToken: nextFencingToken,
      acquiredAt: input.now,
      renewedAt: input.now,
      expiresAt: nextExpiresAt,
      status: "active",
      metadata: input.metadata,
    }),
    previousLock: existing,
    fencingToken: nextFencingToken,
    isTakeover: existing.status === "expired",
    isIdempotentNoop: false,
  });
}

export function decideLockRenewal(
  input: LockRenewalInput,
): LockRenewalDecision {
  ensureCanonicalTimestamp(input.now, "now", "invalid_lock", {});
  if (!Number.isInteger(input.ttlMs) || input.ttlMs < 1) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "ttlMs must be an integer >= 1.",
    });
  }
  if (!isNonEmptyString(input.requestedOwnerId)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "requestedOwnerId must be a non-empty string.",
    });
  }
  if (!isPositiveInteger(input.requestedOwnerEpoch)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "requestedOwnerEpoch must be an integer >= 1.",
    });
  }
  if (!isPositiveInteger(input.presentedFencingToken)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "presentedFencingToken must be an integer >= 1.",
    });
  }
  if (input.metadata != null && !isJsonSafe(input.metadata)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "metadata must be JSON-safe.",
    });
  }

  const current =
    input.currentLock == null
      ? null
      : materializeLockState(parseDistributedLock(input.currentLock), input.now);

  if (current == null) {
    return buildRenewalDecision({
      outcome: "rejected_inactive",
      reason: "no_current_lock",
      nextLock: null,
      previousLock: null,
      fencingToken: null,
      isIdempotentNoop: false,
    });
  }

  if (current.status === "expired") {
    return buildRenewalDecision({
      outcome: "rejected_expired",
      reason: "lock_has_expired",
      nextLock: null,
      previousLock: current,
      fencingToken: current.fencingToken,
      isIdempotentNoop: false,
    });
  }

  if (current.status !== "active") {
    return buildRenewalDecision({
      outcome: "rejected_inactive",
      reason: "lock_is_not_active",
      nextLock: null,
      previousLock: current,
      fencingToken: current.fencingToken,
      isIdempotentNoop: false,
    });
  }

  if (
    current.ownerId !== input.requestedOwnerId.trim() ||
    current.ownerEpoch !== input.requestedOwnerEpoch
  ) {
    return buildRenewalDecision({
      outcome: "rejected_not_owner",
      reason: "owner_identity_does_not_match_active_lock",
      nextLock: null,
      previousLock: current,
      fencingToken: current.fencingToken,
      isIdempotentNoop: false,
    });
  }

  if (current.fencingToken !== input.presentedFencingToken) {
    return buildRenewalDecision({
      outcome: "rejected_fencing_token",
      reason: "fencing_token_does_not_match_active_lock",
      nextLock: null,
      previousLock: current,
      fencingToken: current.fencingToken,
      isIdempotentNoop: false,
    });
  }

  const nextExpiresAt = addMsToIso(input.now, input.ttlMs);
  if (compareIso(nextExpiresAt, current.expiresAt) <= 0) {
    return buildRenewalDecision({
      outcome: "idempotent_noop",
      reason: "requested_renewal_does_not_extend_expiration",
      nextLock: current,
      previousLock: current,
      fencingToken: current.fencingToken,
      isIdempotentNoop: true,
    });
  }

  return buildRenewalDecision({
    outcome: "renewed",
    reason: "active_lock_extended_by_current_owner",
    nextLock: freezeDistributedLock({
      ...current,
      renewedAt: input.now,
      expiresAt: nextExpiresAt,
      metadata: freezeMetadata(input.metadata ?? current.metadata),
    }),
    previousLock: current,
    fencingToken: current.fencingToken,
    isIdempotentNoop: false,
  });
}

export function decideLockRelease(
  input: LockReleaseInput,
): LockReleaseDecision {
  ensureCanonicalTimestamp(input.now, "now", "invalid_lock", {});
  if (!isNonEmptyString(input.presentedOwnerId)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "presentedOwnerId must be a non-empty string.",
    });
  }
  if (!isPositiveInteger(input.presentedOwnerEpoch)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "presentedOwnerEpoch must be an integer >= 1.",
    });
  }
  if (!isPositiveInteger(input.presentedFencingToken)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "presentedFencingToken must be an integer >= 1.",
    });
  }

  const current =
    input.currentLock == null
      ? null
      : materializeLockState(parseDistributedLock(input.currentLock), input.now);

  if (current == null) {
    return buildReleaseDecision({
      outcome: "rejected_inactive",
      reason: "no_current_lock",
      nextLock: null,
      previousLock: null,
      fencingToken: null,
      isIdempotentNoop: false,
    });
  }

  if (
    current.ownerId !== input.presentedOwnerId.trim() ||
    current.ownerEpoch !== input.presentedOwnerEpoch
  ) {
    return buildReleaseDecision({
      outcome: "rejected_not_owner",
      reason: "owner_identity_does_not_match_lock",
      nextLock: null,
      previousLock: current,
      fencingToken: current.fencingToken,
      isIdempotentNoop: false,
    });
  }

  if (current.fencingToken !== input.presentedFencingToken) {
    return buildReleaseDecision({
      outcome: "rejected_fencing_token",
      reason: "fencing_token_does_not_match_lock",
      nextLock: null,
      previousLock: current,
      fencingToken: current.fencingToken,
      isIdempotentNoop: false,
    });
  }

  if (current.status === "released") {
    return buildReleaseDecision({
      outcome: "idempotent_noop",
      reason: "lock_already_released_by_same_owner",
      nextLock: current,
      previousLock: current,
      fencingToken: current.fencingToken,
      isIdempotentNoop: true,
    });
  }

  if (current.status === "expired") {
    return buildReleaseDecision({
      outcome: "rejected_expired",
      reason: "lock_has_expired",
      nextLock: null,
      previousLock: current,
      fencingToken: current.fencingToken,
      isIdempotentNoop: false,
    });
  }

  if (current.status !== "active") {
    return buildReleaseDecision({
      outcome: "rejected_inactive",
      reason: "lock_is_not_active",
      nextLock: null,
      previousLock: current,
      fencingToken: current.fencingToken,
      isIdempotentNoop: false,
    });
  }

  return buildReleaseDecision({
    outcome: "released",
    reason: "lock_released_by_current_owner",
    nextLock: freezeDistributedLock({
      ...current,
      status: "released",
      releasedAt: input.now,
    }),
    previousLock: current,
    fencingToken: current.fencingToken,
    isIdempotentNoop: false,
  });
}

export function validateFencingToken(
  input: FencingValidationInput,
): FencingValidationDecision {
  ensureCanonicalTimestamp(input.now, "now", "invalid_lock", {});
  if (!isNonEmptyString(input.presentedOwnerId)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "presentedOwnerId must be a non-empty string.",
    });
  }
  if (!isPositiveInteger(input.presentedOwnerEpoch)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "presentedOwnerEpoch must be an integer >= 1.",
    });
  }
  if (!isPositiveInteger(input.presentedFencingToken)) {
    throw new DistributedCoordinationError({
      code: "invalid_lock",
      message: "presentedFencingToken must be an integer >= 1.",
    });
  }

  const current =
    input.currentLock == null
      ? null
      : materializeLockState(parseDistributedLock(input.currentLock), input.now);

  if (current == null) {
    return Object.freeze({
      outcome: "inactive_lock",
      reason: "no_current_lock",
      currentLock: null,
    });
  }

  if (current.status === "expired") {
    return Object.freeze({
      outcome: "expired_lock",
      reason: "lock_has_expired",
      currentLock: current,
    });
  }

  if (current.status !== "active") {
    return Object.freeze({
      outcome: "inactive_lock",
      reason: "lock_is_not_active",
      currentLock: current,
    });
  }

  if (current.ownerId !== input.presentedOwnerId.trim()) {
    return Object.freeze({
      outcome: "invalid_owner",
      reason: "owner_id_does_not_match_active_lock",
      currentLock: current,
    });
  }

  if (current.ownerEpoch !== input.presentedOwnerEpoch) {
    return Object.freeze({
      outcome: "invalid_epoch",
      reason: "owner_epoch_does_not_match_active_lock",
      currentLock: current,
    });
  }

  if (current.fencingToken !== input.presentedFencingToken) {
    return Object.freeze({
      outcome: "stale_fencing_token",
      reason: "fencing_token_does_not_match_active_lock",
      currentLock: current,
    });
  }

  return Object.freeze({
    outcome: "valid",
    reason: "presented_owner_and_token_match_active_lock",
    currentLock: current,
  });
}

export function decideIdempotencyStart(
  input: IdempotencyStartInput,
): IdempotencyStartDecision {
  if (!isNonEmptyString(input.idempotencyKey)) {
    throw new DistributedCoordinationError({
      code: "invalid_idempotency_record",
      message: "idempotencyKey must be a non-empty string.",
      idempotencyKey: String(input.idempotencyKey ?? ""),
    });
  }
  for (const [field, value] of [
    ["operationType", input.operationType],
    ["subjectType", input.subjectType],
    ["subjectId", input.subjectId],
    ["requestFingerprint", input.requestFingerprint],
    ["ownerId", input.ownerId],
  ] as const) {
    if (!isNonEmptyString(value)) {
      throw new DistributedCoordinationError({
        code: "invalid_idempotency_record",
        message: `${field} must be a non-empty string.`,
        idempotencyKey: input.idempotencyKey,
      });
    }
  }
  if (!isPositiveInteger(input.ownerEpoch)) {
    throw new DistributedCoordinationError({
      code: "invalid_idempotency_record",
      message: "ownerEpoch must be an integer >= 1.",
      idempotencyKey: input.idempotencyKey,
    });
  }
  if (!isPositiveInteger(input.fencingToken)) {
    throw new DistributedCoordinationError({
      code: "invalid_idempotency_record",
      message: "fencingToken must be an integer >= 1.",
      idempotencyKey: input.idempotencyKey,
    });
  }
  ensureCanonicalTimestamp(input.now, "now", "invalid_idempotency_record", {
    idempotencyKey: input.idempotencyKey,
  });
  ensureCanonicalTimestamp(
    input.expiresAt,
    "expiresAt",
    "invalid_idempotency_record",
    { idempotencyKey: input.idempotencyKey },
  );
  if (compareIso(input.expiresAt, input.now) <= 0) {
    throw new DistributedCoordinationError({
      code: "invalid_idempotency_record",
      message: "expiresAt must be later than now.",
      idempotencyKey: input.idempotencyKey,
    });
  }
  if (input.metadata != null && !isJsonSafe(input.metadata)) {
    throw new DistributedCoordinationError({
      code: "invalid_idempotency_record",
      message: "metadata must be JSON-safe.",
      idempotencyKey: input.idempotencyKey,
    });
  }

  const existing =
    input.existingRecord == null
      ? null
      : materializeIdempotencyState(
          parseIdempotencyRecord(input.existingRecord),
          input.now,
        );

  if (existing != null && existing.idempotencyKey !== input.idempotencyKey) {
    throw new DistributedCoordinationError({
      code: "invalid_idempotency_record",
      message:
        "existingRecord does not match the requested idempotencyKey.",
      idempotencyKey: input.idempotencyKey,
    });
  }

  if (existing == null) {
    return buildStartDecision({
      outcome: "start_new",
      reason: "no_existing_record",
      nextRecord: buildIdempotencyRecord({
        idempotencyKey: input.idempotencyKey,
        operationType: input.operationType,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        requestFingerprint: input.requestFingerprint,
        status: "pending",
        ownerId: input.ownerId,
        ownerEpoch: input.ownerEpoch,
        fencingToken: input.fencingToken,
        createdAt: input.now,
        updatedAt: input.now,
        expiresAt: input.expiresAt,
        metadata: input.metadata,
      }),
      previousRecord: null,
      resultFingerprint: null,
      isIdempotentNoop: false,
    });
  }

  if (input.fencingToken < existing.fencingToken) {
    return buildStartDecision({
      outcome: "reject_stale_fencing_token",
      reason: "presented_fencing_token_is_stale",
      nextRecord: null,
      previousRecord: existing,
      resultFingerprint: null,
      isIdempotentNoop: false,
    });
  }

  if (existing.requestFingerprint !== input.requestFingerprint.trim()) {
    return buildStartDecision({
      outcome: "reject_fingerprint_conflict",
      reason: "same_idempotency_key_with_different_request_fingerprint",
      nextRecord: null,
      previousRecord: existing,
      resultFingerprint: existing.resultFingerprint,
      isIdempotentNoop: false,
    });
  }

  if (existing.status === "completed") {
    return buildStartDecision({
      outcome: "return_completed_result",
      reason: "completed_record_with_same_fingerprint",
      nextRecord: existing,
      previousRecord: existing,
      resultFingerprint: existing.resultFingerprint,
      isIdempotentNoop: true,
    });
  }

  if (existing.status === "failed_permanent" || existing.status === "superseded") {
    return buildStartDecision({
      outcome: "reject_permanent_failure",
      reason:
        existing.status === "superseded"
          ? "record_has_been_superseded"
          : "record_failed_permanently",
      nextRecord: null,
      previousRecord: existing,
      resultFingerprint: existing.resultFingerprint,
      isIdempotentNoop: false,
    });
  }

  if (existing.status === "pending" || existing.status === "in_progress") {
    if (
      existing.ownerId === input.ownerId.trim() &&
      existing.ownerEpoch === input.ownerEpoch &&
      existing.fencingToken === input.fencingToken
    ) {
      return buildStartDecision({
        outcome: "resume_same_owner",
        reason: "same_owner_same_epoch_same_fencing_token",
        nextRecord: existing,
        previousRecord: existing,
        resultFingerprint: existing.resultFingerprint,
        isIdempotentNoop: true,
      });
    }

    return buildStartDecision({
      outcome: "reject_active_other_owner",
      reason: "another_active_owner_holds_the_operation",
      nextRecord: null,
      previousRecord: existing,
      resultFingerprint: existing.resultFingerprint,
      isIdempotentNoop: false,
    });
  }

  if (existing.status === "failed_retryable") {
    return buildStartDecision({
      outcome: "retry_failed_operation",
      reason: "retryable_failure_can_be_retried",
      nextRecord: buildIdempotencyRecord({
        ...existing,
        status: "pending",
        ownerId: input.ownerId,
        ownerEpoch: input.ownerEpoch,
        fencingToken: input.fencingToken,
        updatedAt: input.now,
        startedAt: null,
        completedAt: null,
        expiresAt: input.expiresAt,
        resultFingerprint: null,
        failureCode: null,
        metadata: input.metadata ?? existing.metadata,
      }),
      previousRecord: existing,
      resultFingerprint: null,
      isIdempotentNoop: false,
    });
  }

  if (existing.status === "expired") {
    return buildStartDecision({
      outcome: "restart_expired",
      reason: "expired_record_can_be_restarted",
      nextRecord: buildIdempotencyRecord({
        ...existing,
        status: "pending",
        ownerId: input.ownerId,
        ownerEpoch: input.ownerEpoch,
        fencingToken: input.fencingToken,
        updatedAt: input.now,
        startedAt: null,
        completedAt: null,
        expiresAt: input.expiresAt,
        resultFingerprint: null,
        failureCode: null,
        metadata: input.metadata ?? existing.metadata,
      }),
      previousRecord: existing,
      resultFingerprint: null,
      isIdempotentNoop: false,
    });
  }

  return buildStartDecision({
    outcome: "reject_permanent_failure",
    reason: "unsupported_terminal_state",
    nextRecord: null,
    previousRecord: existing,
    resultFingerprint: existing.resultFingerprint,
    isIdempotentNoop: false,
  });
}

export function markIdempotencyInProgress(
  input: IdempotencyMutationInput,
): IdempotencyRecord {
  ensureCanonicalTimestamp(
    input.now,
    "now",
    "invalid_idempotency_record",
    { idempotencyKey: input.record.idempotencyKey },
  );
  const record = parseIdempotencyRecord(input.record);
  assertIdempotencyOwnership(record, input);

  if (record.status === "in_progress") {
    return input.record;
  }

  if (record.status !== "pending") {
    throw new DistributedCoordinationError({
      code: "invalid_transition",
      message: `Cannot mark ${record.status} idempotency record as in_progress.`,
      idempotencyKey: record.idempotencyKey,
      ownerId: input.ownerId,
      expectedFencingToken: record.fencingToken,
      presentedFencingToken: input.fencingToken,
    });
  }

  return buildIdempotencyRecord({
    ...record,
    status: "in_progress",
    updatedAt: input.now,
    startedAt: record.startedAt ?? input.now,
  });
}

export function completeIdempotencyRecord(
  input: CompleteIdempotencyRecordInput,
): IdempotencyRecord {
  if (!isNonEmptyString(input.resultFingerprint)) {
    throw new DistributedCoordinationError({
      code: "invalid_idempotency_record",
      message: "resultFingerprint must be a non-empty string.",
      idempotencyKey: input.record.idempotencyKey,
    });
  }
  ensureCanonicalTimestamp(
    input.now,
    "now",
    "invalid_idempotency_record",
    { idempotencyKey: input.record.idempotencyKey },
  );
  const record = parseIdempotencyRecord(input.record);
  assertIdempotencyOwnership(record, input);

  if (record.status === "completed") {
    if (record.resultFingerprint !== input.resultFingerprint.trim()) {
      throw new DistributedCoordinationError({
        code: "result_conflict",
        message: "Completed idempotency record cannot change its result fingerprint.",
        idempotencyKey: record.idempotencyKey,
        ownerId: input.ownerId,
        expectedFencingToken: record.fencingToken,
        presentedFencingToken: input.fencingToken,
      });
    }

    return input.record;
  }

  if (
    record.status === "failed_permanent" ||
    record.status === "expired" ||
    record.status === "superseded"
  ) {
    throw new DistributedCoordinationError({
      code: "invalid_transition",
      message: `Cannot complete idempotency record from status ${record.status}.`,
      idempotencyKey: record.idempotencyKey,
      ownerId: input.ownerId,
      expectedFencingToken: record.fencingToken,
      presentedFencingToken: input.fencingToken,
    });
  }

  return buildIdempotencyRecord({
    ...record,
    status: "completed",
    updatedAt: input.now,
    startedAt: record.startedAt ?? input.now,
    completedAt: input.now,
    resultFingerprint: input.resultFingerprint.trim(),
    failureCode: null,
  });
}

export function failIdempotencyRecordRetryable(
  input: FailIdempotencyRecordInput,
): IdempotencyRecord {
  if (!isNonEmptyString(input.failureCode)) {
    throw new DistributedCoordinationError({
      code: "invalid_idempotency_record",
      message: "failureCode must be a non-empty string.",
      idempotencyKey: input.record.idempotencyKey,
    });
  }
  ensureCanonicalTimestamp(
    input.now,
    "now",
    "invalid_idempotency_record",
    { idempotencyKey: input.record.idempotencyKey },
  );
  const record = parseIdempotencyRecord(input.record);
  assertIdempotencyOwnership(record, input);

  if (record.status === "failed_retryable") {
    if (record.failureCode !== input.failureCode.trim()) {
      throw new DistributedCoordinationError({
        code: "invalid_transition",
        message: "Retryable failure code cannot change for the same terminal state.",
        idempotencyKey: record.idempotencyKey,
        ownerId: input.ownerId,
        expectedFencingToken: record.fencingToken,
        presentedFencingToken: input.fencingToken,
      });
    }
    return input.record;
  }

  if (
    record.status === "completed" ||
    record.status === "failed_permanent" ||
    record.status === "expired" ||
    record.status === "superseded"
  ) {
    throw new DistributedCoordinationError({
      code: "invalid_transition",
      message: `Cannot mark idempotency record as failed_retryable from status ${record.status}.`,
      idempotencyKey: record.idempotencyKey,
      ownerId: input.ownerId,
      expectedFencingToken: record.fencingToken,
      presentedFencingToken: input.fencingToken,
    });
  }

  return buildIdempotencyRecord({
    ...record,
    status: "failed_retryable",
    updatedAt: input.now,
    startedAt: record.startedAt ?? input.now,
    completedAt: null,
    resultFingerprint: null,
    failureCode: input.failureCode.trim(),
  });
}

export function failIdempotencyRecordPermanent(
  input: FailIdempotencyRecordInput,
): IdempotencyRecord {
  if (!isNonEmptyString(input.failureCode)) {
    throw new DistributedCoordinationError({
      code: "invalid_idempotency_record",
      message: "failureCode must be a non-empty string.",
      idempotencyKey: input.record.idempotencyKey,
    });
  }
  ensureCanonicalTimestamp(
    input.now,
    "now",
    "invalid_idempotency_record",
    { idempotencyKey: input.record.idempotencyKey },
  );
  const record = parseIdempotencyRecord(input.record);
  assertIdempotencyOwnership(record, input);

  if (record.status === "failed_permanent") {
    if (record.failureCode !== input.failureCode.trim()) {
      throw new DistributedCoordinationError({
        code: "invalid_transition",
        message: "Permanent failure code cannot change for the same terminal state.",
        idempotencyKey: record.idempotencyKey,
        ownerId: input.ownerId,
        expectedFencingToken: record.fencingToken,
        presentedFencingToken: input.fencingToken,
      });
    }
    return input.record;
  }

  if (
    record.status === "completed" ||
    record.status === "expired" ||
    record.status === "superseded"
  ) {
    throw new DistributedCoordinationError({
      code: "invalid_transition",
      message: `Cannot mark idempotency record as failed_permanent from status ${record.status}.`,
      idempotencyKey: record.idempotencyKey,
      ownerId: input.ownerId,
      expectedFencingToken: record.fencingToken,
      presentedFencingToken: input.fencingToken,
    });
  }

  return buildIdempotencyRecord({
    ...record,
    status: "failed_permanent",
    updatedAt: input.now,
    startedAt: record.startedAt ?? input.now,
    completedAt: null,
    resultFingerprint: null,
    failureCode: input.failureCode.trim(),
  });
}

export function expireIdempotencyRecord(
  input: IdempotencyMutationInput,
): IdempotencyRecord {
  ensureCanonicalTimestamp(
    input.now,
    "now",
    "invalid_idempotency_record",
    { idempotencyKey: input.record.idempotencyKey },
  );
  const record = parseIdempotencyRecord(input.record);
  assertIdempotencyOwnership(record, input);

  if (record.status === "expired") {
    return input.record;
  }

  if (
    record.status === "completed" ||
    record.status === "failed_permanent" ||
    record.status === "superseded"
  ) {
    throw new DistributedCoordinationError({
      code: "invalid_transition",
      message: `Cannot expire idempotency record from status ${record.status}.`,
      idempotencyKey: record.idempotencyKey,
      ownerId: input.ownerId,
      expectedFencingToken: record.fencingToken,
      presentedFencingToken: input.fencingToken,
    });
  }

  return buildIdempotencyRecord({
    ...record,
    status: "expired",
    updatedAt: input.now,
    completedAt: null,
    resultFingerprint: null,
    failureCode: null,
  });
}

export function supersedeIdempotencyRecord(
  input: IdempotencyMutationInput,
): IdempotencyRecord {
  ensureCanonicalTimestamp(
    input.now,
    "now",
    "invalid_idempotency_record",
    { idempotencyKey: input.record.idempotencyKey },
  );
  const record = parseIdempotencyRecord(input.record);
  assertIdempotencyOwnership(record, input);

  if (record.status === "superseded") {
    return input.record;
  }

  if (record.status === "completed") {
    throw new DistributedCoordinationError({
      code: "invalid_transition",
      message: "Completed idempotency records cannot be superseded.",
      idempotencyKey: record.idempotencyKey,
      ownerId: input.ownerId,
      expectedFencingToken: record.fencingToken,
      presentedFencingToken: input.fencingToken,
    });
  }

  return buildIdempotencyRecord({
    ...record,
    status: "superseded",
    updatedAt: input.now,
    completedAt: null,
    resultFingerprint: null,
    failureCode: null,
  });
}

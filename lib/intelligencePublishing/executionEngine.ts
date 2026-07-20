import { createHash } from "node:crypto";

import {
  buildPublicationEventIdempotencyKey,
  parsePublicationEventEnvelope,
  type PublicationEventEnvelope,
} from "./eventContracts";
import {
  buildLockResourceKey,
  type CoordinationJsonObject,
  type CoordinationJsonValue,
  type LockResource,
  type LockResourceType,
} from "./distributedCoordination";
import {
  resolveImpact,
  type GovernanceRequirement,
  type ImpactAction,
  type ImpactPlan,
} from "./impactResolver";
import {
  buildJobTargetKey,
  expandImpactActionIntoJobs,
  parseJob,
  type ExpandImpactActionIntoJobsContext,
  type Job,
  type JobMetadata,
  type JobType,
} from "./jobModel";
import {
  createOrchestrationRun,
  parseOrchestrationRun,
  type OrchestrationRun,
  type OrchestrationRunMetadata,
} from "./orchestrationRun";
import {
  assertRegistrySnapshotPublicSafe,
  buildImpactResolutionContextFromRegistry,
  buildJobExpansionContextFromRegistry,
  buildRegistrySnapshotFingerprint,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
  type RegistrySnapshot,
} from "./registryAdapter";

export type ExecutionCoordinationRequirement = Readonly<{
  requirementId: string;
  resourceType: LockResourceType;
  resourceId: string;
  lockKey: string;
  operationType: string;
  idempotencyKey: string;
  ownerScope: string;
  requiredBeforeJobIds: readonly string[];
  releaseAfterJobIds: readonly string[];
  metadata: CoordinationJsonObject;
}>;

export type ExecutionGovernanceSummary = Readonly<{
  governanceRequirement: GovernanceRequirement;
  requiresHumanReview: boolean;
  requiresImmediateSuppression: boolean;
  reviewJobIds: readonly string[];
  suppressionJobIds: readonly string[];
  publicationJobIds: readonly string[];
  blockedUntilReview: boolean;
  reasons: readonly string[];
}>;

export type ExecutionPlan = Readonly<{
  executionPlanId: string;
  executionPlanVersion: number;
  event: PublicationEventEnvelope;
  eventIdempotencyKey: string;
  registrySnapshotId: string;
  registrySnapshotVersion: number;
  registrySnapshotFingerprint: string;
  impactPlan: ImpactPlan;
  orchestrationRun: OrchestrationRun;
  jobs: readonly Job[];
  executionOrder: readonly string[];
  coordinationRequirements: readonly ExecutionCoordinationRequirement[];
  governanceSummary: ExecutionGovernanceSummary;
  estimatedCost: number;
  createdAt: string;
  metadata: CoordinationJsonObject;
}>;

export type ExecutionPlanValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type ExecutionPlanValidationResult =
  | Readonly<{
      ok: true;
      executionPlan: ExecutionPlan;
    }>
  | Readonly<{
      ok: false;
      issues: readonly ExecutionPlanValidationIssue[];
    }>;

export type ExecutionEngineErrorCode =
  | "invalid_event"
  | "invalid_registry_snapshot"
  | "impact_resolution_failed"
  | "run_creation_failed"
  | "job_expansion_failed"
  | "duplicate_job_conflict"
  | "orphan_job_dependency"
  | "inconsistent_job_graph"
  | "cyclic_job_graph"
  | "invalid_execution_order"
  | "invalid_coordination_requirement"
  | "invalid_governance_summary"
  | "inconsistent_execution_plan"
  | "invalid_cost"
  | "private_field_detected";

export class ExecutionEngineError extends Error {
  readonly code: ExecutionEngineErrorCode;
  readonly executionPlanId?: string;
  readonly eventId?: string;
  readonly runId?: string;
  readonly jobId?: string;
  readonly path?: string;

  constructor(
    input: Readonly<{
      code: ExecutionEngineErrorCode;
      message: string;
      executionPlanId?: string;
      eventId?: string;
      runId?: string;
      jobId?: string;
      path?: string;
    }>,
  ) {
    super(input.message);
    this.name = "ExecutionEngineError";
    this.code = input.code;
    this.executionPlanId = input.executionPlanId;
    this.eventId = input.eventId;
    this.runId = input.runId;
    this.jobId = input.jobId;
    this.path = input.path;
  }
}

export type BuildExecutionPlanInput = Readonly<{
  event: unknown;
  registrySnapshot: unknown;
  runId: string;
  now: () => string;
  eventIdempotencyKey?: string;
  runEpoch?: number;
  attempt?: number;
  executionPlanVersion?: number;
  maxAttemptsByJobType?: Readonly<Partial<Record<JobType, number>>>;
  estimatedCostByJobType?: Readonly<Partial<Record<JobType, number>>>;
  metadataByJobType?: Readonly<Partial<Record<JobType, JobMetadata>>>;
  dependencyJobIdsByTargetKey?: Readonly<Record<string, readonly string[]>>;
  dependentJobIdsByTargetKey?: Readonly<Record<string, readonly string[]>>;
  metadata?: CoordinationJsonObject;
  orchestrationRunMetadata?: OrchestrationRunMetadata;
}>;

const ACTION_EXPANSION_ORDER: Readonly<Record<ImpactAction, number>> =
  Object.freeze({
    suppress: 0,
    rollback: 1,
    request_review: 2,
    generate_asset_version: 3,
    regenerate_variant: 4,
    update_metadata: 5,
    update_freshness: 6,
    publish: 7,
    republish: 8,
    skip: 9,
  });

const JOB_PRIORITY_ORDER = Object.freeze({
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
} as const);

const JOB_EXECUTION_TYPE_ORDER: Readonly<Record<JobType, number>> = Object.freeze({
  suppress: 0,
  rollback: 1,
  review: 2,
  generate_asset_version: 3,
  generate_variant: 4,
  update_metadata: 5,
  update_freshness: 6,
  publish: 7,
});

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareNullableStrings(
  left: string | null,
  right: string | null,
): number {
  return compareStrings(left ?? "", right ?? "");
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

function uniqueSortedStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareStrings));
}

function freezeMetadata(metadata: CoordinationJsonObject | undefined): CoordinationJsonObject {
  return Object.freeze({ ...(metadata ?? {}) });
}

function freezeCoordinationRequirement(
  requirement: ExecutionCoordinationRequirement,
): ExecutionCoordinationRequirement {
  return Object.freeze({
    ...requirement,
    requiredBeforeJobIds: uniqueSortedStrings(requirement.requiredBeforeJobIds),
    releaseAfterJobIds: uniqueSortedStrings(requirement.releaseAfterJobIds),
    metadata: freezeMetadata(requirement.metadata),
  });
}

function freezeGovernanceSummary(
  summary: ExecutionGovernanceSummary,
): ExecutionGovernanceSummary {
  return Object.freeze({
    ...summary,
    reviewJobIds: uniqueSortedStrings(summary.reviewJobIds),
    suppressionJobIds: uniqueSortedStrings(summary.suppressionJobIds),
    publicationJobIds: uniqueSortedStrings(summary.publicationJobIds),
    reasons: Object.freeze([...summary.reasons]),
  });
}

function freezeExecutionPlan(plan: ExecutionPlan): ExecutionPlan {
  return Object.freeze({
    ...plan,
    jobs: Object.freeze([...plan.jobs]),
    executionOrder: Object.freeze([...plan.executionOrder]),
    coordinationRequirements: Object.freeze(
      plan.coordinationRequirements.map(freezeCoordinationRequirement),
    ),
    governanceSummary: freezeGovernanceSummary(plan.governanceSummary),
    metadata: freezeMetadata(plan.metadata),
  });
}

function buildStableHash(parts: readonly string[], prefix: string): string {
  const hash = createHash("sha256")
    .update(parts.join("||"))
    .digest("hex");

  return `${prefix}${hash}`;
}

function canonicalizeJob(job: Job): string {
  return JSON.stringify({
    ...job,
    dependencyJobIds: [...job.dependencyJobIds].sort(compareStrings),
    dependentJobIds: [...job.dependentJobIds].sort(compareStrings),
    metadata: Object.fromEntries(
      Object.entries(job.metadata).sort((left, right) =>
        compareStrings(left[0], right[0]),
      ),
    ),
  });
}

function compareJobsForPlanning(left: Job, right: Job): number {
  const byPriority =
    JOB_PRIORITY_ORDER[left.priority] - JOB_PRIORITY_ORDER[right.priority];
  if (byPriority !== 0) return byPriority;

  const leftUrgency =
    left.jobType === "suppress" || left.jobType === "rollback" ? 0 : 1;
  const rightUrgency =
    right.jobType === "suppress" || right.jobType === "rollback" ? 0 : 1;
  if (leftUrgency !== rightUrgency) {
    return leftUrgency - rightUrgency;
  }

  const byType =
    JOB_EXECUTION_TYPE_ORDER[left.jobType] -
    JOB_EXECUTION_TYPE_ORDER[right.jobType];
  if (byType !== 0) return byType;

  const byAsset = compareNullableStrings(left.assetId, right.assetId);
  if (byAsset !== 0) return byAsset;

  const byLocale = compareNullableStrings(left.locale, right.locale);
  if (byLocale !== 0) return byLocale;

  const byChannel = compareNullableStrings(left.channel, right.channel);
  if (byChannel !== 0) return byChannel;

  return compareStrings(left.jobId, right.jobId);
}

function buildCanonicalNow(input: () => string): readonly [() => string, string] {
  const value = input();
  if (!isCanonicalIsoTimestamp(value)) {
    throw new ExecutionEngineError({
      code: "inconsistent_execution_plan",
      path: "now",
      message: `Expected a canonical ISO timestamp, received ${value}.`,
    });
  }

  return [() => value, value] as const;
}

function toExecutionEngineError(
  error: unknown,
  fallback: Readonly<{
    code: ExecutionEngineErrorCode;
    message: string;
    eventId?: string;
    runId?: string;
    jobId?: string;
    path?: string;
  }>,
): ExecutionEngineError {
  if (error instanceof ExecutionEngineError) {
    return error;
  }

  if (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    "message" in error
  ) {
    const candidate = error as {
      code?: string;
      message?: string;
      path?: string;
    };

    if (candidate.code === "private_field_detected") {
      return new ExecutionEngineError({
        code: "private_field_detected",
        message: String(candidate.message),
        path: candidate.path,
        eventId: fallback.eventId,
        runId: fallback.runId,
        jobId: fallback.jobId,
      });
    }
  }

  return new ExecutionEngineError({
    code: fallback.code,
    message:
      error instanceof Error && isNonEmptyString(error.message)
        ? error.message
        : fallback.message,
    eventId: fallback.eventId,
    runId: fallback.runId,
    jobId: fallback.jobId,
    path: fallback.path,
  });
}

function buildRequirementId(input: Readonly<{
  resourceType: LockResourceType;
  resourceId: string;
  lockKey: string;
  operationType: string;
  idempotencyKey: string;
  ownerScope: string;
}>): string {
  return buildStableHash(
    [
      input.resourceType,
      input.resourceId,
      input.lockKey,
      input.operationType,
      input.idempotencyKey,
      input.ownerScope,
    ],
    "ipp_req_",
  );
}

function buildRequirementIdempotencyKey(input: Readonly<{
  eventIdempotencyKey: string;
  resourceType: LockResourceType;
  resourceId: string;
  operationType: string;
}>): string {
  return buildStableHash(
    [
      input.eventIdempotencyKey,
      input.resourceType,
      input.resourceId,
      input.operationType,
    ],
    "ipp_req_idem_",
  );
}

function buildLockResource(input: Readonly<{
  resourceType: LockResourceType;
  resourceId: string;
  scope?: string | null;
  partitionKey?: string | null;
}>): LockResource {
  return Object.freeze({
    resourceType: input.resourceType,
    resourceId: input.resourceId.trim(),
    scope: input.scope?.trim() ?? null,
    partitionKey: input.partitionKey?.trim() ?? null,
  });
}

function appendCoordinationRequirement(
  aggregate: Map<string, ExecutionCoordinationRequirement>,
  input: Readonly<{
    resourceType: LockResourceType;
    resourceId: string;
    operationType: string;
    ownerScope: string;
    eventIdempotencyKey: string;
    requiredBeforeJobIds: readonly string[];
    releaseAfterJobIds: readonly string[];
    metadata?: CoordinationJsonObject;
    scope?: string | null;
    partitionKey?: string | null;
  }>,
): void {
  const resource = buildLockResource({
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    scope: input.scope,
    partitionKey: input.partitionKey,
  });
  const lockKey = buildLockResourceKey(resource);
  const idempotencyKey = buildRequirementIdempotencyKey({
    eventIdempotencyKey: input.eventIdempotencyKey,
    resourceType: resource.resourceType,
    resourceId: resource.resourceId,
    operationType: input.operationType,
  });
  const requirementId = buildRequirementId({
    resourceType: resource.resourceType,
    resourceId: resource.resourceId,
    lockKey,
    operationType: input.operationType,
    idempotencyKey,
    ownerScope: input.ownerScope,
  });
  const existing = aggregate.get(requirementId);
  const merged = freezeCoordinationRequirement({
    requirementId,
    resourceType: resource.resourceType,
    resourceId: resource.resourceId,
    lockKey,
    operationType: input.operationType,
    idempotencyKey,
    ownerScope: input.ownerScope,
    requiredBeforeJobIds: Object.freeze([
      ...(existing?.requiredBeforeJobIds ?? []),
      ...input.requiredBeforeJobIds,
    ]),
    releaseAfterJobIds: Object.freeze([
      ...(existing?.releaseAfterJobIds ?? []),
      ...input.releaseAfterJobIds,
    ]),
    metadata: freezeMetadata({
      ...(existing?.metadata ?? {}),
      ...(input.metadata ?? {}),
    }),
  });

  aggregate.set(requirementId, merged);
}

function shouldCreateAssetRequirement(job: Job): boolean {
  return (
    job.assetId != null &&
    [
      "generate_asset_version",
      "generate_variant",
      "update_metadata",
      "update_freshness",
      "review",
    ].includes(job.jobType)
  );
}

function shouldCreateAssetVersionRequirement(job: Job): boolean {
  return (
    job.assetVersionId != null &&
    ["generate_variant", "publish", "suppress", "rollback"].includes(job.jobType)
  );
}

function shouldCreatePublicationRequirement(job: Job): boolean {
  return ["publish", "suppress", "rollback"].includes(job.jobType);
}

function buildPublicationDestinationResourceId(job: Job): string {
  return [
    job.assetId ?? "unknown_asset",
    job.locale ?? "*",
    job.channel ?? "*",
  ].join("::");
}

function assertJsonSafeMetadata(
  value: unknown,
  path: string,
): asserts value is CoordinationJsonObject {
  if (!isJsonSafe(value)) {
    throw new ExecutionEngineError({
      code: "inconsistent_execution_plan",
      path,
      message: `Expected JSON-safe metadata at ${path}.`,
    });
  }
}

function buildActionSortKey(action: ImpactAction): number {
  return ACTION_EXPANSION_ORDER[action];
}

export function calculateExecutionPlanEstimatedCost(
  jobs: readonly Job[],
): number {
  const total = jobs.reduce((sum, job) => sum + job.estimatedCost, 0);
  return Number(total.toFixed(6));
}

export function buildExecutionPlanId(input: Readonly<{
  eventIdempotencyKey: string;
  registrySnapshotFingerprint: string;
  impactPlanId: string;
  runId: string;
  jobIds: readonly string[];
  executionPlanVersion: number;
}>): string {
  return buildStableHash(
    [
      input.eventIdempotencyKey,
      input.registrySnapshotFingerprint,
      input.impactPlanId,
      input.runId,
      [...input.jobIds].sort(compareStrings).join(","),
      String(input.executionPlanVersion),
    ],
    "ipp_exec_",
  );
}

export function expandImpactPlanIntoJobs(
  impactPlan: ImpactPlan,
  context: ExpandImpactActionIntoJobsContext,
): readonly Job[] {
  const deduped = new Map<string, Job>();
  const actions = [...impactPlan.requiredActions].sort(
    (left, right) => buildActionSortKey(left) - buildActionSortKey(right),
  );

  for (const action of actions) {
    const jobs = expandImpactActionIntoJobs(action, impactPlan, context);
    for (const job of jobs) {
      const parsed = parseJob(job);
      const existing = deduped.get(parsed.jobId);
      if (existing == null) {
        deduped.set(parsed.jobId, parsed);
        continue;
      }

      if (canonicalizeJob(existing) !== canonicalizeJob(parsed)) {
        throw new ExecutionEngineError({
          code: "duplicate_job_conflict",
          runId: parsed.runId,
          jobId: parsed.jobId,
          message: `Job ${parsed.jobId} was generated multiple times with conflicting content.`,
        });
      }
    }
  }

  return Object.freeze(
    [...deduped.values()].sort(compareJobsForPlanning),
  );
}

export function normalizeExecutionJobs(
  jobs: readonly Job[],
): readonly Job[] {
  const parsedJobs = jobs.map((job) => parseJob(job));
  const jobById = new Map<string, Job>();
  for (const job of parsedJobs) {
    const existing = jobById.get(job.jobId);
    if (existing == null) {
      jobById.set(job.jobId, job);
      continue;
    }

    if (canonicalizeJob(existing) !== canonicalizeJob(job)) {
      throw new ExecutionEngineError({
        code: "duplicate_job_conflict",
        runId: job.runId,
        jobId: job.jobId,
        message: `Duplicate job ${job.jobId} differs across candidates.`,
      });
    }
  }

  const dependencySets = new Map<string, Set<string>>();
  const dependentSets = new Map<string, Set<string>>();
  for (const job of jobById.values()) {
    dependencySets.set(job.jobId, new Set<string>());
    dependentSets.set(job.jobId, new Set<string>());
  }

  const addDependencyEdge = (
    dependentJobId: string,
    dependencyJobId: string,
    sourcePath: string,
  ) => {
    if (dependentJobId === dependencyJobId) {
      throw new ExecutionEngineError({
        code: "inconsistent_job_graph",
        jobId: dependentJobId,
        path: sourcePath,
        message: `Job ${dependentJobId} cannot depend on itself.`,
      });
    }
    if (!jobById.has(dependencyJobId)) {
      throw new ExecutionEngineError({
        code: "orphan_job_dependency",
        jobId: dependentJobId,
        path: sourcePath,
        message: `Job ${dependentJobId} references unknown dependency ${dependencyJobId}.`,
      });
    }

    dependencySets.get(dependentJobId)?.add(dependencyJobId);
    dependentSets.get(dependencyJobId)?.add(dependentJobId);
  };

  for (const job of jobById.values()) {
    for (const dependencyJobId of job.dependencyJobIds) {
      addDependencyEdge(job.jobId, dependencyJobId, `jobs.${job.jobId}.dependencyJobIds`);
    }
    for (const dependentJobId of job.dependentJobIds) {
      if (!jobById.has(dependentJobId)) {
        throw new ExecutionEngineError({
          code: "orphan_job_dependency",
          jobId: job.jobId,
          path: `jobs.${job.jobId}.dependentJobIds`,
          message: `Job ${job.jobId} references unknown dependent ${dependentJobId}.`,
        });
      }
      addDependencyEdge(dependentJobId, job.jobId, `jobs.${job.jobId}.dependentJobIds`);
    }
  }

  const normalized = [...jobById.values()].map((job) => {
    const dependencyJobIds = uniqueSortedStrings([
      ...(dependencySets.get(job.jobId) ?? new Set<string>()),
    ]);
    const dependentJobIds = uniqueSortedStrings([
      ...(dependentSets.get(job.jobId) ?? new Set<string>()),
    ]);

    const normalizedStatus =
      dependencyJobIds.length > 0 && job.status === "queued"
        ? "waiting_dependencies"
        : dependencyJobIds.length === 0 && job.status === "waiting_dependencies"
          ? "queued"
          : job.status;

    return parseJob({
      ...job,
      status: normalizedStatus,
      dependencyJobIds,
      dependentJobIds,
    });
  });

  buildExecutionOrder(normalized);

  return Object.freeze(normalized.sort(compareJobsForPlanning));
}

export function buildExecutionOrder(
  jobs: readonly Job[],
): readonly string[] {
  const normalizedJobs = [...jobs].map((job) => parseJob(job));
  const jobById = new Map(normalizedJobs.map((job) => [job.jobId, job] as const));
  const indegree = new Map<string, number>();
  const dependentsByJobId = new Map<string, string[]>();

  for (const job of normalizedJobs) {
    indegree.set(job.jobId, job.dependencyJobIds.length);
    dependentsByJobId.set(job.jobId, []);
  }

  for (const job of normalizedJobs) {
    for (const dependencyJobId of job.dependencyJobIds) {
      if (!jobById.has(dependencyJobId)) {
        throw new ExecutionEngineError({
          code: "orphan_job_dependency",
          jobId: job.jobId,
          message: `Job ${job.jobId} depends on missing job ${dependencyJobId}.`,
        });
      }
      dependentsByJobId.get(dependencyJobId)?.push(job.jobId);
    }
  }

  const ready = normalizedJobs
    .filter((job) => indegree.get(job.jobId) === 0)
    .sort(compareJobsForPlanning);
  const order: string[] = [];

  while (ready.length > 0) {
    const next = ready.shift();
    if (next == null) {
      break;
    }
    order.push(next.jobId);

    const dependents = dependentsByJobId.get(next.jobId) ?? [];
    for (const dependentJobId of dependents.sort(compareStrings)) {
      const remaining = (indegree.get(dependentJobId) ?? 0) - 1;
      indegree.set(dependentJobId, remaining);
      if (remaining === 0) {
        ready.push(jobById.get(dependentJobId)!);
        ready.sort(compareJobsForPlanning);
      }
    }
  }

  if (order.length !== normalizedJobs.length) {
    throw new ExecutionEngineError({
      code: "cyclic_job_graph",
      message: "The execution job graph contains a cycle.",
    });
  }

  return Object.freeze(order);
}

export function buildExecutionPlanCoordinationRequirements(input: Readonly<{
  eventIdempotencyKey: string;
  orchestrationRun: OrchestrationRun;
  jobs: readonly Job[];
}>): readonly ExecutionCoordinationRequirement[] {
  const aggregate = new Map<string, ExecutionCoordinationRequirement>();
  const allJobIds = Object.freeze(input.jobs.map((job) => job.jobId));

  appendCoordinationRequirement(aggregate, {
    resourceType: "orchestration_run",
    resourceId: input.orchestrationRun.runId,
    operationType: "plan_execution",
    ownerScope: input.orchestrationRun.runId,
    eventIdempotencyKey: input.eventIdempotencyKey,
    requiredBeforeJobIds: allJobIds,
    releaseAfterJobIds: allJobIds,
    metadata: freezeMetadata({
      eventId: input.orchestrationRun.eventId,
    }),
  });

  for (const job of input.jobs) {
    appendCoordinationRequirement(aggregate, {
      resourceType: "job",
      resourceId: job.jobId,
      operationType: job.action,
      ownerScope: input.orchestrationRun.runId,
      eventIdempotencyKey: input.eventIdempotencyKey,
      requiredBeforeJobIds: Object.freeze([job.jobId]),
      releaseAfterJobIds: Object.freeze([job.jobId]),
      metadata: freezeMetadata({
        runId: job.runId,
        jobType: job.jobType,
      }),
    });

    if (shouldCreateAssetRequirement(job) && job.assetId != null) {
      appendCoordinationRequirement(aggregate, {
        resourceType: "asset",
        resourceId: job.assetId,
        operationType: job.action,
        ownerScope: input.orchestrationRun.runId,
        eventIdempotencyKey: input.eventIdempotencyKey,
        requiredBeforeJobIds: Object.freeze([job.jobId]),
        releaseAfterJobIds: Object.freeze([job.jobId]),
        metadata: freezeMetadata({
          jobId: job.jobId,
          targetKey: buildJobTargetKey({
            jobType: job.jobType,
            assetId: job.assetId,
            locale: job.locale,
            channel: job.channel,
          }),
        }),
      });
    }

    if (shouldCreateAssetVersionRequirement(job) && job.assetVersionId != null) {
      appendCoordinationRequirement(aggregate, {
        resourceType: "asset_version",
        resourceId: job.assetVersionId,
        operationType: job.action,
        ownerScope: input.orchestrationRun.runId,
        eventIdempotencyKey: input.eventIdempotencyKey,
        requiredBeforeJobIds: Object.freeze([job.jobId]),
        releaseAfterJobIds: Object.freeze([job.jobId]),
        metadata: freezeMetadata({
          jobId: job.jobId,
          assetId: job.assetId,
        }),
      });
    }

    if (shouldCreatePublicationRequirement(job)) {
      appendCoordinationRequirement(aggregate, {
        resourceType: "publication_destination",
        resourceId: buildPublicationDestinationResourceId(job),
        operationType: job.action,
        ownerScope: input.orchestrationRun.runId,
        eventIdempotencyKey: input.eventIdempotencyKey,
        requiredBeforeJobIds: Object.freeze([job.jobId]),
        releaseAfterJobIds: Object.freeze([job.jobId]),
        metadata: freezeMetadata({
          jobId: job.jobId,
          assetVersionId: job.assetVersionId,
        }),
      });
    }
  }

  return Object.freeze(
    [...aggregate.values()].sort((left, right) =>
      compareStrings(left.requirementId, right.requirementId),
    ),
  );
}

export function buildExecutionGovernanceSummary(
  impactPlan: ImpactPlan,
  jobs: readonly Job[],
): ExecutionGovernanceSummary {
  const reviewJobIds = Object.freeze(
    jobs
      .filter((job) => job.jobType === "review")
      .map((job) => job.jobId),
  );
  const suppressionJobIds = Object.freeze(
    jobs
      .filter((job) => job.jobType === "suppress")
      .map((job) => job.jobId),
  );
  const publicationJobIds = Object.freeze(
    jobs
      .filter((job) => job.jobType === "publish")
      .map((job) => job.jobId),
  );

  const requiresHumanReview =
    impactPlan.governanceRequirement === "human_review" ||
    reviewJobIds.length > 0;
  const requiresImmediateSuppression =
    impactPlan.governanceRequirement === "immediate_suppression" ||
    suppressionJobIds.length > 0;

  return freezeGovernanceSummary({
    governanceRequirement: impactPlan.governanceRequirement,
    requiresHumanReview,
    requiresImmediateSuppression,
    reviewJobIds,
    suppressionJobIds,
    publicationJobIds,
    blockedUntilReview: requiresHumanReview && reviewJobIds.length > 0,
    reasons: Object.freeze(impactPlan.reasons.map((reason) => reason.code)),
  });
}

export function validateExecutionPlan(
  input: unknown,
): ExecutionPlanValidationResult {
  const issues: ExecutionPlanValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected an execution plan object.",
        }),
      ]),
    };
  }

  const candidate = input as Partial<ExecutionPlan>;

  if (!isNonEmptyString(candidate.executionPlanId)) {
    issues.push({
      path: "executionPlanId",
      message: "Expected a non-empty executionPlanId.",
    });
  }

  if (
    !Number.isInteger(candidate.executionPlanVersion) ||
    Number(candidate.executionPlanVersion) < 1
  ) {
    issues.push({
      path: "executionPlanVersion",
      message: "Expected executionPlanVersion >= 1.",
    });
  }

  let parsedEvent: PublicationEventEnvelope | null = null;
  try {
    parsedEvent = parsePublicationEventEnvelope(candidate.event);
  } catch (error) {
    issues.push({
      path: "event",
      message:
        error instanceof Error ? error.message : "Invalid event envelope.",
    });
  }

  const eventIdempotencyKey = candidate.eventIdempotencyKey;
  if (!isNonEmptyString(eventIdempotencyKey)) {
    issues.push({
      path: "eventIdempotencyKey",
      message: "Expected a non-empty event idempotency key.",
    });
  }

  const registrySnapshotId = candidate.registrySnapshotId;
  if (!isNonEmptyString(registrySnapshotId)) {
    issues.push({
      path: "registrySnapshotId",
      message: "Expected a non-empty registrySnapshotId.",
    });
  }

  if (
    !Number.isInteger(candidate.registrySnapshotVersion) ||
    Number(candidate.registrySnapshotVersion) < 1
  ) {
    issues.push({
      path: "registrySnapshotVersion",
      message: "Expected registrySnapshotVersion >= 1.",
    });
  }

  if (!isNonEmptyString(candidate.registrySnapshotFingerprint)) {
    issues.push({
      path: "registrySnapshotFingerprint",
      message: "Expected a non-empty registrySnapshotFingerprint.",
    });
  }

  const impactPlan = candidate.impactPlan;
  if (impactPlan == null || typeof impactPlan !== "object") {
    issues.push({
      path: "impactPlan",
      message: "Expected an ImpactPlan object.",
    });
  } else {
    const typedPlan = impactPlan as ImpactPlan;
    if (parsedEvent != null && typedPlan.triggerEventId !== parsedEvent.eventId) {
      issues.push({
        path: "impactPlan.triggerEventId",
        message: "ImpactPlan.triggerEventId must match event.eventId.",
      });
    }
  }

  let parsedRun: OrchestrationRun | null = null;
  try {
    parsedRun = parseOrchestrationRun(candidate.orchestrationRun);
  } catch (error) {
    issues.push({
      path: "orchestrationRun",
      message:
        error instanceof Error ? error.message : "Invalid orchestration run.",
    });
  }

  let parsedJobs: readonly Job[] = Object.freeze([]);
  if (!Array.isArray(candidate.jobs)) {
    issues.push({
      path: "jobs",
      message: "Expected a jobs array.",
    });
  } else {
    try {
      parsedJobs = Object.freeze(candidate.jobs.map((job) => parseJob(job)));
      parsedJobs = normalizeExecutionJobs(parsedJobs);
    } catch (error) {
      issues.push({
        path: "jobs",
        message: error instanceof Error ? error.message : "Invalid job graph.",
      });
    }
  }

  if (parsedEvent != null && isNonEmptyString(eventIdempotencyKey)) {
    const expectedKey = buildPublicationEventIdempotencyKey(parsedEvent);
    if (expectedKey !== eventIdempotencyKey) {
      issues.push({
        path: "eventIdempotencyKey",
        message: "eventIdempotencyKey does not match the canonical event identity.",
      });
    }
  }

  if (parsedRun != null && parsedEvent != null) {
    if (parsedRun.eventId !== parsedEvent.eventId) {
      issues.push({
        path: "orchestrationRun.eventId",
        message: "OrchestrationRun.eventId must match event.eventId.",
      });
    }
    if (
      isNonEmptyString(eventIdempotencyKey) &&
      parsedRun.eventIdempotencyKey !== eventIdempotencyKey
    ) {
      issues.push({
        path: "orchestrationRun.eventIdempotencyKey",
        message:
          "OrchestrationRun.eventIdempotencyKey must match plan.eventIdempotencyKey.",
      });
    }
    if (impactPlan != null && typeof impactPlan === "object") {
      if (parsedRun.impactPlanId !== (impactPlan as ImpactPlan).planId) {
        issues.push({
          path: "orchestrationRun.impactPlanId",
          message: "OrchestrationRun.impactPlanId must match ImpactPlan.planId.",
        });
      }
    }
  }

  if (parsedRun != null) {
    for (const job of parsedJobs) {
      if (job.runId !== parsedRun.runId) {
        issues.push({
          path: `jobs.${job.jobId}.runId`,
          message: "Every job must belong to orchestrationRun.runId.",
        });
      }
    }
  }

  if (!Array.isArray(candidate.executionOrder)) {
    issues.push({
      path: "executionOrder",
      message: "Expected an executionOrder array.",
    });
  } else {
    const executionOrder = candidate.executionOrder;
    const normalizedOrder = parsedJobs.length > 0 ? buildExecutionOrder(parsedJobs) : [];
    const expectedIds = uniqueSortedStrings(parsedJobs.map((job) => job.jobId));
    const receivedIds = uniqueSortedStrings(
      executionOrder.filter((value): value is string => typeof value === "string"),
    );

    if (
      expectedIds.length !== receivedIds.length ||
      expectedIds.some((value, index) => value !== receivedIds[index])
    ) {
      issues.push({
        path: "executionOrder",
        message: "executionOrder must contain each planned job exactly once.",
      });
    }

    if (JSON.stringify(executionOrder) !== JSON.stringify(normalizedOrder)) {
      issues.push({
        path: "executionOrder",
        message: "executionOrder is not the canonical deterministic topological order.",
      });
    }
  }

  const expectedCost = calculateExecutionPlanEstimatedCost(parsedJobs);
  if (typeof candidate.estimatedCost !== "number") {
    issues.push({
      path: "estimatedCost",
      message: "Expected a numeric estimatedCost.",
    });
  } else if (Number(candidate.estimatedCost.toFixed(6)) !== expectedCost) {
    issues.push({
      path: "estimatedCost",
      message: "estimatedCost must equal the canonical sum of job.estimatedCost values.",
    });
  }

  if (!isNonEmptyString(candidate.createdAt) || !isCanonicalIsoTimestamp(candidate.createdAt)) {
    issues.push({
      path: "createdAt",
      message: "Expected a canonical ISO createdAt timestamp.",
    });
  }

  if (!Array.isArray(candidate.coordinationRequirements)) {
    issues.push({
      path: "coordinationRequirements",
      message: "Expected a coordinationRequirements array.",
    });
  } else {
    const jobIdSet = new Set(parsedJobs.map((job) => job.jobId));
    for (let index = 0; index < candidate.coordinationRequirements.length; index += 1) {
      const requirement = candidate.coordinationRequirements[index];
      if (typeof requirement !== "object" || requirement == null || Array.isArray(requirement)) {
        issues.push({
          path: `coordinationRequirements.${index}`,
          message: "Expected a coordination requirement object.",
        });
        continue;
      }

      const typedRequirement = requirement as ExecutionCoordinationRequirement;
      if (!isNonEmptyString(typedRequirement.requirementId)) {
        issues.push({
          path: `coordinationRequirements.${index}.requirementId`,
          message: "Expected a non-empty requirementId.",
        });
      }
      if (!isNonEmptyString(typedRequirement.resourceId)) {
        issues.push({
          path: `coordinationRequirements.${index}.resourceId`,
          message: "Expected a non-empty resourceId.",
        });
      }
      if (!isNonEmptyString(typedRequirement.lockKey)) {
        issues.push({
          path: `coordinationRequirements.${index}.lockKey`,
          message: "Expected a non-empty lockKey.",
        });
      } else {
        try {
          const expectedLockKey = buildLockResourceKey(
            buildLockResource({
              resourceType: typedRequirement.resourceType,
              resourceId: typedRequirement.resourceId,
            }),
          );
          if (typedRequirement.lockKey !== expectedLockKey) {
            issues.push({
              path: `coordinationRequirements.${index}.lockKey`,
              message: "lockKey does not match the canonical resource key.",
            });
          }
        } catch (error) {
          issues.push({
            path: `coordinationRequirements.${index}.lockKey`,
            message:
              error instanceof Error ? error.message : "Invalid lock resource.",
          });
        }
      }

      for (const jobId of [
        ...typedRequirement.requiredBeforeJobIds,
        ...typedRequirement.releaseAfterJobIds,
      ]) {
        if (!jobIdSet.has(jobId)) {
          issues.push({
            path: `coordinationRequirements.${index}`,
            message: `Coordination requirement references unknown job ${jobId}.`,
          });
        }
      }

      if (!isJsonSafe(typedRequirement.metadata)) {
        issues.push({
          path: `coordinationRequirements.${index}.metadata`,
          message: "Coordination requirement metadata must be JSON-safe.",
        });
      }
    }
  }

  if (
    candidate.governanceSummary == null ||
    typeof candidate.governanceSummary !== "object" ||
    Array.isArray(candidate.governanceSummary)
  ) {
    issues.push({
      path: "governanceSummary",
      message: "Expected a governanceSummary object.",
    });
  } else {
    const summary = candidate.governanceSummary as ExecutionGovernanceSummary;
    const jobIdSet = new Set(parsedJobs.map((job) => job.jobId));
    for (const [field, jobIds] of [
      ["reviewJobIds", summary.reviewJobIds],
      ["suppressionJobIds", summary.suppressionJobIds],
      ["publicationJobIds", summary.publicationJobIds],
    ] as const) {
      for (const jobId of jobIds) {
        if (!jobIdSet.has(jobId)) {
          issues.push({
            path: `governanceSummary.${field}`,
            message: `${field} references unknown job ${jobId}.`,
          });
        }
      }
    }

    if (summary.blockedUntilReview && summary.reviewJobIds.length === 0) {
      issues.push({
        path: "governanceSummary.blockedUntilReview",
        message: "blockedUntilReview requires at least one review job.",
      });
    }
  }

  if (!isJsonSafe(candidate.metadata)) {
    issues.push({
      path: "metadata",
      message: "Execution plan metadata must be JSON-safe.",
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
    executionPlan: freezeExecutionPlan(candidate as ExecutionPlan),
  };
}

export function parseExecutionPlan(input: unknown): ExecutionPlan {
  const result = validateExecutionPlan(input);
  if (!result.ok) {
    throw new ExecutionEngineError({
      code: "inconsistent_execution_plan",
      message: result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    });
  }

  return result.executionPlan;
}

export function buildExecutionPlan(input: BuildExecutionPlanInput): ExecutionPlan {
  const [canonicalNow, createdAt] = buildCanonicalNow(input.now);

  let event: PublicationEventEnvelope;
  try {
    event = parsePublicationEventEnvelope(input.event);
  } catch (error) {
    throw toExecutionEngineError(error, {
      code: "invalid_event",
      message: "Failed to parse the publication event envelope.",
    });
  }

  const canonicalEventIdempotencyKey = buildPublicationEventIdempotencyKey(event);
  const eventIdempotencyKey = input.eventIdempotencyKey ?? canonicalEventIdempotencyKey;
  if (eventIdempotencyKey !== canonicalEventIdempotencyKey) {
    throw new ExecutionEngineError({
      code: "invalid_event",
      eventId: event.eventId,
      message:
        "The provided eventIdempotencyKey does not match the canonical event identity.",
    });
  }

  let parsedSnapshot: RegistrySnapshot;
  try {
    parsedSnapshot = parseRegistrySnapshot(input.registrySnapshot);
    assertRegistrySnapshotPublicSafe(parsedSnapshot);
  } catch (error) {
    throw toExecutionEngineError(error, {
      code: "invalid_registry_snapshot",
      eventId: event.eventId,
      message: "Failed to parse the registry snapshot.",
    });
  }

  let normalizedSnapshot: RegistrySnapshot;
  try {
    normalizedSnapshot = normalizeRegistrySnapshot(parsedSnapshot);
  } catch (error) {
    throw toExecutionEngineError(error, {
      code: "invalid_registry_snapshot",
      eventId: event.eventId,
      message: "Failed to normalize the registry snapshot.",
    });
  }

  const registrySnapshotFingerprint =
    buildRegistrySnapshotFingerprint(normalizedSnapshot);

  let impactPlan: ImpactPlan;
  try {
    const impactContext = buildImpactResolutionContextFromRegistry({
      snapshot: normalizedSnapshot,
      event,
      now: canonicalNow,
    });
    impactPlan = resolveImpact(event, impactContext);
  } catch (error) {
    throw toExecutionEngineError(error, {
      code: "impact_resolution_failed",
      eventId: event.eventId,
      message: "Failed to resolve the event impact.",
    });
  }

  let orchestrationRun: OrchestrationRun;
  try {
    orchestrationRun = createOrchestrationRun({
      runId: input.runId,
      event,
      eventIdempotencyKey,
      impactPlan,
      now: canonicalNow,
      runEpoch: input.runEpoch,
      attempt: input.attempt,
      metadata: input.orchestrationRunMetadata,
    });
  } catch (error) {
    throw toExecutionEngineError(error, {
      code: "run_creation_failed",
      eventId: event.eventId,
      runId: input.runId,
      message: "Failed to create the orchestration run.",
    });
  }

  let expandedJobs: readonly Job[];
  try {
    const jobContext = buildJobExpansionContextFromRegistry({
      snapshot: normalizedSnapshot,
      impactPlan,
      runId: orchestrationRun.runId,
      now: canonicalNow,
      maxAttemptsByJobType: input.maxAttemptsByJobType,
      estimatedCostByJobType: input.estimatedCostByJobType,
      metadataByJobType: input.metadataByJobType,
      dependencyJobIdsByTargetKey: input.dependencyJobIdsByTargetKey,
      dependentJobIdsByTargetKey: input.dependentJobIdsByTargetKey,
    });
    expandedJobs = expandImpactPlanIntoJobs(impactPlan, jobContext);
  } catch (error) {
    throw toExecutionEngineError(error, {
      code:
        error instanceof ExecutionEngineError &&
        error.code === "duplicate_job_conflict"
          ? "duplicate_job_conflict"
          : "job_expansion_failed",
      eventId: event.eventId,
      runId: orchestrationRun.runId,
      message: "Failed to expand the impact plan into jobs.",
    });
  }

  let jobs: readonly Job[];
  try {
    jobs = normalizeExecutionJobs(expandedJobs);
  } catch (error) {
    throw toExecutionEngineError(error, {
      code:
        error instanceof ExecutionEngineError ? error.code : "inconsistent_job_graph",
      eventId: event.eventId,
      runId: orchestrationRun.runId,
      message: "Failed to normalize the execution job graph.",
    });
  }

  let executionOrder: readonly string[];
  try {
    executionOrder = buildExecutionOrder(jobs);
  } catch (error) {
    throw toExecutionEngineError(error, {
      code:
        error instanceof ExecutionEngineError ? error.code : "invalid_execution_order",
      eventId: event.eventId,
      runId: orchestrationRun.runId,
      message: "Failed to build a deterministic execution order.",
    });
  }

  let coordinationRequirements: readonly ExecutionCoordinationRequirement[];
  try {
    coordinationRequirements = buildExecutionPlanCoordinationRequirements({
      eventIdempotencyKey,
      orchestrationRun,
      jobs,
    });
  } catch (error) {
    throw toExecutionEngineError(error, {
      code: "invalid_coordination_requirement",
      eventId: event.eventId,
      runId: orchestrationRun.runId,
      message: "Failed to build coordination requirements.",
    });
  }

  let governanceSummary: ExecutionGovernanceSummary;
  try {
    governanceSummary = buildExecutionGovernanceSummary(impactPlan, jobs);
  } catch (error) {
    throw toExecutionEngineError(error, {
      code: "invalid_governance_summary",
      eventId: event.eventId,
      runId: orchestrationRun.runId,
      message: "Failed to derive the governance summary.",
    });
  }

  const estimatedCost = calculateExecutionPlanEstimatedCost(jobs);
  const executionPlanVersion = input.executionPlanVersion ?? 1;
  if (!Number.isInteger(executionPlanVersion) || executionPlanVersion < 1) {
    throw new ExecutionEngineError({
      code: "inconsistent_execution_plan",
      eventId: event.eventId,
      message: "executionPlanVersion must be an integer >= 1.",
    });
  }

  const metadata = freezeMetadata(input.metadata);
  assertJsonSafeMetadata(metadata, "metadata");

  const executionPlanId = buildExecutionPlanId({
    eventIdempotencyKey,
    registrySnapshotFingerprint,
    impactPlanId: impactPlan.planId,
    runId: orchestrationRun.runId,
    jobIds: jobs.map((job) => job.jobId),
    executionPlanVersion,
  });

  const plan = freezeExecutionPlan({
    executionPlanId,
    executionPlanVersion,
    event,
    eventIdempotencyKey,
    registrySnapshotId: normalizedSnapshot.snapshotId,
    registrySnapshotVersion: normalizedSnapshot.snapshotVersion,
    registrySnapshotFingerprint,
    impactPlan,
    orchestrationRun,
    jobs,
    executionOrder,
    coordinationRequirements,
    governanceSummary,
    estimatedCost,
    createdAt,
    metadata,
  });

  const validationResult = validateExecutionPlan(plan);
  if (!validationResult.ok) {
    throw new ExecutionEngineError({
      code: "inconsistent_execution_plan",
      executionPlanId,
      eventId: event.eventId,
      runId: orchestrationRun.runId,
      message: validationResult.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; "),
    });
  }

  return validationResult.executionPlan;
}

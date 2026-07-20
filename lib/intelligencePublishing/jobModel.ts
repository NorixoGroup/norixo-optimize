import { createHash } from "node:crypto";

import type { PublicationEventPriority } from "./eventContracts";
import {
  IMPACT_ACTIONS,
  type ImpactAction,
  type ImpactPlan,
} from "./impactResolver";

export const JOB_STATUSES = Object.freeze([
  "queued",
  "waiting_dependencies",
  "leased",
  "running",
  "succeeded",
  "retryable_failed",
  "permanent_failed",
  "cancelled",
  "superseded",
  "timed_out",
] as const);

export type JobStatus = (typeof JOB_STATUSES)[number];

export const TERMINAL_JOB_STATUSES = Object.freeze([
  "succeeded",
  "permanent_failed",
  "cancelled",
  "superseded",
  "timed_out",
] as const);

export const ACTIVE_JOB_STATUSES = Object.freeze([
  "queued",
  "waiting_dependencies",
  "leased",
  "running",
  "retryable_failed",
] as const);

export const JOB_TYPES = Object.freeze([
  "generate_asset_version",
  "generate_variant",
  "publish",
  "suppress",
  "rollback",
  "update_metadata",
  "update_freshness",
  "review",
] as const);

export type JobType = (typeof JOB_TYPES)[number];

export type JobMetadata = Readonly<Record<string, unknown>>;

export type Job = Readonly<{
  jobId: string;
  runId: string;
  parentJobId: string | null;
  action: ImpactAction;
  jobType: JobType;
  status: JobStatus;
  priority: PublicationEventPriority;
  locale: string | null;
  channel: string | null;
  assetId: string | null;
  assetVersionId: string | null;
  dependencyJobIds: readonly string[];
  dependentJobIds: readonly string[];
  attempt: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseAcquiredAt: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  failureReason: string | null;
  cancellationReason: string | null;
  supersededByJobId: string | null;
  timeoutReason: string | null;
  estimatedCost: number;
  actualCost: number;
  metadata: JobMetadata;
}>;

export type JobValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

export type JobValidationResult =
  | Readonly<{
      ok: true;
      job: Job;
    }>
  | Readonly<{
      ok: false;
      issues: readonly JobValidationIssue[];
    }>;

export type JobTransitionErrorCode =
  | "invalid_transition"
  | "terminal_job"
  | "invalid_dependency"
  | "invalid_timestamp"
  | "missing_lease"
  | "missing_reason"
  | "missing_superseding_job"
  | "retry_not_allowed"
  | "unknown_action";

export class JobTransitionError extends Error {
  readonly code: JobTransitionErrorCode;
  readonly fromStatus: JobStatus;
  readonly toStatus: JobStatus;
  readonly jobId: string;

  constructor(input: Readonly<{
    code: JobTransitionErrorCode;
    fromStatus: JobStatus;
    toStatus: JobStatus;
    jobId: string;
    message: string;
  }>) {
    super(input.message);
    this.name = "JobTransitionError";
    this.code = input.code;
    this.fromStatus = input.fromStatus;
    this.toStatus = input.toStatus;
    this.jobId = input.jobId;
  }
}

export type CreateJobInput = Readonly<{
  jobId: string;
  runId: string;
  action: ImpactAction;
  jobType: JobType;
  priority: PublicationEventPriority;
  now: string;
  parentJobId?: string | null;
  locale?: string | null;
  channel?: string | null;
  assetId?: string | null;
  assetVersionId?: string | null;
  dependencyJobIds?: readonly string[];
  dependentJobIds?: readonly string[];
  attempt?: number;
  maxAttempts?: number;
  estimatedCost?: number;
  actualCost?: number;
  metadata?: JobMetadata;
}>;

export type TransitionJobInput = Readonly<{
  toStatus: JobStatus;
  now: string;
  failureReason?: string;
  cancellationReason?: string;
  supersededByJobId?: string;
  timeoutReason?: string;
}>;

export type LeaseJobInput = Readonly<{
  now: string;
  leaseOwner: string;
  leaseTtlSeconds: number;
}>;

export type ExpandImpactActionIntoJobsContext = Readonly<{
  runId: string;
  now: () => string;
  localesByAssetId?: Readonly<Record<string, readonly string[]>>;
  channelsByAssetId?: Readonly<Record<string, readonly string[]>>;
  activeAssetVersionIdsByAssetId?: Readonly<Record<string, string | null>>;
  dependencyJobIdsByTargetKey?: Readonly<Record<string, readonly string[]>>;
  dependentJobIdsByTargetKey?: Readonly<Record<string, readonly string[]>>;
  maxAttemptsByJobType?: Readonly<Partial<Record<JobType, number>>>;
  estimatedCostByJobType?: Readonly<Partial<Record<JobType, number>>>;
  metadataByJobType?: Readonly<Partial<Record<JobType, JobMetadata>>>;
}>;

const JOB_STATUS_TO_ALLOWED_TRANSITIONS: Readonly<
  Record<JobStatus, readonly JobStatus[]>
> = Object.freeze({
  queued: Object.freeze([
    "queued",
    "waiting_dependencies",
    "leased",
    "cancelled",
    "superseded",
    "timed_out",
  ] as const),
  waiting_dependencies: Object.freeze([
    "waiting_dependencies",
    "queued",
    "leased",
    "cancelled",
    "superseded",
    "timed_out",
  ] as const),
  leased: Object.freeze([
    "leased",
    "queued",
    "waiting_dependencies",
    "running",
    "cancelled",
    "superseded",
    "timed_out",
  ] as const),
  running: Object.freeze([
    "running",
    "succeeded",
    "retryable_failed",
    "permanent_failed",
    "cancelled",
    "superseded",
    "timed_out",
  ] as const),
  retryable_failed: Object.freeze([
    "retryable_failed",
    "queued",
    "waiting_dependencies",
    "cancelled",
    "superseded",
    "timed_out",
  ] as const),
  succeeded: Object.freeze(["succeeded"] as const),
  permanent_failed: Object.freeze(["permanent_failed"] as const),
  cancelled: Object.freeze(["cancelled"] as const),
  superseded: Object.freeze(["superseded"] as const),
  timed_out: Object.freeze(["timed_out"] as const),
});

const JOB_TYPE_BY_ACTION: Readonly<Record<ImpactAction, JobType | null>> =
  Object.freeze({
    skip: null,
    update_metadata: "update_metadata",
    update_freshness: "update_freshness",
    generate_asset_version: "generate_asset_version",
    regenerate_variant: "generate_variant",
    request_review: "review",
    publish: "publish",
    republish: "publish",
    suppress: "suppress",
    rollback: "rollback",
  });

const JOB_TYPE_ORDER_INDEX: Readonly<Record<JobType, number>> = Object.freeze({
  generate_asset_version: 0,
  generate_variant: 1,
  update_metadata: 2,
  update_freshness: 3,
  review: 4,
  publish: 5,
  suppress: 6,
  rollback: 7,
});

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareJobTypes(left: JobType, right: JobType): number {
  return JOB_TYPE_ORDER_INDEX[left] - JOB_TYPE_ORDER_INDEX[right];
}

function sortUniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareStrings));
}

function freezeMetadata(metadata: JobMetadata | undefined): JobMetadata {
  return Object.freeze({ ...(metadata ?? {}) });
}

function freezeJob(job: Job): Job {
  return Object.freeze({
    ...job,
    dependencyJobIds: Object.freeze([...job.dependencyJobIds]),
    dependentJobIds: Object.freeze([...job.dependentJobIds]),
    metadata: freezeMetadata(job.metadata),
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

function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

function isJobType(value: unknown): value is JobType {
  return typeof value === "string" && (JOB_TYPES as readonly string[]).includes(value);
}

function isImpactAction(value: unknown): value is ImpactAction {
  return (
    typeof value === "string" &&
    (IMPACT_ACTIONS as readonly string[]).includes(value)
  );
}

function ensureTimestamp(
  timestamp: string,
  job: Pick<Job, "jobId" | "status">,
  toStatus: JobStatus,
): void {
  if (!isCanonicalIsoTimestamp(timestamp)) {
    throw new JobTransitionError({
      code: "invalid_timestamp",
      fromStatus: job.status,
      toStatus,
      jobId: job.jobId,
      message: `Invalid canonical timestamp: ${timestamp}`,
    });
  }
}

function addSecondsToIso(baseTimestamp: string, seconds: number): string {
  const base = new Date(baseTimestamp).getTime();
  return new Date(base + seconds * 1000).toISOString();
}

function normalizeJobIds(values: readonly string[] | undefined): readonly string[] {
  return sortUniqueStrings(values ?? []);
}

function hasDependencies(job: Pick<Job, "dependencyJobIds">): boolean {
  return job.dependencyJobIds.length > 0;
}

function inferredQueuedStatus(
  dependencyJobIds: readonly string[],
): JobStatus {
  return dependencyJobIds.length > 0 ? "waiting_dependencies" : "queued";
}

function buildUpdatedJob(job: Job, changes: Partial<Job>): Job {
  return freezeJob({
    ...job,
    ...changes,
    dependencyJobIds: normalizeJobIds(
      changes.dependencyJobIds ?? job.dependencyJobIds,
    ),
    dependentJobIds: normalizeJobIds(
      changes.dependentJobIds ?? job.dependentJobIds,
    ),
    metadata: freezeMetadata(changes.metadata ?? job.metadata),
  });
}

function validateReason(
  value: string | undefined,
  fieldName:
    | "failureReason"
    | "cancellationReason"
    | "timeoutReason",
  job: Job,
  toStatus: JobStatus,
): string {
  if (!isNonEmptyString(value)) {
    throw new JobTransitionError({
      code: "missing_reason",
      fromStatus: job.status,
      toStatus,
      jobId: job.jobId,
      message: `${fieldName} is required for status ${toStatus}.`,
    });
  }
  return value.trim();
}

function ensureSameOrAllowedTransition(
  job: Job,
  toStatus: JobStatus,
): void {
  if (isTerminalJobStatus(job.status)) {
    throw new JobTransitionError({
      code: "terminal_job",
      fromStatus: job.status,
      toStatus,
      jobId: job.jobId,
      message: `Cannot transition terminal job ${job.jobId} from ${job.status} to ${toStatus}.`,
    });
  }
  if (!canTransitionJob(job.status, toStatus)) {
    throw new JobTransitionError({
      code: "invalid_transition",
      fromStatus: job.status,
      toStatus,
      jobId: job.jobId,
      message: `Invalid job transition from ${job.status} to ${toStatus}.`,
    });
  }
}

function jobStateNoOp(job: Job, nextStatus: JobStatus): boolean {
  return job.status === nextStatus;
}

function buildJobTargetKey(input: Readonly<{
  jobType: JobType;
  assetId?: string | null;
  locale?: string | null;
  channel?: string | null;
}>): string {
  return [
    input.jobType,
    input.assetId ?? "",
    input.locale ?? "",
    input.channel ?? "",
  ].join("|");
}

export { buildJobTargetKey };

export function isTerminalJobStatus(status: JobStatus): boolean {
  return (TERMINAL_JOB_STATUSES as readonly string[]).includes(status);
}

export function isActiveJobStatus(status: JobStatus): boolean {
  return (ACTIVE_JOB_STATUSES as readonly string[]).includes(status);
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return JOB_STATUS_TO_ALLOWED_TRANSITIONS[from].includes(to);
}

export function createJob(input: CreateJobInput): Job {
  if (!isNonEmptyString(input.jobId)) {
    throw new Error("jobId must be a non-empty string.");
  }
  if (!isNonEmptyString(input.runId)) {
    throw new Error("runId must be a non-empty string.");
  }
  ensureTimestamp(
    input.now,
    { jobId: input.jobId, status: "queued" },
    "queued",
  );

  const dependencyJobIds = normalizeJobIds(input.dependencyJobIds);
  const dependentJobIds = normalizeJobIds(input.dependentJobIds);
  const attempt = input.attempt ?? 1;
  const maxAttempts = input.maxAttempts ?? 3;

  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error("attempt must be an integer >= 1.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be an integer >= 1.");
  }

  return buildUpdatedJob(
    {
      jobId: input.jobId.trim(),
      runId: input.runId.trim(),
      parentJobId: input.parentJobId?.trim() ?? null,
      action: input.action,
      jobType: input.jobType,
      status: inferredQueuedStatus(dependencyJobIds),
      priority: input.priority,
      locale: input.locale?.trim() ?? null,
      channel: input.channel?.trim() ?? null,
      assetId: input.assetId?.trim() ?? null,
      assetVersionId: input.assetVersionId?.trim() ?? null,
      dependencyJobIds,
      dependentJobIds,
      attempt,
      maxAttempts,
      leaseOwner: null,
      leaseAcquiredAt: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      createdAt: input.now,
      updatedAt: input.now,
      startedAt: null,
      finishedAt: null,
      failureReason: null,
      cancellationReason: null,
      supersededByJobId: null,
      timeoutReason: null,
      estimatedCost: input.estimatedCost ?? 0,
      actualCost: input.actualCost ?? 0,
      metadata: freezeMetadata(input.metadata),
    },
    {},
  );
}

export function transitionJob(job: Job, input: TransitionJobInput): Job {
  ensureTimestamp(input.now, job, input.toStatus);

  if (jobStateNoOp(job, input.toStatus)) {
    return job;
  }

  ensureSameOrAllowedTransition(job, input.toStatus);

  let nextFailureReason = job.failureReason;
  let nextCancellationReason = job.cancellationReason;
  let nextSupersededByJobId = job.supersededByJobId;
  let nextTimeoutReason = job.timeoutReason;

  if (input.toStatus === "retryable_failed") {
    nextFailureReason = validateReason(
      input.failureReason,
      "failureReason",
      job,
      input.toStatus,
    );
  } else if (input.toStatus === "permanent_failed") {
    nextFailureReason = validateReason(
      input.failureReason,
      "failureReason",
      job,
      input.toStatus,
    );
  }

  if (input.toStatus === "cancelled") {
    nextCancellationReason = validateReason(
      input.cancellationReason,
      "cancellationReason",
      job,
      input.toStatus,
    );
  }

  if (input.toStatus === "superseded") {
    if (!isNonEmptyString(input.supersededByJobId)) {
      throw new JobTransitionError({
        code: "missing_superseding_job",
        fromStatus: job.status,
        toStatus: input.toStatus,
        jobId: job.jobId,
        message: "supersededByJobId is required for superseded jobs.",
      });
    }
    nextSupersededByJobId = input.supersededByJobId.trim();
  }

  if (input.toStatus === "timed_out") {
    nextTimeoutReason = validateReason(
      input.timeoutReason,
      "timeoutReason",
      job,
      input.toStatus,
    );
  }

  const nextStartedAt =
    job.startedAt == null &&
    (input.toStatus === "leased" || input.toStatus === "running")
      ? input.now
      : job.startedAt;

  const nextFinishedAt = isTerminalJobStatus(input.toStatus) ? input.now : null;

  return buildUpdatedJob(job, {
    status: input.toStatus,
    updatedAt: input.now,
    startedAt: nextStartedAt,
    finishedAt: nextFinishedAt,
    failureReason: nextFailureReason,
    cancellationReason: nextCancellationReason,
    supersededByJobId: nextSupersededByJobId,
    timeoutReason: nextTimeoutReason,
  });
}

export function leaseJob(job: Job, input: LeaseJobInput): Job {
  ensureTimestamp(input.now, job, "leased");
  if (!isNonEmptyString(input.leaseOwner)) {
    throw new JobTransitionError({
      code: "missing_lease",
      fromStatus: job.status,
      toStatus: "leased",
      jobId: job.jobId,
      message: "leaseOwner is required to lease a job.",
    });
  }
  if (!Number.isInteger(input.leaseTtlSeconds) || input.leaseTtlSeconds < 1) {
    throw new JobTransitionError({
      code: "missing_lease",
      fromStatus: job.status,
      toStatus: "leased",
      jobId: job.jobId,
      message: "leaseTtlSeconds must be an integer >= 1.",
    });
  }

  const leaseExpiresAt = addSecondsToIso(input.now, input.leaseTtlSeconds);
  if (
    job.status === "leased" &&
    job.leaseOwner === input.leaseOwner.trim() &&
    job.leaseAcquiredAt === input.now &&
    job.leaseExpiresAt === leaseExpiresAt
  ) {
    return job;
  }

  ensureSameOrAllowedTransition(job, "leased");

  return buildUpdatedJob(job, {
    status: "leased",
    updatedAt: input.now,
    startedAt: job.startedAt ?? input.now,
    leaseOwner: input.leaseOwner.trim(),
    leaseAcquiredAt: input.now,
    leaseExpiresAt,
    heartbeatAt: input.now,
  });
}

export function heartbeatJob(job: Job, now: string): Job {
  ensureTimestamp(now, job, job.status);
  if (job.heartbeatAt === now) {
    return job;
  }
  if (job.status !== "leased" && job.status !== "running") {
    throw new JobTransitionError({
      code: "invalid_transition",
      fromStatus: job.status,
      toStatus: job.status,
      jobId: job.jobId,
      message: `Cannot heartbeat job ${job.jobId} from status ${job.status}.`,
    });
  }
  return buildUpdatedJob(job, {
    updatedAt: now,
    heartbeatAt: now,
  });
}

export function releaseLease(job: Job, now: string): Job {
  ensureTimestamp(now, job, job.status);
  if (
    job.status !== "leased" &&
    job.status !== "running" &&
    job.status !== "retryable_failed"
  ) {
    throw new JobTransitionError({
      code: "invalid_transition",
      fromStatus: job.status,
      toStatus: job.status,
      jobId: job.jobId,
      message: `Cannot release lease for job ${job.jobId} from status ${job.status}.`,
    });
  }

  const nextStatus = inferredQueuedStatus(job.dependencyJobIds);
  return buildUpdatedJob(job, {
    status: nextStatus,
    updatedAt: now,
    leaseOwner: null,
    leaseAcquiredAt: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
  });
}

export function canRetry(job: Job): boolean {
  return job.status === "retryable_failed" && job.attempt < job.maxAttempts;
}

export function remainingAttempts(job: Job): number {
  return Math.max(job.maxAttempts - job.attempt, 0);
}

export function retryJob(job: Job, now: string): Job {
  ensureTimestamp(now, job, job.status);
  if (job.status === inferredQueuedStatus(job.dependencyJobIds)) {
    return job;
  }
  if (!canRetry(job)) {
    throw new JobTransitionError({
      code: "retry_not_allowed",
      fromStatus: job.status,
      toStatus: inferredQueuedStatus(job.dependencyJobIds),
      jobId: job.jobId,
      message: `Retry is not allowed for job ${job.jobId}.`,
    });
  }
  return buildUpdatedJob(job, {
    status: inferredQueuedStatus(job.dependencyJobIds),
    updatedAt: now,
    attempt: job.attempt + 1,
    leaseOwner: null,
    leaseAcquiredAt: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    finishedAt: null,
    failureReason: null,
    timeoutReason: null,
  });
}

export function completeJob(job: Job, now: string): Job {
  return transitionJob(job, {
    toStatus: "succeeded",
    now,
  });
}

export function cancelJob(
  job: Job,
  now: string,
  reason: string,
): Job {
  return transitionJob(job, {
    toStatus: "cancelled",
    now,
    cancellationReason: reason,
  });
}

export function timeoutJob(
  job: Job,
  now: string,
  reason: string,
): Job {
  return transitionJob(job, {
    toStatus: "timed_out",
    now,
    timeoutReason: reason,
  });
}

export function supersedeJob(
  job: Job,
  now: string,
  supersededByJobId: string,
): Job {
  return transitionJob(job, {
    toStatus: "superseded",
    now,
    supersededByJobId,
  });
}

export function isLeaseExpired(job: Job, now: string): boolean {
  if (job.leaseExpiresAt == null) {
    return false;
  }
  ensureTimestamp(now, job, job.status);
  return new Date(now).getTime() > new Date(job.leaseExpiresAt).getTime();
}

export function isJobRunnable(job: Job): boolean {
  return job.status === "queued";
}

function buildJobId(input: Readonly<{
  runId: string;
  action: ImpactAction;
  jobType: JobType;
  assetId?: string | null;
  locale?: string | null;
  channel?: string | null;
}>): string {
  const hash = createHash("sha256")
    .update(
      [
        input.runId,
        input.action,
        input.jobType,
        input.assetId ?? "",
        input.locale ?? "",
        input.channel ?? "",
      ].join("||"),
    )
    .digest("hex");

  return `ipp_job_${hash}`;
}

function buildSingleJob(
  action: ImpactAction,
  jobType: JobType,
  impactPlan: ImpactPlan,
  context: ExpandImpactActionIntoJobsContext,
  input: Readonly<{
    assetId?: string | null;
    locale?: string | null;
    channel?: string | null;
  }>,
): Job {
  const targetKey = buildJobTargetKey({
    jobType,
    assetId: input.assetId ?? null,
    locale: input.locale ?? null,
    channel: input.channel ?? null,
  });
  return createJob({
    jobId: buildJobId({
      runId: context.runId,
      action,
      jobType,
      assetId: input.assetId ?? null,
      locale: input.locale ?? null,
      channel: input.channel ?? null,
    }),
    runId: context.runId,
    action,
    jobType,
    priority: impactPlan.priority,
    now: context.now(),
    assetId: input.assetId ?? null,
    assetVersionId:
      input.assetId == null
        ? null
        : context.activeAssetVersionIdsByAssetId?.[input.assetId] ?? null,
    locale: input.locale ?? null,
    channel: input.channel ?? null,
    dependencyJobIds:
      context.dependencyJobIdsByTargetKey?.[targetKey] ?? Object.freeze([]),
    dependentJobIds:
      context.dependentJobIdsByTargetKey?.[targetKey] ?? Object.freeze([]),
    maxAttempts: context.maxAttemptsByJobType?.[jobType] ?? 3,
    estimatedCost: context.estimatedCostByJobType?.[jobType] ?? 0,
    metadata: {
      impactPlanId: impactPlan.planId,
      ...(context.metadataByJobType?.[jobType] ?? {}),
    },
  });
}

export function expandImpactActionIntoJobs(
  action: ImpactAction,
  impactPlan: ImpactPlan,
  context: ExpandImpactActionIntoJobsContext,
): readonly Job[] {
  const jobType = JOB_TYPE_BY_ACTION[action];
  if (jobType == null) {
    return Object.freeze([]);
  }

  const assetIds = sortUniqueStrings(impactPlan.impactedAssets);
  const jobs: Job[] = [];

  switch (action) {
    case "generate_asset_version": {
      for (const assetId of assetIds) {
        const locales =
          sortUniqueStrings(context.localesByAssetId?.[assetId] ?? []) ??
          Object.freeze([]);
        if (locales.length === 0) {
          jobs.push(
            buildSingleJob(action, jobType, impactPlan, context, {
              assetId,
              locale: null,
              channel: null,
            }),
          );
          continue;
        }
        for (const locale of locales) {
          jobs.push(
            buildSingleJob(action, jobType, impactPlan, context, {
              assetId,
              locale,
              channel: null,
            }),
          );
        }
      }
      break;
    }

    case "regenerate_variant": {
      for (const assetId of assetIds) {
        const locales = sortUniqueStrings(context.localesByAssetId?.[assetId] ?? []);
        const channels = sortUniqueStrings(
          context.channelsByAssetId?.[assetId] ?? [],
        );
        const resolvedLocales = locales.length > 0 ? locales : [null];
        const resolvedChannels = channels.length > 0 ? channels : [null];
        for (const locale of resolvedLocales) {
          for (const channel of resolvedChannels) {
            jobs.push(
              buildSingleJob(action, jobType, impactPlan, context, {
                assetId,
                locale,
                channel,
              }),
            );
          }
        }
      }
      break;
    }

    case "publish":
    case "republish": {
      for (const assetId of assetIds) {
        const channels = sortUniqueStrings(
          context.channelsByAssetId?.[assetId] ?? impactPlan.impactedChannels,
        );
        const resolvedChannels = channels.length > 0 ? channels : [null];
        for (const channel of resolvedChannels) {
          jobs.push(
            buildSingleJob(action, jobType, impactPlan, context, {
              assetId,
              locale: null,
              channel,
            }),
          );
        }
      }
      break;
    }

    case "suppress":
    case "rollback":
    case "update_metadata":
    case "update_freshness":
    case "request_review": {
      for (const assetId of assetIds) {
        jobs.push(
          buildSingleJob(action, jobType, impactPlan, context, {
            assetId,
            locale: null,
            channel: null,
          }),
        );
      }
      break;
    }

    case "skip":
      break;
  }

  return Object.freeze(
    [...jobs].sort((left, right) => {
      const byType = compareJobTypes(left.jobType, right.jobType);
      if (byType !== 0) return byType;
      return compareStrings(left.jobId, right.jobId);
    }),
  );
}

export function validateJob(input: unknown): JobValidationResult {
  const issues: JobValidationIssue[] = [];
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          path: "",
          message: "Expected a job object.",
        }),
      ]),
    };
  }

  const candidate = input as Record<string, unknown>;

  for (const field of ["jobId", "runId"] as const) {
    if (!isNonEmptyString(candidate[field])) {
      issues.push({
        path: field,
        message: "Expected a non-empty string.",
      });
    }
  }

  if (!isImpactAction(candidate.action)) {
    issues.push({
      path: "action",
      message: "Expected a known impact action.",
    });
  }

  if (!isJobType(candidate.jobType)) {
    issues.push({
      path: "jobType",
      message: `Expected one of: ${JOB_TYPES.join(", ")}.`,
    });
  }

  if (!isJobStatus(candidate.status)) {
    issues.push({
      path: "status",
      message: `Expected one of: ${JOB_STATUSES.join(", ")}.`,
    });
  }

  for (const field of ["createdAt", "updatedAt"] as const) {
    const value = candidate[field];
    if (!isNonEmptyString(value) || !isCanonicalIsoTimestamp(value)) {
      issues.push({
        path: field,
        message: "Expected a canonical ISO timestamp.",
      });
    }
  }

  for (const field of [
    "startedAt",
    "finishedAt",
    "leaseAcquiredAt",
    "leaseExpiresAt",
    "heartbeatAt",
  ] as const) {
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

  if (!Number.isInteger(candidate.attempt) || Number(candidate.attempt) < 1) {
    issues.push({
      path: "attempt",
      message: "Expected an integer >= 1.",
    });
  }

  if (
    !Number.isInteger(candidate.maxAttempts) ||
    Number(candidate.maxAttempts) < 1
  ) {
    issues.push({
      path: "maxAttempts",
      message: "Expected an integer >= 1.",
    });
  }

  const dependencyJobIds = Array.isArray(candidate.dependencyJobIds)
    ? candidate.dependencyJobIds
    : null;
  if (dependencyJobIds == null) {
    issues.push({
      path: "dependencyJobIds",
      message: "Expected an array of job ids.",
    });
  } else if (new Set(dependencyJobIds).size !== dependencyJobIds.length) {
    issues.push({
      path: "dependencyJobIds",
      message: "Dependency job ids must be deduplicated.",
    });
  } else if (!dependencyJobIds.every(isNonEmptyString)) {
    issues.push({
      path: "dependencyJobIds",
      message: "Dependency job ids must contain only non-empty strings.",
    });
  }

  const dependentJobIds = Array.isArray(candidate.dependentJobIds)
    ? candidate.dependentJobIds
    : null;
  if (dependentJobIds == null) {
    issues.push({
      path: "dependentJobIds",
      message: "Expected an array of job ids.",
    });
  } else if (new Set(dependentJobIds).size !== dependentJobIds.length) {
    issues.push({
      path: "dependentJobIds",
      message: "Dependent job ids must be deduplicated.",
    });
  } else if (!dependentJobIds.every(isNonEmptyString)) {
    issues.push({
      path: "dependentJobIds",
      message: "Dependent job ids must contain only non-empty strings.",
    });
  }

  const status = candidate.status;
  if (isJobStatus(status)) {
    if (isTerminalJobStatus(status)) {
      if (candidate.finishedAt == null) {
        issues.push({
          path: "finishedAt",
          message: "finishedAt is required for terminal statuses.",
        });
      }
    } else if (candidate.finishedAt != null) {
      issues.push({
        path: "finishedAt",
        message: "finishedAt must be null for non-terminal statuses.",
      });
    }

    if (status === "leased" || status === "running") {
      for (const field of ["leaseOwner", "leaseAcquiredAt", "leaseExpiresAt"] as const) {
        if (candidate[field] == null || candidate[field] === "") {
          issues.push({
            path: field,
            message: `${field} is required for ${status} jobs.`,
          });
        }
      }

      if (
        isNonEmptyString(candidate.leaseAcquiredAt) &&
        isNonEmptyString(candidate.leaseExpiresAt) &&
        new Date(candidate.leaseExpiresAt).getTime() <=
          new Date(candidate.leaseAcquiredAt).getTime()
      ) {
        issues.push({
          path: "leaseExpiresAt",
          message: "leaseExpiresAt must be later than leaseAcquiredAt.",
        });
      }

      if (
        candidate.heartbeatAt != null &&
        isNonEmptyString(candidate.leaseAcquiredAt) &&
        isNonEmptyString(candidate.heartbeatAt) &&
        new Date(candidate.heartbeatAt).getTime() <
          new Date(candidate.leaseAcquiredAt).getTime()
      ) {
        issues.push({
          path: "heartbeatAt",
          message: "heartbeatAt cannot be earlier than leaseAcquiredAt.",
        });
      }
    }

    if (status === "cancelled" && !isNonEmptyString(candidate.cancellationReason)) {
      issues.push({
        path: "cancellationReason",
        message: "cancellationReason is required for cancelled jobs.",
      });
    }

    if (
      (status === "retryable_failed" || status === "permanent_failed") &&
      !isNonEmptyString(candidate.failureReason)
    ) {
      issues.push({
        path: "failureReason",
        message: "failureReason is required for failed jobs.",
      });
    }

    if (status === "superseded" && !isNonEmptyString(candidate.supersededByJobId)) {
      issues.push({
        path: "supersededByJobId",
        message: "supersededByJobId is required for superseded jobs.",
      });
    }

    if (status === "timed_out" && !isNonEmptyString(candidate.timeoutReason)) {
      issues.push({
        path: "timeoutReason",
        message: "timeoutReason is required for timed out jobs.",
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
    job: freezeJob(candidate as Job),
  };
}

export function parseJob(input: unknown): Job {
  const result = validateJob(input);
  if (!result.ok) {
    throw new Error(
      result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | "),
    );
  }

  return result.job;
}

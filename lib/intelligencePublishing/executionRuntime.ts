import { createHash } from "node:crypto";

import type {
  CoordinationJsonObject,
  CoordinationJsonValue,
} from "./distributedCoordination";
import {
  parseExecutionPlan as parseEngineExecutionPlan,
  type ExecutionPlan as EngineExecutionPlan,
} from "./executionEngine";
import {
  assertRegistrySnapshotPublicSafe,
  buildRegistrySnapshotFingerprint,
  parseRegistrySnapshot,
  type RegistrySnapshot,
} from "./registryAdapter";
import type { JobType } from "./jobModel";

export const EXECUTION_RUNTIME_JOB_STATUSES = Object.freeze([
  "pending",
  "ready",
  "running",
  "completed",
  "skipped",
  "failed",
  "cancelled",
] as const);

export type ExecutionRuntimeJobStatus =
  (typeof EXECUTION_RUNTIME_JOB_STATUSES)[number];

export const EXECUTION_RUNTIME_DIAGNOSTIC_CODES = Object.freeze([
  "dependency_cycle",
  "missing_dependency",
  "duplicate_job",
  "invalid_job",
  "fingerprint_conflict",
  "already_completed",
  "retry_scheduled",
  "resume_detected",
  "graph_invalid",
] as const);

export type ExecutionRuntimeDiagnosticCode =
  (typeof EXECUTION_RUNTIME_DIAGNOSTIC_CODES)[number];

export type ExecutionRuntimeDiagnosticSeverity =
  | "info"
  | "warning"
  | "error";

export type ExecutionRuntimeDiagnostic = Readonly<{
  code: ExecutionRuntimeDiagnosticCode;
  severity: ExecutionRuntimeDiagnosticSeverity;
  jobId: string | null;
  dependencyJobId: string | null;
  message: string;
  metadata: CoordinationJsonObject;
}>;

export type ExecutionRuntimeRetryPolicy = Readonly<{
  maxAttempts: number;
  retryable: boolean;
}>;

export type ExecutionRuntimeTimeout = Readonly<{
  timeoutSeconds: number | null;
}>;

export type ExecutionRuntimeJobExecutionState = Readonly<{
  status: ExecutionRuntimeJobStatus;
  attemptCount: number;
  maxAttempts: number;
  blockedByJobIds: readonly string[];
  resumable: boolean;
  lastUpdatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  diagnostics: readonly ExecutionRuntimeDiagnostic[];
}>;

export type ExecutionRuntimeJob = Readonly<{
  id: string;
  fingerprint: string;
  type: JobType | string;
  dependencies: readonly string[];
  dependents: readonly string[];
  inputs: CoordinationJsonObject;
  outputs: CoordinationJsonObject;
  retryPolicy: ExecutionRuntimeRetryPolicy;
  timeout: ExecutionRuntimeTimeout;
  diagnostics: readonly ExecutionRuntimeDiagnostic[];
  executionState: ExecutionRuntimeJobExecutionState;
  metadata: CoordinationJsonObject;
}>;

export type ExecutionRuntimeJobInput = Readonly<{
  id: string;
  type: JobType | string;
  dependencies?: readonly string[];
  inputs?: CoordinationJsonObject;
  outputs?: CoordinationJsonObject;
  retryPolicy?: Readonly<{
    maxAttempts?: number;
    retryable?: boolean;
  }>;
  timeout?: Readonly<{
    timeoutSeconds?: number | null;
  }>;
  metadata?: CoordinationJsonObject;
  attemptCount?: number;
  sortKey?: string | number | null;
}>;

export type ExecutionGraph = Readonly<{
  graphId: string;
  executionPlanId: string | null;
  registrySnapshotId: string;
  registrySnapshotFingerprint: string;
  jobs: readonly ExecutionRuntimeJob[];
  rootJobIds: readonly string[];
  leafJobIds: readonly string[];
  orderedJobIds: readonly string[];
  diagnostics: readonly ExecutionRuntimeDiagnostic[];
  fingerprint: string;
  createdAt: string;
  metadata: CoordinationJsonObject;
}>;

export type ExecutionPlan = Readonly<{
  planId: string;
  graphId: string;
  graphFingerprint: string;
  executionPlanId: string | null;
  registrySnapshotId: string;
  registrySnapshotFingerprint: string;
  jobs: readonly ExecutionRuntimeJob[];
  orderedJobs: readonly ExecutionRuntimeJob[];
  rootJobs: readonly string[];
  leafJobs: readonly string[];
  diagnostics: readonly ExecutionRuntimeDiagnostic[];
  fingerprint: string;
  createdAt: string;
  metadata: CoordinationJsonObject;
}>;

export type ExecutionState = Readonly<{
  stateId: string;
  planId: string;
  graphId: string;
  graphFingerprint: string;
  status: ExecutionRuntimeJobStatus;
  jobs: readonly ExecutionRuntimeJob[];
  pendingJobIds: readonly string[];
  readyJobIds: readonly string[];
  runningJobIds: readonly string[];
  completedJobIds: readonly string[];
  skippedJobIds: readonly string[];
  failedJobIds: readonly string[];
  cancelledJobIds: readonly string[];
  resumedJobIds: readonly string[];
  retryScheduledJobIds: readonly string[];
  alreadyCompletedJobIds: readonly string[];
  diagnostics: readonly ExecutionRuntimeDiagnostic[];
  fingerprint: string;
  resumeCount: number;
  updatedAt: string;
  metadata: CoordinationJsonObject;
}>;

export type ExecutionRuntimeResult = Readonly<{
  executionPlan: ExecutionPlan;
  executionState: ExecutionState;
  readyJobs: readonly ExecutionRuntimeJob[];
  diagnostics: readonly ExecutionRuntimeDiagnostic[];
}>;

export type BuildExecutionGraphInput = Readonly<{
  registrySnapshotId: string;
  registrySnapshotFingerprint: string;
  jobs: readonly ExecutionRuntimeJobInput[];
  executionPlanId?: string | null;
  createdAt: string;
  metadata?: CoordinationJsonObject;
}>;

export type BuildExecutionGraphFromExecutionPlanInput = Readonly<{
  executionPlan: unknown;
  registrySnapshot: unknown;
  createdAt?: string;
  metadata?: CoordinationJsonObject;
  timeoutSecondsByJobType?: Readonly<Partial<Record<JobType, number>>>;
}>;

export type BuildExecutionPlanInput = Readonly<{
  graph: ExecutionGraph;
  createdAt?: string;
  metadata?: CoordinationJsonObject;
}>;

export type ExecuteExecutionPlanInput = Readonly<{
  executionPlan: ExecutionPlan;
  previousState?: ExecutionState;
  now: string;
  metadata?: CoordinationJsonObject;
}>;

export type ResumeExecutionPlanInput = Readonly<{
  executionPlan: ExecutionPlan;
  previousState: ExecutionState;
  now: string;
  metadata?: CoordinationJsonObject;
}>;

export type ExecutionRuntimeErrorCode =
  | "invalid_registry_snapshot"
  | "invalid_execution_plan"
  | "invalid_graph"
  | "invalid_state"
  | "duplicate_job"
  | "missing_dependency"
  | "dependency_cycle"
  | "fingerprint_conflict";

export class ExecutionRuntimeError extends Error {
  readonly code: ExecutionRuntimeErrorCode;
  readonly diagnostics: readonly ExecutionRuntimeDiagnostic[];

  constructor(
    input: Readonly<{
      code: ExecutionRuntimeErrorCode;
      message: string;
      diagnostics?: readonly ExecutionRuntimeDiagnostic[];
    }>,
  ) {
    super(input.message);
    this.name = "ExecutionRuntimeError";
    this.code = input.code;
    this.diagnostics = Object.freeze([...(input.diagnostics ?? [])]);
  }
}

type NormalizedGraphJob = Readonly<{
  id: string;
  type: string;
  dependencies: readonly string[];
  inputs: CoordinationJsonObject;
  outputs: CoordinationJsonObject;
  retryPolicy: ExecutionRuntimeRetryPolicy;
  timeout: ExecutionRuntimeTimeout;
  metadata: CoordinationJsonObject;
  attemptCount: number;
  sortKey: string;
}>;

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertCanonicalTimestamp(value: string, fieldName: string): void {
  if (!isCanonicalIsoTimestamp(value)) {
    throw new ExecutionRuntimeError({
      code: "invalid_graph",
      message: `${fieldName} must be a canonical ISO-8601 timestamp.`,
    });
  }
}

function sortUniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareStrings));
}

function freezeMetadata(
  metadata: CoordinationJsonObject | undefined,
): CoordinationJsonObject {
  return Object.freeze({ ...(metadata ?? {}) });
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

function assertJsonSafeMetadata(
  metadata: CoordinationJsonObject,
  fieldName: string,
): void {
  if (!isJsonSafe(metadata)) {
    throw new ExecutionRuntimeError({
      code: "invalid_graph",
      message: `${fieldName} must be JSON-safe.`,
    });
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value != null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort((left, right) => compareStrings(left[0], right[0]))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashFingerprint(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")}`;
}

function buildDiagnostic(
  input: Readonly<{
    code: ExecutionRuntimeDiagnosticCode;
    severity: ExecutionRuntimeDiagnosticSeverity;
    jobId?: string | null;
    dependencyJobId?: string | null;
    message: string;
    metadata?: CoordinationJsonObject;
  }>,
): ExecutionRuntimeDiagnostic {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    jobId: input.jobId ?? null,
    dependencyJobId: input.dependencyJobId ?? null,
    message: input.message,
    metadata: freezeMetadata(input.metadata),
  });
}

function freezeDiagnostics(
  diagnostics: readonly ExecutionRuntimeDiagnostic[],
): readonly ExecutionRuntimeDiagnostic[] {
  return Object.freeze([...diagnostics]);
}

function freezeExecutionState(
  state: ExecutionRuntimeJobExecutionState,
): ExecutionRuntimeJobExecutionState {
  return Object.freeze({
    ...state,
    blockedByJobIds: Object.freeze([...state.blockedByJobIds]),
    diagnostics: freezeDiagnostics(state.diagnostics),
  });
}

function freezeExecutionJob(job: ExecutionRuntimeJob): ExecutionRuntimeJob {
  return Object.freeze({
    ...job,
    dependencies: Object.freeze([...job.dependencies]),
    dependents: Object.freeze([...job.dependents]),
    inputs: freezeMetadata(job.inputs),
    outputs: freezeMetadata(job.outputs),
    diagnostics: freezeDiagnostics(job.diagnostics),
    executionState: freezeExecutionState(job.executionState),
    metadata: freezeMetadata(job.metadata),
  });
}

function freezeExecutionGraph(graph: ExecutionGraph): ExecutionGraph {
  return Object.freeze({
    ...graph,
    jobs: Object.freeze(graph.jobs.map((job) => freezeExecutionJob(job))),
    rootJobIds: Object.freeze([...graph.rootJobIds]),
    leafJobIds: Object.freeze([...graph.leafJobIds]),
    orderedJobIds: Object.freeze([...graph.orderedJobIds]),
    diagnostics: freezeDiagnostics(graph.diagnostics),
    metadata: freezeMetadata(graph.metadata),
  });
}

function freezeExecutionPlan(plan: ExecutionPlan): ExecutionPlan {
  return Object.freeze({
    ...plan,
    jobs: Object.freeze(plan.jobs.map((job) => freezeExecutionJob(job))),
    orderedJobs: Object.freeze(
      plan.orderedJobs.map((job) => freezeExecutionJob(job)),
    ),
    rootJobs: Object.freeze([...plan.rootJobs]),
    leafJobs: Object.freeze([...plan.leafJobs]),
    diagnostics: freezeDiagnostics(plan.diagnostics),
    metadata: freezeMetadata(plan.metadata),
  });
}

function freezeExecutionRuntimeState(state: ExecutionState): ExecutionState {
  return Object.freeze({
    ...state,
    jobs: Object.freeze(state.jobs.map((job) => freezeExecutionJob(job))),
    pendingJobIds: Object.freeze([...state.pendingJobIds]),
    readyJobIds: Object.freeze([...state.readyJobIds]),
    runningJobIds: Object.freeze([...state.runningJobIds]),
    completedJobIds: Object.freeze([...state.completedJobIds]),
    skippedJobIds: Object.freeze([...state.skippedJobIds]),
    failedJobIds: Object.freeze([...state.failedJobIds]),
    cancelledJobIds: Object.freeze([...state.cancelledJobIds]),
    resumedJobIds: Object.freeze([...state.resumedJobIds]),
    retryScheduledJobIds: Object.freeze([...state.retryScheduledJobIds]),
    alreadyCompletedJobIds: Object.freeze([...state.alreadyCompletedJobIds]),
    diagnostics: freezeDiagnostics(state.diagnostics),
    metadata: freezeMetadata(state.metadata),
  });
}

function normalizeGraphJob(input: ExecutionRuntimeJobInput): NormalizedGraphJob {
  if (!isNonEmptyString(input.id)) {
    throw new ExecutionRuntimeError({
      code: "invalid_graph",
      message: "Every runtime job must have a non-empty id.",
      diagnostics: Object.freeze([
        buildDiagnostic({
          code: "invalid_job",
          severity: "error",
          message: "Every runtime job must have a non-empty id.",
        }),
      ]),
    });
  }

  if (!isNonEmptyString(input.type)) {
    throw new ExecutionRuntimeError({
      code: "invalid_graph",
      message: `Runtime job ${input.id} must have a non-empty type.`,
      diagnostics: Object.freeze([
        buildDiagnostic({
          code: "invalid_job",
          severity: "error",
          jobId: input.id,
          message: `Runtime job ${input.id} must have a non-empty type.`,
        }),
      ]),
    });
  }

  const maxAttempts = input.retryPolicy?.maxAttempts ?? 1;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new ExecutionRuntimeError({
      code: "invalid_graph",
      message: `Runtime job ${input.id} has an invalid maxAttempts value.`,
      diagnostics: Object.freeze([
        buildDiagnostic({
          code: "invalid_job",
          severity: "error",
          jobId: input.id,
          message: `Runtime job ${input.id} has an invalid maxAttempts value.`,
        }),
      ]),
    });
  }

  const attemptCount = input.attemptCount ?? 1;
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    throw new ExecutionRuntimeError({
      code: "invalid_graph",
      message: `Runtime job ${input.id} has an invalid attemptCount value.`,
      diagnostics: Object.freeze([
        buildDiagnostic({
          code: "invalid_job",
          severity: "error",
          jobId: input.id,
          message: `Runtime job ${input.id} has an invalid attemptCount value.`,
        }),
      ]),
    });
  }

  const timeoutSeconds = input.timeout?.timeoutSeconds ?? null;
  if (
    timeoutSeconds != null &&
    (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1)
  ) {
    throw new ExecutionRuntimeError({
      code: "invalid_graph",
      message: `Runtime job ${input.id} has an invalid timeoutSeconds value.`,
      diagnostics: Object.freeze([
        buildDiagnostic({
          code: "invalid_job",
          severity: "error",
          jobId: input.id,
          message: `Runtime job ${input.id} has an invalid timeoutSeconds value.`,
        }),
      ]),
    });
  }

  const inputs = freezeMetadata(input.inputs);
  const outputs = freezeMetadata(input.outputs);
  const metadata = freezeMetadata(input.metadata);
  assertJsonSafeMetadata(inputs, `jobs.${input.id}.inputs`);
  assertJsonSafeMetadata(outputs, `jobs.${input.id}.outputs`);
  assertJsonSafeMetadata(metadata, `jobs.${input.id}.metadata`);

  const sortKey =
    input.sortKey == null
      ? `${String(input.type)}|${input.id}`
      : `${typeof input.sortKey}:${String(input.sortKey)}`;

  return Object.freeze({
    id: input.id.trim(),
    type: String(input.type).trim(),
    dependencies: sortUniqueStrings(
      (input.dependencies ?? []).map((dependencyJobId) => dependencyJobId.trim()),
    ),
    inputs,
    outputs,
    retryPolicy: Object.freeze({
      maxAttempts,
      retryable: input.retryPolicy?.retryable ?? maxAttempts > 1,
    }),
    timeout: Object.freeze({
      timeoutSeconds,
    }),
    metadata,
    attemptCount,
    sortKey,
  });
}

function compareGraphJobs(
  left: Pick<NormalizedGraphJob, "sortKey" | "type" | "id">,
  right: Pick<NormalizedGraphJob, "sortKey" | "type" | "id">,
): number {
  if (left.sortKey !== right.sortKey) {
    return compareStrings(left.sortKey, right.sortKey);
  }
  if (left.type !== right.type) {
    return compareStrings(left.type, right.type);
  }
  return compareStrings(left.id, right.id);
}

function deriveJobFingerprint(
  input: Readonly<{
    executionPlanId: string | null;
    registrySnapshotFingerprint: string;
    job: NormalizedGraphJob;
  }>,
): string {
  return hashFingerprint("ipp_runtime_job", {
    executionPlanId: input.executionPlanId,
    registrySnapshotFingerprint: input.registrySnapshotFingerprint,
    id: input.job.id,
    type: input.job.type,
    dependencies: input.job.dependencies,
    inputs: input.job.inputs,
    outputs: input.job.outputs,
    retryPolicy: input.job.retryPolicy,
    timeout: input.job.timeout,
    metadata: input.job.metadata,
  });
}

function buildInitialJob(
  input: Readonly<{
    executionPlanId: string | null;
    registrySnapshotFingerprint: string;
    job: NormalizedGraphJob;
    dependents: readonly string[];
    createdAt: string;
  }>,
): ExecutionRuntimeJob {
  const status: ExecutionRuntimeJobStatus =
    input.job.dependencies.length === 0 ? "ready" : "pending";

  return freezeExecutionJob({
    id: input.job.id,
    fingerprint: deriveJobFingerprint({
      executionPlanId: input.executionPlanId,
      registrySnapshotFingerprint: input.registrySnapshotFingerprint,
      job: input.job,
    }),
    type: input.job.type,
    dependencies: input.job.dependencies,
    dependents: input.dependents,
    inputs: input.job.inputs,
    outputs: input.job.outputs,
    retryPolicy: input.job.retryPolicy,
    timeout: input.job.timeout,
    diagnostics: Object.freeze([]),
    executionState: Object.freeze({
      status,
      attemptCount: input.job.attemptCount,
      maxAttempts: input.job.retryPolicy.maxAttempts,
      blockedByJobIds:
        status === "pending"
          ? Object.freeze([...input.job.dependencies])
          : Object.freeze([]),
      resumable: false,
      lastUpdatedAt: input.createdAt,
      startedAt: null,
      finishedAt: null,
      diagnostics: Object.freeze([]),
    }),
    metadata: input.job.metadata,
  });
}

function resolveExecutionGraphStructure(
  jobs: readonly NormalizedGraphJob[],
): Readonly<{
  rootJobIds: readonly string[];
  leafJobIds: readonly string[];
  orderedJobIds: readonly string[];
  dependentsByJobId: ReadonlyMap<string, readonly string[]>;
}> {
  const duplicateIds = jobs
    .map((job) => job.id)
    .filter((jobId, index, values) => values.indexOf(jobId) !== index);
  if (duplicateIds.length > 0) {
    const diagnostics = duplicateIds.map((jobId) =>
      buildDiagnostic({
        code: "duplicate_job",
        severity: "error",
        jobId,
        message: `Job ${jobId} appears more than once in the runtime graph.`,
      }),
    );
    throw new ExecutionRuntimeError({
      code: "duplicate_job",
      message: `Duplicate runtime job ids detected: ${sortUniqueStrings(duplicateIds).join(", ")}.`,
      diagnostics,
    });
  }

  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const dependentsByJobId = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const job of jobs) {
    indegree.set(job.id, job.dependencies.length);
    dependentsByJobId.set(job.id, []);
  }

  for (const job of jobs) {
    for (const dependencyJobId of job.dependencies) {
      if (!jobById.has(dependencyJobId)) {
        throw new ExecutionRuntimeError({
          code: "missing_dependency",
          message: `Job ${job.id} depends on missing job ${dependencyJobId}.`,
          diagnostics: Object.freeze([
            buildDiagnostic({
              code: "missing_dependency",
              severity: "error",
              jobId: job.id,
              dependencyJobId,
              message: `Job ${job.id} depends on missing job ${dependencyJobId}.`,
            }),
          ]),
        });
      }

      if (dependencyJobId === job.id) {
        throw new ExecutionRuntimeError({
          code: "dependency_cycle",
          message: `Job ${job.id} cannot depend on itself.`,
          diagnostics: Object.freeze([
            buildDiagnostic({
              code: "dependency_cycle",
              severity: "error",
              jobId: job.id,
              dependencyJobId,
              message: `Job ${job.id} cannot depend on itself.`,
            }),
          ]),
        });
      }

      dependentsByJobId.get(dependencyJobId)?.push(job.id);
    }
  }

  const ready = jobs
    .filter((job) => job.dependencies.length === 0)
    .sort(compareGraphJobs);
  const orderedJobIds: string[] = [];

  while (ready.length > 0) {
    const next = ready.shift();
    if (next == null) {
      break;
    }

    orderedJobIds.push(next.id);
    for (const dependentJobId of dependentsByJobId.get(next.id) ?? []) {
      const nextIndegree = (indegree.get(dependentJobId) ?? 0) - 1;
      indegree.set(dependentJobId, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(jobById.get(dependentJobId)!);
        ready.sort(compareGraphJobs);
      }
    }
  }

  if (orderedJobIds.length !== jobs.length) {
    throw new ExecutionRuntimeError({
      code: "dependency_cycle",
      message: "The runtime execution graph contains a cycle.",
      diagnostics: Object.freeze([
        buildDiagnostic({
          code: "dependency_cycle",
          severity: "error",
          message: "The runtime execution graph contains a cycle.",
        }),
      ]),
    });
  }

  const rootJobIds = sortUniqueStrings(
    jobs.filter((job) => job.dependencies.length === 0).map((job) => job.id),
  );
  const leafJobIds = sortUniqueStrings(
    jobs
      .filter((job) => (dependentsByJobId.get(job.id)?.length ?? 0) === 0)
      .map((job) => job.id),
  );

  return Object.freeze({
    rootJobIds,
    leafJobIds,
    orderedJobIds: Object.freeze(orderedJobIds),
    dependentsByJobId: new Map(
      [...dependentsByJobId.entries()].map(([jobId, dependents]) => [
        jobId,
        sortUniqueStrings(dependents),
      ]),
    ),
  });
}

function buildGraphFingerprint(input: Readonly<{
  executionPlanId: string | null;
  registrySnapshotId: string;
  registrySnapshotFingerprint: string;
  jobs: readonly ExecutionRuntimeJob[];
  rootJobIds: readonly string[];
  leafJobIds: readonly string[];
  orderedJobIds: readonly string[];
}>): string {
  return hashFingerprint("ipp_runtime_graph", {
    executionPlanId: input.executionPlanId,
    registrySnapshotId: input.registrySnapshotId,
    registrySnapshotFingerprint: input.registrySnapshotFingerprint,
    jobs: input.jobs.map((job) => ({
      id: job.id,
      fingerprint: job.fingerprint,
    })),
    rootJobIds: input.rootJobIds,
    leafJobIds: input.leafJobIds,
    orderedJobIds: input.orderedJobIds,
  });
}

function buildPlanFingerprint(input: Readonly<{
  graphFingerprint: string;
  orderedJobIds: readonly string[];
  rootJobIds: readonly string[];
  leafJobIds: readonly string[];
}>): string {
  return hashFingerprint("ipp_runtime_plan", {
    graphFingerprint: input.graphFingerprint,
    orderedJobIds: input.orderedJobIds,
    rootJobIds: input.rootJobIds,
    leafJobIds: input.leafJobIds,
  });
}

function buildStateFingerprint(input: Readonly<{
  planFingerprint: string;
  jobs: readonly ExecutionRuntimeJob[];
  pendingJobIds: readonly string[];
  readyJobIds: readonly string[];
  runningJobIds: readonly string[];
  completedJobIds: readonly string[];
  skippedJobIds: readonly string[];
  failedJobIds: readonly string[];
  cancelledJobIds: readonly string[];
  resumedJobIds: readonly string[];
  retryScheduledJobIds: readonly string[];
  alreadyCompletedJobIds: readonly string[];
}>): string {
  return hashFingerprint("ipp_runtime_state", {
    planFingerprint: input.planFingerprint,
    jobs: input.jobs.map((job) => ({
      id: job.id,
      fingerprint: job.fingerprint,
      state: job.executionState,
    })),
    pendingJobIds: input.pendingJobIds,
    readyJobIds: input.readyJobIds,
    runningJobIds: input.runningJobIds,
    completedJobIds: input.completedJobIds,
    skippedJobIds: input.skippedJobIds,
    failedJobIds: input.failedJobIds,
    cancelledJobIds: input.cancelledJobIds,
    resumedJobIds: input.resumedJobIds,
    retryScheduledJobIds: input.retryScheduledJobIds,
    alreadyCompletedJobIds: input.alreadyCompletedJobIds,
  });
}

function buildPlanStatus(jobs: readonly ExecutionRuntimeJob[]): ExecutionRuntimeJobStatus {
  const statuses = jobs.map((job) => job.executionState.status);

  if (statuses.includes("running")) {
    return "running";
  }
  if (statuses.every((status) => status === "skipped")) {
    return "skipped";
  }
  if (statuses.every((status) => status === "cancelled")) {
    return "cancelled";
  }
  if (
    statuses.every((status) =>
      status === "completed" || status === "skipped" || status === "cancelled",
    )
  ) {
    return "completed";
  }
  if (statuses.includes("ready")) {
    return "ready";
  }
  if (statuses.includes("failed")) {
    return "failed";
  }
  return "pending";
}

function withExecutionState(
  job: ExecutionRuntimeJob,
  state: ExecutionRuntimeJobExecutionState,
): ExecutionRuntimeJob {
  return freezeExecutionJob({
    ...job,
    executionState: freezeExecutionState(state),
  });
}

function buildExecutionStateForJob(
  input: Readonly<{
    job: ExecutionRuntimeJob;
    now: string;
    status: ExecutionRuntimeJobStatus;
    blockedByJobIds?: readonly string[];
    resumable?: boolean;
    diagnostics?: readonly ExecutionRuntimeDiagnostic[];
    attemptCount?: number;
    startedAt?: string | null;
    finishedAt?: string | null;
  }>,
): ExecutionRuntimeJobExecutionState {
  const status = input.status;
  const terminal = status === "completed" || status === "skipped" || status === "failed" || status === "cancelled";
  return freezeExecutionState({
    status,
    attemptCount: input.attemptCount ?? input.job.executionState.attemptCount,
    maxAttempts: input.job.retryPolicy.maxAttempts,
    blockedByJobIds: Object.freeze(
      [...(input.blockedByJobIds ?? [])].sort(compareStrings),
    ),
    resumable: input.resumable ?? false,
    lastUpdatedAt: input.now,
    startedAt: input.startedAt ?? input.job.executionState.startedAt,
    finishedAt:
      input.finishedAt ??
      (terminal ? input.now : input.job.executionState.finishedAt),
    diagnostics: freezeDiagnostics(input.diagnostics ?? []),
  });
}

function isDependencySatisfied(status: ExecutionRuntimeJobStatus): boolean {
  return status === "completed" || status === "skipped";
}

function buildEngineRuntimeJobInputs(
  plan: EngineExecutionPlan,
  timeoutSecondsByJobType: Readonly<Partial<Record<JobType, number>>> | undefined,
): readonly ExecutionRuntimeJobInput[] {
  return Object.freeze(
    plan.jobs.map((job, index) =>
      Object.freeze({
        id: job.jobId,
        type: job.jobType,
        dependencies: job.dependencyJobIds,
        inputs: Object.freeze({
          action: job.action,
          assetId: job.assetId,
          assetVersionId: job.assetVersionId,
          locale: job.locale,
          channel: job.channel,
          parentJobId: job.parentJobId,
          priority: job.priority,
        }),
        outputs: Object.freeze({}),
        retryPolicy: Object.freeze({
          maxAttempts: job.maxAttempts,
          retryable: job.maxAttempts > 1,
        }),
        timeout: Object.freeze({
          timeoutSeconds:
            timeoutSecondsByJobType?.[job.jobType] ??
            (isFiniteNumber(job.metadata.timeoutSeconds)
              ? Number(job.metadata.timeoutSeconds)
              : null),
        }),
        metadata: Object.freeze({
          runId: job.runId,
          engineStatus: job.status,
          estimatedCost: job.estimatedCost,
          actualCost: job.actualCost,
          sourceMetadataFingerprint: hashFingerprint(
            "ipp_runtime_engine_job_metadata",
            job.metadata,
          ),
          sourceMetadataKeys: Object.freeze(
            Object.keys(job.metadata).sort(compareStrings),
          ),
        }),
        attemptCount: job.attempt,
        sortKey: String(index).padStart(8, "0"),
      }),
    ),
  );
}

function ensureMatchingRegistrySnapshot(
  plan: EngineExecutionPlan,
  snapshot: RegistrySnapshot,
): void {
  const snapshotFingerprint = buildRegistrySnapshotFingerprint(snapshot);
  if (snapshot.snapshotId !== plan.registrySnapshotId) {
    throw new ExecutionRuntimeError({
      code: "invalid_registry_snapshot",
      message:
        "The registry snapshot id does not match the execution engine plan input.",
    });
  }
  if (snapshotFingerprint !== plan.registrySnapshotFingerprint) {
    throw new ExecutionRuntimeError({
      code: "fingerprint_conflict",
      message:
        "The registry snapshot fingerprint does not match the execution engine plan input.",
    });
  }
}

function indexJobsById(
  jobs: readonly ExecutionRuntimeJob[],
): ReadonlyMap<string, ExecutionRuntimeJob> {
  return new Map(jobs.map((job) => [job.id, job]));
}

function ensureCompatiblePreviousState(
  executionPlan: ExecutionPlan,
  previousState: ExecutionState | null | undefined,
): ExecutionState | null {
  if (previousState == null) {
    return null;
  }
  if (
    previousState.planId !== executionPlan.planId ||
    previousState.graphFingerprint !== executionPlan.graphFingerprint
  ) {
    return null;
  }
  return previousState;
}

function rehydrateExecutionJobs(
  input: Readonly<{
    executionPlan: ExecutionPlan;
    previousState: ExecutionState | null;
    now: string;
    resumeInterruptedJobs: boolean;
  }>,
): Readonly<{
  jobs: readonly ExecutionRuntimeJob[];
  diagnostics: readonly ExecutionRuntimeDiagnostic[];
  resumedJobIds: readonly string[];
  retryScheduledJobIds: readonly string[];
  alreadyCompletedJobIds: readonly string[];
}> {
  const previousJobsById = new Map(
    (input.previousState?.jobs ?? []).map((job) => [job.id, job]),
  );
  const nextJobs: ExecutionRuntimeJob[] = [];
  const diagnostics: ExecutionRuntimeDiagnostic[] = [];
  const resumedJobIds: string[] = [];
  const retryScheduledJobIds: string[] = [];
  const alreadyCompletedJobIds: string[] = [];

  for (const job of input.executionPlan.orderedJobs) {
    const previousJob = previousJobsById.get(job.id);

    if (previousJob == null) {
      nextJobs.push(job);
      continue;
    }

    if (previousJob.fingerprint !== job.fingerprint) {
      diagnostics.push(
        buildDiagnostic({
          code: "fingerprint_conflict",
          severity: "warning",
          jobId: job.id,
          message:
            `Job ${job.id} changed fingerprint between runs and will be recomputed.`,
        }),
      );
      nextJobs.push(job);
      continue;
    }

    const previousStatus = previousJob.executionState.status;
    if (previousStatus === "completed") {
      const completedDiagnostic = buildDiagnostic({
        code: "already_completed",
        severity: "info",
        jobId: job.id,
        message: `Job ${job.id} is already completed and will not be recomputed.`,
      });
      alreadyCompletedJobIds.push(job.id);
      diagnostics.push(completedDiagnostic);
      nextJobs.push(
        withExecutionState(
          job,
          buildExecutionStateForJob({
            job,
            now: input.now,
            status: "completed",
            attemptCount: previousJob.executionState.attemptCount,
            startedAt: previousJob.executionState.startedAt,
            finishedAt: previousJob.executionState.finishedAt,
            diagnostics: [...previousJob.executionState.diagnostics, completedDiagnostic],
          }),
        ),
      );
      continue;
    }

    if (previousStatus === "skipped" || previousStatus === "cancelled") {
      nextJobs.push(
        withExecutionState(
          job,
          buildExecutionStateForJob({
            job,
            now: input.now,
            status: previousStatus,
            attemptCount: previousJob.executionState.attemptCount,
            startedAt: previousJob.executionState.startedAt,
            finishedAt: previousJob.executionState.finishedAt,
            diagnostics: previousJob.executionState.diagnostics,
          }),
        ),
      );
      continue;
    }

    if (previousStatus === "failed") {
      const canRetry =
        job.retryPolicy.retryable &&
        previousJob.executionState.attemptCount < job.retryPolicy.maxAttempts;
      if (!canRetry) {
        nextJobs.push(
          withExecutionState(
            job,
            buildExecutionStateForJob({
              job,
              now: input.now,
              status: "failed",
              attemptCount: previousJob.executionState.attemptCount,
              startedAt: previousJob.executionState.startedAt,
              finishedAt: previousJob.executionState.finishedAt,
              diagnostics: previousJob.executionState.diagnostics,
            }),
          ),
        );
        continue;
      }

      const retryDiagnostic = buildDiagnostic({
        code: "retry_scheduled",
        severity: "info",
        jobId: job.id,
        message: `Job ${job.id} is scheduled for retry.`,
      });
      retryScheduledJobIds.push(job.id);
      diagnostics.push(retryDiagnostic);
      nextJobs.push(
        withExecutionState(
          job,
          buildExecutionStateForJob({
            job,
            now: input.now,
            status: job.dependencies.length === 0 ? "ready" : "pending",
            attemptCount: previousJob.executionState.attemptCount + 1,
            blockedByJobIds: job.dependencies,
            resumable: true,
            diagnostics: [...previousJob.executionState.diagnostics, retryDiagnostic],
          }),
        ),
      );
      continue;
    }

    if (previousStatus === "running" && input.resumeInterruptedJobs) {
      const resumeDiagnostic = buildDiagnostic({
        code: "resume_detected",
        severity: "info",
        jobId: job.id,
        message: `Job ${job.id} was interrupted and is being resumed.`,
      });
      resumedJobIds.push(job.id);
      diagnostics.push(resumeDiagnostic);
      nextJobs.push(
        withExecutionState(
          job,
          buildExecutionStateForJob({
            job,
            now: input.now,
            status: job.dependencies.length === 0 ? "ready" : "pending",
            attemptCount: previousJob.executionState.attemptCount,
            blockedByJobIds: job.dependencies,
            resumable: true,
            diagnostics: [...previousJob.executionState.diagnostics, resumeDiagnostic],
          }),
        ),
      );
      continue;
    }

    if (previousStatus === "running") {
      nextJobs.push(
        withExecutionState(
          job,
          buildExecutionStateForJob({
            job,
            now: input.now,
            status: "running",
            attemptCount: previousJob.executionState.attemptCount,
            startedAt: previousJob.executionState.startedAt,
            diagnostics: previousJob.executionState.diagnostics,
          }),
        ),
      );
      continue;
    }

    if (previousStatus === "ready" || previousStatus === "pending") {
      nextJobs.push(
        withExecutionState(
          job,
          buildExecutionStateForJob({
            job,
            now: input.now,
            status: previousStatus,
            attemptCount: previousJob.executionState.attemptCount,
            blockedByJobIds:
              previousStatus === "pending" ? job.dependencies : Object.freeze([]),
            diagnostics: previousJob.executionState.diagnostics,
          }),
        ),
      );
      continue;
    }

    nextJobs.push(job);
  }

  const jobsById = indexJobsById(nextJobs);
  const finalizedJobs = input.executionPlan.orderedJobs.map((planJob) => {
    const provisionalJob = jobsById.get(planJob.id) ?? planJob;
    const currentStatus = provisionalJob.executionState.status;
    if (
      currentStatus === "completed" ||
      currentStatus === "skipped" ||
      currentStatus === "failed" ||
      currentStatus === "cancelled" ||
      currentStatus === "running"
    ) {
      return provisionalJob;
    }

    const blockedByJobIds = provisionalJob.dependencies.filter((dependencyJobId) => {
      const dependencyJob = jobsById.get(dependencyJobId);
      return !(
        dependencyJob != null &&
        isDependencySatisfied(dependencyJob.executionState.status)
      );
    });

    return withExecutionState(
      provisionalJob,
      buildExecutionStateForJob({
        job: provisionalJob,
        now: input.now,
        status: blockedByJobIds.length === 0 ? "ready" : "pending",
        attemptCount: provisionalJob.executionState.attemptCount,
        blockedByJobIds,
        resumable: provisionalJob.executionState.resumable,
        diagnostics: provisionalJob.executionState.diagnostics,
      }),
    );
  });

  return Object.freeze({
    jobs: Object.freeze(finalizedJobs),
    diagnostics: freezeDiagnostics(diagnostics),
    resumedJobIds: Object.freeze(sortUniqueStrings(resumedJobIds)),
    retryScheduledJobIds: Object.freeze(sortUniqueStrings(retryScheduledJobIds)),
    alreadyCompletedJobIds: Object.freeze(sortUniqueStrings(alreadyCompletedJobIds)),
  });
}

export function buildExecutionGraph(input: BuildExecutionGraphInput): ExecutionGraph {
  assertCanonicalTimestamp(input.createdAt, "createdAt");
  if (!isNonEmptyString(input.registrySnapshotId)) {
    throw new ExecutionRuntimeError({
      code: "invalid_graph",
      message: "registrySnapshotId must be a non-empty string.",
    });
  }
  if (!isNonEmptyString(input.registrySnapshotFingerprint)) {
    throw new ExecutionRuntimeError({
      code: "invalid_graph",
      message: "registrySnapshotFingerprint must be a non-empty string.",
    });
  }

  const metadata = freezeMetadata(input.metadata);
  assertJsonSafeMetadata(metadata, "metadata");

  const normalizedJobs = [...input.jobs]
    .map((job) => normalizeGraphJob(job))
    .sort(compareGraphJobs);
  const graphShape = resolveExecutionGraphStructure(normalizedJobs);

  const jobs = normalizedJobs.map((job) =>
    buildInitialJob({
      executionPlanId: input.executionPlanId?.trim() ?? null,
      registrySnapshotFingerprint: input.registrySnapshotFingerprint.trim(),
      job,
      dependents: graphShape.dependentsByJobId.get(job.id) ?? Object.freeze([]),
      createdAt: input.createdAt,
    }),
  );

  const graphFingerprint = buildGraphFingerprint({
    executionPlanId: input.executionPlanId?.trim() ?? null,
    registrySnapshotId: input.registrySnapshotId.trim(),
    registrySnapshotFingerprint: input.registrySnapshotFingerprint.trim(),
    jobs,
    rootJobIds: graphShape.rootJobIds,
    leafJobIds: graphShape.leafJobIds,
    orderedJobIds: graphShape.orderedJobIds,
  });

  return freezeExecutionGraph({
    graphId: hashFingerprint("ipp_runtime_graph_id", {
      executionPlanId: input.executionPlanId?.trim() ?? null,
      graphFingerprint,
    }),
    executionPlanId: input.executionPlanId?.trim() ?? null,
    registrySnapshotId: input.registrySnapshotId.trim(),
    registrySnapshotFingerprint: input.registrySnapshotFingerprint.trim(),
    jobs: Object.freeze(jobs),
    rootJobIds: graphShape.rootJobIds,
    leafJobIds: graphShape.leafJobIds,
    orderedJobIds: graphShape.orderedJobIds,
    diagnostics: Object.freeze([]),
    fingerprint: graphFingerprint,
    createdAt: input.createdAt,
    metadata,
  });
}

export function buildExecutionGraphFromExecutionPlan(
  input: BuildExecutionGraphFromExecutionPlanInput,
): ExecutionGraph {
  let executionPlan: EngineExecutionPlan;
  try {
    executionPlan = parseEngineExecutionPlan(input.executionPlan);
  } catch (error) {
    throw new ExecutionRuntimeError({
      code: "invalid_execution_plan",
      message: error instanceof Error ? error.message : "Invalid execution plan.",
    });
  }

  let registrySnapshot: RegistrySnapshot;
  try {
    registrySnapshot = parseRegistrySnapshot(input.registrySnapshot);
    assertRegistrySnapshotPublicSafe(registrySnapshot);
  } catch (error) {
    throw new ExecutionRuntimeError({
      code: "invalid_registry_snapshot",
      message:
        error instanceof Error ? error.message : "Invalid registry snapshot.",
    });
  }

  ensureMatchingRegistrySnapshot(executionPlan, registrySnapshot);

  return buildExecutionGraph({
    registrySnapshotId: registrySnapshot.snapshotId,
    registrySnapshotFingerprint: buildRegistrySnapshotFingerprint(registrySnapshot),
    executionPlanId: executionPlan.executionPlanId,
    createdAt: input.createdAt ?? executionPlan.createdAt,
    jobs: buildEngineRuntimeJobInputs(
      executionPlan,
      input.timeoutSecondsByJobType,
    ),
    metadata: Object.freeze({
      eventId: executionPlan.event.eventId,
      runId: executionPlan.orchestrationRun.runId,
      eventType: executionPlan.event.eventType,
      sourcePlanId: executionPlan.executionPlanId,
      ...input.metadata,
    }),
  });
}

export function buildExecutionPlan(input: BuildExecutionPlanInput): ExecutionPlan {
  const createdAt = input.createdAt ?? input.graph.createdAt;
  assertCanonicalTimestamp(createdAt, "createdAt");

  const metadata = freezeMetadata(input.metadata);
  assertJsonSafeMetadata(metadata, "metadata");

  const jobById = indexJobsById(input.graph.jobs);
  const orderedJobs = input.graph.orderedJobIds.map((jobId) => {
    const job = jobById.get(jobId);
    if (job == null) {
      throw new ExecutionRuntimeError({
        code: "invalid_graph",
        message: `Execution graph is missing ordered job ${jobId}.`,
        diagnostics: Object.freeze([
          buildDiagnostic({
            code: "graph_invalid",
            severity: "error",
            jobId,
            message: `Execution graph is missing ordered job ${jobId}.`,
          }),
        ]),
      });
    }
    return job;
  });

  const fingerprint = buildPlanFingerprint({
    graphFingerprint: input.graph.fingerprint,
    orderedJobIds: input.graph.orderedJobIds,
    rootJobIds: input.graph.rootJobIds,
    leafJobIds: input.graph.leafJobIds,
  });

  return freezeExecutionPlan({
    planId: hashFingerprint("ipp_runtime_plan_id", {
      graphId: input.graph.graphId,
      fingerprint,
    }),
    graphId: input.graph.graphId,
    graphFingerprint: input.graph.fingerprint,
    executionPlanId: input.graph.executionPlanId,
    registrySnapshotId: input.graph.registrySnapshotId,
    registrySnapshotFingerprint: input.graph.registrySnapshotFingerprint,
    jobs: input.graph.jobs,
    orderedJobs: Object.freeze(orderedJobs),
    rootJobs: input.graph.rootJobIds,
    leafJobs: input.graph.leafJobIds,
    diagnostics: input.graph.diagnostics,
    fingerprint,
    createdAt,
    metadata,
  });
}

function buildExecutionState(
  input: Readonly<{
    executionPlan: ExecutionPlan;
    previousState: ExecutionState | null;
    now: string;
    resumeInterruptedJobs: boolean;
    metadata?: CoordinationJsonObject;
  }>,
): ExecutionState {
  assertCanonicalTimestamp(input.now, "now");

  const metadata = freezeMetadata(input.metadata);
  assertJsonSafeMetadata(metadata, "metadata");

  const compatibilityState = ensureCompatiblePreviousState(
    input.executionPlan,
    input.previousState,
  );

  const normalized = rehydrateExecutionJobs({
    executionPlan: input.executionPlan,
    previousState: compatibilityState,
    now: input.now,
    resumeInterruptedJobs: input.resumeInterruptedJobs,
  });

  const pendingJobIds = normalized.jobs
    .filter((job) => job.executionState.status === "pending")
    .map((job) => job.id);
  const readyJobIds = normalized.jobs
    .filter((job) => job.executionState.status === "ready")
    .map((job) => job.id);
  const runningJobIds = normalized.jobs
    .filter((job) => job.executionState.status === "running")
    .map((job) => job.id);
  const completedJobIds = normalized.jobs
    .filter((job) => job.executionState.status === "completed")
    .map((job) => job.id);
  const skippedJobIds = normalized.jobs
    .filter((job) => job.executionState.status === "skipped")
    .map((job) => job.id);
  const failedJobIds = normalized.jobs
    .filter((job) => job.executionState.status === "failed")
    .map((job) => job.id);
  const cancelledJobIds = normalized.jobs
    .filter((job) => job.executionState.status === "cancelled")
    .map((job) => job.id);

  const status = buildPlanStatus(normalized.jobs);
  const fingerprint = buildStateFingerprint({
    planFingerprint: input.executionPlan.fingerprint,
    jobs: normalized.jobs,
    pendingJobIds,
    readyJobIds,
    runningJobIds,
    completedJobIds,
    skippedJobIds,
    failedJobIds,
    cancelledJobIds,
    resumedJobIds: normalized.resumedJobIds,
    retryScheduledJobIds: normalized.retryScheduledJobIds,
    alreadyCompletedJobIds: normalized.alreadyCompletedJobIds,
  });

  return freezeExecutionRuntimeState({
    stateId: hashFingerprint("ipp_runtime_state_id", {
      planId: input.executionPlan.planId,
      fingerprint,
    }),
    planId: input.executionPlan.planId,
    graphId: input.executionPlan.graphId,
    graphFingerprint: input.executionPlan.graphFingerprint,
    status,
    jobs: normalized.jobs,
    pendingJobIds: Object.freeze(sortUniqueStrings(pendingJobIds)),
    readyJobIds: Object.freeze(sortUniqueStrings(readyJobIds)),
    runningJobIds: Object.freeze(sortUniqueStrings(runningJobIds)),
    completedJobIds: Object.freeze(sortUniqueStrings(completedJobIds)),
    skippedJobIds: Object.freeze(sortUniqueStrings(skippedJobIds)),
    failedJobIds: Object.freeze(sortUniqueStrings(failedJobIds)),
    cancelledJobIds: Object.freeze(sortUniqueStrings(cancelledJobIds)),
    resumedJobIds: normalized.resumedJobIds,
    retryScheduledJobIds: normalized.retryScheduledJobIds,
    alreadyCompletedJobIds: normalized.alreadyCompletedJobIds,
    diagnostics: normalized.diagnostics,
    fingerprint,
    resumeCount:
      (compatibilityState?.resumeCount ?? 0) +
      (input.resumeInterruptedJobs ? 1 : 0),
    updatedAt: input.now,
    metadata,
  });
}

export function executeExecutionPlan(
  input: ExecuteExecutionPlanInput,
): ExecutionRuntimeResult {
  const executionState = buildExecutionState({
    executionPlan: input.executionPlan,
    previousState: input.previousState ?? null,
    now: input.now,
    resumeInterruptedJobs: false,
    metadata: input.metadata,
  });

  return Object.freeze({
    executionPlan: input.executionPlan,
    executionState,
    readyJobs: Object.freeze(
      executionState.jobs.filter((job) => job.executionState.status === "ready"),
    ),
    diagnostics: executionState.diagnostics,
  });
}

export function resumeExecutionPlan(
  input: ResumeExecutionPlanInput,
): ExecutionRuntimeResult {
  const executionState = buildExecutionState({
    executionPlan: input.executionPlan,
    previousState: input.previousState,
    now: input.now,
    resumeInterruptedJobs: true,
    metadata: input.metadata,
  });

  return Object.freeze({
    executionPlan: input.executionPlan,
    executionState,
    readyJobs: Object.freeze(
      executionState.jobs.filter((job) => job.executionState.status === "ready"),
    ),
    diagnostics: executionState.diagnostics,
  });
}

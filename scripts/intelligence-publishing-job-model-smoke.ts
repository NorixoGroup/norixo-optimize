import assert from "node:assert/strict";

import {
  parsePublicationEventEnvelope,
  type PublicationEventPriority,
} from "../lib/intelligencePublishing/eventContracts";
import { resolveImpact } from "../lib/intelligencePublishing/impactResolver";
import {
  buildJobTargetKey,
  cancelJob,
  completeJob,
  createJob,
  expandImpactActionIntoJobs,
  heartbeatJob,
  isJobRunnable,
  isLeaseExpired,
  leaseJob,
  parseJob,
  releaseLease,
  remainingAttempts,
  retryJob,
  supersedeJob,
  timeoutJob,
  transitionJob,
  validateJob,
  type Job,
  type JobTransitionError,
} from "../lib/intelligencePublishing/jobModel";

function buildImpactPlan() {
  const event = parsePublicationEventEnvelope({
    eventId: "evt_job_001",
    eventType: "public_overview_approved",
    occurredAt: "2026-07-20T10:00:00.000Z",
    sourceSystem: "public_intelligence",
    subjectType: "public_overview",
    subjectId: "overview:paris",
    subjectFingerprint: "overview_fp_v2",
    policyVersions: {
      publicMarketOverviewContractVersion: "pmo_v1",
    },
    priority: "P1",
    visibility: "public",
    metadata: {
      approvalStatus: "internal_approved",
    },
  });

  return resolveImpact(event, {
    assets: Object.freeze([
      Object.freeze({
        assetId: "asset_report_paris",
        assetType: "market_report",
        visibility: "public" as const,
      }),
    ]),
    assetVersions: Object.freeze([
      Object.freeze({
        assetVersionId: "asset_version_paris_v1",
        assetId: "asset_report_paris",
      }),
    ]),
    artifactReferences: Object.freeze([
      Object.freeze({
        assetId: "asset_report_paris",
        assetVersionId: "asset_version_paris_v1",
        referenceType: "source_subject" as const,
        subjectType: "public_overview" as const,
        subjectId: "overview:paris",
      }),
    ]),
    activeVersions: Object.freeze({
      asset_report_paris: "asset_version_paris_v1",
    }),
    availableLocales: Object.freeze({
      asset_report_paris: Object.freeze(["en", "fr"]),
    }),
    availableChannels: Object.freeze({
      asset_report_paris: Object.freeze(["web", "api"]),
    }),
    currentPolicyVersions: Object.freeze({}),
    currentFingerprints: Object.freeze({
      "public_overview:overview:paris": "overview_fp_v1",
    }),
    currentApprovalStates: Object.freeze({}),
    now: () => "2026-07-20T11:00:00.000Z",
  });
}

function buildJob(overrides: Partial<Parameters<typeof createJob>[0]> = {}): Job {
  return createJob({
    jobId: "job_001",
    runId: "run_001",
    action: "generate_asset_version",
    jobType: "generate_asset_version",
    priority: "P1",
    now: "2026-07-20T11:00:00.000Z",
    assetId: "asset_report_paris",
    locale: "en",
    channel: null,
    dependencyJobIds: Object.freeze([]),
    dependentJobIds: Object.freeze([]),
    ...overrides,
  });
}

function expectJobTransitionError(fn: () => unknown): JobTransitionError {
  try {
    fn();
  } catch (error) {
    return error as JobTransitionError;
  }
  throw new Error("Expected a job transition error.");
}

{
  const job = buildJob();
  assert.equal(job.status, "queued");
  assert.equal(job.attempt, 1);
  assert.equal(job.maxAttempts, 3);
}

{
  const queued = buildJob();
  const waiting = transitionJob(queued, {
    toStatus: "waiting_dependencies",
    now: "2026-07-20T11:01:00.000Z",
  });
  assert.equal(waiting.status, "waiting_dependencies");
}

{
  const leased = leaseJob(buildJob(), {
    now: "2026-07-20T11:01:00.000Z",
    leaseOwner: "worker-a",
    leaseTtlSeconds: 60,
  });
  assert.equal(leased.status, "leased");
  assert.equal(leased.leaseOwner, "worker-a");
}

{
  const leased = leaseJob(buildJob(), {
    now: "2026-07-20T11:01:00.000Z",
    leaseOwner: "worker-a",
    leaseTtlSeconds: 60,
  });
  const sameLease = leaseJob(leased, {
    now: "2026-07-20T11:01:00.000Z",
    leaseOwner: "worker-a",
    leaseTtlSeconds: 60,
  });
  assert.equal(sameLease, leased);
}

{
  const running = transitionJob(
    leaseJob(buildJob(), {
      now: "2026-07-20T11:01:00.000Z",
      leaseOwner: "worker-a",
      leaseTtlSeconds: 60,
    }),
    {
      toStatus: "running",
      now: "2026-07-20T11:02:00.000Z",
    },
  );
  assert.equal(running.status, "running");
}

{
  const leased = leaseJob(buildJob(), {
    now: "2026-07-20T11:01:00.000Z",
    leaseOwner: "worker-a",
    leaseTtlSeconds: 60,
  });
  const heartbeat = heartbeatJob(leased, "2026-07-20T11:02:00.000Z");
  assert.equal(heartbeat.heartbeatAt, "2026-07-20T11:02:00.000Z");
}

{
  const leased = leaseJob(buildJob(), {
    now: "2026-07-20T11:01:00.000Z",
    leaseOwner: "worker-a",
    leaseTtlSeconds: 60,
  });
  const heartbeat = heartbeatJob(leased, "2026-07-20T11:02:00.000Z");
  const sameHeartbeat = heartbeatJob(heartbeat, "2026-07-20T11:02:00.000Z");
  assert.equal(sameHeartbeat, heartbeat);
}

{
  const released = releaseLease(
    leaseJob(buildJob(), {
      now: "2026-07-20T11:01:00.000Z",
      leaseOwner: "worker-a",
      leaseTtlSeconds: 60,
    }),
    "2026-07-20T11:02:00.000Z",
  );
  assert.equal(released.status, "queued");
}

{
  const completed = completeJob(
    transitionJob(
      leaseJob(buildJob(), {
        now: "2026-07-20T11:01:00.000Z",
        leaseOwner: "worker-a",
        leaseTtlSeconds: 60,
      }),
      {
        toStatus: "running",
        now: "2026-07-20T11:02:00.000Z",
      },
    ),
    "2026-07-20T11:03:00.000Z",
  );
  assert.equal(completed.status, "succeeded");
}

{
  const retryable = transitionJob(
    transitionJob(
      leaseJob(buildJob(), {
        now: "2026-07-20T11:01:00.000Z",
        leaseOwner: "worker-a",
        leaseTtlSeconds: 60,
      }),
      {
        toStatus: "running",
        now: "2026-07-20T11:02:00.000Z",
      },
    ),
    {
      toStatus: "retryable_failed",
      now: "2026-07-20T11:03:00.000Z",
      failureReason: "temporary_provider_failure",
    },
  );
  assert.equal(retryable.status, "retryable_failed");
  const retried = retryJob(retryable, "2026-07-20T11:04:00.000Z");
  assert.equal(retried.status, "queued");
  assert.equal(retried.attempt, 2);
}

{
  const permanentFailed = transitionJob(
    transitionJob(
      leaseJob(buildJob(), {
        now: "2026-07-20T11:01:00.000Z",
        leaseOwner: "worker-a",
        leaseTtlSeconds: 60,
      }),
      {
        toStatus: "running",
        now: "2026-07-20T11:02:00.000Z",
      },
    ),
    {
      toStatus: "permanent_failed",
      now: "2026-07-20T11:03:00.000Z",
      failureReason: "invalid_payload",
    },
  );
  const error = expectJobTransitionError(() =>
    retryJob(permanentFailed, "2026-07-20T11:04:00.000Z"),
  );
  assert.equal(error.code, "retry_not_allowed");
}

{
  const timedOut = timeoutJob(
    leaseJob(buildJob(), {
      now: "2026-07-20T11:01:00.000Z",
      leaseOwner: "worker-a",
      leaseTtlSeconds: 60,
    }),
    "2026-07-20T11:02:00.000Z",
    "lease_expired",
  );
  assert.equal(timedOut.status, "timed_out");
}

{
  const cancelled = cancelJob(
    buildJob(),
    "2026-07-20T11:01:00.000Z",
    "manual_cancel",
  );
  assert.equal(cancelled.status, "cancelled");
}

{
  const superseded = supersedeJob(
    buildJob(),
    "2026-07-20T11:01:00.000Z",
    "job_002",
  );
  assert.equal(superseded.status, "superseded");
  assert.equal(superseded.supersededByJobId, "job_002");
}

{
  const job = buildJob({
    dependencyJobIds: Object.freeze(["job_a", "job_b"]),
    dependentJobIds: Object.freeze(["job_c", "job_d"]),
  });
  assert.deepEqual(job.dependencyJobIds, ["job_a", "job_b"]);
  assert.deepEqual(job.dependentJobIds, ["job_c", "job_d"]);
}

{
  const snapshot = JSON.stringify(buildJob());
  buildJob();
  assert.equal(JSON.stringify(buildJob()), snapshot);
}

{
  const runnable = isJobRunnable(buildJob());
  assert.equal(runnable, true);
}

{
  const leased = leaseJob(buildJob(), {
    now: "2026-07-20T11:01:00.000Z",
    leaseOwner: "worker-a",
    leaseTtlSeconds: 60,
  });
  assert.equal(isLeaseExpired(leased, "2026-07-20T11:01:30.000Z"), false);
  assert.equal(isLeaseExpired(leased, "2026-07-20T11:02:30.000Z"), true);
}

{
  const retryable = transitionJob(
    transitionJob(
      leaseJob(buildJob(), {
        now: "2026-07-20T11:01:00.000Z",
        leaseOwner: "worker-a",
        leaseTtlSeconds: 60,
      }),
      {
        toStatus: "running",
        now: "2026-07-20T11:02:00.000Z",
      },
    ),
    {
      toStatus: "retryable_failed",
      now: "2026-07-20T11:03:00.000Z",
      failureReason: "temporary_provider_failure",
    },
  );
  assert.equal(remainingAttempts(retryable), 2);
}

{
  const invalid = validateJob({
    ...buildJob(),
    dependencyJobIds: ["job_a", "job_a"],
  });
  assert.equal(invalid.ok, false);
}

{
  const parsed = parseJob(buildJob());
  assert.equal(parsed.jobId, "job_001");
}

{
  const plan = buildImpactPlan();
  const jobs = expandImpactActionIntoJobs("generate_asset_version", plan, {
    runId: "run_001",
    now: () => "2026-07-20T11:00:00.000Z",
    localesByAssetId: Object.freeze({
      asset_report_paris: Object.freeze(["fr", "en"]),
    }),
    channelsByAssetId: Object.freeze({
      asset_report_paris: Object.freeze(["web", "api"]),
    }),
    activeAssetVersionIdsByAssetId: Object.freeze({
      asset_report_paris: "asset_version_paris_v1",
    }),
  });
  assert.equal(jobs.length, 2);
  assert.deepEqual(
    jobs.map((job) => job.locale),
    ["en", "fr"],
  );
}

{
  const plan = buildImpactPlan();
  const publishTargetKey = buildJobTargetKey({
    jobType: "publish",
    assetId: "asset_report_paris",
    locale: null,
    channel: "web",
  });
  const jobs = expandImpactActionIntoJobs("republish", plan, {
    runId: "run_001",
    now: () => "2026-07-20T11:00:00.000Z",
    channelsByAssetId: Object.freeze({
      asset_report_paris: Object.freeze(["api", "web"]),
    }),
    dependencyJobIdsByTargetKey: Object.freeze({
      [publishTargetKey]: Object.freeze(["job_generate_en", "job_generate_fr"]),
    }),
  });
  assert.equal(jobs.length, 2);
  const webJob = jobs.find((job) => job.channel === "web");
  assert.deepEqual(webJob?.dependencyJobIds, ["job_generate_en", "job_generate_fr"]);
}

{
  const sameJob = transitionJob(buildJob(), {
    toStatus: "queued",
    now: "2026-07-20T11:00:00.000Z",
  });
  assert.equal(sameJob.updatedAt, "2026-07-20T11:00:00.000Z");
}

console.log("PASS — Intelligence Publishing job model smoke");

import assert from "node:assert/strict";

import { parsePublicationEventEnvelope } from "../lib/intelligencePublishing/eventContracts";
import { buildExecutionPlan as buildEnginePublicationPlan } from "../lib/intelligencePublishing/executionEngine";
import {
  ExecutionRuntimeError,
  buildExecutionGraph,
  buildExecutionGraphFromExecutionPlan,
  buildExecutionPlan,
  executeExecutionPlan,
  resumeExecutionPlan,
} from "../lib/intelligencePublishing/executionRuntime";
import { parseRegistrySnapshot } from "../lib/intelligencePublishing/registryAdapter";

function buildSimpleGraph() {
  return buildExecutionGraph({
    registrySnapshotId: "registry_snapshot_runtime_smoke",
    registrySnapshotFingerprint: "registry_fp_runtime_smoke",
    executionPlanId: "engine_plan_runtime_smoke",
    createdAt: "2026-07-21T12:00:00.000Z",
    jobs: [
      {
        id: "job_generate",
        type: "generate_asset_version",
        dependencies: [],
        retryPolicy: {
          maxAttempts: 2,
          retryable: true,
        },
      },
      {
        id: "job_variant",
        type: "generate_variant",
        dependencies: ["job_generate"],
      },
      {
        id: "job_publish",
        type: "publish",
        dependencies: ["job_variant"],
        retryPolicy: {
          maxAttempts: 2,
          retryable: true,
        },
      },
    ],
  });
}

function buildComplexGraph() {
  return buildExecutionGraph({
    registrySnapshotId: "registry_snapshot_runtime_complex",
    registrySnapshotFingerprint: "registry_fp_runtime_complex",
    executionPlanId: "engine_plan_runtime_complex",
    createdAt: "2026-07-21T12:05:00.000Z",
    jobs: [
      {
        id: "job_publish_report",
        type: "publish",
        dependencies: ["job_generate_report", "job_generate_variant"],
      },
      {
        id: "job_generate_variant",
        type: "generate_variant",
        dependencies: ["job_generate_report"],
      },
      {
        id: "job_generate_report",
        type: "generate_asset_version",
        dependencies: [],
      },
      {
        id: "job_refresh_metadata",
        type: "update_metadata",
        dependencies: ["job_generate_report"],
      },
    ],
  });
}

function buildEngineSnapshotInput() {
  return parseRegistrySnapshot({
    snapshotId: "registry_snapshot_runtime_engine",
    snapshotVersion: 2,
    generatedAt: "2026-07-21T09:00:00.000Z",
    assets: [
      {
        assetId: "asset_report_paris",
        canonicalId: "market-report-paris",
        assetType: "market_report",
        status: "published",
        visibility: "public",
        defaultLocale: "en",
        availableLocales: ["en", "fr"],
        availableChannels: ["web"],
        activeVersionId: "asset_report_paris_v1",
        templateId: "tpl_market_report",
        ownerTeam: "intelligence",
        confidenceAffectsVisibleContent: true,
        policyChangeAffectsVisibleContent: true,
        freshnessExpiryBehavior: "keep_visible",
        createdAt: "2026-07-21T08:00:00.000Z",
        updatedAt: "2026-07-21T08:30:00.000Z",
        metadata: {
          market: "paris",
        },
      },
    ],
    assetVersions: [
      {
        assetVersionId: "asset_report_paris_v1",
        assetId: "asset_report_paris",
        versionNumber: 1,
        status: "active",
        contentFingerprint: "content_fp_paris_v1",
        sourceFingerprint: "source_fp_paris_v1",
        templateFingerprint: "template_fp_market_report_v1",
        rendererFingerprint: "renderer_fp_market_report_v1",
        policyVersions: {
          pricing_policy: "pricing_v1",
        },
        confidenceBand: "high",
        createdAt: "2026-07-21T08:00:00.000Z",
        approvedAt: "2026-07-21T08:05:00.000Z",
        publishedAt: "2026-07-21T08:10:00.000Z",
        supersededAt: null,
        metadata: {},
      },
    ],
    artifactReferences: [
      {
        referenceId: "ref_report_paris_source",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v1",
        artifactType: "benchmark",
        artifactId: "benchmark:pricing:paris",
        artifactFingerprint: "benchmark_fp_paris_v1",
        relationshipType: "derived_from",
        policyVersions: {
          pricing_policy: "pricing_v1",
        },
        createdAt: "2026-07-21T08:10:00.000Z",
        metadata: {},
      },
    ],
    channelVariants: [
      {
        variantId: "variant_report_paris_en_web",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v1",
        locale: "en",
        channel: "web",
        status: "generated",
        contentFingerprint: "variant_fp_report_paris_en_web",
        destinationKey: "/reports/airbnb-market-report-paris",
        publishedAt: null,
        updatedAt: "2026-07-21T08:15:00.000Z",
        metadata: {},
      },
    ],
    freshnessStates: [
      {
        freshnessId: "freshness_report_paris",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v1",
        computedAt: "2026-07-21T08:10:00.000Z",
        reviewDueAt: "2026-07-28T08:10:00.000Z",
        publishableUntil: "2026-08-28T08:10:00.000Z",
        staleAfter: "2026-08-07T08:10:00.000Z",
        expiredAfter: "2026-08-28T08:10:00.000Z",
        isPublishable: true,
        isStale: false,
        isExpired: false,
        evaluatedAt: "2026-07-21T08:10:00.000Z",
      },
    ],
    publicationStates: [
      {
        publicationId: "publication_report_paris_en_web",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v1",
        locale: "en",
        channel: "web",
        status: "published",
        destinationKey: "/reports/airbnb-market-report-paris",
        publicationFingerprint: "publication_fp_report_paris_v1",
        publishedAt: "2026-07-21T08:20:00.000Z",
        suppressedAt: null,
        metadata: {},
        createdAt: "2026-07-21T08:20:00.000Z",
        updatedAt: "2026-07-21T08:20:00.000Z",
      },
    ],
    policyVersions: {
      pricing_policy: "pricing_v1",
    },
    metadata: {},
  });
}

function buildEngineExecutionScenario() {
  const event = parsePublicationEventEnvelope({
    eventId: "evt_runtime_publish_001",
    eventType: "benchmark_updated",
    occurredAt: "2026-07-21T09:30:00.000Z",
    sourceSystem: "intelligence_v2",
    subjectType: "benchmark",
    subjectId: "benchmark:pricing:paris",
    subjectFingerprint: "benchmark_pricing_paris_fp_v2",
    policyVersions: {
      pricing_policy: "pricing_v2",
    },
    priority: "P1",
    visibility: "internal",
    metadata: {
      benchmarkType: "pricing_distribution",
      changeSummary: "distribution_updated",
    },
  });

  const snapshot = buildEngineSnapshotInput();
  return {
    snapshot,
    executionPlan: buildEnginePublicationPlan({
      event,
      registrySnapshot: snapshot,
      runId: "run_runtime_smoke_001",
      now: () => "2026-07-21T10:00:00.000Z",
      metadataByJobType: {
        publish: {
          timeoutSeconds: 300,
        },
      },
    }),
  };
}

function expectRuntimeError(
  fn: () => unknown,
  code: string,
): ExecutionRuntimeError {
  try {
    fn();
  } catch (error) {
    assert(error instanceof ExecutionRuntimeError);
    assert.equal(error.code, code);
    return error;
  }

  throw new Error(`Expected ExecutionRuntimeError(${code}).`);
}

{
  const graph = buildSimpleGraph();
  assert.equal(graph.rootJobIds.length, 1);
  assert.deepEqual(graph.rootJobIds, ["job_generate"]);
  assert.deepEqual(graph.leafJobIds, ["job_publish"]);
  assert.deepEqual(graph.orderedJobIds, [
    "job_generate",
    "job_variant",
    "job_publish",
  ]);
  assert.equal(Object.isFrozen(graph), true);
  assert.equal(Object.isFrozen(graph.jobs), true);
}

{
  const first = buildComplexGraph();
  const second = buildComplexGraph();
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.orderedJobIds, [
    "job_generate_report",
    "job_generate_variant",
    "job_publish_report",
    "job_refresh_metadata",
  ]);
}

{
  const cycle = expectRuntimeError(
    () =>
      buildExecutionGraph({
        registrySnapshotId: "registry_snapshot_runtime_cycle",
        registrySnapshotFingerprint: "registry_fp_runtime_cycle",
        createdAt: "2026-07-21T12:10:00.000Z",
        jobs: [
          {
            id: "job_a",
            type: "generate_asset_version",
            dependencies: ["job_b"],
          },
          {
            id: "job_b",
            type: "publish",
            dependencies: ["job_a"],
          },
        ],
      }),
    "dependency_cycle",
  );
  assert.equal(cycle.diagnostics[0]?.code, "dependency_cycle");
}

{
  const missing = expectRuntimeError(
    () =>
      buildExecutionGraph({
        registrySnapshotId: "registry_snapshot_runtime_missing",
        registrySnapshotFingerprint: "registry_fp_runtime_missing",
        createdAt: "2026-07-21T12:11:00.000Z",
        jobs: [
          {
            id: "job_only",
            type: "publish",
            dependencies: ["job_unknown"],
          },
        ],
      }),
    "missing_dependency",
  );
  assert.equal(missing.diagnostics[0]?.dependencyJobId, "job_unknown");
}

{
  const graph = buildSimpleGraph();
  const plan = buildExecutionPlan({
    graph,
  });
  const first = executeExecutionPlan({
    executionPlan: plan,
    now: "2026-07-21T12:15:00.000Z",
  });
  const second = executeExecutionPlan({
    executionPlan: plan,
    now: "2026-07-21T12:15:00.000Z",
  });
  assert.equal(plan.fingerprint, buildExecutionPlan({ graph }).fingerprint);
  assert.equal(first.executionState.fingerprint, second.executionState.fingerprint);
  assert.deepEqual(first.executionState.readyJobIds, ["job_generate"]);
  assert.deepEqual(first.executionState.pendingJobIds, [
    "job_publish",
    "job_variant",
  ]);
}

{
  const graph = buildSimpleGraph();
  const plan = buildExecutionPlan({
    graph,
  });
  const previous = executeExecutionPlan({
    executionPlan: plan,
    now: "2026-07-21T12:20:00.000Z",
  }).executionState;

  const completedA = previous.jobs.map((job) => {
    if (job.id === "job_generate") {
      return {
        ...job,
        executionState: {
          ...job.executionState,
          status: "completed" as const,
          blockedByJobIds: [],
          finishedAt: "2026-07-21T12:21:00.000Z",
        },
      };
    }
    if (job.id === "job_variant") {
      return {
        ...job,
        executionState: {
          ...job.executionState,
          status: "completed" as const,
          blockedByJobIds: [],
          finishedAt: "2026-07-21T12:22:00.000Z",
        },
      };
    }
    return {
      ...job,
      executionState: {
        ...job.executionState,
        status: "failed" as const,
        blockedByJobIds: [],
        finishedAt: "2026-07-21T12:23:00.000Z",
      },
    };
  });

  const resumed = resumeExecutionPlan({
    executionPlan: plan,
    previousState: {
      ...previous,
      jobs: completedA,
      completedJobIds: ["job_generate", "job_variant"],
      failedJobIds: ["job_publish"],
      pendingJobIds: [],
      readyJobIds: [],
      runningJobIds: [],
      skippedJobIds: [],
      cancelledJobIds: [],
      alreadyCompletedJobIds: [],
      retryScheduledJobIds: [],
      resumedJobIds: [],
      status: "failed",
      updatedAt: "2026-07-21T12:23:00.000Z",
    },
    now: "2026-07-21T12:24:00.000Z",
  });

  assert.deepEqual(resumed.executionState.readyJobIds, ["job_publish"]);
  assert.deepEqual(
    [...resumed.executionState.alreadyCompletedJobIds].sort(),
    ["job_generate", "job_variant"],
  );
  assert.deepEqual(resumed.executionState.retryScheduledJobIds, ["job_publish"]);
}

{
  const graph = buildSimpleGraph();
  const plan = buildExecutionPlan({
    graph,
  });
  const previous = executeExecutionPlan({
    executionPlan: plan,
    now: "2026-07-21T12:30:00.000Z",
  }).executionState;
  const running = previous.jobs.map((job) =>
    job.id === "job_generate"
      ? {
          ...job,
          executionState: {
            ...job.executionState,
            status: "running" as const,
            startedAt: "2026-07-21T12:31:00.000Z",
          },
        }
      : job,
  );

  const resumed = resumeExecutionPlan({
    executionPlan: plan,
    previousState: {
      ...previous,
      jobs: running,
      runningJobIds: ["job_generate"],
      readyJobIds: [],
      pendingJobIds: ["job_variant", "job_publish"],
      status: "running",
      updatedAt: "2026-07-21T12:31:00.000Z",
    },
    now: "2026-07-21T12:32:00.000Z",
  });

  assert.deepEqual(resumed.executionState.resumedJobIds, ["job_generate"]);
  assert.deepEqual(resumed.executionState.readyJobIds, ["job_generate"]);
}

{
  const { snapshot, executionPlan } = buildEngineExecutionScenario();
  const graph = buildExecutionGraphFromExecutionPlan({
    executionPlan,
    registrySnapshot: snapshot,
  });
  const plan = buildExecutionPlan({
    graph,
  });
  const result = executeExecutionPlan({
    executionPlan: plan,
    now: "2026-07-21T10:05:00.000Z",
  });
  assert.equal(graph.executionPlanId, executionPlan.executionPlanId);
  assert.equal(plan.executionPlanId, executionPlan.executionPlanId);
  assert.equal(result.executionState.graphId, graph.graphId);
  assert.ok(result.executionState.readyJobIds.length > 0);
}

console.info("PASS — Intelligence Publishing execution runtime smoke");

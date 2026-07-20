import assert from "node:assert/strict";

import {
  buildPublicationEventIdempotencyKey,
  parsePublicationEventEnvelope,
  type PublicationEventEnvelope,
} from "../lib/intelligencePublishing/eventContracts";
import {
  ExecutionEngineError,
  buildExecutionOrder,
  buildExecutionPlan,
  buildExecutionPlanId,
  buildExecutionPlanCoordinationRequirements,
  buildExecutionGovernanceSummary,
  calculateExecutionPlanEstimatedCost,
  expandImpactPlanIntoJobs,
  normalizeExecutionJobs,
  parseExecutionPlan,
  validateExecutionPlan,
} from "../lib/intelligencePublishing/executionEngine";
import { buildJobExpansionContextFromRegistry } from "../lib/intelligencePublishing/registryAdapter";
import { resolveImpact } from "../lib/intelligencePublishing/impactResolver";
import {
  buildJobTargetKey,
  createJob,
} from "../lib/intelligencePublishing/jobModel";
import {
  buildImpactResolutionContextFromRegistry,
  buildRegistrySnapshotFingerprint,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
} from "../lib/intelligencePublishing/registryAdapter";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildBaseSnapshotInput() {
  return {
    snapshotId: "registry_snapshot_exec_001",
    snapshotVersion: 3,
    generatedAt: "2026-07-20T14:00:00.000Z",
    assets: [
      {
        assetId: "asset_report_paris",
        canonicalId: "market-report-paris",
        assetType: "market_report",
        status: "published",
        visibility: "public",
        defaultLocale: "en",
        availableLocales: ["fr", "en"],
        availableChannels: ["newsletter", "web"],
        activeVersionId: "asset_report_paris_v2",
        templateId: "tpl_market_report",
        ownerTeam: "intelligence",
        confidenceAffectsVisibleContent: true,
        policyChangeAffectsVisibleContent: true,
        freshnessExpiryBehavior: "keep_visible",
        createdAt: "2026-07-01T09:00:00.000Z",
        updatedAt: "2026-07-20T13:00:00.000Z",
        metadata: {
          market: "paris",
        },
      },
      {
        assetId: "asset_overview_marrakech",
        canonicalId: "market-overview-marrakech",
        assetType: "insight_card",
        status: "approved",
        visibility: "public",
        defaultLocale: "en",
        availableLocales: ["en"],
        availableChannels: ["api", "web"],
        activeVersionId: "asset_overview_marrakech_v1",
        templateId: "tpl_public_overview",
        ownerTeam: "intelligence",
        confidenceAffectsVisibleContent: true,
        policyChangeAffectsVisibleContent: true,
        freshnessExpiryBehavior: "keep_visible",
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-20T13:00:00.000Z",
        metadata: {
          market: "marrakech",
        },
      },
      {
        assetId: "asset_overview_rabat",
        canonicalId: "market-overview-rabat",
        assetType: "insight_card",
        status: "published",
        visibility: "public",
        defaultLocale: "en",
        availableLocales: ["en"],
        availableChannels: ["web"],
        activeVersionId: "asset_overview_rabat_v1",
        templateId: "tpl_public_overview",
        ownerTeam: "intelligence",
        confidenceAffectsVisibleContent: true,
        policyChangeAffectsVisibleContent: true,
        freshnessExpiryBehavior: "keep_visible",
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-20T13:00:00.000Z",
        metadata: {
          market: "rabat",
        },
      },
      {
        assetId: "asset_overview_fes",
        canonicalId: "market-overview-fes",
        assetType: "insight_card",
        status: "published",
        visibility: "public",
        defaultLocale: "en",
        availableLocales: ["en"],
        availableChannels: ["web"],
        activeVersionId: "asset_overview_fes_v1",
        templateId: "tpl_public_overview",
        ownerTeam: "intelligence",
        confidenceAffectsVisibleContent: true,
        policyChangeAffectsVisibleContent: true,
        freshnessExpiryBehavior: "keep_visible",
        createdAt: "2026-07-10T09:00:00.000Z",
        updatedAt: "2026-07-20T13:00:00.000Z",
        metadata: {
          market: "fes",
        },
      },
      {
        assetId: "asset_report_london",
        canonicalId: "market-report-london",
        assetType: "market_report",
        status: "published",
        visibility: "public",
        defaultLocale: "en",
        availableLocales: ["en"],
        availableChannels: ["web"],
        activeVersionId: "asset_report_london_v1",
        templateId: "tpl_market_report",
        ownerTeam: "intelligence",
        confidenceAffectsVisibleContent: false,
        policyChangeAffectsVisibleContent: true,
        freshnessExpiryBehavior: "keep_visible",
        createdAt: "2026-07-05T09:00:00.000Z",
        updatedAt: "2026-07-20T13:00:00.000Z",
        metadata: {
          market: "london",
        },
      },
    ],
    assetVersions: [
      {
        assetVersionId: "asset_report_paris_v2",
        assetId: "asset_report_paris",
        versionNumber: 2,
        status: "active",
        contentFingerprint: "content_fp_paris_v2",
        sourceFingerprint: "source_fp_paris_v2",
        templateFingerprint: "template_fp_market_report_v1",
        rendererFingerprint: "renderer_fp_web_v2",
        policyVersions: {
          pricing_policy: "policy_v2",
        },
        confidenceBand: "high",
        createdAt: "2026-07-18T09:00:00.000Z",
        approvedAt: "2026-07-19T09:00:00.000Z",
        publishedAt: "2026-07-20T10:00:00.000Z",
        supersededAt: null,
        metadata: {},
      },
      {
        assetVersionId: "asset_overview_marrakech_v1",
        assetId: "asset_overview_marrakech",
        versionNumber: 1,
        status: "approved",
        contentFingerprint: "content_fp_marrakech_v1",
        sourceFingerprint: "source_fp_marrakech_v1",
        templateFingerprint: "template_fp_overview_v1",
        rendererFingerprint: "renderer_fp_overview_v1",
        policyVersions: {
          public_overview_policy: "overview_policy_v1",
        },
        confidenceBand: "moderate",
        createdAt: "2026-07-16T09:00:00.000Z",
        approvedAt: "2026-07-17T09:00:00.000Z",
        publishedAt: null,
        supersededAt: null,
        metadata: {},
      },
      {
        assetVersionId: "asset_overview_rabat_v1",
        assetId: "asset_overview_rabat",
        versionNumber: 1,
        status: "active",
        contentFingerprint: "content_fp_rabat_v1",
        sourceFingerprint: "source_fp_rabat_v1",
        templateFingerprint: "template_fp_overview_v1",
        rendererFingerprint: "renderer_fp_overview_v1",
        policyVersions: {
          public_overview_policy: "overview_policy_v1",
        },
        confidenceBand: "high",
        createdAt: "2026-07-16T09:00:00.000Z",
        approvedAt: "2026-07-17T09:00:00.000Z",
        publishedAt: "2026-07-19T09:00:00.000Z",
        supersededAt: null,
        metadata: {},
      },
      {
        assetVersionId: "asset_overview_fes_v1",
        assetId: "asset_overview_fes",
        versionNumber: 1,
        status: "active",
        contentFingerprint: "content_fp_fes_v1",
        sourceFingerprint: "source_fp_fes_v1",
        templateFingerprint: "template_fp_overview_v1",
        rendererFingerprint: "renderer_fp_overview_v1",
        policyVersions: {
          public_overview_policy: "overview_policy_v1",
        },
        confidenceBand: "high",
        createdAt: "2026-07-16T09:00:00.000Z",
        approvedAt: "2026-07-17T09:00:00.000Z",
        publishedAt: "2026-07-19T09:00:00.000Z",
        supersededAt: null,
        metadata: {},
      },
      {
        assetVersionId: "asset_report_london_v1",
        assetId: "asset_report_london",
        versionNumber: 1,
        status: "active",
        contentFingerprint: "content_fp_london_v1",
        sourceFingerprint: "source_fp_london_v1",
        templateFingerprint: "template_fp_market_report_v1",
        rendererFingerprint: "renderer_fp_web_v1",
        policyVersions: {
          pricing_policy: "policy_v1",
        },
        confidenceBand: "high",
        createdAt: "2026-07-10T09:00:00.000Z",
        approvedAt: "2026-07-11T09:00:00.000Z",
        publishedAt: "2026-07-12T09:00:00.000Z",
        supersededAt: null,
        metadata: {},
      },
    ],
    artifactReferences: [
      {
        referenceId: "ref_paris_benchmark",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        artifactType: "benchmark",
        artifactId: "benchmark:pricing:paris",
        artifactFingerprint: "benchmark_fp_v1",
        relationshipType: "supported_by",
        policyVersions: {
          pricing_policy: "policy_v2",
        },
        createdAt: "2026-07-20T09:35:00.000Z",
        metadata: {
          sourceApproved: true,
        },
      },
      {
        referenceId: "ref_paris_policy",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        artifactType: "policy",
        artifactId: "pricing_policy",
        artifactFingerprint: "policy_fp_v2",
        relationshipType: "governed_by",
        policyVersions: {
          pricing_policy: "policy_v2",
        },
        createdAt: "2026-07-20T09:40:00.000Z",
        metadata: {},
      },
      {
        referenceId: "ref_marrakech_overview",
        assetId: "asset_overview_marrakech",
        assetVersionId: "asset_overview_marrakech_v1",
        artifactType: "public_overview",
        artifactId: "overview:marrakech",
        artifactFingerprint: "overview_fp_v1",
        relationshipType: "supported_by",
        policyVersions: {
          public_overview_policy: "overview_policy_v1",
        },
        createdAt: "2026-07-20T09:30:00.000Z",
        metadata: {
          sourceApproved: true,
          approvalState: "internal_approved",
        },
      },
      {
        referenceId: "ref_rabat_overview",
        assetId: "asset_overview_rabat",
        assetVersionId: "asset_overview_rabat_v1",
        artifactType: "public_overview",
        artifactId: "overview:rabat",
        artifactFingerprint: "overview_rabat_fp_v1",
        relationshipType: "supported_by",
        policyVersions: {
          public_overview_policy: "overview_policy_v1",
        },
        createdAt: "2026-07-20T09:30:00.000Z",
        metadata: {
          sourceApproved: true,
        },
      },
      {
        referenceId: "ref_fes_overview",
        assetId: "asset_overview_fes",
        assetVersionId: "asset_overview_fes_v1",
        artifactType: "public_overview",
        artifactId: "overview:fes",
        artifactFingerprint: "overview_fes_fp_v1",
        relationshipType: "supported_by",
        policyVersions: {
          public_overview_policy: "overview_policy_v1",
        },
        createdAt: "2026-07-20T09:30:00.000Z",
        metadata: {
          sourceApproved: true,
        },
      },
      {
        referenceId: "ref_london_policy",
        assetId: "asset_report_london",
        assetVersionId: "asset_report_london_v1",
        artifactType: "policy",
        artifactId: "pricing_policy",
        artifactFingerprint: "policy_fp_v1",
        relationshipType: "governed_by",
        policyVersions: {
          pricing_policy: "policy_v1",
        },
        createdAt: "2026-07-20T09:40:00.000Z",
        metadata: {},
      },
    ],
    channelVariants: [
      {
        variantId: "variant_paris_en_web_v2",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        locale: "en",
        channel: "web",
        status: "published",
        contentFingerprint: "variant_fp_paris_en_web_v2",
        destinationKey: "site:web:en",
        publishedAt: "2026-07-20T10:05:00.000Z",
        updatedAt: "2026-07-20T10:05:00.000Z",
        metadata: {},
      },
      {
        variantId: "variant_paris_fr_web_v2",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        locale: "fr",
        channel: "web",
        status: "published",
        contentFingerprint: "variant_fp_paris_fr_web_v2",
        destinationKey: "site:web:fr",
        publishedAt: "2026-07-20T10:05:00.000Z",
        updatedAt: "2026-07-20T10:05:00.000Z",
        metadata: {},
      },
      {
        variantId: "variant_paris_en_newsletter_v2",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        locale: "en",
        channel: "newsletter",
        status: "published",
        contentFingerprint: "variant_fp_paris_en_newsletter_v2",
        destinationKey: "newsletter:en",
        publishedAt: "2026-07-20T10:05:00.000Z",
        updatedAt: "2026-07-20T10:05:00.000Z",
        metadata: {},
      },
      {
        variantId: "variant_marrakech_en_web_v1",
        assetId: "asset_overview_marrakech",
        assetVersionId: "asset_overview_marrakech_v1",
        locale: "en",
        channel: "web",
        status: "approved",
        contentFingerprint: "variant_fp_marrakech_en_web_v1",
        destinationKey: "site:web:en:marrakech",
        publishedAt: null,
        updatedAt: "2026-07-20T10:05:00.000Z",
        metadata: {},
      },
      {
        variantId: "variant_rabat_en_web_v1",
        assetId: "asset_overview_rabat",
        assetVersionId: "asset_overview_rabat_v1",
        locale: "en",
        channel: "web",
        status: "published",
        contentFingerprint: "variant_fp_rabat_en_web_v1",
        destinationKey: "site:web:en:rabat",
        publishedAt: "2026-07-20T10:05:00.000Z",
        updatedAt: "2026-07-20T10:05:00.000Z",
        metadata: {},
      },
      {
        variantId: "variant_fes_en_web_v1",
        assetId: "asset_overview_fes",
        assetVersionId: "asset_overview_fes_v1",
        locale: "en",
        channel: "web",
        status: "published",
        contentFingerprint: "variant_fp_fes_en_web_v1",
        destinationKey: "site:web:en:fes",
        publishedAt: "2026-07-20T10:05:00.000Z",
        updatedAt: "2026-07-20T10:05:00.000Z",
        metadata: {},
      },
    ],
    freshnessStates: [
      {
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        computedAt: "2026-07-20T13:30:00.000Z",
        reviewDueAt: null,
        publishableUntil: "2026-08-20T13:30:00.000Z",
        staleAfter: "2026-07-25T13:30:00.000Z",
        expiredAfter: "2026-08-25T13:30:00.000Z",
        isPublishable: true,
        isStale: false,
        isExpired: false,
        evaluatedAt: "2026-07-20T13:30:00.000Z",
      },
      {
        assetId: "asset_overview_marrakech",
        assetVersionId: "asset_overview_marrakech_v1",
        computedAt: "2026-07-20T13:30:00.000Z",
        reviewDueAt: null,
        publishableUntil: "2026-08-20T13:30:00.000Z",
        staleAfter: "2026-07-25T13:30:00.000Z",
        expiredAfter: "2026-08-25T13:30:00.000Z",
        isPublishable: true,
        isStale: false,
        isExpired: false,
        evaluatedAt: "2026-07-20T13:30:00.000Z",
      },
      {
        assetId: "asset_overview_rabat",
        assetVersionId: "asset_overview_rabat_v1",
        computedAt: "2026-07-20T13:30:00.000Z",
        reviewDueAt: null,
        publishableUntil: "2026-08-20T13:30:00.000Z",
        staleAfter: "2026-07-25T13:30:00.000Z",
        expiredAfter: "2026-08-25T13:30:00.000Z",
        isPublishable: true,
        isStale: false,
        isExpired: false,
        evaluatedAt: "2026-07-20T13:30:00.000Z",
      },
      {
        assetId: "asset_overview_fes",
        assetVersionId: "asset_overview_fes_v1",
        computedAt: "2026-07-20T13:30:00.000Z",
        reviewDueAt: null,
        publishableUntil: "2026-08-20T13:30:00.000Z",
        staleAfter: "2026-07-25T13:30:00.000Z",
        expiredAfter: "2026-08-25T13:30:00.000Z",
        isPublishable: true,
        isStale: false,
        isExpired: false,
        evaluatedAt: "2026-07-20T13:30:00.000Z",
      },
      {
        assetId: "asset_report_london",
        assetVersionId: "asset_report_london_v1",
        computedAt: "2026-07-20T13:30:00.000Z",
        reviewDueAt: null,
        publishableUntil: "2026-08-20T13:30:00.000Z",
        staleAfter: "2026-07-25T13:30:00.000Z",
        expiredAfter: "2026-08-25T13:30:00.000Z",
        isPublishable: true,
        isStale: false,
        isExpired: false,
        evaluatedAt: "2026-07-20T13:30:00.000Z",
      },
    ],
    publicationStates: [
      {
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        locale: "en",
        channel: "web",
        status: "published",
        destinationKey: "site:web:en",
        publicationFingerprint: "pub_fp_paris_web_en",
        publishedAt: "2026-07-20T10:05:00.000Z",
        suppressedAt: null,
        metadata: {},
      },
      {
        assetId: "asset_overview_rabat",
        assetVersionId: "asset_overview_rabat_v1",
        locale: "en",
        channel: "web",
        status: "published",
        destinationKey: "site:web:en:rabat",
        publicationFingerprint: "pub_fp_rabat",
        publishedAt: "2026-07-20T10:05:00.000Z",
        suppressedAt: null,
        metadata: {},
      },
      {
        assetId: "asset_overview_fes",
        assetVersionId: "asset_overview_fes_v1",
        locale: "en",
        channel: "web",
        status: "published",
        destinationKey: "site:web:en:fes",
        publicationFingerprint: "pub_fp_fes",
        publishedAt: "2026-07-20T10:05:00.000Z",
        suppressedAt: null,
        metadata: {},
      },
    ],
    policyVersions: {
      pricing_policy: "policy_v2",
      public_overview_policy: "overview_policy_v1",
    },
    metadata: {
      registry: "test",
    },
  };
}

function buildSnapshot() {
  return normalizeRegistrySnapshot(parseRegistrySnapshot(buildBaseSnapshotInput()));
}

function buildNow() {
  return () => "2026-07-20T15:00:00.000Z";
}

function buildEvent(
  overrides: Record<string, unknown> = {},
): PublicationEventEnvelope {
  return parsePublicationEventEnvelope({
    eventId: "evt_exec_base",
    eventType: "benchmark_updated",
    occurredAt: "2026-07-20T14:30:00.000Z",
    sourceSystem: "intelligence_v2",
    subjectType: "benchmark",
    subjectId: "benchmark:pricing:paris",
    subjectFingerprint: "benchmark_fp_v2",
    policyVersions: {
      pricing_policy: "policy_v2",
    },
    priority: "P1",
    visibility: "internal",
    metadata: {
      benchmarkType: "pricing_distribution",
      changeSummary: "median_changed",
    },
    ...overrides,
  });
}

function expectExecutionEngineError(
  fn: () => unknown,
  code?: string,
): ExecutionEngineError {
  try {
    fn();
  } catch (error) {
    const typed = error as ExecutionEngineError;
    if (code != null) {
      assert.equal(typed.code, code);
    }
    return typed;
  }

  throw new Error("Expected an ExecutionEngineError.");
}

{
  const snapshot = buildSnapshot();
  const event = buildEvent();
  const snapshotBefore = JSON.stringify(snapshot);
  const eventBefore = JSON.stringify(event);

  const plan = buildExecutionPlan({
    event,
    registrySnapshot: snapshot,
    runId: "run_exec_A",
    now: buildNow(),
    estimatedCostByJobType: {
      generate_asset_version: 5,
    },
    metadata: {
      trace: "scenario_a",
    },
  });

  assert.equal(plan.event.eventId, event.eventId);
  assert.equal(plan.registrySnapshotId, snapshot.snapshotId);
  assert.equal(plan.impactPlan.impactLevel, "content_regeneration_required");
  assert.equal(plan.orchestrationRun.runId, "run_exec_A");
  assert.equal(plan.jobs.length, 2);
  assert.deepEqual(
    plan.jobs.map((job) => [job.jobType, job.locale]),
    [
      ["generate_asset_version", "en"],
      ["generate_asset_version", "fr"],
    ],
  );
  assert.equal(plan.executionOrder.length, 2);
  assert.ok(plan.coordinationRequirements.length >= 3);
  assert.equal(plan.estimatedCost, 10);
  assert.equal(plan.governanceSummary.blockedUntilReview, false);
  assert.equal(JSON.stringify(snapshot), snapshotBefore);
  assert.equal(JSON.stringify(event), eventBefore);
  assert.throws(() => {
    (plan.jobs as unknown as unknown[]).push(plan.jobs[0]!);
  });
}

{
  const snapshot = buildSnapshot();
  const event = buildEvent({
    eventId: "evt_exec_B",
    eventType: "public_overview_approved",
    subjectType: "public_overview",
    subjectId: "overview:marrakech",
    subjectFingerprint: "overview_fp_v2",
    priority: "P1",
    visibility: "public",
    metadata: {
      approvalStatus: "internal_approved",
    },
  });

  const plan = buildExecutionPlan({
    event,
    registrySnapshot: snapshot,
    runId: "run_exec_B",
    now: buildNow(),
    estimatedCostByJobType: {
      generate_asset_version: 5,
      publish: 3,
    },
  });

  const publishJobs = plan.jobs.filter((job) => job.jobType === "publish");
  assert.ok(plan.jobs.some((job) => job.jobType === "generate_asset_version"));
  assert.equal(publishJobs.length, 2);
  assert.deepEqual(plan.governanceSummary.publicationJobIds, publishJobs.map((job) => job.jobId).sort());
}

{
  const snapshot = buildSnapshot();
  const event = buildEvent({
    eventId: "evt_exec_B2",
    eventType: "public_overview_approved",
    subjectType: "public_overview",
    subjectId: "overview:marrakech",
    subjectFingerprint: "overview_fp_v2",
    priority: "P1",
    visibility: "public",
    metadata: {
      approvalStatus: "internal_approved",
    },
  });

  const impactPlan = resolveImpact(
    event,
    buildImpactResolutionContextFromRegistry({
      snapshot,
      event,
      now: buildNow(),
    }),
  );
  const seedJobs = expandImpactPlanIntoJobs(
    impactPlan,
    buildJobExpansionContextFromRegistry({
      snapshot,
      impactPlan,
      runId: "run_exec_B2",
      now: buildNow(),
    }),
  );
  const generationJobId = seedJobs.find(
    (job) =>
      job.jobType === "generate_asset_version" &&
      job.assetId === "asset_overview_marrakech" &&
      job.locale === "en",
  )?.jobId;
  assert.ok(generationJobId != null);

  const publishTargetKey = buildJobTargetKey({
    jobType: "publish",
    assetId: "asset_overview_marrakech",
    locale: null,
    channel: "web",
  });

  const plan = buildExecutionPlan({
    event,
    registrySnapshot: snapshot,
    runId: "run_exec_B2",
    now: buildNow(),
    estimatedCostByJobType: {
      generate_asset_version: 5,
      publish: 3,
    },
    dependencyJobIdsByTargetKey: {
      [publishTargetKey]: Object.freeze([generationJobId]),
    },
  });

  const publishJob = plan.jobs.find((job) => job.jobType === "publish" && job.channel === "web");
  assert.ok(publishJob != null);
  assert.ok(publishJob.dependencyJobIds.includes(generationJobId));
  assert.ok(plan.executionOrder.indexOf(generationJobId) < plan.executionOrder.indexOf(publishJob.jobId));
}

{
  const snapshot = buildSnapshot();
  const event = buildEvent({
    eventId: "evt_exec_C",
    eventType: "public_overview_suppressed",
    subjectType: "public_overview",
    subjectId: "overview:rabat",
    subjectFingerprint: "overview_rabat_fp_v2",
    priority: "P2",
    visibility: "public",
    metadata: {
      suppressionReason: "confidence_below_floor",
    },
  });

  const plan = buildExecutionPlan({
    event,
    registrySnapshot: snapshot,
    runId: "run_exec_C",
    now: buildNow(),
    estimatedCostByJobType: {
      suppress: 2,
    },
  });

  assert.equal(plan.impactPlan.priority, "P0");
  assert.ok(plan.jobs.every((job) => job.jobType === "suppress"));
  assert.equal(plan.governanceSummary.requiresImmediateSuppression, true);
  assert.equal(plan.governanceSummary.suppressionJobIds.length, 1);
  assert.deepEqual(plan.executionOrder, plan.jobs.map((job) => job.jobId));
}

{
  const snapshot = buildSnapshot();
  const event = buildEvent({
    eventId: "evt_exec_D",
    eventType: "confidence_changed",
    subjectType: "public_overview",
    subjectId: "overview:marrakech",
    subjectFingerprint: "overview_fp_v3",
    priority: "P1",
    visibility: "public",
    metadata: {
      previousConfidence: "high",
      nextConfidence: "moderate",
    },
  });

  const plan = buildExecutionPlan({
    event,
    registrySnapshot: snapshot,
    runId: "run_exec_D",
    now: buildNow(),
    estimatedCostByJobType: {
      review: 4,
    },
  });

  assert.equal(plan.governanceSummary.requiresHumanReview, true);
  assert.equal(plan.governanceSummary.blockedUntilReview, true);
  assert.equal(plan.governanceSummary.reviewJobIds.length, 1);
  assert.ok(plan.jobs.some((job) => job.jobType === "review"));
}

{
  const snapshot = buildSnapshot();
  const event = buildEvent({
    eventId: "evt_exec_E",
    subjectFingerprint: "benchmark_fp_v1",
  });
  const plan = buildExecutionPlan({
    event,
    registrySnapshot: snapshot,
    runId: "run_exec_E",
    now: buildNow(),
  });

  assert.equal(plan.impactPlan.impactLevel, "no_impact");
  assert.equal(plan.jobs.length, 0);
  assert.deepEqual(plan.executionOrder, []);
  assert.equal(plan.estimatedCost, 0);
  assert.equal(plan.orchestrationRun.status, "queued");
}

{
  const snapshot = buildSnapshot();
  const event = buildEvent();
  const first = buildExecutionPlan({
    event,
    registrySnapshot: snapshot,
    runId: "run_exec_det",
    now: buildNow(),
    estimatedCostByJobType: {
      generate_asset_version: 5,
    },
    metadata: {
      trace: "alpha",
    },
  });
  const second = buildExecutionPlan({
    event: deepClone(event),
    registrySnapshot: deepClone(snapshot),
    runId: "run_exec_det",
    now: buildNow(),
    estimatedCostByJobType: {
      generate_asset_version: 5,
    },
    metadata: {
      trace: "beta",
    },
  });

  assert.equal(first.executionPlanId, second.executionPlanId);
}

{
  const reordered = deepClone(buildBaseSnapshotInput());
  reordered.assets.reverse();
  reordered.assetVersions.reverse();
  reordered.artifactReferences.reverse();
  reordered.channelVariants.reverse();
  reordered.freshnessStates.reverse();
  reordered.publicationStates.reverse();

  const base = buildExecutionPlan({
    event: buildEvent(),
    registrySnapshot: buildBaseSnapshotInput(),
    runId: "run_exec_same_logic",
    now: buildNow(),
  });
  const reorderedPlan = buildExecutionPlan({
    event: buildEvent(),
    registrySnapshot: reordered,
    runId: "run_exec_same_logic",
    now: buildNow(),
  });

  assert.equal(base.executionPlanId, reorderedPlan.executionPlanId);
}

{
  const snapshot = buildBaseSnapshotInput();
  snapshot.assets[0].metadata.market = "paris-updated";
  const basePlan = buildExecutionPlan({
    event: buildEvent(),
    registrySnapshot: buildBaseSnapshotInput(),
    runId: "run_exec_fingerprint_a",
    now: buildNow(),
  });
  const changedPlan = buildExecutionPlan({
    event: buildEvent(),
    registrySnapshot: snapshot,
    runId: "run_exec_fingerprint_a",
    now: buildNow(),
  });
  assert.notEqual(basePlan.executionPlanId, changedPlan.executionPlanId);
}

{
  const snapshot = buildSnapshot();
  const event = buildEvent();
  const planA = buildExecutionPlan({
    event,
    registrySnapshot: snapshot,
    runId: "run_exec_jobs_a",
    now: buildNow(),
  });
  const planB = buildExecutionPlan({
    event,
    registrySnapshot: snapshot,
    runId: "run_exec_jobs_b",
    now: buildNow(),
  });
  assert.notEqual(planA.executionPlanId, planB.executionPlanId);
}

{
  const snapshot = buildSnapshot();
  const event = buildEvent();
  const impactPlan = resolveImpact(
    event,
    buildImpactResolutionContextFromRegistry({
      snapshot,
      event,
      now: buildNow(),
    }),
  );
  const context = buildJobExpansionContextFromRegistry({
    snapshot,
    impactPlan,
    runId: "run_exec_dup",
    now: buildNow(),
  });
  const jobs = expandImpactPlanIntoJobs(impactPlan, context);
  const duplicated = normalizeExecutionJobs([...jobs, ...jobs]);
  assert.equal(duplicated.length, jobs.length);
}

{
  const job = createJob({
    jobId: "ipp_job_conflict",
    runId: "run_conflict",
    action: "publish",
    jobType: "publish",
    priority: "P1",
    now: "2026-07-20T15:00:00.000Z",
    assetId: "asset_overview_marrakech",
    channel: "web",
  });
  const conflicting = {
    ...job,
    channel: "api",
  };
  expectExecutionEngineError(
    () => normalizeExecutionJobs([job, conflicting]),
    "duplicate_job_conflict",
  );
}

{
  const job = createJob({
    jobId: "ipp_job_orphan",
    runId: "run_orphan",
    action: "publish",
    jobType: "publish",
    priority: "P1",
    now: "2026-07-20T15:00:00.000Z",
    dependencyJobIds: Object.freeze(["missing_job"]),
  });
  expectExecutionEngineError(
    () => normalizeExecutionJobs([job]),
    "orphan_job_dependency",
  );
}

{
  const first = createJob({
    jobId: "ipp_job_cycle_a",
    runId: "run_cycle",
    action: "publish",
    jobType: "publish",
    priority: "P1",
    now: "2026-07-20T15:00:00.000Z",
    dependencyJobIds: Object.freeze(["ipp_job_cycle_b"]),
  });
  const second = createJob({
    jobId: "ipp_job_cycle_b",
    runId: "run_cycle",
    action: "generate_asset_version",
    jobType: "generate_asset_version",
    priority: "P1",
    now: "2026-07-20T15:00:00.000Z",
    dependencyJobIds: Object.freeze(["ipp_job_cycle_a"]),
  });
  expectExecutionEngineError(
    () => normalizeExecutionJobs([first, second]),
    "cyclic_job_graph",
  );
}

{
  const plan = buildExecutionPlan({
    event: buildEvent(),
    registrySnapshot: buildSnapshot(),
    runId: "run_exec_parse",
    now: buildNow(),
  });
  const invalid = {
    ...plan,
    executionOrder: Object.freeze([]),
  };
  const result = validateExecutionPlan(invalid);
  assert.equal(result.ok, false);
}

{
  const plan = buildExecutionPlan({
    event: buildEvent(),
    registrySnapshot: buildSnapshot(),
    runId: "run_exec_parse_ok",
    now: buildNow(),
  });
  const parsed = parseExecutionPlan(plan);
  assert.equal(parsed.executionPlanId, plan.executionPlanId);
}

{
  const snapshot = buildSnapshot();
  const event = buildEvent();
  const eventKey = buildPublicationEventIdempotencyKey(event);
  const context = buildImpactResolutionContextFromRegistry({
    snapshot,
    event,
    now: buildNow(),
  });
  const impactPlan = resolveImpact(event, context);
  const jobs = expandImpactPlanIntoJobs(
    impactPlan,
    buildJobExpansionContextFromRegistry({
      snapshot,
      impactPlan,
      runId: "run_manual_plan",
      now: buildNow(),
    }),
  );
  const normalizedJobs = normalizeExecutionJobs(jobs);
  const order = buildExecutionOrder(normalizedJobs);
  const requirements = buildExecutionPlanCoordinationRequirements({
    eventIdempotencyKey: eventKey,
    orchestrationRun: buildExecutionPlan({
      event,
      registrySnapshot: snapshot,
      runId: "run_manual_plan",
      now: buildNow(),
    }).orchestrationRun,
    jobs: normalizedJobs,
  });
  const summary = buildExecutionGovernanceSummary(impactPlan, normalizedJobs);
  const expectedCost = calculateExecutionPlanEstimatedCost(normalizedJobs);
  const planId = buildExecutionPlanId({
    eventIdempotencyKey: eventKey,
    registrySnapshotFingerprint: buildRegistrySnapshotFingerprint(snapshot),
    impactPlanId: impactPlan.planId,
    runId: "run_manual_plan",
    jobIds: normalizedJobs.map((job) => job.jobId),
    executionPlanVersion: 1,
  });

  assert.ok(order.length >= 0);
  assert.ok(requirements.length >= 1);
  assert.equal(expectedCost, normalizedJobs.reduce((sum, job) => sum + job.estimatedCost, 0));
  assert.ok(summary.reasons.length >= 1);
  assert.ok(planId.startsWith("ipp_exec_"));
}

console.log("PASS — Intelligence Publishing execution engine smoke");

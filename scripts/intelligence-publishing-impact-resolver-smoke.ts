import assert from "node:assert/strict";

import {
  parsePublicationEventEnvelope,
  type PublicationEventEnvelope,
} from "../lib/intelligencePublishing/eventContracts";
import {
  buildImpactPlanId,
  resolveImpact,
  type ImpactPlan,
  type ImpactResolutionContext,
} from "../lib/intelligencePublishing/impactResolver";

function buildEvent(
  overrides: Record<string, unknown> = {},
): PublicationEventEnvelope {
  return parsePublicationEventEnvelope({
    eventId: "evt_base",
    eventType: "benchmark_updated",
    occurredAt: "2026-07-20T10:00:00.000Z",
    sourceSystem: "intelligence_v2",
    subjectType: "benchmark",
    subjectId: "benchmark:pricing:paris",
    subjectFingerprint: "fp_v2",
    policyVersions: {
      benchmarkArtifactContractVersion: "v1",
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

function buildContext(
  overrides: Partial<ImpactResolutionContext> = {},
): ImpactResolutionContext {
  return Object.freeze({
    assets: Object.freeze([
      Object.freeze({
        assetId: "asset_report_paris",
        assetType: "market_report",
        templateId: "market_report_v1",
        visibility: "public" as const,
        confidenceAffectsVisibleContent: false,
        policyChangeAffectsVisibleContent: true,
        freshnessExpiryBehavior: "keep_visible" as const,
      }),
    ]),
    assetVersions: Object.freeze([
      Object.freeze({
        assetVersionId: "asset_version_report_paris_v1",
        assetId: "asset_report_paris",
      }),
    ]),
    artifactReferences: Object.freeze([
      Object.freeze({
        assetId: "asset_report_paris",
        assetVersionId: "asset_version_report_paris_v1",
        referenceType: "source_subject" as const,
        subjectType: "benchmark" as const,
        subjectId: "benchmark:pricing:paris",
      }),
      Object.freeze({
        assetId: "asset_report_paris",
        assetVersionId: "asset_version_report_paris_v1",
        referenceType: "policy" as const,
        subjectType: "policy",
        subjectId: "policy:public_market_overview_governance",
      }),
    ]),
    activeVersions: Object.freeze({
      asset_report_paris: "asset_version_report_paris_v1",
    }),
    availableLocales: Object.freeze({
      asset_report_paris: Object.freeze(["en", "fr"]),
    }),
    availableChannels: Object.freeze({
      asset_report_paris: Object.freeze(["web"]),
    }),
    currentPolicyVersions: Object.freeze({
      "policy:public_market_overview_governance": "pmo_v1",
    }),
    currentFingerprints: Object.freeze({
      "benchmark:benchmark:pricing:paris": "fp_v1",
      "public_overview:overview:paris": "overview_fp_v1",
    }),
    currentApprovalStates: Object.freeze({
      "benchmark:benchmark:pricing:paris_v3": false,
    }),
    now: () => "2026-07-20T11:00:00.000Z",
    ...overrides,
  });
}

function snapshotContext(context: ImpactResolutionContext): string {
  return JSON.stringify({
    assets: context.assets,
    assetVersions: context.assetVersions,
    artifactReferences: context.artifactReferences,
    activeVersions: context.activeVersions,
    availableLocales: context.availableLocales,
    availableChannels: context.availableChannels,
    currentPolicyVersions: context.currentPolicyVersions,
    currentFingerprints: context.currentFingerprints,
    currentApprovalStates: context.currentApprovalStates ?? null,
  });
}

function snapshotEvent(event: PublicationEventEnvelope): string {
  return JSON.stringify(event);
}

function expectAction(plan: ImpactPlan, action: string) {
  assert.ok(
    plan.requiredActions.includes(action as never),
    `Expected required action ${action}`,
  );
}

{
  const event = buildEvent({
    subjectId: "benchmark:pricing:london",
  });
  const plan = resolveImpact(event, buildContext());
  assert.equal(plan.impactLevel, "no_impact");
  assert.deepEqual(plan.requiredActions, ["skip"]);
  assert.equal(plan.reasons[0]?.code, "no_lineage_match");
}

{
  const event = buildEvent({
    subjectFingerprint: "fp_v1",
  });
  const plan = resolveImpact(event, buildContext());
  assert.equal(plan.impactLevel, "no_impact");
  assert.equal(plan.reasons[0]?.code, "unchanged_fingerprint");
}

{
  const event = buildEvent({
    eventId: "evt_created",
    eventType: "benchmark_created",
    metadata: {
      benchmarkType: "pricing_distribution",
    },
    subjectFingerprint: "fp_v3",
  });
  const plan = resolveImpact(event, buildContext());
  assert.equal(plan.impactLevel, "content_regeneration_required");
  expectAction(plan, "generate_asset_version");
  assert.ok(plan.skippedActions.includes("publish"));
}

{
  const event = buildEvent({
    eventId: "evt_updated",
    subjectFingerprint: "fp_v4",
  });
  const plan = resolveImpact(event, buildContext());
  assert.equal(plan.impactLevel, "content_regeneration_required");
  assert.equal(plan.visibleDelta, "minor");
  expectAction(plan, "generate_asset_version");
}

{
  const event = buildEvent({
    eventId: "evt_suppressed",
    eventType: "public_overview_suppressed",
    subjectType: "public_overview",
    subjectId: "overview:paris",
    subjectFingerprint: "overview_fp_v2",
    priority: "P2",
    metadata: {
      suppressionReason: "confidence_below_floor",
    },
  });
  const context = buildContext({
    artifactReferences: Object.freeze([
      Object.freeze({
        assetId: "asset_report_paris",
        assetVersionId: "asset_version_report_paris_v1",
        referenceType: "source_subject" as const,
        subjectType: "public_overview" as const,
        subjectId: "overview:paris",
      }),
    ]),
  });
  const plan = resolveImpact(event, context);
  assert.equal(plan.impactLevel, "immediate_suppression_required");
  assert.equal(plan.priority, "P0");
  assert.equal(plan.governanceRequirement, "immediate_suppression");
  expectAction(plan, "suppress");
}

{
  const event = buildEvent({
    eventId: "evt_conf_down",
    eventType: "confidence_changed",
    subjectType: "asset_version",
    subjectId: "asset_version_report_paris_v1",
    metadata: {
      previousConfidence: "high",
      nextConfidence: "moderate",
    },
  });
  const plan = resolveImpact(event, buildContext());
  assert.equal(plan.impactLevel, "human_review_required");
  assert.equal(plan.visibleDelta, "moderate");
  expectAction(plan, "request_review");
}

{
  const event = buildEvent({
    eventId: "evt_fresh_keep",
    eventType: "freshness_expired",
    subjectFingerprint: "fresh_v2",
    metadata: {
      expiredAt: "2026-07-20T09:00:00.000Z",
    },
  });
  const plan = resolveImpact(event, buildContext());
  assert.equal(plan.impactLevel, "freshness_only");
  expectAction(plan, "update_freshness");
}

{
  const event = buildEvent({
    eventId: "evt_fresh_suppress",
    eventType: "freshness_expired",
    subjectFingerprint: "fresh_v2",
    metadata: {
      expiredAt: "2026-07-20T09:00:00.000Z",
    },
  });
  const context = buildContext({
    assets: Object.freeze([
      Object.freeze({
        assetId: "asset_report_paris",
        assetType: "market_report",
        templateId: "market_report_v1",
        visibility: "public" as const,
        freshnessExpiryBehavior: "suppress" as const,
      }),
    ]),
  });
  const plan = resolveImpact(event, context);
  assert.equal(plan.impactLevel, "immediate_suppression_required");
  expectAction(plan, "suppress");
}

{
  const event = buildEvent({
    eventId: "evt_manual",
    eventType: "manual_republish_requested",
    subjectType: "asset",
    subjectId: "asset_report_paris",
    subjectFingerprint: "manual_request_v1",
    requestId: "req_manual_001",
    metadata: {
      reason: "editorial_fix",
      requestedBy: "ops@norixo.io",
    },
  });
  const plan = resolveImpact(event, buildContext());
  assert.equal(plan.impactLevel, "full_republish_required");
  expectAction(plan, "republish");
}

{
  const event = buildEvent({
    eventId: "evt_plan_stable",
    subjectFingerprint: "fp_v5",
  });
  const context = buildContext();
  const planA = resolveImpact(event, context);
  const planB = resolveImpact(event, context);
  assert.equal(planA.planId, planB.planId);
}

{
  const event = buildEvent({
    eventId: "evt_plan_order",
    subjectFingerprint: "fp_v6",
  });
  const orderedContext = buildContext({
    assets: Object.freeze([
      Object.freeze({
        assetId: "asset_a",
        assetType: "market_report",
        visibility: "public" as const,
      }),
      Object.freeze({
        assetId: "asset_b",
        assetType: "ranking",
        visibility: "public" as const,
      }),
    ]),
    assetVersions: Object.freeze([
      Object.freeze({ assetVersionId: "version_a", assetId: "asset_a" }),
      Object.freeze({ assetVersionId: "version_b", assetId: "asset_b" }),
    ]),
    artifactReferences: Object.freeze([
      Object.freeze({
        assetId: "asset_a",
        referenceType: "source_subject" as const,
        subjectType: "benchmark" as const,
        subjectId: "benchmark:pricing:paris",
      }),
      Object.freeze({
        assetId: "asset_b",
        referenceType: "source_subject" as const,
        subjectType: "benchmark" as const,
        subjectId: "benchmark:pricing:paris",
      }),
    ]),
    activeVersions: Object.freeze({
      asset_a: "version_a",
      asset_b: "version_b",
    }),
    availableLocales: Object.freeze({
      asset_a: Object.freeze(["en"]),
      asset_b: Object.freeze(["fr"]),
    }),
    availableChannels: Object.freeze({
      asset_a: Object.freeze(["web"]),
      asset_b: Object.freeze(["web"]),
    }),
  });
  const reversedContext = buildContext({
    assets: Object.freeze([...orderedContext.assets].reverse()),
    assetVersions: Object.freeze([...orderedContext.assetVersions].reverse()),
    artifactReferences: Object.freeze([...orderedContext.artifactReferences].reverse()),
    activeVersions: orderedContext.activeVersions,
    availableLocales: orderedContext.availableLocales,
    availableChannels: orderedContext.availableChannels,
    currentPolicyVersions: orderedContext.currentPolicyVersions,
    currentFingerprints: orderedContext.currentFingerprints,
    currentApprovalStates: orderedContext.currentApprovalStates,
    now: orderedContext.now,
  });
  const planA = resolveImpact(event, orderedContext);
  const planB = resolveImpact(event, reversedContext);
  assert.equal(planA.planId, planB.planId);
}

{
  const event = buildEvent({
    eventId: "evt_immutability",
    subjectFingerprint: "fp_v7",
  });
  const context = buildContext();
  const eventBefore = snapshotEvent(event);
  const contextBefore = snapshotContext(context);
  resolveImpact(event, context);
  assert.equal(snapshotEvent(event), eventBefore);
  assert.equal(snapshotContext(context), contextBefore);
}

{
  const event = buildEvent({
    eventId: "evt_build_plan_id",
    subjectFingerprint: "fp_v8",
  });
  const planIdA = buildImpactPlanId({
    event,
    impactedAssetIds: ["asset_b", "asset_a"],
    actions: ["republish", "generate_asset_version"],
    contextFingerprint: "ctx_fp",
  });
  const planIdB = buildImpactPlanId({
    event,
    impactedAssetIds: ["asset_a", "asset_b"],
    actions: ["generate_asset_version", "republish"],
    contextFingerprint: "ctx_fp",
  });
  assert.equal(planIdA, planIdB);
}

console.log("PASS — Intelligence Publishing impact resolver smoke");

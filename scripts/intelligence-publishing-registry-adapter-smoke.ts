import assert from "node:assert/strict";

import { parsePublicationEventEnvelope } from "../lib/intelligencePublishing/eventContracts";
import { resolveImpact } from "../lib/intelligencePublishing/impactResolver";
import { expandImpactActionIntoJobs } from "../lib/intelligencePublishing/jobModel";
import {
  RegistryAdapterError,
  assertRegistrySnapshotPublicSafe,
  buildImpactResolutionContextFromRegistry,
  buildJobExpansionContextFromRegistry,
  buildRegistrySnapshotFingerprint,
  findRegistryAssetsByArtifact,
  getActiveRegistryVersion,
  getRegistryArtifactLineage,
  getRegistryAsset,
  getRegistryFreshnessState,
  getRegistryAssetVersion,
  hasPublishedRegistryVariant,
  isRegistryAssetPublishable,
  isRegistryVersionApproved,
  listRegistryPublicationsForAsset,
  listRegistryVariantsForAsset,
  listRegistryVersionsForAsset,
  normalizeRegistrySnapshot,
  parseRegistrySnapshot,
} from "../lib/intelligencePublishing/registryAdapter";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectRegistryAdapterError(
  fn: () => unknown,
): RegistryAdapterError {
  try {
    fn();
  } catch (error) {
    return error as RegistryAdapterError;
  }

  throw new Error("Expected a RegistryAdapterError.");
}

function buildSnapshotInput() {
  return {
    snapshotId: "registry_snapshot_001",
    snapshotVersion: 1,
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
        availableChannels: ["api", "web"],
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
        assetId: "asset_guide_lyon",
        canonicalId: "guide-lyon",
        assetType: "guide",
        status: "approved",
        visibility: "public",
        defaultLocale: "en",
        availableLocales: ["en"],
        availableChannels: ["web"],
        activeVersionId: "asset_guide_lyon_v1",
        templateId: "tpl_guide",
        ownerTeam: "editorial",
        confidenceAffectsVisibleContent: false,
        policyChangeAffectsVisibleContent: false,
        freshnessExpiryBehavior: "suppress",
        createdAt: "2026-07-05T09:00:00.000Z",
        updatedAt: "2026-07-20T13:00:00.000Z",
        metadata: {
          market: "lyon",
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
        metadata: {
          summary: "active paris report",
        },
      },
      {
        assetVersionId: "asset_report_paris_v1",
        assetId: "asset_report_paris",
        versionNumber: 1,
        status: "superseded",
        contentFingerprint: "content_fp_paris_v1",
        sourceFingerprint: "source_fp_paris_v1",
        templateFingerprint: "template_fp_market_report_v1",
        rendererFingerprint: "renderer_fp_web_v1",
        policyVersions: {
          pricing_policy: "policy_v1",
        },
        confidenceBand: "moderate",
        createdAt: "2026-07-10T09:00:00.000Z",
        approvedAt: "2026-07-11T09:00:00.000Z",
        publishedAt: "2026-07-12T09:00:00.000Z",
        supersededAt: "2026-07-20T10:00:00.000Z",
        metadata: {
          summary: "old paris report",
        },
      },
      {
        assetVersionId: "asset_guide_lyon_v1",
        assetId: "asset_guide_lyon",
        versionNumber: 1,
        status: "approved",
        contentFingerprint: "content_fp_lyon_v1",
        sourceFingerprint: "source_fp_lyon_v1",
        templateFingerprint: "template_fp_guide_v1",
        rendererFingerprint: "renderer_fp_text_v1",
        policyVersions: {
          editorial_policy: "policy_editorial_v1",
        },
        confidenceBand: "moderate",
        createdAt: "2026-07-15T09:00:00.000Z",
        approvedAt: "2026-07-16T09:00:00.000Z",
        publishedAt: null,
        supersededAt: null,
        metadata: {
          summary: "lyon guide approved",
        },
      },
    ],
    artifactReferences: [
      {
        referenceId: "ref_paris_overview",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        artifactType: "public_overview",
        artifactId: "overview:paris",
        artifactFingerprint: "overview_fp_v2",
        relationshipType: "supported_by",
        policyVersions: {
          public_overview_policy: "overview_policy_v2",
        },
        createdAt: "2026-07-20T09:30:00.000Z",
        metadata: {
          sourceApproved: true,
          approvalState: "internal_approved",
        },
      },
      {
        referenceId: "ref_paris_benchmark_v2",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        artifactType: "benchmark",
        artifactId: "benchmark:paris:pricing:v2",
        artifactFingerprint: "benchmark_fp_v2",
        relationshipType: "supported_by",
        policyVersions: {
          pricing_policy: "policy_v2",
        },
        createdAt: "2026-07-20T09:35:00.000Z",
        metadata: {
          sourceApproved: false,
          approvalState: "pending_review",
        },
      },
      {
        referenceId: "ref_paris_benchmark_v1",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v1",
        artifactType: "benchmark",
        artifactId: "benchmark:paris:pricing:v1",
        artifactFingerprint: "benchmark_fp_v1",
        relationshipType: "supersedes",
        policyVersions: {
          pricing_policy: "policy_v1",
        },
        createdAt: "2026-07-12T09:00:00.000Z",
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
        referenceId: "ref_lyon_policy",
        assetId: "asset_guide_lyon",
        assetVersionId: "asset_guide_lyon_v1",
        artifactType: "policy",
        artifactId: "editorial_policy",
        artifactFingerprint: "policy_fp_editorial_v1",
        relationshipType: "governed_by",
        policyVersions: {
          editorial_policy: "policy_editorial_v1",
        },
        createdAt: "2026-07-16T09:10:00.000Z",
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
        variantId: "variant_paris_en_api_v2",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        locale: "en",
        channel: "api",
        status: "published",
        contentFingerprint: "variant_fp_paris_en_api_v2",
        destinationKey: "api:market:en",
        publishedAt: "2026-07-20T10:06:00.000Z",
        updatedAt: "2026-07-20T10:06:00.000Z",
        metadata: {},
      },
      {
        variantId: "variant_paris_fr_web_v2",
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        locale: "fr",
        channel: "web",
        status: "approved",
        contentFingerprint: "variant_fp_paris_fr_web_v2",
        destinationKey: "site:web:fr",
        publishedAt: null,
        updatedAt: "2026-07-20T10:07:00.000Z",
        metadata: {},
      },
      {
        variantId: "variant_lyon_en_web_v1",
        assetId: "asset_guide_lyon",
        assetVersionId: "asset_guide_lyon_v1",
        locale: "en",
        channel: "web",
        status: "generated",
        contentFingerprint: "variant_fp_lyon_en_web_v1",
        destinationKey: "site:web:en",
        publishedAt: null,
        updatedAt: "2026-07-16T09:20:00.000Z",
        metadata: {},
      },
    ],
    freshnessStates: [
      {
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        computedAt: "2026-07-20T10:10:00.000Z",
        reviewDueAt: "2026-07-27T10:10:00.000Z",
        publishableUntil: "2026-08-20T10:10:00.000Z",
        staleAfter: "2026-07-30T10:10:00.000Z",
        expiredAfter: "2026-08-30T10:10:00.000Z",
        isPublishable: true,
        isStale: false,
        isExpired: false,
        evaluatedAt: "2026-07-20T10:10:00.000Z",
      },
      {
        assetId: "asset_guide_lyon",
        assetVersionId: "asset_guide_lyon_v1",
        computedAt: "2026-07-20T10:15:00.000Z",
        reviewDueAt: "2026-07-25T10:15:00.000Z",
        publishableUntil: null,
        staleAfter: "2026-07-24T10:15:00.000Z",
        expiredAfter: "2026-07-28T10:15:00.000Z",
        isPublishable: false,
        isStale: true,
        isExpired: false,
        evaluatedAt: "2026-07-20T10:15:00.000Z",
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
        publicationFingerprint: "publication_fp_paris_en_web_v2",
        publishedAt: "2026-07-20T10:05:00.000Z",
        suppressedAt: null,
        metadata: {},
      },
      {
        assetId: "asset_report_paris",
        assetVersionId: "asset_report_paris_v2",
        locale: "en",
        channel: "api",
        status: "published",
        destinationKey: "api:market:en",
        publicationFingerprint: "publication_fp_paris_en_api_v2",
        publishedAt: "2026-07-20T10:06:00.000Z",
        suppressedAt: null,
        metadata: {},
      },
      {
        assetId: "asset_guide_lyon",
        assetVersionId: "asset_guide_lyon_v1",
        locale: "en",
        channel: "web",
        status: "unpublished",
        destinationKey: "site:web:en",
        publicationFingerprint: null,
        publishedAt: null,
        suppressedAt: null,
        metadata: {},
      },
    ],
    policyVersions: {
      editorial_policy: "policy_editorial_v1",
      pricing_policy: "policy_v2",
      public_overview_policy: "overview_policy_v2",
    },
    metadata: {
      source: "registry_smoke",
    },
  };
}

const parsedSnapshot = parseRegistrySnapshot(buildSnapshotInput());

{
  assert.equal(parsedSnapshot.assets.length, 2);
}

{
  const normalized = normalizeRegistrySnapshot(parsedSnapshot);
  assert.deepEqual(
    normalized.assets.map((asset) => asset.assetId),
    ["asset_guide_lyon", "asset_report_paris"],
  );
  assert.deepEqual(
    normalized.assetVersions.map((version) => version.assetVersionId),
    [
      "asset_guide_lyon_v1",
      "asset_report_paris_v1",
      "asset_report_paris_v2",
    ],
  );
}

{
  const shuffled = deepClone(buildSnapshotInput());
  shuffled.assets.reverse();
  shuffled.assetVersions.reverse();
  shuffled.artifactReferences.reverse();
  shuffled.channelVariants.reverse();
  shuffled.freshnessStates.reverse();
  shuffled.publicationStates.reverse();

  const normalizedA = normalizeRegistrySnapshot(parsedSnapshot);
  const normalizedB = normalizeRegistrySnapshot(parseRegistrySnapshot(shuffled));
  assert.deepEqual(normalizedA, normalizedB);
}

{
  const fingerprintA = buildRegistrySnapshotFingerprint(parsedSnapshot);
  const shuffled = deepClone(buildSnapshotInput());
  shuffled.assets.reverse();
  shuffled.assetVersions.reverse();
  shuffled.artifactReferences.reverse();
  shuffled.channelVariants.reverse();
  shuffled.freshnessStates.reverse();
  shuffled.publicationStates.reverse();
  const fingerprintB = buildRegistrySnapshotFingerprint(
    parseRegistrySnapshot(shuffled),
  );
  assert.equal(fingerprintA, fingerprintB);
}

{
  const changed = deepClone(buildSnapshotInput());
  changed.assets[0].activeVersionId = "asset_report_paris_v1";
  assert.notEqual(
    buildRegistrySnapshotFingerprint(parsedSnapshot),
    buildRegistrySnapshotFingerprint(parseRegistrySnapshot(changed)),
  );
}

{
  const changed = deepClone(buildSnapshotInput());
  changed.artifactReferences[0].artifactFingerprint = "overview_fp_v3";
  assert.notEqual(
    buildRegistrySnapshotFingerprint(parsedSnapshot),
    buildRegistrySnapshotFingerprint(parseRegistrySnapshot(changed)),
  );
}

{
  const changed = deepClone(buildSnapshotInput());
  changed.freshnessStates[0].isPublishable = false;
  assert.notEqual(
    buildRegistrySnapshotFingerprint(parsedSnapshot),
    buildRegistrySnapshotFingerprint(parseRegistrySnapshot(changed)),
  );
}

{
  const invalid = deepClone(buildSnapshotInput());
  invalid.assetVersions[0].assetId = "missing_asset";
  const error = expectRegistryAdapterError(() => parseRegistrySnapshot(invalid));
  assert.equal(error.code, "invalid_snapshot");
}

{
  const invalid = deepClone(buildSnapshotInput());
  invalid.assets[0].activeVersionId = "asset_guide_lyon_v1";
  const error = expectRegistryAdapterError(() => parseRegistrySnapshot(invalid));
  assert.equal(error.code, "invalid_snapshot");
}

{
  const invalid = deepClone(buildSnapshotInput());
  invalid.channelVariants[0].assetVersionId = "asset_guide_lyon_v1";
  const error = expectRegistryAdapterError(() => parseRegistrySnapshot(invalid));
  assert.equal(error.code, "invalid_snapshot");
}

{
  const invalid = deepClone(buildSnapshotInput());
  invalid.publicationStates[0].assetVersionId = "asset_guide_lyon_v1";
  const error = expectRegistryAdapterError(() => parseRegistrySnapshot(invalid));
  assert.equal(error.code, "invalid_snapshot");
}

{
  const invalid = deepClone(buildSnapshotInput());
  invalid.assets.push(deepClone(invalid.assets[0]));
  const error = expectRegistryAdapterError(() => parseRegistrySnapshot(invalid));
  assert.equal(error.code, "invalid_snapshot");
}

{
  const invalid = deepClone(buildSnapshotInput());
  (invalid.assets[0].metadata as Record<string, unknown>).customerEmail =
    "secret@example.com";
  const error = expectRegistryAdapterError(() => parseRegistrySnapshot(invalid));
  assert.equal(error.code, "invalid_snapshot");
}

{
  const before = JSON.stringify(buildSnapshotInput());
  normalizeRegistrySnapshot(parsedSnapshot);
  buildRegistrySnapshotFingerprint(parsedSnapshot);
  assert.equal(JSON.stringify(buildSnapshotInput()), before);
}

{
  assert.equal(getRegistryAsset(parsedSnapshot, "asset_report_paris")?.assetType, "market_report");
  assert.equal(
    getRegistryAssetVersion(parsedSnapshot, "asset_report_paris_v2")?.versionNumber,
    2,
  );
  assert.equal(
    getActiveRegistryVersion(parsedSnapshot, "asset_report_paris")?.assetVersionId,
    "asset_report_paris_v2",
  );
  assert.equal(
    findRegistryAssetsByArtifact(parsedSnapshot, "public_overview", "overview:paris").length,
    1,
  );
  assert.equal(listRegistryVersionsForAsset(parsedSnapshot, "asset_report_paris").length, 2);
  assert.equal(getRegistryArtifactLineage(parsedSnapshot, "asset_report_paris").length, 4);
  assert.equal(listRegistryVariantsForAsset(parsedSnapshot, "asset_report_paris").length, 3);
  assert.equal(listRegistryPublicationsForAsset(parsedSnapshot, "asset_report_paris").length, 2);
  assert.equal(
    getRegistryFreshnessState(parsedSnapshot, "asset_report_paris", "asset_report_paris_v2")
      ?.isPublishable,
    true,
  );
  assert.equal(isRegistryAssetPublishable(parsedSnapshot, "asset_report_paris"), true);
  assert.equal(isRegistryVersionApproved(parsedSnapshot, "asset_report_paris_v2"), true);
  assert.equal(
    hasPublishedRegistryVariant(parsedSnapshot, {
      assetId: "asset_report_paris",
      assetVersionId: "asset_report_paris_v2",
      locale: "en",
      channel: "web",
    }),
    true,
  );
}

const overviewEvent = parsePublicationEventEnvelope({
  eventId: "evt_registry_overview_001",
  eventType: "public_overview_approved",
  occurredAt: "2026-07-20T14:05:00.000Z",
  sourceSystem: "registry_smoke",
  subjectType: "public_overview",
  subjectId: "overview:paris",
  subjectFingerprint: "overview_fp_v3",
  policyVersions: {
    public_overview_policy: "overview_policy_v2",
  },
  priority: "P1",
  visibility: "public",
  metadata: {
    approvalStatus: "internal_approved",
  },
});

const overviewContext = buildImpactResolutionContextFromRegistry({
  snapshot: parsedSnapshot,
  event: overviewEvent,
  now: () => "2026-07-20T14:06:00.000Z",
});

{
  assert.deepEqual(
    overviewContext.assets.map((asset) => asset.assetId),
    ["asset_report_paris"],
  );
  assert.equal(
    overviewContext.currentFingerprints["public_overview:overview:paris"],
    "overview_fp_v2",
  );
  assert.deepEqual(overviewContext.availableLocales.asset_report_paris, ["en", "fr"]);
  assert.deepEqual(overviewContext.availableChannels.asset_report_paris, ["api", "web"]);
  assert.equal(overviewContext.currentApprovalStates?.["benchmark:benchmark:paris:pricing:v2"], false);
}

const overviewPlan = resolveImpact(overviewEvent, overviewContext);

{
  assert.equal(overviewPlan.impactLevel, "content_regeneration_required");
  assert.deepEqual(overviewPlan.impactedAssets, ["asset_report_paris"]);
  assert.deepEqual(overviewPlan.requiredActions, ["generate_asset_version", "republish"]);
}

const supersededEvent = parsePublicationEventEnvelope({
  eventId: "evt_registry_benchmark_superseded_001",
  eventType: "benchmark_superseded",
  occurredAt: "2026-07-20T14:10:00.000Z",
  sourceSystem: "registry_smoke",
  subjectType: "benchmark",
  subjectId: "benchmark:paris:pricing:v1",
  subjectFingerprint: "benchmark_fp_v1_next",
  policyVersions: {
    pricing_policy: "policy_v2",
  },
  priority: "P1",
  visibility: "public",
  metadata: {
    benchmarkType: "pricing",
    supersededBySubjectId: "benchmark:paris:pricing:v2",
  },
});

const supersededContext = buildImpactResolutionContextFromRegistry({
  snapshot: parsedSnapshot,
  event: supersededEvent,
  now: () => "2026-07-20T14:11:00.000Z",
});

const supersededPlan = resolveImpact(supersededEvent, supersededContext);

{
  assert.equal(
    supersededContext.currentApprovalStates?.["benchmark:benchmark:paris:pricing:v2"],
    false,
  );
  assert.ok(supersededPlan.requiredActions.includes("request_review"));
  assert.equal(supersededPlan.governanceRequirement, "human_review");
}

const jobContext = buildJobExpansionContextFromRegistry({
  snapshot: parsedSnapshot,
  impactPlan: overviewPlan,
  runId: "run_registry_001",
  now: () => "2026-07-20T14:12:00.000Z",
  maxAttemptsByJobType: {
    generate_asset_version: 4,
  },
  metadataByJobType: {
    generate_asset_version: {
      source: "registry_smoke",
    },
  },
});

{
  assert.ok(jobContext.localesByAssetId != null);
  assert.ok(jobContext.channelsByAssetId != null);
  assert.ok(jobContext.activeAssetVersionIdsByAssetId != null);
  assert.deepEqual(Object.keys(jobContext.localesByAssetId), ["asset_report_paris"]);
  assert.deepEqual(jobContext.localesByAssetId.asset_report_paris, ["en", "fr"]);
  assert.deepEqual(jobContext.channelsByAssetId.asset_report_paris, ["api", "web"]);
  assert.equal(
    jobContext.activeAssetVersionIdsByAssetId.asset_report_paris,
    "asset_report_paris_v2",
  );
}

{
  const now = () => "2026-07-20T14:12:00.000Z";
  const left = buildJobExpansionContextFromRegistry({
    snapshot: parsedSnapshot,
    impactPlan: overviewPlan,
    runId: "run_registry_001",
    now,
  });
  const right = buildJobExpansionContextFromRegistry({
    snapshot: parsedSnapshot,
    impactPlan: overviewPlan,
    runId: "run_registry_001",
    now,
  });
  assert.deepEqual(left, right);
}

{
  const jobs = expandImpactActionIntoJobs(
    "generate_asset_version",
    overviewPlan,
    jobContext,
  );
  assert.equal(jobs.length, 2);
  assert.deepEqual(
    [...jobs.map((job) => job.locale)].sort(),
    ["en", "fr"],
  );
}

{
  const jobsA = expandImpactActionIntoJobs("republish", overviewPlan, jobContext);
  const jobsB = expandImpactActionIntoJobs("republish", overviewPlan, jobContext);
  assert.deepEqual(jobsA, jobsB);
}

{
  assert.doesNotThrow(() => assertRegistrySnapshotPublicSafe(parsedSnapshot));
}

console.log("PASS — Intelligence Publishing registry adapter smoke");

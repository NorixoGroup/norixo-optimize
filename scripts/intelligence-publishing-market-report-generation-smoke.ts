import assert from "node:assert/strict";

import {
  buildRegistryPopulationPlan,
  applyRegistryPopulationPlan,
  type OccupancyBenchmarkPopulationInput,
  type PricingBenchmarkPopulationInput,
  type PublicMarketOverviewPopulationInput,
} from "../lib/intelligencePublishing/registryPopulation";
import {
  buildRegistrySnapshotForMarketReport,
  buildMarketReportFingerprint,
} from "../lib/intelligencePublishing/marketReportPilot";
import {
  buildMarketReportExecutionGraph,
  generateMarketReportDocument,
  resolveMarketReportAssets,
  validateMarketReportArtifactBundle,
  type MarketReportArtifactBundle,
} from "../lib/intelligencePublishing/marketReportGeneration";
import {
  buildRegistrySnapshotFingerprint,
  parseRegistrySnapshot,
} from "../lib/intelligencePublishing/registryAdapter";

function buildPricingInput(
  overrides: Partial<PricingBenchmarkPopulationInput["payload"]> = {},
): PricingBenchmarkPopulationInput {
  return {
    source: "public_market_dataset",
    datasetType: "pricing_benchmark",
    payload: {
      artifact_key: "pricing_artifact_fp_paris_airbnb_apartment_v1",
      artifact_contract_version: "pricing_contract_v1",
      benchmark_type: "pricing_distribution",
      approval_status: "internal_approved",
      country: "fr",
      city: "Paris",
      platform: "airbnb",
      property_type: "apartment",
      capacity_band: "1_3",
      currency: "EUR",
      market_cell_key: "fr:paris:airbnb:apartment:1_3",
      capture_period_bucket: "2026-07",
      source_period_start: "2026-04-01",
      source_period_end: "2026-06-30",
      cohort_definition_version: "cohort_v1",
      source_class_count: 3,
      source_diversity_band: "moderate",
      p10_price: 90,
      p25_price: 110,
      median_price: 135,
      p75_price: 170,
      p90_price: 210,
      raw_sample_size: 42,
      included_sample_size: 24,
      excluded_outlier_count: 2,
      outlier_policy_version: "outlier_v1",
      confidence_level: "high",
      confidence_policy_version: "confidence_v1",
      valid_from: "2026-07-01T00:00:00.000Z",
      valid_until: "2026-09-30T00:00:00.000Z",
      freshness_policy_version: "freshness_v1",
      approved_for_internal: true,
      approved_for_audit: true,
      limitations: [],
      cohort_policy_version: "cohort_policy_v1",
      aggregation_policy_version: "aggregation_v1",
      approval_policy_version: "approval_v1",
      market_cell_policy_version: "market_cell_v1",
      supersedes_artifact_id: null,
      ...overrides,
    },
  };
}

function buildOccupancyInput(
  overrides: Partial<OccupancyBenchmarkPopulationInput["payload"]> = {},
): OccupancyBenchmarkPopulationInput {
  return {
    source: "public_market_dataset",
    datasetType: "occupancy_benchmark",
    payload: {
      artifact_key: "occupancy_artifact_fp_paris_airbnb_apartment_v1",
      artifact_contract_version: "occupancy_contract_v1",
      benchmark_type: "occupancy_distribution",
      approval_status: "internal_approved",
      country: "fr",
      city: "Paris",
      platform: "airbnb",
      property_type: "apartment",
      capacity_band: "1_3",
      currency: "UNKNOWN",
      market_cell_key: "fr:paris:airbnb:apartment:1_3",
      capture_period_bucket: "2026-07",
      source_period_start: "2026-04-01",
      source_period_end: "2026-06-30",
      cohort_definition_version: "cohort_v1",
      source_class_count: 2,
      source_diversity_band: "moderate",
      p10_price: null,
      p25_price: null,
      median_price: null,
      p75_price: null,
      p90_price: null,
      observed_days_1_6_count: 1,
      observed_days_7_13_count: 2,
      observed_days_14_29_count: 5,
      observed_days_30_59_count: 7,
      observed_days_60_plus_count: 9,
      unavailability_0_19_count: 1,
      unavailability_20_39_count: 3,
      unavailability_40_59_count: 4,
      unavailability_60_79_count: 7,
      unavailability_80_100_count: 9,
      dominant_observed_days_band: "60_plus",
      dominant_unavailability_rate_band: "80_100",
      raw_sample_size: 28,
      included_sample_size: 24,
      excluded_outlier_count: 1,
      outlier_policy_version: "outlier_v1",
      confidence_level: "moderate",
      confidence_policy_version: "confidence_v1",
      valid_from: "2026-07-01T00:00:00.000Z",
      valid_until: "2026-09-30T00:00:00.000Z",
      freshness_policy_version: "freshness_v1",
      approved_for_internal: true,
      approved_for_audit: false,
      limitations: [],
      cohort_policy_version: "cohort_policy_v1",
      aggregation_policy_version: "aggregation_v1",
      approval_policy_version: "approval_v1",
      market_cell_policy_version: "market_cell_v1",
      supersedes_artifact_id: null,
      ...overrides,
    },
  };
}

function buildOverviewInput(
  overrides: Partial<PublicMarketOverviewPopulationInput["artifact"]> = {},
): PublicMarketOverviewPopulationInput {
  return {
    source: "public_market_dataset",
    datasetType: "market_overview",
    artifact: {
      publicContractVersion: "public_overview_contract_v1",
      artifactKey: "public_overview_fp_paris_airbnb_apartment_v1",
      intendedUse: "public_market_overview",
      aggregationWindow: "rolling_90_days",
      platformScope: "single_platform",
      capacityScope: "all_capacities",
      propertyScope: "exact",
      country: "fr",
      city: "Paris",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      capturePeriodBucket: "2026-07",
      windowStartedAt: "2026-04-01T00:00:00.000Z",
      windowEndedAt: "2026-06-30T00:00:00.000Z",
      p25: 112,
      median: 138,
      p75: 168,
      sampleBand: "sufficient",
      confidence: "standard",
      freshnessStatus: "fresh",
      exposureStatus: "public_usable",
      limitationCodes: [],
      policyVersions: {
        contractVersion: "overview_contract_v1",
        aggregationPolicyVersion: "overview_aggregation_v1",
        governancePolicyVersion: "overview_governance_v1",
        marketCellPolicyVersion: "market_cell_v1",
      },
      ...overrides,
    },
  };
}

function buildSnapshot(input?: {
  pricing?: Partial<PricingBenchmarkPopulationInput["payload"]>;
  occupancy?: Partial<OccupancyBenchmarkPopulationInput["payload"]>;
  overview?: Partial<PublicMarketOverviewPopulationInput["artifact"]>;
}) {
  const generatedAt = "2026-07-21T12:00:00.000Z";
  const evaluatedAt = "2026-07-21T12:00:00.000Z";
  const plan = buildRegistryPopulationPlan(
    [
      buildPricingInput(input?.pricing),
      buildOccupancyInput(input?.occupancy),
      buildOverviewInput(input?.overview),
    ],
    {
      generatedAt,
      evaluatedAt,
      targetLocales: ["en"],
      composeMarketReports: true,
      metadata: { smoke: true },
    },
  );
  return applyRegistryPopulationPlan(plan).nextSnapshot;
}

function getReportAssetKey(snapshot: ReturnType<typeof buildSnapshot>): string {
  const asset = snapshot.assets.find((entry) => entry.assetType === "market_report");
  assert.ok(asset, "Expected a market_report asset.");
  return asset.assetId;
}

function cloneSnapshot(snapshot: ReturnType<typeof buildSnapshot>): any {
  return JSON.parse(JSON.stringify(snapshot));
}

function assertNoPrivateMarkers(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const fragment of ["userId", "listingUrl", "rawPayload", "<script", "jsx"]) {
    assert.equal(serialized.includes(fragment), false, `Unexpected fragment: ${fragment}`);
  }
}

async function main() {
  const snapshot = buildSnapshot();
  const reportAssetKey = getReportAssetKey(snapshot);
  const fingerprintBefore = buildRegistrySnapshotFingerprint(snapshot);

  const resolved = resolveMarketReportAssets({
    registrySnapshot: snapshot,
    reportAssetKey,
    locale: "en",
  });
  assert.equal(resolved.reportDefinition.reportId.startsWith("report_"), true);
  assert.equal(resolved.pricing?.content.distribution.median, 135);
  assert.equal(resolved.occupancy?.content.dominantUnavailabilityRateBand, "80_100");
  assert.equal(resolved.overview?.content.distribution.median, 138);

  const bundle = generateMarketReportDocument({
    registrySnapshot: snapshot,
    reportAssetKey,
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
  });
  const validation = validateMarketReportArtifactBundle(bundle);
  assert.equal(validation.ok, true);
  assert.equal(bundle.document.identity.canonicalPath.startsWith("/reports/"), true);
  assert.equal(bundle.document.identity.canonicalUrl, `https://norixo.io${bundle.document.identity.canonicalPath}`);
  assert.equal(bundle.document.sections[0]?.sectionType, "executive_summary");
  assert.equal(bundle.document.sections.some((section) => section.sectionType === "pricing_benchmark"), true);
  assert.equal(bundle.document.sections.some((section) => section.sectionType === "occupancy_benchmark"), true);
  assert.equal(bundle.document.sections.some((section) => section.sectionType === "market_overview"), true);
  assert.equal(bundle.document.sections.some((section) => section.sectionType === "confidence"), true);
  assert.equal(bundle.document.sections.some((section) => section.sectionType === "freshness"), true);
  assert.equal(bundle.document.sections.some((section) => section.sectionType === "methodology"), true);
  assert.equal(bundle.document.sections.some((section) => section.sectionType === "sources"), true);
  assert.equal(bundle.document.identity.locale, "en");
  assert.equal(bundle.change.changeType, "new_report");
  assertNoPrivateMarkers(bundle);

  const bundleAgain = generateMarketReportDocument({
    registrySnapshot: snapshot,
    reportAssetKey,
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
    previousBundle: bundle,
  });
  assert.equal(bundleAgain.document.contentFingerprint, bundle.document.contentFingerprint);
  assert.equal(bundleAgain.reportFingerprint, bundle.reportFingerprint);
  assert.equal(bundleAgain.change.changeType, "unchanged_report");

  const bundleWithDifferentGeneratedAt = generateMarketReportDocument({
    registrySnapshot: snapshot,
    reportAssetKey,
    locale: "en",
    generatedAt: "2026-07-22T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
  });
  assert.equal(bundleWithDifferentGeneratedAt.document.contentFingerprint, bundle.document.contentFingerprint);

  const reversedSnapshot = parseRegistrySnapshot({
    ...snapshot,
    assets: [...snapshot.assets].reverse(),
    assetVersions: [...snapshot.assetVersions].reverse(),
    artifactReferences: [...snapshot.artifactReferences].reverse(),
    channelVariants: [...snapshot.channelVariants].reverse(),
    freshnessStates: [...snapshot.freshnessStates].reverse(),
    publicationStates: [...snapshot.publicationStates].reverse(),
  });
  const reversedBundle = generateMarketReportDocument({
    registrySnapshot: reversedSnapshot,
    reportAssetKey,
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
  });
  assert.equal(reversedBundle.document.contentFingerprint, bundle.document.contentFingerprint);

  const updatedSnapshot = buildSnapshot({
    pricing: { median_price: 142, p75_price: 176 },
  });
  const updatedBundle = generateMarketReportDocument({
    registrySnapshot: updatedSnapshot,
    reportAssetKey: getReportAssetKey(updatedSnapshot),
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
    previousBundle: bundle,
  });
  assert.notEqual(updatedBundle.document.contentFingerprint, bundle.document.contentFingerprint);
  assert.equal(updatedBundle.change.changeType, "updated_report");

  const frBundle = generateMarketReportDocument({
    registrySnapshot: snapshot,
    reportAssetKey,
    locale: "fr",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
  });
  assert.equal(frBundle.document.identity.locale, "fr");
  assert.equal(frBundle.document.title.includes("Rapport"), true);

  assert.throws(
    () =>
      generateMarketReportDocument({
        registrySnapshot: snapshot,
        reportAssetKey,
        locale: "de",
        generatedAt: "2026-07-21T12:00:00.000Z",
      }),
    /supported/i,
  );

  const partialSnapshot = cloneSnapshot(snapshot);
  const occupancyAsset = partialSnapshot.assets.find(
    (asset: any) =>
      (asset.metadata as Record<string, unknown>).assetKind === "market_occupancy_benchmark",
  );
  assert.ok(occupancyAsset, "Expected occupancy asset.");
  partialSnapshot.assets = partialSnapshot.assets.filter(
    (asset: any) => asset.assetId !== occupancyAsset.assetId,
  );
  partialSnapshot.assetVersions = partialSnapshot.assetVersions.filter(
    (version: any) => version.assetId !== occupancyAsset.assetId,
  );
  partialSnapshot.artifactReferences = partialSnapshot.artifactReferences.filter(
    (reference: any) => reference.assetId !== occupancyAsset.assetId,
  );
  partialSnapshot.freshnessStates = partialSnapshot.freshnessStates.filter(
    (state: any) => state.assetId !== occupancyAsset.assetId,
  );
  const normalizedPartialSnapshot = parseRegistrySnapshot(partialSnapshot);

  assert.throws(
    () =>
      generateMarketReportDocument({
        registrySnapshot: normalizedPartialSnapshot,
        reportAssetKey,
        locale: "en",
        generatedAt: "2026-07-21T12:00:00.000Z",
      }),
    /Required public-safe assets are missing/i,
  );

  const partialBundle = generateMarketReportDocument({
    registrySnapshot: normalizedPartialSnapshot,
    reportAssetKey,
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    options: {
      strictCompleteness: false,
      completenessPolicy: {
        allowPartialReport: true,
      },
    },
  });
  assert.equal(partialBundle.change.changeType, "partial_report");
  assert.equal(
    partialBundle.document.sections.some(
      (section) =>
        section.sectionType === "occupancy_benchmark" &&
        section.content.status === "missing",
    ),
    true,
  );

  const crossMarketSnapshot = cloneSnapshot(snapshot);
  const overviewAsset = crossMarketSnapshot.assets.find(
    (asset: any) => (asset.metadata as Record<string, unknown>).assetKind === "market_overview",
  );
  assert.ok(overviewAsset);
  overviewAsset.metadata = {
    ...overviewAsset.metadata,
    city: "Lyon",
  };
  assert.throws(
    () =>
      generateMarketReportDocument({
        registrySnapshot: parseRegistrySnapshot(crossMarketSnapshot),
        reportAssetKey,
        locale: "en",
        generatedAt: "2026-07-21T12:00:00.000Z",
      }),
    /another market/i,
  );

  const missingActiveVersionSnapshot = cloneSnapshot(snapshot);
  const reportAsset = missingActiveVersionSnapshot.assets.find(
    (asset: any) => asset.assetId === reportAssetKey,
  );
  assert.ok(reportAsset);
  reportAsset.activeVersionId = null;
  assert.throws(
    () =>
      resolveMarketReportAssets({
        registrySnapshot: parseRegistrySnapshot(missingActiveVersionSnapshot),
        reportAssetKey,
        locale: "en",
      }),
    /no active version/i,
  );

  const staleSnapshot = cloneSnapshot(snapshot);
  const pricingAsset = staleSnapshot.assets.find(
    (asset: any) => (asset.metadata as Record<string, unknown>).assetKind === "market_pricing_benchmark",
  );
  assert.ok(pricingAsset);
  const staleFreshness = staleSnapshot.freshnessStates.find(
    (entry: any) => entry.assetId === pricingAsset.assetId,
  );
  assert.ok(staleFreshness);
  staleFreshness.isStale = true;
  staleFreshness.isExpired = false;
  const staleBundle = generateMarketReportDocument({
    registrySnapshot: parseRegistrySnapshot(staleSnapshot),
    reportAssetKey,
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
  });
  assert.equal(staleBundle.change.changeType, "stale_report");

  const runtime = buildMarketReportExecutionGraph({
    registrySnapshot: snapshot,
    reportAssetKey,
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
  });
  assert.equal(runtime.graph.jobs.length, 3);
  assert.equal(runtime.plan.orderedJobs.length, 3);

  const pilotSnapshot = buildRegistrySnapshotForMarketReport(resolved.reportDefinition);
  assert.equal(
    buildMarketReportFingerprint(resolved.reportDefinition).startsWith("ipp_market_report_"),
    true,
  );
  assert.equal(pilotSnapshot.assets[0]?.assetType, "market_report");

  const privacyUserSnapshot = cloneSnapshot(snapshot);
  const privacyUserVersion = privacyUserSnapshot.assetVersions.find(
    (version: any) => version.assetId === reportAssetKey,
  );
  assert.ok(privacyUserVersion);
  privacyUserVersion.metadata = {
    ...privacyUserVersion.metadata,
    userId: "forbidden",
  };
  assert.throws(
    () =>
      generateMarketReportDocument({
        registrySnapshot: privacyUserSnapshot,
        reportAssetKey,
        locale: "en",
        generatedAt: "2026-07-21T12:00:00.000Z",
      }),
    /Forbidden private field/i,
  );

  const privacyListingSnapshot = cloneSnapshot(snapshot);
  const privacyListingVersion = privacyListingSnapshot.assetVersions.find(
    (version: any) => version.assetId === reportAssetKey,
  );
  assert.ok(privacyListingVersion);
  privacyListingVersion.metadata = {
    ...privacyListingVersion.metadata,
    listingUrl: "https://example.com/private",
  };
  assert.throws(
    () =>
      generateMarketReportDocument({
        registrySnapshot: privacyListingSnapshot,
        reportAssetKey,
        locale: "en",
        generatedAt: "2026-07-21T12:00:00.000Z",
      }),
    /Forbidden private field/i,
  );

  const privacyPayloadSnapshot = cloneSnapshot(snapshot);
  const privacyPayloadVersion = privacyPayloadSnapshot.assetVersions.find(
    (version: any) => version.assetId === reportAssetKey,
  );
  assert.ok(privacyPayloadVersion);
  privacyPayloadVersion.metadata = {
    ...privacyPayloadVersion.metadata,
    rawPayload: { private: true },
  };
  assert.throws(
    () =>
      generateMarketReportDocument({
        registrySnapshot: privacyPayloadSnapshot,
        reportAssetKey,
        locale: "en",
        generatedAt: "2026-07-21T12:00:00.000Z",
      }),
    /Forbidden private field/i,
  );

  assert.equal(buildRegistrySnapshotFingerprint(snapshot), fingerprintBefore);
  assert.equal(Object.isFrozen(bundle), true);
  assert.equal(Object.isFrozen(bundle.document), true);
  assert.equal(Object.isFrozen(bundle.document.sections), true);

  console.log("PASS — Intelligence publishing market report generation smoke");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

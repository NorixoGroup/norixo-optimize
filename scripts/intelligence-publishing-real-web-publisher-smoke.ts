import assert from "node:assert/strict";

import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
  type OccupancyBenchmarkPopulationInput,
  type PricingBenchmarkPopulationInput,
  type PublicMarketOverviewPopulationInput,
} from "../lib/intelligencePublishing/registryPopulation";
import {
  generateMarketReportDocument,
  type MarketReportArtifactBundle,
} from "../lib/intelligencePublishing/marketReportGeneration";
import { parseRegistrySnapshot } from "../lib/intelligencePublishing/registryAdapter";
import {
  buildDefaultWebPublicationPolicy,
  buildWebPageModel,
  buildWebPublicationManifest,
  buildWebPublisherRuntimePlan,
  buildWebSeoModel,
  resolveWebPublicationDecision,
  resolveWebRoute,
  validateWebPublicationManifest,
  type WebPublicationTarget,
} from "../lib/intelligencePublishing/webPublisher";

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

function buildTarget(locale = "en"): WebPublicationTarget {
  return {
    channel: "web",
    baseUrl: "https://norixo.io",
    locale,
    environment: "next_app",
    publicationMode: "canonical_with_legacy_alias",
    defaultLocale: "en",
    localizedRouteStrategy: "default_unprefixed",
    metadata: {
      smoke: true,
    },
  };
}

function createBundle(
  snapshot: ReturnType<typeof buildSnapshot>,
  previousBundle?: MarketReportArtifactBundle,
): MarketReportArtifactBundle {
  return generateMarketReportDocument({
    registrySnapshot: snapshot,
    reportAssetKey: getReportAssetKey(snapshot),
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
    previousBundle,
  });
}

function assertNoPrivateFragments(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const fragment of [
    "userId",
    "workspaceId",
    "auditId",
    "listingId",
    "listingUrl",
    "sourceUrl",
    "rawPayload",
  ]) {
    assert.equal(serialized.includes(fragment), false, `Unexpected private fragment: ${fragment}`);
  }
}

async function main() {
  const baseSnapshot = buildSnapshot();
  const baseBundle = createBundle(baseSnapshot);
  const baseTarget = buildTarget();
  const knownStaticRoutes = ["/reports/airbnb-market-report-paris"];

  const baseRoute = resolveWebRoute({
    bundle: baseBundle,
    target: baseTarget,
    siblingBundles: [baseBundle],
    knownStaticRoutes,
  });
  assert.equal(baseRoute.canonical.pathname, "/reports/airbnb-market-report-paris-apartment");
  assert.equal(baseRoute.aliases[0]?.fromPath, "/reports/airbnb-market-report-paris");

  const baseDecision = resolveWebPublicationDecision({
    bundle: baseBundle,
    target: baseTarget,
    route: baseRoute,
    policy: buildDefaultWebPublicationPolicy(),
  });
  assert.equal(baseDecision.decisionType, "publish");

  const baseManifest = buildWebPublicationManifest({
    bundle: baseBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    knownStaticRoutes,
    siblingBundles: [baseBundle],
  });
  assert.equal(validateWebPublicationManifest(baseManifest).ok, true);
  assert.equal(baseManifest.route.canonical.pathname, "/reports/airbnb-market-report-paris-apartment");
  assert.equal(baseManifest.aliases[0]?.fromPath, "/reports/airbnb-market-report-paris");
  assert.ok(baseManifest.sitemapEntry);
  assertNoPrivateFragments(baseManifest);

  const baseManifestAgain = buildWebPublicationManifest({
    bundle: baseBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    knownStaticRoutes,
    siblingBundles: [baseBundle],
  });
  assert.equal(baseManifest.publicationFingerprint, baseManifestAgain.publicationFingerprint);
  assert.equal(baseManifest.route.canonical.fingerprint, baseManifestAgain.route.canonical.fingerprint);
  assert.equal(baseManifest.page.contentFingerprint, baseManifestAgain.page.contentFingerprint);
  assert.equal(baseManifest.seo.contentFingerprint, baseManifestAgain.seo.contentFingerprint);

  const unchangedBundle = generateMarketReportDocument({
    registrySnapshot: baseSnapshot,
    reportAssetKey: getReportAssetKey(baseSnapshot),
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
    previousBundle: baseBundle,
  });
  assert.equal(unchangedBundle.change.changeType, "unchanged_report");
  const unchangedManifest = buildWebPublicationManifest({
    bundle: unchangedBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    previousManifest: baseManifest,
    knownStaticRoutes,
    siblingBundles: [unchangedBundle],
  });
  assert.equal(unchangedManifest.decision.decisionType, "skip_unchanged");
  assert.equal(unchangedManifest.change.changedComponents.includes("decision"), true);

  const updatedSnapshot = buildSnapshot({
    pricing: { median_price: 142, p75_price: 176 },
  });
  const updatedBundle = generateMarketReportDocument({
    registrySnapshot: updatedSnapshot,
    reportAssetKey: getReportAssetKey(updatedSnapshot),
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
    previousBundle: baseBundle,
  });
  assert.equal(updatedBundle.change.changeType, "updated_report");
  const updatedManifest = buildWebPublicationManifest({
    bundle: updatedBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    previousManifest: baseManifest,
    knownStaticRoutes,
    siblingBundles: [updatedBundle],
  });
  assert.equal(updatedManifest.decision.decisionType, "publish");
  assert.equal(updatedManifest.change.changedComponents.includes("content"), true);

  const partialSnapshot = cloneSnapshot(baseSnapshot);
  const occupancyAsset = partialSnapshot.assets.find(
    (asset: any) =>
      (asset.metadata as Record<string, unknown>).assetKind === "market_occupancy_benchmark",
  );
  assert.ok(occupancyAsset);
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
  const partialBundle = generateMarketReportDocument({
    registrySnapshot: parseRegistrySnapshot(partialSnapshot),
    reportAssetKey: getReportAssetKey(baseSnapshot),
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
    options: {
      strictCompleteness: false,
      completenessPolicy: {
        allowPartialReport: true,
      },
    },
  });
  assert.equal(partialBundle.change.changeType, "partial_report");
  const partialManifestAllowed = buildWebPublicationManifest({
    bundle: partialBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    policy: {
      allowPartialReports: true,
      indexPartialReports: false,
    },
    knownStaticRoutes,
    siblingBundles: [partialBundle],
  });
  assert.equal(partialManifestAllowed.decision.decisionType, "publish_with_warning");
  assert.equal(partialManifestAllowed.seo.robots.index, false);
  assert.equal(partialManifestAllowed.sitemapEntry, null);

  const partialManifestBlocked = buildWebPublicationManifest({
    bundle: partialBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    policy: {
      allowPartialReports: false,
    },
    knownStaticRoutes,
    siblingBundles: [partialBundle],
  });
  assert.equal(partialManifestBlocked.decision.decisionType, "skip_partial");
  assert.equal(partialManifestBlocked.sitemapEntry, null);

  const staleSnapshot = cloneSnapshot(baseSnapshot);
  const pricingAsset = staleSnapshot.assets.find(
    (asset: any) =>
      (asset.metadata as Record<string, unknown>).assetKind === "market_pricing_benchmark",
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
    reportAssetKey: getReportAssetKey(baseSnapshot),
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
  });
  assert.equal(staleBundle.change.changeType, "stale_report");
  const staleManifestAllowed = buildWebPublicationManifest({
    bundle: staleBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    policy: {
      allowStaleReports: true,
      indexStaleReports: false,
    },
    knownStaticRoutes,
    siblingBundles: [staleBundle],
  });
  assert.equal(staleManifestAllowed.decision.decisionType, "publish_with_warning");
  assert.equal(staleManifestAllowed.sitemapEntry, null);

  const staleManifestBlocked = buildWebPublicationManifest({
    bundle: staleBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    policy: {
      allowStaleReports: false,
    },
    knownStaticRoutes,
    siblingBundles: [staleBundle],
  });
  assert.equal(staleManifestBlocked.decision.decisionType, "skip_stale");

  const invalidBundle: MarketReportArtifactBundle = {
    ...baseBundle,
    change: {
      ...baseBundle.change,
      changeType: "invalid_report",
    },
  };
  const invalidManifest = buildWebPublicationManifest({
    bundle: invalidBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    knownStaticRoutes,
    siblingBundles: [invalidBundle],
  });
  assert.equal(invalidManifest.decision.decisionType, "skip_invalid");
  assert.equal(invalidManifest.seo.robots.index, false);
  assert.equal(invalidManifest.sitemapEntry, null);

  const selfAliasRoute = resolveWebRoute({
    bundle: baseBundle,
    target: baseTarget,
    siblingBundles: [baseBundle],
    legacySlugOverride: "airbnb-market-report-paris-apartment",
  });
  assert.equal(selfAliasRoute.aliases[0]?.status, "blocked");

  const conflictingManifest = {
    ...baseManifest,
    reportId: "report_conflicting_market",
  };
  const routeConflictManifest = buildWebPublicationManifest({
    bundle: baseBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    existingManifests: [conflictingManifest],
    knownStaticRoutes,
    siblingBundles: [baseBundle],
  });
  assert.equal(routeConflictManifest.decision.decisionType, "route_conflict");

  const stablePage = buildWebPageModel({
    bundle: baseBundle,
    route: baseRoute,
  });
  const stablePageAgain = buildWebPageModel({
    bundle: baseBundle,
    route: baseRoute,
  });
  assert.equal(stablePage.contentFingerprint, stablePageAgain.contentFingerprint);

  const stableSeo = buildWebSeoModel({
    bundle: baseBundle,
    route: baseRoute,
    decision: baseDecision,
    target: baseTarget,
  });
  const stableSeoAgain = buildWebSeoModel({
    bundle: baseBundle,
    route: baseRoute,
    decision: baseDecision,
    target: baseTarget,
  });
  assert.equal(stableSeo.contentFingerprint, stableSeoAgain.contentFingerprint);

  const seoBundle: MarketReportArtifactBundle = {
    ...baseBundle,
    metadataArtifact: {
      ...baseBundle.metadataArtifact,
      openGraph: {
        ...baseBundle.metadataArtifact.openGraph,
        siteName: "Norixo Market Intelligence",
      },
    },
  };
  const seoManifest = buildWebPublicationManifest({
    bundle: seoBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    previousManifest: baseManifest,
    knownStaticRoutes,
    siblingBundles: [seoBundle],
  });
  assert.equal(seoManifest.change.changeType, "seo_changed");
  assert.equal(seoManifest.change.changedComponents.includes("seo"), true);

  const routeBundle: MarketReportArtifactBundle = {
    ...baseBundle,
    document: {
      ...baseBundle.document,
      identity: {
        ...baseBundle.document.identity,
        propertyType: "house",
      },
    },
  };
  const routeManifest = buildWebPublicationManifest({
    bundle: routeBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
    previousManifest: baseManifest,
    knownStaticRoutes,
    siblingBundles: [routeBundle],
  });
  assert.equal(routeManifest.change.changedComponents.includes("route"), true);

  const runtime = buildWebPublisherRuntimePlan({
    bundle: baseBundle,
    target: baseTarget,
    generatedAt: "2026-07-21T12:00:00.000Z",
  });
  assert.equal(runtime.graph.jobs.length, 7);
  assert.equal(runtime.plan.orderedJobs.length, 7);
  assert.equal(
    runtime.plan.orderedJobs[0]?.type,
    "validate_market_report_bundle",
  );
  assert.equal(
    runtime.plan.orderedJobs[runtime.plan.orderedJobs.length - 1]?.type,
    "validate_web_publication_manifest",
  );
  assert.deepEqual(
    runtime.graph.jobs.map((job) => job.type).sort(),
    [
      "build_web_page_model",
      "build_web_seo_model",
      "build_web_sitemap_entry",
      "resolve_web_publication_decision",
      "resolve_web_route",
      "validate_market_report_bundle",
      "validate_web_publication_manifest",
    ].sort(),
  );

  console.log("PASS — Intelligence Publishing real web publisher smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

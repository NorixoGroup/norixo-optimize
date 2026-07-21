import assert from "node:assert/strict";

import sitemap from "../app/sitemap";
import {
  generateMetadata as generateReportMetadata,
  generateStaticParams as generateReportStaticParams,
} from "../app/(default)/reports/[report]/page";
import {
  marketReports,
  type MarketReport,
} from "../data/marketReports";
import {
  buildNextMetadataFromPublication,
  buildNextPublicationCatalog,
  buildNextSitemapEntries,
  buildNextStaticParams,
  getNextPublicationCards,
  getNextPublicationStructuredData,
  resolveNextPublicationBySlug,
  validateNextPublicationCatalog,
  validateNextPublicationResolution,
} from "../lib/intelligencePublishing/nextWebPublicationAdapter";
import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
  type OccupancyBenchmarkPopulationInput,
  type PricingBenchmarkPopulationInput,
  type PublicMarketOverviewPopulationInput,
} from "../lib/intelligencePublishing/registryPopulation";
import { generateMarketReportDocument } from "../lib/intelligencePublishing/marketReportGeneration";
import { parseRegistrySnapshot } from "../lib/intelligencePublishing/registryAdapter";
import {
  buildWebPublicationManifest,
  type WebPublicationManifest,
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

function buildSnapshot() {
  const plan = buildRegistryPopulationPlan(
    [buildPricingInput(), buildOccupancyInput(), buildOverviewInput()],
    {
      generatedAt: "2026-07-21T12:00:00.000Z",
      evaluatedAt: "2026-07-21T12:00:00.000Z",
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

function buildTarget(): WebPublicationTarget {
  return {
    channel: "web",
    baseUrl: "https://norixo.io",
    locale: "en",
    environment: "next_app",
    publicationMode: "canonical_with_legacy_alias",
    defaultLocale: "en",
    localizedRouteStrategy: "default_unprefixed",
    metadata: { smoke: true },
  };
}

function buildManifest(): WebPublicationManifest {
  const snapshot = buildSnapshot();
  const bundle = generateMarketReportDocument({
    registrySnapshot: snapshot,
    reportAssetKey: getReportAssetKey(snapshot),
    locale: "en",
    generatedAt: "2026-07-21T12:00:00.000Z",
    canonicalBaseUrl: "https://norixo.io",
  });
  return buildWebPublicationManifest({
    bundle,
    target: buildTarget(),
    generatedAt: "2026-07-21T12:00:00.000Z",
    knownStaticRoutes: ["/reports/airbnb-market-report-paris"],
    siblingBundles: [bundle],
  });
}

function cloneManifest(manifest: WebPublicationManifest): any {
  return JSON.parse(JSON.stringify(manifest));
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
    "comparableUrl",
    "rawPayload",
  ]) {
    assert.equal(serialized.includes(fragment), false, `Unexpected private fragment: ${fragment}`);
  }
}

async function main() {
  const manifest = buildManifest();
  const legacyOnlyCatalog = buildNextPublicationCatalog({
    manifests: [],
    legacyReports: marketReports,
  });
  assert.equal(validateNextPublicationCatalog(legacyOnlyCatalog), true);
  assert.equal(
    legacyOnlyCatalog.entries.filter((entry) => entry.source === "static_legacy").length,
    marketReports.length,
  );

  const ippOnlyCatalog = buildNextPublicationCatalog({
    manifests: [manifest],
    legacyReports: [],
  });
  assert.equal(
    ippOnlyCatalog.entries.some((entry) => entry.source === "ipp_canonical"),
    true,
  );
  assert.equal(
    ippOnlyCatalog.entries.some((entry) => entry.source === "ipp_alias"),
    true,
  );

  const hybridCatalog = buildNextPublicationCatalog({
    manifests: [manifest],
    legacyReports: marketReports,
  });
  assert.equal(
    hybridCatalog.entries.filter((entry) => entry.source === "ipp_alias").length,
    0,
  );

  const canonicalResolution = resolveNextPublicationBySlug(
    ippOnlyCatalog,
    "airbnb-market-report-paris-apartment",
  );
  assert.equal(canonicalResolution.found, true);
  assert.equal(canonicalResolution.source, "ipp_canonical");
  assert.equal(validateNextPublicationResolution(canonicalResolution), true);

  const aliasResolution = resolveNextPublicationBySlug(
    ippOnlyCatalog,
    "airbnb-market-report-paris",
  );
  assert.equal(aliasResolution.found, true);
  assert.equal(aliasResolution.source, "ipp_alias");
  assert.equal(
    aliasResolution.redirectCandidate,
    "/reports/airbnb-market-report-paris-apartment",
  );

  const fallbackLegacyResolution = resolveNextPublicationBySlug(
    hybridCatalog,
    "airbnb-market-report-paris",
  );
  assert.equal(fallbackLegacyResolution.found, true);
  assert.equal(fallbackLegacyResolution.source, "static_legacy");

  const conflictingCanonicalManifest = cloneManifest(manifest);
  conflictingCanonicalManifest.route.canonical.pathname =
    "/reports/airbnb-market-report-paris";
  conflictingCanonicalManifest.route.canonical.slug =
    "airbnb-market-report-paris";
  const conflictCatalog = buildNextPublicationCatalog({
    manifests: [conflictingCanonicalManifest],
    legacyReports: marketReports,
  });
  assert.equal(
    conflictCatalog.entries.some(
      (entry) =>
        entry.source === "ipp_canonical" &&
        entry.pathname === "/reports/airbnb-market-report-paris",
    ),
    false,
  );

  const notFoundResolution = resolveNextPublicationBySlug(
    hybridCatalog,
    "unknown-market-report",
  );
  assert.equal(notFoundResolution.found, false);

  const invalidManifest = cloneManifest(manifest) as any;
  invalidManifest.page.heading = "";
  const invalidCatalog = buildNextPublicationCatalog({
    manifests: [invalidManifest],
    legacyReports: [],
  });
  assert.equal(
    invalidCatalog.entries.some((entry) => entry.source === "ipp_canonical"),
    false,
  );

  const noindexManifest = cloneManifest(manifest);
  noindexManifest.seo.robots = {
    ...noindexManifest.seo.robots,
    index: false,
  };
  noindexManifest.sitemapEntry = null;
  const noindexCatalog = buildNextPublicationCatalog({
    manifests: [noindexManifest],
    legacyReports: [],
  });
  const noindexEntry = noindexCatalog.entries.find(
    (entry) => entry.source === "ipp_canonical",
  );
  assert.ok(noindexEntry);
  assert.equal(noindexEntry.indexable, false);
  assert.equal(noindexEntry.sitemapEligible, false);

  assert.deepEqual(
    buildNextStaticParams(hybridCatalog),
    buildNextStaticParams(hybridCatalog),
  );
  assert.equal(
    buildNextStaticParams(hybridCatalog).some(
      (entry) => entry.report === "airbnb-market-report-paris",
    ),
    true,
  );

  const legacyMetadata = await generateReportMetadata({
    params: Promise.resolve({ report: "airbnb-market-report-paris" }),
  });
  assert.equal(
    legacyMetadata.alternates?.canonical,
    "https://norixo.io/reports/airbnb-market-report-paris",
  );

  const ippMetadata = buildNextMetadataFromPublication(canonicalResolution);
  assert.equal(
    ippMetadata.alternates?.canonical,
    "https://norixo.io/reports/airbnb-market-report-paris-apartment",
  );
  assert.equal((ippMetadata.robots as { index?: boolean } | undefined)?.index, true);

  const structuredData = getNextPublicationStructuredData(canonicalResolution);
  assert.ok(structuredData);
  assert.equal(
    JSON.stringify(structuredData).includes(
      "https://norixo.io/reports/airbnb-market-report-paris-apartment",
    ),
    true,
  );
  assert.equal(canonicalResolution.entry?.manifest?.page.heading.length! > 0, true);

  const cards = getNextPublicationCards(hybridCatalog);
  assert.equal(
    cards.filter((card) => card.href === "/reports/airbnb-market-report-paris").length,
    1,
  );

  const hybridSitemap = buildNextSitemapEntries(hybridCatalog);
  assert.equal(
    hybridSitemap.some(
      (entry) => entry.url === "https://norixo.io/reports/airbnb-market-report-paris",
    ),
    true,
  );
  assert.equal(
    hybridSitemap.some(
      (entry) =>
        entry.url === "https://norixo.io/reports/airbnb-market-report-paris-apartment",
    ),
    true,
  );
  const noindexSitemap = buildNextSitemapEntries(noindexCatalog);
  assert.equal(
    noindexSitemap.some(
      (entry) =>
        entry.url === "https://norixo.io/reports/airbnb-market-report-paris-apartment",
    ),
    false,
  );

  const legacyParams = generateReportStaticParams();
  assert.equal(legacyParams.some((entry) => entry.report === "airbnb-market-report-paris"), true);
  const appSitemap = sitemap();
  assert.equal(
    appSitemap.some(
      (entry) => entry.url === "https://norixo.io/reports/airbnb-market-report-paris",
    ),
    true,
  );

  assertNoPrivateFragments(hybridCatalog);
  assertNoPrivateFragments(canonicalResolution);
  assertNoPrivateFragments(ippMetadata);

  const stableCatalogAgain = buildNextPublicationCatalog({
    manifests: [manifest],
    legacyReports: marketReports,
  });
  assert.equal(hybridCatalog.fingerprint, stableCatalogAgain.fingerprint);

  console.log("PASS — Intelligence Publishing Next publication integration smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
  type OccupancyBenchmarkPopulationInput,
  type PricingBenchmarkPopulationInput,
  type PublicMarketOverviewPopulationInput,
} from "../lib/intelligencePublishing/registryPopulation";
import { generateMarketReportDocument } from "../lib/intelligencePublishing/marketReportGeneration";
import {
  DEFAULT_WEB_MANIFEST_CATALOG_OUTPUT_PATH,
  loadWebManifestMaterializationSource,
  materializeWebPublicationManifests,
  runWebManifestMaterializationCli,
  validateWebManifestCatalogEnvelope,
  writeWebManifestCatalog,
  WEB_MANIFEST_CATALOG_SCHEMA_VERSION,
  WEB_MANIFEST_GENERATOR_VERSION,
  type WebManifestCatalogEnvelope,
} from "../lib/intelligencePublishing/webManifestMaterialization";
import {
  buildWebPublicationManifest,
  type WebPublicationManifest,
  type WebPublicationTarget,
} from "../lib/intelligencePublishing/webPublisher";

const GENERATED_AT = "2026-07-21T12:00:00.000Z";

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
      generatedAt: GENERATED_AT,
      evaluatedAt: GENERATED_AT,
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

function buildBundle() {
  const snapshot = buildSnapshot();
  return generateMarketReportDocument({
    registrySnapshot: snapshot,
    reportAssetKey: getReportAssetKey(snapshot),
    locale: "en",
    generatedAt: GENERATED_AT,
    canonicalBaseUrl: "https://norixo.io",
  });
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

function buildManifest(
  overrides: Partial<WebPublicationManifest> = {},
): WebPublicationManifest {
  const bundle = buildBundle();
  const manifest = buildWebPublicationManifest({
    bundle,
    target: buildTarget(),
    generatedAt: GENERATED_AT,
    knownStaticRoutes: ["/reports/airbnb-market-report-paris"],
    siblingBundles: [bundle],
  });
  return deepMergeManifest(manifest, overrides);
}

function buildSyntheticManifest(
  base: WebPublicationManifest,
  index: number,
  mode: "indexable" | "noindex" | "blocked" = "indexable",
): WebPublicationManifest {
  const slug = `airbnb-market-report-synthetic-city-${index}`;
  const canonicalPath = `/reports/${slug}`;
  const canonicalUrl = `https://norixo.io${canonicalPath}`;
  const alias =
    index % 20 === 0 && base.aliases[0] != null
      ? [
          {
            ...base.aliases[0],
            aliasKey: `${base.aliases[0].aliasKey}_synthetic_${index}`,
            fingerprint: `${base.aliases[0].fingerprint}_synthetic_${index}`,
            fromPath: `/reports/synthetic-city-${index}`,
            toPath: canonicalPath,
          },
        ]
      : [];

  const manifest = deepMergeManifest(base, {
    manifestId: `${base.manifestId}_synthetic_${index}`,
    reportId: `${base.reportId}_synthetic_${index}`,
    publicationFingerprint: `${base.publicationFingerprint}_synthetic_${index}`,
    aliases: alias,
    route: {
      ...base.route,
      aliases: alias,
      canonical: {
        ...base.route.canonical,
        slug,
        pathname: canonicalPath,
        canonicalPath,
        canonicalUrl,
        absoluteUrl: canonicalUrl,
      },
    },
    page: {
      ...base.page,
      route: canonicalPath,
      metadata: {
        ...base.page.metadata,
        canonicalPath,
        reportId: `${base.reportId}_synthetic_${index}`,
      },
    },
    seo: {
      ...base.seo,
      canonical: canonicalUrl,
      openGraph: {
        ...base.seo.openGraph,
        url: canonicalUrl,
      },
      structuredData: {
        ...base.seo.structuredData,
        canonicalUrl,
        mainEntity: {
          ...(base.seo.structuredData.mainEntity as Record<string, unknown>),
          canonicalUrl,
        },
      },
      robots: {
        ...base.seo.robots,
        index: true,
      },
    },
    publication: {
      ...base.publication,
      canonicalPath,
      canonicalUrl,
      renderable: true,
      indexable: true,
      sitemapEligible: true,
      publicationMode: "publish",
      routeExposure: "canonical",
      blockedReasons: [],
      warningReasons: [],
    },
    sitemapEntry: {
      ...(base.sitemapEntry ?? {
        changeFrequency: "weekly" as const,
        priority: 0.6,
        locale: base.target.locale,
        contentFingerprint: `${base.publicationFingerprint}_synthetic_sitemap_${index}`,
      }),
      url: canonicalUrl,
      lastModified: GENERATED_AT,
    },
    decision: {
      ...base.decision,
      decisionType: "publish",
      allowsPublication: true,
      requiresNoindex: false,
    },
  });

  if (mode === "noindex") {
    return deepMergeManifest(manifest, {
      seo: {
        ...manifest.seo,
        robots: {
          ...manifest.seo.robots,
          index: false,
        },
      },
      publication: {
        ...manifest.publication,
        indexable: false,
        sitemapEligible: false,
        publicationMode: "publish_with_warning",
        warningReasons: ["noindex_applied"],
      },
      sitemapEntry: null,
      decision: {
        ...manifest.decision,
        decisionType: "publish_with_warning",
        requiresNoindex: true,
      },
    });
  }

  if (mode === "blocked") {
    return deepMergeManifest(manifest, {
      seo: {
        ...manifest.seo,
        robots: {
          ...manifest.seo.robots,
          index: false,
        },
      },
      publication: {
        ...manifest.publication,
        publicationMode: "block",
        renderable: false,
        indexable: false,
        sitemapEligible: false,
        routeExposure: "none",
        blockedReasons: ["blocked_in_synthetic_smoke"],
        warningReasons: [],
      },
      sitemapEntry: null,
      decision: {
        ...manifest.decision,
        decisionType: "skip_invalid",
        allowsPublication: false,
        requiresNoindex: true,
      },
    });
  }

  return manifest;
}

function deepMergeManifest(
  base: WebPublicationManifest,
  overrides: Partial<WebPublicationManifest>,
): WebPublicationManifest {
  return JSON.parse(
    JSON.stringify({
      ...base,
      ...overrides,
      route: {
        ...base.route,
        ...(overrides.route ?? {}),
        canonical: {
          ...base.route.canonical,
          ...(overrides.route?.canonical ?? {}),
        },
      },
      seo: {
        ...base.seo,
        ...(overrides.seo ?? {}),
        robots: {
          ...base.seo.robots,
          ...((overrides.seo?.robots as Record<string, unknown> | undefined) ?? {}),
        },
      },
      decision: {
        ...base.decision,
        ...(overrides.decision ?? {}),
      },
      publication: {
        ...base.publication,
        ...(overrides.publication ?? {}),
      },
      aliases: overrides.aliases ?? base.aliases,
      sitemapEntry:
        overrides.sitemapEntry === undefined
          ? base.sitemapEntry
          : overrides.sitemapEntry,
      metadata: {
        ...(base as unknown as Record<string, unknown>),
      },
    }),
  ) as WebPublicationManifest;
}

function cloneManifest<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function writeJsonTempFile(name: string, value: unknown): Promise<string> {
  const filePath = path.join(tmpdir(), name);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

async function captureConsoleInfo(
  fn: () => Promise<void>,
): Promise<readonly string[]> {
  const calls: string[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => {
    calls.push(args.map((arg) => String(arg)).join(" "));
  };
  try {
    await fn();
  } finally {
    console.info = original;
  }
  return calls;
}

function parseCliJson(logs: readonly string[]): Record<string, unknown> {
  const last = logs.at(-1);
  assert.ok(last, "Expected CLI output.");
  return JSON.parse(last);
}

function expectManifestByCanonicalPath(
  envelope: WebManifestCatalogEnvelope,
  canonicalPath: string,
): WebPublicationManifest {
  const manifest =
    envelope.manifests.find(
      (entry) => entry.publication.canonicalPath === canonicalPath,
    ) ?? null;
  assert.ok(manifest, `Expected a manifest for ${canonicalPath}.`);
  return manifest;
}

async function main() {
  const emptySource = await loadWebManifestMaterializationSource();
  const emptyResult = materializeWebPublicationManifests({
    source: emptySource,
    policy: {
      allowEmptyCatalog: true,
      generatedAt: GENERATED_AT,
    },
  });
  assert.equal(emptyResult.status, "empty");
  assert.equal(emptyResult.envelope.manifestCount, 0);

  assert.throws(
    () =>
      materializeWebPublicationManifests({
        source: emptySource,
        policy: {
          allowEmptyCatalog: false,
          generatedAt: GENERATED_AT,
        },
      }),
    /empty catalog/i,
  );

  const snapshot = buildSnapshot();
  const snapshotPath = await writeJsonTempFile(
    "ipp-materialization-snapshot.json",
    snapshot,
  );
  const snapshotSource = await loadWebManifestMaterializationSource({
    sourcePath: snapshotPath,
  });
  const snapshotResult = materializeWebPublicationManifests({
    source: snapshotSource,
    policy: {
      allowEmptyCatalog: false,
    },
  });
  assert.equal(snapshotResult.envelope.manifestCount >= 1, true);
  expectManifestByCanonicalPath(
    snapshotResult.envelope,
    "/reports/airbnb-market-report-paris-apartment",
  );

  const bundle = buildBundle();
  const bundlePath = await writeJsonTempFile(
    "ipp-materialization-bundle.json",
    bundle,
  );
  const bundleSource = await loadWebManifestMaterializationSource({
    sourcePath: bundlePath,
  });
  const bundleResult = materializeWebPublicationManifests({
    source: bundleSource,
    policy: {
      allowEmptyCatalog: false,
    },
  });
  assert.equal(bundleResult.envelope.manifestCount >= 1, true);
  expectManifestByCanonicalPath(
    bundleResult.envelope,
    "/reports/airbnb-market-report-paris-apartment",
  );

  const manifest = buildManifest();
  const manifestPath = await writeJsonTempFile(
    "ipp-materialization-manifest.json",
    manifest,
  );
  const manifestSource = await loadWebManifestMaterializationSource({
    sourcePath: manifestPath,
  });
  const manifestResult = materializeWebPublicationManifests({
    source: manifestSource,
    policy: {
      allowEmptyCatalog: false,
    },
  });
  assert.equal(manifestResult.envelope.manifestCount >= 1, true);
  assert.equal(
    manifestResult.includedManifests.some(
      (entry) => entry.publicationFingerprint === manifest.publicationFingerprint,
    ),
    true,
  );

  const unchangedManifest = buildWebPublicationManifest({
    bundle,
    target: buildTarget(),
    generatedAt: GENERATED_AT,
    knownStaticRoutes: ["/reports/airbnb-market-report-paris"],
    siblingBundles: [bundle],
    previousManifest: manifest,
  });
  const unchangedPath = await writeJsonTempFile(
    "ipp-materialization-unchanged.json",
    unchangedManifest,
  );
  const unchangedSource = await loadWebManifestMaterializationSource({
    sourcePath: unchangedPath,
  });
  const unchangedResult = materializeWebPublicationManifests({
    source: unchangedSource,
    policy: {
      allowEmptyCatalog: false,
      includeUnchangedManifests: true,
    },
  });
  assert.equal(unchangedResult.envelope.manifestCount >= 1, true);
  assert.equal(
    unchangedResult.envelope.manifests.some(
      (entry) => entry.publication.canonicalPath === manifest.publication.canonicalPath,
    ),
    true,
  );

  const partialManifest = deepMergeManifest(manifest, {
    manifestId: `${manifest.manifestId}_partial`,
    publicationFingerprint: `${manifest.publicationFingerprint}_partial`,
    decision: {
      ...manifest.decision,
      decisionType: "skip_partial",
      allowsPublication: false,
      requiresNoindex: true,
    },
    publication: {
      ...manifest.publication,
      publicationMode: "block",
      completeness: "partial_report",
      renderable: false,
      indexable: false,
      sitemapEligible: false,
      routeExposure: "none",
      blockedReasons: ["partial_report_blocked"],
      warningReasons: [],
    },
    seo: {
      ...manifest.seo,
      robots: {
        ...manifest.seo.robots,
        index: false,
      },
    },
    sitemapEntry: null,
  });
  const partialPath = await writeJsonTempFile(
    "ipp-materialization-partial.json",
    partialManifest,
  );
  const partialResult = materializeWebPublicationManifests({
    source: await loadWebManifestMaterializationSource({ sourcePath: partialPath }),
    policy: {
      allowEmptyCatalog: true,
      allowPartialReports: false,
      generatedAt: GENERATED_AT,
    },
  });
  assert.equal(partialResult.envelope.manifestCount, 0);

  const privacyManifest = cloneManifest(manifest) as WebPublicationManifest & {
    manifestId: string;
    publicationFingerprint: string;
    page: WebPublicationManifest["page"] & {
      metadata: Record<string, unknown>;
    };
  };
  privacyManifest.manifestId = `${manifest.manifestId}_privacy`;
  privacyManifest.publicationFingerprint = `${manifest.publicationFingerprint}_privacy`;
  (
    privacyManifest.page.metadata
  ).userId = "private-user";
  const privacyPath = await writeJsonTempFile(
    "ipp-materialization-privacy.json",
    privacyManifest,
  );
  await assert.rejects(
    () =>
      loadWebManifestMaterializationSource({
        sourcePath: privacyPath,
      }),
    /privacy|Forbidden private field/i,
  );

  const conflictingManifest = deepMergeManifest(manifest, {
    manifestId: `${manifest.manifestId}_conflict`,
    publicationFingerprint: `${manifest.publicationFingerprint}_conflict`,
    reportId: `${manifest.reportId}_conflict`,
  });
  const duplicateSourcePath = await writeJsonTempFile(
    "ipp-materialization-duplicate.json",
    {
      manifests: [manifest, conflictingManifest],
    },
  );
  const duplicateResult = materializeWebPublicationManifests({
    source: await loadWebManifestMaterializationSource({
      sourcePath: duplicateSourcePath,
    }),
    policy: {
      allowEmptyCatalog: false,
    },
  });
  assert.equal(duplicateResult.envelope.manifestCount, 1);
  assert.ok(duplicateResult.excludedManifests.length > 0);
  assert.ok(
    duplicateResult.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "materialization_conflict_detected",
    ),
  );
  const keptDuplicateManifest =
    duplicateResult.envelope.manifests.find((entry) =>
      [manifest.manifestId, conflictingManifest.manifestId].includes(entry.manifestId),
    ) ?? null;
  assert.ok(keptDuplicateManifest, "Expected one conflicting manifest to remain.");

  const reversedSourcePath = await writeJsonTempFile(
    "ipp-materialization-reversed.json",
    {
      manifests: [conflictingManifest, manifest],
    },
  );
  const reversedResult = materializeWebPublicationManifests({
    source: await loadWebManifestMaterializationSource({
      sourcePath: reversedSourcePath,
    }),
    policy: {
      allowEmptyCatalog: false,
    },
  });
  assert.equal(
    reversedResult.catalogFingerprint,
    duplicateResult.catalogFingerprint,
  );

  const differentTimestampResult = materializeWebPublicationManifests({
    source: bundleSource,
    policy: {
      allowEmptyCatalog: false,
      generatedAt: "2026-07-22T12:00:00.000Z",
    },
  });
  assert.equal(
    differentTimestampResult.catalogFingerprint,
    bundleResult.catalogFingerprint,
  );

  const modifiedManifest = deepMergeManifest(manifest, {
    manifestId: `${manifest.manifestId}_modified`,
    reportId: `${manifest.reportId}_modified`,
    publicationFingerprint: `${manifest.publicationFingerprint}_modified`,
    page: {
      ...manifest.page,
      heading: `${manifest.page.heading} Updated`,
    },
  });
  const modifiedSourcePath = await writeJsonTempFile(
    "ipp-materialization-modified.json",
    {
      manifests: [modifiedManifest],
    },
  );
  const modifiedResult = materializeWebPublicationManifests({
    source: await loadWebManifestMaterializationSource({
      sourcePath: modifiedSourcePath,
    }),
    policy: {
      allowEmptyCatalog: false,
    },
  });
  assert.notEqual(
    modifiedResult.catalogFingerprint,
    manifestResult.catalogFingerprint,
  );

  const envelopeValidation = validateWebManifestCatalogEnvelope(
    duplicateResult.envelope,
  );
  assert.equal(envelopeValidation.ok, true);
  assert.equal(
    duplicateResult.envelope.schemaVersion,
    WEB_MANIFEST_CATALOG_SCHEMA_VERSION,
  );
  assert.equal(
    duplicateResult.envelope.generatorVersion,
    WEB_MANIFEST_GENERATOR_VERSION,
  );
  assert.equal(
    duplicateResult.envelope.policyFingerprint.length > 0,
    true,
  );
  assert.equal(
    typeof duplicateResult.envelope.indexes.byManifestId[
      keptDuplicateManifest.manifestId
    ],
    "number",
  );
  assert.equal(
    typeof duplicateResult.envelope.indexes.byCanonicalPath[
      keptDuplicateManifest.publication.canonicalPath
    ],
    "number",
  );
  assert.equal(
    typeof duplicateResult.envelope.indexes.bySlug[
      keptDuplicateManifest.route.canonical.slug
    ],
    "number",
  );
  assert.equal(
    duplicateResult.envelope.indexes.sitemapManifestIds.includes(
      keptDuplicateManifest.manifestId,
    ),
    true,
  );
  assert.equal(
    duplicateResult.envelope.indexes.hubManifestIds.includes(
      keptDuplicateManifest.manifestId,
    ),
    true,
  );

  const unknownSchemaEnvelope = cloneManifest(duplicateResult.envelope) as Record<string, unknown>;
  unknownSchemaEnvelope.schemaVersion = 999;
  const unknownSchemaValidation = validateWebManifestCatalogEnvelope(
    unknownSchemaEnvelope,
  );
  assert.equal(unknownSchemaValidation.ok, false);
  if (unknownSchemaValidation.ok) {
    throw new Error("Expected unknown schemaVersion to fail.");
  }

  const invalidGeneratedAtEnvelope = cloneManifest(
    duplicateResult.envelope,
  ) as Record<string, unknown>;
  invalidGeneratedAtEnvelope.generatedAt = "not-an-iso-date";
  const invalidGeneratedAtValidation = validateWebManifestCatalogEnvelope(
    invalidGeneratedAtEnvelope,
  );
  assert.equal(invalidGeneratedAtValidation.ok, false);

  const emptyGeneratorEnvelope = cloneManifest(
    duplicateResult.envelope,
  ) as Record<string, unknown>;
  emptyGeneratorEnvelope.generatorVersion = "";
  const emptyGeneratorValidation = validateWebManifestCatalogEnvelope(
    emptyGeneratorEnvelope,
  );
  assert.equal(emptyGeneratorValidation.ok, false);

  const incoherentCountEnvelope = cloneManifest(
    duplicateResult.envelope,
  ) as Record<string, unknown>;
  incoherentCountEnvelope.manifestCount = 999;
  const incoherentCountValidation = validateWebManifestCatalogEnvelope(
    incoherentCountEnvelope,
  );
  assert.equal(incoherentCountValidation.ok, false);

  const invalidManifestsEnvelope = cloneManifest(
    duplicateResult.envelope,
  ) as Record<string, unknown>;
  invalidManifestsEnvelope.manifests = {};
  const invalidManifestsValidation = validateWebManifestCatalogEnvelope(
    invalidManifestsEnvelope,
  );
  assert.equal(invalidManifestsValidation.ok, false);

  const duplicateIdEnvelope = cloneManifest(duplicateResult.envelope) as any;
  duplicateIdEnvelope.manifests = [
    keptDuplicateManifest,
    keptDuplicateManifest,
  ];
  duplicateIdEnvelope.manifestCount = 2;
  duplicateIdEnvelope.policyFingerprint =
    keptDuplicateManifest.publication.policyFingerprint;
  duplicateIdEnvelope.catalogFingerprint = "forged";
  const duplicateIdValidation = validateWebManifestCatalogEnvelope(
    duplicateIdEnvelope,
  );
  assert.equal(duplicateIdValidation.ok, false);

  const duplicatePathManifest = deepMergeManifest(
    keptDuplicateManifest,
    {
      manifestId: `${keptDuplicateManifest.manifestId}_same_path`,
      publicationFingerprint: `${keptDuplicateManifest.publicationFingerprint}_same_path`,
    },
  );
  const duplicatePathEnvelope = cloneManifest(duplicateResult.envelope) as any;
  duplicatePathEnvelope.manifests = [
    keptDuplicateManifest,
    duplicatePathManifest,
  ];
  duplicatePathEnvelope.manifestCount = 2;
  duplicatePathEnvelope.policyFingerprint =
    keptDuplicateManifest.publication.policyFingerprint;
  duplicatePathEnvelope.catalogFingerprint = "forged";
  const duplicatePathValidation = validateWebManifestCatalogEnvelope(
    duplicatePathEnvelope,
  );
  assert.equal(duplicatePathValidation.ok, false);

  const duplicateAliasManifest = deepMergeManifest(
    keptDuplicateManifest,
    {
      manifestId: `${keptDuplicateManifest.manifestId}_same_alias`,
      publicationFingerprint: `${keptDuplicateManifest.publicationFingerprint}_same_alias`,
      reportId: `${keptDuplicateManifest.reportId}_same_alias`,
      route: {
        ...keptDuplicateManifest.route,
        canonical: {
          ...keptDuplicateManifest.route.canonical,
          slug: `${keptDuplicateManifest.route.canonical.slug}-same-alias`,
          pathname: `/reports/${keptDuplicateManifest.route.canonical.slug}-same-alias`,
          canonicalPath: `/reports/${keptDuplicateManifest.route.canonical.slug}-same-alias`,
          canonicalUrl: `https://norixo.io/reports/${keptDuplicateManifest.route.canonical.slug}-same-alias`,
          absoluteUrl: `https://norixo.io/reports/${keptDuplicateManifest.route.canonical.slug}-same-alias`,
        },
      },
      publication: {
        ...keptDuplicateManifest.publication,
        canonicalPath: `/reports/${keptDuplicateManifest.route.canonical.slug}-same-alias`,
        canonicalUrl: `https://norixo.io/reports/${keptDuplicateManifest.route.canonical.slug}-same-alias`,
      },
      seo: {
        ...keptDuplicateManifest.seo,
        canonical: `https://norixo.io/reports/${keptDuplicateManifest.route.canonical.slug}-same-alias`,
        openGraph: {
          ...keptDuplicateManifest.seo.openGraph,
          url: `https://norixo.io/reports/${keptDuplicateManifest.route.canonical.slug}-same-alias`,
        },
      },
    },
  );
  const duplicateAliasSourcePath = await writeJsonTempFile(
    "ipp-materialization-duplicate-alias.json",
    {
      manifests: [
        keptDuplicateManifest,
        duplicateAliasManifest,
      ],
    },
  );
  const duplicateAliasResult = materializeWebPublicationManifests({
    source: await loadWebManifestMaterializationSource({
      sourcePath: duplicateAliasSourcePath,
    }),
    policy: {
      allowEmptyCatalog: false,
    },
  });
  assert.equal(duplicateAliasResult.envelope.manifestCount, 1);

  const forgedPolicyEnvelope = cloneManifest(
    duplicateResult.envelope,
  ) as Record<string, unknown>;
  forgedPolicyEnvelope.policyFingerprint = "forged_policy_fingerprint";
  const forgedPolicyValidation = validateWebManifestCatalogEnvelope(
    forgedPolicyEnvelope,
  );
  assert.equal(forgedPolicyValidation.ok, false);

  const forgedCatalogEnvelope = cloneManifest(
    duplicateResult.envelope,
  ) as Record<string, unknown>;
  forgedCatalogEnvelope.catalogFingerprint = "forged_catalog_fingerprint";
  const forgedCatalogValidation = validateWebManifestCatalogEnvelope(
    forgedCatalogEnvelope,
  );
  assert.equal(forgedCatalogValidation.ok, false);

  const forgedByManifestIdEnvelope = cloneManifest(duplicateResult.envelope) as any;
  forgedByManifestIdEnvelope.indexes.byManifestId = {
    [keptDuplicateManifest.manifestId]: 999,
  };
  assert.equal(
    validateWebManifestCatalogEnvelope(forgedByManifestIdEnvelope).ok,
    false,
  );

  const forgedByCanonicalPathEnvelope = cloneManifest(
    duplicateResult.envelope,
  ) as any;
  forgedByCanonicalPathEnvelope.indexes.byCanonicalPath = {
    [keptDuplicateManifest.publication.canonicalPath]: 999,
  };
  assert.equal(
    validateWebManifestCatalogEnvelope(forgedByCanonicalPathEnvelope).ok,
    false,
  );

  const forgedBySlugEnvelope = cloneManifest(duplicateResult.envelope) as any;
  forgedBySlugEnvelope.indexes.bySlug = {
    [keptDuplicateManifest.route.canonical.slug]: 999,
  };
  assert.equal(validateWebManifestCatalogEnvelope(forgedBySlugEnvelope).ok, false);

  const forgedAliasEnvelope = cloneManifest(duplicateResult.envelope) as any;
  const aliasPath =
    Object.keys(forgedAliasEnvelope.indexes.aliases)[0] ??
    "/reports/airbnb-market-report-paris";
  forgedAliasEnvelope.indexes.aliases = {
    [aliasPath]: {
      manifestIndex: 0,
      toPath: "/reports/unknown-destination",
      statusCode: 308,
      aliasType: "historical_static_route",
    },
  };
  assert.equal(validateWebManifestCatalogEnvelope(forgedAliasEnvelope).ok, false);

  const aliasLoopEnvelope = cloneManifest(duplicateResult.envelope) as any;
  aliasLoopEnvelope.indexes.aliases = {
    [aliasPath]: {
      manifestIndex: 0,
      toPath: aliasPath,
      statusCode: 308,
      aliasType: "historical_static_route",
    },
  };
  assert.equal(validateWebManifestCatalogEnvelope(aliasLoopEnvelope).ok, false);

  const aliasCanonicalCollisionEnvelope = cloneManifest(
    duplicateResult.envelope,
  ) as any;
  aliasCanonicalCollisionEnvelope.indexes.aliases = {
    [keptDuplicateManifest.publication.canonicalPath]: {
      manifestIndex: 0,
      toPath: keptDuplicateManifest.publication.canonicalPath,
      statusCode: 308,
      aliasType: "historical_static_route",
    },
  };
  assert.equal(
    validateWebManifestCatalogEnvelope(aliasCanonicalCollisionEnvelope).ok,
    false,
  );

  const forgedSitemapEnvelope = cloneManifest(
    duplicateResult.envelope,
  ) as any;
  forgedSitemapEnvelope.indexes.sitemapManifestIds = ["unknown_manifest"];
  assert.equal(validateWebManifestCatalogEnvelope(forgedSitemapEnvelope).ok, false);

  const forgedHubEnvelope = cloneManifest(duplicateResult.envelope) as any;
  forgedHubEnvelope.indexes.hubManifestIds = ["unknown_manifest"];
  assert.equal(validateWebManifestCatalogEnvelope(forgedHubEnvelope).ok, false);

  const invalidManifestEnvelope = cloneManifest(
    duplicateResult.envelope,
  ) as any;
  invalidManifestEnvelope.manifests = [
    deepMergeManifest(keptDuplicateManifest, {
      page: {
        ...keptDuplicateManifest.page,
        heading: "",
      },
    }),
  ];
  invalidManifestEnvelope.manifestCount = 1;
  invalidManifestEnvelope.policyFingerprint =
    keptDuplicateManifest.publication.policyFingerprint;
  invalidManifestEnvelope.catalogFingerprint = "forged";
  const invalidManifestValidation = validateWebManifestCatalogEnvelope(
    invalidManifestEnvelope,
  );
  assert.equal(invalidManifestValidation.ok, false);

  const emptyEnvelope = materializeWebPublicationManifests({
    source: emptySource,
    policy: {
      allowEmptyCatalog: true,
      generatedAt: GENERATED_AT,
    },
  }).envelope;
  assert.equal(validateWebManifestCatalogEnvelope(emptyEnvelope).ok, true);
  assert.deepEqual(emptyEnvelope.indexes.byManifestId, {});
  assert.deepEqual(emptyEnvelope.indexes.byCanonicalPath, {});
  assert.deepEqual(emptyEnvelope.indexes.bySlug, {});
  assert.deepEqual(emptyEnvelope.indexes.aliases, {});
  assert.deepEqual(emptyEnvelope.indexes.sitemapManifestIds, []);
  assert.deepEqual(emptyEnvelope.indexes.hubManifestIds, []);

  const noindexRenderableManifest = buildSyntheticManifest(manifest, 501, "noindex");
  const noindexRenderableSourcePath = await writeJsonTempFile(
    "ipp-materialization-noindex-renderable.json",
    { manifests: [noindexRenderableManifest] },
  );
  const noindexRenderableResult = materializeWebPublicationManifests({
    source: await loadWebManifestMaterializationSource({
      sourcePath: noindexRenderableSourcePath,
    }),
    policy: {
      allowEmptyCatalog: false,
    },
  });
  assert.equal(noindexRenderableResult.envelope.manifestCount, 1);
  assert.equal(
    noindexRenderableResult.envelope.indexes.byCanonicalPath[
      noindexRenderableManifest.publication.canonicalPath
    ],
    0,
  );
  assert.equal(
    noindexRenderableResult.envelope.indexes.sitemapManifestIds.includes(
      noindexRenderableManifest.manifestId,
    ),
    false,
  );
  assert.equal(
    noindexRenderableResult.envelope.indexes.hubManifestIds.includes(
      noindexRenderableManifest.manifestId,
    ),
    false,
  );

  const syntheticBaseManifest = buildManifest();
  const syntheticManifests = Array.from({ length: 120 }, (_, index) =>
    buildSyntheticManifest(
      syntheticBaseManifest,
      index + 1,
      (index + 1) % 15 === 0
        ? "blocked"
        : (index + 1) % 10 === 0
          ? "noindex"
          : "indexable",
    ),
  );
  const syntheticSourcePath = await writeJsonTempFile(
    "ipp-materialization-synthetic-scale.json",
    { manifests: syntheticManifests },
  );
  const syntheticResult = materializeWebPublicationManifests({
    source: await loadWebManifestMaterializationSource({
      sourcePath: syntheticSourcePath,
    }),
    policy: {
      allowEmptyCatalog: false,
    },
  });
  assert.equal(syntheticResult.envelope.manifestCount >= 100, true);
  assert.equal(
    syntheticResult.envelope.indexes.sitemapManifestIds.length > 0,
    true,
  );
  assert.equal(
    syntheticResult.envelope.indexes.hubManifestIds.length > 0,
    true,
  );
  const firstSyntheticManifestId = syntheticResult.envelope.manifests[0]!.manifestId;
  const middleSyntheticManifestId =
    syntheticResult.envelope.manifests[
      Math.floor(syntheticResult.envelope.manifests.length / 2)
    ]!.manifestId;
  const lastSyntheticManifestId =
    syntheticResult.envelope.manifests.at(-1)!.manifestId;
  assert.equal(
    typeof syntheticResult.envelope.indexes.byManifestId[firstSyntheticManifestId],
    "number",
  );
  assert.equal(
    typeof syntheticResult.envelope.indexes.byManifestId[middleSyntheticManifestId],
    "number",
  );
  assert.equal(
    typeof syntheticResult.envelope.indexes.byManifestId[lastSyntheticManifestId],
    "number",
  );

  const impossibleManifest = deepMergeManifest(manifest, {
    manifestId: `${manifest.manifestId}_impossible`,
    publicationFingerprint: `${manifest.publicationFingerprint}_impossible`,
    publication: {
      ...manifest.publication,
      indexable: false,
      sitemapEligible: true,
    },
  });
  const impossibleSourcePath = await writeJsonTempFile(
    "ipp-materialization-impossible.json",
    impossibleManifest,
  );
  await assert.rejects(
    () =>
      loadWebManifestMaterializationSource({
        sourcePath: impossibleSourcePath,
      }),
    /publication\.indexable|publication\.sitemapEligible|sitemap/i,
  );

  const outputPath = path.join(
    tmpdir(),
    "ipp-web-publication-manifests.generated.json",
  );
  await rm(outputPath, { force: true });
  const firstWrite = await writeWebManifestCatalog({
    envelope: duplicateResult.envelope,
    outputPath,
  });
  assert.equal(firstWrite.status, "written");
  const secondWrite = await writeWebManifestCatalog({
    envelope: duplicateResult.envelope,
    outputPath,
    previousCatalog: duplicateResult.envelope,
  });
  assert.equal(secondWrite.status, "skipped");

  const writtenEnvelope = JSON.parse(await readFile(outputPath, "utf8"));
  const writtenValidation = validateWebManifestCatalogEnvelope(writtenEnvelope);
  assert.equal(writtenValidation.ok, true);

  const dryRunLogs = await captureConsoleInfo(() =>
    runWebManifestMaterializationCli([
      "--dry-run",
      "--allow-empty",
      `--generated-at=${GENERATED_AT}`,
      `--output=${path.join(tmpdir(), "unused.json")}`,
    ]),
  );
  const dryRunJson = parseCliJson(dryRunLogs);
  assert.equal(dryRunJson.mode, "dry-run");
  assert.equal(dryRunJson.manifestCount, 0);

  await assert.rejects(
    () =>
      runWebManifestMaterializationCli([
        "--dry-run",
        "--strict",
        `--generated-at=${GENERATED_AT}`,
      ]),
    /Strict mode/i,
  );

  const cliOutputPath = path.join(
    tmpdir(),
    "ipp-web-publication-manifests-cli.generated.json",
  );
  await rm(cliOutputPath, { force: true });
  const writeLogs = await captureConsoleInfo(() =>
    runWebManifestMaterializationCli([
      "--write",
      `--source=${snapshotPath}`,
      `--output=${cliOutputPath}`,
    ]),
  );
  const writeJson = parseCliJson(writeLogs);
  assert.equal(writeJson.mode, "write");
  assert.equal(writeJson.writeStatus, "written");

  const writeLogsAgain = await captureConsoleInfo(() =>
    runWebManifestMaterializationCli([
      "--write",
      `--source=${snapshotPath}`,
      `--output=${cliOutputPath}`,
    ]),
  );
  const writeJsonAgain = parseCliJson(writeLogsAgain);
  assert.equal(writeJsonAgain.writeStatus, "skipped");

  const generatedWrapperCatalog = JSON.parse(
    await readFile(DEFAULT_WEB_MANIFEST_CATALOG_OUTPUT_PATH, "utf8"),
  ) as WebManifestCatalogEnvelope;
  assert.equal(
    validateWebManifestCatalogEnvelope(generatedWrapperCatalog).ok,
    true,
  );

  console.log("PASS — Intelligence publishing manifest materialization smoke");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";

import type { IntelligencePublishingBatchAction } from "../lib/intelligencePublishing/batchPlanning";
import {
  MAX_INTELLIGENCE_PUBLISHING_CAMPAIGN_REPORTS,
  buildIntelligencePublishingPublicationPlan,
  validateIntelligencePublishingCampaignSpecification,
  validateIntelligencePublishingPublicationPlan,
  type IntelligencePublishingCampaignSpecification,
} from "../lib/intelligencePublishing/campaignPlanning";
import type { MarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import { parseMarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
} from "../lib/intelligencePublishing/registryPopulation";
import type { RegistrySnapshot } from "../lib/intelligencePublishing/registryAdapter";

const GENERATED_AT = "2026-07-22T10:00:00.000Z";
const ALTERNATE_CREATED_AT = "2026-07-22T11:00:00.000Z";

function buildDefinition(
  overrides: Partial<MarketReportDefinition> & {
    reportId: string;
    marketCellKey: string;
    city: string;
    country: string;
    platform: string;
    propertyType: string;
    language: string;
    slug: string;
    benchmarkFingerprint: string;
    overviewFingerprint: string;
  },
): MarketReportDefinition {
  return parseMarketReportDefinition({
    reportVersion: 1,
    title: `${overrides.platform} Market Report ${overrides.city}`,
    policyVersions: {
      pricing_policy: "pricing_v1",
      overview_policy: "overview_v1",
    },
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    metadata: {
      source: "campaign_planning_smoke",
    },
    ...overrides,
  });
}

function buildRegistrySnapshot(
  definitions: readonly MarketReportDefinition[],
): RegistrySnapshot {
  const inputs = definitions.map((definition) => ({
    source: "market_report_definition" as const,
    datasetType: "market_report_definition" as const,
    definition,
    metadata: {
      smoke: true,
    },
  }));
  const locales = [...new Set(definitions.map((definition) => definition.language))];
  const plan = buildRegistryPopulationPlan(inputs, {
    generatedAt: GENERATED_AT,
    evaluatedAt: GENERATED_AT,
    targetLocales: locales,
    composeMarketReports: false,
    metadata: {
      smoke: true,
    },
  });
  return applyRegistryPopulationPlan(plan).nextSnapshot;
}

function withCanonicalPaths(snapshot: RegistrySnapshot): RegistrySnapshot {
  return {
    ...snapshot,
    assets: Object.freeze(
      snapshot.assets.map((asset) => {
        const slug =
          typeof asset.metadata.reportSlug === "string"
            ? asset.metadata.reportSlug
            : asset.canonicalId;
        const locale =
          typeof asset.metadata.reportLanguage === "string"
            ? asset.metadata.reportLanguage
            : asset.defaultLocale;
        return {
          ...asset,
          metadata: Object.freeze({
            ...asset.metadata,
            canonicalPath:
              locale === "en"
                ? `/reports/${slug}`
                : `/${locale}/reports/${slug}`,
          }),
        };
      }),
    ),
  };
}

function buildBaseSnapshot(): RegistrySnapshot {
  return withCanonicalPaths(
    buildRegistrySnapshot([
      buildDefinition({
        reportId: "report_paris_airbnb_apartment_en",
        marketCellKey: "fr:paris:airbnb:apartment",
        city: "Paris",
        country: "fr",
        platform: "airbnb",
        propertyType: "apartment",
        language: "en",
        slug: "airbnb-market-report-paris-apartment",
        benchmarkFingerprint: "pricing_fp_paris_airbnb_apartment",
        overviewFingerprint: "overview_fp_paris_airbnb_apartment",
      }),
      buildDefinition({
        reportId: "report_barcelona_airbnb_apartment_fr",
        marketCellKey: "es:barcelona:airbnb:apartment",
        city: "Barcelona",
        country: "es",
        platform: "airbnb",
        propertyType: "apartment",
        language: "fr",
        slug: "airbnb-market-report-barcelona-apartment",
        benchmarkFingerprint: "pricing_fp_barcelona_airbnb_apartment",
        overviewFingerprint: "overview_fp_barcelona_airbnb_apartment",
      }),
      buildDefinition({
        reportId: "report_madrid_booking_house_en",
        marketCellKey: "es:madrid:booking:house",
        city: "Madrid",
        country: "es",
        platform: "booking",
        propertyType: "house",
        language: "en",
        slug: "booking-market-report-madrid-house",
        benchmarkFingerprint: "pricing_fp_madrid_booking_house",
        overviewFingerprint: "overview_fp_madrid_booking_house",
      }),
      buildDefinition({
        reportId: "report_marseille_airbnb_villa_fr",
        marketCellKey: "fr:marseille:airbnb:villa",
        city: "Marseille",
        country: "fr",
        platform: "airbnb",
        propertyType: "villa",
        language: "fr",
        slug: "airbnb-market-report-marseille-villa",
        benchmarkFingerprint: "pricing_fp_marseille_airbnb_villa",
        overviewFingerprint: "overview_fp_marseille_airbnb_villa",
      }),
      buildDefinition({
        reportId: "report_lisbon_airbnb_room_en",
        marketCellKey: "pt:lisbon:airbnb:room",
        city: "Lisbon",
        country: "pt",
        platform: "airbnb",
        propertyType: "room",
        language: "en",
        slug: "airbnb-market-report-lisbon-room",
        benchmarkFingerprint: "pricing_fp_lisbon_airbnb_room",
        overviewFingerprint: "overview_fp_lisbon_airbnb_room",
      }),
      buildDefinition({
        reportId: "report_valencia_vrbo_apartment_en",
        marketCellKey: "es:valencia:vrbo:apartment",
        city: "Valencia",
        country: "es",
        platform: "vrbo",
        propertyType: "apartment",
        language: "en",
        slug: "vrbo-market-report-valencia-apartment",
        benchmarkFingerprint: "pricing_fp_valencia_vrbo_apartment",
        overviewFingerprint: "overview_fp_valencia_vrbo_apartment",
      }),
    ]),
  );
}

function buildLargeSnapshot(): RegistrySnapshot {
  const locales = ["en", "fr", "es", "de"] as const;
  const markets = [
    { country: "fr", city: "paris" },
    { country: "es", city: "barcelona" },
    { country: "es", city: "madrid" },
    { country: "pt", city: "lisbon" },
    { country: "it", city: "rome" },
    { country: "ma", city: "marrakech" },
    { country: "fr", city: "marseille" },
    { country: "es", city: "seville" },
    { country: "fr", city: "cannes" },
    { country: "pt", city: "porto" },
  ] as const;
  const platforms = ["airbnb", "booking", "vrbo", "agoda", "expedia"] as const;
  const propertyTypes = [
    "apartment",
    "house",
    "villa",
    "room",
    "hotel",
  ] as const;

  const definitions: MarketReportDefinition[] = [];
  for (let index = 0; index < 100; index += 1) {
    const locale = locales[index % locales.length]!;
    const market = markets[index % markets.length]!;
    const platform = platforms[index % platforms.length]!;
    const propertyType = propertyTypes[index % propertyTypes.length]!;
    const slug = `${platform}-market-report-${market.city}-${propertyType}-${locale}-${index
      .toString()
      .padStart(3, "0")}`;
    definitions.push(
      buildDefinition({
        reportId: `report_${index.toString().padStart(3, "0")}`,
        marketCellKey: `${market.country}:${market.city}:${platform}:${propertyType}`,
        city: market.city.charAt(0).toUpperCase() + market.city.slice(1),
        country: market.country,
        platform,
        propertyType,
        language: locale,
        slug,
        benchmarkFingerprint: `pricing_fp_${index}`,
        overviewFingerprint: `overview_fp_${index}`,
      }),
    );
  }
  return withCanonicalPaths(buildRegistrySnapshot(definitions));
}

function buildSpecification(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    schemaVersion: "ipp_campaign_specification_v1",
    campaignVersion: "ipp_campaign_contract_v1",
    campaignKey: "es-airbnb-fr-publish-wave-1",
    name: "FR + EN Airbnb reports in Spain",
    requestedAction: "publish",
    selection: {},
    exclusions: {},
    ordering: {
      strategy: "market_then_locale",
      priorityReportKeys: [
        "airbnb-market-report-barcelona-apartment",
        "airbnb-market-report-paris-apartment",
      ],
    },
    limits: {
      maxReports: 50,
    },
    metadata: {
      wave: "1",
    },
    ...overrides,
  };
}

function expectInvalidSpecification(
  specification: unknown,
  pattern: RegExp,
): void {
  const validation = validateIntelligencePublishingCampaignSpecification(specification);
  assert.equal(validation.ok, false);
  assert.match(
    validation.ok ? "" : validation.issues.map((issue) => issue.message).join(" | "),
    pattern,
  );
}

function buildPlan(
  snapshot: RegistrySnapshot,
  specification: unknown,
  createdAt = GENERATED_AT,
) {
  return buildIntelligencePublishingPublicationPlan({
    registrySnapshot: snapshot,
    specification,
    createdAt,
  });
}

function cloneWithDuplicateLogicalEntry(snapshot: RegistrySnapshot): RegistrySnapshot {
  const asset = snapshot.assets[0]!;
  const version = snapshot.assetVersions.find(
    (candidate) => candidate.assetId === asset.assetId,
  )!;
  return {
    ...snapshot,
    assets: Object.freeze([
      ...snapshot.assets,
      {
        ...asset,
        assetId: `${asset.assetId}_duplicate`,
        activeVersionId: `${version.assetVersionId}_duplicate`,
      },
    ]),
    assetVersions: Object.freeze([
      ...snapshot.assetVersions,
      {
        ...version,
        assetVersionId: `${version.assetVersionId}_duplicate`,
        assetId: `${asset.assetId}_duplicate`,
      },
    ]),
  };
}

function cloneWithIneligibleEntry(snapshot: RegistrySnapshot): RegistrySnapshot {
  return {
    ...snapshot,
    assets: Object.freeze([
      ...snapshot.assets,
      {
        ...snapshot.assets[0]!,
        assetId: "asset_market_report_ineligible",
        canonicalId: "airbnb-market-report-ineligible-apartment",
        activeVersionId: "asset_market_report_ineligible_v1",
        metadata: Object.freeze({
          source: "synthetic_ineligible",
        }),
      },
    ]),
    assetVersions: Object.freeze([
      ...snapshot.assetVersions,
      {
        ...snapshot.assetVersions[0]!,
        assetVersionId: "asset_market_report_ineligible_v1",
        assetId: "asset_market_report_ineligible",
      },
    ]),
  };
}

function main() {
  const baseSnapshot = buildBaseSnapshot();
  const largeSnapshot = buildLargeSnapshot();

  const minimalSpec = buildSpecification({
    selection: {},
    exclusions: {},
    ordering: { strategy: "registry_order" },
    limits: { maxReports: 10 },
    metadata: {},
  });
  const minimalValidation = validateIntelligencePublishingCampaignSpecification(minimalSpec);
  assert.equal(minimalValidation.ok, true);

  const completeValidation = validateIntelligencePublishingCampaignSpecification(
    buildSpecification({
      selection: {
        locales: ["FR", "en"],
        countries: ["ES"],
        platforms: ["Airbnb"],
      },
      exclusions: {
        cities: ["madrid"],
      },
      ordering: {
        strategy: "market_then_locale",
        priorityReportKeys: [
          "airbnb-market-report-barcelona-apartment",
          "airbnb-market-report-paris-apartment",
        ],
      },
      limits: { maxReports: 25 },
      metadata: {
        owner: "seo",
      },
    }),
  );
  assert.equal(completeValidation.ok, true);

  expectInvalidSpecification(
    {
      ...buildSpecification(),
      schemaVersion: "ipp_campaign_specification_v999",
    },
    /schemaVersion/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      campaignVersion: "ipp_campaign_contract_v999",
    },
    /version/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      campaignKey: "Invalid Key",
    },
    /campaignKey/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      requestedAction: "archive",
    },
    /requestedAction/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      selection: {
        locales: [],
      },
    },
    /cannot be an empty array/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      selection: {
        freshness: ["stale"],
      },
    },
    /Unsupported selection dimension/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      ordering: {
        strategy: "business_priority",
      },
    },
    /ordering\.strategy/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      ordering: {
        strategy: "report_key",
        priorityReportKeys: ["a", "a"],
      },
    },
    /duplicates/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      limits: {
        maxReports: 0,
      },
    },
    /maxReports/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      limits: {
        maxReports: -1,
      },
    },
    /maxReports/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      limits: {
        maxReports: 12.5,
      },
    },
    /maxReports/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      limits: {
        maxReports: MAX_INTELLIGENCE_PUBLISHING_CAMPAIGN_REPORTS + 1,
      },
    },
    /maxReports/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      metadata: {
        invalid: new Set(["x"]),
      },
    },
    /JSON-safe/i,
  );
  expectInvalidSpecification(
    {
      ...buildSpecification(),
      metadata: {
        email: "private@example.com",
      },
    },
    /Forbidden private field/i,
  );

  const normalizationValidation = validateIntelligencePublishingCampaignSpecification(
    buildSpecification({
      selection: {
        locales: ["FR", "fr", "EN"],
        countries: ["ES", "es"],
        platforms: ["Airbnb", "airbnb"],
        propertyTypes: ["Apartment", "apartment"],
      },
    }),
  );
  assert.equal(normalizationValidation.ok, true);
  if (normalizationValidation.ok) {
    assert.deepEqual(normalizationValidation.specification.selection.locales, [
      "en",
      "fr",
    ]);
    assert.deepEqual(normalizationValidation.specification.selection.countries, [
      "es",
    ]);
    assert.deepEqual(normalizationValidation.specification.selection.platforms, [
      "airbnb",
    ]);
    assert.deepEqual(
      normalizationValidation.specification.selection.propertyTypes,
      ["apartment"],
    );
  }

  const stableSpecA = validateIntelligencePublishingCampaignSpecification(
    buildSpecification({
      selection: {
        locales: ["fr", "en"],
        countries: ["es", "fr"],
      },
    }),
  );
  const stableSpecB = validateIntelligencePublishingCampaignSpecification(
    buildSpecification({
      selection: {
        countries: ["fr", "es"],
        locales: ["en", "fr"],
      },
    }),
  );
  assert.equal(stableSpecA.ok, true);
  assert.equal(stableSpecB.ok, true);
  if (stableSpecA.ok && stableSpecB.ok) {
    assert.equal(
      stableSpecA.specification.campaignSpecificationFingerprint,
      stableSpecB.specification.campaignSpecificationFingerprint,
    );
  }

  const reversedPriority = validateIntelligencePublishingCampaignSpecification(
    buildSpecification({
      ordering: {
        strategy: "market_then_locale",
        priorityReportKeys: [
          "airbnb-market-report-paris-apartment",
          "airbnb-market-report-barcelona-apartment",
        ],
      },
    }),
  );
  assert.equal(reversedPriority.ok, true);
  if (stableSpecA.ok && reversedPriority.ok) {
    assert.notEqual(
      stableSpecA.specification.campaignSpecificationFingerprint,
      reversedPriority.specification.campaignSpecificationFingerprint,
    );
  }

  const changedMetadata = validateIntelligencePublishingCampaignSpecification(
    buildSpecification({
      metadata: {
        wave: "2",
      },
    }),
  );
  const changedAction = validateIntelligencePublishingCampaignSpecification(
    buildSpecification({
      requestedAction: "refresh" as IntelligencePublishingBatchAction,
    }),
  );
  const changedSelection = validateIntelligencePublishingCampaignSpecification(
    buildSpecification({
      selection: {
        countries: ["fr"],
      },
    }),
  );
  assert.equal(changedMetadata.ok, true);
  assert.equal(changedAction.ok, true);
  assert.equal(changedSelection.ok, true);
  if (stableSpecA.ok && changedMetadata.ok && changedAction.ok && changedSelection.ok) {
    assert.notEqual(
      stableSpecA.specification.campaignSpecificationFingerprint,
      changedMetadata.specification.campaignSpecificationFingerprint,
    );
    assert.notEqual(
      stableSpecA.specification.campaignSpecificationFingerprint,
      changedAction.specification.campaignSpecificationFingerprint,
    );
    assert.notEqual(
      stableSpecA.specification.campaignSpecificationFingerprint,
      changedSelection.specification.campaignSpecificationFingerprint,
    );
  }

  const emptySnapshotPlan = buildPlan(
    {
      ...baseSnapshot,
      assets: Object.freeze([]),
      assetVersions: Object.freeze([]),
      artifactReferences: Object.freeze([]),
      channelVariants: Object.freeze([]),
      freshnessStates: Object.freeze([]),
      publicationStates: Object.freeze([]),
    },
    minimalSpec,
  );
  assert.equal(
    emptySnapshotPlan.warnings.some((warning) => warning.code === "empty_registry"),
    true,
  );

  const emptySelectionPlan = buildPlan(baseSnapshot, minimalSpec);
  assert.equal(emptySelectionPlan.items.length > 0, true);

  const selectReportKeyPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        reportKeys: ["airbnb-market-report-barcelona-apartment"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.deepEqual(
    selectReportKeyPlan.items.map((item) => item.reportKey),
    ["airbnb-market-report-barcelona-apartment"],
  );

  const selectLocalesPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        locales: ["fr"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(selectLocalesPlan.items.every((item) => item.locale === "fr"), true);

  const selectCountriesPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        countries: ["es"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(selectCountriesPlan.items.every((item) => item.country === "es"), true);

  const selectCitiesPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        cities: ["barcelona"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(selectCitiesPlan.items.every((item) => item.city === "barcelona"), true);

  const selectPlatformsPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        platforms: ["airbnb"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(
    selectPlatformsPlan.items.every((item) => item.platform === "airbnb"),
    true,
  );

  const selectPropertyTypesPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        propertyTypes: ["apartment"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(
    selectPropertyTypesPlan.items.every((item) => item.propertyType === "apartment"),
    true,
  );

  const orPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        locales: ["fr", "en"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(
    new Set(orPlan.items.map((item) => item.locale)).size >= 2,
    true,
  );

  const andPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        locales: ["fr", "en"],
        countries: ["es"],
        platforms: ["airbnb"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(
    andPlan.items.every(
      (item) =>
        ["fr", "en"].includes(item.locale) &&
        item.country === "es" &&
        item.platform === "airbnb",
    ),
    true,
  );

  const exclusionPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        countries: ["es"],
      },
      exclusions: {
        cities: ["barcelona"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(exclusionPlan.items.some((item) => item.city === "barcelona"), false);
  assert.equal(
    exclusionPlan.warnings.some((warning) => warning.code === "excluded_selected_item"),
    true,
  );

  const noMatchPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        cities: ["tokyo"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(noMatchPlan.items.length, 0);
  assert.equal(
    noMatchPlan.warnings.some((warning) => warning.code === "selection_matched_nothing"),
    true,
  );

  const priorityPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {},
      ordering: {
        strategy: "report_key",
        priorityReportKeys: [
          "airbnb-market-report-barcelona-apartment",
          "airbnb-market-report-paris-apartment",
        ],
      },
      limits: { maxReports: 10 },
    }),
  );
  assert.deepEqual(
    priorityPlan.items.slice(0, 2).map((item) => item.reportKey),
    [
      "airbnb-market-report-barcelona-apartment",
      "airbnb-market-report-paris-apartment",
    ],
  );

  const unknownPriorityPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      ordering: {
        strategy: "report_key",
        priorityReportKeys: [
          "unknown-report-key",
          "airbnb-market-report-barcelona-apartment",
        ],
      },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(
    unknownPriorityPlan.warnings.some(
      (warning) =>
        warning.code === "unknown_priority_report_key" &&
        warning.metadata.reportKey === "unknown-report-key",
    ),
    true,
  );

  const registryOrderPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      ordering: { strategy: "registry_order" },
      limits: { maxReports: 10 },
    }),
  );
  assert.deepEqual(
    registryOrderPlan.items.map((item) => item.reportKey),
    [
      "airbnb-market-report-barcelona-apartment",
      "airbnb-market-report-lisbon-room",
      "booking-market-report-madrid-house",
      "airbnb-market-report-marseille-villa",
      "airbnb-market-report-paris-apartment",
      "vrbo-market-report-valencia-apartment",
    ],
  );

  const canonicalPathPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      ordering: { strategy: "canonical_path" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(
    canonicalPathPlan.items[0]!.canonicalPath! <=
      canonicalPathPlan.items[1]!.canonicalPath!,
    true,
  );

  const reportKeyPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.deepEqual(
    reportKeyPlan.items.map((item) => item.reportKey),
    [...reportKeyPlan.items.map((item) => item.reportKey)].sort(),
  );

  const marketThenLocalePlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      ordering: { strategy: "market_then_locale" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(
    marketThenLocalePlan.items[0]!.country <= marketThenLocalePlan.items[1]!.country,
    true,
  );

  assert.equal(
    new Set(marketThenLocalePlan.items.map((item) => item.planItemFingerprint)).size,
    marketThenLocalePlan.items.length,
  );

  const maxReportsPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      ordering: { strategy: "report_key" },
      limits: { maxReports: 2 },
    }),
  );
  assert.equal(maxReportsPlan.items.length, 2);
  assert.equal(maxReportsPlan.summary.truncatedCount, 4);
  assert.equal(maxReportsPlan.summary.plannedCount, 2);
  assert.equal(maxReportsPlan.summary.eligibleCount, 6);
  assert.deepEqual(
    maxReportsPlan.items.map((item) => item.index),
    [0, 1],
  );

  const stablePlanA = buildPlan(
    baseSnapshot,
    buildSpecification({
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  const stablePlanB = buildPlan(
    baseSnapshot,
    buildSpecification({
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
    ALTERNATE_CREATED_AT,
  );
  assert.equal(stablePlanA.planFingerprint, stablePlanB.planFingerprint);

  const reversedAssetSnapshot = {
    ...baseSnapshot,
    assets: Object.freeze([...baseSnapshot.assets].reverse()),
  };
  const reversedReportKeyPlan = buildPlan(
    reversedAssetSnapshot,
    buildSpecification({
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(stablePlanA.planFingerprint, reversedReportKeyPlan.planFingerprint);

  const reversedRegistryOrderPlan = buildPlan(
    reversedAssetSnapshot,
    buildSpecification({
      ordering: { strategy: "registry_order" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(
    validateIntelligencePublishingPublicationPlan(reversedRegistryOrderPlan).ok,
    true,
  );

  const differentSnapshotPlan = buildPlan(
    withCanonicalPaths(
      buildRegistrySnapshot([
        buildDefinition({
          reportId: "report_new_airbnb_apartment_en",
          marketCellKey: "gb:london:airbnb:apartment",
          city: "London",
          country: "gb",
          platform: "airbnb",
          propertyType: "apartment",
          language: "en",
          slug: "airbnb-market-report-london-apartment",
          benchmarkFingerprint: "pricing_fp_london",
          overviewFingerprint: "overview_fp_london",
        }),
      ]),
    ),
    minimalSpec,
  );
  assert.notEqual(stablePlanA.planFingerprint, differentSnapshotPlan.planFingerprint);

  const differentSpecPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        platforms: ["booking"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.notEqual(stablePlanA.planFingerprint, differentSpecPlan.planFingerprint);

  const addItemPlan = buildPlan(
    largeSnapshot,
    buildSpecification({
      selection: {
        locales: ["fr", "en"],
        platforms: ["airbnb"],
      },
      exclusions: {
        cities: ["porto"],
      },
      ordering: {
        strategy: "market_then_locale",
        priorityReportKeys: [
          "airbnb-market-report-barcelona-villa-fr-001",
          "airbnb-market-report-madrid-room-en-002",
        ],
      },
      limits: { maxReports: 50 },
    }),
  );
  const removeItemPlan = buildPlan(
    largeSnapshot,
    buildSpecification({
      selection: {
        locales: ["fr", "en"],
        platforms: ["airbnb"],
      },
      exclusions: {
        cities: ["porto", "rome"],
      },
      ordering: {
        strategy: "market_then_locale",
        priorityReportKeys: [
          "airbnb-market-report-barcelona-villa-fr-001",
          "airbnb-market-report-madrid-room-en-002",
        ],
      },
      limits: { maxReports: 50 },
    }),
  );
  assert.notEqual(addItemPlan.planFingerprint, removeItemPlan.planFingerprint);

  const changedActionPlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      requestedAction: "refresh" as IntelligencePublishingBatchAction,
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.notEqual(stablePlanA.planFingerprint, changedActionPlan.planFingerprint);

  const changedLocalePlan = buildPlan(
    baseSnapshot,
    buildSpecification({
      selection: {
        locales: ["fr"],
      },
      ordering: { strategy: "report_key" },
      limits: { maxReports: 10 },
    }),
  );
  assert.notEqual(stablePlanA.planFingerprint, changedLocalePlan.planFingerprint);

  assert.equal(validateIntelligencePublishingPublicationPlan(stablePlanA).ok, true);
  assert.equal(
    validateIntelligencePublishingPublicationPlan({
      ...stablePlanA,
      planFingerprint: `${stablePlanA.planFingerprint}_tampered`,
    }).ok,
    false,
  );
  assert.equal(
    validateIntelligencePublishingPublicationPlan({
      ...stablePlanA,
      items: Object.freeze([
        {
          ...stablePlanA.items[0]!,
          planItemFingerprint: `${stablePlanA.items[0]!.planItemFingerprint}_tampered`,
        },
        ...stablePlanA.items.slice(1),
      ]),
    }).ok,
    false,
  );
  assert.equal(
    validateIntelligencePublishingPublicationPlan({
      ...stablePlanA,
      summary: {
        ...stablePlanA.summary,
        plannedCount: 999,
      },
    }).ok,
    false,
  );

  const duplicateSnapshotPlan = buildPlan(
    cloneWithDuplicateLogicalEntry(baseSnapshot),
    buildSpecification({
      ordering: { strategy: "registry_order" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(
    duplicateSnapshotPlan.warnings.some(
      (warning) => warning.code === "duplicate_registry_entry_ignored",
    ),
    true,
  );

  const ineligibleSnapshotPlan = buildPlan(
    cloneWithIneligibleEntry(baseSnapshot),
    buildSpecification({
      ordering: { strategy: "registry_order" },
      limits: { maxReports: 10 },
    }),
  );
  assert.equal(
    ineligibleSnapshotPlan.warnings.some(
      (warning) => warning.code === "unsupported_entry_skipped",
    ),
    true,
  );

  assert.equal(stablePlanA.warnings.every((warning) => typeof warning.code === "string"), true);
  assert.equal(
    stablePlanA.diagnostics.some(
      (diagnostic) => diagnostic.code === "publication_plan_materialized",
    ),
    true,
  );

  expectInvalidSpecification(
    {
      ...buildSpecification(),
      metadata: {
        userId: "private",
      },
    },
    /Forbidden private field/i,
  );

  const planPrivacyCheck = JSON.stringify(stablePlanA);
  assert.equal(planPrivacyCheck.includes("private@example.com"), false);
  assert.equal(planPrivacyCheck.includes("userId"), false);

  const lotPlan = buildPlan(
    largeSnapshot,
    buildSpecification({
      selection: {
        locales: ["fr", "en"],
        platforms: ["airbnb"],
      },
      exclusions: {
        cities: ["porto"],
      },
      ordering: {
        strategy: "market_then_locale",
        priorityReportKeys: [
          "airbnb-market-report-barcelona-villa-fr-001",
          "airbnb-market-report-madrid-room-en-002",
        ],
      },
      limits: { maxReports: 50 },
      metadata: {
        wave: "lot-100",
      },
    }),
  );
  assert.equal(lotPlan.summary.registryEntryCount, 100);
  assert.equal(lotPlan.items.length <= 50, true);
  assert.equal(lotPlan.summary.plannedCount, lotPlan.items.length);
  assert.equal(
    new Set(lotPlan.items.map((item) => item.planItemFingerprint)).size,
    lotPlan.items.length,
  );
  assert.equal(validateIntelligencePublishingPublicationPlan(lotPlan).ok, true);

  console.log("PASS — Intelligence publishing campaign planning smoke");
}

main();

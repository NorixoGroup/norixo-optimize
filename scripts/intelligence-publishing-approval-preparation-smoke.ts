import assert from "node:assert/strict";

import type { IntelligencePublishingBatchAction } from "../lib/intelligencePublishing/batchPlanning";
import {
  buildIntelligencePublishingApprovalPreparationBundle,
  validateIntelligencePublishingApprovalPreparationBundle,
  validateIntelligencePublishingExecutionRequest,
  type IntelligencePublishingApprovalPreparationBundle,
  type IntelligencePublishingApprovalPreparationError,
} from "../lib/intelligencePublishing/approvalPreparation";
import {
  buildIntelligencePublishingExecutionApprovalRequest,
} from "../lib/intelligencePublishing/approvalGrant";
import {
  buildIntelligencePublishingPublicationPlan,
  buildIntelligencePublishingPublicationPlanCandidateFingerprint,
  buildIntelligencePublishingPublicationPlanFingerprint,
  buildIntelligencePublishingPublicationPlanItemFingerprint,
  validateIntelligencePublishingPublicationPlan,
  type IntelligencePublishingPublicationPlan,
  type IntelligencePublishingPublicationPlanItem,
} from "../lib/intelligencePublishing/campaignPlanning";
import type { MarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import { parseMarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
} from "../lib/intelligencePublishing/registryPopulation";
import type { RegistrySnapshot } from "../lib/intelligencePublishing/registryAdapter";

const GENERATED_AT = "2026-07-22T10:00:00.000Z";
const CREATED_AT = "2026-07-22T10:30:00.000Z";
const ALT_CREATED_AT = "2026-07-22T11:30:00.000Z";

const DEFAULT_GATE_POLICY = Object.freeze({
  approvalRequired: true,
  maxExecuteBatchSize: 250,
  allowlistReportKeys: null,
});

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
      source: "approval_preparation_smoke",
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
    ]),
  );
}

function buildSingleParisSnapshot(): RegistrySnapshot {
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
  action: IntelligencePublishingBatchAction,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    schemaVersion: "ipp_campaign_specification_v1",
    campaignVersion: "ipp_campaign_contract_v1",
    campaignKey: `${action}-campaign`,
    name: `${action} campaign`,
    requestedAction: action,
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
      smoke: true,
      action,
    },
    ...overrides,
  };
}

function buildPlan(
  snapshot: RegistrySnapshot,
  action: IntelligencePublishingBatchAction,
  specificationOverrides?: Record<string, unknown>,
): IntelligencePublishingPublicationPlan {
  return buildIntelligencePublishingPublicationPlan({
    specification: buildSpecification(action, specificationOverrides),
    registrySnapshot: snapshot,
    createdAt: CREATED_AT,
  });
}

function rebuildPlanItem(
  item: IntelligencePublishingPublicationPlanItem,
  overrides?: Partial<IntelligencePublishingPublicationPlanItem> & {
    candidateFingerprint?: string;
  },
): IntelligencePublishingPublicationPlanItem {
  const base = {
    index: overrides?.index ?? item.index,
    reportKey: overrides?.reportKey ?? item.reportKey,
    requestedAction: overrides?.requestedAction ?? item.requestedAction,
    locale: overrides?.locale ?? item.locale,
    country: overrides?.country ?? item.country,
    city: overrides?.city ?? item.city,
    platform: overrides?.platform ?? item.platform,
    propertyType: overrides?.propertyType ?? item.propertyType,
    canonicalPath:
      overrides?.canonicalPath === undefined
        ? item.canonicalPath
        : overrides.canonicalPath,
    sourceFingerprint:
      overrides?.sourceFingerprint === undefined
        ? item.sourceFingerprint
        : overrides.sourceFingerprint,
    priorityRank:
      overrides?.priorityRank === undefined
        ? item.priorityRank
        : overrides.priorityRank,
    isPriority: overrides?.isPriority ?? item.isPriority,
    candidateFingerprint:
      overrides?.candidateFingerprint ??
      buildIntelligencePublishingPublicationPlanCandidateFingerprint({
        reportKey: overrides?.reportKey ?? item.reportKey,
        requestedAction: overrides?.requestedAction ?? item.requestedAction,
        locale: overrides?.locale ?? item.locale,
        country: overrides?.country ?? item.country,
        city: overrides?.city ?? item.city,
        platform: overrides?.platform ?? item.platform,
        propertyType: overrides?.propertyType ?? item.propertyType,
        sourceFingerprint:
          overrides?.sourceFingerprint === undefined
            ? item.sourceFingerprint
            : overrides.sourceFingerprint,
      }),
  };

  return {
    ...base,
    planItemFingerprint:
      buildIntelligencePublishingPublicationPlanItemFingerprint(base),
  };
}

function rebuildPlan(
  plan: IntelligencePublishingPublicationPlan,
  overrides?: Partial<IntelligencePublishingPublicationPlan> & {
    items?: readonly IntelligencePublishingPublicationPlanItem[];
  },
): IntelligencePublishingPublicationPlan {
  const base = {
    schemaVersion: overrides?.schemaVersion ?? plan.schemaVersion,
    planVersion: overrides?.planVersion ?? plan.planVersion,
    campaignKey: overrides?.campaignKey ?? plan.campaignKey,
    requestedAction: overrides?.requestedAction ?? plan.requestedAction,
    campaignSpecificationFingerprint:
      overrides?.campaignSpecificationFingerprint ??
      plan.campaignSpecificationFingerprint,
    registryFingerprint: overrides?.registryFingerprint ?? plan.registryFingerprint,
    createdAt: overrides?.createdAt ?? plan.createdAt,
    summary: overrides?.summary ?? plan.summary,
    items: overrides?.items ?? plan.items,
    warnings: overrides?.warnings ?? plan.warnings,
    diagnostics: overrides?.diagnostics ?? plan.diagnostics,
  };
  return {
    ...base,
    planFingerprint: buildIntelligencePublishingPublicationPlanFingerprint(base),
  };
}

function reverseSnapshot(snapshot: RegistrySnapshot): RegistrySnapshot {
  const clone = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
  for (const key of [
    "assets",
    "assetVersions",
    "artifactReferences",
    "channelVariants",
    "freshnessStates",
    "publicationStates",
  ] as const) {
    clone[key] = [...((clone[key] as unknown[]) ?? [])].reverse();
  }
  return clone as RegistrySnapshot;
}

function duplicateFirstLogicalCandidate(snapshot: RegistrySnapshot): RegistrySnapshot {
  const clone = JSON.parse(JSON.stringify(snapshot)) as RegistrySnapshot;
  const firstAsset = clone.assets[0]!;
  const firstVersion = clone.assetVersions.find(
    (version) => version.assetId === firstAsset.assetId,
  )!;
  const duplicatedAssetId = `${firstAsset.assetId}_duplicate`;
  const duplicatedVersionId = `${firstVersion.assetVersionId}_duplicate`;

  return {
    ...clone,
    assets: Object.freeze([
      ...clone.assets,
      {
        ...firstAsset,
        assetId: duplicatedAssetId,
        activeVersionId: duplicatedVersionId,
      },
    ]),
    assetVersions: Object.freeze([
      ...clone.assetVersions,
      {
        ...firstVersion,
        assetId: duplicatedAssetId,
        assetVersionId: duplicatedVersionId,
      },
    ]),
  };
}

function buildBundle(
  input: Partial<Parameters<typeof buildIntelligencePublishingApprovalPreparationBundle>[0]> & {
    publicationPlan: unknown;
    registrySnapshot: unknown;
  },
): IntelligencePublishingApprovalPreparationBundle {
  return buildIntelligencePublishingApprovalPreparationBundle({
    requestedAction: "publish",
    executionMode: "execute",
    gatePolicy: DEFAULT_GATE_POLICY,
    createdAt: CREATED_AT,
    ...input,
  });
}

function expectPreparationError(
  fn: () => unknown,
  code: string,
): IntelligencePublishingApprovalPreparationError {
  let captured: unknown = null;
  try {
    fn();
  } catch (error) {
    captured = error;
  }
  assert.ok(captured instanceof Error);
  assert.equal(
    (captured as IntelligencePublishingApprovalPreparationError).code,
    code,
  );
  return captured as IntelligencePublishingApprovalPreparationError;
}

function assertNoSensitiveFields(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const fragment of [
    "password",
    "secret",
    "authorization",
    "cookie",
    "listingUrl",
    "rawListing",
  ]) {
    assert.equal(serialized.includes(fragment), false);
  }
}

async function main() {
  const baseSnapshot = buildBaseSnapshot();
  const basePlan = buildPlan(baseSnapshot, "publish");
  const validation = validateIntelligencePublishingPublicationPlan(basePlan);
  assert.equal(validation.ok, true);

  const minimalPlan = buildPlan(baseSnapshot, "publish", {
    selection: {
      reportKeys: ["airbnb-market-report-barcelona-apartment"],
    },
    ordering: {
      strategy: "report_key",
      priorityReportKeys: [],
    },
  });

  const minimalBundle = buildBundle({
    publicationPlan: minimalPlan,
    registrySnapshot: baseSnapshot,
  });
  assert.equal(validateIntelligencePublishingApprovalPreparationBundle(minimalBundle).ok, true);
  assert.equal(validateIntelligencePublishingExecutionRequest(minimalBundle.executionRequest).ok, true);
  assert.equal(minimalBundle.summary.publicationPlanItemCount, 1);
  assert.equal(minimalBundle.summary.materializedCandidateCount, 1);
  assert.equal(minimalBundle.executionApprovalRequest.candidateCount, 1);

  const multiBundle = buildBundle({
    publicationPlan: basePlan,
    registrySnapshot: baseSnapshot,
  });
  assert.equal(validateIntelligencePublishingApprovalPreparationBundle(multiBundle).ok, true);
  assert.equal(multiBundle.summary.publicationPlanItemCount, basePlan.items.length);
  assert.equal(multiBundle.summary.materializedCandidateCount, basePlan.items.length);
  assert.deepEqual(
    multiBundle.executionRequest.candidateFingerprintsInOrder,
    basePlan.items.map((item) => item.candidateFingerprint),
  );
  assert.equal(
    multiBundle.executionApprovalRequest.registryFingerprint,
    basePlan.registryFingerprint,
  );
  assert.equal(
    multiBundle.executionApprovalRequest.candidateCount,
    basePlan.items.length,
  );
  assert.deepEqual(
    multiBundle.executionApprovalRequest.requestedActions,
    ["publish"],
  );
  assert.deepEqual(
    multiBundle.executionApprovalRequest.reportKeys,
    [...new Set(multiBundle.executionRequest.reportKeysInOrder)].sort(),
  );
  assert.equal(
    multiBundle.executionRequest.gatePolicyFingerprint,
    multiBundle.executionApprovalRequest.gatePolicyFingerprint,
  );

  const directApprovalRequest = buildIntelligencePublishingExecutionApprovalRequest({
    registryFingerprint: multiBundle.executionRequest.registryFingerprint,
    mode: "execute",
    candidates: multiBundle.executionRequest.candidates,
    gatePolicy: DEFAULT_GATE_POLICY,
  });
  assert.deepEqual(multiBundle.executionApprovalRequest, directApprovalRequest);

  const sameBundleDifferentCreatedAt = buildIntelligencePublishingApprovalPreparationBundle({
    publicationPlan: basePlan,
    registrySnapshot: baseSnapshot,
    requestedAction: "publish",
    executionMode: "execute",
    gatePolicy: DEFAULT_GATE_POLICY,
    createdAt: ALT_CREATED_AT,
  });
  assert.equal(
    multiBundle.executionRequest.executionRequestFingerprint,
    sameBundleDifferentCreatedAt.executionRequest.executionRequestFingerprint,
  );
  assert.equal(
    multiBundle.bundleFingerprint,
    sameBundleDifferentCreatedAt.bundleFingerprint,
  );

  const reversedSnapshot = reverseSnapshot(baseSnapshot);
  const reversedBundle = buildBundle({
    publicationPlan: basePlan,
    registrySnapshot: reversedSnapshot,
  });
  assert.equal(reversedBundle.bundleFingerprint, multiBundle.bundleFingerprint);
  assert.equal(
    reversedBundle.executionRequest.executionRequestFingerprint,
    multiBundle.executionRequest.executionRequestFingerprint,
  );
  assert.equal(
    reversedBundle.executionApprovalRequest.requestFingerprint,
    multiBundle.executionApprovalRequest.requestFingerprint,
  );

  const generatePlan = buildPlan(baseSnapshot, "generate");
  const generateBundle = buildIntelligencePublishingApprovalPreparationBundle({
    publicationPlan: generatePlan,
    registrySnapshot: baseSnapshot,
    requestedAction: "generate",
    executionMode: "execute",
    gatePolicy: DEFAULT_GATE_POLICY,
    createdAt: CREATED_AT,
  });
  assert.equal(generateBundle.requestedAction, "generate");
  assert.deepEqual(generateBundle.executionApprovalRequest.requestedActions, ["generate"]);

  const publishPlan = buildPlan(baseSnapshot, "publish");
  const publishBundle = buildBundle({
    publicationPlan: publishPlan,
    registrySnapshot: baseSnapshot,
  });
  assert.equal(publishBundle.requestedAction, "publish");

  const refreshPlan = buildPlan(baseSnapshot, "refresh");
  const refreshBundle = buildIntelligencePublishingApprovalPreparationBundle({
    publicationPlan: refreshPlan,
    registrySnapshot: baseSnapshot,
    requestedAction: "refresh",
    executionMode: "execute",
    gatePolicy: DEFAULT_GATE_POLICY,
    createdAt: CREATED_AT,
  });
  assert.equal(refreshBundle.requestedAction, "refresh");
  assert.deepEqual(refreshBundle.executionApprovalRequest.requestedActions, ["refresh"]);
  assert.notEqual(
    generateBundle.executionRequest.executionRequestFingerprint,
    publishBundle.executionRequest.executionRequestFingerprint,
  );
  assert.notEqual(
    generateBundle.bundleFingerprint,
    publishBundle.bundleFingerprint,
  );
  assert.notEqual(
    refreshBundle.executionRequest.executionRequestFingerprint,
    publishBundle.executionRequest.executionRequestFingerprint,
  );
  assert.notEqual(
    refreshBundle.bundleFingerprint,
    publishBundle.bundleFingerprint,
  );

  expectPreparationError(
    () =>
      buildIntelligencePublishingApprovalPreparationBundle({
        publicationPlan: publishPlan,
        registrySnapshot: baseSnapshot,
        requestedAction: "refresh",
        executionMode: "execute",
        gatePolicy: DEFAULT_GATE_POLICY,
        createdAt: CREATED_AT,
      }),
    "requested_action_mismatch",
  );

  expectPreparationError(
    () =>
      buildIntelligencePublishingApprovalPreparationBundle({
        publicationPlan: publishPlan,
        registrySnapshot: baseSnapshot,
        requestedAction: "publish",
        executionMode: "dry_run" as never,
        gatePolicy: DEFAULT_GATE_POLICY,
        createdAt: CREATED_AT,
      }),
    "execution_request_invalid",
  );

  expectPreparationError(
    () =>
      buildIntelligencePublishingApprovalPreparationBundle({
        publicationPlan: publishPlan,
        registrySnapshot: baseSnapshot,
        requestedAction: "publish",
        executionMode: "unknown" as never,
        gatePolicy: DEFAULT_GATE_POLICY,
        createdAt: CREATED_AT,
      }),
    "execution_request_invalid",
  );

  expectPreparationError(
    () =>
      buildBundle({
        publicationPlan: publishPlan,
        registrySnapshot: { bad: true },
      }),
    "invalid_registry_snapshot",
  );

  expectPreparationError(
    () =>
      buildBundle({
        publicationPlan: rebuildPlan(basePlan, {
          registryFingerprint: "registry_fp_mismatch",
        }),
        registrySnapshot: baseSnapshot,
      }),
    "registry_fingerprint_mismatch",
  );

  const tamperedPlan = {
    ...basePlan,
    planFingerprint: "ipp_publication_plan_tampered",
  };
  expectPreparationError(
    () =>
      buildBundle({
        publicationPlan: tamperedPlan,
        registrySnapshot: baseSnapshot,
      }),
    "invalid_publication_plan",
  );

  const tamperedItemPlan = rebuildPlan(basePlan, {
    items: [
      {
        ...basePlan.items[0]!,
        planItemFingerprint: "ipp_publication_plan_item_tampered",
      },
      ...basePlan.items.slice(1),
    ],
  });
  expectPreparationError(
    () =>
      buildBundle({
        publicationPlan: tamperedItemPlan,
        registrySnapshot: baseSnapshot,
      }),
    "invalid_publication_plan",
  );

  const emptyPlan = buildPlan(baseSnapshot, "publish", {
    selection: {
      reportKeys: ["missing-report-key"],
    },
  });
  assert.equal(emptyPlan.items.length, 0);
  expectPreparationError(
    () =>
      buildBundle({
        publicationPlan: emptyPlan,
        registrySnapshot: baseSnapshot,
      }),
    "empty_publication_plan_not_executable",
  );

  const missingCandidatePlan = rebuildPlan(minimalPlan, {
    items: [
      rebuildPlanItem(minimalPlan.items[0]!, {
        reportKey: "airbnb-market-report-unknown-city-apartment",
      }),
    ],
  });
  expectPreparationError(
    () =>
      buildBundle({
        publicationPlan: missingCandidatePlan,
        registrySnapshot: baseSnapshot,
      }),
    "report_key_mismatch",
  );

  const localeMismatchPlan = rebuildPlan(minimalPlan, {
    items: [
      rebuildPlanItem(minimalPlan.items[0]!, {
        locale: "de",
      }),
    ],
  });
  expectPreparationError(
    () =>
      buildBundle({
        publicationPlan: localeMismatchPlan,
        registrySnapshot: baseSnapshot,
      }),
    "locale_mismatch",
  );

  const sourceMismatchPlan = rebuildPlan(minimalPlan, {
    items: [
      rebuildPlanItem(minimalPlan.items[0]!, {
        sourceFingerprint: "source_fp_different",
      }),
    ],
  });
  expectPreparationError(
    () =>
      buildBundle({
        publicationPlan: sourceMismatchPlan,
        registrySnapshot: baseSnapshot,
      }),
    "source_fingerprint_mismatch",
  );

  const itemActionMismatchPlan = rebuildPlan(minimalPlan, {
    items: [
      rebuildPlanItem(minimalPlan.items[0]!, {
        requestedAction: "refresh",
      }),
    ],
  });
  expectPreparationError(
    () =>
      buildBundle({
        publicationPlan: itemActionMismatchPlan,
        registrySnapshot: baseSnapshot,
      }),
    "requested_action_mismatch",
  );

  const ambiguousSnapshot = duplicateFirstLogicalCandidate(buildSingleParisSnapshot());
  const ambiguousPlan = buildPlan(ambiguousSnapshot, "publish", {
    selection: {
      reportKeys: ["airbnb-market-report-paris-apartment"],
    },
  });
  expectPreparationError(
    () =>
      buildBundle({
        publicationPlan: ambiguousPlan,
        registrySnapshot: ambiguousSnapshot,
      }),
    "ambiguous_plan_item_candidate",
  );

  const orderByReportKeyPlan = buildPlan(baseSnapshot, "publish", {
    ordering: {
      strategy: "report_key",
      priorityReportKeys: [],
    },
  });
  const orderByCanonicalPathPlan = buildPlan(baseSnapshot, "publish", {
    ordering: {
      strategy: "canonical_path",
      priorityReportKeys: [],
    },
  });
  const orderByReportKeyBundle = buildBundle({
    publicationPlan: orderByReportKeyPlan,
    registrySnapshot: baseSnapshot,
  });
  const orderByCanonicalPathBundle = buildBundle({
    publicationPlan: orderByCanonicalPathPlan,
    registrySnapshot: baseSnapshot,
  });
  assert.notEqual(
    minimalBundle.executionRequest.executionRequestFingerprint,
    multiBundle.executionRequest.executionRequestFingerprint,
  );
  assert.notEqual(minimalBundle.bundleFingerprint, multiBundle.bundleFingerprint);
  assert.notEqual(
    orderByReportKeyBundle.executionRequest.executionRequestFingerprint,
    orderByCanonicalPathBundle.executionRequest.executionRequestFingerprint,
  );
  assert.notEqual(
    orderByReportKeyBundle.bundleFingerprint,
    orderByCanonicalPathBundle.bundleFingerprint,
  );

  const allowlistPolicyBundle = buildIntelligencePublishingApprovalPreparationBundle({
    publicationPlan: basePlan,
    registrySnapshot: baseSnapshot,
    requestedAction: "publish",
    executionMode: "execute",
    gatePolicy: {
      approvalRequired: true,
      maxExecuteBatchSize: 250,
      allowlistReportKeys: ["airbnb-market-report-barcelona-apartment"],
    },
    createdAt: CREATED_AT,
  });
  assert.notEqual(
    allowlistPolicyBundle.executionApprovalRequest.requestFingerprint,
    multiBundle.executionApprovalRequest.requestFingerprint,
  );
  assert.notEqual(
    allowlistPolicyBundle.bundleFingerprint,
    multiBundle.bundleFingerprint,
  );

  const differentRegistrySnapshot = withCanonicalPaths(
    buildRegistrySnapshot([
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
    ]),
  );
  const differentRegistryPlan = buildPlan(differentRegistrySnapshot, "publish");
  const differentRegistryBundle = buildBundle({
    publicationPlan: differentRegistryPlan,
    registrySnapshot: differentRegistrySnapshot,
  });
  assert.notEqual(differentRegistryBundle.bundleFingerprint, minimalBundle.bundleFingerprint);

  const approvalRequestTampered = {
    ...multiBundle,
    executionApprovalRequest: {
      ...multiBundle.executionApprovalRequest,
      requestFingerprint: "ipp_execution_approval_request_tampered",
    },
  };
  assert.equal(
    validateIntelligencePublishingApprovalPreparationBundle(approvalRequestTampered).ok,
    false,
  );

  const approvalRequestScopeMismatch = {
    ...multiBundle,
    executionApprovalRequest: {
      ...multiBundle.executionApprovalRequest,
      reportKeys: ["other-report-key"],
    },
  };
  assert.equal(
    validateIntelligencePublishingApprovalPreparationBundle(
      approvalRequestScopeMismatch,
    ).ok,
    false,
  );

  const summaryTampered = {
    ...multiBundle,
    summary: {
      ...multiBundle.summary,
      uniqueReportKeyCount: 999,
    },
  };
  assert.equal(validateIntelligencePublishingApprovalPreparationBundle(summaryTampered).ok, false);

  const candidateCountTampered = {
    ...multiBundle,
    executionRequest: {
      ...multiBundle.executionRequest,
      candidateCount: 999,
    },
  };
  assert.equal(
    validateIntelligencePublishingApprovalPreparationBundle(candidateCountTampered).ok,
    false,
  );

  const reportKeysTampered = {
    ...multiBundle,
    executionRequest: {
      ...multiBundle.executionRequest,
      reportKeysInOrder: ["tampered"],
    },
  };
  assert.equal(
    validateIntelligencePublishingApprovalPreparationBundle(reportKeysTampered).ok,
    false,
  );

  const requestedActionsTampered = {
    ...multiBundle,
    executionRequest: {
      ...multiBundle.executionRequest,
      candidates: multiBundle.executionRequest.candidates.map((candidate, index) =>
        index === 0 ? { ...candidate, requestedAction: "refresh" } : candidate,
      ),
    },
  };
  assert.equal(
    validateIntelligencePublishingApprovalPreparationBundle(requestedActionsTampered).ok,
    false,
  );

  const largeSnapshot = buildLargeSnapshot();
  const largePlan = buildPlan(largeSnapshot, "publish", {
    limits: {
      maxReports: 100,
    },
  });
  assert.equal(largePlan.items.length, 100);
  const largeBundle = buildBundle({
    publicationPlan: largePlan,
    registrySnapshot: largeSnapshot,
  });
  assert.equal(largeBundle.summary.publicationPlanItemCount, 100);
  assert.equal(largeBundle.summary.materializedCandidateCount, 100);
  assert.equal(largeBundle.executionApprovalRequest.candidateCount, 100);
  assert.equal(
    largeBundle.executionRequest.candidateFingerprintsInOrder.length,
    100,
  );

  const reversedLargeSnapshot = reverseSnapshot(largeSnapshot);
  const reversedLargeBundle = buildBundle({
    publicationPlan: largePlan,
    registrySnapshot: reversedLargeSnapshot,
  });
  assert.equal(reversedLargeBundle.bundleFingerprint, largeBundle.bundleFingerprint);
  assert.equal(
    reversedLargeBundle.executionRequest.executionRequestFingerprint,
    largeBundle.executionRequest.executionRequestFingerprint,
  );

  assertNoSensitiveFields(minimalBundle);
  assert.equal("grantId" in minimalBundle, false);
  assert.equal("signature" in minimalBundle, false);
  assert.equal("approvalGrant" in minimalBundle, false);

  console.log("PASS — Intelligence publishing approval preparation smoke");
}

void main();

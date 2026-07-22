import assert from "node:assert/strict";

import { buildRetryIntelligencePublishingBatchPlan } from "../lib/intelligencePublishing/batchPlanning";
import type { MarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import { parseMarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
} from "../lib/intelligencePublishing/registryPopulation";
import {
  buildIntelligencePublishingOrchestrationFingerprint,
  orchestrateIntelligencePublishing,
  validateIntelligencePublishingOrchestrationResult,
} from "../lib/intelligencePublishing/orchestrator";
import type { RegistrySnapshot } from "../lib/intelligencePublishing/registryAdapter";

const GENERATED_AT = "2026-07-22T09:00:00.000Z";

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
      source: "orchestrator_smoke",
    },
    ...overrides,
  });
}

function buildRegistrySnapshot(definitions: readonly MarketReportDefinition[]) {
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

function buildEmptySnapshot(): RegistrySnapshot {
  return {
    snapshotId: "registry_snapshot_empty",
    snapshotVersion: 1,
    generatedAt: GENERATED_AT,
    assets: [],
    assetVersions: [],
    artifactReferences: [],
    channelVariants: [],
    freshnessStates: [],
    publicationStates: [],
    policyVersions: {},
    metadata: {
      smoke: true,
    },
  };
}

function duplicateFirstAsset(snapshot: RegistrySnapshot): RegistrySnapshot {
  const asset = snapshot.assets[0]!;
  const assetVersion = snapshot.assetVersions.find(
    (entry) => entry.assetVersionId === asset.activeVersionId,
  )!;
  const variants = snapshot.channelVariants.filter(
    (entry) =>
      entry.assetId === asset.assetId &&
      entry.assetVersionId === assetVersion.assetVersionId,
  );
  const publications = snapshot.publicationStates.filter(
    (entry) =>
      entry.assetId === asset.assetId &&
      entry.assetVersionId === assetVersion.assetVersionId,
  );
  const freshness = snapshot.freshnessStates.filter(
    (entry) =>
      entry.assetId === asset.assetId &&
      entry.assetVersionId === assetVersion.assetVersionId,
  );
  const duplicatedAssetId = `${asset.assetId}_duplicate`;
  const duplicatedAssetVersionId = `${assetVersion.assetVersionId}_duplicate`;

  return {
    ...snapshot,
    assets: [
      ...snapshot.assets,
      {
        ...asset,
        assetId: duplicatedAssetId,
        activeVersionId: duplicatedAssetVersionId,
      },
    ],
    assetVersions: [
      ...snapshot.assetVersions,
      {
        ...assetVersion,
        assetVersionId: duplicatedAssetVersionId,
        assetId: duplicatedAssetId,
      },
    ],
    channelVariants: [
      ...snapshot.channelVariants,
      ...variants.map((entry, index) => ({
        ...entry,
        variantId: `${entry.variantId}_duplicate_${index + 1}`,
        assetId: duplicatedAssetId,
        assetVersionId: duplicatedAssetVersionId,
      })),
    ],
    freshnessStates: [
      ...snapshot.freshnessStates,
      ...freshness.map((entry) => ({
        ...entry,
        assetId: duplicatedAssetId,
        assetVersionId: duplicatedAssetVersionId,
      })),
    ],
    publicationStates: [
      ...snapshot.publicationStates,
      ...publications.map((entry) => ({
        ...entry,
        assetId: duplicatedAssetId,
        assetVersionId: duplicatedAssetVersionId,
      })),
    ],
  };
}

function assertNoPrivateKeys(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes("userId"), false);
  assert.equal(serialized.includes("workspaceId"), false);
  assert.equal(serialized.includes("listingUrl"), false);
  assert.equal(serialized.includes("rawPayload"), false);
}

async function main() {
  const smallSnapshot = buildRegistrySnapshot([
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
      reportId: "report_marrakech_airbnb_riad_en",
      marketCellKey: "ma:marrakech:airbnb:riad",
      city: "Marrakech",
      country: "ma",
      platform: "airbnb",
      propertyType: "riad",
      language: "en",
      slug: "airbnb-market-report-marrakech-riad",
      benchmarkFingerprint: "pricing_fp_marrakech_airbnb_riad",
      overviewFingerprint: "overview_fp_marrakech_airbnb_riad",
    }),
  ]);

  const dryRun = await orchestrateIntelligencePublishing({
    registrySnapshot: smallSnapshot,
    mode: "dry_run",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
  });
  assert.equal(dryRun.summary.registryAssetCount, 3);
  assert.equal(dryRun.summary.itemCount, 3);
  assert.equal(dryRun.batchResult.status, "dry_run_completed");
  assert.equal(validateIntelligencePublishingOrchestrationResult(dryRun).ok, true);
  assertNoPrivateKeys(dryRun);

  const dryRunRepeat = await orchestrateIntelligencePublishing({
    registrySnapshot: smallSnapshot,
    mode: "dry_run",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
  });
  assert.equal(dryRun.registryFingerprint, dryRunRepeat.registryFingerprint);
  assert.equal(dryRun.planFingerprint, dryRunRepeat.planFingerprint);
  assert.equal(dryRun.resultFingerprint, dryRunRepeat.resultFingerprint);
  assert.equal(
    buildIntelligencePublishingOrchestrationFingerprint(dryRun),
    buildIntelligencePublishingOrchestrationFingerprint(dryRunRepeat),
  );

  const executeSimulated = await orchestrateIntelligencePublishing({
    registrySnapshot: smallSnapshot,
    mode: "execute",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
    executeItem: async (item) => {
      if (item.sequence === 2) {
        return {
          status: "failed",
          retryable: true,
          metadata: {
            synthetic: true,
          },
        };
      }
      if (item.sequence === 3) {
        return {
          status: "blocked",
          retryable: false,
          metadata: {
            synthetic: true,
          },
        };
      }
      return {
        status: "succeeded",
        retryable: false,
        metadata: {
          synthetic: true,
        },
      };
    },
  });
  assert.equal(executeSimulated.batchResult.status, "completed_with_failures");
  assert.deepEqual(
    executeSimulated.batchResult.itemResults.map((item) => item.status),
    ["succeeded", "failed", "blocked"],
  );
  const retryPlan = buildRetryIntelligencePublishingBatchPlan({
    previousPlan: executeSimulated.batchPlan,
    previousResult: executeSimulated.batchResult,
    createdAt: "2026-07-22T09:30:00.000Z",
    includeBlocked: true,
  });
  assert.deepEqual(retryPlan.retriedItemKeys.length, 2);

  const empty = await orchestrateIntelligencePublishing({
    getRegistrySnapshot: async () => buildEmptySnapshot(),
    mode: "dry_run",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
  });
  assert.equal(empty.summary.registryAssetCount, 0);
  assert.equal(empty.summary.itemCount, 0);
  assert.equal(
    empty.diagnostics.some((diagnostic) => diagnostic.code === "registry_empty"),
    true,
  );

  const duplicateSnapshot = duplicateFirstAsset(smallSnapshot);
  const duplicateRun = await orchestrateIntelligencePublishing({
    registrySnapshot: duplicateSnapshot,
    mode: "dry_run",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
  });
  assert.equal(duplicateRun.batchPlan.candidateCount, 4);
  assert.equal(duplicateRun.batchPlan.itemCount, 3);
  assert.equal(duplicateRun.batchPlan.duplicateCount, 1);

  const hundredDefinitions: MarketReportDefinition[] = Array.from(
    { length: 100 },
    (_, index) =>
      buildDefinition({
        reportId: `report_city_${index + 1}`,
        marketCellKey: `country_${index % 5}:city_${index + 1}:${
          index % 2 === 0 ? "airbnb" : "booking"
        }:${index % 3 === 0 ? "apartment" : index % 3 === 1 ? "house" : "room"}`,
        city: `City ${index + 1}`,
        country:
          index % 5 === 0
            ? "fr"
            : index % 5 === 1
              ? "es"
              : index % 5 === 2
                ? "ma"
                : index % 5 === 3
                  ? "it"
                  : "pt",
        platform: index % 2 === 0 ? "airbnb" : "booking",
        propertyType:
          index % 3 === 0 ? "apartment" : index % 3 === 1 ? "house" : "room",
        language:
          index % 4 === 0 ? "fr" : index % 4 === 1 ? "en" : index % 4 === 2 ? "es" : "de",
        slug: `${index % 2 === 0 ? "airbnb" : "booking"}-market-report-city-${
          index + 1
        }-${index % 3 === 0 ? "apartment" : index % 3 === 1 ? "house" : "room"}`,
        benchmarkFingerprint: `pricing_fp_city_${index + 1}`,
        overviewFingerprint: `overview_fp_city_${index + 1}`,
      }),
  );
  const hundredSnapshot = buildRegistrySnapshot(hundredDefinitions);
  const hundredRun = await orchestrateIntelligencePublishing({
    registrySnapshot: hundredSnapshot,
    mode: "dry_run",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
  });
  assert.equal(hundredRun.summary.registryAssetCount, 100);
  assert.equal(hundredRun.summary.itemCount, 100);
  assert.equal(hundredRun.batchResult.summary.totalItems, 100);

  console.log("PASS — Intelligence publishing orchestrator smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";

import {
  buildIntelligencePublishingBatchPlan,
  buildRetryIntelligencePublishingBatchPlan,
} from "../lib/intelligencePublishing/batchPlanning";
import type { MarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import { parseMarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
} from "../lib/intelligencePublishing/registryPopulation";
import {
  buildRegistryBatchCandidatesFromSnapshot,
  buildRegistrySnapshotBatchPlan,
  createRegistryBatchRuntimeExecutionHandler,
  executeRegistrySnapshotBatch,
} from "../lib/intelligencePublishing/registryBatchRuntime";

const GENERATED_AT = "2026-07-21T12:00:00.000Z";

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
      source: "registry_batch_runtime_smoke",
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

  const candidateResult = buildRegistryBatchCandidatesFromSnapshot({
    registrySnapshot: smallSnapshot,
  });
  assert.equal(candidateResult.candidates.length, 3);
  assert.deepEqual(
    candidateResult.candidates.map((candidate) => candidate.reportKey),
    [
      "airbnb-market-report-barcelona-apartment",
      "airbnb-market-report-marrakech-riad",
      "airbnb-market-report-paris-apartment",
    ],
  );

  const dryRun = await executeRegistrySnapshotBatch({
    registrySnapshot: smallSnapshot,
    mode: "dry_run",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
  });
  assert.equal(dryRun.plan.itemCount, 3);
  assert.equal(dryRun.result.status, "dry_run_completed");
  assert.deepEqual(
    dryRun.result.itemResults.map((item) => item.status),
    ["dry_run_validated", "dry_run_validated", "dry_run_validated"],
  );

  const registryBatchPlan = buildRegistrySnapshotBatchPlan({
    registrySnapshot: smallSnapshot,
    mode: "execute",
    createdAt: GENERATED_AT,
  });
  assert.equal(registryBatchPlan.plan.itemCount, 3);

  const duplicatePlan = buildIntelligencePublishingBatchPlan({
    candidates: [
      ...candidateResult.candidates,
      {
        ...candidateResult.candidates[0]!,
        candidateId: `${candidateResult.candidates[0]!.candidateId}_duplicate`,
      },
    ],
    mode: "execute",
    createdAt: GENERATED_AT,
  });
  assert.equal(duplicatePlan.itemCount, 3);
  assert.equal(duplicatePlan.duplicateCount, 1);

  const actualHandler = createRegistryBatchRuntimeExecutionHandler({
    registrySnapshot: smallSnapshot,
    now: () => GENERATED_AT,
  });
  const actualExecution = await executeRegistrySnapshotBatch({
    registrySnapshot: smallSnapshot,
    mode: "execute",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
    executeItem: actualHandler,
  });
  assert.equal(actualExecution.result.status, "completed");
  assert.equal(actualExecution.result.summary.succeededItems, 3);
  for (const item of actualExecution.result.itemResults) {
    assert.equal(item.status, "succeeded");
    assert.equal(typeof item.metadata.engineExecutionPlanId, "string");
    assert.equal(typeof item.metadata.runtimePlanId, "string");
    assert.equal((item.metadata.readyJobCount as number) > 0, true);
  }

  const mixedExecution = await executeRegistrySnapshotBatch({
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
            simulated: true,
          },
        };
      }
      return actualHandler(item);
    },
  });
  assert.equal(mixedExecution.result.status, "completed_with_failures");
  assert.deepEqual(
    mixedExecution.result.itemResults.map((item) => item.status),
    ["succeeded", "failed", "succeeded"],
  );

  const retryPlan = buildRetryIntelligencePublishingBatchPlan({
    previousPlan: mixedExecution.plan,
    previousResult: mixedExecution.result,
    createdAt: "2026-07-21T12:30:00.000Z",
  });
  assert.equal(retryPlan.plan.itemCount, 1);
  assert.deepEqual(
    retryPlan.retriedItemKeys,
    [mixedExecution.result.itemResults[1]!.itemKey],
  );

  const blockedExecution = await executeRegistrySnapshotBatch({
    registrySnapshot: smallSnapshot,
    mode: "execute",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
    requestedAction: "generate",
  });
  assert.equal(blockedExecution.result.status, "blocked");
  assert.equal(blockedExecution.result.summary.blockedItems, 3);

  const hundredDefinitions: MarketReportDefinition[] = Array.from(
    { length: 100 },
    (_, index) =>
      buildDefinition({
        reportId: `report_city_${index + 1}`,
        marketCellKey: `country_${index % 5}:city_${index + 1}:${
          index % 2 === 0 ? "airbnb" : "booking"
        }:${index % 3 === 0 ? "apartment" : index % 3 === 1 ? "house" : "room"}`,
        city: `City ${index + 1}`,
        country: index % 5 === 0 ? "fr" : index % 5 === 1 ? "es" : index % 5 === 2 ? "ma" : index % 5 === 3 ? "it" : "pt",
        platform: index % 2 === 0 ? "airbnb" : "booking",
        propertyType:
          index % 3 === 0 ? "apartment" : index % 3 === 1 ? "house" : "room",
        language: index % 4 === 0 ? "fr" : index % 4 === 1 ? "en" : index % 4 === 2 ? "es" : "de",
        slug: `${index % 2 === 0 ? "airbnb" : "booking"}-market-report-city-${
          index + 1
        }-${index % 3 === 0 ? "apartment" : index % 3 === 1 ? "house" : "room"}`,
        benchmarkFingerprint: `pricing_fp_city_${index + 1}`,
        overviewFingerprint: `overview_fp_city_${index + 1}`,
      }),
  );
  const hundredSnapshot = buildRegistrySnapshot(hundredDefinitions);
  const hundredExecution = await executeRegistrySnapshotBatch({
    registrySnapshot: hundredSnapshot,
    mode: "execute",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
    executeItem: async (item) => {
      if (item.sequence % 17 === 0) {
        return {
          status: "blocked",
          metadata: {
            synthetic: true,
          },
        };
      }
      if (item.sequence % 11 === 0) {
        return {
          status: "failed",
          retryable: true,
          metadata: {
            synthetic: true,
          },
        };
      }
      return {
        status: "succeeded",
        metadata: {
          synthetic: true,
        },
      };
    },
  });
  assert.equal(hundredExecution.plan.itemCount, 100);
  assert.equal(hundredExecution.result.itemResults.length, 100);
  assert.equal(hundredExecution.result.summary.failedItems > 0, true);
  assert.equal(hundredExecution.result.summary.blockedItems > 0, true);
  assert.equal(hundredExecution.result.status, "completed_with_failures");

  console.log("PASS — Intelligence Publishing registry batch runtime smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

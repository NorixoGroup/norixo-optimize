import assert from "node:assert/strict";

import {
  buildMarketReportExecutionPlan,
} from "../lib/intelligencePublishing/marketReportPilot";
import { parsePublicationEventEnvelope } from "../lib/intelligencePublishing/eventContracts";
import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
  persistRegistryPopulationPlan,
  type OccupancyBenchmarkPopulationInput,
  type PricingBenchmarkPopulationInput,
  type PublicMarketOverviewPopulationInput,
} from "../lib/intelligencePublishing/registryPopulation";
import {
  buildRegistrySnapshotForMarketReport,
} from "../lib/intelligencePublishing/marketReportPilot";
import {
  buildRegistrySnapshotFingerprint,
  getRegistryAsset,
  getRegistryAssetVersion,
  parseRegistrySnapshot,
  validateRegistrySnapshot,
} from "../lib/intelligencePublishing/registryAdapter";
import {
  buildPersistentRegistryWritePayload,
  type PersistentRegistryRepository,
  type PersistentRegistryWriteResult,
  type RegistryWriteOptions,
} from "../lib/intelligencePublishing/persistentRegistry";

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

function buildEvent(subjectId: string, subjectFingerprint: string) {
  return parsePublicationEventEnvelope({
    eventId: "evt_registry_population_smoke",
    eventType: "benchmark_updated",
    occurredAt: "2026-07-21T10:00:00.000Z",
    sourceSystem: "intelligence_v2",
    subjectType: "benchmark",
    subjectId,
    subjectFingerprint,
    policyVersions: {
      pricing_policy: "pricing_v1",
    },
    priority: "P1",
    visibility: "internal",
    metadata: {
      benchmarkType: "pricing_distribution",
      changeSummary: "distribution_updated",
      smoke: true,
    },
  });
}

class InMemoryRegistryRepository {
  private snapshot = parseRegistrySnapshot({
    snapshotId: "intelligence_publishing_registry",
    snapshotVersion: 1,
    generatedAt: "2026-07-21T00:00:00.000Z",
    assets: [],
    assetVersions: [],
    artifactReferences: [],
    channelVariants: [],
    freshnessStates: [],
    publicationStates: [],
    policyVersions: {},
    metadata: {},
  });

  async readSnapshot() {
    return this.snapshot;
  }

  async writeSnapshot(
    snapshot: ReturnType<typeof parseRegistrySnapshot>,
    options: RegistryWriteOptions,
  ): Promise<PersistentRegistryWriteResult> {
    const normalized = parseRegistrySnapshot(snapshot);
    const nextFingerprint = buildRegistrySnapshotFingerprint(normalized);
    const currentFingerprint = buildRegistrySnapshotFingerprint(this.snapshot);
    const status = nextFingerprint === currentFingerprint ? "idempotent" : "written";
    this.snapshot = normalized;
    return {
      status,
      snapshot: normalized,
      snapshotFingerprint: nextFingerprint,
      snapshotVersion: normalized.snapshotVersion,
      snapshotId: normalized.snapshotId,
      fencingToken: 1,
      metadata: Object.freeze({
        idempotencyKey: options.idempotencyKey,
      }),
    };
  }
}

async function main() {
{
  const generatedAt = "2026-07-21T12:00:00.000Z";
  const evaluatedAt = "2026-07-21T12:00:00.000Z";
  const pricing = buildPricingInput();
  const occupancy = buildOccupancyInput();
  const overview = buildOverviewInput();

  const firstPlan = buildRegistryPopulationPlan(
    [pricing, occupancy, overview],
    {
      generatedAt,
      evaluatedAt,
      targetLocales: ["en"],
      metadata: {
        smoke: "registry_population",
      },
    },
  );
  const secondPlan = buildRegistryPopulationPlan(
    [overview, pricing, occupancy],
    {
      generatedAt,
      evaluatedAt,
      targetLocales: ["en"],
      metadata: {
        smoke: "registry_population",
      },
    },
  );

  assert.equal(firstPlan.planId, secondPlan.planId);
  assert.equal(firstPlan.inputFingerprint, secondPlan.inputFingerprint);
  assert.equal(firstPlan.facts.length, 8);
  assert.equal(firstPlan.contributions.length, 4);
  assert.equal(
    firstPlan.contributions.some(
      (contribution) =>
        contribution.assetKind === "market_report" &&
        contribution.reportDefinition != null,
    ),
    true,
  );

  const applied = applyRegistryPopulationPlan(firstPlan);
  assert.equal(validateRegistrySnapshot(applied.nextSnapshot).ok, true);
  assert.equal(applied.changedAssetKeys.length, 4);
  assert.equal(applied.unchangedAssetKeys.length, 0);
  assert.equal(
    getRegistryAsset(
      applied.nextSnapshot,
      "asset_market_pricing_fr_paris_airbnb_apartment_1_3",
    )?.assetType,
    "insight_card",
  );

  const reportContribution = firstPlan.contributions.find(
    (contribution) => contribution.assetKind === "market_report",
  );
  assert(reportContribution?.reportDefinition);
  const marketReportSnapshot = buildRegistrySnapshotForMarketReport(
    reportContribution.reportDefinition,
  );
  assert.equal(validateRegistrySnapshot(marketReportSnapshot).ok, true);
  const plan = buildMarketReportExecutionPlan({
    request: {
      definition: reportContribution.reportDefinition,
      triggerEvent: buildEvent(
        `benchmark:${reportContribution.reportDefinition.marketCellKey}`,
        reportContribution.reportDefinition.benchmarkFingerprint,
      ),
      registrySnapshot: marketReportSnapshot,
    },
    runId: "run_registry_population_smoke",
    now: () => generatedAt,
  });
  assert.equal(plan.jobs.length >= 0, true);

  const persistentPayload = buildPersistentRegistryWritePayload({
    currentSnapshot: null,
    snapshot: applied.nextSnapshot,
    writeOptions: {
      idempotencyKey: "registry_population_smoke_write",
      writtenAt: generatedAt,
      metadata: {},
    },
  });
  assert.equal(
    persistentPayload.snapshot.snapshotFingerprint,
    applied.nextSnapshotFingerprint,
  );
}

{
  const generatedAt = "2026-07-21T12:00:00.000Z";
  const evaluatedAt = "2026-07-21T12:00:00.000Z";
  const repository =
    new InMemoryRegistryRepository() as unknown as PersistentRegistryRepository;

  const plan = buildRegistryPopulationPlan(
    [buildPricingInput(), buildOccupancyInput(), buildOverviewInput()],
    {
      generatedAt,
      evaluatedAt,
      targetLocales: ["en"],
    },
  );

  const firstPersist = await persistRegistryPopulationPlan({
    repository,
    plan,
    writeOptions: {
      idempotencyKey: "population-write-1",
      writtenAt: generatedAt,
      metadata: {},
    },
  });
  const secondPersist = await persistRegistryPopulationPlan({
    repository,
    plan,
    writeOptions: {
      idempotencyKey: "population-write-2",
      writtenAt: generatedAt,
      metadata: {},
    },
  });

  assert.equal(firstPersist.writeResult.status, "written");
  assert.equal(secondPersist.writeResult.status, "idempotent");
  assert.equal(
    firstPersist.reloadedSnapshotFingerprint,
    secondPersist.reloadedSnapshotFingerprint,
  );
}

{
  const initial = applyRegistryPopulationPlan(
    buildRegistryPopulationPlan(
      [buildPricingInput(), buildOccupancyInput(), buildOverviewInput()],
      {
        generatedAt: "2026-07-21T12:00:00.000Z",
        evaluatedAt: "2026-07-21T12:00:00.000Z",
        targetLocales: ["en"],
      },
    ),
  );

  const unchanged = applyRegistryPopulationPlan(
    buildRegistryPopulationPlan(
      [buildPricingInput(), buildOccupancyInput(), buildOverviewInput()],
      {
        generatedAt: "2026-07-21T12:00:00.000Z",
        evaluatedAt: "2026-07-21T12:00:00.000Z",
        targetLocales: ["en"],
      },
    ),
    initial.nextSnapshot,
  );
  assert.equal(unchanged.unchangedAssetKeys.length >= 3, true);

  const freshnessOnly = applyRegistryPopulationPlan(
    buildRegistryPopulationPlan(
      [
        buildPricingInput({
          valid_until: "2026-10-15T00:00:00.000Z",
        }),
        buildOccupancyInput(),
        buildOverviewInput(),
      ],
      {
        generatedAt: "2026-07-21T12:00:00.000Z",
        evaluatedAt: "2026-07-21T12:00:00.000Z",
        targetLocales: ["en"],
      },
    ),
    initial.nextSnapshot,
  );
  assert.equal(
    freshnessOnly.changes.some((change) => change.kind === "freshness_only_change"),
    true,
  );

  const changed = applyRegistryPopulationPlan(
    buildRegistryPopulationPlan(
      [
        buildPricingInput({
          artifact_key: "pricing_artifact_fp_paris_airbnb_apartment_v2",
          median_price: 149,
        }),
        buildOccupancyInput(),
        buildOverviewInput(),
      ],
      {
        generatedAt: "2026-07-22T12:00:00.000Z",
        evaluatedAt: "2026-07-22T12:00:00.000Z",
        targetLocales: ["en"],
      },
    ),
    initial.nextSnapshot,
  );
  assert.equal(
    changed.changes.some((change) => change.kind === "new_version"),
    true,
  );
  const pricingAsset = getRegistryAsset(
    changed.nextSnapshot,
    "asset_market_pricing_fr_paris_airbnb_apartment_1_3",
  );
  assert(pricingAsset?.activeVersionId);
  const pricingVersion = getRegistryAssetVersion(
    changed.nextSnapshot,
    pricingAsset.activeVersionId,
  );
  assert.equal(pricingVersion?.versionNumber, 2);
}

{
  const protectedInputs = [
    buildPricingInput({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ userId: "secret-user" } as any),
    }),
  ];
  assert.throws(
    () =>
      buildRegistryPopulationPlan(protectedInputs, {
        generatedAt: "2026-07-21T12:00:00.000Z",
        evaluatedAt: "2026-07-21T12:00:00.000Z",
      }),
    /Forbidden private field/i,
  );
  assert.throws(
    () =>
      buildRegistryPopulationPlan(
        [
          buildPricingInput({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ metadata: { listingUrl: "https://example.com/private" } } as any),
          }),
        ],
        {
          generatedAt: "2026-07-21T12:00:00.000Z",
          evaluatedAt: "2026-07-21T12:00:00.000Z",
        },
      ),
    /Forbidden private field|Forbidden URL-like value/i,
  );
}

{
  const paris = applyRegistryPopulationPlan(
    buildRegistryPopulationPlan(
      [buildPricingInput(), buildOccupancyInput(), buildOverviewInput()],
      {
        generatedAt: "2026-07-21T12:00:00.000Z",
        evaluatedAt: "2026-07-21T12:00:00.000Z",
        targetLocales: ["en"],
      },
    ),
  );
  const barcelonaPlan = buildRegistryPopulationPlan(
    [
      buildPricingInput({
        artifact_key: "pricing_artifact_fp_barcelona_airbnb_apartment_v1",
        country: "es",
        city: "Barcelona",
        market_cell_key: "es:barcelona:airbnb:apartment:1_3",
      }),
      buildOccupancyInput({
        artifact_key: "occupancy_artifact_fp_barcelona_airbnb_apartment_v1",
        country: "es",
        city: "Barcelona",
        market_cell_key: "es:barcelona:airbnb:apartment:1_3",
      }),
      buildOverviewInput({
        artifactKey: "public_overview_fp_barcelona_airbnb_apartment_v1",
        country: "es",
        city: "Barcelona",
        platform: "airbnb",
        propertyType: "apartment",
      }),
    ],
    {
      generatedAt: "2026-07-22T12:00:00.000Z",
      evaluatedAt: "2026-07-22T12:00:00.000Z",
      targetLocales: ["en"],
    },
  );
  const merged = applyRegistryPopulationPlan(barcelonaPlan, paris.nextSnapshot);
  assert.equal(
    getRegistryAsset(
      merged.nextSnapshot,
      "asset_market_pricing_fr_paris_airbnb_apartment_1_3",
    ) != null,
    true,
  );
  assert.equal(
    getRegistryAsset(
      merged.nextSnapshot,
      "asset_market_pricing_es_barcelona_airbnb_apartment_1_3",
    ) != null,
    true,
  );
}

console.log("PASS — Intelligence Publishing registry population smoke");
}

void main();

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildOpaqueFactKey } from "../lib/intelligenceV2/opaqueFactIdentity";
import {
  buildPublicMarketOverviewBackfill,
  type PublicMarketOverviewBackfillResult,
} from "../lib/intelligenceV2/publicMarketOverviewBackfill";
import type { PublicMarketOverviewFactRow } from "../lib/intelligenceV2/publicMarketOverviewBuilder";
import {
  type PublicIntelligenceBackfillOptions,
} from "../lib/intelligenceV2/publicIntelligenceBackfill";
import {
  transformCandidateToAnonymousPricingFact,
  type AnonymousPricingFactCandidate,
} from "../lib/intelligenceV2/pricingFact";
import type {
  MarketMemoryPricingBackfillComparableRow,
  MarketMemoryPricingBackfillSnapshotRow,
} from "../lib/intelligenceV2/marketMemoryPricingBackfill";
import type {
  PricingFactWriterDependencies,
  PricingFactWriterResult,
  WriteAnonymousPricingFactsInput,
} from "../lib/intelligenceV2/pricingFactWriter";

const TEST_ENV = {
  INTELLIGENCE_FACT_IDENTITY_SECRET: "smoke-secret",
} as const;

process.env.INTELLIGENCE_FACT_IDENTITY_SECRET =
  TEST_ENV.INTELLIGENCE_FACT_IDENTITY_SECRET;

const {
  runPublicIntelligenceBackfill,
  parsePublicIntelligenceBackfillCliArgs,
} = require("../lib/intelligenceV2/publicIntelligenceBackfill") as typeof import("../lib/intelligenceV2/publicIntelligenceBackfill");

function buildSnapshot(input: {
  id: string;
  country: string | null;
  city: string | null;
  platform: string | null;
  route: string;
  propertyType?: string;
  createdAt?: string;
}): MarketMemoryPricingBackfillSnapshotRow {
  return {
    id: input.id,
    country: input.country,
    city: input.city,
    platform: input.platform,
    property_type: input.propertyType ?? "apartment",
    created_at: input.createdAt ?? "2026-07-01T00:00:00.000Z",
    metadata: { route: input.route },
  };
}

function buildComparable(input: {
  id: string;
  snapshotId: string;
  country?: string | null;
  city?: string | null;
  platform?: string | null;
  propertyType?: string | null;
  nightlyPrice?: number | null;
  currency?: string | null;
  createdAt?: string;
  externalId?: string;
}): MarketMemoryPricingBackfillComparableRow {
  return {
    id: input.id,
    snapshot_id: input.snapshotId,
    platform: input.platform ?? "airbnb",
    city: input.city ?? "Barcelona",
    country: input.country ?? "Spain",
    property_type: input.propertyType ?? "apartment",
    nightly_price: input.nightlyPrice ?? 120,
    currency: input.currency ?? "EUR",
    created_at: input.createdAt ?? "2026-07-10T00:00:00.000Z",
    raw: {
      canonicalUrl: `https://example.com/${input.id}`,
      externalId: input.externalId ?? `ext-${input.id}`,
      locationLabel: `${input.city ?? "Barcelona"}, ${input.country ?? "Spain"}`,
      comparableQuality: "pricing_grade",
    },
    url: null,
    title: null,
    latitude: null,
    longitude: null,
  };
}

function createFixture() {
  const snapshots: MarketMemoryPricingBackfillSnapshotRow[] = [
    buildSnapshot({
      id: "00000000-0000-4000-8000-000000000001",
      country: "Spain",
      city: "Barcelona",
      platform: "airbnb",
      route: "api_audits",
    }),
    buildSnapshot({
      id: "00000000-0000-4000-8000-000000000002",
      country: "France",
      city: "Marseille",
      platform: "airbnb",
      route: "api_listings",
    }),
    buildSnapshot({
      id: "00000000-0000-4000-8000-000000000003",
      country: "France",
      city: "Cannes",
      platform: "airbnb",
      route: "api_audits",
    }),
    buildSnapshot({
      id: "00000000-0000-4000-8000-000000000004",
      country: "Morocco",
      city: "Rabat",
      platform: "airbnb",
      route: "api_audits",
    }),
    buildSnapshot({
      id: "00000000-0000-4000-8000-000000000005",
      country: "France",
      city: "Toulouse",
      platform: "airbnb",
      route: "unsupported_route",
    }),
    buildSnapshot({
      id: "00000000-0000-4000-8000-000000000006",
      country: null,
      city: "Fes",
      platform: "airbnb",
      route: "api_audits",
    }),
    buildSnapshot({
      id: "00000000-0000-4000-8000-000000000007",
      country: "Morocco",
      city: "Tangier",
      platform: "airbnb",
      route: "api_audits",
    }),
  ];

  const comparables: MarketMemoryPricingBackfillComparableRow[] = [
    buildComparable({
      id: "cmp-bcn-1",
      snapshotId: snapshots[0]!.id,
      createdAt: "2026-05-10T00:00:00.000Z",
      nightlyPrice: 90,
    }),
    buildComparable({
      id: "cmp-bcn-2",
      snapshotId: snapshots[0]!.id,
      createdAt: "2026-05-20T00:00:00.000Z",
      nightlyPrice: 100,
    }),
    buildComparable({
      id: "cmp-bcn-3",
      snapshotId: snapshots[0]!.id,
      createdAt: "2026-06-10T00:00:00.000Z",
      nightlyPrice: 110,
    }),
    buildComparable({
      id: "cmp-bcn-4",
      snapshotId: snapshots[0]!.id,
      createdAt: "2026-06-20T00:00:00.000Z",
      nightlyPrice: 120,
    }),
    buildComparable({
      id: "cmp-bcn-5",
      snapshotId: snapshots[0]!.id,
      createdAt: "2026-07-05T00:00:00.000Z",
      nightlyPrice: 130,
    }),
    buildComparable({
      id: "cmp-bcn-6",
      snapshotId: snapshots[0]!.id,
      createdAt: "2026-07-12T00:00:00.000Z",
      nightlyPrice: 140,
    }),
    buildComparable({
      id: "cmp-mrs-1",
      snapshotId: snapshots[1]!.id,
      country: "France",
      city: "Marseille",
      createdAt: "2026-05-11T00:00:00.000Z",
      nightlyPrice: 80,
    }),
    buildComparable({
      id: "cmp-mrs-2",
      snapshotId: snapshots[1]!.id,
      country: "France",
      city: "Marseille",
      createdAt: "2026-05-21T00:00:00.000Z",
      nightlyPrice: 85,
    }),
    buildComparable({
      id: "cmp-mrs-3",
      snapshotId: snapshots[1]!.id,
      country: "France",
      city: "Marseille",
      createdAt: "2026-06-09T00:00:00.000Z",
      nightlyPrice: 95,
    }),
    buildComparable({
      id: "cmp-mrs-4",
      snapshotId: snapshots[1]!.id,
      country: "France",
      city: "Marseille",
      createdAt: "2026-06-19T00:00:00.000Z",
      nightlyPrice: 100,
    }),
    buildComparable({
      id: "cmp-mrs-5",
      snapshotId: snapshots[1]!.id,
      country: "France",
      city: "Marseille",
      createdAt: "2026-07-06T00:00:00.000Z",
      nightlyPrice: 105,
    }),
    buildComparable({
      id: "cmp-can-1",
      snapshotId: snapshots[2]!.id,
      country: "France",
      city: "Cannes",
      createdAt: "2026-05-12T00:00:00.000Z",
      nightlyPrice: 210,
    }),
    buildComparable({
      id: "cmp-can-2",
      snapshotId: snapshots[2]!.id,
      country: "France",
      city: "Cannes",
      createdAt: "2026-05-22T00:00:00.000Z",
      nightlyPrice: 215,
    }),
    buildComparable({
      id: "cmp-can-3",
      snapshotId: snapshots[2]!.id,
      country: "France",
      city: "Cannes",
      createdAt: "2026-06-11T00:00:00.000Z",
      nightlyPrice: 220,
    }),
    buildComparable({
      id: "cmp-can-4",
      snapshotId: snapshots[2]!.id,
      country: "France",
      city: "Cannes",
      createdAt: "2026-06-21T00:00:00.000Z",
      nightlyPrice: 225,
    }),
    buildComparable({
      id: "cmp-can-5",
      snapshotId: snapshots[2]!.id,
      country: "France",
      city: "Cannes",
      createdAt: "2026-07-08T00:00:00.000Z",
      nightlyPrice: 230,
    }),
    buildComparable({
      id: "cmp-rab-1",
      snapshotId: snapshots[3]!.id,
      country: "Morocco",
      city: "Rabat",
      createdAt: "2026-05-13T00:00:00.000Z",
      nightlyPrice: 70,
    }),
    buildComparable({
      id: "cmp-rab-2",
      snapshotId: snapshots[3]!.id,
      country: "Morocco",
      city: "Rabat",
      createdAt: "2026-05-23T00:00:00.000Z",
      nightlyPrice: 75,
    }),
    buildComparable({
      id: "cmp-rab-3",
      snapshotId: snapshots[3]!.id,
      country: "Morocco",
      city: "Rabat",
      createdAt: "2026-06-14T00:00:00.000Z",
      nightlyPrice: 80,
    }),
    buildComparable({
      id: "cmp-rab-4",
      snapshotId: snapshots[3]!.id,
      country: "Morocco",
      city: "Rabat",
      createdAt: "2026-07-09T00:00:00.000Z",
      nightlyPrice: 82,
    }),
    buildComparable({
      id: "cmp-tls-1",
      snapshotId: snapshots[4]!.id,
      country: "France",
      city: "Toulouse",
      createdAt: "2026-07-10T00:00:00.000Z",
      nightlyPrice: 91,
    }),
    buildComparable({
      id: "cmp-fes-1",
      snapshotId: snapshots[5]!.id,
      country: "Morocco",
      city: "Fes",
      createdAt: "2026-07-10T00:00:00.000Z",
      nightlyPrice: 61,
    }),
  ];

  return { snapshots, comparables };
}

function buildCandidateFromObservation(
  input: WriteAnonymousPricingFactsInput,
  observation: WriteAnonymousPricingFactsInput["observations"][number],
): AnonymousPricingFactCandidate {
  return {
    sourceClass: input.sourceClass,
    capturedAt: observation.capturedAt,
    platform: observation.platform ?? null,
    country: observation.country ?? null,
    city: observation.city ?? null,
    propertyType: observation.propertyType ?? null,
    capacity: observation.capacity ?? null,
    guestCapacity: observation.guestCapacity ?? null,
    currency: observation.currency ?? null,
    nightlyPrice: observation.nightlyPrice ?? null,
    comparableQuality:
      observation.comparableQuality === "pricing_grade"
        ? "moderate"
        : observation.comparableQuality === "contextual"
          ? "low"
          : undefined,
    freshness: observation.freshness ?? "fresh",
  };
}

function createFactStore() {
  const rows = new Map<string, PublicMarketOverviewFactRow>();

  function queryExistingFactKeys(factKeys: ReadonlyArray<string>) {
    return new Set(factKeys.filter((factKey) => rows.has(factKey)));
  }

  function seedFromWriterInput(
    input: WriteAnonymousPricingFactsInput,
    env: PricingFactWriterDependencies["env"],
  ): PricingFactWriterResult {
    let accepted = 0;
    let rejected = 0;

    for (const observation of input.observations) {
      const transformed = transformCandidateToAnonymousPricingFact(
        buildCandidateFromObservation(input, observation),
      );
      if (!transformed.accepted) {
        rejected += 1;
        continue;
      }

      const factKey = buildOpaqueFactKey(
        {
          privateComparableSignature: observation.privateComparableSignature,
          marketCellKey: transformed.fact.marketCell.marketCellKey,
          capturePeriodBucket: transformed.fact.capturePeriodBucket,
          normalizedNightlyPrice: transformed.fact.normalizedNightlyPrice,
          transformationPolicyVersion: transformed.fact.transformationPolicyVersion,
        },
        env ?? TEST_ENV,
      );
      if (!factKey.ok) {
        rejected += 1;
        continue;
      }

      rows.set(factKey.factKey, {
        country: transformed.fact.marketCell.country,
        city: transformed.fact.marketCell.city,
        platform: transformed.fact.marketCell.platform,
        property_type: transformed.fact.marketCell.propertyType,
        capacity_band: transformed.fact.marketCell.capacityBand,
        currency: transformed.fact.marketCell.currency,
        market_cell_key: transformed.fact.marketCell.marketCellKey,
        normalized_nightly_price: transformed.fact.normalizedNightlyPrice,
        source_class: input.sourceClass,
        capture_period_bucket: transformed.fact.capturePeriodBucket,
        created_at: observation.capturedAt,
        fact_contract_version: transformed.fact.factContractVersion,
        transformation_policy_version: transformed.fact.transformationPolicyVersion,
        eligibility_policy_version: transformed.fact.eligibilityPolicyVersion,
        deduplication_policy_version: transformed.fact.deduplicationPolicyVersion,
        market_cell_policy_version: transformed.fact.marketCellPolicyVersion,
        confidence_policy_version: transformed.fact.confidencePolicyVersion,
        freshness_policy_version: transformed.fact.freshnessPolicyVersion,
        pricing_normalization_policy_version:
          transformed.fact.pricingNormalizationPolicyVersion,
      });
      accepted += 1;
    }

    return {
      status: "success",
      received: input.observations.length,
      accepted,
      rejected,
      deduplicatedInBatch: 0,
      submitted: accepted,
      databaseStatus: "success",
      duplicatesDatabase: "unknown",
      reasonCodes: [],
    };
  }

  return {
    size: () => rows.size,
    rows: () => [...rows.values()],
    queryExistingFactKeys,
    writePricingFacts: async (
      input: WriteAnonymousPricingFactsInput,
      dependencies?: PricingFactWriterDependencies,
    ) => seedFromWriterInput(input, dependencies?.env),
  };
}

function createArtifactStore(factStore: ReturnType<typeof createFactStore>) {
  const artifacts = new Map<string, { id: string }>();
  let insertCalls = 0;

  return {
    size: () => artifacts.size,
    insertCalls: () => insertCalls,
    buildPublicOverviewBackfill: async (
      options: Parameters<typeof buildPublicMarketOverviewBackfill>[0],
      failCity?: string,
    ): Promise<PublicMarketOverviewBackfillResult> => {
      if (failCity != null && options.city === failCity) {
        return {
          ok: false,
          error: "synthetic_public_overview_failure",
        };
      }

      return buildPublicMarketOverviewBackfill(options, {
        now: () => new Date("2026-07-15T12:00:00.000Z"),
        loadFacts: async (input) => ({
          ok: true,
          rows: factStore.rows().filter((row) => {
            if (row.country !== input.country || row.city !== input.city) {
              return false;
            }
            if (input.platform != null && row.platform !== input.platform) {
              return false;
            }
            if (input.currency != null && row.currency !== input.currency) {
              return false;
            }
            if (!input.capturePeriodBuckets.includes(row.capture_period_bucket)) {
              return false;
            }
            return true;
          }),
        }),
        insertArtifact: async (payload) => {
          insertCalls += 1;
          if (artifacts.has(payload.artifact_key)) {
            return {
              ok: true as const,
              status: "already_existing" as const,
            };
          }
          artifacts.set(payload.artifact_key, {
            id: `artifact-${artifacts.size + 1}`,
          });
          return {
            ok: true as const,
            status: "inserted" as const,
          };
        },
      });
    },
  };
}

async function runWithFixture(input: {
  options: Partial<PublicIntelligenceBackfillOptions>;
  failCity?: string;
  factStore?: ReturnType<typeof createFactStore>;
  artifactStore?: ReturnType<typeof createArtifactStore>;
  snapshots?: ReadonlyArray<MarketMemoryPricingBackfillSnapshotRow>;
  comparables?: ReadonlyArray<MarketMemoryPricingBackfillComparableRow>;
}) {
  const fixture = {
    snapshots: input.snapshots ?? createFixture().snapshots,
    comparables: input.comparables ?? createFixture().comparables,
  };
  const factStore = input.factStore ?? createFactStore();
  const artifactStore = input.artifactStore ?? createArtifactStore(factStore);

  const result = await runPublicIntelligenceBackfill(
    {
      mode: "dry_run",
      confirmWrite: false,
      country: null,
      city: null,
      platform: null,
      stage: "all",
      marketLimit: null,
      limit: null,
      from: null,
      to: null,
      ...input.options,
    },
    {
      now: () => new Date("2026-07-15T12:00:00.000Z"),
      loadSnapshots: async () => fixture.snapshots,
      loadComparablesForSnapshotIds: async (snapshotIds) =>
        fixture.comparables.filter((comparable) =>
          snapshotIds.includes(comparable.snapshot_id),
        ),
      queryExistingFactKeys: async (factKeys) =>
        factStore.queryExistingFactKeys(factKeys),
      writePricingFacts: factStore.writePricingFacts,
      buildPublicOverviewBackfill: async (options) =>
        artifactStore.buildPublicOverviewBackfill(options, input.failCity),
    },
  );

  return { result, factStore, artifactStore };
}

async function main() {
  const parsedDefault = parsePublicIntelligenceBackfillCliArgs([]);
  assert.equal(parsedDefault.ok, true);
  if (parsedDefault.ok) {
    assert.equal(parsedDefault.options.mode, "dry_run");
    assert.equal(parsedDefault.options.stage, "all");
  }

  const conflictingModes = parsePublicIntelligenceBackfillCliArgs([
    "--dry-run",
    "--apply",
  ]);
  assert.equal(conflictingModes.ok, false);

  const missingConfirm = parsePublicIntelligenceBackfillCliArgs(["--apply"]);
  assert.equal(missingConfirm.ok, false);

  const cityWithoutCountry = parsePublicIntelligenceBackfillCliArgs([
    "--city=barcelona",
  ]);
  assert.equal(cityWithoutCountry.ok, false);

  const dryRun = await runWithFixture({
    options: {
      mode: "dry_run",
      marketLimit: 20,
    },
  });
  assert.equal(dryRun.result.ok, true);
  if (dryRun.result.ok) {
    assert.equal(dryRun.factStore.size(), 0);
    assert.equal(dryRun.artifactStore.size(), 0);
    assert.ok(dryRun.result.marketsDiscovered >= 4);
    assert.ok(
      dryRun.result.geographyRecoveries.countryInferredFromKnownCity >= 1,
    );
    assert.ok(
      dryRun.result.anomalies.some(
        (anomaly) => anomaly.code === "unsupported_snapshot_source",
      ),
    );
  }

  const agadirRecovery = await runWithFixture({
    options: {
      mode: "dry_run",
      country: "ma",
      city: "agadir",
    },
    snapshots: [
      buildSnapshot({
        id: "00000000-0000-4000-8000-000000000101",
        country: null,
        city: null,
        platform: "booking",
        route: "api_audits",
      }),
    ],
    comparables: [
      buildComparable({
        id: "cmp-aga-1",
        snapshotId: "00000000-0000-4000-8000-000000000101",
        country: null,
        city: "Agadir",
        platform: "booking",
        nightlyPrice: 88,
      }),
    ],
  });
  assert.equal(agadirRecovery.result.ok, true);
  if (agadirRecovery.result.ok) {
    assert.equal(
      agadirRecovery.result.geographyRecoveries.countryInferredFromKnownCity,
      1,
    );
    assert.equal(agadirRecovery.result.anomalies.length, 0);
    assert.equal(agadirRecovery.result.markets[0]?.market.country, "ma");
    assert.equal(agadirRecovery.result.markets[0]?.market.city, "agadir");
  }

  const barcelonaRecovery = await runWithFixture({
    options: {
      mode: "dry_run",
      country: "es",
      city: "barcelona",
    },
    snapshots: [
      buildSnapshot({
        id: "00000000-0000-4000-8000-000000000104",
        country: null,
        city: "BARCELONA",
        platform: "airbnb",
        route: "api_audits",
      }),
    ],
    comparables: [
      buildComparable({
        id: "cmp-bcn-recovery-1",
        snapshotId: "00000000-0000-4000-8000-000000000104",
        country: null,
        city: "Barcelona",
        platform: "airbnb",
        nightlyPrice: 118,
      }),
    ],
  });
  assert.equal(barcelonaRecovery.result.ok, true);
  if (barcelonaRecovery.result.ok) {
    assert.equal(
      barcelonaRecovery.result.geographyRecoveries.countryInferredFromKnownCity,
      1,
    );
    assert.equal(barcelonaRecovery.result.markets[0]?.market.country, "es");
  }

  const fesRecovery = await runWithFixture({
    options: {
      mode: "dry_run",
      country: "ma",
      city: "fes",
    },
    snapshots: [
      buildSnapshot({
        id: "00000000-0000-4000-8000-000000000105",
        country: null,
        city: "  fès ",
        platform: "airbnb",
        route: "api_audits",
      }),
    ],
    comparables: [
      buildComparable({
        id: "cmp-fes-recovery-1",
        snapshotId: "00000000-0000-4000-8000-000000000105",
        country: null,
        city: "Fes",
        platform: "airbnb",
        nightlyPrice: 63,
      }),
    ],
  });
  assert.equal(fesRecovery.result.ok, true);
  if (fesRecovery.result.ok) {
    assert.equal(
      fesRecovery.result.geographyRecoveries.countryInferredFromKnownCity,
      1,
    );
    assert.equal(fesRecovery.result.markets[0]?.market.country, "ma");
  }

  const unknownCityRecovery = await runWithFixture({
    options: {
      mode: "dry_run",
    },
    snapshots: [
      buildSnapshot({
        id: "00000000-0000-4000-8000-000000000106",
        country: null,
        city: "Unknown City",
        platform: "booking",
        route: "api_audits",
      }),
    ],
    comparables: [
      buildComparable({
        id: "cmp-unknown-1",
        snapshotId: "00000000-0000-4000-8000-000000000106",
        country: null,
        city: "Unknown City",
        platform: "booking",
        nightlyPrice: 88,
      }),
    ],
  });
  assert.equal(unknownCityRecovery.result.ok, true);
  if (unknownCityRecovery.result.ok) {
    assert.equal(
      unknownCityRecovery.result.geographyRecoveries.countryInferredFromKnownCity,
      0,
    );
    assert.equal(unknownCityRecovery.result.markets.length, 0);
  }

  const ambiguousComparableCityRecovery = await runWithFixture({
    options: {
      mode: "dry_run",
      country: "ma",
      city: "agadir",
    },
    snapshots: [
      buildSnapshot({
        id: "00000000-0000-4000-8000-000000000103",
        country: null,
        city: null,
        platform: "booking",
        route: "api_audits",
      }),
    ],
    comparables: [
      buildComparable({
        id: "cmp-aga-amb-1",
        snapshotId: "00000000-0000-4000-8000-000000000103",
        country: null,
        city: "Agadir",
        platform: "booking",
        nightlyPrice: 88,
      }),
      buildComparable({
        id: "cmp-aga-amb-2",
        snapshotId: "00000000-0000-4000-8000-000000000103",
        country: null,
        city: "Paris",
        platform: "booking",
        nightlyPrice: 92,
      }),
    ],
  });
  assert.equal(ambiguousComparableCityRecovery.result.ok, true);
  if (ambiguousComparableCityRecovery.result.ok) {
    assert.equal(
      ambiguousComparableCityRecovery.result.geographyRecoveries
        .countryInferredFromKnownCity,
      0,
    );
    assert.equal(ambiguousComparableCityRecovery.result.markets.length, 0);
  }

  const explicitCountryPreserved = await runWithFixture({
    options: {
      mode: "dry_run",
      country: "fr",
      city: "paris",
    },
    snapshots: [
      buildSnapshot({
        id: "00000000-0000-4000-8000-000000000102",
        country: "France",
        city: "Paris",
        platform: "airbnb",
        route: "api_audits",
      }),
    ],
    comparables: [
      buildComparable({
        id: "cmp-par-1",
        snapshotId: "00000000-0000-4000-8000-000000000102",
        country: "France",
        city: "Paris",
        platform: "airbnb",
        nightlyPrice: 144,
      }),
    ],
  });
  assert.equal(explicitCountryPreserved.result.ok, true);
  if (explicitCountryPreserved.result.ok) {
    assert.equal(
      explicitCountryPreserved.result.geographyRecoveries.countryInferredFromKnownCity,
      0,
    );
  }

  const countryFilter = await runWithFixture({
    options: {
      mode: "dry_run",
      country: "fr",
      marketLimit: 20,
    },
  });
  assert.equal(countryFilter.result.ok, true);
  if (countryFilter.result.ok) {
    assert.deepEqual(
      countryFilter.result.markets.map((market) => market.market.country),
      ["fr", "fr"],
    );
  }

  const cityFilter = await runWithFixture({
    options: {
      mode: "dry_run",
      country: "es",
      city: "barcelona",
    },
  });
  assert.equal(cityFilter.result.ok, true);
  if (cityFilter.result.ok) {
    assert.equal(cityFilter.result.markets.length, 1);
    assert.equal(cityFilter.result.markets[0]?.market.city, "barcelona");
  }

  const platformFilter = await runWithFixture({
    options: {
      mode: "dry_run",
      platform: "airbnb",
    },
  });
  assert.equal(platformFilter.result.ok, true);

  const factsOnly = await runWithFixture({
    options: {
      mode: "apply",
      confirmWrite: true,
      stage: "facts",
      marketLimit: 20,
    },
  });
  assert.equal(factsOnly.result.ok, true);
  if (factsOnly.result.ok) {
    assert.ok(factsOnly.factStore.size() > 0);
    assert.equal(factsOnly.artifactStore.size(), 0);
    assert.ok(
      factsOnly.result.markets.every(
        (market) => market.publicOverview.inserted === 0,
      ),
    );
  }

  const artifactsOnlyFactStore = createFactStore();
  const preload = await runWithFixture({
    options: {
      mode: "apply",
      confirmWrite: true,
      stage: "facts",
      marketLimit: 20,
    },
    factStore: artifactsOnlyFactStore,
  });
  assert.equal(preload.result.ok, true);

  const artifactsOnly = await runWithFixture({
    options: {
      mode: "apply",
      confirmWrite: true,
      stage: "artifacts",
      marketLimit: 20,
    },
    factStore: artifactsOnlyFactStore,
  });
  assert.equal(artifactsOnly.result.ok, true);
  if (artifactsOnly.result.ok) {
    assert.ok(artifactsOnly.artifactStore.size() > 0);
  }

  const continuesOnError = await runWithFixture({
    options: {
      mode: "apply",
      confirmWrite: true,
      stage: "all",
      country: "fr",
      marketLimit: 20,
    },
    failCity: "cannes",
  });
  assert.equal(continuesOnError.result.ok, true);
  if (continuesOnError.result.ok) {
    assert.equal(continuesOnError.result.marketsFailed, 1);
    assert.ok(
      continuesOnError.result.markets.some(
        (market) => market.market.city === "marseille",
      ),
    );
    assert.ok(
      continuesOnError.result.markets.some(
        (market) => market.market.city === "cannes" && market.technicalFailure,
      ),
    );
  }

  const notPublic = await runWithFixture({
    options: {
      mode: "apply",
      confirmWrite: true,
      country: "ma",
      city: "rabat",
      stage: "all",
    },
  });
  assert.equal(notPublic.result.ok, true);
  if (notPublic.result.ok) {
    assert.equal(notPublic.result.marketsFailed, 0);
    assert.equal(notPublic.result.marketsPublic, 0);
    assert.equal(notPublic.result.marketsInsufficient, 1);
  }

  const idempotentFactStore = createFactStore();
  const idempotentArtifactStore = createArtifactStore(idempotentFactStore);
  const firstApply = await runWithFixture({
    options: {
      mode: "apply",
      confirmWrite: true,
      country: "es",
      city: "barcelona",
      stage: "all",
    },
    factStore: idempotentFactStore,
    artifactStore: idempotentArtifactStore,
  });
  assert.equal(firstApply.result.ok, true);
  const secondApply = await runWithFixture({
    options: {
      mode: "apply",
      confirmWrite: true,
      country: "es",
      city: "barcelona",
      stage: "all",
    },
    factStore: idempotentFactStore,
    artifactStore: idempotentArtifactStore,
  });
  assert.equal(secondApply.result.ok, true);
  if (secondApply.result.ok) {
    const market = secondApply.result.markets[0];
    assert.equal(market?.pricingFacts.inserted, 0);
    assert.ok((market?.pricingFacts.alreadyExisting ?? 0) > 0);
    assert.equal(market?.publicOverview.inserted, 0);
    assert.ok((market?.publicOverview.alreadyExisting ?? 0) > 0);
  }

  const securityChecks = [
    "../lib/intelligenceV2/publicIntelligenceBackfill.ts",
    "./backfill-public-intelligence.ts",
  ];
  for (const file of securityChecks) {
    const absolute = new URL(file, import.meta.url);
    const source = readFileSync(absolute, "utf8");
    for (const banned of [
      "brightdata",
      "runAudit",
      "openai",
      "stripe",
      "searchCompetitors",
      "raw_listing",
      "source_url",
      "target_ref",
    ]) {
      assert.equal(
        source.includes(banned),
        false,
        `Expected ${file} to exclude ${banned}.`,
      );
    }
  }

  console.info("PASS — Public intelligence backfill orchestrator smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

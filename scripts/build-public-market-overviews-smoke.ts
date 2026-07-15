import assert from "node:assert/strict";

import { buildBenchmarkArtifactKey } from "../lib/intelligenceV2/benchmarkArtifactIdentity";
import {
  buildPublicMarketOverviewArtifact,
  type PublicMarketOverviewFactRow,
} from "../lib/intelligenceV2/publicMarketOverviewBuilder";

function buildRow(
  overrides: Partial<PublicMarketOverviewFactRow> = {},
): PublicMarketOverviewFactRow {
  return {
    country: "ma",
    city: "marrakech",
    platform: "airbnb",
    property_type: "apartment",
    capacity_band: "unknown",
    currency: "EUR",
    market_cell_key: "v1|ma|marrakech|airbnb|apartment|unknown|eur",
    normalized_nightly_price: 120,
    source_class: "authenticated_audit",
    capture_period_bucket: "2026-06",
    created_at: "2026-06-01T00:00:00.000Z",
    fact_contract_version: "v1",
    transformation_policy_version: "v1",
    eligibility_policy_version: "v1",
    deduplication_policy_version: "v1",
    market_cell_policy_version: "v1",
    confidence_policy_version: "v1",
    freshness_policy_version: "v1",
    pricing_normalization_policy_version: "v1",
    ...overrides,
  };
}

function buildRows(input: {
  count: number;
  sourceClasses?: string[];
  periods?: string[];
  platforms?: string[];
  propertyType?: string;
  priceStart?: number;
  createdAtBase?: string[];
}): PublicMarketOverviewFactRow[] {
  const periods = input.periods ?? ["2026-05", "2026-06", "2026-07"];
  const sourceClasses = input.sourceClasses ?? ["authenticated_audit"];
  const platforms = input.platforms ?? ["airbnb"];
  const propertyType = input.propertyType ?? "apartment";
  const createdAtBase =
    input.createdAtBase ?? [
      "2026-05-20T00:00:00.000Z",
      "2026-06-20T00:00:00.000Z",
      "2026-07-10T00:00:00.000Z",
    ];

  return Array.from({ length: input.count }, (_, index) =>
    buildRow({
      platform: platforms[index % platforms.length] ?? platforms[0]!,
      property_type: propertyType,
      normalized_nightly_price: (input.priceStart ?? 100) + index * 5,
      source_class: sourceClasses[index % sourceClasses.length] ?? sourceClasses[0]!,
      capture_period_bucket: periods[index % periods.length] ?? periods[0]!,
      created_at: createdAtBase[index % createdAtBase.length] ?? createdAtBase[0]!,
      market_cell_key: `v1|ma|marrakech|${(platforms[index % platforms.length] ?? platforms[0]!).toLowerCase()}|${propertyType}|unknown|eur`,
    }),
  );
}

function injectRows(rows: ReadonlyArray<PublicMarketOverviewFactRow>) {
  return async () =>
    ({ ok: true, rows }) as const;
}

async function main() {
  const four = await buildPublicMarketOverviewArtifact(
    {
      country: "ma",
      city: "marrakech",
      platformScope: "all_platforms",
      propertyType: "apartment",
      currency: "EUR",
      propertyScope: "exact",
    },
    {
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      loadFacts: injectRows(buildRows({ count: 4 })),
    },
  );
  assert.equal(four.available, false);
  assert.equal(four.status, "not_public");
  assert.equal(four.reasonCodes.includes("insufficient_sample_size"), true);

  const five = await buildPublicMarketOverviewArtifact(
    {
      country: "ma",
      city: "marrakech",
      platformScope: "all_platforms",
      propertyType: "apartment",
      currency: "EUR",
      propertyScope: "exact",
    },
    {
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      loadFacts: injectRows(buildRows({ count: 5, periods: ["2026-07"] })),
    },
  );
    assert.equal(five.available, true);
  if (five.available) {
    assert.equal(five.artifact.platform, "all");
    assert.equal(five.artifact.platformScope, "all_platforms");
    assert.equal(five.artifact.exposureStatus, "public_usable_with_limits");
    assert.equal(five.artifact.confidence, "standard");
    assert.equal(five.artifact.sampleBand, "sufficient");
    assert.equal(
      five.artifact.limitationCodes.includes("multi_platform_scope"),
      true,
    );
    assert.equal(
      five.artifact.limitationCodes.includes("limited_sample_size"),
      true,
    );
    assert.equal(
      five.artifact.limitationCodes.includes("limited_source_diversity"),
      true,
    );
    assert.equal(
      five.artifact.limitationCodes.includes("all_capacities_scope"),
      true,
    );
  }

  const paris = await buildPublicMarketOverviewArtifact(
    {
      country: "fr",
      city: "paris",
      platformScope: "all_platforms",
      propertyType: "apartment",
      currency: "EUR",
      propertyScope: "exact",
    },
    {
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      loadFacts: injectRows(
        buildRows({
          count: 5,
          periods: ["2026-07"],
          platforms: ["airbnb"],
        })
          .concat(
            buildRows({
              count: 8,
              periods: ["2026-07"],
              platforms: ["booking"],
              priceStart: 180,
            }),
          )
          .concat(
            buildRows({
              count: 2,
              periods: ["2026-07"],
              platforms: ["vrbo"],
              priceStart: 220,
            }),
          )
          .map((row) => ({
            ...row,
            country: "fr",
            city: "paris",
            market_cell_key: row.market_cell_key.replace("ma|marrakech", "fr|paris"),
          })),
      ),
    },
  );
  assert.equal(paris.available, true);
  if (paris.available) {
    assert.equal(paris.includedSampleSize, 15);
    assert.equal(paris.artifact.platform, "all");
    assert.equal(paris.artifact.platformScope, "all_platforms");
    assert.equal(paris.artifact.exposureStatus, "public_usable_with_limits");
    assert.equal(paris.artifact.confidence, "standard");
    assert.equal(paris.artifact.sampleBand, "sufficient");
    assert.equal(
      paris.artifact.limitationCodes.includes("multi_platform_scope"),
      true,
    );
    assert.equal(
      paris.artifact.limitationCodes.includes("limited_sample_size"),
      true,
    );
  }

  const fiveCrossPlatform = await buildPublicMarketOverviewArtifact(
    {
      country: "ma",
      city: "marrakech",
      platformScope: "all_platforms",
      propertyType: "apartment",
      currency: "EUR",
      propertyScope: "exact",
    },
    {
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      loadFacts: injectRows([
        ...buildRows({ count: 3, periods: ["2026-07"], platforms: ["airbnb"] }),
        ...buildRows({
          count: 2,
          periods: ["2026-07"],
          platforms: ["booking"],
          priceStart: 180,
        }),
      ]),
    },
  );
  assert.equal(fiveCrossPlatform.available, true);
  if (fiveCrossPlatform.available) {
    assert.equal(fiveCrossPlatform.includedSampleSize, 5);
    assert.equal(fiveCrossPlatform.artifact.exposureStatus, "public_usable_with_limits");
    assert.equal(
      fiveCrossPlatform.artifact.limitationCodes.includes("multi_platform_scope"),
      true,
    );
  }

  const thirty = await buildPublicMarketOverviewArtifact(
    {
      country: "ma",
      city: "marrakech",
      platformScope: "all_platforms",
      propertyType: "apartment",
      currency: "EUR",
      propertyScope: "exact",
    },
    {
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      loadFacts: injectRows(
        buildRows({
          count: 30,
          sourceClasses: ["authenticated_audit", "authenticated_listing"],
          periods: ["2026-05", "2026-06", "2026-07"],
          priceStart: 110,
        }),
      ),
    },
  );
    assert.equal(thirty.available, true);
  if (thirty.available) {
    assert.equal(thirty.artifact.platform, "all");
    assert.equal(thirty.artifact.exposureStatus, "public_usable");
    assert.equal(thirty.artifact.confidence, "standard");
    assert.equal(thirty.artifact.sampleBand, "strong");
    assert.equal(
      thirty.artifact.limitationCodes.includes("multi_platform_scope"),
      true,
    );
  }

  const fifty = await buildPublicMarketOverviewArtifact(
    {
      country: "ma",
      city: "marrakech",
      platformScope: "all_platforms",
      propertyType: "apartment",
      currency: "EUR",
      propertyScope: "exact",
    },
    {
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      loadFacts: injectRows(
        buildRows({
          count: 50,
          sourceClasses: ["authenticated_audit", "authenticated_listing"],
          periods: ["2026-05", "2026-06", "2026-07"],
          priceStart: 110,
        }),
      ),
    },
  );
  assert.equal(fifty.available, true);
  if (fifty.available) {
    assert.equal(fifty.artifact.exposureStatus, "public_usable");
    assert.equal(fifty.artifact.confidence, "high");
    assert.equal(fifty.artifact.sampleBand, "strong");
  }

  const singlePeriod = await buildPublicMarketOverviewArtifact(
    {
      country: "ma",
      city: "marrakech",
      platformScope: "all_platforms",
      propertyType: "apartment",
      currency: "EUR",
      propertyScope: "exact",
    },
    {
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      loadFacts: injectRows(buildRows({ count: 18, periods: ["2026-07"] })),
    },
  );
  assert.equal(singlePeriod.available, true);
  if (singlePeriod.available) {
    assert.equal(singlePeriod.artifact.exposureStatus, "public_usable_with_limits");
    assert.equal(
      singlePeriod.artifact.limitationCodes.includes("limited_sample_size"),
      true,
    );
  }

  const broader = await buildPublicMarketOverviewArtifact(
    {
      country: "ma",
      city: "marrakech",
      platformScope: "all_platforms",
      propertyType: "apartment",
      currency: "EUR",
      propertyScope: "broader_market",
    },
    {
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      loadFacts: injectRows([
        ...buildRows({ count: 9, propertyType: "unknown", periods: ["2026-05"] }),
        ...buildRows({ count: 3, propertyType: "unknown", periods: ["2026-06"] }),
        ...buildRows({ count: 3, propertyType: "unknown", periods: ["2026-07"] }),
        ...buildRows({ count: 2, propertyType: "villa", periods: ["2026-07"], priceStart: 600 }),
      ]),
    },
  );
    assert.equal(broader.available, true);
  if (broader.available) {
    assert.equal(broader.includedSampleSize, 17);
    assert.equal(broader.artifact.platform, "all");
    assert.equal(broader.artifact.exposureStatus, "public_usable_with_limits");
    assert.equal(
      broader.artifact.limitationCodes.includes("broader_market_segment"),
      true,
    );
    assert.equal(
      broader.artifact.limitationCodes.includes("all_capacities_scope"),
      true,
    );
    assert.equal(
      broader.artifact.limitationCodes.includes("multi_platform_scope"),
      true,
    );
    assert.equal(
      broader.artifact.limitationCodes.includes("limited_source_diversity"),
      true,
    );
    assert.equal(
      broader.artifact.limitationCodes.includes("limited_sample_size"),
      true,
    );
  }

  const flatSmallCohort = await buildPublicMarketOverviewArtifact(
    {
      country: "ma",
      city: "marrakech",
      platformScope: "all_platforms",
      propertyType: "apartment",
      currency: "EUR",
      propertyScope: "exact",
    },
    {
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      loadFacts: injectRows(
        Array.from({ length: 15 }, (_, index) =>
          buildRow({
            normalized_nightly_price: 100,
            capture_period_bucket: index % 2 === 0 ? "2026-06" : "2026-07",
            created_at:
              index % 2 === 0
                ? "2026-06-10T00:00:00.000Z"
                : "2026-07-10T00:00:00.000Z",
          }),
        ),
      ),
    },
  );
  assert.equal(flatSmallCohort.available, true);
  if (flatSmallCohort.available) {
    assert.equal(
      flatSmallCohort.artifact.exposureStatus,
      "public_usable_with_limits",
    );
    assert.equal(
      flatSmallCohort.artifact.limitationCodes.includes("limited_sample_size"),
      true,
    );
  }

  const outOfWindow = await buildPublicMarketOverviewArtifact(
    {
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "apartment",
      currency: "EUR",
      propertyScope: "exact",
    },
    {
      now: () => new Date("2026-07-15T00:00:00.000Z"),
      loadFacts: injectRows(
        buildRows({
          count: 20,
          createdAtBase: ["2026-01-10T00:00:00.000Z"],
          periods: ["2026-01"],
        }),
      ),
    },
  );
  assert.equal(outOfWindow.available, false);
  assert.equal(outOfWindow.reasonCodes.includes("no_facts_in_window"), true);

  if (!thirty.available) {
    throw new Error("Expected thirty-row scenario to be public.");
  }

  const privateArtifactKeyResult = buildBenchmarkArtifactKey({
    benchmarkType: "pricing_distribution",
    marketCellKey: thirty.persistableArtifact.market_cell_key,
    capturePeriodBucket: thirty.persistableArtifact.capture_period_bucket,
    sourcePeriodStart: thirty.persistableArtifact.source_period_start,
    sourcePeriodEnd: thirty.persistableArtifact.source_period_end,
    p10Price: thirty.persistableArtifact.p10_price,
    p25Price: thirty.persistableArtifact.p25_price,
    medianPrice: thirty.persistableArtifact.median_price,
    p75Price: thirty.persistableArtifact.p75_price,
    p90Price: thirty.persistableArtifact.p90_price,
    rawSampleSize: thirty.persistableArtifact.raw_sample_size,
    includedSampleSize: thirty.persistableArtifact.included_sample_size,
    excludedOutlierCount: 0,
    sourceClassCount: thirty.persistableArtifact.source_class_count,
    sourceDiversityBand: thirty.persistableArtifact.source_diversity_band,
    confidenceLevel: thirty.persistableArtifact.confidence_level,
    approvalStatus: thirty.persistableArtifact.approval_status,
    limitations: thirty.persistableArtifact.limitations,
    artifactContractVersion: "v1",
    cohortDefinitionVersion: "v1",
    cohortPolicyVersion: "v1",
    aggregationPolicyVersion: "v1",
    outlierPolicyVersion: "v1",
    confidencePolicyVersion: "v1",
    freshnessPolicyVersion: "v1",
    approvalPolicyVersion: "v1",
    marketCellPolicyVersion: "v1",
  });
  assert.equal(privateArtifactKeyResult.ok, true);
  if (privateArtifactKeyResult.ok) {
    assert.notEqual(privateArtifactKeyResult.artifactKey, thirty.artifact.artifactKey);
  }

  const serialized = JSON.stringify(thirty);
  assert.equal(serialized.includes("normalized_nightly_price"), false);
  assert.equal(serialized.includes("\"fact_key\""), false);
  assert.equal(serialized.includes("sourceUrl"), false);

  assert.equal(thirty.persistableArtifact.approved_for_audit, false);
  assert.equal(thirty.persistableArtifact.intended_use, "public_market_overview");

  console.log("PASS — Multi-platform public market overview builder smoke");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

import assert from "node:assert/strict";

import {
  buildPricingDiagnosticV2,
  deriveMedianDeltaPercent,
  derivePricingInterquartilePosition,
  derivePricingPercentileBand,
  derivePricingPositionBand,
} from "../lib/intelligenceV2/pricingDiagnosticV2";
import type { PricingBenchmarkEvidence } from "../lib/intelligenceV2/pricingBenchmarkEvidence";
import {
  INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
  INTELLIGENCE_V2_BENCHMARK_FALLBACK_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_SELECTION_POLICY_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_PRICING_BENCHMARK_EVIDENCE_CONTRACT_VERSION,
  INTELLIGENCE_V2_PRICING_DIAGNOSTIC_CONTRACT_VERSION,
} from "../lib/intelligenceV2/policyVersions";

function buildEvidence(
  overrides: Partial<PricingBenchmarkEvidence> = {},
): PricingBenchmarkEvidence {
  const marketCell = Object.freeze({
    country: "france",
    city: "paris",
    platform: "airbnb",
    propertyType: "apartment" as const,
    capacityBand: "4_6" as const,
    currency: "EUR",
    marketCellKey:
      "v1|france|paris|airbnb|apartment|4_6|eur",
  });

  return Object.freeze({
    evidenceContractVersion:
      INTELLIGENCE_V2_PRICING_BENCHMARK_EVIDENCE_CONTRACT_VERSION,
    benchmarkType: "pricing_distribution",
    requestedMarketCell: marketCell,
    resolvedMarketCell: marketCell,
    fallbackLevel: "exact",
    capturePeriodBucket: "2026-06",
    distribution: Object.freeze({
      p10: 80,
      p25: 100,
      median: 120,
      p75: 150,
      p90: 180,
    }),
    confidenceLevel: "very_high",
    freshnessStatus: "fresh",
    validFrom: "2026-07-01T00:00:00.000Z",
    validUntil: "2026-07-31T23:59:59.999Z",
    sampleSizeBand: "40_plus",
    limitations: [],
    intendedUse: "private_audit",
    evidenceStrength: "strong",
    permittedWording: "strong_market_evidence",
    policyVersions: Object.freeze({
      artifactContractVersion:
        INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
      marketCellPolicyVersion:
        INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
      selectionPolicyVersion:
        INTELLIGENCE_V2_BENCHMARK_SELECTION_POLICY_VERSION,
      fallbackPolicyVersion:
        INTELLIGENCE_V2_BENCHMARK_FALLBACK_POLICY_VERSION,
    }),
    ...overrides,
  });
}

function mustBeAvailable(
  result: ReturnType<typeof buildPricingDiagnosticV2>,
) {
  if (!result.available) {
    throw new Error(
      `Expected available diagnostic: ${result.reasonCodes.join(",")}`,
    );
  }

  return result.diagnostic;
}

function mustBeUnavailable(
  result: ReturnType<typeof buildPricingDiagnosticV2>,
) {
  if (result.available) {
    throw new Error("Expected unavailable diagnostic");
  }

  return result;
}

assert.equal(
  mustBeUnavailable(
    buildPricingDiagnosticV2({
      listingNightlyPrice: 0,
      currency: "EUR",
      pricingBenchmarkEvidence: buildEvidence(),
    }),
  ).status,
  "invalid_input",
);

assert.equal(
  mustBeUnavailable(
    buildPricingDiagnosticV2({
      listingNightlyPrice: -10,
      currency: "EUR",
      pricingBenchmarkEvidence: buildEvidence(),
    }),
  ).status,
  "invalid_input",
);

assert.equal(
  mustBeUnavailable(
    buildPricingDiagnosticV2({
      listingNightlyPrice: Number.NaN,
      currency: "EUR",
      pricingBenchmarkEvidence: buildEvidence(),
    }),
  ).status,
  "invalid_input",
);

assert.equal(
  mustBeUnavailable(
    buildPricingDiagnosticV2({
      listingNightlyPrice: 120,
      currency: "USD",
      pricingBenchmarkEvidence: buildEvidence(),
    }),
  ).status,
  "currency_mismatch",
);

const range = {
  p10: 80,
  p25: 100,
  median: 120,
  p75: 150,
  p90: 180,
};

assert.equal(derivePricingPositionBand(79, range), "deep_discount");
assert.equal(derivePricingPositionBand(80, range), "below_market");
assert.equal(derivePricingPositionBand(90, range), "below_market");
assert.equal(derivePricingPositionBand(100, range), "slightly_below");
assert.equal(derivePricingPositionBand(110, range), "slightly_below");
assert.equal(derivePricingPositionBand(120, range), "market_aligned");
assert.equal(derivePricingPositionBand(140, range), "market_aligned");
assert.equal(derivePricingPositionBand(150, range), "market_aligned");
assert.equal(derivePricingPositionBand(160, range), "premium_position");
assert.equal(derivePricingPositionBand(180, range), "premium_position");
assert.equal(derivePricingPositionBand(181, range), "high_outlier");

assert.equal(derivePricingPercentileBand(79, range), "below_p10");
assert.equal(derivePricingPercentileBand(80, range), "p10_to_p25");
assert.equal(derivePricingPercentileBand(100, range), "p25_to_p50");
assert.equal(derivePricingPercentileBand(120, range), "p50_to_p75");
assert.equal(derivePricingPercentileBand(150, range), "p50_to_p75");
assert.equal(derivePricingPercentileBand(160, range), "p75_to_p90");
assert.equal(derivePricingPercentileBand(180, range), "p75_to_p90");
assert.equal(derivePricingPercentileBand(181, range), "above_p90");

assert.equal(derivePricingInterquartilePosition(99, range), "below_iqr");
assert.equal(derivePricingInterquartilePosition(100, range), "inside_iqr");
assert.equal(derivePricingInterquartilePosition(150, range), "inside_iqr");
assert.equal(derivePricingInterquartilePosition(151, range), "above_iqr");

assert.equal(deriveMedianDeltaPercent(132, 120), 10);
assert.equal(deriveMedianDeltaPercent(108, 120), -10);

const strongExact = mustBeAvailable(
  buildPricingDiagnosticV2({
    listingNightlyPrice: 120,
    currency: "eur",
    pricingBenchmarkEvidence: buildEvidence(),
  }),
);
assert.equal(strongExact.status, "available");
assert.equal(strongExact.positionBand, "market_aligned");
assert.equal(strongExact.pricingSignal, "aligned");
assert.equal(strongExact.recommendedAction, "hold_price");
assert.equal(strongExact.currency, "EUR");
assert.equal(
  strongExact.diagnosticContractVersion,
  INTELLIGENCE_V2_PRICING_DIAGNOSTIC_CONTRACT_VERSION,
);

const moderate = mustBeAvailable(
  buildPricingDiagnosticV2({
    listingNightlyPrice: 90,
    currency: "EUR",
    pricingBenchmarkEvidence: buildEvidence({
      evidenceStrength: "moderate",
      permittedWording: "moderate_market_evidence",
    }),
  }),
);
assert.equal(moderate.recommendedAction, "test_higher_price");
assert.ok(moderate.limitations.includes("limited_evidence"));

const capacityFallback = mustBeAvailable(
  buildPricingDiagnosticV2({
    listingNightlyPrice: 120,
    currency: "EUR",
    pricingBenchmarkEvidence: buildEvidence({
      fallbackLevel: "capacity_unknown",
      evidenceStrength: "moderate",
      permittedWording: "moderate_market_evidence",
      limitations: ["broad_fallback"],
    }),
  }),
);
assert.ok(capacityFallback.limitations.includes("benchmark_fallback"));

const propertyFallback = mustBeAvailable(
  buildPricingDiagnosticV2({
    listingNightlyPrice: 120,
    currency: "EUR",
    pricingBenchmarkEvidence: buildEvidence({
      fallbackLevel: "property_unknown",
      evidenceStrength: "moderate",
      permittedWording: "moderate_market_evidence",
      limitations: ["broad_fallback"],
    }),
  }),
);
assert.ok(propertyFallback.limitations.includes("benchmark_fallback"));

const doubleFallback = mustBeAvailable(
  buildPricingDiagnosticV2({
    listingNightlyPrice: 70,
    currency: "EUR",
    pricingBenchmarkEvidence: buildEvidence({
      fallbackLevel: "property_capacity_unknown",
      evidenceStrength: "limited",
      permittedWording: "limited_market_evidence",
      limitations: ["broad_fallback"],
    }),
  }),
);
assert.equal(doubleFallback.status, "limited");
assert.equal(doubleFallback.recommendedAction, "monitor_position");
assert.ok(doubleFallback.limitations.includes("broad_market_cell"));
assert.ok(doubleFallback.limitations.includes("weak_action_only"));

const aging = mustBeAvailable(
  buildPricingDiagnosticV2({
    listingNightlyPrice: 70,
    currency: "EUR",
    pricingBenchmarkEvidence: buildEvidence({
      freshnessStatus: "aging",
      evidenceStrength: "limited",
      permittedWording: "limited_market_evidence",
    }),
  }),
);
assert.equal(aging.status, "limited");
assert.equal(aging.recommendedAction, "monitor_position");
assert.ok(aging.limitations.includes("aging_evidence"));
assert.ok(aging.limitations.includes("limited_evidence"));

const unavailableEvidence = mustBeUnavailable(
  buildPricingDiagnosticV2({
    listingNightlyPrice: 120,
    currency: "EUR",
    pricingBenchmarkEvidence: buildEvidence({
      evidenceStrength: "unavailable",
      permittedWording: "do_not_claim",
    }),
  }),
);
assert.equal(unavailableEvidence.status, "insufficient_evidence");
assert.ok(unavailableEvidence.reasonCodes.includes("evidence_too_weak"));

const malformedDistribution = mustBeUnavailable(
  buildPricingDiagnosticV2({
    listingNightlyPrice: 120,
    currency: "EUR",
    pricingBenchmarkEvidence: buildEvidence({
      distribution: Object.freeze({
        p10: 80,
        p25: 130,
        median: 120,
        p75: 150,
        p90: 180,
      }),
    }),
  }),
);
assert.equal(malformedDistribution.status, "invalid_input");
assert.ok(
  malformedDistribution.reasonCodes.includes(
    "benchmark_distribution_invalid",
  ),
);

const equalPercentiles = mustBeAvailable(
  buildPricingDiagnosticV2({
    listingNightlyPrice: 120,
    currency: "EUR",
    pricingBenchmarkEvidence: buildEvidence({
      distribution: Object.freeze({
        p10: 120,
        p25: 120,
        median: 120,
        p75: 120,
        p90: 120,
      }),
    }),
  }),
);
assert.equal(equalPercentiles.positionBand, "market_aligned");

const dedupedLimitations = mustBeAvailable(
  buildPricingDiagnosticV2({
    listingNightlyPrice: 120,
    currency: "EUR",
    pricingBenchmarkEvidence: buildEvidence({
      fallbackLevel: "capacity_unknown",
      evidenceStrength: "moderate",
      permittedWording: "moderate_market_evidence",
      limitations: [
        "broad_fallback",
        "small_sample",
        "small_sample",
        "broad_fallback",
      ],
    }),
  }),
);
assert.deepEqual(
  dedupedLimitations.limitations,
  [...new Set(dedupedLimitations.limitations)].sort(),
);
assert.deepEqual(dedupedLimitations.reasonCodes, []);

const first = buildPricingDiagnosticV2({
  listingNightlyPrice: 135,
  currency: "EUR",
  pricingBenchmarkEvidence: buildEvidence(),
});
const second = buildPricingDiagnosticV2({
  listingNightlyPrice: 135,
  currency: "EUR",
  pricingBenchmarkEvidence: buildEvidence(),
});
assert.deepEqual(first, second);

const serialized = JSON.stringify(first);
for (const forbidden of [
  "artifactKey",
  "artifactId",
  "workspaceId",
  "auditId",
  "listingId",
  "factKey",
  "comparable",
  "https://",
  "title",
  "description",
]) {
  assert.equal(serialized.includes(forbidden), false);
}

assert.equal(
  serialized.includes("premium_supported"),
  false,
);
assert.equal(
  serialized.includes("premium_unsupported"),
  false,
);

console.log("PASS — Intelligence v2 Pricing Diagnostic V2 smoke");

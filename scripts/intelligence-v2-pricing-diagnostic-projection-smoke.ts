import assert from "node:assert/strict";

import {
  INTELLIGENCE_V2_PRIVATE_PRICING_DIAGNOSTIC_PROJECTION_CONTRACT_VERSION,
  projectPrivatePricingDiagnostic,
} from "../lib/intelligenceV2/pricingDiagnosticProjection";
import type {
  PricingDiagnosticV2,
} from "../lib/intelligenceV2/pricingDiagnosticV2";
import {
  INTELLIGENCE_V2_PRICING_ACTION_POLICY_VERSION,
  INTELLIGENCE_V2_PRICING_DIAGNOSTIC_CONTRACT_VERSION,
  INTELLIGENCE_V2_PRICING_POSITION_POLICY_VERSION,
} from "../lib/intelligenceV2/policyVersions";

function buildDiagnostic(
  overrides: Partial<PricingDiagnosticV2> = {},
): PricingDiagnosticV2 {
  return Object.freeze({
    diagnosticContractVersion:
      INTELLIGENCE_V2_PRICING_DIAGNOSTIC_CONTRACT_VERSION,
    status: "available",

    currency: "EUR",
    benchmarkPeriod: "2026-06",

    positionBand: "market_aligned",
    percentileBand: "p50_to_p75",
    interquartilePosition: "inside_iqr",
    medianDeltaPercent: 8.5,

    marketRange: Object.freeze({
      p10: 80,
      p25: 100,
      median: 120,
      p75: 150,
      p90: 180,
    }),

    pricingSignal: "aligned",
    recommendedAction: "hold_price",

    evidenceStrength: "strong",
    confidenceLevel: "very_high",
    fallbackLevel: "exact",
    permittedWording: "strong_market_evidence",

    limitations: [],
    reasonCodes: [] as const,

    policyVersions: Object.freeze({
      diagnosticContractVersion:
        INTELLIGENCE_V2_PRICING_DIAGNOSTIC_CONTRACT_VERSION,
      positionPolicyVersion:
        INTELLIGENCE_V2_PRICING_POSITION_POLICY_VERSION,
      actionPolicyVersion:
        INTELLIGENCE_V2_PRICING_ACTION_POLICY_VERSION,
      evidenceContractVersion: "v1",
    }),

    ...overrides,
  });
}

function mustProject(
  diagnostic: PricingDiagnosticV2,
) {
  const result = projectPrivatePricingDiagnostic(diagnostic);

  if (!result.projected) {
    throw new Error(
      `Expected projection: ${result.reasonCodes.join(",")}`,
    );
  }

  return result.projection;
}

function mustReject(
  diagnostic: PricingDiagnosticV2,
) {
  const result = projectPrivatePricingDiagnostic(diagnostic);

  if (result.projected) {
    throw new Error("Expected projection rejection");
  }

  return result;
}

const baseProjection = mustProject(buildDiagnostic());

assert.equal(
  baseProjection.projectionContractVersion,
  INTELLIGENCE_V2_PRIVATE_PRICING_DIAGNOSTIC_PROJECTION_CONTRACT_VERSION,
);
assert.equal(
  baseProjection.diagnosticContractVersion,
  INTELLIGENCE_V2_PRICING_DIAGNOSTIC_CONTRACT_VERSION,
);
assert.equal(baseProjection.status, "available");
assert.equal(baseProjection.positionBand, "market_aligned");
assert.equal(baseProjection.percentileBand, "p50_to_p75");
assert.equal(baseProjection.medianDeltaPercent, 8.5);
assert.equal(baseProjection.pricingSignal, "aligned");
assert.equal(baseProjection.recommendedAction, "hold_price");
assert.equal(baseProjection.evidenceStrength, "strong");
assert.equal(baseProjection.fallbackLevel, "exact");

const limitedProjection = mustProject(
  buildDiagnostic({
    status: "limited",
    evidenceStrength: "limited",
    fallbackLevel: "property_capacity_unknown",
    limitations: [
      "weak_action_only",
      "broad_market_cell",
      "weak_action_only",
      " benchmark_fallback ",
    ],
  }),
);

assert.equal(limitedProjection.status, "limited");
assert.deepEqual(limitedProjection.limitations, [
  "benchmark_fallback",
  "broad_market_cell",
  "weak_action_only",
]);

const normalizedCurrency = mustProject(
  buildDiagnostic({
    currency: " eur ",
  }),
);
assert.equal(normalizedCurrency.currency, "EUR");

const invalidCurrency = mustReject(
  buildDiagnostic({
    currency: "EURO",
  }),
);
assert.ok(
  invalidCurrency.reasonCodes.includes("invalid_currency"),
);

const invalidPeriod = mustReject(
  buildDiagnostic({
    benchmarkPeriod: "2026-13",
  }),
);
assert.ok(
  invalidPeriod.reasonCodes.includes(
    "invalid_benchmark_period",
  ),
);

const invalidDelta = mustReject(
  buildDiagnostic({
    medianDeltaPercent: Number.NaN,
  }),
);
assert.ok(
  invalidDelta.reasonCodes.includes(
    "invalid_median_delta",
  ),
);

const invalidPolicies = mustReject(
  buildDiagnostic({
    diagnosticContractVersion: "v2",
  }),
);
assert.ok(
  invalidPolicies.reasonCodes.includes(
    "invalid_policy_versions",
  ),
);

const deterministicLeft = projectPrivatePricingDiagnostic(
  buildDiagnostic({
    limitations: [
      "limited_evidence",
      "benchmark_fallback",
      "limited_evidence",
    ],
  }),
);
const deterministicRight = projectPrivatePricingDiagnostic(
  buildDiagnostic({
    limitations: [
      "benchmark_fallback",
      "limited_evidence",
    ],
  }),
);

assert.deepEqual(deterministicLeft, deterministicRight);

const serialized = JSON.stringify(baseProjection);

for (const forbidden of [
  "marketRange",
  "interquartilePosition",
  "confidenceLevel",
  "permittedWording",
  "reasonCodes",
  "artifactId",
  "artifactKey",
  "factKey",
  "workspaceId",
  "auditId",
  "listingId",
  "userId",
  "requestedMarketCell",
  "resolvedMarketCell",
  "http://",
  "https://",
  "title",
  "description",
  "comparable",
]) {
  assert.equal(
    serialized.includes(forbidden),
    false,
    `Projection leaks forbidden field: ${forbidden}`,
  );
}

assert.deepEqual(
  Object.keys(baseProjection).sort(),
  [
    "benchmarkPeriod",
    "currency",
    "diagnosticContractVersion",
    "evidenceStrength",
    "fallbackLevel",
    "limitations",
    "medianDeltaPercent",
    "percentileBand",
    "policyVersions",
    "positionBand",
    "pricingSignal",
    "projectionContractVersion",
    "recommendedAction",
    "status",
  ].sort(),
);

console.log(
  "PASS — Intelligence v2 Pricing Diagnostic Projection smoke",
);

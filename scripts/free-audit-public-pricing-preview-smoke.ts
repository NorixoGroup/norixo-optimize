import assert from "node:assert/strict";

import {
  buildFreeAuditPricingPreview,
  type BuildFreeAuditPricingPreviewDependencies,
} from "../lib/freeAudit/publicPricingPreview";
import type {
  FreeAuditPricingPreviewAvailable,
  FreeAuditPricingPreviewInput,
  FreeAuditPricingPreviewInsufficientCoverage,
  FreeAuditPricingPreviewResult,
  FreeAuditPricingPreviewUnavailable,
} from "../lib/freeAudit/publicPricingPreviewContract";
import type { PricingBenchmarkEvidence } from "../lib/intelligenceV2/pricingBenchmarkEvidence";
import {
  INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
  INTELLIGENCE_V2_BENCHMARK_FALLBACK_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_SELECTION_POLICY_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_PRICING_BENCHMARK_EVIDENCE_CONTRACT_VERSION,
} from "../lib/intelligenceV2/policyVersions";

const FORBIDDEN_KEYS = new Set([
  "intendedUse",
  "marketCellKey",
  "artifactId",
  "artifact_id",
  "artifactKey",
  "artifact_key",
  "factKey",
  "fact_key",
  "supersedesArtifactId",
  "supersedes_artifact_id",
  "evidenceContractVersion",
  "diagnosticContractVersion",
  "projectionContractVersion",
  "policyVersions",
  "validFrom",
  "validUntil",
  "fallbackLevel",
  "confidenceLevel",
  "freshnessStatus",
  "permittedWording",
  "reasonCodes",
  "rawSampleSize",
  "includedSampleSize",
  "excludedOutlierCount",
  "sourceClassCount",
  "sourceDiversityBand",
  "approvalStatus",
  "approvedForInternal",
  "approvedForAudit",
  "createdAt",
  "created_at",
  "p10",
  "p90",
  "listingUrl",
]);

function buildBaseInput(
  overrides: Partial<FreeAuditPricingPreviewInput> = {},
): FreeAuditPricingPreviewInput {
  return Object.freeze({
    country: "Morocco",
    city: "Marrakech",
    platform: "booking",
    propertyType: "apartment",
    guestCapacity: 4,
    declaredNightlyPrice: 150,
    currency: "eur",
    ...overrides,
  });
}

function buildEvidence(
  overrides: Partial<PricingBenchmarkEvidence> = {},
): PricingBenchmarkEvidence {
  const requestedMarketCell = Object.freeze({
    country: "morocco",
    city: "marrakech",
    platform: "booking",
    propertyType: "apartment" as const,
    capacityBand: "4_6" as const,
    currency: "EUR",
    marketCellKey: "v1|morocco|marrakech|booking|apartment|4_6|eur",
  });

  const resolvedMarketCell = Object.freeze({
    ...requestedMarketCell,
  });

  return Object.freeze({
    evidenceContractVersion:
      INTELLIGENCE_V2_PRICING_BENCHMARK_EVIDENCE_CONTRACT_VERSION,
    benchmarkType: "pricing_distribution",
    requestedMarketCell,
    resolvedMarketCell,
    fallbackLevel: "exact",
    capturePeriodBucket: "2026-07",
    distribution: Object.freeze({
      p10: 90,
      p25: 120.4,
      median: 150.2,
      p75: 190.6,
      p90: 240.8,
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
      marketCellPolicyVersion: INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
      selectionPolicyVersion:
        INTELLIGENCE_V2_BENCHMARK_SELECTION_POLICY_VERSION,
      fallbackPolicyVersion:
        INTELLIGENCE_V2_BENCHMARK_FALLBACK_POLICY_VERSION,
    }),
    ...overrides,
  });
}

function buildDependencies(input: {
  selector: BuildFreeAuditPricingPreviewDependencies["getPricingBenchmarkEvidence"];
  now?: () => Date;
}): BuildFreeAuditPricingPreviewDependencies {
  return Object.freeze({
    getPricingBenchmarkEvidence: input.selector,
    now: input.now ?? (() => new Date("2026-07-14T10:00:00.000Z")),
  });
}

function collectForbiddenKeys(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectForbiddenKeys(entry, found);
    }
    return found;
  }

  if (value != null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        found.add(key);
      }
      collectForbiddenKeys(nested, found);
    }
  }

  return found;
}

function assertNoForbiddenKeys(result: FreeAuditPricingPreviewResult): void {
  const found = collectForbiddenKeys(JSON.parse(JSON.stringify(result)));
  assert.deepEqual([...found], []);
}

function assertAvailable(
  result: FreeAuditPricingPreviewResult,
): FreeAuditPricingPreviewAvailable {
  assert.equal(result.status, "available");
  return result;
}

function assertInsufficient(
  result: FreeAuditPricingPreviewResult,
): FreeAuditPricingPreviewInsufficientCoverage {
  assert.equal(result.status, "insufficient_coverage");
  return result;
}

function assertUnavailable(
  result: FreeAuditPricingPreviewResult,
): FreeAuditPricingPreviewUnavailable {
  assert.equal(result.status, "unavailable");
  return result;
}

async function main() {
  let selectorCalls = 0;
  const availableResult = await buildFreeAuditPricingPreview(
    buildBaseInput(),
    buildDependencies({
      selector: async () => {
        selectorCalls += 1;
        return Object.freeze({
          available: true,
          evidence: buildEvidence(),
        });
      },
    }),
  );
  const available = assertAvailable(availableResult);
  assert.equal(selectorCalls, 1);
  assert.equal(available.market.currency, "EUR");
  assert.equal(available.market.capacityBand, "4_6");
  assert.deepEqual(available.benchmark, {
    lowPrice: 120,
    medianPrice: 150,
    highPrice: 191,
  });
  assert.equal(available.positioning.band, "below_market");
  assert.equal(available.positioning.deltaFromMedianPercent, -0.1);
  assert.equal(available.confidence.level, "high");
  assert.equal(available.confidence.sampleBand, "strong");
  assert.ok(available.limitations.length >= 3);
  assert.ok(available.recommendations.length >= 2);
  assertNoForbiddenKeys(available);

  assert.equal(
    assertAvailable(
      await buildFreeAuditPricingPreview(
        buildBaseInput({ declaredNightlyPrice: 80 }),
        buildDependencies({
          selector: async () =>
            Object.freeze({
              available: true,
              evidence: buildEvidence(),
            }),
        }),
      ),
    ).positioning.band,
    "well_below_market",
  );

  assert.equal(
    assertAvailable(
      await buildFreeAuditPricingPreview(
        buildBaseInput({ declaredNightlyPrice: 130 }),
        buildDependencies({
          selector: async () =>
            Object.freeze({
              available: true,
              evidence: buildEvidence(),
            }),
        }),
      ),
    ).positioning.band,
    "below_market",
  );

  assert.equal(
    assertAvailable(
      await buildFreeAuditPricingPreview(
        buildBaseInput({ declaredNightlyPrice: 150.2 }),
        buildDependencies({
          selector: async () =>
            Object.freeze({
              available: true,
              evidence: buildEvidence(),
            }),
        }),
      ),
    ).positioning.band,
    "near_market",
  );

  assert.equal(
    assertAvailable(
      await buildFreeAuditPricingPreview(
        buildBaseInput({ declaredNightlyPrice: 210 }),
        buildDependencies({
          selector: async () =>
            Object.freeze({
              available: true,
              evidence: buildEvidence(),
            }),
        }),
      ),
    ).positioning.band,
    "above_market",
  );

  const wellAbove = assertAvailable(
    await buildFreeAuditPricingPreview(
      buildBaseInput({ declaredNightlyPrice: 260 }),
      buildDependencies({
        selector: async () =>
          Object.freeze({
            available: true,
            evidence: buildEvidence({
              fallbackLevel: "property_capacity_unknown",
              sampleSizeBand: "20_39",
              evidenceStrength: "limited",
              permittedWording: "limited_market_evidence",
              limitations: ["broad_fallback"],
            }),
          }),
      }),
    ),
  );
  assert.equal(wellAbove.positioning.band, "well_above_market");
  assert.equal(wellAbove.confidence.level, "standard");
  assert.equal(wellAbove.confidence.sampleBand, "sufficient");
  assert.ok(wellAbove.limitations.includes(
    "Le benchmark disponible couvre un segment de marche plus large que la demande initiale.",
  ));
  assertNoForbiddenKeys(wellAbove);

  const insufficient = assertInsufficient(
    await buildFreeAuditPricingPreview(
      buildBaseInput(),
      buildDependencies({
        selector: async () =>
          Object.freeze({
            available: false,
            status: "unavailable",
            reasonCodes: ["no_artifact"],
          }),
      }),
    ),
  );
  assert.equal(insufficient.message, "Nous ne disposons pas encore d'un volume suffisant de donnees agregees pour ce marche.");
  assert.equal("benchmark" in insufficient, false);
  assert.equal("recommendations" in insufficient, false);
  assertNoForbiddenKeys(insufficient);

  const unavailableFromDisabled = assertUnavailable(
    await buildFreeAuditPricingPreview(
      buildBaseInput(),
      buildDependencies({
        selector: async () =>
          Object.freeze({
            available: false,
            status: "disabled",
            reasonCodes: ["flag_disabled"],
          }),
      }),
    ),
  );
  assert.equal(
    unavailableFromDisabled.message,
    "L'apercu gratuit est temporairement indisponible.",
  );
  assertNoForbiddenKeys(unavailableFromDisabled);

  const unavailableFromThrow = assertUnavailable(
    await buildFreeAuditPricingPreview(
      buildBaseInput(),
      buildDependencies({
        selector: async () => {
          throw new Error("sensitive supabase failure");
        },
      }),
    ),
  );
  assert.equal(
    unavailableFromThrow.message,
    "L'apercu gratuit est temporairement indisponible.",
  );
  assertNoForbiddenKeys(unavailableFromThrow);

  let invalidSelectorCalls = 0;
  const invalidInputs: unknown[] = [
    buildBaseInput({ country: "   " }),
    buildBaseInput({ city: "   " }),
    Object.freeze({ ...buildBaseInput(), platform: "other" }),
    Object.freeze({ ...buildBaseInput(), propertyType: "castle" }),
    buildBaseInput({ guestCapacity: 0 }),
    buildBaseInput({ guestCapacity: 2.5 }),
    buildBaseInput({ declaredNightlyPrice: 0 }),
    buildBaseInput({ declaredNightlyPrice: -1 }),
    buildBaseInput({ currency: "EURO" }),
    buildBaseInput({ declaredNightlyPrice: Number.NaN }),
    buildBaseInput({ declaredNightlyPrice: Number.POSITIVE_INFINITY }),
  ];
  for (const invalidInput of invalidInputs) {
    const result = await buildFreeAuditPricingPreview(
      invalidInput as FreeAuditPricingPreviewInput,
      buildDependencies({
        selector: async () => {
          invalidSelectorCalls += 1;
          return Object.freeze({
            available: true,
            evidence: buildEvidence(),
          });
        },
      }),
    );
    assertUnavailable(result);
  }
  assert.equal(invalidSelectorCalls, 0);

  let capturedPeriod: string | null = null;
  await buildFreeAuditPricingPreview(
    buildBaseInput(),
    buildDependencies({
      now: () => new Date("2026-07-31T23:59:59.999Z"),
      selector: async (input) => {
        capturedPeriod = input.capturePeriodBucket;
        return Object.freeze({
          available: false,
          status: "unavailable",
          reasonCodes: ["no_artifact"],
        });
      },
    }),
  );
  assert.equal(capturedPeriod, "2026-07");

  console.log("PASS — Free audit public pricing preview smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";

import {
  buildFreeAuditPricingPreview,
  type BuildFreeAuditPricingPreviewDependencies,
} from "../lib/freeAudit/publicPricingPreview";
import type {
  FreeAuditMarketOverviewAvailable,
  FreeAuditMarketOverviewInput,
  FreeAuditMarketOverviewInsufficientCoverage,
  FreeAuditMarketOverviewUnavailable,
  FreeAuditPricingPreviewResult,
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
  "guestCapacity",
  "declaredNightlyPrice",
  "positioning",
  "deltaFromMedianPercent",
]);

function buildBaseInput(
  overrides: Partial<FreeAuditMarketOverviewInput> = {},
): FreeAuditMarketOverviewInput {
  return Object.freeze({
    country: "Morocco",
    city: "Marrakech",
    platform: "booking",
    propertyType: "apartment",
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
    capacityBand: "unknown" as const,
    currency: "EUR",
    marketCellKey: "v1|morocco|marrakech|booking|apartment|unknown|eur",
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
): FreeAuditMarketOverviewAvailable {
  assert.equal(result.status, "available");
  return result;
}

function assertInsufficient(
  result: FreeAuditPricingPreviewResult,
): FreeAuditMarketOverviewInsufficientCoverage {
  assert.equal(result.status, "insufficient_coverage");
  return result;
}

function assertUnavailable(
  result: FreeAuditPricingPreviewResult,
): FreeAuditMarketOverviewUnavailable {
  assert.equal(result.status, "unavailable");
  return result;
}

function buildDependencies(input: {
  selector: NonNullable<BuildFreeAuditPricingPreviewDependencies["getPricingBenchmarkEvidence"]>;
  listCurrencies: NonNullable<
    BuildFreeAuditPricingPreviewDependencies["listMarketOverviewArtifactCurrencies"]
  >;
  now?: () => Date;
}): BuildFreeAuditPricingPreviewDependencies {
  return Object.freeze({
    getPricingBenchmarkEvidence: input.selector,
    listMarketOverviewArtifactCurrencies: input.listCurrencies,
    now: input.now ?? (() => new Date("2026-07-14T10:00:00.000Z")),
  });
}

async function main() {
  {
    let selectorCalls = 0;
    let capturedSelectorInput: Record<string, unknown> | null = null;
    let capturedDiscoveryInput: Record<string, unknown> | null = null;

    const result = await buildFreeAuditPricingPreview(
      buildBaseInput(),
      buildDependencies({
        listCurrencies: async (input) => {
          capturedDiscoveryInput = input;
          return Object.freeze({
            ok: true,
            rows: Object.freeze([{ currency: "EUR" }]),
          });
        },
        selector: async (input) => {
          selectorCalls += 1;
          capturedSelectorInput = input;
          return Object.freeze({
            available: true,
            evidence: buildEvidence(),
          });
        },
      }),
    );

    const available = assertAvailable(result);
    assert.equal(selectorCalls, 1);
    assert.deepEqual(capturedDiscoveryInput, {
      country: "Morocco",
      city: "Marrakech",
      platform: "booking",
      propertyType: "apartment",
      capturePeriodBucket: "2026-07",
    });
    assert.deepEqual(capturedSelectorInput, {
      country: "Morocco",
      city: "Marrakech",
      platform: "booking",
      propertyType: "apartment",
      currency: "EUR",
      capturePeriodBucket: "2026-07",
      intendedUse: "private_audit",
    });
    assert.equal("guestCapacity" in capturedSelectorInput!, false);
    assert.equal("capacity" in capturedSelectorInput!, false);
    assert.deepEqual(available.market, {
      country: "morocco",
      city: "marrakech",
      platform: "booking",
      propertyType: "apartment",
    });
    assert.deepEqual(available.benchmark, {
      lowPrice: 120,
      medianPrice: 150,
      highPrice: 191,
      currency: "EUR",
    });
    assert.equal(available.confidence.level, "high");
    assert.equal(available.confidence.sampleBand, "strong");
    assert.equal(available.limitations.length >= 3, true);
    assert.equal(available.recommendations.length >= 3, true);
    assert.equal(available.limitations.includes("aggregated_market_data"), true);
    assert.equal(available.recommendations.includes("full_audit_for_positioning"), true);
    assertNoForbiddenKeys(available);
  }

  {
    const result = await buildFreeAuditPricingPreview(
      buildBaseInput(),
      buildDependencies({
        listCurrencies: async () =>
          Object.freeze({
            ok: true,
            rows: Object.freeze([{ currency: "EUR" }]),
          }),
        selector: async () =>
          Object.freeze({
            available: true,
            evidence: buildEvidence({
              fallbackLevel: "capacity_unknown",
              resolvedMarketCell: Object.freeze({
                country: "morocco",
                city: "marrakech",
                platform: "booking",
                propertyType: "unknown",
                capacityBand: "unknown",
                currency: "EUR",
                marketCellKey: "v1|morocco|marrakech|booking|unknown|unknown|eur",
              }),
              limitations: ["benchmark_fallback", "broad_market_cell"],
              sampleSizeBand: "20_39",
              evidenceStrength: "moderate",
            }),
          }),
      }),
    );

    const available = assertAvailable(result);
    assert.equal(available.market.propertyType, "unknown");
    assert.equal(available.confidence.level, "standard");
    assert.equal(available.confidence.sampleBand, "sufficient");
    assert.equal(
      available.limitations.includes("broad_market_segment"),
      true,
    );
    assertNoForbiddenKeys(available);
  }

  {
    const result = await buildFreeAuditPricingPreview(
      buildBaseInput(),
      buildDependencies({
        listCurrencies: async () =>
          Object.freeze({
            ok: true,
            rows: Object.freeze([{ currency: "EUR" }, { currency: "USD" }]),
          }),
        selector: async (input) =>
          Object.freeze({
            available: true,
            evidence: buildEvidence({
              requestedMarketCell: Object.freeze({
                country: "morocco",
                city: "marrakech",
                platform: "booking",
                propertyType: "apartment",
                capacityBand: "unknown",
                currency: input.currency,
                marketCellKey: `v1|morocco|marrakech|booking|apartment|unknown|${String(
                  input.currency,
                ).toLowerCase()}`,
              }),
              resolvedMarketCell: Object.freeze({
                country: "morocco",
                city: "marrakech",
                platform: "booking",
                propertyType: "apartment",
                capacityBand: "unknown",
                currency: input.currency,
                marketCellKey: `v1|morocco|marrakech|booking|apartment|unknown|${String(
                  input.currency,
                ).toLowerCase()}`,
              }),
            }),
          }),
      }),
    );

    const insufficient = assertInsufficient(result);
    assert.equal(
      insufficient.limitations.includes("multi_currency_market"),
      true,
    );
    assertNoForbiddenKeys(insufficient);
  }

  {
    const noRows = assertInsufficient(
      await buildFreeAuditPricingPreview(
        buildBaseInput(),
        buildDependencies({
          listCurrencies: async () =>
            Object.freeze({
              ok: true,
              rows: Object.freeze([]),
            }),
          selector: async () => {
            throw new Error("selector should not run without currencies");
          },
        }),
      ),
    );
    assert.equal(noRows.market.platform, "booking");
    assertNoForbiddenKeys(noRows);
  }

  {
    const invalidCurrencyRows = assertInsufficient(
      await buildFreeAuditPricingPreview(
        buildBaseInput(),
        buildDependencies({
          listCurrencies: async () =>
            Object.freeze({
              ok: true,
              rows: Object.freeze([{ currency: "UNKNOWN" }, { currency: null }]),
            }),
          selector: async () => {
            throw new Error("selector should not run for unusable currencies");
          },
        }),
      ),
    );
    assert.equal(invalidCurrencyRows.market.city, "marrakech");
    assertNoForbiddenKeys(invalidCurrencyRows);
  }

  {
    const unavailable = assertUnavailable(
      await buildFreeAuditPricingPreview(
        buildBaseInput(),
        buildDependencies({
          listCurrencies: async () => Object.freeze({ ok: false }),
          selector: async () => {
            throw new Error("selector should not run when discovery fails");
          },
        }),
      ),
    );
    assert.equal(
      unavailable.message,
      "L'apercu gratuit est temporairement indisponible.",
    );
    assertNoForbiddenKeys(unavailable);
  }

  {
    const unavailable = assertUnavailable(
      await buildFreeAuditPricingPreview(
        buildBaseInput(),
        buildDependencies({
          listCurrencies: async () =>
            Object.freeze({
              ok: true,
              rows: Object.freeze([{ currency: "EUR" }]),
            }),
          selector: async () =>
            Object.freeze({
              available: false,
              status: "database_error",
              reasonCodes: ["query_failed"],
            }),
        }),
      ),
    );
    assertNoForbiddenKeys(unavailable);
  }

  {
    const unavailable = assertUnavailable(
      await buildFreeAuditPricingPreview(
        buildBaseInput(),
        buildDependencies({
          listCurrencies: async () =>
            Object.freeze({
              ok: true,
              rows: Object.freeze([{ currency: "EUR" }]),
            }),
          selector: async () =>
            Object.freeze({
              available: true,
              evidence: buildEvidence({
                distribution: Object.freeze({
                  p10: 90,
                  p25: 190,
                  median: 150,
                  p75: 120,
                  p90: 240,
                }),
              }),
            }),
        }),
      ),
    );
    assertNoForbiddenKeys(unavailable);
  }

  {
    let selectorCalls = 0;
    const invalidInputs: unknown[] = [
      buildBaseInput({ country: "   " }),
      buildBaseInput({ city: "   " }),
      Object.freeze({ ...buildBaseInput(), platform: "other" }),
      Object.freeze({ ...buildBaseInput(), propertyType: "castle" }),
    ];

    for (const invalidInput of invalidInputs) {
      const result = await buildFreeAuditPricingPreview(
        invalidInput as FreeAuditMarketOverviewInput,
        buildDependencies({
          listCurrencies: async () =>
            Object.freeze({
              ok: true,
              rows: Object.freeze([{ currency: "EUR" }]),
            }),
          selector: async () => {
            selectorCalls += 1;
            return Object.freeze({
              available: true,
              evidence: buildEvidence(),
            });
          },
        }),
      );
      assertUnavailable(result);
    }

    assert.equal(selectorCalls, 0);
  }

  console.log("PASS — Free audit public pricing preview smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

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
import type { PublicMarketOverviewSelectorResult } from "../lib/intelligenceV2/publicMarketOverviewSelector";

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
  "requestedPropertyType",
  "resolvedPropertyType",
  "propertyScope",
  "capacityScope",
  "limitationCodes",
  "sourceWindow",
  "reasonCode",
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

function buildPublicAvailableResult(
  overrides: Partial<Extract<PublicMarketOverviewSelectorResult, { status: "available" }>> = {},
): Extract<PublicMarketOverviewSelectorResult, { status: "available" }> {
  return Object.freeze({
    status: "available",
    market: Object.freeze({
      country: "morocco",
      city: "marrakech",
      platform: "all",
      platformScope: "all_platforms",
      requestedPropertyType: "apartment",
      resolvedPropertyType: "apartment",
      propertyScope: "exact",
      capacityScope: "all_capacities",
    }),
    benchmark: Object.freeze({
      p25: 120.4,
      median: 150.2,
      p75: 190.6,
      currency: "EUR",
    }),
    confidence: "high",
    sampleBand: "strong",
    limitationCodes: Object.freeze([
      "all_capacities_scope",
      "multi_platform_scope",
    ] as const),
    sourceWindow: Object.freeze({
      aggregationWindow: "rolling_90_days",
      validFrom: "2026-07-01T00:00:00.000Z",
      validUntil: "2026-09-29T00:00:00.000Z",
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
  selector: NonNullable<
    BuildFreeAuditPricingPreviewDependencies["getPublicMarketOverviewEvidence"]
  >;
  now?: () => Date;
}): BuildFreeAuditPricingPreviewDependencies {
  return Object.freeze({
    getPublicMarketOverviewEvidence: input.selector,
    now: input.now ?? (() => new Date("2026-07-15T10:00:00.000Z")),
  });
}

async function main() {
  {
    let selectorCalls = 0;
    let capturedSelectorInput: Record<string, unknown> | null = null;
    let capturedNow: unknown;

    const result = await buildFreeAuditPricingPreview(
      buildBaseInput(),
      buildDependencies({
        selector: async (input) => {
          selectorCalls += 1;
          capturedNow = input.now;
          capturedSelectorInput = input as Record<string, unknown>;
          return buildPublicAvailableResult();
        },
      }),
    );

    const available = assertAvailable(result);
    assert.equal(selectorCalls, 1);
    assert.deepEqual(capturedSelectorInput, {
      country: "Morocco",
      city: "Marrakech",
      platform: "booking",
      propertyType: "apartment",
      now: capturedNow,
    });
    assert.equal(typeof capturedNow, "function");
    assert.equal("guestCapacity" in capturedSelectorInput!, false);
    assert.equal("currency" in capturedSelectorInput!, false);
    assert.equal("capturePeriodBucket" in capturedSelectorInput!, false);
    assert.equal("intendedUse" in capturedSelectorInput!, false);
    assert.deepEqual(available.market, {
      country: "morocco",
      city: "marrakech",
      platform: "all",
      platformScope: "all_platforms",
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
    assert.equal(available.limitations.includes("aggregated_market_data"), true);
    assert.equal(available.limitations.includes("all_capacities_scope"), true);
    assert.equal(available.limitations.includes("multi_platform_scope"), true);
    assert.equal(available.recommendations.includes("full_audit_for_positioning"), true);
    assertNoForbiddenKeys(available);
  }

  {
    const result = await buildFreeAuditPricingPreview(
      buildBaseInput(),
      buildDependencies({
        selector: async () =>
          buildPublicAvailableResult({
            market: Object.freeze({
              country: "morocco",
              city: "marrakech",
              platform: "all",
              platformScope: "all_platforms",
              requestedPropertyType: "apartment",
              resolvedPropertyType: "unknown",
              propertyScope: "broader_market",
              capacityScope: "all_capacities",
            }),
            confidence: "standard",
            sampleBand: "sufficient",
            limitationCodes: Object.freeze([
              "all_capacities_scope",
              "multi_platform_scope",
              "broader_market_segment",
            ] as const),
          }),
      }),
    );

    const available = assertAvailable(result);
    assert.equal(available.market.propertyType, "unknown");
    assert.equal(available.confidence.level, "standard");
    assert.equal(available.confidence.sampleBand, "sufficient");
    assert.equal(available.limitations.includes("broad_market_segment"), true);
    assert.equal(available.limitations.includes("all_capacities_scope"), true);
    assert.equal(available.limitations.includes("multi_platform_scope"), true);
    assert.equal(available.recommendations.includes("broader_segment_used"), true);
    assertNoForbiddenKeys(available);
  }

  {
    const result = await buildFreeAuditPricingPreview(
      buildBaseInput({
        platform: "airbnb",
      }),
      buildDependencies({
        selector: async () =>
          buildPublicAvailableResult({
            market: Object.freeze({
              country: "ma",
              city: "marrakech",
              platform: "all",
              platformScope: "all_platforms",
              requestedPropertyType: "apartment",
              resolvedPropertyType: "unknown",
              propertyScope: "broader_market",
              capacityScope: "all_capacities",
            }),
            benchmark: Object.freeze({
              p25: 43,
              median: 68,
              p75: 99,
              currency: "EUR",
            }),
            confidence: "standard",
            sampleBand: "sufficient",
            limitationCodes: Object.freeze([
              "all_capacities_scope",
              "multi_platform_scope",
              "broader_market_segment",
              "limited_sample_size",
              "limited_source_diversity",
            ] as const),
          }),
      }),
    );

    const available = assertAvailable(result);
    assert.deepEqual(available.benchmark, {
      lowPrice: 43,
      medianPrice: 68,
      highPrice: 99,
      currency: "EUR",
    });
    assert.equal(available.market.platform, "all");
    assert.equal(available.market.platformScope, "all_platforms");
    assert.equal(available.market.propertyType, "unknown");
    assert.equal(available.limitations.includes("broad_market_segment"), true);
    assert.equal(available.limitations.includes("all_capacities_scope"), true);
    assert.equal(available.limitations.includes("multi_platform_scope"), true);
    assert.equal(available.limitations.includes("limited_sample_size"), true);
    assert.equal(available.limitations.includes("limited_source_diversity"), true);
    assert.equal(available.recommendations.includes("broader_segment_used"), true);
    assertNoForbiddenKeys(available);
  }

  {
    const result = await buildFreeAuditPricingPreview(
      buildBaseInput(),
      buildDependencies({
        selector: async () =>
          Object.freeze({
            status: "insufficient_coverage",
            reasonCode: "ambiguous_currency",
          }),
      }),
    );

    const insufficient = assertInsufficient(result);
    assert.equal(insufficient.limitations.includes("multi_currency_market"), true);
    assertNoForbiddenKeys(insufficient);
  }

  {
    const result = await buildFreeAuditPricingPreview(
      buildBaseInput(),
      buildDependencies({
        selector: async () =>
          Object.freeze({
            status: "insufficient_coverage",
            reasonCode: "no_public_artifact",
          }),
      }),
    );

    const insufficient = assertInsufficient(result);
    assert.equal(insufficient.market.platform, "all");
    assert.equal(insufficient.market.platformScope, "all_platforms");
    assertNoForbiddenKeys(insufficient);
  }

  {
    const unavailable = assertUnavailable(
      await buildFreeAuditPricingPreview(
        buildBaseInput(),
        buildDependencies({
          selector: async () =>
            Object.freeze({
              status: "unavailable",
              reasonCode: "database_read_error",
            }),
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
          selector: async () =>
            buildPublicAvailableResult({
              benchmark: Object.freeze({
                p25: 190,
                median: 150,
                p75: 120,
                currency: "EUR",
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
          selector: async () => {
            selectorCalls += 1;
            return buildPublicAvailableResult();
          },
        }),
      );
      assertUnavailable(result);
    }

    assert.equal(selectorCalls, 0);
  }

  console.log("PASS — Free audit multi-platform overview smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

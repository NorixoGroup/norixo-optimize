import assert from "node:assert/strict";

import {
  getPublicMarketOverviewEvidence,
  type PublicMarketOverviewSelectionInput,
} from "../lib/intelligenceV2/publicMarketOverviewSelector";

type SelectorRow = Record<string, unknown>;

function buildInput(
  overrides: Partial<PublicMarketOverviewSelectionInput> = {},
): PublicMarketOverviewSelectionInput {
  return Object.freeze({
    country: "Morocco",
    city: "Marrakech",
    platform: "airbnb",
    propertyType: "apartment",
    now: () => new Date("2026-07-15T10:00:00.000Z"),
    ...overrides,
  });
}

function buildRow(overrides: Partial<SelectorRow> = {}): SelectorRow {
  return Object.freeze({
    id: "artifact-1",
    benchmark_type: "pricing_distribution",
    approval_status: "internal_approved",
    approved_for_internal: true,
    approved_for_audit: false,
    intended_use: "public_market_overview",
    aggregation_window: "rolling_90_days",
    platform_scope: "all_platforms",
    capacity_scope: "all_capacities",
    property_scope: "exact",
    country: "morocco",
    city: "marrakech",
    platform: "all",
    property_type: "apartment",
    currency: "EUR",
    capture_period_bucket: "2026-07",
    p25_price: 43,
    median_price: 68,
    p75_price: 99,
    included_sample_size: 17,
    confidence_level: "moderate",
    valid_from: "2026-07-01T00:00:00.000Z",
    valid_until: "2026-09-29T00:00:00.000Z",
    limitations: ["small_sample"],
    created_at: "2026-07-15T00:00:00.000Z",
    ...overrides,
  });
}

async function main() {
  {
    let capturedLoadInput: Record<string, unknown> | null = null;
    const result = await getPublicMarketOverviewEvidence(buildInput(), {
      loadArtifacts: async (input) => {
        capturedLoadInput = input;
        return Object.freeze({
          ok: true,
          rows: Object.freeze([
            buildRow({
              id: "private-artifact",
              intended_use: "private_audit",
            }),
            buildRow({
              id: "approved-for-audit",
              approved_for_audit: true,
            }),
            buildRow({
              id: "broader",
              property_scope: "broader_market",
              property_type: "unknown",
              limitations: ["broad_fallback", "small_sample"],
            }),
            buildRow({
              id: "exact",
              property_scope: "exact",
              property_type: "apartment",
              included_sample_size: 36,
              confidence_level: "high",
              limitations: [],
              created_at: "2026-07-16T00:00:00.000Z",
            }),
          ]),
        });
      },
    });

    assert.deepEqual(capturedLoadInput, {
      country: "ma",
      city: "marrakech",
      propertyType: "apartment",
    });
    assert.equal(result.status, "available");
    assert.deepEqual(result.market, {
      country: "morocco",
      city: "marrakech",
      platform: "all",
      platformScope: "all_platforms",
      requestedPropertyType: "apartment",
      resolvedPropertyType: "apartment",
      propertyScope: "exact",
      capacityScope: "all_capacities",
    });
    assert.deepEqual(result.benchmark, {
      p25: 43,
      median: 68,
      p75: 99,
      currency: "EUR",
    });
    assert.equal(result.confidence, "high");
    assert.equal(result.sampleBand, "strong");
    assert.deepEqual(result.limitationCodes, [
      "all_capacities_scope",
      "multi_platform_scope",
    ]);
  }

  {
    const result = await getPublicMarketOverviewEvidence(buildInput(), {
      loadArtifacts: async () =>
        Object.freeze({
          ok: true,
          rows: Object.freeze([
            buildRow({
              property_scope: "broader_market",
              property_type: "unknown",
              limitations: ["broad_fallback", "small_sample", "aging_data"],
            }),
          ]),
        }),
    });

    assert.equal(result.status, "available");
    assert.equal(result.market.platformScope, "all_platforms");
    assert.equal(result.market.propertyScope, "broader_market");
    assert.equal(result.market.resolvedPropertyType, "unknown");
    assert.deepEqual(result.limitationCodes, [
      "aging_data",
      "all_capacities_scope",
      "broader_market_segment",
      "limited_sample_size",
      "multi_platform_scope",
    ]);
  }

  {
    const result = await getPublicMarketOverviewEvidence(buildInput(), {
      loadArtifacts: async () =>
        Object.freeze({
          ok: true,
          rows: Object.freeze([
            buildRow({ id: "eur", currency: "EUR" }),
            buildRow({ id: "usd", currency: "USD" }),
          ]),
        }),
    });

    assert.deepEqual(result, {
      status: "insufficient_coverage",
      reasonCode: "ambiguous_currency",
    });
  }

  {
    const result = await getPublicMarketOverviewEvidence(buildInput(), {
      loadArtifacts: async () =>
        Object.freeze({
          ok: true,
          rows: Object.freeze([
            buildRow({
              id: "expired-exact",
              valid_from: "2026-01-01T00:00:00.000Z",
              valid_until: "2026-02-01T00:00:00.000Z",
            }),
            buildRow({
              id: "broader-valid",
              property_scope: "broader_market",
              property_type: "unknown",
              limitations: ["broad_fallback"],
            }),
          ]),
        }),
    });

    assert.equal(result.status, "available");
    assert.equal(result.market.propertyScope, "broader_market");
  }

  {
    const result = await getPublicMarketOverviewEvidence(buildInput(), {
      loadArtifacts: async () =>
        Object.freeze({
          ok: true,
          rows: Object.freeze([
            buildRow({
              id: "malformed",
              p25_price: 100,
              median_price: 50,
              p75_price: 20,
            }),
            buildRow({
              id: "valid",
              property_scope: "broader_market",
              property_type: "unknown",
              limitations: ["broad_fallback"],
            }),
          ]),
        }),
    });

    assert.equal(result.status, "available");
    assert.equal(result.market.propertyScope, "broader_market");
  }

  {
    const result = await getPublicMarketOverviewEvidence(buildInput(), {
      loadArtifacts: async () => Object.freeze({ ok: false }),
    });

    assert.deepEqual(result, {
      status: "unavailable",
      reasonCode: "database_read_error",
    });
  }

  {
    const result = await getPublicMarketOverviewEvidence(buildInput({
      country: "   ",
    }));

    assert.deepEqual(result, {
      status: "unavailable",
      reasonCode: "invalid_input",
    });
  }

  {
    const result = await getPublicMarketOverviewEvidence(buildInput(), {
      loadArtifacts: async () =>
        Object.freeze({
          ok: true,
          rows: Object.freeze([]),
        }),
    });

    assert.deepEqual(result, {
      status: "insufficient_coverage",
      reasonCode: "no_public_artifact",
    });
  }

  console.log("PASS — Multi-platform public market overview selector smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

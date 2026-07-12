import {
  DEBUG_INTELLIGENCE_V2,
  ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION,
  ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION,
  ENABLE_INTELLIGENCE_FACT_CONTRIBUTION,
  ENABLE_INTELLIGENCE_FACT_TRANSFORMATION,
  getIntelligenceV2FeatureFlags,
} from "../lib/intelligenceV2/featureFlags";
import { buildMarketCellV1 } from "../lib/intelligenceV2/marketCell";
import {
  buildAnonymousPricingFactIdentityProjection,
  projectAnonymousPricingFactIdempotencyInputs,
  transformCandidateToAnonymousPricingFact,
  type AnonymousPricingFact,
  type AnonymousPricingFactCandidate,
  type AnonymousPricingFactTransformResult,
} from "../lib/intelligenceV2/pricingFact";
import { validateSharedIntelligencePrivacy } from "../lib/intelligenceV2/privacyValidator";

type ScenarioResult = {
  scenario: string;
  status: "pass" | "fail";
  reason?: string;
  marketCellKey?: string;
  privacyViolationCodes?: string[];
};

function fail(message: string): never {
  throw new Error(message);
}

function expect(condition: boolean, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function expectRejected(
  result: AnonymousPricingFactTransformResult,
  reason: string,
  message: string,
): void {
  expect(result.accepted === false, `${message}: expected rejection`);
  if (result.accepted) {
    fail(`${message}: expected rejection`);
  }
  expect(result.reason === reason, `${message}: expected ${reason}, got ${result.reason}`);
}

function expectAccepted(
  result: AnonymousPricingFactTransformResult,
  message: string,
): AnonymousPricingFact {
  expect(result.accepted === true, `${message}: expected accepted result`);
  if (!result.accepted) {
    fail(`${message}: expected accepted result`);
  }
  return result.fact;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildBaseCandidate(
  overrides: Partial<AnonymousPricingFactCandidate> = {},
): AnonymousPricingFactCandidate {
  return {
    sourceClass: "authenticated_audit",
    capturedAt: "2026-07-01T12:34:56.000Z",
    platform: "booking",
    country: "Morocco",
    city: "Marrakech",
    propertyType: "apartment",
    capacity: 4,
    guestCapacity: 4,
    currency: "eur",
    nightlyPrice: 182.45,
    extractionQuality: "high",
    comparableQuality: "high",
    freshness: "fresh",
    ...overrides,
  };
}

function logScenario(result: ScenarioResult): void {
  console.log(JSON.stringify(result));
}

async function main() {
  const scenarioResults: ScenarioResult[] = [];
  const run = (scenario: string, fn: () => void) => {
    try {
      fn();
      const result: ScenarioResult = { scenario, status: "pass" };
      scenarioResults.push(result);
      logScenario(result);
    } catch (error) {
      const result: ScenarioResult = {
        scenario,
        status: "fail",
        reason: error instanceof Error ? error.message : String(error),
      };
      scenarioResults.push(result);
      logScenario(result);
    }
  };

  run("authenticated_audit_valid", () => {
    const fact = expectAccepted(
      transformCandidateToAnonymousPricingFact(buildBaseCandidate()),
      "authenticated_audit_valid",
    );
    expect(fact.sourceClass === "authenticated_audit", "wrong source class");
  });

  run("authenticated_listing_valid", () => {
    const fact = expectAccepted(
      transformCandidateToAnonymousPricingFact(
        buildBaseCandidate({ sourceClass: "authenticated_listing" }),
      ),
      "authenticated_listing_valid",
    );
    expect(fact.sourceClass === "authenticated_listing", "wrong source class");
  });

  run("guest_audit_rejected", () => {
    expectRejected(
      transformCandidateToAnonymousPricingFact(
        buildBaseCandidate({ sourceClass: "guest_audit" }),
      ),
      "guest_source_not_allowed",
      "guest_audit_rejected",
    );
  });

  run("historical_backfill_rejected", () => {
    expectRejected(
      transformCandidateToAnonymousPricingFact(
        buildBaseCandidate({ sourceClass: "historical_backfill" }),
      ),
      "historical_backfill_disabled",
      "historical_backfill_rejected",
    );
  });

  run("unknown_currency_rejected", () => {
    expectRejected(
      transformCandidateToAnonymousPricingFact(
        buildBaseCandidate({ currency: "euro" }),
      ),
      "invalid_currency",
      "unknown_currency_rejected",
    );
  });

  run("zero_price_rejected", () => {
    expectRejected(
      transformCandidateToAnonymousPricingFact(buildBaseCandidate({ nightlyPrice: 0 })),
      "invalid_nightly_price",
      "zero_price_rejected",
    );
  });

  run("negative_price_rejected", () => {
    expectRejected(
      transformCandidateToAnonymousPricingFact(buildBaseCandidate({ nightlyPrice: -12 })),
      "invalid_nightly_price",
      "negative_price_rejected",
    );
  });

  run("invalid_date_rejected", () => {
    expectRejected(
      transformCandidateToAnonymousPricingFact(
        buildBaseCandidate({ capturedAt: "not-a-date" }),
      ),
      "invalid_capture_date",
      "invalid_date_rejected",
    );
  });

  run("missing_capacity_becomes_unknown", () => {
    const fact = expectAccepted(
      transformCandidateToAnonymousPricingFact(
        buildBaseCandidate({ capacity: null, guestCapacity: null }),
      ),
      "missing_capacity_becomes_unknown",
    );
    expect(fact.marketCell.capacityBand === "unknown", "capacity band should be unknown");
  });

  run("unknown_property_type_becomes_unknown", () => {
    const fact = expectAccepted(
      transformCandidateToAnonymousPricingFact(
        buildBaseCandidate({ propertyType: "castle" }),
      ),
      "unknown_property_type_becomes_unknown",
    );
    expect(fact.marketCell.propertyType === "unknown", "property type should be unknown");
  });

  run("market_cell_key_is_stable", () => {
    const left = buildMarketCellV1(buildBaseCandidate());
    const right = buildMarketCellV1(buildBaseCandidate());
    expect(left.marketCellKey === right.marketCellKey, "market cell key must be stable");
  });

  run("same_input_same_fact_logic", () => {
    const left = expectAccepted(
      transformCandidateToAnonymousPricingFact(buildBaseCandidate()),
      "same_input_same_fact_logic:left",
    );
    const right = expectAccepted(
      transformCandidateToAnonymousPricingFact(buildBaseCandidate()),
      "same_input_same_fact_logic:right",
    );
    expect(deepEqual(left, right), "facts must be identical");
    expect(
      deepEqual(
        buildAnonymousPricingFactIdentityProjection(left),
        buildAnonymousPricingFactIdentityProjection(right),
      ),
      "identity projection must be identical",
    );
  });

  run("missing_country_rejected", () => {
    expectRejected(
      transformCandidateToAnonymousPricingFact(buildBaseCandidate({ country: null })),
      "missing_country",
      "missing_country_rejected",
    );
  });

  run("missing_city_rejected", () => {
    expectRejected(
      transformCandidateToAnonymousPricingFact(buildBaseCandidate({ city: null })),
      "missing_city",
      "missing_city_rejected",
    );
  });

  run("unknown_platform_rejected", () => {
    expectRejected(
      transformCandidateToAnonymousPricingFact(buildBaseCandidate({ platform: "mystery" })),
      "unsupported_platform",
      "unknown_platform_rejected",
    );
  });

  run("url_injected_detected", () => {
    const validation = validateSharedIntelligencePrivacy({
      marketCell: {
        country: "ma",
      },
      metadata: {
        source_url: "https://private.example.com/listing/123",
      },
    });
    expect(validation.valid === false, "url must be rejected");
    expect(
      validation.violations.some((item) => item.code === "forbidden_key"),
      "forbidden key should be detected",
    );
  });

  run("nested_private_key_detected", () => {
    const validation = validateSharedIntelligencePrivacy({
      marketCell: {
        country: "ma",
      },
      nested: {
        workspace_id: "ws-private",
      },
    });
    expect(validation.valid === false, "nested private key must be rejected");
    expect(
      validation.violations.some((item) => item.code === "forbidden_key"),
      "nested forbidden key should be detected",
    );
  });

  run("coordinates_injected_detected", () => {
    const validation = validateSharedIntelligencePrivacy({
      marketCell: {
        country: "ma",
      },
      geo: {
        lat: 31.6295,
        lng: -7.9811,
      },
    });
    expect(validation.valid === false, "coordinates must be rejected");
    expect(
      validation.violations.some((item) => item.code === "forbidden_coordinate_object"),
      "coordinate object should be detected",
    );
  });

  run("accepted_fact_has_no_privacy_violation", () => {
    const fact = expectAccepted(
      transformCandidateToAnonymousPricingFact(buildBaseCandidate()),
      "accepted_fact_has_no_privacy_violation",
    );
    const validation = validateSharedIntelligencePrivacy(fact);
    expect(validation.valid, "accepted fact should pass privacy validation");
  });

  run("feature_flags_default_false", () => {
    const keys = [
      ENABLE_INTELLIGENCE_FACT_TRANSFORMATION,
      ENABLE_INTELLIGENCE_FACT_CONTRIBUTION,
      ENABLE_INTELLIGENCE_BENCHMARK_COMPUTATION,
      ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION,
      DEBUG_INTELLIGENCE_V2,
    ] as const;
    const snapshot = new Map<string, string | undefined>();
    for (const key of keys) {
      snapshot.set(key, process.env[key]);
      delete process.env[key];
    }

    try {
      const flags = getIntelligenceV2FeatureFlags();
      expect(
        Object.values(flags).every((value) => value === false),
        "all flags should default to false",
      );
    } finally {
      for (const [key, value] of snapshot.entries()) {
        if (value == null) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  run("idempotency_projection_is_stable", () => {
    const fact = expectAccepted(
      transformCandidateToAnonymousPricingFact(buildBaseCandidate()),
      "idempotency_projection_is_stable",
    );
    const left = projectAnonymousPricingFactIdempotencyInputs(fact);
    const right = projectAnonymousPricingFactIdempotencyInputs(fact);
    expect(deepEqual(left, right), "idempotency projection must be stable");
  });

  const failures = scenarioResults.filter((result) => result.status === "fail");
  if (failures.length > 0) {
    console.error(
      JSON.stringify({
        summary: "FAIL",
        failedScenarios: failures.map((item) => item.scenario),
      }),
    );
    process.exit(1);
  }

  console.log("PASS — Intelligence v2 Pricing Fact smoke");
}

void main();

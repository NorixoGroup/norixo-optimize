import { buildMarketCellV1 } from "../lib/intelligenceV2/marketCell";
import {
  getPricingBenchmarkEvidence,
  mapPricingBenchmarkArtifactDbRow,
  type PricingBenchmarkArtifactDbRow,
  type PricingBenchmarkDbRowLoadResult,
  type PricingBenchmarkEvidenceSelectorDependencies,
  type PricingBenchmarkSupersessionLoadResult,
} from "../lib/intelligenceV2/pricingBenchmarkEvidenceSelector";
import type { PricingBenchmarkEvidenceInput } from "../lib/intelligenceV2/pricingBenchmarkEvidence";
import {
  DEBUG_INTELLIGENCE_V2,
  ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION,
} from "../lib/intelligenceV2/featureFlags";
import {
  INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
  INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
  INTELLIGENCE_V2_COHORT_POLICY_VERSION,
  INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
  INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
} from "../lib/intelligenceV2/policyVersions";

type ScenarioResult = {
  scenario: string;
  status: "pass" | "fail";
  reason?: string;
};

type LoaderStats = {
  artifactCalls: number;
  supersessionCalls: number;
  governanceCalls: number;
};

function fail(message: string): never {
  throw new Error(message);
}

function expect(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  expect(actual === expected, `${message}: expected ${expected}, got ${actual}`);
}

function logScenario(result: ScenarioResult): void {
  console.log(JSON.stringify(result));
}

function buildBaseInput(
  overrides: Partial<PricingBenchmarkEvidenceInput> = {},
): PricingBenchmarkEvidenceInput {
  return {
    country: "Morocco",
    city: "Marrakech",
    platform: "booking",
    propertyType: "apartment",
    capacity: 4,
    guestCapacity: 4,
    currency: "EUR",
    capturePeriodBucket: "2026-06",
    intendedUse: "private_audit",
    ...overrides,
  };
}

function buildDbRowFromInput(
  input: PricingBenchmarkEvidenceInput,
  overrides: Partial<PricingBenchmarkArtifactDbRow> = {},
): PricingBenchmarkArtifactDbRow {
  const marketCell = buildMarketCellV1(input);

  return {
    id: "artifact-1",
    benchmark_type: "pricing_distribution",
    approval_status: "audit_approved",
    approved_for_internal: true,
    approved_for_audit: true,
    country: marketCell.country,
    city: marketCell.city,
    platform: marketCell.platform,
    property_type: marketCell.propertyType,
    capacity_band: marketCell.capacityBand,
    currency: marketCell.currency,
    market_cell_key: marketCell.marketCellKey,
    capture_period_bucket: input.capturePeriodBucket,
    p10_price: 100,
    p25_price: 120,
    median_price: 150,
    p75_price: 180,
    p90_price: 210,
    raw_sample_size: 24,
    included_sample_size: 24,
    excluded_outlier_count: 0,
    source_class_count: 2,
    source_diversity_band: "moderate",
    confidence_level: "high",
    valid_from: "2026-07-01T00:00:00.000Z",
    valid_until: "2026-07-31T23:59:59.999Z",
    limitations: [],
    artifact_contract_version: INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
    cohort_policy_version: INTELLIGENCE_V2_COHORT_POLICY_VERSION,
    aggregation_policy_version: INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
    outlier_policy_version: INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
    confidence_policy_version: INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
    freshness_policy_version: INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
    approval_policy_version: INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
    market_cell_policy_version: INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
    supersedes_artifact_id: null,
    created_at: "2026-07-02T10:00:00.000Z",
    ...overrides,
  };
}

function buildDependencies(options: {
  rows?: ReadonlyArray<PricingBenchmarkArtifactDbRow>;
  supersededArtifactIds?: ReadonlyArray<string>;
  failArtifacts?: boolean;
  failSupersession?: boolean;
  failGovernance?: boolean;
  stats: LoaderStats;
}): PricingBenchmarkEvidenceSelectorDependencies {
  return {
    loadArtifacts: async (): Promise<PricingBenchmarkDbRowLoadResult> => {
      options.stats.artifactCalls += 1;
      if (options.failArtifacts) {
        return { ok: false };
      }
      return { ok: true, rows: options.rows ?? [] };
    },
    loadSupersedingArtifactIds: async (): Promise<PricingBenchmarkSupersessionLoadResult> => {
      options.stats.supersessionCalls += 1;
      if (options.failSupersession) {
        return { ok: false };
      }
      return {
        ok: true,
        supersededArtifactIds: [...(options.supersededArtifactIds ?? [])],
      };
    },
    evaluateGovernance: (input) => {
      options.stats.governanceCalls += 1;
      if (options.failGovernance) {
        throw new Error("governance_failure");
      }
      return require("../lib/intelligenceV2/pricingBenchmarkGovernance")
        .evaluatePricingBenchmarkGovernance(input);
    },
    now: () => new Date("2026-07-12T12:00:00.000Z"),
  };
}

async function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function main() {
  const scenarioResults: ScenarioResult[] = [];
  const originalConsoleInfo = console.info;
  const logs: string[] = [];

  const run = async (scenario: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
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

  console.info = (...args: unknown[]) => {
    logs.push(args.map((value) => String(value)).join(" "));
  };

  try {
    await run("flag_off_no_loader_called", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        {
          [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "false",
          [DEBUG_INTELLIGENCE_V2]: "false",
        },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({ stats }),
          ),
      );

      expect(result.available === false, "flag off should disable selector");
      if (result.available) {
        fail("flag off should disable selector");
      }
      expectEqual(result.status, "disabled", "flag off should return disabled");
      expect(result.reasonCodes.includes("flag_disabled"), "missing flag_disabled");
      expectEqual(stats.artifactCalls, 0, "artifact loader must not be called");
      expectEqual(stats.supersessionCalls, 0, "supersession loader must not be called");
      expectEqual(stats.governanceCalls, 0, "governance must not be called");
    });

    await run("exact_usable_available", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true", [DEBUG_INTELLIGENCE_V2]: "false" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [buildDbRowFromInput(buildBaseInput())],
              stats,
            }),
          ),
      );
      expect(result.available === true, "exact artifact should be available");
      if (!result.available) fail("exact artifact should be available");
      expectEqual(result.evidence.fallbackLevel, "exact", "exact should win");
      expectEqual(stats.artifactCalls, 1, "artifact loader should be called once");
      expectEqual(stats.supersessionCalls, 1, "supersession loader should be called once");
      expectEqual(stats.governanceCalls, 1, "governance should be called once");
    });

    await run("capacity_fallback_usable_after_exact_quarantined", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const exactQuarantined = buildDbRowFromInput(buildBaseInput(), {
        id: "exact-quarantined",
        approval_status: "insufficient",
        approved_for_internal: false,
        approved_for_audit: false,
        raw_sample_size: 4,
        included_sample_size: 4,
      });
      const row = buildDbRowFromInput(
        buildBaseInput({ capacity: null, guestCapacity: null }),
        {
          id: "capacity-fallback",
        },
      );
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({ rows: [exactQuarantined, row], stats }),
          ),
      );
      expect(result.available === true, "capacity fallback should be available");
      if (!result.available) fail("capacity fallback should be available");
      expectEqual(
        result.evidence.fallbackLevel,
        "capacity_unknown",
        "capacity fallback level should match",
      );
      expectEqual(stats.governanceCalls, 2, "both candidates should be governed");
    });

    await run("exact_beats_fallback", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const exact = buildDbRowFromInput(buildBaseInput(), {
        id: "exact",
        created_at: "2026-07-01T10:00:00.000Z",
      });
      const fallback = buildDbRowFromInput(buildBaseInput({ propertyType: null }), {
        id: "fallback",
        created_at: "2026-07-20T10:00:00.000Z",
      });
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({ rows: [fallback, exact], stats }),
          ),
      );
      expect(result.available === true, "exact should still be available");
      if (!result.available) fail("exact should still be available");
      expectEqual(result.evidence.fallbackLevel, "exact", "exact should beat fallback");
    });

    await run("exact_usable_with_limits_beats_fallback_usable", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const exactLimited = buildDbRowFromInput(buildBaseInput(), {
        id: "exact-limited",
        p90_price: 700,
      });
      const fallbackUsable = buildDbRowFromInput(buildBaseInput({ propertyType: null }), {
        id: "fallback-usable",
        confidence_level: "very_high",
      });
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({ rows: [fallbackUsable, exactLimited], stats }),
          ),
      );
      expect(result.available === true, "exact limited should still be available");
      if (!result.available) fail("exact limited should still be available");
      expectEqual(result.evidence.fallbackLevel, "exact", "exact limited should beat fallback usable");
    });

    await run("no_rows_unavailable_and_no_supersession_query", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({ rows: [], stats }),
          ),
      );
      expect(result.available === false, "no rows should be unavailable");
      if (result.available) fail("no rows should be unavailable");
      expectEqual(result.status, "unavailable", "no rows should be unavailable");
      expect(result.reasonCodes.includes("no_artifact"), "missing no_artifact");
      expectEqual(stats.supersessionCalls, 0, "no rows should skip supersession loader");
    });

    await run("malformed_row_ignored", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [buildDbRowFromInput(buildBaseInput(), { p25_price: 90 })],
              stats,
            }),
          ),
      );
      expect(result.available === false, "malformed row should be ignored");
      if (result.available) fail("malformed row should be ignored");
      expect(result.reasonCodes.includes("artifact_malformed"), "missing artifact_malformed");
      expectEqual(stats.supersessionCalls, 0, "no valid row should skip supersession");
    });

    await run("policy_incompatible_row_rejected_by_governance", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [
                buildDbRowFromInput(buildBaseInput(), {
                  aggregation_policy_version: "v2",
                }),
              ],
              stats,
            }),
          ),
      );
      expect(result.available === false, "policy incompatible row should be ignored");
      if (result.available) fail("policy incompatible row should be ignored");
      expect(
        result.reasonCodes.includes("artifact_policy_incompatible"),
        "missing artifact_policy_incompatible",
      );
      expectEqual(stats.supersessionCalls, 1, "governable row should still load supersession");
    });

    await run("internal_only_not_returned", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [
                buildDbRowFromInput(buildBaseInput(), {
                  approval_status: "internal_approved",
                  approved_for_audit: false,
                }),
              ],
              stats,
            }),
          ),
      );
      expect(result.available === false, "non audit row should be unavailable");
      if (result.available) fail("non audit row should be unavailable");
      expect(
        result.reasonCodes.includes("artifact_not_audit_approved"),
        "missing artifact_not_audit_approved",
      );
    });

    await run("fallback_internal_not_returned", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const exactQuarantined = buildDbRowFromInput(buildBaseInput(), {
        id: "exact-expired",
        valid_until: "2026-07-10T23:59:59.999Z",
      });
      const internalFallback = buildDbRowFromInput(buildBaseInput({ propertyType: null }), {
        id: "fallback-internal",
        approval_status: "internal_approved",
        approved_for_audit: false,
      });
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [exactQuarantined, internalFallback],
              stats,
            }),
          ),
      );
      expect(result.available === false, "internal fallback should not produce evidence");
      if (result.available) fail("internal fallback should not produce evidence");
      expect(result.reasonCodes.includes("artifact_expired"), "missing artifact_expired");
      expect(
        result.reasonCodes.includes("artifact_not_audit_approved"),
        "missing artifact_not_audit_approved",
      );
    });

    await run("fallback_revoked_not_returned", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const revokedFallback = buildDbRowFromInput(buildBaseInput({ propertyType: null }), {
        id: "fallback-revoked",
        approval_status: "revoked",
        approved_for_internal: false,
        approved_for_audit: false,
      });
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [revokedFallback],
              stats,
            }),
          ),
      );
      expect(result.available === false, "revoked fallback should not produce evidence");
      if (result.available) fail("revoked fallback should not produce evidence");
      expect(
        result.reasonCodes.includes("artifact_not_audit_approved"),
        "missing artifact_not_audit_approved",
      );
    });

    await run("superseded_artifact_excluded_by_governance", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [buildDbRowFromInput(buildBaseInput(), { id: "superseded" })],
              supersededArtifactIds: ["superseded"],
              stats,
            }),
          ),
      );
      expect(result.available === false, "superseded artifact should be unavailable");
      if (result.available) fail("superseded artifact should be unavailable");
      expect(result.reasonCodes.includes("artifact_superseded"), "missing artifact_superseded");
    });

    await run("expired_artifact_unavailable", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [
                buildDbRowFromInput(buildBaseInput(), {
                  valid_until: "2026-07-10T23:59:59.999Z",
                }),
              ],
              stats,
            }),
          ),
      );
      expect(result.available === false, "expired artifact should be unavailable");
      if (result.available) fail("expired artifact should be unavailable");
      expect(result.reasonCodes.includes("artifact_expired"), "missing artifact_expired");
    });

    await run("not_yet_valid_artifact_unavailable", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [
                buildDbRowFromInput(buildBaseInput(), {
                  valid_from: "2026-07-20T00:00:00.000Z",
                }),
              ],
              stats,
            }),
          ),
      );
      expect(result.available === false, "future artifact should be unavailable");
      if (result.available) fail("future artifact should be unavailable");
      expect(
        result.reasonCodes.includes("artifact_not_yet_valid"),
        "missing artifact_not_yet_valid",
      );
    });

    await run("different_platform_unavailable", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [buildDbRowFromInput(buildBaseInput({ platform: "airbnb" }))],
              stats,
            }),
          ),
      );
      expect(result.available === false, "different platform should be unavailable");
      if (result.available) fail("different platform should be unavailable");
      expect(result.reasonCodes.includes("artifact_malformed"), "missing artifact_malformed");
    });

    await run("different_currency_unavailable", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [buildDbRowFromInput(buildBaseInput({ currency: "USD" }))],
              stats,
            }),
          ),
      );
      expect(result.available === false, "different currency should be unavailable");
      if (result.available) fail("different currency should be unavailable");
      expect(result.reasonCodes.includes("artifact_malformed"), "missing artifact_malformed");
    });

    await run("none_usable_returns_unavailable", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const exactInternal = buildDbRowFromInput(buildBaseInput(), {
        id: "exact-internal",
        approval_status: "internal_approved",
        approved_for_audit: false,
      });
      const fallbackRevoked = buildDbRowFromInput(buildBaseInput({ propertyType: null }), {
        id: "fallback-revoked-2",
        approval_status: "revoked",
        approved_for_internal: false,
        approved_for_audit: false,
      });
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [exactInternal, fallbackRevoked],
              stats,
            }),
          ),
      );
      expect(result.available === false, "no usable candidate should stay unavailable");
      if (result.available) fail("no usable candidate should stay unavailable");
      expect(
        result.reasonCodes.includes("artifact_not_audit_approved"),
        "missing artifact_not_audit_approved",
      );
    });

    await run("governance_failure_best_effort", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [buildDbRowFromInput(buildBaseInput())],
              failGovernance: true,
              stats,
            }),
          ),
      );
      expect(result.available === false, "governance failure should stay unavailable");
      if (result.available) fail("governance failure should stay unavailable");
      expect(result.reasonCodes.includes("artifact_malformed"), "missing artifact_malformed");
      expectEqual(stats.governanceCalls, 1, "governance should be attempted once");
    });

    await run("primary_loader_error_database_error", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({ failArtifacts: true, stats }),
          ),
      );
      expect(result.available === false, "primary loader error should fail");
      if (result.available) fail("primary loader error should fail");
      expectEqual(result.status, "database_error", "expected database_error");
      expect(result.reasonCodes.includes("database_read_error"), "missing database_read_error");
      expectEqual(stats.supersessionCalls, 0, "primary error should skip supersession");
    });

    await run("supersession_loader_error_database_error", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [buildDbRowFromInput(buildBaseInput())],
              failSupersession: true,
              stats,
            }),
          ),
      );
      expect(result.available === false, "supersession loader error should fail");
      if (result.available) fail("supersession loader error should fail");
      expectEqual(result.status, "database_error", "expected database_error");
      expect(result.reasonCodes.includes("database_read_error"), "missing database_read_error");
    });

    await run("result_exposes_no_artifact_id_key_or_raw_row", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [buildDbRowFromInput(buildBaseInput(), { id: "secret-artifact-id" })],
              stats,
            }),
          ),
      );
      const serialized = JSON.stringify(result);
      expect(!serialized.includes("artifact_key"), "result must not expose artifact_key");
      expect(!serialized.includes("raw"), "result must not expose raw rows");
      expect(!serialized.includes("secret-artifact-id"), "result must not expose artifact id");
    });

    await run("maximum_two_loaders_and_mapping_helper", async () => {
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      const mapped = mapPricingBenchmarkArtifactDbRow(buildDbRowFromInput(buildBaseInput()));
      expect(mapped.ok === true, "mapping helper should accept valid row");
      const result = await withEnv(
        { [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true" },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [buildDbRowFromInput(buildBaseInput())],
              stats,
            }),
          ),
      );
      expect(result.available === true, "selector should still succeed");
      expectEqual(stats.artifactCalls, 1, "artifact loader should run once");
      expectEqual(stats.supersessionCalls, 1, "supersession loader should run once");
    });

    await run("debug_log_sanitized", async () => {
      logs.length = 0;
      const stats: LoaderStats = { artifactCalls: 0, supersessionCalls: 0, governanceCalls: 0 };
      await withEnv(
        {
          [ENABLE_INTELLIGENCE_BENCHMARK_CONSUMPTION]: "true",
          [DEBUG_INTELLIGENCE_V2]: "true",
        },
        () =>
          getPricingBenchmarkEvidence(
            buildBaseInput(),
            buildDependencies({
              rows: [buildDbRowFromInput(buildBaseInput(), { id: "secret-artifact-id" })],
              stats,
            }),
          ),
      );
      expect(logs.length > 0, "debug should produce a log");
      const joined = logs.join("\n");
      expect(!joined.includes("secret-artifact-id"), "debug log must not expose artifact ids");
      expect(!joined.includes("p10"), "debug log must not expose percentiles");
      expect(!joined.includes("market_cell_key"), "debug log must not expose raw rows");
    });
  } finally {
    console.info = originalConsoleInfo;
  }

  const failed = scenarioResults.filter((result) => result.status === "fail");
  if (failed.length > 0) {
    fail(`${failed.length} pricing benchmark evidence selector scenarios failed`);
  }

  console.log("PASS — Intelligence v2 Pricing Benchmark Evidence Selector smoke");
}

void main();

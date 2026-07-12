import {
  derivePricingBenchmarkGovernanceFreshness,
  derivePricingBenchmarkQualityBand,
  derivePricingBenchmarkRepresentativeness,
  derivePricingBenchmarkRiskLevel,
  evaluatePricingBenchmarkGovernance,
  validatePricingBenchmarkGovernanceInput,
  type PricingBenchmarkGovernanceInput,
  type PricingBenchmarkGovernanceReasonCode,
} from "../lib/intelligenceV2/pricingBenchmarkGovernance";
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

function fail(message: string): never {
  throw new Error(message);
}

function expect(condition: boolean, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  expect(actual === expected, `${message}: expected ${expected}, got ${actual}`);
}

function expectIncludes<T>(values: ReadonlyArray<T>, expected: T, message: string): void {
  expect(values.includes(expected), message);
}

function logScenario(result: ScenarioResult): void {
  console.log(JSON.stringify(result));
}

function buildBaseInput(
  overrides: Partial<PricingBenchmarkGovernanceInput> = {},
): PricingBenchmarkGovernanceInput {
  return {
    benchmarkType: "pricing_distribution",
    approvalStatus: "audit_approved",
    approvedForInternal: true,
    approvedForAudit: true,
    propertyType: "apartment",
    capacityBand: "4_6",
    platform: "booking",
    currency: "EUR",
    p10: 100,
    p25: 120,
    median: 150,
    p75: 180,
    p90: 210,
    rawSampleSize: 50,
    includedSampleSize: 50,
    excludedOutlierCount: 0,
    sourceClassCount: 2,
    sourceDiversityBand: "moderate",
    confidenceLevel: "very_high",
    validFrom: "2026-07-01T00:00:00.000Z",
    validUntil: "2026-07-31T23:59:59.999Z",
    limitations: [],
    artifactContractVersion: INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
    cohortPolicyVersion: INTELLIGENCE_V2_COHORT_POLICY_VERSION,
    aggregationPolicyVersion: INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
    outlierPolicyVersion: INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
    confidencePolicyVersion: INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
    freshnessPolicyVersion: INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
    approvalPolicyVersion: INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
    marketCellPolicyVersion: INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
    superseded: false,
    now: "2026-07-12T12:00:00.000Z",
    ...overrides,
  };
}

function assertNoPrivateData(result: ReturnType<typeof evaluatePricingBenchmarkGovernance>): void {
  expect(!("artifactId" in result), "result must not expose artifactId");
  expect(!("artifactKey" in result), "result must not expose artifactKey");
  expect(!("url" in result), "result must not expose url");
  expect(!("factKey" in result), "result must not expose factKey");
}

function expectSortedDedupedReasonCodes(
  reasonCodes: ReadonlyArray<PricingBenchmarkGovernanceReasonCode>,
): void {
  const sorted = [...reasonCodes].sort();
  expectEqual(JSON.stringify(reasonCodes), JSON.stringify(sorted), "reason codes must be sorted");
  expectEqual(
    new Set(reasonCodes).size,
    reasonCodes.length,
    "reason codes must be deduped",
  );
}

function expectSortedDedupedStrings(values: ReadonlyArray<string>, message: string): void {
  const sorted = [...values].sort();
  expectEqual(JSON.stringify(values), JSON.stringify(sorted), `${message} must be sorted`);
  expectEqual(new Set(values).size, values.length, `${message} must be deduped`);
}

async function main() {
  const scenarioResults: ScenarioResult[] = [];

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

  await run("artifact_sain_40_plus_usable", () => {
    const result = evaluatePricingBenchmarkGovernance(buildBaseInput());
    expect(result.accepted === true, "usable artifact should be accepted");
    expectEqual(result.decision, "usable", "40+ healthy artifact should be usable");
    expectEqual(result.freshnessBand, "fresh", "freshness should be fresh");
    expectEqual(result.stabilityBand, "unknown", "stability should stay unknown");
    expectEqual(result.qualityBand, "very_high", "usable should map to very_high");
    expectEqual(result.riskLevel, "low", "usable should be low risk");
    expectEqual(
      JSON.stringify(result.approvedUses),
      JSON.stringify(["internal_analysis", "private_audit"]),
      "usable should approve both uses",
    );
    assertNoPrivateData(result);
  });

  await run("artifact_sain_20_39_usable_with_limits", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        rawSampleSize: 30,
        includedSampleSize: 30,
        confidenceLevel: "high",
      }),
    );
    expect(result.accepted === true, "20-39 artifact should be accepted");
    expectEqual(result.decision, "usable_with_limits", "20-39 should be limited");
  });

  await run("internal_approved_internal_only", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        approvalStatus: "internal_approved",
        approvedForAudit: false,
      }),
    );
    expect(result.accepted === true, "internal_approved should stay accepted");
    expectEqual(result.decision, "internal_only", "internal_approved should be internal_only");
    expectIncludes(result.reasonCodes, "artifact_not_audit_approved", "missing not approved reason");
    expectEqual(JSON.stringify(result.approvedUses), JSON.stringify(["internal_analysis"]), "internal_only uses mismatch");
  });

  await run("exploratory_internal_only", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        approvalStatus: "exploratory",
        approvedForAudit: false,
        rawSampleSize: 8,
        includedSampleSize: 8,
        confidenceLevel: "low",
      }),
    );
    expect(result.accepted === true, "exploratory should stay accepted");
    expectEqual(result.decision, "internal_only", "exploratory should be internal_only");
  });

  await run("insufficient_quarantined", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        approvalStatus: "insufficient",
        approvedForInternal: false,
        approvedForAudit: false,
        rawSampleSize: 4,
        includedSampleSize: 4,
        confidenceLevel: "very_low",
      }),
    );
    expect(result.accepted === false, "insufficient should be rejected");
    expectEqual(result.decision, "quarantined", "insufficient should be quarantined");
    expectIncludes(result.reasonCodes, "sample_too_small", "missing sample_too_small");
  });

  await run("revoked_revoked", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        approvalStatus: "revoked",
        approvedForAudit: false,
      }),
    );
    expect(result.accepted === false, "revoked should be rejected");
    expectEqual(result.decision, "revoked", "revoked should stay revoked");
    expectIncludes(result.reasonCodes, "artifact_revoked", "missing revoked reason");
    expectEqual(result.riskLevel, "critical", "revoked should be critical");
  });

  await run("expired_quarantined", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        validUntil: "2026-07-10T23:59:59.999Z",
      }),
    );
    expect(result.accepted === false, "expired should be rejected");
    expectEqual(result.decision, "quarantined", "expired should be quarantined");
    expectIncludes(result.reasonCodes, "artifact_expired", "missing expired reason");
  });

  await run("not_yet_valid_quarantined", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        validFrom: "2026-07-20T00:00:00.000Z",
        validUntil: "2026-08-20T00:00:00.000Z",
      }),
    );
    expect(result.accepted === false, "not-yet-valid should be rejected");
    expectEqual(result.decision, "quarantined", "not-yet-valid should be quarantined");
    expectIncludes(result.reasonCodes, "artifact_not_yet_valid", "missing not-yet-valid reason");
  });

  await run("sample_lt_5_quarantined", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        rawSampleSize: 3,
        includedSampleSize: 3,
      }),
    );
    expect(result.accepted === false, "sample <5 should be rejected");
    expectEqual(result.decision, "quarantined", "sample <5 should be quarantined");
    expectIncludes(result.reasonCodes, "sample_too_small", "missing sample_too_small");
  });

  await run("low_diversity_downgrade", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        sourceClassCount: 1,
        sourceDiversityBand: "low",
        confidenceLevel: "high",
      }),
    );
    expect(result.accepted === true, "low diversity should stay accepted with limits");
    expectEqual(result.decision, "usable_with_limits", "low diversity should downgrade");
    expectIncludes(result.reasonCodes, "low_source_diversity", "missing low diversity reason");
  });

  await run("unknown_property_downgrade", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        propertyType: "unknown",
        confidenceLevel: "high",
      }),
    );
    expect(result.accepted === true, "unknown property should stay accepted");
    expectEqual(result.decision, "usable_with_limits", "unknown property should downgrade");
    expectIncludes(result.reasonCodes, "unknown_property_type", "missing property reason");
  });

  await run("unknown_capacity_downgrade", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        capacityBand: "unknown",
        confidenceLevel: "high",
      }),
    );
    expect(result.accepted === true, "unknown capacity should stay accepted");
    expectEqual(result.decision, "usable_with_limits", "unknown capacity should downgrade");
    expectIncludes(result.reasonCodes, "unknown_capacity", "missing capacity reason");
  });

  await run("property_and_capacity_unknown_internal_only", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        propertyType: "unknown",
        capacityBand: "unknown",
        confidenceLevel: "high",
      }),
    );
    expect(result.accepted === true, "double unknown should stay accepted");
    expectEqual(result.decision, "internal_only", "double unknown should be internal_only");
  });

  await run("malformed_distribution_quarantined", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        p25: 90,
      }),
    );
    expect(result.accepted === false, "malformed distribution should be rejected");
    expectEqual(result.decision, "quarantined", "malformed distribution should be quarantined");
    expectIncludes(result.reasonCodes, "distribution_malformed", "missing malformed reason");
  });

  await run("extreme_spread_seul_usable_with_limits", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        p90: 700,
      }),
    );
    expect(result.accepted === true, "extreme spread alone should stay accepted");
    expectEqual(result.decision, "usable_with_limits", "extreme spread alone should be limited");
    expectIncludes(result.reasonCodes, "distribution_extreme_spread", "missing spread reason");
  });

  await run("extreme_spread_plus_small_sample_internal_only", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        rawSampleSize: 12,
        includedSampleSize: 12,
        p90: 700,
        confidenceLevel: "high",
      }),
    );
    expect(result.accepted === true, "small sample 10-19 should stay accepted");
    expectEqual(result.decision, "internal_only", "small sample plus spread should be internal_only");
  });

  await run("aging_usable_with_limits", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        validUntil: "2026-07-18T00:00:00.000Z",
      }),
    );
    expect(result.accepted === true, "aging artifact should stay accepted");
    expectEqual(result.decision, "usable_with_limits", "aging should be limited");
    expectEqual(result.freshnessBand, "aging", "freshness should be aging");
    expectIncludes(result.reasonCodes, "aging_data", "missing aging reason");
  });

  await run("stability_unknown_non_blocking", () => {
    const result = evaluatePricingBenchmarkGovernance(buildBaseInput());
    expectEqual(result.stabilityBand, "unknown", "stability should be unknown");
    expectEqual(result.decision, "usable", "unknown stability should not block");
  });

  await run("policy_incompatible_quarantined", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        artifactContractVersion: "v999",
      }),
    );
    expect(result.accepted === false, "policy incompatible should be rejected");
    expectEqual(result.decision, "quarantined", "policy incompatible should be quarantined");
    expectIncludes(result.reasonCodes, "artifact_policy_incompatible", "missing policy reason");
  });

  await run("superseded_quarantined", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        superseded: true,
      }),
    );
    expect(result.accepted === false, "superseded should be rejected");
    expectEqual(result.decision, "quarantined", "superseded should be quarantined");
    expectIncludes(result.reasonCodes, "artifact_superseded", "missing superseded reason");
  });

  await run("reason_codes_sorted_and_deduped", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        propertyType: "unknown",
        sourceClassCount: 1,
        sourceDiversityBand: "low",
        limitations: [
          "unknown_property_type",
          "low_source_diversity",
          "unknown_property_type",
        ],
        confidenceLevel: "high",
      }),
    );
    expectSortedDedupedReasonCodes(result.reasonCodes);
  });

  await run("limitation_codes_sorted_and_deduped", () => {
    const result = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        validUntil: "2026-07-18T00:00:00.000Z",
        limitations: ["aging_data", "unknown_capacity", "aging_data"],
        capacityBand: "unknown",
        confidenceLevel: "high",
      }),
    );
    expectSortedDedupedStrings(result.limitationCodes, "limitation codes");
    expectIncludes(result.limitationCodes, "aging_data", "missing aging limitation");
    expectIncludes(result.limitationCodes, "unknown_capacity", "missing capacity limitation");
  });

  await run("approved_uses_coherents", () => {
    const usable = evaluatePricingBenchmarkGovernance(buildBaseInput());
    const internalOnly = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        approvalStatus: "internal_approved",
        approvedForAudit: false,
      }),
    );
    const quarantined = evaluatePricingBenchmarkGovernance(
      buildBaseInput({
        rawSampleSize: 3,
        includedSampleSize: 3,
      }),
    );

    expectEqual(
      JSON.stringify(usable.approvedUses),
      JSON.stringify(["internal_analysis", "private_audit"]),
      "usable uses mismatch",
    );
    expectEqual(
      JSON.stringify(internalOnly.approvedUses),
      JSON.stringify(["internal_analysis"]),
      "internal_only uses mismatch",
    );
    expectEqual(
      JSON.stringify(quarantined.approvedUses),
      JSON.stringify([]),
      "quarantined uses mismatch",
    );
  });

  await run("helpers_and_validation", () => {
    expectEqual(
      derivePricingBenchmarkGovernanceFreshness(
        "2026-07-01T00:00:00.000Z",
        "2026-07-31T23:59:59.999Z",
        "2026-07-12T12:00:00.000Z",
      ),
      "fresh",
      "freshness helper should detect fresh",
    );
    expectEqual(
      derivePricingBenchmarkRepresentativeness("apartment", "4_6"),
      "high",
      "representativeness helper should detect high",
    );
    expectEqual(
      derivePricingBenchmarkQualityBand({
        decision: "internal_only",
        includedSampleSize: 8,
      }),
      "low",
      "quality helper should detect low internal_only",
    );
    expectEqual(
      derivePricingBenchmarkRiskLevel("usable_with_limits"),
      "moderate",
      "risk helper should detect moderate",
    );

    const invalid = validatePricingBenchmarkGovernanceInput(
      buildBaseInput({
        rawSampleSize: 10,
        includedSampleSize: 12,
      }),
    );
    expect(invalid.valid === false, "validation should fail for invalid sample sizes");
    if (invalid.valid) {
      fail("validation should fail for invalid sample sizes");
    }
    expectIncludes(invalid.reasonCodes, "quality_gate_failed", "missing quality gate failure");
  });

  const failed = scenarioResults.filter((result) => result.status === "fail");
  if (failed.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("PASS — Intelligence v2 Pricing Benchmark Governance smoke");
}

void main();

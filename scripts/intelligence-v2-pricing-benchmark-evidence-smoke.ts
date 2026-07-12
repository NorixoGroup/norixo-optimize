import { buildMarketCellV1 } from "../lib/intelligenceV2/marketCell";
import {
  buildPricingEvidenceMarketCellCandidates,
  derivePricingEvidenceFreshnessStatus,
  derivePricingEvidencePermittedWording,
  derivePricingEvidenceSampleSizeBand,
  derivePricingEvidenceStrength,
  projectPricingBenchmarkEvidence,
  selectBestPricingBenchmarkArtifact,
  validatePricingBenchmarkArtifactCandidate,
  type PricingBenchmarkArtifactCandidate,
  type PricingBenchmarkEvidenceInput,
} from "../lib/intelligenceV2/pricingBenchmarkEvidence";
import {
  INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
  INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
  INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
  INTELLIGENCE_V2_COHORT_POLICY_VERSION,
  INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
  INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
  INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
  INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
  INTELLIGENCE_V2_PRICING_BENCHMARK_EVIDENCE_CONTRACT_VERSION,
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

function buildArtifactFromInput(
  id: string,
  input: PricingBenchmarkEvidenceInput,
  overrides: Partial<PricingBenchmarkArtifactCandidate> = {},
): PricingBenchmarkArtifactCandidate {
  const marketCell = buildMarketCellV1(input);

  return {
    id,
    benchmarkType: "pricing_distribution",
    approvalStatus: "audit_approved",
    approvedForAudit: true,
    country: marketCell.country,
    city: marketCell.city,
    platform: marketCell.platform,
    propertyType: marketCell.propertyType,
    capacityBand: marketCell.capacityBand,
    currency: marketCell.currency,
    marketCellKey: marketCell.marketCellKey,
    capturePeriodBucket: input.capturePeriodBucket,
    p10Price: 100,
    p25Price: 120,
    medianPrice: 150,
    p75Price: 180,
    p90Price: 210,
    includedSampleSize: 24,
    confidenceLevel: "high",
    validFrom: "2026-07-01T00:00:00.000Z",
    validUntil: "2026-07-31T23:59:59.999Z",
    limitations: [],
    artifactContractVersion: INTELLIGENCE_V2_BENCHMARK_ARTIFACT_CONTRACT_VERSION,
    marketCellPolicyVersion: INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
    cohortPolicyVersion: INTELLIGENCE_V2_COHORT_POLICY_VERSION,
    aggregationPolicyVersion: INTELLIGENCE_V2_AGGREGATION_POLICY_VERSION,
    outlierPolicyVersion: INTELLIGENCE_V2_OUTLIER_POLICY_VERSION,
    confidencePolicyVersion: INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
    freshnessPolicyVersion: INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
    approvalPolicyVersion: INTELLIGENCE_V2_APPROVAL_POLICY_VERSION,
    supersedesArtifactId: null,
    createdAt: "2026-07-02T10:00:00.000Z",
    ...overrides,
  };
}

function expectAvailable(
  input: PricingBenchmarkEvidenceInput,
  artifacts: ReadonlyArray<PricingBenchmarkArtifactCandidate>,
  now = new Date("2026-07-12T12:00:00.000Z"),
) {
  const result = projectPricingBenchmarkEvidence({ input, artifacts, now });
  expect(result.available === true, "expected evidence to be available");
  if (!result.available) {
    fail(`expected available evidence, got ${result.status}`);
  }
  return result.evidence;
}

function expectUnavailable(
  input: PricingBenchmarkEvidenceInput,
  artifacts: ReadonlyArray<PricingBenchmarkArtifactCandidate>,
  expectedStatus: "unavailable" | "not_approved" | "policy_incompatible",
  expectedReason: string,
  now = new Date("2026-07-12T12:00:00.000Z"),
) {
  const result = projectPricingBenchmarkEvidence({ input, artifacts, now });
  expect(result.available === false, "expected evidence to be unavailable");
  if (result.available) {
    fail("expected evidence to be unavailable");
  }
  expectEqual(result.status, expectedStatus, "unexpected projection status");
  expect(
    result.reasonCodes.includes(expectedReason as never),
    `missing reason code ${expectedReason}`,
  );
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

  const baseInput = buildBaseInput();
  const now = new Date("2026-07-12T12:00:00.000Z");

  await run("exact_selected", () => {
    const evidence = expectAvailable(baseInput, [buildArtifactFromInput("exact", baseInput)], now);
    expectEqual(evidence.fallbackLevel, "exact", "exact artifact should win");
    expectEqual(
      evidence.evidenceContractVersion,
      INTELLIGENCE_V2_PRICING_BENCHMARK_EVIDENCE_CONTRACT_VERSION,
      "evidence contract version should match",
    );
  });

  await run("capacity_fallback", () => {
    const fallbackInput = buildBaseInput({ capacity: null, guestCapacity: null });
    const candidates = buildPricingEvidenceMarketCellCandidates(fallbackInput);
    expectEqual(candidates[0]?.fallbackLevel, "exact", "first candidate should stay exact");
    const exactInput = buildBaseInput();
    const capacityUnknownInput = buildBaseInput({ capacity: null, guestCapacity: null });
    const evidence = expectAvailable(
      exactInput,
      [buildArtifactFromInput("capacity", capacityUnknownInput)],
      now,
    );
    expectEqual(
      evidence.fallbackLevel,
      "capacity_unknown",
      "capacity fallback should be selected",
    );
  });

  await run("property_fallback", () => {
    const evidence = expectAvailable(
      baseInput,
      [buildArtifactFromInput("property", buildBaseInput({ propertyType: null }))],
      now,
    );
    expectEqual(
      evidence.fallbackLevel,
      "property_unknown",
      "property fallback should be selected",
    );
  });

  await run("property_capacity_fallback", () => {
    const evidence = expectAvailable(
      baseInput,
      [
        buildArtifactFromInput(
          "property_capacity",
          buildBaseInput({ propertyType: null, capacity: null, guestCapacity: null }),
        ),
      ],
      now,
    );
    expectEqual(
      evidence.fallbackLevel,
      "property_capacity_unknown",
      "property and capacity fallback should be selected",
    );
  });

  await run("exact_beats_newer_fallback", () => {
    const exactArtifact = buildArtifactFromInput("exact-old", baseInput, {
      createdAt: "2026-07-01T10:00:00.000Z",
    });
    const fallbackArtifact = buildArtifactFromInput(
      "fallback-new",
      buildBaseInput({ propertyType: null }),
      {
        createdAt: "2026-07-20T10:00:00.000Z",
      },
    );
    const evidence = expectAvailable(baseInput, [fallbackArtifact, exactArtifact], now);
    expectEqual(evidence.fallbackLevel, "exact", "exact should beat newer fallback");
  });

  await run("different_platform_rejected", () => {
    expectUnavailable(
      baseInput,
      [buildArtifactFromInput("platform", buildBaseInput({ platform: "airbnb" }))],
      "unavailable",
      "platform_mismatch",
      now,
    );
  });

  await run("different_currency_rejected", () => {
    expectUnavailable(
      baseInput,
      [buildArtifactFromInput("currency", buildBaseInput({ currency: "USD" }))],
      "unavailable",
      "currency_mismatch",
      now,
    );
  });

  await run("different_period_rejected", () => {
    expectUnavailable(
      baseInput,
      [buildArtifactFromInput("period", buildBaseInput({ capturePeriodBucket: "2026-05" }))],
      "unavailable",
      "capture_period_mismatch",
      now,
    );
  });

  await run("revoked_rejected", () => {
    expectUnavailable(
      baseInput,
      [buildArtifactFromInput("revoked", baseInput, { approvalStatus: "revoked" })],
      "not_approved",
      "revoked_artifact",
      now,
    );
  });

  await run("internal_approved_rejected", () => {
    expectUnavailable(
      baseInput,
      [buildArtifactFromInput("internal", baseInput, { approvalStatus: "internal_approved" })],
      "not_approved",
      "approval_status_not_audit_approved",
      now,
    );
  });

  await run("moderate_confidence_rejected", () => {
    expectUnavailable(
      baseInput,
      [buildArtifactFromInput("moderate", baseInput, { confidenceLevel: "moderate" })],
      "not_approved",
      "confidence_level_not_allowed",
      now,
    );
  });

  await run("superseded_rejected", () => {
    const selection = selectBestPricingBenchmarkArtifact({
      input: baseInput,
      artifacts: [buildArtifactFromInput("superseded", baseInput)],
      now,
      supersededArtifactIds: ["superseded"],
    });
    expect(selection.selected === false, "superseded artifact should not be selected");
    if (selection.selected) {
      fail("superseded artifact should not be selected");
    }
    expectEqual(selection.status, "unavailable", "superseded should be unavailable");
    expect(
      selection.reasonCodes.includes("superseded_artifact"),
      "missing superseded reason",
    );
  });

  await run("not_yet_valid_rejected", () => {
    expectUnavailable(
      baseInput,
      [
        buildArtifactFromInput("future", baseInput, {
          validFrom: "2026-07-20T00:00:00.000Z",
        }),
      ],
      "unavailable",
      "artifact_not_yet_valid",
      now,
    );
  });

  await run("expired_rejected", () => {
    expectUnavailable(
      baseInput,
      [
        buildArtifactFromInput("expired", baseInput, {
          validUntil: "2026-07-10T23:59:59.999Z",
        }),
      ],
      "unavailable",
      "artifact_expired",
      now,
    );
  });

  await run("policy_mismatch_rejected", () => {
    expectUnavailable(
      baseInput,
      [
        buildArtifactFromInput("policy", baseInput, {
          aggregationPolicyVersion: "v2",
        }),
      ],
      "policy_incompatible",
      "policy_version_mismatch",
      now,
    );
  });

  await run("unordered_percentiles_rejected", () => {
    expectUnavailable(
      baseInput,
      [
        buildArtifactFromInput("distribution", baseInput, {
          p10Price: 100,
          p25Price: 90,
        }),
      ],
      "unavailable",
      "invalid_distribution",
      now,
    );
  });

  await run("sample_band_20_39", () => {
    expectEqual(
      derivePricingEvidenceSampleSizeBand(20),
      "20_39",
      "sample size 20 should map to 20_39",
    );
  });

  await run("strong_evidence", () => {
    const evidence = expectAvailable(
      baseInput,
      [
        buildArtifactFromInput("strong", baseInput, {
          includedSampleSize: 42,
          confidenceLevel: "very_high",
        }),
      ],
      now,
    );
    expectEqual(evidence.evidenceStrength, "strong", "exact very high fresh should be strong");
    expectEqual(
      evidence.permittedWording,
      "strong_market_evidence",
      "strong evidence should map to strong wording",
    );
  });

  await run("aging_degrades_strength", () => {
    const evidence = expectAvailable(
      baseInput,
      [
        buildArtifactFromInput("aging", baseInput, {
          includedSampleSize: 42,
          confidenceLevel: "very_high",
          validUntil: "2026-07-15T23:59:59.999Z",
        }),
      ],
      now,
    );
    expectEqual(evidence.freshnessStatus, "aging", "artifact should be aging");
    expectEqual(evidence.evidenceStrength, "limited", "aging should degrade strength");
  });

  await run("limitations_sorted_and_deduped", () => {
    const evidence = expectAvailable(
      baseInput,
      [
        buildArtifactFromInput("limitations", baseInput, {
          limitations: ["small_sample", "aging_data", "small_sample"],
        }),
      ],
      now,
    );
    expectEqual(
      evidence.limitations.join(","),
      "aging_data,small_sample",
      "limitations should be sorted and deduped",
    );
  });

  await run("fallback_adds_broad_fallback", () => {
    const evidence = expectAvailable(
      baseInput,
      [buildArtifactFromInput("fallback", buildBaseInput({ propertyType: null }))],
      now,
    );
    expect(
      evidence.limitations.includes("broad_fallback"),
      "fallback should add broad_fallback limitation",
    );
  });

  await run("no_artifact_unavailable", () => {
    expectUnavailable(baseInput, [], "unavailable", "no_artifact", now);
  });

  await run("freshness_helper", () => {
    expectEqual(
      derivePricingEvidenceFreshnessStatus(
        "2026-07-01T00:00:00.000Z",
        "2026-07-31T23:59:59.999Z",
        now,
      ),
      "fresh",
      "freshness helper should return fresh",
    );
  });

  await run("strength_and_wording_helpers", () => {
    const strength = derivePricingEvidenceStrength({
      confidenceLevel: "high",
      freshnessStatus: "fresh",
      fallbackLevel: "property_unknown",
      limitations: ["broad_fallback"],
    });
    expectEqual(strength, "moderate", "single fallback should remain moderate");
    expectEqual(
      derivePricingEvidencePermittedWording(strength),
      "moderate_market_evidence",
      "moderate strength should map to moderate wording",
    );
  });

  await run("candidate_validation", () => {
    const candidate = buildPricingEvidenceMarketCellCandidates(baseInput)[0];
    if (candidate == null) {
      fail("missing exact candidate");
    }
    const validation = validatePricingBenchmarkArtifactCandidate({
      artifact: buildArtifactFromInput("validate", baseInput),
      requestedMarketCell: buildMarketCellV1(baseInput),
      candidateMarketCell: candidate.marketCell,
      capturePeriodBucket: baseInput.capturePeriodBucket,
      fallbackLevel: candidate.fallbackLevel,
      now,
    });
    expect(validation.valid === true, "exact candidate should validate");
  });

  const failed = scenarioResults.filter((result) => result.status === "fail");
  if (failed.length > 0) {
    fail(`${failed.length} pricing benchmark evidence scenarios failed`);
  }

  console.log("PASS — Intelligence v2 Pricing Benchmark Evidence smoke");
}

void main();

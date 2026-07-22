import assert from "node:assert/strict";

import type { IntelligencePublishingBatchCandidate } from "../lib/intelligencePublishing/batchPlanning";
import {
  evaluateIntelligencePublishingExecutionGate,
  validateIntelligencePublishingExecutionGateDecision,
} from "../lib/intelligencePublishing/executionGate";
import type { MarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import { parseMarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
} from "../lib/intelligencePublishing/registryPopulation";
import {
  orchestrateIntelligencePublishing,
  validateIntelligencePublishingOrchestrationResult,
} from "../lib/intelligencePublishing/orchestrator";

const GENERATED_AT = "2026-07-22T10:00:00.000Z";

function buildCandidate(overrides: Partial<IntelligencePublishingBatchCandidate> & {
  candidateId: string;
  reportKey: string;
  locale: string;
  country: string;
  city: string;
  platform: string;
  propertyType: string;
}): IntelligencePublishingBatchCandidate {
  return {
    requestedAction: "publish",
    priority: 100,
    sourceFingerprint: "source_fp_default",
    ...overrides,
  };
}

function buildDefinition(
  overrides: Partial<MarketReportDefinition> & {
    reportId: string;
    marketCellKey: string;
    city: string;
    country: string;
    platform: string;
    propertyType: string;
    language: string;
    slug: string;
    benchmarkFingerprint: string;
    overviewFingerprint: string;
  },
): MarketReportDefinition {
  return parseMarketReportDefinition({
    reportVersion: 1,
    title: `${overrides.platform} Market Report ${overrides.city}`,
    policyVersions: {
      pricing_policy: "pricing_v1",
      overview_policy: "overview_v1",
    },
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    metadata: {
      source: "execution_gate_smoke",
    },
    ...overrides,
  });
}

function buildRegistrySnapshot(definitions: readonly MarketReportDefinition[]) {
  const inputs = definitions.map((definition) => ({
    source: "market_report_definition" as const,
    datasetType: "market_report_definition" as const,
    definition,
    metadata: {
      smoke: true,
    },
  }));
  const locales = [...new Set(definitions.map((definition) => definition.language))];
  const plan = buildRegistryPopulationPlan(inputs, {
    generatedAt: GENERATED_AT,
    evaluatedAt: GENERATED_AT,
    targetLocales: locales,
    composeMarketReports: false,
    metadata: {
      smoke: true,
    },
  });
  return applyRegistryPopulationPlan(plan).nextSnapshot;
}

function assertNoPrivateKeys(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes("userId"), false);
  assert.equal(serialized.includes("workspaceId"), false);
  assert.equal(serialized.includes("listingUrl"), false);
  assert.equal(serialized.includes("rawPayload"), false);
}

async function main() {
  const candidates = [
    buildCandidate({
      candidateId: "cand_1",
      reportKey: "airbnb-market-report-paris-apartment",
      locale: "en",
      country: "fr",
      city: "paris",
      platform: "airbnb",
      propertyType: "apartment",
    }),
    buildCandidate({
      candidateId: "cand_2",
      reportKey: "airbnb-market-report-barcelona-apartment",
      locale: "fr",
      country: "es",
      city: "barcelona",
      platform: "airbnb",
      propertyType: "apartment",
    }),
  ] as const;

  const dryRun = evaluateIntelligencePublishingExecutionGate({
    mode: "dry_run",
    evaluatedAt: GENERATED_AT,
    candidates,
  });
  assert.equal(dryRun.decision, "allowed");
  assert.deepEqual(dryRun.reasonCodes, ["dry_run_allowed"]);
  assert.equal(validateIntelligencePublishingExecutionGateDecision(dryRun).ok, true);

  const executeAllowed = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: GENERATED_AT,
    candidates,
  });
  assert.equal(executeAllowed.decision, "allowed");
  assert.deepEqual(executeAllowed.reasonCodes, ["execute_allowed"]);

  const executionDisabled = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: GENERATED_AT,
    candidates,
    config: {
      executionEnabled: false,
    },
  });
  assert.equal(executionDisabled.decision, "blocked");
  assert.deepEqual(executionDisabled.reasonCodes, ["execution_disabled"]);

  const killSwitch = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: GENERATED_AT,
    candidates,
    config: {
      killSwitchEnabled: true,
    },
  });
  assert.equal(killSwitch.decision, "blocked");
  assert.deepEqual(killSwitch.reasonCodes, ["kill_switch_enabled"]);

  const approvalRequired = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: GENERATED_AT,
    candidates,
    config: {
      approvalRequired: true,
    },
  });
  assert.equal(approvalRequired.decision, "approval_required");
  assert.deepEqual(approvalRequired.reasonCodes, ["approval_required"]);

  const tooLarge = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: GENERATED_AT,
    candidates,
    config: {
      maxExecuteBatchSize: 1,
    },
  });
  assert.equal(tooLarge.decision, "blocked");
  assert.deepEqual(tooLarge.reasonCodes, ["batch_size_exceeded"]);

  const allowlistOk = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: GENERATED_AT,
    candidates,
    config: {
      allowlistReportKeys: [
        "airbnb-market-report-paris-apartment",
        "airbnb-market-report-barcelona-apartment",
      ],
    },
  });
  assert.equal(allowlistOk.decision, "allowed");
  assert.deepEqual(allowlistOk.reasonCodes, [
    "execute_allowed",
    "allowlist_passed",
  ]);

  const allowlistBlocked = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: GENERATED_AT,
    candidates,
    config: {
      allowlistReportKeys: ["airbnb-market-report-paris-apartment"],
    },
  });
  assert.equal(allowlistBlocked.decision, "blocked");
  assert.deepEqual(allowlistBlocked.reasonCodes, ["allowlist_blocked"]);

  const stableLeft = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: GENERATED_AT,
    candidates,
    config: {
      allowlistReportKeys: [
        "airbnb-market-report-paris-apartment",
        "airbnb-market-report-barcelona-apartment",
      ],
    },
  });
  const stableRight = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: "2026-07-22T11:00:00.000Z",
    candidates,
    config: {
      allowlistReportKeys: [
        "airbnb-market-report-paris-apartment",
        "airbnb-market-report-barcelona-apartment",
      ],
    },
  });
  assert.equal(stableLeft.fingerprint, stableRight.fingerprint);
  assertNoPrivateKeys(stableLeft);

  const snapshot = buildRegistrySnapshot([
    buildDefinition({
      reportId: "report_paris_airbnb_apartment_en",
      marketCellKey: "fr:paris:airbnb:apartment",
      city: "Paris",
      country: "fr",
      platform: "airbnb",
      propertyType: "apartment",
      language: "en",
      slug: "airbnb-market-report-paris-apartment",
      benchmarkFingerprint: "pricing_fp_paris_airbnb_apartment",
      overviewFingerprint: "overview_fp_paris_airbnb_apartment",
    }),
    buildDefinition({
      reportId: "report_barcelona_airbnb_apartment_fr",
      marketCellKey: "es:barcelona:airbnb:apartment",
      city: "Barcelona",
      country: "es",
      platform: "airbnb",
      propertyType: "apartment",
      language: "fr",
      slug: "airbnb-market-report-barcelona-apartment",
      benchmarkFingerprint: "pricing_fp_barcelona_airbnb_apartment",
      overviewFingerprint: "overview_fp_barcelona_airbnb_apartment",
    }),
  ]);

  const blockedOrchestration = await orchestrateIntelligencePublishing({
    registrySnapshot: snapshot,
    mode: "execute",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
    gateConfig: {
      approvalRequired: true,
    },
  });
  assert.equal(blockedOrchestration.gateDecision.decision, "approval_required");
  assert.equal(blockedOrchestration.batchPlan, null);
  assert.equal(blockedOrchestration.batchResult, null);
  assert.equal(blockedOrchestration.summary.gateDecision, "approval_required");
  assert.equal(validateIntelligencePublishingOrchestrationResult(blockedOrchestration).ok, true);

  const allowedOrchestration = await orchestrateIntelligencePublishing({
    registrySnapshot: snapshot,
    mode: "dry_run",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
  });
  assert.equal(allowedOrchestration.gateDecision.decision, "allowed");
  assert.notEqual(allowedOrchestration.batchPlan, null);
  assert.notEqual(allowedOrchestration.batchResult, null);
  assertNoPrivateKeys(allowedOrchestration);

  console.log("PASS — Intelligence publishing execution gate smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

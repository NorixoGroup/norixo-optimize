import assert from "node:assert/strict";

import { parsePublicationEventEnvelope } from "../lib/intelligencePublishing/eventContracts";
import {
  buildMarketReportExecutionPlan,
  buildMarketReportExecutionPlanFingerprint,
  buildMarketReportFingerprint,
  buildMarketReportPilotResult,
  buildRegistrySnapshotForMarketReport,
  parseMarketReportDefinition,
  validateMarketReportDefinition,
} from "../lib/intelligencePublishing/marketReportPilot";
import { validateExecutionPlan } from "../lib/intelligencePublishing/executionEngine";
import {
  buildRegistrySnapshotFingerprint,
  validateRegistrySnapshot,
} from "../lib/intelligencePublishing/registryAdapter";

function buildNow() {
  return () => "2026-07-20T16:00:00.000Z";
}

function buildDefinition(overrides: Record<string, unknown> = {}) {
  return parseMarketReportDefinition({
    reportId: "report_paris_airbnb_apartment_en",
    marketCellKey: "fr:paris:airbnb:apartment",
    city: "Paris",
    country: "fr",
    platform: "airbnb",
    propertyType: "apartment",
    language: "en",
    title: "Airbnb Market Report Paris",
    slug: "airbnb-market-report-paris",
    reportVersion: 1,
    benchmarkFingerprint: "benchmark_fp_v1",
    overviewFingerprint: "overview_fp_v1",
    policyVersions: {
      pricing_policy: "policy_v1",
      public_overview_policy: "overview_policy_v1",
    },
    createdAt: "2026-07-20T09:00:00.000Z",
    updatedAt: "2026-07-20T12:00:00.000Z",
    metadata: {
      source: "pilot",
    },
    ...overrides,
  });
}

function buildBenchmarkUpdatedEvent(subjectFingerprint: string) {
  return parsePublicationEventEnvelope({
    eventId: "evt_market_report_benchmark_updated",
    eventType: "benchmark_updated",
    occurredAt: "2026-07-20T15:30:00.000Z",
    sourceSystem: "intelligence_v2",
    subjectType: "benchmark",
    subjectId: "benchmark:fr:paris:airbnb:apartment",
    subjectFingerprint,
    policyVersions: {
      pricing_policy: "policy_v1",
    },
    priority: "P1",
    visibility: "internal",
    metadata: {
      benchmarkType: "pricing_distribution",
      changeSummary: "median_changed",
    },
  });
}

function buildOverviewApprovedEvent(subjectFingerprint: string) {
  return parsePublicationEventEnvelope({
    eventId: "evt_market_report_overview_approved",
    eventType: "public_overview_approved",
    occurredAt: "2026-07-20T15:35:00.000Z",
    sourceSystem: "public_intelligence",
    subjectType: "public_overview",
    subjectId: "overview:fr:paris:airbnb:apartment",
    subjectFingerprint,
    policyVersions: {
      public_overview_policy: "overview_policy_v1",
    },
    priority: "P1",
    visibility: "public",
    metadata: {
      approvalStatus: "internal_approved",
    },
  });
}

{
  const definition = buildDefinition();
  const snapshot = buildRegistrySnapshotForMarketReport(definition);
  const validation = validateRegistrySnapshot(snapshot);
  assert.equal(validation.ok, true);

  const plan = buildMarketReportExecutionPlan({
    request: {
      definition,
      triggerEvent: buildBenchmarkUpdatedEvent("benchmark_fp_v2"),
      registrySnapshot: snapshot,
    },
    runId: "run_market_report_A",
    now: buildNow(),
    estimatedCostByJobType: {
      generate_asset_version: 5,
    },
  });

  const result = validateExecutionPlan(plan);
  assert.equal(result.ok, true);
  assert.equal(plan.impactPlan.impactLevel, "content_regeneration_required");
  assert.equal(plan.jobs.length, 1);
  assert.equal(plan.jobs[0]?.jobType, "generate_asset_version");
  assert.equal(plan.jobs[0]?.assetId, "asset_market_report_report_paris_airbnb_apartment_en");
}

{
  const definition = buildDefinition();
  const snapshot = buildRegistrySnapshotForMarketReport(definition);
  const plan = buildMarketReportExecutionPlan({
    request: {
      definition,
      triggerEvent: buildOverviewApprovedEvent("overview_fp_v2"),
      registrySnapshot: snapshot,
    },
    runId: "run_market_report_B",
    now: buildNow(),
    estimatedCostByJobType: {
      generate_asset_version: 5,
      publish: 3,
    },
  });

  const publishJobs = plan.jobs.filter((job) => job.jobType === "publish");
  assert.equal(plan.impactPlan.requiredActions.includes("republish"), true);
  assert.equal(publishJobs.length, 2);
  assert.equal(plan.governanceSummary.publicationJobIds.length, 2);
}

{
  const definition = buildDefinition();
  const snapshot = buildRegistrySnapshotForMarketReport(definition);
  const plan = buildMarketReportExecutionPlan({
    request: {
      definition,
      triggerEvent: buildBenchmarkUpdatedEvent("benchmark_fp_v1"),
      registrySnapshot: snapshot,
    },
    runId: "run_market_report_C",
    now: buildNow(),
  });

  assert.equal(plan.impactPlan.impactLevel, "no_impact");
  assert.equal(plan.jobs.length, 0);
  assert.deepEqual(plan.executionOrder, []);
}

{
  const definition = buildDefinition();
  const firstFingerprint = buildMarketReportFingerprint(definition);
  const secondFingerprint = buildMarketReportFingerprint(buildDefinition());
  const firstSnapshot = buildRegistrySnapshotForMarketReport(definition);
  const secondSnapshot = buildRegistrySnapshotForMarketReport(buildDefinition());
  const firstPlan = buildMarketReportExecutionPlan({
    request: {
      definition,
      triggerEvent: buildBenchmarkUpdatedEvent("benchmark_fp_v2"),
      registrySnapshot: firstSnapshot,
    },
    runId: "run_market_report_D",
    now: buildNow(),
  });
  const secondPlan = buildMarketReportExecutionPlan({
    request: {
      definition: buildDefinition(),
      triggerEvent: buildBenchmarkUpdatedEvent("benchmark_fp_v2"),
      registrySnapshot: secondSnapshot,
    },
    runId: "run_market_report_D",
    now: buildNow(),
  });

  assert.equal(firstFingerprint, secondFingerprint);
  assert.equal(
    buildRegistrySnapshotFingerprint(firstSnapshot),
    buildRegistrySnapshotFingerprint(secondSnapshot),
  );
  assert.equal(firstPlan.executionPlanId, secondPlan.executionPlanId);
}

{
  const base = buildDefinition();
  const changed = buildDefinition({
    benchmarkFingerprint: "benchmark_fp_v2",
  });
  const basePlan = buildMarketReportExecutionPlan({
    request: {
      definition: base,
      triggerEvent: buildBenchmarkUpdatedEvent("benchmark_fp_v2"),
      registrySnapshot: buildRegistrySnapshotForMarketReport(base),
    },
    runId: "run_market_report_E1",
    now: buildNow(),
  });
  const changedPlan = buildMarketReportExecutionPlan({
    request: {
      definition: changed,
      triggerEvent: buildBenchmarkUpdatedEvent("benchmark_fp_v3"),
      registrySnapshot: buildRegistrySnapshotForMarketReport(changed),
    },
    runId: "run_market_report_E1",
    now: buildNow(),
  });

  assert.notEqual(buildMarketReportFingerprint(base), buildMarketReportFingerprint(changed));
  assert.notEqual(basePlan.executionPlanId, changedPlan.executionPlanId);
}

{
  const invalid = validateMarketReportDefinition({
    reportId: "",
    marketCellKey: "",
    city: "",
    country: "",
    platform: "",
    propertyType: "",
    language: "",
    title: "",
    slug: "",
    reportVersion: 0,
    benchmarkFingerprint: "",
    overviewFingerprint: "",
    policyVersions: null,
    createdAt: "invalid",
    updatedAt: "invalid",
    metadata: undefined,
  });
  assert.equal(invalid.ok, false);
}

{
  const definition = buildDefinition();
  const pilot = buildMarketReportPilotResult({
    definition,
    triggerEvent: buildBenchmarkUpdatedEvent("benchmark_fp_v2"),
    runId: "run_market_report_pilot",
    now: buildNow(),
  });

  assert.equal(pilot.definition.reportId, definition.reportId);
  assert.equal(pilot.registrySnapshot.snapshotId, "registry_snapshot_market_report_report_paris_airbnb_apartment_en");
  assert.ok(pilot.executionPlanFingerprint.startsWith("ipp_market_report_exec_"));
  assert.equal(
    pilot.executionPlanFingerprint,
    buildMarketReportExecutionPlanFingerprint({
      definition,
      registrySnapshot: pilot.registrySnapshot,
      executionPlan: pilot.executionPlan,
    }),
  );
}

console.log("PASS — Intelligence Publishing market report pilot smoke");

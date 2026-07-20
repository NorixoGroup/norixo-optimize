import assert from "node:assert/strict";

import {
  buildExecutionJournal,
  buildExecutionDiagnostics,
  buildExecutionEventsFromJournal,
  buildExecutionSummary,
  buildRollbackPlan,
  appendJournalEntry,
  validateExecutionEvent,
  validateExecutionJournal,
  validateExecutionSummary,
  validateRollbackPlan,
  type ExecutionJournalEntryInput,
} from "../lib/intelligencePublishing/observability";
import { parsePublicationEventEnvelope } from "../lib/intelligencePublishing/eventContracts";
import {
  buildMarketReportExecutionPlan,
  buildRegistrySnapshotForMarketReport,
  parseMarketReportDefinition,
} from "../lib/intelligencePublishing/marketReportPilot";
import {
  planWebPublicationBatch,
  validateWebPublicationBatch,
  type WebPublisherConfiguration,
} from "../lib/intelligencePublishing/webPublisher";

function buildNow() {
  return () => "2026-07-20T18:00:00.000Z";
}

function buildDefinition() {
  return parseMarketReportDefinition({
    reportId: "report_marrakech_airbnb_apartment_en",
    marketCellKey: "morocco:marrakech:airbnb:apartment",
    city: "Marrakech",
    country: "morocco",
    platform: "airbnb",
    propertyType: "apartment",
    language: "en",
    title: "Marrakech Airbnb Market Report",
    slug: "marrakech-airbnb-market-report",
    reportVersion: 2,
    benchmarkFingerprint: "benchmark_fp_observability_v2",
    overviewFingerprint: "overview_fp_observability_v2",
    policyVersions: {
      pricing_policy: "pricing_policy_v2",
      public_overview_policy: "public_overview_policy_v2",
    },
    createdAt: "2026-07-20T17:15:00.000Z",
    updatedAt: "2026-07-20T17:45:00.000Z",
    metadata: {
      pilot: "observability",
    },
  });
}

function buildPublisherConfiguration(): WebPublisherConfiguration {
  return {
    siteOrigin: "https://norixo.io",
    defaultLocale: "en",
    localizedRouteStrategy: "default_unprefixed",
    marketReportRoutePattern: "/market-reports/{country}/{city}/{slug}",
    deploymentTarget: "next_app",
    rendererVersion: "web_renderer_v1",
    supportedLocales: ["en", "fr"],
    metadata: {
      surface: "web",
      smoke: "observability",
    },
  };
}

function buildTriggerEvent() {
  const definition = buildDefinition();
  const registrySnapshot = buildRegistrySnapshotForMarketReport(definition);

  return parsePublicationEventEnvelope({
    eventId: "evt_market_report_observability_001",
    eventType: "manual_republish_requested",
    occurredAt: "2026-07-20T17:50:00.000Z",
    sourceSystem: "admin_console",
    subjectType: "asset",
    subjectId: registrySnapshot.assets[0]!.assetId,
    subjectFingerprint: "manual_republish_fp_v1",
    policyVersions: {
      pricing_policy: "pricing_policy_v2",
    },
    priority: "P1",
    visibility: "internal",
    requestId: "req_observability_001",
    metadata: {
      reason: "editorial_review",
      requestedBy: "ops@norixo.io",
    },
  });
}

function buildJournalEntries(
  executionPlanId: string,
  batchId: string,
): readonly ExecutionJournalEntryInput[] {
  const entries: ExecutionJournalEntryInput[] = [
    {
      timestamp: "2026-07-20T18:00:00.000Z",
      phase: "planning",
      entityType: "execution_plan",
      entityId: executionPlanId,
      action: "plan_created",
      severity: "info",
      message: "Execution plan created deterministically.",
      structuredData: {
        source: "execution_engine",
      },
    },
    {
      timestamp: "2026-07-20T18:00:00.000Z",
      phase: "planning",
      entityType: "job",
      entityId: "multiple",
      action: "job_planned",
      severity: "info",
      message: "Execution jobs derived from the impact plan.",
      structuredData: {
        origin: "impact_resolver",
      },
    },
    {
      timestamp: "2026-07-20T18:00:00.000Z",
      phase: "publication_batching",
      entityType: "command",
      entityId: batchId,
      action: "command_planned",
      severity: "info",
      message: "Web publication batch planned without side effects.",
      structuredData: {
        channel: "web",
      },
    },
  ];

  return Object.freeze(entries.map((entry) => Object.freeze(entry)));
}

{
  const definition = buildDefinition();
  const registrySnapshot = buildRegistrySnapshotForMarketReport(definition);
  const executionPlan = buildMarketReportExecutionPlan({
    request: {
      definition,
      triggerEvent: buildTriggerEvent(),
      registrySnapshot,
    },
    runId: "run_observability_001",
    now: buildNow(),
    estimatedCostByJobType: {
      generate_asset_version: 5,
      publish: 3,
    },
  });

  const batch = planWebPublicationBatch({
    executionPlan,
    registrySnapshot,
    publisherConfiguration: buildPublisherConfiguration(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [registrySnapshot.assets[0]!.assetId]: definition,
    },
  });

  assert.equal(validateWebPublicationBatch(batch).ok, true);

  const initialDiagnostics = buildExecutionDiagnostics({
    executionPlan,
    publicationBatch: batch,
    metadata: {
      smoke: "observability",
    },
  });

  const baseJournal = buildExecutionJournal({
    executionPlan,
    status: "in_progress",
    entries: buildJournalEntries(executionPlan.executionPlanId, batch.batchId),
    diagnostics: initialDiagnostics,
    metadata: {
      smoke: "observability",
      stage: "base",
    },
  });

  assert.equal(validateExecutionJournal(baseJournal).ok, true);
  assert.equal(Object.isFrozen(baseJournal), true);
  assert.equal(Object.isFrozen(baseJournal.entries), true);
  assert.equal(baseJournal.entries.length, 3);

  const rollbackPlan = buildRollbackPlan({
    executionPlan,
    publicationBatch: batch,
    createdAt: "2026-07-20T18:00:01.000Z",
    metadata: {
      smoke: "observability",
    },
  });
  const rollbackPlanDuplicate = buildRollbackPlan({
    executionPlan,
    publicationBatch: batch,
    createdAt: "2026-07-20T18:00:01.000Z",
    metadata: {
      smoke: "observability",
    },
  });

  assert.deepEqual(rollbackPlan, rollbackPlanDuplicate);
  assert.equal(validateRollbackPlan(rollbackPlan).ok, true);
  assert.equal(rollbackPlan.rollbackActions.length > 0, true);

  const diagnostics = buildExecutionDiagnostics({
    executionPlan,
    publicationBatch: batch,
    rollbackPlan,
    metadata: {
      smoke: "observability",
    },
  });

  const journalWithRollback = appendJournalEntry(baseJournal, {
    timestamp: "2026-07-20T18:00:01.000Z",
    phase: "rollback",
    entityType: "rollback_plan",
    entityId: rollbackPlan.rollbackPlanId,
    action: "rollback_prepared",
    severity: "info",
    message: "Rollback plan prepared declaratively.",
    structuredData: {
      rollbackActionCount: rollbackPlan.rollbackActions.length,
    },
  });

  assert.equal(baseJournal.entries.length, 3);
  assert.equal(journalWithRollback.entries.length, 4);

  const journalCompletedEntries = appendJournalEntry(journalWithRollback, {
    timestamp: "2026-07-20T18:00:02.000Z",
    phase: "summary",
    entityType: "execution_summary",
    entityId: executionPlan.executionPlanId,
    action: "execution_completed",
    severity: "info",
    message: "Execution summary prepared without executing any command.",
    structuredData: {
      journalMode: "dry_plan_only",
    },
  });

  const completedJournal = buildExecutionJournal({
    executionPlan,
    startedAt: baseJournal.startedAt,
    finishedAt: "2026-07-20T18:00:02.000Z",
    status: "completed",
    entries: journalCompletedEntries.entries,
    diagnostics,
    metadata: {
      smoke: "observability",
      stage: "completed",
    },
  });
  const completedJournalDuplicate = buildExecutionJournal({
    executionPlan,
    startedAt: baseJournal.startedAt,
    finishedAt: "2026-07-20T18:00:02.000Z",
    status: "completed",
    entries: journalCompletedEntries.entries,
    diagnostics,
    metadata: {
      smoke: "observability",
      stage: "completed",
    },
  });

  assert.deepEqual(completedJournal, completedJournalDuplicate);
  assert.equal(validateExecutionJournal(completedJournal).ok, true);
  assert.equal(completedJournal.entries.length, 5);

  const executionEvents = buildExecutionEventsFromJournal(completedJournal);
  assert.equal(executionEvents.length, completedJournal.entries.length);
  executionEvents.forEach((executionEvent) => {
    assert.equal(validateExecutionEvent(executionEvent).ok, true);
  });
  assert.deepEqual(
    executionEvents.map((executionEvent) => executionEvent.eventType),
    [
      "plan_created",
      "job_planned",
      "command_planned",
      "rollback_prepared",
      "execution_completed",
    ],
  );

  const summary = buildExecutionSummary({
    executionPlan,
    publicationBatch: batch,
    rollbackPlan,
    diagnostics,
    metadata: {
      smoke: "observability",
    },
  });
  const summaryDuplicate = buildExecutionSummary({
    executionPlan,
    publicationBatch: batch,
    rollbackPlan,
    diagnostics,
    metadata: {
      smoke: "observability",
    },
  });

  assert.deepEqual(summary, summaryDuplicate);
  assert.equal(validateExecutionSummary(summary).ok, true);
  assert.equal(summary.jobsPlanned, executionPlan.jobs.length);
  assert.equal(summary.publicationCommands, batch.commands.length);
  assert.equal(summary.rollbackPlanId, rollbackPlan.rollbackPlanId);
  assert.equal(summary.deterministicFingerprint, summaryDuplicate.deterministicFingerprint);

  const replaySummary = buildExecutionSummary({
    executionPlan,
    publicationBatch: batch,
    rollbackPlan: rollbackPlanDuplicate,
    diagnostics,
    metadata: {
      smoke: "observability",
    },
  });
  assert.deepEqual(summary, replaySummary);
}

console.log("PASS — Intelligence Publishing observability smoke");

import assert from "node:assert/strict";

import { buildExecutionPlan } from "../lib/intelligencePublishing/executionEngine";
import { parsePublicationEventEnvelope } from "../lib/intelligencePublishing/eventContracts";
import { createJob } from "../lib/intelligencePublishing/jobModel";
import {
  buildRegistrySnapshotForMarketReport,
  parseMarketReportDefinition,
} from "../lib/intelligencePublishing/marketReportPilot";
import {
  buildTargetWebPublicationFingerprint,
  buildWebContentDescriptor,
  deriveNextWebPublicationState,
  planWebPublicationBatch,
  planWebPublicationCommand,
  resolveWebPublicationDestination,
  validateWebPublicationBatch,
  validateWebPublicationCommand,
  validateWebPublicationDestination,
  validateWebContentDescriptor,
  type WebPublisherConfiguration,
  type WebPublicationCommand,
  WebPublisherError,
} from "../lib/intelligencePublishing/webPublisher";

function buildNow() {
  return () => "2026-07-20T17:00:00.000Z";
}

function buildConfig(
  overrides: Partial<WebPublisherConfiguration> = {},
): WebPublisherConfiguration {
  return {
    siteOrigin: "https://norixo.io",
    defaultLocale: "en",
    localizedRouteStrategy: "default_unprefixed",
    marketReportRoutePattern: "/market-reports/{country}/{city}/{slug}",
    deploymentTarget: "next_app",
    rendererVersion: "web_renderer_v1",
    supportedLocales: ["en", "fr", "de"],
    metadata: {
      surface: "web",
    },
    ...overrides,
  };
}

function buildDefinition(overrides: Record<string, unknown> = {}) {
  return parseMarketReportDefinition({
    reportId: "marrakech_airbnb_report_en",
    marketCellKey: "morocco:marrakech:airbnb:apartment",
    city: "Marrakech",
    country: "morocco",
    platform: "airbnb",
    propertyType: "apartment",
    language: "en",
    title: "Marrakech Airbnb Market Report",
    slug: "marrakech-airbnb-market-report",
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

function buildOverviewApprovedEvent(fingerprint: string) {
  return parsePublicationEventEnvelope({
    eventId: "evt_web_overview_approved",
    eventType: "public_overview_approved",
    occurredAt: "2026-07-20T16:00:00.000Z",
    sourceSystem: "public_intelligence",
    subjectType: "public_overview",
    subjectId: "overview:morocco:marrakech:airbnb:apartment",
    subjectFingerprint: fingerprint,
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

function buildSuppressedEvent() {
  return parsePublicationEventEnvelope({
    eventId: "evt_web_overview_suppressed",
    eventType: "public_overview_suppressed",
    occurredAt: "2026-07-20T16:05:00.000Z",
    sourceSystem: "public_intelligence",
    subjectType: "public_overview",
    subjectId: "overview:morocco:marrakech:airbnb:apartment",
    subjectFingerprint: "overview_fp_v2",
    policyVersions: {
      public_overview_policy: "overview_policy_v1",
    },
    priority: "P1",
    visibility: "public",
    metadata: {
      suppressionReason: "confidence_below_floor",
    },
  });
}

function buildFreshnessExpiredEvent() {
  return parsePublicationEventEnvelope({
    eventId: "evt_web_freshness",
    eventType: "freshness_expired",
    occurredAt: "2026-07-20T16:10:00.000Z",
    sourceSystem: "public_intelligence",
    subjectType: "public_overview",
    subjectId: "overview:morocco:marrakech:airbnb:apartment",
    subjectFingerprint: "fresh_fp_v2",
    policyVersions: {
      public_overview_policy: "overview_policy_v1",
    },
    priority: "P1",
    visibility: "public",
    metadata: {
      expiredAt: "2026-07-20T16:00:00.000Z",
    },
  });
}

function buildRepublishPlan() {
  const definition = buildDefinition();
  const snapshot = buildRegistrySnapshotForMarketReport(definition);
  const executionPlan = buildExecutionPlan({
    event: buildOverviewApprovedEvent("overview_fp_v2"),
    registrySnapshot: snapshot,
    runId: "run_web_republish",
    now: buildNow(),
    estimatedCostByJobType: {
      generate_asset_version: 5,
      publish: 3,
    },
  });
  return { definition, snapshot, executionPlan };
}

function buildSuppressPlan() {
  const definition = buildDefinition();
  const snapshot = buildRegistrySnapshotForMarketReport(definition);
  const executionPlan = buildExecutionPlan({
    event: buildSuppressedEvent(),
    registrySnapshot: snapshot,
    runId: "run_web_suppress",
    now: buildNow(),
    estimatedCostByJobType: {
      suppress: 2,
    },
  });
  return { definition, snapshot, executionPlan };
}

function buildFreshnessPlan() {
  const definition = buildDefinition();
  const snapshot = buildRegistrySnapshotForMarketReport(definition);
  const executionPlan = buildExecutionPlan({
    event: buildFreshnessExpiredEvent(),
    registrySnapshot: snapshot,
    runId: "run_web_freshness",
    now: buildNow(),
    estimatedCostByJobType: {
      update_freshness: 1,
    },
  });
  return { definition, snapshot, executionPlan };
}

function expectWebPublisherError(
  fn: () => unknown,
  code?: string,
): WebPublisherError {
  try {
    fn();
  } catch (error) {
    const typed = error as WebPublisherError;
    if (code != null) {
      assert.equal(typed.code, code);
    }
    return typed;
  }

  throw new Error("Expected a WebPublisherError.");
}

{
  const definition = buildDefinition();
  const snapshot = buildRegistrySnapshotForMarketReport(definition);
  const asset = snapshot.assets[0]!;
  const version = snapshot.assetVersions[0]!;
  const destination = resolveWebPublicationDestination({
    asset,
    assetVersion: version,
    locale: "en",
    configuration: buildConfig(),
    marketReportDefinition: definition,
  });
  assert.equal(destination.route, "/market-reports/morocco/marrakech/marrakech-airbnb-market-report");
  assert.equal(
    destination.canonicalUrl,
    "https://norixo.io/market-reports/morocco/marrakech/marrakech-airbnb-market-report",
  );
  assert.equal(validateWebPublicationDestination(destination).ok, true);
}

{
  const definition = buildDefinition({
    language: "fr",
    slug: "rapport-marche-airbnb-marrakech",
  });
  const snapshot = buildRegistrySnapshotForMarketReport(definition);
  const destination = resolveWebPublicationDestination({
    asset: snapshot.assets[0]!,
    assetVersion: snapshot.assetVersions[0]!,
    locale: "fr",
    configuration: buildConfig(),
    marketReportDefinition: definition,
  });
  assert.equal(destination.route, "/fr/market-reports/morocco/marrakech/rapport-marche-airbnb-marrakech");
}

{
  const definition = buildDefinition();
  const snapshot = buildRegistrySnapshotForMarketReport(definition);
  const asset = snapshot.assets[0]!;
  const version = snapshot.assetVersions[0]!;

  expectWebPublisherError(
    () =>
      resolveWebPublicationDestination({
        asset,
        assetVersion: version,
        locale: "es",
        configuration: buildConfig(),
        marketReportDefinition: definition,
      }),
    "unsupported_locale",
  );
  expectWebPublisherError(
    () =>
      resolveWebPublicationDestination({
        asset,
        assetVersion: version,
        locale: "en",
        configuration: buildConfig({
          marketReportRoutePattern: "/market-reports/{slug}?draft=1",
        }),
        marketReportDefinition: definition,
      }),
    "invalid_route",
  );
  expectWebPublisherError(
    () =>
      resolveWebPublicationDestination({
        asset,
        assetVersion: version,
        locale: "en",
        configuration: buildConfig({
          siteOrigin: "norixo.io",
        }),
        marketReportDefinition: definition,
      }),
    "invalid_destination",
  );
}

{
  const { definition, snapshot } = buildRepublishPlan();
  const asset = snapshot.assets[0]!;
  const version = snapshot.assetVersions[0]!;
  const destination = resolveWebPublicationDestination({
    asset,
    assetVersion: version,
    locale: "en",
    configuration: buildConfig(),
    marketReportDefinition: definition,
  });
  const descriptor = buildWebContentDescriptor({
    asset,
    assetVersion: version,
    snapshot,
    destination,
    configuration: buildConfig(),
    marketReportDefinition: definition,
  });
  assert.equal(validateWebContentDescriptor(descriptor).ok, true);
  assert.ok(descriptor.rendererFingerprint.startsWith("ipp_web_renderer_"));
  const altDescriptor = buildWebContentDescriptor({
    asset,
    assetVersion: version,
    snapshot,
    destination: {
      ...destination,
      locale: "fr",
      route: "/fr/market-reports/morocco/marrakech/marrakech-airbnb-market-report",
      canonicalUrl:
        "https://norixo.io/fr/market-reports/morocco/marrakech/marrakech-airbnb-market-report",
      destinationId: "alt-destination",
    },
    configuration: buildConfig({
      rendererVersion: "web_renderer_v2",
    }),
    marketReportDefinition: definition,
  });
  assert.notEqual(descriptor.rendererFingerprint, altDescriptor.rendererFingerprint);
  assert.equal(JSON.stringify(descriptor).includes("sourceUrl"), false);
}

{
  const { definition, snapshot, executionPlan } = buildRepublishPlan();
  const webJob = executionPlan.jobs.find((job) => job.channel === "web")!;
  const newsletterJob = executionPlan.jobs.find((job) => job.channel === "newsletter")!;
  const command = planWebPublicationCommand({
    executionPlan,
    job: webJob,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });
  assert.equal(command.action, "republish");
  assert.equal(command.destination.channel, "web");
  assert.equal(command.contentDescriptor?.route, command.destination.route);
  assert.equal(command.preconditions.length > 0, true);
  assert.equal(command.invalidationHints.length > 0, true);
  assert.equal(command.fencingRequirement.validationRequiredBeforeWrite, true);
  assert.equal(command.nextPublicationState.status, "publishing");
  assert.equal(validateWebPublicationCommand(command).ok, true);

  const sameCommand = planWebPublicationCommand({
    executionPlan,
    job: webJob,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
    metadata: {
      debug: "non_structural",
    },
  });
  assert.equal(command.commandId, sameCommand.commandId);
  assert.equal(command.idempotencyKey, sameCommand.idempotencyKey);

  expectWebPublisherError(
    () =>
      planWebPublicationCommand({
        executionPlan,
        job: newsletterJob,
        registrySnapshot: snapshot,
        publisherConfiguration: buildConfig(),
        now: buildNow(),
      }),
    "unsupported_channel",
  );
}

{
  const { definition, snapshot, executionPlan } = buildSuppressPlan();
  const suppressJob = executionPlan.jobs[0]!;
  const suppressCommand = planWebPublicationCommand({
    executionPlan,
    job: suppressJob,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });
  assert.equal(suppressCommand.action, "suppress");
  assert.equal(suppressCommand.contentDescriptor, null);
  assert.equal(suppressCommand.nextPublicationState.status, "suppressed");
}

{
  const { definition, snapshot, executionPlan } = buildRepublishPlan();
  const baseJob = executionPlan.jobs.find((job) => job.channel === "web")!;
  const publishJob = {
    ...baseJob,
    action: "publish" as const,
  };
  const rollbackJob = {
    ...baseJob,
    action: "rollback" as const,
  };
  const updateMetadataJob = {
    ...baseJob,
    action: "update_metadata" as const,
    channel: null,
  };
  const publishCommand = planWebPublicationCommand({
    executionPlan: {
      ...executionPlan,
      jobs: Object.freeze([publishJob]),
      executionOrder: Object.freeze([publishJob.jobId]),
    },
    job: publishJob,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });
  const rollbackCommand = planWebPublicationCommand({
    executionPlan: {
      ...executionPlan,
      jobs: Object.freeze([rollbackJob]),
      executionOrder: Object.freeze([rollbackJob.jobId]),
    },
    job: rollbackJob,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });
  const updateMetadataCommand = planWebPublicationCommand({
    executionPlan: {
      ...executionPlan,
      jobs: Object.freeze([updateMetadataJob]),
      executionOrder: Object.freeze([updateMetadataJob.jobId]),
    },
    job: updateMetadataJob,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });

  assert.equal(publishCommand.action, "publish");
  assert.equal(rollbackCommand.action, "rollback");
  assert.equal(rollbackCommand.nextPublicationState.status, "rolled_back");
  assert.equal(updateMetadataCommand.action, "update_metadata");

  const freshness = buildFreshnessPlan();
  const freshnessJob = freshness.executionPlan.jobs[0]!;
  const freshnessCommand = planWebPublicationCommand({
    executionPlan: freshness.executionPlan,
    job: freshnessJob,
    registrySnapshot: freshness.snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [freshness.snapshot.assets[0]!.assetId]: freshness.definition,
    },
  });
  assert.equal(freshnessCommand.action, "update_freshness");
}

{
  const { definition, snapshot, executionPlan } = buildRepublishPlan();
  const webJob = executionPlan.jobs.find((job) => job.channel === "web")!;
  const fakeJob = createJob({
    jobId: "job_missing",
    runId: executionPlan.orchestrationRun.runId,
    action: "publish",
    jobType: "publish",
    priority: "P1",
    now: "2026-07-20T17:00:00.000Z",
    assetId: "missing_asset",
    assetVersionId: snapshot.assetVersions[0]!.assetVersionId,
    channel: "web",
  });
  expectWebPublisherError(
    () =>
      planWebPublicationCommand({
        executionPlan,
        job: fakeJob,
        registrySnapshot: snapshot,
        publisherConfiguration: buildConfig(),
        now: buildNow(),
      }),
    "job_not_in_execution_plan",
  );

  expectWebPublisherError(
    () =>
      planWebPublicationCommand({
        executionPlan,
        job: {
          ...webJob,
          assetId: "missing_asset",
        } as typeof webJob,
        registrySnapshot: snapshot,
        publisherConfiguration: buildConfig(),
        now: buildNow(),
      }),
    "missing_asset",
  );

  expectWebPublisherError(
    () =>
      planWebPublicationCommand({
        executionPlan,
        job: {
          ...webJob,
          assetVersionId: "missing_version",
        } as typeof webJob,
        registrySnapshot: snapshot,
        publisherConfiguration: buildConfig(),
        now: buildNow(),
      }),
    "missing_version",
  );
}

{
  const { definition, snapshot, executionPlan } = buildRepublishPlan();
  const webJob = executionPlan.jobs.find((job) => job.channel === "web")!;
  const baseCommand = planWebPublicationCommand({
    executionPlan,
    job: webJob,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });
  const changedDestinationCommand = planWebPublicationCommand({
    executionPlan,
    job: webJob,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig({
      siteOrigin: "https://fr.norixo.io",
    }),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });
  const changedFingerprintCommand = planWebPublicationCommand({
    executionPlan,
    job: webJob,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig({
      rendererVersion: "web_renderer_v2",
    }),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });
  assert.notEqual(baseCommand.commandId, changedDestinationCommand.commandId);
  assert.notEqual(baseCommand.commandId, changedFingerprintCommand.commandId);
}

{
  const { definition, snapshot, executionPlan } = buildRepublishPlan();
  const batch = planWebPublicationBatch({
    executionPlan,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });
  assert.equal(batch.commands.length, 1);
  assert.equal(batch.commands[0]!.destination.channel, "web");
  assert.deepEqual(batch.commandIds, batch.executionOrder);
  assert.equal(batch.estimatedWriteCount, 1);
  assert.equal(validateWebPublicationBatch(batch).ok, true);

  const filteredEmptyBatch = planWebPublicationBatch({
    executionPlan,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    filters: {
      actions: ["suppress"],
    },
  });
  assert.equal(filteredEmptyBatch.commands.length, 0);
}

{
  const { definition, snapshot, executionPlan } = buildSuppressPlan();
  const suppressBatch = planWebPublicationBatch({
    executionPlan,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });
  assert.equal(suppressBatch.containsImmediateSuppression, true);
}

{
  const { definition, snapshot, executionPlan } = buildRepublishPlan();
  const webJob = executionPlan.jobs.find((job) => job.channel === "web")!;
  const command = planWebPublicationCommand({
    executionPlan,
    job: webJob,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });

  const sameFingerprint = buildTargetWebPublicationFingerprint({
    assetId: command.assetId,
    assetVersionId: command.assetVersionId,
    contentFingerprint: command.contentDescriptor!.contentFingerprint,
    rendererFingerprint: command.contentDescriptor!.rendererFingerprint,
    locale: command.contentDescriptor!.locale,
    route: command.contentDescriptor!.route,
    templateId: command.contentDescriptor!.templateId,
    policyVersions: command.contentDescriptor!.policyVersions,
  });
  const changedRouteFingerprint = buildTargetWebPublicationFingerprint({
    assetId: command.assetId,
    assetVersionId: command.assetVersionId,
    contentFingerprint: command.contentDescriptor!.contentFingerprint,
    rendererFingerprint: command.contentDescriptor!.rendererFingerprint,
    locale: command.contentDescriptor!.locale,
    route: "/fr/market-reports/morocco/marrakech/marrakech-airbnb-market-report",
    templateId: command.contentDescriptor!.templateId,
    policyVersions: command.contentDescriptor!.policyVersions,
  });
  assert.equal(sameFingerprint, command.targetPublicationFingerprint);
  assert.notEqual(sameFingerprint, changedRouteFingerprint);
}

{
  const { definition, snapshot, executionPlan } = buildRepublishPlan();
  const batch = planWebPublicationBatch({
    executionPlan,
    registrySnapshot: snapshot,
    publisherConfiguration: buildConfig(),
    now: buildNow(),
    marketReportDefinitionsByAssetId: {
      [snapshot.assets[0]!.assetId]: definition,
    },
  });
  assert.equal(batch.commands[0]!.destination.canonicalUrl, "https://norixo.io/market-reports/morocco/marrakech/marrakech-airbnb-market-report");
  assert.equal(JSON.stringify(batch).includes("sourceUrl"), false);
  assert.equal(JSON.stringify(batch).includes("listingUrl"), false);
}

console.log("PASS — Intelligence Publishing web publisher smoke");

import assert from "node:assert/strict";
import fs from "node:fs";

import {
  executeApprovedIntelligencePublishing,
  IntelligencePublishingApprovedOrchestratorError,
} from "../lib/intelligencePublishing/approvedOrchestrator";
import { buildIntelligencePublishingApprovedExecutionBundle } from "../lib/intelligencePublishing/approvedExecution";
import { issueIntelligencePublishingApprovalGrant } from "../lib/intelligencePublishing/approvalGrant";
import { buildIntelligencePublishingApprovalPreparationBundle } from "../lib/intelligencePublishing/approvalPreparation";
import { buildIntelligencePublishingPublicationPlan } from "../lib/intelligencePublishing/campaignPlanning";
import type { MarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import { parseMarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import {
  orchestrateIntelligencePublishing,
  validateIntelligencePublishingOrchestrationResult,
} from "../lib/intelligencePublishing/orchestrator";
import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
} from "../lib/intelligencePublishing/registryPopulation";
import { buildRegistryBatchCandidatesFromSnapshot } from "../lib/intelligencePublishing/registryBatchRuntime";
import type { RegistrySnapshot } from "../lib/intelligencePublishing/registryAdapter";

const GENERATED_AT = "2026-07-22T11:00:00.000Z";
const CREATED_AT = "2026-07-22T11:15:00.000Z";
const EXECUTION_NOW = "2026-07-22T11:25:00.000Z";
const EXPIRY_AT = "2026-07-22T11:45:00.000Z";
const GRANT_SECRET = "norixo-approved-orchestrator-secret";
const APPROVAL_VERIFICATION = Object.freeze({
  secret: GRANT_SECRET,
  now: CREATED_AT,
  maxGrantLifetimeSeconds: 1800,
});

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
      source: "approved_orchestrator_smoke",
    },
    ...overrides,
  });
}

function buildRegistrySnapshot(
  definitions: readonly MarketReportDefinition[],
): RegistrySnapshot {
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

function withCanonicalPaths(snapshot: RegistrySnapshot): RegistrySnapshot {
  return {
    ...snapshot,
    assets: Object.freeze(
      snapshot.assets.map((asset) => {
        const slug =
          typeof asset.metadata.reportSlug === "string"
            ? asset.metadata.reportSlug
            : asset.canonicalId;
        const locale =
          typeof asset.metadata.reportLanguage === "string"
            ? asset.metadata.reportLanguage
            : asset.defaultLocale;
        return {
          ...asset,
          metadata: Object.freeze({
            ...asset.metadata,
            canonicalPath:
              locale === "en"
                ? `/reports/${slug}`
                : `/${locale}/reports/${slug}`,
          }),
        };
      }),
    ),
  };
}

function buildSnapshot(): RegistrySnapshot {
  return withCanonicalPaths(
    buildRegistrySnapshot([
      buildDefinition({
        reportId: "report_barcelona_airbnb_apartment_en",
        marketCellKey: "es:barcelona:airbnb:apartment",
        city: "Barcelona",
        country: "es",
        platform: "airbnb",
        propertyType: "apartment",
        language: "en",
        slug: "airbnb-market-report-barcelona-apartment",
        benchmarkFingerprint: "pricing_fp_barcelona_airbnb_apartment",
        overviewFingerprint: "overview_fp_barcelona_airbnb_apartment",
      }),
      buildDefinition({
        reportId: "report_paris_airbnb_apartment_fr",
        marketCellKey: "fr:paris:airbnb:apartment",
        city: "Paris",
        country: "fr",
        platform: "airbnb",
        propertyType: "apartment",
        language: "fr",
        slug: "airbnb-market-report-paris-apartment",
        benchmarkFingerprint: "pricing_fp_paris_airbnb_apartment",
        overviewFingerprint: "overview_fp_paris_airbnb_apartment",
      }),
      buildDefinition({
        reportId: "report_madrid_booking_house_en",
        marketCellKey: "es:madrid:booking:house",
        city: "Madrid",
        country: "es",
        platform: "booking",
        propertyType: "house",
        language: "en",
        slug: "booking-market-report-madrid-house",
        benchmarkFingerprint: "pricing_fp_madrid_booking_house",
        overviewFingerprint: "overview_fp_madrid_booking_house",
      }),
      buildDefinition({
        reportId: "report_marrakech_airbnb_riad_en",
        marketCellKey: "ma:marrakech:airbnb:riad",
        city: "Marrakech",
        country: "ma",
        platform: "airbnb",
        propertyType: "riad",
        language: "en",
        slug: "airbnb-market-report-marrakech-riad",
        benchmarkFingerprint: "pricing_fp_marrakech_airbnb_riad",
        overviewFingerprint: "overview_fp_marrakech_airbnb_riad",
      }),
      buildDefinition({
        reportId: "report_rome_airbnb_villa_de",
        marketCellKey: "it:rome:airbnb:villa",
        city: "Rome",
        country: "it",
        platform: "airbnb",
        propertyType: "villa",
        language: "de",
        slug: "airbnb-market-report-rome-villa",
        benchmarkFingerprint: "pricing_fp_rome_airbnb_villa",
        overviewFingerprint: "overview_fp_rome_airbnb_villa",
      }),
    ]),
  );
}

function buildPublicationPlanForSnapshot(
  snapshot: RegistrySnapshot,
  overrides?: Record<string, unknown>,
) {
  return buildIntelligencePublishingPublicationPlan({
    registrySnapshot: snapshot,
    specification: {
      schemaVersion: "ipp_campaign_specification_v1",
      campaignVersion: "ipp_campaign_contract_v1",
      campaignKey: "approved-orchestrator-smoke",
      name: "Approved Orchestrator Smoke",
      requestedAction: "publish",
      selection: {},
      exclusions: {},
      ordering: {
        strategy: "report_key",
        priorityReportKeys: [],
      },
      limits: {
        maxReports: 10,
      },
      metadata: {
        smoke: true,
      },
      ...(overrides ?? {}),
    },
    createdAt: CREATED_AT,
  });
}

function buildBundle(
  snapshot: RegistrySnapshot,
  specificationOverrides?: Record<string, unknown>,
) {
  const publicationPlan = buildPublicationPlanForSnapshot(
    snapshot,
    specificationOverrides,
  );

  return buildIntelligencePublishingApprovalPreparationBundle({
    publicationPlan,
    registrySnapshot: snapshot,
    requestedAction: "publish",
    executionMode: "execute",
    gatePolicy: {
      approvalRequired: true,
      maxExecuteBatchSize: 10,
      allowlistReportKeys: null,
    },
    createdAt: CREATED_AT,
  });
}

function buildGrant(bundle: ReturnType<typeof buildBundle>) {
  return issueIntelligencePublishingApprovalGrant({
    approvalRequest: bundle.executionApprovalRequest,
    issuer: "norixo-approver",
    issuedAt: CREATED_AT,
    expiresAt: EXPIRY_AT,
    secret: GRANT_SECRET,
    maxGrantLifetimeSeconds: 1800,
  });
}

function buildAllowedBundle(
  snapshot: RegistrySnapshot,
  specificationOverrides?: Record<string, unknown>,
) {
  const approvalPreparationBundle = buildBundle(snapshot, specificationOverrides);
  const approvalGrant = buildGrant(approvalPreparationBundle);
  return {
    approvalPreparationBundle,
    approvalGrant,
    approvedExecutionBundle: buildIntelligencePublishingApprovedExecutionBundle({
      approvalPreparationBundle,
      approvalGrant,
      createdAt: CREATED_AT,
      evaluatedAt: CREATED_AT,
      approvalVerification: {
        secret: GRANT_SECRET,
        maxGrantLifetimeSeconds: 1800,
      },
    }),
  };
}

function expectError(
  fn: () => Promise<unknown> | unknown,
  code: string,
): Promise<IntelligencePublishingApprovedOrchestratorError> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      throw new Error(`Expected error code ${code}.`);
    })
    .catch((error) => {
      assert.ok(error instanceof Error);
      const typedError = error as IntelligencePublishingApprovedOrchestratorError;
      assert.equal(typedError.code, code);
      return typedError;
    });
}

function assertNoPrivateKeys(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes("userId"), false);
  assert.equal(serialized.includes("workspaceId"), false);
  assert.equal(serialized.includes("listingUrl"), false);
  assert.equal(serialized.includes("rawPayload"), false);
}

function assertSourceStructure(): void {
  const source = fs.readFileSync(
    "lib/intelligencePublishing/approvedOrchestrator.ts",
    "utf8",
  );
  assert.equal(source.includes("./orchestrator"), true);
  assert.equal(source.includes("orchestrateIntelligencePublishing("), true);
  assert.equal(source.includes("executeRegistrySnapshotBatch"), false);
  assert.equal(source.includes("executeExecutionPlan"), false);
  assert.equal(source.includes("supabase"), false);
}

async function main() {
  const snapshot = buildSnapshot();
  const fullPreview = buildRegistryBatchCandidatesFromSnapshot({
    registrySnapshot: snapshot,
    channel: "web",
    requestedAction: "publish",
    priority: 100,
  });
  assert.equal(fullPreview.candidates.length, 5);

  const subset = buildAllowedBundle(snapshot, {
    selection: {
      reportKeys: [
        "airbnb-market-report-barcelona-apartment",
        "airbnb-market-report-rome-villa",
      ],
    },
  });
  assert.equal(
    subset.approvalPreparationBundle.executionRequest.candidates.length,
    2,
  );
  assert.deepEqual(
    subset.approvalPreparationBundle.executionRequest.reportKeysInOrder,
    [
      "airbnb-market-report-barcelona-apartment",
      "airbnb-market-report-rome-villa",
    ],
  );

  let executionCount = 0;
  const approvedSubsetResult = await executeApprovedIntelligencePublishing({
    approvedExecutionBundle: subset.approvedExecutionBundle,
    registrySnapshot: snapshot,
    now: () => EXECUTION_NOW,
    approvalVerification: APPROVAL_VERIFICATION,
    executeItem: async () => {
      executionCount += 1;
      return {
        status: "succeeded",
        metadata: {
          smoke: true,
        },
      };
    },
  });
  assert.equal(approvedSubsetResult.gateDecision.decision, "allowed");
  assert.equal(approvedSubsetResult.summary.registryAssetCount, 5);
  assert.equal(approvedSubsetResult.summary.candidateCount, 2);
  assert.equal(approvedSubsetResult.batchPlan?.itemCount, 2);
  assert.equal(approvedSubsetResult.batchResult?.summary.totalItems, 2);
  assert.equal(
    executionCount,
    approvedSubsetResult.batchPlan?.items.filter((item) => item.executable).length ?? 0,
  );
  assert.deepEqual(
    approvedSubsetResult.batchPlan?.items.map((item) => item.candidate.reportKey),
    subset.approvedExecutionBundle.orchestratorInput?.reportKeysInOrder,
  );
  assert.equal(
    validateIntelligencePublishingOrchestrationResult(approvedSubsetResult).ok,
    true,
  );
  assertNoPrivateKeys(approvedSubsetResult);

  const directSubsetResult = await orchestrateIntelligencePublishing({
    mode: "execute",
    createdAt: CREATED_AT,
    now: () => EXECUTION_NOW,
    registrySnapshot: snapshot,
    approvedCandidates:
      subset.approvedExecutionBundle.orchestratorInput?.candidates ?? [],
    requestedAction: "publish",
    approvalGrant: subset.approvalGrant,
    approvalVerification: APPROVAL_VERIFICATION,
    gateConfig: subset.approvedExecutionBundle.orchestratorInput?.gateConfig,
    executeItem: async () => ({
      status: "succeeded",
      metadata: {
        smoke: true,
      },
    }),
  });
  assert.equal(directSubsetResult.summary.candidateCount, 2);
  assert.equal(directSubsetResult.batchPlan?.itemCount, 2);
  assert.equal(
    directSubsetResult.batchPlan?.items[0]?.candidate.reportKey,
    "airbnb-market-report-barcelona-apartment",
  );
  assert.equal(
    directSubsetResult.batchPlan?.items[1]?.candidate.reportKey,
    "airbnb-market-report-rome-villa",
  );

  const maxReports = buildAllowedBundle(snapshot, {
    selection: {
      platforms: ["airbnb"],
    },
    ordering: {
      strategy: "report_key",
      priorityReportKeys: [],
    },
    limits: {
      maxReports: 2,
    },
  });
  const maxReportsResult = await executeApprovedIntelligencePublishing({
    approvedExecutionBundle: maxReports.approvedExecutionBundle,
    registrySnapshot: snapshot,
    now: () => EXECUTION_NOW,
    approvalVerification: APPROVAL_VERIFICATION,
    executeItem: async () => ({
      status: "succeeded",
      metadata: {
        smoke: true,
      },
    }),
  });
  assert.equal(maxReportsResult.summary.candidateCount, 2);
  assert.equal(maxReportsResult.batchPlan?.itemCount, 2);

  const exclusions = buildAllowedBundle(snapshot, {
    selection: {
      platforms: ["airbnb"],
    },
    exclusions: {
      cities: ["barcelona", "marrakech"],
    },
    ordering: {
      strategy: "report_key",
      priorityReportKeys: [],
    },
    limits: {
      maxReports: 10,
    },
  });
  const exclusionsResult = await executeApprovedIntelligencePublishing({
    approvedExecutionBundle: exclusions.approvedExecutionBundle,
    registrySnapshot: snapshot,
    now: () => EXECUTION_NOW,
    approvalVerification: APPROVAL_VERIFICATION,
    executeItem: async () => ({
      status: "succeeded",
      metadata: {
        smoke: true,
      },
    }),
  });
  assert.deepEqual(
    exclusionsResult.batchPlan?.items.map((item) => item.candidate.city),
    ["paris", "rome"],
  );

  const fullCampaign = buildAllowedBundle(snapshot);
  const fullCampaignResult = await executeApprovedIntelligencePublishing({
    approvedExecutionBundle: fullCampaign.approvedExecutionBundle,
    registrySnapshot: snapshot,
    now: () => EXECUTION_NOW,
    approvalVerification: APPROVAL_VERIFICATION,
    executeItem: async () => ({
      status: "succeeded",
      metadata: {
        smoke: true,
      },
    }),
  });
  assert.equal(fullCampaignResult.summary.candidateCount, 5);
  assert.equal(fullCampaignResult.batchPlan?.itemCount, 5);

  const blockedBundle = buildIntelligencePublishingApprovedExecutionBundle({
    approvalPreparationBundle: subset.approvalPreparationBundle,
    approvalGrant: subset.approvalGrant,
    createdAt: CREATED_AT,
    evaluatedAt: CREATED_AT,
    gateConfig: {
      readOnly: true,
    },
    approvalVerification: {
      secret: GRANT_SECRET,
      maxGrantLifetimeSeconds: 1800,
    },
  });
  await expectError(
    () =>
      executeApprovedIntelligencePublishing({
        approvedExecutionBundle: blockedBundle,
        registrySnapshot: snapshot,
        now: () => EXECUTION_NOW,
        approvalVerification: APPROVAL_VERIFICATION,
      }),
    "gate_decision_not_allowed",
  );

  const approvalRequiredBundle = buildIntelligencePublishingApprovedExecutionBundle({
    approvalPreparationBundle: subset.approvalPreparationBundle,
    createdAt: CREATED_AT,
    evaluatedAt: CREATED_AT,
  });
  await expectError(
    () =>
      executeApprovedIntelligencePublishing({
        approvedExecutionBundle: approvalRequiredBundle,
        registrySnapshot: snapshot,
        now: () => EXECUTION_NOW,
      }),
    "gate_decision_not_allowed",
  );

  await expectError(
    () =>
      executeApprovedIntelligencePublishing({
        approvedExecutionBundle: subset.approvedExecutionBundle,
        registrySnapshot: snapshot,
        now: () => EXECUTION_NOW,
      }),
    "missing_approval_verification",
  );

  const injectedCandidateBundle = {
    ...subset.approvedExecutionBundle,
    orchestratorInput: subset.approvedExecutionBundle.orchestratorInput == null
      ? null
      : {
          ...subset.approvedExecutionBundle.orchestratorInput,
          candidates: Object.freeze([
            ...subset.approvedExecutionBundle.orchestratorInput.candidates,
            fullPreview.candidates[2]!,
          ]),
        },
  };
  await expectError(
    () =>
      executeApprovedIntelligencePublishing({
        approvedExecutionBundle: injectedCandidateBundle,
        registrySnapshot: snapshot,
        now: () => EXECUTION_NOW,
        approvalVerification: APPROVAL_VERIFICATION,
      }),
    "invalid_approved_execution_bundle",
  );

  const tamperedFingerprint = {
    ...subset.approvedExecutionBundle,
    approvedExecutionBundleFingerprint:
      "ipp_approved_execution_bundle_tampered",
  };
  await expectError(
    () =>
      executeApprovedIntelligencePublishing({
        approvedExecutionBundle: tamperedFingerprint,
        registrySnapshot: snapshot,
        now: () => EXECUTION_NOW,
        approvalVerification: APPROVAL_VERIFICATION,
      }),
    "invalid_approved_execution_bundle",
  );

  const falsifiedBundle = {
    ...subset.approvedExecutionBundle,
    gateDecision: {
      ...subset.approvedExecutionBundle.gateDecision,
      decision: "blocked" as const,
    },
  };
  await expectError(
    () =>
      executeApprovedIntelligencePublishing({
        approvedExecutionBundle: falsifiedBundle,
        registrySnapshot: snapshot,
        now: () => EXECUTION_NOW,
        approvalVerification: APPROVAL_VERIFICATION,
      }),
    "invalid_approved_execution_bundle",
  );

  assertSourceStructure();
  console.log("PASS — Approved orchestrator smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

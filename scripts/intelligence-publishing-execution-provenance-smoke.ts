import assert from "node:assert/strict";

import {
  buildIntelligencePublishingApprovedExecutionBundle,
} from "../lib/intelligencePublishing/approvedExecution";
import {
  issueIntelligencePublishingApprovalGrant,
} from "../lib/intelligencePublishing/approvalGrant";
import {
  buildIntelligencePublishingApprovalPreparationBundle,
} from "../lib/intelligencePublishing/approvalPreparation";
import {
  executeApprovedIntelligencePublishing,
} from "../lib/intelligencePublishing/approvedOrchestrator";
import {
  buildIntelligencePublishingExecutionProvenance,
  validateIntelligencePublishingExecutionProvenance,
} from "../lib/intelligencePublishing/executionProvenance";
import {
  buildIntelligencePublishingPublicationPlan,
} from "../lib/intelligencePublishing/campaignPlanning";
import type { MarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import { parseMarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
} from "../lib/intelligencePublishing/registryPopulation";
import type { RegistrySnapshot } from "../lib/intelligencePublishing/registryAdapter";

const GENERATED_AT = "2026-07-22T12:00:00.000Z";
const PLAN_CREATED_AT = "2026-07-22T12:15:00.000Z";
const APPROVED_AT = "2026-07-22T12:20:00.000Z";
const EXECUTION_STARTED_AT = "2026-07-22T12:30:00.000Z";
const EXECUTION_FINISHED_AT = "2026-07-22T12:30:05.250Z";
const GRANT_EXPIRES_AT = "2026-07-22T12:45:00.000Z";
const GRANT_SECRET = "norixo-execution-provenance-secret";
const APPROVAL_VERIFICATION = Object.freeze({
  secret: GRANT_SECRET,
  now: PLAN_CREATED_AT,
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
      source: "execution_provenance_smoke",
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

function buildBaseDefinitions(): readonly MarketReportDefinition[] {
  return [
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
  ] as const;
}

function buildSnapshot(
  definitions: readonly MarketReportDefinition[] = buildBaseDefinitions(),
): RegistrySnapshot {
  return withCanonicalPaths(buildRegistrySnapshot(definitions));
}

async function buildContext(input?: Readonly<{
  snapshot?: RegistrySnapshot;
  campaignKey?: string;
  requestedAction?: "generate" | "publish" | "refresh";
  approvalGrantIssuedAt?: string;
  executionStartedAt?: string;
  executionFinishedAt?: string;
}>) {
  const snapshot = input?.snapshot ?? buildSnapshot();
  const requestedAction = input?.requestedAction ?? "publish";
  const campaignKey = input?.campaignKey ?? "execution-provenance-smoke";
  const approvalGrantIssuedAt = input?.approvalGrantIssuedAt ?? APPROVED_AT;
  const executionStartedAt = input?.executionStartedAt ?? EXECUTION_STARTED_AT;
  const executionFinishedAt = input?.executionFinishedAt ?? EXECUTION_FINISHED_AT;

  const publicationPlan = buildIntelligencePublishingPublicationPlan({
    registrySnapshot: snapshot,
    specification: {
      schemaVersion: "ipp_campaign_specification_v1",
      campaignVersion: "ipp_campaign_contract_v1",
      campaignKey,
      name: "Execution Provenance Smoke",
      requestedAction,
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
    },
    createdAt: PLAN_CREATED_AT,
  });

  const approvalPreparationBundle =
    buildIntelligencePublishingApprovalPreparationBundle({
      publicationPlan,
      registrySnapshot: snapshot,
      requestedAction,
      executionMode: "execute",
      gatePolicy: {
        approvalRequired: true,
        maxExecuteBatchSize: 10,
        allowlistReportKeys: null,
      },
      createdAt: PLAN_CREATED_AT,
    });

  const approvalGrant = issueIntelligencePublishingApprovalGrant({
    approvalRequest: approvalPreparationBundle.executionApprovalRequest,
    issuer: "norixo-approver",
    issuedAt: approvalGrantIssuedAt,
    expiresAt: GRANT_EXPIRES_AT,
    secret: GRANT_SECRET,
    maxGrantLifetimeSeconds: 1800,
  });

  const approvedExecutionBundle =
    buildIntelligencePublishingApprovedExecutionBundle({
      approvalPreparationBundle,
      approvalGrant,
      createdAt: APPROVED_AT,
      evaluatedAt: APPROVED_AT,
      approvalVerification: APPROVAL_VERIFICATION,
    });

  const orchestrationResult = await executeApprovedIntelligencePublishing({
    approvedExecutionBundle,
    registrySnapshot: snapshot,
    now: () => executionFinishedAt,
    approvalVerification: {
      secret: GRANT_SECRET,
      now: executionFinishedAt,
      maxGrantLifetimeSeconds: 1800,
    },
    executeItem: async () => ({
      status: "succeeded",
      retryable: false,
      metadata: {
        synthetic: true,
      },
    }),
  });

  const provenance = buildIntelligencePublishingExecutionProvenance({
    approvedExecutionBundle,
    orchestrationResult,
    executionStartedAt,
    executionFinishedAt,
  });

  return {
    snapshot,
    publicationPlan,
    approvalPreparationBundle,
    approvalGrant,
    approvedExecutionBundle,
    orchestrationResult,
    provenance,
    executionStartedAt,
    executionFinishedAt,
  };
}

function assertNoPrivateKeys(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes("userId"), false);
  assert.equal(serialized.includes("workspaceId"), false);
  assert.equal(serialized.includes("listingUrl"), false);
  assert.equal(serialized.includes("rawPayload"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("token"), false);
}

function expectFailure(fn: () => unknown, fragment: string): void {
  try {
    fn();
    throw new Error(`Expected failure containing ${fragment}.`);
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.match(error.message, new RegExp(fragment));
  }
}

async function main() {
  const base = await buildContext();
  const baseValidation = validateIntelligencePublishingExecutionProvenance(
    base.provenance,
  );
  assert.equal(baseValidation.ok, true);
  assert.equal(base.provenance.candidateCount, 2);
  assert.deepEqual(base.provenance.reportKeys, [
    "airbnb-market-report-barcelona-apartment",
    "airbnb-market-report-paris-apartment",
  ]);
  assert.deepEqual(base.provenance.requestedActions, ["publish"]);
  assert.equal(base.provenance.executionDurationMs, 5250);
  assertNoPrivateKeys(base.provenance);

  const sameChainDifferentCreatedAt = buildIntelligencePublishingExecutionProvenance({
    approvedExecutionBundle: base.approvedExecutionBundle,
    orchestrationResult: base.orchestrationResult,
    executionStartedAt: base.executionStartedAt,
    executionFinishedAt: base.executionFinishedAt,
    createdAt: "2026-07-22T13:00:00.000Z",
  });
  assert.equal(
    base.provenance.provenanceFingerprint,
    sameChainDifferentCreatedAt.provenanceFingerprint,
  );
  assert.notEqual(base.provenance.createdAt, sameChainDifferentCreatedAt.createdAt);

  expectFailure(
    () =>
      buildIntelligencePublishingExecutionProvenance({
        approvedExecutionBundle: base.approvedExecutionBundle,
        orchestrationResult: {
          ...base.orchestrationResult,
          resultFingerprint: "ipp_batch_result_tampered",
        },
        executionStartedAt: base.executionStartedAt,
        executionFinishedAt: base.executionFinishedAt,
      }),
    "orchestrationResult validation failed",
  );

  const differentGrant = await buildContext({
    approvalGrantIssuedAt: "2026-07-22T12:21:00.000Z",
  });
  assert.notEqual(
    base.provenance.approvalGrantFingerprint,
    differentGrant.provenance.approvalGrantFingerprint,
  );
  assert.notEqual(
    base.provenance.provenanceFingerprint,
    differentGrant.provenance.provenanceFingerprint,
  );

  const differentPublicationPlan = await buildContext({
    campaignKey: "execution-provenance-smoke-variant",
  });
  assert.notEqual(
    base.provenance.publicationPlanFingerprint,
    differentPublicationPlan.provenance.publicationPlanFingerprint,
  );
  assert.notEqual(
    base.provenance.provenanceFingerprint,
    differentPublicationPlan.provenance.provenanceFingerprint,
  );

  const expandedSnapshot = buildSnapshot([
    ...buildBaseDefinitions(),
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
  ]);
  const differentRegistry = await buildContext({
    snapshot: expandedSnapshot,
  });
  assert.notEqual(
    base.provenance.registryFingerprint,
    differentRegistry.provenance.registryFingerprint,
  );
  assert.notEqual(base.provenance.candidateCount, differentRegistry.provenance.candidateCount);
  assert.notEqual(
    base.provenance.provenanceFingerprint,
    differentRegistry.provenance.provenanceFingerprint,
  );

  const differentReportKeys = await buildContext({
    snapshot: buildSnapshot([
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
      buildDefinition({
        reportId: "report_rome_airbnb_villa_en",
        marketCellKey: "it:rome:airbnb:villa",
        city: "Rome",
        country: "it",
        platform: "airbnb",
        propertyType: "villa",
        language: "en",
        slug: "airbnb-market-report-rome-villa",
        benchmarkFingerprint: "pricing_fp_rome_airbnb_villa",
        overviewFingerprint: "overview_fp_rome_airbnb_villa",
      }),
    ]),
  });
  assert.notDeepEqual(base.provenance.reportKeys, differentReportKeys.provenance.reportKeys);
  assert.notEqual(
    base.provenance.provenanceFingerprint,
    differentReportKeys.provenance.provenanceFingerprint,
  );

  const differentRequestedActions = await buildContext({
    requestedAction: "refresh",
  });
  assert.deepEqual(differentRequestedActions.provenance.requestedActions, ["refresh"]);
  assert.notDeepEqual(
    base.provenance.requestedActions,
    differentRequestedActions.provenance.requestedActions,
  );
  assert.notEqual(
    base.provenance.provenanceFingerprint,
    differentRequestedActions.provenance.provenanceFingerprint,
  );

  const differentTiming = buildIntelligencePublishingExecutionProvenance({
    approvedExecutionBundle: base.approvedExecutionBundle,
    orchestrationResult: base.orchestrationResult,
    executionStartedAt: "2026-07-22T12:30:00.000Z",
    executionFinishedAt: "2026-07-22T12:30:06.250Z",
  });
  assert.equal(differentTiming.executionDurationMs, 6250);
  assert.notEqual(
    base.provenance.provenanceFingerprint,
    differentTiming.provenanceFingerprint,
  );

  console.log("PASS — Intelligence publishing execution provenance smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

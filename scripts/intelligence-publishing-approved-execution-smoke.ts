import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildIntelligencePublishingApprovedExecutionBundle,
  validateIntelligencePublishingApprovedExecutionBundle,
  type IntelligencePublishingApprovedExecutionError,
} from "../lib/intelligencePublishing/approvedExecution";
import {
  issueIntelligencePublishingApprovalGrant,
  validateIntelligencePublishingApprovalGrant,
} from "../lib/intelligencePublishing/approvalGrant";
import {
  buildIntelligencePublishingApprovalPreparationBundle,
} from "../lib/intelligencePublishing/approvalPreparation";
import { evaluateIntelligencePublishingExecutionGate } from "../lib/intelligencePublishing/executionGate";
import type { MarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import { parseMarketReportDefinition } from "../lib/intelligencePublishing/marketReportPilot";
import {
  buildIntelligencePublishingPublicationPlan,
} from "../lib/intelligencePublishing/campaignPlanning";
import {
  applyRegistryPopulationPlan,
  buildRegistryPopulationPlan,
} from "../lib/intelligencePublishing/registryPopulation";
import type { RegistrySnapshot } from "../lib/intelligencePublishing/registryAdapter";

const GENERATED_AT = "2026-07-22T10:00:00.000Z";
const CREATED_AT = "2026-07-22T10:30:00.000Z";
const EVALUATED_AT = "2026-07-22T10:45:00.000Z";
const LATER_EVALUATED_AT = "2026-07-22T10:50:00.000Z";
const EXPIRED_AT = "2026-07-22T11:10:00.000Z";
const GRANT_SECRET = "norixo-approved-execution-secret";
const GRANT_VERIFICATION = Object.freeze({
  secret: GRANT_SECRET,
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
      source: "approved_execution_smoke",
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
    ]),
  );
}

function buildBundle(snapshot: RegistrySnapshot) {
  const publicationPlan = buildIntelligencePublishingPublicationPlan({
    registrySnapshot: snapshot,
    specification: {
      schemaVersion: "ipp_campaign_specification_v1",
      campaignVersion: "ipp_campaign_contract_v1",
      campaignKey: "approved-execution-smoke",
      name: "Approved Execution Smoke",
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
    },
    createdAt: CREATED_AT,
  });

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
    expiresAt: "2026-07-22T10:55:00.000Z",
    secret: GRANT_SECRET,
    maxGrantLifetimeSeconds: 1800,
  });
}

function expectErrorCode(
  fn: () => unknown,
  code: string,
): IntelligencePublishingApprovedExecutionError {
  try {
    fn();
    throw new Error(`Expected error code ${code}.`);
  } catch (error) {
    assert.ok(error instanceof Error);
    const typedError = error as IntelligencePublishingApprovedExecutionError;
    assert.equal(typedError.code, code);
    return typedError;
  }
}

function assertNoPrivateKeys(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes("userId"), false);
  assert.equal(serialized.includes("workspaceId"), false);
  assert.equal(serialized.includes("listingUrl"), false);
  assert.equal(serialized.includes("rawPayload"), false);
}

function assertNoExecutionImports(): void {
  const source = fs.readFileSync(
    "lib/intelligencePublishing/approvedExecution.ts",
    "utf8",
  );
  assert.equal(source.includes("./orchestrator"), false);
  assert.equal(source.includes("executeRegistrySnapshotBatch"), false);
  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("supabase"), false);
}

async function main() {
  const snapshot = buildSnapshot();
  const bundle = buildBundle(snapshot);
  const grant = buildGrant(bundle);

  assert.equal(validateIntelligencePublishingApprovalGrant(grant).ok, true);

  const allowed = buildIntelligencePublishingApprovedExecutionBundle({
    approvalPreparationBundle: bundle,
    approvalGrant: grant,
    createdAt: EVALUATED_AT,
    evaluatedAt: EVALUATED_AT,
    approvalVerification: GRANT_VERIFICATION,
  });
  assert.equal(allowed.gateDecision.decision, "allowed");
  assert.notEqual(allowed.orchestratorInput, null);
  assert.equal(
    allowed.executionRequestFingerprint,
    bundle.executionRequest.executionRequestFingerprint,
  );
  assert.equal(
    validateIntelligencePublishingApprovedExecutionBundle(allowed).ok,
    true,
  );

  const stable = buildIntelligencePublishingApprovedExecutionBundle({
    approvalPreparationBundle: bundle,
    approvalGrant: grant,
    createdAt: LATER_EVALUATED_AT,
    evaluatedAt: LATER_EVALUATED_AT,
    approvalVerification: GRANT_VERIFICATION,
  });
  assert.equal(
    allowed.approvedExecutionBundleFingerprint,
    stable.approvedExecutionBundleFingerprint,
  );
  assert.equal(
    allowed.orchestratorInput?.orchestratorInputFingerprint,
    stable.orchestratorInput?.orchestratorInputFingerprint,
  );

  const approvalRequired = buildIntelligencePublishingApprovedExecutionBundle({
    approvalPreparationBundle: bundle,
    createdAt: EVALUATED_AT,
    evaluatedAt: EVALUATED_AT,
    approvalVerification: GRANT_VERIFICATION,
  });
  assert.equal(approvalRequired.gateDecision.decision, "approval_required");
  assert.equal(approvalRequired.orchestratorInput, null);

  const readOnly = buildIntelligencePublishingApprovedExecutionBundle({
    approvalPreparationBundle: bundle,
    approvalGrant: grant,
    createdAt: EVALUATED_AT,
    evaluatedAt: EVALUATED_AT,
    gateConfig: {
      readOnly: true,
    },
    approvalVerification: GRANT_VERIFICATION,
  });
  assert.equal(readOnly.gateDecision.decision, "blocked");
  assert.deepEqual(readOnly.gateDecision.reasonCodes, ["read_only_mode"]);
  assert.equal(readOnly.orchestratorInput, null);

  const killSwitch = buildIntelligencePublishingApprovedExecutionBundle({
    approvalPreparationBundle: bundle,
    approvalGrant: grant,
    createdAt: EVALUATED_AT,
    evaluatedAt: EVALUATED_AT,
    gateConfig: {
      killSwitchEnabled: true,
    },
    approvalVerification: GRANT_VERIFICATION,
  });
  assert.equal(killSwitch.gateDecision.decision, "blocked");
  assert.deepEqual(killSwitch.gateDecision.reasonCodes, ["kill_switch_enabled"]);
  assert.equal(killSwitch.orchestratorInput, null);

  const invalidGrant = expectErrorCode(
    () =>
      buildIntelligencePublishingApprovedExecutionBundle({
        approvalPreparationBundle: bundle,
        approvalGrant: {
          ...grant,
          signature: "not-hex",
        },
        createdAt: EVALUATED_AT,
        evaluatedAt: EVALUATED_AT,
        approvalVerification: GRANT_VERIFICATION,
      }),
    "invalid_approval_grant",
  );
  assert.match(invalidGrant.message, /Approval grant .*failed/i);

  const invalidBundle = expectErrorCode(
    () =>
      buildIntelligencePublishingApprovedExecutionBundle({
        approvalPreparationBundle: {
          ...bundle,
          executionRequest: {
            ...bundle.executionRequest,
            candidateCount: bundle.executionRequest.candidateCount + 1,
          },
        },
        approvalGrant: grant,
        createdAt: EVALUATED_AT,
        evaluatedAt: EVALUATED_AT,
        approvalVerification: GRANT_VERIFICATION,
      }),
    "invalid_approval_preparation_bundle",
  );
  assert.match(invalidBundle.message, /Approval preparation bundle .*failed/i);

  const gateMismatch = expectErrorCode(
    () =>
      buildIntelligencePublishingApprovedExecutionBundle({
        approvalPreparationBundle: bundle,
        approvalGrant: grant,
        createdAt: EVALUATED_AT,
        evaluatedAt: EVALUATED_AT,
        gateConfig: {
          approvalRequired: false,
        },
        approvalVerification: GRANT_VERIFICATION,
      }),
    "gate_policy_fingerprint_mismatch",
  );
  assert.ok(gateMismatch.message.includes("gate policy fingerprint"));

  const wrongSecret = buildIntelligencePublishingApprovedExecutionBundle({
    approvalPreparationBundle: bundle,
    approvalGrant: grant,
    createdAt: EVALUATED_AT,
    evaluatedAt: EVALUATED_AT,
    approvalVerification: {
      secret: "wrong-secret-wrong-secret",
    },
  });
  assert.equal(wrongSecret.gateDecision.decision, "blocked");
  assert.deepEqual(wrongSecret.gateDecision.reasonCodes, [
    "approval_grant_signature_invalid",
  ]);
  assert.equal(wrongSecret.orchestratorInput, null);

  const expired = buildIntelligencePublishingApprovedExecutionBundle({
    approvalPreparationBundle: bundle,
    approvalGrant: grant,
    createdAt: EXPIRED_AT,
    evaluatedAt: EXPIRED_AT,
    approvalVerification: GRANT_VERIFICATION,
  });
  assert.equal(expired.gateDecision.decision, "blocked");
  assert.deepEqual(expired.gateDecision.reasonCodes, ["approval_grant_expired"]);

  const dryRunGate = evaluateIntelligencePublishingExecutionGate({
    mode: "dry_run",
    evaluatedAt: EVALUATED_AT,
    candidates: bundle.executionRequest.candidates,
  });
  assert.equal(dryRunGate.decision, "allowed");
  assert.deepEqual(dryRunGate.reasonCodes, ["dry_run_allowed"]);

  const noExecuteDryRunPath = expectErrorCode(
    () =>
      buildIntelligencePublishingApprovedExecutionBundle({
        approvalPreparationBundle: {
          ...bundle,
          executionMode: "dry_run",
        },
        approvalGrant: grant,
        createdAt: EVALUATED_AT,
        evaluatedAt: EVALUATED_AT,
        approvalVerification: GRANT_VERIFICATION,
      }),
    "invalid_approval_preparation_bundle",
  );
  assert.ok(noExecuteDryRunPath.message.includes("validation failed"));

  assertNoPrivateKeys(allowed);
  assertNoExecutionImports();

  console.log("PASS — Intelligence publishing approved execution smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

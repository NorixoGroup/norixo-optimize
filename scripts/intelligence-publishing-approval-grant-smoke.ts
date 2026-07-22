import assert from "node:assert/strict";

import type { IntelligencePublishingBatchCandidate } from "../lib/intelligencePublishing/batchPlanning";
import {
  buildIntelligencePublishingExecutionApprovalRequest,
  issueIntelligencePublishingApprovalGrant,
  validateIntelligencePublishingApprovalGrant,
  validateIntelligencePublishingExecutionApprovalRequest,
  verifyIntelligencePublishingApprovalGrant,
} from "../lib/intelligencePublishing/approvalGrant";
import { evaluateIntelligencePublishingExecutionGate } from "../lib/intelligencePublishing/executionGate";
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
import type { RegistrySnapshot } from "../lib/intelligencePublishing/registryAdapter";

const SECRET = "norixo-approval-secret-2026";
const WRONG_SECRET = "norixo-wrong-secret-2026";
const ISSUED_AT = "2026-07-22T10:00:00.000Z";
const EXPIRES_AT = "2026-07-22T10:10:00.000Z";
const EVALUATED_AT = "2026-07-22T10:05:00.000Z";
const GENERATED_AT = "2026-07-22T10:00:00.000Z";

function buildCandidate(
  overrides: Partial<IntelligencePublishingBatchCandidate> & {
    candidateId: string;
    reportKey: string;
    locale: string;
    country: string;
    city: string;
    platform: string;
    propertyType: string;
  },
): IntelligencePublishingBatchCandidate {
  return {
    requestedAction: "publish",
    priority: 100,
    sourceFingerprint: "source_fp_default",
    ...overrides,
  };
}

function buildBaseCandidates(): readonly IntelligencePublishingBatchCandidate[] {
  return Object.freeze([
    buildCandidate({
      candidateId: "cand_paris_en",
      reportKey: "airbnb-market-report-paris-apartment",
      locale: "en",
      country: "fr",
      city: "paris",
      platform: "airbnb",
      propertyType: "apartment",
    }),
    buildCandidate({
      candidateId: "cand_barcelona_fr",
      reportKey: "airbnb-market-report-barcelona-apartment",
      locale: "fr",
      country: "es",
      city: "barcelona",
      platform: "airbnb",
      propertyType: "apartment",
    }),
  ]);
}

function buildApprovalRequest(
  candidates: readonly IntelligencePublishingBatchCandidate[],
  overrides?: Partial<{
    registryFingerprint: string;
    approvalRequired: boolean;
    maxExecuteBatchSize: number | null;
    allowlistReportKeys: readonly string[] | null;
  }>,
) {
  return buildIntelligencePublishingExecutionApprovalRequest({
    registryFingerprint: overrides?.registryFingerprint ?? "registry_fp_alpha",
    mode: "execute",
    candidates,
    gatePolicy: {
      approvalRequired: overrides?.approvalRequired ?? true,
      maxExecuteBatchSize: overrides?.maxExecuteBatchSize ?? null,
      allowlistReportKeys: overrides?.allowlistReportKeys ?? null,
    },
  });
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
      source: "approval_grant_smoke",
    },
    ...overrides,
  });
}

function buildRegistrySnapshot(definitions: readonly MarketReportDefinition[]): RegistrySnapshot {
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

function buildOrchestratorSnapshot(): RegistrySnapshot {
  return buildRegistrySnapshot([
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
}

function assertNoSecretSerialized(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(SECRET), false);
  assert.equal(serialized.includes(WRONG_SECRET), false);
}

function expectThrow(fn: () => unknown, pattern: RegExp): void {
  let thrown = false;
  try {
    fn();
  } catch (error) {
    thrown = true;
    assert.match(error instanceof Error ? error.message : String(error), pattern);
  }
  assert.equal(thrown, true);
}

async function main() {
  const baseCandidates = buildBaseCandidates();

  const request = buildApprovalRequest(baseCandidates);
  assert.equal(validateIntelligencePublishingExecutionApprovalRequest(request).ok, true);
  assert.equal(request.mode, "execute");
  assert.equal(request.candidateCount, 2);
  assert.equal(request.reportKeys.length, 2);
  assert.equal(request.requestedActions.length, 1);

  const reversedRequest = buildApprovalRequest([...baseCandidates].reverse());
  assert.equal(request.requestFingerprint, reversedRequest.requestFingerprint);
  assert.equal(request.candidatesFingerprint, reversedRequest.candidatesFingerprint);

  const registryChanged = buildApprovalRequest(baseCandidates, {
    registryFingerprint: "registry_fp_beta",
  });
  assert.notEqual(request.requestFingerprint, registryChanged.requestFingerprint);

  const reportAdded = buildApprovalRequest([
    ...baseCandidates,
    buildCandidate({
      candidateId: "cand_marrakech_en",
      reportKey: "airbnb-market-report-marrakech-riad",
      locale: "en",
      country: "ma",
      city: "marrakech",
      platform: "airbnb",
      propertyType: "riad",
    }),
  ]);
  assert.notEqual(request.requestFingerprint, reportAdded.requestFingerprint);

  const actionModified = buildApprovalRequest([
    {
      ...baseCandidates[0]!,
      requestedAction: "refresh",
    },
    baseCandidates[1]!,
  ]);
  assert.notEqual(request.requestFingerprint, actionModified.requestFingerprint);

  const localeModified = buildApprovalRequest([
    {
      ...baseCandidates[0]!,
      locale: "de",
    },
    baseCandidates[1]!,
  ]);
  assert.notEqual(request.requestFingerprint, localeModified.requestFingerprint);

  const grant = issueIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    issuer: "norixo.release.control",
    issuedAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    secret: SECRET,
    metadata: {
      channel: "manual_release",
    },
  });
  assert.equal(validateIntelligencePublishingApprovalGrant(grant).ok, true);
  assert.equal(typeof grant.signature, "string");
  assert.equal(grant.signature.length > 0, true);

  const stableGrant = issueIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    issuer: "norixo.release.control",
    issuedAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    secret: SECRET,
    metadata: {
      channel: "manual_release",
    },
  });
  assert.equal(grant.grantId, stableGrant.grantId);

  const verified = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: grant,
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.reasonCode, "approval_grant_verified");

  const wrongSecret = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: grant,
    options: {
      secret: WRONG_SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(wrongSecret.ok, false);
  assert.equal(wrongSecret.reasonCode, "approval_grant_signature_invalid");

  const payloadModified = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: {
      ...grant,
      issuer: "tampered.issuer",
    },
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(payloadModified.ok, false);
  assert.equal(payloadModified.reasonCode, "approval_grant_id_mismatch");

  const signatureModified = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: {
      ...grant,
      signature: `${grant.signature.slice(0, -1)}0`,
    },
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(signatureModified.ok, false);
  assert.equal(signatureModified.reasonCode, "approval_grant_signature_invalid");

  const expired = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: grant,
    options: {
      secret: SECRET,
      now: "2026-07-22T10:20:01.000Z",
    },
  });
  assert.equal(expired.ok, false);
  assert.equal(expired.reasonCode, "approval_grant_expired");

  const futureGrant = issueIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    issuer: "norixo.release.control",
    issuedAt: "2026-07-22T10:20:00.000Z",
    expiresAt: "2026-07-22T10:25:00.000Z",
    secret: SECRET,
  });
  const notYetValid = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: futureGrant,
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(notYetValid.ok, false);
  assert.equal(notYetValid.reasonCode, "approval_grant_not_yet_valid");

  expectThrow(
    () =>
      issueIntelligencePublishingApprovalGrant({
        approvalRequest: request,
        issuer: "norixo.release.control",
        issuedAt: ISSUED_AT,
        expiresAt: "2026-07-22T11:00:01.000Z",
        secret: SECRET,
      }),
    /maximum/i,
  );

  const invalidDates = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: {
      ...grant,
      issuedAt: "not-a-date",
    },
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(invalidDates.ok, false);
  assert.equal(invalidDates.reasonCode, "approval_grant_invalid");

  const unknownSchema = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: {
      ...grant,
      schemaVersion: "ipp_approval_grant_v999",
    },
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(unknownSchema.ok, false);
  assert.equal(unknownSchema.reasonCode, "approval_grant_schema_unsupported");

  const unknownVersion = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: {
      ...grant,
      grantVersion: "ipp_approval_grant_contract_v999",
    },
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(unknownVersion.ok, false);
  assert.equal(unknownVersion.reasonCode, "approval_grant_version_unsupported");

  const unknownAlgorithm = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: {
      ...grant,
      signatureAlgorithm: "rsa_sha256" as never,
    },
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(unknownAlgorithm.ok, false);
  assert.equal(unknownAlgorithm.reasonCode, "approval_grant_algorithm_unsupported");

  const falsifiedGrantId = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: {
      ...grant,
      grantId: `${grant.grantId}_tampered`,
    },
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(falsifiedGrantId.ok, false);
  assert.equal(falsifiedGrantId.reasonCode, "approval_grant_id_mismatch");

  const registryMismatch = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: registryChanged,
    approvalGrant: grant,
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(registryMismatch.ok, false);
  assert.equal(registryMismatch.reasonCode, "approval_grant_registry_mismatch");

  const requestMismatch = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: localeModified,
    approvalGrant: grant,
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(requestMismatch.ok, false);
  assert.equal(requestMismatch.reasonCode, "approval_grant_request_mismatch");

  const modeMismatch = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: {
      ...grant,
      mode: "dry_run" as never,
    },
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(modeMismatch.ok, false);
  assert.equal(modeMismatch.reasonCode, "approval_grant_scope_mismatch");

  const actionOutOfScope = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: actionModified,
    approvalGrant: grant,
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(actionOutOfScope.ok, false);
  assert.equal(actionOutOfScope.reasonCode, "approval_grant_action_not_allowed");

  const reportOutOfScopeRequest = buildApprovalRequest([
    buildCandidate({
      candidateId: "cand_london_en",
      reportKey: "airbnb-market-report-london-apartment",
      locale: "en",
      country: "uk",
      city: "london",
      platform: "airbnb",
      propertyType: "apartment",
    }),
    baseCandidates[1]!,
  ]);
  const reportOutOfScope = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: reportOutOfScopeRequest,
    approvalGrant: grant,
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(reportOutOfScope.ok, false);
  assert.equal(reportOutOfScope.reasonCode, "approval_grant_report_not_allowed");

  const threeCandidateRequest = buildApprovalRequest([
    ...baseCandidates,
    buildCandidate({
      candidateId: "cand_paris_de",
      reportKey: "airbnb-market-report-paris-apartment",
      locale: "de",
      country: "fr",
      city: "paris",
      platform: "airbnb",
      propertyType: "apartment",
    }),
  ]);

  const grantWithLargerMax = issueIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    issuer: "norixo.release.control",
    issuedAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    secret: SECRET,
    maxApprovedBatchSize: 10,
  });
  const candidateCountMismatch = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: threeCandidateRequest,
    approvalGrant: grantWithLargerMax,
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(candidateCountMismatch.ok, false);
  assert.equal(
    candidateCountMismatch.reasonCode,
    "approval_grant_candidate_count_mismatch",
  );

  const batchSizeExceeded = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: threeCandidateRequest,
    approvalGrant: grant,
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(batchSizeExceeded.ok, false);
  assert.equal(
    batchSizeExceeded.reasonCode,
    "approval_grant_batch_size_exceeded",
  );

  const approvalRequiredNoGrant = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    config: {
      approvalRequired: true,
    },
    approvalRequest: request,
  });
  assert.equal(approvalRequiredNoGrant.decision, "approval_required");
  assert.deepEqual(approvalRequiredNoGrant.reasonCodes, ["approval_grant_missing"]);

  const approvalRequiredValidGrant = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    config: {
      approvalRequired: true,
    },
    approvalRequest: request,
    approvalGrant: grant,
    approvalVerification: {
      secret: SECRET,
    },
  });
  assert.equal(approvalRequiredValidGrant.decision, "allowed");
  assert.deepEqual(approvalRequiredValidGrant.reasonCodes, ["approval_grant_verified"]);

  const approvalRequiredInvalidGrant = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    config: {
      approvalRequired: true,
    },
    approvalRequest: request,
    approvalGrant: {
      ...grant,
      signature: `${grant.signature.slice(0, -1)}0`,
    },
    approvalVerification: {
      secret: SECRET,
    },
  });
  assert.equal(approvalRequiredInvalidGrant.decision, "blocked");
  assert.deepEqual(
    approvalRequiredInvalidGrant.reasonCodes,
    ["approval_grant_signature_invalid"],
  );

  const killSwitchWithGrant = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    config: {
      approvalRequired: true,
      killSwitchEnabled: true,
    },
    approvalRequest: request,
    approvalGrant: grant,
    approvalVerification: {
      secret: SECRET,
    },
  });
  assert.equal(killSwitchWithGrant.decision, "blocked");
  assert.deepEqual(killSwitchWithGrant.reasonCodes, ["kill_switch_enabled"]);

  const executionDisabledWithGrant = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    config: {
      approvalRequired: true,
      executionEnabled: false,
    },
    approvalRequest: request,
    approvalGrant: grant,
    approvalVerification: {
      secret: SECRET,
    },
  });
  assert.equal(executionDisabledWithGrant.decision, "blocked");
  assert.deepEqual(executionDisabledWithGrant.reasonCodes, ["execution_disabled"]);

  const readOnlyWithGrant = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    config: {
      approvalRequired: true,
      readOnly: true,
    },
    approvalRequest: request,
    approvalGrant: grant,
    approvalVerification: {
      secret: SECRET,
    },
  });
  assert.equal(readOnlyWithGrant.decision, "blocked");
  assert.deepEqual(readOnlyWithGrant.reasonCodes, ["read_only_mode"]);

  const allowlistBlockingWithGrant = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    config: {
      approvalRequired: true,
      allowlistReportKeys: ["airbnb-market-report-paris-apartment"],
    },
    approvalRequest: request,
    approvalGrant: grant,
    approvalVerification: {
      secret: SECRET,
    },
  });
  assert.equal(allowlistBlockingWithGrant.decision, "blocked");
  assert.deepEqual(allowlistBlockingWithGrant.reasonCodes, ["allowlist_blocked"]);

  const batchTooLargeWithGrant = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    config: {
      approvalRequired: true,
      maxExecuteBatchSize: 1,
    },
    approvalRequest: request,
    approvalGrant: grant,
    approvalVerification: {
      secret: SECRET,
    },
  });
  assert.equal(batchTooLargeWithGrant.decision, "blocked");
  assert.deepEqual(batchTooLargeWithGrant.reasonCodes, ["batch_size_exceeded"]);

  const executeNoApprovalRequirement = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    config: {
      approvalRequired: false,
    },
    approvalRequest: request,
  });
  assert.equal(executeNoApprovalRequirement.decision, "allowed");
  assert.deepEqual(executeNoApprovalRequirement.reasonCodes, ["execute_allowed"]);

  const dryRunAllowed = evaluateIntelligencePublishingExecutionGate({
    mode: "dry_run",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
  });
  assert.equal(dryRunAllowed.decision, "allowed");
  assert.deepEqual(dryRunAllowed.reasonCodes, ["dry_run_allowed"]);

  const dryRunWithGrant = evaluateIntelligencePublishingExecutionGate({
    mode: "dry_run",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    approvalGrant: grant,
  });
  assert.equal(dryRunWithGrant.decision, "allowed");
  assert.equal(dryRunWithGrant.warnings.length > 0, true);

  expectThrow(
    () =>
      validateIntelligencePublishingExecutionApprovalRequest({
        ...request,
        email: "private@example.com",
      }),
    /Forbidden private field/i,
  );

  expectThrow(
    () =>
      issueIntelligencePublishingApprovalGrant({
        approvalRequest: request,
        issuer: "norixo.release.control",
        issuedAt: ISSUED_AT,
        expiresAt: EXPIRES_AT,
        secret: SECRET,
        metadata: {
          email: "private@example.com",
        } as never,
      }),
    /Forbidden private field/i,
  );

  assertNoSecretSerialized(request);
  assertNoSecretSerialized(grant);

  const gateFingerprintA = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: EVALUATED_AT,
    candidates: baseCandidates,
    config: {
      approvalRequired: true,
    },
    approvalRequest: request,
  });
  const gateFingerprintB = evaluateIntelligencePublishingExecutionGate({
    mode: "execute",
    evaluatedAt: "2026-07-22T10:07:00.000Z",
    candidates: baseCandidates,
    config: {
      approvalRequired: true,
    },
    approvalRequest: request,
  });
  assert.equal(gateFingerprintA.fingerprint, gateFingerprintB.fingerprint);

  const orchestratorSnapshot = buildOrchestratorSnapshot();
  const orchestratorNoGrant = await orchestrateIntelligencePublishing({
    registrySnapshot: orchestratorSnapshot,
    mode: "execute",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
    gateConfig: {
      approvalRequired: true,
    },
  });
  assert.equal(orchestratorNoGrant.gateDecision.decision, "approval_required");
  assert.equal(orchestratorNoGrant.batchPlan, null);
  assert.equal(orchestratorNoGrant.batchResult, null);
  assert.equal(validateIntelligencePublishingOrchestrationResult(orchestratorNoGrant).ok, true);

  const orchestratorRequest = buildApprovalRequest(baseCandidates, {
    registryFingerprint: orchestratorNoGrant.registryFingerprint,
    approvalRequired: true,
  });
  const orchestratorGrant = issueIntelligencePublishingApprovalGrant({
    approvalRequest: orchestratorRequest,
    issuer: "norixo.release.control",
    issuedAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    secret: SECRET,
  });
  const orchestratorGranted = await orchestrateIntelligencePublishing({
    registrySnapshot: orchestratorSnapshot,
    mode: "execute",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
    gateConfig: {
      approvalRequired: true,
    },
    approvalGrant: orchestratorGrant,
    approvalVerification: {
      secret: SECRET,
    },
    executeItem: async () => ({
      status: "succeeded",
      retryable: false,
      metadata: {
        simulated: true,
      },
    }),
  });
  assert.equal(orchestratorGranted.gateDecision.decision, "allowed");
  assert.notEqual(orchestratorGranted.batchPlan, null);
  assert.notEqual(orchestratorGranted.batchResult, null);

  const orchestratorInvalidGrant = await orchestrateIntelligencePublishing({
    registrySnapshot: orchestratorSnapshot,
    mode: "execute",
    createdAt: GENERATED_AT,
    now: () => GENERATED_AT,
    gateConfig: {
      approvalRequired: true,
    },
    approvalGrant: {
      ...orchestratorGrant,
      signature: `${orchestratorGrant.signature.slice(0, -1)}0`,
    },
    approvalVerification: {
      secret: SECRET,
    },
  });
  assert.equal(orchestratorInvalidGrant.gateDecision.decision, "blocked");
  assert.equal(orchestratorInvalidGrant.batchPlan, null);
  assert.equal(orchestratorInvalidGrant.batchResult, null);

  const replayFirst = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: grant,
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  const replaySecond = verifyIntelligencePublishingApprovalGrant({
    approvalRequest: request,
    approvalGrant: grant,
    options: {
      secret: SECRET,
      now: EVALUATED_AT,
    },
  });
  assert.equal(replayFirst.ok, true);
  assert.equal(replaySecond.ok, true);

  assert.deepEqual(request.reportKeys, [
    "airbnb-market-report-barcelona-apartment",
    "airbnb-market-report-paris-apartment",
  ]);
  assert.deepEqual(request.requestedActions, ["publish"]);
  assert.equal(request.candidateCount, 2);
  assert.equal(request.requestFingerprint, reversedRequest.requestFingerprint);
  assert.equal(grant.executionRequestFingerprint, request.requestFingerprint);
  assert.notEqual(request.requestFingerprint, reportAdded.requestFingerprint);

  console.log("PASS — Intelligence publishing approval grant smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

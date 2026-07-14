import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  DEBUG_INTELLIGENCE_V2,
  getIntelligenceV2FeatureFlags,
  type IntelligenceV2FeatureFlagEnv,
} from "./featureFlags";
import {
  buildOpaqueFactKey,
  getIntelligenceFactIdentitySecret,
} from "./opaqueFactIdentity";
import {
  transformCandidateToAnonymousPricingFact,
  type AnonymousPricingFact,
  type AnonymousPricingFactCandidate,
  type IntelligenceV2PricingSourceClass,
} from "./pricingFact";
import { validateSharedIntelligencePrivacy } from "./privacyValidator";

export type AuthenticatedPricingFactSourceClass = Extract<
  IntelligenceV2PricingSourceClass,
  "authenticated_audit" | "authenticated_listing"
>;

export type IntelligencePricingCollectionMode = "live" | "memory_reuse";

export type PrivatePricingObservation = Readonly<{
  privateComparableSignature?: string | null;
  capturedAt: string;
  platform?: string | null;
  country?: string | null;
  city?: string | null;
  propertyType?: string | null;
  capacity?: number | null;
  guestCapacity?: number | null;
  currency?: string | null;
  nightlyPrice?: number | null;
  sourceKind?: "market_memory_seed" | "live_comparable" | null;
  comparableQuality?: "pricing_grade" | "contextual" | null;
  freshness?: "unknown" | "fresh" | "recent" | "aging" | "stale" | null;
}>;

export type AnonymousFactGroupInsertRow = Readonly<{
  fact_key: string;
  fact_contract_version: string;
  country: string;
  city: string;
  platform: AnonymousPricingFact["marketCell"]["platform"];
  property_type: AnonymousPricingFact["marketCell"]["propertyType"];
  capacity_band: AnonymousPricingFact["marketCell"]["capacityBand"];
  currency: string;
  market_cell_key: string;
  metric_family: AnonymousPricingFact["metricFamily"];
  normalized_nightly_price: number;
  price_band: AnonymousPricingFact["priceBand"];
  capture_period_bucket: string;
  source_class: AuthenticatedPricingFactSourceClass;
  confidence_input_band: AnonymousPricingFact["confidenceInputBand"];
  freshness_input_band: AnonymousPricingFact["freshnessInputBand"];
  source_quality_band: AnonymousPricingFact["sourceQualityBand"];
  transformation_policy_version: string;
  eligibility_policy_version: string;
  deduplication_policy_version: string;
  market_cell_policy_version: string;
  confidence_policy_version: string;
  freshness_policy_version: string;
  pricing_normalization_policy_version: string;
}>;

export type PricingFactWriterReasonCode =
  | "transformation_disabled"
  | "contribution_disabled"
  | "memory_reuse_skipped"
  | "missing_identity_secret"
  | "invalid_candidate"
  | "privacy_validation_failed"
  | "missing_private_signature"
  | "duplicate_in_batch"
  | "database_error";

export type PricingFactWriterStatus =
  | "disabled"
  | "transformed_only"
  | "success"
  | "failed"
  | "skipped";

export type PricingFactWriterDatabaseStatus =
  | "not_attempted"
  | "success"
  | "failed";

export type PricingFactWriterResult = Readonly<{
  status: PricingFactWriterStatus;
  received: number;
  accepted: number;
  rejected: number;
  deduplicatedInBatch: number;
  submitted: number;
  databaseStatus: PricingFactWriterDatabaseStatus;
  duplicatesDatabase: "not_attempted" | "unknown";
  reasonCodes: PricingFactWriterReasonCode[];
}>;

type UpsertFactsResult = Readonly<{ ok: true }> | Readonly<{ ok: false }>;

export type PricingFactWriterDependencies = Readonly<{
  env?: IntelligenceV2FeatureFlagEnv;
  upsertFacts?: (
    rows: ReadonlyArray<AnonymousFactGroupInsertRow>,
  ) => Promise<UpsertFactsResult>;
}>;

export type WriteAnonymousPricingFactsInput = Readonly<{
  sourceClass: AuthenticatedPricingFactSourceClass;
  collectionMode: IntelligencePricingCollectionMode;
  observations: ReadonlyArray<PrivatePricingObservation>;
}>;

function addReasonCode(
  reasonCodes: Set<PricingFactWriterReasonCode>,
  code: PricingFactWriterReasonCode,
): void {
  reasonCodes.add(code);
}

function toSourceQualityBandInput(
  comparableQuality: PrivatePricingObservation["comparableQuality"],
): "moderate" | "low" | undefined {
  if (comparableQuality === "pricing_grade") return "moderate";
  if (comparableQuality === "contextual") return "low";
  return undefined;
}

function buildWriterCandidate(
  sourceClass: AuthenticatedPricingFactSourceClass,
  observation: PrivatePricingObservation,
): AnonymousPricingFactCandidate {
  return {
    sourceClass,
    capturedAt: observation.capturedAt,
    platform: observation.platform ?? null,
    country: observation.country ?? null,
    city: observation.city ?? null,
    propertyType: observation.propertyType ?? null,
    capacity: observation.capacity ?? null,
    guestCapacity: observation.guestCapacity ?? null,
    currency: observation.currency ?? null,
    nightlyPrice: observation.nightlyPrice ?? null,
    comparableQuality: toSourceQualityBandInput(observation.comparableQuality),
    freshness: observation.freshness ?? "fresh",
  };
}

function buildWriterFact(
  fact: AnonymousPricingFact,
): AnonymousPricingFact {
  return {
    ...fact,
    confidenceInputBand: "unknown",
  };
}

function buildInsertRow(
  factKey: string,
  fact: AnonymousPricingFact,
): AnonymousFactGroupInsertRow {
  return {
    fact_key: factKey,
    fact_contract_version: fact.factContractVersion,
    country: fact.marketCell.country,
    city: fact.marketCell.city,
    platform: fact.marketCell.platform,
    property_type: fact.marketCell.propertyType,
    capacity_band: fact.marketCell.capacityBand,
    currency: fact.marketCell.currency,
    market_cell_key: fact.marketCell.marketCellKey,
    metric_family: fact.metricFamily,
    normalized_nightly_price: fact.normalizedNightlyPrice,
    price_band: fact.priceBand,
    capture_period_bucket: fact.capturePeriodBucket,
    source_class: fact.sourceClass as AuthenticatedPricingFactSourceClass,
    confidence_input_band: fact.confidenceInputBand,
    freshness_input_band: fact.freshnessInputBand,
    source_quality_band: fact.sourceQualityBand,
    transformation_policy_version: fact.transformationPolicyVersion,
    eligibility_policy_version: fact.eligibilityPolicyVersion,
    deduplication_policy_version: fact.deduplicationPolicyVersion,
    market_cell_policy_version: fact.marketCellPolicyVersion,
    confidence_policy_version: fact.confidencePolicyVersion,
    freshness_policy_version: fact.freshnessPolicyVersion,
    pricing_normalization_policy_version:
      fact.pricingNormalizationPolicyVersion,
  };
}

function logWriterSummary(
  env: IntelligenceV2FeatureFlagEnv,
  input: WriteAnonymousPricingFactsInput,
  result: PricingFactWriterResult,
): void {
  if (env[DEBUG_INTELLIGENCE_V2]?.trim().toLowerCase() !== "true") {
    return;
  }

  console.info(
    "[intelligence-v2][pricing-fact-writer]",
    JSON.stringify({
      sourceClass: input.sourceClass,
      collectionMode: input.collectionMode,
      status: result.status,
      received: result.received,
      accepted: result.accepted,
      rejected: result.rejected,
      deduplicatedInBatch: result.deduplicatedInBatch,
      submitted: result.submitted,
      databaseStatus: result.databaseStatus,
      reasonCodes: result.reasonCodes,
    }),
  );
}

async function defaultUpsertFacts(
  rows: ReadonlyArray<AnonymousFactGroupInsertRow>,
): Promise<UpsertFactsResult> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("anonymous_fact_groups").upsert(rows, {
      onConflict: "fact_key",
      ignoreDuplicates: true,
    });

    if (error) {
      return { ok: false };
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function buildResult(
  result: Omit<PricingFactWriterResult, "reasonCodes"> & {
    reasonCodes: Set<PricingFactWriterReasonCode>;
  },
): PricingFactWriterResult {
  return {
    ...result,
    reasonCodes: [...result.reasonCodes].sort(),
  };
}

export async function writeAnonymousPricingFacts(
  input: WriteAnonymousPricingFactsInput,
  dependencies: PricingFactWriterDependencies = {},
): Promise<PricingFactWriterResult> {
  const env = dependencies.env ?? process.env;
  const flags = getIntelligenceV2FeatureFlags(env);
  const received = input.observations.length;

  if (!flags.ENABLE_INTELLIGENCE_FACT_TRANSFORMATION) {
    const result = buildResult({
      status: "disabled",
      received,
      accepted: 0,
      rejected: 0,
      deduplicatedInBatch: 0,
      submitted: 0,
      databaseStatus: "not_attempted",
      duplicatesDatabase: "not_attempted",
      reasonCodes: new Set(["transformation_disabled"]),
    });
    logWriterSummary(env, input, result);
    return result;
  }

  if (input.collectionMode === "memory_reuse") {
    const result = buildResult({
      status: "skipped",
      received,
      accepted: 0,
      rejected: 0,
      deduplicatedInBatch: 0,
      submitted: 0,
      databaseStatus: "not_attempted",
      duplicatesDatabase: "not_attempted",
      reasonCodes: new Set(["memory_reuse_skipped"]),
    });
    logWriterSummary(env, input, result);
    return result;
  }

  if (
    flags.ENABLE_INTELLIGENCE_FACT_CONTRIBUTION &&
    getIntelligenceFactIdentitySecret(env) == null
  ) {
    const result = buildResult({
      status: "failed",
      received,
      accepted: 0,
      rejected: 0,
      deduplicatedInBatch: 0,
      submitted: 0,
      databaseStatus: "not_attempted",
      duplicatesDatabase: "not_attempted",
      reasonCodes: new Set(["missing_identity_secret"]),
    });
    logWriterSummary(env, input, result);
    return result;
  }

  const reasonCodes = new Set<PricingFactWriterReasonCode>();
  let accepted = 0;
  let rejected = 0;
  const rowsForDatabase: AnonymousFactGroupInsertRow[] = [];

  for (const observation of input.observations) {
    if (observation.sourceKind === "market_memory_seed") {
      rejected += 1;
      addReasonCode(reasonCodes, "invalid_candidate");
      continue;
    }

    const transformed = transformCandidateToAnonymousPricingFact(
      buildWriterCandidate(input.sourceClass, observation),
    );

    if (!transformed.accepted) {
      rejected += 1;
      addReasonCode(
        reasonCodes,
        transformed.reason === "privacy_validation_failed"
          ? "privacy_validation_failed"
          : "invalid_candidate",
      );
      continue;
    }

    const fact = buildWriterFact(transformed.fact);
    const factValidation = validateSharedIntelligencePrivacy(fact);
    if (!factValidation.valid) {
      rejected += 1;
      addReasonCode(reasonCodes, "privacy_validation_failed");
      continue;
    }

    if (!flags.ENABLE_INTELLIGENCE_FACT_CONTRIBUTION) {
      accepted += 1;
      continue;
    }

    const factKeyResult = buildOpaqueFactKey(
      {
        privateComparableSignature: observation.privateComparableSignature,
        marketCellKey: fact.marketCell.marketCellKey,
        capturePeriodBucket: fact.capturePeriodBucket,
        normalizedNightlyPrice: fact.normalizedNightlyPrice,
        transformationPolicyVersion: fact.transformationPolicyVersion,
      },
      env,
    );

    if (!factKeyResult.ok) {
      rejected += 1;
      addReasonCode(
        reasonCodes,
        factKeyResult.reason === "missing_private_signature"
          ? "missing_private_signature"
          : factKeyResult.reason === "missing_identity_secret"
            ? "missing_identity_secret"
            : "invalid_candidate",
      );
      continue;
    }

    const row = buildInsertRow(factKeyResult.factKey, fact);
    const rowValidation = validateSharedIntelligencePrivacy(row);
    if (!rowValidation.valid) {
      rejected += 1;
      addReasonCode(reasonCodes, "privacy_validation_failed");
      continue;
    }

    rowsForDatabase.push(row);
    accepted += 1;
  }

  if (!flags.ENABLE_INTELLIGENCE_FACT_CONTRIBUTION) {
    addReasonCode(reasonCodes, "contribution_disabled");
    const result = buildResult({
      status: "transformed_only",
      received,
      accepted,
      rejected,
      deduplicatedInBatch: 0,
      submitted: 0,
      databaseStatus: "not_attempted",
      duplicatesDatabase: "not_attempted",
      reasonCodes,
    });
    logWriterSummary(env, input, result);
    return result;
  }

  const deduplicatedRowsByFactKey = new Map<string, AnonymousFactGroupInsertRow>();
  for (const row of rowsForDatabase) {
    if (deduplicatedRowsByFactKey.has(row.fact_key)) {
      addReasonCode(reasonCodes, "duplicate_in_batch");
      continue;
    }
    deduplicatedRowsByFactKey.set(row.fact_key, row);
  }

  const uniqueRows = [...deduplicatedRowsByFactKey.values()];
  const deduplicatedInBatch = rowsForDatabase.length - uniqueRows.length;

  if (uniqueRows.length === 0) {
    const result = buildResult({
      status: "skipped",
      received,
      accepted,
      rejected,
      deduplicatedInBatch,
      submitted: 0,
      databaseStatus: "not_attempted",
      duplicatesDatabase: "not_attempted",
      reasonCodes,
    });
    logWriterSummary(env, input, result);
    return result;
  }

  const upsertFacts = dependencies.upsertFacts ?? defaultUpsertFacts;

  try {
    const upsertResult = await upsertFacts(uniqueRows);
    if (!upsertResult.ok) {
      addReasonCode(reasonCodes, "database_error");
      const result = buildResult({
        status: "failed",
        received,
        accepted,
        rejected,
        deduplicatedInBatch,
        submitted: uniqueRows.length,
        databaseStatus: "failed",
        duplicatesDatabase: "unknown",
        reasonCodes,
      });
      logWriterSummary(env, input, result);
      return result;
    }

    const result = buildResult({
      status: "success",
      received,
      accepted,
      rejected,
      deduplicatedInBatch,
      submitted: uniqueRows.length,
      databaseStatus: "success",
      duplicatesDatabase: "unknown",
      reasonCodes,
    });
    logWriterSummary(env, input, result);
    return result;
  } catch {
    addReasonCode(reasonCodes, "database_error");
    const result = buildResult({
      status: "failed",
      received,
      accepted,
      rejected,
      deduplicatedInBatch,
      submitted: uniqueRows.length,
      databaseStatus: "failed",
      duplicatesDatabase: "unknown",
      reasonCodes,
    });
    logWriterSummary(env, input, result);
    return result;
  }
}

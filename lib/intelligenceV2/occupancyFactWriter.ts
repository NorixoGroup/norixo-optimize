import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import {
  DEBUG_INTELLIGENCE_V2,
  getIntelligenceV2FeatureFlags,
  type IntelligenceV2FeatureFlagEnv,
} from "./featureFlags";
import {
  buildOpaqueOccupancyFactKey,
} from "./occupancyFactIdentity";
import {
  transformCandidateToAnonymousOccupancyFact,
  type AnonymousOccupancyFact,
  type AnonymousOccupancyFactCandidate,
  type IntelligenceV2OccupancySourceClass,
} from "./occupancyFact";
import {
  getIntelligenceFactIdentitySecret,
} from "./opaqueFactIdentity";
import {
  INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
  INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
} from "./policyVersions";
import {
  validateSharedIntelligencePrivacy,
} from "./privacyValidator";

export type AuthenticatedOccupancyFactSourceClass =
  Extract<
    IntelligenceV2OccupancySourceClass,
    "authenticated_audit" | "authenticated_listing"
  >;

export type IntelligenceOccupancyCollectionMode =
  | "live"
  | "memory_reuse";

export type PrivateOccupancyObservation = Readonly<{
  privateOccupancySignature?: string | null;
  capturedAt: string;

  platform?: string | null;
  country?: string | null;
  city?: string | null;
  propertyType?: string | null;
  capacity?: number | null;
  guestCapacity?: number | null;

  observedDays?: number | null;
  unavailableDays?: number | null;
  availableDays?: number | null;
  windowDays?: number | null;

  extractionQuality?: string | null;
  freshness?: string | null;

  sourceKind?: "live_observation" | "memory_seed" | null;
}>;

export type AnonymousOccupancyFactGroupInsertRow =
  Readonly<{
    fact_key: string;
    fact_contract_version: string;

    country: string;
    city: string;
    platform:
      AnonymousOccupancyFact["marketCell"]["platform"];
    property_type:
      AnonymousOccupancyFact["marketCell"]["propertyType"];
    capacity_band:
      AnonymousOccupancyFact["marketCell"]["capacityBand"];
    currency: "UNKNOWN";
    market_cell_key: string;

    metric_family: "occupancy";

    normalized_nightly_price: null;
    price_band: null;
    observed_days_band:
      AnonymousOccupancyFact["observedDaysBand"];
    unavailability_rate_band:
      AnonymousOccupancyFact["unavailabilityRateBand"];

    capture_period_bucket: string;
    source_class: AuthenticatedOccupancyFactSourceClass;

    confidence_input_band: "unknown";
    freshness_input_band:
      | "unknown"
      | "fresh"
      | "recent"
      | "aging"
      | "stale";
    source_quality_band:
      AnonymousOccupancyFact["sourceQualityBand"];

    transformation_policy_version: string;
    eligibility_policy_version: string;
    deduplication_policy_version: string;
    market_cell_policy_version: string;
    confidence_policy_version: string;
    freshness_policy_version: string;
    pricing_normalization_policy_version: null;
  }>;

export type OccupancyFactWriterReasonCode =
  | "transformation_disabled"
  | "contribution_disabled"
  | "memory_reuse_skipped"
  | "missing_identity_secret"
  | "missing_private_signature"
  | "invalid_candidate"
  | "privacy_validation_failed"
  | "duplicate_in_batch"
  | "database_error";

export type OccupancyFactWriterStatus =
  | "disabled"
  | "transformed_only"
  | "success"
  | "failed"
  | "skipped";

export type OccupancyFactWriterDatabaseStatus =
  | "not_attempted"
  | "success"
  | "failed";

export type OccupancyFactWriterResult = Readonly<{
  status: OccupancyFactWriterStatus;
  received: number;
  accepted: number;
  rejected: number;
  deduplicatedInBatch: number;
  submitted: number;
  databaseStatus: OccupancyFactWriterDatabaseStatus;
  duplicatesDatabase: "not_attempted" | "unknown";
  reasonCodes: OccupancyFactWriterReasonCode[];
}>;

type UpsertFactsResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false }>;

export type OccupancyFactWriterDependencies =
  Readonly<{
    env?: IntelligenceV2FeatureFlagEnv;
    upsertFacts?: (
      rows: ReadonlyArray<AnonymousOccupancyFactGroupInsertRow>,
    ) => Promise<UpsertFactsResult>;
  }>;

export type WriteAnonymousOccupancyFactsInput =
  Readonly<{
    sourceClass: AuthenticatedOccupancyFactSourceClass;
    collectionMode: IntelligenceOccupancyCollectionMode;
    observations:
      ReadonlyArray<PrivateOccupancyObservation>;
  }>;

function addReasonCode(
  reasonCodes: Set<OccupancyFactWriterReasonCode>,
  code: OccupancyFactWriterReasonCode,
): void {
  reasonCodes.add(code);
}

function normalizeFreshness(
  value: string | null | undefined,
): AnonymousOccupancyFactGroupInsertRow["freshness_input_band"] {
  const normalized =
    typeof value === "string"
      ? value.trim().toLowerCase()
      : "";

  if (
    normalized === "fresh" ||
    normalized === "recent" ||
    normalized === "aging" ||
    normalized === "stale"
  ) {
    return normalized;
  }

  return "unknown";
}

function buildWriterCandidate(
  sourceClass: AuthenticatedOccupancyFactSourceClass,
  observation: PrivateOccupancyObservation,
): AnonymousOccupancyFactCandidate {
  return {
    sourceClass,
    capturedAt: observation.capturedAt,

    platform: observation.platform ?? null,
    country: observation.country ?? null,
    city: observation.city ?? null,
    propertyType: observation.propertyType ?? null,
    capacity: observation.capacity ?? null,
    guestCapacity: observation.guestCapacity ?? null,

    observedDays: observation.observedDays ?? null,
    unavailableDays:
      observation.unavailableDays ?? null,
    availableDays: observation.availableDays ?? null,
    windowDays: observation.windowDays ?? null,

    extractionQuality:
      observation.extractionQuality ?? null,
    freshness: observation.freshness ?? null,
  };
}

function buildInsertRow(
  factKey: string,
  fact: AnonymousOccupancyFact,
  observation: PrivateOccupancyObservation,
): AnonymousOccupancyFactGroupInsertRow {
  return {
    fact_key: factKey,
    fact_contract_version:
      fact.factContractVersion,

    country: fact.marketCell.country,
    city: fact.marketCell.city,
    platform: fact.marketCell.platform,
    property_type: fact.marketCell.propertyType,
    capacity_band: fact.marketCell.capacityBand,
    currency: "UNKNOWN",
    market_cell_key: fact.marketCell.marketCellKey,

    metric_family: "occupancy",

    normalized_nightly_price: null,
    price_band: null,
    observed_days_band: fact.observedDaysBand,
    unavailability_rate_band:
      fact.unavailabilityRateBand,

    capture_period_bucket:
      fact.capturePeriodBucket,
    source_class:
      fact.sourceClass as AuthenticatedOccupancyFactSourceClass,

    confidence_input_band: "unknown",
    freshness_input_band:
      normalizeFreshness(observation.freshness),
    source_quality_band:
      fact.sourceQualityBand,

    transformation_policy_version:
      fact.transformationPolicyVersion,
    eligibility_policy_version:
      fact.eligibilityPolicyVersion,
    deduplication_policy_version:
      fact.deduplicationPolicyVersion,
    market_cell_policy_version:
      fact.marketCellPolicyVersion,
    confidence_policy_version:
      INTELLIGENCE_V2_CONFIDENCE_POLICY_VERSION,
    freshness_policy_version:
      INTELLIGENCE_V2_FRESHNESS_POLICY_VERSION,
    pricing_normalization_policy_version: null,
  };
}

function buildResult(
  result: Omit<
    OccupancyFactWriterResult,
    "reasonCodes"
  > & {
    reasonCodes:
      Set<OccupancyFactWriterReasonCode>;
  },
): OccupancyFactWriterResult {
  return {
    ...result,
    reasonCodes: [...result.reasonCodes].sort(),
  };
}

function logWriterSummary(
  env: IntelligenceV2FeatureFlagEnv,
  input: WriteAnonymousOccupancyFactsInput,
  result: OccupancyFactWriterResult,
): void {
  if (
    env[DEBUG_INTELLIGENCE_V2]
      ?.trim()
      .toLowerCase() !== "true"
  ) {
    return;
  }

  console.info(
    "[intelligence-v2][occupancy-fact-writer]",
    JSON.stringify({
      sourceClass: input.sourceClass,
      collectionMode: input.collectionMode,
      status: result.status,
      received: result.received,
      accepted: result.accepted,
      rejected: result.rejected,
      deduplicatedInBatch:
        result.deduplicatedInBatch,
      submitted: result.submitted,
      databaseStatus: result.databaseStatus,
      reasonCodes: result.reasonCodes,
    }),
  );
}

async function defaultUpsertFacts(
  rows: ReadonlyArray<AnonymousOccupancyFactGroupInsertRow>,
): Promise<UpsertFactsResult> {
  try {
    const admin = createSupabaseAdminClient();

    const { error } = await admin
      .from("anonymous_fact_groups")
      .upsert(rows, {
        onConflict: "fact_key",
        ignoreDuplicates: true,
      });

    return error ? { ok: false } : { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function writeAnonymousOccupancyFacts(
  input: WriteAnonymousOccupancyFactsInput,
  dependencies: OccupancyFactWriterDependencies = {},
): Promise<OccupancyFactWriterResult> {
  const env = dependencies.env ?? process.env;
  const flags =
    getIntelligenceV2FeatureFlags(env);
  const received = input.observations.length;

  if (
    !flags.ENABLE_INTELLIGENCE_FACT_TRANSFORMATION
  ) {
    const result = buildResult({
      status: "disabled",
      received,
      accepted: 0,
      rejected: 0,
      deduplicatedInBatch: 0,
      submitted: 0,
      databaseStatus: "not_attempted",
      duplicatesDatabase: "not_attempted",
      reasonCodes:
        new Set(["transformation_disabled"]),
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
      reasonCodes:
        new Set(["memory_reuse_skipped"]),
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
      reasonCodes:
        new Set(["missing_identity_secret"]),
    });

    logWriterSummary(env, input, result);
    return result;
  }

  const reasonCodes =
    new Set<OccupancyFactWriterReasonCode>();
  const rowsForDatabase:
    AnonymousOccupancyFactGroupInsertRow[] = [];

  let accepted = 0;
  let rejected = 0;

  for (const observation of input.observations) {
    if (observation.sourceKind === "memory_seed") {
      rejected += 1;
      addReasonCode(
        reasonCodes,
        "invalid_candidate",
      );
      continue;
    }

    const transformed =
      transformCandidateToAnonymousOccupancyFact(
        buildWriterCandidate(
          input.sourceClass,
          observation,
        ),
      );

    if (!transformed.accepted) {
      rejected += 1;
      addReasonCode(
        reasonCodes,
        transformed.reason ===
          "privacy_validation_failed"
          ? "privacy_validation_failed"
          : "invalid_candidate",
      );
      continue;
    }

    const fact = transformed.fact;
    const factValidation =
      validateSharedIntelligencePrivacy(fact);

    if (!factValidation.valid) {
      rejected += 1;
      addReasonCode(
        reasonCodes,
        "privacy_validation_failed",
      );
      continue;
    }

    if (
      !flags.ENABLE_INTELLIGENCE_FACT_CONTRIBUTION
    ) {
      accepted += 1;
      continue;
    }

    const factKeyResult =
      buildOpaqueOccupancyFactKey(
        {
          privateOccupancySignature:
            observation.privateOccupancySignature,
          marketCellKey:
            fact.marketCell.marketCellKey,
          capturePeriodBucket:
            fact.capturePeriodBucket,
          observedDaysBand:
            fact.observedDaysBand,
          unavailabilityRateBand:
            fact.unavailabilityRateBand,
          transformationPolicyVersion:
            fact.transformationPolicyVersion,
        },
        env,
      );

    if (!factKeyResult.ok) {
      rejected += 1;
      addReasonCode(
        reasonCodes,
        factKeyResult.reason ===
          "missing_private_signature"
          ? "missing_private_signature"
          : factKeyResult.reason ===
              "missing_identity_secret"
            ? "missing_identity_secret"
            : "invalid_candidate",
      );
      continue;
    }

    const row = buildInsertRow(
      factKeyResult.factKey,
      fact,
      observation,
    );

    const rowValidation =
      validateSharedIntelligencePrivacy(row);

    if (!rowValidation.valid) {
      rejected += 1;
      addReasonCode(
        reasonCodes,
        "privacy_validation_failed",
      );
      continue;
    }

    rowsForDatabase.push(row);
    accepted += 1;
  }

  if (
    !flags.ENABLE_INTELLIGENCE_FACT_CONTRIBUTION
  ) {
    addReasonCode(
      reasonCodes,
      "contribution_disabled",
    );

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

  const uniqueRowsByFactKey =
    new Map<
      string,
      AnonymousOccupancyFactGroupInsertRow
    >();

  for (const row of rowsForDatabase) {
    if (uniqueRowsByFactKey.has(row.fact_key)) {
      addReasonCode(
        reasonCodes,
        "duplicate_in_batch",
      );
      continue;
    }

    uniqueRowsByFactKey.set(
      row.fact_key,
      row,
    );
  }

  const uniqueRows =
    [...uniqueRowsByFactKey.values()];
  const deduplicatedInBatch =
    rowsForDatabase.length - uniqueRows.length;

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

  const upsertFacts =
    dependencies.upsertFacts ??
    defaultUpsertFacts;

  try {
    const upsertResult =
      await upsertFacts(uniqueRows);

    if (!upsertResult.ok) {
      addReasonCode(
        reasonCodes,
        "database_error",
      );

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
    addReasonCode(
      reasonCodes,
      "database_error",
    );

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

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

import {
  buildMarketCellV1,
  normalizeCurrency,
  normalizeIntelligencePlatform,
  normalizeIntelligencePropertyType,
  type IntelligenceV2Platform,
  type IntelligenceV2PropertyType,
} from "./marketCell";
import {
  buildPublicMarketOverviewArtifact,
  buildPublicMarketOverviewWindow,
  selectPublicMarketOverviewRows,
  type PublicMarketOverviewBuilderDependencies,
  type PublicMarketOverviewBuilderInput,
  type PublicMarketOverviewFactRow,
} from "./publicMarketOverviewBuilder";
import type {
  PublicMarketOverviewPersistableArtifactRow,
  PublicMarketOverviewPropertyScope,
} from "./publicMarketOverviewContract";

export type PublicMarketOverviewBackfillMode = "dry_run" | "apply";
export type PublicMarketOverviewBackfillCandidateStatus =
  | "dry_run"
  | "inserted"
  | "already_existing"
  | "not_public"
  | "failed";

export type PublicMarketOverviewBackfillOptions = Readonly<{
  mode: PublicMarketOverviewBackfillMode;
  confirmWrite: boolean;
  country?: string | null;
  city?: string | null;
  platform?: string | null;
  propertyType?: string | null;
  currency?: string | null;
  windowDays: 90;
  limit?: number | null;
}>;

export type PublicMarketOverviewCliParseResult =
  | Readonly<{ ok: true; options: PublicMarketOverviewBackfillOptions }>
  | Readonly<{ ok: false; error: string }>;

export type PublicMarketOverviewBackfillCandidate = Readonly<{
  scope: PublicMarketOverviewPropertyScope;
  country: string;
  city: string;
  platform: Exclude<IntelligenceV2Platform, "unknown">;
  requestedPropertyType: IntelligenceV2PropertyType | null;
  currency: string;
  windowStartedAt: string;
  windowEndedAt: string;
  capturePeriodBuckets: readonly string[];
  factsIncluded: number;
  capturePeriods: readonly string[];
  sourceClasses: readonly string[];
  p25: number | null;
  median: number | null;
  p75: number | null;
  sampleBand: string | null;
  confidence: string | null;
  exposureStatus: string | null;
  limitationCodes: readonly string[];
  reasonCodes: readonly string[];
  artifactKey: string | null;
  status: PublicMarketOverviewBackfillCandidateStatus;
  wouldWrite: boolean;
  persistableArtifact: PublicMarketOverviewPersistableArtifactRow | null;
  writeFailure: PublicMarketOverviewSafeWriteFailure | null;
}>;

export type PublicMarketOverviewBackfillResult =
  | Readonly<{
      ok: true;
      mode: PublicMarketOverviewBackfillMode;
      windowStartedAt: string;
      windowEndedAt: string;
      capturePeriodBuckets: readonly string[];
      candidates: readonly PublicMarketOverviewBackfillCandidate[];
      insertedCount: number;
      alreadyExistingCount: number;
      failedCount: number;
      notPublicCount: number;
      writeEligibleCount: number;
    }>
  | Readonly<{
      ok: false;
      error: string;
    }>;

type NormalizedFilters = Readonly<{
  country: string | null;
  city: string | null;
  platform: Exclude<IntelligenceV2Platform, "unknown"> | null;
  propertyType: IntelligenceV2PropertyType | null;
  currency: string | null;
}>;

type PublicMarketOverviewBackfillLoadFactsInput = Readonly<{
  country: string | null;
  city: string | null;
  platform: Exclude<IntelligenceV2Platform, "unknown"> | null;
  currency: string | null;
  capturePeriodBuckets: readonly string[];
}>;

type PublicMarketOverviewBackfillDependencies = Readonly<{
  now?: () => Date;
  loadFacts?: (
    input: PublicMarketOverviewBackfillLoadFactsInput,
  ) => Promise<
    | Readonly<{ ok: true; rows: ReadonlyArray<PublicMarketOverviewFactRow> }>
    | Readonly<{ ok: false }>
  >;
  insertArtifact?: (
    payload: PublicMarketOverviewPersistableArtifactRow,
  ) => Promise<PublicMarketOverviewInsertArtifactResult | boolean>;
  builderDependencies?: Omit<PublicMarketOverviewBuilderDependencies, "now" | "loadFacts">;
}>;

export type PublicMarketOverviewSafeWriteFailure = Readonly<{
  code: string | null;
  schemaField: string | null;
  message: string | null;
}>;

type PublicMarketOverviewInsertArtifactResult =
  | Readonly<{ ok: true; status: "inserted" | "already_existing" }>
  | Readonly<{ ok: false; failure: PublicMarketOverviewSafeWriteFailure }>;

type CandidateTarget = Readonly<{
  country: string;
  city: string;
  platform: Exclude<IntelligenceV2Platform, "unknown">;
  propertyType: IntelligenceV2PropertyType | null;
  currency: string;
  rows: ReadonlyArray<PublicMarketOverviewFactRow>;
}>;

const FACT_SELECT_COLUMNS = [
  "country",
  "city",
  "platform",
  "property_type",
  "capacity_band",
  "currency",
  "market_cell_key",
  "normalized_nightly_price",
  "source_class",
  "capture_period_bucket",
  "created_at",
  "fact_contract_version",
  "transformation_policy_version",
  "eligibility_policy_version",
  "deduplication_policy_version",
  "market_cell_policy_version",
  "confidence_policy_version",
  "freshness_policy_version",
  "pricing_normalization_policy_version",
].join(",");

export const PUBLIC_MARKET_OVERVIEW_ARTIFACT_UPSERT_OPTIONS = Object.freeze({
  onConflict: "artifact_key",
  ignoreDuplicates: true,
} as const);

function uniqueSortedStrings<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort() as T[];
}

function normalizeNonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFilters(
  options: Pick<
    PublicMarketOverviewBackfillOptions,
    "country" | "city" | "platform" | "propertyType" | "currency"
  >,
): NormalizedFilters | null {
  const seed = buildMarketCellV1({
    country: options.country ?? undefined,
    city: options.city ?? undefined,
    platform: options.platform ?? "airbnb",
    propertyType: options.propertyType ?? "apartment",
    currency: options.currency ?? "EUR",
  });

  const rawCountry = normalizeNonEmptyString(options.country);
  const rawCity = normalizeNonEmptyString(options.city);
  const rawPlatform = normalizeNonEmptyString(options.platform);
  const rawPropertyType = normalizeNonEmptyString(options.propertyType);
  const rawCurrency = normalizeNonEmptyString(options.currency);

  if (rawCountry != null && seed.country === "unknown") {
    return null;
  }
  if (rawCity != null && seed.city === "unknown") {
    return null;
  }
  if (rawPlatform != null && seed.platform === "unknown") {
    return null;
  }
  if (rawPropertyType != null && seed.propertyType === "unknown") {
    return null;
  }
  if (rawCurrency != null && normalizeCurrency(rawCurrency) === "UNKNOWN") {
    return null;
  }

  const normalizedPlatform =
    rawPlatform == null || seed.platform === "unknown" ? null : seed.platform;

  return Object.freeze({
    country: rawCountry == null ? null : seed.country,
    city: rawCity == null ? null : seed.city,
    platform: normalizedPlatform,
    propertyType: rawPropertyType == null ? null : seed.propertyType,
    currency: rawCurrency == null ? null : normalizeCurrency(rawCurrency),
  });
}

async function loadFactsFromSupabase(
  input: PublicMarketOverviewBackfillLoadFactsInput,
): Promise<
  | Readonly<{ ok: true; rows: ReadonlyArray<PublicMarketOverviewFactRow> }>
  | Readonly<{ ok: false }>
> {
  try {
    const admin = createSupabaseAdminClient();
    let query = admin
      .from("anonymous_fact_groups")
      .select(FACT_SELECT_COLUMNS)
      .eq("metric_family", "pricing")
      .in("capture_period_bucket", [...input.capturePeriodBuckets])
      .order("country", { ascending: true })
      .order("city", { ascending: true })
      .order("platform", { ascending: true })
      .order("currency", { ascending: true })
      .order("capture_period_bucket", { ascending: true })
      .order("created_at", { ascending: true });

    if (input.country != null) {
      query = query.eq("country", input.country);
    }
    if (input.city != null) {
      query = query.eq("city", input.city);
    }
    if (input.platform != null) {
      query = query.eq("platform", input.platform);
    }
    if (input.currency != null) {
      query = query.eq("currency", input.currency);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) {
      return { ok: false };
    }

    return {
      ok: true,
      rows: data as unknown as PublicMarketOverviewFactRow[],
    };
  } catch {
    return { ok: false };
  }
}

async function insertArtifactIntoSupabase(
  payload: PublicMarketOverviewPersistableArtifactRow,
): Promise<PublicMarketOverviewInsertArtifactResult> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("benchmark_artifacts")
      .upsert(payload, PUBLIC_MARKET_OVERVIEW_ARTIFACT_UPSERT_OPTIONS)
      .select("id");

    if (!error) {
      return {
        ok: true,
        status: Array.isArray(data) && data.length > 0 ? "inserted" : "already_existing",
      };
    }

    return {
      ok: false,
      failure: extractSafeWriteFailure(error),
    };
  } catch (error) {
    return {
      ok: false,
      failure: extractSafeWriteFailure(error),
    };
  }
}

function extractSchemaField(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const patterns = [
    /column ["']?([a-z0-9_]+)["']?/i,
    /constraint ["']?([a-z0-9_]+)["']?/i,
    /field ["']?([a-z0-9_]+)["']?/i,
    /Could not find the ['"]([a-z0-9_]+)['"] column/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function sanitizeGenericMessage(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized.slice(0, 200) : null;
}

function extractSafeWriteFailure(error: unknown): PublicMarketOverviewSafeWriteFailure {
  if (!error || typeof error !== "object") {
    return Object.freeze({
      code: null,
      schemaField: null,
      message: null,
    });
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const code = typeof candidate.code === "string" ? candidate.code : null;
  const message = sanitizeGenericMessage(
    typeof candidate.message === "string"
      ? candidate.message
      : typeof candidate.details === "string"
        ? candidate.details
        : typeof candidate.hint === "string"
          ? candidate.hint
          : null,
  );
  const schemaField =
    extractSchemaField(
      typeof candidate.message === "string" ? candidate.message : null,
    ) ??
    extractSchemaField(
      typeof candidate.details === "string" ? candidate.details : null,
    ) ??
    extractSchemaField(
      typeof candidate.hint === "string" ? candidate.hint : null,
    );

  return Object.freeze({
    code,
    schemaField,
    message,
  });
}

function normalizeInsertResult(
  value: PublicMarketOverviewInsertArtifactResult | boolean,
): PublicMarketOverviewInsertArtifactResult {
  if (typeof value === "boolean") {
    return value
      ? { ok: true, status: "inserted" }
      : {
          ok: false,
          failure: Object.freeze({
            code: null,
            schemaField: null,
            message: null,
          }),
        };
  }

  return value;
}

function buildCandidateTargets(input: {
  filters: NormalizedFilters;
  rows: ReadonlyArray<PublicMarketOverviewFactRow>;
  limit: number | null;
}): CandidateTarget[] {
  const rows = input.rows.filter((row) => {
    if (input.filters.country != null && row.country !== input.filters.country) {
      return false;
    }
    if (input.filters.city != null && row.city !== input.filters.city) {
      return false;
    }
    if (input.filters.platform != null && row.platform !== input.filters.platform) {
      return false;
    }
    if (
      input.filters.currency != null &&
      normalizeCurrency(row.currency) !== input.filters.currency
    ) {
      return false;
    }
    return true;
  });

  const groups = new Map<string, CandidateTarget>();
  for (const row of rows) {
    const platform = normalizeIntelligencePlatform(row.platform);
    const currency = normalizeCurrency(row.currency);
    if (platform === "unknown" || currency === "UNKNOWN") {
      continue;
    }

    const key = [row.country, row.city, platform, currency].join("|");
    const existing = groups.get(key);
    if (existing == null) {
      groups.set(
        key,
        Object.freeze({
          country: row.country,
          city: row.city,
          platform,
          propertyType: input.filters.propertyType,
          currency,
          rows: [row],
        }),
      );
      continue;
    }

    groups.set(
      key,
      Object.freeze({
        ...existing,
        rows: [...existing.rows, row],
      }),
    );
  }

  if (
    groups.size === 0 &&
    input.filters.country != null &&
    input.filters.city != null &&
    input.filters.platform != null
  ) {
    const currencies =
      input.filters.currency != null ? [input.filters.currency] : [];
    for (const currency of currencies) {
      const key = [
        input.filters.country,
        input.filters.city,
        input.filters.platform,
        currency,
      ].join("|");
      groups.set(
        key,
        Object.freeze({
          country: input.filters.country,
          city: input.filters.city,
          platform: input.filters.platform,
          propertyType: input.filters.propertyType,
          currency,
          rows: [],
        }),
      );
    }
  }

  const targets = [...groups.values()].sort((left, right) =>
    [left.country, left.city, left.platform, left.currency].join("|").localeCompare(
      [right.country, right.city, right.platform, right.currency].join("|"),
    ),
  );

  return input.limit == null ? targets : targets.slice(0, input.limit);
}

function buildScopes(
  propertyType: IntelligenceV2PropertyType | null,
): PublicMarketOverviewPropertyScope[] {
  if (propertyType == null) {
    return ["broader_market"];
  }
  return ["exact", "broader_market"];
}

function buildBuilderInput(
  target: CandidateTarget,
  scope: PublicMarketOverviewPropertyScope,
): PublicMarketOverviewBuilderInput {
  return Object.freeze({
    country: target.country,
    city: target.city,
    platform: target.platform,
    propertyType: target.propertyType,
    currency: target.currency,
    propertyScope: scope,
    dryRun: true,
  });
}

function summarizeSelectedRows(
  target: CandidateTarget,
  scope: PublicMarketOverviewPropertyScope,
  rows: ReadonlyArray<PublicMarketOverviewFactRow>,
  capturePeriodBuckets: readonly string[],
) {
  const propertyType = target.propertyType ?? "unknown";
  const selectedRows = selectPublicMarketOverviewRows({
    rows,
    country: target.country,
    city: target.city,
    platform: target.platform,
    propertyType,
    currency: target.currency,
    propertyScope: scope,
    capturePeriodBuckets,
  });

  const capturePeriods = uniqueSortedStrings(
    selectedRows
      .map((row) => normalizeNonEmptyString(row.capture_period_bucket))
      .filter((value): value is string => value != null),
  );
  const sourceClasses = uniqueSortedStrings(
    selectedRows
      .map((row) => normalizeNonEmptyString(row.source_class))
      .filter((value): value is string => value != null),
  );

  return Object.freeze({
    selectedRows,
    capturePeriods,
    sourceClasses,
  });
}

export function parsePublicMarketOverviewCliArgs(
  argv: readonly string[],
): PublicMarketOverviewCliParseResult {
  let mode: PublicMarketOverviewBackfillMode = "dry_run";
  let confirmWrite = false;
  let country: string | null = null;
  let city: string | null = null;
  let platform: string | null = null;
  let propertyType: string | null = null;
  let currency: string | null = null;
  let limit: number | null = null;
  let windowDays: 90 = 90;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      if (mode === "apply") {
        return { ok: false, error: "Cannot combine --dry-run and --apply." };
      }
      mode = "dry_run";
      continue;
    }
    if (arg === "--apply") {
      if (mode === "dry_run" && argv.includes("--dry-run")) {
        return { ok: false, error: "Cannot combine --dry-run and --apply." };
      }
      mode = "apply";
      continue;
    }
    if (arg === "--confirm-write") {
      confirmWrite = true;
      continue;
    }
    if (arg.startsWith("--country=")) {
      country = arg.slice("--country=".length);
      continue;
    }
    if (arg.startsWith("--city=")) {
      city = arg.slice("--city=".length);
      continue;
    }
    if (arg.startsWith("--platform=")) {
      platform = arg.slice("--platform=".length);
      continue;
    }
    if (arg.startsWith("--property-type=")) {
      propertyType = arg.slice("--property-type=".length);
      continue;
    }
    if (arg.startsWith("--currency=")) {
      currency = arg.slice("--currency=".length);
      continue;
    }
    if (arg.startsWith("--window-days=")) {
      const parsed = Number(arg.slice("--window-days=".length));
      if (!Number.isInteger(parsed) || parsed !== 90) {
        return {
          ok: false,
          error: "Only --window-days=90 is supported in v1.",
        };
      }
      windowDays = 90;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return { ok: false, error: "Expected --limit to be a positive integer." };
      }
      limit = parsed;
      continue;
    }

    return { ok: false, error: `Unknown argument: ${arg}` };
  }

  if (mode === "apply" && !confirmWrite) {
    return {
      ok: false,
      error: "--apply requires --confirm-write.",
    };
  }

  if (
    mode === "apply" &&
    (normalizeNonEmptyString(country) == null ||
      normalizeNonEmptyString(city) == null ||
      normalizeNonEmptyString(platform) == null)
  ) {
    return {
      ok: false,
      error: "--apply requires --country, --city and --platform.",
    };
  }

  return {
    ok: true,
    options: Object.freeze({
      mode,
      confirmWrite,
      country,
      city,
      platform,
      propertyType,
      currency,
      windowDays,
      limit,
    }),
  };
}

export async function buildPublicMarketOverviewBackfill(
  options: PublicMarketOverviewBackfillOptions,
  dependencies: PublicMarketOverviewBackfillDependencies = {},
): Promise<PublicMarketOverviewBackfillResult> {
  if (options.windowDays !== 90) {
    return { ok: false, error: "Only rolling_90_days is supported in v1." };
  }

  if (options.mode === "apply" && !options.confirmWrite) {
    return { ok: false, error: "--apply requires --confirm-write." };
  }

  const filters = normalizeFilters(options);
  if (filters == null) {
    return { ok: false, error: "Invalid market, platform, property type or currency filter." };
  }

  if (
    options.mode === "apply" &&
    (filters.country == null || filters.city == null || filters.platform == null)
  ) {
    return {
      ok: false,
      error: "--apply requires normalized country, city and platform filters.",
    };
  }

  const now = dependencies.now?.() ?? new Date();
  const window = buildPublicMarketOverviewWindow(now);
  const windowStartedAt = window.windowStartedAt.toISOString();
  const windowEndedAt = window.windowEndedAt.toISOString();

  const loadFacts = dependencies.loadFacts ?? loadFactsFromSupabase;
  const loadedFacts = await loadFacts({
    country: filters.country,
    city: filters.city,
    platform: filters.platform,
    currency: filters.currency,
    capturePeriodBuckets: window.capturePeriodBuckets,
  });

  if (!loadedFacts.ok) {
    return { ok: false, error: "Unable to load anonymous pricing facts." };
  }

  const targets = buildCandidateTargets({
    filters,
    rows: loadedFacts.rows,
    limit: options.limit ?? null,
  });

  const insertArtifact = dependencies.insertArtifact ?? insertArtifactIntoSupabase;
  const builderDependencies = dependencies.builderDependencies ?? {};

  const candidates: PublicMarketOverviewBackfillCandidate[] = [];
  let insertedCount = 0;
  let alreadyExistingCount = 0;
  let failedCount = 0;
  let notPublicCount = 0;
  let writeEligibleCount = 0;

  for (const target of targets) {
    for (const scope of buildScopes(target.propertyType)) {
      const builderInput = buildBuilderInput(target, scope);
      const rowSummary = summarizeSelectedRows(
        target,
        scope,
        target.rows,
        window.capturePeriodBuckets,
      );
      const buildResult = await buildPublicMarketOverviewArtifact(builderInput, {
        ...builderDependencies,
        now: () => now,
        loadFacts: async () => ({ ok: true, rows: target.rows }),
      });

      const baseCandidate = {
        scope,
        country: target.country,
        city: target.city,
        platform: target.platform,
        requestedPropertyType: target.propertyType,
        currency: target.currency,
        windowStartedAt,
        windowEndedAt,
        capturePeriodBuckets: window.capturePeriodBuckets,
        factsIncluded: rowSummary.selectedRows.length,
        capturePeriods: rowSummary.capturePeriods,
        sourceClasses: rowSummary.sourceClasses,
      } as const;

      if (!buildResult.available) {
        notPublicCount += 1;
        candidates.push(
          Object.freeze({
            ...baseCandidate,
            p25: null,
            median: null,
            p75: null,
            sampleBand: null,
            confidence: null,
            exposureStatus: null,
            limitationCodes: buildResult.limitationCodes,
            reasonCodes: buildResult.reasonCodes,
            artifactKey: null,
            status: buildResult.status === "not_public" ? "not_public" : "failed",
            wouldWrite: false,
            persistableArtifact: null,
            writeFailure: null,
          }),
        );
        continue;
      }

      writeEligibleCount += 1;
      const eligibleExposure =
        buildResult.artifact.exposureStatus === "public_usable" ||
        buildResult.artifact.exposureStatus === "public_usable_with_limits";

      if (options.mode === "dry_run") {
        candidates.push(
          Object.freeze({
            ...baseCandidate,
            p25: buildResult.artifact.p25,
            median: buildResult.artifact.median,
            p75: buildResult.artifact.p75,
            sampleBand: buildResult.artifact.sampleBand,
            confidence: buildResult.artifact.confidence,
            exposureStatus: buildResult.artifact.exposureStatus,
            limitationCodes: buildResult.artifact.limitationCodes,
            reasonCodes: [],
            artifactKey: buildResult.artifact.artifactKey,
            status: "dry_run",
            wouldWrite: eligibleExposure,
            persistableArtifact: buildResult.persistableArtifact,
            writeFailure: null,
          }),
        );
        continue;
      }

      let insertResult: PublicMarketOverviewInsertArtifactResult = {
        ok: false,
        failure: Object.freeze({
          code: null,
          schemaField: null,
          message: null,
        }),
      };
      try {
        insertResult = normalizeInsertResult(
          await insertArtifact(buildResult.persistableArtifact),
        );
      } catch {
        insertResult = {
          ok: false,
          failure: Object.freeze({
            code: null,
            schemaField: null,
            message: null,
          }),
        };
      }

      if (!insertResult.ok) {
        failedCount += 1;
        candidates.push(
          Object.freeze({
            ...baseCandidate,
            p25: buildResult.artifact.p25,
            median: buildResult.artifact.median,
            p75: buildResult.artifact.p75,
            sampleBand: buildResult.artifact.sampleBand,
            confidence: buildResult.artifact.confidence,
            exposureStatus: buildResult.artifact.exposureStatus,
            limitationCodes: buildResult.artifact.limitationCodes,
            reasonCodes: ["database_insert_error"],
            artifactKey: buildResult.artifact.artifactKey,
            status: "failed",
            wouldWrite: eligibleExposure,
            persistableArtifact: buildResult.persistableArtifact,
            writeFailure: insertResult.failure,
          }),
        );
        continue;
      }

      if (insertResult.status === "already_existing") {
        alreadyExistingCount += 1;
        candidates.push(
          Object.freeze({
            ...baseCandidate,
            p25: buildResult.artifact.p25,
            median: buildResult.artifact.median,
            p75: buildResult.artifact.p75,
            sampleBand: buildResult.artifact.sampleBand,
            confidence: buildResult.artifact.confidence,
            exposureStatus: buildResult.artifact.exposureStatus,
            limitationCodes: buildResult.artifact.limitationCodes,
            reasonCodes: ["artifact_already_exists"],
            artifactKey: buildResult.artifact.artifactKey,
            status: "already_existing",
            wouldWrite: eligibleExposure,
            persistableArtifact: buildResult.persistableArtifact,
            writeFailure: null,
          }),
        );
        continue;
      }

      insertedCount += 1;
      candidates.push(
        Object.freeze({
          ...baseCandidate,
          p25: buildResult.artifact.p25,
          median: buildResult.artifact.median,
          p75: buildResult.artifact.p75,
          sampleBand: buildResult.artifact.sampleBand,
          confidence: buildResult.artifact.confidence,
          exposureStatus: buildResult.artifact.exposureStatus,
          limitationCodes: buildResult.artifact.limitationCodes,
          reasonCodes: [],
          artifactKey: buildResult.artifact.artifactKey,
          status: "inserted",
          wouldWrite: eligibleExposure,
          persistableArtifact: buildResult.persistableArtifact,
          writeFailure: null,
        }),
      );
    }
  }

  return Object.freeze({
    ok: true,
    mode: options.mode,
    windowStartedAt,
    windowEndedAt,
    capturePeriodBuckets: window.capturePeriodBuckets,
    candidates,
    insertedCount,
    alreadyExistingCount,
    failedCount,
    notPublicCount,
    writeEligibleCount,
  });
}

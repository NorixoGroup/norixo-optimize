import {
  canonicalizeMarketCity,
  canonicalizeMarketCountry,
} from "@/lib/competitors/marketNormalization";
import {
  buildAnonymousPricingFactIdentityProjection,
  transformCandidateToAnonymousPricingFact,
  type AnonymousPricingFact,
  type AnonymousPricingFactCandidate,
} from "./pricingFact";
import {
  buildOpaqueFactKey,
  type OpaqueFactIdentityEnv,
} from "./opaqueFactIdentity";
import { buildPrivateComparableIdentity } from "./privateComparableIdentity";
import type { PrivatePricingObservation } from "./pricingFactWriter";
import {
  normalizeIntelligencePlatform,
} from "./marketCell";
import {
  validateSharedIntelligencePrivacy,
  type PrivacyValidationResult,
} from "./privacyValidator";

const ISO_DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LIMIT = 10000;

export type MarketMemoryPricingBackfillSourceClass =
  | "authenticated_audit"
  | "authenticated_listing";

export type MarketMemoryPricingBackfillMode = "dry_run" | "apply";

export type MarketMemoryPricingBackfillExclusionReason =
  | "unsupported_snapshot_source"
  | "fallback_observed_only"
  | "missing_snapshot"
  | "invalid_country"
  | "invalid_city"
  | "unsupported_platform"
  | "invalid_currency"
  | "invalid_price"
  | "invalid_capture_date"
  | "privacy_validation_failed"
  | "identity_unavailable"
  | "duplicate_fact_key"
  | "limit_reached"
  | "filter_mismatch";

export type MarketMemoryPricingBackfillCliOptions = Readonly<{
  country: string | null;
  city: string | null;
  platform: string | null;
  limit: number | null;
  snapshotId: string | null;
  from: string | null;
  to: string | null;
  mode: MarketMemoryPricingBackfillMode;
  confirmWrite: boolean;
}>;

export type MarketMemoryPricingBackfillSnapshotRow = Readonly<{
  id: string;
  country: string | null;
  city: string | null;
  platform: string | null;
  property_type: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}>;

export type MarketMemoryPricingBackfillComparableRow = Readonly<{
  id: string;
  snapshot_id: string;
  platform: string | null;
  city: string | null;
  country: string | null;
  property_type: string | null;
  nightly_price: number | null;
  currency: string | null;
  created_at: string;
  raw: Record<string, unknown> | null;
  url: string | null;
  title: string | null;
  latitude: number | null;
  longitude: number | null;
}>;

export type MarketMemoryPricingFactCandidate = Readonly<{
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  capacityBand: string;
  currency: string;
  normalizedNightlyPrice: number;
  capturePeriodBucket: string;
  sourceClass: MarketMemoryPricingBackfillSourceClass;
  sourceQualityBand: string;
  confidenceInputBand: string;
  freshnessInputBand: string;
  transformationPolicyVersion: string;
  privateComparableSignature: string;
  marketCellKey: string;
  opaqueFactKeyPreview: string;
}>;

export type MarketMemoryPricingBackfillDryRunCell = Readonly<{
  country: string;
  city: string;
  platform: string;
  propertyType: string;
  capacityBand: string;
  currency: string;
  capturePeriodBucket: string;
  count: number;
}>;

export type MarketMemoryPricingBackfillDryRunReport = Readonly<{
  mode: "dry_run";
  scanned: {
    snapshots: number;
    comparables: number;
  };
  eligibleCandidates: number;
  uniqueFactKeys: number;
  duplicateFactKeys: number;
  explicitStructuredCapacityCandidates: number;
  exclusions: Readonly<
    Record<MarketMemoryPricingBackfillExclusionReason, number>
  >;
  bySourceClass: Readonly<Record<string, number>>;
  byPropertyType: Readonly<Record<string, number>>;
  byCapacityBand: Readonly<Record<string, number>>;
  byCurrency: Readonly<Record<string, number>>;
  byCapturePeriod: Readonly<Record<string, number>>;
  cells: readonly MarketMemoryPricingBackfillDryRunCell[];
}>;

export type MarketMemoryPricingBackfillDryRunDiagnostics = Readonly<{
  candidates: ReadonlyArray<MarketMemoryPricingFactCandidate>;
  preparedWrites: ReadonlyArray<MarketMemoryPricingBackfillPreparedWrite>;
}>;

export type MarketMemoryPricingBackfillPreparedWrite = Readonly<{
  sourceClass: MarketMemoryPricingBackfillSourceClass;
  observation: PrivatePricingObservation;
  opaqueFactKeyPreview: string;
  propertyType: string;
  capacityBand: string;
  currency: string;
  capturePeriodBucket: string;
}>;

export type MarketMemoryPricingBackfillApplyReport = Readonly<{
  mode: "apply";
  scanned: MarketMemoryPricingBackfillDryRunReport["scanned"];
  eligibleCandidates: number;
  uniqueCandidates: number;
  explicitStructuredCapacityCandidates: number;
  duplicateFactKeys: number;
  exclusions: MarketMemoryPricingBackfillDryRunReport["exclusions"];
  bySourceClass: MarketMemoryPricingBackfillDryRunReport["bySourceClass"];
  byPropertyType: MarketMemoryPricingBackfillDryRunReport["byPropertyType"];
  byCapacityBand: MarketMemoryPricingBackfillDryRunReport["byCapacityBand"];
  byCurrency: MarketMemoryPricingBackfillDryRunReport["byCurrency"];
  byCapturePeriod: MarketMemoryPricingBackfillDryRunReport["byCapturePeriod"];
  cells: MarketMemoryPricingBackfillDryRunReport["cells"];
  writeAttempted: number;
  inserted: number;
  alreadyExisting: number;
  rejected: number;
  failed: number;
}>;

export type MarketMemoryPricingBackfillDependencies = Readonly<{
  privacyValidator?: (value: unknown) => PrivacyValidationResult;
}>;

export type MarketMemoryPricingBackfillAnalyzeInput = Readonly<{
  options: MarketMemoryPricingBackfillCliOptions;
  snapshots: ReadonlyArray<MarketMemoryPricingBackfillSnapshotRow>;
  comparables: ReadonlyArray<MarketMemoryPricingBackfillComparableRow>;
  identityEnv?: OpaqueFactIdentityEnv;
  referenceNow?: string | Date;
  includeDiagnostics?: boolean;
  dependencies?: MarketMemoryPricingBackfillDependencies;
}>;

export type MarketMemoryPricingBackfillAnalyzeResult = Readonly<{
  report: MarketMemoryPricingBackfillDryRunReport;
  diagnostics?: MarketMemoryPricingBackfillDryRunDiagnostics;
}>;

type ComparableRawRecord = Record<string, unknown>;

type StructuredCapacitySignal = Readonly<{
  capacity: number | null;
  guestCapacity: number | null;
  explicit: boolean;
}>;

type SnapshotRouteResult =
  | Readonly<{
      ok: true;
      sourceClass: MarketMemoryPricingBackfillSourceClass;
    }>
  | Readonly<{
      ok: false;
    }>;

type ReportAccumulator = {
  eligibleCandidates: number;
  uniqueFactKeys: Set<string>;
  duplicateFactKeys: number;
  explicitStructuredCapacityCandidates: number;
  exclusions: Record<MarketMemoryPricingBackfillExclusionReason, number>;
  bySourceClass: Record<string, number>;
  byPropertyType: Record<string, number>;
  byCapacityBand: Record<string, number>;
  byCurrency: Record<string, number>;
  byCapturePeriod: Record<string, number>;
  cells: Map<string, MarketMemoryPricingBackfillDryRunCell>;
  uniqueCandidates: MarketMemoryPricingFactCandidate[];
  preparedWrites: MarketMemoryPricingBackfillPreparedWrite[];
};

function fail(message: string): never {
  throw new Error(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPlainObject(value: unknown): ComparableRawRecord | null {
  return isPlainObject(value) ? value : null;
}

function pickString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function toUtcDateBounds(value: string, endOfDay: boolean): string {
  return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
}

function incrementCounter(
  record: Record<string, number>,
  key: string,
  amount = 1,
): void {
  record[key] = (record[key] ?? 0) + amount;
}

function createEmptyExclusions(): Record<
  MarketMemoryPricingBackfillExclusionReason,
  number
> {
  return {
    unsupported_snapshot_source: 0,
    fallback_observed_only: 0,
    missing_snapshot: 0,
    invalid_country: 0,
    invalid_city: 0,
    unsupported_platform: 0,
    invalid_currency: 0,
    invalid_price: 0,
    invalid_capture_date: 0,
    privacy_validation_failed: 0,
    identity_unavailable: 0,
    duplicate_fact_key: 0,
    limit_reached: 0,
    filter_mismatch: 0,
  };
}

function createAccumulator(): ReportAccumulator {
  return {
    eligibleCandidates: 0,
    uniqueFactKeys: new Set<string>(),
    duplicateFactKeys: 0,
    explicitStructuredCapacityCandidates: 0,
    exclusions: createEmptyExclusions(),
    bySourceClass: {},
    byPropertyType: {},
    byCapacityBand: {},
    byCurrency: {},
    byCapturePeriod: {},
    cells: new Map<string, MarketMemoryPricingBackfillDryRunCell>(),
    uniqueCandidates: [],
    preparedWrites: [],
  };
}

function parseEqualsArgument(
  argument: string,
  name: string,
): string | null {
  const prefix = `${name}=`;
  if (!argument.startsWith(prefix)) {
    return null;
  }
  const value = argument.slice(prefix.length).trim();
  if (value.length === 0) {
    fail(`Missing value for \`${name}\`.`);
  }
  return value;
}

export function parseMarketMemoryPricingBackfillCliArgs(
  argv: ReadonlyArray<string>,
): MarketMemoryPricingBackfillCliOptions {
  let country: string | null = null;
  let city: string | null = null;
  let platform: string | null = null;
  let limit: number | null = null;
  let snapshotId: string | null = null;
  let from: string | null = null;
  let to: string | null = null;
  let mode: MarketMemoryPricingBackfillMode = "dry_run";
  let confirmWrite = false;
  let explicitDryRun = false;

  for (const argument of argv) {
    if (argument === "--dry-run") {
      explicitDryRun = true;
      continue;
    }

    if (argument === "--apply") {
      mode = "apply";
      continue;
    }

    if (argument === "--confirm-write") {
      confirmWrite = true;
      continue;
    }

    const parsedCountry = parseEqualsArgument(argument, "--country");
    if (parsedCountry != null) {
      country = parsedCountry;
      continue;
    }

    const parsedCity = parseEqualsArgument(argument, "--city");
    if (parsedCity != null) {
      city = parsedCity;
      continue;
    }

    const parsedPlatform = parseEqualsArgument(argument, "--platform");
    if (parsedPlatform != null) {
      platform = parsedPlatform;
      continue;
    }

    const parsedLimit = parseEqualsArgument(argument, "--limit");
    if (parsedLimit != null) {
      const value = Number(parsedLimit);
      if (!Number.isInteger(value) || value <= 0 || value > MAX_LIMIT) {
        fail(
          `\`--limit\` must be a positive integer not greater than ${MAX_LIMIT}.`,
        );
      }
      limit = value;
      continue;
    }

    const parsedSnapshotId = parseEqualsArgument(argument, "--snapshot-id");
    if (parsedSnapshotId != null) {
      if (!UUID_REGEX.test(parsedSnapshotId)) {
        fail("`--snapshot-id` must be a valid UUID.");
      }
      snapshotId = parsedSnapshotId;
      continue;
    }

    const parsedFrom = parseEqualsArgument(argument, "--from");
    if (parsedFrom != null) {
      if (!isValidIsoDate(parsedFrom)) {
        fail("`--from` must be a valid ISO date in YYYY-MM-DD format.");
      }
      from = parsedFrom;
      continue;
    }

    const parsedTo = parseEqualsArgument(argument, "--to");
    if (parsedTo != null) {
      if (!isValidIsoDate(parsedTo)) {
        fail("`--to` must be a valid ISO date in YYYY-MM-DD format.");
      }
      to = parsedTo;
      continue;
    }

    fail(`Unknown argument: ${argument}`);
  }

  if (from != null && to != null) {
    const fromTime = new Date(toUtcDateBounds(from, false)).getTime();
    const toTime = new Date(toUtcDateBounds(to, true)).getTime();
    if (fromTime > toTime) {
      fail("`--from` must be earlier than or equal to `--to`.");
    }
  }

  if (explicitDryRun && mode === "apply") {
    fail("`--dry-run` and `--apply` cannot be used together.");
  }

  if (mode === "apply") {
    if (!confirmWrite) {
      fail("Apply mode requires --confirm-write.");
    }

    if (country == null || city == null || platform == null) {
      fail(
        "Apply mode requires an explicit perimeter: `--country`, `--city`, and `--platform`.",
      );
    }
  }

  return {
    country,
    city,
    platform,
    limit,
    snapshotId,
    from,
    to,
    mode,
    confirmWrite,
  };
}

function normalizeCountryFilter(value: string | null): string | null {
  return value == null ? null : canonicalizeMarketCountry(value);
}

function normalizeCityFilter(value: string | null): string | null {
  return value == null ? null : canonicalizeMarketCity(value);
}

function normalizePlatformFilter(value: string | null): string | null {
  if (value == null) return null;
  const normalized = normalizeIntelligencePlatform(value);
  if (normalized === "unknown") {
    fail("`--platform` must be one of airbnb, booking, expedia, agoda, or vrbo.");
  }
  return normalized;
}

function snapshotCreatedAtWithinRange(
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
  options: MarketMemoryPricingBackfillCliOptions,
): boolean {
  const createdAt = new Date(snapshot.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  if (options.from != null) {
    const fromTime = new Date(toUtcDateBounds(options.from, false)).getTime();
    if (createdAt.getTime() < fromTime) return false;
  }

  if (options.to != null) {
    const toTime = new Date(toUtcDateBounds(options.to, true)).getTime();
    if (createdAt.getTime() > toTime) return false;
  }

  return true;
}

function snapshotMatchesFilters(
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
  options: MarketMemoryPricingBackfillCliOptions,
): boolean {
  if (options.snapshotId != null && snapshot.id !== options.snapshotId) {
    return false;
  }

  if (!snapshotCreatedAtWithinRange(snapshot, options)) {
    return false;
  }

  const countryFilter = normalizeCountryFilter(options.country);
  if (countryFilter != null) {
    const snapshotCountry = canonicalizeMarketCountry(snapshot.country);
    if (snapshotCountry !== countryFilter) {
      return false;
    }
  }

  const cityFilter = normalizeCityFilter(options.city);
  if (cityFilter != null) {
    const snapshotCity = canonicalizeMarketCity(snapshot.city);
    if (snapshotCity !== cityFilter) {
      return false;
    }
  }

  const platformFilter = normalizePlatformFilter(options.platform);
  if (platformFilter != null) {
    const snapshotPlatform = normalizeIntelligencePlatform(snapshot.platform);
    if (snapshotPlatform !== platformFilter) {
      return false;
    }
  }

  return true;
}

function deriveSourceClass(
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
): SnapshotRouteResult {
  const metadata = toPlainObject(snapshot.metadata);
  const route = pickString(metadata?.route);

  if (route === "api_audits") {
    return { ok: true, sourceClass: "authenticated_audit" };
  }
  if (route === "api_listings") {
    return { ok: true, sourceClass: "authenticated_listing" };
  }

  return { ok: false };
}

function isFallbackObservedOnly(
  comparable: MarketMemoryPricingBackfillComparableRow,
): boolean {
  const raw = toPlainObject(comparable.raw);
  const marketMemory = toPlainObject(raw?._marketMemory);
  return (
    marketMemory?.comparableOrigin === "fallback_observed_only" ||
    marketMemory?.observedOnly === true
  );
}

function pickRawNestedString(
  raw: ComparableRawRecord | null,
  firstKey: string,
  secondKey: string,
): string | null {
  const first = toPlainObject(raw?.[firstKey]);
  return pickString(first?.[secondKey]);
}

function pickComparablePropertyType(
  comparable: MarketMemoryPricingBackfillComparableRow,
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
): string | null {
  const raw = toPlainObject(comparable.raw);
  return (
    pickString(comparable.property_type) ??
    pickString(snapshot.property_type) ??
    pickString(raw?.propertyType) ??
    pickString(raw?.type) ??
    null
  );
}

function pickComparableCountry(
  comparable: MarketMemoryPricingBackfillComparableRow,
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
): string | null {
  return pickString(comparable.country) ?? pickString(snapshot.country) ?? null;
}

function pickComparableCity(
  comparable: MarketMemoryPricingBackfillComparableRow,
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
): string | null {
  return pickString(comparable.city) ?? pickString(snapshot.city) ?? null;
}

function pickComparablePlatform(
  comparable: MarketMemoryPricingBackfillComparableRow,
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
): string | null {
  return pickString(comparable.platform) ?? pickString(snapshot.platform) ?? null;
}

function pickComparableCapturedAt(
  comparable: MarketMemoryPricingBackfillComparableRow,
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
): string {
  return pickString(comparable.created_at) ?? snapshot.created_at;
}

function extractStructuredCapacitySignal(
  comparable: MarketMemoryPricingBackfillComparableRow,
): StructuredCapacitySignal {
  const raw = toPlainObject(comparable.raw);
  const structure = toPlainObject(raw?.structure);

  const capacity =
    toPositiveInteger(raw?.capacity) ?? toPositiveInteger(structure?.capacity);
  const guestCapacity = toPositiveInteger(raw?.guestCapacity);

  return {
    capacity,
    guestCapacity,
    explicit: capacity != null || guestCapacity != null,
  };
}

function deriveFreshnessInputBand(
  capturedAt: string,
  referenceNow: Date,
): AnonymousPricingFactCandidate["freshness"] {
  const parsed = new Date(capturedAt);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }

  const ageMs = referenceNow.getTime() - parsed.getTime();
  const ageDays = Math.floor(ageMs / 86400000);

  if (ageDays <= 30) return "fresh";
  if (ageDays <= 90) return "recent";
  if (ageDays <= 180) return "aging";
  return "stale";
}

function buildComparableIdentityInput(
  comparable: MarketMemoryPricingBackfillComparableRow,
  platform: string,
  city: string | null,
  country: string | null,
): Parameters<typeof buildPrivateComparableIdentity>[0] {
  const raw = toPlainObject(comparable.raw);
  const rawLocationLabel =
    pickString(raw?.locationLabel) ??
    pickRawNestedString(raw, "structure", "locationLabel");

  return {
    platform,
    url: comparable.url,
    sourceUrl: pickString(raw?.sourceUrl),
    canonicalUrl: pickString(raw?.canonicalUrl),
    sourceId: pickString(raw?.externalId),
    title: comparable.title,
    locationLabel:
      rawLocationLabel ??
      (city != null && country != null ? `${city}, ${country}` : city ?? country),
    latitude: comparable.latitude,
    longitude: comparable.longitude,
  };
}

function buildAnonymousPricingCandidate(
  sourceClass: MarketMemoryPricingBackfillSourceClass,
  comparable: MarketMemoryPricingBackfillComparableRow,
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
  referenceNow: Date,
): {
  candidate: AnonymousPricingFactCandidate;
  explicitCapacity: boolean;
} {
  const raw = toPlainObject(comparable.raw);
  const capacitySignal = extractStructuredCapacitySignal(comparable);

  return {
    candidate: {
      sourceClass,
      capturedAt: pickComparableCapturedAt(comparable, snapshot),
      platform: pickComparablePlatform(comparable, snapshot),
      country: pickComparableCountry(comparable, snapshot),
      city: pickComparableCity(comparable, snapshot),
      propertyType: pickComparablePropertyType(comparable, snapshot),
      capacity: capacitySignal.capacity,
      guestCapacity: capacitySignal.guestCapacity,
      currency: comparable.currency,
      nightlyPrice: comparable.nightly_price,
      comparableQuality: pickString(raw?.comparableQuality),
      freshness: deriveFreshnessInputBand(
        pickComparableCapturedAt(comparable, snapshot),
        referenceNow,
      ),
    },
    explicitCapacity: capacitySignal.explicit,
  };
}

function normalizeComparableQuality(
  value: unknown,
): PrivatePricingObservation["comparableQuality"] {
  return value === "pricing_grade" || value === "contextual" ? value : null;
}

function buildPreparedObservation(
  sourceClass: MarketMemoryPricingBackfillSourceClass,
  comparable: MarketMemoryPricingBackfillComparableRow,
  snapshot: MarketMemoryPricingBackfillSnapshotRow,
  privateComparableSignature: string,
  freshness: NonNullable<PrivatePricingObservation["freshness"]>,
): PrivatePricingObservation {
  const raw = toPlainObject(comparable.raw);
  const capacitySignal = extractStructuredCapacitySignal(comparable);

  return {
    privateComparableSignature,
    capturedAt: pickComparableCapturedAt(comparable, snapshot),
    platform: pickComparablePlatform(comparable, snapshot),
    country: pickComparableCountry(comparable, snapshot),
    city: pickComparableCity(comparable, snapshot),
    propertyType: pickComparablePropertyType(comparable, snapshot),
    capacity: capacitySignal.capacity,
    guestCapacity: capacitySignal.guestCapacity,
    currency: comparable.currency,
    nightlyPrice: comparable.nightly_price,
    sourceKind: "live_comparable",
    comparableQuality: normalizeComparableQuality(raw?.comparableQuality),
    freshness,
  };
}

function mapTransformRejectionReason(
  reason: Parameters<
    typeof transformCandidateToAnonymousPricingFact
  >[0] extends never
    ? never
    : Exclude<
        ReturnType<typeof transformCandidateToAnonymousPricingFact>,
        { accepted: true; fact: AnonymousPricingFact }
      >["reason"],
): MarketMemoryPricingBackfillExclusionReason {
  switch (reason) {
    case "missing_country":
      return "invalid_country";
    case "missing_city":
      return "invalid_city";
    case "unsupported_platform":
      return "unsupported_platform";
    case "missing_currency":
    case "invalid_currency":
      return "invalid_currency";
    case "invalid_nightly_price":
      return "invalid_price";
    case "invalid_capture_date":
      return "invalid_capture_date";
    case "privacy_validation_failed":
      return "privacy_validation_failed";
    case "guest_source_not_allowed":
    case "historical_backfill_disabled":
      return "unsupported_snapshot_source";
  }
}

function candidateMatchesFilters(
  fact: AnonymousPricingFact,
  options: MarketMemoryPricingBackfillCliOptions,
): boolean {
  const countryFilter = normalizeCountryFilter(options.country);
  if (countryFilter != null && fact.marketCell.country !== countryFilter) {
    return false;
  }

  const cityFilter = normalizeCityFilter(options.city);
  if (cityFilter != null && fact.marketCell.city !== cityFilter) {
    return false;
  }

  const platformFilter = normalizePlatformFilter(options.platform);
  if (platformFilter != null && fact.marketCell.platform !== platformFilter) {
    return false;
  }

  return true;
}

function buildFactCandidateView(
  fact: AnonymousPricingFact,
  privateComparableSignature: string,
  opaqueFactKeyPreview: string,
): MarketMemoryPricingFactCandidate {
  return {
    country: fact.marketCell.country,
    city: fact.marketCell.city,
    platform: fact.marketCell.platform,
    propertyType: fact.marketCell.propertyType,
    capacityBand: fact.marketCell.capacityBand,
    currency: fact.marketCell.currency,
    normalizedNightlyPrice: fact.normalizedNightlyPrice,
    capturePeriodBucket: fact.capturePeriodBucket,
    sourceClass:
      fact.sourceClass === "authenticated_audit"
        ? "authenticated_audit"
        : "authenticated_listing",
    sourceQualityBand: fact.sourceQualityBand,
    confidenceInputBand: fact.confidenceInputBand,
    freshnessInputBand: fact.freshnessInputBand,
    transformationPolicyVersion: fact.transformationPolicyVersion,
    privateComparableSignature,
    marketCellKey: fact.marketCell.marketCellKey,
    opaqueFactKeyPreview,
  };
}

function buildPreparedWrite(
  fact: AnonymousPricingFact,
  opaqueFactKeyPreview: string,
  observation: PrivatePricingObservation,
): MarketMemoryPricingBackfillPreparedWrite {
  return {
    sourceClass:
      fact.sourceClass === "authenticated_audit"
        ? "authenticated_audit"
        : "authenticated_listing",
    observation,
    opaqueFactKeyPreview,
    propertyType: fact.marketCell.propertyType,
    capacityBand: fact.marketCell.capacityBand,
    currency: fact.marketCell.currency,
    capturePeriodBucket: fact.capturePeriodBucket,
  };
}

function addUniqueCandidateToAccumulator(
  accumulator: ReportAccumulator,
  candidate: MarketMemoryPricingFactCandidate,
  preparedWrite: MarketMemoryPricingBackfillPreparedWrite,
): void {
  incrementCounter(accumulator.bySourceClass, candidate.sourceClass);
  incrementCounter(accumulator.byPropertyType, candidate.propertyType);
  incrementCounter(accumulator.byCapacityBand, candidate.capacityBand);
  incrementCounter(accumulator.byCurrency, candidate.currency);
  incrementCounter(accumulator.byCapturePeriod, candidate.capturePeriodBucket);

  const cellKey = [
    candidate.country,
    candidate.city,
    candidate.platform,
    candidate.propertyType,
    candidate.capacityBand,
    candidate.currency,
    candidate.capturePeriodBucket,
  ].join("|");
  const current = accumulator.cells.get(cellKey);
  if (current) {
    accumulator.cells.set(cellKey, {
      ...current,
      count: current.count + 1,
    });
  } else {
    accumulator.cells.set(cellKey, {
      country: candidate.country,
      city: candidate.city,
      platform: candidate.platform,
      propertyType: candidate.propertyType,
      capacityBand: candidate.capacityBand,
      currency: candidate.currency,
      capturePeriodBucket: candidate.capturePeriodBucket,
      count: 1,
    });
  }

  accumulator.uniqueCandidates.push(candidate);
  accumulator.preparedWrites.push(preparedWrite);
}

function sortRecord(
  input: Record<string, number>,
): Readonly<Record<string, number>> {
  const entries = Object.entries(input).sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      rightValue - leftValue || leftKey.localeCompare(rightKey),
  );
  return Object.fromEntries(entries);
}

function sortCells(
  cells: Iterable<MarketMemoryPricingBackfillDryRunCell>,
): ReadonlyArray<MarketMemoryPricingBackfillDryRunCell> {
  return [...cells].sort(
    (left, right) =>
      right.count - left.count ||
      left.country.localeCompare(right.country) ||
      left.city.localeCompare(right.city) ||
      left.platform.localeCompare(right.platform) ||
      left.propertyType.localeCompare(right.propertyType) ||
      left.capacityBand.localeCompare(right.capacityBand) ||
      left.currency.localeCompare(right.currency) ||
      left.capturePeriodBucket.localeCompare(right.capturePeriodBucket),
  );
}

function toReferenceNow(referenceNow?: string | Date): Date {
  if (referenceNow instanceof Date) {
    return new Date(referenceNow.toISOString());
  }
  if (typeof referenceNow === "string") {
    const parsed = new Date(referenceNow);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

export function analyzeMarketMemoryPricingBackfillDryRun(
  input: MarketMemoryPricingBackfillAnalyzeInput,
): MarketMemoryPricingBackfillAnalyzeResult {
  const filteredSnapshots = input.snapshots.filter((snapshot) =>
    snapshotMatchesFilters(snapshot, input.options),
  );
  const snapshotById = new Map(
    filteredSnapshots.map((snapshot) => [snapshot.id, snapshot] as const),
  );
  const referenceNow = toReferenceNow(input.referenceNow);
  const privacyValidator =
    input.dependencies?.privacyValidator ?? validateSharedIntelligencePrivacy;
  const accumulator = createAccumulator();

  const sortedComparables = [...input.comparables]
    .filter((comparable) => snapshotById.has(comparable.snapshot_id))
    .sort((left, right) => {
      const createdAtOrder = left.created_at.localeCompare(right.created_at);
      if (createdAtOrder !== 0) return createdAtOrder;
      return left.id.localeCompare(right.id);
    });

  const processedComparables =
    input.options.limit == null
      ? sortedComparables
      : sortedComparables.slice(0, input.options.limit);
  const skippedForLimit = sortedComparables.length - processedComparables.length;

  if (skippedForLimit > 0) {
    accumulator.exclusions.limit_reached += skippedForLimit;
  }

  for (const comparable of processedComparables) {
    const snapshot = snapshotById.get(comparable.snapshot_id);
    if (!snapshot) {
      accumulator.exclusions.missing_snapshot += 1;
      continue;
    }

    const sourceClassResult = deriveSourceClass(snapshot);
    if (!sourceClassResult.ok) {
      accumulator.exclusions.unsupported_snapshot_source += 1;
      continue;
    }

    if (isFallbackObservedOnly(comparable)) {
      accumulator.exclusions.fallback_observed_only += 1;
      continue;
    }

    const candidateInput = buildAnonymousPricingCandidate(
      sourceClassResult.sourceClass,
      comparable,
      snapshot,
      referenceNow,
    );
    const transformed = transformCandidateToAnonymousPricingFact(
      candidateInput.candidate,
    );

    if (!transformed.accepted) {
      accumulator.exclusions[
        mapTransformRejectionReason(transformed.reason)
      ] += 1;
      continue;
    }

    if (!candidateMatchesFilters(transformed.fact, input.options)) {
      accumulator.exclusions.filter_mismatch += 1;
      continue;
    }

    const privacyValidation = privacyValidator(transformed.fact);
    if (!privacyValidation.valid) {
      accumulator.exclusions.privacy_validation_failed += 1;
      continue;
    }

    accumulator.eligibleCandidates += 1;

    if (candidateInput.explicitCapacity) {
      accumulator.explicitStructuredCapacityCandidates += 1;
    }

    const identity = buildPrivateComparableIdentity(
      buildComparableIdentityInput(
        comparable,
        transformed.fact.marketCell.platform,
        pickComparableCity(comparable, snapshot),
        pickComparableCountry(comparable, snapshot),
      ),
    );

    if (!identity.ok) {
      accumulator.exclusions.identity_unavailable += 1;
      continue;
    }

    const projection = buildAnonymousPricingFactIdentityProjection(
      transformed.fact,
    );
    const factKey = buildOpaqueFactKey(
      {
        privateComparableSignature: identity.privateComparableSignature,
        marketCellKey: projection.marketCellKey,
        capturePeriodBucket: projection.capturePeriodBucket,
        normalizedNightlyPrice: projection.normalizedNightlyPrice,
        transformationPolicyVersion: projection.transformationPolicyVersion,
      },
      input.identityEnv,
    );

    if (!factKey.ok) {
      accumulator.exclusions.identity_unavailable += 1;
      continue;
    }

    if (accumulator.uniqueFactKeys.has(factKey.factKey)) {
      accumulator.duplicateFactKeys += 1;
      accumulator.exclusions.duplicate_fact_key += 1;
      continue;
    }

    const preparedObservation = buildPreparedObservation(
      sourceClassResult.sourceClass,
      comparable,
      snapshot,
      identity.privateComparableSignature,
      transformed.fact.freshnessInputBand,
    );

    accumulator.uniqueFactKeys.add(factKey.factKey);
    addUniqueCandidateToAccumulator(
      accumulator,
      buildFactCandidateView(
        transformed.fact,
        identity.privateComparableSignature,
        factKey.factKey,
      ),
      buildPreparedWrite(
        transformed.fact,
        factKey.factKey,
        preparedObservation,
      ),
    );
  }

  const report: MarketMemoryPricingBackfillDryRunReport = {
    mode: "dry_run",
    scanned: {
      snapshots: filteredSnapshots.length,
      comparables: processedComparables.length,
    },
    eligibleCandidates: accumulator.eligibleCandidates,
    uniqueFactKeys: accumulator.uniqueFactKeys.size,
    duplicateFactKeys: accumulator.duplicateFactKeys,
    explicitStructuredCapacityCandidates:
      accumulator.explicitStructuredCapacityCandidates,
    exclusions: Object.freeze({ ...accumulator.exclusions }),
    bySourceClass: sortRecord(accumulator.bySourceClass),
    byPropertyType: sortRecord(accumulator.byPropertyType),
    byCapacityBand: sortRecord(accumulator.byCapacityBand),
    byCurrency: sortRecord(accumulator.byCurrency),
    byCapturePeriod: sortRecord(accumulator.byCapturePeriod),
    cells: sortCells(accumulator.cells.values()),
  };

  if (!input.includeDiagnostics) {
    return { report };
  }

  return {
    report,
    diagnostics: {
      candidates: accumulator.uniqueCandidates,
      preparedWrites: accumulator.preparedWrites,
    },
  };
}

export function runMarketMemoryPricingBackfillDryRun(
  input: MarketMemoryPricingBackfillAnalyzeInput,
): MarketMemoryPricingBackfillDryRunReport {
  return analyzeMarketMemoryPricingBackfillDryRun(input).report;
}

export function buildMarketMemoryPricingBackfillApplyReport(input: {
  dryRunReport: MarketMemoryPricingBackfillDryRunReport;
  writeAttempted: number;
  inserted: number;
  alreadyExisting: number;
  rejected: number;
}): MarketMemoryPricingBackfillApplyReport {
  const uniqueCandidates = input.dryRunReport.uniqueFactKeys;
  const failed = Math.max(
    0,
    uniqueCandidates -
      input.alreadyExisting -
      input.inserted -
      input.rejected,
  );

  return {
    mode: "apply",
    scanned: input.dryRunReport.scanned,
    eligibleCandidates: input.dryRunReport.eligibleCandidates,
    uniqueCandidates,
    explicitStructuredCapacityCandidates:
      input.dryRunReport.explicitStructuredCapacityCandidates,
    duplicateFactKeys: input.dryRunReport.duplicateFactKeys,
    exclusions: input.dryRunReport.exclusions,
    bySourceClass: input.dryRunReport.bySourceClass,
    byPropertyType: input.dryRunReport.byPropertyType,
    byCapacityBand: input.dryRunReport.byCapacityBand,
    byCurrency: input.dryRunReport.byCurrency,
    byCapturePeriod: input.dryRunReport.byCapturePeriod,
    cells: input.dryRunReport.cells,
    writeAttempted: input.writeAttempted,
    inserted: input.inserted,
    alreadyExisting: input.alreadyExisting,
    rejected: input.rejected,
    failed,
  };
}

function formatBreakdownSection(
  title: string,
  values: Readonly<Record<string, number>>,
): string[] {
  const entries = Object.entries(values);
  const lines = [title];

  if (entries.length === 0) {
    lines.push("  none: 0");
    return lines;
  }

  for (const [key, count] of entries) {
    lines.push(`  ${key}: ${count}`);
  }

  return lines;
}

function formatCells(
  cells: ReadonlyArray<MarketMemoryPricingBackfillDryRunCell>,
): string[] {
  const lines = ["Cells:"];
  if (cells.length === 0) {
    lines.push("  none: 0");
    return lines;
  }

  for (const cell of cells) {
    lines.push(
      `  ${cell.country} | ${cell.city} | ${cell.platform} | ${cell.propertyType} | ${cell.capacityBand} | ${cell.currency} | ${cell.capturePeriodBucket}: ${cell.count}`,
    );
  }
  return lines;
}

function formatFilterValue(value: string | number | null): string {
  if (value == null) return "(none)";
  return String(value);
}

export function formatMarketMemoryPricingBackfillDryRunReport(
  report: MarketMemoryPricingBackfillDryRunReport,
  options: MarketMemoryPricingBackfillCliOptions,
): string {
  const lines: string[] = [
    "Mode: dry-run",
    "Filters:",
    `  country: ${formatFilterValue(options.country)}`,
    `  city: ${formatFilterValue(options.city)}`,
    `  platform: ${formatFilterValue(options.platform)}`,
    `  snapshotId: ${formatFilterValue(options.snapshotId)}`,
    `  from: ${formatFilterValue(options.from)}`,
    `  to: ${formatFilterValue(options.to)}`,
    `  limit: ${formatFilterValue(options.limit)}`,
    "",
    `Snapshots scanned: ${report.scanned.snapshots}`,
    `Comparables scanned: ${report.scanned.comparables}`,
    `Eligible candidates: ${report.eligibleCandidates}`,
    `Unique fact keys: ${report.uniqueFactKeys}`,
    `Duplicates: ${report.duplicateFactKeys}`,
    `Explicit structured capacity candidates: ${report.explicitStructuredCapacityCandidates}`,
    "",
  ];

  lines.push(...formatBreakdownSection("Excluded:", report.exclusions));
  lines.push("");
  lines.push(...formatBreakdownSection("Source classes:", report.bySourceClass));
  lines.push("");
  lines.push(...formatBreakdownSection("Property types:", report.byPropertyType));
  lines.push("");
  lines.push(...formatBreakdownSection("Capacity bands:", report.byCapacityBand));
  lines.push("");
  lines.push(...formatBreakdownSection("Currencies:", report.byCurrency));
  lines.push("");
  lines.push(...formatBreakdownSection("Periods:", report.byCapturePeriod));
  lines.push("");
  lines.push(...formatCells(report.cells));
  lines.push("");
  lines.push("No data was written.");

  return lines.join("\n");
}

export function formatMarketMemoryPricingBackfillApplyReport(
  report: MarketMemoryPricingBackfillApplyReport,
  options: MarketMemoryPricingBackfillCliOptions,
): string {
  const lines: string[] = [
    "Mode: apply",
    "Filters:",
    `  country: ${formatFilterValue(options.country)}`,
    `  city: ${formatFilterValue(options.city)}`,
    `  platform: ${formatFilterValue(options.platform)}`,
    `  snapshotId: ${formatFilterValue(options.snapshotId)}`,
    `  from: ${formatFilterValue(options.from)}`,
    `  to: ${formatFilterValue(options.to)}`,
    `  limit: ${formatFilterValue(options.limit)}`,
    "",
    `Snapshots scanned: ${report.scanned.snapshots}`,
    `Comparables scanned: ${report.scanned.comparables}`,
    `Eligible candidates: ${report.eligibleCandidates}`,
    `Unique candidates: ${report.uniqueCandidates}`,
    `Duplicates: ${report.duplicateFactKeys}`,
    `Explicit structured capacity candidates: ${report.explicitStructuredCapacityCandidates}`,
    "",
    `Write attempted: ${report.writeAttempted}`,
    `Inserted: ${report.inserted}`,
    `Already existing: ${report.alreadyExisting}`,
    `Rejected: ${report.rejected}`,
    `Failed: ${report.failed}`,
    "",
  ];

  lines.push(...formatBreakdownSection("Excluded:", report.exclusions));
  lines.push("");
  lines.push(...formatBreakdownSection("Source classes:", report.bySourceClass));
  lines.push("");
  lines.push(...formatBreakdownSection("Property types:", report.byPropertyType));
  lines.push("");
  lines.push(...formatBreakdownSection("Capacity bands:", report.byCapacityBand));
  lines.push("");
  lines.push(...formatBreakdownSection("Currencies:", report.byCurrency));
  lines.push("");
  lines.push(...formatBreakdownSection("Periods:", report.byCapturePeriod));
  lines.push("");
  lines.push(...formatCells(report.cells));

  return lines.join("\n");
}

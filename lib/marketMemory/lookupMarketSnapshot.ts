type MarketMemoryComparableMetadata = {
  _marketMemory?: {
    comparableOrigin?: string | null;
    observedOnly?: boolean | null;
  } | null;
};

type FallbackObservedComparableRow = MarketMemoryComparableMetadata & {
  raw?: MarketMemoryComparableMetadata | null;
};

// Helper pour détecter les comparables fallback_observed_only
function isFallbackObservedOnly(row: FallbackObservedComparableRow): boolean {
  const raw = row.raw ?? row;
  return (
    raw?._marketMemory?.comparableOrigin === "fallback_observed_only" ||
    raw?._marketMemory?.observedOnly === true
  );
}
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { ExtractedListing, SupportedPlatform } from "@/lib/extractors/types";

const DEBUG_MARKET_MEMORY =
  process.env.DEBUG_MARKET_MEMORY === "true" ||
  process.env.DEBUG_MARKET_PIPELINE === "true" ||
  process.env.DEBUG_BOOKING_PIPELINE === "true";

function mmLookupLog(
  kind: "lookup-start" | "lookup-result" | "would-reuse" | "skip-reason" | "reuse-tier-analysis",
  payload: Record<string, unknown>
) {
  if (!DEBUG_MARKET_MEMORY) return;
  console.warn(`[market-memory][${kind}] ${JSON.stringify(payload)}`);
}

export type LookupMarketSnapshotInput = {
  platform: SupportedPlatform;
  city?: string | null;
  country?: string | null;
  propertyType?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  nights?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  sourceUrl?: string | null;
  route?: "api_audits" | "api_listings" | "guest_audit" | string;
};

export type LookupMarketSnapshotResult = {
  shouldReuse: boolean;
  reason: string;
  score: number;
  snapshotsFound: number;
  comparablesFound: number;
  samePlatformComparableCount: number;
  samePlatformPricedComparableCount: number;
  crossPlatformComparableCount: number;
  countsByPlatform: Record<string, number>;
  reuseKind: "same_platform_comparables" | "cross_platform_pricing_only" | "insufficient";
  shadowComparables: LookupMarketSnapshotComparable[];
  bestSnapshotId?: string | null;
  freshnessDays?: number | null;
  matchedBy: {
    platform: boolean;
    city: boolean;
    country: boolean;
    propertyType: boolean;
    nights: boolean;
    dateWindow: boolean;
    geo: boolean;
  };
  observedFallbackComparableCount?: number;
  sameSeasonWindow?: boolean;
  nearbyGeoMatch?: boolean;
  geoDistanceKm?: number | null;
  propertyTypeCompatible?: boolean;
  reuseTier?: "exact_city_exact_dates" | "exact_city_same_nights" | "nearby_geo_same_nights" | "seasonal_match_only" | "insufficient";
};

export type LookupMarketSnapshotComparable = {
  url: string | null;
  title: string | null;
  platform: string | null;
  nightlyPrice: number | null;
  totalPrice: number | null;
  currency: string | null;
  propertyType: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
};

export function canReuseMarketMemoryStrict(result: LookupMarketSnapshotResult): boolean {
  return (
    result.shouldReuse === true &&
    result.reuseKind === "same_platform_comparables" &&
    result.matchedBy.platform === true &&
    result.matchedBy.country === true &&
    result.matchedBy.city === true &&
    result.matchedBy.dateWindow === true &&
    result.samePlatformComparableCount >= 3 &&
    result.samePlatformPricedComparableCount >= 3 &&
    result.freshnessDays != null &&
    result.freshnessDays <= 30 &&
    result.shadowComparables.length >= 3
  );
}

export function canReuseMarketMemorySeasonalStrict(
  result: LookupMarketSnapshotResult
): boolean {
  return (
    result.shouldReuse === false &&
    result.reason === "date_window_mismatch" &&
    result.reuseKind === "same_platform_comparables" &&
    result.matchedBy.platform === true &&
    result.matchedBy.country === true &&
    result.matchedBy.city === true &&
    result.matchedBy.nights === true &&
    (result.propertyTypeCompatible === true || result.matchedBy.propertyType === true) &&
    result.sameSeasonWindow === true &&
    result.samePlatformComparableCount >= 5 &&
    result.samePlatformPricedComparableCount >= 3 &&
    result.crossPlatformComparableCount === 0 &&
    result.observedFallbackComparableCount === 0 &&
    result.freshnessDays != null &&
    result.freshnessDays <= 7 &&
    result.shadowComparables.length >= 5
  );
}

export function buildStrictReuseCompetitorsFromShadowComparables(
  comparables: LookupMarketSnapshotComparable[],
  fallbackPlatform: SupportedPlatform
): ExtractedListing[] {
  return comparables.map((comparable, index) => ({
    url: comparable.url ?? `market-memory://${fallbackPlatform}/${index + 1}`,
    sourceUrl: comparable.url ?? undefined,
    platform:
      comparable.platform === "airbnb" ||
      comparable.platform === "booking" ||
      comparable.platform === "vrbo" ||
      comparable.platform === "agoda" ||
      comparable.platform === "expedia" ||
      comparable.platform === "other"
        ? comparable.platform
        : fallbackPlatform,
    title: comparable.title ?? "Market memory comparable",
    description: "",
    amenities: [],
    photos: [],
    price: comparable.nightlyPrice,
    rawStayPrice: comparable.totalPrice,
    currency: comparable.currency,
    stayNights: comparable.nights,
    priceBasis: comparable.nightlyPrice != null ? "nightly" : "unknown",
    propertyType: comparable.propertyType,
  }));
}

export type ShadowReuseComparison = {
  memoryComparableCount: number;
  liveComparableCount: number;
  memoryPricedCount: number;
  livePricedCount: number;
  memoryMedianNightlyPrice: number | null;
  liveMedianNightlyPrice: number | null;
  memoryAverageNightlyPrice: number | null;
  liveAverageNightlyPrice: number | null;
  memoryMinNightlyPrice: number | null;
  memoryMaxNightlyPrice: number | null;
  liveMinNightlyPrice: number | null;
  liveMaxNightlyPrice: number | null;
  medianDeltaPercent: number | null;
  overlapCount: number;
  memoryPropertyTypes: string[];
  livePropertyTypes: string[];
  memoryDateWindows: string[];
  liveDateWindows: string[];
  memoryNights: number[];
  liveNights: number[];
  sameDateWindow: boolean;
};

type SnapshotLookupRow = {
  id: string;
  created_at: string;
  platform: string;
  city: string | null;
  country: string | null;
  property_type: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  comparable_count: number | null;
  confidence_score: number | null;
  metadata: Record<string, unknown> | null;
};

type ComparableLookupRow = {
  id: string;
  snapshot_id: string;
  platform: string | null;
  url: string | null;
  title: string | null;
  nightly_price: number | null;
  total_price: number | null;
  currency: string | null;
  property_type: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  latitude: number | null;
  longitude: number | null;
  raw?: MarketMemoryComparableMetadata | null;
};

type SnapshotScore = {
  snapshot: SnapshotLookupRow;
  score: number;
  freshnessDays: number | null;
  matchedBy: LookupMarketSnapshotResult["matchedBy"];
};

type SnapshotRankedCandidate = SnapshotScore & {
  comparables: ComparableLookupRow[];
  samePlatformComparableCount: number;
  samePlatformPricedComparableCount: number;
  crossPlatformComparableCount: number;
  countsByPlatform: Record<string, number>;
  reuseKind: LookupMarketSnapshotResult["reuseKind"];
};

function emptyResult(
  reason: string,
  overrides?: Partial<LookupMarketSnapshotResult>
): LookupMarketSnapshotResult {
  return {
    shouldReuse: false,
    reason,
    score: 0,
    snapshotsFound: 0,
    comparablesFound: 0,
    samePlatformComparableCount: 0,
    samePlatformPricedComparableCount: 0,
    crossPlatformComparableCount: 0,
    countsByPlatform: {},
    reuseKind: "insufficient",
    shadowComparables: [],
    bestSnapshotId: null,
    freshnessDays: null,
    matchedBy: {
      platform: false,
      city: false,
      country: false,
      propertyType: false,
      nights: false,
      dateWindow: false,
      geo: false,
    },
    ...overrides,
  };
}

function normStr(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normLower(value: string | null | undefined): string | null {
  const normalized = normStr(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normIsoDate(value: string | null | undefined): string | null {
  const normalized = normStr(value);
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normNights(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function monthFromIsoDate(value: string | null | undefined): number | null {
  const normalized = normIsoDate(value);
  if (!normalized) return null;
  const month = Number.parseInt(normalized.slice(5, 7), 10);
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : null;
}

function seasonBucketFromMonth(month: number | null): string | null {
  if (month == null) return null;
  if (month === 12 || month === 1 || month === 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "autumn";
}

function canonicalPropertyType(value: string | null | undefined): string | null {
  const normalized = normLower(value);
  if (!normalized) return null;
  if (normalized.includes("appartement") || normalized.includes("apartment")) return "apartment";
  if (normalized.includes("villa")) return "villa";
  if (normalized.includes("riad") || /\bdar\b/i.test(normalized)) return "riad";
  if (normalized.includes("maison") || normalized.includes("house")) return "house";
  if (normalized.includes("studio")) return "studio";
  return normalized;
}

function propertyTypesCompatible(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const leftCanonical = canonicalPropertyType(left);
  const rightCanonical = canonicalPropertyType(right);
  if (leftCanonical == null || rightCanonical == null) return false;
  return leftCanonical === rightCanonical;
}

function nearestComparableDistanceKm(
  inputLat: number | null | undefined,
  inputLng: number | null | undefined,
  comparables: ComparableLookupRow[]
): number | null {
  if (!hasCoordinates(inputLat, inputLng)) return null;
  let bestDistance: number | null = null;
  for (const comparable of comparables) {
    if (!hasCoordinates(comparable.latitude, comparable.longitude)) continue;
    const currentDistance = distanceKm(
      inputLat as number,
      inputLng as number,
      comparable.latitude as number,
      comparable.longitude as number
    );
    if (bestDistance == null || currentDistance < bestDistance) {
      bestDistance = currentDistance;
    }
  }
  return bestDistance != null ? round2(bestDistance) : null;
}

function computeSameSeasonWindow(
  inputCheckIn: string | null | undefined,
  inputCheckOut: string | null | undefined,
  snapshotCheckIn: string | null | undefined,
  snapshotCheckOut: string | null | undefined
): boolean {
  const inputCheckInMonth = monthFromIsoDate(inputCheckIn);
  const inputCheckOutMonth = monthFromIsoDate(inputCheckOut);
  const snapshotCheckInMonth = monthFromIsoDate(snapshotCheckIn);
  const snapshotCheckOutMonth = monthFromIsoDate(snapshotCheckOut);

  if (
    inputCheckInMonth != null &&
    inputCheckOutMonth != null &&
    snapshotCheckInMonth != null &&
    snapshotCheckOutMonth != null
  ) {
    return inputCheckInMonth === snapshotCheckInMonth && inputCheckOutMonth === snapshotCheckOutMonth;
  }

  const inputSeason = seasonBucketFromMonth(inputCheckInMonth ?? inputCheckOutMonth);
  const snapshotSeason = seasonBucketFromMonth(snapshotCheckInMonth ?? snapshotCheckOutMonth);
  return inputSeason != null && snapshotSeason != null && inputSeason === snapshotSeason;
}

function determineReuseTier(input: {
  matchedByCity: boolean;
  matchedByDateWindow: boolean;
  matchedByNights: boolean;
  nearbyGeoMatch: boolean;
  sameSeasonWindow: boolean;
}): LookupMarketSnapshotResult["reuseTier"] {
  if (input.matchedByCity && input.matchedByDateWindow) return "exact_city_exact_dates";
  if (input.matchedByCity && input.matchedByNights) return "exact_city_same_nights";
  if (input.nearbyGeoMatch && input.matchedByNights) return "nearby_geo_same_nights";
  if (input.sameSeasonWindow) return "seasonal_match_only";
  return "insufficient";
}

function ageDaysFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  const diff = Date.now() - parsed;
  return Math.floor(Math.max(0, diff) / (24 * 60 * 60 * 1000));
}

function freshnessScore(ageDays: number | null): number {
  if (ageDays == null) return 0;
  if (ageDays <= 7) return 10;
  if (ageDays <= 30) return 8;
  if (ageDays <= 90) return 3;
  return 0;
}

function hasCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreSnapshot(input: LookupMarketSnapshotInput, snapshot: SnapshotLookupRow): SnapshotScore {
  const inputPlatform = normLower(input.platform);
  const inputCountry = normLower(input.country);
  const inputCity = normLower(input.city);
  const inputPropertyType = normLower(input.propertyType);
  const inputCheckIn = normIsoDate(input.checkIn);
  const inputCheckOut = normIsoDate(input.checkOut);
  const inputNights = normNights(input.nights);

  const snapshotPlatform = normLower(snapshot.platform);
  const snapshotCountry = normLower(snapshot.country);
  const snapshotCity = normLower(snapshot.city);
  const snapshotPropertyType = normLower(snapshot.property_type);
  const snapshotCheckIn = normIsoDate(snapshot.check_in);
  const snapshotCheckOut = normIsoDate(snapshot.check_out);
  const snapshotNights = normNights(snapshot.nights);

  const matchedBy: LookupMarketSnapshotResult["matchedBy"] = {
    platform: inputPlatform != null && snapshotPlatform === inputPlatform,
    city: inputCity == null || snapshotCity === inputCity,
    country: inputCountry == null || snapshotCountry === inputCountry,
    propertyType: inputPropertyType == null || snapshotPropertyType === inputPropertyType,
    nights: inputNights == null || snapshotNights === inputNights,
    dateWindow:
      (inputCheckIn == null && inputCheckOut == null) ||
      (inputCheckIn != null &&
        inputCheckOut != null &&
        snapshotCheckIn === inputCheckIn &&
        snapshotCheckOut === inputCheckOut),
    geo: false,
  };

  if (!matchedBy.platform) {
    return { snapshot, score: 0, freshnessDays: ageDaysFromIso(snapshot.created_at), matchedBy };
  }

  let score = 30;

  if (inputCountry != null && snapshotCountry === inputCountry) score += 15;
  if (inputCity != null && snapshotCity === inputCity) score += 20;
  if (inputPropertyType != null && snapshotPropertyType === inputPropertyType) score += 15;
  if (inputNights != null && snapshotNights === inputNights) score += 5;
  if (inputCheckIn != null && inputCheckOut != null && matchedBy.dateWindow) score += 5;

  const freshnessDays = ageDaysFromIso(snapshot.created_at);
  score += freshnessScore(freshnessDays);

  const comparableCount = typeof snapshot.comparable_count === "number" ? snapshot.comparable_count : 0;
  if (comparableCount >= 5) score += 10;
  else if (comparableCount >= 3) score += 7;

  return { snapshot, score, freshnessDays, matchedBy };
}

function inferSkipReason(result: LookupMarketSnapshotResult): string {
  if (result.snapshotsFound === 0) return "no_matching_snapshots";
  if (!result.bestSnapshotId) return "no_best_snapshot";
  if (result.reason === "missing_location_for_reuse") return result.reason;
  if (result.reason === "missing_city_for_reuse") return result.reason;
  if (result.reason === "insufficient_priced_same_platform_comparables") return result.reason;
  if (result.comparablesFound < 3) return "insufficient_comparables";
  if ((result.freshnessDays ?? 9999) > 30) return "snapshot_too_old";
  if (result.score < 70) return "score_below_threshold";
  return result.reason;
}

function buildCountsByPlatform(comparables: ComparableLookupRow[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const comparable of comparables) {
    const platform = normLower(comparable.platform) ?? "other";
    counts.set(platform, (counts.get(platform) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function determineReuseKind(
  comparablesFound: number,
  samePlatformComparableCount: number
): LookupMarketSnapshotResult["reuseKind"] {
  if (samePlatformComparableCount >= 3) return "same_platform_comparables";
  if (comparablesFound >= 3) return "cross_platform_pricing_only";
  return "insufficient";
}

function hasPricedSnapshotComparable(comparable: ComparableLookupRow): boolean {
  return typeof comparable.nightly_price === "number" && Number.isFinite(comparable.nightly_price);
}

function buildSnapshotCandidate(
  platform: string,
  score: SnapshotScore,
  comparables: ComparableLookupRow[]
): SnapshotRankedCandidate {
  const countsByPlatform = buildCountsByPlatform(comparables);
  const samePlatformComparableCount = comparables.filter(
    (comparable) => normLower(comparable.platform) === platform
  ).length;
  const samePlatformPricedComparableCount = comparables.filter(
    (comparable) => normLower(comparable.platform) === platform && hasPricedSnapshotComparable(comparable)
  ).length;
  const crossPlatformComparableCount = Math.max(0, comparables.length - samePlatformComparableCount);
  const reuseKind = determineReuseKind(comparables.length, samePlatformComparableCount);

  return {
    ...score,
    comparables,
    samePlatformComparableCount,
    samePlatformPricedComparableCount,
    crossPlatformComparableCount,
    countsByPlatform,
    reuseKind,
  };
}

function reuseKindRank(reuseKind: LookupMarketSnapshotResult["reuseKind"]): number {
  switch (reuseKind) {
    case "same_platform_comparables":
      return 3;
    case "cross_platform_pricing_only":
      return 2;
    default:
      return 1;
  }
}

function compareSnapshotScores(a: SnapshotRankedCandidate, b: SnapshotRankedCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  const aReuseRank = reuseKindRank(a.reuseKind);
  const bReuseRank = reuseKindRank(b.reuseKind);
  if (bReuseRank !== aReuseRank) return bReuseRank - aReuseRank;
  if (b.samePlatformComparableCount !== a.samePlatformComparableCount) {
    return b.samePlatformComparableCount - a.samePlatformComparableCount;
  }
  if (b.matchedBy.dateWindow !== a.matchedBy.dateWindow) {
    return Number(b.matchedBy.dateWindow) - Number(a.matchedBy.dateWindow);
  }
  const aCount = typeof a.snapshot.comparable_count === "number" ? a.snapshot.comparable_count : 0;
  const bCount = typeof b.snapshot.comparable_count === "number" ? b.snapshot.comparable_count : 0;
  if (bCount !== aCount) return bCount - aCount;
  const aTime = Date.parse(a.snapshot.created_at);
  const bTime = Date.parse(b.snapshot.created_at);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && bTime !== aTime) return bTime - aTime;
  return 0;
}

function summarizeLookupResultForLogs(result: LookupMarketSnapshotResult): Record<string, unknown> {
  return {
    shouldReuse: result.shouldReuse,
    reason: result.reason,
    score: result.score,
    snapshotsFound: result.snapshotsFound,
    comparablesFound: result.comparablesFound,
    samePlatformComparableCount: result.samePlatformComparableCount,
    samePlatformPricedComparableCount: result.samePlatformPricedComparableCount,
    crossPlatformComparableCount: result.crossPlatformComparableCount,
    countsByPlatform: result.countsByPlatform,
    reuseKind: result.reuseKind,
    reuseTier: result.reuseTier ?? "insufficient",
    bestSnapshotId: result.bestSnapshotId ?? null,
    freshnessDays: result.freshnessDays ?? null,
    matchedBy: result.matchedBy,
    sameSeasonWindow: result.sameSeasonWindow ?? false,
    nearbyGeoMatch: result.nearbyGeoMatch ?? false,
    geoDistanceKm: result.geoDistanceKm ?? null,
    propertyTypeCompatible: result.propertyTypeCompatible ?? false,
  };
}

function toShadowComparable(row: ComparableLookupRow): LookupMarketSnapshotComparable {
  return {
    url: normStr(row.url),
    title: normStr(row.title),
    platform: normLower(row.platform),
    nightlyPrice: typeof row.nightly_price === "number" && Number.isFinite(row.nightly_price) ? row.nightly_price : null,
    totalPrice: typeof row.total_price === "number" && Number.isFinite(row.total_price) ? row.total_price : null,
    currency: normStr(row.currency),
    propertyType: normLower(row.property_type),
    checkIn: normIsoDate(row.check_in),
    checkOut: normIsoDate(row.check_out),
    nights: normNights(row.nights),
  };
}

function round2(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const left = sorted[mid - 1];
  const right = sorted[mid];
  return left != null && right != null ? (left + right) / 2 : null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeComparableUrl(url: string | null | undefined): string | null {
  const value = normStr(url);
  return value ? value.toLowerCase() : null;
}

function dateWindowSignature(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  nights: number | null | undefined
): string | null {
  const normalizedCheckIn = normIsoDate(checkIn);
  const normalizedCheckOut = normIsoDate(checkOut);
  const normalizedNights = normNights(nights);
  if (normalizedCheckIn && normalizedCheckOut) {
    return `${normalizedCheckIn}|${normalizedCheckOut}|${normalizedNights ?? ""}`;
  }
  if (normalizedNights != null) {
    return `nights:${normalizedNights}`;
  }
  return null;
}

function nightlyPriceFromLiveComparable(listing: ExtractedListing): number | null {
  return typeof listing.price === "number" && Number.isFinite(listing.price) ? listing.price : null;
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))].sort();
}

export function buildShadowReuseComparison(
  memoryComparables: LookupMarketSnapshotComparable[],
  liveComparables: ExtractedListing[]
): ShadowReuseComparison {
  const memoryPrices = memoryComparables
    .map((comparable) => comparable.nightlyPrice)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const livePrices = liveComparables
    .map((comparable) => nightlyPriceFromLiveComparable(comparable))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const memoryUrls = new Set(
    memoryComparables
      .map((comparable) => normalizeComparableUrl(comparable.url))
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const liveUrls = new Set(
    liveComparables
      .map((comparable) => normalizeComparableUrl(comparable.url ?? comparable.sourceUrl ?? comparable.canonicalUrl ?? null))
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const overlapCount = [...memoryUrls].filter((url) => liveUrls.has(url)).length;
  const memoryMedianNightlyPrice = round2(median(memoryPrices));
  const liveMedianNightlyPrice = round2(median(livePrices));
  const memoryAverageNightlyPrice = round2(average(memoryPrices));
  const liveAverageNightlyPrice = round2(average(livePrices));
  const memoryMinNightlyPrice = round2(memoryPrices.length > 0 ? Math.min(...memoryPrices) : null);
  const memoryMaxNightlyPrice = round2(memoryPrices.length > 0 ? Math.max(...memoryPrices) : null);
  const liveMinNightlyPrice = round2(livePrices.length > 0 ? Math.min(...livePrices) : null);
  const liveMaxNightlyPrice = round2(livePrices.length > 0 ? Math.max(...livePrices) : null);
  const medianDeltaPercent =
    memoryMedianNightlyPrice != null &&
    liveMedianNightlyPrice != null &&
    memoryMedianNightlyPrice > 0
      ? round2(((liveMedianNightlyPrice - memoryMedianNightlyPrice) / memoryMedianNightlyPrice) * 100)
      : null;
  const memoryPropertyTypes = uniqueStrings(memoryComparables.map((comparable) => comparable.propertyType));
  const livePropertyTypes = uniqueStrings(
    liveComparables.map((comparable) => normLower(comparable.propertyType ?? comparable.structure?.propertyType ?? null))
  );
  const memoryDateWindows = uniqueStrings(
    memoryComparables.map((comparable) => dateWindowSignature(comparable.checkIn, comparable.checkOut, comparable.nights))
  );
  const liveDateWindows = uniqueStrings(
    liveComparables.map((comparable) => dateWindowSignature(null, null, comparable.stayNights ?? null))
  );
  const memoryNights = [...new Set(memoryComparables.map((comparable) => normNights(comparable.nights)).filter((value): value is number => value != null))].sort((a, b) => a - b);
  const liveNights = [...new Set(liveComparables.map((comparable) => normNights(comparable.stayNights ?? null)).filter((value): value is number => value != null))].sort((a, b) => a - b);
  const exactDateWindowMatch =
    memoryDateWindows.length > 0 &&
    liveDateWindows.length > 0 &&
    memoryDateWindows.some((signature) => liveDateWindows.includes(signature));
  const nightsOnlyMatch = memoryNights.length > 0 && liveNights.length > 0 && memoryNights.some((value) => liveNights.includes(value));
  const sameDateWindow = exactDateWindowMatch || nightsOnlyMatch;

  return {
    memoryComparableCount: memoryComparables.length,
    liveComparableCount: liveComparables.length,
    memoryPricedCount: memoryPrices.length,
    livePricedCount: livePrices.length,
    memoryMedianNightlyPrice,
    liveMedianNightlyPrice,
    memoryAverageNightlyPrice,
    liveAverageNightlyPrice,
    memoryMinNightlyPrice,
    memoryMaxNightlyPrice,
    liveMinNightlyPrice,
    liveMaxNightlyPrice,
    medianDeltaPercent,
    overlapCount,
    memoryPropertyTypes,
    livePropertyTypes,
    memoryDateWindows,
    liveDateWindows,
    memoryNights,
    liveNights,
    sameDateWindow,
  };
}

export async function lookupMarketSnapshot(
  input: LookupMarketSnapshotInput
): Promise<LookupMarketSnapshotResult> {
  const platform = normLower(input.platform);
  const city = normLower(input.city);
  const country = normLower(input.country);
  const propertyType = normLower(input.propertyType);
  const checkIn = normIsoDate(input.checkIn);
  const checkOut = normIsoDate(input.checkOut);
  const nights = normNights(input.nights);

  mmLookupLog("lookup-start", {
    route: input.route ?? null,
    platform,
    city,
    country,
    propertyType,
    checkIn,
    checkOut,
    nights,
    hasGeo: hasCoordinates(input.latitude, input.longitude),
    sourceUrl: normStr(input.sourceUrl),
  });

  if (!platform) {
    const result = emptyResult("missing_platform");
    mmLookupLog("skip-reason", { reason: result.reason });
    return result;
  }

  try {
    const admin = createSupabaseAdminClient();
    let query = admin
      .from("market_snapshots")
      .select(
        "id, created_at, platform, city, country, property_type, check_in, check_out, nights, comparable_count, confidence_score, metadata"
      )
      .eq("platform", platform)
      .order("created_at", { ascending: false })
      .limit(100);

    if (country) query = query.eq("country", country);
    if (city) query = query.eq("city", city);
    if (propertyType) query = query.eq("property_type", propertyType);

    const { data: snapshotsData, error: snapshotsError } = await query;

    if (snapshotsError) {
      const result = emptyResult(`supabase_snapshot_query_error:${snapshotsError.message}`);
      mmLookupLog("skip-reason", { reason: result.reason });
      return result;
    }

    const snapshots = (snapshotsData ?? []) as SnapshotLookupRow[];
    if (snapshots.length === 0) {
      const result = emptyResult("no_matching_snapshots");
      mmLookupLog("lookup-result", result);
      mmLookupLog("skip-reason", { reason: result.reason });
      return result;
    }

    const snapshotIds = snapshots.map((snapshot) => snapshot.id);
    const { data: allComparablesData, error: allComparablesError } = await admin
      .from("market_comparables")
      .select(
        "id, snapshot_id, platform, url, title, nightly_price, total_price, currency, property_type, check_in, check_out, nights, latitude, longitude, raw"
      )
      .in("snapshot_id", snapshotIds);

    if (allComparablesError) {
      const result = emptyResult(`supabase_comparable_query_error:${allComparablesError.message}`, {
        snapshotsFound: snapshots.length,
      });
      mmLookupLog("lookup-result", result);
      mmLookupLog("skip-reason", { reason: result.reason });
      return result;
    }

    const comparablesBySnapshotId = new Map<string, ComparableLookupRow[]>();
    for (const comparable of (allComparablesData ?? []) as ComparableLookupRow[]) {
      const existing = comparablesBySnapshotId.get(comparable.snapshot_id);
      if (existing) existing.push(comparable);
      else comparablesBySnapshotId.set(comparable.snapshot_id, [comparable]);
    }

    const ranked = snapshots
      .map((snapshot) => scoreSnapshot(input, snapshot))
      .map((scoredSnapshot) =>
        buildSnapshotCandidate(
          platform,
          scoredSnapshot,
          comparablesBySnapshotId.get(scoredSnapshot.snapshot.id) ?? []
        )
      )
      .sort(compareSnapshotScores);
    const best = ranked[0];
    if (!best) {
      const result = emptyResult("no_best_snapshot", { snapshotsFound: snapshots.length });
      mmLookupLog("lookup-result", result);
      mmLookupLog("skip-reason", { reason: result.reason });
      return result;
    }


    // Exclure fallback_observed_only des calculs principaux
    const comparablesAll = best.comparables;
    const comparables = comparablesAll.filter((c) => !isFallbackObservedOnly(c));
    const observedFallbackComparableCount = comparablesAll.length - comparables.length;
    const countsByPlatform = buildCountsByPlatform(comparables);
    const samePlatformComparableCount = comparables.filter((comparable) => normLower(comparable.platform) === platform).length;
    const samePlatformPricedComparableCount = comparables.filter(
      (comparable) => normLower(comparable.platform) === platform && hasPricedSnapshotComparable(comparable)
    ).length;
    const crossPlatformComparableCount = Math.max(0, comparables.length - samePlatformComparableCount);
    const reuseKind = determineReuseKind(comparables.length, samePlatformComparableCount);
    const shadowComparables = comparables.map(toShadowComparable);
    const geoDistanceKm = nearestComparableDistanceKm(input.latitude, input.longitude, comparables);
    const nearbyGeoMatch = geoDistanceKm != null && geoDistanceKm <= 5;
    const geoMatched =
      hasCoordinates(input.latitude, input.longitude) &&
      comparables.some(
        (c) =>
          hasCoordinates(c.latitude, c.longitude) &&
          distanceKm(input.latitude as number, input.longitude as number, c.latitude as number, c.longitude as number) <= 25
      );

    // Log diagnostic sur les comparables fallback_observed_only exclus
    if (observedFallbackComparableCount > 0) {
      mmLookupLog("lookup-result", { observedFallbackComparableCount });
    }

    const matchedBy: LookupMarketSnapshotResult["matchedBy"] = {
      ...best.matchedBy,
      geo: Boolean(geoMatched),
    };
    const sameSeasonWindow = computeSameSeasonWindow(
      checkIn,
      checkOut,
      best.snapshot.check_in,
      best.snapshot.check_out
    );
    const propertyTypeCompatible = propertyTypesCompatible(propertyType, best.snapshot.property_type);
    const reuseTier = determineReuseTier({
      matchedByCity: matchedBy.city,
      matchedByDateWindow: matchedBy.dateWindow,
      matchedByNights: matchedBy.nights,
      nearbyGeoMatch,
      sameSeasonWindow,
    });
    let reason = "advisory_skip";
    let shouldReuse = false;

    // PATCH 7: Durcir shouldReuse pour la fenêtre de dates
    if (input.checkIn && input.checkOut) {
      if (matchedBy.dateWindow) {
        // Seulement si la fenêtre de dates correspond exactement
        if (!country) {
          reason = "missing_location_for_reuse";
        } else if (!city && !geoMatched) {
          reason = "missing_city_for_reuse";
        } else if (reuseKind === "cross_platform_pricing_only") {
          reason = "cross_platform_pricing_only";
        } else if (comparables.length < 3) {
          reason = "insufficient_comparables";
        } else if (samePlatformPricedComparableCount < 3) {
          reason = "insufficient_priced_same_platform_comparables";
        } else if (best.freshnessDays != null && best.freshnessDays > 30) {
          reason = "snapshot_too_old";
        } else if (
          best.score < 70 ||
          samePlatformComparableCount < 3 ||
          samePlatformPricedComparableCount < 3 ||
          reuseKind !== "same_platform_comparables"
        ) {
          reason = "score_below_threshold";
        } else {
          shouldReuse = true;
          reason = "advisory_reuse_candidate";
        }
      } else {
        // Fenêtre de dates ne correspond pas
        shouldReuse = false;
        reason = "date_window_mismatch";
      }
    } else {
      // Ancien comportement si pas de checkIn/checkOut
      if (!country) {
        reason = "missing_location_for_reuse";
      } else if (!city && !geoMatched) {
        reason = "missing_city_for_reuse";
      } else if (reuseKind === "cross_platform_pricing_only") {
        reason = "cross_platform_pricing_only";
      } else if (comparables.length < 3) {
        reason = "insufficient_comparables";
      } else if (samePlatformPricedComparableCount < 3) {
        reason = "insufficient_priced_same_platform_comparables";
      } else if (best.freshnessDays != null && best.freshnessDays > 30) {
        reason = "snapshot_too_old";
      } else if (
        best.score < 70 ||
        samePlatformComparableCount < 3 ||
        samePlatformPricedComparableCount < 3 ||
        reuseKind !== "same_platform_comparables"
      ) {
        reason = "score_below_threshold";
      } else {
        shouldReuse = true;
        reason = "advisory_reuse_candidate";
      }
    }

    const result: LookupMarketSnapshotResult = {
      shouldReuse,
      reason,
      score: best.score,
      snapshotsFound: snapshots.length,
      comparablesFound: comparables.length,
      samePlatformComparableCount,
      samePlatformPricedComparableCount,
      crossPlatformComparableCount,
      countsByPlatform,
      reuseKind,
      shadowComparables,
      bestSnapshotId: best.snapshot.id,
      freshnessDays: best.freshnessDays,
      matchedBy,
      observedFallbackComparableCount,
      sameSeasonWindow,
      nearbyGeoMatch,
      geoDistanceKm,
      propertyTypeCompatible,
      reuseTier,
    };
    mmLookupLog("reuse-tier-analysis", {
      route: input.route ?? null,
      reuseTier,
      geoDistanceKm,
      sameSeasonWindow,
      nearbyGeoMatch,
      propertyTypeCompatible,
      score: result.score,
      freshnessDays: result.freshnessDays ?? null,
      samePlatformComparableCount: result.samePlatformComparableCount,
      samePlatformPricedComparableCount: result.samePlatformPricedComparableCount,
      bestSnapshotId: result.bestSnapshotId ?? null,
    });
    mmLookupLog("lookup-result", { ...summarizeLookupResultForLogs(result), observedFallbackComparableCount });

    mmLookupLog("lookup-result", {
      ...summarizeLookupResultForLogs(result),
      requested: {
        city: city != null,
        country: country != null,
        propertyType: propertyType != null,
        nights: nights != null,
        dateWindow: checkIn != null && checkOut != null,
        geo: hasCoordinates(input.latitude, input.longitude),
      },
    });

    if (shouldReuse) {
      mmLookupLog("would-reuse", {
        bestSnapshotId: result.bestSnapshotId,
        score: result.score,
        comparablesFound: result.comparablesFound,
        samePlatformComparableCount: result.samePlatformComparableCount,
        samePlatformPricedComparableCount: result.samePlatformPricedComparableCount,
        crossPlatformComparableCount: result.crossPlatformComparableCount,
        countsByPlatform: result.countsByPlatform,
        reuseKind: result.reuseKind,
        freshnessDays: result.freshnessDays,
      });
    } else {
      mmLookupLog("skip-reason", {
        reason: inferSkipReason(result),
        bestSnapshotId: result.bestSnapshotId,
        score: result.score,
        comparablesFound: result.comparablesFound,
        samePlatformComparableCount: result.samePlatformComparableCount,
        samePlatformPricedComparableCount: result.samePlatformPricedComparableCount,
        crossPlatformComparableCount: result.crossPlatformComparableCount,
        countsByPlatform: result.countsByPlatform,
        reuseKind: result.reuseKind,
        freshnessDays: result.freshnessDays,
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const result = emptyResult(`lookup_exception:${message}`);
    mmLookupLog("skip-reason", { reason: result.reason });
    return result;
  }
}

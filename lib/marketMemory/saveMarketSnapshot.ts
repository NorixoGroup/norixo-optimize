import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { parseBookingStayNightsFromUrl } from "@/lib/extractors/booking-url";
import type { ExtractedListing } from "@/lib/extractors/types";

const DEBUG_MM =
  process.env.DEBUG_MARKET_MEMORY === "true" ||
  process.env.DEBUG_MARKET_PIPELINE === "true" ||
  process.env.DEBUG_BOOKING_PIPELINE === "true";

const ENABLE_MARKET_MEMORY_OBSERVED_FALLBACK_PERSIST =
  process.env.ENABLE_MARKET_MEMORY_OBSERVED_FALLBACK_PERSIST === "true" || DEBUG_MM;

function mmLog(kind: string, payload?: Record<string, unknown>) {
  if (!DEBUG_MM) return;
  const line = `[market-memory][${kind}] ${JSON.stringify(payload ?? {})}`;
  console.warn(line);
}

export type MarketSnapshotBundleMeta = {
  attempted: number;
  selected: number;
  radiusKm: number;
  maxResults: number;
};

export type SaveMarketSnapshotInput = {
  target: ExtractedListing;
  competitors: ExtractedListing[];
  observedFallbackComparables?: ExtractedListing[];
  bundle: MarketSnapshotBundleMeta;
  /** Contexte additionnel (ex. listing_id, route) — jamais bloquant. */
  extraMetadata?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function locationCityCountry(target: ExtractedListing): { city: string | null; country: string | null } {
  const loc = (target as { location?: unknown }).location;
  if (!isRecord(loc)) return { city: null, country: null };
  const city = normalizeNullableText(loc.city);
  const country = normalizeNullableText(loc.country);
  return { city, country };
}

function looksLikeGeoLabelPart(value: string): boolean {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!normalized) return false;
  if (/\d/.test(normalized)) return false;
  if (/[&/|]/.test(value)) return false;
  if (
    /\b(hotel|hotel|riad|dar|villa|appartement|apartment|maison|house|palais|palace|spa|resort|guesthouse)\b/.test(
      normalized
    )
  ) {
    return false;
  }
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 4;
}

function extractGeoFromLocationLabel(value: unknown): {
  city: string | null;
  country: string | null;
  citySource: string | null;
  countrySource: string | null;
} {
  const label = normalizeNullableText(value);
  if (!label) {
    return { city: null, country: null, citySource: null, countrySource: null };
  }
  const parts = label.split(",").map((part) => normalizeNullableText(part)).filter((part): part is string => Boolean(part));
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    return {
      city: looksLikeGeoLabelPart(first) ? first : null,
      country: looksLikeGeoLabelPart(last) && last !== first ? last : null,
      citySource: looksLikeGeoLabelPart(first) ? "locationLabel.city" : null,
      countrySource: looksLikeGeoLabelPart(last) && last !== first ? "locationLabel.country" : null,
    };
  }
  if (parts.length === 1 && looksLikeGeoLabelPart(parts[0])) {
    return { city: parts[0], country: null, citySource: "locationLabel.city", countrySource: null };
  }
  return { city: null, country: null, citySource: null, countrySource: null };
}

function extractComparableCityCountry(comparable: ExtractedListing): {
  city: string | null;
  country: string | null;
  citySource: string | null;
  countrySource: string | null;
} {
  const topLevelCity = normalizeNullableText((comparable as { city?: unknown }).city);
  const topLevelCountry = normalizeNullableText((comparable as { country?: unknown }).country);
  const location = (comparable as { location?: unknown }).location;
  const locationCity = isRecord(location) ? normalizeNullableText(location.city) : null;
  const locationCountry = isRecord(location) ? normalizeNullableText(location.country) : null;
  const labelGeo = extractGeoFromLocationLabel(comparable.locationLabel);
  const structureLabelGeo = extractGeoFromLocationLabel(comparable.structure?.locationLabel);

  return {
    city:
      topLevelCity ??
      locationCity ??
      labelGeo.city ??
      structureLabelGeo.city ??
      null,
    country:
      topLevelCountry ??
      locationCountry ??
      labelGeo.country ??
      structureLabelGeo.country ??
      null,
    citySource:
      (topLevelCity ? "top_level_city" : null) ??
      (locationCity ? "location.city" : null) ??
      labelGeo.citySource ??
      (structureLabelGeo.citySource ? "structure.locationLabel.city" : null) ??
      null,
    countrySource:
      (topLevelCountry ? "top_level_country" : null) ??
      (locationCountry ? "location.country" : null) ??
      labelGeo.countrySource ??
      (structureLabelGeo.countrySource ? "structure.locationLabel.country" : null) ??
      null,
  };
}

function parseBookingStayDatesFromUrl(url: string): { checkIn: string | null; checkOut: string | null } {
  try {
    const sp = new URL(url.trim()).searchParams;
    const ci = sp.get("checkin")?.trim() ?? "";
    const co = sp.get("checkout")?.trim() ?? "";
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (iso.test(ci) && iso.test(co)) return { checkIn: ci, checkOut: co };
  } catch {
    /* ignore */
  }
  return { checkIn: null, checkOut: null };
}

function snapshotStayFields(target: ExtractedListing): {
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
} {
  const nights =
    typeof target.stayNights === "number" && Number.isFinite(target.stayNights) && target.stayNights > 0
      ? Math.floor(target.stayNights)
      : parseBookingStayNightsFromUrl(target.url ?? "");
  if (target.platform === "booking" && typeof target.url === "string") {
    const { checkIn, checkOut } = parseBookingStayDatesFromUrl(target.url);
    return { checkIn, checkOut, nights };
  }
  return { checkIn: null, checkOut: null, nights };
}

function buildQuerySignature(parts: {
  platform: string;
  city: string | null;
  country: string | null;
  propertyType: string | null;
  radiusKm: number;
  maxResults: number;
  sourceUrl: string | null;
}): string {
  const payload = [
    parts.platform,
    parts.city ?? "",
    parts.country ?? "",
    parts.propertyType ?? "",
    String(parts.radiusKm),
    String(parts.maxResults),
    (parts.sourceUrl ?? "").trim().slice(0, 512),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function comparableUrl(c: ExtractedListing): string {
  const u = (c.url || c.sourceUrl || c.canonicalUrl || "").trim();
  return u;
}

function normalizedSignatureForComparable(c: ExtractedListing): string {
  const parts = [
    c.platform,
    comparableUrl(c).toLowerCase(),
    (c.title || "").slice(0, 160),
    (c.locationLabel || "").slice(0, 120),
    c.price != null && Number.isFinite(c.price) ? String(Math.round(c.price * 100) / 100) : "",
    c.latitude ?? "",
    c.longitude ?? "",
  ].join("|");
  return createHash("sha256").update(parts).digest("hex");
}

function dedupeKeyForComparable(c: ExtractedListing): string {
  const url = comparableUrl(c).toLowerCase();
  if (url.length > 0) return `url:${url}`;
  return `sig:${normalizedSignatureForComparable(c)}`;
}

function slimRawComparable(c: ExtractedListing): Record<string, unknown> {
  const desc =
    typeof c.description === "string" && c.description.length > 4000
      ? `${c.description.slice(0, 4000)}…`
      : c.description;
  return {
    ...c,
    description: desc,
    photos: Array.isArray(c.photos) ? c.photos.slice(0, 30) : c.photos,
  } as unknown as Record<string, unknown>;
}

function withComparableMemoryMetadata(
  comparable: ExtractedListing,
  origin: "final_selected" | "fallback_observed_only"
): Record<string, unknown> {
  const raw = slimRawComparable(comparable);
  const existingMarketMemory = isRecord(raw._marketMemory) ? raw._marketMemory : null;
  return {
    ...raw,
    _marketMemory: {
      ...(existingMarketMemory ?? {}),
      comparableOrigin: origin,
      observedOnly: origin === "fallback_observed_only",
    },
  };
}

function rawComparableRecord(comparable: ExtractedListing): Record<string, unknown> | null {
  const raw = (comparable as { raw?: unknown }).raw;
  return isRecord(raw) ? raw : null;
}

function finitePositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function extractComparableCurrency(comparable: ExtractedListing): {
  value: string | null;
  source: string | null;
} {
  const topLevel = normalizeNullableText(comparable.currency);
  if (topLevel) {
    return { value: topLevel.toUpperCase(), source: "top_level_currency" };
  }
  const raw = rawComparableRecord(comparable);
  const rawCurrency =
    normalizeNullableText(raw?.currency) ??
    normalizeNullableText(raw?.priceCurrency) ??
    normalizeNullableText(raw?.currencyCode);
  if (rawCurrency) {
    return { value: rawCurrency.toUpperCase(), source: "raw_currency" };
  }
  return { value: null, source: null };
}

function extractComparablePropertyType(comparable: ExtractedListing): {
  value: string | null;
  source: string | null;
} {
  const topLevel = normalizeNullableText(comparable.propertyType);
  if (topLevel) {
    return { value: topLevel, source: "top_level_property_type" };
  }
  const raw = rawComparableRecord(comparable);
  const rawType = normalizeNullableText(raw?.propertyType) ?? normalizeNullableText(raw?.type);
  if (rawType) {
    return { value: rawType, source: "raw_property_type" };
  }
  return { value: null, source: null };
}

function extractComparableTotalPrice(comparable: ExtractedListing): {
  value: number | null;
  source: string | null;
} {
  const topLevel = finitePositiveNumber(comparable.rawStayPrice);
  if (topLevel != null) {
    return { value: Math.round(topLevel * 100) / 100, source: "top_level_rawStayPrice" };
  }
  const raw = rawComparableRecord(comparable);
  const rawTotal =
    finitePositiveNumber(raw?.rawStayPrice) ??
    finitePositiveNumber(raw?.totalPrice) ??
    finitePositiveNumber(raw?.stayTotalPrice) ??
    finitePositiveNumber(raw?.total);
  if (rawTotal != null) {
    return { value: Math.round(rawTotal * 100) / 100, source: "raw_total_price" };
  }
  return { value: null, source: null };
}

function buildCountsByPlatform(competitors: ExtractedListing[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const competitor of competitors) {
    const platform =
      typeof competitor.platform === "string" && competitor.platform.trim().length > 0
        ? competitor.platform.trim().toLowerCase()
        : "other";
    counts.set(platform, (counts.get(platform) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Persiste un snapshot marché + comparables (append-only).
 * Ne lance jamais d’erreur : en cas d’échec, log warning uniquement.
 */
export async function saveMarketSnapshot(input: SaveMarketSnapshotInput): Promise<void> {
  try {
    const { city, country } = locationCityCountry(input.target);
    const platform = input.target.platform ?? "other";
    const propertyType =
      typeof input.target.propertyType === "string" && input.target.propertyType.trim()
        ? input.target.propertyType.trim()
        : null;
    const sourceUrl =
      typeof input.target.url === "string" && input.target.url.trim()
        ? input.target.url.trim()
        : typeof input.target.sourceUrl === "string"
          ? input.target.sourceUrl.trim()
          : null;
    const querySignature = buildQuerySignature({
      platform,
      city,
      country,
      propertyType,
      radiusKm: input.bundle.radiusKm,
      maxResults: input.bundle.maxResults,
      sourceUrl,
    });
    const { checkIn, checkOut, nights } = snapshotStayFields(input.target);
    const hasFinalCompetitors = input.competitors.length > 0;
    const hasObservedFallbackComparables =
      Array.isArray(input.observedFallbackComparables) &&
      input.observedFallbackComparables.length > 0;

    if (!hasFinalCompetitors && !hasObservedFallbackComparables) {
      mmLog("snapshot-skip-empty", {
        route:
          typeof input.extraMetadata?.route === "string" ? input.extraMetadata.route : null,
        platform,
        city,
        country,
        propertyType,
        checkIn,
        checkOut,
        nights,
      });
      return;
    }

    const admin = createSupabaseAdminClient();

    const checkInDate = checkIn;
    const checkOutDate = checkOut;

    const metadata = {
      ...input.extraMetadata,
      bundle: {
        attempted: input.bundle.attempted,
        selected: input.bundle.selected,
        radiusKm: input.bundle.radiusKm,
        maxResults: input.bundle.maxResults,
      },
      market_memory: {
        observedFallbackComparablesProvided: Array.isArray(input.observedFallbackComparables)
          ? input.observedFallbackComparables.length
          : 0,
      },
    };
    const snapshotPlatform = platform.trim().toLowerCase();
    const countsByPlatform = buildCountsByPlatform(input.competitors);
    const mixedPlatformSnapshot = Object.keys(countsByPlatform).some(
      (comparablePlatform) => comparablePlatform !== snapshotPlatform
    );
    mmLog("snapshot-platform-composition", {
      snapshotPlatform,
      countsByPlatform,
      mixedPlatformSnapshot,
      comparableCount: input.competitors.length,
    });

    const seen = new Set<string>();
    let skipped = 0;
    let comparableGeoLogCount = 0;
    let comparableFieldFallbackLogCount = 0;

    const buildRowsForComparables = (
      comparables: ExtractedListing[],
      origin: "final_selected" | "fallback_observed_only"
    ): Array<Record<string, unknown>> => {
      const builtRows: Array<Record<string, unknown>> = [];
      for (const c of comparables) {
        const key = `${origin}:${dedupeKeyForComparable(c)}`;
        if (seen.has(key)) {
          skipped += 1;
          mmLog("dedupe-skipped", { key: key.slice(0, 80) });
          continue;
        }
        seen.add(key);
        const url = comparableUrl(c) || null;
        const sig = normalizedSignatureForComparable(c);
        const compStay = snapshotStayFields(c);
        const ratingVal =
          typeof c.rating === "number" && Number.isFinite(c.rating)
            ? c.rating
            : typeof c.ratingValue === "number" && Number.isFinite(c.ratingValue)
              ? c.ratingValue
              : null;
        const reviewCount =
          typeof c.reviewCount === "number" && Number.isFinite(c.reviewCount)
            ? Math.floor(c.reviewCount)
            : null;
        const comparableGeo = extractComparableCityCountry(c);
        const comparableCity = comparableGeo.city ?? city;
        const comparableCountry = comparableGeo.country ?? country;
        const comparableCurrency = extractComparableCurrency(c);
        const comparablePropertyType = extractComparablePropertyType(c);
        const comparableTotalPrice = extractComparableTotalPrice(c);
        if (comparableGeoLogCount < 8) {
          comparableGeoLogCount += 1;
          mmLog("comparable-geo-write", {
            comparablePlatform: c.platform ?? "other",
            hasComparableCity: comparableCity != null,
            hasComparableCountry: comparableCountry != null,
            usedCitySource: comparableGeo.citySource,
            usedCountrySource: comparableGeo.countrySource,
            url: url ? url.slice(0, 160) : null,
          });
        }
        if (comparableFieldFallbackLogCount < 8) {
          comparableFieldFallbackLogCount += 1;
          mmLog("comparable-field-fallback", {
            platform: c.platform ?? "other",
            usedCurrencySource: comparableCurrency.source,
            usedPropertyTypeSource: comparablePropertyType.source,
            usedTotalPriceSource: comparableTotalPrice.source,
            url: url ? url.slice(0, 160) : null,
          });
        }
        const nightlyPrice =
          typeof c.price === "number" && Number.isFinite(c.price)
            ? Math.round(c.price * 100) / 100
            : null;

        const shouldSkipIncompleteComparable =
          !url ||
          comparableCity == null ||
          comparableCountry == null ||
          comparablePropertyType.value == null ||
          nightlyPrice == null ||
          nightlyPrice <= 0 ||
          comparableCurrency.value == null;

        if (shouldSkipIncompleteComparable) {
          skipped += 1;
          mmLog("comparable-skip-incomplete", {
            platform: c.platform ?? "other",
            hasUrl: Boolean(url),
            hasCity: comparableCity != null,
            hasCountry: comparableCountry != null,
            hasPropertyType: comparablePropertyType.value != null,
            hasNightlyPrice: nightlyPrice != null && nightlyPrice > 0,
            hasCurrency: comparableCurrency.value != null,
            url: url ? url.slice(0, 160) : null,
            origin,
          });
          continue;
        }

        builtRows.push({
          platform: c.platform ?? "other",
          url,
          title: typeof c.title === "string" ? c.title.slice(0, 2000) : null,
          city: comparableCity,
          country: comparableCountry,
          property_type: comparablePropertyType.value,
          nightly_price: nightlyPrice,
          total_price: comparableTotalPrice.value,
          currency: comparableCurrency.value,
          rating: ratingVal,
          review_count: reviewCount,
          latitude:
            typeof c.latitude === "number" && Number.isFinite(c.latitude)
              ? Math.round(c.latitude * 1e6) / 1e6
              : null,
          longitude:
            typeof c.longitude === "number" && Number.isFinite(c.longitude)
              ? Math.round(c.longitude * 1e6) / 1e6
              : null,
          check_in: compStay.checkIn,
          check_out: compStay.checkOut,
          nights: compStay.nights,
          raw: withComparableMemoryMetadata(c, origin),
          normalized_signature: sig,
        });
      }
      return builtRows;
    };

    const rows = buildRowsForComparables(input.competitors, "final_selected");
    const shouldPersistObservedFallbackComparables =
      ENABLE_MARKET_MEMORY_OBSERVED_FALLBACK_PERSIST &&
      rows.length === 0 &&
      input.bundle.selected === 0 &&
      Array.isArray(input.observedFallbackComparables) &&
      input.observedFallbackComparables.length > 0;
    const observedRows = shouldPersistObservedFallbackComparables
      ? buildRowsForComparables(input.observedFallbackComparables ?? [], "fallback_observed_only")
      : [];

    const { data: snap, error: snapErr } = await admin
      .from("market_snapshots")
      .insert({
        platform,
        city,
        country,
        property_type: propertyType,
        check_in: checkInDate,
        check_out: checkOutDate,
        nights,
        source_url: sourceUrl,
        query_signature: querySignature,
        comparable_count: input.competitors.length,
        confidence_score: null,
        metadata,
      })
      .select("id")
      .single();

    if (snapErr || !snap?.id) {
      mmLog("save-error", { phase: "snapshot", message: snapErr?.message ?? "no id" });
      return;
    }

    mmLog("snapshot-created", {
      snapshotId: snap.id,
      comparableCount: input.competitors.length,
      skipped,
      observedFallbackComparableCount: observedRows.length,
    });

    const rowsToPersist = rows.length > 0 ? rows : observedRows;

    if (rowsToPersist.length === 0) {
      mmLog("comparables-saved", { snapshotId: snap.id, inserted: 0 });
      return;
    }

    const withSnapshot = rowsToPersist.map((r) => ({ ...r, snapshot_id: snap.id }));
    const { error: compErr } = await admin.from("market_comparables").insert(withSnapshot);
    if (compErr) {
      mmLog("save-error", { phase: "comparables", message: compErr.message, snapshotId: snap.id });
      return;
    }

    if (rows.length === 0 && observedRows.length > 0) {
      mmLog("fallback-observed-persist", {
        snapshotId: snap.id,
        observedCount: input.observedFallbackComparables?.length ?? 0,
        persistedCount: observedRows.length,
        platforms: buildCountsByPlatform(input.observedFallbackComparables ?? []),
        selectedFinalCount: input.bundle.selected,
      });
    }

    mmLog("comparables-saved", { snapshotId: snap.id, inserted: rowsToPersist.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mmLog("save-error", { phase: "outer", message: msg });
  }
}

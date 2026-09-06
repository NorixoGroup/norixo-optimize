import { chromium } from "playwright";
import type { CompetitorCandidate } from "./types";
import type { ExtractedListing } from "@/lib/extractors/types";
import { getNormalizedComparableType } from "./filterComparableListings";

function extractAirbnbRoomId(url?: string | null) {
  return url?.match(/\/rooms\/(\d+)/)?.[1] ?? null;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getBrightDataCdpEndpoint() {
  const browserHost = readEnv("BRIGHTDATA_BROWSER_HOST");
  const browserUsername = readEnv("BRIGHTDATA_BROWSER_USERNAME");
  const browserPassword = readEnv("BRIGHTDATA_BROWSER_PASSWORD");

  if (browserHost && browserUsername && browserPassword) {
    const port = readEnv("BRIGHTDATA_BROWSER_PORT") ?? "9222";
    const hostWithPort = browserHost.includes(":") ? browserHost : `${browserHost}:${port}`;
    return `wss://${encodeURIComponent(browserUsername)}:${encodeURIComponent(
      browserPassword
    )}@${hostWithPort}`;
  }

  const host = readEnv("BRIGHTDATA_HOST");
  const port = readEnv("BRIGHTDATA_PORT");
  const username = readEnv("BRIGHTDATA_USERNAME");
  const password = readEnv("BRIGHTDATA_PASSWORD");

  if (!host || port !== "9222" || !username || !password) return null;

  const hostWithPort = host.includes(":") ? host : `${host}:${port}`;
  return `wss://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostWithPort}`;
}

function normalizeSearchToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s,-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const AIRBNB_MARRAKECH_LOCAL_TOKENS = [
  "marrakech",
  "marrakesh",
  "gueliz",
  "hivernage",
  "medina",
  "menara",
  "abouab",
  "majorelle",
] as const;

const AIRBNB_GLOBAL_MISMATCH_TOKENS = [
  "japan",
  "tokyo",
  "kyoto",
  "usa",
  "united states",
  "new york",
  "california",
  "finland",
  "helsinki",
  "uruguay",
  "montevideo",
  "vietnam",
  "hanoi",
  "ho chi minh",
  "germany",
  "berlin",
  "munich",
] as const;

type AirbnbGeoCandidate = {
  url: string;
  title: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type AirbnbGeoContext = {
  targetCity: string | null;
  targetCountry: string | null;
  hasReliableLocationContext: boolean;
  hasTargetCoordinates: boolean;
  targetLatitude: number | null;
  targetLongitude: number | null;
  enforceMarrakechStrictTextFilter: boolean;
};

const AIRBNB_TITLE_NOISE_RULES: Array<{ token: RegExp; reason: string; penalty: number }> = [
  { token: /\bjacuzzi\b/i, reason: "jacuzzi", penalty: 4 },
  { token: /\bspa\b/i, reason: "spa", penalty: 4 },
  { token: /\bsauna\b/i, reason: "sauna", penalty: 4 },
  { token: /\blove\s*room\b/i, reason: "love_room", penalty: 5 },
  { token: /\bromantic\s+night\b/i, reason: "romantic_night", penalty: 4 },
  { token: /\bluxury\b/i, reason: "luxury", penalty: 3 },
  { token: /\bvilla\b/i, reason: "villa", penalty: 3 },
  { token: /\bxxl\b/i, reason: "xxl", penalty: 2 },
] as const;

function normalizeLower(value: string | null | undefined): string {
  return normalizeSearchToken(value ?? "").toLowerCase();
}

function getAirbnbGeoCityAliases(city: string | null): string[] {
  if (!city) return [];
  switch (city) {
    case "barcelone":
      return [
        "barcelona",
        "hospitalet",
        "l hospitalet",
        "hospitalet de llobregat",
        "sant boi",
        "sant just",
        "sant just desvern",
      ];
    default:
      return [];
  }
}

function safeFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function shouldPenalizeNoisyAirbnbTitles(target: ExtractedListing): {
  enabled: boolean;
  targetType: string;
  targetPrice: number | null;
} {
  const targetType = getNormalizedComparableType(target);
  const targetPrice = safeFiniteNumber(target.price);
  if (targetType === "studio_like") {
    return { enabled: true, targetType, targetPrice };
  }
  if (targetType === "apartment_like" && targetPrice != null && targetPrice <= 150) {
    return { enabled: true, targetType, targetPrice };
  }
  return { enabled: false, targetType, targetPrice };
}

function getAirbnbTitleNoisePenalty(title: string | null | undefined): {
  reasons: string[];
  penalty: number;
} {
  const value = typeof title === "string" ? title.trim() : "";
  if (!value) return { reasons: [], penalty: 0 };
  const reasons: string[] = [];
  let penalty = 0;
  for (const rule of AIRBNB_TITLE_NOISE_RULES) {
    if (!rule.token.test(value)) continue;
    reasons.push(rule.reason);
    penalty += rule.penalty;
  }
  return { reasons, penalty };
}

function combinedNormalizedText(parts: Array<string | null | undefined>): string {
  return normalizeLower(parts.filter((part): part is string => typeof part === "string" && part.trim().length > 0).join(" "));
}

function hasFiniteCoordinates(
  value: Pick<AirbnbGeoCandidate, "latitude" | "longitude">
): value is { latitude: number; longitude: number } {
  return (
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude)
  );
}

function haversineDistanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa =
    s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 6371 * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function inferAirbnbTargetGeoContext(target: ExtractedListing): AirbnbGeoContext {
  const locationSource =
    target.locationLabel ??
    target.structure?.locationLabel ??
    target.locationDetails?.find((value) => typeof value === "string" && value.trim().length > 0) ??
    null;
  const targetCity = extractPrimaryLocationContext(locationSource);
  const normalizedTargetCity = normalizeLower(targetCity);
  const targetGeoText = combinedNormalizedText([
    target.locationLabel,
    target.structure?.locationLabel,
    ...(target.locationDetails ?? []),
    target.title,
    target.url,
  ]);
  const targetCountry =
    /\b(morocco|maroc|marruecos)\b/.test(targetGeoText) || normalizedTargetCity === "marrakech"
      ? "morocco"
      : null;
  const hasTargetCoordinates = hasFiniteCoordinates({
    latitude: target.latitude ?? null,
    longitude: target.longitude ?? null,
  });

  return {
    targetCity: normalizedTargetCity || null,
    targetCountry,
    hasReliableLocationContext: Boolean(normalizedTargetCity || hasTargetCoordinates),
    hasTargetCoordinates,
    targetLatitude: hasTargetCoordinates ? target.latitude ?? null : null,
    targetLongitude: hasTargetCoordinates ? target.longitude ?? null : null,
    enforceMarrakechStrictTextFilter:
      normalizedTargetCity === "marrakech" && targetCountry === "morocco",
  };
}

function logAirbnbGeoStage(payload: Record<string, unknown>): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][airbnb-geo-stage]", JSON.stringify(payload));
}

function logAirbnbGeoRejectedGlobal(payload: Record<string, unknown>): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][airbnb-geo-rejected-global]", JSON.stringify(payload));
}

function logAirbnbGeoRadiusSelected(payload: Record<string, unknown>): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][airbnb-geo-radius-selected]", JSON.stringify(payload));
}

function logAirbnbGeoFinalPool(payload: Record<string, unknown>): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][airbnb-geo-final-pool]", JSON.stringify(payload));
}

function filterAirbnbCandidatesByGeo(
  candidates: AirbnbGeoCandidate[],
  target: ExtractedListing
): AirbnbGeoCandidate[] {
  const geo = inferAirbnbTargetGeoContext(target);
  logAirbnbGeoStage({
    stage: "start",
    targetCity: geo.targetCity,
    targetCountry: geo.targetCountry,
    hasReliableLocationContext: geo.hasReliableLocationContext,
    hasTargetCoordinates: geo.hasTargetCoordinates,
    candidateCount: candidates.length,
  });

  if (!geo.hasReliableLocationContext) {
    logAirbnbGeoRadiusSelected({
      strategy: "no_target_geo_context",
      selectedRadiusKm: null,
      retainedCount: candidates.length,
    });
    return candidates;
  }

  const textFiltered = candidates.filter((candidate) => {
    const candidateText = combinedNormalizedText([candidate.title, candidate.url]);
    if (!candidateText) {
      logAirbnbGeoRejectedGlobal({
        url: candidate.url,
        title: candidate.title ?? null,
        reason: "empty_candidate_text",
        targetCity: geo.targetCity,
        targetCountry: geo.targetCountry,
      });
      return false;
    }

    if (geo.enforceMarrakechStrictTextFilter) {
      const matchedLocalToken =
        AIRBNB_MARRAKECH_LOCAL_TOKENS.find((token) => candidateText.includes(token)) ?? null;
      if (matchedLocalToken) return true;
      const matchedGlobalToken =
        AIRBNB_GLOBAL_MISMATCH_TOKENS.find((token) => candidateText.includes(token)) ?? null;
      logAirbnbGeoRejectedGlobal({
        url: candidate.url,
        title: candidate.title ?? null,
        reason: matchedGlobalToken ? "marrakech_global_token_mismatch" : "marrakech_missing_local_token",
        matchedToken: matchedGlobalToken,
        targetCity: geo.targetCity,
        targetCountry: geo.targetCountry,
      });
      return false;
    }

    if (geo.targetCity && geo.targetCountry !== "morocco") {
      const cityTokens = [geo.targetCity, ...getAirbnbGeoCityAliases(geo.targetCity)];
      const matchedTargetCity = cityTokens.some((token) => candidateText.includes(token));
      if (!matchedTargetCity) {
        logAirbnbGeoRejectedGlobal({
          url: candidate.url,
          title: candidate.title ?? null,
          reason: "missing_target_city_token",
          targetCity: geo.targetCity,
          targetCountry: geo.targetCountry,
        });
        return false;
      }
    }

    if (geo.targetCountry === "morocco") {
      const matchedGlobalToken =
        AIRBNB_GLOBAL_MISMATCH_TOKENS.find((token) => candidateText.includes(token)) ?? null;
      if (matchedGlobalToken) {
        logAirbnbGeoRejectedGlobal({
          url: candidate.url,
          title: candidate.title ?? null,
          reason: "country_global_token_mismatch",
          matchedToken: matchedGlobalToken,
          targetCity: geo.targetCity,
          targetCountry: geo.targetCountry,
        });
        return false;
      }
    }

    return true;
  });

  logAirbnbGeoStage({
    stage: "after_text_filter",
    retainedCount: textFiltered.length,
    rejectedCount: candidates.length - textFiltered.length,
    targetCity: geo.targetCity,
    targetCountry: geo.targetCountry,
  });

  if (
    !geo.hasTargetCoordinates ||
    geo.targetLatitude == null ||
    geo.targetLongitude == null ||
    textFiltered.every((candidate) => !hasFiniteCoordinates(candidate))
  ) {
    logAirbnbGeoRadiusSelected({
      strategy: "text_only",
      selectedRadiusKm: null,
      retainedCount: textFiltered.length,
    });
    return textFiltered;
  }

  const withCoords: Array<AirbnbGeoCandidate & { latitude: number; longitude: number }> = [];
  for (const candidate of textFiltered) {
    if (hasFiniteCoordinates(candidate)) {
      withCoords.push(candidate);
    }
  }
  const withoutCoords = textFiltered.filter((candidate) => !hasFiniteCoordinates(candidate));
  let selectedRadiusKm = 1;
  let withinRadius = withCoords.filter(
    (candidate) =>
      haversineDistanceKm(
        geo.targetLatitude!,
        geo.targetLongitude!,
        candidate.latitude,
        candidate.longitude
      ) <= 1
  );
  if (withinRadius.length < 15) {
    selectedRadiusKm = 5;
    withinRadius = withCoords.filter(
      (candidate) =>
        haversineDistanceKm(
          geo.targetLatitude!,
          geo.targetLongitude!,
          candidate.latitude,
          candidate.longitude
        ) <= 5
    );
  }
  if (withinRadius.length < 15) {
    selectedRadiusKm = 10;
    withinRadius = withCoords.filter(
      (candidate) =>
        haversineDistanceKm(
          geo.targetLatitude!,
          geo.targetLongitude!,
          candidate.latitude,
          candidate.longitude
        ) <= 10
    );
  }
  logAirbnbGeoRadiusSelected({
    strategy: "coordinates",
    selectedRadiusKm,
    withCoordsCount: withCoords.length,
    retainedWithCoordsCount: withinRadius.length,
    retainedWithoutCoordsCount: withoutCoords.length,
  });
  return [...withinRadius, ...withoutCoords];
}



function airbnbSnippetMonthIndex(label: string): number | null {
  const head = label.toLowerCase().replace(/\./g, "").slice(0, 4);

  if (head.startsWith("jan")) return 0;
  if (head.startsWith("feb")) return 1;
  if (head.startsWith("mar")) return 2;
  if (head.startsWith("apr")) return 3;
  if (head.startsWith("may")) return 4;
  if (head.startsWith("jun")) return 5;
  if (head.startsWith("jul")) return 6;
  if (head.startsWith("aug")) return 7;
  if (head.startsWith("sep")) return 8;
  if (head.startsWith("oct")) return 9;
  if (head.startsWith("nov")) return 10;
  if (head.startsWith("dec")) return 11;

  return null;
}

function inferAirbnbSnippetNightsFromTitle(title: string): number | null {
  const t = title
    .replace(/([a-zA-Z])([A-Z][a-z]{2}\b)/g, "$1 $2")
    .replace(/(\d)([A-Z][a-z]{2}\b)/g, "$1 $2")
    .replace(/(\d)(€|\$|£)/g, "$1 $2")
    .replace(/\s+/g, " ");

  const monthSeg =
    "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z.]*";

  const cross = t.match(
    new RegExp(
      `\\b${monthSeg}\\s+(\\d{1,2})\\s*[–\\u2013\\-]\\s*${monthSeg}\\s+(\\d{1,2})\\b`,
      "i"
    )
  );

  if (cross) {
    const m1 = airbnbSnippetMonthIndex(cross[1] ?? "");
    const d1 = Number.parseInt(cross[2] ?? "", 10);
    const m2 = airbnbSnippetMonthIndex(cross[3] ?? "");
    const d2 = Number.parseInt(cross[4] ?? "", 10);

    if (
      m1 == null ||
      m2 == null ||
      !Number.isFinite(d1) ||
      !Number.isFinite(d2)
    ) {
      return null;
    }

    const year = new Date().getUTCFullYear();

    const t1 = Date.UTC(year, m1, d1);
    let t2 = Date.UTC(year, m2, d2);

    if (t2 <= t1) {
      t2 = Date.UTC(year + 1, m2, d2);
    }

    const days = Math.round((t2 - t1) / 86400000);

    return days > 0 ? days : null;
  }

  const same = t.match(
    new RegExp(
      `\\b${monthSeg}\\s+(\\d{1,2})\\s*[–\\u2013\\-]\\s+(\\d{1,2})\\b`,
      "i"
    )
  );

  if (same) {
    const d1 = Number.parseInt(same[2] ?? "", 10);
    const d2 = Number.parseInt(same[3] ?? "", 10);

    if (
      Number.isFinite(d1) &&
      Number.isFinite(d2) &&
      d2 > d1
    ) {
      return d2 - d1;
    }
  }

  return null;
}


function airbnbStayNightsFromUrl(url: string | null | undefined): number | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const ci = u.searchParams.get("check_in")?.trim();
    const co = u.searchParams.get("check_out")?.trim();
    if (!ci || !co) return null;
    const d1 = Date.parse(ci.slice(0, 10));
    const d2 = Date.parse(co.slice(0, 10));
    if (!Number.isFinite(d1) || !Number.isFinite(d2)) return null;
    const nights = Math.round((d2 - d1) / 86_400_000);
    return nights > 0 ? nights : null;
  } catch {
    return null;
  }
}

function parseAirbnbSnippetPriceNumber(raw: string): number | null {
  let value = raw.replace(/[^\d.,\s]/g, "").replace(/\s+/g, "").trim();
  if (!value) return null;
  const hasComma = value.includes(",");
  const hasDot = value.includes(".");
  if (hasComma && hasDot) {
    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");
    value =
      lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (hasComma) {
    value = /^\d+,\d{1,2}$/.test(value) ? value.replace(",", ".") : value.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, "");
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseAirbnbSnippetCurrency(text: string): string | null {
  if (text.includes("€") || /\bEUR\b/i.test(text)) return "EUR";
  if (text.includes("$") || /\bUSD\b/i.test(text)) return "USD";
  if (text.includes("£") || /\bGBP\b/i.test(text)) return "GBP";
  if (/\bMAD\b|\bDH\b|د\.?\s?م\.?/i.test(text)) return "MAD";
  return null;
}

type AirbnbSnippetPricingResult = {
  price: number | null;
  currency: string | null;
  rawStayPrice: number | null;
  stayNights: number | null;
  priceBasis: ExtractedListing["priceBasis"] | undefined;
  source: "nightly" | "total" | null;
  rawTotalMatched: string | null;
};

function parseAirbnbSearchSnippetPricing(
  text: string,
  targetStayNights: number | null
): AirbnbSnippetPricingResult {
  const normalized = text
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/(\d)(€|\$|£)/g, "$1 $2")
    .replace(/\b(total|totale)(Show|Free)\b/gi, "$1 $2")
    .replace(/\b(per\s+night|par\s+nuit|night)(Show|Free)\b/gi, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const currency = parseAirbnbSnippetCurrency(normalized);
  const nightlyMatch =
    normalized.match(
      /(?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?)\s*([\d\s.,]+)\s*(?:\/\s*n(?:ight|uit)|per\s+night|par\s+nuit)\b/i
    ) ??
    normalized.match(
      /([\d\s.,]+)\s*(?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?)\s*(?:\/\s*n(?:ight|uit)|per\s+night|par\s+nuit)\b/i
    ) ??
    normalized.match(
      /(?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?)\s*([\d\s.,]+)\s*night\b/i
    ) ??
    normalized.match(
      /([\d\s.,]+)\s*(?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?)\s*night\b/i
    );
  if (nightlyMatch?.[1]) {
    const nightlyPrice = parseAirbnbSnippetPriceNumber(nightlyMatch[1]);
    if (nightlyPrice != null) {
      return {
        price: Math.round(nightlyPrice * 100) / 100,
        currency,
        rawStayPrice:
          targetStayNights != null && targetStayNights > 0
            ? Math.round(nightlyPrice * targetStayNights * 100) / 100
            : null,
        stayNights: targetStayNights,
        priceBasis: "nightly",
        source: "nightly",
        rawTotalMatched: null,
      };
    }
  }

  const totalMatch =
    normalized.match(
      /((?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?)\s*([\d][\d\s.,]{0,12}))\s*(?:au\s+total|total|totale)\b/i
    ) ??
    normalized.match(
      /(([\d][\d\s.,]{0,12})\s*(?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?))\s*(?:au\s+total|total|totale)\b/i
    );
  if (totalMatch?.[1] && totalMatch?.[2]) {
    const rawTotalMatched = totalMatch[1].trim();
    const totalPrice = parseAirbnbSnippetPriceNumber(totalMatch[2]);
    if (totalPrice != null) {
      const inferredStayNights =
        targetStayNights != null && targetStayNights > 0
          ? targetStayNights
          : inferAirbnbSnippetNightsFromTitle(normalized);

      const nightlyPrice =
        inferredStayNights != null && inferredStayNights > 0
          ? Math.round((totalPrice / inferredStayNights) * 100) / 100
          : null;
      return {
        price: nightlyPrice,
        currency,
        rawStayPrice: Math.round(totalPrice * 100) / 100,
        stayNights: inferredStayNights,
        priceBasis: nightlyPrice != null ? "nightly" : undefined,
        source: "total",
        rawTotalMatched,
      };
    }
  }

  return {
    price: null,
    currency,
    rawStayPrice: null,
    stayNights: targetStayNights,
    priceBasis: undefined,
    source: null,
    rawTotalMatched: null,
  };
}

function isVillaTypedSearchQuery(q: string): boolean {
  const n = normalizeSearchToken(q);
  if (!n) return false;
  const lower = n.toLowerCase();
  if (/\b(villa|villas|maison|house)\b/.test(lower)) return true;
  if (/\bprivate\b/.test(lower) && /\bvilla\b/.test(lower)) return true;
  return false;
}

function logAirbnbDiscoveryQuery(payload: {
  query: string;
  linksCount: number;
  collectedCount: number;
  sampleTitles: string[];
}): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][airbnb-discovery-query]", JSON.stringify(payload));
}

function logAirbnbBuiltQuery(payload: {
  query: string;
  source: "location" | "title_with_city" | "title" | "fallback";
  hasLocationContext: boolean;
}): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][airbnb-query-built]", JSON.stringify(payload));
}

function logAirbnbQueryGuard(payload: {
  originalQuery: string;
  guardedQuery: string;
  reason: "title_only_replaced_with_city" | "title_only_fallback_replaced_with_city";
  locationContext: string;
}): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][airbnb-query-guard]", JSON.stringify(payload));
}

function extractPrimaryLocationContext(locationLabel: string | null | undefined): string {
  const normalizedLocation = normalizeSearchToken(locationLabel ?? "");
  if (!normalizedLocation) return "";
  return normalizedLocation.split(",")[0]?.trim() || normalizedLocation;
}

function extractLocationHintsFromHtml(html: string) {
  const locality = html.match(/"addressLocality":"([^"]+)"/i)?.[1] ?? null;
  const canonicalTitle =
    html.match(/<title>([^<]+)<\/title>/i)?.[1]?.replace(/\s*-\s*Airbnb\s*$/i, "") ?? null;

  const titleLocation = canonicalTitle?.split(" - ").find((segment) => segment.includes(","));

  return [locality, titleLocation, canonicalTitle]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(normalizeSearchToken);
}

function buildOrderedAirbnbSearchQueries(input: {
  htmlHints: string[];
  locationLabel: string | null | undefined;
  title: string | null | undefined;
  fallbackQuery: string;
}): string[] {
  const explicitOrdered: string[] = [];
  const seenExplicit = new Set<string>();
  const locationQuery = normalizeSearchToken(input.locationLabel ?? "");
  const titleQuery = normalizeSearchToken(input.title ?? "");
  const fallbackQuery = normalizeSearchToken(input.fallbackQuery ?? "");
  const locationContext = extractPrimaryLocationContext(input.locationLabel);
  const hasLocationContext = Boolean(locationContext);

  const addExplicitQuery = (
    query: string,
    source: "location" | "title_with_city" | "title" | "fallback"
  ) => {
    const normalizedQuery = query.trim();
    if (
      /^(residence de tourisme|tourisme|apartamento|vivienda rentada|vivienda)$/i.test(
        normalizedQuery
      )
    ) {
      logAirbnbQueryGuard({
        originalQuery: query,
        guardedQuery: "",
        reason: "title_only_replaced_with_city",
        locationContext,
      });
      return;
    }

    if (!query || seenExplicit.has(query)) return;
    seenExplicit.add(query);
    explicitOrdered.push(query);
    logAirbnbBuiltQuery({
      query,
      source,
      hasLocationContext,
    });
  };

  const safeLocationQuery =
    locationQuery &&
    !/^(residence de tourisme|tourisme|apartamento|vivienda rentada|vivienda)$/i.test(
      locationQuery.trim()
    )
      ? locationQuery
      : "";

  addExplicitQuery(safeLocationQuery, "location");

  const isGenericAirbnbSearchQuery = (query: string): boolean =>
    /^(residence de tourisme|tourisme|apartamento|vivienda rentada|vivienda)$/i.test(query.trim());

  let effectiveTitleQuery = titleQuery;
  if (isGenericAirbnbSearchQuery(effectiveTitleQuery)) {
    effectiveTitleQuery = "";
  }

  if (effectiveTitleQuery && hasLocationContext) {
    const titleContainsLocation =
      hasLocationContext && titleQuery.toLowerCase().includes(locationContext.toLowerCase());
    effectiveTitleQuery =
      hasLocationContext && !titleContainsLocation
        ? normalizeSearchToken(locationContext)
        : titleQuery;
    if (hasLocationContext && !titleContainsLocation && effectiveTitleQuery !== titleQuery) {
      logAirbnbQueryGuard({
        originalQuery: titleQuery,
        guardedQuery: effectiveTitleQuery,
        reason: "title_only_replaced_with_city",
        locationContext,
      });
    }
    if (
    effectiveTitleQuery &&
    /^(residence de tourisme|tourisme|apartamento|vivienda rentada|vivienda)$/i.test(
      effectiveTitleQuery.trim()
    )
  ) {
    effectiveTitleQuery = "";
  }

  addExplicitQuery(
      effectiveTitleQuery,
      hasLocationContext && !titleContainsLocation ? "title_with_city" : "title"
    );
  }

  let effectiveFallbackQuery = fallbackQuery;
  if (fallbackQuery && hasLocationContext) {
    const fallbackContainsLocation = fallbackQuery.toLowerCase().includes(locationContext.toLowerCase());
    if (!fallbackContainsLocation) {
      effectiveFallbackQuery = effectiveTitleQuery || normalizeSearchToken(`${fallbackQuery} ${locationContext}`);
      if (effectiveFallbackQuery && effectiveFallbackQuery !== fallbackQuery) {
        logAirbnbQueryGuard({
          originalQuery: fallbackQuery,
          guardedQuery: effectiveFallbackQuery,
          reason: "title_only_fallback_replaced_with_city",
          locationContext,
        });
      }
    }
  }

  if (hasLocationContext) {
    addExplicitQuery(effectiveFallbackQuery, "fallback");
  }

  const priorityExplicit = explicitOrdered.filter(isVillaTypedSearchQuery);
  const restExplicit = explicitOrdered.filter((q) => !isVillaTypedSearchQuery(q));

  const priorityHtml = input.htmlHints.filter((q) => isVillaTypedSearchQuery(q));
  const restHtml = input.htmlHints.filter((q) => !isVillaTypedSearchQuery(q));

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (list: string[]) => {
    for (const q of list) {
      if (!q || seen.has(q)) continue;
      seen.add(q);
      out.push(q);
    }
  };

  push(priorityExplicit);
  push(priorityHtml);
  push(restExplicit);
  push(restHtml);

  return out;
}

export async function searchAirbnbCompetitorCandidates(
  target: ExtractedListing,
  maxResults = 5
): Promise<CompetitorCandidate[]> {
  const fallbackQuery =
    target.locationLabel || target.title || target.description?.slice(0, 80) || "";
  const targetStayNights = airbnbStayNightsFromUrl(target.url ?? null);
  const cdpEndpoint = getBrightDataCdpEndpoint();

  const browser = cdpEndpoint
    ? await chromium.connectOverCDP(cdpEndpoint)
    : await chromium.launch({
        headless: true,
      });

  const page = await browser.newPage();

  try {
    const htmlHints: string[] = [];

    if (target.url) {
      await page.goto(target.url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page.waitForTimeout(5000);

      const html = await page.content();
      for (const value of extractLocationHintsFromHtml(html)) {
        if (value) htmlHints.push(value);
      }
    }

    const queries = buildOrderedAirbnbSearchQueries({
      htmlHints,
      locationLabel: target.locationLabel,
      title: target.title,
      fallbackQuery,
    });

    if (queries.length === 0) {
      await browser.close();
      return [];
    }

    const targetRoomId = extractAirbnbRoomId(target.url);
    const collectedTitles = new Map<string, string | null>();
    const collectCap = Math.max(maxResults * 4, 12);

    const addCollected = (url: string, listingTitle: string | null) => {
      if (targetRoomId && extractAirbnbRoomId(url) === targetRoomId) return;
      const trimmedTitle =
        listingTitle && listingTitle.trim() ? listingTitle.trim().slice(0, 240) : null;
      if (!collectedTitles.has(url)) {
        collectedTitles.set(url, trimmedTitle);
        return;
      }
      const prev = collectedTitles.get(url);
      if (!prev && trimmedTitle) {
        collectedTitles.set(url, trimmedTitle);
      }
    };

    for (const query of queries) {
      const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(query)}/homes`;

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page.waitForTimeout(5000);

      const rows = await page.$$eval(
        'a[href*="/rooms/"]',
        (elements) => {
          const MAX_LEN = 240;
          const clean = (s: string | null | undefined) => {
            if (!s) return "";
            return s.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
          };
          const resolveNearbyParent = (linkEl: Element): Element | null => {
            const byItemprop = linkEl.closest("[itemprop]");
            if (byItemprop) return byItemprop;
            const byTestid = linkEl.closest("[data-testid]");
            if (byTestid) return byTestid;
            const byDiv = linkEl.closest("div");
            if (byDiv) return byDiv;
            let cur: Element | null = linkEl.parentElement;
            let last: Element | null = null;
            for (let i = 0; i < 4 && cur; i++) {
              last = cur;
              cur = cur.parentElement;
            }
            return last;
          };
          return elements.map((el) => {
            const href = el.getAttribute("href");
            const abs = href ? `https://www.airbnb.com${href.split("?")[0]}` : null;
            const aria = el.getAttribute("aria-label");
            const titleAttr = el.getAttribute("title");
            const linkText = (el.textContent || "").replace(/\s+/g, " ").trim();
            const parentEl = resolveNearbyParent(el);
            const parentText = parentEl
              ? (parentEl.textContent || "").replace(/\s+/g, " ").trim()
              : "";
            const candidates = [
              clean(aria),
              clean(titleAttr),
              clean(linkText),
              clean(parentText),
            ];
            const titleGuess = candidates.find((c) => c.length > 0) || null;
            return { href: abs, title: titleGuess };
          });
        }
      );

      const byHref = new Map<string, string | null>();
      for (const row of rows) {
        if (!row.href) continue;
        const t = row.title?.trim() || null;
        if (!byHref.has(row.href)) {
          byHref.set(row.href, t);
        } else if (!byHref.get(row.href) && t) {
          byHref.set(row.href, t);
        }
      }

      const linksCount = byHref.size;
      for (const [href, t] of byHref) {
        addCollected(href, t);
        if (collectedTitles.size >= collectCap) break;
      }

      const sampleTitles = [...byHref.values()]
        .filter((t): t is string => Boolean(t && t.trim()))
        .slice(0, 8);

      logAirbnbDiscoveryQuery({
        query,
        linksCount,
        collectedCount: collectedTitles.size,
        sampleTitles,
      });

      if (collectedTitles.size >= collectCap) break;
    }

    const geoFilteredCandidates = filterAirbnbCandidatesByGeo(
      [...collectedTitles.entries()].map(([url, title]) => ({
        url,
        title,
        latitude: null,
        longitude: null,
      })),
      target
    );

    logAirbnbGeoFinalPool({
      targetUrl: target.url ?? null,
      targetCity: inferAirbnbTargetGeoContext(target).targetCity,
      targetCountry: inferAirbnbTargetGeoContext(target).targetCountry,
      discoveredCount: collectedTitles.size,
      retainedCount: geoFilteredCandidates.length,
      sampleTitles: geoFilteredCandidates
        .map((candidate) => candidate.title)
        .filter((title): title is string => typeof title === "string" && title.trim().length > 0)
        .slice(0, 8),
    });

    const titleNoisePenaltyContext = shouldPenalizeNoisyAirbnbTitles(target);
    const rankedCandidates = titleNoisePenaltyContext.enabled
      ? geoFilteredCandidates
          .map((candidate, index) => {
            const noise = getAirbnbTitleNoisePenalty(candidate.title);
            if (process.env.DEBUG_MARKET_PIPELINE === "true" && noise.penalty > 0) {
              console.log(
                "[market][airbnb-title-noise-penalized]",
                JSON.stringify({
                  targetType: titleNoisePenaltyContext.targetType,
                  targetPrice: titleNoisePenaltyContext.targetPrice,
                  title: candidate.title ?? null,
                  reasons: noise.reasons,
                  penalty: noise.penalty,
                })
              );
            }
            return {
              candidate,
              index,
              penalty: noise.penalty,
            };
          })
          .sort((a, b) => a.penalty - b.penalty || a.index - b.index)
          .map((entry) => entry.candidate)
      : geoFilteredCandidates;

    const uniqueUrls = rankedCandidates.slice(0, maxResults).map((candidate) => candidate.url);

    await browser.close();

    return uniqueUrls.map((url) => {
      const title = collectedTitles.get(url) ?? null;
      const pricing = parseAirbnbSearchSnippetPricing(title ?? "", targetStayNights);
      if (process.env.DEBUG_MARKET_PIPELINE === "true" && pricing.source) {
        console.log(
          "[market][airbnb-snippet-price-parse-result]",
          JSON.stringify({
            url,
            title,
            source: pricing.source,
            rawTotalMatched: pricing.rawTotalMatched,
            rawStayPrice: pricing.rawStayPrice,
            stayNights: pricing.stayNights ?? null,
            nightlyPrice: pricing.price,
            currency: pricing.currency ?? null,
            priceBasis: pricing.priceBasis ?? null,
          })
        );
      }
      return {
        url,
        platform: "airbnb",
        title,
        price: pricing.price,
        currency: pricing.currency,
        rawStayPrice: pricing.rawStayPrice,
        stayNights: pricing.stayNights,
        priceBasis: pricing.priceBasis,
        latitude: null,
        longitude: null,
      };
    });
  } catch (error) {
    await browser.close();

    console.error("Airbnb competitor search failed:", error);

    return [];
  }
}

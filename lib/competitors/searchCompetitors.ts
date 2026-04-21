import { extractListing } from "@/lib/extractors";
import type { ExtractedListing } from "@/lib/extractors/types";
import { chromium, type Browser, type Page } from "playwright-core";
import { searchAgodaCompetitorCandidates } from "./agoda-search";
import type { SearchCompetitorsInput, SearchCompetitorsResult } from "./types";
import { searchAirbnbCompetitorCandidates } from "./airbnb-search";
import { searchBookingCompetitorCandidates } from "./booking-search";
import { searchVrboCompetitorCandidates } from "./vrbo-search";
import {
  evaluateComparableCandidates,
  filterComparableListings,
  getNormalizedComparableType,
  guessListingCity,
  guessListingLanguage,
  guessListingNeighborhood,
} from "./filterComparableListings";

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_RADIUS_KM = 1;
const MAX_MARKET_COMPARABLES = 5;
const AIRBNB_COMPETITOR_PRICE_ATTEMPT_LIMIT = 3;
const AIRBNB_COMPETITOR_PRICE_NIGHTS = 5;
const AIRBNB_COMPETITOR_PRICE_TIMEOUT_MS = 15000;
const BOOKING_CANDIDATE_EXTRACTION_CAP = Number.parseInt(
  process.env.BOOKING_CANDIDATE_EXTRACTION_CAP ?? "6",
  10
);
const BOOKING_PRICED_COMPARABLE_STOP_TARGET = Number.parseInt(
  process.env.BOOKING_PRICED_COMPARABLE_STOP_TARGET ?? "3",
  10
);
const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";
const WEAK_CITY_TOKENS = new Set([
  "cozy",
  "skyview",
  "golden",
  "modern",
  "stylish",
  "beautiful",
  "spacious",
  "charming",
  "central",
  "downtown",
  "view",
  "suite",
  "apartment",
  "appartement",
  "studio",
  "villa",
  "house",
  "hotel",
  "home",
  "near",
  "city",
  "center",
  "centre",
]);

type CompetitorPropertyKind =
  | "studio"
  | "apartment"
  | "villa"
  | "riad"
  | "house"
  | "hotel"
  | "unknown";

function safeListingNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function detectPropertyTypeFromListingText(
  title: string,
  description: string
): CompetitorPropertyKind {
  const text = `${title}\n${description}`.toLowerCase();

  if (/\bstudio\b/i.test(text)) return "studio";
  if (/\briad\b/i.test(text)) return "riad";
  if (/\b(apartment|appartement|flat)\b/i.test(text)) return "apartment";
  if (/\bvilla\b/i.test(text)) return "villa";
  if (/\b(maison|house)\b/i.test(text)) return "house";
  if (/\b(hotel|hostel|resort)\b/i.test(text)) return "hotel";

  return "unknown";
}

function isPropertyTypeComparable(
  target: CompetitorPropertyKind,
  candidate: CompetitorPropertyKind
): boolean {
  if (target === "unknown" || candidate === "unknown") return true;

  if (target === "apartment") {
    if (candidate === "villa" || candidate === "riad" || candidate === "house") return false;
    return candidate === "apartment";
  }
  if (target === "villa") {
    if (candidate === "studio" || candidate === "apartment" || candidate === "hotel") return false;
    return candidate === "villa" || candidate === "riad" || candidate === "house";
  }

  return target === candidate;
}

function isBedroomOrCapacityWithinOne(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const tb = safeListingNumber(target.bedrooms ?? target.bedroomCount);
  const cb = safeListingNumber(candidate.bedrooms ?? candidate.bedroomCount);
  if (tb !== null && cb !== null) {
    return Math.abs(tb - cb) <= 1;
  }

  const tc = safeListingNumber(target.capacity ?? target.guestCapacity);
  const cc = safeListingNumber(candidate.capacity ?? candidate.guestCapacity);
  if (tc !== null && cc !== null) {
    return Math.abs(tc - cc) <= 1;
  }

  return true;
}

function filterCompetitorsByPropertyAndStructure(
  target: ExtractedListing,
  orderedCandidates: ExtractedListing[],
  maxKeep: number
): ExtractedListing[] {
  const targetKind = detectPropertyTypeFromListingText(
    target.title ?? "",
    target.description ?? ""
  );
  const picked: ExtractedListing[] = [];

  for (const listing of orderedCandidates) {
    const propertyType = detectPropertyTypeFromListingText(
      listing.title ?? "",
      listing.description ?? ""
    );
    const bedrooms = safeListingNumber(listing.bedrooms ?? listing.bedroomCount);
    const capacity = safeListingNumber(listing.capacity ?? listing.guestCapacity);

    const typeOk = isPropertyTypeComparable(targetKind, propertyType);
    const structureOk = isBedroomOrCapacityWithinOne(target, listing);
    const targetVillaFamily =
      targetKind === "villa" || getNormalizedComparableType(target) === "villa_like";
    const titleTrim = (listing.title ?? "").trim();
    const cityGuessLower = (guessListingCity(listing) ?? "").toLowerCase();
    const weakQualityComparable =
      targetVillaFamily &&
      String(listing.platform ?? "").toLowerCase() === "booking" &&
      propertyType === "unknown" &&
      (!titleTrim ||
        /untitled/i.test(listing.title ?? "") ||
        cityGuessLower === "untitled" ||
        /\buntitled\b/i.test(cityGuessLower));
    const kept = typeOk && structureOk && !weakQualityComparable;

    console.log("[filter][competitor]", {
      title: listing.title ?? "",
      propertyType,
      bedrooms,
      capacity,
      kept,
    });

    if (!kept) continue;

    listing.propertyType = propertyType;
    picked.push(listing);
    if (picked.length >= maxKeep) break;
  }

  return picked;
}

function debugComparablesLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

function isCompetitorSearchAborted(input: SearchCompetitorsInput) {
  return input.abortSignal?.aborted === true;
}

function hasPlausibleComparablePrice(listing: ExtractedListing) {
  return (
    typeof listing.price === "number" &&
    Number.isFinite(listing.price) &&
    listing.price > 0 &&
    listing.price <= 5000 &&
    typeof listing.currency === "string" &&
    listing.currency.trim().length > 0
  );
}

type CandidateSource = "booking" | "airbnb" | "vrbo" | "agoda";
type CandidateUrl = { url: string; source: CandidateSource };

function isVrboTarget(target: ExtractedListing): boolean {
  return (
    String(target.platform ?? "").toLowerCase() === "vrbo" ||
    String(target.sourcePlatform ?? "").toLowerCase() === "vrbo"
  );
}

function getMarketComparisonPlatform(platform: unknown): CandidateSource | "unknown" {
  const normalized = typeof platform === "string" ? platform.toLowerCase() : "";
  if (normalized === "expedia") return "booking";
  if (
    normalized === "booking" ||
    normalized === "airbnb" ||
    normalized === "vrbo" ||
    normalized === "agoda"
  ) {
    return normalized;
  }
  return "unknown";
}

function getCompetitorSourcePriority(platform: unknown): string[] {
  const normalized = typeof platform === "string" ? platform.toLowerCase() : "";
  if (normalized === "airbnb") return ["booking", "airbnb_minimal_fallback"];
  if (normalized === "expedia") return ["booking"];
  return [getMarketComparisonPlatform(platform)];
}

function getBookingUrlHints(url: string): { cityHint: string | null; countryHint: string | null } {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/hotel\/([a-z]{2})\/([^/]+)\.html/i);
    const countryCode = match?.[1]?.toLowerCase() ?? null;
    const slug = (match?.[2] ?? "").toLowerCase();
    const normalizedSlug = normalizeMarketText(slug);

    const cityHint = normalizedSlug.includes("marrakech")
      ? "marrakech"
      : normalizedSlug.includes("las vegas")
        ? "las vegas"
        : normalizedSlug.includes("orlando")
          ? "orlando"
          : KNOWN_CITY_NEIGHBORHOODS.marrakech.find((neighborhood) =>
              normalizedSlug.includes(neighborhood)
            ) ?? (normalizedSlug.includes("paris")
              ? "paris"
              : normalizedSlug.includes("nairobi")
                ? "nairobi"
                : null);

    const countryHint =
      countryCode === "ma" || normalizedSlug.includes("morocco") || normalizedSlug.includes("maroc")
        ? "morocco"
        : countryCode === "fr" || normalizedSlug.includes("france")
          ? "france"
          : countryCode === "ke" || normalizedSlug.includes("kenya")
            ? "kenya"
            : countryCode === "us" ||
                normalizedSlug.includes("united states") ||
                normalizedSlug.includes("usa")
              ? "united states"
              : null;

    return { cityHint, countryHint: normalizeCountry(countryHint) };
  } catch {
    return { cityHint: null, countryHint: null };
  }
}

function isBookingCandidateCoherentByHints(input: {
  targetCity: string | null;
  targetCountry: string | null;
  cityHint: string | null;
  countryHint: string | null;
  url: string;
}) {
  const { targetCity, targetCountry, cityHint, countryHint, url } = input;
  const normalizedTargetCity = normalizeMarketText(targetCity);
  const normalizedCityHint = normalizeMarketText(cityHint);
  const normalizedTargetCountry = normalizeCountry(targetCountry);
  const normalizedCountryHint = normalizeCountry(countryHint);
  const normalizedUrl = normalizeMarketText(url);
  const knownNeighborhoods = KNOWN_CITY_NEIGHBORHOODS[normalizedTargetCity] ?? [];

  if (
    normalizedTargetCity &&
    normalizedCityHint &&
    normalizedCityHint !== normalizedTargetCity &&
    !knownNeighborhoods.includes(normalizedCityHint)
  ) {
    return false;
  }
  if (
    normalizedTargetCountry &&
    normalizedCountryHint &&
    normalizedCountryHint !== normalizedTargetCountry
  ) {
    return false;
  }
  const pathCountryCodeMatch = url.match(/\/hotel\/([a-z]{2})\//i);
  const pathCountryCode = pathCountryCodeMatch?.[1]?.toLowerCase() ?? null;
  let pathCountryLabel: string | null = null;
  if (pathCountryCode) {
    switch (pathCountryCode) {
      case "ma":
        pathCountryLabel = "morocco";
        break;
      case "fr":
        pathCountryLabel = "france";
        break;
      case "ke":
        pathCountryLabel = "kenya";
        break;
      case "us":
        pathCountryLabel = "united states";
        break;
      case "gb":
        pathCountryLabel = "united kingdom";
        break;
      case "ca":
        pathCountryLabel = "canada";
        break;
      default:
        pathCountryLabel = null;
    }
  }
  const normalizedPathCountry = pathCountryLabel ? normalizeCountry(pathCountryLabel) : null;
  if (
    normalizedTargetCountry &&
    normalizedPathCountry &&
    normalizedPathCountry !== normalizedTargetCountry
  ) {
    return false;
  }
  if (normalizedTargetCountry === "morocco" && /\/hotel\/ma\//i.test(url)) return true;
  if (normalizedTargetCountry && normalizedCountryHint === normalizedTargetCountry) return true;
  if (normalizedTargetCity && normalizedCityHint === normalizedTargetCity) return true;
  if (normalizedTargetCity && knownNeighborhoods.includes(normalizedCityHint)) return true;
  if (normalizedTargetCity && normalizedUrl.includes(normalizedTargetCity)) return true;
  if (!normalizedCityHint && !normalizedCountryHint) return true;
  return false;
}

function guessListingCountry(listing: ExtractedListing): string | null {
  const text = `${listing.locationLabel ?? ""} ${listing.title ?? ""} ${listing.url ?? ""}`.toLowerCase();
  if (
    text.includes("morocco") ||
    text.includes("maroc") ||
    text.includes("marrakech") ||
    text.includes("marrakesh")
  ) {
    return "morocco";
  }
  if (text.includes("france") || text.includes("paris")) return "france";
  if (text.includes("kenya")) return "kenya";
  if (
    text.includes("united states") ||
    text.includes("united states of america") ||
    /\b(?:usa|u\.s\.a\.|u\.s\.)\b/i.test(text) ||
    /\b(?:las vegas|nevada|nv)\b/i.test(text)
  ) {
    return "united states";
  }
  return null;
}

function normalizeMarketText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bmarrakesh\b/g, "marrakech")
    .replace(/\bmarraquexe\b/g, "marrakech")
    .replace(/\bmarraquex\b/g, "marrakech");
}

function isWeakCityToken(value: string | null | undefined): boolean {
  const normalized = normalizeMarketText(value);
  if (!normalized) return true;
  if (normalized.length < 4) return true;
  return WEAK_CITY_TOKENS.has(normalized);
}

function cityLooksReliableForMarket(listing: ExtractedListing, city: string): boolean {
  if (!city) return false;

  const normalizedCity = normalizeMarketText(city);
  if (!normalizedCity) return false;

  if (KNOWN_CITY_NEIGHBORHOODS[normalizedCity]) return true;

  const locationText = normalizeMarketText(listing.locationLabel);
  if (locationText && locationText.includes(normalizedCity)) return true;

  const urlText = normalizeMarketText(listing.url);
  if (urlText && urlText.includes(normalizedCity)) return true;

  const titleText = normalizeMarketText(listing.title);
  if (titleText && titleText.includes(normalizedCity) && normalizedCity.length >= 6) return true;

  return false;
}

function pickReliableMarketCity(listing: ExtractedListing): string | null {
  const cityFromLocation = normalizeMarketText(
    guessListingCity({
      ...listing,
      title: "",
      description: "",
      url: "",
    } as ExtractedListing)
  );
  const cityFromDefault = normalizeMarketText(guessListingCity(listing));

  if (cityFromLocation && !isWeakCityToken(cityFromLocation)) {
    return cityFromLocation;
  }

  if (
    cityFromDefault &&
    !isWeakCityToken(cityFromDefault) &&
    cityLooksReliableForMarket(listing, cityFromDefault)
  ) {
    return cityFromDefault;
  }

  return null;
}

function normalizeCountry(input: string | null): string | null {
  if (!input) return null;
  const normalized = normalizeMarketText(input);

  if (normalized.includes("morocco") || normalized.includes("maroc")) return "morocco";
  if (normalized.includes("france")) return "france";
  if (normalized.includes("kenya")) return "kenya";
  if (
    normalized.includes("united states") ||
    normalized.includes("united states of america") ||
    /\b(?:usa|u s a|u s|us)\b/i.test(normalized)
  ) {
    return "united states";
  }

  return normalized;
}

function guessMarketComparisonCity(listing: ExtractedListing): string | null {
  const text = normalizeMarketText(
    `${listing.locationLabel ?? ""} ${listing.title ?? ""} ${listing.url ?? ""} ${
      isVrboTarget(listing) ? listing.description ?? "" : ""
    }`
  );
  if (/\blas vegas\b/.test(text)) return "las vegas";
  if (isVrboTarget(listing) && /\bsidi bouzid\b/.test(text)) return "sidi bouzid";
  return pickReliableMarketCity(listing);
}

function guessMarketComparisonCountry(listing: ExtractedListing): string | null {
  const country = normalizeCountry(guessListingCountry(listing));
  if (country || !isVrboTarget(listing)) return country;

  const text = normalizeMarketText(
    `${listing.locationLabel ?? ""} ${listing.title ?? ""} ${listing.description ?? ""} ${listing.url ?? ""}`
  );
  if (/\b(?:maroc|morocco|el jadida|casablanca settat)\b/.test(text)) return "morocco";
  return null;
}

function buildBookingDiscoveryTarget(target: ExtractedListing): ExtractedListing {
  const targetCity = guessMarketComparisonCity(target);
  const targetCountry = guessMarketComparisonCountry(target);
  const searchQuery = [targetCity, targetCountry].filter(Boolean).join(", ");
  if (!searchQuery) return target;

  return {
    ...target,
    title: searchQuery,
    locationLabel: searchQuery,
    description: `${searchQuery} ${target.description ?? ""}`.trim(),
  };
}

function isExpediaTarget(target: ExtractedListing): boolean {
  return (
    String(target.platform ?? "").toLowerCase() === "expedia" ||
    String(target.sourcePlatform ?? "").toLowerCase() === "expedia"
  );
}

const KNOWN_CITY_NEIGHBORHOODS: Record<string, string[]> = {
  marrakech: [
    "gueliz",
    "medina",
    "hivernage",
    "majorelle",
    "palmeraie",
    "agdal",
    "menara",
    "sidi ghanem",
    "semmlalia",
    "semelalia",
  ],
};

function isGeoCompatible(candidate: ExtractedListing, targetCity: string | null): boolean {
  const normalizedTargetCity = normalizeMarketText(targetCity);
  if (!normalizedTargetCity) return true;

  const candidateCity = normalizeMarketText(guessListingCity(candidate));
  const candidateText = normalizeMarketText(
    `${candidate.title ?? ""} ${candidate.url ?? ""} ${candidate.locationLabel ?? ""}`
  );
  const knownNeighborhoods = KNOWN_CITY_NEIGHBORHOODS[normalizedTargetCity] ?? [];

  return (
    candidateCity === normalizedTargetCity ||
    knownNeighborhoods.includes(candidateCity) ||
    candidateText.includes(normalizedTargetCity) ||
    knownNeighborhoods.some((neighborhood) => candidateText.includes(neighborhood))
  );
}

function hasApartmentSignalInTitle(candidate: ExtractedListing): boolean {
  return /\b(appartement|apartment|studio|flat)\b/i.test(candidate.title ?? "");
}

function isTypeCompatible(candidate: ExtractedListing, targetType: string): boolean {
  const candidateType = getNormalizedComparableType(candidate);
  const rawType = normalizeMarketText(candidate.propertyType);

  if (targetType === "unknown" || candidateType === "unknown") return true;
  if (candidateType === targetType || rawType === targetType) return true;

  if (targetType === "apartment_like") {
    if (
      ["apartment", "apartment_like", "entire_place", "studio"].includes(rawType) ||
      candidateType === "apartment_like" ||
      candidateType === "studio_like"
    ) {
      return true;
    }

    if ((rawType.includes("hotel") || candidateType === "hotel_like") && hasApartmentSignalInTitle(candidate)) {
      return true;
    }
  }

  if (targetType === "villa_like" && candidateType === "house_like") {
    return true;
  }

  return false;
}

async function getCandidateUrls(
  target: ExtractedListing,
  maxResults: number,
  sourcePriority?: CandidateSource[],
  comparableDiscoveryGeo?: {
    normalizedTargetCountry: string | null;
    skipEmbeddedAndNetwork: boolean;
  },
  abortSignal?: AbortSignal
): Promise<CandidateUrl[]> {
  const normalize = (urls: string[], source: CandidateSource) =>
    urls
      .map((url) => url?.trim() || "")
      .filter(Boolean)
      .map((url) => ({ url, source }));

  switch (sourcePriority?.[0] ?? getMarketComparisonPlatform(target.platform)) {
    case "airbnb": {
      const targetCity = guessMarketComparisonCity(target);
      const targetCountry = guessMarketComparisonCountry(target);
      const searchQuery = [targetCity, targetCountry].filter(Boolean).join(" ");
      const bookingDiscoveryTarget = searchQuery
        ? {
            ...target,
            title: `${searchQuery}, ${target.propertyType ?? "appartement"}`,
            locationLabel: searchQuery,
            description: `${target.description ?? ""} ${searchQuery}`.trim(),
          }
        : target;
      const bookingUrls = await (async () => {
        try {
          const candidates = await searchBookingCompetitorCandidates(
            bookingDiscoveryTarget,
            Math.max(maxResults * 2, 6),
            comparableDiscoveryGeo,
            abortSignal
          );
          return normalize(candidates.map((c) => c.url), "booking");
        } catch (error) {
          console.error("Error searching Booking.com competitors for Airbnb target", error);
          return [] as CandidateUrl[];
        }
      })();

      const airbnbUrls = await (async () => {
        try {
          const candidates = await searchAirbnbCompetitorCandidates(target, maxResults);
          return normalize(candidates.map((c) => c.url), "airbnb");
        } catch (error) {
          console.error("Error searching Airbnb competitors", error);
          return [] as CandidateUrl[];
        }
      })();

      return [...bookingUrls, ...airbnbUrls];
    }
    case "booking": {
      try {
        const bookingDiscoveryTarget = isExpediaTarget(target)
          ? buildBookingDiscoveryTarget(target)
          : target;
        const candidates = await searchBookingCompetitorCandidates(
          bookingDiscoveryTarget,
          maxResults,
          comparableDiscoveryGeo,
          abortSignal
        );
        return normalize(candidates.map((c) => c.url), "booking");
      } catch (error) {
        console.error("Error searching Booking.com competitors", error);
        return [];
      }
    }

    case "vrbo": {
      try {
        const targetCity = guessMarketComparisonCity(target);
        const targetCountry = guessMarketComparisonCountry(target);
        const searchQuery = [targetCity, targetCountry].filter(Boolean).join(", ");
        const vrboDiscoveryTarget = searchQuery
          ? {
              ...target,
              title: searchQuery,
              locationLabel: searchQuery,
              description: `${searchQuery} ${target.description ?? ""}`.trim(),
            }
          : target;
        const candidates = await searchVrboCompetitorCandidates(vrboDiscoveryTarget, maxResults);
        return normalize(candidates.map((c) => c.url), "vrbo");
      } catch (error) {
        console.error("Error searching VRBO competitors", error);
        return [];
      }
    }

    case "agoda": {
      try {
        const candidates = await searchAgodaCompetitorCandidates(target, maxResults);
        return normalize(candidates.map((c) => c.url), "agoda");
      } catch (error) {
        console.error("Error searching Agoda competitors", error);
        return [];
      }
    }

    default:
      return [];
  }
}

function isUsableListing(listing: ExtractedListing, target: ExtractedListing): boolean {
  if (!listing) return false;

  if (!listing.url || typeof listing.url !== "string") return false;
  if (listing.url === target.url) return false;

  const hasTitle = typeof listing.title === "string" && listing.title.trim().length > 0;
  const hasPhotos = Array.isArray(listing.photos) && listing.photos.length > 0;
  const hasAmenities = Array.isArray(listing.amenities) && listing.amenities.length > 0;
  const hasPrice = hasPlausibleComparablePrice(listing);

  // At least one core field should be meaningful for the listing to be comparable
  return hasTitle || hasPhotos || hasAmenities || hasPrice;
}

function buildListingKey(listing: ExtractedListing): string {
  const url = listing.url ?? "";
  const externalId = listing.externalId ?? "";
  const platform = listing.platform ?? "";
  const title = (listing.title ?? "").toLowerCase();
  const price =
    typeof listing.price === "number" && Number.isFinite(listing.price)
      ? listing.price.toFixed(2)
      : "";

  return [platform, externalId, url, title, price].join("|");
}

function dedupeListings(
  listings: ExtractedListing[],
  target: ExtractedListing
): ExtractedListing[] {
  const seen = new Set<string>();
  const result: ExtractedListing[] = [];

  for (const listing of listings) {
    if (!isUsableListing(listing, target)) continue;

    const key = buildListingKey(listing);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(listing);
  }

  return result;
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

function buildAirbnbCompetitorPricingUrl(url: string) {
  const target = new URL(url);
  if (/airbnb\.com$/i.test(target.hostname)) {
    target.hostname = "www.airbnb.fr";
  }
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 14);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + AIRBNB_COMPETITOR_PRICE_NIGHTS);

  target.searchParams.set("check_in", checkIn.toISOString().slice(0, 10));
  target.searchParams.set("check_out", checkOut.toISOString().slice(0, 10));
  target.searchParams.set("adults", "2");
  return {
    url: target.toString(),
    nights: AIRBNB_COMPETITOR_PRICE_NIGHTS,
  };
}

function parseCurrencyFromText(text: string) {
  if (text.includes("€")) return "EUR";
  if (text.includes("$")) return "USD";
  if (text.includes("£")) return "GBP";
  if (
    text.includes("MAD") ||
    text.includes("DH") ||
    text.includes("د.م.") ||
    text.toLowerCase().includes("dirham")
  ) {
    return "MAD";
  }
  return null;
}

function parsePriceNumber(text: string) {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseAirbnbTotalPrice(text: string) {
  const normalized = text.replace(/\u00a0|\u202f/g, " ").replace(/\s+/g, " ").trim();
  if (!/(au total|total|totale)/i.test(normalized)) return null;

  const match =
    normalized.match(/([€$£])\s*(\d[\d\s.,]*)\s*(?:au\s*total|total|totale)/i) ??
    normalized.match(/(\d[\d\s.,]*)\s*([€$£])\s*(?:au\s*total|total|totale)/i);

  if (match) {
    const symbolFirst = /[€$£]/.test(match[1] ?? "");
    const rawPrice = symbolFirst ? match[2] : match[1];
    const currencySymbol = symbolFirst ? match[1] : match[2];
    const value = parsePriceNumber(rawPrice ?? "");
    if (value == null || value <= 0 || value > 50000) return null;

    return {
      totalPrice: Math.round(value),
      currency: parseCurrencyFromText(currencySymbol ?? normalized),
    };
  }

  if (parseCurrencyFromText(normalized) === "MAD") {
    const madMatch =
      normalized.match(
        /(?:au\s*total|total|totale)[^\d]{0,80}(\d[\d\s.,]*)\s*(?:MAD|DH|د\.م\.|dirham)/i
      ) ??
      normalized.match(
        /(\d[\d\s.,]*)\s*(?:MAD|DH|د\.م\.)\s*(?:pour\s*)?(?:le\s*)?(?:au\s*)?(?:total|totale)/i
      );

    if (madMatch?.[1]) {
      const value = parsePriceNumber(madMatch[1]);
      if (value != null && value > 0 && value <= 50000) {
        return {
          totalPrice: Math.round(value),
          currency: "MAD" as const,
        };
      }
    }
  }

  return null;
}

function getRemainingTimeout(startedAt: number) {
  return Math.max(1000, AIRBNB_COMPETITOR_PRICE_TIMEOUT_MS - (Date.now() - startedAt));
}

async function readAirbnbCompetitorTotalPrice(page: Page, startedAt: number) {
  await page
    .waitForSelector('[data-testid="book-it-default"], [data-testid="price-element"], body', {
      timeout: Math.min(4000, getRemainingTimeout(startedAt)),
    })
    .catch(() => {});
  await page.waitForTimeout(Math.min(1500, getRemainingTimeout(startedAt))).catch(() => {});

  const candidates = await page.evaluate(`
    (() => {
      const values = [];
      const pushText = (source, text) => {
        const normalized = (text || "").replace(/\\s+/g, " ").trim();
        if (!normalized || normalized.length > 260) return;
        const hasWestern = /[€$£]/.test(normalized);
        const hasMad =
          /MAD|\\bDH\\b|د\\.م\\.|dirham/i.test(normalized);
        if (!hasWestern && !hasMad) return;
        if (!/(au total|total|totale)/i.test(normalized)) return;
        values.push({ source, text: normalized });
      };

      document
        .querySelectorAll('[data-testid="book-it-default"], [data-testid="book-it-default"] span')
        .forEach((element) => pushText("book-it-default", element.textContent));
      document
        .querySelectorAll('[data-testid="price-element"], [data-testid="price-element"] span')
        .forEach((element) => pushText("price-element", element.textContent));

      return values.slice(0, 20);
    })()
  `);

  if (!Array.isArray(candidates)) return null;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const text = (candidate as { text?: unknown }).text;
    if (typeof text !== "string") continue;

    const parsed = parseAirbnbTotalPrice(text);
    if (parsed) return parsed;
  }

  return null;
}

async function fetchAirbnbCompetitorPriceWithCdp(url: string) {
  const endpoint = getBrightDataCdpEndpoint();
  if (!endpoint) return null;

  const pricingUrl = buildAirbnbCompetitorPricingUrl(url);
  const startedAt = Date.now();
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.connectOverCDP(endpoint, {
      timeout: Math.min(3000, getRemainingTimeout(startedAt)),
    });
    page = await browser.newPage();
    await page.goto(pricingUrl.url, {
      waitUntil: "commit",
      timeout: Math.min(11000, getRemainingTimeout(startedAt)),
    });

    const parsed = await readAirbnbCompetitorTotalPrice(page, startedAt);
    if (!parsed) {
      console.log("[pricing][competitor]", {
        url,
        totalPrice: null,
        pricePerNight: null,
        nights: pricingUrl.nights,
        currency: null,
      });
      return null;
    }

    const pricePerNight = Math.round((parsed.totalPrice / pricingUrl.nights) * 100) / 100;
    console.log("[pricing][competitor]", {
      url,
      totalPrice: parsed.totalPrice,
      pricePerNight,
      nights: pricingUrl.nights,
      currency: parsed.currency,
    });

    return {
      totalPrice: parsed.totalPrice,
      pricePerNight,
      nights: pricingUrl.nights,
      currency: parsed.currency,
    };
  } catch (error) {
    console.log("[pricing][competitor]", {
      url,
      totalPrice: null,
      pricePerNight: null,
      nights: pricingUrl.nights,
      currency: null,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function enrichAirbnbCompetitorPrices(competitors: ExtractedListing[]) {
  let attempted = 0;
  let successful = 0;

  for (const competitor of competitors) {
    if (successful >= AIRBNB_COMPETITOR_PRICE_ATTEMPT_LIMIT) break;
    if (attempted >= AIRBNB_COMPETITOR_PRICE_ATTEMPT_LIMIT) break;
    if (competitor.platform !== "airbnb") continue;
    if (typeof competitor.price === "number" && Number.isFinite(competitor.price)) continue;

    attempted += 1;
    const pricing = await fetchAirbnbCompetitorPriceWithCdp(competitor.url);
    if (!pricing) continue;

    competitor.price = pricing.pricePerNight;
    competitor.currency = pricing.currency;
    const priceExtras: Record<string, unknown> = {
      pricePerNight: pricing.pricePerNight,
      totalPrice: pricing.totalPrice,
      priceNights: pricing.nights,
      priceSource: "cdp_avg_nightly_from_total",
    };
    if (pricing.currency === "MAD") {
      priceExtras.eurApprox = pricing.totalPrice * 0.1;
      priceExtras.eurApproxPerNight = pricing.pricePerNight * 0.1;
      priceExtras.eurApproxSource = "fixed_mad_to_eur_0_1";
    }
    Object.assign(competitor, priceExtras);
    successful += 1;
  }
}

export async function searchCompetitorsAroundTarget(
  input: SearchCompetitorsInput
): Promise<SearchCompetitorsResult> {
  const overrideMax =
    typeof input.comparables?.max === "number" && Number.isFinite(input.comparables.max)
      ? input.comparables.max
      : null;
  const maxResults = Math.min(
    Math.max(Math.round(overrideMax ?? input.maxResults ?? DEFAULT_MAX_RESULTS), 1),
    MAX_MARKET_COMPARABLES
  );
  const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;
  const candidateFetchLimit = Math.max(maxResults * 3, 8);
  const overrideCity = normalizeMarketText(input.comparables?.city) || null;
  const overrideCountry = normalizeCountry(input.comparables?.country ?? null);
  const overridePropertyType = normalizeMarketText(input.comparables?.propertyType) || null;
  const overrideSourcePriority = (input.comparables?.sourcePriority ?? [])
    .map((source) => source.trim().toLowerCase())
    .filter((source): source is CandidateSource =>
      source === "booking" || source === "airbnb" || source === "vrbo" || source === "agoda"
    );
  const comparableTarget: ExtractedListing = input.comparables
    ? {
        ...input.target,
        title: [overrideCity, overrideCountry, overridePropertyType].filter(Boolean).join(" ") || input.target.title,
        description: [
          input.target.description ?? "",
          overrideCity,
          overrideCountry,
          overridePropertyType,
        ].filter(Boolean).join(" "),
        locationLabel: [overrideCity, overrideCountry].filter(Boolean).join(", ") || input.target.locationLabel,
        propertyType: overridePropertyType ?? input.target.propertyType,
      }
    : input.target;
  const targetCity = overrideCity ?? guessMarketComparisonCity(comparableTarget);
  const targetCountry = overrideCountry ?? guessMarketComparisonCountry(comparableTarget);
  const targetPlatform = overrideSourcePriority[0] ?? getMarketComparisonPlatform(input.target.platform);
  const competitorSourcePriority =
    overrideSourcePriority.length > 0 ? overrideSourcePriority : getCompetitorSourcePriority(input.target.platform);
  const isExpediaBookingMarket = targetPlatform === "booking" && isExpediaTarget(input.target);

  console.log("[market][strategy]", {
    targetPlatform,
    targetCity,
    targetCountry,
    competitorSourcePriority,
    maxComparables: maxResults,
  });

  const hasComparableGeoOverride = Boolean(overrideCity) || Boolean(overrideCountry);
  const strictBookingComparableDiscovery =
    Boolean(input.comparables) &&
    overrideSourcePriority[0] === "booking" &&
    hasComparableGeoOverride;
  const comparableDiscoveryGeo = strictBookingComparableDiscovery
    ? {
        normalizedTargetCountry: normalizeCountry(targetCountry),
        skipEmbeddedAndNetwork: true,
      }
    : undefined;

  const candidateUrls = await getCandidateUrls(
    comparableTarget,
    candidateFetchLimit,
    overrideSourcePriority,
    comparableDiscoveryGeo,
    input.abortSignal
  );
  const uniqueCandidates = candidateUrls
    .filter((candidate) => candidate.url !== input.target.url)
    .filter((candidate, index, arr) => arr.findIndex((item) => item.url === candidate.url) === index)
    .slice(0, Math.max(candidateFetchLimit * 2, 8));

  const extractListings = async (urls: CandidateUrl[]) => {
    const listings: ExtractedListing[] = [];
    for (const candidate of urls) {
      if (isCompetitorSearchAborted(input)) {
        console.log("[market][budget] timeoutAbort", {
          stage: "before_candidate_extract",
          url: candidate.url,
        });
        break;
      }

      try {
        const listing = await extractListing(candidate.url);
        if (listing && listing.url !== input.target.url) {
          listings.push(listing);
        }
      } catch {
        // Keep competitor extraction best-effort; individual failures should not fail the audit.
      }
    }

    return listings;
  };

  const bookingCandidates = uniqueCandidates
    .filter((candidate) => candidate.source === "booking")
    .slice(0, candidateFetchLimit);
  const fallbackCandidates = uniqueCandidates
    .filter((candidate) => candidate.source !== "booking")
    .slice(0, candidateFetchLimit);

  const bookingPreselected = bookingCandidates.filter((candidate) => {
    const { cityHint, countryHint } = getBookingUrlHints(candidate.url);
    const keep = isBookingCandidateCoherentByHints({
      targetCity,
      targetCountry,
      cityHint,
      countryHint,
      url: candidate.url,
    });
    if (!keep) {
      console.log("[market][booking-pre-reject]", {
        url: candidate.url,
        title: null,
        cityHint,
        countryHint,
        reason: "pre_geo_mismatch",
      });
      return false;
    }
    console.log("[market][booking-pre-keep]", {
      url: candidate.url,
      title: null,
      cityHint,
      countryHint,
    });
    return true;
  });

  console.log("[market][booking-discovery]", {
    targetCity,
    targetCountry,
    targetPropertyType: getNormalizedComparableType(comparableTarget),
    candidateCount: bookingPreselected.length,
  });

  const bookingRawCompetitors: ExtractedListing[] = [];
  const defaultBookingExtractionCap = Math.min(
    Math.max(
      Number.isFinite(BOOKING_CANDIDATE_EXTRACTION_CAP)
        ? BOOKING_CANDIDATE_EXTRACTION_CAP
        : 4,
      maxResults
    ),
    bookingPreselected.length
  );
  const bookingExtractionCap = isExpediaBookingMarket
    ? Math.min(defaultBookingExtractionCap, 1)
    : defaultBookingExtractionCap;
  const pricedComparableStopTarget = Math.min(
    maxResults,
    Math.max(
      1,
      Number.isFinite(BOOKING_PRICED_COMPARABLE_STOP_TARGET)
        ? BOOKING_PRICED_COMPARABLE_STOP_TARGET
        : 2
    )
  );
  const effectivePricedComparableStopTarget = isExpediaBookingMarket
    ? 1
    : pricedComparableStopTarget;
  const validComparableStopTarget = isExpediaBookingMarket ? 1 : maxResults;
  let bookingExtractionAttempts = 0;
  let pricedBookingComparables = 0;
  console.log("[market][budget] candidateExtractionCap", {
    source: "booking",
    candidateCount: bookingPreselected.length,
    candidateExtractionCap: bookingExtractionCap,
    pricedComparableStopTarget: effectivePricedComparableStopTarget,
    validComparableStopTarget,
  });

  for (const candidate of bookingPreselected) {
    if (bookingRawCompetitors.length >= validComparableStopTarget) break;
    if (isCompetitorSearchAborted(input)) {
      console.log("[market][budget] timeoutAbort", {
        stage: "booking_loop",
        openedCandidates: bookingExtractionAttempts,
        keptCandidates: bookingRawCompetitors.length,
      });
      break;
    }
    if (pricedBookingComparables >= effectivePricedComparableStopTarget) {
      console.log("[market][budget] stopEarlyEnoughComparables", {
        source: "booking",
        pricedComparables: pricedBookingComparables,
        keptCandidates: bookingRawCompetitors.length,
        validComparableStopTarget,
      });
      break;
    }
    if (bookingExtractionAttempts >= bookingExtractionCap) {
      console.log("[market][budget] extractionSkipped", {
        source: "booking",
        reason: "candidate_extraction_cap_reached",
        candidateExtractionCap: bookingExtractionCap,
        nextUrl: candidate.url,
      });
      break;
    }

    bookingExtractionAttempts += 1;
    const extracted = await extractListings([candidate]);
    const listing = extracted[0];
    if (!listing) continue;

    const geoCheck = isGeoCompatible(listing, targetCity);
    const typeCheck = isTypeCompatible(listing, getNormalizedComparableType(comparableTarget));
    if (!geoCheck || !typeCheck) {
      console.log("[market][candidate-rejected]", {
        platform: listing.platform ?? "booking",
        title: listing.title ?? null,
        city: guessListingCity(listing),
        country: guessListingCountry(listing),
        propertyType: listing.propertyType ?? null,
        geoCheck,
        typeCheck,
        reason: !geoCheck && !typeCheck
          ? "geo_and_type_mismatch"
          : !geoCheck
            ? "geo_mismatch"
            : "property_type_mismatch",
      });
      continue;
    }

    if (!isBedroomOrCapacityWithinOne(comparableTarget, listing)) {
      console.log("[market][candidate-rejected]", {
        platform: listing.platform ?? "booking",
        title: listing.title ?? null,
        city: guessListingCity(listing),
        country: guessListingCountry(listing),
        propertyType: listing.propertyType ?? null,
        reason: "structure_too_far",
      });
      continue;
    }

    const targetVillaFamilyPreFilter =
      detectPropertyTypeFromListingText(comparableTarget.title ?? "", comparableTarget.description ?? "") ===
        "villa" || getNormalizedComparableType(comparableTarget) === "villa_like";
    const titleTrimPre = (listing.title ?? "").trim();
    const cityGuessLowerPre = (guessListingCity(listing) ?? "").toLowerCase();
    const detectedKindPre = detectPropertyTypeFromListingText(
      listing.title ?? "",
      listing.description ?? ""
    );
    const weakQualityPrePush =
      targetVillaFamilyPreFilter &&
      String(listing.platform ?? "").toLowerCase() === "booking" &&
      detectedKindPre === "unknown" &&
      (!titleTrimPre ||
        /untitled/i.test(listing.title ?? "") ||
        cityGuessLowerPre === "untitled" ||
        /\buntitled\b/i.test(cityGuessLowerPre));
    if (weakQualityPrePush) {
      console.log("[market][candidate-rejected]", {
        platform: listing.platform ?? "booking",
        title: listing.title ?? null,
        city: guessListingCity(listing),
        country: guessListingCountry(listing),
        propertyType: listing.propertyType ?? null,
        reason: "weak_booking_comparable",
      });
      continue;
    }

    bookingRawCompetitors.push(listing);
    if (hasPlausibleComparablePrice(listing)) {
      pricedBookingComparables += 1;
    }

    if (
      isExpediaBookingMarket &&
      (pricedBookingComparables >= effectivePricedComparableStopTarget ||
        bookingRawCompetitors.length >= validComparableStopTarget)
    ) {
      console.log("[market][budget] stopEarlyEnoughComparables", {
        source: "booking",
        pricedComparables: pricedBookingComparables,
        keptCandidates: bookingRawCompetitors.length,
        validComparableStopTarget,
      });
      break;
    }
  }

  const bookingSanitized = dedupeListings(bookingRawCompetitors, comparableTarget);
  const bookingOrdered = bookingSanitized;
  let bookingCompetitors = filterCompetitorsByPropertyAndStructure(comparableTarget, bookingOrdered, maxResults);
  if (bookingCompetitors.length === 0 && bookingOrdered.length > 0) {
    const relaxedFallback = bookingOrdered
      .filter((listing) =>
        isTypeCompatible(listing, getNormalizedComparableType(comparableTarget))
      )
      .filter((listing) => isBedroomOrCapacityWithinOne(comparableTarget, listing))
      .sort((a, b) => {
        const aPriced = hasPlausibleComparablePrice(a) ? 1 : 0;
        const bPriced = hasPlausibleComparablePrice(b) ? 1 : 0;
        return bPriced - aPriced;
      })
      .slice(0, Math.min(maxResults, 2));

    if (relaxedFallback.length > 0) {
      console.log("[market][relaxed-fallback]", {
        reason: "strict_filters_returned_zero",
        selected: relaxedFallback.length,
      });
      bookingCompetitors = relaxedFallback;
    }
  }

  const needsFallback =
    input.target.platform !== "airbnb"
      ? bookingCompetitors.length < maxResults
      : bookingCompetitors.length > 0 && bookingCompetitors.length < maxResults;
  const fallbackRawCompetitors =
    needsFallback && !isCompetitorSearchAborted(input)
      ? await extractListings(fallbackCandidates)
      : [];
  const rawCompetitors: ExtractedListing[] = [...bookingRawCompetitors, ...fallbackRawCompetitors];

  const sanitizedCompetitors = dedupeListings(rawCompetitors, comparableTarget);
  const candidateDecisions = evaluateComparableCandidates(
    comparableTarget,
    sanitizedCompetitors
  );

  const comparablePoolLimit = Math.max(maxResults * 4, 15);
  const competitorsOrdered = filterComparableListings(
    comparableTarget,
    sanitizedCompetitors,
    comparablePoolLimit
  );
  const fallbackCompetitors = filterCompetitorsByPropertyAndStructure(
    comparableTarget,
    competitorsOrdered,
    maxResults
  );
  let competitors = dedupeListings(
    [...bookingCompetitors, ...fallbackCompetitors],
    comparableTarget
  ).slice(0, maxResults);
  if (competitors.length === 0 && sanitizedCompetitors.length > 0) {
    const emergencyFallback = sanitizedCompetitors
      .filter((listing) => isBedroomOrCapacityWithinOne(comparableTarget, listing))
      .sort((a, b) => {
        const aPriced = hasPlausibleComparablePrice(a) ? 1 : 0;
        const bPriced = hasPlausibleComparablePrice(b) ? 1 : 0;
        return bPriced - aPriced;
      })
      .slice(0, 1);

    if (emergencyFallback.length > 0) {
      console.log("[market][relaxed-fallback]", {
        reason: "all_filters_returned_zero",
        selected: emergencyFallback.length,
      });
      competitors = emergencyFallback;
    }
  }
  if (competitors.some((listing) => listing.platform === "airbnb")) {
    await enrichAirbnbCompetitorPrices(competitors);
  }

  for (const listing of competitors) {
    console.log("[market][competitor-kept]", {
      platform: listing.platform ?? null,
      title: listing.title ?? null,
      city: guessListingCity(listing),
      country: guessListingCountry(listing),
      propertyType: listing.propertyType ?? null,
      bedrooms: listing.bedrooms ?? listing.bedroomCount ?? null,
      price: typeof listing.price === "number" ? listing.price : null,
      currency: listing.currency ?? null,
    });
  }

  debugComparablesLog("[guest-audit][comparables][pipeline-debug]", {
    target: {
      title: input.target.title ?? null,
      platform: input.target.platform ?? null,
      propertyType: input.target.propertyType ?? null,
      normalizedTargetType: getNormalizedComparableType(input.target),
      capacity: input.target.capacity ?? null,
      bedrooms: input.target.bedrooms ?? null,
      bathrooms: input.target.bathrooms ?? null,
      locationLabel: input.target.locationLabel ?? null,
    },
    platform: input.target.platform ?? null,
    source: "searchCompetitorsAroundTarget",
    searchResultCountRaw: uniqueCandidates.length,
    rawCandidates: sanitizedCompetitors.map((listing) => ({
      id: listing.externalId ?? null,
      url: listing.url ?? null,
      title: listing.title ?? null,
      platform: listing.platform ?? null,
      propertyType: listing.propertyType ?? null,
      normalizedType: getNormalizedComparableType(listing),
      city: guessListingCity(listing),
      neighborhood: guessListingNeighborhood(listing),
      languageGuess: guessListingLanguage(listing),
      capacity: listing.capacity ?? null,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      photosCount: Array.isArray(listing.photos)
        ? listing.photos.filter(Boolean).length
        : typeof listing.photosCount === "number"
          ? listing.photosCount
          : 0,
      ratingValue:
        typeof listing.ratingValue === "number"
          ? listing.ratingValue
          : typeof listing.rating === "number"
            ? listing.rating
            : null,
      reviewCount: typeof listing.reviewCount === "number" ? listing.reviewCount : null,
      amenitiesCount: Array.isArray(listing.amenities)
        ? listing.amenities.filter(Boolean).length
        : 0,
      locationLabel: listing.locationLabel ?? null,
    })),
    filterResultCount: competitors.length,
    rejectedCandidates: candidateDecisions
      .filter((decision) => !decision.accepted)
      .map((decision) => ({
        id: decision.candidate.externalId ?? null,
        url: decision.candidate.url ?? null,
        title: decision.candidate.title ?? null,
        platform: decision.candidate.platform ?? null,
        normalizedType: decision.candidateNormalizedType,
        normalizedTargetType: decision.targetNormalizedType,
        city: decision.candidateCity,
        neighborhood: decision.candidateNeighborhood,
        languageGuess: decision.candidateLanguageGuess,
        bedrooms: decision.candidate.bedrooms ?? null,
        bathrooms: decision.candidate.bathrooms ?? null,
        capacity: decision.candidate.capacity ?? null,
        reasons: decision.reasons,
      })),
    retainedCandidates: competitors.map((listing) => ({
      id: listing.externalId ?? null,
      url: listing.url ?? null,
      title: listing.title ?? null,
      platform: listing.platform ?? null,
      normalizedType: getNormalizedComparableType(listing),
      city: guessListingCity(listing),
      neighborhood: guessListingNeighborhood(listing),
      languageGuess: guessListingLanguage(listing),
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      capacity: listing.capacity ?? null,
    })),
    finalInjectedCount: competitors.length,
  });

  return {
    target: input.target,
    competitors,
    attempted: uniqueCandidates.length,
    selected: competitors.length,
    radiusKm,
    maxResults,
  };
}

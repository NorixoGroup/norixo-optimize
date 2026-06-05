import { chromium } from "playwright";
import { discoverBookingCandidatesWithRenderedSerp } from "./booking-rendered-discovery";
import type { CompetitorCandidate } from "./types";
import type { ExtractedListing } from "@/lib/extractors/types";
import { getNormalizedComparableType } from "./filterComparableListings";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";
const DEBUG_BOOKING_PIPELINE =
  process.env.DEBUG_BOOKING_PIPELINE === "true" || DEBUG_GUEST_AUDIT;
const DEBUG_MARKET_PIPELINE = process.env.DEBUG_MARKET_PIPELINE === "true";

function isBookingDiscoveryAborted(signal?: AbortSignal | null): boolean {
  return signal?.aborted === true;
}

function debugBookingComparableLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

function peekBookingTargetStaySearchParams(url: string | null | undefined) {
  if (!url?.trim()) {
    return {
      checkin: null as string | null,
      checkout: null as string | null,
      selected_currency: null as string | null,
      group_adults: null as string | null,
      no_rooms: null as string | null,
    };
  }
  try {
    const sp = new URL(url.trim()).searchParams;
    return {
      checkin: sp.get("checkin")?.trim() || null,
      checkout: sp.get("checkout")?.trim() || null,
      selected_currency: sp.get("selected_currency")?.trim() || null,
      group_adults: sp.get("group_adults")?.trim() || null,
      no_rooms: sp.get("no_rooms")?.trim() || null,
    };
  } catch {
    return {
      checkin: null,
      checkout: null,
      selected_currency: null,
      group_adults: null,
      no_rooms: null,
    };
  }
}

function peekBookingDiscoveryTargetGeoParts(target: ExtractedListing): {
  targetCity: string | null;
  targetCountry: string | null;
} {
  const rawLocation = normalizeSearchToken(target.locationLabel ?? "");
  const locationParts = rawLocation
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (locationParts.length >= 2) {
    const sanitized = sanitizeBookingDiscoveryCity(
      locationParts.slice(0, -1).join(" ").trim() || null
    );
    return {
      targetCity: sanitized.city,
      targetCountry: locationParts[locationParts.length - 1] ?? null,
    };
  }
  if (locationParts.length === 1) {
    const sanitized = sanitizeBookingDiscoveryCity(locationParts[0] ?? null);
    return { targetCity: sanitized.city, targetCountry: null };
  }
  return { targetCity: null, targetCountry: null };
}

function normalizeSearchToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s,-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BOOKING_UNRELIABLE_DISCOVERY_CITY_TOKENS = new Set([
  "apparemment",
  "appartement",
  "apartment",
  "appart",
  "centre",
  "center",
  "ville",
  "city",
  "accommodation",
  "booking",
  "hotel",
  "maison",
  "logement",
  "this",
  "site",
  "reached",
  "can",
  "cant",
  "can t",
]);

function sanitizeBookingDiscoveryCity(value: string | null | undefined): {
  city: string | null;
  reason: string | null;
} {
  const normalized = normalizeSearchToken(value ?? "").toLowerCase();
  if (!normalized) return { city: null, reason: "empty_city_candidate" };
  if (BOOKING_UNRELIABLE_DISCOVERY_CITY_TOKENS.has(normalized)) {
    return { city: null, reason: `blocked_city_token:${normalized}` };
  }
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (
    tokens.length > 0 &&
    tokens.every((token) => BOOKING_UNRELIABLE_DISCOVERY_CITY_TOKENS.has(token))
  ) {
    return { city: null, reason: `all_city_tokens_blocked:${normalized}` };
  }
  return { city: normalized, reason: null };
}

function isLikelyBookingHotelUrl(url: string) {
  if (!url.includes("/hotel/")) return false;
  if (url.includes("/hotel/index.html") || /\/hotel\/index/i.test(url)) return false;
  return /booking\.com\/hotel\/[a-z]{2}\//i.test(url);
}

function pathCountryCodeToDiscoveryLabel(code: string): string | null {
  switch (code.toLowerCase()) {
    case "ma":
      return "morocco";
    case "fr":
      return "france";
    case "ke":
      return "kenya";
    case "us":
      return "united states";
    case "gb":
      return "united kingdom";
    case "be":
      return "belgium";
    case "es":
      return "spain";
    default:
      return null;
  }
}

function canonicalCountryForDiscoveryCompare(label: string | null | undefined): string | null {
  if (!label) return null;
  const n = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (n.includes("morocco") || n.includes("maroc")) return "morocco";
  if (n.includes("france")) return "france";
  if (n.includes("kenya")) return "kenya";
  if (n.includes("united states") || /\b(?:usa|u s a|u s)\b/.test(n)) return "united states";
  if (n.includes("united kingdom") || n === "uk") return "united kingdom";
  if (n.includes("belgium") || n.includes("belgique")) return "belgium";
  if (n.includes("spain") || n.includes("espana") || n.includes("españa")) return "spain";
  return n.replace(/[^a-z0-9]+/g, " ").trim() || null;
}

function isBookingDiscoveryUrlAllowedForTargetCountry(url: string, normalizedTargetCountry: string | null): boolean {
  if (!normalizedTargetCountry) return true;
  const m = url.match(/\/hotel\/([a-z]{2})\//i);
  if (!m?.[1]) return true;
  const pathLabel = pathCountryCodeToDiscoveryLabel(m[1]);
  if (!pathLabel) return true;
  const pathCanon = canonicalCountryForDiscoveryCompare(pathLabel);
  const targetCanon = canonicalCountryForDiscoveryCompare(normalizedTargetCountry);
  if (!pathCanon || !targetCanon) return true;
  return pathCanon === targetCanon;
}

function extractBookingSlug(url: string) {
  const match = url.match(/booking\.com\/hotel\/[a-z]{2}\/([^/?#]+?)(?:\.[a-z-]+)?\.html/i);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Étiquette de type déduite du slug hôtel (hors chemin `/hotel/xx/`). */
export type BookingCandidateInferredType =
  | "villa"
  | "maison"
  | "house"
  | "home"
  | "holiday_home"
  | "riad"
  | "dar"
  | "apartment"
  | "studio"
  | "room"
  | "hotel"
  | "guesthouse"
  | "hostel"
  | "unknown";

function slugHaystackForBookingTypeInference(url: string): string {
  const raw = extractBookingSlug(url);
  if (!raw) return "";
  let s = raw.replace(/-/g, " ");
  try {
    s = decodeURIComponent(s);
  } catch {
    /* ignore */
  }
  return s.toLowerCase();
}

/** Aligné sur normalizeMarketText (searchCompetitors) — évite import circulaire. */
function normalizeForBookingDiscoveryHaystack(value: string | null | undefined): string {
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

/** Ville « demandée » pour discovery (cohérent avec le plan de requêtes). */
function getBookingDiscoveryRequestedCityLabel(target: ExtractedListing): string | null {
  const rawTitle = normalizeSearchToken(target.title ?? "");
  const rawLocation = normalizeSearchToken(target.locationLabel ?? "");
  const titleParts = rawTitle
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const locationParts = rawLocation
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const tailLocation = titleParts.length > 1 ? titleParts.slice(-2).join(" ") : "";
  const broadLocation =
    locationParts.length >= 2
      ? locationParts.join(" ")
      : locationParts.length === 1
        ? locationParts[0] ?? ""
        : "";
  const geoCountry =
    locationParts.length >= 2 && locationParts[locationParts.length - 1]?.trim()
      ? locationParts[locationParts.length - 1].trim()
      : "";
  const geoCity =
    locationParts.length >= 2 && geoCountry
      ? locationParts.slice(0, -1).join(" ").trim()
      : "";
  const effectiveGeoCity = normalizeSearchToken(
    (geoCity && geoCountry ? geoCity : "") ||
      (locationParts.length === 1 ? locationParts[0] ?? "" : "") ||
      ""
  );
  const requested = normalizeSearchToken(
    effectiveGeoCity || broadLocation || rawLocation || tailLocation || ""
  );
  return requested || null;
}

function bookingUrlContainsDiscoveryTargetCity(url: string, target: ExtractedListing): boolean {
  const city = getBookingDiscoveryRequestedCityLabel(target);
  if (!city) return false;
  const n = normalizeForBookingDiscoveryHaystack(city);
  if (n.length < 4) return false;
  const hay = normalizeForBookingDiscoveryHaystack(`${url} ${slugHaystackForBookingTypeInference(url)}`);
  return hay.includes(n);
}

function parseBookingSerpResolvedCityGuess(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    const cityMatch = u.pathname.match(
      /\/(?:city|region|landmark)\/([a-z]{2})\/([^/.?#]+)\.html/i
    );
    if (cityMatch?.[2]) {
      return normalizeForBookingDiscoveryHaystack(cityMatch[2].replace(/-/g, " "));
    }
  } catch {
    /* ignore */
  }
  return null;
}

function getBookingCountryCodeForCityFallback(target: ExtractedListing): string | null {
  const targetRecord = target as ExtractedListing & {
    country?: string | null;
    locationCountry?: string | null;
    countryCode?: string | null;
    address?: string | null;
  };

  const rawCountry = [
    targetRecord.country,
    targetRecord.locationCountry,
    targetRecord.countryCode,
    target.locationLabel,
    targetRecord.address,
    target.url,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  const country = normalizeForBookingDiscoveryHaystack(rawCountry);

  const map: Record<string, string> = {
    france: "fr",
    morocco: "ma",
    maroc: "ma",
    spain: "es",
    espagne: "es",
    italy: "it",
    italie: "it",
    portugal: "pt",
    "united kingdom": "gb",
    uk: "gb",
    england: "gb",
    angleterre: "gb",
    germany: "de",
    allemagne: "de",
    netherlands: "nl",
    belgium: "be",
    belgique: "be",
    austria: "at",
    suisse: "ch",
    switzerland: "ch",
    turkey: "tr",
    turquie: "tr",
    "united arab emirates": "ae",
    uae: "ae",
    emirates: "ae",
  };

  return map[country] ?? null;
}

function buildBookingCityFallbackUrl(target: ExtractedListing, requestedCity: string | null): string | null {
  const countryCode = getBookingCountryCodeForCityFallback(target);
  if (!countryCode) return null;

  const normalized = normalizeForBookingDiscoveryHaystack(requestedCity ?? "");
  if (!normalized || normalized.length < 3) return null;

  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) return null;

  return `https://www.booking.com/city/${countryCode}/${slug}.html`;
}

/** Ville demandée détectée dans la requête interactive (intention de recherche). */
function inferRequestedCityLabelFromDiscoveryQuery(query: string): string | null {
  const n = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\bsidi[\s-]+bouzid\b/i.test(n)) return "sidi bouzid";
  return null;
}

function getEffectiveRequestedCityForSerpGuard(
  target: ExtractedListing,
  query: string
): string | null {
  return inferRequestedCityLabelFromDiscoveryQuery(query) ?? getBookingDiscoveryRequestedCityLabel(target);
}

/** Slug ou URL : « sidi bouzid » normalisé ou sous-chaînes explicites sidi-bouzid. */
function urlContainsRequestedCitySignals(url: string, requestedNormalized: string): boolean {
  if (!requestedNormalized || requestedNormalized.length < 4) return false;
  const hay = normalizeForBookingDiscoveryHaystack(`${url} ${slugHaystackForBookingTypeInference(url)}`);
  if (hay.includes(requestedNormalized)) return true;
  const u = url.toLowerCase();
  if (requestedNormalized.includes("sidi") && requestedNormalized.includes("bouzid")) {
    if (u.includes("sidi-bouzid") || u.includes("sidi_bouzid")) return true;
  }
  return false;
}

function countBookingUrlsMatchingRequestedCity(
  rawUrls: Array<string | null | undefined>,
  requestedCityLabel: string | null
): { count: number; sample: string[] } {
  if (!requestedCityLabel) return { count: 0, sample: [] };
  const n = normalizeForBookingDiscoveryHaystack(requestedCityLabel);
  if (n.length < 4) return { count: 0, sample: [] };
  const matched: string[] = [];
  for (const raw of rawUrls) {
    const u = normalizeBookingHotelUrl(raw);
    if (!u || !isLikelyBookingHotelUrl(u)) continue;
    if (urlContainsRequestedCitySignals(u, n)) matched.push(u);
  }
  return { count: matched.length, sample: matched.slice(0, 5) };
}

function bookingUrlsSignalRequestedCity(urls: string[], requestedCityLabel: string | null): boolean {
  if (!requestedCityLabel) return false;
  const n = normalizeForBookingDiscoveryHaystack(requestedCityLabel);
  if (n.length < 4) return false;
  return urls.some((u) => urlContainsRequestedCitySignals(u, n));
}

function bookingTargetRefinementHaystack(target: ExtractedListing): string {
  const slugPart = slugHaystackForBookingTypeInference(target.url ?? "");
  const titlePart = normalizeSearchToken(target.title ?? "").toLowerCase();
  const propPart = normalizeSearchToken(target.propertyType ?? "").toLowerCase();
  const locPart = normalizeSearchToken(target.locationLabel ?? "").toLowerCase();
  return `${slugPart} ${titlePart} ${propPart} ${locPart}`.replace(/\s+/g, " ").trim();
}

/** Aiguille Sidi Bouzid depuis la cible (filtre merge discovery, sans scoring). */
function inferSidiBouzidNeedleFromTarget(target: ExtractedListing): string | null {
  const fromLabel = getBookingDiscoveryRequestedCityLabel(target);
  const normLabel = fromLabel ? normalizeForBookingDiscoveryHaystack(fromLabel) : "";
  if (normLabel.includes("sidi") && normLabel.includes("bouzid")) return "sidi bouzid";
  if (/\bsidi[\s-]+bouzid\b/.test(bookingTargetRefinementHaystack(target))) return "sidi bouzid";
  return null;
}

/** Affinage Booking avant requêtes discovery et type gate (slug, titre, type de bien, lieu). */
function refineBookingTargetType(target: ExtractedListing, currentTargetType: string): string {
  // Hard guard: Booking discovery must never refine apartment/studio targets into villa-like.
  // The target type is already normalized upstream; refinement is only for non-urban rental types.
  if (currentTargetType === "studio_like" || currentTargetType === "apartment_like") {
    return currentTargetType;
  }

  const h = bookingTargetRefinementHaystack(target);
  if (!h) return currentTargetType;

  // Do not let broad Booking slug/title/location hints mutate apartment/studio targets
  // into villa_like. This protects urban apartment-like listings from villa discovery.
  const apartmentLikeTarget =
    currentTargetType === "studio_like" || currentTargetType === "apartment_like";

  if (!apartmentLikeTarget && /\bvilla\b/.test(h)) return "villa_like";
  if (!apartmentLikeTarget && /\bmaison\b/.test(h) && /\bpiscine\b/.test(h)) return "villa_like";
  if (/\briad\b/.test(h) || /\bdar\b/.test(h)) return "riad_like";
  if (/\b(apartment|appartement|flat)\b/.test(h)) return "apartment_like";
  if (/\bstudio\b/.test(h)) return "studio_like";
  if (/\b(chambre|chambres|room|rooms|suite|suites)\b/.test(h)) return "room_like";
  if (
    /\bhotel\b/.test(h) ||
    /\bhostel\b/.test(h) ||
    /\bguesthouse\b/.test(h) ||
    /\bguest house\b/.test(h) ||
    /\bmaison d hotes\b/.test(h) ||
    /\bmaison dhotes\b/.test(h)
  ) {
    return "hotel_like";
  }
  return currentTargetType;
}

function slugHasBookingPrivateRentalSignals(s: string): boolean {
  if (!s) return false;
  if (/\bprivate[- ]pool\b/.test(s)) return true;
  if (/\b(entire|whole)[- ](villa|home|house|place)\b/.test(s)) return true;
  if (/\b(villa|holiday)[- ]home\b/.test(s) || /\bholidayhome\b/.test(s)) return true;
  if (/\bpiscine[- ]?(prive|privee|privees|private)\b/.test(s)) return true;
  if (/\bmaison[- ]?(entiere|entière)\b/.test(s)) return true;
  if (/\bgere[- ]?par[- ]?un[- ]?particulier\b/.test(s)) return true;
  if (/\bhebergement[- ]?prive\b/.test(s)) return true;
  if (/\bpiscine\b/.test(s) && /\b(prive|privee|private)\b/.test(s)) return true;
  return false;
}

function slugHasBookingVillaDiscoveryAmenitySignals(s: string): boolean {
  if (!s) return false;
  if (/\bpiscine\b/.test(s)) return true;
  if (/\bpool\b/.test(s)) return true;
  if (/\bprivate[- ]pool\b/.test(s)) return true;
  return false;
}

/** Infère le type à partir du slug décodé uniquement (pas le pays `/hotel/ma/`). */
export function inferBookingCandidateTypeFromUrl(url: string): BookingCandidateInferredType {
  const s = slugHaystackForBookingTypeInference(url);
  if (!s) return "unknown";
  if (/\bstudio\b/.test(s)) return "studio";
  if (/\b(chambre|chambres|room|rooms|suite|suites)\b/.test(s)) return "room";
  if (slugHasBookingPrivateRentalSignals(s)) return "villa";
  if (
    /\b(apartment|appartement|apart|aparthotel|residence|residences|flat)\b/.test(s)
  ) {
    return "apartment";
  }
  if (/\bguesthouse\b/.test(s) || /\bguest house\b/.test(s)) return "guesthouse";
  if (/\bmaison d hotes\b/.test(s) || /\bmaison dhotes\b/.test(s)) return "guesthouse";
  if (/\bhostel\b/.test(s)) return "hostel";
  if (/\b(hotel|boutique|resort)\b/.test(s)) return "hotel";
  if (/\briad\b/.test(s)) return "riad";
  if (/\bdar\b/.test(s)) return "dar";
  if (/\bvilla\b/.test(s)) return "villa";
  if (/\bmaison\b/.test(s)) return "maison";
  if (/\bhouse\b/.test(s)) return "house";
  if (/\bholiday[- ]home\b/.test(s) || /\bholidayhome\b/.test(s)) return "holiday_home";
  if (/\bhome\b/.test(s)) return "home";
  const rawHyp = extractBookingSlug(url) ?? "";
  if (/\bis[-_]bouzid\b/.test(rawHyp)) return "home";
  return "unknown";
}

/** Pool villa relâché contrôlé : pas de riad/appart/hôtel/chambre/unknown. */
function isVillaControlledRelaxedCandidateType(
  candidateType: BookingCandidateInferredType
): boolean {
  return (
    candidateType === "villa" ||
    candidateType === "maison" ||
    candidateType === "house" ||
    candidateType === "home" ||
    candidateType === "holiday_home" ||
    candidateType === "dar"
  );
}

function passesBookingVillaDiscoverySignalGate(url: string): boolean {
  const s = slugHaystackForBookingTypeInference(url);
  if (!s) return false;
  if (slugHasBookingPrivateRentalSignals(s)) return true;
  if (/\b(villa|maison|house|home|holiday[- ]home|holidayhome)\b/.test(s)) return true;
  if (/\bmaison\b/.test(s) && /\b\d+\s*chambres?\b/.test(s)) return true;
  if (/\bvilla\b/.test(s) && /\bprivee?\b/.test(s)) return true;
  return slugHasBookingVillaDiscoveryAmenitySignals(s);
}

function passesBookingDiscoveryVillaControlledRelaxedGate(
  target: ExtractedListing,
  url: string
): boolean {
  if (!isLikelyBookingHotelUrl(url)) return true;
  if (isTargetVariant(url, target)) return true;
  const plan = buildBookingSearchQueryPlan(target);
  if (plan.refinedTargetType === "villa_like" && bookingUrlContainsDiscoveryTargetCity(url, target)) {
    return true;
  }
  const candidateType = inferBookingCandidateTypeFromUrl(url);
  return isVillaControlledRelaxedCandidateType(candidateType) || passesBookingVillaDiscoverySignalGate(url);
}

export function isBookingCandidateTypeAllowedForTarget(
  targetType: string,
  candidateType: BookingCandidateInferredType
): boolean {
  if (!targetType || targetType === "unknown") return true;
  if (targetType === "villa_like") {
    return (
      candidateType === "villa" ||
      candidateType === "maison" ||
      candidateType === "house" ||
      candidateType === "home" ||
      candidateType === "holiday_home" ||
      candidateType === "dar"
    );
  }
  if (candidateType === "unknown") return true;

  switch (targetType) {
    case "apartment_like":
      return candidateType === "apartment" || candidateType === "studio";
    case "studio_like":
      return candidateType === "studio";
    case "room_like":
      return candidateType === "room";
    case "hotel_like":
      return (
        candidateType === "hotel" || candidateType === "guesthouse" || candidateType === "hostel"
      );
    case "riad_like":
      return candidateType === "riad" || candidateType === "dar";
    case "house_like":
      return (
        candidateType === "riad" ||
        candidateType === "dar" ||
        candidateType === "villa" ||
        candidateType === "maison" ||
        candidateType === "house" ||
        candidateType === "home"
      );
    default:
      return true;
  }
}

function passesBookingDiscoveryTypeGate(
  target: ExtractedListing,
  url: string,
  refinedTargetType: string
): boolean {
  if (!isLikelyBookingHotelUrl(url)) return true;
  if (isTargetVariant(url, target)) return true;
  if (refinedTargetType === "villa_like" && bookingUrlContainsDiscoveryTargetCity(url, target)) {
    return true;
  }
  if (refinedTargetType === "villa_like" && passesBookingVillaDiscoverySignalGate(url)) {
    return true;
  }
  const candidateType = inferBookingCandidateTypeFromUrl(url);
  return isBookingCandidateTypeAllowedForTarget(refinedTargetType, candidateType);
}

function inferBookingUrlTypeBucket(url: string) {
  const slug = extractBookingSlug(url) ?? "";

  if (!slug) return "unknown";
  if (/\bstudio\b/.test(slug)) return "studio_like";
  if (
    /\b(apartment|appartement|apart|aparthotel|residence|residences|flat|suite)\b/.test(
      slug
    )
  ) {
    return "apartment_like";
  }
  if (
    slugHasBookingPrivateRentalSignals(slug.replace(/-/g, " ").toLowerCase()) ||
    /\bis[-_]bouzid\b/.test(slug)
  ) {
    return "house_like";
  }
  if (/\b(villa|house|maison|riad|dar|home)\b/.test(slug)) {
    return "house_like";
  }
  if (/\b(hotel|boutique|hostel|resort|spa)\b/.test(slug)) {
    return "hotel_like";
  }

  return "unknown";
}

function getBookingApartmentPreselectSignals(url: string): {
  apartmentExplicit: boolean;
  hotelStrong: boolean;
  reasons: string[];
} {
  const slug = (extractBookingSlug(url) ?? "").toLowerCase();
  const reasons: string[] = [];
  const apartmentExplicit =
    /\b(appart|appartement|apartment|apartments|residence|residences|condo|flat)\b/.test(slug);
  const probableHotelSlug =
    /\bminzah\b/.test(slug) ||
    /\betoile-du-nord\b/.test(slug) ||
    /\bdiagonal\b/.test(slug) ||
    /\bben-batouta\b/.test(slug) ||
    /\bmamora-bay\b/.test(slug) ||
    /\blalla-soulika\b/.test(slug);
  const hotelStrong =
    /\bhotel\b/.test(slug) ||
    /\bpalace\b/.test(slug) ||
    /\bresort\b/.test(slug) ||
    /\bspa\b/.test(slug) ||
    /\bfairmont\b/.test(slug) ||
    /\bryad-art-place\b/.test(slug) ||
    /\bmarina-bay-center\b/.test(slug) ||
    probableHotelSlug;
  if (apartmentExplicit) reasons.push("explicit_apartment_slug_signal");
  if (/\bhotel\b/.test(slug)) reasons.push("strong_hotel_slug_signal");
  if (/\bpalace\b/.test(slug)) reasons.push("strong_palace_slug_signal");
  if (/\bresort\b/.test(slug)) reasons.push("strong_resort_slug_signal");
  if (/\bspa\b/.test(slug)) reasons.push("strong_spa_slug_signal");
  if (/\bfairmont\b/.test(slug)) reasons.push("strong_fairmont_slug_signal");
  if (/\bryad-art-place\b/.test(slug)) reasons.push("strong_ryad_art_place_slug_signal");
  if (/\bmarina-bay-center\b/.test(slug)) reasons.push("strong_marina_bay_city_center_slug_signal");
  if (/\bminzah\b/.test(slug)) reasons.push("probable_hotel_minzah_slug_signal");
  if (/\betoile-du-nord\b/.test(slug)) reasons.push("probable_hotel_etoile_du_nord_slug_signal");
  if (/\bdiagonal\b/.test(slug)) reasons.push("probable_hotel_diagonal_slug_signal");
  if (/\bben-batouta\b/.test(slug)) reasons.push("probable_hotel_ben_batouta_slug_signal");
  if (/\bmamora-bay\b/.test(slug)) reasons.push("probable_hotel_mamora_bay_slug_signal");
  if (/\blalla-soulika\b/.test(slug)) reasons.push("probable_hotel_lalla_soulika_slug_signal");
  return { apartmentExplicit, hotelStrong, reasons };
}

function rankBookingComparableUrl(target: ExtractedListing, url: string) {
  const slug = extractBookingSlug(url) ?? "";
  const normalizedTargetType = getNormalizedComparableType(target);
  const bookingTargetGeo = peekBookingDiscoveryTargetGeoParts(target);
  const normalizedTargetCountry = canonicalCountryForDiscoveryCompare(
    bookingTargetGeo.targetCountry
  );
  const candidateType = inferBookingUrlTypeBucket(url);
  const apartmentPreselectSignals = getBookingApartmentPreselectSignals(url);
  const title = `${target.title ?? ""} ${target.locationLabel ?? ""}`.toLowerCase();
  const locationBonus =
    ["gueliz", "guéliz", "marrakech"].reduce(
      (sum, token) => sum + (slug.includes(token.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ? 8 : 0),
      0
    );
  const bedroomBonus = target.bedrooms && slug.includes(`${target.bedrooms}`)
    ? 6
    : /\b(2br|2-bedroom|2-bed|2ch|2-ch)\b/.test(slug)
      ? 6
      : 0;

  let score = 0;
  if (normalizedTargetType !== "unknown" && candidateType === normalizedTargetType) {
    score += 40;
  } else if (candidateType === "unknown") {
    score += 8;
  }

  if (title.includes("appartement") && /\b(appartement|apartment|apart|residence)\b/.test(slug)) {
    score += 18;
  }

  if (title.includes("hotel") && /\bhotel\b/.test(slug)) {
    score += 10;
  }

  score += bedroomBonus + locationBonus;

  if (normalizedTargetType === "apartment_like") {
    if (apartmentPreselectSignals.apartmentExplicit) score += 32;
    if (candidateType === "apartment_like") score += 18;
    if (candidateType === "studio_like") score += 10;
    if (candidateType === "hotel_like") score -= 28;
    if (candidateType === "house_like") score -= 18;
    if (apartmentPreselectSignals.hotelStrong) score -= 42;
  }

  if (normalizedTargetType === "villa_like") {
    const h = slug.toLowerCase();
    if (/\bvilla\b/i.test(h)) score += 20;
    if (/\briad\b/i.test(h)) score += 20;
    if (/\bhouse\b/i.test(h)) score += 16;
    if (/\bhome\b/i.test(h)) score += 12;
    if (/\bguesthouse\b/i.test(h)) score += 16;
    if (/\bdar\b/i.test(h)) score += 16;
    if (/\bmaison\b/i.test(h)) score += 16;
    if (/\bhotel\b/i.test(h)) score -= 24;
    if (/\bhostel\b/i.test(h)) score -= 20;
    if (/\bapartment\b/i.test(h)) score -= 22;
    if (/\bstudio\b/i.test(h)) score -= 22;
    if (/\broom\b/i.test(h)) score -= 14;
  }

  if (normalizedTargetType === "riad_like" && normalizedTargetCountry === "morocco") {
    score += getBookingMoroccoRiadRankingAdjustment(url).scoreDelta;
  }

  return score;
}

export function getBookingMoroccoRiadRankingAdjustment(url: string): {
  scoreDelta: number;
  boostedReasons: string[];
  penalizedReasons: string[];
} {
  const slug = (extractBookingSlug(url) ?? "").toLowerCase();
  const h = normalizeSearchToken(slugHaystackForBookingTypeInference(url)).toLowerCase();
  const boostedReasons: string[] = [];
  const penalizedReasons: string[] = [];
  let scoreDelta = 0;

  if (/\briad\b/.test(h)) {
    scoreDelta += 1000;
    boostedReasons.push("riad");
  }
  if (/\bdar\b/.test(h)) {
    scoreDelta += 1000;
    boostedReasons.push("dar");
  }
  if (/\bmedina\b/.test(h)) {
    scoreDelta += 120;
    boostedReasons.push("medina");
  }
  if (/\bfes\b/.test(h)) {
    scoreDelta += 120;
    boostedReasons.push("fes");
  }
  if (/\bfez\b/.test(h)) {
    scoreDelta += 120;
    boostedReasons.push("fez");
  }
  if (/\bmaison d hotes\b/.test(h) || /\bmaison dhotes\b/.test(h)) {
    scoreDelta += 120;
    boostedReasons.push("maison_d_hotes");
  }
  if (/\bguest house\b/.test(h) || /\bguesthouse\b/.test(h)) {
    scoreDelta += 120;
    boostedReasons.push("guest_house");
  }
  if (/\btraditional house\b/.test(h)) {
    scoreDelta += 120;
    boostedReasons.push("traditional_house");
  }
  if (/\bpalais\s+marocain\b/.test(h)) {
    scoreDelta += 18;
    boostedReasons.push("palais_marocain");
  }
  if (/\bmaison\s+traditionnelle\b/.test(h)) {
    scoreDelta += 18;
    boostedReasons.push("maison_traditionnelle");
  }

  if (/\bhotel\b/.test(h)) {
    scoreDelta -= 18;
    penalizedReasons.push("hotel");
  }
  if (/\bspa\b/.test(h)) {
    scoreDelta -= 18;
    penalizedReasons.push("spa");
  }
  if (/\bresort\b/.test(h)) {
    scoreDelta -= 20;
    penalizedReasons.push("resort");
  }
  if (/\bmarriott\b/.test(h)) {
    scoreDelta -= 28;
    penalizedReasons.push("marriott");
  }
  if (/\bpalace\b/.test(h)) {
    scoreDelta -= 18;
    penalizedReasons.push("palace");
  }
  if (/\burban\b/.test(h)) {
    scoreDelta -= 16;
    penalizedReasons.push("urban");
  }
  if (/\broyal\b/.test(h)) {
    scoreDelta -= 14;
    penalizedReasons.push("royal");
  }

  // Keep slug around to ensure `/riad-` and `/dar-` style paths are strongly boosted even if tokenization changes.
  if (slug.includes("riad-") && !boostedReasons.includes("riad")) {
    scoreDelta += 1000;
    boostedReasons.push("slug_riad");
  }
  if (slug.includes("dar-") && !boostedReasons.includes("dar")) {
    scoreDelta += 1000;
    boostedReasons.push("slug_dar");
  }

  return { scoreDelta, boostedReasons, penalizedReasons };
}

export function describeBookingApartmentPreselectCandidate(url: string): {
  slug: string;
  reasons: string[];
} {
  return {
    slug: extractBookingSlug(url) ?? "",
    reasons: getBookingApartmentPreselectSignals(url).reasons,
  };
}

function isTargetVariant(url: string, target: ExtractedListing) {
  const targetSlug = extractBookingSlug(target.url ?? "");
  const candidateSlug = extractBookingSlug(url);
  if (!targetSlug || !candidateSlug) return false;
  return candidateSlug === targetSlug;
}

function normalizeBookingHotelUrl(url: string | null | undefined) {
  if (!url) return null;
  const absolute = url.startsWith("http") ? url : `https://www.booking.com${url}`;
  return absolute.split("?")[0];
}

function collectBookingHotelUrlsFromText(text: string) {
  return [...text.matchAll(/https:\\\/\\\/www\.booking\.com\\\/hotel\\\/[a-z]{2}\\\/[A-Za-z0-9\-_.]+(?:\.[a-z-]+)?\.html/gi)]
    .map((match) => match[0].replaceAll("\\/", "/").split("?")[0])
    .filter(Boolean);
}

function buildApartmentStrongQueries(args: {
  effectiveGeoCity: string | null;
  countryQueryToken: string | null;
}): string[] {
  if (!args.effectiveGeoCity) return [];

  const c = args.effectiveGeoCity;
  const rawApartment: string[] = [];

  if (args.countryQueryToken) {
    rawApartment.push(
      `apartment ${c} ${args.countryQueryToken}`,
      `${c} ${args.countryQueryToken} apartment`,
      `appartement ${c} ${args.countryQueryToken}`,
      `${c} ${args.countryQueryToken} appartement`
    );
  }

  rawApartment.push(
    `apartment ${c}`,
    `${c} apartment`,
    `appartement ${c}`,
    `${c} appartement`
  );

  const seen = new Set<string>();
  const queries: string[] = [];
  for (const q of rawApartment) {
    const k = normalizeSearchToken(q);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    queries.push(k);
  }

  return queries;
}

function buildBookingSearchQueryPlan(target: ExtractedListing): {
  queries: string[];
  strongTypeQueries: string[];
  targetType: string;
  refinedTargetType: string;
  blockedReason?: string | null;
  targetCityBeforeSanitize?: string | null;
  targetCityAfterSanitize?: string | null;
} {
  const targetType = getNormalizedComparableType(target);
  const refinedTargetType = refineBookingTargetType(target, targetType);
  const rawTitle = normalizeSearchToken(target.title ?? "");
  const rawLocation = normalizeSearchToken(target.locationLabel ?? "");
  const titleParts = rawTitle
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const locationParts = rawLocation
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const tailLocation = titleParts.length > 1 ? titleParts.slice(-2).join(" ") : "";
  const broadLocation =
    locationParts.length >= 2
      ? locationParts.join(" ")
      : locationParts.length === 1
        ? locationParts[0] ?? ""
        : "";
  const propertyHint = target.bedrooms ? `${target.bedrooms} bedroom` : target.propertyType ?? "";

  const geoCountry =
    locationParts.length >= 2 && locationParts[locationParts.length - 1]?.trim()
      ? locationParts[locationParts.length - 1].trim()
      : "";
  const geoCityRaw =
    locationParts.length >= 2 && geoCountry
      ? locationParts.slice(0, -1).join(" ").trim()
      : "";
  const propertyTypeToken = normalizeSearchToken(target.propertyType ?? "").trim();

  const effectiveGeoCityRaw = normalizeSearchToken(
    (geoCityRaw && geoCountry ? geoCityRaw : "") ||
      (locationParts.length === 1 ? locationParts[0] ?? "" : "") ||
      ""
  );
  const sanitizedGeoCity = sanitizeBookingDiscoveryCity(geoCityRaw);
  const sanitizedEffectiveGeoCity = sanitizeBookingDiscoveryCity(effectiveGeoCityRaw);
  const geoCity = sanitizedGeoCity.city ?? "";
  const effectiveGeoCity = sanitizedEffectiveGeoCity.city ?? "";
  const targetCountryFromUrl = (() => {
    const code = (target.url ?? "").match(/\/hotel\/([a-z]{2})\//i)?.[1]?.toLowerCase() ?? null;
    return code ? pathCountryCodeToDiscoveryLabel(code) : null;
  })();
  const countryQueryToken = geoCountry
    ? /maroc|marocco|morocco/i.test(geoCountry)
      ? "morocco"
      : normalizeSearchToken(geoCountry)
    : targetCountryFromUrl;

  const blockedMoroccoDiscovery =
    String(target.platform ?? "").toLowerCase() === "booking" &&
    countryQueryToken === "morocco" &&
    !effectiveGeoCity &&
    !geoCity;
  if (blockedMoroccoDiscovery) {
    const beforeCity = effectiveGeoCityRaw || geoCityRaw || null;
    const reason =
      sanitizedEffectiveGeoCity.reason ??
      sanitizedGeoCity.reason ??
      "booking_morocco_unreliable_target_city";
    console.log(
      "[market][booking-target-city-unreliable]",
      JSON.stringify({
        beforeCity,
        reason,
        title: target.title ?? null,
        url: target.url ?? null,
        locationLabel: target.locationLabel ?? null,
      })
    );
    return {
      queries: [],
      strongTypeQueries: [],
      targetType,
      refinedTargetType,
      blockedReason: "booking_morocco_unreliable_target_city",
      targetCityBeforeSanitize: beforeCity,
      targetCityAfterSanitize: null,
    };
  }

  const strongTypeQueries: string[] = [
    ...buildApartmentStrongQueries({
      effectiveGeoCity,
      countryQueryToken,
    }),
  ];

  if (refinedTargetType === "villa_like") {
    const rawStrong: string[] = [];
    if (effectiveGeoCity) {
      const c = effectiveGeoCity;
      if (countryQueryToken) {
        rawStrong.push(
          `villa ${c} ${countryQueryToken}`,
          `private villa ${c} ${countryQueryToken}`,
          `villa piscine ${c} ${countryQueryToken}`,
          `maison piscine ${c} ${countryQueryToken}`,
          `house ${c} ${countryQueryToken}`,
          `holiday home ${c} ${countryQueryToken}`,
          `villa ${c}`
        );
      } else {
        rawStrong.push(
          `villa ${c}`,
          `private villa ${c}`,
          `villa piscine ${c}`,
          `maison piscine ${c}`,
          `house ${c}`,
          `holiday home ${c}`
        );
      }
    } else {
      const loc = normalizeSearchToken(broadLocation || rawLocation || tailLocation || "");
      if (loc) {
        rawStrong.push(
          `villa ${loc}`,
          `private villa ${loc}`,
          `villa piscine ${loc}`,
          `maison piscine ${loc}`,
          `house ${loc}`,
          `holiday home ${loc}`
        );
      }
    }
    if (rawStrong.length === 0) {
      rawStrong.push("villa");
    }
    const vSeen = new Set<string>();
    for (const q of rawStrong) {
      const k = normalizeSearchToken(q);
      if (!k || vSeen.has(k)) continue;
      vSeen.add(k);
      strongTypeQueries.push(k);
    }
  }

  const houseStrongQueries: string[] = [];
  if (refinedTargetType === "house_like" && effectiveGeoCity) {
    const c = effectiveGeoCity;
    const rawHouse: string[] = [];
    if (countryQueryToken) {
      rawHouse.push(
        normalizeSearchToken(`maison ${c} ${countryQueryToken}`),
        normalizeSearchToken(`house ${c} ${countryQueryToken}`),
        normalizeSearchToken(`home ${c} ${countryQueryToken}`),
        normalizeSearchToken(`holiday home ${c} ${countryQueryToken}`)
      );
    } else {
      rawHouse.push(
        normalizeSearchToken(`maison ${c}`),
        normalizeSearchToken(`house ${c}`),
        normalizeSearchToken(`home ${c}`)
      );
    }
    const hSeen = new Set<string>();
    for (const q of rawHouse) {
      const k = normalizeSearchToken(q);
      if (!k || hSeen.has(k)) continue;
      hSeen.add(k);
      houseStrongQueries.push(k);
    }
  }

  const riadStrongQueries: string[] = [];
  if (refinedTargetType === "riad_like" && effectiveGeoCity) {
    const c = effectiveGeoCity;
    const rawRiad: string[] = [];
    if (countryQueryToken) {
      rawRiad.push(
        normalizeSearchToken(`riad ${c} ${countryQueryToken}`),
        normalizeSearchToken(`dar ${c} ${countryQueryToken}`),
        normalizeSearchToken(`riad ${c}`)
      );
    } else {
      rawRiad.push(normalizeSearchToken(`riad ${c}`), normalizeSearchToken(`dar ${c}`));
    }
    const rSeen = new Set<string>();
    for (const q of rawRiad) {
      const k = normalizeSearchToken(q);
      if (!k || rSeen.has(k)) continue;
      rSeen.add(k);
      riadStrongQueries.push(k);
    }
  }

  const strongGeoQueries: string[] = [];
  if (geoCity && geoCountry) {
    if (/maroc|marocco/i.test(geoCountry)) {
      strongGeoQueries.push(normalizeSearchToken(`${geoCity} morocco`));
      if (propertyTypeToken && refinedTargetType !== "house_like") {
        strongGeoQueries.push(normalizeSearchToken(`${geoCity} morocco ${propertyTypeToken}`));
      }
    }
    if (propertyTypeToken && refinedTargetType !== "house_like") {
      strongGeoQueries.push(normalizeSearchToken(`${geoCity} ${geoCountry} ${propertyTypeToken}`));
    }
    strongGeoQueries.push(normalizeSearchToken(`${geoCity} ${geoCountry}`));
    if (refinedTargetType !== "house_like") {
      strongGeoQueries.push(normalizeSearchToken(`${geoCity} accommodation`));
    }
    strongGeoQueries.push(normalizeSearchToken(`${geoCity} ${geoCountry} booking`));
  }

  const legacyQueries = [
    [tailLocation, propertyHint].filter(Boolean).join(" ").trim(),
    tailLocation,
    broadLocation,
    rawLocation,
    rawTitle,
    normalizeSearchToken(target.description?.slice(0, 80) ?? ""),
  ].filter(Boolean);

  /** Villas : éviter requêtes « hôtellerie » générique ; « booking » en fin de phrase est autorisé (ancrage SERP). */
  const bookingVillaForbiddenQuery = /\b(hotel|hostel|motel)\b|\baccommodation\b/i;

  /** Maroc + villa : ville d’abord (évite listes trop larges niveau pays seul / côte hors cible type Marrakech). */
  let moroccoVillaCityAnchors: string[] = [];
  if (
    refinedTargetType === "villa_like" &&
    countryQueryToken === "morocco" &&
    (effectiveGeoCity || geoCity)
  ) {
    const cityLabel = normalizeSearchToken(effectiveGeoCity || geoCity || "");
    if (cityLabel) {
      moroccoVillaCityAnchors = [
        normalizeSearchToken(`villa ${cityLabel} ${countryQueryToken}`),
        normalizeSearchToken(`maison ${cityLabel} ${countryQueryToken}`),
        normalizeSearchToken(`villa avec piscine ${cityLabel}`),
        normalizeSearchToken(`maison avec piscine ${cityLabel}`),
        normalizeSearchToken(`villa ${cityLabel}`),
        normalizeSearchToken(`maison ${cityLabel}`),
        normalizeSearchToken(`villa ${cityLabel} booking`),
        normalizeSearchToken(`maison ${cityLabel} booking`),
        normalizeSearchToken(`${cityLabel} ${countryQueryToken} villa`),
        normalizeSearchToken(`${cityLabel} ${countryQueryToken} maison`),
        normalizeSearchToken(`${cityLabel} morocco`),
        normalizeSearchToken(`${geoCity || cityLabel} morocco`),
        normalizeSearchToken(`private villa ${cityLabel}`),
        normalizeSearchToken(`villa ${cityLabel} piscine`),
        normalizeSearchToken(`villa privee ${cityLabel}`),
        normalizeSearchToken(`holiday home ${cityLabel}`),
        normalizeSearchToken(`maison 4 chambres ${cityLabel}`),
      ];
    }
  }

  const merged =
    refinedTargetType === "villa_like"
      ? [...moroccoVillaCityAnchors, ...strongTypeQueries]
      : [
          ...strongTypeQueries,
          ...houseStrongQueries,
          ...riadStrongQueries,
          ...strongGeoQueries,
          ...legacyQueries,
        ];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const q of merged) {
    const k = normalizeSearchToken(q);
    if (!k || seen.has(k)) continue;
    if (refinedTargetType === "villa_like" && bookingVillaForbiddenQuery.test(k)) continue;
    seen.add(k);
    ordered.push(k);
  }
  const strongTypeQueriesAll = [...strongTypeQueries, ...houseStrongQueries, ...riadStrongQueries];

  const sliceCap =
    refinedTargetType === "villa_like" &&
    countryQueryToken === "morocco" &&
    (effectiveGeoCity || geoCity)
      ? 12
      : 6;

  return {
    queries: ordered.slice(0, sliceCap),
    strongTypeQueries: strongTypeQueriesAll,
    targetType,
    refinedTargetType,
    blockedReason: null,
    targetCityBeforeSanitize: effectiveGeoCityRaw || geoCityRaw || null,
    targetCityAfterSanitize: effectiveGeoCity || geoCity || null,
  };
}

function extractBookingSearchQueries(target: ExtractedListing): string[] {
  return buildBookingSearchQueryPlan(target).queries;
}

/** Merge A/B/C + filtre geo Sidi Bouzid villa + type gate — même logique que buildBookingCompetitorCandidatesResult. */
function computeBookingDiscoveryPostGateLists(
  target: ExtractedListing,
  skipAb: boolean,
  sourceAEmbeddedCandidates: string[],
  sourceBNetworkCandidates: string[],
  sourceCSearchCandidates: string[]
): {
  targetTypeRaw: string;
  refinedTargetTypeForGate: string;
  mergedForDiscovery: string[];
  beforeTypeGateCount: number;
  strictAfterCount: number;
  dedupedAfterTypeGate: string[];
  relaxedApplied: boolean;
  validListingCandidates: string[];
} {
  const dedupedCandidates = [
    ...new Set(
      skipAb
        ? [...sourceCSearchCandidates, ...sourceAEmbeddedCandidates, ...sourceBNetworkCandidates]
        : [...sourceAEmbeddedCandidates, ...sourceBNetworkCandidates, ...sourceCSearchCandidates]
    ),
  ];

  const targetTypeRaw = getNormalizedComparableType(target);

  // Prevent legacy Booking refinement from mutating apartment/studio targets
  // into villa_like during post-discovery gating.
  const refinedTargetTypeForGate =
    targetTypeRaw === "studio_like" || targetTypeRaw === "apartment_like"
      ? targetTypeRaw
      : refineBookingTargetType(target, targetTypeRaw);

  const sidiBouzidGeoNeedle = inferSidiBouzidNeedleFromTarget(target);
  let mergedForDiscovery = dedupedCandidates;
  if (sidiBouzidGeoNeedle && refinedTargetTypeForGate === "villa_like") {
    const needleNorm = normalizeForBookingDiscoveryHaystack(sidiBouzidGeoNeedle);
    mergedForDiscovery = dedupedCandidates.filter((url) => {
      if (!isLikelyBookingHotelUrl(url)) return true;
      if (isTargetVariant(url, target)) return true;
      return urlContainsRequestedCitySignals(url, needleNorm);
    });
  }

  const beforeTypeGateCount = mergedForDiscovery.length;
  const strictPool = mergedForDiscovery.filter((url) =>
    passesBookingDiscoveryTypeGate(target, url, refinedTargetTypeForGate)
  );
  const strictAfterCount = strictPool.length;

  let dedupedAfterTypeGate: string[];
  let relaxedApplied = false;
  if (refinedTargetTypeForGate === "villa_like" && strictAfterCount < 3) {
    dedupedAfterTypeGate = mergedForDiscovery.filter((url) =>
      passesBookingDiscoveryVillaControlledRelaxedGate(target, url)
    );
    relaxedApplied = true;
  } else {
    dedupedAfterTypeGate = strictPool;
  }

  const validListingCandidates = dedupedAfterTypeGate.filter(
    (url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target)
  );

  return {
    targetTypeRaw,
    refinedTargetTypeForGate,
    mergedForDiscovery,
    beforeTypeGateCount,
    strictAfterCount,
    dedupedAfterTypeGate,
    relaxedApplied,
    validListingCandidates,
  };
}

function buildBookingCompetitorCandidatesResult(input: {
  target: ExtractedListing;
  maxResults: number;
  skipAb: boolean;
  guardCountry: string | null;
  sourceAEmbeddedCandidates: string[];
  sourceBNetworkCandidates: string[];
  sourceCSearchCandidates: string[];
  sourceCSearchCandidatesRaw: string[];
  sourceCAttempt: {
    urls: string[];
    sourceQueries: Array<{ query: string; url: string; candidates: number }>;
  };
  discoveryQueryContext?: {
    searchQueries: string[];
    comparableTargetType: string;
    refinedTargetType: string;
  } | null;
}): CompetitorCandidate[] {
  const {
    target,
    maxResults,
    skipAb,
    guardCountry,
    sourceAEmbeddedCandidates,
    sourceBNetworkCandidates,
    sourceCSearchCandidates,
    sourceCSearchCandidatesRaw,
    sourceCAttempt,
    discoveryQueryContext,
  } = input;

  if (DEBUG_MARKET_PIPELINE && discoveryQueryContext) {
    const stay = peekBookingTargetStaySearchParams(target.url);
    const geo = peekBookingDiscoveryTargetGeoParts(target);
    const trimSerp = (u: string) => (u.length > 260 ? `${u.slice(0, 257)}...` : u);
    console.log(
      "[market][debug][booking-discovery-query]",
      JSON.stringify({
        targetUrl: target.url ?? null,
        targetTitle: target.title ?? null,
        targetPlatform: target.platform ?? null,
        targetType: discoveryQueryContext.refinedTargetType,
        comparableTargetType: discoveryQueryContext.comparableTargetType,
        targetCity: geo.targetCity,
        targetCountry: geo.targetCountry,
        checkin: stay.checkin,
        checkout: stay.checkout,
        searchQueries: discoveryQueryContext.searchQueries,
        generatedSearchUrls: sourceCAttempt.sourceQueries.map((row) => ({
          query: row.query,
          serp_url: trimSerp(row.url),
          candidates_found: row.candidates,
        })),
        selected_currency: stay.selected_currency,
        group_adults: stay.group_adults,
        no_rooms: stay.no_rooms,
      })
    );
  }

  const {
    targetTypeRaw,
    refinedTargetTypeForGate,
    mergedForDiscovery,
    beforeTypeGateCount,
    strictAfterCount,
    dedupedAfterTypeGate,
    relaxedApplied,
    validListingCandidates,
  } = computeBookingDiscoveryPostGateLists(
    target,
    skipAb,
    sourceAEmbeddedCandidates,
    sourceBNetworkCandidates,
    sourceCSearchCandidates
  );

  if (skipAb) {
    console.log("[market][booking-discovery]", {
      mode: "strict_comparable_geo",
      normalizedTargetCountry: guardCountry,
      skipEmbeddedAndNetwork: true,
      sourceC_beforeCountryGuard: sourceCSearchCandidatesRaw.length,
      sourceC_afterCountryGuard: sourceCSearchCandidates.length,
      mergedCandidateCount: mergedForDiscovery.length,
    });
  }

  const relaxedAfterCount = dedupedAfterTypeGate.length;
  const rejectedCount = beforeTypeGateCount - relaxedAfterCount;

  if (process.env.DEBUG_MARKET_PIPELINE === "true") {
    const rejectedUrls = mergedForDiscovery.filter((url) => !dedupedAfterTypeGate.includes(url));
    console.log(
      "[market][booking-type-gate]",
      JSON.stringify({
        targetType: targetTypeRaw,
        refinedTargetType: refinedTargetTypeForGate,
        beforeCount: beforeTypeGateCount,
        strictAfterCount,
        relaxedApplied,
        relaxedAfterCount,
        afterCount: relaxedAfterCount,
        rejectedCount,
        sampleRejected: rejectedUrls.slice(0, 5).map((u) => (u.length > 160 ? `${u.slice(0, 157)}...` : u)),
      })
    );
    console.log(
      "[market][booking-type-gate-kept]",
      JSON.stringify({
        entries: dedupedAfterTypeGate.slice(0, 10).map((url) => ({
          url: url.length > 220 ? `${url.slice(0, 217)}...` : url,
          inferredType: inferBookingCandidateTypeFromUrl(url),
          refinedTargetType: refinedTargetTypeForGate,
        })),
      })
    );
  }

  if (process.env.DEBUG_MARKET_PIPELINE === "true" && refinedTargetTypeForGate === "villa_like") {
    const geo = peekBookingDiscoveryTargetGeoParts(target);
    const trimUrl = (url: string) => (url.length > 220 ? `${url.slice(0, 217)}...` : url);
    console.log(
      "[market][booking-villa-discovery-debug]",
      JSON.stringify({
        city: geo.targetCity,
        country: geo.targetCountry,
        refinedTargetType: refinedTargetTypeForGate,
        queries: discoveryQueryContext?.searchQueries ?? [],
        generatedSearchUrls: sourceCAttempt.sourceQueries.map((row) => ({
          query: row.query,
          serp_url: trimUrl(row.url),
          candidates_found: row.candidates,
        })),
        beforeTypeGateCount,
        strictAfterCount,
        relaxedAfterCount,
        validListingCandidates: validListingCandidates.slice(0, 10).map(trimUrl),
        finalCandidateCount: validListingCandidates.length,
      })
    );
  }

  const rejectedCandidates = dedupedAfterTypeGate
    .filter((url) => !isLikelyBookingHotelUrl(url) || isTargetVariant(url, target))
    .map((url) => ({
      url,
      reason: !isLikelyBookingHotelUrl(url) ? "not_a_listing_url" : "target_variant",
    }));

  const rankedBeforeRiadBoost = [...validListingCandidates];
  const rankedValidListingCandidates = [...validListingCandidates].sort(
    (a, b) => rankBookingComparableUrl(target, b) - rankBookingComparableUrl(target, a)
  );

  const refinedTargetTypeForRanking = refineBookingTargetType(
    target,
    getNormalizedComparableType(target)
  );
  const rankingTargetGeo = peekBookingDiscoveryTargetGeoParts(target);
  const rankingTargetCountry = canonicalCountryForDiscoveryCompare(rankingTargetGeo.targetCountry);
  if (
    DEBUG_MARKET_PIPELINE &&
    refinedTargetTypeForRanking === "riad_like" &&
    rankingTargetCountry === "morocco"
  ) {
    const trimUrl = (u: string) => (u.length > 180 ? `${u.slice(0, 177)}...` : u);
    const beforeTop = rankedBeforeRiadBoost.slice(0, 8).map(trimUrl);
    const afterTop = rankedValidListingCandidates.slice(0, 8).map(trimUrl);
    const adjustments = rankedValidListingCandidates.map((url) =>
      getBookingMoroccoRiadRankingAdjustment(url)
    );
    const boosted = adjustments.filter((entry) => entry.boostedReasons.length > 0).length;
    const penalized = adjustments.filter((entry) => entry.penalizedReasons.length > 0).length;
    console.log(
      "[market][booking-riad-ranking-prioritized]",
      JSON.stringify({
        boosted,
        penalized,
        beforeTop,
        afterTop,
      })
    );
  }

  if (DEBUG_BOOKING_PIPELINE) {
    console.log("[booking][competitors][discovery]", {
      dedupedUrls: dedupedAfterTypeGate.length,
      rejectedCount: rejectedCandidates.length,
      validListingUrls: validListingCandidates.length,
      cappedReturn: Math.min(rankedValidListingCandidates.length, maxResults),
      rejectedSample: rejectedCandidates.slice(0, 8),
    });
  }

  if (DEBUG_MARKET_PIPELINE) {
    const resolveBookingDiscoverySource = (url: string): string => {
      if (sourceAEmbeddedCandidates.includes(url)) return "embedded_listing_page";
      if (sourceBNetworkCandidates.includes(url)) return "network_graphql_payload";
      if (sourceCSearchCandidatesRaw.includes(url)) {
        return sourceCSearchCandidates.includes(url)
          ? "interactive_search_dom_post_country_guard"
          : "interactive_search_dom_pre_country_guard";
      }
      return "unknown_merged_pool";
    };
    const trimUrl = (u: string) => (u.length > 240 ? `${u.slice(0, 237)}...` : u);
    const urlsBeforeTypeGate = mergedForDiscovery.map((url, index) => ({
      index,
      url: trimUrl(url),
      title: null as string | null,
      source: resolveBookingDiscoverySource(url),
    }));
    const urlsAfterTypeGate = dedupedAfterTypeGate.map((url, index) => ({
      index,
      url: trimUrl(url),
      title: null as string | null,
      source: resolveBookingDiscoverySource(url),
    }));
    const urlsFinalRanked = rankedValidListingCandidates.map((url, index) => ({
      index,
      url: trimUrl(url),
      title: null as string | null,
      source: resolveBookingDiscoverySource(url),
    }));
    console.log(
      "[market][booking-discovery-debug]",
      JSON.stringify({
        phase: "merged_and_gated_pools",
        totals: {
          uniqueUrlsMergedBeforeTypeGate: mergedForDiscovery.length,
          afterTypeGate: dedupedAfterTypeGate.length,
          validListingUrls: validListingCandidates.length,
          rankedBeforeCap: rankedValidListingCandidates.length,
          returnedToPipelineCap: Math.min(rankedValidListingCandidates.length, maxResults),
        },
        embeddedCount: sourceAEmbeddedCandidates.length,
        networkPayloadCount: sourceBNetworkCandidates.length,
        interactiveSearchRawCount: sourceCSearchCandidatesRaw.length,
        interactiveSearchAfterGuardCount: sourceCSearchCandidates.length,
        urlsBeforeTypeGate,
        urlsAfterTypeGate,
        urlsFinalRankedForReturn: urlsFinalRanked,
      })
    );
  }

  debugBookingComparableLog("[guest-audit][comparables][booking-source-debug]", {
    targetUrl: target.url ?? null,
    targetTitle: target.title ?? null,
    targetLocation: target.locationLabel ?? null,
    sourceAttemptOrder: ["embedded_listing_page", "network_payloads", "interactive_home_search"],
    sourceA_embeddedCandidates: sourceAEmbeddedCandidates,
    sourceB_networkCandidates: sourceBNetworkCandidates,
    sourceC_searchCandidates: {
      queries: sourceCAttempt.sourceQueries,
      urls: sourceCSearchCandidates,
    },
    dedupedCandidates: dedupedAfterTypeGate,
    validListingCandidates: rankedValidListingCandidates,
    rejectedCandidates,
    finalCandidateCount: rankedValidListingCandidates.slice(0, maxResults).length,
  });

  const unique = rankedValidListingCandidates.slice(0, maxResults);

  return unique.map((url) => ({
    url: url as string,
    platform: "booking",
    title: null,
    price: null,
    latitude: null,
    longitude: null,
  }));
}

async function collectEmbeddedBookingCandidates(
  page: import("playwright").Page,
  target: ExtractedListing
) {
  const html = await page.content();
  const candidateUrls = new Set<string>();

  for (const url of collectBookingHotelUrlsFromText(html)) {
    if (!isLikelyBookingHotelUrl(url) || isTargetVariant(url, target)) continue;
    candidateUrls.add(url);
  }

  const scriptJsonTexts = await page.$$eval(
    'script[type="application/json"]',
    (elements) => elements.map((el) => el.textContent || "")
  );

  for (const text of scriptJsonTexts) {
    for (const url of collectBookingHotelUrlsFromText(text)) {
      if (!isLikelyBookingHotelUrl(url) || isTargetVariant(url, target)) continue;
      candidateUrls.add(url);
    }
  }

  if (DEBUG_MARKET_PIPELINE) {
    console.log(
      "[market][booking-discovery-debug]",
      JSON.stringify({
        phase: "embedded_listing_page_dom",
        totalUrlsExtractedFromPageHtmlAndJson: candidateUrls.size,
      })
    );
  }

  return [...candidateUrls];
}

async function collectInteractiveSearchCandidates(input: {
  page: import("playwright").Page;
  target: ExtractedListing;
  queries: string[];
  maxResults: number;
  abortSignal?: AbortSignal | null;
}) {
  const collectedUrls: string[] = [];
  const sourceQueries: Array<{ query: string; url: string; candidates: number }> = [];
  const inputSelector =
    'input[name="ss"], input[placeholder*="destination" i], input[aria-label*="destination" i]';

  console.log(
    "[market][booking-interactive-search-start]",
    JSON.stringify({
      queryCount: input.queries.length,
      queries: input.queries,
      abortActiveBeforeLoop: isBookingDiscoveryAborted(input.abortSignal),
    })
  );

  for (const query of input.queries) {
    if (isBookingDiscoveryAborted(input.abortSignal)) {
      console.log(
        "[market][booking-interactive-search-aborted]",
        JSON.stringify({ query, reason: "abort_signal_active_before_query" })
      );
      break;
    }

    let step = "start";
    try {
      step = "goto_home";
      await input.page.goto("https://www.booking.com/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      step = "wait_after_goto";
      const homepageUrl = input.page.url();
      const homepageTitle = await input.page.title().catch(() => "");
      const homepageIsChallenge =
        /just a moment|checking your browser|cloudflare|enable javascript|ddos/i.test(
          homepageTitle
        );
      console.log(
        "[market][booking-homepage-loaded]",
        JSON.stringify({
          query,
          url: homepageUrl,
          title: homepageTitle.slice(0, 120),
          isChallenge: homepageIsChallenge,
        })
      );

      await input.page.waitForTimeout(1200);
      step = "locate_search_input";
      const searchInput = input.page.locator(inputSelector).first();
      if ((await searchInput.count()) === 0) {
        console.log(
          "[market][booking-search-input-not-found]",
          JSON.stringify({ query, pageUrl: input.page.url(), pageTitle: homepageTitle.slice(0, 120) })
        );
        continue;
      }

      step = "interact_search";
      await searchInput.click().catch(() => null);
      await searchInput.fill(query).catch(() => null);
      await input.page.waitForTimeout(700);
      await input.page.keyboard.press("Enter").catch(() => null);
      await input.page.waitForTimeout(3200);
      await input.page.waitForLoadState("load").catch(() => null);
      await input.page.waitForTimeout(800);

      step = "collect_hotel_links";
      const serpUrl = input.page.url();
      const serpTitle = await input.page.title().catch(() => "");
      const serpIsChallenge =
        /just a moment|checking your browser|cloudflare|enable javascript|ddos/i.test(serpTitle);
      console.log(
        "[market][booking-serp-loaded]",
        JSON.stringify({
          query,
          serpUrl: serpUrl.slice(0, 220),
          serpTitle: serpTitle.slice(0, 120),
          isChallenge: serpIsChallenge,
        })
      );

      const requestedCityForFallback = getEffectiveRequestedCityForSerpGuard(input.target, query);
      const homepageSubmitFailed =
        !serpIsChallenge &&
        /^https:\/\/www\.booking\.com\/?(?:[?#].*)?$/i.test(serpUrl);

      if (homepageSubmitFailed) {
        const fallbackCityUrl = buildBookingCityFallbackUrl(input.target, requestedCityForFallback);
        if (fallbackCityUrl) {
          console.log(
            "[market][booking-city-fallback]",
            JSON.stringify({
              query,
              reason: "homepage_after_interactive_submit",
              requestedCity: requestedCityForFallback,
              fallbackCityUrl,
            })
          );
          await input.page.goto(fallbackCityUrl, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          await input.page.waitForTimeout(1500);
        }
      }

      const pageUrls = await input.page.$$eval(
        'a[href*="/hotel/"]',
        (elements) =>
          elements
            .map((el) => el.getAttribute("href"))
            .filter(Boolean)
            .map((href) => {
              if (!href) return null;
              if (href.startsWith("http")) return href.split("?")[0];
              return `https://www.booking.com${href.split("?")[0]}`;
            })
      );

      step = "merge_results";
      const newForQuery: string[] = [];
      let queryCount = 0;
      for (const rawUrl of pageUrls) {
        const url = normalizeBookingHotelUrl(rawUrl);
        if (!url) continue;
        if (!isLikelyBookingHotelUrl(url)) continue;
        if (isTargetVariant(url, input.target)) continue;
        if (!collectedUrls.includes(url)) {
          newForQuery.push(url);
          collectedUrls.push(url);
          queryCount += 1;
        }
      }

      const resolvedSearchUrl = input.page.url();
      const requestedCityFromTarget = getBookingDiscoveryRequestedCityLabel(input.target);
      const requestedCity = getEffectiveRequestedCityForSerpGuard(input.target, query);
      const resolvedCityGuess = parseBookingSerpResolvedCityGuess(resolvedSearchUrl);
      const normReq = requestedCity ? normalizeForBookingDiscoveryHaystack(requestedCity) : "";
      const normRes = resolvedCityGuess ? normalizeForBookingDiscoveryHaystack(resolvedCityGuess) : "";
      const serpCityDiffersFromTarget = Boolean(
        normReq.length >= 4 &&
          normRes.length >= 4 &&
          normReq !== normRes &&
          !normReq.includes(normRes) &&
          !normRes.includes(normReq)
      );
      const hotelUrlsThisSerp = pageUrls
        .map((h) => normalizeBookingHotelUrl(h))
        .filter((u): u is string => u != null && isLikelyBookingHotelUrl(u));
      const anchorCount = Array.isArray(pageUrls) ? pageUrls.filter(Boolean).length : 0;
      const { count: urlsContainingRequestedCityCount, sample: sampleUrlsContainingRequestedCity } =
        countBookingUrlsMatchingRequestedCity(pageUrls, requestedCity);
      const resultsMatchTargetCity = bookingUrlsSignalRequestedCity(
        [...hotelUrlsThisSerp, ...newForQuery],
        requestedCity
      );
      const resolvedUrlIsElJadidaCityPage = /\/city\/ma\/el-jadida\b/i.test(resolvedSearchUrl);
      const explicitSidiBouzidVsElJadida =
        normReq.includes("sidi") &&
        normReq.includes("bouzid") &&
        resolvedUrlIsElJadidaCityPage &&
        urlsContainingRequestedCityCount === 0;
      const rejectRedirectedSerp =
        (serpCityDiffersFromTarget && !resultsMatchTargetCity) || explicitSidiBouzidVsElJadida;
      const redirectAction = rejectRedirectedSerp
        ? "reject_redirected_serp"
        : resultsMatchTargetCity && serpCityDiffersFromTarget
          ? "keep_if_results_match_target_city"
          : "keep_serp";

      console.log(
        "[market][booking-discovery-city-redirect-debug]",
        JSON.stringify({
          query,
          requestedCity,
          requestedCityFromTarget,
          normalizedRequestedCity: normReq || null,
          searchResultsPageUrl: resolvedSearchUrl,
          resolvedCityGuess,
          normalizedResolvedCityGuess: normRes || null,
          totalHotelAnchorsRawInDom: anchorCount,
          urlsContainingRequestedCityCount,
          sampleUrlsContainingRequestedCity,
          action: redirectAction,
        })
      );

      if (rejectRedirectedSerp) {
        for (const u of newForQuery) {
          const idx = collectedUrls.lastIndexOf(u);
          if (idx !== -1) collectedUrls.splice(idx, 1);
        }
        queryCount = 0;
      }

      if (DEBUG_MARKET_PIPELINE && (serpCityDiffersFromTarget || explicitSidiBouzidVsElJadida)) {
        console.log(
          "[market][booking-discovery-city-redirect]",
          JSON.stringify({
            requestedCity,
            requestedCityFromTarget,
            resolvedSearchUrl,
            resolvedCityGuess,
            resultsMatchTargetCity,
            explicitSidiBouzidVsElJadida,
            action: redirectAction,
          })
        );
      }

      sourceQueries.push({
        query,
        url: resolvedSearchUrl,
        candidates: queryCount,
      });

      if (DEBUG_MARKET_PIPELINE) {
        console.log(
          "[market][booking-discovery-debug]",
          JSON.stringify({
            phase: "interactive_search_serp_dom",
            query,
            searchResultsPageUrl: resolvedSearchUrl,
            requestedCity,
            totalHotelAnchorsRawInDom: Array.isArray(pageUrls) ? pageUrls.filter(Boolean).length : 0,
            uniqueNewUrlsThisQuery: queryCount,
            collectedUrlsRunningTotal: collectedUrls.length,
          })
        );
      }

      if (collectedUrls.length >= input.maxResults) {
        break;
      }
    } catch (error) {
      console.warn("[booking][interactive-search-query-failed]", {
        query,
        step,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  return {
    urls: collectedUrls,
    sourceQueries,
  };
}

function hasEnoughRankedFromEmbeddedNetwork(
  target: ExtractedListing,
  sourceA: string[],
  sourceB: string[],
  guardCountry: string | null,
  needCount: number
): boolean {
  const pool = [...new Set([...sourceA, ...sourceB])];
  const valid = pool.filter(
    (url) =>
      isLikelyBookingHotelUrl(url) &&
      !isTargetVariant(url, target) &&
      (!guardCountry || isBookingDiscoveryUrlAllowedForTargetCountry(url, guardCountry))
  );
  const ranked = [...valid].sort(
    (a, b) => rankBookingComparableUrl(target, b) - rankBookingComparableUrl(target, a)
  );
  return ranked.length >= needCount;
}

export async function searchBookingCompetitorCandidates(
  target: ExtractedListing,
  maxResults = 5,
  discoveryGeo?: { normalizedTargetCountry: string | null; skipEmbeddedAndNetwork: boolean } | null,
  abortSignal?: AbortSignal | null
): Promise<CompetitorCandidate[]> {
  const queryPlan = buildBookingSearchQueryPlan(target);
  const queries = queryPlan.queries;
  const skipAb = Boolean(discoveryGeo?.skipEmbeddedAndNetwork);
  const guardCountry = discoveryGeo?.normalizedTargetCountry ?? null;

  console.log(
    "[market][booking-query]",
    JSON.stringify({
      queryCount: queries.length,
      queries,
      targetType: queryPlan.targetType,
      refinedTargetType: queryPlan.refinedTargetType,
      strongTypeQueries: queryPlan.strongTypeQueries,
      targetUrlPreview: (target.url ?? "").slice(0, 160),
      targetLocationLabel: target.locationLabel ?? null,
      targetTitlePreview: (target.title ?? "").slice(0, 140),
      guardCountry,
      skipEmbeddedAndNetwork: skipAb,
      targetCityBeforeSanitize: queryPlan.targetCityBeforeSanitize ?? null,
      targetCityAfterSanitize: queryPlan.targetCityAfterSanitize ?? null,
      blockedReason: queryPlan.blockedReason ?? null,
    })
  );

  if (queries.length === 0 || isBookingDiscoveryAborted(abortSignal)) {
    return [];
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const interactiveCap = Math.min(Math.max(maxResults * 2, 8), 12);

  const networkResponseBodies: string[] = [];
  let sourceAEmbeddedCandidates: string[] = [];
  let sourceBNetworkCandidates: string[] = [];
  let sourceCSearchCandidates: string[] = [];
  let sourceCSearchCandidatesRaw: string[] = [];
  let sourceCAttempt: {
    urls: string[];
    sourceQueries: Array<{ query: string; url: string; candidates: number }>;
  } = { urls: [], sourceQueries: [] };

  try {
    page.on("response", async (response) => {
      if (isBookingDiscoveryAborted(abortSignal)) {
        return;
      }
      const url = response.url();
      if (!/dml\/graphql|orca|acid_carousel|carousel|recommend|similar|nearby/i.test(url)) {
        return;
      }
      try {
        const text = await response.text();
        networkResponseBodies.push(text);
      } catch {
        // Ignore unreadable response bodies.
      }
    });

    if (isBookingDiscoveryAborted(abortSignal)) {
      return [];
    }

    await page.goto(target.url ?? "", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(2000);
    await page.waitForLoadState("load").catch(() => null);
    await page.waitForTimeout(800);

    if (isBookingDiscoveryAborted(abortSignal)) {
      sourceBNetworkCandidates = skipAb
        ? []
        : [
            ...new Set(
              networkResponseBodies.flatMap((text) => collectBookingHotelUrlsFromText(text))
            ),
          ].filter((url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target));
      return buildBookingCompetitorCandidatesResult({
        target,
        maxResults,
        skipAb,
        guardCountry,
        sourceAEmbeddedCandidates: [],
        sourceBNetworkCandidates,
        sourceCSearchCandidates: [],
        sourceCSearchCandidatesRaw: [],
        sourceCAttempt: { urls: [], sourceQueries: [] },
        discoveryQueryContext: {
          searchQueries: queries,
          comparableTargetType: queryPlan.targetType,
          refinedTargetType: queryPlan.refinedTargetType,
        },
      });
    }

    sourceAEmbeddedCandidates = skipAb
      ? []
      : await collectEmbeddedBookingCandidates(page, target);

    sourceBNetworkCandidates = skipAb
      ? []
      : [
          ...new Set(
            networkResponseBodies.flatMap((text) => collectBookingHotelUrlsFromText(text))
          ),
        ].filter((url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target));

    if (isBookingDiscoveryAborted(abortSignal)) {
      return buildBookingCompetitorCandidatesResult({
        target,
        maxResults,
        skipAb,
        guardCountry,
        sourceAEmbeddedCandidates,
        sourceBNetworkCandidates,
        sourceCSearchCandidates: [],
        sourceCSearchCandidatesRaw: [],
        sourceCAttempt: { urls: [], sourceQueries: [] },
        discoveryQueryContext: {
          searchQueries: queries,
          comparableTargetType: queryPlan.targetType,
          refinedTargetType: queryPlan.refinedTargetType,
        },
      });
    }

    const enoughFromAb =
      !skipAb &&
      hasEnoughRankedFromEmbeddedNetwork(
        target,
        sourceAEmbeddedCandidates,
        sourceBNetworkCandidates,
        guardCountry,
        maxResults
      );

    if (!enoughFromAb && !isBookingDiscoveryAborted(abortSignal)) {
      sourceCAttempt = await collectInteractiveSearchCandidates({
        page,
        target,
        queries,
        maxResults: interactiveCap,
        abortSignal,
      });
      sourceCSearchCandidatesRaw = sourceCAttempt.urls.filter(
        (url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target)
      );
      sourceCSearchCandidates = guardCountry
        ? sourceCSearchCandidatesRaw.filter((u) =>
            isBookingDiscoveryUrlAllowedForTargetCountry(u, guardCountry)
          )
        : sourceCSearchCandidatesRaw;

      if (
        skipAb &&
        guardCountry &&
        sourceCSearchCandidates.length === 0 &&
        !isBookingDiscoveryAborted(abortSignal)
      ) {
        const rawLocationFb = normalizeSearchToken(target.locationLabel ?? "");
        const locationPartsFb = rawLocationFb
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        if (locationPartsFb.length >= 2) {
          const cityFb = locationPartsFb[0];
          const countryFb = locationPartsFb[locationPartsFb.length - 1];
          const ptFb = normalizeSearchToken(target.propertyType ?? "").trim();
          const fallbackQueries: string[] = [];
          if (ptFb) fallbackQueries.push(normalizeSearchToken(`${cityFb} ${countryFb} ${ptFb}`));
          fallbackQueries.push(normalizeSearchToken(`${cityFb} ${countryFb}`));
          const fallbackQueriesDistinct = [...new Set(fallbackQueries)].slice(0, 2);
          if (fallbackQueriesDistinct.length > 0) {
            const sourceCFallbackAttempt = await collectInteractiveSearchCandidates({
              page,
              target,
              queries: fallbackQueriesDistinct,
              maxResults: interactiveCap,
              abortSignal,
            });
            const fallbackRaw = sourceCFallbackAttempt.urls.filter(
              (url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target)
            );
            sourceCSearchCandidatesRaw = [...sourceCSearchCandidatesRaw, ...fallbackRaw];
            sourceCSearchCandidates = guardCountry
              ? fallbackRaw.filter((u) =>
                  isBookingDiscoveryUrlAllowedForTargetCountry(u, guardCountry)
                )
              : fallbackRaw;
            sourceCAttempt = {
              urls: [...sourceCAttempt.urls, ...sourceCFallbackAttempt.urls],
              sourceQueries: [
                ...sourceCAttempt.sourceQueries,
                ...sourceCFallbackAttempt.sourceQueries,
              ],
            };
          }
        }
      }
    }

    const normalDiscoveryCount = (() => {
      const merged = [
        ...new Set([
          ...sourceAEmbeddedCandidates,
          ...sourceBNetworkCandidates,
          ...sourceCSearchCandidates,
        ]),
      ];
      return merged.filter(
        (u) =>
          isLikelyBookingHotelUrl(u) &&
          !isTargetVariant(u, target) &&
          (!guardCountry || isBookingDiscoveryUrlAllowedForTargetCountry(u, guardCountry))
      ).length;
    })();

    const postGateForRenderedDecision = computeBookingDiscoveryPostGateLists(
      target,
      skipAb,
      sourceAEmbeddedCandidates,
      sourceBNetworkCandidates,
      sourceCSearchCandidates
    );
    const usableDiscoveryCount = postGateForRenderedDecision.validListingCandidates.length;

    const targetPlatform = String(target.platform ?? "").toLowerCase();
    const isBookingPlatform = targetPlatform === "booking";
    const hasAbortSignal = abortSignal != null;
    const abortNotActive = !abortSignal?.aborted;
    const shouldTryRenderedFallback =
      isBookingPlatform && usableDiscoveryCount < 3 && abortNotActive;

    let renderedGateReason: string | null = null;
    if (shouldTryRenderedFallback) {
      renderedGateReason = "usable_discovery_insufficient";
    } else if (!isBookingPlatform) {
      renderedGateReason = "target_platform_not_booking";
    } else if (usableDiscoveryCount >= 3) {
      renderedGateReason = "usable_discovery_sufficient";
    } else if (!abortNotActive) {
      renderedGateReason = "abort_signal_active";
    }

    const locPartsForGate = normalizeSearchToken(target.locationLabel ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const targetCountryForGate =
      locPartsForGate.length >= 2 ? locPartsForGate[locPartsForGate.length - 1] ?? null : null;

    console.log(
      "[market][booking-rendered-discovery-gate]",
      JSON.stringify({
        targetPlatform,
        normalDiscoveryCount,
        usableDiscoveryCount,
        shouldTryRenderedFallback,
        hasAbortSignal,
        abortSignalAborted: abortSignal?.aborted ?? false,
        targetCity: getBookingDiscoveryRequestedCityLabel(target),
        targetCountry: targetCountryForGate,
        targetType: queryPlan.targetType,
        refinedTargetType: queryPlan.refinedTargetType,
        reason: renderedGateReason,
      })
    );

    if (shouldTryRenderedFallback) {
      let rendered: string[] = [];
      try {
        rendered = await discoverBookingCandidatesWithRenderedSerp({
          target,
          maxUrls: 20,
          abortSignal,
        });
      } catch (e) {
        console.warn("[booking][rendered-discovery] unexpected", e);
      }
      rendered = rendered.filter(
        (u) => isLikelyBookingHotelUrl(u) && !isTargetVariant(u, target)
      );
      if (rendered.length > 0) {
        sourceCSearchCandidatesRaw = [...new Set([...sourceCSearchCandidatesRaw, ...rendered])];
        sourceCSearchCandidates = guardCountry
          ? sourceCSearchCandidatesRaw.filter((u) =>
              isBookingDiscoveryUrlAllowedForTargetCountry(u, guardCountry)
            )
          : [...sourceCSearchCandidatesRaw];
        sourceCAttempt = {
          urls: [...sourceCAttempt.urls, ...rendered],
          sourceQueries: [
            ...sourceCAttempt.sourceQueries,
            {
              query: "__rendered_serp_persistent__",
              url: "playwright_persistent",
              candidates: rendered.length,
            },
          ],
        };
      }
    }

    return buildBookingCompetitorCandidatesResult({
      target,
      maxResults,
      skipAb,
      guardCountry,
      sourceAEmbeddedCandidates,
      sourceBNetworkCandidates,
      sourceCSearchCandidates,
      sourceCSearchCandidatesRaw,
      sourceCAttempt,
      discoveryQueryContext: {
        searchQueries: queries,
        comparableTargetType: queryPlan.targetType,
        refinedTargetType: queryPlan.refinedTargetType,
      },
    });
  } catch (error) {
    console.error("Booking competitor search failed:", error);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── Premium early-stop discovery (refine-market route only) ─────────────────

export type BookingPremiumEarlyStopResult = {
  urls: string[];
  stoppedEarly: boolean;
  queriesRun: number;
};

/**
 * Booking discovery with per-query early-stop gate for the refine-market route.
 *
 * Runs interactive SERP queries one at a time. After each query, checks the
 * post-gate valid listing candidate count. Stops as soon as earlyStopMin URLs
 * pass the type gate — no need to exhaust all queries.
 *
 * Does NOT modify searchBookingCompetitorCandidates or the audit pipeline.
 * Called exclusively from runPremiumBookingDiscovery in refine-market/route.ts.
 */
export async function searchBookingPremiumUrlsEarlyStop(
  target: ExtractedListing,
  opts: {
    cap?: number;
    earlyStopMin?: number;
    abortSignal?: AbortSignal | null;
  } = {}
): Promise<BookingPremiumEarlyStopResult> {
  const cap = opts.cap ?? 8;
  const earlyStopMin = opts.earlyStopMin ?? 6;
  const abortSignal = opts.abortSignal ?? null;

  const queryPlan = buildBookingSearchQueryPlan(target);
  const queries = queryPlan.queries;

  if (queries.length === 0 || isBookingDiscoveryAborted(abortSignal)) {
    return { urls: [], stoppedEarly: false, queriesRun: 0 };
  }

  const fnStartedAt = Date.now();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const networkResponseBodies: string[] = [];
  let sourceAEmbeddedCandidates: string[] = [];
  let sourceBNetworkCandidates: string[] = [];
  const collectedSearchUrls: string[] = [];

  const inputSelector =
    'input[name="ss"], input[placeholder*="destination" i], input[aria-label*="destination" i]';

  try {
    page.on("response", async (response) => {
      if (isBookingDiscoveryAborted(abortSignal)) return;
      const url = response.url();
      if (!/dml\/graphql|orca|acid_carousel|carousel|recommend|similar|nearby/i.test(url)) return;
      try {
        const text = await response.text();
        networkResponseBodies.push(text);
      } catch { /* ignore */ }
    });

    if (isBookingDiscoveryAborted(abortSignal)) {
      return { urls: [], stoppedEarly: false, queriesRun: 0 };
    }

    // Phase A+B: load target listing page to seed embedded + network candidates
    await page.goto(target.url ?? "", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.waitForLoadState("load").catch(() => null);
    await page.waitForTimeout(800);

    if (!isBookingDiscoveryAborted(abortSignal)) {
      sourceAEmbeddedCandidates = await collectEmbeddedBookingCandidates(page, target);
      sourceBNetworkCandidates = [
        ...new Set(networkResponseBodies.flatMap((text) => collectBookingHotelUrlsFromText(text))),
      ].filter((url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target));
    }

    // Early-stop check on A+B alone (rare but possible for well-embedded listings)
    {
      const postGate = computeBookingDiscoveryPostGateLists(
        target, false, sourceAEmbeddedCandidates, sourceBNetworkCandidates, []
      );
      const valid = postGate.validListingCandidates;
      if (valid.length >= earlyStopMin) {
        const ranked = [...valid].sort(
          (a, b) => rankBookingComparableUrl(target, b) - rankBookingComparableUrl(target, a)
        );
        const result = ranked.slice(0, cap);
        console.log(
          "[refine-market][premium-discovery-early-stop]",
          JSON.stringify({
            queryIndex: -1,
            phase: "ab_sources_only",
            collectedRawCount: sourceAEmbeddedCandidates.length + sourceBNetworkCandidates.length,
            validListingCandidatesCount: valid.length,
            returnedCount: result.length,
            elapsedMs: Date.now() - fnStartedAt,
            stoppedEarly: true,
          })
        );
        return { urls: result, stoppedEarly: true, queriesRun: 0 };
      }
    }

    // Phase C: interactive SERP queries with per-query post-gate early-stop check
    for (let qi = 0; qi < queries.length; qi++) {
      const query = queries[qi]!;
      if (isBookingDiscoveryAborted(abortSignal)) break;

      try {
        await page.goto("https://www.booking.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(1200);

        const searchInput = page.locator(inputSelector).first();
        if ((await searchInput.count()) === 0) {
          console.warn("[refine-market][premium-early-stop][input-not-found]", { query, queryIndex: qi });
          continue;
        }

        await searchInput.click().catch(() => null);
        await searchInput.fill(query).catch(() => null);
        await page.waitForTimeout(700);
        await page.keyboard.press("Enter").catch(() => null);
        await page.waitForTimeout(3200);
        await page.waitForLoadState("load").catch(() => null);
        await page.waitForTimeout(800);

        const pageUrls = await page.$$eval(
          'a[href*="/hotel/"]',
          (elements) =>
            elements
              .map((el) => el.getAttribute("href"))
              .filter(Boolean)
              .map((href) => {
                if (!href) return null;
                if (href.startsWith("http")) return href.split("?")[0];
                return `https://www.booking.com${href.split("?")[0]}`;
              })
        );

        for (const rawUrl of pageUrls) {
          const url = normalizeBookingHotelUrl(rawUrl);
          if (!url || !isLikelyBookingHotelUrl(url) || isTargetVariant(url, target)) continue;
          if (!collectedSearchUrls.includes(url)) collectedSearchUrls.push(url);
        }
      } catch (err) {
        console.warn("[refine-market][premium-early-stop][query-failed]", {
          query,
          queryIndex: qi,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      // Post-gate check: type gate + dedup across all sources
      const postGate = computeBookingDiscoveryPostGateLists(
        target, false, sourceAEmbeddedCandidates, sourceBNetworkCandidates, collectedSearchUrls
      );
      const valid = postGate.validListingCandidates;
      const shouldStop = valid.length >= earlyStopMin;

      const ranked = [...valid].sort(
        (a, b) => rankBookingComparableUrl(target, b) - rankBookingComparableUrl(target, a)
      );
      const result = shouldStop ? ranked.slice(0, cap) : [];

      console.log(
        "[refine-market][premium-discovery-early-stop]",
        JSON.stringify({
          queryIndex: qi,
          query,
          collectedRawCount: collectedSearchUrls.length,
          validListingCandidatesCount: valid.length,
          returnedCount: result.length,
          elapsedMs: Date.now() - fnStartedAt,
          stoppedEarly: shouldStop,
          aborted: isBookingDiscoveryAborted(abortSignal),
        })
      );

      if (shouldStop) {
        return { urls: result, stoppedEarly: true, queriesRun: qi + 1 };
      }
    }

    // Full run completed without reaching earlyStopMin
    const finalPostGate = computeBookingDiscoveryPostGateLists(
      target, false, sourceAEmbeddedCandidates, sourceBNetworkCandidates, collectedSearchUrls
    );
    const finalValid = finalPostGate.validListingCandidates;
    const finalRanked = [...finalValid].sort(
      (a, b) => rankBookingComparableUrl(target, b) - rankBookingComparableUrl(target, a)
    );
    const finalResult = finalRanked.slice(0, cap);

    console.log(
      "[refine-market][premium-discovery-early-stop]",
      JSON.stringify({
        queryIndex: queries.length - 1,
        phase: "full_run_completed",
        collectedRawCount: collectedSearchUrls.length,
        validListingCandidatesCount: finalValid.length,
        returnedCount: finalResult.length,
        elapsedMs: Date.now() - fnStartedAt,
        stoppedEarly: false,
        aborted: isBookingDiscoveryAborted(abortSignal),
      })
    );

    return { urls: finalResult, stoppedEarly: false, queriesRun: queries.length };

  } catch (err) {
    console.error("[refine-market][premium-early-stop][fatal]", {
      message: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - fnStartedAt,
    });
    return { urls: [], stoppedEarly: false, queriesRun: 0 };
  } finally {
    await browser.close().catch(() => {});
  }
}

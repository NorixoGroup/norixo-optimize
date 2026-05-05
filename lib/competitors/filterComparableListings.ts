import type { ExtractedListing } from "@/lib/extractors/types";
import { normalizeWhitespace } from "@/lib/extractors/shared";
import { classifyComparableSegment } from "@/lib/marketClassification/classifyComparableSegment";

export type ComparableCandidateDecision = {
  candidate: ExtractedListing;
  accepted: boolean;
  reasons: string[];
  comparableScore: number;
  distanceKm: number | null;
  targetNormalizedType: string;
  candidateNormalizedType: string;
  targetCity: string | null;
  candidateCity: string | null;
  targetNeighborhood: string | null;
  candidateNeighborhood: string | null;
  targetLanguageGuess: string;
  candidateLanguageGuess: string;
};

const NON_CITY_TOKENS = new Set([
  "proximit",
  "proximite",
  "nearby",
  "near",
  "location",
  "emplacement",
  "voir",
  "airport",
  "aeroport",
  "aéroport",
  "transport",
  "transports",
  "center",
  "centre",
  "downtown",
  "city",
  "ville",
]);

const DEBUG_MARKET_PIPELINE = process.env.DEBUG_MARKET_PIPELINE === "true";

const BOOKING_MOROCCO_VILLA_MIN_NIGHT_PRICE = 40;
const BOOKING_MOROCCO_VILLA_SUSPICIOUS_LOW_PRICE_CEILING = 60;

export type EvaluateComparableCandidatesOptions = {
  /** Pays marché normalisé (ex. depuis discovery / guard) pour garde‑fous ciblés. */
  normalizedTargetCountry?: string | null;
};

/** Accent / casse / séparateurs : pour sous-chaîne ville dans titres, URL, etc. */
function normalizeCityForBookingGeoMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericSaintStylePrefix(word: string): boolean {
  const w = word.toLowerCase().replace(/\.$/, "");
  return w === "saint" || w === "sainte" || w === "st" || w === "san" || w === "santa";
}

function canonicalizeSaintPrefixForGeoNeedle(raw: string): string {
  const t = raw.toLowerCase().replace(/\.$/, "");
  if (t === "st") return "saint";
  return t;
}

/** Ville multi-mots : jamais accepter seul « saint » ; villes composées = phrase entière. */
function bookingCityNeedleIsSpecificEnough(normalizedNeedle: string): boolean {
  if (!normalizedNeedle) return false;
  const parts = normalizedNeedle.split(" ").filter(Boolean);
  const first = parts[0] ?? "";

  if (isGenericSaintStylePrefix(first)) {
    return parts.length >= 2;
  }
  if (parts.length >= 2) return true;
  return normalizedNeedle.length >= 4;
}

type BookingCitySignalMatch = {
  match: boolean;
  matchedBy?: "title" | "url" | "locationLabel" | "description";
  matchedNeedle?: string;
};

/**
 * Booking : la ville extraite (guessListingCity) est souvent un faux positif sur le titre.
 * `targetCityNeedle` doit être la ville cible complète normalisée (ex. "saint gaudens"), jamais un seul token générique.
 */
function bookingCandidateMatchesTargetCityFromSignals(
  candidate: ExtractedListing,
  targetCityNeedle: string
): BookingCitySignalMatch {
  const needle = normalizeCityForBookingGeoMatch(targetCityNeedle);
  if (!needle || !bookingCityNeedleIsSpecificEnough(needle)) {
    return { match: false };
  }

  const checks: Array<{
    field: NonNullable<BookingCitySignalMatch["matchedBy"]>;
    text: string | null | undefined;
  }> = [
    { field: "title", text: candidate.title },
    { field: "url", text: candidate.url },
    { field: "locationLabel", text: candidate.locationLabel },
    { field: "description", text: candidate.description },
  ];

  for (const { field, text } of checks) {
    if (typeof text !== "string" || !text.trim()) continue;
    const hay = normalizeCityForBookingGeoMatch(text);
    if (hay.includes(needle)) {
      return { match: true, matchedBy: field, matchedNeedle: needle };
    }
  }

  return { match: false };
}

function normalizeTextParts(...values: Array<string | null | undefined>): string {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function tokenizeComparableText(text: string): string[] {
  return text
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

export function getNormalizedComparableType(listing: ExtractedListing): string {
  const isAirbnb = String(listing.platform ?? "").toLowerCase() === "airbnb";
  const airbnbClassText =
    typeof listing.airbnbComparableClassificationText === "string"
      ? listing.airbnbComparableClassificationText.trim()
      : "";
  const classificationTitle =
    isAirbnb && airbnbClassText.length > 0 ? airbnbClassText : listing.title;

  const primaryText = normalizeTextParts(listing.propertyType, classificationTitle, listing.url);
  const secondaryText = normalizeTextParts(listing.description);
  const primaryTokens = new Set(tokenizeComparableText(primaryText));
  const secondaryTokens = new Set(tokenizeComparableText(secondaryText));

  const hasAny = (tokens: Set<string>, values: string[]) => values.some((value) => tokens.has(value));
  const primaryHasApartment =
    hasAny(primaryTokens, [
      "apartment",
      "apartments",
      "apartmenthotel",
      "aparthotel",
      "flat",
      "appartement",
      "appartements",
      "residence",
      "residences",
      "apart",
      "condo",
      "suite",
    ]) || primaryText.includes("entire place");
  const primaryHasStudio = primaryTokens.has("studio");
  const primaryHasVilla = primaryTokens.has("villa");
  const primaryHasHouse = hasAny(primaryTokens, [
    "house",
    "home",
    "maison",
    "riad",
    "dar",
    "townhouse",
    "chalet",
  ]);
  const primaryHasHotel =
    hasAny(primaryTokens, ["hotel", "hotels", "resort", "hostel", "guesthouse", "inn"]) ||
    primaryText.includes("boutique hotel") ||
    primaryText.includes("guest house");

  if (isAirbnb && primaryHasStudio) {
    const canonicalFirst = normalizeWhitespace(classificationTitle).split(/\s*·\s*/)[0] ?? "";
    const entireApartmentFr = /logement entier\s*:?\s*appartement/i.test(secondaryText);
    const entireApartmentEn = /entire place\s*:?\s*apartment/i.test(secondaryText);
    const apartmentFirstOg =
      /^appartement\b/i.test(canonicalFirst) || /^apartment\b/i.test(canonicalFirst);
    const studioFirstOg = /^studio\b/i.test(canonicalFirst);

    if (
      (primaryHasApartment || entireApartmentFr || entireApartmentEn || apartmentFirstOg) &&
      !studioFirstOg
    ) {
      return "apartment_like";
    }
    if ((entireApartmentFr || entireApartmentEn) && studioFirstOg) {
      return "apartment_like";
    }
  }

  if (primaryHasStudio) return "studio_like";
  if (primaryHasVilla) return "villa_like";
  if (primaryHasApartment) return "apartment_like";
  if (primaryHasHouse) return "house_like";
  if (primaryHasHotel) return "hotel_like";

  if (secondaryTokens.has("studio")) return "studio_like";
  if (secondaryTokens.has("villa")) return "villa_like";
  if (
    hasAny(secondaryTokens, [
      "apartment",
      "apartments",
      "apartmenthotel",
      "aparthotel",
      "flat",
      "appartement",
      "appartements",
      "residence",
      "residences",
      "apart",
      "condo",
      "suite",
    ]) || secondaryText.includes("entire place")
  ) {
    return "apartment_like";
  }
  if (
    hasAny(secondaryTokens, [
      "house",
      "home",
      "maison",
      "riad",
      "dar",
      "townhouse",
      "chalet",
    ])
  ) {
    return "house_like";
  }
  if (
    hasAny(secondaryTokens, ["hotel", "hotels", "resort", "hostel", "guesthouse", "inn"]) ||
    secondaryText.includes("boutique hotel") ||
    secondaryText.includes("guest house")
  ) {
    return "hotel_like";
  }

  return "unknown";
}

export function guessListingLanguage(listing: ExtractedListing): string {
  const titleText = normalizeTextParts(listing.title);
  const fallbackText = normalizeTextParts(listing.locationLabel);
  const text = titleText || fallbackText;
  if (!text) return "unknown";

  const detectScript = (value: string) => {
    if (/[\u0590-\u05ff]/.test(value)) return "hebrew";
    if (/[\u0600-\u06ff]/.test(value)) return "arabic";
    if (/[\u0400-\u04ff]/.test(value)) return "cyrillic";
    if (/^[\x00-\x7F\u00C0-\u024F\s.,·'’"!?()\-/:|]+$/.test(value)) return "latin";
    return "mixed";
  };

  const titleScript = titleText ? detectScript(titleText) : "unknown";
  if (titleScript !== "unknown" && titleScript !== "mixed") return titleScript;
  return detectScript(text);
}

function safeNumber(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasBasicData(listing: ExtractedListing): boolean {
  const hasTitle = typeof listing.title === "string" && listing.title.trim().length > 0;
  const hasPhotos = Array.isArray(listing.photos) && listing.photos.length > 0;
  const hasAmenities = Array.isArray(listing.amenities) && listing.amenities.length > 0;
  const hasPrice = safeNumber(listing.price) !== null;

  return hasTitle || hasPhotos || hasAmenities || hasPrice;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function extractLocationTokens(listing: ExtractedListing): string[] {
  const text = normalizeTextParts(listing.locationLabel, listing.title);
  if (!text) return [];

  const stopwords = new Set([
    "hotel",
    "hôtel",
    "appartement",
    "apartment",
    "apart",
    "residence",
    "résidence",
    "villa",
    "maison",
    "riad",
    "maroc",
    "france",
    "francia",
    "marruecos",
    "morocco",
    "only",
    "family",
  ]);

  return [...new Set(
    text
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !stopwords.has(token))
  )];
}

export function guessListingCity(listing: ExtractedListing): string | null {
  const descHint =
    String(listing.platform ?? "").toLowerCase() === "airbnb" &&
    !normalizeTextParts(listing.locationLabel, listing.structure?.locationLabel)
      ? listing.description?.slice(0, 520)
      : undefined;
  const text = normalizeTextParts(
    listing.locationLabel,
    listing.structure?.locationLabel,
    listing.title,
    typeof listing.url === "string" ? listing.url : undefined,
    descHint
  );
  if (!text) return null;

  if (/\bsidi[\s-]+bouzid\b/.test(text)) {
    return "sidi bouzid";
  }

  const brandingFallbackSkip = new Set([
    "golden",
    "holiday",
    "family",
    "only",
    "central",
    "executive",
    "premium",
    "luxury",
    "modern",
    "urban",
    "residence",
    "residences",
    "collection",
    "palace",
    "suites",
    "suite",
    "plaza",
    "garden",
    "city",
    "home",
    "homes",
    "appart",
    "apartment",
    "apartement",
    "appartamento",
    "apartman",
    "hotel",
    "hostel",
    "resort",
  ]);

  const normalized = text
    .replace(/\bmarrakesh\b/g, "marrakech")
    .replace(/\bmarraquexe\b/g, "marrakech")
    .replace(/\bmarraquex\b/g, "marrakech")
    .replace(/\bparis\b/g, "paris")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const explicitMatch = normalized.match(
    /\b(?:in|à|a|en|de|di|em)\s+([a-z][a-z-]{2,})(?:\s*·|,|$)/i
  );
  if (
    explicitMatch?.[1] &&
    !NON_CITY_TOKENS.has(explicitMatch[1]) &&
    !brandingFallbackSkip.has(explicitMatch[1])
  ) {
    return explicitMatch[1];
  }

  const tokenMatch = extractLocationTokens({
    ...listing,
    locationLabel: normalized,
    title: normalized,
  } as ExtractedListing);

  const knownCityTokens = [
    "marrakech",
    "paris",
    "lille",
    "toulouse",
    "essaouira",
    "casablanca",
    "rabat",
    "tangier",
    "tanger",
  ];

  return (
    tokenMatch.find((token) => knownCityTokens.includes(token)) ??
    tokenMatch.find((token) => !NON_CITY_TOKENS.has(token) && !brandingFallbackSkip.has(token)) ??
    null
  );
}

/**
 * Aiguille geo Booking : phrase ville complète à partir des signaux cible (titre, libellés, description).
 * Évite guessListingCity seul quand il ne retient que « saint ».
 */
function resolveBookingGeoTargetCityNeedle(target: ExtractedListing): string | null {
  const descHint =
    String(target.platform ?? "").toLowerCase() === "airbnb" &&
    !normalizeTextParts(target.locationLabel, target.structure?.locationLabel)
      ? target.description?.slice(0, 520)
      : undefined;
  const rawText = normalizeTextParts(
    target.locationLabel,
    target.structure?.locationLabel,
    target.title,
    typeof target.url === "string" ? target.url : undefined,
    descHint,
    target.description?.slice(0, 800)
  );

  if (rawText) {
    const normalized = rawText
      .replace(/\bmarrakesh\b/g, "marrakech")
      .replace(/\bmarraquexe\b/g, "marrakech")
      .replace(/\bmarraquex\b/g, "marrakech")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const compound = normalized.match(
      /\b(saint|sainte|st\.?|san|santa)[\s,'-]+([a-z\u00e0-\u024f]{2,})\b/i
    );
    if (compound?.[1] && compound[2]) {
      const p1 = canonicalizeSaintPrefixForGeoNeedle(compound[1]);
      const needle = normalizeCityForBookingGeoMatch(`${p1} ${compound[2]}`);
      if (bookingCityNeedleIsSpecificEnough(needle)) return needle;
    }

    const beforeCountry = normalized.match(
      /,\s*([a-z]+(?:[\s'-][a-z]+)+)\s*,\s*(?:france|morocco|maroc|espagne|spain|italy|italie|portugal)\b/
    );
    if (beforeCountry?.[1]) {
      const needle = normalizeCityForBookingGeoMatch(beforeCountry[1]);
      if (bookingCityNeedleIsSpecificEnough(needle)) return needle;
    }
  }

  const guess = guessListingCity(target);
  if (!guess) return null;
  const n = normalizeCityForBookingGeoMatch(guess);
  if (!bookingCityNeedleIsSpecificEnough(n)) return null;
  return n;
}

export function guessListingNeighborhood(listing: ExtractedListing): string | null {
  const text = normalizeTextParts(listing.locationLabel, listing.title);
  if (!text) return null;

  const knownNeighborhoods = [
    "gueliz",
    "gueliz",
    "hivernage",
    "medina",
    "victor",
    "majorelle",
  ];

  return knownNeighborhoods.find((token) => text.includes(token)) ?? null;
}

function getDistanceKm(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | null {
  if (
    typeof lat1 !== "number" ||
    !Number.isFinite(lat1) ||
    typeof lon1 !== "number" ||
    !Number.isFinite(lon1) ||
    typeof lat2 !== "number" ||
    !Number.isFinite(lat2) ||
    typeof lon2 !== "number" ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function capacityCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const t = safeNumber(target.capacity);
  const c = safeNumber(candidate.capacity);

  if (t === null || c === null) return true;

  return Math.abs(t - c) <= 3;
}

function bedroomsCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const t = safeNumber(target.bedrooms);
  const c = safeNumber(candidate.bedrooms);

  if (t === null || c === null) return true;

  return Math.abs(t - c) <= 2;
}

function bathroomsCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const t = safeNumber(target.bathrooms);
  const c = safeNumber(candidate.bathrooms);

  if (t === null || c === null) return true;

  return Math.abs(t - c) <= 2;
}

function typeCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const targetType = getNormalizedComparableType(target);
  const candidateType = getNormalizedComparableType(candidate);

  if (targetType === "unknown" || candidateType === "unknown") return true;

  if (targetType !== "hotel_like" && candidateType === "hotel_like") return false;
  if (targetType === "studio_like") {
    if (candidateType === "studio_like") return true;
    if (
      candidateType === "apartment_like" &&
      String(target.platform ?? "").toLowerCase() === "booking" &&
      String(candidate.platform ?? "").toLowerCase() === "booking"
    ) {
      return true;
    }
    return false;
  }

  return targetType === candidateType;
}

function hasExplicitHotelSignal(listing: ExtractedListing): boolean {
  const primaryText = normalizeTextParts(listing.propertyType, listing.title);
  const hasHotelWord =
    /\bhotel\b|\bhôtel\b|\bhostel\b|\bresort\b|\bguest ?house\b|\binn\b/.test(primaryText);
  const hasResidentialOverride =
    /\bapart\b|\bapartment\b|\bappartement\b|\bstudio\b|\bvilla\b|\bmaison\b|\briad\b|\bdar\b|\baparthotel\b|\bresidence\b/.test(
      primaryText
    );

  return hasHotelWord && !hasResidentialOverride;
}

function platformCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  if (!target.platform || !candidate.platform) return true;
  return target.platform === candidate.platform;
}

function locationCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const targetCity = guessListingCity(target);
  const candidateCity = guessListingCity(candidate);
  const targetNeighborhood = guessListingNeighborhood(target);
  const candidateNeighborhood = guessListingNeighborhood(candidate);

  if (targetCity && candidateCity && targetCity !== candidateCity) {
    const isBookingCandidate = String(candidate.platform ?? "").toLowerCase() === "booking";
    if (isBookingCandidate) {
      const normalizedTargetCity = resolveBookingGeoTargetCityNeedle(target);
      if (DEBUG_MARKET_PIPELINE) {
        console.log(
          "[market][booking-geo-needle-debug]",
          JSON.stringify({
            rawGuessTargetCity: targetCity,
            resolvedTargetCityNeedle: normalizedTargetCity,
            targetTitle: target.title ?? null,
            targetLocationLabel: target.locationLabel ?? null,
            targetDescriptionPreview:
              typeof target.description === "string"
                ? target.description.slice(0, 200)
                : null,
          })
        );
      }
      const sig = normalizedTargetCity
        ? bookingCandidateMatchesTargetCityFromSignals(candidate, normalizedTargetCity)
        : { match: false as const };
      if (sig.match) {
        if (DEBUG_MARKET_PIPELINE) {
          console.log(
            "[market][booking-geo-fallback]",
            JSON.stringify({
              title: candidate.title ?? null,
              extractedCity: candidateCity,
              rawTargetCity: targetCity,
              normalizedTargetCity,
              matchedBy: sig.matchedBy ?? null,
              matchedNeedle: sig.matchedNeedle ?? null,
            })
          );
        }
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  if (
    targetNeighborhood &&
    candidateNeighborhood &&
    targetNeighborhood !== candidateNeighborhood &&
    target.platform === candidate.platform
  ) {
    return false;
  }

  const distanceKm = getDistanceKm(
    target.latitude,
    target.longitude,
    candidate.latitude,
    candidate.longitude
  );

  if (distanceKm === null) {
    const targetTokens = extractLocationTokens(target);
    const candidateTokens = extractLocationTokens(candidate);

    if (targetTokens.length === 0 || candidateTokens.length === 0) return true;

    return targetTokens.some((token) => candidateTokens.includes(token));
  }

  // Allow a broader radius but avoid clearly different areas
  return distanceKm <= 50;
}

function priceCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const t = safeNumber(target.price);
  const c = safeNumber(candidate.price);

  if (t === null || c === null || t <= 0 || c <= 0) return true;

  const ratio = c / t;

  // Filter out extreme outliers (very underpriced or overpriced vs target)
  if (ratio < 0.33 || ratio > 3) return false;

  return true;
}

function isLowQualityCandidate(listing: ExtractedListing): boolean {
  const title = (listing.title ?? "").trim();
  const locationLabel = (listing.locationLabel ?? "").trim();
  const bathrooms = safeNumber(listing.bathrooms);

  if (!title || title.length < 4 || title.length > 180) return true;
  if (/airbnb:|the largest selection of hotels|vacation rentals|holiday rentals/i.test(title)) {
    return true;
  }
  if (/airbnb:|vacation rentals|holiday rentals/i.test(locationLabel)) {
    return true;
  }
  if (bathrooms !== null && bathrooms > 12) return true;

  return false;
}

function languageCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const targetLanguage = guessListingLanguage(target);
  const candidateLanguage = guessListingLanguage(candidate);

  if (targetLanguage === "unknown" || candidateLanguage === "unknown") return true;
  if (targetLanguage === candidateLanguage) return true;

  return targetLanguage === "latin" && candidateLanguage === "latin";
}

function computeCompletenessScore(listing: ExtractedListing): number {
  let score = 0;

  if (listing.title && listing.title.trim().length > 0) score += 2;

  const descriptionLength = listing.description?.trim().length ?? 0;
  if (descriptionLength > 0) score += descriptionLength > 120 ? 2 : 1;

  if (Array.isArray(listing.photos) && listing.photos.length > 0) {
    score += Math.min(3, listing.photos.length >= 10 ? 3 : 2);
  }

  if (Array.isArray(listing.amenities) && listing.amenities.length > 0) {
    score += listing.amenities.length >= 8 ? 2 : 1;
  }

  if (safeNumber(listing.price) !== null) score += 1;
  if (safeNumber(listing.rating) !== null && safeNumber(listing.reviewCount) !== null)
    score += 1;

  return Math.max(0, Math.min(10, score));
}

function computeComparableScore(
  target: ExtractedListing,
  candidate: ExtractedListing
): number {
  let score = 0;

  if (platformCompatible(target, candidate)) score += 20;
  if (typeCompatible(target, candidate)) score += 40;

  const tCapacity = safeNumber(target.capacity);
  const cCapacity = safeNumber(candidate.capacity);
  if (tCapacity !== null && cCapacity !== null) {
    score += Math.max(0, 20 - Math.abs(tCapacity - cCapacity) * 8);
  }

  const tBedrooms = safeNumber(target.bedrooms);
  const cBedrooms = safeNumber(candidate.bedrooms);
  if (tBedrooms !== null && cBedrooms !== null) {
    score += Math.max(0, 12 - Math.abs(tBedrooms - cBedrooms) * 6);
  }

  const tBathrooms = safeNumber(target.bathrooms);
  const cBathrooms = safeNumber(candidate.bathrooms);
  if (tBathrooms !== null && cBathrooms !== null) {
    score += Math.max(0, 8 - Math.abs(tBathrooms - cBathrooms) * 4);
  }

  const distanceKm = getDistanceKm(
    target.latitude,
    target.longitude,
    candidate.latitude,
    candidate.longitude
  );

  if (distanceKm !== null) {
    score += Math.max(0, 15 - distanceKm * 5);
  }

  const tPrice = safeNumber(target.price);
  const cPrice = safeNumber(candidate.price);
  if (tPrice !== null && tPrice > 0 && cPrice !== null && cPrice > 0) {
    const ratio = cPrice / tPrice;
    const deviation = Math.abs(ratio - 1);

    if (deviation <= 0.15) {
      score += 12;
    } else if (deviation <= 0.3) {
      score += 8;
    } else if (deviation <= 0.5) {
      score += 4;
    }
  }

  // Reward listings that have enough data to be meaningfully comparable
  score += computeCompletenessScore(candidate);

  return score;
}

export function filterComparableListings(
  target: ExtractedListing,
  candidates: ExtractedListing[],
  maxResults = 5
): ExtractedListing[] {
  const decisions = evaluateComparableCandidates(target, candidates);
  if (DEBUG_MARKET_PIPELINE) {
    const keptDecisions = decisions.filter((d) => d.accepted);
    const rejectedDecisions = decisions.filter((d) => !d.accepted);
    console.log(
      "[market][debug][post-filter]",
      JSON.stringify({
        context: "filterComparableListings",
        maxResults,
        keptCount: keptDecisions.length,
        rejectedCount: rejectedDecisions.length,
        kept: keptDecisions.map((d) => ({
          title: d.candidate.title ?? null,
          price:
            typeof d.candidate.price === "number" && Number.isFinite(d.candidate.price)
              ? d.candidate.price
              : null,
          propertyType: d.candidate.propertyType ?? null,
          url: (d.candidate.url ?? "").trim(),
        })),
        rejected: rejectedDecisions.map((d) => ({
          title: d.candidate.title ?? null,
          price:
            typeof d.candidate.price === "number" && Number.isFinite(d.candidate.price)
              ? d.candidate.price
              : null,
          propertyType: d.candidate.propertyType ?? null,
          url: (d.candidate.url ?? "").trim(),
          reasons: d.reasons,
        })),
      })
    );
  }

  const filtered = decisions
    .filter((decision) => decision.accepted)
    .sort((a, b) => {
      const scoreDiff = b.comparableScore - a.comparableScore;
      if (scoreDiff !== 0) return scoreDiff;

      const distanceA =
        typeof a.distanceKm === "number" && Number.isFinite(a.distanceKm)
          ? a.distanceKm
          : 999;
      const distanceB =
        typeof b.distanceKm === "number" && Number.isFinite(b.distanceKm)
          ? b.distanceKm
          : 999;

      return distanceA - distanceB;
    })
    .slice(0, maxResults);

  return filtered.map((item) => item.candidate);
}

/** Ensemble de raisons toléré pour l’override riad/ryad Booking → cible villa_like (aucune autre). */
function bookingRiadVillaComparableOverrideReasons(reasons: readonly string[]): boolean {
  if (reasons.length === 1) {
    return reasons[0] === "property_type_mismatch";
  }
  if (reasons.length === 2) {
    const set = new Set(reasons);
    return (
      set.size === 2 &&
      set.has("property_type_mismatch") &&
      set.has("structure_too_far")
    );
  }
  return false;
}

/** Pays marché (heuristique texte) — évite un import depuis `searchCompetitors` (cycle). */
function guessListingCountryFromText(listing: ExtractedListing): string | null {
  const text = `${listing.locationLabel ?? ""} ${listing.title ?? ""} ${listing.url ?? ""}`.toLowerCase();
  if (
    text.includes("morocco") ||
    text.includes("maroc") ||
    text.includes("marrakech") ||
    text.includes("marrakesh")
  ) {
    return "morocco";
  }
  return null;
}

/**
 * Cible villa Booking Maroc avec prix nuitée manifestement sous-coté : ne pas appliquer
 * `price_outlier` uniquement sur le ratio strict, pour ne pas rejeter des comparables crédibles (>= 40).
 * `priceCompatible` reste inchangé pour le reste du code ; exception locale ici uniquement.
 */
function shouldRelaxPriceOutlierForBookingMoroccoVillaLowTarget(args: {
  target: ExtractedListing;
  candidate: ExtractedListing;
  normalizedTargetCountry: string | null;
  targetNormalizedType: string;
  candidateNormalizedType: string;
}): boolean {
  const {
    target,
    candidate,
    normalizedTargetCountry,
    targetNormalizedType,
    candidateNormalizedType,
  } = args;

  if (String(target.platform ?? "").toLowerCase() !== "booking") return false;
  if (String(candidate.platform ?? "").toLowerCase() !== "booking") return false;
  if (normalizedTargetCountry !== "morocco") return false;
  if (targetNormalizedType !== "villa_like") return false;

  if (candidateNormalizedType === "hotel_like" || candidateNormalizedType === "apartment_like") {
    return false;
  }

  if (guessListingCountryFromText(candidate) !== "morocco") return false;

  const t = safeNumber(target.price);
  const c = safeNumber(candidate.price);
  if (t == null || c == null || t <= 0 || c <= 0) return false;

  if (!(t < BOOKING_MOROCCO_VILLA_MIN_NIGHT_PRICE || t < 60)) return false;

  if (c < BOOKING_MOROCCO_VILLA_MIN_NIGHT_PRICE) return false;

  if (priceCompatible(target, candidate)) return false;

  return true;
}

/**
 * Villa Booking Maroc : autorise des `house_like` (riad, maison, dar…) comme comparables
 * sans élargir `typeCompatible` globalement. N’enlève pas les gardes prix / geo / hôtel.
 */
function isBookingMoroccoVillaHouseCompatible(args: {
  target: ExtractedListing;
  candidate: ExtractedListing;
  reasons: readonly string[];
  normalizedTargetCountry: string | null;
  targetNormalizedType: string;
  candidateNormalizedType: string;
}): boolean {
  const {
    target,
    candidate,
    reasons,
    normalizedTargetCountry,
    targetNormalizedType,
    candidateNormalizedType,
  } = args;

  if (String(target.platform ?? "").toLowerCase() !== "booking") return false;
  if (String(candidate.platform ?? "").toLowerCase() !== "booking") return false;
  if (normalizedTargetCountry !== "morocco") return false;
  if (targetNormalizedType !== "villa_like") return false;
  if (candidateNormalizedType !== "house_like") return false;

  if (guessListingCountryFromText(candidate) !== "morocco") return false;

  if (reasons.includes("hotel_vs_apartment_mismatch")) return false;
  if (hasExplicitHotelSignal(candidate)) return false;

  const p = candidate.price;
  if (typeof p !== "number" || !Number.isFinite(p) || p < BOOKING_MOROCCO_VILLA_MIN_NIGHT_PRICE) {
    return false;
  }

  if (!priceCompatible(target, candidate)) return false;
  if (!locationCompatible(target, candidate)) return false;

  return true;
}

function bookingVillaBookingStructureTooFarSoftGuards(args: {
  targetNormalizedType: string;
  missingPrice: boolean;
  reasonsSnapshot: readonly string[];
  candidate: ExtractedListing;
  target: ExtractedListing;
  targetCity: string | null;
  candidateCity: string | null;
}): boolean {
  if (args.targetNormalizedType !== "villa_like") return false;
  if (String(args.target.platform ?? "").toLowerCase() !== "booking") return false;
  if (String(args.candidate.platform ?? "").toLowerCase() !== "booking") return false;
  if (args.missingPrice) return false;

  const p = args.candidate.price;
  if (
    typeof p !== "number" ||
    !Number.isFinite(p) ||
    p <= 0 ||
    p > 5000
  ) {
    return false;
  }
  if (
    typeof args.candidate.currency !== "string" ||
    args.candidate.currency.trim().length === 0
  ) {
    return false;
  }

  const blocked = new Set([
    "low_quality_candidate",
    "hotel_vs_apartment_mismatch",
    "city_mismatch",
    "country_mismatch",
    "price_outlier",
  ]);
  for (const r of args.reasonsSnapshot) {
    if (blocked.has(r)) return false;
  }

  const tc = (args.targetCity ?? "").trim().toLowerCase();
  const cc = (args.candidateCity ?? "").trim().toLowerCase();
  if (cc.length > 0 && tc.length > 0 && cc !== tc) {
    return false;
  }

  return true;
}

export function evaluateComparableCandidates(
  target: ExtractedListing,
  candidates: ExtractedListing[],
  options?: EvaluateComparableCandidatesOptions
): ComparableCandidateDecision[] {
  const normalizedTargetCountry = options?.normalizedTargetCountry ?? null;
  const targetNormalizedType = getNormalizedComparableType(target);
  const targetCity = guessListingCity(target);
  const targetNeighborhood = guessListingNeighborhood(target);
  const targetLanguageGuess = guessListingLanguage(target);

  return candidates
    .filter((candidate) => candidate.url !== target.url)
    .map((candidate) => {
      const reasons: string[] = [];
      const legacyType = getNormalizedComparableType(candidate);
      const candidateNormalizedType = legacyType;
      const candidateCity = guessListingCity(candidate);
      const candidateNeighborhood = guessListingNeighborhood(candidate);
      const candidateLanguageGuess = guessListingLanguage(candidate);

      if (DEBUG_MARKET_PIPELINE) {
        const segmentResult = classifyComparableSegment({
          propertyType: candidate.propertyType ?? null,
          title: candidate.title ?? null,
          description: candidate.description ?? null,
          url: candidate.url ?? null,
          platform: candidate.platform ?? null,
        });
        if (legacyType !== segmentResult.segment) {
          console.log(
            "[segment][diff]",
            JSON.stringify({
              title: candidate.title ?? null,
              legacyType,
              newSegment: segmentResult.segment,
              confidence: segmentResult.confidence,
              signals: segmentResult.signals,
            })
          );
        }
      }

      if (!hasBasicData(candidate) || isLowQualityCandidate(candidate)) {
        reasons.push("low_quality_candidate");
      }
      if (
        targetNormalizedType !== "hotel_like" &&
        hasExplicitHotelSignal(candidate)
      ) {
        reasons.push("hotel_vs_apartment_mismatch");
      }
      if (!typeCompatible(target, candidate)) {
        reasons.push("property_type_mismatch");
        if (targetNormalizedType !== "hotel_like" && candidateNormalizedType === "hotel_like") {
          reasons.push("hotel_vs_apartment_mismatch");
        }
      }
      if (
        target.platform === "airbnb" &&
        candidateNormalizedType === "unknown"
      ) {
        reasons.push("low_quality_candidate");
      }
      if (
        !capacityCompatible(target, candidate) ||
        !bedroomsCompatible(target, candidate) ||
        !bathroomsCompatible(target, candidate)
      ) {
        reasons.push("structure_too_far");
      }
      if (!locationCompatible(target, candidate)) {
        if (targetCity && candidateCity && targetCity !== candidateCity) {
          reasons.push("city_mismatch");
        } else if (
          targetNeighborhood &&
          candidateNeighborhood &&
          targetNeighborhood !== candidateNeighborhood
        ) {
          reasons.push("neighborhood_mismatch");
        } else {
          reasons.push("city_mismatch");
        }
      }
      if (!languageCompatible(target, candidate)) reasons.push("language_incoherent");
      if (!priceCompatible(target, candidate)) {
        const previousReasonsBeforeOutlier = [...reasons];
        const relaxLowTargetPriceOutlier = shouldRelaxPriceOutlierForBookingMoroccoVillaLowTarget({
          target,
          candidate,
          normalizedTargetCountry,
          targetNormalizedType,
          candidateNormalizedType,
        });
        if (!relaxLowTargetPriceOutlier) {
          reasons.push("price_outlier");
          if (DEBUG_MARKET_PIPELINE) {
            const tPrice = safeNumber(target.price);
            const cPrice = safeNumber(candidate.price);
            const ratio =
              tPrice != null && cPrice != null && tPrice > 0
                ? cPrice / tPrice
                : null;
            const u = (candidate.url ?? "").trim();
            console.log(
              "[market][price-outlier-debug]",
              JSON.stringify({
                targetTitle: target.title ?? null,
                targetPrice: tPrice,
                targetCurrency: target.currency ?? null,
                targetPriceBasis: target.priceBasis ?? null,
                targetStayNights: target.stayNights ?? null,
                targetRawStayPrice: target.rawStayPrice ?? null,
                candidateTitle: candidate.title ?? null,
                candidatePrice: cPrice,
                candidateCurrency: candidate.currency ?? null,
                candidatePriceBasis: candidate.priceBasis ?? null,
                candidateStayNights: candidate.stayNights ?? null,
                candidateRawStayPrice: candidate.rawStayPrice ?? null,
                ratio,
                candidateUrl: u.length > 240 ? `${u.slice(0, 237)}...` : u || null,
                reasons: [...reasons],
              })
            );
          }
        } else if (DEBUG_MARKET_PIPELINE) {
          const tPrice = safeNumber(target.price);
          const cPrice = safeNumber(candidate.price);
          const ratio =
            tPrice != null && cPrice != null && tPrice > 0 ? cPrice / tPrice : null;
          console.log(
            "[market][booking-morocco-villa-low-target-price-soft-keep]",
            JSON.stringify({
              targetPrice: tPrice,
              candidatePrice: cPrice,
              ratio,
              targetTitle: target.title ?? null,
              candidateTitle: candidate.title ?? null,
              previousReasons: previousReasonsBeforeOutlier,
              finalReasons: [...reasons],
            })
          );
        }
      }

      const missingPrice =
        typeof candidate.price !== "number" ||
        !Number.isFinite(candidate.price) ||
        candidate.price <= 0;

      const previousReasons = [...reasons];

      const propertyTypeWords = tokenizeComparableText(
        normalizeTextParts(candidate.propertyType)
      );
      const firstPropertyTypeToken = propertyTypeWords[0] ?? "";
      if (
        !missingPrice &&
        targetNormalizedType === "villa_like" &&
        String(target.platform ?? "").toLowerCase() === "booking" &&
        String(candidate.platform ?? "").toLowerCase() === "booking" &&
        bookingRiadVillaComparableOverrideReasons(previousReasons) &&
        (firstPropertyTypeToken === "riad" || firstPropertyTypeToken === "ryad")
      ) {
        reasons.length = 0;
        if (DEBUG_MARKET_PIPELINE) {
          const u = (candidate.url ?? "").trim();
          console.log(
            "[market][booking-riad-villa-compatibility-override]",
            JSON.stringify({
              url: u.length > 240 ? `${u.slice(0, 237)}...` : u || null,
              propertyTypeRaw: candidate.propertyType ?? null,
              candidateNormalizedType,
              targetNormalizedType,
              previousReasons,
            })
          );
        }
      }

      if (
        reasons.includes("property_type_mismatch") &&
        isBookingMoroccoVillaHouseCompatible({
          target,
          candidate,
          reasons,
          normalizedTargetCountry,
          targetNormalizedType,
          candidateNormalizedType,
        })
      ) {
        const previousReasonsHouse = [...reasons];
        for (let i = reasons.length - 1; i >= 0; i -= 1) {
          if (reasons[i] === "property_type_mismatch") {
            reasons.splice(i, 1);
          }
        }
        if (DEBUG_MARKET_PIPELINE && previousReasonsHouse.length !== reasons.length) {
          console.log(
            "[market][booking-morocco-villa-house-soft-keep]",
            JSON.stringify({
              title: candidate.title ?? null,
              candidateType: candidateNormalizedType,
              candidatePrice:
                typeof candidate.price === "number" && Number.isFinite(candidate.price)
                  ? candidate.price
                  : null,
              previousReasons: previousReasonsHouse,
              finalReasons: [...reasons],
            })
          );
        }
      }

      if (
        bookingVillaBookingStructureTooFarSoftGuards({
          targetNormalizedType,
          missingPrice,
          reasonsSnapshot: previousReasons,
          candidate,
          target,
          targetCity,
          candidateCity,
        }) &&
        reasons.length === 1 &&
        reasons[0] === "structure_too_far"
      ) {
        const beforeStructureSoft = [...reasons];
        reasons.length = 0;
        if (DEBUG_MARKET_PIPELINE) {
          const u = (candidate.url ?? "").trim();
          console.log(
            "[market][booking-villa-structure-soft-override]",
            JSON.stringify({
              url: u.length > 240 ? `${u.slice(0, 237)}...` : u || null,
              propertyTypeRaw: candidate.propertyType ?? null,
              previousReasons: beforeStructureSoft,
              finalReasons: [...reasons],
            })
          );
        }
      }

      /** Après prix nuitée et overrides ; évite les extractions Booking villa MA à ~20 € qui faussent la moyenne marché. */
      if (
        String(target.platform ?? "").toLowerCase() === "booking" &&
        targetNormalizedType === "villa_like" &&
        normalizedTargetCountry === "morocco" &&
        !missingPrice &&
        typeof candidate.price === "number" &&
        Number.isFinite(candidate.price) &&
        candidate.price < BOOKING_MOROCCO_VILLA_MIN_NIGHT_PRICE
      ) {
        reasons.push("booking_morocco_villa_price_floor");
        if (DEBUG_MARKET_PIPELINE) {
          const u = (candidate.url ?? "").trim();
          console.log(
            "[market][booking-price-floor-rejected]",
            JSON.stringify({
              title: candidate.title ?? null,
              name: candidate.hostName ?? null,
              url: u.length > 240 ? `${u.slice(0, 237)}...` : u || null,
              price: candidate.price,
              floor: BOOKING_MOROCCO_VILLA_MIN_NIGHT_PRICE,
              targetPlatform: target.platform ?? null,
              targetType: targetNormalizedType,
              guardCountry: normalizedTargetCountry,
              normalizedTargetCountry,
              reason: "booking_morocco_villa_price_floor",
            })
          );
        }
      }

      /** Après plancher ; fourchette 40–59,xx € encore souvent trompeuse pour villa Booking au Maroc. */
      if (
        String(target.platform ?? "").toLowerCase() === "booking" &&
        targetNormalizedType === "villa_like" &&
        normalizedTargetCountry === "morocco" &&
        typeof candidate.price === "number" &&
        Number.isFinite(candidate.price) &&
        candidate.price >= BOOKING_MOROCCO_VILLA_MIN_NIGHT_PRICE &&
        candidate.price < BOOKING_MOROCCO_VILLA_SUSPICIOUS_LOW_PRICE_CEILING
      ) {
        reasons.push("booking_morocco_villa_suspicious_low_price");
        if (DEBUG_MARKET_PIPELINE) {
          const u = (candidate.url ?? "").trim();
          console.log(
            "[market][booking-suspicious-low-price-rejected]",
            JSON.stringify({
              title: candidate.title ?? null,
              name: candidate.hostName ?? null,
              url: u.length > 240 ? `${u.slice(0, 237)}...` : u || null,
              price: candidate.price,
              floor: BOOKING_MOROCCO_VILLA_MIN_NIGHT_PRICE,
              suspiciousCeiling: BOOKING_MOROCCO_VILLA_SUSPICIOUS_LOW_PRICE_CEILING,
              targetPlatform: target.platform ?? null,
              targetType: targetNormalizedType,
              guardCountry: normalizedTargetCountry,
              normalizedTargetCountry,
              reason: "booking_morocco_villa_suspicious_low_price",
            })
          );
        }
      }

      if (DEBUG_MARKET_PIPELINE && String(candidate.platform ?? "").toLowerCase() === "booking") {
        const u = (candidate.url ?? "").trim();
        console.log(
          "[market][booking-filter-debug]",
          JSON.stringify({
            url: u.length > 240 ? `${u.slice(0, 237)}...` : u || null,
            propertyTypeRaw: candidate.propertyType ?? null,
            candidateNormalizedType,
            targetNormalizedType,
            accepted: reasons.length === 0,
            reasons: [...reasons],
            missingPrice,
          })
        );
      }

      return {
        candidate,
        accepted: reasons.length === 0,
        reasons,
        comparableScore: computeComparableScore(target, candidate),
        distanceKm: getDistanceKm(
          target.latitude,
          target.longitude,
          candidate.latitude,
          candidate.longitude
        ),
        targetNormalizedType,
        candidateNormalizedType,
        targetCity,
        candidateCity,
        targetNeighborhood,
        candidateNeighborhood,
        targetLanguageGuess,
        candidateLanguageGuess,
      };
    });
}

function normalizeHaystackForPremium(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function targetBedroomsForPremium(t: ExtractedListing): number | null {
  return safeNumber(t.bedrooms) ?? safeNumber(t.bedroomCount);
}

function largestSqmFromListingText(
  title: string | null | undefined,
  description: string | null | undefined
): number | null {
  const merged = normalizeTextParts(title, description);
  if (!merged) return null;
  const re = /\b(\d{2,4})\s*(?:m2|m²|sqm|sq\.?\s*m)\b/gi;
  let maxN: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(merged)) !== null) {
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(n)) maxN = maxN === null ? n : Math.max(maxN, n);
  }
  return maxN;
}

const PREMIUM_LUXURY_HAY_REGEX =
  /\b(luxury|luxe|premium|prestige|palais|private\s+pool|piscine\s+privee|villa\s+privee)\b/;

/** Règle A uniquement — ne qualifie pas les villas entrée de gamme sans signaux fort / prix récent. */
function classifyPremiumLuxeVillaTarget(target: ExtractedListing): {
  eligible: boolean;
  reason: string;
  targetPrice: number | null;
} {
  const pf = String(target.platform ?? "").toLowerCase();
  if (pf !== "booking" && pf !== "airbnb") {
    return { eligible: false, reason: "unsupported_platform", targetPrice: null };
  }
  if (getNormalizedComparableType(target) !== "villa_like") {
    return { eligible: false, reason: "not_villa_like", targetPrice: null };
  }

  const targetPrice =
    typeof target.price === "number" && Number.isFinite(target.price) && target.price > 0
      ? target.price
      : null;
  if (targetPrice === null) {
    return { eligible: false, reason: "missing_target_price", targetPrice: null };
  }

  const cap = safeNumber(target.capacity) ?? safeNumber(target.guestCapacity);
  const beds = targetBedroomsForPremium(target);
  const hay = normalizeHaystackForPremium(normalizeTextParts(target.title, target.description));
  const sqm = largestSqmFromListingText(target.title, target.description);

  const hasSignals =
    targetPrice >= 250 ||
    (cap != null && cap >= 8) ||
    (beds != null && beds >= 4) ||
    PREMIUM_LUXURY_HAY_REGEX.test(hay) ||
    (sqm != null && sqm >= 300);

  if (!hasSignals) {
    return { eligible: false, reason: "no_premium_signals", targetPrice };
  }

  return { eligible: true, reason: "premium_luxe_villa_signals", targetPrice };
}

function premiumSegmentComparableExcluded(candidate: ExtractedListing): {
  excluded: boolean;
  reasonLabel: string;
} {
  const ctype = getNormalizedComparableType(candidate);
  if (ctype === "hotel_like" || ctype === "apartment_like") {
    return { excluded: true, reasonLabel: `type_${ctype}` };
  }

  const hay = normalizeHaystackForPremium(
    normalizeTextParts(
      candidate.title,
      candidate.description,
      candidate.propertyType,
      candidate.airbnbComparableClassificationText
    )
  );

  if (/\bhostel\b/.test(hay) || /\bdorm\b/.test(hay) || /\bdortoir\b/.test(hay)) {
    return { excluded: true, reasonLabel: "hostel_signal" };
  }
  if (/\bshared\s+room\b/.test(hay) || /\bprivate\s+room\b/.test(hay)) {
    return { excluded: true, reasonLabel: "shared_private_room_signal" };
  }

  return { excluded: false, reasonLabel: "" };
}

/** Post‑traitement après `evaluateComparableCandidates` + weak override Booking : villas premium uniquement. */
export function applyPremiumVillaComparablePostFilter(
  target: ExtractedListing,
  decisions: ReturnType<typeof evaluateComparableCandidates>
): ReturnType<typeof evaluateComparableCandidates> {
  const { eligible, reason, targetPrice } = classifyPremiumLuxeVillaTarget(target);
  const beforeAccepted = decisions.filter((d) => d.accepted).length;

  const emitLog = (payload: Record<string, unknown>) => {
    if (!DEBUG_MARKET_PIPELINE) return;
    console.log("[market][premium-villa-filter]", JSON.stringify(payload));
  };

  const shouldTraceVilla =
    DEBUG_MARKET_PIPELINE &&
    getNormalizedComparableType(target) === "villa_like" &&
    (String(target.platform ?? "").toLowerCase() === "booking" ||
      String(target.platform ?? "").toLowerCase() === "airbnb");

  if (!eligible || targetPrice == null) {
    if (shouldTraceVilla) {
      emitLog({
        enabled: false,
        reason,
        targetTitle: target.title ?? null,
        targetPrice,
        priceFloorFactor: null,
        targetCapacity: safeNumber(target.capacity) ?? safeNumber(target.guestCapacity),
        targetBedrooms: targetBedroomsForPremium(target),
        beforeCount: beforeAccepted,
        afterCount: beforeAccepted,
        minAllowedPrice: null,
        ignoredBecauseTooFew: false,
        dropped: [],
      });
    }
    return decisions;
  }

  const priceFloorFactor =
    targetPrice >= 500 ? 0.6 : targetPrice >= 300 ? 0.55 : 0.35;
  const minAllowedPrice = Math.round(targetPrice * priceFloorFactor * 100) / 100;

  type DroppedRow = {
    title: string | null;
    price: number | null;
    type: string;
    reason: string;
  };

  const droppedRows: DroppedRow[] = [];
  let droppedTruncated = false;
  const DROP_LOG_CAP = 20;

  const staged: ReturnType<typeof evaluateComparableCandidates> = decisions.map((d) => {
    if (!d.accepted) return d;

    const c = d.candidate;
    const ctype = getNormalizedComparableType(c);
    const seg = premiumSegmentComparableExcluded(c);
    const cPrice =
      typeof c.price === "number" && Number.isFinite(c.price) && c.price > 0 ? c.price : null;

    let dropReason: string | null = null;
    let reasonCode = "";

    if (seg.excluded) {
      dropReason = seg.reasonLabel;
      reasonCode = "premium_villa_segmentation_type";
    } else if (cPrice !== null && cPrice < minAllowedPrice) {
      dropReason = `below_min_allowed_${minAllowedPrice}`;
      reasonCode = "premium_villa_segmentation_price";
    }

    if (dropReason === null) return d;

    if (droppedRows.length < DROP_LOG_CAP) {
      droppedRows.push({
        title: c.title ?? null,
        price: cPrice,
        type: ctype,
        reason: dropReason,
      });
    } else {
      droppedTruncated = true;
    }

    return {
      ...d,
      accepted: false,
      reasons: [...d.reasons, reasonCode],
    };
  });

  const stagedAccepted = staged.filter((x) => x.accepted).length;
  const filterRemovedSomething =
    stagedAccepted !== beforeAccepted || droppedRows.length > 0;
  let ignoredBecauseTooFew = false;
  let out = staged;
  let afterAccepted = stagedAccepted;

  if (
    stagedAccepted < 3 &&
    filterRemovedSomething &&
    (droppedRows.length > 0 || beforeAccepted >= 3)
  ) {
    ignoredBecauseTooFew = true;
    out = decisions;
    afterAccepted = beforeAccepted;
    console.warn(
      "[market][premium-villa-filter-ignored-sample]",
      JSON.stringify({
        reason: "reverted_sample_below_3",
        beforeAccepted,
        stagedAfter: stagedAccepted,
        droppedAttempted: droppedRows.length,
      })
    );
  }

  if (shouldTraceVilla) {
    emitLog({
      enabled: true,
      reason,
      targetTitle: target.title ?? null,
      targetPrice,
      priceFloorFactor,
      minAllowedPrice,
      targetCapacity: safeNumber(target.capacity) ?? safeNumber(target.guestCapacity),
      targetBedrooms: targetBedroomsForPremium(target),
      beforeCount: beforeAccepted,
      afterCount: afterAccepted,
      ignoredBecauseTooFew,
      dropped: droppedRows,
      droppedTruncated,
    });
  }

  return out;
}

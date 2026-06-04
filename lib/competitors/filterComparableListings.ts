import type { ExtractedListing } from "@/lib/extractors/types";
import { canonicalizeMarketCity } from "./marketNormalization";
import { normalizeWhitespace } from "@/lib/extractors/shared";
import {
  classifyComparableSegment,
  type ComparableSegmentResult,
} from "@/lib/marketClassification/classifyComparableSegment";
import {
  hasExplicitRoomSignal,
  hasStrongApartmentSignal,
} from "@/lib/marketClassification/comparableTypeLexicon";

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

  // Common multilingual connector words that are often extracted from titles,
  // but are never reliable standalone cities.
  "pour",
  "vous",
  "avec",
  "sans",
  "dans",
  "chez",
  "entre",
  "sur",
  "sous",
  "the",
  "for",
  "you",
  "with",
  "without",
  "and",
  "near",
  "next",
  "to",
  "para",
  "con",
  "sin",
  "en",
  "em",
  "com",
  "sem",
  "und",
  "mit",
  "ohne",
  "bei",
  "https",
  "http",
  "www",
]);

const DEBUG_MARKET_PIPELINE = process.env.DEBUG_MARKET_PIPELINE === "true";

const BOOKING_MOROCCO_VILLA_MIN_NIGHT_PRICE = 40;
const BOOKING_MOROCCO_VILLA_SUSPICIOUS_LOW_PRICE_CEILING = 60;
const AIRBNB_MARRAKECH_LOCAL_TOKENS = [
  "marrakech",
  "marrakesh",
  "gueliz",
  "medina",
  "hivernage",
] as const;

export type CanonicalCityOverride = {
  urlKey: string;
  canonicalCity: string | null;
};

export type ComparableEvaluationOptions = {
  /** Pays marché normalisé (ex. depuis discovery / guard) pour garde‑fous ciblés. */
  normalizedTargetCountry?: string | null;
  canonicalCityOverrides?: CanonicalCityOverride[] | null;
  targetCanonicalCityOverride?: string | null;
};

export type EvaluateComparableCandidatesOptions = ComparableEvaluationOptions;

export function normalizeComparableUrlKey(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";

  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.split("?")[0]?.trim().toLowerCase() ?? "";
  }
}

function normalizeCanonicalCityOverrideValue(value: string | null | undefined): string | null {
  const canonical = canonicalizeMarketCity(value);
  if (canonical) return canonical;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function lookupCanonicalCityOverride(
  listing: ExtractedListing,
  options?: ComparableEvaluationOptions
): string | null {
  const urlKey = normalizeComparableUrlKey(listing.url ?? null);
  if (!urlKey) return null;
  const overrides = Array.isArray(options?.canonicalCityOverrides)
    ? options.canonicalCityOverrides
    : [];
  const match = overrides.find((row) => row.urlKey === urlKey);
  return normalizeCanonicalCityOverrideValue(match?.canonicalCity ?? null);
}

function hasMatchingCanonicalCityOverride(
  target: ExtractedListing,
  candidate: ExtractedListing,
  options?: ComparableEvaluationOptions
): boolean {
  const targetCanonicalCityOverride = normalizeCanonicalCityOverrideValue(
    options?.targetCanonicalCityOverride
  );
  const candidateCanonicalCityOverride = lookupCanonicalCityOverride(candidate, options);
  if (!targetCanonicalCityOverride || !candidateCanonicalCityOverride) return false;
  return targetCanonicalCityOverride === candidateCanonicalCityOverride;
}

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

function normalizeComparableGuardText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isAirbnbMarrakechLocalAcceptanceGuardEligible(input: {
  target: ExtractedListing;
  candidate: ExtractedListing;
  normalizedTargetCountry: string | null;
  targetCity: string | null;
  candidateCity: string | null;
  candidateNormalizedType: string;
}): boolean {
  if (String(input.target.platform ?? "").toLowerCase() !== "airbnb") return false;
  if (String(input.candidate.platform ?? "").toLowerCase() !== "airbnb") return false;
  const normalizedTargetCity = normalizeComparableGuardText(input.targetCity);
  const normalizedTargetCountry = normalizeComparableGuardText(input.normalizedTargetCountry);
  if (
    normalizedTargetCountry !== "morocco" &&
    normalizedTargetCountry !== "maroc"
  ) {
    return false;
  }
  if (normalizedTargetCity !== "marrakech" && normalizedTargetCity !== "marrakesh") {
    return false;
  }
  if (
    typeof input.candidate.price !== "number" ||
    !Number.isFinite(input.candidate.price) ||
    input.candidate.price <= 0
  ) {
    return false;
  }
  const candidateText = normalizeComparableGuardText(
    normalizeTextParts(
      input.candidate.title,
      input.candidate.locationLabel,
      input.candidate.structure?.locationLabel,
      input.candidateCity
    )
  );
  const hasStrongLocalSignal = AIRBNB_MARRAKECH_LOCAL_TOKENS.some((token) =>
    candidateText.includes(token)
  );
  if (!hasStrongLocalSignal) return false;
  if (input.candidateNormalizedType === "apartment_like") return true;
  if (input.candidateNormalizedType !== "unknown") return false;
  return /\b(apartment|appartement|studio)\b/.test(candidateText);
}

function tokenizeComparableText(text: string): string[] {
  return text
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function getUrlTextForComparableType(listing: ExtractedListing): string | undefined {
  const rawUrl = typeof listing.url === "string" ? listing.url.trim() : "";
  if (!rawUrl) return undefined;
  const platform = String(listing.platform ?? "").toLowerCase();
  if (platform !== "booking") return rawUrl;

  try {
    const parsed = new URL(rawUrl);
    const sanitizedPath = parsed.pathname.replace(/^\/hotel\/[a-z]{2}\//i, "/");
    return `${parsed.origin}${sanitizedPath}`;
  } catch {
    return rawUrl.replace(/\/hotel\/[a-z]{2}\//i, "/");
  }
}

export function getNormalizedComparableType(listing: ExtractedListing): string {
  const isAirbnb = String(listing.platform ?? "").toLowerCase() === "airbnb";
  const airbnbClassText =
    typeof listing.airbnbComparableClassificationText === "string"
      ? listing.airbnbComparableClassificationText.trim()
      : "";
  const classificationTitle =
    isAirbnb && airbnbClassText.length > 0 ? airbnbClassText : listing.title;

  const primaryText = normalizeTextParts(
    listing.propertyType,
    classificationTitle,
    isAirbnb ? undefined : getUrlTextForComparableType(listing)
  );
  const secondaryText = normalizeTextParts(listing.description);
  const primaryTokens = new Set(tokenizeComparableText(primaryText));
  const secondaryTokens = new Set(tokenizeComparableText(secondaryText));

  const hasAny = (tokens: Set<string>, values: string[]) => values.some((value) => tokens.has(value));
  const primaryHasSuite =
    primaryTokens.has("suite") || primaryTokens.has("suites");
  const secondaryHasSuite =
    secondaryTokens.has("suite") || secondaryTokens.has("suites");
  const hasAparthotelBaseToken = (tokens: Set<string>) =>
    hasAny(tokens, ["aparthotel", "apartmenthotel"]);
  const hasApartmentBaseToken = (tokens: Set<string>) =>
    hasAny(tokens, [
      "apartment",
      "apartments",
      "flat",
      "appartement",
      "appartements",
      "residence",
      "residences",
      "apart",
      "condo",
    ]);
  const primaryHasExplicitRoomSignal = hasExplicitRoomSignal(primaryText);
  const bookingApartmentSignalOverride =
    String(listing.platform ?? "").toLowerCase() === "booking" &&
    (hasApartmentBaseToken(primaryTokens) || hasStrongApartmentSignal(primaryText));

  const primaryHasApartment =
    bookingApartmentSignalOverride ||
    (
      !primaryHasExplicitRoomSignal &&
      (hasApartmentBaseToken(primaryTokens) || hasStrongApartmentSignal(primaryText))
    );
  const primaryHasAparthotel = hasAparthotelBaseToken(primaryTokens);
  const primaryHasStudio = primaryTokens.has("studio");
  const primaryHasVilla = primaryTokens.has("villa");
  const primaryHasRiad =
    primaryTokens.has("riad") ||
    primaryTokens.has("dar") ||
    primaryText.includes("maison traditionnelle") ||
    primaryText.includes("palais marocain") ||
    primaryText.includes("medina house") ||
    primaryText.includes("traditional moroccan house");
  const primaryHasHouse = hasAny(primaryTokens, [
    "house",
    "home",
    "maison",
    "townhouse",
    "chalet",
  ]);
  const primaryHasRoom =
    hasAny(primaryTokens, ["room", "rooms", "chambre", "chambres"]) ||
    primaryText.includes("private room") ||
    primaryText.includes("shared room") ||
    primaryHasSuite ||
    primaryHasAparthotel;
  const primaryHasHotel =
    hasAny(primaryTokens, ["hotel", "hotels", "resort", "hostel", "guesthouse", "inn"]) ||
    primaryText.includes("boutique hotel") ||
    primaryText.includes("guest house") ||
    primaryText.includes("maison d hotes") ||
    primaryText.includes("maison dhotes") ||
    primaryText.includes("maison d'hotes") ||
    primaryText.includes("maison d’hotes") ||
    primaryText.includes("maison d hote") ||
    primaryText.includes("maison d’hote");

  if (isAirbnb && primaryHasStudio) {
    const canonicalFirst = normalizeWhitespace(classificationTitle).split(/\s*·\s*/)[0] ?? "";
    const entireApartmentFr = /logement entier\s*:?\s*appartement/i.test(secondaryText);
    const entireApartmentEn = /entire place\s*:?\s*apartment/i.test(secondaryText);
    const apartmentFirstOg =
      /^appartement\b/i.test(canonicalFirst) || /^apartment\b/i.test(canonicalFirst);
    const studioFirstOg = /^studio\b/i.test(canonicalFirst);
    const explicitStudioSignal =
      studioFirstOg ||
      /\bstudio\b/i.test(String(listing.propertyType ?? "")) ||
      /\bstudio\b/i.test(String(listing.title ?? ""));

    if (explicitStudioSignal) {
      return "studio_like";
    }

    if (
      (primaryHasApartment || entireApartmentFr || entireApartmentEn || apartmentFirstOg) &&
      !explicitStudioSignal
    ) {
      return "apartment_like";
    }
  }

  if (
    String(listing.platform ?? "").toLowerCase() === "booking" &&
    (primaryHasApartment || hasStrongApartmentSignal(primaryText))
  ) {
    return "apartment_like";
  }

  if (primaryHasStudio) return "studio_like";
  if (primaryHasVilla) return "villa_like";
  // "Résidence Hôtelière" / "Hôtel Résidence" — hotel token dominates residence token.
  // Exception: explicit aparthotel (e.g. "Appart-Hotel") stays apartment_like.
  const agodaApartmentOverridesGenericHotelPath =
    String(listing.platform ?? "").toLowerCase() === "agoda" &&
    primaryHasApartment &&
    !primaryHasAparthotel;

  if (
    primaryHasHotel &&
    primaryHasApartment &&
    !primaryHasAparthotel &&
    !agodaApartmentOverridesGenericHotelPath
  ) return "hotel_like";
  if (primaryHasApartment) return "apartment_like";
  // Riad/dar signals take priority over generic house — but yield to hotel tokens.
  if (primaryHasRiad && !primaryHasHotel && !hasStrongBookingHotelSignals(listing)) return "riad_like";
  if (primaryHasHouse) return "house_like";
  if (primaryHasHotel) return "hotel_like";
  if (primaryHasRoom) return "room_like";

  if (secondaryTokens.has("studio")) return "studio_like";
  if (secondaryTokens.has("villa")) return "villa_like";
  const secondaryHasAparthotel = hasAparthotelBaseToken(secondaryTokens);
  const secondaryHasExplicitRoomSignal = hasExplicitRoomSignal(secondaryText);
  if (
    !secondaryHasExplicitRoomSignal &&
    (hasApartmentBaseToken(secondaryTokens) || hasStrongApartmentSignal(secondaryText))
  ) {
    return "apartment_like";
  }
  const secondaryHasRiad = secondaryTokens.has("riad") || secondaryTokens.has("dar");
  if (secondaryHasRiad && !hasStrongBookingHotelSignals(listing)) {
    return "riad_like";
  }
  if (
    hasAny(secondaryTokens, [
      "house",
      "home",
      "maison",
      "townhouse",
      "chalet",
    ])
  ) {
    return "house_like";
  }
  if (
    hasAny(secondaryTokens, ["hotel", "hotels", "resort", "hostel", "guesthouse", "inn"]) ||
    secondaryText.includes("boutique hotel") ||
    secondaryText.includes("guest house") ||
    secondaryText.includes("maison d hotes") ||
    secondaryText.includes("maison dhotes") ||
    secondaryText.includes("maison d'hotes") ||
    secondaryText.includes("maison d’hotes") ||
    secondaryText.includes("maison d hote") ||
    secondaryText.includes("maison d’hote")
  ) {
    return "hotel_like";
  }
  if (
    hasAny(secondaryTokens, ["room", "rooms", "chambre", "chambres"]) ||
    secondaryText.includes("private room") ||
    secondaryText.includes("shared room") ||
    secondaryHasSuite ||
    secondaryHasAparthotel
  ) {
    return "room_like";
  }

  return "unknown";
}

export function guessListingLanguage(listing: ExtractedListing): string {
  const titleText = normalizeTextParts(listing.title);
  const fallbackText = normalizeTextParts(listing.locationLabel);
  const sanitizeDecorativeText = (value: string) =>
    value
      .replace(/[•·●▪◦‣⁃⋅∙]/g, " ")
      .replace(/[—–]+/g, "-")
      .replace(/[|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const sanitizedTitleText = sanitizeDecorativeText(titleText);
  const sanitizedFallbackText = sanitizeDecorativeText(fallbackText);
  const text = sanitizedTitleText || sanitizedFallbackText;
  if (!text) return "unknown";

  const detectScript = (value: string) => {
    if (/[\u0590-\u05ff]/.test(value)) return "hebrew";
    if (/[\u0600-\u06ff]/.test(value)) return "arabic";
    if (/[\u0400-\u04ff]/.test(value)) return "cyrillic";
    if (/^[\x00-\x7F\u00C0-\u024F\s.,·'’"!?()\-/:|]+$/.test(value)) return "latin";
    return "mixed";
  };

  const titleScript = sanitizedTitleText ? detectScript(sanitizedTitleText) : "unknown";
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

function resolveCanonicalCityFromCoordinates(
  latitude: unknown,
  longitude: unknown
): string | null {
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  // Barcelona metro
  if (latitude >= 41.25 && latitude <= 41.55 && longitude >= 1.95 && longitude <= 2.35) {
    return "barcelona";
  }

  // Madrid metro
  if (latitude >= 40.25 && latitude <= 40.60 && longitude >= -3.90 && longitude <= -3.50) {
    return "madrid";
  }

  // Rome metro
  if (latitude >= 41.75 && latitude <= 42.05 && longitude >= 12.35 && longitude <= 12.65) {
    return "rome";
  }

  // Marrakech / Guéliz / Hivernage / Medina
  if (latitude >= 31.45 && latitude <= 31.78 && longitude >= -8.25 && longitude <= -7.75) {
    return "marrakech";
  }

  // Paris / near suburbs
  if (latitude >= 48.75 && latitude <= 49.05 && longitude >= 2.10 && longitude <= 2.60) {
    return "paris";
  }

  // Toulouse metro
  if (latitude >= 43.45 && latitude <= 43.75 && longitude >= 1.25 && longitude <= 1.65) {
    return "toulouse";
  }

  return null;
}

export function guessListingCity(listing: ExtractedListing): string | null {
  const cityFromCoordinates = resolveCanonicalCityFromCoordinates(
    listing.latitude,
    listing.longitude
  );
  if (cityFromCoordinates) return cityFromCoordinates;
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
    "large",
    "greater",
    "grand",
    "cosy",
    "cozy",
    "moderno",
    "deluxe",
    "private",
    "rental",
    "hebergement",
    "hébergement",
    "room",
    "rooms",
    "stay",
    "living",
    "smart",
    "design",
  ]);

  const normalized = text
    .replace(/\bgrand\s+londres\b/g, "london")
    .replace(/\bgreater\s+london\b/g, "london")
    .replace(/\bmarrakesh\b/g, "marrakech")
    .replace(/\bmarraquexe\b/g, "marrakech")
    .replace(/\bmarraquex\b/g, "marrakech")
    .replace(/\bparis\b/g, "paris")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const modernAirbnbTitleCityStopwords = new Set([
    "apartment",
    "rental",
    "unit",
    "serviced",
    "logement",
    "entier",
    "city",
    "center",
    "centre",
    "beach",
    "home",
    "room",
  ]);
  const strictGenericGeoTokens = new Set([
    "large",
    "greater",
    "grand",
    "cosy",
    "cozy",
    "moderno",
    "deluxe",
    "private",
    "rental",
    "hebergement",
    "hébergement",
    "room",
    "rooms",
    "stay",
    "living",
    "smart",
    "design",
  ]);

  const explicitCompoundMatch = normalized.match(
    /\b(?:in|à|a|en|de|di|em)\s+(grand\s+londres|greater\s+london)\b/i
  );
  if (explicitCompoundMatch?.[1]) {
    return "london";
  }

  if (normalized.includes("grand londres")) {
    return "london";
  }

  if (normalized.includes("greater london")) {
    return "london";
  }

  if (String(listing.platform ?? "").toLowerCase() === "airbnb") {
    const modernAirbnbOriginal = normalizeTextParts(listing.locationLabel, listing.title);
    const modernAirbnbCleanSource = modernAirbnbOriginal
      .replace(/\bhttps?:\/\/\S+/gi, " ")
      .replace(/\bwww\.\S+/gi, " ")
      .replace(/\b\/rooms\/\S*/gi, " ")
      .replace(/[?&]\S*/g, " ")
      .trim();
    const modernAirbnbNormalized = modernAirbnbCleanSource
      .replace(/\bgrand\s+londres\b/g, "london")
      .replace(/\bgreater\s+london\b/g, "london")
      .replace(/\bmarrakesh\b/g, "marrakech")
      .replace(/\bmarraquexe\b/g, "marrakech")
      .replace(/\bmarraquex\b/g, "marrakech")
      .replace(/\bparis\b/g, "paris")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const modernAirbnbTitleCityMatch = modernAirbnbNormalized.match(
      /(?:^|\b)(?:logement\s+entier\s+a\s+)?(?:private\s+room|shared\s+room|hotel\s+room|boutique\s+hotel|rental\s+unit|serviced\s+apartment|casa\s+particular|entire\s+home|apartment|condo|loft|room|riad|villa|house)\s+in\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,2})/i
    );
    const modernAirbnbRawCity = modernAirbnbTitleCityMatch?.[1]?.trim() ?? null;
    if (modernAirbnbRawCity) {
      const canonicalModernAirbnbCity = canonicalizeMarketCity(modernAirbnbRawCity);
      const modernAirbnbTokenMatch = extractLocationTokens({
        ...listing,
        locationLabel: modernAirbnbRawCity,
        title: modernAirbnbRawCity,
      } as ExtractedListing).filter(
        (token) =>
          !NON_CITY_TOKENS.has(token) &&
          !brandingFallbackSkip.has(token) &&
          !strictGenericGeoTokens.has(token) &&
          !modernAirbnbTitleCityStopwords.has(token)
      );
      const modernAirbnbKnownCityMatch = modernAirbnbTokenMatch.find((token) =>
        [
          "barcelona",
          "london",
          "marrakech",
          "paris",
          "lille",
          "toulouse",
          "essaouira",
          "casablanca",
          "rabat",
          "taghazout",
          "imsouane",
          "chefchaouen",
          "ouarzazate",
          "tangier",
          "tanger",
        ].includes(token)
      );
      const extractedCity = canonicalModernAirbnbCity ?? modernAirbnbKnownCityMatch ?? null;
      if (extractedCity) {
        if (DEBUG_MARKET_PIPELINE) {
          console.log(
            "[market-resolution][airbnb-modern-title-city-clean]",
            JSON.stringify({
              original: modernAirbnbOriginal || null,
              cleaned: modernAirbnbCleanSource || null,
              extractedCity,
            })
          );
          console.log(
            "[market-resolution][airbnb-modern-title-city]",
            JSON.stringify({
              title: listing.title ?? null,
              extractedCity,
              pattern: "airbnb_modern_title_in_city",
            })
          );
        }
        return extractedCity;
      }
    }
  }

  const explicitMatch = normalized.match(
    /\b(?:in|à|a|en|de|di|em)\s+([a-z][a-z-]{2,})(?:\s*·|,|$)/i
  );
  if (
    explicitMatch?.[1] &&
    !NON_CITY_TOKENS.has(explicitMatch[1]) &&
    !brandingFallbackSkip.has(explicitMatch[1]) &&
    ![
      "large", "greater", "grand", "cosy", "cozy", "moderno", "deluxe",
      "private", "rental", "hebergement", "hébergement", "room", "rooms",
      "stay", "living", "smart", "design"
    ].includes(explicitMatch[1])
  ) {
    return explicitMatch[1];
  }

  const tokenMatch = extractLocationTokens({
    ...listing,
    locationLabel: normalized,
    title: normalized,
  } as ExtractedListing);

  const knownCityTokens = [
    "barcelona",
    "london",
    "marrakech",
    "paris",
    "lille",
    "toulouse",
    "essaouira",
    "casablanca",
    "rabat",
    "taghazout",
    "imsouane",
    "chefchaouen",
    "ouarzazate",
    "tangier",
    "tanger",
  ];

  const cleanedTokenMatch = tokenMatch.filter(
    (token) =>
      !NON_CITY_TOKENS.has(token) &&
      !brandingFallbackSkip.has(token) &&
      !strictGenericGeoTokens.has(token)
  );

  const knownCityMatch = cleanedTokenMatch.find((token) => knownCityTokens.includes(token));
  if (knownCityMatch) return knownCityMatch;

  return null;
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
  const sameBookingPlatform =
    String(target.platform ?? "").toLowerCase() === "booking" &&
    String(candidate.platform ?? "").toLowerCase() === "booking";

  if (targetType === "unknown" || candidateType === "unknown") return true;

  if (targetType !== "hotel_like" && candidateType === "hotel_like") {
    if (!((targetType === "apartment_like" || targetType === "studio_like") && hasAparthotelTypeSignal(candidate))) {
      return false;
    }
  }
  if (targetType !== "hotel_like" && targetType !== "room_like" && candidateType === "room_like") {
    if (!(targetType === "apartment_like" && hasAparthotelTypeSignal(candidate))) {
      return false;
    }
  }
  if (targetType === "hotel_like") {
    return candidateType === "hotel_like" || candidateType === "room_like";
  }
  if (targetType === "room_like") {
    return candidateType === "room_like" || candidateType === "hotel_like";
  }
  if (targetType === "studio_like") {
    if (candidateType === "studio_like") return true;
    if (candidateType === "apartment_like" && sameBookingPlatform) {
      return isBookingStudioApartmentPartialMatch(target, candidate);
    }

    const sameAirbnbPlatform =
      String(target.platform ?? "").toLowerCase() === "airbnb" &&
      String(candidate.platform ?? "").toLowerCase() === "airbnb";
    const title = String(candidate.title ?? "");
    const isClearlyLargeOrNonStudio =
      /family|sleeps\s*[4-9]|sleeps\s*[1-9][0-9]|villa|house|home|penthouse/i.test(title);
    const candidateBedrooms = safeNumber(candidate.bedrooms);
    const candidateCapacity = safeNumber(candidate.capacity);

    const isSmallStudioLikeApartment =
      sameAirbnbPlatform &&
      candidateType === "apartment_like" &&
      (candidateBedrooms == null || candidateBedrooms <= 1) &&
      (candidateCapacity == null || candidateCapacity <= 3) &&
      /studio|suite|apt|apartment/i.test(title) &&
      !isClearlyLargeOrNonStudio;

    if (isSmallStudioLikeApartment) {
      if (DEBUG_MARKET_PIPELINE) {
        console.log(
          "[market][airbnb-studio-apartment-bridge]",
          JSON.stringify({
            targetUrl: target.url ?? null,
            candidateUrl: candidate.url ?? null,
            title,
            candidateBedrooms,
            candidateCapacity,
            targetType,
            candidateType,
          })
        );
      }
      return true;
    }

    return false;
  }

  if (targetType === "apartment_like") {
    if (candidateType === "apartment_like") return true;
    if (candidateType === "studio_like" && sameBookingPlatform) {
      return isBookingStudioApartmentPartialMatch(target, candidate);
    }
    if (candidateType === "room_like" && hasAparthotelTypeSignal(candidate)) {
      return true;
    }
    return false;
  }

  if (targetType === "riad_like") {
    if (candidateType === "riad_like") return true;
    if (candidateType === "house_like") {
      if (hasHotelOrRoomTypeSignal(candidate)) return false;
      if (hasStrongBookingHotelSignals(candidate)) return false;
      const hasRiadCompat = /\briad\b|\bdar\b|\bmedina\b|\bmaison\s+traditionnelle\b|\bpalais\s+marocain\b/i.test(
        comparableTypeSignalText(candidate)
      );
      if (hasRiadCompat) {
        console.log("[market][riad-fallback-compatibility]", JSON.stringify({
          direction: "riad_like_target_accepts_house_like",
          candidateTitle: (candidate.title ?? "").slice(0, 80),
          candidateUrl: (candidate.url ?? "").slice(0, 120),
        }));
        return true;
      }
      return false;
    }
    return false;
  }
  if (targetType === "house_like" && candidateType === "riad_like") {
    if (hasHotelOrRoomTypeSignal(candidate)) return false;
    if (hasStrongBookingHotelSignals(candidate)) return false;
    console.log("[market][riad-fallback-compatibility]", JSON.stringify({
      direction: "house_like_target_accepts_riad_like",
      candidateTitle: (candidate.title ?? "").slice(0, 80),
      candidateUrl: (candidate.url ?? "").slice(0, 120),
    }));
    return true;
  }

  if (targetType === "villa_like" && candidateType === "house_like") {
    if (hasRiadOrDarTypeSignal(candidate)) return false;
    if (hasHotelOrRoomTypeSignal(candidate)) return false;
    if (hasStrongBookingHotelSignals(candidate)) return false;
    return hasVillaPremiumHouseSignals(candidate);
  }

  return targetType === candidateType;
}

function comparableTypeSignalText(listing: ExtractedListing): string {
  return normalizeTextParts(
    listing.propertyType,
    listing.title,
    listing.description,
    listing.url
  );
}

function hasRiadOrDarTypeSignal(listing: ExtractedListing): boolean {
  return /\briad\b|\bdar\b/.test(comparableTypeSignalText(listing));
}

function hasVillaTypeSignal(listing: ExtractedListing): boolean {
  return /\bvilla\b|\bprivate pool\b|\bpiscine\s+priv(?:e|ee|ée)\b/.test(
    comparableTypeSignalText(listing)
  );
}

function hasVillaPremiumHouseSignals(listing: ExtractedListing): boolean {
  const hay = comparableTypeSignalText(listing);
  return (
    /\bvilla\b/.test(hay) ||
    /\bprivate villa\b/.test(hay) ||
    /\bvilla\s+privee?\b/.test(hay) ||
    /\bprivate pool\b/.test(hay) ||
    /\bpiscine\s+priv(?:e|ee|ée)\b/.test(hay) ||
    /\bpool\b/.test(hay) ||
    /\bpiscine\b/.test(hay) ||
    /\bpalais\b/.test(hay) ||
    /\b\d+\s*bedrooms?\b/.test(hay) ||
    /\b\d+\s*bdr\b/.test(hay) ||
    /\bmaison\s+\d+\s*chambres?\b/.test(hay)
  );
}

function hasHotelOrRoomTypeSignal(listing: ExtractedListing): boolean {
  return (
    hasExplicitHotelSignal(listing) ||
    /\broom\b|\brooms\b|\bchambre\b|\bchambres\b|\bguest ?house\b|\bhostel\b|\bresort\b/.test(
      comparableTypeSignalText(listing)
    )
  );
}

function hasAparthotelTypeSignal(listing: ExtractedListing): boolean {
  return /\baparthotel\b|\bapartmenthotel\b|\bapartment\s+hotel\b|\bhotel\s+apartment\b|\bserviced\s+apartment\b|\bresidence\s+hoteliere\b|\brésidence\s+hôtelière\b|\bcondo\s+hotel\b/.test(
    comparableTypeSignalText(listing)
  );
}

/**
 * Signaux hôteliers forts : chaînes connues, all-inclusive, thalasso, beach resort.
 * Ces propriétés ne peuvent jamais être apartment_like ou villa_like.
 * Utilisé pour éviter les faux positifs dans la classification.
 */
function hasStrongBookingHotelSignals(listing: ExtractedListing): boolean {
  const hay = comparableTypeSignalText(listing);
  if (/\ball[- ]inclusive\b/i.test(hay)) return true;
  if (/\bthalasso\b|\bthalassa\b/i.test(hay)) return true;
  if (/\bbeach\s+resort\b|\bresort\s+beach\b/i.test(hay)) return true;
  if (/\bsofitel\b|\briu\b|\bfairmont\b|\bpullman\b|\bnovotel\b|\bhilton\b/i.test(hay)) return true;
  if (/\bmarriott\b|\bmovenpick\b|\bradisson\b|\bsheraton\b|\bhyatt\b|\bwyndham\b/i.test(hay)) return true;
  if (/\biberostar\b|\baccorhotels\b|\bbestwestern\b|\bbest\s+western\b/i.test(hay)) return true;
  if (/\bpalais\s+des\s+roses\b/i.test(hay)) return true;
  return false;
}

function smallUnitStructureSnapshot(listing: ExtractedListing): {
  bedrooms: number | null;
  capacity: number | null;
  hasSignal: boolean;
  eligible: boolean;
} {
  const bedrooms = safeNumber(listing.bedrooms ?? listing.bedroomCount);
  const capacity = safeNumber(listing.capacity ?? listing.guestCapacity);
  const hasSignal = bedrooms != null || capacity != null;
  const eligible =
    (bedrooms != null && bedrooms <= 1) ||
    (capacity != null && capacity <= 3);
  return { bedrooms, capacity, hasSignal, eligible };
}

function isBookingStudioApartmentPartialMatch(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  if (hasHotelOrRoomTypeSignal(candidate)) return false;
  if (hasVillaTypeSignal(candidate)) return false;
  if (hasRiadOrDarTypeSignal(candidate)) return false;

  const targetStructure = smallUnitStructureSnapshot(target);
  const candidateStructure = smallUnitStructureSnapshot(candidate);
  if (!targetStructure.hasSignal || !candidateStructure.hasSignal) return false;
  if (!targetStructure.eligible || !candidateStructure.eligible) return false;

  if (
    targetStructure.bedrooms != null &&
    candidateStructure.bedrooms != null &&
    Math.abs(targetStructure.bedrooms - candidateStructure.bedrooms) > 1
  ) {
    return false;
  }
  if (
    targetStructure.capacity != null &&
    candidateStructure.capacity != null &&
    Math.abs(targetStructure.capacity - candidateStructure.capacity) > 1
  ) {
    return false;
  }

  return true;
}

function hasExplicitHotelSignal(listing: ExtractedListing): boolean {
  // Known hotel brands / resort patterns are unconditional — no residential override applies.
  if (hasStrongBookingHotelSignals(listing)) return true;

  const primaryText = normalizeTextParts(listing.propertyType, listing.title);
  const hasHotelWord =
    /\bhotel\b|\bhôtel\b|\bhostel\b|\bresort\b|\bguest ?house\b|\binn\b/.test(primaryText);
  if (!hasHotelWord) return false;

  // Only truly private accommodation overrides a hotel word (villa, riad, dar, maison).
  // "résidence/residence" and "appart/apart" do NOT override — "Résidence Hôtelière" is hotel_like.
  const hasPrivateOverride =
    /\bvilla\b|\bmaison\b|\briad\b|\bdar\b/.test(primaryText);
  return !hasPrivateOverride;
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
  candidate: ExtractedListing,
  options?: {
    targetCanonicalCityOverride?: string | null;
    candidateCanonicalCityOverride?: string | null;
  }
): boolean {
  const guessedTargetCity = guessListingCity(target);
  const guessedCandidateCity = guessListingCity(candidate);
  const targetCanonicalCityOverride = normalizeCanonicalCityOverrideValue(
    options?.targetCanonicalCityOverride
  );
  const candidateCanonicalCityOverride = normalizeCanonicalCityOverrideValue(
    options?.candidateCanonicalCityOverride
  );
  const targetCity = targetCanonicalCityOverride ?? guessedTargetCity;
  const candidateCity = candidateCanonicalCityOverride ?? guessedCandidateCity;
  const targetNeighborhood = guessListingNeighborhood(target);
  const candidateNeighborhood = guessListingNeighborhood(candidate);
  const hasCanonicalOverridePair = Boolean(
    targetCanonicalCityOverride && candidateCanonicalCityOverride
  );

  const geoRadiusMatchKm = getDistanceKm(
    target.latitude,
    target.longitude,
    candidate.latitude,
    candidate.longitude
  );
  const geoRadiusCompatible =
    geoRadiusMatchKm !== null &&
    geoRadiusMatchKm <= 50;

  // GPS-first: when both target and candidate have coordinates, distance is the source of truth.
  // Text city/neighborhood guesses are only a fallback when coordinates are missing.
  if (geoRadiusMatchKm !== null) {
    return geoRadiusCompatible;
  }

  if (
    DEBUG_MARKET_PIPELINE &&
    (targetCanonicalCityOverride || candidateCanonicalCityOverride)
  ) {
    console.log(
      "[market-resolution][legacy-city-override-lookup]",
      JSON.stringify({
        targetUrl: target.url ?? null,
        candidateUrl: candidate.url ?? null,
        targetUrlKey: normalizeComparableUrlKey(target.url ?? null),
        candidateUrlKey: normalizeComparableUrlKey(candidate.url ?? null),
        guessedTargetCity,
        guessedCandidateCity,
        targetCanonicalCityOverride,
        candidateCanonicalCityOverride,
      })
    );
    console.log(
      "[market-resolution][legacy-city-source-used]",
      JSON.stringify({
        targetUrl: target.url ?? null,
        candidateUrl: candidate.url ?? null,
        targetCity,
        candidateCity,
        targetCitySource: targetCanonicalCityOverride ? "canonical_override" : "guessListingCity",
        candidateCitySource: candidateCanonicalCityOverride
          ? "canonical_override"
          : "guessListingCity",
      })
    );
  }

  if (hasCanonicalOverridePair) {
    if (targetCity && candidateCity && targetCity !== candidateCity && !geoRadiusCompatible) {
      return false;
    }
  } else if (targetCity && candidateCity && targetCity !== candidateCity) {
    if (geoRadiusCompatible) {
      if (DEBUG_MARKET_PIPELINE) {
        console.log(
          "[market-resolution][legacy-geo-radius-city-mismatch-bypass]",
          JSON.stringify({
            targetUrl: target.url ?? null,
            candidateUrl: candidate.url ?? null,
            targetCity,
            candidateCity,
            distanceKm: geoRadiusMatchKm,
            reason: "geo_radius_match",
          })
        );
      }
    } else {
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

function getLocationMismatchReason(args: {
  target: ExtractedListing;
  candidate: ExtractedListing;
  options?: EvaluateComparableCandidatesOptions;
  targetCanonicalCityOverride: string | null;
  candidateCanonicalCityOverride: string | null;
  targetCity: string | null;
  candidateCity: string | null;
  targetNeighborhood: string | null;
  candidateNeighborhood: string | null;
}): "city_mismatch" | "neighborhood_mismatch" | null {
  if (
    locationCompatible(args.target, args.candidate, {
      targetCanonicalCityOverride: args.targetCanonicalCityOverride,
      candidateCanonicalCityOverride: args.candidateCanonicalCityOverride,
    })
  ) {
    return null;
  }

  const matchingCanonicalOverride = hasMatchingCanonicalCityOverride(
    args.target,
    args.candidate,
    args.options
  );
  const pollutedCityTokens = new Set([
    "studio",
    "grand",
    "greater",
    "large",
    "cosy",
    "cozy",
    "rental",
    "logement",
    "hebergement",
    "hébergement",
    "moderno",
    "deluxe",
    "private",
    "room",
    "home",
  ]);
  const targetCityPolluted = args.targetCity ? pollutedCityTokens.has(args.targetCity) : false;
  const candidateCityPolluted = args.candidateCity
    ? pollutedCityTokens.has(args.candidateCity)
    : false;
  const allowBookingApartmentSameCityNeighborhoodBridge =
    matchingCanonicalOverride &&
    String(args.target.platform ?? "").toLowerCase() === "booking" &&
    String(args.candidate.platform ?? "").toLowerCase() === "booking" &&
    getNormalizedComparableType(args.target) === "apartment_like" &&
    getNormalizedComparableType(args.candidate) === "apartment_like";

  let reason: "city_mismatch" | "neighborhood_mismatch" | null = null;

  if (
    matchingCanonicalOverride &&
    args.targetNeighborhood &&
    args.candidateNeighborhood &&
    args.targetNeighborhood !== args.candidateNeighborhood &&
    !allowBookingApartmentSameCityNeighborhoodBridge
  ) {
    reason = "neighborhood_mismatch";
  } else if (matchingCanonicalOverride) {
    reason = null;
  } else if (
    args.targetCity &&
    args.candidateCity &&
    args.targetCity !== args.candidateCity &&
    !targetCityPolluted &&
    !candidateCityPolluted
  ) {
    reason = "city_mismatch";
  } else if (
    args.targetNeighborhood &&
    args.candidateNeighborhood &&
    args.targetNeighborhood !== args.candidateNeighborhood &&
    !allowBookingApartmentSameCityNeighborhoodBridge
  ) {
    reason = "neighborhood_mismatch";
  } else if (!targetCityPolluted && !candidateCityPolluted) {
    reason = "city_mismatch";
  }

  if (DEBUG_MARKET_PIPELINE) {
    console.log(
      "[market-resolution][legacy-city-reason-source]",
      JSON.stringify({
        candidateUrl: args.candidate.url ?? null,
        hasMatchingCanonicalOverride: matchingCanonicalOverride,
        targetCityFromGuess: guessListingCity(args.target),
        candidateCityFromGuess: guessListingCity(args.candidate),
        targetCanonicalCityOverride: args.targetCanonicalCityOverride,
        candidateCanonicalCityOverride: args.candidateCanonicalCityOverride,
        reasonPushed: reason,
      })
    );
  }

  return reason;
}

function getTypeMismatchReasons(args: {
  target: ExtractedListing;
  candidate: ExtractedListing;
  targetNormalizedType: string;
  candidateNormalizedType: string;
  targetTypeSignals: ComparableSegmentResult | null;
  candidateTypeSignals: ComparableSegmentResult | null;
  typeMatch: boolean;
}): string[] {
  const reasons: string[] = [];

  if (!hasBasicData(args.candidate) || isLowQualityCandidate(args.candidate)) {
    reasons.push("low_quality_candidate");
  }
  if (
    args.targetNormalizedType !== "hotel_like" &&
    hasExplicitHotelSignal(args.candidate)
  ) {
    reasons.push("hotel_vs_apartment_mismatch");
  }

  if (DEBUG_MARKET_PIPELINE) {
    console.log(
      "[market][type-compatibility]",
      JSON.stringify({
        stage: "evaluateComparableCandidates",
        targetUrl: args.target.url ?? null,
        candidateUrl: args.candidate.url ?? null,
        targetType: args.targetNormalizedType,
        candidateType: args.candidateNormalizedType,
        targetConfidence: args.targetTypeSignals?.confidence ?? null,
        candidateConfidence: args.candidateTypeSignals?.confidence ?? null,
        targetSignals: args.targetTypeSignals?.signals ?? [],
        candidateSignals: args.candidateTypeSignals?.signals ?? [],
        decision: args.typeMatch ? "accept" : "reject",
        reason: args.typeMatch ? "type_compatible" : "property_type_mismatch",
      })
    );
  }

  if (!args.typeMatch) {
    reasons.push("property_type_mismatch");
    if (
      args.targetNormalizedType !== "hotel_like" &&
      args.candidateNormalizedType === "hotel_like"
    ) {
      reasons.push("hotel_vs_apartment_mismatch");
    }
    if (DEBUG_MARKET_PIPELINE) {
      console.log(
        "[market][type-rejection]",
        JSON.stringify({
          stage: "evaluateComparableCandidates",
          targetUrl: args.target.url ?? null,
          candidateUrl: args.candidate.url ?? null,
          targetType: args.targetNormalizedType,
          candidateType: args.candidateNormalizedType,
          targetConfidence: args.targetTypeSignals?.confidence ?? null,
          candidateConfidence: args.candidateTypeSignals?.confidence ?? null,
          targetSignals: args.targetTypeSignals?.signals ?? [],
          candidateSignals: args.candidateTypeSignals?.signals ?? [],
          decision: "reject",
          reason: "property_type_mismatch",
        })
      );
    }
  }

  if (
    args.target.platform === "airbnb" &&
    args.candidateNormalizedType === "unknown" &&
    !args.typeMatch
  ) {
    reasons.push("low_quality_candidate");
  }

  return reasons;
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

function comparablePriceRatio(
  target: ExtractedListing,
  candidate: ExtractedListing
): number | null {
  const t = safeNumber(target.price);
  const c = safeNumber(candidate.price);

  if (t === null || c === null || t <= 0 || c <= 0) return null;

  return c / t;
}

type ComparablePriceSanityStatus =
  | "price_ok"
  | "price_missing"
  | "price_basis_unknown"
  | "price_ratio_outlier"
  | "studio_noise_price_outlier"
  | "price_scrubbed"
  | "price_ambiguous";

function isAirbnbStudioNoisePriceOutlier(args: {
  target: ExtractedListing;
  candidate: ExtractedListing;
  targetNormalizedType: string;
  ratio: number | null;
}): boolean {
  const { target, candidate, targetNormalizedType, ratio } = args;
  if (String(target.platform ?? "").toLowerCase() !== "airbnb") return false;
  if (String(candidate.platform ?? "").toLowerCase() !== "airbnb") return false;
  if (targetNormalizedType !== "studio_like") return false;
  const targetPrice = safeNumber(target.price);
  if (targetPrice == null || targetPrice <= 0 || targetPrice > 90) return false;
  if (ratio == null || ratio < 2.5) return false;
  const title = typeof candidate.title === "string" ? candidate.title : "";
  if (!title.trim()) return false;
  return /\b(jacuzzi|spa|sauna|love\s*room|romantic\s+night|luxury|villa|xxl)\b/i.test(title);
}

function classifyComparablePriceSanity(args: {
  target: ExtractedListing;
  candidate: ExtractedListing;
  ratio: number | null;
  priceCompatible: boolean;
  targetNormalizedType?: string;
}): ComparablePriceSanityStatus {
  const { candidate, ratio, priceCompatible, targetNormalizedType = "unknown" } = args;
  const candidatePrice = safeNumber(candidate.price);
  const candidateRawStayPrice = safeNumber(candidate.rawStayPrice);
  const candidateStayNights = safeNumber(candidate.stayNights);
  const candidatePriceBasis = candidate.priceBasis ?? null;
  const candidateCurrency =
    typeof candidate.currency === "string" && candidate.currency.trim().length > 0
      ? candidate.currency.trim()
      : null;
  const candidatePlatform = String(
    candidate.platform ?? candidate.sourcePlatform ?? ""
  ).toLowerCase();

  if (
    isAirbnbStudioNoisePriceOutlier({
      target: args.target,
      candidate,
      targetNormalizedType,
      ratio,
    })
  ) {
    return "studio_noise_price_outlier";
  }

  if (!priceCompatible && ratio !== null) return "price_ratio_outlier";

  if (candidatePrice === null || candidatePrice <= 0) {
    if (
      candidateRawStayPrice != null &&
      candidateRawStayPrice > 0 &&
      candidateCurrency === null
    ) {
      return "price_scrubbed";
    }
    return "price_missing";
  }

  if (
    candidatePlatform === "airbnb" &&
    (candidatePriceBasis == null || candidateCurrency == null)
  ) {
    return "price_ambiguous";
  }

  if (candidatePriceBasis === "unknown") {
    if (
      candidateRawStayPrice != null &&
      candidateRawStayPrice > 0 &&
      candidateStayNights != null &&
      candidateStayNights > 1
    ) {
      return "price_ambiguous";
    }
    return "price_basis_unknown";
  }

  return "price_ok";
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
  maxResults = 5,
  options?: ComparableEvaluationOptions
): ExtractedListing[] {
  const decisions = evaluateComparableCandidates(target, candidates, options);
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
 * Belt-and-suspenders : si le rawStayPrice de la cible Booking apartment_like Maroc est un entier
 * year-like (2020-2040), la cible a probablement été mal lue (bug "2026 €"). On relaxe le rejet
 * price_outlier pour éviter d'exclure des comparables réels. Fix 1 (bookingNumericPriceBandFilter)
 * devrait empêcher ce cas en amont ; cette garde s'active si le prix survit quand même.
 */
function shouldRelaxPriceOutlierForBookingApartmentYearDerived(args: {
  target: ExtractedListing;
  normalizedTargetCountry: string | null;
  targetNormalizedType: string;
  candidateNormalizedType: string;
}): boolean {
  const { target, normalizedTargetCountry, targetNormalizedType, candidateNormalizedType } = args;
  if (String(target.platform ?? "").toLowerCase() !== "booking") return false;
  if (normalizedTargetCountry !== "morocco") return false;
  if (targetNormalizedType !== "apartment_like") return false;
  if (candidateNormalizedType !== "apartment_like") return false;
  const rawStay =
    typeof target.rawStayPrice === "number" && Number.isFinite(target.rawStayPrice)
      ? target.rawStayPrice
      : null;
  if (rawStay == null) return false;
  return Number.isInteger(rawStay) && rawStay >= 2020 && rawStay <= 2040;
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
  if (hasRiadOrDarTypeSignal(candidate)) return false;
  if (hasHotelOrRoomTypeSignal(candidate)) return false;

  if (guessListingCountryFromText(candidate) !== "morocco") return false;

  if (reasons.includes("hotel_vs_apartment_mismatch")) return false;
  if (hasExplicitHotelSignal(candidate)) return false;

  const p = candidate.price;
  if (typeof p !== "number" || !Number.isFinite(p) || p < BOOKING_MOROCCO_VILLA_MIN_NIGHT_PRICE) {
    return false;
  }

  if (!priceCompatible(target, candidate)) return false;
  if (!locationCompatible(target, candidate)) return false;
  if (!bedroomsCompatible(target, candidate) && !capacityCompatible(target, candidate)) {
    return false;
  }

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
  const targetTypeSignals = DEBUG_MARKET_PIPELINE
    ? classifyComparableSegment({
        propertyType: target.propertyType ?? null,
        title: target.title ?? null,
        description: target.description ?? null,
        url: target.url ?? null,
        platform: target.platform ?? null,
      })
    : null;
  const targetCanonicalCityOverride = normalizeCanonicalCityOverrideValue(
    options?.targetCanonicalCityOverride
  );
  const targetCity = targetCanonicalCityOverride ?? guessListingCity(target);
  const targetNeighborhood = guessListingNeighborhood(target);
  const targetLanguageGuess = guessListingLanguage(target);

  return candidates
    .filter((candidate) => candidate.url !== target.url)
    .map((candidate) => {
      const reasons: string[] = [];
      const legacyType = getNormalizedComparableType(candidate);
      const candidateNormalizedType = legacyType;
      const candidateTypeSignals = DEBUG_MARKET_PIPELINE
        ? classifyComparableSegment({
            propertyType: candidate.propertyType ?? null,
            title: candidate.title ?? null,
            description: candidate.description ?? null,
            url: candidate.url ?? null,
            platform: candidate.platform ?? null,
          })
        : null;
      const candidateCanonicalCityOverride = lookupCanonicalCityOverride(candidate, options);
      const candidateCity = candidateCanonicalCityOverride ?? guessListingCity(candidate);
      const candidateNeighborhood = guessListingNeighborhood(candidate);
      const candidateLanguageGuess = guessListingLanguage(candidate);

      if (DEBUG_MARKET_PIPELINE) {
        if (candidateTypeSignals && legacyType !== candidateTypeSignals.segment) {
          console.log(
            "[segment][diff]",
            JSON.stringify({
              title: candidate.title ?? null,
              legacyType,
              newSegment: candidateTypeSignals.segment,
              confidence: candidateTypeSignals.confidence,
              signals: candidateTypeSignals.signals,
            })
          );
        }
      }

      const typeMatch = typeCompatible(target, candidate);
      reasons.push(
        ...getTypeMismatchReasons({
          target,
          candidate,
          targetNormalizedType,
          candidateNormalizedType,
          targetTypeSignals,
          candidateTypeSignals,
          typeMatch,
        })
      );

      // Non-gated: log ambiguous cases where an "unknown" type candidate passes type compat
      // but carries hotel/resort signals — helps spot misclassified hotel residences.
      if (
        candidateNormalizedType === "unknown" &&
        targetNormalizedType === "apartment_like" &&
        String(candidate.platform ?? "").toLowerCase() === "booking"
      ) {
        const hay = normalizeTextParts(
          candidate.propertyType,
          candidate.title,
          candidate.url
        );
        const hotelSignals: string[] = [];
        if (/\bhotel\b|\bhôtel\b|\bhostel\b|\bresort\b/.test(hay)) hotelSignals.push("hotel_word");
        if (/\ball[- ]inclusive\b/i.test(hay)) hotelSignals.push("all_inclusive");
        if (/\bthalasso\b|\bthalassa\b/i.test(hay)) hotelSignals.push("thalasso");
        if (/\bsofitel\b|\briu\b|\bfairmont\b|\bhilton\b|\bmarriott\b/i.test(hay))
          hotelSignals.push("known_brand");
        if (/\bpalais\s+des\s+roses\b/i.test(hay)) hotelSignals.push("palais_des_roses");
        if (hotelSignals.length > 0) {
          const u = (candidate.url ?? "").trim();
          console.log(
            "[booking][apartment-hotel-ambiguity]",
            JSON.stringify({
              url: u.length > 200 ? `${u.slice(0, 197)}...` : u,
              title: (candidate.title ?? "").slice(0, 100),
              propertyType: candidate.propertyType ?? null,
              detectedSignals: hotelSignals,
              normalizedCandidateType: candidateNormalizedType,
              decision: reasons.length === 0 ? "accepted_ambiguous" : "rejected",
              currentReasons: [...reasons],
            })
          );
        }
      }
      const capacityOk = capacityCompatible(target, candidate);
      const bedroomsOk = bedroomsCompatible(target, candidate);
      const bathroomsOk = bathroomsCompatible(target, candidate);
      if (!capacityOk || !bedroomsOk || !bathroomsOk) {
        reasons.push("structure_too_far");
      }
      const locationMismatchReason = getLocationMismatchReason({
        target,
        candidate,
        options,
        targetCanonicalCityOverride,
        candidateCanonicalCityOverride,
        targetCity,
        candidateCity,
        targetNeighborhood,
        candidateNeighborhood,
      });
      if (locationMismatchReason) reasons.push(locationMismatchReason);
      if (!languageCompatible(target, candidate)) reasons.push("language_incoherent");

      const ratio = comparablePriceRatio(target, candidate);
      const basePriceCompatible = priceCompatible(target, candidate);
      const studioNoisePriceOutlier = isAirbnbStudioNoisePriceOutlier({
        target,
        candidate,
        targetNormalizedType,
        ratio,
      });
      const currentPriceCompatible = basePriceCompatible && !studioNoisePriceOutlier;

      if (
        reasons.includes("language_incoherent") &&
        isAirbnbMarrakechLocalAcceptanceGuardEligible({
          target,
          candidate,
          normalizedTargetCountry,
          targetCity,
          candidateCity,
          candidateNormalizedType,
        })
      ) {
        const removableReasons = new Set([
          "language_incoherent",
          "city_mismatch",
        ]);

        const removedReasons = reasons.filter((reason) =>
          removableReasons.has(reason)
        );
        const finalReasons = reasons.filter(
          (reason) => !removableReasons.has(reason)
        );
        if (DEBUG_MARKET_PIPELINE) {
          console.log(
            "[market][airbnb-marrakech-local-acceptance-guard]",
            JSON.stringify({
              targetCity,
              targetCountry: normalizedTargetCountry,
              candidateTitle: candidate.title ?? null,
              candidateCity,
              candidateType: candidateNormalizedType,
              price:
                typeof candidate.price === "number" && Number.isFinite(candidate.price)
                  ? candidate.price
                  : null,
              removedReasons,
              finalReasons,
            })
          );
        }
        reasons.splice(
          0,
          reasons.length,
          ...finalReasons
        );
      }
      if (
        reasons.includes("language_incoherent") &&
        String(target.platform ?? "").toLowerCase() === "airbnb" &&
        String(candidate.platform ?? "").toLowerCase() === "airbnb" &&
        typeMatch &&
        currentPriceCompatible !== false &&
        !reasons.includes("city_mismatch") &&
        !reasons.includes("property_type_mismatch") &&
        !reasons.includes("structure_too_far")
      ) {
        const removedReasons = reasons.filter((reason) => reason === "language_incoherent");
        const finalReasons = reasons.filter((reason) => reason !== "language_incoherent");
        if (DEBUG_MARKET_PIPELINE) {
          console.log(
            "[market][airbnb-language-incoherent-softened]",
            JSON.stringify({
              targetCity,
              candidateCity,
              candidateTitle: candidate.title ?? null,
              candidateType: candidateNormalizedType,
              removedReasons,
              finalReasons,
            })
          );
        }
        reasons.splice(0, reasons.length, ...finalReasons);
      }

      if (
        reasons.includes("structure_too_far") &&
        String(target.platform ?? "").toLowerCase() === "airbnb" &&
        String(candidate.platform ?? "").toLowerCase() === "airbnb" &&
        typeMatch &&
        currentPriceCompatible !== false &&
        !reasons.includes("city_mismatch") &&
        !reasons.includes("neighborhood_mismatch") &&
        !reasons.includes("property_type_mismatch") &&
        !reasons.includes("hotel_vs_apartment_mismatch") &&
        (targetNormalizedType === "apartment_like" || targetNormalizedType === "studio_like") &&
        candidateNormalizedType === targetNormalizedType
      ) {
        const removedReasons = reasons.filter((reason) => reason === "structure_too_far");
        const finalReasons = reasons.filter((reason) => reason !== "structure_too_far");
        if (DEBUG_MARKET_PIPELINE) {
          console.log(
            "[market][airbnb-structure-softened-for-pricing]",
            JSON.stringify({
              targetCity,
              candidateCity,
              targetType: targetNormalizedType,
              candidateType: candidateNormalizedType,
              candidateTitle: candidate.title ?? null,
              price:
                typeof candidate.price === "number" && Number.isFinite(candidate.price)
                  ? candidate.price
                  : null,
              removedReasons,
              finalReasons,
            })
          );
        }
        reasons.splice(0, reasons.length, ...finalReasons);
      }
      if (
        reasons.includes("property_type_mismatch") &&
        String(target.platform ?? "").toLowerCase() === "airbnb" &&
        String(candidate.platform ?? "").toLowerCase() === "airbnb" &&
        currentPriceCompatible !== false &&
        typeof candidate.price === "number" &&
        Number.isFinite(candidate.price) &&
        candidate.price > 0 &&
        !reasons.includes("city_mismatch") &&
        !reasons.includes("neighborhood_mismatch") &&
        !reasons.includes("hotel_vs_apartment_mismatch") &&
        (targetNormalizedType === "apartment_like" || targetNormalizedType === "studio_like") &&
        (candidateNormalizedType === "apartment_like" || candidateNormalizedType === "studio_like")
      ) {
        const removedReasons = reasons.filter((reason) => reason === "property_type_mismatch");
        const finalReasons = reasons.filter((reason) => reason !== "property_type_mismatch");
        if (DEBUG_MARKET_PIPELINE) {
          console.log(
            "[market][airbnb-apartment-studio-type-softened-for-pricing]",
            JSON.stringify({
              targetCity,
              candidateCity,
              targetType: targetNormalizedType,
              candidateType: candidateNormalizedType,
              candidateTitle: candidate.title ?? null,
              price:
                typeof candidate.price === "number" && Number.isFinite(candidate.price)
                  ? candidate.price
                  : null,
              removedReasons,
              finalReasons,
            })
          );
        }
        reasons.splice(0, reasons.length, ...finalReasons);
      }

      const priceSanityStatus = classifyComparablePriceSanity({
        target,
        candidate,
        ratio,
        priceCompatible: currentPriceCompatible,
        targetNormalizedType,
      });
      if (DEBUG_MARKET_PIPELINE) {
        console.log(
          "[market][price-sanity-input]",
          JSON.stringify({
            targetUrl: target.url ?? null,
            candidateUrl: candidate.url ?? null,
            targetType: targetNormalizedType,
            candidateType: candidateNormalizedType,
            targetPrice:
              typeof target.price === "number" && Number.isFinite(target.price)
                ? target.price
                : null,
            candidatePrice:
              typeof candidate.price === "number" && Number.isFinite(candidate.price)
                ? candidate.price
                : null,
            targetCurrency: target.currency ?? null,
            candidateCurrency: candidate.currency ?? null,
            targetPriceBasis: target.priceBasis ?? null,
            candidatePriceBasis: candidate.priceBasis ?? null,
            targetStayNights: target.stayNights ?? null,
            candidateStayNights: candidate.stayNights ?? null,
            targetRawStayPrice: target.rawStayPrice ?? null,
            candidateRawStayPrice: candidate.rawStayPrice ?? null,
            ratio,
            status: priceSanityStatus,
          })
        );
      }
      if (!currentPriceCompatible) {
        const previousReasonsBeforeOutlier = [...reasons];
        const relaxLowTargetPriceOutlier =
          shouldRelaxPriceOutlierForBookingMoroccoVillaLowTarget({
            target,
            candidate,
            normalizedTargetCountry,
            targetNormalizedType,
            candidateNormalizedType,
          }) ||
          shouldRelaxPriceOutlierForBookingApartmentYearDerived({
            target,
            normalizedTargetCountry,
            targetNormalizedType,
            candidateNormalizedType,
          });
        if (!relaxLowTargetPriceOutlier) {
          reasons.push("price_outlier");
          if (DEBUG_MARKET_PIPELINE && studioNoisePriceOutlier) {
            console.log(
              "[market][studio-price-sanity-tightened]",
              JSON.stringify({
                targetType: targetNormalizedType,
                targetPrice: safeNumber(target.price),
                candidateTitle: candidate.title ?? null,
                candidatePrice: safeNumber(candidate.price),
                ratio,
                reasons: [...reasons],
                decision: "reject",
                reason: "studio_noise_price_outlier",
              })
            );
          }
          if (DEBUG_MARKET_PIPELINE) {
            console.log(
              "[market][price-sanity-decision]",
              JSON.stringify({
                decision: "reject",
                reason: studioNoisePriceOutlier ? "studio_noise_price_outlier" : "price_outlier",
                ratio,
                priceCompatible: currentPriceCompatible,
                status: priceSanityStatus,
                existingReason:
                  previousReasonsBeforeOutlier.length > 0 ? previousReasonsBeforeOutlier : null,
              })
            );
          }
          if (DEBUG_MARKET_PIPELINE) {
            const tPrice = safeNumber(target.price);
            const cPrice = safeNumber(candidate.price);
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
          console.log(
            "[market][price-sanity-decision]",
              JSON.stringify({
                decision: "accept",
                reason: "booking_morocco_villa_low_target_price_soft_keep",
                ratio,
                priceCompatible: currentPriceCompatible,
                status: priceSanityStatus,
                existingReason:
                  previousReasonsBeforeOutlier.length > 0 ? previousReasonsBeforeOutlier : null,
              })
            );
          }
      } else if (DEBUG_MARKET_PIPELINE) {
        let reason = "ratio_within_bounds";
        if (ratio === null) {
          reason = "missing_or_non_positive_price";
        }
        console.log(
          "[market][price-sanity-decision]",
          JSON.stringify({
            decision: "accept",
            reason,
            ratio,
            priceCompatible: currentPriceCompatible,
            status: priceSanityStatus,
            existingReason: reasons.length > 0 ? reasons : null,
          })
        );
      }

      const missingPrice =
        typeof candidate.price !== "number" ||
        !Number.isFinite(candidate.price) ||
        candidate.price <= 0;

      const previousReasons = [...reasons];

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

type PremiumVillaPostFilterMeta = {
  targetPrice: number;
  minAllowedPrice: number;
  beforeAccepted: number;
  stagedAccepted: number;
  droppedCount: number;
  droppedPriceRange: [number, number] | null;
  reason: string;
};

export type PremiumVillaPostFilterResult = {
  decisions: ReturnType<typeof evaluateComparableCandidates>;
  premiumVillaFilterIgnoredBecauseTooFew: boolean;
  metadata: PremiumVillaPostFilterMeta | null;
};

/** Post‑traitement après `evaluateComparableCandidates` + weak override Booking : villas premium uniquement. */
export function applyPremiumVillaComparablePostFilter(
  target: ExtractedListing,
  decisions: ReturnType<typeof evaluateComparableCandidates>
): PremiumVillaPostFilterResult {
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

  // Always-on diagnostic: fires regardless of DEBUG_MARKET_PIPELINE
  const targetNormTypeForDiag = getNormalizedComparableType(target);
  const targetPlatformForDiag = String(target.platform ?? "").toLowerCase();
  if (targetNormTypeForDiag === "villa_like" && (targetPlatformForDiag === "booking" || targetPlatformForDiag === "airbnb")) {
    const rawStayPriceForDiag = typeof (target as Record<string, unknown>).rawStayPrice === "number"
      ? (target as Record<string, unknown>).rawStayPrice
      : null;
    const stayNightsForDiag = typeof (target as Record<string, unknown>).stayNights === "number"
      ? (target as Record<string, unknown>).stayNights
      : null;
    const acceptedCandidatePrices = decisions
      .filter((d) => d.accepted)
      .map((d) => (typeof d.candidate.price === "number" && Number.isFinite(d.candidate.price) && d.candidate.price > 0 ? d.candidate.price : null));
    console.log("[market][premium-villa-filter-debug]", JSON.stringify({
      phase: "entry",
      targetType: targetNormTypeForDiag,
      platform: targetPlatformForDiag,
      targetPrice,
      rawTargetPrice: typeof target.price === "number" ? target.price : null,
      rawStayPrice: rawStayPriceForDiag,
      stayNights: stayNightsForDiag,
      eligible,
      reason,
      beforeAccepted,
      acceptedCandidatePrices,
    }));
  }

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
    return { decisions, premiumVillaFilterIgnoredBecauseTooFew: false, metadata: null };
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

  const droppedPrices = droppedRows.map((r) => r.price).filter((p): p is number => p !== null);
  const droppedPriceRange: [number, number] | null =
    droppedPrices.length > 0
      ? [Math.min(...droppedPrices), Math.max(...droppedPrices)]
      : null;

  // Always-on diagnostic: outcome after applying the filter
  console.log("[market][premium-villa-filter-debug]", JSON.stringify({
    phase: "post_filter",
    targetPrice,
    minAllowedPrice,
    beforeAccepted,
    stagedAccepted,
    droppedCount: droppedRows.length,
    droppedPriceRange,
    filterRemovedSomething,
    ignoredBecauseTooFew,
  }));

  return {
    decisions: out,
    premiumVillaFilterIgnoredBecauseTooFew: ignoredBecauseTooFew,
    metadata: ignoredBecauseTooFew
      ? {
          targetPrice,
          minAllowedPrice,
          beforeAccepted,
          stagedAccepted,
          droppedCount: droppedRows.length,
          droppedPriceRange,
          reason: "premium_villa_filter_reverted_sample_below_3",
        }
      : null,
  };
}

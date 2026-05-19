import type { ExtractedListing } from "@/lib/extractors/types";
import { getNormalizedComparableType, guessListingCity } from "./filterComparableListings";

const DEBUG_MARKET_PIPELINE = process.env.DEBUG_MARKET_PIPELINE === "true";

export type NormalizedMarketEntity = {
  rawCity: string | null;
  canonicalCity: string | null;
  displayCity: string | null;
  rawCountry: string | null;
  canonicalCountry: string | null;
  rawPropertyType: string | null;
  normalizedComparableType: string;
  nightlyPrice: number | null;
  rawStayPrice: number | null;
  priceBasis: "nightly" | "total" | "unknown";
  signalsUsed: string[];
  fieldPrecedence: string[];
};

const CANONICAL_CITY_ALIASES: Record<string, string> = {
  // Morocco
  fes: "fes",
  fez: "fes",
  fès: "fes",
  rabat: "rabat",
  marrakech: "marrakech",
  marrakesh: "marrakech",
  marraquexe: "marrakech",
  marraquex: "marrakech",
  tangier: "tangier",
  tanger: "tangier",
  "sidi bouzid": "sidi bouzid",
  casablanca: "casablanca",
  agadir: "agadir",
  essaouira: "essaouira",
  taghazout: "taghazout",
  imsouane: "imsouane",

  // Europe — high-frequency multilingual aliases
  lisbon: "lisbon",
  lisbonne: "lisbon",
  lisboa: "lisbon",
  paris: "paris",
  barcelona: "barcelona",
  barcelone: "barcelona",
  barcelon: "barcelona",
  madrid: "madrid",
  rome: "rome",
  roma: "rome",
  milan: "milan",
  milano: "milan",
  munich: "munich",
  munchen: "munich",
  münchen: "munich",
  seville: "seville",
  sevilla: "seville",
  séville: "seville",
  valencia: "valencia",
  valence: "valencia",
  porto: "porto",
  oporto: "porto",
  london: "london",
  londres: "london",
  brussels: "brussels",
  bruxelles: "brussels",
  brussel: "brussels",
  amsterdam: "amsterdam",
  berlin: "berlin",
  athens: "athens",
  athenes: "athens",
  athènes: "athens",
  vienna: "vienna",
  vienne: "vienna",
  prague: "prague",
};

const CANONICAL_COUNTRY_ALIASES: Record<string, string> = {
  morocco: "ma",
  maroc: "ma",
  marocco: "ma",
  ma: "ma",

  france: "fr",
  fr: "fr",

  spain: "es",
  espagne: "es",
  espana: "es",
  españa: "es",
  es: "es",

  portugal: "pt",
  pt: "pt",

  italy: "it",
  italie: "it",
  italia: "it",
  it: "it",

  germany: "de",
  allemagne: "de",
  deutschland: "de",
  de: "de",

  belgium: "be",
  belgique: "be",
  belgie: "be",
  belgië: "be",
  be: "be",

  "united kingdom": "gb",
  "royaume uni": "gb",
  uk: "gb",
  gb: "gb",

  "united states": "us",
  "united states of america": "us",
  usa: "us",
  "etats unis": "us",
  "états unis": "us",
  us: "us",
};

function normalizeToken(value: string | null | undefined) {
  if (!value) return null;
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const KNOWN_CITY_VARIANTS: Array<{
  canonical: string;
  variants: string[];
}> = [
  { canonical: "fes", variants: ["fes", "fez", "fès"] },
  { canonical: "rabat", variants: ["rabat"] },
  { canonical: "marrakech", variants: ["marrakech", "marrakesh"] },
  { canonical: "tangier", variants: ["tangier", "tanger"] },
  { canonical: "sidi bouzid", variants: ["sidi bouzid"] },
  { canonical: "casablanca", variants: ["casablanca"] },
  { canonical: "agadir", variants: ["agadir"] },
  { canonical: "essaouira", variants: ["essaouira"] },
  { canonical: "lisbon", variants: ["lisbon", "lisbonne", "lisboa"] },
];

function containsWholeWord(haystack: string, needle: string) {
  const escaped = needle.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(haystack);
}

function extractKnownCityFromText(text: string | null | undefined): string | null {
  const normalized = normalizeToken(text);
  if (!normalized) return null;
  for (const entry of KNOWN_CITY_VARIANTS) {
    for (const variant of entry.variants) {
      if (containsWholeWord(normalized, normalizeToken(variant) ?? variant)) {
        return entry.canonical;
      }
    }
  }
  return null;
}

function readDirectLocationCity(listing: ExtractedListing): string | null {
  const location = (listing as ExtractedListing & {
    location?: { city?: string | null } | null;
  }).location;
  const city = location?.city;
  return typeof city === "string" && city.trim().length > 0 ? city.trim() : null;
}

function resolveAirbnbMoroccoNeighborhoodCitySuppression(
  listing: ExtractedListing,
  guessedCity: string | null
): { replacementCity: string | null; replacementSource: string | null } | null {
  if (String(listing.platform ?? "").toLowerCase() !== "airbnb") return null;
  if (normalizeToken(guessedCity) !== "ocean") return null;

  const locationCity = readDirectLocationCity(listing);
  const listingLocationLabel =
    typeof listing.locationLabel === "string" ? listing.locationLabel : null;
  const structureLocationLabel =
    typeof listing.structure?.locationLabel === "string" ? listing.structure.locationLabel : null;
  const locationDetailsText = Array.isArray(listing.locationDetails)
    ? listing.locationDetails.filter((value): value is string => typeof value === "string").join(" | ")
    : null;
  const descriptionText =
    typeof listing.description === "string" ? listing.description : null;
  const titleText = typeof listing.title === "string" ? listing.title : null;
  const rawCountryValue = (listing as Record<string, unknown>).country;
  const rawCountry = typeof rawCountryValue === "string" ? rawCountryValue : null;

  const sourceCandidates: Array<{ source: string; text: string | null }> = [
    { source: "locationLabel", text: listingLocationLabel },
    { source: "structureLocationLabel", text: structureLocationLabel },
    { source: "rawLocation", text: [locationCity, listingLocationLabel, structureLocationLabel].filter(Boolean).join(" | ") || null },
    { source: "description", text: descriptionText },
    { source: "title", text: titleText },
    { source: "locationDetails", text: locationDetailsText },
  ];

  let replacementCity: string | null = null;
  let replacementSource: string | null = null;
  for (const candidate of sourceCandidates) {
    const city = extractKnownCityFromText(candidate.text);
    if (city) {
      replacementCity = city;
      replacementSource = candidate.source;
      break;
    }
  }

  const probableMorocco =
    canonicalizeMarketCountry(rawCountry) === "ma" ||
    /(?:\bmorocco\b|\bmaroc\b)/i.test(
      [listingLocationLabel, structureLocationLabel, locationDetailsText, descriptionText, titleText, listing.url ?? ""]
        .filter(Boolean)
        .join(" | ")
    ) ||
    replacementCity !== null;

  if (!probableMorocco) return null;

  if (DEBUG_MARKET_PIPELINE) {
    console.log(
      "[market][airbnb-morocco-neighborhood-city-suppressed]",
      JSON.stringify({
        targetUrl: listing.url ?? null,
        suppressedCity: guessedCity,
        replacementCity,
        replacementSource,
        title: titleText ?? null,
        locationLabel: listingLocationLabel ?? null,
        structureLocationLabel: structureLocationLabel ?? null,
        descriptionSnippet:
          typeof descriptionText === "string" && descriptionText.trim().length > 0
            ? descriptionText.slice(0, 240)
            : null,
      })
    );
  }

  return { replacementCity, replacementSource };
}

function resolveMarketCitySignal(listing: ExtractedListing): {
  city: string | null;
  signal: string;
} {
  const locationCity = readDirectLocationCity(listing);
  const directLocationCity = extractKnownCityFromText(locationCity);
  if (directLocationCity) {
    return { city: directLocationCity, signal: "known_city_from_location_city" };
  }

  const listingLocationLabel =
    typeof listing.locationLabel === "string" ? listing.locationLabel : null;
  const directListingLocationLabelCity = extractKnownCityFromText(listingLocationLabel);
  if (directListingLocationLabelCity) {
    return {
      city: directListingLocationLabelCity,
      signal: "known_city_from_listing_location_label",
    };
  }

  const structureLocationLabel =
    typeof listing.structure?.locationLabel === "string" ? listing.structure.locationLabel : null;
  const directStructureLocationLabelCity = extractKnownCityFromText(structureLocationLabel);
  if (directStructureLocationLabelCity) {
    return {
      city: directStructureLocationLabelCity,
      signal: "known_city_from_structure_location_label",
    };
  }

  const broadKnownCity = extractKnownCityFromText(
    [locationCity, listingLocationLabel, structureLocationLabel, listing.title ?? "", listing.url ?? ""]
      .filter(Boolean)
      .join(" | ")
  );
  if (broadKnownCity) {
    return { city: broadKnownCity, signal: "known_city_from_listing_text" };
  }

  const guessedCity = guessListingCity(listing);
  const airbnbMoroccoSuppression = resolveAirbnbMoroccoNeighborhoodCitySuppression(
    listing,
    guessedCity
  );
  if (airbnbMoroccoSuppression) {
    return {
      city: airbnbMoroccoSuppression.replacementCity,
      signal: airbnbMoroccoSuppression.replacementCity
        ? `airbnb_morocco_neighborhood_city_suppressed:${airbnbMoroccoSuppression.replacementSource ?? "fallback"}`
        : "airbnb_morocco_neighborhood_city_suppressed:null",
    };
  }
  return {
    city: guessedCity ?? null,
    signal: guessedCity ? "guessListingCity_fallback" : "no_city_signal",
  };
}

export function canonicalizeMarketCity(city: string | null | undefined) {
  const token = normalizeToken(city);
  if (!token) return null;
  return CANONICAL_CITY_ALIASES[token] ?? token;
}

export function canonicalizeMarketCountry(country: string | null | undefined) {
  const token = normalizeToken(country);
  if (!token) return null;
  return CANONICAL_COUNTRY_ALIASES[token] ?? token;
}

export function resolveComparableType(listing: ExtractedListing) {
  return getNormalizedComparableType(listing);
}

export function resolveNightlyPriceView(
  listing: ExtractedListing
): Pick<NormalizedMarketEntity, "nightlyPrice" | "rawStayPrice" | "priceBasis"> {
  const nightlyPrice = typeof listing.price === "number" && Number.isFinite(listing.price) ? listing.price : null;
  const totalPrice = (listing as Record<string, unknown>).totalPrice;
  const rawStayPrice = typeof totalPrice === "number" && Number.isFinite(totalPrice) ? totalPrice : null;
  const priceBasis: NormalizedMarketEntity["priceBasis"] =
    nightlyPrice != null ? "nightly" : rawStayPrice != null ? "total" : "unknown";
  return { nightlyPrice, rawStayPrice, priceBasis };
}

export function normalizeMarketEntity(listing: ExtractedListing): NormalizedMarketEntity {
  const citySignal = resolveMarketCitySignal(listing);
  const rawCity = citySignal.city ?? null;
  const rawCountryValue = (listing as Record<string, unknown>).country;
  const rawCountry = typeof rawCountryValue === "string" ? rawCountryValue : null;
  const nightly = resolveNightlyPriceView(listing);

  return {
    rawCity,
    canonicalCity: canonicalizeMarketCity(rawCity),
    displayCity: rawCity,
    rawCountry,
    canonicalCountry: canonicalizeMarketCountry(rawCountry),
    rawPropertyType: typeof listing.propertyType === "string" ? listing.propertyType : null,
    normalizedComparableType: resolveComparableType(listing),
    nightlyPrice: nightly.nightlyPrice,
    rawStayPrice: nightly.rawStayPrice,
    priceBasis: nightly.priceBasis,
    signalsUsed: [citySignal.signal, "getNormalizedComparableType", "listing.price"],
    fieldPrecedence: ["location.city", "locationLabel", "structure.locationLabel", "title", "url"],
  };
}

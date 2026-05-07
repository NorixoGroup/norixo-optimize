import type { ExtractedListing } from "@/lib/extractors/types";
import { getNormalizedComparableType, guessListingCity } from "./filterComparableListings";

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

const CITY_ALIASES: Record<string, string> = {
  fes: "fes",
  fez: "fes",
  fès: "fes",
  marrakech: "marrakech",
  marrakesh: "marrakech",
  tangier: "tangier",
  tanger: "tangier",
  "sidi bouzid": "sidi bouzid",
  casablanca: "casablanca",
  agadir: "agadir",
  essaouira: "essaouira",
};

const COUNTRY_ALIASES: Record<string, string> = {
  morocco: "ma",
  maroc: "ma",
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
  { canonical: "marrakech", variants: ["marrakech", "marrakesh"] },
  { canonical: "tangier", variants: ["tangier", "tanger"] },
  { canonical: "sidi bouzid", variants: ["sidi bouzid"] },
  { canonical: "casablanca", variants: ["casablanca"] },
  { canonical: "agadir", variants: ["agadir"] },
  { canonical: "essaouira", variants: ["essaouira"] },
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
  return {
    city: guessedCity ?? null,
    signal: guessedCity ? "guessListingCity_fallback" : "no_city_signal",
  };
}

export function canonicalizeMarketCity(city: string | null | undefined) {
  const token = normalizeToken(city);
  if (!token) return null;
  return CITY_ALIASES[token] ?? token;
}

export function canonicalizeMarketCountry(country: string | null | undefined) {
  const token = normalizeToken(country);
  if (!token) return null;
  return COUNTRY_ALIASES[token] ?? token;
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

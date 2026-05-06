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
  fez: "fes",
  fès: "fes",
  marrakesh: "marrakech",
};

const COUNTRY_ALIASES: Record<string, string> = {
  morocco: "ma",
  maroc: "ma",
};

function normalizeToken(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().toLowerCase();
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

export function resolveNightlyPriceView(listing: ExtractedListing) {
  const nightlyPrice = typeof listing.price === "number" && Number.isFinite(listing.price) ? listing.price : null;
  const totalPrice = (listing as Record<string, unknown>).totalPrice;
  const rawStayPrice = typeof totalPrice === "number" && Number.isFinite(totalPrice) ? totalPrice : null;
  const priceBasis = nightlyPrice != null ? "nightly" : rawStayPrice != null ? "total" : "unknown";
  return { nightlyPrice, rawStayPrice, priceBasis };
}

export function normalizeMarketEntity(listing: ExtractedListing): NormalizedMarketEntity {
  const guessedCity = guessListingCity(listing);
  const rawCity = guessedCity ?? null;
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
    signalsUsed: ["guessListingCity", "getNormalizedComparableType", "listing.price"],
    fieldPrecedence: ["location.city", "locationLabel", "title", "url"],
  };
}

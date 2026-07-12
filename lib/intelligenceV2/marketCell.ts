import {
  canonicalizeMarketCity,
  canonicalizeMarketCountry,
  normalizeMarketEntity,
} from "@/lib/competitors/marketNormalization";
import { getNormalizedComparableType } from "@/lib/competitors/filterComparableListings";
import type { ExtractedListing, SupportedPlatform } from "@/lib/extractors/types";
import {
  mapPropertyTypeOverrideToListingPropertyType,
  parsePropertyTypeOverride,
} from "@/lib/listings/propertyTypeOverrideOptions";
import { normalizeWhitespace } from "@/lib/extractors/shared";
import { INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION } from "./policyVersions";

export type IntelligenceV2Platform =
  | "airbnb"
  | "booking"
  | "expedia"
  | "agoda"
  | "vrbo"
  | "unknown";

export type IntelligenceV2PropertyType =
  | "studio"
  | "apartment"
  | "villa"
  | "riad"
  | "room"
  | "hotel"
  | "unknown";

export type IntelligenceV2CapacityBand =
  | "unknown"
  | "1_3"
  | "4_6"
  | "7_9"
  | "10_plus";

export type IntelligenceV2Currency = string;

export type MarketCellInput = {
  country?: string | null;
  city?: string | null;
  platform?: string | null;
  propertyType?: string | null;
  capacity?: number | null;
  guestCapacity?: number | null;
  currency?: string | null;
};

export type MarketCellV1 = Readonly<{
  country: string;
  city: string;
  platform: IntelligenceV2Platform;
  propertyType: IntelligenceV2PropertyType;
  capacityBand: IntelligenceV2CapacityBand;
  currency: IntelligenceV2Currency;
  marketCellKey: string;
}>;

function toFinitePositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

function normalizeAsciiKeyPart(value: string | null | undefined): string {
  if (typeof value !== "string") return "unknown";
  const normalized = normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unknown";
}

function toSupportedPlatformForSeed(
  value: IntelligenceV2Platform,
): SupportedPlatform {
  if (
    value === "airbnb" ||
    value === "booking" ||
    value === "vrbo" ||
    value === "agoda" ||
    value === "expedia"
  ) {
    return value;
  }
  return "other";
}

function normalizePropertyTypeSeed(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const override = parsePropertyTypeOverride(trimmed);
  if (override) {
    return mapPropertyTypeOverrideToListingPropertyType(override);
  }

  return trimmed.toLowerCase();
}

function buildMarketNormalizationSeed(
  input: MarketCellInput,
): ExtractedListing & { country?: string | null } {
  const platform = normalizeIntelligencePlatform(input.platform);
  const propertyType = normalizePropertyTypeSeed(input.propertyType);
  const capacity = toFinitePositiveInteger(input.capacity);
  const guestCapacity = toFinitePositiveInteger(input.guestCapacity);
  const city = typeof input.city === "string" ? input.city : null;
  const country = typeof input.country === "string" ? input.country : null;

  return {
    url: "",
    sourceUrl: "",
    platform: toSupportedPlatformForSeed(platform),
    title: "",
    description: "",
    amenities: [],
    photos: [],
    price: null,
    currency: null,
    latitude: null,
    longitude: null,
    capacity,
    guestCapacity,
    propertyType,
    locationLabel: city,
    reviewCount: null,
    rating: null,
    structure: {
      capacity: capacity ?? guestCapacity,
      bedrooms: null,
      bedCount: null,
      bathrooms: null,
      propertyType,
      locationLabel: city,
    },
    country,
  };
}

export function normalizeIntelligencePlatform(
  value: string | null | undefined,
): IntelligenceV2Platform {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    normalized === "airbnb" ||
    normalized === "booking" ||
    normalized === "expedia" ||
    normalized === "agoda" ||
    normalized === "vrbo"
  ) {
    return normalized;
  }
  return "unknown";
}

export function normalizeCurrency(
  value: string | null | undefined,
): IntelligenceV2Currency {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z]{3}$/.test(trimmed)) {
    return "UNKNOWN";
  }
  return trimmed.toUpperCase();
}

export function normalizeCapacityBand(input: {
  capacity?: number | null;
  guestCapacity?: number | null;
}): IntelligenceV2CapacityBand {
  const capacity =
    toFinitePositiveInteger(input.capacity) ??
    toFinitePositiveInteger(input.guestCapacity);

  if (capacity == null) return "unknown";
  if (capacity <= 3) return "1_3";
  if (capacity <= 6) return "4_6";
  if (capacity <= 9) return "7_9";
  return "10_plus";
}

export function normalizeIntelligencePropertyType(
  value: string | null | undefined,
): IntelligenceV2PropertyType {
  const propertyTypeSeed = normalizePropertyTypeSeed(value);
  if (!propertyTypeSeed) {
    return "unknown";
  }

  const seed = buildMarketNormalizationSeed({ propertyType: propertyTypeSeed });
  const normalizedComparableType = getNormalizedComparableType(seed);

  switch (normalizedComparableType) {
    case "studio_like":
      return "studio";
    case "apartment_like":
      return "apartment";
    case "villa_like":
    case "house_like":
      return "villa";
    case "riad_like":
      return "riad";
    case "room_like":
      return "room";
    case "hotel_like":
      return "hotel";
  }

  const normalizedKey = normalizeAsciiKeyPart(propertyTypeSeed);
  if (normalizedKey === "studio") return "studio";
  if (
    normalizedKey === "apartment" ||
    normalizedKey === "appartement" ||
    normalizedKey === "flat"
  ) {
    return "apartment";
  }
  if (
    normalizedKey === "villa" ||
    normalizedKey === "house" ||
    normalizedKey === "maison"
  ) {
    return "villa";
  }
  if (normalizedKey === "riad" || normalizedKey === "dar") {
    return "riad";
  }
  if (
    normalizedKey === "room" ||
    normalizedKey === "chambre" ||
    normalizedKey === "rooms"
  ) {
    return "room";
  }
  if (normalizedKey === "hotel") {
    return "hotel";
  }

  return "unknown";
}

export function buildMarketCellKey(input: {
  country: string;
  city: string;
  platform: IntelligenceV2Platform;
  propertyType: IntelligenceV2PropertyType;
  capacityBand: IntelligenceV2CapacityBand;
  currency: IntelligenceV2Currency;
}): string {
  return [
    INTELLIGENCE_V2_MARKET_CELL_POLICY_VERSION,
    normalizeAsciiKeyPart(input.country),
    normalizeAsciiKeyPart(input.city),
    normalizeAsciiKeyPart(input.platform),
    normalizeAsciiKeyPart(input.propertyType),
    normalizeAsciiKeyPart(input.capacityBand),
    normalizeAsciiKeyPart(input.currency.toLowerCase()),
  ].join("|");
}

export function buildMarketCellV1(input: MarketCellInput): MarketCellV1 {
  const seed = buildMarketNormalizationSeed(input);
  const normalizedEntity = normalizeMarketEntity(seed);

  const country =
    canonicalizeMarketCountry(input.country ?? normalizedEntity.canonicalCountry) ??
    "unknown";
  const city =
    canonicalizeMarketCity(input.city ?? normalizedEntity.canonicalCity) ?? "unknown";
  const platform = normalizeIntelligencePlatform(input.platform ?? seed.platform);
  const propertyType = normalizeIntelligencePropertyType(
    input.propertyType ?? normalizedEntity.rawPropertyType,
  );
  const capacityBand = normalizeCapacityBand({
    capacity: input.capacity ?? seed.capacity ?? null,
    guestCapacity: input.guestCapacity ?? seed.guestCapacity ?? null,
  });
  const currency = normalizeCurrency(input.currency);

  return Object.freeze({
    country,
    city,
    platform,
    propertyType,
    capacityBand,
    currency,
    marketCellKey: buildMarketCellKey({
      country,
      city,
      platform,
      propertyType,
      capacityBand,
      currency,
    }),
  });
}

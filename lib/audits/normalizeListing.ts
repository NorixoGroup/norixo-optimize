import { guessListingCity } from "@/lib/competitors/filterComparableListings";
import { guessMarketComparisonCountry } from "@/lib/competitors/searchCompetitors";
import type { ExtractedListing, SupportedPlatform } from "@/lib/extractors/types";

function toSupportedPlatform(value: unknown): SupportedPlatform {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  if (s === "airbnb" || s === "booking" || s === "vrbo" || s === "agoda" || s === "expedia") {
    return s;
  }
  return "other";
}

function buildComparableTargetShape(raw: Record<string, unknown>) {
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    description: typeof raw.description === "string" ? raw.description : "",
    url: (typeof raw.url === "string" ? raw.url : null) ?? (typeof raw.sourceUrl === "string" ? raw.sourceUrl : null),
    locationLabel:
      (typeof raw.locationLabel === "string" ? raw.locationLabel : null) ??
      (raw.structure &&
      typeof raw.structure === "object" &&
      raw.structure !== null &&
      typeof (raw.structure as { locationLabel?: unknown }).locationLabel === "string"
        ? (raw.structure as { locationLabel: string }).locationLabel
        : null),
    structure: raw.structure,
    platform: raw.platform ?? raw.source_platform ?? "unknown",
    propertyType: raw.propertyType ?? null,
    bedrooms: raw.bedrooms ?? raw.bedroomCount ?? null,
    bedCount: raw.bedCount ?? null,
    bathrooms: raw.bathrooms ?? raw.bathroomCount ?? null,
    capacity: raw.capacity ?? raw.guestCapacity ?? null,
    currency: raw.currency ?? null,
  };
}

export function normalizeListing(raw: unknown): ExtractedListing & { reviewsCount: number; location: unknown } {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  const baseLocation = r.location ?? null;
  const comparable = buildComparableTargetShape(r);
  const inferredCity = guessListingCity(comparable as never);
  const inferredCountry = guessMarketComparisonCountry(comparable as never);

  const url =
    typeof r.url === "string" ? r.url : typeof r.sourceUrl === "string" ? r.sourceUrl : "";

  return {
    title: typeof r.title === "string" ? r.title : "",
    description: typeof r.description === "string" ? r.description : "",
    photos: Array.isArray(r.photos) ? r.photos.filter((p): p is string => typeof p === "string") : [],
    amenities: Array.isArray(r.amenities) ? r.amenities.filter((a): a is string => typeof a === "string") : [],
    price: typeof r.price === "number" ? r.price : null,
    rating: typeof r.rating === "number" ? r.rating : null,
    reviewsCount: typeof r.reviewsCount === "number" ? r.reviewsCount : 0,
    location:
      baseLocation ??
      (inferredCity || inferredCountry
        ? { city: inferredCity ?? null, country: inferredCountry ?? null }
        : null),
    url,
    platform: toSupportedPlatform(r.platform ?? r.source_platform),

    locationLabel: comparable.locationLabel,
    structure: r.structure as ExtractedListing["structure"],
    propertyType:
      typeof r.propertyType === "string"
        ? r.propertyType
        : comparable.propertyType != null && typeof comparable.propertyType === "string"
          ? comparable.propertyType
          : null,
    airbnbComparableClassificationText:
      typeof r.airbnbComparableClassificationText === "string" ? r.airbnbComparableClassificationText : null,
    bedrooms: typeof r.bedrooms === "number" ? r.bedrooms : typeof r.bedroomCount === "number" ? r.bedroomCount : null,
    bedCount: typeof r.bedCount === "number" ? r.bedCount : null,
    bathrooms: typeof r.bathrooms === "number" ? r.bathrooms : typeof r.bathroomCount === "number" ? r.bathroomCount : null,
    capacity: typeof r.capacity === "number" ? r.capacity : typeof r.guestCapacity === "number" ? r.guestCapacity : null,
    currency:
      typeof r.currency === "string" ? r.currency : comparable.currency != null && typeof comparable.currency === "string" ? comparable.currency : null,
    sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : typeof r.url === "string" ? r.url : undefined,
    canonicalUrl: typeof r.canonicalUrl === "string" ? r.canonicalUrl : undefined,
  };
}
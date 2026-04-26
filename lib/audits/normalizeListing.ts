import { guessListingCity } from "@/lib/competitors/filterComparableListings";
import { guessMarketComparisonCountry } from "@/lib/competitors/searchCompetitors";

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

export function normalizeListing(raw: any) {
  const baseLocation = raw?.location ?? null;
  const comparable = buildComparableTargetShape((raw ?? {}) as Record<string, unknown>);
  const inferredCity = guessListingCity(comparable as never);
  const inferredCountry = guessMarketComparisonCountry(comparable as never);

  return {
    title: raw?.title ?? "",
    description: raw?.description ?? "",
    photos: Array.isArray(raw?.photos) ? raw.photos : [],
    amenities: Array.isArray(raw?.amenities) ? raw.amenities : [],
    price: raw?.price ?? null,
    rating: raw?.rating ?? null,
    reviewsCount: raw?.reviewsCount ?? 0,
    location:
      baseLocation ??
      (inferredCity || inferredCountry
        ? { city: inferredCity ?? null, country: inferredCountry ?? null }
        : null),
    url: raw?.url ?? raw?.sourceUrl ?? null,

    platform: raw?.platform ?? raw?.source_platform ?? "unknown",

    locationLabel: comparable.locationLabel,
    structure: raw?.structure,
    propertyType: raw?.propertyType ?? null,
    airbnbComparableClassificationText: raw?.airbnbComparableClassificationText ?? null,
    bedrooms: raw?.bedrooms ?? raw?.bedroomCount ?? null,
    bedCount: raw?.bedCount ?? null,
    bathrooms: raw?.bathrooms ?? raw?.bathroomCount ?? null,
    capacity: raw?.capacity ?? raw?.guestCapacity ?? null,
    currency: raw?.currency ?? null,
    sourceUrl: raw?.sourceUrl ?? raw?.url ?? null,
    canonicalUrl: raw?.canonicalUrl ?? null,
  };
}
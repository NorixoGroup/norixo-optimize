import { guessListingCity } from "@/lib/competitors/filterComparableListings";
import { guessMarketComparisonCountry } from "@/lib/competitors/searchCompetitors";
import type { ExtractedListing, SupportedPlatform } from "@/lib/extractors/types";

const AIRBNB_GENERIC_INFERRED_CITIES = new Set([
  "couple",
  "stay",
  "residence",
  "residencia",
  "logement",
  "entier",
  "france",

  "location",
  "locations",
  "location vacances",
  "locations vacances",
  "location de vacances",
  "locations de vacances",
  "vacances",
  "hebergement",
  "hébergement",
  "hebergements",
  "hébergements",
  "hebergement prefere",
  "hébergement préféré",
  "hebergement favori",
  "hébergement favori",
  "sejour",
  "séjour",
  "appartement",
  "appartements",

  "vacation rental",
  "vacation rentals",
  "holiday rental",
  "holiday rentals",
  "rental unit",
  "rental",
  "rentals",
  "accommodation",
]);

function normalizeLocationGuardText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readBaseLocationField(
  baseLocation: unknown,
  key: "city" | "country"
): string | null {
  if (!baseLocation || typeof baseLocation !== "object") return null;
  const value = (baseLocation as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function logNormalizeLocationGuard(payload: {
  platform: SupportedPlatform;
  rawInferredCity: string | null;
  rawInferredCountry: string | null;
  finalCity: string | null;
  finalCountry: string | null;
  reason: string | null;
}): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[audit][normalize-location-guard]", JSON.stringify(payload));
}

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

  const platformVal = toSupportedPlatform(r.platform ?? r.source_platform);
  const rawLocationCity = readBaseLocationField(baseLocation, "city");
  const rawLocationCountry = readBaseLocationField(baseLocation, "country");

  const locationLabelCity =
    typeof comparable.locationLabel === "string"
      ? comparable.locationLabel
          .split(",")[0]
          ?.trim()
          ?.toLowerCase() ?? null
      : null;

  const resolvedLocationCity =
    rawLocationCity ??
    locationLabelCity ??
    null;

  const hasOriginalLocationSignal = Boolean(
    (typeof comparable.locationLabel === "string" && comparable.locationLabel.trim().length > 0) ||
      rawLocationCity ||
      rawLocationCountry
  );
  let finalInferredCity =
    resolvedLocationCity ??
    inferredCity;
  let finalInferredCountry = inferredCountry;
  let normalizeLocationGuardReason: string | null = null;
  if (platformVal === "airbnb") {
    const normalizedInferredCity = normalizeLocationGuardText(inferredCity);
    if (normalizedInferredCity && AIRBNB_GENERIC_INFERRED_CITIES.has(normalizedInferredCity)) {
      finalInferredCity = null;
      normalizeLocationGuardReason = hasOriginalLocationSignal
        ? "airbnb_reject_generic_inferred_city_even_with_origin_location"
        : "airbnb_reject_generic_inferred_city_without_origin_location";
    }

    if (!hasOriginalLocationSignal && finalInferredCountry != null && finalInferredCity == null) {
      finalInferredCountry = null;
      normalizeLocationGuardReason =
        normalizeLocationGuardReason ??
        "airbnb_reject_inferred_country_without_origin_location";
    }

    if (finalInferredCity === null && normalizedInferredCity && finalInferredCountry != null) {
      finalInferredCountry = null;
      normalizeLocationGuardReason =
        normalizeLocationGuardReason ??
        "airbnb_reject_inferred_country_after_generic_city";
    }
  }
  const normalizedLocationLabel = normalizeLocationGuardText(comparable.locationLabel);
  const finalLocationLabel =
    platformVal === "airbnb" &&
    normalizedLocationLabel &&
    AIRBNB_GENERIC_INFERRED_CITIES.has(normalizedLocationLabel)
      ? null
      : comparable.locationLabel;

  if (platformVal === "airbnb") {
    console.log("[audit][normalize-location-input]", JSON.stringify({
      rawLocationCity,
      rawLocationCountry,
      locationLabel: comparable.locationLabel ?? null,
      locationLabelCity,
      resolvedLocationCity,
      inferredCity,
      inferredCountry,
    }));
  }

  logNormalizeLocationGuard({
    platform: platformVal,
    rawInferredCity: inferredCity ?? null,
    rawInferredCountry: inferredCountry ?? null,
    finalCity: finalInferredCity ?? null,
    finalCountry: finalInferredCountry ?? null,
    reason: normalizeLocationGuardReason,
  });
  const rawStayMeta = r as {
    stayNights?: number | null;
    rawStayPrice?: number | null;
    priceBasis?: string;
  };
  const bookingMeta =
    platformVal === "booking" &&
    (rawStayMeta.stayNights !== undefined ||
      rawStayMeta.rawStayPrice != null ||
      rawStayMeta.priceBasis === "nightly" ||
      rawStayMeta.priceBasis === "unknown")
      ? {
          ...(rawStayMeta.stayNights !== undefined
            ? {
                stayNights:
                  typeof rawStayMeta.stayNights === "number" && Number.isFinite(rawStayMeta.stayNights)
                    ? Math.floor(rawStayMeta.stayNights)
                    : null,
              }
            : {}),
          ...(typeof rawStayMeta.rawStayPrice === "number" && Number.isFinite(rawStayMeta.rawStayPrice)
            ? { rawStayPrice: rawStayMeta.rawStayPrice }
            : {}),
          ...(rawStayMeta.priceBasis === "nightly" || rawStayMeta.priceBasis === "unknown"
            ? { priceBasis: rawStayMeta.priceBasis as "nightly" | "unknown" }
            : {}),
        }
      : {};

  return {
    title: typeof r.title === "string" ? r.title : "",
    description: typeof r.description === "string" ? r.description : "",
    photos: Array.isArray(r.photos) ? r.photos.filter((p): p is string => typeof p === "string") : [],
    amenities: Array.isArray(r.amenities) ? r.amenities.filter((a): a is string => typeof a === "string") : [],
    price:
      typeof r.price === "number" && Number.isFinite(r.price)
        ? r.price
        : typeof r.normalizedNightlyPrice === "number" && Number.isFinite(r.normalizedNightlyPrice)
          ? r.normalizedNightlyPrice
          : null,
    normalizedNightlyPrice:
      typeof r.normalizedNightlyPrice === "number" && Number.isFinite(r.normalizedNightlyPrice)
        ? r.normalizedNightlyPrice
        : null,
    rating: typeof r.rating === "number" ? r.rating : null,
    hostName: typeof r.hostName === "string" ? r.hostName : typeof r.host_name === "string" ? r.host_name : null,
    hostInfo: typeof r.hostInfo === "string" ? r.hostInfo : null,
    reviewsCount: typeof r.reviewsCount === "number" ? r.reviewsCount : 0,
    location:
      baseLocation ??
      (finalInferredCity || finalInferredCountry
        ? { city: finalInferredCity ?? null, country: finalInferredCountry ?? null }
        : null),
    url,
    platform: platformVal,

    locationLabel: finalLocationLabel,
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
    latitude: typeof r.latitude === "number" && Number.isFinite(r.latitude) ? r.latitude : null,
    longitude: typeof r.longitude === "number" && Number.isFinite(r.longitude) ? r.longitude : null,
    currency:
      typeof r.currency === "string" ? r.currency : comparable.currency != null && typeof comparable.currency === "string" ? comparable.currency : null,
    sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : typeof r.url === "string" ? r.url : undefined,
    canonicalUrl: typeof r.canonicalUrl === "string" ? r.canonicalUrl : undefined,
    priceDetails:
      r.priceDetails && typeof r.priceDetails === "object"
        ? (r.priceDetails as ExtractedListing["priceDetails"])
        : null,
    ...bookingMeta,
  };
}

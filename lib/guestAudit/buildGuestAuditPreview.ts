import type {
  AuditSubScore,
  ExtractedListing,
  ListingFieldQuality,
} from "@/lib/extractors/types";
import {
  detectPlatformFromUrl,
  normalizeAuditLocaleToFrench,
  type GuestSupportedPlatform,
} from "./shared";
import { getNormalizedComparableType } from "@/lib/competitors/filterComparableListings";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

function debugGuestAuditLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

type GuestAuditPreview = {
  listing_url: string;
  title: string;
  platform: GuestSupportedPlatform;
  score: number;
  insights: string[];
  recommendations: string[];
  summary: string | null;
  marketComparison: string | null;
  estimatedRevenue: string | null;
  bookingPotential: string | null;
  occupancyObservation: ExtractedListing["occupancyObservation"];
  subScores: AuditSubScore[];
  marketPositioning?: {
    status: "ok" | "partial" | "insufficient_data" | "blocked";
    comparableCount: number;
    summary: string;
    comparables?: Array<{
      id?: string;
      url?: string;
      title?: string;
      platform?: string | null;
      propertyType?: string | null;
      capacity?: number | null;
      bedrooms?: number | null;
      bathrooms?: number | null;
      price?: number | null;
      currency?: string | null;
      eurApprox?: number | null;
      priceSource?: string | null;
      photosCount?: number | null;
      ratingValue?: number | null;
      reviewCount?: number | null;
      amenitiesCount?: number | null;
    }>;
    metrics: Array<{
      key:
        | "photos"
        | "rating"
        | "reviews"
        | "amenities"
        | "title"
        | "description"
        | "structure";
      label: string;
      subjectValue: number | string | null;
      marketAverage: number | null;
      position: "above" | "average" | "below" | "unknown";
      note: string | null;
    }>;
  };
  scoreBreakdown?: {
    visibility: number | null;
    trust: number | null;
    conversion: number | null;
    dataQuality: number | null;
  };
};

type FieldAvailability =
  | "available-good"
  | "available-partial"
  | "unavailable-public"
  | "missing-probable-issue";

type ScoreBreakdown = {
  visibility: number | null;
  trust: number | null;
  conversion: number | null;
  dataQuality: number | null;
};

type MarketPositionMetric = {
  key:
    | "photos"
    | "rating"
    | "reviews"
    | "amenities"
    | "title"
    | "description"
    | "structure";
  label: string;
  subjectValue: number | string | null;
  marketAverage: number | null;
  position: "above" | "average" | "below" | "unknown";
  note: string | null;
};

type MarketPositionComparable = NonNullable<
  NonNullable<GuestAuditPreview["marketPositioning"]>["comparables"]
>[number];

function normalizeOccupancyObservation(
  occupancyObservation: ExtractedListing["occupancyObservation"]
): ExtractedListing["occupancyObservation"] {
  if (!occupancyObservation) {
    return {
      status: "unavailable",
      rate: null,
      unavailableDays: 0,
      availableDays: 0,
      observedDays: 0,
      windowDays: 60,
      source: null,
    };
  }

  return {
    ...occupancyObservation,
    status: occupancyObservation.rate == null ? "unavailable" : "available",
  };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => (value ?? "").trim()).filter(Boolean))];
}

function averageAvailableScores(scores: Array<number | null>) {
  const available = scores.filter((score): score is number => score != null);
  if (available.length === 0) return null;
  return available.reduce((sum, score) => sum + score, 0) / available.length;
}

function averageNumbers(values: Array<number | null>) {
  const available = values.filter((value): value is number => value != null);
  if (available.length === 0) return null;
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}

function normalizeScoreToTen(value: number | null, scale: number | null) {
  if (value == null || scale == null || scale <= 0) return null;
  return clamp((value / scale) * 10, 0, 10);
}

function hasDescriptiveTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) return false;
  if (normalized.length < 18) return false;

  const lower = normalized.toLowerCase();
  return (
    lower.includes("studio") ||
    lower.includes("appartement") ||
    lower.includes("apartment") ||
    lower.includes("villa") ||
    lower.includes("riad") ||
    lower.includes("maison") ||
    lower.includes("loft") ||
    lower.includes("suite") ||
    lower.includes("terrasse") ||
    lower.includes("balcon") ||
    lower.includes("piscine") ||
    lower.includes("centre") ||
    lower.includes("vue")
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPhotoPoints(photoCount: number) {
  if (photoCount <= 0) return 0;
  return clamp(photoCount / 10, 0, 3);
}

function getDescriptionPoints(descriptionLength: number) {
  if (descriptionLength <= 0) return 0;
  return clamp(descriptionLength / 400, 0, 3);
}

function getAmenitiesPoints(amenitiesCount: number) {
  if (amenitiesCount <= 0) return 0;
  return clamp(amenitiesCount / 10, 0, 2);
}

function getTitlePoints(title: string) {
  const normalized = title.trim();
  if (!normalized || normalized === "Titre non detecte") return 0;

  let score = 0;

  if (normalized.length >= 18) score += 0.8;
  if (normalized.length >= 35) score += 0.4;
  if (hasDescriptiveTitle(normalized)) score += 0.8;

  return clamp(score, 0, 2);
}

function scoreTitle(title: string | null) {
  const normalized = (title ?? "").trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  const looksLikeLocationOnly =
    normalized.length < 30 &&
    !hasDescriptiveTitle(normalized) &&
    !/[,&-]/.test(normalized) &&
    lower.split(/\s+/).length <= 3;

  if (looksLikeLocationOnly) return 3;
  if (normalized.length < 20) return 4;
  if (normalized.length < 35) return 6.5;
  if (normalized.length <= 80) return 9;
  return 8;
}

function scoreDescription(
  description: string | null,
  source: string | null | undefined
) {
  const normalized = (description ?? "").trim();
  if (!normalized) return null;

  const lowerSource = (source ?? "").toLowerCase();
  const lowerValue = normalized.toLowerCase();

  if (
    lowerValue.startsWith("passer à la section principale") ||
    lowerValue.includes("ouvrez l’appli carnets de voyages") ||
    lowerValue.includes("sign in")
  ) {
    return 2.5;
  }

  if (
    (lowerSource === "og_description" || lowerSource === "meta_description") &&
    normalized.length < 400
  ) {
    return 5.5;
  }

  if (normalized.length >= 1400) return 10;
  if (normalized.length >= 900) return 9;
  if (normalized.length >= 450) return 8.5;
  if (normalized.length >= 220) return 7;
  return 5.5;
}

function scoreAmenities(count: number, availabilityStatus: FieldAvailability) {
  if (availabilityStatus === "unavailable-public") return null;
  if (count <= 0) return 3;
  if (count <= 3) return 5;
  if (count <= 7) return 7.5;
  return 9.5;
}

function scoreStructure(input: {
  bedrooms: number | null;
  bathrooms: number | null;
  capacity: number | null;
  bedCount: number | null;
  propertyType: string | null;
}) {
  const usefulCount = [
    input.bedrooms,
    input.bathrooms,
    input.capacity,
    input.bedCount,
    input.propertyType?.trim() ? 1 : null,
  ].filter((value) => value != null).length;

  if (usefulCount === 0) return null;
  if (usefulCount === 1) return 4;
  if (usefulCount === 2) return 6;
  if (usefulCount === 3) return 8;
  return 9.5;
}

function scoreLocation(location: string | null) {
  const normalized = (location ?? "").trim();
  if (!normalized) return null;
  if (/[,-]/.test(normalized)) return 8.5;
  if (normalized.split(/\s+/).length >= 4) return 9.5;
  return 6.5;
}

function scoreReviewCount(reviewCount: number | null) {
  if (reviewCount == null) return null;
  if (reviewCount < 3) return 4;
  if (reviewCount < 10) return 6;
  if (reviewCount < 30) return 8;
  return 10;
}

function scoreRating(ratingValue: number | null, ratingScale: number | null) {
  const normalized = normalizeScoreToTen(ratingValue, ratingScale);
  if (normalized == null) return null;
  if (normalized < 6) return 2.5;
  if (normalized < 7.5) return 5.5;
  if (normalized < 9) return 8;
  return 9.5;
}

function scorePresence(value: string | null) {
  return value?.trim() ? 8 : null;
}

function scoreRules(rulesCount: number, availabilityStatus: FieldAvailability) {
  if (availabilityStatus === "unavailable-public") return null;
  if (rulesCount <= 0) return 4;
  if (rulesCount === 1) return 6;
  if (rulesCount <= 3) return 8;
  return 9;
}

function normalizeMetaQuality(
  quality: ListingFieldQuality | undefined
): "missing" | "full" | "partial" | "weak" {
  if (quality === "missing") return "missing";
  if (quality === "high") return "full";
  if (quality === "medium") return "partial";
  return "weak";
}

function isDataReliable(confidence: number | null | undefined) {
  return (confidence ?? 1) >= 0.7;
}

function getFieldAvailability(input: {
  platform: GuestSupportedPlatform;
  kind:
    | "title"
    | "description"
    | "photos"
    | "amenities"
    | "rating"
    | "reviewCount"
    | "structure"
    | "location"
    | "host"
    | "rules";
  valuePresent: boolean;
  source?: string | null;
  confidence?: number | null;
  metaQuality?: ListingFieldQuality;
  relatedAmenitiesCount?: number;
  relatedHostInfo?: string | null;
  relatedRulesCount?: number;
}) : FieldAvailability {
  if (input.valuePresent) {
    if (input.kind === "description") {
      const source = input.source ?? "";
      if (
        input.platform === "vrbo" &&
        (source === "og_description" || source === "meta_description")
      ) {
        return "available-partial";
      }
      if (normalizeMetaQuality(input.metaQuality) === "full" && getMetaConfidence({ confidence: input.confidence }) >= 0.7) {
        return "available-good";
      }
      return "available-partial";
    }

    if (input.kind === "photos" && input.platform === "vrbo" && input.source === "body_photo_total") {
      return "available-partial";
    }

    if ((input.confidence ?? 1) < 0.7) {
      return "available-partial";
    }

    return "available-good";
  }

  if (
    input.kind === "amenities" &&
    input.platform === "vrbo" &&
    !input.relatedHostInfo &&
    (input.relatedRulesCount ?? 0) === 0
  ) {
    return "unavailable-public";
  }

  if (input.kind === "host" || input.kind === "rules") {
    return "unavailable-public";
  }

  return "missing-probable-issue";
}

function computeVisibilityScore(input: {
  title: string;
  photoCount: number;
  photoMeta: ExtractedListing["photoMeta"];
  ratingValue: number | null;
  ratingScale: number | null;
  reviewCount: number | null;
}) {
  return averageAvailableScores([
    scoreTitle(input.title),
    input.photoCount > 0 ? scorePhotoCount(input.photoCount) : null,
    scoreRating(input.ratingValue, input.ratingScale),
    scoreReviewCount(input.reviewCount),
  ]);
}

function scorePhotoCount(photoCount: number) {
  if (photoCount <= 4) return 4;
  if (photoCount <= 9) return 6;
  if (photoCount <= 19) return 8;
  return 10;
}

function getListingPhotoCount(listing: ExtractedListing) {
  if (typeof listing.photosCount === "number") return listing.photosCount;
  return Array.isArray(listing.photos) ? listing.photos.filter(Boolean).length : 0;
}

function getAmenitiesCount(listing: ExtractedListing) {
  return Array.isArray(listing.amenities) ? listing.amenities.filter(Boolean).length : 0;
}

function getListingRatingOnTen(listing: ExtractedListing) {
  const ratingValue =
    typeof listing.ratingValue === "number"
      ? listing.ratingValue
      : typeof listing.rating === "number"
        ? listing.rating
        : null;
  const ratingScale =
    typeof listing.ratingScale === "number" ? listing.ratingScale : ratingValue != null ? 5 : null;
  return normalizeScoreToTen(ratingValue, ratingScale);
}

function getStructureSignalCount(listing: ExtractedListing) {
  return [
    listing.capacity,
    listing.bedrooms,
    listing.bathrooms,
    listing.bedCount,
    listing.propertyType?.trim() ? 1 : null,
  ].filter((value) => value != null).length;
}

function getStructureScoreForListing(listing: ExtractedListing) {
  return scoreStructure({
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    capacity: listing.capacity ?? null,
    bedCount: listing.bedCount ?? null,
    propertyType: listing.propertyType ?? null,
  });
}

function buildStructureNote(listing: ExtractedListing) {
  const parts = [
    typeof listing.capacity === "number" ? `${listing.capacity} voyageurs` : null,
    typeof listing.bedrooms === "number" ? `${listing.bedrooms} chambre${listing.bedrooms > 1 ? "s" : ""}` : null,
    typeof listing.bathrooms === "number" ? `${listing.bathrooms} salle${listing.bathrooms > 1 ? "s" : ""} de bain` : null,
    listing.propertyType?.trim() || null,
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) return "Structure peu détaillée";
  return parts.join(" · ");
}

function inferPropertyTypeFromLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("appartement") || normalized.includes("apartment")) return "apartment";
  if (normalized.includes("villa")) return "villa";
  if (normalized.includes("riad")) return "riad";
  if (normalized.includes("maison") || normalized.includes("house")) return "house";
  if (normalized.includes("studio")) return "studio";
  return null;
}

function getListingPropertyType(listing: ExtractedListing): string | null {
  const direct =
    typeof listing.propertyType === "string" && listing.propertyType.trim().length > 0
      ? listing.propertyType
      : null;
  if (direct) return direct;
  return (
    inferPropertyTypeFromLabel(listing.locationLabel) ??
    getNormalizedComparableType(listing) ??
    null
  );
}

function getListingPriceSource(listing: ExtractedListing): string | null {
  const record = listing as Record<string, unknown>;
  return typeof record.priceSource === "string"
    ? record.priceSource
    : typeof record.price_source === "string"
      ? record.price_source
      : null;
}

function getListingEurApprox(listing: ExtractedListing): number | null {
  const record = listing as Record<string, unknown>;
  return typeof record.eurApprox === "number" ? record.eurApprox : null;
}

function getListingPrice(listing: ExtractedListing): number | null {
  const record = listing as Record<string, unknown>;
  if (typeof listing.price === "number" && Number.isFinite(listing.price)) return listing.price;
  if (typeof record.pricePerNight === "number" && Number.isFinite(record.pricePerNight)) {
    return record.pricePerNight;
  }
  return null;
}

function getListingCurrency(listing: ExtractedListing): string | null {
  const record = listing as Record<string, unknown>;
  if (typeof listing.currency === "string" && listing.currency.trim().length > 0) {
    return listing.currency;
  }
  if (typeof record.priceCurrency === "string") return record.priceCurrency;
  if (typeof record.currency === "string") return record.currency;
  return null;
}

function buildTitleNote(listing: ExtractedListing) {
  const length = (listing.title ?? "").trim().length;
  if (!length) return null;
  return `${length} caractères`;
}

function buildDescriptionNote(listing: ExtractedListing) {
  const length = (listing.description ?? "").trim().length;
  if (!length) return null;

  const source = listing.descriptionMeta?.source ?? null;
  if (source === "og_description" || source === "meta_description") {
    return `${length} caractères visibles publiquement`;
  }

  return `${length} caractères exploitables`;
}

function getReliableComparableCount(competitors: ExtractedListing[]) {
  return competitors.filter((listing) => {
    let signalCount = 0;
    if ((listing.title ?? "").trim()) signalCount += 1;
    if ((listing.description ?? "").trim().length >= 80) signalCount += 1;
    if (getListingPhotoCount(listing) > 0) signalCount += 1;
    if (getAmenitiesCount(listing) > 0) signalCount += 1;
    if (getListingRatingOnTen(listing) != null) signalCount += 1;
    if (typeof listing.reviewCount === "number") signalCount += 1;
    if (getStructureSignalCount(listing) > 0) signalCount += 1;
    return signalCount >= 3;
  }).length;
}

function getComparableReliabilityReasons(listing: ExtractedListing) {
  const reasons: string[] = [];

  if (!(listing.title ?? "").trim()) reasons.push("missing_title");
  if ((listing.description ?? "").trim().length < 80) reasons.push("thin_description");
  if (getListingPhotoCount(listing) <= 0) reasons.push("missing_photos");
  if (getAmenitiesCount(listing) <= 0) reasons.push("missing_amenities");
  if (getListingRatingOnTen(listing) == null) reasons.push("missing_rating");
  if (typeof listing.reviewCount !== "number") reasons.push("missing_review_count");
  if (getStructureSignalCount(listing) <= 0) reasons.push("missing_structure");

  return reasons;
}

function buildMarketComparable(listing: ExtractedListing): MarketPositionComparable {
  return {
    id: listing.externalId ?? undefined,
    url: listing.url ?? undefined,
    title: listing.title ?? undefined,
    platform: listing.platform ?? null,
    propertyType: getListingPropertyType(listing),
    capacity: listing.capacity ?? listing.guestCapacity ?? null,
    bedrooms: listing.bedrooms ?? listing.bedroomCount ?? null,
    bathrooms: listing.bathrooms ?? null,
    price: getListingPrice(listing),
    currency: getListingCurrency(listing),
    eurApprox: getListingEurApprox(listing),
    priceSource: getListingPriceSource(listing),
    photosCount: getListingPhotoCount(listing) || null,
    ratingValue:
      typeof listing.ratingValue === "number"
        ? listing.ratingValue
        : typeof listing.rating === "number"
          ? listing.rating
          : null,
    reviewCount: typeof listing.reviewCount === "number" ? listing.reviewCount : null,
    amenitiesCount: getAmenitiesCount(listing) || null,
  };
}

function getComparableListingsForMarketPositioning(competitors: ExtractedListing[]) {
  const accepted: ExtractedListing[] = [];
  const rejected: Array<{ url: string | null; title: string | null; reasons: string[] }> = [];

  for (const listing of competitors) {
    const reasons = getComparableReliabilityReasons(listing);
    if (reasons.length > 4) {
      rejected.push({
        url: listing.url ?? null,
        title: listing.title ?? null,
        reasons,
      });
      continue;
    }

    accepted.push(listing);
    if (accepted.length >= 5) break;
  }

  return {
    accepted,
    rejected,
  };
}

function getMetricPosition(input: {
  key: MarketPositionMetric["key"];
  subjectValue: number | null;
  marketAverage: number | null;
}): MarketPositionMetric["position"] {
  if (input.subjectValue == null || input.marketAverage == null || input.marketAverage <= 0) {
    return "unknown";
  }

  const { subjectValue, marketAverage } = input;
  const delta = subjectValue - marketAverage;
  const ratio = delta / marketAverage;
  const absoluteDelta = Math.abs(delta);

  if (input.key === "rating") {
    if (absoluteDelta < 0.35) return "average";
    return delta > 0 ? "above" : "below";
  }

  if (input.key === "title" || input.key === "description" || input.key === "structure") {
    if (absoluteDelta < 0.6) return "average";
    return delta > 0 ? "above" : "below";
  }

  if (Math.abs(ratio) < 0.15) return "average";
  return delta > 0 ? "above" : "below";
}

function buildMarketPositioning(input: {
  extracted: ExtractedListing;
  competitors: ExtractedListing[];
}): GuestAuditPreview["marketPositioning"] {
  const source = "searchCompetitorsAroundTarget";
  const platform = input.extracted.platform ?? null;
  const rawCandidateCount = input.competitors.length;
  const comparableCandidates = input.competitors.slice(0, 5);
  const reliableComparableCount = getReliableComparableCount(comparableCandidates);
  const comparableCount = comparableCandidates.length;
  const isBlockedPlatform =
    comparableCount === 0 &&
    (platform === "vrbo" || platform === "other");

  const subjectMetrics = {
    photos: getListingPhotoCount(input.extracted),
    rating: getListingRatingOnTen(input.extracted),
    reviews:
      typeof input.extracted.reviewCount === "number" ? input.extracted.reviewCount : null,
    amenities: getAmenitiesCount(input.extracted),
    title: scoreTitle(input.extracted.title ?? null),
    description: scoreDescription(
      input.extracted.description ?? null,
      input.extracted.descriptionMeta?.source
    ),
    structure: getStructureScoreForListing(input.extracted),
  };

  const marketAverages = {
    photos: averageNumbers(comparableCandidates.map(getListingPhotoCount)),
    rating: averageNumbers(comparableCandidates.map(getListingRatingOnTen)),
    reviews: averageNumbers(
      comparableCandidates.map((listing) =>
        typeof listing.reviewCount === "number" ? listing.reviewCount : null
      )
    ),
    amenities: averageNumbers(comparableCandidates.map(getAmenitiesCount)),
    title: averageNumbers(
      comparableCandidates.map((listing) => scoreTitle(listing.title ?? null))
    ),
    description: averageNumbers(
      comparableCandidates.map((listing) =>
        scoreDescription(listing.description ?? null, listing.descriptionMeta?.source)
      )
    ),
    structure: averageNumbers(comparableCandidates.map(getStructureScoreForListing)),
  };

  const metrics: MarketPositionMetric[] = [
    {
      key: "photos",
      label: "Photos",
      subjectValue: subjectMetrics.photos,
      marketAverage: marketAverages.photos,
      position: getMetricPosition({
        key: "photos",
        subjectValue: subjectMetrics.photos,
        marketAverage: marketAverages.photos,
      }),
      note: null,
    },
    {
      key: "rating",
      label: "Note",
      subjectValue: subjectMetrics.rating,
      marketAverage: marketAverages.rating,
      position: getMetricPosition({
        key: "rating",
        subjectValue: subjectMetrics.rating,
        marketAverage: marketAverages.rating,
      }),
      note: null,
    },
    {
      key: "reviews",
      label: "Avis",
      subjectValue: subjectMetrics.reviews,
      marketAverage: marketAverages.reviews,
      position: getMetricPosition({
        key: "reviews",
        subjectValue: subjectMetrics.reviews,
        marketAverage: marketAverages.reviews,
      }),
      note: null,
    },
    {
      key: "amenities",
      label: "Équipements",
      subjectValue: subjectMetrics.amenities,
      marketAverage: marketAverages.amenities,
      position: getMetricPosition({
        key: "amenities",
        subjectValue: subjectMetrics.amenities,
        marketAverage: marketAverages.amenities,
      }),
      note: null,
    },
    {
      key: "title",
      label: "Titre",
      subjectValue: subjectMetrics.title,
      marketAverage: marketAverages.title,
      position: getMetricPosition({
        key: "title",
        subjectValue: subjectMetrics.title,
        marketAverage: marketAverages.title,
      }),
      note: buildTitleNote(input.extracted),
    },
    {
      key: "description",
      label: "Description",
      subjectValue: subjectMetrics.description,
      marketAverage: marketAverages.description,
      position: getMetricPosition({
        key: "description",
        subjectValue: subjectMetrics.description,
        marketAverage: marketAverages.description,
      }),
      note: buildDescriptionNote(input.extracted),
    },
    {
      key: "structure",
      label: "Structure",
      subjectValue: subjectMetrics.structure,
      marketAverage: marketAverages.structure,
      position: getMetricPosition({
        key: "structure",
        subjectValue: subjectMetrics.structure,
        marketAverage: marketAverages.structure,
      }),
      note: buildStructureNote(input.extracted),
    },
  ];

  const knownMetricCount = metrics.filter((metric) => metric.position !== "unknown").length;

  const comparables = comparableCandidates.map(buildMarketComparable);
  const fallbackReason = isBlockedPlatform
    ? "platform_source_not_exploitable"
    : comparableCount === 0
      ? "no_credible_comparables"
      : comparableCount < 3
        ? "limited_credible_comparables"
        : knownMetricCount < 3
          ? "limited_market_signal_coverage"
          : null;

  debugGuestAuditLog("[guest-audit][market-positioning][debug]", {
    platform,
    source,
    normalizedTargetType: getNormalizedComparableType(input.extracted),
    rawCandidateCount,
    retainedComparableCount: comparableCount,
    reliableComparableCount,
    status:
      isBlockedPlatform
        ? "blocked"
        : comparableCount === 0
          ? "insufficient_data"
          : comparableCount < 3 || knownMetricCount < 3
            ? "partial"
            : "ok",
    fallbackReason,
    rejectedCandidates: [],
    marketAverages,
    finalMetricPositions: metrics.map((metric) => ({
      key: metric.key,
      position: metric.position,
      subjectValue: metric.subjectValue,
      marketAverage: metric.marketAverage,
    })),
  });

  if (isBlockedPlatform) {
    return {
      status: "blocked",
      comparableCount,
      summary:
        "La plateforme ne permet pas encore une comparaison locale fiable sur cette annonce.",
      comparables,
      metrics,
    };
  }

  if (comparableCount === 0) {
    return {
      status: "insufficient_data",
      comparableCount,
      summary: "Données marché insuffisantes pour établir une comparaison locale fiable.",
      comparables,
      metrics,
    };
  }

  if (comparableCount < 3 || knownMetricCount < 3) {
    return {
      status: "partial",
      comparableCount,
      summary: "Lecture indicative basée sur un nombre limité de logements comparables.",
      comparables,
      metrics,
    };
  }

  const aboveCount = metrics.filter((metric) => metric.position === "above").length;
  const belowCount = metrics.filter((metric) => metric.position === "below").length;

  const summary =
    aboveCount >= 3 && belowCount <= 1
      ? "Cette annonce se positionne au-dessus du marché local sur les signaux visibles."
      : belowCount >= 3
        ? "Cette annonce paraît en retrait par rapport au marché local sur plusieurs signaux visibles."
        : "Cette annonce est globalement dans la moyenne du marché local.";

  return {
    status: "ok",
    comparableCount,
    summary,
    comparables,
    metrics,
  };
}

function computeTrustScore(input: {
  platform: GuestSupportedPlatform;
  ratingValue: number | null;
  ratingScale: number | null;
  reviewCount: number | null;
  hostInfo: string | null;
  rulesCount: number;
}) {
  const hostAvailability = getFieldAvailability({
    platform: input.platform,
    kind: "host",
    valuePresent: Boolean(input.hostInfo),
  });
  const rulesAvailability = getFieldAvailability({
    platform: input.platform,
    kind: "rules",
    valuePresent: input.rulesCount > 0,
  });

  return averageAvailableScores([
    scoreRating(input.ratingValue, input.ratingScale),
    scoreReviewCount(input.reviewCount),
    hostAvailability === "unavailable-public" ? null : scorePresence(input.hostInfo),
    scoreRules(input.rulesCount, rulesAvailability),
  ]);
}

function computeConversionScore(input: {
  platform: GuestSupportedPlatform;
  description: string;
  descriptionMeta: ExtractedListing["descriptionMeta"];
  amenitiesCount: number;
  structure: {
    bedrooms: number | null;
    bathrooms: number | null;
    capacity: number | null;
    bedCount: number | null;
    propertyType: string | null;
  };
  location: string | null;
  hostInfo: string | null;
  rulesCount: number;
}) {
  const amenitiesAvailability = getFieldAvailability({
    platform: input.platform,
    kind: "amenities",
    valuePresent: input.amenitiesCount > 0,
    relatedHostInfo: input.hostInfo,
    relatedRulesCount: input.rulesCount,
  });

  return averageAvailableScores([
    scoreDescription(input.description, input.descriptionMeta?.source),
    scoreAmenities(input.amenitiesCount, amenitiesAvailability),
    scoreStructure(input.structure),
    scoreLocation(input.location),
  ]);
}

function computeDataQualityScore(input: {
  platform: GuestSupportedPlatform;
  title: string;
  description: string;
  descriptionMeta: ExtractedListing["descriptionMeta"];
  photoCount: number;
  photoMeta: ExtractedListing["photoMeta"];
  amenitiesCount: number;
  ratingValue: number | null;
  reviewCount: number | null;
  structure: {
    bedrooms: number | null;
    bathrooms: number | null;
    capacity: number | null;
    bedCount: number | null;
    propertyType: string | null;
  };
  location: string | null;
  hostInfo: string | null;
  rulesCount: number;
}) {
  const statuses: FieldAvailability[] = [
    getFieldAvailability({
      platform: input.platform,
      kind: "title",
      valuePresent: Boolean(input.title.trim()),
    }),
    getFieldAvailability({
      platform: input.platform,
      kind: "description",
      valuePresent: Boolean(input.description.trim()),
      source: input.descriptionMeta?.source,
      confidence: input.descriptionMeta?.confidence ?? null,
      metaQuality: input.descriptionMeta?.quality,
    }),
    getFieldAvailability({
      platform: input.platform,
      kind: "photos",
      valuePresent: input.photoCount > 0,
      source: input.photoMeta?.source,
      confidence: input.photoMeta?.confidence ?? null,
      metaQuality: input.photoMeta?.quality,
    }),
    getFieldAvailability({
      platform: input.platform,
      kind: "amenities",
      valuePresent: input.amenitiesCount > 0,
      relatedHostInfo: input.hostInfo,
      relatedRulesCount: input.rulesCount,
    }),
    getFieldAvailability({
      platform: input.platform,
      kind: "rating",
      valuePresent: input.ratingValue != null,
    }),
    getFieldAvailability({
      platform: input.platform,
      kind: "reviewCount",
      valuePresent: input.reviewCount != null,
    }),
    getFieldAvailability({
      platform: input.platform,
      kind: "structure",
      valuePresent: scoreStructure(input.structure) != null,
    }),
    getFieldAvailability({
      platform: input.platform,
      kind: "location",
      valuePresent: Boolean(input.location),
    }),
    getFieldAvailability({
      platform: input.platform,
      kind: "host",
      valuePresent: Boolean(input.hostInfo),
    }),
    getFieldAvailability({
      platform: input.platform,
      kind: "rules",
      valuePresent: input.rulesCount > 0,
    }),
  ];

  const statusScores = statuses.map((status) => {
    switch (status) {
      case "available-good":
        return 10;
      case "available-partial":
        return 7;
      case "unavailable-public":
        return 8.5;
      case "missing-probable-issue":
        return 3.5;
    }
  });

  return averageAvailableScores(statusScores);
}

function computeMetaAwareSubScore(input: {
  key: string;
  label: string;
  weight: number;
  baseScore: number;
  quality?: ListingFieldQuality;
  confidence?: number | null;
  available: boolean;
}): AuditSubScore {
  if (!input.available) {
    return {
      key: input.key,
      label: input.label,
      status: "unavailable",
      score: null,
      weight: input.weight,
      isDataReliable: false,
      reason: "missing",
    };
  }

  const quality = normalizeMetaQuality(input.quality);
  const confidence = input.confidence ?? 1;
  const reliable = isDataReliable(confidence);

  if (quality === "missing") {
    return {
      key: input.key,
      label: input.label,
      status: "unavailable",
      score: null,
      weight: input.weight,
      isDataReliable: false,
      reason: "missing",
    };
  }

  if (confidence < 0.5) {
    return {
      key: input.key,
      label: input.label,
      status: "partial",
      score: clamp(Math.min(input.baseScore, input.weight * 0.2), 0, input.weight),
      weight: input.weight,
      isDataReliable: false,
      reason: "low_confidence",
    };
  }

  if (quality === "full") {
    return {
      key: input.key,
      label: input.label,
      status: "scored",
      score: clamp(input.baseScore, 0, input.weight),
      weight: input.weight,
      isDataReliable: reliable,
      reason: "high_quality",
    };
  }

  if (quality === "partial") {
    return {
      key: input.key,
      label: input.label,
      status: "partial",
      score: clamp(Math.min(input.baseScore, input.weight * 0.7), 0, input.weight),
      weight: input.weight,
      isDataReliable: reliable,
      reason: "partial_quality",
    };
  }

  return {
    key: input.key,
    label: input.label,
    status: reliable ? "scored" : "partial",
    score:
      confidence >= 0.7
        ? clamp(Math.min(input.baseScore, input.weight * 0.4), 0, input.weight)
        : clamp(Math.min(input.baseScore, input.weight * 0.25), 0, input.weight),
    weight: input.weight,
    isDataReliable: reliable,
    reason: confidence >= 0.7 ? "weak_quality" : "weak_quality_low_confidence",
  };
}

function buildAuditSubScores(input: {
  platform: GuestSupportedPlatform;
  photoCount: number;
  photoMeta: ExtractedListing["photoMeta"];
  descriptionLength: number;
  descriptionMeta: ExtractedListing["descriptionMeta"];
  amenitiesCount: number;
  hostInfo: string | null;
  rulesCount: number;
  title: string;
  ratingValue: number | null;
  ratingScale: number | null;
  reviewCount: number | null;
  occupancyObservation: ExtractedListing["occupancyObservation"];
}): AuditSubScore[] {
  const photoBaseScore = getPhotoPoints(input.photoCount);
  const descriptionBaseScore = getDescriptionPoints(input.descriptionLength);
  const amenitiesBaseScore = getAmenitiesPoints(input.amenitiesCount);
  const titleBaseScore = getTitlePoints(input.title);
  const normalizedReputation =
    normalizeRatingToFiveScale(input.ratingValue, input.ratingScale) ?? input.ratingValue;
  const reputationBaseScore =
    normalizedReputation == null || input.reviewCount == null
      ? 0
      : clamp(
          (normalizedReputation / 5) * 1.4 +
            clamp(input.reviewCount / 20, 0, 0.6) -
            (normalizedReputation < 3 ? 0.9 : normalizedReputation < 3.75 ? 0.35 : 0) -
            (input.reviewCount < 5 ? 0.35 : 0),
          0,
          2
        );

  return [
    computeMetaAwareSubScore({
      key: "photos",
      label: "Photos",
      weight: 3,
      baseScore: photoBaseScore,
      quality: input.photoMeta?.quality,
      confidence: input.photoMeta?.confidence ?? null,
      available: input.photoCount > 0,
    }),
    computeMetaAwareSubScore({
      key: "description",
      label: "Description",
      weight: 3,
      baseScore: descriptionBaseScore,
      quality: input.descriptionMeta?.quality,
      confidence: input.descriptionMeta?.confidence ?? null,
      available: input.descriptionLength > 0,
    }),
    {
      key: "amenities",
      label: "Equipements",
      status: input.amenitiesCount > 0 ? "scored" : "unavailable",
      score: input.amenitiesCount > 0 ? amenitiesBaseScore : null,
      weight: 2,
      isDataReliable: input.amenitiesCount > 0,
      reason:
        input.amenitiesCount > 0
          ? "count_based"
          : input.platform === "vrbo" && !input.hostInfo && input.rulesCount === 0
            ? "not_publicly_exposed"
            : "missing",
    },
    {
      key: "title",
      label: "Titre",
      status: input.title.trim() ? "scored" : "unavailable",
      score: input.title.trim() ? titleBaseScore : null,
      weight: 2,
      isDataReliable: Boolean(input.title.trim()),
      reason: input.title.trim() ? "title_based" : "missing",
    },
    {
      key: "reputation",
      label: "Reputation",
      status:
        input.ratingValue != null && input.reviewCount != null ? "scored" : "unavailable",
      score:
        input.ratingValue != null && input.reviewCount != null ? reputationBaseScore : null,
      weight: 2,
      isDataReliable: input.ratingValue != null && input.reviewCount != null,
      reason:
        input.ratingValue != null && input.reviewCount != null
          ? "rating_review_based"
          : "missing",
    },
    {
      key: "occupancy",
      label: "Occupation observee",
      status:
        input.occupancyObservation?.status === "available" ? "partial" : "unavailable",
      score: null,
      weight: 0,
      isDataReliable: input.occupancyObservation?.status === "available",
      reason:
        input.occupancyObservation?.status === "available"
          ? "observed_not_scored"
          : "unavailable",
    },
  ];
}

function computeGuestAuditScoreV2(breakdown: ScoreBreakdown) {
  const weightedParts: Array<{ score: number; weight: number }> = [];

  if (breakdown.visibility != null) weightedParts.push({ score: breakdown.visibility, weight: 0.4 });
  if (breakdown.trust != null) weightedParts.push({ score: breakdown.trust, weight: 0.25 });
  if (breakdown.conversion != null) weightedParts.push({ score: breakdown.conversion, weight: 0.25 });
  if (breakdown.dataQuality != null) weightedParts.push({ score: breakdown.dataQuality, weight: 0.1 });

  if (weightedParts.length === 0) return 0;

  const weightedTotal = weightedParts.reduce((sum, part) => sum + part.score * part.weight, 0);
  const totalWeight = weightedParts.reduce((sum, part) => sum + part.weight, 0);

  return Math.round(clamp(weightedTotal / totalWeight, 0, 10) * 10) / 10;
}

function getMetaConfidence(meta: { confidence?: number | null } | null | undefined) {
  return meta?.confidence ?? 1;
}

function buildSummary(score: number) {
  if (score >= 8) {
    return "Annonce bien structuree, avec une base visuelle et descriptive deja solide.";
  }
  if (score >= 6) {
    return "Annonce exploitable, mais plusieurs elements visibles peuvent encore etre renforces.";
  }
  return "Annonce encore partielle sur les signaux detectes, avec des informations a mieux structurer.";
}

function buildPhotoInsight(
  photoCount: number,
  photoMeta: ExtractedListing["photoMeta"],
  platform: GuestSupportedPlatform
) {
  if (photoCount <= 0 && getMetaConfidence(photoMeta) < 0.5) {
    return "Nous n'avons pas pu confirmer de galerie photo exploitable sur cette annonce.";
  }
  if (photoCount <= 0) {
    return "Aucune photo exploitable n'a ete detectee : la presentation visuelle du logement ne ressort pas.";
  }

  if (photoCount < 10 && getMetaConfidence(photoMeta) < 0.5) {
    return "Nous n'avons peut-etre recupere qu'une partie de la galerie photo de l'annonce.";
  }

  if (platform === "vrbo" && photoMeta?.source === "body_photo_total" && photoCount > 0) {
    return `${photoCount} photos visibles ont pu etre confirmees sur cette page, mais la galerie complete n'est pas publiquement exposee de facon structuree.`;
  }

  if (photoCount < 10) {
    return `${photoCount} photos detectees : la couverture visuelle reste limitee et freine encore la projection du voyageur.`;
  }
  if (photoCount < 20) {
    return `${photoCount} photos detectees : la couverture visuelle est correcte et soutient deja la conversion, meme si certains espaces restent moins visibles.`;
  }
  return `${photoCount} photos detectees : la couverture visuelle est excellente et soutient bien la conversion.`;
}

function buildDescriptionInsight(
  descriptionLength: number,
  descriptionMeta: ExtractedListing["descriptionMeta"],
  platform: GuestSupportedPlatform
) {
  if (descriptionLength <= 0 && getMetaConfidence(descriptionMeta) < 0.5) {
    return "Nous n'avons peut-etre pas pu recuperer correctement la description de cette annonce.";
  }
  if (descriptionLength <= 0) {
    return "Aucune description exploitable n'a ete detectee : le contexte du logement reste tres limite.";
  }
  if (
    platform === "vrbo" &&
    (descriptionMeta?.source === "og_description" ||
      descriptionMeta?.source === "meta_description") &&
    getMetaConfidence(descriptionMeta) < 0.7
  ) {
    return "Seule une description courte publiquement visible a pu etre recuperee sur cette page.";
  }
  if (descriptionMeta?.quality === "low" && getMetaConfidence(descriptionMeta) < 0.7) {
    return "Nous n'avons peut-etre recupere qu'une partie de la description.";
  }
  if (descriptionMeta?.quality === "low" && getMetaConfidence(descriptionMeta) >= 0.7) {
    return "La description reste courte et limite encore le niveau de reassurance.";
  }
  if (descriptionLength < 300) {
    return "La description apporte encore peu de contexte utile pour convertir le voyageur.";
  }
  if (descriptionLength < 1000) {
    return "La description couvre l'essentiel, mais elle peut mieux mettre en avant les avantages differenciants du sejour.";
  }
  return "La description est detaillee et soutient deja bien la conversion.";
}

function buildOccupancyInsight(
  occupancyObservation: ExtractedListing["occupancyObservation"]
) {
  if (occupancyObservation?.status === "unavailable") {
    return "Les donnees d'occupation ne sont pas disponibles pour cette annonce.";
  }

  return null;
}

function buildAmenitiesInsight(
  amenitiesCount: number,
  platform: GuestSupportedPlatform,
  hostInfo: string | null,
  rulesCount: number
) {
  if (amenitiesCount <= 0) {
    if (platform === "vrbo" && !hostInfo && rulesCount === 0) {
      return "Certaines informations, comme les equipements detailles, l'hote ou les regles, ne sont pas publiquement exposees sur cette page.";
    }
    return "Aucun equipement exploitable n'a ete detecte : le niveau de reassurance reste faible sur la fiche.";
  }
  if (amenitiesCount < 5) {
    return "Peu d'equipements detectes : les signaux utiles a la conversion ressortent encore peu.";
  }
  if (amenitiesCount < 15) {
    return `${amenitiesCount} equipements detectes : la fiche couvre les attentes de base, mais peut encore mieux rassurer.`;
  }
  return `${amenitiesCount} equipements detectes : la fiche met bien en avant les amenites utiles a la conversion.`;
}

function buildLocationInsight(location: string | null) {
  if (!location) {
    return "Localisation non detectee de facon fiable sur cette page.";
  }

  return `Localisation detectee : ${location}.`;
}

function buildTitleInsight(title: string) {
  const normalized = title.trim();

  if (!normalized || normalized === "Titre non detecte") {
    return "Le titre n'a pas ete detecte de facon exploitable sur la page.";
  }

  if (hasDescriptiveTitle(normalized)) {
    return "Le titre met deja en avant le type de bien ou un atout utile pour le voyageur.";
  }

  if (normalized.length < 18) {
    return "Le titre detecte reste tres court et apporte peu de contexte sur le logement.";
  }

  return "Le titre est present, mais il met encore peu en avant l'atout principal du bien.";
}

function formatFrenchNumber(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1).replace(".", ",");
}

function normalizeRatingToFiveScale(rating: number | null, scale: number | null) {
  if (rating == null) return null;
  if (!scale || scale <= 0 || scale === 5) return rating;
  return (rating / scale) * 5;
}

function buildReputationInsight(
  rating: number | null,
  reviewCount: number | null,
  ratingScale: number | null
) {
  if (rating == null || reviewCount == null) {
    return null;
  }

  const normalizedRating = formatFrenchNumber(rating);
  const displayScale = ratingScale && ratingScale > 0 ? ratingScale : 5;
  const comparableRating = normalizeRatingToFiveScale(rating, displayScale) ?? rating;

  if (comparableRating < 3) {
    return `Note ${normalizedRating}/${displayScale} sur ${reviewCount} avis : la note client est faible et peut freiner fortement la conversion.`;
  }

  if (comparableRating < 3.75) {
    return `Note ${normalizedRating}/${displayScale} sur ${reviewCount} avis : la note client reste moyenne et limite le niveau de reassurance.`;
  }

  if (reviewCount < 5) {
    return `Note ${normalizedRating}/${displayScale} sur ${reviewCount} avis : le nombre d'avis reste faible, ce qui limite encore la credibilite percue.`;
  }

  if (reviewCount >= 20 && comparableRating >= 4.6) {
    return `Note ${normalizedRating}/${displayScale} sur ${reviewCount} avis : le niveau de reassurance voyageurs est deja solide.`;
  }

  if (reviewCount < 10) {
    return `Note ${normalizedRating}/${displayScale} sur ${reviewCount} avis : le signal de reassurance existe, mais reste encore limite.`;
  }

  if (comparableRating < 4.3) {
    return `Note ${normalizedRating}/${displayScale} sur ${reviewCount} avis : la reputation visible parait plus fragile que la moyenne attendue.`;
  }

  return `Note ${normalizedRating}/${displayScale} sur ${reviewCount} avis : la fiche affiche deja un retour voyageurs exploitable.`;
}

function buildStructureInsight(input: {
  guestCapacity: number | null;
  bedroomCount: number | null;
  bedCount: number | null;
  bathroomCount: number | null;
}) {
  const parts: string[] = [];

  if (input.guestCapacity != null) {
    parts.push(
      `${input.guestCapacity} voyageur${input.guestCapacity > 1 ? "s" : ""}`
    );
  }

  if (input.bedroomCount != null) {
    parts.push(
      `${input.bedroomCount} chambre${input.bedroomCount > 1 ? "s" : ""}`
    );
  }

  if (input.bedCount != null) {
    parts.push(`${input.bedCount} lit${input.bedCount > 1 ? "s" : ""}`);
  }

  if (input.bathroomCount != null) {
    parts.push(
      `${formatFrenchNumber(input.bathroomCount)} salle${input.bathroomCount > 1 ? "s" : ""} de bain`
    );
  }

  if (parts.length < 2) {
    return null;
  }

  return `Structure du bien detectee : ${parts.slice(0, 3).join(", ")}.`;
}

function buildContextualSummary(input: {
  score: number;
  platform: GuestSupportedPlatform;
  photoCount: number;
  photoMeta: ExtractedListing["photoMeta"];
  descriptionLength: number;
  descriptionMeta: ExtractedListing["descriptionMeta"];
  amenitiesCount: number;
  hostInfo: string | null;
  rulesCount: number;
}) {
  const photoStatus =
    input.photoCount <= 0 && getMetaConfidence(input.photoMeta) < 0.5
      ? "une galerie potentiellement partielle"
      : input.photoCount < 10
      ? "une couverture visuelle faible"
      : input.photoCount < 20
        ? "une couverture visuelle correcte"
        : "une couverture visuelle excellente";
  const descriptionStatus =
    input.descriptionLength <= 0 && getMetaConfidence(input.descriptionMeta) < 0.5
      ? "une description potentiellement partielle"
      : input.descriptionLength < 300
      ? "une description courte"
      : input.descriptionLength < 1000
        ? "une description correcte"
        : "une description complete";
  const amenitiesStatus =
    input.platform === "vrbo" && input.amenitiesCount <= 0 && !input.hostInfo && input.rulesCount === 0
      ? "certaines informations non publiquement exposees"
      : input.amenitiesCount < 8
      ? "des equipements encore peu visibles"
      : "des equipements correctement renseignes";

  if (input.score >= 8) {
    return `Annonce bien structuree, avec ${photoStatus}, ${descriptionStatus} et ${amenitiesStatus}.`;
  }

  if (input.score >= 6) {
    return `Annonce exploitable, mais l'audit detecte ${photoStatus}, ${descriptionStatus} et ${amenitiesStatus}.`;
  }

  return `Annonce encore inegale, avec ${photoStatus}, ${descriptionStatus} et ${amenitiesStatus}.`;
}

function buildRecommendations(input: {
  platform: GuestSupportedPlatform;
  photoCount: number;
  photoMeta: ExtractedListing["photoMeta"];
  descriptionLength: number;
  descriptionMeta: ExtractedListing["descriptionMeta"];
  amenitiesCount: number;
  hostInfo: string | null;
  rulesCount: number;
  title: string;
  ratingValue: number | null;
  ratingScale: number | null;
  reviewCount: number | null;
}) {
  const candidates: string[] = [];
  const comparableRating =
    normalizeRatingToFiveScale(input.ratingValue, input.ratingScale) ?? input.ratingValue;

  if (comparableRating != null && comparableRating < 3) {
    candidates.push("Ameliorez l'experience client pour faire remonter la note globale.");
    candidates.push("Analysez les retours voyageurs et corrigez les irritants recurrents.");
  } else if (comparableRating != null && comparableRating < 3.75) {
    candidates.push("Ameliorez l'experience client pour renforcer le niveau de reassurance.");
  }

  if (input.reviewCount != null && input.reviewCount < 5) {
    candidates.push("Encouragez davantage d'avis clients pour consolider la credibilite de l'annonce.");
  }

  if (comparableRating != null && comparableRating < 3) {
    candidates.push(
      "Travaillez les points faibles visibles dans les retours clients avant d'optimiser seulement le contenu."
    );
  }

  if (!(input.platform === "vrbo" && input.photoMeta?.source === "body_photo_total") && input.photoCount < 10) {
    candidates.push("Ajoutez plus de photos pour mieux presenter le logement.");
  }

  const isVrboPublicDescriptionOnly =
    input.platform === "vrbo" &&
    (input.descriptionMeta?.source === "og_description" ||
      input.descriptionMeta?.source === "meta_description") &&
    getMetaConfidence(input.descriptionMeta) < 0.7;

  if (!isVrboPublicDescriptionOnly && input.descriptionLength < 300) {
    candidates.push("Ameliorez la description pour donner plus de contexte aux voyageurs.");
  } else if (!isVrboPublicDescriptionOnly && input.descriptionLength < 900) {
    candidates.push("Renforcez la description avec des details plus differenciants sur l'experience de sejour.");
  }

  const isVrboPublicDataUnavailable =
    input.platform === "vrbo" && input.amenitiesCount <= 0 && !input.hostInfo && input.rulesCount === 0;

  if (!isVrboPublicDataUnavailable && input.amenitiesCount < 8) {
    candidates.push("Ajoutez ou rendez plus visibles les equipements essentiels.");
  } else if (!isVrboPublicDataUnavailable && input.amenitiesCount < 15) {
    candidates.push("Mettez davantage en avant les equipements deja presents pour renforcer la reassurance.");
  }

  if (!hasDescriptiveTitle(input.title) || input.title.trim().length < 18) {
    candidates.push("Retravaillez le titre pour mettre plus clairement en avant le type de bien ou son atout principal.");
  }

  const selected = uniqueStrings(candidates).slice(0, 3);

  console.log("[guest-audit][guest-builder][recommendations] candidates:", candidates);
  console.log("[guest-audit][guest-builder][recommendations] selected:", selected);

  return selected;
}

export function buildGuestAuditPreview(input: {
  extracted: ExtractedListing;
  competitors?: ExtractedListing[];
}): GuestAuditPreview {
  const { extracted } = input;
  const photoCount =
    typeof extracted.photosCount === "number"
      ? extracted.photosCount
      : Array.isArray(extracted.photos)
        ? extracted.photos.filter(Boolean).length
        : 0;
  const descriptionLength = (extracted.description ?? "").trim().length;
  const amenitiesCount = Array.isArray(extracted.amenities)
    ? extracted.amenities.filter(Boolean).length
    : 0;
  const hostInfo = typeof extracted.hostInfo === "string" ? extracted.hostInfo.trim() : "";
  const rulesCount = Array.isArray(extracted.rules) ? extracted.rules.filter(Boolean).length : 0;
  const location = normalizeAuditLocaleToFrench(extracted.locationLabel ?? null);
  const resolvedPropertyType =
    getListingPropertyType(extracted) ?? inferPropertyTypeFromLabel(location);
  const hasLocation = Boolean(location);
  const title = normalizeAuditLocaleToFrench(extracted.title || "Titre non detecte");
  const platform = extracted.sourcePlatform ?? extracted.platform ?? detectPlatformFromUrl(extracted.url);
  const ratingScale =
    typeof extracted.ratingScale === "number" ? extracted.ratingScale : 5;
  const ratingValue =
    typeof extracted.ratingValue === "number"
      ? extracted.ratingValue
      : typeof extracted.rating === "number"
        ? extracted.rating
        : null;
  const reviewCount = typeof extracted.reviewCount === "number" ? extracted.reviewCount : null;
  const guestCapacity =
    typeof extracted.guestCapacity === "number"
      ? extracted.guestCapacity
      : typeof extracted.capacity === "number"
        ? extracted.capacity
        : null;
  const bedroomCount =
    typeof extracted.bedroomCount === "number"
      ? extracted.bedroomCount
      : typeof extracted.bedrooms === "number"
        ? extracted.bedrooms
        : null;
  const bathroomCount =
    typeof extracted.bathroomCount === "number"
      ? extracted.bathroomCount
      : typeof extracted.bathrooms === "number"
        ? extracted.bathrooms
        : null;
  const bedCount = typeof extracted.bedCount === "number" ? extracted.bedCount : null;

  const occupancyObservation = normalizeOccupancyObservation(
    extracted.occupancyObservation ?? null
  );
  const subScores = buildAuditSubScores({
    platform,
    photoCount,
    photoMeta: extracted.photoMeta,
    descriptionLength,
    descriptionMeta: extracted.descriptionMeta,
    amenitiesCount,
    hostInfo: hostInfo || null,
    rulesCount,
    title,
    ratingValue,
    ratingScale,
    reviewCount,
    occupancyObservation,
  });
  const scoreBreakdown: ScoreBreakdown = {
    visibility: computeVisibilityScore({
      title,
      photoCount,
      photoMeta: extracted.photoMeta,
      ratingValue,
      ratingScale,
      reviewCount,
    }),
    trust: computeTrustScore({
      platform,
      ratingValue,
      ratingScale,
      reviewCount,
      hostInfo: hostInfo || null,
      rulesCount,
    }),
    conversion: computeConversionScore({
      platform,
      description: extracted.description ?? "",
      descriptionMeta: extracted.descriptionMeta,
      amenitiesCount,
      structure: {
        bedrooms: bedroomCount,
        bathrooms: bathroomCount,
        capacity: guestCapacity,
        bedCount,
        propertyType: resolvedPropertyType,
      },
      location: location || null,
      hostInfo: hostInfo || null,
      rulesCount,
    }),
    dataQuality: computeDataQualityScore({
      platform,
      title,
      description: extracted.description ?? "",
      descriptionMeta: extracted.descriptionMeta,
      photoCount,
      photoMeta: extracted.photoMeta,
      amenitiesCount,
      ratingValue,
      reviewCount,
      structure: {
        bedrooms: bedroomCount,
        bathrooms: bathroomCount,
        capacity: guestCapacity,
        bedCount,
        propertyType: resolvedPropertyType,
      },
      location: location || null,
      hostInfo: hostInfo || null,
      rulesCount,
    }),
  };
  const recalculatedScore = computeGuestAuditScoreV2(scoreBreakdown);
  const marketPositioning = buildMarketPositioning({
    extracted,
    competitors: Array.isArray(input.competitors) ? input.competitors : [],
  });

  debugGuestAuditLog("[guest-audit][builder][score-v2]", {
    platform,
    globalScore: recalculatedScore,
    scoreBreakdown,
    subInputs: {
      title,
      description: {
        length: descriptionLength,
        source: extracted.descriptionMeta?.source ?? null,
        quality: extracted.descriptionMeta?.quality ?? null,
      },
      photosCount: photoCount,
      amenitiesCount,
      ratingValue,
      ratingScale,
      reviewCount,
      structure: {
        guestCapacity,
        bedroomCount,
        bedCount,
        bathroomCount,
        propertyType: resolvedPropertyType,
      },
      locationLabel: location || null,
      hostInfoPresent: Boolean(hostInfo),
      rulesCount,
    },
  });

  const prioritizedInsights = [
    {
      category: "photos",
      priority: photoCount <= 0 ? 100 : photoCount < 10 ? 95 : photoCount < 20 ? 72 : 46,
      text: buildPhotoInsight(photoCount, extracted.photoMeta, platform),
    },
    {
      category: "description",
      priority:
        descriptionLength <= 0 ? 98 : descriptionLength < 300 ? 90 : descriptionLength < 1000 ? 64 : 42,
      text: buildDescriptionInsight(descriptionLength, extracted.descriptionMeta, platform),
    },
    {
      category: "amenities",
      priority: amenitiesCount <= 0 ? 94 : amenitiesCount < 5 ? 86 : amenitiesCount < 15 ? 61 : 40,
      text: buildAmenitiesInsight(amenitiesCount, platform, hostInfo || null, rulesCount),
    },
    {
      category: "title",
      priority:
        !title || title === "Titre non detecte"
          ? 88
          : hasDescriptiveTitle(title)
            ? 34
            : title.trim().length < 18
              ? 74
              : 52,
      text: buildTitleInsight(title),
    },
    {
      category: "trust",
      priority:
        ratingValue == null || reviewCount == null
          ? -1
          : reviewCount < 10
            ? 66
            : (normalizeRatingToFiveScale(ratingValue, ratingScale) ?? ratingValue) < 4.3
              ? 68
              : reviewCount >= 20 &&
                  (normalizeRatingToFiveScale(ratingValue, ratingScale) ?? ratingValue) >= 4.6
                ? 58
                : 47,
      text: buildReputationInsight(ratingValue, reviewCount, ratingScale),
    },
    {
      category: "structure",
      priority:
        guestCapacity == null &&
        bedroomCount == null &&
        bedCount == null &&
        bathroomCount == null
          ? -1
          : 50,
      text: buildStructureInsight({
        guestCapacity,
        bedroomCount,
        bedCount,
        bathroomCount,
      }),
    },
    {
      category: "location",
      priority: hasLocation ? 24 : 54,
      text: buildLocationInsight(location || null),
    },
    {
      category: "occupancy",
      priority: occupancyObservation?.status === "unavailable" ? 18 : -1,
      text: buildOccupancyInsight(occupancyObservation),
    },
    {
      category: "platform",
      priority: platform === "other" ? 12 : 14,
      text:
        platform === "airbnb"
          ? "La plateforme Airbnb a bien ete detectee pour cette annonce."
          : platform === "booking"
            ? "La plateforme Booking a bien ete detectee pour cette annonce."
            : platform === "vrbo"
              ? "La plateforme Vrbo a bien ete detectee pour cette annonce."
              : platform === "agoda"
                ? "La plateforme Agoda a bien ete detectee pour cette annonce."
              : null,
    },
  ]
    .filter((item) => item.priority >= 0 && item.text)
    .sort((a, b) => b.priority - a.priority);

  const insights = uniqueStrings(
    prioritizedInsights
      .filter(
        (item, index, array) =>
          array.findIndex((candidate) => candidate.category === item.category) === index
      )
      .map((item) => item.text)
  )
    .map((value) => normalizeAuditLocaleToFrench(value))
    .slice(0, 3);

  const recommendations = uniqueStrings(
    buildRecommendations({
      platform,
      photoCount,
      photoMeta: extracted.photoMeta,
      descriptionLength,
      descriptionMeta: extracted.descriptionMeta,
      amenitiesCount,
      hostInfo: hostInfo || null,
      rulesCount,
      title,
      ratingValue,
      ratingScale,
      reviewCount,
    })
  )
    .map((value) => normalizeAuditLocaleToFrench(value))
    .slice(0, 2);

  return {
    listing_url: extracted.canonicalUrl ?? extracted.url,
    title,
    platform,
    score: recalculatedScore,
    insights,
    recommendations,
    summary:
      buildContextualSummary({
        score: recalculatedScore,
        platform,
        photoCount,
        photoMeta: extracted.photoMeta,
        descriptionLength,
        descriptionMeta: extracted.descriptionMeta,
        amenitiesCount,
        hostInfo: hostInfo || null,
        rulesCount,
      }) || buildSummary(recalculatedScore),
    marketComparison:
      marketPositioning.comparableCount > 0 ? marketPositioning.summary : null,
    estimatedRevenue: null,
    bookingPotential: null,
    occupancyObservation,
    subScores,
    marketPositioning,
    scoreBreakdown,
  };
}

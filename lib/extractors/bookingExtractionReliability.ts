import type { ExtractedListing } from "./types";

const UNTITLED_BOOKING_FALLBACK = "Untitled Booking listing";

function normalizedTitle(listing: ExtractedListing): string {
  return typeof listing.title === "string"
    ? listing.title.trim()
    : "";
}

function normalizedDescription(listing: ExtractedListing): string {
  return typeof listing.description === "string"
    ? listing.description.trim()
    : "";
}

function usablePhotoCount(listing: ExtractedListing): number {
  if (!Array.isArray(listing.photos)) return 0;

  return new Set(
    listing.photos
      .filter((photo): photo is string => typeof photo === "string")
      .map((photo) => photo.trim())
      .filter((photo) => /^https?:\/\//i.test(photo)),
  ).size;
}

function amenitiesCount(listing: ExtractedListing): number {
  return Array.isArray(listing.amenities)
    ? listing.amenities.filter(Boolean).length
    : 0;
}

/**
 * Booking extraction reliability contract.
 *
 * Fail closed from actual extracted evidence, not from declared counters.
 * A Booking challenge/generic-page warning remains additional evidence,
 * but the absence of a warning must never make an empty extraction reliable.
 *
 * The currently validated real Booking fixture has substantial title,
 * description and real gallery evidence. We deliberately keep amenities
 * as a soft signal because some otherwise usable Booking pages may expose
 * them incompletely.
 */
export function isUnreliableBookingExtraction(
  extracted: ExtractedListing,
): boolean {
  if (String(extracted.platform ?? "").toLowerCase() !== "booking") {
    return false;
  }

  const warnings = extracted.extractionMeta?.warnings;

  const hasUnreliableWarning =
    Array.isArray(warnings) &&
    (warnings.includes("booking_challenge_detected") ||
      warnings.includes("booking_generic_page_detected"));

  const title = normalizedTitle(extracted);

  const hasRealTitle =
    title.length >= 5 &&
    title !== UNTITLED_BOOKING_FALLBACK;

  const descriptionLength =
    normalizedDescription(extracted).length;

  const photoCount = usablePhotoCount(extracted);

  // Core listing evidence must exist independently of warning detection.
  if (!hasRealTitle) return true;
  if (descriptionLength < 80) return true;
  if (photoCount < 3) return true;

  // A challenge/generic-page warning is tolerated only when the extracted
  // listing still contains enough independent real evidence.
  if (hasUnreliableWarning) {
    const hasPrice =
      typeof extracted.price === "number" &&
      Number.isFinite(extracted.price) &&
      extracted.price > 0;

    const hasAmenities = amenitiesCount(extracted) > 0;

    if (!hasPrice && !hasAmenities) return true;
  }

  return false;
}

export function logBookingTargetExtractionUnreliable(
  route: string,
  url: string | null,
  extracted: ExtractedListing,
): void {
  const warnings = extracted.extractionMeta?.warnings;

  console.warn(
    "[booking][target-extraction-unreliable]",
    JSON.stringify({
      route,
      url:
        url && url.length > 280
          ? `${url.slice(0, 277)}...`
          : url,
      warnings: Array.isArray(warnings) ? warnings : null,
      price: extracted.price ?? null,
      title: extracted.title ?? null,
      photosCount: usablePhotoCount(extracted),
      declaredPhotosCount:
        typeof extracted.photosCount === "number"
          ? extracted.photosCount
          : null,
      amenitiesCount: amenitiesCount(extracted),
      descriptionLength:
        normalizedDescription(extracted).length,
    }),
  );
}

export const BOOKING_EXTRACTION_UNAVAILABLE_BODY = {
  error: "booking_extraction_unavailable",
  message:
    "Booking bloque temporairement l’analyse de cette annonce. Votre audit n’a pas été exécuté et aucun crédit n’a été débité. Réessayez dans quelques minutes ou choisissez d’autres dates.",
  retryable: true,
  creditDebited: false,
  auditCreated: false,
} as const;

export function logBookingTargetExtractionUnreliableNoCredit(payload: {
  route: string;
  url: string | null;
  reason: string;
}): void {
  const { route, url, reason } = payload;

  const safeUrl =
    url && url.length > 280
      ? `${url.slice(0, 277)}...`
      : url;

  console.warn(
    "[booking][target-extraction-unreliable-no-credit]",
    JSON.stringify({
      route,
      url: safeUrl,
      creditDebited: false,
      auditCreated: false,
      reason,
    }),
  );
}

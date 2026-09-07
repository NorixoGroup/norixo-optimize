import type { ExtractedListing } from "./types";

export const EXPEDIA_EXTRACTION_UNAVAILABLE_BODY = {
  code: "expedia_extraction_unavailable",
  error:
    "L’extraction de cette annonce Expedia est temporairement indisponible. Aucun audit n’a été généré à partir de données incomplètes.",
} as const;

function normalizedTextLength(value: unknown): number {
  if (typeof value !== "string") {
    return 0;
  }

  return value.replace(/\s+/g, " ").trim().length;
}

function usablePhotoCount(listing: ExtractedListing): number {
  if (!Array.isArray(listing.photos)) {
    return 0;
  }

  return new Set(
    listing.photos
      .filter(
        (value): value is string =>
          typeof value === "string" &&
          /^https?:\/\//i.test(value.trim()),
      )
      .map((value) => value.trim()),
  ).size;
}

export type ExpediaExtractionReliability = {
  platform: string | null;
  isExpedia: boolean;
  reliable: boolean;
  titleLength: number;
  descriptionLength: number;
  photoCount: number;
  amenityCount: number;
  reasons: string[];
};

export function evaluateExpediaExtractionReliability(
  listing: ExtractedListing,
): ExpediaExtractionReliability {
  const platform =
    typeof listing.platform === "string"
      ? listing.platform.toLowerCase()
      : null;

  const isExpedia = platform === "expedia";

  const titleLength = normalizedTextLength(listing.title);
  const descriptionLength = normalizedTextLength(listing.description);
  const photoCount = usablePhotoCount(listing);
  const amenityCount = Array.isArray(listing.amenities)
    ? listing.amenities.filter(
        (value) =>
          typeof value === "string" &&
          value.trim().length > 0,
      ).length
    : 0;

  const reasons: string[] = [];

  if (isExpedia) {
    if (titleLength < 5) {
      reasons.push("title_missing_or_too_short");
    }

    if (descriptionLength < 120) {
      reasons.push("description_missing_or_too_short");
    }

    if (photoCount < 3) {
      reasons.push("insufficient_photos");
    }

    /*
     * Amenities are deliberately not a hard failure yet.
     *
     * Some legitimate Expedia pages may expose sparse amenity text.
     * We record the signal, but the fail-closed contract currently
     * requires enough identity/content plus at least three real photos.
     */
    if (amenityCount === 0) {
      reasons.push("amenities_unavailable");
    }
  }

  const hardFailureReasons = new Set([
    "title_missing_or_too_short",
    "description_missing_or_too_short",
    "insufficient_photos",
  ]);

  const reliable =
    !isExpedia ||
    !reasons.some((reason) => hardFailureReasons.has(reason));

  return {
    platform,
    isExpedia,
    reliable,
    titleLength,
    descriptionLength,
    photoCount,
    amenityCount,
    reasons,
  };
}

export function isUnreliableExpediaExtraction(
  listing: ExtractedListing,
): boolean {
  const result = evaluateExpediaExtractionReliability(listing);

  return result.isExpedia && !result.reliable;
}

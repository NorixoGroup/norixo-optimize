import type { ExtractedListing } from "./types";

export const AGODA_EXTRACTION_UNAVAILABLE_BODY = {
  code: "agoda_extraction_unavailable",
  error:
    "L’extraction de cette annonce Agoda est temporairement indisponible. Aucun audit n’a été généré à partir de données incomplètes.",
} as const;

function normalizedText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function usablePhotoCount(listing: ExtractedListing): number {
  const photos = Array.isArray(listing.photos)
    ? listing.photos
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            /^https?:\/\//i.test(value.trim()),
        )
        .map((value) => value.trim())
    : [];

  return new Set(photos).size;
}

export type AgodaExtractionReliability = {
  platform: string | null;
  isAgoda: boolean;
  reliable: boolean;
  titleLength: number;
  descriptionLength: number;
  photoCount: number;
  amenityCount: number;
  reasons: string[];
};

export function evaluateAgodaExtractionReliability(
  listing: ExtractedListing,
): AgodaExtractionReliability {
  const platform =
    typeof listing.platform === "string"
      ? listing.platform.toLowerCase()
      : null;

  const isAgoda = platform === "agoda";
  const titleLength = normalizedText(listing.title).length;
  const descriptionLength = normalizedText(listing.description).length;
  const photoCount = usablePhotoCount(listing);

  const amenityCount = Array.isArray(listing.amenities)
    ? listing.amenities.filter(
        (value) =>
          typeof value === "string" &&
          value.trim().length > 0,
      ).length
    : 0;

  const reasons: string[] = [];

  if (isAgoda) {
    if (titleLength < 5) {
      reasons.push("title_missing_or_too_short");
    }

    /*
     * Agoda-specific fail-closed threshold.
     *
     * A real validated Agoda extraction currently returns a legitimate
     * 108-character description, so the generic 120-character threshold
     * used by some other platform contracts would create a false negative.
     *
     * 80 is therefore a conservative Norixo reliability floor, not a claim
     * about Agoda's own content requirements.
     */
    if (descriptionLength < 80) {
      reasons.push("description_missing_or_too_short");
    }

    if (photoCount < 3) {
      reasons.push("insufficient_photos");
    }

    /*
     * Amenities remain a soft signal.
     * Missing secondary metadata alone must not invalidate an otherwise
     * identifiable listing with sufficient narrative content and photos.
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
    !isAgoda ||
    !reasons.some((reason) =>
      hardFailureReasons.has(reason),
    );

  return {
    platform,
    isAgoda,
    reliable,
    titleLength,
    descriptionLength,
    photoCount,
    amenityCount,
    reasons,
  };
}

export function isUnreliableAgodaExtraction(
  listing: ExtractedListing,
): boolean {
  return !evaluateAgodaExtractionReliability(listing).reliable;
}

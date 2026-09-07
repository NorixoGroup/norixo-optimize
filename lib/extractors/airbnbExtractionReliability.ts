import type { ExtractedListing } from "./types";

export const AIRBNB_EXTRACTION_UNAVAILABLE_BODY = {
  code: "airbnb_extraction_unavailable",
  error:
    "L’extraction de cette annonce Airbnb est temporairement indisponible. Aucun audit n’a été généré à partir de données incomplètes.",
} as const;

function normalizedText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
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

function hasChallengeSignal(listing: ExtractedListing): boolean {
  const title = normalizedText(listing.title);
  const description = normalizedText(listing.description);
  const text = `${title}\n${description}`;

  return /robot ou pas robot|captcha|verify (?:that )?(?:you(?:'re| are) )?(?:not a robot|human)|are you human|access denied|forbidden|challenge-container|awswaf/i.test(
    text,
  );
}

function hasErrorPageSignal(listing: ExtractedListing): boolean {
  const title = normalizedText(listing.title);
  const description = normalizedText(listing.description);
  const text = `${title}\n${description}`;

  return /une erreur s['’]?est produite|something went wrong|an error occurred|we encountered an error|page (?:is )?(?:temporarily )?unavailable/i.test(
    text,
  );
}

export type AirbnbExtractionReliability = {
  platform: string | null;
  isAirbnb: boolean;
  reliable: boolean;
  challengeDetected: boolean;
  errorPageDetected: boolean;
  titleLength: number;
  descriptionLength: number;
  photoCount: number;
  amenityCount: number;
  reasons: string[];
};

export function evaluateAirbnbExtractionReliability(
  listing: ExtractedListing,
): AirbnbExtractionReliability {
  const platform =
    typeof listing.platform === "string"
      ? listing.platform.toLowerCase()
      : null;

  const isAirbnb = platform === "airbnb";

  const titleLength = normalizedText(listing.title).length;
  const descriptionLength =
    normalizedText(listing.description).length;

  const photoCount = usablePhotoCount(listing);

  const amenityCount = Array.isArray(listing.amenities)
    ? listing.amenities.filter(
        (value) =>
          typeof value === "string" &&
          value.trim().length > 0,
      ).length
    : 0;

  const challengeDetected =
    isAirbnb && hasChallengeSignal(listing);

  const errorPageDetected =
    isAirbnb && hasErrorPageSignal(listing);

  const reasons: string[] = [];

  if (isAirbnb) {
    if (challengeDetected) {
      reasons.push("challenge_page_detected");
    }

    if (errorPageDetected) {
      reasons.push("error_page_detected");
    }

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
     * Amenities are intentionally a soft signal.
     *
     * A valid Airbnb page can expose partial secondary metadata,
     * so missing amenities alone must not reject the extraction.
     */
    if (amenityCount === 0) {
      reasons.push("amenities_unavailable");
    }
  }

  const hardFailureReasons = new Set([
    "challenge_page_detected",
    "error_page_detected",
    "title_missing_or_too_short",
    "description_missing_or_too_short",
    "insufficient_photos",
  ]);

  const reliable =
    !isAirbnb ||
    !reasons.some((reason) =>
      hardFailureReasons.has(reason),
    );

  return {
    platform,
    isAirbnb,
    reliable,
    challengeDetected,
    errorPageDetected,
    titleLength,
    descriptionLength,
    photoCount,
    amenityCount,
    reasons,
  };
}

export function isUnreliableAirbnbExtraction(
  listing: ExtractedListing,
): boolean {
  const result =
    evaluateAirbnbExtractionReliability(listing);

  return result.isAirbnb && !result.reliable;
}

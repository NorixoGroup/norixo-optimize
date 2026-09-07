import type { ExtractedListing } from "./types";

export const VRBO_EXTRACTION_UNAVAILABLE_BODY = {
  code: "vrbo_extraction_unavailable",
  error:
    "L’extraction de cette annonce Vrbo ou Abritel est temporairement indisponible. Aucun audit n’a été généré à partir de données incomplètes.",
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

  const challengeText = `${title}\n${description}`;

  return /robot ou pas robot|captcha|verify (?:that )?(?:you(?:'re| are) )?(?:not a robot|human)|are you human|access denied|forbidden|challenge-container|awswaf/i.test(
    challengeText,
  );
}

export type VrboExtractionReliability = {
  platform: string | null;
  isVrbo: boolean;
  reliable: boolean;
  challengeDetected: boolean;
  titleLength: number;
  descriptionLength: number;
  photoCount: number;
  amenityCount: number;
  reasons: string[];
};

export function evaluateVrboExtractionReliability(
  listing: ExtractedListing,
): VrboExtractionReliability {
  const platform =
    typeof listing.platform === "string"
      ? listing.platform.toLowerCase()
      : null;

  const isVrbo = platform === "vrbo";
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

  const challengeDetected =
    isVrbo && hasChallengeSignal(listing);

  const reasons: string[] = [];

  if (isVrbo) {
    if (challengeDetected) {
      reasons.push("challenge_page_detected");
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

    if (amenityCount === 0) {
      reasons.push("amenities_unavailable");
    }
  }

  const hardFailureReasons = new Set([
    "challenge_page_detected",
    "title_missing_or_too_short",
    "description_missing_or_too_short",
    "insufficient_photos",
  ]);

  const reliable =
    !isVrbo ||
    !reasons.some((reason) =>
      hardFailureReasons.has(reason),
    );

  return {
    platform,
    isVrbo,
    reliable,
    challengeDetected,
    titleLength,
    descriptionLength,
    photoCount,
    amenityCount,
    reasons,
  };
}

export function isUnreliableVrboExtraction(
  listing: ExtractedListing,
): boolean {
  const result =
    evaluateVrboExtractionReliability(listing);

  return result.isVrbo && !result.reliable;
}

import type { ExtractedListing } from "./types";

export type PricingOnlyExtractionReliability = {
  platform: string | null;
  guardedPlatform: boolean;
  reliable: boolean;
  challengeDetected: boolean;
  hasPositivePrice: boolean;
  price: number | null;
  rawStayPrice: number | null;
  stayNights: number | null;
  reasons: string[];
};

function normalizedText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function positiveFiniteNumber(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : null;
}

function hasChallengeSignal(listing: ExtractedListing): boolean {
  const title = normalizedText(listing.title);
  const description = normalizedText(listing.description);
  const text = `${title}\n${description}`;

  return /robot ou pas robot|captcha|verify (?:that )?(?:you(?:'re| are) )?(?:not a robot|human)|are you human|access denied|forbidden|challenge-container|awswaf/i.test(
    text,
  );
}

export function evaluatePricingOnlyExtractionReliability(
  listing: ExtractedListing,
): PricingOnlyExtractionReliability {
  const platform =
    typeof listing.platform === "string"
      ? listing.platform.toLowerCase()
      : null;

  const guardedPlatform =
    platform === "expedia" || platform === "vrbo";

  const challengeDetected =
    guardedPlatform && hasChallengeSignal(listing);

  const price = positiveFiniteNumber(listing.price);
  const rawStayPrice = positiveFiniteNumber(listing.rawStayPrice);
  const stayNights = positiveFiniteNumber(listing.stayNights);

  const hasPositivePrice =
    price !== null ||
    (rawStayPrice !== null && stayNights !== null);

  const reasons: string[] = [];

  if (guardedPlatform) {
    if (challengeDetected) {
      reasons.push("challenge_page_detected");
    }

    if (!hasPositivePrice) {
      reasons.push("usable_price_unavailable");
    }
  }

  return {
    platform,
    guardedPlatform,
    reliable:
      !guardedPlatform ||
      (!challengeDetected && hasPositivePrice),
    challengeDetected,
    hasPositivePrice,
    price,
    rawStayPrice,
    stayNights,
    reasons,
  };
}

export function isUnreliablePricingOnlyExtraction(
  listing: ExtractedListing,
): boolean {
  const result =
    evaluatePricingOnlyExtractionReliability(listing);

  return result.guardedPlatform && !result.reliable;
}

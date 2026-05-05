import type { ExtractedListing } from "./types";

const UNTITLED_BOOKING_FALLBACK = "Untitled Booking listing";

function photosCount(listing: ExtractedListing): number {
  if (typeof listing.photosCount === "number" && Number.isFinite(listing.photosCount)) {
    return Math.max(0, Math.floor(listing.photosCount));
  }
  return Array.isArray(listing.photos) ? listing.photos.filter(Boolean).length : 0;
}

function amenitiesCount(listing: ExtractedListing): number {
  return Array.isArray(listing.amenities) ? listing.amenities.filter(Boolean).length : 0;
}

/**
 * Cible Booking : page challenge + trop peu de signaux exploitables → ne pas lancer d’audit marché.
 * Si prix + titre réel + photos sont présents malgré le warning, on laisse passer.
 */
export function isUnreliableBookingExtraction(extracted: ExtractedListing): boolean {
  if (String(extracted.platform ?? "").toLowerCase() !== "booking") return false;
  const warnings = extracted.extractionMeta?.warnings;
  if (!Array.isArray(warnings) || !warnings.includes("booking_challenge_detected")) {
    return false;
  }

  const hasPrice =
    typeof extracted.price === "number" && Number.isFinite(extracted.price) && extracted.price > 0;
  const title = (extracted.title ?? "").trim();
  const hasRealTitle = title.length > 0 && title !== UNTITLED_BOOKING_FALLBACK;
  const hasPhotos = photosCount(extracted) > 0;

  if (hasPrice && hasRealTitle && hasPhotos) return false;

  let bad = 0;
  if (!hasPrice) bad += 1;
  if (!hasRealTitle) bad += 1;
  if (!hasPhotos) bad += 1;
  if (amenitiesCount(extracted) === 0) bad += 1;
  if ((extracted.description ?? "").trim().length === 0) bad += 1;

  return bad >= 2;
}

export function logBookingTargetExtractionUnreliable(
  route: string,
  url: string | null,
  extracted: ExtractedListing
): void {
  const warnings = extracted.extractionMeta?.warnings;
  console.warn(
    "[booking][target-extraction-unreliable]",
    JSON.stringify({
      route,
      url: url && url.length > 280 ? `${url.slice(0, 277)}...` : url,
      warnings: Array.isArray(warnings) ? warnings : null,
      price: extracted.price ?? null,
      title: extracted.title ?? null,
      photosCount: photosCount(extracted),
      amenitiesCount: amenitiesCount(extracted),
      descriptionLength: (extracted.description ?? "").trim().length,
    })
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
  const safeUrl = url && url.length > 280 ? `${url.slice(0, 277)}...` : url;
  console.warn(
    "[booking][target-extraction-unreliable-no-credit]",
    JSON.stringify({
      route,
      url: safeUrl,
      creditDebited: false,
      auditCreated: false,
      reason,
    })
  );
}

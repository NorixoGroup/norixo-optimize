import type { ExtractedListing } from "@/lib/extractors/types";

import type {
  PrivateOccupancyObservation,
} from "./occupancyFactWriter";

function normalizeString(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function positiveInteger(
  value: number | null | undefined,
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  )
    ? Math.floor(value)
    : null;
}

export function buildPrivateOccupancyObservation(
  listing: ExtractedListing,
  privateOccupancySignature: string | null,
): PrivateOccupancyObservation | null {
  const occupancy = listing.occupancyObservation;

  if (occupancy == null) {
    return null;
  }

  return {
    privateOccupancySignature,

    capturedAt:
      listing.extractionMeta?.extractedAt ??
      new Date().toISOString(),

    platform: normalizeString(listing.platform),
    country: normalizeString(
      (listing as { country?: string | null }).country,
    ),
    city: normalizeString(
      (listing as { city?: string | null }).city,
    ),
    propertyType: normalizeString(
      listing.propertyType,
    ),

    capacity:
      positiveInteger(listing.capacity),

    guestCapacity:
      positiveInteger(listing.guestCapacity),

    observedDays:
      positiveInteger(
        occupancy.observedDays,
      ),

    unavailableDays:
      positiveInteger(
        occupancy.unavailableDays,
      ),

    availableDays:
      positiveInteger(
        occupancy.availableDays,
      ),

    windowDays:
      positiveInteger(
        occupancy.windowDays,
      ),

    extractionQuality: "high",

    freshness: "fresh",

    sourceKind: "live_observation",
  };
}

import type { ExtractedListing, SupportedPlatform } from "./types";
import { detectPlatform, resolveExtractor } from "./router";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

function debugGuestAuditLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

function logNormalizedListing(listing: ExtractedListing) {
  debugGuestAuditLog("[guest-audit][normalized]", {
    platform: listing.platform,
    title: {
      length: listing.title.trim().length,
      source: listing.titleMeta?.source ?? null,
    },
    description: {
      length: listing.description.trim().length,
      source: listing.descriptionMeta?.source ?? null,
      preview: listing.description.trim().slice(0, 200),
    },
    photos: {
      count:
        typeof listing.photosCount === "number"
          ? listing.photosCount
          : Array.isArray(listing.photos)
            ? listing.photos.length
            : 0,
      source: listing.photoMeta?.source ?? null,
    },
    occupancy: {
      status: listing.occupancyObservation?.status ?? null,
    },
  });
}

export async function extractListing(url: string): Promise<ExtractedListing> {
  const resolved = resolveExtractor(url);
  const listing = await resolved.run(url);

  logNormalizedListing(listing);

  return listing;
}

export { detectPlatform, resolveExtractor };
export type { SupportedPlatform };

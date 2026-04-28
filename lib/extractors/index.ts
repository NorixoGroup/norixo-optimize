import type { ExtractedListing, ExtractListingOptions, SupportedPlatform } from "./types";
import { guessListingCity } from "@/lib/competitors/filterComparableListings";
import { detectPlatform, resolveExtractor } from "./router";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";
const DEBUG_MARKET_PIPELINE = process.env.DEBUG_MARKET_PIPELINE === "true";

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

export async function extractListing(
  url: string,
  options?: ExtractListingOptions
): Promise<ExtractedListing> {
  const isBooking = /booking\.com/i.test(url);
  const resolved = resolveExtractor(url);
  try {
    const listing = await resolved.run(url, options);

    logNormalizedListing(listing);

    if (DEBUG_MARKET_PIPELINE && isBooking) {
      const cityGuess = guessListingCity(listing);
      console.log(
        "[market][booking-extract-debug]",
        JSON.stringify({
          url: url.length > 260 ? `${url.slice(0, 257)}...` : url,
          success: true,
          title: listing.title ?? null,
          price:
            typeof listing.price === "number" && Number.isFinite(listing.price)
              ? listing.price
              : null,
          propertyTypeDetected: listing.propertyType ?? null,
          cityDetected: cityGuess ?? listing.locationLabel ?? null,
          failReason: null,
        })
      );
    }

    return listing;
  } catch (error) {
    if (DEBUG_MARKET_PIPELINE && isBooking) {
      console.log(
        "[market][booking-extract-debug]",
        JSON.stringify({
          url: url.length > 260 ? `${url.slice(0, 257)}...` : url,
          success: false,
          title: null,
          price: null,
          propertyTypeDetected: null,
          cityDetected: null,
          failReason: error instanceof Error ? error.message : String(error),
        })
      );
    }
    throw error;
  }
}

export { buildBookingUrlWithDates, bookingUrlHasStayDates, cleanBookingCanonicalUrl } from "./booking-url";
export { detectPlatform, resolveExtractor };
export type { ExtractListingOptions, SupportedPlatform };

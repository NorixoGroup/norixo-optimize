import { extractListing } from "@/lib/extractors";
import type { ExtractedListing } from "@/lib/extractors/types";
import type { SearchCompetitorsInput, SearchCompetitorsResult } from "./types";
import { searchAirbnbCompetitorCandidates } from "./airbnb-search";
import { searchBookingCompetitorCandidates } from "./booking-search";
import { searchVrboCompetitorCandidates } from "./vrbo-search";
import { filterComparableListings } from "./filterComparableListings";

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_RADIUS_KM = 1;

async function getCandidateUrls(
  target: ExtractedListing,
  maxResults: number
): Promise<string[]> {
  switch (target.platform) {
    case "airbnb": {
      try {
        const candidates = await searchAirbnbCompetitorCandidates(target, maxResults);
        return candidates.map((c) => c.url).filter(Boolean);
      } catch (error) {
        console.error("Error searching Airbnb competitors", error);
        return [];
      }
    }

    case "booking": {
      try {
        const candidates = await searchBookingCompetitorCandidates(target, maxResults);
        return candidates.map((c) => c.url).filter(Boolean);
      } catch (error) {
        console.error("Error searching Booking.com competitors", error);
        return [];
      }
    }

    case "vrbo": {
      try {
        const candidates = await searchVrboCompetitorCandidates(target, maxResults);
        return candidates.map((c) => c.url).filter(Boolean);
      } catch (error) {
        console.error("Error searching VRBO competitors", error);
        return [];
      }
    }

    default:
      return [];
  }
}

function isUsableListing(listing: ExtractedListing, target: ExtractedListing): boolean {
  if (!listing) return false;

  if (!listing.url || typeof listing.url !== "string") return false;
  if (listing.url === target.url) return false;

  const hasTitle = typeof listing.title === "string" && listing.title.trim().length > 0;
  const hasPhotos = Array.isArray(listing.photos) && listing.photos.length > 0;
  const hasAmenities = Array.isArray(listing.amenities) && listing.amenities.length > 0;

  // At least one core field should be meaningful for the listing to be comparable
  return hasTitle || hasPhotos || hasAmenities;
}

function buildListingKey(listing: ExtractedListing): string {
  const url = listing.url ?? "";
  const externalId = listing.externalId ?? "";
  const platform = listing.platform ?? "";
  const title = (listing.title ?? "").toLowerCase();
  const price =
    typeof listing.price === "number" && Number.isFinite(listing.price)
      ? listing.price.toFixed(2)
      : "";

  return [platform, externalId, url, title, price].join("|");
}

function dedupeListings(
  listings: ExtractedListing[],
  target: ExtractedListing
): ExtractedListing[] {
  const seen = new Set<string>();
  const result: ExtractedListing[] = [];

  for (const listing of listings) {
    if (!isUsableListing(listing, target)) continue;

    const key = buildListingKey(listing);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(listing);
  }

  return result;
}

export async function searchCompetitorsAroundTarget(
  input: SearchCompetitorsInput
): Promise<SearchCompetitorsResult> {
  const maxResults = Math.min(input.maxResults ?? DEFAULT_MAX_RESULTS, 5);
  const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;

  const candidateUrls = await getCandidateUrls(input.target, maxResults);

  const uniqueUrls = [...new Set(candidateUrls.map((url) => url?.trim() || ""))]
    .filter((url) => Boolean(url) && url !== input.target.url)
    .slice(0, maxResults * 3);

  const extractedResults = await Promise.allSettled(
    uniqueUrls.map((url) => extractListing(url))
  );

  const rawCompetitors: ExtractedListing[] = extractedResults
    .filter(
      (result): result is PromiseFulfilledResult<ExtractedListing> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value)
    .filter((listing) => listing && listing.url !== input.target.url);

  const sanitizedCompetitors = dedupeListings(rawCompetitors, input.target);

  const competitors = filterComparableListings(
    input.target,
    sanitizedCompetitors,
    maxResults
  );

  return {
    target: input.target,
    competitors,
    attempted: uniqueUrls.length,
    selected: competitors.length,
    radiusKm,
    maxResults,
  };
}
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
      const candidates = await searchAirbnbCompetitorCandidates(target, maxResults);
      return candidates.map((c) => c.url).filter(Boolean);
    }

    case "booking": {
      const candidates = await searchBookingCompetitorCandidates(target, maxResults);
      return candidates.map((c) => c.url).filter(Boolean);
    }

    case "vrbo": {
      const candidates = await searchVrboCompetitorCandidates(target, maxResults);
      return candidates.map((c) => c.url).filter(Boolean);
    }

    default:
      return [];
  }
}

export async function searchCompetitorsAroundTarget(
  input: SearchCompetitorsInput
): Promise<SearchCompetitorsResult> {
  const maxResults = Math.min(input.maxResults ?? DEFAULT_MAX_RESULTS, 5);
  const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;

  const candidateUrls = await getCandidateUrls(input.target, maxResults);

  const uniqueUrls = [...new Set(candidateUrls)]
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
    .filter((listing) => listing.url !== input.target.url);

  const competitors = filterComparableListings(
    input.target,
    rawCompetitors,
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
import { extractListing } from "@/lib/extractors";
import type { ExtractedListing } from "@/lib/extractors/types";
import { searchAgodaCompetitorCandidates } from "./agoda-search";
import type { SearchCompetitorsInput, SearchCompetitorsResult } from "./types";
import { searchAirbnbCompetitorCandidates } from "./airbnb-search";
import { searchBookingCompetitorCandidates } from "./booking-search";
import { searchVrboCompetitorCandidates } from "./vrbo-search";
import {
  evaluateComparableCandidates,
  filterComparableListings,
  getNormalizedComparableType,
  guessListingCity,
  guessListingLanguage,
  guessListingNeighborhood,
} from "./filterComparableListings";

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_RADIUS_KM = 1;
const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

function debugComparablesLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

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

    case "agoda": {
      try {
        const candidates = await searchAgodaCompetitorCandidates(target, maxResults);
        return candidates.map((c) => c.url).filter(Boolean);
      } catch (error) {
        console.error("Error searching Agoda competitors", error);
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
  const candidateFetchLimit = Math.max(maxResults * 4, 12);

  const candidateUrls = await getCandidateUrls(input.target, candidateFetchLimit);

  const uniqueUrls = [...new Set(candidateUrls.map((url) => url?.trim() || ""))]
    .filter((url) => Boolean(url) && url !== input.target.url)
    .slice(0, candidateFetchLimit);

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
  const candidateDecisions = evaluateComparableCandidates(
    input.target,
    sanitizedCompetitors
  );

  const competitors = filterComparableListings(
    input.target,
    sanitizedCompetitors,
    maxResults
  );

  debugComparablesLog("[guest-audit][comparables][pipeline-debug]", {
    target: {
      title: input.target.title ?? null,
      platform: input.target.platform ?? null,
      propertyType: input.target.propertyType ?? null,
      normalizedTargetType: getNormalizedComparableType(input.target),
      capacity: input.target.capacity ?? null,
      bedrooms: input.target.bedrooms ?? null,
      bathrooms: input.target.bathrooms ?? null,
      locationLabel: input.target.locationLabel ?? null,
    },
    platform: input.target.platform ?? null,
    source: "searchCompetitorsAroundTarget",
    searchResultCountRaw: uniqueUrls.length,
    rawCandidates: sanitizedCompetitors.map((listing) => ({
      id: listing.externalId ?? null,
      url: listing.url ?? null,
      title: listing.title ?? null,
      platform: listing.platform ?? null,
      propertyType: listing.propertyType ?? null,
      normalizedType: getNormalizedComparableType(listing),
      city: guessListingCity(listing),
      neighborhood: guessListingNeighborhood(listing),
      languageGuess: guessListingLanguage(listing),
      capacity: listing.capacity ?? null,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      photosCount: Array.isArray(listing.photos)
        ? listing.photos.filter(Boolean).length
        : typeof listing.photosCount === "number"
          ? listing.photosCount
          : 0,
      ratingValue:
        typeof listing.ratingValue === "number"
          ? listing.ratingValue
          : typeof listing.rating === "number"
            ? listing.rating
            : null,
      reviewCount: typeof listing.reviewCount === "number" ? listing.reviewCount : null,
      amenitiesCount: Array.isArray(listing.amenities)
        ? listing.amenities.filter(Boolean).length
        : 0,
      locationLabel: listing.locationLabel ?? null,
    })),
    filterResultCount: competitors.length,
    rejectedCandidates: candidateDecisions
      .filter((decision) => !decision.accepted)
      .map((decision) => ({
        id: decision.candidate.externalId ?? null,
        url: decision.candidate.url ?? null,
        title: decision.candidate.title ?? null,
        platform: decision.candidate.platform ?? null,
        normalizedType: decision.candidateNormalizedType,
        normalizedTargetType: decision.targetNormalizedType,
        city: decision.candidateCity,
        neighborhood: decision.candidateNeighborhood,
        languageGuess: decision.candidateLanguageGuess,
        bedrooms: decision.candidate.bedrooms ?? null,
        bathrooms: decision.candidate.bathrooms ?? null,
        capacity: decision.candidate.capacity ?? null,
        reasons: decision.reasons,
      })),
    retainedCandidates: competitors.map((listing) => ({
      id: listing.externalId ?? null,
      url: listing.url ?? null,
      title: listing.title ?? null,
      platform: listing.platform ?? null,
      normalizedType: getNormalizedComparableType(listing),
      city: guessListingCity(listing),
      neighborhood: guessListingNeighborhood(listing),
      languageGuess: guessListingLanguage(listing),
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      capacity: listing.capacity ?? null,
    })),
    finalInjectedCount: competitors.length,
  });

  return {
    target: input.target,
    competitors,
    attempted: uniqueUrls.length,
    selected: competitors.length,
    radiusKm,
    maxResults,
  };
}

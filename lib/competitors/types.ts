import type { ExtractedListing } from "@/lib/extractors/types";

export type CompetitorCandidate = {
  url: string;
  platform: ExtractedListing["platform"];
  title?: string | null;
  price?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type SearchCompetitorsInput = {
  target: ExtractedListing;
  maxResults?: number;
  radiusKm?: number;
  abortSignal?: AbortSignal;
};

export type SearchCompetitorsResult = {
  target: ExtractedListing;
  competitors: ExtractedListing[];
  attempted: number;
  selected: number;
  radiusKm: number;
  maxResults: number;
};

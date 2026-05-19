import type { ExtractedListing } from "@/lib/extractors/types";

export type CompetitorCandidate = {
  url: string;
  platform: ExtractedListing["platform"];
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  rawStayPrice?: number | null;
  stayNights?: number | null;
  priceBasis?: ExtractedListing["priceBasis"] | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type SearchCompetitorsInput = {
  target: ExtractedListing;
  /** Override utilisateur (studio, apartment, …) — fusionné sur la cible comparables avant filtrage. */
  propertyTypeOverride?: string | null;
  auditCheckIn?: string | null;
  auditCheckOut?: string | null;
  maxResults?: number;
  radiusKm?: number;
  abortSignal?: AbortSignal;
  comparables?: {
    sourcePriority?: string[];
    city?: string | null;
    country?: string | null;
    propertyType?: string | null;
    max?: number | null;
    /** Comparables déjà connus depuis Market Memory/Supabase, utilisés comme seed pricing avant live discovery. */
    seedComparables?: ExtractedListing[];
  };
};

export type SearchCompetitorsResult = {
  target: ExtractedListing;
  competitors: ExtractedListing[];
  attempted: number;
  selected: number;
  radiusKm: number;
  maxResults: number;
  observedFallbackComparables?: ExtractedListing[];
};

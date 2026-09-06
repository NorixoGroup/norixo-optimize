export type FreeListingAuditPlatform =
  | "airbnb"
  | "booking"
  | "expedia"
  | "agoda"
  | "vrbo"
  | "other";

export type FreeListingAuditExtractionStatus =
  | "complete"
  | "partial"
  | "blocked";

export type FreeListingAuditMarketStatus =
  | "ok"
  | "partial"
  | "insufficient_data"
  | "blocked";

export type FreeListingAuditLockedSection =
  | "photos"
  | "description"
  | "market_positioning"
  | "occupancy"
  | "conversion"
  | "action_plan";

export type FreeListingAuditAvailable = Readonly<{
  status: "available";
  listing: Readonly<{
    url: string;
    title: string;
    platform: FreeListingAuditPlatform;
    propertyType: string | null;
  }>;
  score: number;
  summary: string | null;
  insights: readonly string[];
  recommendations: readonly string[];
  trust: Readonly<{
    rating: number | null;
    reviewCount: number | null;
    badge: string | null;
    extractionStatus: FreeListingAuditExtractionStatus;
  }>;
  market: Readonly<{
    status: FreeListingAuditMarketStatus;
    comparableCount: number;
    summary: string | null;
  }>;
  availability: Readonly<{
    detected: boolean;
  }>;
  lockedSections: readonly FreeListingAuditLockedSection[];
}>;

export type FreeListingAuditUnavailable = Readonly<{
  status: "unavailable";
  reason: string;
}>;

export type FreeListingAuditPublicResult =
  | FreeListingAuditAvailable
  | FreeListingAuditUnavailable;

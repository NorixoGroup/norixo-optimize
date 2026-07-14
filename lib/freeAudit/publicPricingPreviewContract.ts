export type FreeAuditPricingPreviewPlatform =
  | "airbnb"
  | "booking"
  | "expedia"
  | "agoda"
  | "vrbo";

export type FreeAuditPricingPreviewPropertyType =
  | "studio"
  | "apartment"
  | "villa"
  | "riad"
  | "room"
  | "hotel";

export type FreeAuditPricingPreviewMarketPropertyType =
  | FreeAuditPricingPreviewPropertyType
  | "unknown";

export type FreeAuditPricingPreviewCapacityBand =
  | "1_3"
  | "4_6"
  | "7_9"
  | "10_plus"
  | "unknown";

export type FreeAuditPricingPreviewPositioningBand =
  | "well_below_market"
  | "below_market"
  | "near_market"
  | "above_market"
  | "well_above_market";

export type FreeAuditPricingPreviewConfidenceLevel =
  | "standard"
  | "high";

export type FreeAuditPricingPreviewSampleBand =
  | "sufficient"
  | "strong";

export type FreeAuditPricingPreviewInput = Readonly<{
  country: string;
  city: string;
  platform: FreeAuditPricingPreviewPlatform;
  propertyType: FreeAuditPricingPreviewPropertyType;
  guestCapacity: number;
  declaredNightlyPrice: number;
  currency: string;
}>;

export type FreeAuditPublicMarket = Readonly<{
  country: string;
  city: string;
  platform: FreeAuditPricingPreviewPlatform;
  propertyType: FreeAuditPricingPreviewMarketPropertyType;
  capacityBand: FreeAuditPricingPreviewCapacityBand;
  currency: string;
}>;

export type FreeAuditPricingPreviewAvailable = Readonly<{
  status: "available";
  market: FreeAuditPublicMarket;
  declaredNightlyPrice: number;
  benchmark: Readonly<{
    lowPrice: number;
    medianPrice: number;
    highPrice: number;
  }>;
  positioning: Readonly<{
    band: FreeAuditPricingPreviewPositioningBand;
    deltaFromMedianPercent: number;
  }>;
  confidence: Readonly<{
    level: FreeAuditPricingPreviewConfidenceLevel;
    sampleBand: FreeAuditPricingPreviewSampleBand;
  }>;
  limitations: readonly string[];
  recommendations: readonly string[];
}>;

export type FreeAuditPricingPreviewInsufficientCoverage = Readonly<{
  status: "insufficient_coverage";
  market: FreeAuditPublicMarket;
  declaredNightlyPrice: number;
  limitations: readonly string[];
  message: string;
}>;

export type FreeAuditPricingPreviewUnavailable = Readonly<{
  status: "unavailable";
  message: string;
}>;

export type FreeAuditPricingPreviewResult =
  | FreeAuditPricingPreviewAvailable
  | FreeAuditPricingPreviewInsufficientCoverage
  | FreeAuditPricingPreviewUnavailable;

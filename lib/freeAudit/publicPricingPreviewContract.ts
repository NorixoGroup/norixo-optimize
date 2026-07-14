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

export type FreeAuditPricingPreviewConfidenceLevel =
  | "standard"
  | "high";

export type FreeAuditPricingPreviewSampleBand =
  | "sufficient"
  | "strong";

export type FreeAuditMarketOverviewInput = Readonly<{
  country: string;
  city: string;
  platform: FreeAuditPricingPreviewPlatform;
  propertyType: FreeAuditPricingPreviewPropertyType;
}>;

export type FreeAuditPublicMarket = Readonly<{
  country: string;
  city: string;
  platform: FreeAuditPricingPreviewPlatform;
  propertyType: FreeAuditPricingPreviewMarketPropertyType;
}>;

export type FreeAuditMarketOverviewAvailable = Readonly<{
  status: "available";
  market: FreeAuditPublicMarket;
  benchmark: Readonly<{
    lowPrice: number;
    medianPrice: number;
    highPrice: number;
    currency: string;
  }>;
  confidence: Readonly<{
    level: FreeAuditPricingPreviewConfidenceLevel;
    sampleBand: FreeAuditPricingPreviewSampleBand;
  }>;
  limitations: readonly string[];
  recommendations: readonly string[];
}>;

export type FreeAuditMarketOverviewInsufficientCoverage = Readonly<{
  status: "insufficient_coverage";
  market: FreeAuditPublicMarket;
  limitations: readonly string[];
  message: string;
}>;

export type FreeAuditMarketOverviewUnavailable = Readonly<{
  status: "unavailable";
  message: string;
}>;

export type FreeAuditPricingPreviewResult =
  | FreeAuditMarketOverviewAvailable
  | FreeAuditMarketOverviewInsufficientCoverage
  | FreeAuditMarketOverviewUnavailable;

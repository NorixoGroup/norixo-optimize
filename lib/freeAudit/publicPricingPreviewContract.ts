export type FreeAuditPricingPreviewPlatform =
  | "airbnb"
  | "booking"
  | "expedia"
  | "agoda"
  | "vrbo";

export type FreeAuditPricingPreviewMarketPlatform =
  | FreeAuditPricingPreviewPlatform
  | "all";

export type FreeAuditPricingPreviewPlatformScope =
  | "single_platform"
  | "all_platforms";

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

export type FreeAuditMarketOverviewLimitationCode =
  | "market_only"
  | "aggregated_market_data"
  | "listing_specific_factors"
  | "broad_market_segment"
  | "all_capacities_scope"
  | "multi_platform_scope"
  | "limited_sample_size"
  | "limited_source_diversity"
  | "aging_data"
  | "multi_currency_market";

export type FreeAuditMarketOverviewRecommendationCode =
  | "median_positions_market"
  | "broader_segment_used"
  | "listing_specific_factors_matter"
  | "full_audit_for_positioning";

export type FreeAuditMarketOverviewInput = Readonly<{
  country: string;
  city: string;
  platform: FreeAuditPricingPreviewPlatform;
  propertyType: FreeAuditPricingPreviewPropertyType;
}>;

export type FreeAuditPublicMarket = Readonly<{
  country: string;
  city: string;
  platform: FreeAuditPricingPreviewMarketPlatform;
  platformScope: FreeAuditPricingPreviewPlatformScope;
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
  limitations: readonly FreeAuditMarketOverviewLimitationCode[];
  recommendations: readonly FreeAuditMarketOverviewRecommendationCode[];
}>;

export type FreeAuditMarketOverviewInsufficientCoverage = Readonly<{
  status: "insufficient_coverage";
  market: FreeAuditPublicMarket;
  limitations: readonly FreeAuditMarketOverviewLimitationCode[];
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

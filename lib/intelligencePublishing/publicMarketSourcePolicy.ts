import type { PublicMarketReportSource } from "./publicMarketSourceAdapter";
import type { MarketReportCompletenessPolicy } from "./marketReportGeneration";

export function buildPublicMarketCompletenessPolicy(
  source: PublicMarketReportSource,
): Partial<MarketReportCompletenessPolicy> {
  const required = new Set(source.publication.requiredMetrics);

  return {
    requireOverview: required.has("market_overview"),
    requirePricing: required.has("pricing_benchmark"),
    requireOccupancy: required.has("occupancy_benchmark"),
    allowPartialReport: true,
    minimumSectionCount: 5,
  };
}

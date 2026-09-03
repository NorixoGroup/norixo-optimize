import { getSearchEligibility } from "./searchEligibility";

/**
 * City-topic URLs that already produced impressions in the
 * 2026-09-03 GSC review but are not yet promoted to WINNER.
 *
 * These URLs remain protected in the sitemap while their
 * quality / intent / performance is reviewed.
 *
 * This is sitemap policy only:
 * it does not change indexability, generation, canonicals,
 * robots directives, redirects, or search eligibility.
 */
const GSC_PROTECTED_CITY_TOPIC_PATHS = new Set<string>([
  "/airbnb-optimizer/aix-en-provence/long-stay-guide",
  "/airbnb-optimizer/athens/business-travel-guide",
  "/airbnb-optimizer/auckland/pricing-positioning",
  "/airbnb-optimizer/boston/occupancy-guide",
  "/airbnb-optimizer/bucharest/occupancy-guide",
  "/airbnb-optimizer/budapest/revenue-optimization",
  "/airbnb-optimizer/chicago/business-travel-guide",
  "/airbnb-optimizer/chicago/market-analysis",
  "/airbnb-optimizer/copenhagen/occupancy-guide",
  "/airbnb-optimizer/dublin/pricing-positioning",
  "/airbnb-optimizer/istanbul/pricing-positioning",
  "/airbnb-optimizer/kuala-lumpur/local-demand-guide",
  "/airbnb-optimizer/kuala-lumpur/occupancy-guide",
  "/airbnb-optimizer/lagos-portugal/guest-trust-guide",
  "/airbnb-optimizer/lagos-portugal/revenue-optimization",
  "/airbnb-optimizer/madrid/business-travel-guide",
  "/airbnb-optimizer/madrid/guest-trust-guide",
  "/airbnb-optimizer/melbourne/business-travel-guide",
  "/airbnb-optimizer/melbourne/seasonality-guide",
  "/airbnb-optimizer/mexico-city/business-travel-guide",
  "/airbnb-optimizer/mexico-city/guest-trust-guide",
  "/airbnb-optimizer/nice/occupancy-guide",
  "/airbnb-optimizer/philadelphia/business-travel-guide",
  "/airbnb-optimizer/queenstown/revenue-optimization",
  "/airbnb-optimizer/queenstown/review-strategy",
  "/airbnb-optimizer/san-francisco/seasonality-guide",
  "/airbnb-optimizer/seoul/review-strategy",
  "/airbnb-optimizer/vancouver/occupancy-guide",
  "/airbnb-optimizer/zaragoza/local-demand-guide",
]);

export function isCityTopicSitemapEligible(
  pathname: string
): boolean {
  const eligibility = getSearchEligibility(pathname);

  if (!eligibility.sitemapEligible) {
    return false;
  }

  if (
    eligibility.tier === "core" ||
    eligibility.tier === "winner"
  ) {
    return true;
  }

  return GSC_PROTECTED_CITY_TOPIC_PATHS.has(pathname);
}

export function getGscProtectedCityTopicPaths(): readonly string[] {
  return [...GSC_PROTECTED_CITY_TOPIC_PATHS];
}

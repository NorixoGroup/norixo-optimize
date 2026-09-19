import { getSearchEligibility } from "./searchEligibility";
import { isCohort25CityTopicRepairPath } from "./cohort25CityTopicRepair";

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
/**
 * Small sitemap-only experiment cohort.
 *
 * These HOLD URLs have bespoke content and remain unchanged in search
 * eligibility. Inclusion here changes sitemap discovery only.
 *
 * Control cohort intentionally remains omitted:
 * - /airbnb-optimizer/bali/occupancy-guide
 * - /airbnb-optimizer/paris/occupancy-guide
 * - /airbnb-optimizer/london/occupancy-guide
 */
const SITEMAP_EXPERIMENT_CITY_TOPIC_PATHS = new Set<string>([
  "/airbnb-optimizer/hong-kong/title-optimization",
  "/airbnb-optimizer/helsinki/occupancy-guide",
  "/airbnb-optimizer/sapporo/booking-conversion",
  "/airbnb-optimizer/biarritz/competitor-analysis",
  "/airbnb-optimizer/jeddah/occupancy-guide",
  "/airbnb-optimizer/corfu/occupancy-guide",
  "/airbnb-optimizer/da-nang/occupancy-guide",
  "/airbnb-optimizer/stockholm/occupancy-guide",
  "/airbnb-optimizer/evora/occupancy-guide",
  "/airbnb-optimizer/cairo/occupancy-guide",
  "/airbnb-optimizer/fort-lauderdale/family-travel-guide",
  "/airbnb-optimizer/sapporo/competitor-analysis",
  "/airbnb-optimizer/calgary/search-visibility",
  "/airbnb-optimizer/lyon/occupancy-guide",
  "/airbnb-optimizer/sapporo/pricing-positioning",
  "/airbnb-optimizer/sofia/occupancy-guide",
  "/airbnb-optimizer/ibiza/occupancy-guide",
  "/airbnb-optimizer/malaga/occupancy-guide",
  "/airbnb-optimizer/san-sebastian/first-photo",
  "/airbnb-optimizer/jeddah/guest-trust-guide",
  "/airbnb-optimizer/dakhla/description-optimization",
  "/airbnb-optimizer/doha/amenities-guide",
  "/airbnb-optimizer/doha/photo-order",
  "/airbnb-optimizer/doha/seasonality-guide",
  "/airbnb-optimizer/reykjavik/occupancy-guide",
  "/airbnb-optimizer/muscat/title-optimization",
  "/airbnb-optimizer/marrakech/occupancy-guide",
  "/airbnb-optimizer/istanbul/occupancy-guide",
  "/airbnb-optimizer/barcelona/occupancy-guide",
  "/airbnb-optimizer/paris/occupancy-guide",
  "/airbnb-optimizer/london/occupancy-guide",
  "/airbnb-optimizer/bali/occupancy-guide",
  "/airbnb-optimizer/abu-dhabi/occupancy-guide",
  "/airbnb-optimizer/agadir/occupancy-guide",
  "/airbnb-optimizer/aix-en-provence/occupancy-guide",
  "/airbnb-optimizer/al-hoceima/occupancy-guide",
  "/airbnb-optimizer/albufeira/occupancy-guide",
  "/airbnb-optimizer/alicante/occupancy-guide",
  "/airbnb-optimizer/amman/occupancy-guide",
  "/airbnb-optimizer/amsterdam/occupancy-guide",
  "/airbnb-optimizer/annecy/occupancy-guide",
  "/airbnb-optimizer/antwerp/occupancy-guide",
  "/airbnb-optimizer/arcachon/occupancy-guide",
  "/airbnb-optimizer/asilah/occupancy-guide",
  "/airbnb-optimizer/athens/occupancy-guide",
  "/airbnb-optimizer/auckland/occupancy-guide",
  "/airbnb-optimizer/austin/occupancy-guide",
  "/airbnb-optimizer/avignon/occupancy-guide",
  "/airbnb-optimizer/bali-canggu/occupancy-guide",
  "/airbnb-optimizer/bangkok/occupancy-guide",
  "/airbnb-optimizer/benidorm/occupancy-guide",
  "/airbnb-optimizer/bergamo/occupancy-guide",
  "/airbnb-optimizer/berlin/occupancy-guide",
  "/airbnb-optimizer/biarritz/occupancy-guide",
  "/airbnb-optimizer/bilbao/occupancy-guide",
  "/airbnb-optimizer/bogota/occupancy-guide",
  "/airbnb-optimizer/bologna/occupancy-guide",
]);

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

  return (
    GSC_PROTECTED_CITY_TOPIC_PATHS.has(pathname) ||
    SITEMAP_EXPERIMENT_CITY_TOPIC_PATHS.has(pathname) ||
    isCohort25CityTopicRepairPath(pathname)
  );
}

export function getGscProtectedCityTopicPaths(): readonly string[] {
  return [...GSC_PROTECTED_CITY_TOPIC_PATHS];
}

export function getSitemapExperimentCityTopicPaths(): readonly string[] {
  return [...SITEMAP_EXPERIMENT_CITY_TOPIC_PATHS];
}

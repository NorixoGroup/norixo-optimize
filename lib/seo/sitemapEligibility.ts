import { cities } from "../../data/cities";
import { localSeoTopics } from "../../data/localSeo";
import { getSearchEligibility } from "./searchEligibility";
import { isCohort25CityTopicRepairPath } from "./cohort25CityTopicRepair";
import { getCityTopicQuality } from "./cityTopicQuality";

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
  "/airbnb-optimizer/abu-dhabi/title-optimization",
  "/airbnb-optimizer/agadir/guest-trust-guide",
  "/airbnb-optimizer/aix-en-provence/ranking-factors",
  "/airbnb-optimizer/al-hoceima/pricing-guide",
  "/airbnb-optimizer/albufeira/booking-conversion",
  "/airbnb-optimizer/alicante/revenue-optimization",
  "/airbnb-optimizer/amalfi/occupancy-guide",
  "/airbnb-optimizer/amman/amenities-guide",
  "/airbnb-optimizer/amsterdam/seo-guide",
  "/airbnb-optimizer/annecy/photo-tips",
  "/airbnb-optimizer/antwerp/search-visibility",
  "/airbnb-optimizer/arcachon/market-analysis",
  "/airbnb-optimizer/asilah/first-photo",
  "/airbnb-optimizer/athens/description-optimization",
  "/airbnb-optimizer/auckland/competitor-analysis",
  "/airbnb-optimizer/austin/conversion-guide",
  "/airbnb-optimizer/avignon/guest-trust-guide",
  "/airbnb-optimizer/bali-canggu/photo-tips",
  "/airbnb-optimizer/bali/local-demand-guide",
  "/airbnb-optimizer/bangkok/listing-audit",
  "/airbnb-optimizer/barcelona/seo-guide",
  "/airbnb-optimizer/benidorm/seasonality-guide",
  "/airbnb-optimizer/bergamo/long-stay-guide",
  "/airbnb-optimizer/berlin/pricing-guide",
  "/airbnb-optimizer/biarritz/listing-audit",
  "/airbnb-optimizer/bilbao/review-strategy",
  "/airbnb-optimizer/bogota/description-optimization",
  "/airbnb-optimizer/bologna/seo-guide",
  "/airbnb-optimizer/bordeaux/title-optimization",
  "/airbnb-optimizer/boston/review-strategy",
  "/airbnb-optimizer/braga/occupancy-guide",
  "/airbnb-optimizer/brussels/amenities-guide",
  "/airbnb-optimizer/bucharest/pricing-positioning",
  "/airbnb-optimizer/budapest/amenities-guide",
  "/airbnb-optimizer/buenos-aires/photo-order",
  "/airbnb-optimizer/cadiz/business-travel-guide",
  "/airbnb-optimizer/cairo/revenue-optimization",
  "/airbnb-optimizer/calgary/photo-order",
  "/airbnb-optimizer/cancun/family-travel-guide",
  "/airbnb-optimizer/cannes/first-photo",
  "/airbnb-optimizer/cape-town/ranking-factors",
  "/airbnb-optimizer/cartagena/business-travel-guide",
  "/airbnb-optimizer/casablanca/seasonality-guide",
  "/airbnb-optimizer/cebu/photo-tips",
  "/airbnb-optimizer/chamonix/search-visibility",
  "/airbnb-optimizer/chefchaouen/conversion-guide",
  "/airbnb-optimizer/chiang-mai/listing-audit",
  "/airbnb-optimizer/chicago/family-travel-guide",
  "/airbnb-optimizer/coimbra/competitor-analysis",
  "/airbnb-optimizer/colmar/pricing-guide",
  "/airbnb-optimizer/como/ranking-factors",
  "/airbnb-optimizer/copenhagen/local-demand-guide",
  "/airbnb-optimizer/corfu/pricing-positioning",
  "/airbnb-optimizer/courchevel/market-analysis",
  "/airbnb-optimizer/crete/description-optimization",
  "/airbnb-optimizer/cusco/title-optimization",
  "/airbnb-optimizer/da-nang/long-stay-guide",
  "/airbnb-optimizer/dakhla/photo-order",
  "/airbnb-optimizer/deauville/guest-trust-guide",
  "/airbnb-optimizer/djerba/family-travel-guide",
  "/airbnb-optimizer/doha/review-strategy",
  "/airbnb-optimizer/dubai/pricing-positioning",
  "/airbnb-optimizer/dublin/search-visibility",
  "/airbnb-optimizer/dubrovnik/first-photo",
  "/airbnb-optimizer/edinburgh/business-travel-guide",
  "/airbnb-optimizer/el-jadida/conversion-guide",
  "/airbnb-optimizer/essaouira/booking-conversion",
  "/airbnb-optimizer/evora/booking-conversion",
  "/airbnb-optimizer/faro/long-stay-guide",
  "/airbnb-optimizer/fes/competitor-analysis",
  "/airbnb-optimizer/florence/guest-trust-guide",
  "/airbnb-optimizer/fort-lauderdale/pricing-guide",
  "/airbnb-optimizer/fukuoka/market-analysis",
  "/airbnb-optimizer/geneva/revenue-optimization",
  "/airbnb-optimizer/genoa/seo-guide",
  "/airbnb-optimizer/gijon/local-demand-guide",
  "/airbnb-optimizer/girona/family-travel-guide",
  "/airbnb-optimizer/granada/competitor-analysis",
  "/airbnb-optimizer/grenoble/seasonality-guide",
  "/airbnb-optimizer/guadalajara/occupancy-guide",
  "/airbnb-optimizer/hanoi/business-travel-guide",
  "/airbnb-optimizer/helsinki/ranking-factors",
  "/airbnb-optimizer/ho-chi-minh-city/title-optimization",
  "/airbnb-optimizer/hong-kong/revenue-optimization",
  "/airbnb-optimizer/honolulu/photo-tips",
  "/airbnb-optimizer/hurghada/occupancy-guide",
  "/airbnb-optimizer/ibiza/photo-order",
  "/airbnb-optimizer/ifrane/booking-conversion",
  "/airbnb-optimizer/jakarta/conversion-guide",
  "/airbnb-optimizer/jeddah/pricing-positioning",
  "/airbnb-optimizer/krakow/search-visibility",
  "/airbnb-optimizer/kuala-lumpur/amenities-guide",
  "/airbnb-optimizer/kyoto/local-demand-guide",
  "/airbnb-optimizer/lagos-portugal/description-optimization",
  "/airbnb-optimizer/larnaca/first-photo",
  "/airbnb-optimizer/las-vegas/review-strategy",
  "/airbnb-optimizer/lecce/seasonality-guide",
  "/airbnb-optimizer/london/long-stay-guide",
  "/airbnb-optimizer/lyon/market-analysis",
  "/airbnb-optimizer/manila/listing-audit",
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

const QUALITY_GATED_ROLLOUT_TOPICS = new Set([
  "occupancy-guide",
  "title-optimization",
  "guest-trust-guide",
  "photo-tips",
  "description-optimization",
  "business-travel-guide",
  "listing-audit",
  "revenue-optimization",
  "pricing-positioning",
  "competitor-analysis",
  "seasonality-guide",
  "review-strategy",
  "local-demand-guide",
]);

function isQualityGatedRolloutPath(
  pathname: string
): boolean {
  const match = pathname.match(
    /^\/airbnb-optimizer\/([^/]+)\/([^/]+)$/
  );

  if (!match || !QUALITY_GATED_ROLLOUT_TOPICS.has(match[2])) {
    return false;
  }

  const city = cities.find((candidate) => candidate.slug === match[1]);
  const topic = localSeoTopics.find(
    (candidate) => candidate.slug === match[2]
  );

  if (!city || !topic) {
    return false;
  }

  const quality = getCityTopicQuality(city, topic);

  return (
    quality.status === "eligible-safe" ||
    quality.status === "qualified-evidence"
  );
}

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
    isCohort25CityTopicRepairPath(pathname) ||
    isQualityGatedRolloutPath(pathname)
  );
}

export function getGscProtectedCityTopicPaths(): readonly string[] {
  return [...GSC_PROTECTED_CITY_TOPIC_PATHS];
}

export function getSitemapExperimentCityTopicPaths(): readonly string[] {
  return [...SITEMAP_EXPERIMENT_CITY_TOPIC_PATHS];
}

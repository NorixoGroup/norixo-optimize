import { cities } from "../data/cities";
import { localSeoTopics } from "../data/localSeo";
import {
  getGscProtectedCityTopicPaths,
  getSitemapExperimentCityTopicPaths,
  isCityTopicSitemapEligible,
} from "../lib/seo/sitemapEligibility";
import { getSearchEligibility } from "../lib/seo/searchEligibility";
import { getCohort25CityTopicRepairPaths } from "../lib/seo/cohort25CityTopicRepair";
import { getCityTopicQuality } from "../lib/seo/cityTopicQuality";

const allHubs = cities.map(
  (city) => `/airbnb-optimizer/${city.slug}`
);

const allTopics = cities.flatMap((city) =>
  localSeoTopics.map(
    (topic) =>
      `/airbnb-optimizer/${city.slug}/${topic.slug}`
  )
);

const priorityTopics = allTopics.filter((pathname) => {
  const eligibility = getSearchEligibility(pathname);

  return (
    eligibility.tier === "core" ||
    eligibility.tier === "winner"
  );
});

const protectedTopics =
  getGscProtectedCityTopicPaths();

const experimentTopics =
  getSitemapExperimentCityTopicPaths();

const cohort25Topics =
  getCohort25CityTopicRepairPaths();

const keptTopics = allTopics.filter(
  isCityTopicSitemapEligible
);

const omittedTopics = allTopics.filter(
  (pathname) =>
    !isCityTopicSitemapEligible(pathname)
);

const qualityGatedTopicSlugs = [
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
  "pricing-guide",
  "seo-guide",
  "amenities-guide",
  "booking-conversion",
  "ranking-factors",
  "search-visibility",
  "photo-order",
  "first-photo",
  "family-travel-guide",
  "long-stay-guide",
] as const;

const qualityGatedTopics = qualityGatedTopicSlugs.flatMap(
  (topicSlug) => {
    const topic = localSeoTopics.find(
      (candidate) => candidate.slug === topicSlug
    );

    if (!topic) {
      throw new Error(`${topicSlug} topic not found`);
    }

    return cities.map((city) => {
      const pathname =
        `/airbnb-optimizer/${city.slug}/${topicSlug}`;
      const quality = getCityTopicQuality(city, topic);

      return {
        pathname,
        topicSlug,
        quality,
      };
    });
  }
);

const qualityGatedOccupancyTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "occupancy-guide"
);

const qualityGatedTitleTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "title-optimization"
);

const qualityGatedGuestTrustTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "guest-trust-guide"
);

const qualityGatedPhotoTipsTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "photo-tips"
);

const qualityGatedDescriptionTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "description-optimization"
);

const qualityGatedBusinessTravelTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "business-travel-guide"
);

const qualityGatedListingAuditTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "listing-audit"
);

const qualityGatedRevenueTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "revenue-optimization"
);

const qualityGatedPricingPositioningTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "pricing-positioning"
);

const qualityGatedCompetitorAnalysisTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "competitor-analysis"
);

const qualityGatedSeasonalityTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "seasonality-guide"
);

const qualityGatedReviewStrategyTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "review-strategy"
);

const qualityGatedLocalDemandTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "local-demand-guide"
);

const qualityGatedPricingGuideTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "pricing-guide"
);

const qualityGatedSeoGuideTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "seo-guide"
);
const qualityGatedAmenitiesTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "amenities-guide"
);
const qualityGatedBookingConversionTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "booking-conversion"
);

const qualityGatedRankingFactorsTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "ranking-factors"
);

const qualityGatedSearchVisibilityTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "search-visibility"
);

const qualityGatedPhotoOrderTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "photo-order"
);

const qualityGatedFirstPhotoTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "first-photo"
);

const qualityGatedFamilyTravelTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "family-travel-guide"
);

const qualityGatedLongStayTopics = qualityGatedTopics.filter(
  ({ topicSlug }) => topicSlug === "long-stay-guide"
);

const exposedQualityFailures = qualityGatedTopics.filter(
  ({ pathname, quality }) =>
    isCityTopicSitemapEligible(pathname) &&
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
);

const overlap = priorityTopics.filter(
  (pathname) =>
    protectedTopics.includes(pathname)
);

const cohortPriorityOverlap =
  cohort25Topics.filter((pathname) =>
    priorityTopics.includes(pathname)
  );

const cohortProtectedOverlap =
  cohort25Topics.filter((pathname) =>
    protectedTopics.includes(pathname)
  );

const cohortExperimentOverlap =
  cohort25Topics.filter((pathname) =>
    experimentTopics.includes(pathname)
  );

console.log(`ALL_HUBS=${allHubs.length}`);
console.log(`ALL_TOPICS=${allTopics.length}`);

console.log(
  `PRIORITY_TOPICS=${priorityTopics.length}`
);
console.log(
  `GSC_PROTECTED_HOLD_TOPICS=${protectedTopics.length}`
);

console.log(
  `SITEMAP_EXPERIMENT_TOPICS=${experimentTopics.length}`
);
console.log(
  `COHORT_25_TOPICS=${cohort25Topics.length}`
);

console.log(
  `PRIORITY_PROTECTED_OVERLAP=${overlap.length}`
);

console.log(
  `COHORT_PRIORITY_OVERLAP=${cohortPriorityOverlap.length}`
);

console.log(
  `COHORT_PROTECTED_OVERLAP=${cohortProtectedOverlap.length}`
);

console.log(
  `COHORT_EXPERIMENT_OVERLAP=${cohortExperimentOverlap.length}`
);

console.log(`KEEP_TOPICS=${keptTopics.length}`);
console.log(`OMIT_TOPICS=${omittedTopics.length}`);

console.log(
  `LOCAL_SITEMAP_TARGET=${allHubs.length + keptTopics.length}`
);

console.log(
  `QUALITY_GATED_OCCUPANCY_TOPICS=${qualityGatedOccupancyTopics.length}`
);
console.log(
  `QUALITY_GATED_TITLE_TOPICS=${qualityGatedTitleTopics.length}`
);

console.log(
  `QUALITY_GATED_GUEST_TRUST_TOPICS=${qualityGatedGuestTrustTopics.length}`
);

console.log(
  `QUALITY_GATED_PHOTO_TIPS_TOPICS=${qualityGatedPhotoTipsTopics.length}`
);

console.log(
  `QUALITY_GATED_DESCRIPTION_TOPICS=${qualityGatedDescriptionTopics.length}`
);

console.log(
  `QUALITY_GATED_BUSINESS_TRAVEL_TOPICS=${qualityGatedBusinessTravelTopics.length}`
);

console.log(
  `QUALITY_GATED_LISTING_AUDIT_TOPICS=${qualityGatedListingAuditTopics.length}`
);
console.log(
  `QUALITY_GATED_REVENUE_TOPICS=${qualityGatedRevenueTopics.length}`
);
console.log(
  `QUALITY_GATED_PRICING_POSITIONING_TOPICS=${qualityGatedPricingPositioningTopics.length}`
);

console.log(
  `QUALITY_GATED_COMPETITOR_ANALYSIS_TOPICS=${qualityGatedCompetitorAnalysisTopics.length}`
);

console.log(
  `QUALITY_GATED_SEASONALITY_TOPICS=${qualityGatedSeasonalityTopics.length}`
);

console.log(
  `QUALITY_GATED_REVIEW_STRATEGY_TOPICS=${qualityGatedReviewStrategyTopics.length}`
);

console.log(
  `QUALITY_GATED_LOCAL_DEMAND_TOPICS=${qualityGatedLocalDemandTopics.length}`
);

console.log(
  `QUALITY_GATED_PRICING_GUIDE_TOPICS=${qualityGatedPricingGuideTopics.length}`
);

console.log(
  `QUALITY_GATED_SEO_GUIDE_TOPICS=${qualityGatedSeoGuideTopics.length}`
);
console.log(
  `QUALITY_GATED_AMENITIES_TOPICS=${qualityGatedAmenitiesTopics.length}`
);
console.log(
  `QUALITY_GATED_BOOKING_CONVERSION_TOPICS=${qualityGatedBookingConversionTopics.length}`
);

console.log(
  `QUALITY_GATED_RANKING_FACTORS_TOPICS=${qualityGatedRankingFactorsTopics.length}`
);

console.log(
  `QUALITY_GATED_SEARCH_VISIBILITY_TOPICS=${qualityGatedSearchVisibilityTopics.length}`
);
console.log(
  `QUALITY_GATED_PHOTO_ORDER_TOPICS=${qualityGatedPhotoOrderTopics.length}`
);
console.log(
  `QUALITY_GATED_FIRST_PHOTO_TOPICS=${qualityGatedFirstPhotoTopics.length}`
);
console.log(
  `QUALITY_GATED_FAMILY_TRAVEL_TOPICS=${qualityGatedFamilyTravelTopics.length}`
);
console.log(
  `QUALITY_GATED_LONG_STAY_TOPICS=${qualityGatedLongStayTopics.length}`
);

console.log(
  `EXPOSED_QUALITY_FAIL=${exposedQualityFailures.length}`
);

if (allHubs.length !== 220) {
  throw new Error(
    `Expected 220 hubs, got ${allHubs.length}`
  );
}

if (allTopics.length !== 5500) {
  throw new Error(
    `Expected 5500 topics, got ${allTopics.length}`
  );
}

if (priorityTopics.length !== 7) {
  throw new Error(
    `Expected 7 priority topics, got ${priorityTopics.length}`
  );
}

if (protectedTopics.length !== 29) {
  throw new Error(
    `Expected 29 protected HOLD topics, got ${protectedTopics.length}`
  );
}

if (experimentTopics.length !== 157) {
  throw new Error(
    `Expected 157 sitemap experiment topics, got ${experimentTopics.length}`
  );
}

if (cohort25Topics.length !== 25) {
  throw new Error(
    `Expected 25 Cohort sitemap topics, got ${cohort25Topics.length}`
  );
}

if (overlap.length !== 0) {
  throw new Error(
    `Expected no overlap between WINNER and HOLD protection, got ${overlap.length}`
  );
}

if (
  cohortPriorityOverlap.length !== 0 ||
  cohortProtectedOverlap.length !== 0 ||
  cohortExperimentOverlap.length !== 0
) {
  throw new Error(
    `Unexpected Cohort overlap: priority=${cohortPriorityOverlap.length}, protected=${cohortProtectedOverlap.length}, experiment=${cohortExperimentOverlap.length}`
  );
}

if (keptTopics.length !== 5069) {
  throw new Error(
    `Expected 5069 kept topics, got ${keptTopics.length}`
  );
}

if (omittedTopics.length !== 431) {
  throw new Error(
    `Expected 431 omitted topics, got ${omittedTopics.length}`
  );
}

if (qualityGatedOccupancyTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated occupancy topics, got ${qualityGatedOccupancyTopics.length}`
  );
}

if (qualityGatedTitleTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated title topics, got ${qualityGatedTitleTopics.length}`
  );
}

if (qualityGatedGuestTrustTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated guest-trust topics, got ${qualityGatedGuestTrustTopics.length}`
  );
}

if (qualityGatedPhotoTipsTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated photo-tips topics, got ${qualityGatedPhotoTipsTopics.length}`
  );
}

if (qualityGatedDescriptionTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated description topics, got ${qualityGatedDescriptionTopics.length}`
  );
}

if (qualityGatedBusinessTravelTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated business-travel topics, got ${qualityGatedBusinessTravelTopics.length}`
  );
}

if (qualityGatedRevenueTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated revenue topics, got ${qualityGatedRevenueTopics.length}`
  );
}

if (qualityGatedPricingPositioningTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated pricing-positioning topics, got ${qualityGatedPricingPositioningTopics.length}`
  );
}

if (qualityGatedCompetitorAnalysisTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated competitor-analysis topics, got ${qualityGatedCompetitorAnalysisTopics.length}`
  );
}

if (qualityGatedSeasonalityTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated seasonality topics, got ${qualityGatedSeasonalityTopics.length}`
  );
}

if (qualityGatedReviewStrategyTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated review-strategy topics, got ${qualityGatedReviewStrategyTopics.length}`
  );
}

if (qualityGatedLocalDemandTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated local-demand topics, got ${qualityGatedLocalDemandTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedLocalDemandTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated local-demand topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated local-demand topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

if (qualityGatedPricingGuideTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated pricing-guide topics, got ${qualityGatedPricingGuideTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedPricingGuideTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated pricing-guide topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated pricing-guide topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

if (qualityGatedSeoGuideTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated seo-guide topics, got ${qualityGatedSeoGuideTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedSeoGuideTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated seo-guide topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated seo-guide topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

if (qualityGatedBookingConversionTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated booking-conversion topics, got ${qualityGatedBookingConversionTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedBookingConversionTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated booking-conversion topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated booking-conversion topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

if (qualityGatedRankingFactorsTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated ranking-factors topics, got ${qualityGatedRankingFactorsTopics.length}`
  );
}

if (qualityGatedSearchVisibilityTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated search-visibility topics, got ${qualityGatedSearchVisibilityTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedSearchVisibilityTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated search-visibility topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated search-visibility topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

for (const { pathname, quality } of qualityGatedRankingFactorsTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated ranking-factors topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated ranking-factors topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

if (qualityGatedAmenitiesTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated amenities topics, got ${qualityGatedAmenitiesTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedAmenitiesTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated amenities topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated amenities topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

for (const { pathname, quality } of qualityGatedReviewStrategyTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated review-strategy topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated review-strategy topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

for (const { pathname, quality } of qualityGatedSeasonalityTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated seasonality topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated seasonality topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

for (const { pathname, quality } of qualityGatedCompetitorAnalysisTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated competitor-analysis topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated competitor-analysis topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

for (const { pathname, quality } of qualityGatedPricingPositioningTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated pricing-positioning topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated pricing-positioning topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

for (const { pathname, quality } of qualityGatedRevenueTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated revenue topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated revenue topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

if (qualityGatedListingAuditTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated listing-audit topics, got ${qualityGatedListingAuditTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedListingAuditTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated listing-audit topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated listing-audit topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

for (const { pathname, quality } of qualityGatedBusinessTravelTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated business-travel topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated business-travel topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

for (const { pathname, quality } of qualityGatedDescriptionTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated description topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated description topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

for (const { pathname, quality } of qualityGatedPhotoTipsTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated photo-tips topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Quality-gated photo-tips topic failed quality gate: ${pathname} (${quality.status})`
    );
  }
}

for (const { pathname, quality } of qualityGatedGuestTrustTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated guest-trust topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Guest-trust topic failed quality gate: ${pathname}`
    );
  }
}

for (const { pathname, quality } of qualityGatedOccupancyTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Quality-gated occupancy topic omitted: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Occupancy topic failed quality gate: ${pathname}`
    );
  }
}

if (exposedQualityFailures.length !== 0) {
  throw new Error(
    `Exposed occupancy quality failures: ${exposedQualityFailures.length}`
  );
}

for (const pathname of priorityTopics) {
  if (!keptTopics.includes(pathname)) {
    throw new Error(
      `Priority topic omitted: ${pathname}`
    );
  }
}

for (const pathname of protectedTopics) {
  if (!allTopics.includes(pathname)) {
    throw new Error(
      `Protected path is not a real city-topic route: ${pathname}`
    );
  }

  if (!keptTopics.includes(pathname)) {
    throw new Error(
      `Protected topic omitted: ${pathname}`
    );
  }
}

for (const pathname of experimentTopics) {
  if (!allTopics.includes(pathname)) {
    throw new Error(
      `Experiment path is not a real city-topic route: ${pathname}`
    );
  }

  if (!keptTopics.includes(pathname)) {
    throw new Error(
      `Experiment topic omitted: ${pathname}`
    );
  }

  if (getSearchEligibility(pathname).tier !== "hold") {
    throw new Error(
      `Experiment topic unexpectedly changed tier: ${pathname}`
    );
  }
}

for (const pathname of cohort25Topics) {
  if (!allTopics.includes(pathname)) {
    throw new Error(
      `Cohort path is not a real city-topic route: ${pathname}`
    );
  }

  if (!keptTopics.includes(pathname)) {
    throw new Error(
      `Cohort topic omitted: ${pathname}`
    );
  }

  const eligibility = getSearchEligibility(pathname);

  if (
    eligibility.tier !== "hold" ||
    !eligibility.searchEligible
  ) {
    throw new Error(
      `Cohort topic eligibility changed unexpectedly: ${pathname}`
    );
  }
}

const representativeHold =
  "/airbnb-optimizer/paris/conversion-guide";

if (
  getSearchEligibility(representativeHold).tier !== "hold"
) {
  throw new Error(
    "Representative HOLD path unexpectedly changed tier"
  );
}

if (isCityTopicSitemapEligible(representativeHold)) {
  throw new Error(
    "Representative unprotected HOLD path must be omitted"
  );
}

console.log("CITY_HUB_PRESERVATION=PASS");
console.log("PRIORITY_TOPIC_PRESERVATION=PASS");
console.log("GSC_PROTECTED_TOPIC_PRESERVATION=PASS");
console.log("SITEMAP_EXPERIMENT_TOPIC_PRESERVATION=PASS");
console.log("COHORT_25_TOPIC_PRESERVATION=PASS");
console.log("COHORT_25_OVERLAP_GUARD=PASS");
console.log("UNPROTECTED_HOLD_OMISSION=PASS");
console.log("QUALITY_GATED_OCCUPANCY_PRESERVATION=PASS");
console.log("QUALITY_GATED_TITLE_PRESERVATION=PASS");
console.log("QUALITY_GATED_GUEST_TRUST_PRESERVATION=PASS");
console.log("QUALITY_GATED_PHOTO_TIPS_PRESERVATION=PASS");
console.log("QUALITY_GATED_DESCRIPTION_PRESERVATION=PASS");
console.log("QUALITY_GATED_BUSINESS_TRAVEL_PRESERVATION=PASS");
console.log("QUALITY_GATED_LISTING_AUDIT_PRESERVATION=PASS");
console.log("QUALITY_GATED_REVENUE_PRESERVATION=PASS");
console.log("QUALITY_GATED_REVIEW_STRATEGY_PRESERVATION=PASS");
console.log("QUALITY_GATED_LOCAL_DEMAND_PRESERVATION=PASS");
console.log("QUALITY_GATED_PRICING_GUIDE_PRESERVATION=PASS");
console.log("QUALITY_GATED_SEO_GUIDE_PRESERVATION=PASS");
console.log("QUALITY_GATED_AMENITIES_PRESERVATION=PASS");
console.log("QUALITY_GATED_BOOKING_CONVERSION_PRESERVATION=PASS");
console.log("QUALITY_GATED_RANKING_FACTORS_PRESERVATION=PASS");
if (qualityGatedPhotoOrderTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated photo-order topics, got ${qualityGatedPhotoOrderTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedPhotoOrderTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Expected quality-gated photo-order path in sitemap: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Unsafe photo-order quality status for ${pathname}: ${quality.status}`
    );
  }
}

console.log("QUALITY_GATED_SEARCH_VISIBILITY_PRESERVATION=PASS");
if (qualityGatedFirstPhotoTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated first-photo topics, got ${qualityGatedFirstPhotoTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedFirstPhotoTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Expected quality-gated first-photo path in sitemap: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Unsafe first-photo quality status for ${pathname}: ${quality.status}`
    );
  }
}

console.log("QUALITY_GATED_PHOTO_ORDER_PRESERVATION=PASS");
console.log("QUALITY_GATED_FIRST_PHOTO_PRESERVATION=PASS");

if (qualityGatedFamilyTravelTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated family-travel-guide topics, got ${qualityGatedFamilyTravelTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedFamilyTravelTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Expected quality-gated family-travel-guide path in sitemap: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Unsafe family-travel-guide quality status for ${pathname}: ${quality.status}`
    );
  }
}

console.log("QUALITY_GATED_FAMILY_TRAVEL_PRESERVATION=PASS");

if (qualityGatedLongStayTopics.length !== 220) {
  throw new Error(
    `Expected 220 quality-gated long-stay-guide topics, got ${qualityGatedLongStayTopics.length}`
  );
}

for (const { pathname, quality } of qualityGatedLongStayTopics) {
  if (!isCityTopicSitemapEligible(pathname)) {
    throw new Error(
      `Expected quality-gated long-stay-guide path in sitemap: ${pathname}`
    );
  }

  if (
    quality.status !== "eligible-safe" &&
    quality.status !== "qualified-evidence"
  ) {
    throw new Error(
      `Unsafe long-stay-guide quality status for ${pathname}: ${quality.status}`
    );
  }
}

console.log("QUALITY_GATED_LONG_STAY_PRESERVATION=PASS");
console.log("EXPOSED_QUALITY_GUARD=PASS");
console.log("SITEMAP_SELECTION_SMOKE=PASS");

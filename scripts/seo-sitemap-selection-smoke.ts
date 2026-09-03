import { cities } from "../data/cities";
import { localSeoTopics } from "../data/localSeo";
import {
  getGscProtectedCityTopicPaths,
  isCityTopicSitemapEligible,
} from "../lib/seo/sitemapEligibility";
import { getSearchEligibility } from "../lib/seo/searchEligibility";

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

const keptTopics = allTopics.filter(
  isCityTopicSitemapEligible
);

const omittedTopics = allTopics.filter(
  (pathname) =>
    !isCityTopicSitemapEligible(pathname)
);

const overlap = priorityTopics.filter(
  (pathname) =>
    protectedTopics.includes(pathname)
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
  `PRIORITY_PROTECTED_OVERLAP=${overlap.length}`
);

console.log(`KEEP_TOPICS=${keptTopics.length}`);
console.log(`OMIT_TOPICS=${omittedTopics.length}`);

console.log(
  `LOCAL_SITEMAP_TARGET=${allHubs.length + keptTopics.length}`
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

if (overlap.length !== 0) {
  throw new Error(
    `Expected no overlap between WINNER and HOLD protection, got ${overlap.length}`
  );
}

if (keptTopics.length !== 36) {
  throw new Error(
    `Expected 36 kept topics, got ${keptTopics.length}`
  );
}

if (omittedTopics.length !== 5464) {
  throw new Error(
    `Expected 5464 omitted topics, got ${omittedTopics.length}`
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

const representativeHold =
  "/airbnb-optimizer/paris/pricing-guide";

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
console.log("UNPROTECTED_HOLD_OMISSION=PASS");
console.log("SITEMAP_SELECTION_SMOKE=PASS");

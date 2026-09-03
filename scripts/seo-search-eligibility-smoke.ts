import * as assert from "assert/strict";

import {
  getRegisteredSearchEligibilityPaths,
  getSearchEligibility,
  normalizeSearchPath,
  validateSearchEligibility,
} from "../lib/seo/searchEligibility";

function main() {
  const unknown = getSearchEligibility("/airbnb-optimizer/test-city/test-topic");

  assert.equal(unknown.tier, "hold");
  assert.equal(unknown.searchEligible, true);
  assert.equal(unknown.sitemapEligible, true);
  assert.equal(unknown.reason, "quality-review-pending");

  const core = getSearchEligibility("/");
  assert.equal(core.tier, "core");
  assert.equal(core.searchEligible, true);
  assert.equal(core.sitemapEligible, true);

  const winner = getSearchEligibility("/guides/airbnb-seo");
  assert.equal(winner.tier, "winner");
  assert.equal(winner.searchEligible, true);
  assert.equal(winner.sitemapEligible, true);

  assert.equal(normalizeSearchPath("guides/airbnb-seo"), "/guides/airbnb-seo");
  assert.equal(normalizeSearchPath("/guides/airbnb-seo/"), "/guides/airbnb-seo");
  const absoluteUrl = "https" + "://norixo.io/guides/airbnb-seo?x=1#y";
  assert.equal(normalizeSearchPath(absoluteUrl), "/guides/airbnb-seo");

  assert.throws(() =>
    validateSearchEligibility({
      tier: "winner",
      searchEligible: false,
      sitemapEligible: true,
      uniqueIntent: true,
      uniqueValue: true,
      localEvidence: false,
      reason: "explicit-winner",
    }),
  );

  assert.throws(() =>
    validateSearchEligibility({
      tier: "retire",
      searchEligible: false,
      sitemapEligible: false,
      uniqueIntent: false,
      uniqueValue: false,
      localEvidence: false,
      reason: "quality-review-pending",
    }),
  );

  assert.throws(() =>
    validateSearchEligibility({
      tier: "retire",
      searchEligible: false,
      sitemapEligible: true,
      uniqueIntent: false,
      uniqueValue: false,
      localEvidence: false,
      reason: "retirement-candidate",
    }),
  );

  const validRetire = validateSearchEligibility({
    tier: "retire",
    searchEligible: false,
    sitemapEligible: false,
    uniqueIntent: false,
    uniqueValue: false,
    localEvidence: false,
    reason: "retirement-candidate",
  });

  assert.equal(validRetire.sitemapEligible, false);

  const paths = getRegisteredSearchEligibilityPaths();
  assert.equal(new Set(paths).size, paths.length);

  const fallbackA = getSearchEligibility("/unknown-a");
  const fallbackB = getSearchEligibility("/unknown-b");
  assert.deepEqual(fallbackA, fallbackB);

  assert.equal("robots" in fallbackA, false);
  assert.equal("redirect" in fallbackA, false);

  const mutableCopy = { ...fallbackA };
  mutableCopy.uniqueIntent = true;
  assert.equal(getSearchEligibility("/unknown-a").uniqueIntent, false);

  console.log("PASS seo-search-eligibility-smoke");
  console.log("registered_paths=" + paths.length);
  console.log("fallback=non-destructive");
}

main();

const p0bPriorityPaths = [
  "/",
  "/airbnb-optimizer",
  "/guides",
  "/articles",
  "/tools",
  "/rankings",
  "/guides/airbnb-seo",
  "/guides/airbnb-listing-optimization",
  "/guides/airbnb-pricing-optimization",
  "/guides/airbnb-listing-audit",
  "/guides/airbnb-photo-optimization",
  "/guides/airbnb-conversion-optimization",
  "/airbnb-optimizer/sapporo/occupancy-guide",
  "/airbnb-optimizer/marrakech/revenue-optimization",
  "/airbnb-optimizer/helsinki/title-optimization",
  "/airbnb-optimizer/guadalajara/guest-trust-guide",
  "/airbnb-optimizer/bali/photo-tips",
  "/airbnb-optimizer/singapore/competitor-analysis",
  "/articles/airbnb-photo-mistakes",
  "/articles/airbnb-cleanliness",
  "/articles/airbnb-decor",
  "/articles/airbnb-villa-photography",
  "/rankings/best-airbnb-destinations-for-families",
  "/rankings/best-airbnb-cities",
  "/rankings/best-airbnb-cities-in-europe",
  "/airbnb-optimizer/mexico-city/pricing-guide",
  "/airbnb-optimizer/la-rochelle",
  "/airbnb-optimizer/doha",
] as const;

assert.equal(
  new Set(p0bPriorityPaths).size,
  28,
  "P0-B priority cohort must contain exactly 28 unique paths",
);

for (const pathname of p0bPriorityPaths) {
  const eligibility = getSearchEligibility(pathname);

  assert.equal(
    eligibility.searchEligible,
    true,
    `${pathname} must remain search eligible`,
  );

  assert.equal(
    eligibility.sitemapEligible,
    true,
    `${pathname} must remain sitemap eligible`,
  );

  assert.notEqual(
    eligibility.tier,
    "hold",
    `${pathname} must be explicitly registered`,
  );

  assert.notEqual(
    eligibility.tier,
    "retire",
    `${pathname} must not be retired`,
  );
}

const p0bCorePaths = new Set([
  "/",
  "/airbnb-optimizer",
  "/guides",
  "/articles",
  "/tools",
  "/rankings",
]);

for (const pathname of p0bPriorityPaths) {
  const eligibility = getSearchEligibility(pathname);
  const expectedTier = p0bCorePaths.has(pathname) ? "core" : "winner";

  assert.equal(
    eligibility.tier,
    expectedTier,
    `${pathname} must have expected P0-B tier`,
  );
}

for (const pathname of [
  "/airbnb-optimizer/sapporo/occupancy-guide",
  "/airbnb-optimizer/marrakech/revenue-optimization",
  "/airbnb-optimizer/helsinki/title-optimization",
  "/airbnb-optimizer/guadalajara/guest-trust-guide",
  "/airbnb-optimizer/bali/photo-tips",
  "/airbnb-optimizer/singapore/competitor-analysis",
  "/airbnb-optimizer/mexico-city/pricing-guide",
  "/airbnb-optimizer/la-rochelle",
  "/airbnb-optimizer/doha",
]) {
  assert.equal(
    getSearchEligibility(pathname).localEvidence,
    true,
    `${pathname} must carry local evidence`,
  );
}

const p0bUnregisteredControl = getSearchEligibility(
  "/airbnb-optimizer/paris/amenities-guide",
);

assert.equal(p0bUnregisteredControl.tier, "hold");
assert.equal(p0bUnregisteredControl.searchEligible, true);
assert.equal(p0bUnregisteredControl.sitemapEligible, true);

console.log("PASS seo-search-eligibility-p0-b");
console.log("priority_paths=28");
console.log("core_paths=6");
console.log("winner_paths=22");
console.log("unregistered_control=hold-non-destructive");

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

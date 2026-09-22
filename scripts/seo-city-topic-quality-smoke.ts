import { cities } from "../data/cities";
import { localSeoTopics } from "../data/localSeo";
import { getCityTopicQuality } from "../lib/seo/cityTopicQuality";

let total = 0;
let technicalSafe = 0;
let topicIntentDistinct = 0;
let cityContextPresent = 0;
let eligibleSafe = 0;
let qualifiedEvidence = 0;
let reviewLocalEvidence = 0;
let fail = 0;

for (const city of cities) {
  for (const topic of localSeoTopics) {
    const quality = getCityTopicQuality(city, topic);

    total++;

    if (quality.technicalSafe) technicalSafe++;
    if (quality.topicIntentDistinct) topicIntentDistinct++;
    if (quality.cityContextPresent) cityContextPresent++;

    if (quality.status === "eligible-safe") {
      eligibleSafe++;
    } else if (quality.status === "qualified-evidence") {
      qualifiedEvidence++;
    } else if (quality.status === "review-local-evidence") {
      reviewLocalEvidence++;
    } else {
      fail++;
    }
  }
}

const expectedTotal = cities.length * localSeoTopics.length;

if (total !== expectedTotal) {
  throw new Error(
    `Unexpected city-topic total: ${total}/${expectedTotal}`
  );
}

if (technicalSafe !== total) {
  throw new Error(`Technical safety regression: ${technicalSafe}/${total}`);
}

if (topicIntentDistinct !== total) {
  throw new Error(`Topic intent regression: ${topicIntentDistinct}/${total}`);
}

if (cityContextPresent !== total) {
  throw new Error(`City context regression: ${cityContextPresent}/${total}`);
}

if (reviewLocalEvidence !== 0) {
  throw new Error(`Unexpected local-evidence review pages: ${reviewLocalEvidence}`);
}

if (fail !== 0) {
  throw new Error(`City-topic quality failures: ${fail}`);
}

if (eligibleSafe + qualifiedEvidence !== total) {
  throw new Error("Passing quality partition does not match total.");
}

console.log("PASS seo-city-topic-quality-smoke");
console.log(`TOTAL=${total}`);
console.log(`TECHNICAL_SAFE=${technicalSafe}`);
console.log(`TOPIC_INTENT_DISTINCT=${topicIntentDistinct}`);
console.log(`CITY_CONTEXT_PRESENT=${cityContextPresent}`);
console.log(`ELIGIBLE_SAFE=${eligibleSafe}`);
console.log(`QUALIFIED_EVIDENCE=${qualifiedEvidence}`);
console.log(`REVIEW_LOCAL_EVIDENCE=${reviewLocalEvidence}`);
console.log(`FAIL=${fail}`);
console.log(`TOTAL_PASS=${eligibleSafe + qualifiedEvidence}`);

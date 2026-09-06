import assert from "node:assert/strict";

import { buildPublicListingAudit } from "../lib/freeAudit/buildPublicListingAudit";

const FORBIDDEN_KEYS = new Set([
  "raw_payload",
  "comparables",
  "metrics",
  "scoreBreakdown",
  "subScores",
  "priceSource",
  "eurApprox",
  "hostInfo",
  "hostName",
  "trustInsight",
  "rate",
  "availableDays",
  "unavailableDays",
  "observedDays",
  "windowDays",
  "source",
  "artifactId",
  "artifact_id",
  "factId",
  "fact_id",
]);

function collectForbiddenKeys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenKeys(item, found);
    return found;
  }

  if (value != null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) found.add(key);
      collectForbiddenKeys(nested, found);
    }
  }

  return found;
}

const publicResult = buildPublicListingAudit({
  listing_url: "https://www.airbnb.com/rooms/123456",
  title: "Appartement avec terrasse au centre de Paris",
  platform: "airbnb",
  propertyType: "apartment",
  score: 7.2,
  summary: "Annonce exploitable, mais plusieurs signaux peuvent encore etre renforces.",
  insights: [
    "12 photos detectees : la couverture visuelle est correcte.",
    "La description peut mieux mettre en avant les avantages differenciants.",
    "18 equipements detectes : la fiche rassure deja correctement.",
    "Cet insight ne doit pas sortir car la limite publique est de trois.",
  ],
  recommendations: [
    "Renforcez le titre avec l'atout principal du logement.",
    "Mettez davantage en avant les equipements differenciants.",
    "Cette recommandation ne doit pas sortir car la limite publique est de deux.",
  ],
  rating: 4.82,
  reviewCount: 47,
  trustBadge: "Coup de cœur voyageurs",
  trustSignals: {
    rating: 4.82,
    reviewCount: 47,
    hostName: "Sensitive host name",
    trustBadge: "Coup de cœur voyageurs",
    extractionStatus: "complete",
  },
  marketPositioning: {
    status: "ok",
    comparableCount: 12,
    summary: "Cette annonce est globalement dans la moyenne du marche local.",
    metrics: [
      {
        key: "photos",
        subjectValue: 12,
        marketAverage: 19,
      },
    ],
    comparables: [
      {
        url: "https://example.com/competitor",
        price: 175,
        currency: "EUR",
        priceSource: "runtime_payload",
      },
    ],
  },
  occupancyObservation: {
    status: "available",
    rate: 0.73,
    unavailableDays: 44,
    availableDays: 16,
    observedDays: 60,
    windowDays: 60,
    source: "runtime_calendar",
  },
  raw_payload: {
    secret: "must never escape",
  },
  scoreBreakdown: {
    visibility: 8.1,
    trust: 7.8,
    conversion: 6.5,
    dataQuality: 8.4,
  },
  subScores: [{ key: "photos", score: 2.1, weight: 3 }],
  priceSource: "runtime_payload",
  eurApprox: 150,
  hostInfo: "Sensitive host details",
  trustInsight: { score: 9 },
} as never);

assert.equal(publicResult.status, "available");
if (publicResult.status !== "available") {
  throw new Error("Expected an available public listing audit");
}

assert.equal(publicResult.listing.platform, "airbnb");
assert.equal(publicResult.score, 7.2);
assert.equal(publicResult.insights.length, 3);
assert.equal(publicResult.recommendations.length, 2);
assert.equal(publicResult.trust.rating, 4.82);
assert.equal(publicResult.trust.reviewCount, 47);
assert.equal(publicResult.trust.extractionStatus, "complete");
assert.equal(publicResult.market.status, "ok");
assert.equal(publicResult.market.comparableCount, 12);
assert.equal(publicResult.availability.detected, true);
assert.deepEqual(publicResult.lockedSections, [
  "photos",
  "description",
  "market_positioning",
  "occupancy",
  "conversion",
  "action_plan",
]);

const forbidden = [...collectForbiddenKeys(publicResult)].sort();
assert.deepEqual(forbidden, []);

const serialized = JSON.stringify(publicResult);
for (const forbiddenKey of FORBIDDEN_KEYS) {
  assert.equal(
    serialized.includes(`\"${forbiddenKey}\"`),
    false,
    `Public result leaked forbidden key: ${forbiddenKey}`
  );
}

const unavailable = buildPublicListingAudit({
  listing_url: "https://www.airbnb.com/rooms/123456",
  extractionFailed: true,
  reason: "airbnb_blocked",
});
assert.deepEqual(unavailable, {
  status: "unavailable",
  reason: "airbnb_blocked",
});

const missingUrl = buildPublicListingAudit({
  title: "Missing URL fixture",
});
assert.deepEqual(missingUrl, {
  status: "unavailable",
  reason: "listing_url_unavailable",
});

console.log("PASS — free audit public listing contract smoke");

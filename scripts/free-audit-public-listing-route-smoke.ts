import assert from "node:assert/strict";

import { handleFreeAuditPreviewRequest } from "../app/api/free-audit/preview/handler";
import { buildPublicListingAudit } from "../lib/freeAudit/buildPublicListingAudit";

const FORBIDDEN_KEYS = [
  "raw_payload",
  "comparables",
  "metrics",
  "scoreBreakdown",
  "subScores",
  "priceSource",
  "rate",
  "availableDays",
  "unavailableDays",
  "observedDays",
  "windowDays",
  "source",
] as const;

function buildAllowedRateLimitResult() {
  return {
    allowed: true,
    remaining: 9,
    retryAfterSeconds: 0,
    resetAt: 1_752_500_000_000,
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/free-audit/preview", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.20",
    },
    body: JSON.stringify(body),
  });
}

async function main() {
  let listingCalls = 0;
  let marketCalls = 0;
  let receivedListingUrl: string | null = null;

  const response = await handleFreeAuditPreviewRequest(
    buildRequest({
      listingUrl: "https://www.airbnb.com/rooms/123456#reviews",
      country: "France",
      city: "Paris",
      platform: "airbnb",
      propertyType: "apartment",
    }),
    {
      env: { ENABLE_FREE_AUDIT_PREVIEW: "true" },
      checkRateLimit: () => buildAllowedRateLimitResult(),
      buildPreview: async () => {
        marketCalls += 1;
        throw new Error("market preview must not run for listing requests");
      },
      buildListingPreview: async (input) => {
        listingCalls += 1;
        receivedListingUrl = input.listingUrl ?? null;
        return buildPublicListingAudit({
          listing_url: input.listingUrl,
          title: "Appartement avec terrasse au centre de Paris",
          platform: "airbnb",
          propertyType: "apartment",
          score: 7.2,
          summary: "Annonce exploitable avec plusieurs opportunites d'amelioration.",
          insights: ["Insight 1", "Insight 2", "Insight 3", "Insight 4"],
          recommendations: ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
          rating: 4.82,
          reviewCount: 47,
          trustBadge: "Guest favorite",
          trustSignals: {
            extractionStatus: "complete",
          },
          marketPositioning: {
            status: "ok",
            comparableCount: 12,
            summary: "Dans la moyenne du marche local.",
            metrics: [{ key: "photos", subjectValue: 12, marketAverage: 19 }],
            comparables: [
              {
                url: "https://example.com/competitor",
                price: 175,
                priceSource: "runtime_payload",
              },
            ],
          },
          occupancyObservation: {
            status: "available",
            rate: 0.73,
            availableDays: 16,
            unavailableDays: 44,
            observedDays: 60,
            windowDays: 60,
            source: "runtime_calendar",
          },
          raw_payload: { secret: "must never escape" },
          scoreBreakdown: {
            visibility: 8.1,
            trust: 7.8,
            conversion: 6.5,
            dataQuality: 8.4,
          },
          subScores: [{ key: "photos", score: 2.1 }],
          priceSource: "runtime_payload",
        } as never);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(response.headers.get("X-RateLimit-Limit"), "10");
  assert.equal(listingCalls, 1);
  assert.equal(marketCalls, 0);
  assert.equal(receivedListingUrl, "https://www.airbnb.com/rooms/123456");

  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.status, "available");
  assert.equal((body.listing as Record<string, unknown>).platform, "airbnb");
  assert.equal((body.availability as Record<string, unknown>).detected, true);

  const serialized = JSON.stringify(body);
  for (const key of FORBIDDEN_KEYS) {
    assert.equal(
      serialized.includes(`\"${key}\"`),
      false,
      `Listing route leaked forbidden key: ${key}`,
    );
  }

  const invalidHostResponse = await handleFreeAuditPreviewRequest(
    buildRequest({
      listingUrl: "https://example.com/rooms/123456",
      country: "France",
      city: "Paris",
      platform: "airbnb",
      propertyType: "apartment",
    }),
    {
      env: { ENABLE_FREE_AUDIT_PREVIEW: "true" },
      checkRateLimit: () => {
        throw new Error("rate limit must not run for invalid listing input");
      },
      buildListingPreview: async () => {
        throw new Error("listing preview must not run for invalid listing input");
      },
    },
  );

  assert.equal(invalidHostResponse.status, 400);
  assert.deepEqual(await invalidHostResponse.json(), {
    status: "invalid_request",
    message: "La demande d'apercu est invalide.",
  });

  const platformMismatchResponse = await handleFreeAuditPreviewRequest(
    buildRequest({
      listingUrl: "https://www.airbnb.com/rooms/123456",
      country: "France",
      city: "Paris",
      platform: "booking",
      propertyType: "apartment",
    }),
    {
      env: { ENABLE_FREE_AUDIT_PREVIEW: "true" },
      checkRateLimit: () => {
        throw new Error("rate limit must not run for platform mismatch");
      },
      buildListingPreview: async () => {
        throw new Error("listing preview must not run for platform mismatch");
      },
    },
  );

  assert.equal(platformMismatchResponse.status, 400);

  console.log("PASS — free audit public listing route smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";

import { extractBookingSearchQueries } from "../lib/competitors/booking-search";
import type { ExtractedListing } from "../lib/extractors/types";

function target(propertyType: string): ExtractedListing {
  return {
    url: "https://www.airbnb.com/rooms/1349159372150853675",
    platform: "airbnb",
    title: "Marrakech target",
    description: "",
    amenities: [],
    photos: [],
    locationLabel: "Marrakech, Morocco",
    propertyType,
    latitude: 31.6379,
    longitude: -8.0181,
  } as ExtractedListing;
}

const studioQueries = extractBookingSearchQueries(target("studio"));

assert.deepEqual(
  studioQueries,
  [
    "studio marrakech morocco",
    "marrakech morocco studio",
    "studio marrakech",
    "marrakech studio",
    "apartment marrakech morocco",
    "marrakech morocco apartment",
  ],
  "studio_like must prioritize Studio queries while preserving Apartment fallback"
);

assert.equal(
  studioQueries.length,
  6,
  "normal Booking query plan must preserve the existing six-query cap"
);

assert.equal(
  studioQueries.some((query) => query.includes("nflt=") || query.includes("ht_id=")),
  false,
  "studio query plan must not invent Booking native property-type filters"
);

const apartmentQueries = extractBookingSearchQueries(target("apartment"));

assert.deepEqual(
  apartmentQueries,
  [
    "apartment marrakech morocco",
    "marrakech morocco apartment",
    "appartement marrakech morocco",
    "marrakech morocco appartement",
    "apartment marrakech",
    "marrakech apartment",
  ],
  "apartment query plan must remain unchanged"
);

assert.equal(
  apartmentQueries.some((query) => /\bstudio\b/.test(query)),
  false,
  "non-studio targets must not receive Studio query priority"
);

console.log("PASS — Booking studio query plan smoke");

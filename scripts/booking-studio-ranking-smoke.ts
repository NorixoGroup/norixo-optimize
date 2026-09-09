import assert from "node:assert/strict";

import {
  inferBookingCandidateTypeFromUrl,
  rankBookingComparableUrl,
} from "../lib/competitors/booking-search";

import type { ExtractedListing } from "../lib/extractors/types";

const target = {
  url: "https://www.airbnb.com/rooms/1349159372150853675",
  platform: "airbnb",
  title: "Marrakech studio target",
  description: "",
  amenities: [],
  photos: [],
  locationLabel: "Marrakech, Morocco",
  propertyType: "studio",
  latitude: 31.6379,
  longitude: -8.0181,
  structure: {
    capacity: null,
    bedrooms: null,
    bedCount: null,
    bathrooms: null,
    propertyType: "studio",
    locationLabel: "Marrakech, Morocco",
  },
} as ExtractedListing;

const urls = {
  studio:
    "https://www.booking.com/hotel/ma/studio-marrakech-gueliz.html",

  apartment:
    "https://www.booking.com/hotel/ma/apartment-marrakech-gueliz.html",

  aparthotel:
    "https://www.booking.com/hotel/ma/aparthotel-marrakech.html",

  unknown:
    "https://www.booking.com/hotel/ma/swiss-continental.html",

  hotel:
    "https://www.booking.com/hotel/ma/hotel-marrakech-centre.html",

  realWazo:
    "https://www.booking.com/hotel/ma/wazo-appart.html",
};

const scored = Object.entries(urls).map(([name, url]) => ({
  name,
  type: inferBookingCandidateTypeFromUrl(url),
  score: rankBookingComparableUrl(target, url),
  url,
}));

console.table(scored);

const score = Object.fromEntries(
  scored.map((row) => [row.name, row.score])
) as Record<string, number>;

assert.equal(
  inferBookingCandidateTypeFromUrl(urls.studio),
  "studio"
);

assert.equal(
  inferBookingCandidateTypeFromUrl(urls.apartment),
  "apartment"
);

assert.equal(
  inferBookingCandidateTypeFromUrl(urls.aparthotel),
  "apartment"
);

assert.equal(
  inferBookingCandidateTypeFromUrl(urls.unknown),
  "unknown"
);

assert.equal(
  inferBookingCandidateTypeFromUrl(urls.hotel),
  "hotel"
);

/*
 * Ranking invariant only.
 * This does NOT make apartment/aparthotel valid studio comparables.
 * Final production extraction/type gates remain authoritative.
 */
assert.ok(
  score.studio > score.apartment,
  `studio must outrank apartment: ${score.studio} <= ${score.apartment}`
);

assert.ok(
  score.apartment > score.unknown,
  `apartment must outrank unknown: ${score.apartment} <= ${score.unknown}`
);

assert.ok(
  score.aparthotel > score.unknown,
  `aparthotel must outrank unknown: ${score.aparthotel} <= ${score.unknown}`
);

assert.ok(
  score.unknown > score.hotel,
  `unknown must outrank explicit hotel: ${score.unknown} <= ${score.hotel}`
);

/*
 * Real candidate observed in Marrakech discovery.
 * Its slug may remain "unknown" in strict URL-type inference,
 * but its explicit "appart" preselection signal should improve ranking.
 */
assert.equal(
  inferBookingCandidateTypeFromUrl(urls.realWazo),
  "unknown"
);

assert.ok(
  score.realWazo > score.unknown,
  `wazo-appart signal must outrank neutral unknown: ${score.realWazo} <= ${score.unknown}`
);

console.log("PASS — Booking studio ranking smoke");

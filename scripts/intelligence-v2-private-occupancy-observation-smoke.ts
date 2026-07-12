import assert from "node:assert/strict";

import {
  buildPrivateOccupancyObservation,
} from "../lib/intelligenceV2/privateOccupancyObservation";

const observation =
  buildPrivateOccupancyObservation(
    {
      platform: "booking",
      propertyType: "apartment",
      capacity: 4,
      guestCapacity: 4,
      occupancyObservation: {
        status: "available",
        rate: 0.6,
        observedDays: 30,
        unavailableDays: 18,
        availableDays: 12,
        windowDays: 30,
        source: "calendar",
      },
      extractionMeta: {
        extractor: "booking",
        extractedAt:
          "2026-07-12T12:00:00.000Z",
        warnings: [],
      },
    } as never,
    "private-signature",
  );

assert.ok(observation);

assert.equal(
  observation?.privateOccupancySignature,
  "private-signature",
);

assert.equal(
  observation?.observedDays,
  30,
);

assert.equal(
  observation?.unavailableDays,
  18,
);

assert.equal(
  observation?.availableDays,
  12,
);

assert.equal(
  observation?.windowDays,
  30,
);

assert.equal(
  observation?.sourceKind,
  "live_observation",
);

console.log(
  "PASS — Intelligence v2 Private Occupancy Observation smoke",
);

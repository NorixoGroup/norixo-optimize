import assert from "node:assert/strict";
import fs from "node:fs";

const types = fs.readFileSync("lib/extractors/types.ts", "utf8");
const booking = fs.readFileSync("lib/extractors/booking.ts", "utf8");
const route = fs.readFileSync(
  "app/api/admin/marketing-studio/debug/booking-cross-platform-quality/route.ts",
  "utf8"
);

assert.match(types, /BookingUnitTypeDiagnosticSignal/);
assert.match(types, /onBookingUnitTypeDiagnostic/);
assert.match(types, /evidenceKind: "explicit_type" \| "name" \| "context_only"/);

assert.match(booking, /collectBookingUnitTypeDiagnosticSignalsFromUnknown/);
assert.match(booking, /structured_script/);
assert.match(booking, /network_payload/);
assert.match(booking, /getBookingUnitTypeDiagnosticEvidenceKind/);
assert.match(booking, /case "room_type":/);
assert.match(booking, /case "unit_type":/);
assert.match(booking, /return "explicit_type"/);
assert.match(booking, /case "room_name":/);
assert.match(booking, /case "unit_name":/);
assert.match(booking, /return "name"/);
assert.match(booking, /case "room_description":/);
assert.match(booking, /case "accommodation_type":/);
assert.match(booking, /return "context_only"/);

assert.match(route, /unitTypeDiagnostics/);
assert.match(route, /onBookingUnitTypeDiagnostic/);

/*
 * Critical invariant:
 * diagnostic evidence must not alter market/property-type authority.
 */
const addedLogic = booking.slice(
  booking.indexOf("BOOKING_UNIT_TYPE_DIAGNOSTIC_KEYS"),
  booking.indexOf("function extractBookingOccupancySignalsFromUnknown")
);

assert.doesNotMatch(addedLogic, /propertyType\s*=/);
assert.doesNotMatch(addedLogic, /studio_like/);
assert.doesNotMatch(addedLogic, /apartment_like/);
assert.doesNotMatch(addedLogic, /property_type_mismatch/);
assert.doesNotMatch(addedLogic, /getNormalizedComparableType/);

const forbiddenDiagnosticFields = [
  "rawHtml",
  "raw_payload",
  "cookies",
  "storageState",
  "access_token",
  "password",
];

const diagnosticContract = types.slice(
  types.indexOf("export type BookingUnitTypeDiagnosticSignal"),
  types.indexOf("export type ExtractListingOptions")
);

for (const forbidden of forbiddenDiagnosticFields) {
  assert.equal(
    diagnosticContract.includes(forbidden),
    false,
    `unit-type diagnostic contract must not expose ${forbidden}`
  );
}

console.log("PASS — Booking unit type diagnostic collector smoke");

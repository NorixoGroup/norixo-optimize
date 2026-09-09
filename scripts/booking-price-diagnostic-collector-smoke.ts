import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const typesSource = readFileSync("lib/extractors/types.ts", "utf8");
const bookingSource = readFileSync("lib/extractors/booking.ts", "utf8");
const routeSource = readFileSync(
  "app/api/admin/marketing-studio/debug/booking-cross-platform-quality/route.ts",
  "utf8"
);

assert.match(
  typesSource,
  /onBookingPriceDiagnostic\?: \(event: BookingPriceDiagnosticEvent\) => void/
);

assert.match(bookingSource, /stage: "initial"/);
assert.match(bookingSource, /stage: "recovery"/);
assert.match(bookingSource, /parsedPrice:/);
assert.match(bookingSource, /rejectReason:/);

assert.match(routeSource, /const priceDiagnostics: BookingPriceDiagnosticEvent\[\] = \[\]/);
assert.match(routeSource, /onBookingPriceDiagnostic:/);
assert.match(routeSource, /priceDiagnostics\.push\(event\)/);

const forbiddenDiagnosticFields = [
  "html:",
  "rawHtml",
  "raw_payload",
  "cookies:",
  "storageState",
  "access_token",
  "BRIGHTDATA_BROWSER_PASSWORD:",
  "BRIGHTDATA_PASSWORD:",
];

const diagnosticTypeSlice = typesSource.slice(
  typesSource.indexOf("export type BookingPriceDiagnosticCandidate"),
  typesSource.indexOf("export type ExtractListingOptions")
);

for (const value of forbiddenDiagnosticFields) {
  assert.equal(
    diagnosticTypeSlice.includes(value),
    false,
    `sanitized diagnostic contract must not expose ${value}`
  );
}

console.log("PASS — Booking price diagnostic collector smoke");

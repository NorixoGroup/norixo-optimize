import assert from "node:assert/strict";

import {
  FREE_AUDIT_ALLOWED_PAYLOAD_KEYS,
  detectSupportedPlatformFromListingUrl,
  formatCurrencyValue,
  mapPreviewErrorStatus,
  validateFreeAuditForm,
  type FreeAuditFormValues,
} from "../app/(default)/free-audit/freeAuditPageModel";

function buildValidForm(
  overrides: Partial<FreeAuditFormValues> = {},
): FreeAuditFormValues {
  return {
    listingUrl: "https://www.airbnb.com/rooms/123456789",
    country: "France",
    city: "Paris",
    platform: "airbnb",
    propertyType: "apartment",
    ...overrides,
  };
}

function main() {
  const valid = validateFreeAuditForm(buildValidForm());
  assert.equal(valid.ok, true);
  if (!valid.ok) throw new Error("Expected valid form payload");
  assert.deepEqual(Object.keys(valid.payload).sort(), [...FREE_AUDIT_ALLOWED_PAYLOAD_KEYS].sort());
  assert.equal(valid.payload.listingUrl, "https://www.airbnb.com/rooms/123456789");
  assert.equal(valid.payload.platform, "airbnb");
  assert.equal(valid.payload.propertyType, "apartment");
  assert.equal("guestCapacity" in valid.payload, false);
  assert.equal("declaredNightlyPrice" in valid.payload, false);
  assert.equal("currency" in valid.payload, false);

  const emptyUrl = validateFreeAuditForm(buildValidForm({ listingUrl: "" }));
  assert.equal(emptyUrl.ok, false);
  if (emptyUrl.ok) throw new Error("Expected listing URL to be required");
  assert.equal(emptyUrl.errors.listingUrl, "listing_url_invalid");

  const invalidUrl = validateFreeAuditForm(buildValidForm({ listingUrl: "notaurl" }));
  assert.equal(invalidUrl.ok, false);
  if (invalidUrl.ok) throw new Error("Expected invalid listing URL");
  assert.equal(invalidUrl.errors.listingUrl, "listing_url_invalid");

  const detected = validateFreeAuditForm(
    buildValidForm({
      platform: "",
      listingUrl: "www.booking.com/hotel/fr/example.fr.html",
    }),
  );
  assert.equal(detected.ok, true);
  if (!detected.ok) throw new Error("Expected detected platform");
  assert.equal(detected.payload.platform, "booking");
  assert.equal(detected.payload.listingUrl.startsWith("https://www.booking.com/"), true);

  const mismatch = validateFreeAuditForm(
    buildValidForm({
      platform: "booking",
      listingUrl: "https://www.airbnb.com/rooms/123456789",
    }),
  );
  assert.equal(mismatch.ok, false);
  if (mismatch.ok) throw new Error("Expected URL/platform mismatch rejection");
  assert.equal(mismatch.errors.listingUrl, "listing_url_invalid");

  assert.equal(detectSupportedPlatformFromListingUrl("https://www.airbnb.com/rooms/123456"), "airbnb");
  assert.equal(detectSupportedPlatformFromListingUrl("https://www.booking.com/hotel/fr/test.fr.html"), "booking");
  assert.equal(detectSupportedPlatformFromListingUrl("notaurl"), null);

  assert.equal(mapPreviewErrorStatus("invalid_request"), "invalid_request");
  assert.equal(mapPreviewErrorStatus("rate_limited"), "rate_limited");
  assert.equal(mapPreviewErrorStatus("unavailable"), "unavailable");
  assert.equal(mapPreviewErrorStatus("something_else"), "unknown_error");

  const formatted = formatCurrencyValue("fr", "EUR", 145);
  assert.equal(formatted.includes("145"), true);
  assert.equal(formatted.includes("EUR"), false);

  console.log("PASS — Free audit page model smoke");
}

main();

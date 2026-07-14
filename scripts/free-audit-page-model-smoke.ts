import assert from "node:assert/strict";

import {
  FREE_AUDIT_ALLOWED_PAYLOAD_KEYS,
  detectSupportedPlatformFromListingUrl,
  formatCurrencyValue,
  mapPreviewErrorStatus,
  validateFreeAuditForm,
  type FreeAuditFormValues,
} from "../app/free-audit/freeAuditPageModel";

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
  {
    const validation = validateFreeAuditForm(buildValidForm());
    assert.equal(validation.ok, true);
    if (!validation.ok) {
      throw new Error("Expected valid form payload");
    }

    assert.deepEqual(
      Object.keys(validation.payload).sort(),
      [...FREE_AUDIT_ALLOWED_PAYLOAD_KEYS].sort(),
    );
    assert.equal("listingUrl" in validation.payload, false);
    assert.equal("guestCapacity" in validation.payload, false);
    assert.equal("declaredNightlyPrice" in validation.payload, false);
    assert.equal("currency" in validation.payload, false);
    assert.equal(validation.payload.platform, "airbnb");
    assert.equal(validation.payload.propertyType, "apartment");
  }

  {
    const validation = validateFreeAuditForm(buildValidForm({ listingUrl: "" }));
    assert.equal(validation.ok, true);
  }

  {
    const validation = validateFreeAuditForm(
      buildValidForm({ listingUrl: "notaurl" }),
    );
    assert.equal(validation.ok, false);
    if (validation.ok) {
      throw new Error("Expected invalid listing URL");
    }
    assert.equal(validation.errors.listingUrl, "listing_url_invalid");
  }

  {
    const validation = validateFreeAuditForm(
      buildValidForm({
        platform: "",
        listingUrl: "www.booking.com/hotel/fr/example.fr.html",
      }),
    );
    assert.equal(validation.ok, true);
    if (!validation.ok) {
      throw new Error("Expected detected booking platform");
    }
    assert.equal(validation.payload.platform, "booking");
  }

  {
    const validation = validateFreeAuditForm(
      buildValidForm({
        listingUrl: "",
        country: "",
        city: "",
        platform: "",
        propertyType: "",
      }),
    );
    assert.equal(validation.ok, false);
    if (validation.ok) {
      throw new Error("Expected required field errors");
    }
    assert.equal(validation.errors.country, "country_required");
    assert.equal(validation.errors.city, "city_required");
    assert.equal(validation.errors.platform, "platform_required");
    assert.equal(validation.errors.propertyType, "property_type_required");
    assert.equal("currency" in validation.errors, false);
  }

  {
    assert.equal(
      detectSupportedPlatformFromListingUrl("https://www.airbnb.com/rooms/123456"),
      "airbnb",
    );
    assert.equal(
      detectSupportedPlatformFromListingUrl("https://www.booking.com/hotel/fr/test.fr.html"),
      "booking",
    );
    assert.equal(detectSupportedPlatformFromListingUrl("notaurl"), null);
  }

  {
    assert.equal(mapPreviewErrorStatus("invalid_request"), "invalid_request");
    assert.equal(mapPreviewErrorStatus("rate_limited"), "rate_limited");
    assert.equal(mapPreviewErrorStatus("unavailable"), "unavailable");
    assert.equal(mapPreviewErrorStatus("something_else"), "unknown_error");
    assert.equal(mapPreviewErrorStatus(undefined), "unknown_error");
  }

  {
    const formatted = formatCurrencyValue("fr", "EUR", 145);
    assert.equal(formatted.includes("145"), true);
    assert.equal(formatted.includes("EUR"), false);
  }

  console.log("PASS — Free audit page model smoke");
}

main();

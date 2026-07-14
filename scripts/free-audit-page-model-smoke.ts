import assert from "node:assert/strict";

import {
  FREE_AUDIT_ALLOWED_PAYLOAD_KEYS,
  detectSupportedPlatformFromListingUrl,
  formatCurrencyValue,
  formatPercentValue,
  getConfidenceLevelLabelKey,
  getDeltaDirection,
  getPositioningLabelKey,
  getSampleBandLabelKey,
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
    guestCapacity: "4",
    declaredNightlyPrice: "145",
    currency: "EUR",
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

    assert.deepEqual(Object.keys(validation.payload).sort(), [...FREE_AUDIT_ALLOWED_PAYLOAD_KEYS].sort());
    assert.equal("listingUrl" in validation.payload, false);
    assert.equal(validation.payload.platform, "airbnb");
    assert.equal(validation.payload.guestCapacity, 4);
    assert.equal(validation.payload.declaredNightlyPrice, 145);
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
      buildValidForm({ country: "", city: "", propertyType: "", currency: "" }),
    );
    assert.equal(validation.ok, false);
    if (validation.ok) {
      throw new Error("Expected required field errors");
    }
    assert.equal(validation.errors.country, "country_required");
    assert.equal(validation.errors.city, "city_required");
    assert.equal(validation.errors.propertyType, "property_type_required");
    assert.equal(validation.errors.currency, "currency_required");
  }

  {
    const validation = validateFreeAuditForm(
      buildValidForm({ declaredNightlyPrice: "0", guestCapacity: "" }),
    );
    assert.equal(validation.ok, false);
    if (validation.ok) {
      throw new Error("Expected numeric validation errors");
    }
    assert.equal(validation.errors.declaredNightlyPrice, "declared_price_invalid");
    assert.equal(validation.errors.guestCapacity, "guest_capacity_required");
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
    assert.equal(getPositioningLabelKey("well_below_market"), "well_below_market");
    assert.equal(getPositioningLabelKey("below_market"), "below_market");
    assert.equal(getPositioningLabelKey("near_market"), "near_market");
    assert.equal(getPositioningLabelKey("above_market"), "above_market");
    assert.equal(getPositioningLabelKey("well_above_market"), "well_above_market");
  }

  {
    assert.equal(getDeltaDirection(23), "above_median");
    assert.equal(getDeltaDirection(-12), "below_median");
    assert.equal(getDeltaDirection(0), "at_median");
    assert.equal(formatPercentValue(23), "23");
    assert.equal(formatPercentValue(-12.5), "12.5");
  }

  {
    assert.equal(getConfidenceLevelLabelKey("standard"), "standard");
    assert.equal(getConfidenceLevelLabelKey("high"), "high");
    assert.equal(getSampleBandLabelKey("sufficient"), "sufficient");
    assert.equal(getSampleBandLabelKey("strong"), "strong");
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

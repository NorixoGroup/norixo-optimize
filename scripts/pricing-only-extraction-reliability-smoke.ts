import {
  evaluatePricingOnlyExtractionReliability,
  isUnreliablePricingOnlyExtraction,
} from "../lib/extractors/pricingOnlyExtractionReliability";
import type { ExtractedListing } from "../lib/extractors/types";

function listing(
  overrides: Partial<ExtractedListing> = {},
): ExtractedListing {
  return {
    url: "https://example.com/listing",
    platform: "expedia",
    title: "",
    description: "",
    amenities: [],
    photos: [],
    price: null,
    ...overrides,
  };
}

function expect(
  condition: unknown,
  label: string,
): void {
  if (!condition) {
    throw new Error(`FAIL: ${label}`);
  }

  console.log(`PASS: ${label}`);
}

const expediaPriceOnly = listing({
  platform: "expedia",
  price: 187,
});

const expediaNoPrice = listing({
  platform: "expedia",
});

const expediaChallengeWithPrice = listing({
  platform: "expedia",
  title: "Access denied",
  description: "Verify that you are human",
  price: 187,
});

const vrboPriceOnly = listing({
  platform: "vrbo",
  price: 210,
});

const abritelNormalizedVrboChallenge = listing({
  platform: "vrbo",
  url: "https://www.abritel.fr/location-vacances/p1718754",
  title: "Robot ou pas robot ?",
  price: 210,
});

const vrboStayTotal = listing({
  platform: "vrbo",
  price: null,
  rawStayPrice: 1000,
  stayNights: 5,
});

const vrboStayTotalWithoutNights = listing({
  platform: "vrbo",
  price: null,
  rawStayPrice: 1000,
  stayNights: null,
});

const bookingNoPrice = listing({
  platform: "booking",
});

expect(
  evaluatePricingOnlyExtractionReliability(expediaPriceOnly).reliable,
  "expedia pricing_only accepts positive price without full description/photos",
);

expect(
  isUnreliablePricingOnlyExtraction(expediaNoPrice),
  "expedia pricing_only rejects missing usable price",
);

expect(
  isUnreliablePricingOnlyExtraction(expediaChallengeWithPrice),
  "expedia pricing_only rejects challenge even when a price exists",
);

expect(
  evaluatePricingOnlyExtractionReliability(vrboPriceOnly).reliable,
  "vrbo pricing_only accepts positive price without full description/photos",
);

expect(
  isUnreliablePricingOnlyExtraction(abritelNormalizedVrboChallenge),
  "abritel normalized as vrbo rejects challenge shell",
);

expect(
  evaluatePricingOnlyExtractionReliability(vrboStayTotal).reliable,
  "vrbo pricing_only accepts positive stay total with positive night count",
);

expect(
  isUnreliablePricingOnlyExtraction(vrboStayTotalWithoutNights),
  "vrbo pricing_only rejects stay total without night count",
);

const bookingResult =
  evaluatePricingOnlyExtractionReliability(bookingNoPrice);

expect(
  !bookingResult.guardedPlatform && bookingResult.reliable,
  "booking behavior is untouched by this platform-specific guard",
);

console.log("P0-B4.5a=PASS_PRICING_ONLY_CONTRACT");

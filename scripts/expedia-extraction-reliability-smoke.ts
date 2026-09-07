import {
  evaluateExpediaExtractionReliability,
  isUnreliableExpediaExtraction,
} from "../lib/extractors/expediaExtractionReliability";
import type { ExtractedListing } from "../lib/extractors/types";

function fixture(
  overrides: Partial<ExtractedListing> = {},
): ExtractedListing {
  return {
    url: "https://www.expedia.com/example",
    sourceUrl: "https://www.expedia.com/example",
    platform: "expedia",
    sourcePlatform: "expedia",
    title: "Example Hotel",
    description:
      "A".repeat(300),
    amenities: [
      "Wi-Fi",
      "Pool",
    ],
    photos: [
      "https://example.test/1.jpg",
      "https://example.test/2.jpg",
      "https://example.test/3.jpg",
    ],
    photosCount: 3,
    structure: {
      capacity: null,
      bedrooms: null,
      bedCount: null,
      bathrooms: null,
      propertyType: "hotel",
      locationLabel: "Paris",
    },
    ...overrides,
  } as ExtractedListing;
}

let failed = 0;

function check(
  label: string,
  condition: boolean,
) {
  if (condition) {
    console.log(`PASS ${label}`);
    return;
  }

  failed += 1;
  console.error(`FAIL ${label}`);
}

const healthy = fixture();

check(
  "healthy Expedia extraction is reliable",
  !isUnreliableExpediaExtraction(healthy),
);

const healthyResult =
  evaluateExpediaExtractionReliability(healthy);

check(
  "healthy Expedia has no hard failures",
  healthyResult.reliable === true,
);

const zeroPhotos = fixture({
  photos: [],
  photosCount: 0,
});

check(
  "zero-photo Expedia extraction fails closed",
  isUnreliableExpediaExtraction(zeroPhotos),
);

check(
  "zero-photo reason is explicit",
  evaluateExpediaExtractionReliability(
    zeroPhotos,
  ).reasons.includes("insufficient_photos"),
);

const onePhoto = fixture({
  photos: [
    "https://example.test/1.jpg",
  ],
  photosCount: 68,
});

check(
  "declared photosCount cannot fake real extracted photos",
  isUnreliableExpediaExtraction(onePhoto),
);

const duplicatePhotos = fixture({
  photos: [
    "https://example.test/1.jpg",
    "https://example.test/1.jpg",
    "https://example.test/2.jpg",
  ],
  photosCount: 3,
});

check(
  "duplicate URLs do not satisfy three-photo requirement",
  isUnreliableExpediaExtraction(
    duplicatePhotos,
  ),
);

const invalidPhotos = fixture({
  photos: [
    "not-a-url",
    "/relative.jpg",
    "https://example.test/1.jpg",
  ],
  photosCount: 3,
});

check(
  "invalid and relative photo URLs do not satisfy requirement",
  isUnreliableExpediaExtraction(
    invalidPhotos,
  ),
);

const shortDescription = fixture({
  description: "Too short",
});

check(
  "short Expedia description fails closed",
  isUnreliableExpediaExtraction(
    shortDescription,
  ),
);

const missingTitle = fixture({
  title: "",
});

check(
  "missing Expedia title fails closed",
  isUnreliableExpediaExtraction(
    missingTitle,
  ),
);

const noAmenities = fixture({
  amenities: [],
});

const noAmenitiesResult =
  evaluateExpediaExtractionReliability(
    noAmenities,
  );

check(
  "missing amenities are recorded",
  noAmenitiesResult.reasons.includes(
    "amenities_unavailable",
  ),
);

check(
  "missing amenities alone are not yet a hard failure",
  noAmenitiesResult.reliable === true,
);

const bookingFixture = fixture({
  platform: "booking",
  sourcePlatform: "booking",
  title: "",
  description: "",
  photos: [],
  photosCount: 0,
  amenities: [],
});

check(
  "guard does not affect Booking",
  !isUnreliableExpediaExtraction(
    bookingFixture,
  ),
);

const airbnbFixture = fixture({
  platform: "airbnb",
  sourcePlatform: "airbnb",
  title: "",
  description: "",
  photos: [],
  photosCount: 0,
  amenities: [],
});

check(
  "guard does not affect Airbnb",
  !isUnreliableExpediaExtraction(
    airbnbFixture,
  ),
);

console.log(
  `EXPEDIA_RELIABILITY_TESTS=${
    failed === 0 ? "PASS" : "FAIL"
  }`,
);

console.log(
  `EXPEDIA_RELIABILITY_FAILURES=${failed}`,
);

if (failed > 0) {
  process.exitCode = 1;
}

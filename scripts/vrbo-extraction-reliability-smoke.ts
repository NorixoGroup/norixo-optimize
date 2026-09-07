import {
  evaluateVrboExtractionReliability,
  isUnreliableVrboExtraction,
} from "../lib/extractors/vrboExtractionReliability";
import type { ExtractedListing } from "../lib/extractors/types";

function fixture(
  overrides: Partial<ExtractedListing> = {},
): ExtractedListing {
  return {
    url: "https://www.vrbo.com/example",
    sourceUrl: "https://www.vrbo.com/example",
    platform: "vrbo",
    sourcePlatform: "vrbo",
    title: "A legitimate vacation rental",
    description:
      "A".repeat(300),
    amenities: [],
    photos: [
      "https://media.vrbo.com/1.jpg",
      "https://media.vrbo.com/2.jpg",
      "https://media.vrbo.com/3.jpg",
    ],
    photosCount: 3,
    structure: {
      capacity: null,
      bedrooms: null,
      bedCount: null,
      bathrooms: null,
      propertyType: null,
      locationLabel: null,
    },
    ...overrides,
  } as ExtractedListing;
}

let failed = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${label}`);
    return;
  }

  failed += 1;
  console.error(`FAIL ${label}`);
}

const healthy = fixture();

check(
  "healthy Vrbo extraction is reliable",
  !isUnreliableVrboExtraction(healthy),
);

check(
  "missing amenities alone are not a hard failure",
  evaluateVrboExtractionReliability(healthy).reliable === true &&
    evaluateVrboExtractionReliability(healthy).reasons.includes(
      "amenities_unavailable",
    ),
);

const challenge = fixture({
  title: "Robot ou pas robot ?",
  description: "",
  photos: [],
  photosCount: 0,
});

const challengeResult =
  evaluateVrboExtractionReliability(challenge);

check(
  "Abritel robot challenge fails closed",
  isUnreliableVrboExtraction(challenge),
);

check(
  "challenge reason is explicit",
  challengeResult.challengeDetected === true &&
    challengeResult.reasons.includes("challenge_page_detected"),
);

const zeroPhotos = fixture({
  photos: [],
  photosCount: 31,
});

check(
  "declared photosCount cannot replace extracted photos",
  isUnreliableVrboExtraction(zeroPhotos),
);

const duplicatePhotos = fixture({
  photos: [
    "https://media.vrbo.com/1.jpg",
    "https://media.vrbo.com/1.jpg",
    "https://media.vrbo.com/2.jpg",
  ],
  photosCount: 31,
});

check(
  "duplicate URLs do not satisfy three-photo requirement",
  isUnreliableVrboExtraction(duplicatePhotos),
);

const shortDescription = fixture({
  description: "Too short",
});

check(
  "short description fails closed",
  isUnreliableVrboExtraction(shortDescription),
);

const missingTitle = fixture({
  title: "",
});

check(
  "missing title fails closed",
  isUnreliableVrboExtraction(missingTitle),
);

const sparseSecondaryFields = fixture({
  amenities: [],
  price: null,
  currency: null,
  hostName: null,
  structure: {
    capacity: null,
    bedrooms: null,
    bedCount: null,
    bathrooms: null,
    propertyType: null,
    locationLabel: null,
  },
});

check(
  "secondary-field sparsity alone does not reject a usable listing",
  !isUnreliableVrboExtraction(sparseSecondaryFields),
);

const booking = fixture({
  platform: "booking",
  sourcePlatform: "booking",
  title: "",
  description: "",
  photos: [],
  photosCount: 0,
});

check(
  "guard does not affect Booking",
  !isUnreliableVrboExtraction(booking),
);

if (failed > 0) {
  console.error(`VRBO_RELIABILITY_FAILURES=${failed}`);
  process.exit(1);
}

console.log("VRBO_RELIABILITY_FAILURES=0");

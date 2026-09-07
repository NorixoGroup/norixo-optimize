import type { ExtractedListing } from "../lib/extractors/types";
import {
  evaluateAirbnbExtractionReliability,
  isUnreliableAirbnbExtraction,
} from "../lib/extractors/airbnbExtractionReliability";

function listing(
  overrides: Partial<ExtractedListing>,
): ExtractedListing {
  return {
    platform: "airbnb",
    title: "Superbe app",
    description:
      "Appartement lumineux et confortable situé dans un quartier calme. ".repeat(
        4,
      ),
    photos: [
      "https://a0.muscache.com/im/pictures/1.jpg",
      "https://a0.muscache.com/im/pictures/2.jpg",
      "https://a0.muscache.com/im/pictures/3.jpg",
    ],
    amenities: ["Wifi"],
    ...overrides,
  } as ExtractedListing;
}

let failures = 0;

function check(
  label: string,
  condition: boolean,
): void {
  const status = condition ? "PASS" : "FAIL";

  console.log(`${label}=${status}`);

  if (!condition) {
    failures += 1;
  }
}

const valid = listing({
  title: "Superbe app",
  description: "x".repeat(1849),
  photos: Array.from(
    { length: 22 },
    (_, index) =>
      `https://a0.muscache.com/im/pictures/${index + 1}.jpg`,
  ),
  amenities: Array.from(
    { length: 60 },
    (_, index) => `Amenity ${index + 1}`,
  ),
});

const validResult =
  evaluateAirbnbExtractionReliability(valid);

check(
  "VALID_REAL_SHAPE_RELIABLE",
  validResult.reliable === true &&
    validResult.titleLength === 11 &&
    validResult.descriptionLength === 1849 &&
    validResult.photoCount === 22,
);

check(
  "VALID_REAL_SHAPE_NOT_UNRELIABLE",
  isUnreliableAirbnbExtraction(valid) === false,
);

const frenchErrorPage = listing({
  title: "Une erreur s'est produite",
  description: "",
  photos: [
    "https://a0.muscache.com/im/pictures/error.jpg",
  ],
  amenities: ["Erreur"],
});

const frenchErrorResult =
  evaluateAirbnbExtractionReliability(
    frenchErrorPage,
  );

check(
  "FRENCH_ERROR_PAGE_FAILS_CLOSED",
  frenchErrorResult.reliable === false &&
    frenchErrorResult.errorPageDetected === true &&
    frenchErrorResult.reasons.includes(
      "error_page_detected",
    ) &&
    frenchErrorResult.reasons.includes(
      "description_missing_or_too_short",
    ) &&
    frenchErrorResult.reasons.includes(
      "insufficient_photos",
    ),
);

const englishErrorPage = listing({
  title: "Something went wrong",
  description: "",
  photos: [],
});

const englishErrorResult =
  evaluateAirbnbExtractionReliability(
    englishErrorPage,
  );

check(
  "ENGLISH_ERROR_PAGE_FAILS_CLOSED",
  englishErrorResult.reliable === false &&
    englishErrorResult.errorPageDetected === true,
);

const challengePage = listing({
  title: "Verify you are human",
  description: "Captcha challenge",
  photos: [],
});

const challengeResult =
  evaluateAirbnbExtractionReliability(
    challengePage,
  );

check(
  "CHALLENGE_PAGE_FAILS_CLOSED",
  challengeResult.reliable === false &&
    challengeResult.challengeDetected === true &&
    challengeResult.reasons.includes(
      "challenge_page_detected",
    ),
);

const shortDescription = listing({
  description: "Trop court",
});

check(
  "SHORT_DESCRIPTION_FAILS_CLOSED",
  isUnreliableAirbnbExtraction(
    shortDescription,
  ) === true,
);

const insufficientPhotos = listing({
  photos: [
    "https://a0.muscache.com/im/pictures/1.jpg",
    "https://a0.muscache.com/im/pictures/2.jpg",
  ],
});

check(
  "INSUFFICIENT_PHOTOS_FAILS_CLOSED",
  isUnreliableAirbnbExtraction(
    insufficientPhotos,
  ) === true,
);

const noAmenities = listing({
  amenities: [],
});

const noAmenitiesResult =
  evaluateAirbnbExtractionReliability(
    noAmenities,
  );

check(
  "MISSING_AMENITIES_IS_SOFT_ONLY",
  noAmenitiesResult.reliable === true &&
    noAmenitiesResult.reasons.includes(
      "amenities_unavailable",
    ),
);

const otherPlatform = listing({
  platform: "booking",
  title: "",
  description: "",
  photos: [],
  amenities: [],
});

const otherPlatformResult =
  evaluateAirbnbExtractionReliability(
    otherPlatform,
  );

check(
  "NON_AIRBNB_PASSES_THROUGH",
  otherPlatformResult.isAirbnb === false &&
    otherPlatformResult.reliable === true &&
    isUnreliableAirbnbExtraction(
      otherPlatform,
    ) === false,
);

console.log(
  "VALID_RESULT=" +
    JSON.stringify(validResult),
);

console.log(
  "ERROR_RESULT=" +
    JSON.stringify(frenchErrorResult),
);

console.log(`FAILURES=${failures}`);

if (failures > 0) {
  process.exitCode = 1;
}

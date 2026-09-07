import {
  AGODA_EXTRACTION_UNAVAILABLE_BODY,
  evaluateAgodaExtractionReliability,
  isUnreliableAgodaExtraction,
} from "../lib/extractors/agodaExtractionReliability";
import type { ExtractedListing } from "../lib/extractors/types";

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean) {
  checks += 1;

  if (condition) {
    console.log(`PASS — ${name}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${name}`);
}

function listing(
  overrides: Partial<ExtractedListing> = {},
): ExtractedListing {
  return {
    url: "https://www.agoda.com/example/hotel/example.html",
    sourceUrl: "https://www.agoda.com/example/hotel/example.html",
    platform: "agoda",
    title: "Example Agoda listing",
    description:
      "Description Agoda suffisamment complète pour représenter une annonce réelle et permettre une analyse fiable.",
    photos: [
      "https://pix8.agoda.net/hotelImages/1/1.jpg",
      "https://pix8.agoda.net/hotelImages/1/2.jpg",
      "https://pix8.agoda.net/hotelImages/1/3.jpg",
    ],
    amenities: ["Wi-Fi", "Parking"],
    ...overrides,
  } as ExtractedListing;
}

/*
 * Proven real Agoda shape from the platform E2E matrix:
 * titleLength=36
 * descriptionLength=108
 * photos=69
 * amenities=19
 *
 * We model those exact cardinalities/lengths here so that the reliability
 * contract cannot regress back to the generic 120-character rejection.
 */
const realValidatedShape = listing({
  title: "A".repeat(36),
  description: "D".repeat(108),
  photos: Array.from(
    { length: 69 },
    (_, index) =>
      `https://pix8.agoda.net/hotelImages/validated/${index + 1}.jpg`,
  ),
  amenities: Array.from(
    { length: 19 },
    (_, index) => `Amenity ${index + 1}`,
  ),
});

const validResult =
  evaluateAgodaExtractionReliability(realValidatedShape);

check(
  "REAL_VALIDATED_AGODA_SHAPE_IS_RELIABLE",
  validResult.reliable === true,
);

check(
  "REAL_VALIDATED_AGODA_DESCRIPTION_108_ACCEPTED",
  validResult.descriptionLength === 108 &&
    !validResult.reasons.includes(
      "description_missing_or_too_short",
    ),
);

check(
  "REAL_VALIDATED_AGODA_PHOTO_COUNT_69",
  validResult.photoCount === 69,
);

check(
  "REAL_VALIDATED_AGODA_AMENITY_COUNT_19",
  validResult.amenityCount === 19,
);

check(
  "REAL_VALIDATED_AGODA_NOT_UNRELIABLE",
  isUnreliableAgodaExtraction(realValidatedShape) === false,
);

const description79 = listing({
  description: "D".repeat(79),
});

const description79Result =
  evaluateAgodaExtractionReliability(description79);

check(
  "DESCRIPTION_79_FAILS_CLOSED",
  description79Result.reliable === false &&
    description79Result.reasons.includes(
      "description_missing_or_too_short",
    ),
);

const description80 = listing({
  description: "D".repeat(80),
});

check(
  "DESCRIPTION_80_IS_ACCEPTED",
  evaluateAgodaExtractionReliability(description80).reliable === true,
);

const zeroPhotos = listing({
  photos: [],
});

check(
  "ZERO_PHOTOS_FAILS_CLOSED",
  isUnreliableAgodaExtraction(zeroPhotos) === true,
);

check(
  "ZERO_PHOTOS_REASON_EXPLICIT",
  evaluateAgodaExtractionReliability(
    zeroPhotos,
  ).reasons.includes("insufficient_photos"),
);

const twoPhotos = listing({
  photos: [
    "https://pix8.agoda.net/hotelImages/1/1.jpg",
    "https://pix8.agoda.net/hotelImages/1/2.jpg",
  ],
});

check(
  "TWO_PHOTOS_FAIL_CLOSED",
  isUnreliableAgodaExtraction(twoPhotos) === true,
);

const duplicatePhotos = listing({
  photos: [
    "https://pix8.agoda.net/hotelImages/1/1.jpg",
    "https://pix8.agoda.net/hotelImages/1/1.jpg",
    "https://pix8.agoda.net/hotelImages/1/2.jpg",
  ],
});

check(
  "DUPLICATE_PHOTOS_DO_NOT_FAKE_THRESHOLD",
  evaluateAgodaExtractionReliability(
    duplicatePhotos,
  ).photoCount === 2 &&
    isUnreliableAgodaExtraction(duplicatePhotos) === true,
);

const shortTitle = listing({
  title: "Bad",
});

check(
  "SHORT_TITLE_FAILS_CLOSED",
  isUnreliableAgodaExtraction(shortTitle) === true,
);

const noAmenities = listing({
  amenities: [],
});

const noAmenitiesResult =
  evaluateAgodaExtractionReliability(noAmenities);

check(
  "MISSING_AMENITIES_IS_SOFT_ONLY",
  noAmenitiesResult.reliable === true &&
    noAmenitiesResult.reasons.includes(
      "amenities_unavailable",
    ),
);

const nonAgoda = listing({
  platform: "booking",
  title: "",
  description: "",
  photos: [],
  amenities: [],
});

check(
  "NON_AGODA_IS_PASS_THROUGH",
  evaluateAgodaExtractionReliability(nonAgoda).reliable === true &&
    isUnreliableAgodaExtraction(nonAgoda) === false,
);

check(
  "UNAVAILABLE_BODY_CODE_LOCKED",
  AGODA_EXTRACTION_UNAVAILABLE_BODY.code ===
    "agoda_extraction_unavailable",
);

console.log(`CHECKS=${checks}`);
console.log(`FAILURES=${failures}`);

if (failures > 0) {
  process.exitCode = 1;
}

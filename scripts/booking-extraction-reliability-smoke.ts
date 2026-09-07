import {
  BOOKING_EXTRACTION_UNAVAILABLE_BODY,
  isUnreliableBookingExtraction,
} from "../lib/extractors/bookingExtractionReliability";

let checks = 0;
let failures = 0;

function check(name: string, condition: boolean) {
  checks += 1;

  if (condition) {
    console.log(`PASS — ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL — ${name}`);
  }
}

const realPhotos = [
  "https://cf.bstatic.com/xdata/images/hotel/a.jpg",
  "https://cf.bstatic.com/xdata/images/hotel/b.jpg",
  "https://cf.bstatic.com/xdata/images/hotel/c.jpg",
];

const healthy = {
  platform: "booking",
  title: "ibis Paris Tour Eiffel",
  description: "A".repeat(300),
  photos: realPhotos,
  photosCount: 80,
  amenities: ["Wi-Fi", "Air conditioning"],
  price: 187,
  extractionMeta: {
    warnings: [],
  },
} as any;

check(
  "HEALTHY_BOOKING_IS_RELIABLE",
  !isUnreliableBookingExtraction(healthy),
);

check(
  "HEALTHY_BOOKING_WITH_CHALLENGE_AND_REAL_EVIDENCE_IS_RELIABLE",
  !isUnreliableBookingExtraction({
    ...healthy,
    extractionMeta: {
      warnings: ["booking_challenge_detected"],
    },
  }),
);

check(
  "DECLARED_COUNT_CANNOT_REPLACE_REAL_PHOTOS",
  isUnreliableBookingExtraction({
    ...healthy,
    photos: [],
    photosCount: 80,
  }),
);

check(
  "DUPLICATE_PHOTOS_DO_NOT_SATISFY_THRESHOLD",
  isUnreliableBookingExtraction({
    ...healthy,
    photos: [
      realPhotos[0],
      realPhotos[0],
      realPhotos[0],
    ],
  }),
);

check(
  "TWO_REAL_PHOTOS_FAIL_CLOSED",
  isUnreliableBookingExtraction({
    ...healthy,
    photos: realPhotos.slice(0, 2),
  }),
);

check(
  "NO_WARNING_ZERO_PHOTOS_FAILS_CLOSED",
  isUnreliableBookingExtraction({
    ...healthy,
    photos: [],
    photosCount: 0,
    extractionMeta: { warnings: [] },
  }),
);

check(
  "NO_WARNING_EMPTY_CONTENT_FAILS_CLOSED",
  isUnreliableBookingExtraction({
    platform: "booking",
    title: "",
    description: "",
    photos: [],
    amenities: [],
    extractionMeta: { warnings: [] },
  } as any),
);

check(
  "SHORT_TITLE_FAILS_CLOSED",
  isUnreliableBookingExtraction({
    ...healthy,
    title: "abc",
  }),
);

check(
  "UNTITLED_FALLBACK_FAILS_CLOSED",
  isUnreliableBookingExtraction({
    ...healthy,
    title: "Untitled Booking listing",
  }),
);

check(
  "DESCRIPTION_79_FAILS_CLOSED",
  isUnreliableBookingExtraction({
    ...healthy,
    description: "A".repeat(79),
  }),
);

check(
  "DESCRIPTION_80_IS_ACCEPTED",
  !isUnreliableBookingExtraction({
    ...healthy,
    description: "A".repeat(80),
  }),
);

check(
  "MISSING_AMENITIES_ALONE_IS_SOFT",
  !isUnreliableBookingExtraction({
    ...healthy,
    amenities: [],
  }),
);

check(
  "CHALLENGE_WITHOUT_PRICE_BUT_WITH_AMENITIES_IS_ACCEPTED",
  !isUnreliableBookingExtraction({
    ...healthy,
    price: null,
    extractionMeta: {
      warnings: ["booking_challenge_detected"],
    },
  }),
);

check(
  "CHALLENGE_WITHOUT_PRICE_OR_AMENITIES_FAILS_CLOSED",
  isUnreliableBookingExtraction({
    ...healthy,
    price: null,
    amenities: [],
    extractionMeta: {
      warnings: ["booking_challenge_detected"],
    },
  }),
);

check(
  "NON_BOOKING_PASSES_THROUGH",
  !isUnreliableBookingExtraction({
    ...healthy,
    platform: "airbnb",
    title: "",
    description: "",
    photos: [],
  }),
);

check(
  "UNAVAILABLE_BODY_CODE_LOCKED",
  BOOKING_EXTRACTION_UNAVAILABLE_BODY.error ===
    "booking_extraction_unavailable",
);

console.log(`CHECKS=${checks}`);
console.log(`FAILURES=${failures}`);

if (failures !== 0) {
  process.exitCode = 1;
}

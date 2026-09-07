import assert from "node:assert/strict";

import {
  computeCoverQuality,
  computeGalleryOrder,
  computeRoomCoverage,
  computeVisualDiversity,
  computeVisualQuality,
  isTrustedListingImageUrl,
  normalizePhotoObservations,
  selectListingPhotos,
  type ListingPhotoObservation,
} from "../lib/audits/analyzeListingPhotos";

function photo(
  overrides: Partial<ListingPhotoObservation> & Pick<ListingPhotoObservation, "index">,
): ListingPhotoObservation {
  return {
    index: overrides.index,
    category: overrides.category ?? "other",
    technicalQuality: overrides.technicalQuality ?? 8,
    lighting: overrides.lighting ?? 8,
    composition: overrides.composition ?? 8,
    presentation: overrides.presentation ?? 8,
    bookingAppeal: overrides.bookingAppeal ?? 8,
    isLikelyDuplicate: overrides.isLikelyDuplicate ?? false,
    duplicateOfIndex: overrides.duplicateOfIndex ?? null,
    strengths: overrides.strengths ?? [],
    issues: overrides.issues ?? [],
  };
}

function assertFiniteOrNull(value: number | null, name: string) {
  assert(
    value === null || Number.isFinite(value),
    `${name} must be finite or null`,
  );
}

function testVisualQualityMath() {
  const photos = [
    photo({
      index: 0,
      technicalQuality: 10,
      lighting: 8,
      composition: 6,
      presentation: 4,
    }),
  ];

  const expected =
    10 * 0.3 +
    8 * 0.25 +
    6 * 0.25 +
    4 * 0.2;

  assert.equal(computeVisualQuality(photos), Number(expected.toFixed(1)));
}

function testCoverQualityMath() {
  const photos = [
    photo({
      index: 0,
      technicalQuality: 10,
      lighting: 8,
      composition: 6,
      presentation: 4,
      bookingAppeal: 2,
    }),
  ];

  const expected =
    10 * 0.2 +
    8 * 0.2 +
    6 * 0.25 +
    4 * 0.15 +
    2 * 0.2;

  assert.equal(computeCoverQuality(photos), Number(expected.toFixed(1)));
}

function testVisualQualityExcludesDuplicates() {
  const photos = [
    photo({
      index: 0,
      technicalQuality: 10,
      lighting: 10,
      composition: 10,
      presentation: 10,
    }),
    photo({
      index: 1,
      technicalQuality: 0,
      lighting: 0,
      composition: 0,
      presentation: 0,
      isLikelyDuplicate: true,
      duplicateOfIndex: 0,
    }),
  ];

  assert.equal(computeVisualQuality(photos), 10);
}

function testVisualDiversityDuplicatePenalty() {
  const strong = [
    photo({ index: 0, category: "living_room" }),
    photo({ index: 1, category: "bedroom" }),
    photo({ index: 2, category: "bathroom" }),
    photo({ index: 3, category: "kitchen" }),
  ];

  const duplicated = [
    ...strong,
    photo({
      index: 4,
      category: "living_room",
      isLikelyDuplicate: true,
      duplicateOfIndex: 0,
    }),
    photo({
      index: 5,
      category: "living_room",
      isLikelyDuplicate: true,
      duplicateOfIndex: 0,
    }),
  ];

  assert(
    (computeVisualDiversity(duplicated) ?? 0) <
      (computeVisualDiversity(strong) ?? 0),
  );
}

function testVisualDiversityCategoryPenalty() {
  const oneCategory = [
    photo({ index: 0, category: "bedroom" }),
    photo({ index: 1, category: "bedroom" }),
    photo({ index: 2, category: "bedroom" }),
  ];

  const multipleCategories = [
    photo({ index: 0, category: "living_room" }),
    photo({ index: 1, category: "bedroom" }),
    photo({ index: 2, category: "bathroom" }),
  ];

  assert(
    (computeVisualDiversity(oneCategory) ?? 0) <
      (computeVisualDiversity(multipleCategories) ?? 0),
  );
}

function testRoomCoverage() {
  const coreOnly = [
    photo({ index: 0, category: "living_room" }),
    photo({ index: 1, category: "bedroom" }),
    photo({ index: 2, category: "bathroom" }),
    photo({ index: 3, category: "kitchen" }),
  ];

  assert.equal(computeRoomCoverage(coreOnly), 8);

  const withSecondary = [
    ...coreOnly,
    photo({ index: 4, category: "exterior" }),
    photo({ index: 5, category: "view" }),
    photo({ index: 6, category: "workspace" }),
    photo({ index: 7, category: "amenity" }),
  ];

  assert.equal(computeRoomCoverage(withSecondary), 10);

  const secondaryOnly = [
    photo({ index: 0, category: "pool" }),
    photo({ index: 1, category: "view" }),
    photo({ index: 2, category: "workspace" }),
    photo({ index: 3, category: "amenity" }),
  ];

  assert(
    (computeRoomCoverage(secondaryOnly) ?? 10) <= 2,
    "secondary categories must not compensate for missing core rooms",
  );
}

function testGalleryOrderUnavailableWithoutCover() {
  const observations: ListingPhotoObservation[] = [
    {
      index: 1,
      category: "living_room",
      technicalQuality: 9,
      lighting: 9,
      composition: 9,
      presentation: 9,
      bookingAppeal: 9,
      isLikelyDuplicate: false,
      duplicateOfIndex: null,
      strengths: [],
      issues: [],
    },
    {
      index: 2,
      category: "bedroom",
      technicalQuality: 8,
      lighting: 8,
      composition: 8,
      presentation: 8,
      bookingAppeal: 8,
      isLikelyDuplicate: false,
      duplicateOfIndex: null,
      strengths: [],
      issues: [],
    },
    {
      index: 3,
      category: "bathroom",
      technicalQuality: 8,
      lighting: 8,
      composition: 8,
      presentation: 8,
      bookingAppeal: 8,
      isLikelyDuplicate: false,
      duplicateOfIndex: null,
      strengths: [],
      issues: [],
    },
  ];

  assert.equal(
    computeGalleryOrder(observations),
    null,
    "gallery order must be unavailable when original cover index 0 is not observable",
  );
}

function testGalleryOrderStrongVsWeak() {
  const strong = [
    photo({
      index: 0,
      category: "living_room",
      technicalQuality: 9,
      lighting: 9,
      composition: 9,
      presentation: 9,
      bookingAppeal: 9,
    }),
    photo({ index: 1, category: "bedroom", bookingAppeal: 9 }),
    photo({ index: 2, category: "bathroom", bookingAppeal: 8 }),
    photo({ index: 3, category: "kitchen", bookingAppeal: 8 }),
    photo({ index: 4, category: "view", bookingAppeal: 9 }),
  ];

  const weak = [
    photo({
      index: 0,
      category: "other",
      technicalQuality: 3,
      lighting: 3,
      composition: 3,
      presentation: 3,
      bookingAppeal: 3,
    }),
    photo({
      index: 1,
      category: "other",
      bookingAppeal: 3,
      isLikelyDuplicate: true,
      duplicateOfIndex: 0,
    }),
    photo({
      index: 2,
      category: "other",
      bookingAppeal: 3,
      isLikelyDuplicate: true,
      duplicateOfIndex: 0,
    }),
    photo({ index: 3, category: "other", bookingAppeal: 3 }),
    photo({ index: 4, category: "other", bookingAppeal: 3 }),
  ];

  assert(
    (computeGalleryOrder(strong) ?? 0) >
      (computeGalleryOrder(weak) ?? 10),
  );
}

function testClamping() {
  const normalized = normalizePhotoObservations(
    [
      {
        index: 0,
        category: "bedroom",
        technicalQuality: 999,
        lighting: -50,
        composition: Infinity,
        presentation: NaN,
        bookingAppeal: 11,
        isLikelyDuplicate: false,
        duplicateOfIndex: null,
        strengths: [],
        issues: [],
      },
    ],
    [0],
  );

  assert.equal(normalized.length, 1);

  const p = normalized[0];

  assert.equal(p.technicalQuality, 10);
  assert.equal(p.lighting, 0);
  assert.equal(p.composition, 0);
  assert.equal(p.presentation, 0);
  assert.equal(p.bookingAppeal, 10);
}

function testMalformedObservationFiltering() {
  const normalized = normalizePhotoObservations(
    [
      null,
      "bad",
      {},
      { index: 999, category: "bedroom" },
      {
        index: 0,
        category: "bedroom",
        technicalQuality: 8,
        lighting: 8,
        composition: 8,
        presentation: 8,
        bookingAppeal: 8,
        isLikelyDuplicate: false,
        duplicateOfIndex: null,
      },
      {
        index: 0,
        category: "bathroom",
        technicalQuality: 2,
      },
    ],
    [0, 1],
  );

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].index, 0);
  assert.equal(normalized[0].category, "bedroom");
}

function testInvalidDuplicateReferenceRemoved() {
  const normalized = normalizePhotoObservations(
    [
      {
        index: 0,
        category: "bedroom",
        technicalQuality: 8,
        lighting: 8,
        composition: 8,
        presentation: 8,
        bookingAppeal: 8,
        isLikelyDuplicate: true,
        duplicateOfIndex: 999,
      },
    ],
    [0],
  );

  assert.equal(normalized[0].duplicateOfIndex, null);
  assert.equal(normalized[0].isLikelyDuplicate, false);
}

function testFalseDuplicateFlagClearsValidReference() {
  const normalized = normalizePhotoObservations(
    [
      {
        index: 0,
        category: "living_room",
        technicalQuality: 8,
        lighting: 8,
        composition: 8,
        presentation: 8,
        bookingAppeal: 8,
        isLikelyDuplicate: false,
        duplicateOfIndex: null,
      },
      {
        index: 1,
        category: "living_room",
        technicalQuality: 8,
        lighting: 8,
        composition: 8,
        presentation: 8,
        bookingAppeal: 8,
        isLikelyDuplicate: false,
        duplicateOfIndex: 0,
      },
    ],
    [0, 1],
  );

  assert.equal(normalized.length, 2);
  assert.equal(normalized[1].isLikelyDuplicate, false);
  assert.equal(normalized[1].duplicateOfIndex, null);
}

function testTrueDuplicateFlagKeepsValidReference() {
  const normalized = normalizePhotoObservations(
    [
      {
        index: 0,
        category: "living_room",
        technicalQuality: 8,
        lighting: 8,
        composition: 8,
        presentation: 8,
        bookingAppeal: 8,
        isLikelyDuplicate: false,
        duplicateOfIndex: null,
      },
      {
        index: 1,
        category: "living_room",
        technicalQuality: 8,
        lighting: 8,
        composition: 8,
        presentation: 8,
        bookingAppeal: 8,
        isLikelyDuplicate: true,
        duplicateOfIndex: 0,
      },
    ],
    [0, 1],
  );

  assert.equal(normalized.length, 2);
  assert.equal(normalized[1].isLikelyDuplicate, true);
  assert.equal(normalized[1].duplicateOfIndex, 0);
}

function testAgodaBstaticExactHostSecurity() {
  const platform = "agoda";

  assert.equal(
    isTrustedListingImageUrl(
      "https://q-xx.bstatic.com/xdata/images/hotel/max1024x768/123.jpg",
      platform,
    ),
    true,
  );

  assert.equal(
    isTrustedListingImageUrl(
      "https://pix8.agoda.net/hotelImages/123.jpg",
      platform,
    ),
    true,
  );

  // Exact hostname only: no arbitrary bstatic subdomains.
  assert.equal(
    isTrustedListingImageUrl(
      "https://evil.bstatic.com/image.jpg",
      platform,
    ),
    false,
  );

  assert.equal(
    isTrustedListingImageUrl(
      "https://cf.bstatic.com/image.jpg",
      platform,
    ),
    false,
  );

  // Hostname suffix confusion must never pass.
  assert.equal(
    isTrustedListingImageUrl(
      "https://q-xx.bstatic.com.evil.example/image.jpg",
      platform,
    ),
    false,
  );

  assert.equal(
    isTrustedListingImageUrl(
      "https://evil-q-xx.bstatic.com/image.jpg",
      platform,
    ),
    false,
  );

  // HTTPS is mandatory.
  assert.equal(
    isTrustedListingImageUrl(
      "http://q-xx.bstatic.com/image.jpg",
      platform,
    ),
    false,
  );

  // Credentials are forbidden.
  assert.equal(
    isTrustedListingImageUrl(
      "https://user:pass@q-xx.bstatic.com/image.jpg",
      platform,
    ),
    false,
  );

  // Arbitrary ports are forbidden.
  assert.equal(
    isTrustedListingImageUrl(
      "https://q-xx.bstatic.com:444/image.jpg",
      platform,
    ),
    false,
  );

  // Explicit standard HTTPS port remains equivalent to HTTPS.
  assert.equal(
    isTrustedListingImageUrl(
      "https://q-xx.bstatic.com:443/image.jpg",
      platform,
    ),
    true,
  );

  // Platform scoping matters: Agoda's host must not silently
  // become trusted for another listing platform.
  assert.equal(
    isTrustedListingImageUrl(
      "https://q-xx.bstatic.com/image.jpg",
      "airbnb",
    ),
    false,
  );
}

function testFirstTwelveUniquePhotosOnly() {
  const photos = Array.from(
    { length: 20 },
    (_, index) => `https://example.com/photo-${index}.jpg`,
  );

  const result = selectListingPhotos(photos);

  assert.equal(result.totalPhotoCount, 20);
  assert.equal(result.selected.length, 12);
  assert.equal(result.selected[0].index, 0);
  assert.equal(result.selected[11].index, 11);
}

function testUrlDedupPreservesOriginalIndex() {
  const result = selectListingPhotos([
    "https://example.com/a.jpg",
    "https://example.com/a.jpg",
    "invalid",
    "https://example.com/b.jpg",
  ]);

  assert.equal(result.totalPhotoCount, 2);
  assert.deepEqual(
    result.selected.map((item) => item.index),
    [0, 3],
  );
}

function testInvalidUrlsRemoved() {
  const result = selectListingPhotos([
    "",
    "ftp://example.com/a.jpg",
    "javascript:alert(1)",
    "https://example.com/a.jpg",
    "http://example.com/b.jpg",
  ]);

  assert.equal(result.totalPhotoCount, 2);
  assert.equal(result.selected.length, 2);
}

function testNoNaNInfinityEscape() {
  const photos = [
    photo({
      index: 0,
      technicalQuality: Number.NaN,
      lighting: Number.POSITIVE_INFINITY,
      composition: Number.NEGATIVE_INFINITY,
      presentation: 8,
      bookingAppeal: 8,
    }),
  ];

  const values = [
    computeVisualQuality(photos),
    computeCoverQuality(photos),
    computeVisualDiversity(photos),
    computeRoomCoverage(photos),
    computeGalleryOrder(photos),
  ];

  for (const [index, value] of values.entries()) {
    assertFiniteOrNull(value, `score[${index}]`);
  }
}

function testEmptyInputs() {
  assert.equal(computeVisualQuality([]), null);
  assert.equal(computeCoverQuality([]), null);
  assert.equal(computeVisualDiversity([]), null);
  assert.equal(computeRoomCoverage([]), null);
  assert.equal(computeGalleryOrder([]), null);

  const selected = selectListingPhotos([]);
  assert.equal(selected.totalPhotoCount, 0);
  assert.deepEqual(selected.selected, []);
}

const tests: Array<[string, () => void]> = [
  ["visualQuality math", testVisualQualityMath],
  ["coverQuality math", testCoverQualityMath],
  ["duplicates excluded from visualQuality", testVisualQualityExcludesDuplicates],
  ["visual diversity duplicate penalty", testVisualDiversityDuplicatePenalty],
  ["visual diversity category penalty", testVisualDiversityCategoryPenalty],
  ["room coverage", testRoomCoverage],
  ["gallery order strong vs weak", testGalleryOrderStrongVsWeak],
  [
    "gallery order unavailable without cover",
    testGalleryOrderUnavailableWithoutCover,
  ],
  ["clamping", testClamping],
  ["malformed observation filtering", testMalformedObservationFiltering],
  ["invalid duplicate reference removed", testInvalidDuplicateReferenceRemoved],
  [
    "false duplicate flag clears valid reference",
    testFalseDuplicateFlagClearsValidReference,
  ],
  [
    "true duplicate flag keeps valid reference",
    testTrueDuplicateFlagKeepsValidReference,
  ],
  [
    "Agoda bstatic exact-host security",
    testAgodaBstaticExactHostSecurity,
  ],
  ["first 12 unique photos", testFirstTwelveUniquePhotosOnly],
  ["URL dedup preserves original index", testUrlDedupPreservesOriginalIndex],
  ["invalid URLs removed", testInvalidUrlsRemoved],
  ["no NaN/Infinity escape", testNoNaNInfinityEscape],
  ["empty inputs", testEmptyInputs],
];

let passed = 0;

for (const [name, fn] of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS — ${name}`);
  } catch (error) {
    console.error(`FAIL — ${name}`);
    throw error;
  }
}

console.log(`VISION SMOKE PASS (${passed}/${tests.length})`);

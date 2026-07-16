import assert from "node:assert/strict";

const {
  classifyGeographyCandidate,
} = require("../lib/marketMemory/geographyCandidateClassifier") as typeof import("../lib/marketMemory/geographyCandidateClassifier");
const {
  normalizeListing,
} = require("../lib/audits/normalizeListing") as typeof import("../lib/audits/normalizeListing");
const {
  sanitizeMarketMemorySnapshotGeography,
  resolveMarketMemoryComparableGeography,
} = require("../lib/marketMemory/saveMarketSnapshot") as typeof import("../lib/marketMemory/saveMarketSnapshot");

function readLocationCity(
  value: ReturnType<typeof normalizeListing>,
): string | null {
  const location = value.location;
  if (!location || typeof location !== "object") {
    return null;
  }

  const city = (location as { city?: unknown }).city;
  return typeof city === "string" ? city : null;
}

function main() {
  assert.equal(
    classifyGeographyCandidate({
      rawCity: "Paris",
      rawCountry: "France",
    }).status,
    "canonical",
  );

  const barcelone = classifyGeographyCandidate({
    rawCity: "barcelone",
    rawCountry: null,
  });
  assert.equal(barcelone.status, "recoverable");
  assert.equal(barcelone.city, "barcelona");
  assert.equal(barcelone.country, "spain");

  const fes = classifyGeographyCandidate({
    rawCity: "fès",
    rawCountry: null,
  });
  assert.equal(fes.status, "recoverable");
  assert.equal(fes.city, "fes");
  assert.equal(fes.country, "morocco");

  const marrakesh = classifyGeographyCandidate({
    rawCity: "marrakesh",
    rawCountry: null,
  });
  assert.equal(marrakesh.status, "recoverable");
  assert.equal(marrakesh.city, "marrakech");
  assert.equal(marrakesh.country, "morocco");

  for (const value of [
    "https",
    "studio",
    "appartement",
    "piscine",
    "parking",
    "standing",
    "confortable",
    "unknown",
    "untitled",
    "piscine et parking a gueliz",
  ]) {
    assert.equal(
      classifyGeographyCandidate({
        rawCity: value,
        rawCountry: "Morocco",
      }).status,
      "invalid",
      `Expected ${value} to be invalid.`,
    );
  }

  for (const value of ["bahja", "olhao", "anare", "ann arbor"]) {
    assert.equal(
      classifyGeographyCandidate({
        rawCity: value,
        rawCountry: null,
      }).status,
      "ambiguous",
      `Expected ${value} to stay ambiguous.`,
    );
  }

  for (const value of [
    "gueliz",
    "palmeraie",
    "shinjuku",
    "caversham",
    "levallois-perret",
    "l'hospitalet de llobregat",
  ]) {
    assert.equal(
      classifyGeographyCandidate({
        rawCity: value,
        rawCountry: null,
      }).status,
      "district",
      `Expected ${value} to be treated as district.`,
    );
  }

  const invalidLocationLabel = normalizeListing({
    platform: "booking",
    title: "Example listing",
    description: "",
    url: "https://www.booking.com/hotel/ma/example.html",
    locationLabel: "studio, morocco",
    location: null,
    structure: {
      locationLabel: "studio, morocco",
    },
  });
  assert.equal(readLocationCity(invalidLocationLabel), null);

  const invalidUrlLabel = normalizeListing({
    platform: "booking",
    title: "Example listing",
    description: "",
    url: "https://www.booking.com/hotel/ma/example.html",
    locationLabel: "https, morocco",
    location: null,
    structure: {
      locationLabel: "https, morocco",
    },
  });
  assert.equal(readLocationCity(invalidUrlLabel), null);

  const preservedLocation = normalizeListing({
    platform: "booking",
    title: "Example listing",
    description: "",
    url: "https://www.booking.com/hotel/fr/example.html",
    location: {
      city: "Paris",
      country: "France",
    },
    locationLabel: "studio, france",
  });
  assert.equal(readLocationCity(preservedLocation), "Paris");

  const invalidSnapshot = sanitizeMarketMemorySnapshotGeography({
    rawCity: "studio",
    rawCountry: "Morocco",
  });
  assert.equal(invalidSnapshot.city, null);
  assert.equal(invalidSnapshot.canUseAsComparableFallback, false);

  const canonicalSnapshot = sanitizeMarketMemorySnapshotGeography({
    rawCity: "Paris",
    rawCountry: "France",
  });
  assert.equal(canonicalSnapshot.city, "paris");
  assert.equal(canonicalSnapshot.country, "france");
  assert.equal(canonicalSnapshot.canUseAsComparableFallback, true);

  const comparableWithoutValidFallback = resolveMarketMemoryComparableGeography({
    rawComparableCity: null,
    rawComparableCountry: null,
    snapshotCity: "studio",
    snapshotCountry: "morocco",
  });
  assert.equal(comparableWithoutValidFallback.city, null);
  assert.equal(comparableWithoutValidFallback.usedSnapshotFallback, false);

  const comparableWithValidFallback = resolveMarketMemoryComparableGeography({
    rawComparableCity: null,
    rawComparableCountry: null,
    snapshotCity: "Paris",
    snapshotCountry: "France",
  });
  assert.equal(comparableWithValidFallback.city, "paris");
  assert.equal(comparableWithValidFallback.country, "france");
  assert.equal(comparableWithValidFallback.usedSnapshotFallback, true);

  const comparableOwnCityPreserved = resolveMarketMemoryComparableGeography({
    rawComparableCity: "Rabat",
    rawComparableCountry: "Morocco",
    snapshotCity: "studio",
    snapshotCountry: "morocco",
  });
  assert.equal(comparableOwnCityPreserved.city, "rabat");
  assert.equal(comparableOwnCityPreserved.country, "morocco");
  assert.equal(comparableOwnCityPreserved.usedSnapshotFallback, false);

  console.info("PASS — Geography candidate classifier smoke");
}

main();

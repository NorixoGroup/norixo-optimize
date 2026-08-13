import { cities } from "@/data/cities";
import { countries } from "@/data/countries";
import {
  cityGeoEntityRef,
  countryGeoEntityRef,
  createGeoEntityRef,
  geoEntityRefKey,
} from "./geo-types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function runGeoEntityRefSmokeTest(): void {
  const citiesSnapshot = JSON.stringify(cities);
  const countriesSnapshot = JSON.stringify(countries);
  const paris = cities.find((city) => city.slug === "paris");
  const france = countries.find((country) => country.slug === "france");

  assert(paris, "Paris must exist in the canonical city dataset.");
  assert(france, "France must exist in the canonical country dataset.");

  const parisRef = cityGeoEntityRef(paris);
  const repeatedParisRef = cityGeoEntityRef(paris);
  const franceRef = countryGeoEntityRef(france);
  const syntheticCityParisRef = createGeoEntityRef("city", "paris");
  const syntheticCountryParisRef = createGeoEntityRef("country", "paris");
  const supportedKinds: readonly string[] = ["city", "country"];

  assert(parisRef.kind === "city", "Paris GeoEntityRef kind must be city.");
  assert(parisRef.slug === "paris", "Paris GeoEntityRef slug must be canonical.");
  assert(franceRef.kind === "country", "France GeoEntityRef kind must be country.");
  assert(franceRef.slug === "france", "France GeoEntityRef slug must be canonical.");
  assert(JSON.stringify(parisRef) === JSON.stringify(repeatedParisRef), "GeoEntityRef builders must be deterministic.");
  assert(
    geoEntityRefKey(syntheticCityParisRef) !== geoEntityRefKey(syntheticCountryParisRef),
    "GeoEntityRef identity must distinguish city and country refs with the same slug."
  );
  assert(supportedKinds.includes("city"), "GeoEntityKind must support city.");
  assert(supportedKinds.includes("country"), "GeoEntityKind must support country.");
  assert(!supportedKinds.includes("audience"), "GeoEntityKind must not include audience.");
  assert(!supportedKinds.includes("market"), "GeoEntityKind must not include market.");
  assert(
    JSON.stringify(cities) === citiesSnapshot,
    "GeoEntityRef helpers must not mutate the city dataset."
  );
  assert(
    JSON.stringify(countries) === countriesSnapshot,
    "GeoEntityRef helpers must not mutate the country dataset."
  );

  console.log("Geo entity ref smoke passed.", {
    paris: parisRef,
    france: franceRef,
  });
}

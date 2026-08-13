import type { City } from "@/data/cities";
import type { Country } from "@/data/countries";

export type GeoEntityKind = "city" | "country";

export interface GeoEntityRef {
  readonly kind: GeoEntityKind;
  readonly slug: string;
}

export function createGeoEntityRef(kind: GeoEntityKind, slug: string): GeoEntityRef {
  return { kind, slug };
}

export function cityGeoEntityRef(city: Pick<City, "slug">): GeoEntityRef {
  return createGeoEntityRef("city", city.slug);
}

export function countryGeoEntityRef(country: Pick<Country, "slug">): GeoEntityRef {
  return createGeoEntityRef("country", country.slug);
}

export function geoEntityRefKey(ref: GeoEntityRef): `${GeoEntityKind}:${string}` {
  return `${ref.kind}:${ref.slug}`;
}

/** Valeurs POST /api/audits et `SearchCompetitorsInput.propertyTypeOverride` (hors chaîne vide). */
export type PropertyTypeOverrideSlug =
  | "studio"
  | "apartment"
  | "villa"
  | "riad"
  | "room"
  | "hotel";

const ALLOWED = new Set<PropertyTypeOverrideSlug>([
  "studio",
  "apartment",
  "villa",
  "riad",
  "room",
  "hotel",
]);

export const PROPERTY_TYPE_OPTIONS: ReadonlyArray<{
  value: "" | PropertyTypeOverrideSlug;
  label: string;
}> = [
  { value: "", label: "Choisir le type de bien" },
  { value: "studio", label: "Studio" },
  { value: "apartment", label: "Appartement" },
  { value: "villa", label: "Villa / Maison" },
  { value: "riad", label: "Riad / Dar" },
  { value: "room", label: "Chambre" },
  { value: "hotel", label: "Hôtel" },
];

export function parsePropertyTypeOverride(raw: unknown): PropertyTypeOverrideSlug | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toLowerCase();
  if (!t) return undefined;
  return ALLOWED.has(t as PropertyTypeOverrideSlug) ? (t as PropertyTypeOverrideSlug) : undefined;
}

/** Valeurs `propertyType` cohérentes avec `getNormalizedComparableType` (tokens primaires). */
export function mapPropertyTypeOverrideToListingPropertyType(
  slug: PropertyTypeOverrideSlug
): string {
  switch (slug) {
    case "studio":
      return "studio";
    case "apartment":
      return "appartement";
    case "villa":
      return "villa";
    case "riad":
      return "riad";
    case "room":
      return "chambre";
    case "hotel":
      return "hotel";
  }
}

/** Profil _like pour les logs DEBUG (spec produit — peut différer du typage affiné listing). */
export function normalizeOverrideTypeForMarketDebug(slug: string): string | null {
  switch (slug.trim().toLowerCase()) {
    case "studio":
    case "apartment":
      return "apartment_like";
    case "villa":
      return "villa_like";
    case "riad":
      return "riad_like";
    case "room":
      return "room_like";
    case "hotel":
      return "hotel_like";
    default:
      return null;
  }
}


import type { EditorialNode, EditorialNodeId, EditorialNodeKind } from "./types";

export const schemaVersion = "1" as const;
export const taxonomyVersion = "1" as const;
export const source = "manual-canonical-registry" as const;

function node<K extends EditorialNodeKind>(
  kind: K,
  slug: string,
  label: string
): EditorialNode {
  return {
    id: `${kind}:${slug}` as Extract<EditorialNodeId, `${K}:${string}`>,
    kind,
    label,
    status: "active",
  };
}

export const editorialTaxonomy = {
  platforms: [
    node("platform", "airbnb", "Airbnb"),
    node("platform", "booking", "Booking"),
    node("platform", "vrbo", "Vrbo"),
    node("platform", "expedia", "Expedia"),
  ],
  topics: [
    node("topic", "listing-optimization", "Listing Optimization"),
    node("topic", "seo-ranking", "SEO / Ranking"),
    node("topic", "pricing", "Pricing"),
    node("topic", "revenue", "Revenue"),
    node("topic", "occupancy", "Occupancy"),
    node("topic", "adr", "ADR"),
    node("topic", "revpar", "RevPAR"),
    node("topic", "photos", "Photos"),
    node("topic", "titles", "Titles"),
    node("topic", "descriptions", "Descriptions"),
    node("topic", "amenities", "Amenities"),
    node("topic", "reviews", "Reviews"),
    node("topic", "conversion", "Conversion"),
    node("topic", "trust", "Trust"),
    node("topic", "operations", "Operations"),
    node("topic", "distribution", "Distribution"),
  ],
  audiences: [
    node("audience", "host", "Host"),
    node("audience", "professional-host", "Professional Host"),
    node("audience", "property-manager", "Property Manager"),
    node("audience", "concierge", "Concierge"),
    node("audience", "pms-user", "PMS User"),
    node("audience", "channel-manager-user", "Channel Manager User"),
  ],
  vendors: [
    node("entity", "pricelabs", "PriceLabs"),
    node("entity", "wheelhouse", "Wheelhouse"),
    node("entity", "guesty", "Guesty"),
    node("entity", "hostaway", "Hostaway"),
    node("entity", "lodgify", "Lodgify"),
  ],
  geographyKinds: [
    node("geo", "country", "Country"),
    node("geo", "city", "City"),
    node("geo", "market", "Market"),
  ],
} as const;

export const canonicalEditorialNodes: readonly EditorialNode[] = [
  ...editorialTaxonomy.platforms,
  ...editorialTaxonomy.topics,
  ...editorialTaxonomy.audiences,
  ...editorialTaxonomy.vendors,
  ...editorialTaxonomy.geographyKinds,
];

export type SearchEligibilityTier =
  | "core"
  | "winner"
  | "hold"
  | "retire";

export type SearchEligibilityReason =
  | "core-public-page"
  | "explicit-winner"
  | "quality-review-pending"
  | "consolidation-candidate"
  | "retirement-candidate";

export type SearchIndexDirective = "index" | "noindex";

export type SearchEligibility = Readonly<{
  tier: SearchEligibilityTier;
  searchEligible: boolean;
  sitemapEligible: boolean;
  uniqueIntent: boolean;
  uniqueValue: boolean;
  localEvidence: boolean;
  reason: SearchEligibilityReason;
}>;

export type ResolvedSearchEligibility = SearchEligibility &
  Readonly<{
    indexDirective: SearchIndexDirective;
  }>;

const SAFE_FALLBACK: SearchEligibility = Object.freeze({
  tier: "hold",
  searchEligible: true,
  sitemapEligible: true,
  uniqueIntent: false,
  uniqueValue: false,
  localEvidence: false,
  reason: "quality-review-pending",
});

const REGISTRY: Readonly<Record<string, SearchEligibility>> = Object.freeze({
  "/": Object.freeze({
    tier: "core",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "core-public-page",
  }),
  "/airbnb-optimizer": Object.freeze({
    tier: "core",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "core-public-page",
  }),
  "/guides": Object.freeze({
    tier: "core",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "core-public-page",
  }),
  "/articles": Object.freeze({
    tier: "core",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "core-public-page",
  }),
  "/tools": Object.freeze({
    tier: "core",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "core-public-page",
  }),
  "/rankings": Object.freeze({
    tier: "core",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "core-public-page",
  }),
  "/guides/airbnb-seo": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/guides/airbnb-listing-optimization": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/guides/airbnb-pricing-optimization": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/guides/airbnb-listing-audit": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/guides/airbnb-photo-optimization": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/guides/airbnb-conversion-optimization": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/airbnb-optimizer/sapporo/occupancy-guide": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: true,
    reason: "explicit-winner",
  }),
  "/airbnb-optimizer/marrakech/revenue-optimization": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: true,
    reason: "explicit-winner",
  }),
  "/airbnb-optimizer/helsinki/title-optimization": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: true,
    reason: "explicit-winner",
  }),
  "/airbnb-optimizer/guadalajara/guest-trust-guide": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: true,
    reason: "explicit-winner",
  }),
  "/airbnb-optimizer/bali/photo-tips": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: true,
    reason: "explicit-winner",
  }),
  "/airbnb-optimizer/singapore/competitor-analysis": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: true,
    reason: "explicit-winner",
  }),
  "/articles/airbnb-photo-mistakes": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/articles/airbnb-cleanliness": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/articles/airbnb-decor": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/articles/airbnb-villa-photography": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/rankings/best-airbnb-destinations-for-families": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/rankings/best-airbnb-cities": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/rankings/best-airbnb-cities-in-europe": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: false,
    reason: "explicit-winner",
  }),
  "/airbnb-optimizer/mexico-city/pricing-guide": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: true,
    reason: "explicit-winner",
  }),
  "/airbnb-optimizer/la-rochelle": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: true,
    reason: "explicit-winner",
  }),
  "/airbnb-optimizer/doha": Object.freeze({
    tier: "winner",
    searchEligible: true,
    sitemapEligible: true,
    uniqueIntent: true,
    uniqueValue: true,
    localEvidence: true,
    reason: "explicit-winner",
  }),
});

export function normalizeSearchPath(input: string): string {
  if (typeof input !== "string") {
    throw new TypeError("Search eligibility path must be a string.");
  }

  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Search eligibility path must not be empty.");
  }

  let pathname: string;

  try {
    const isAbsolute = trimmed.startsWith("http" + "://") || trimmed.startsWith("https" + "://");
    const normalizedInput = trimmed.startsWith("/") ? trimmed : "/" + trimmed;
    const baseUrl = "https" + "://norixo.io";
    const url = isAbsolute ? new URL(trimmed) : new URL(normalizedInput, baseUrl);
    pathname = url.pathname;
  } catch {
    throw new Error("Invalid search eligibility path: " + input);
  }

  if (!pathname.startsWith("/")) {
    throw new Error("Invalid search eligibility path: " + input);
  }

  while (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return pathname || "/";
}

export function validateSearchEligibility(
  entry: SearchEligibility,
): SearchEligibility {
  if (
    (entry.tier === "core" || entry.tier === "winner") &&
    entry.searchEligible !== true
  ) {
    throw new Error(entry.tier + " entries must be search eligible.");
  }

  if (
    entry.tier === "retire" &&
    !["consolidation-candidate", "retirement-candidate"].includes(entry.reason)
  ) {
    throw new Error("Retire entries require an explicit retirement reason.");
  }

  if (entry.tier === "retire" && entry.sitemapEligible !== false) {
    throw new Error("Retire entries must not be sitemap eligible.");
  }

  return entry;
}

const CANARY_NOINDEX_PATHS = new Set<string>([
  "/airbnb-optimizer/abu-dhabi/title-optimization",
  "/airbnb-optimizer/agadir/guest-trust-guide",
  "/airbnb-optimizer/aix-en-provence/ranking-factors",
  "/airbnb-optimizer/al-hoceima/pricing-guide",
  "/airbnb-optimizer/albufeira/booking-conversion",
  "/airbnb-optimizer/alicante/revenue-optimization",
  "/airbnb-optimizer/amalfi/occupancy-guide",
  "/airbnb-optimizer/amman/amenities-guide",
  "/airbnb-optimizer/amsterdam/seo-guide",
  "/airbnb-optimizer/annecy/photo-tips",
  "/airbnb-optimizer/antwerp/search-visibility",
  "/airbnb-optimizer/arcachon/market-analysis",
  "/airbnb-optimizer/asilah/first-photo",
  "/airbnb-optimizer/athens/description-optimization",
  "/airbnb-optimizer/auckland/competitor-analysis",
  "/airbnb-optimizer/austin/conversion-guide",
  "/airbnb-optimizer/avignon/guest-trust-guide",
  "/airbnb-optimizer/bali-canggu/photo-tips",
  "/airbnb-optimizer/bali/local-demand-guide",
  "/airbnb-optimizer/bangkok/listing-audit",
  "/airbnb-optimizer/barcelona/seo-guide",
  "/airbnb-optimizer/benidorm/seasonality-guide",
  "/airbnb-optimizer/bergamo/long-stay-guide",
  "/airbnb-optimizer/berlin/pricing-guide",
  "/airbnb-optimizer/biarritz/listing-audit",
  "/airbnb-optimizer/bilbao/review-strategy",
  "/airbnb-optimizer/bogota/description-optimization",
  "/airbnb-optimizer/bologna/seo-guide",
  "/airbnb-optimizer/bordeaux/title-optimization",
  "/airbnb-optimizer/boston/review-strategy",
  "/airbnb-optimizer/braga/occupancy-guide",
  "/airbnb-optimizer/brussels/amenities-guide",
  "/airbnb-optimizer/bucharest/pricing-positioning",
  "/airbnb-optimizer/budapest/amenities-guide",
  "/airbnb-optimizer/buenos-aires/photo-order",
  "/airbnb-optimizer/cadiz/business-travel-guide",
  "/airbnb-optimizer/cairo/revenue-optimization",
  "/airbnb-optimizer/calgary/photo-order",
  "/airbnb-optimizer/cancun/family-travel-guide",
  "/airbnb-optimizer/cannes/first-photo",
  "/airbnb-optimizer/cape-town/ranking-factors",
  "/airbnb-optimizer/cartagena/business-travel-guide",
  "/airbnb-optimizer/casablanca/seasonality-guide",
  "/airbnb-optimizer/cebu/photo-tips",
  "/airbnb-optimizer/chamonix/search-visibility",
  "/airbnb-optimizer/chefchaouen/conversion-guide",
  "/airbnb-optimizer/chiang-mai/listing-audit",
  "/airbnb-optimizer/chicago/family-travel-guide",
  "/airbnb-optimizer/coimbra/competitor-analysis",
  "/airbnb-optimizer/colmar/pricing-guide",
  "/airbnb-optimizer/como/ranking-factors",
  "/airbnb-optimizer/copenhagen/local-demand-guide",
  "/airbnb-optimizer/corfu/pricing-positioning",
  "/airbnb-optimizer/courchevel/market-analysis",
  "/airbnb-optimizer/crete/description-optimization",
  "/airbnb-optimizer/cusco/title-optimization",
  "/airbnb-optimizer/da-nang/long-stay-guide",
  "/airbnb-optimizer/dakhla/photo-order",
  "/airbnb-optimizer/deauville/guest-trust-guide",
  "/airbnb-optimizer/djerba/family-travel-guide",
  "/airbnb-optimizer/doha/review-strategy",
  "/airbnb-optimizer/dubai/pricing-positioning",
  "/airbnb-optimizer/dublin/search-visibility",
  "/airbnb-optimizer/dubrovnik/first-photo",
  "/airbnb-optimizer/edinburgh/business-travel-guide",
  "/airbnb-optimizer/el-jadida/conversion-guide",
  "/airbnb-optimizer/essaouira/booking-conversion",
  "/airbnb-optimizer/evora/booking-conversion",
  "/airbnb-optimizer/faro/long-stay-guide",
  "/airbnb-optimizer/fes/competitor-analysis",
  "/airbnb-optimizer/florence/guest-trust-guide",
  "/airbnb-optimizer/fort-lauderdale/pricing-guide",
  "/airbnb-optimizer/fukuoka/market-analysis",
  "/airbnb-optimizer/geneva/revenue-optimization",
  "/airbnb-optimizer/genoa/seo-guide",
  "/airbnb-optimizer/gijon/local-demand-guide",
  "/airbnb-optimizer/girona/family-travel-guide",
  "/airbnb-optimizer/granada/competitor-analysis",
  "/airbnb-optimizer/grenoble/seasonality-guide",
  "/airbnb-optimizer/guadalajara/occupancy-guide",
  "/airbnb-optimizer/hanoi/business-travel-guide",
  "/airbnb-optimizer/helsinki/ranking-factors",
  "/airbnb-optimizer/ho-chi-minh-city/title-optimization",
  "/airbnb-optimizer/hong-kong/revenue-optimization",
  "/airbnb-optimizer/honolulu/photo-tips",
  "/airbnb-optimizer/hurghada/occupancy-guide",
  "/airbnb-optimizer/ibiza/photo-order",
  "/airbnb-optimizer/ifrane/booking-conversion",
  "/airbnb-optimizer/jakarta/conversion-guide",
  "/airbnb-optimizer/jeddah/pricing-positioning",
  "/airbnb-optimizer/krakow/search-visibility",
  "/airbnb-optimizer/kuala-lumpur/amenities-guide",
  "/airbnb-optimizer/kyoto/local-demand-guide",
  "/airbnb-optimizer/lagos-portugal/description-optimization",
  "/airbnb-optimizer/larnaca/first-photo",
  "/airbnb-optimizer/las-vegas/review-strategy",
  "/airbnb-optimizer/lecce/seasonality-guide",
  "/airbnb-optimizer/london/long-stay-guide",
  "/airbnb-optimizer/lyon/market-analysis",
  "/airbnb-optimizer/manila/listing-audit",
]);

export function isCanaryNoindexPath(path: string): boolean {
  return CANARY_NOINDEX_PATHS.has(normalizeSearchPath(path));
}

export function getCanaryNoindexPaths(): readonly string[] {
  return Object.freeze([...CANARY_NOINDEX_PATHS]);
}

export function getSearchEligibility(path: string): ResolvedSearchEligibility {
  const normalized = normalizeSearchPath(path);

  if (CANARY_NOINDEX_PATHS.has(normalized)) {
    const canaryEntry = validateSearchEligibility({
      tier: "hold",
      searchEligible: false,
      sitemapEligible: false,
      uniqueIntent: false,
      uniqueValue: false,
      localEvidence: false,
      reason: "quality-review-pending",
    });

    return Object.freeze({
      ...canaryEntry,
      indexDirective: "noindex",
    });
  }

  const entry = REGISTRY[normalized] ?? SAFE_FALLBACK;
  const validated = validateSearchEligibility(entry);

  return Object.freeze({
    ...validated,
    indexDirective: validated.searchEligible ? "index" : "noindex",
  });
}

export function getRegisteredSearchEligibilityPaths(): readonly string[] {
  return Object.freeze(Object.keys(REGISTRY));
}

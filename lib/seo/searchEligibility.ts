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

export type SearchEligibility = Readonly<{
  tier: SearchEligibilityTier;
  searchEligible: boolean;
  sitemapEligible: boolean;
  uniqueIntent: boolean;
  uniqueValue: boolean;
  localEvidence: boolean;
  reason: SearchEligibilityReason;
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

export function getSearchEligibility(path: string): SearchEligibility {
  const normalized = normalizeSearchPath(path);
  const entry = REGISTRY[normalized];

  if (!entry) {
    return SAFE_FALLBACK;
  }

  return validateSearchEligibility(entry);
}

export function getRegisteredSearchEligibilityPaths(): readonly string[] {
  return Object.freeze(Object.keys(REGISTRY));
}

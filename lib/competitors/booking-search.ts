import { chromium } from "playwright";
import type { CompetitorCandidate } from "./types";
import type { ExtractedListing } from "@/lib/extractors/types";
import { getNormalizedComparableType } from "./filterComparableListings";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

function isBookingDiscoveryAborted(signal?: AbortSignal | null): boolean {
  return signal?.aborted === true;
}

function debugBookingComparableLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

function normalizeSearchToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s,-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyBookingHotelUrl(url: string) {
  if (!url.includes("/hotel/")) return false;
  if (url.includes("/hotel/index.html")) return false;
  return /booking\.com\/hotel\/[a-z]{2}\//i.test(url);
}

function pathCountryCodeToDiscoveryLabel(code: string): string | null {
  switch (code.toLowerCase()) {
    case "ma":
      return "morocco";
    case "fr":
      return "france";
    case "ke":
      return "kenya";
    case "us":
      return "united states";
    case "gb":
      return "united kingdom";
    default:
      return null;
  }
}

function canonicalCountryForDiscoveryCompare(label: string | null | undefined): string | null {
  if (!label) return null;
  const n = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (n.includes("morocco") || n.includes("maroc")) return "morocco";
  if (n.includes("france")) return "france";
  if (n.includes("kenya")) return "kenya";
  if (n.includes("united states") || /\b(?:usa|u s a|u s)\b/.test(n)) return "united states";
  if (n.includes("united kingdom") || n === "uk") return "united kingdom";
  return n.replace(/[^a-z0-9]+/g, " ").trim() || null;
}

function isBookingDiscoveryUrlAllowedForTargetCountry(url: string, normalizedTargetCountry: string | null): boolean {
  if (!normalizedTargetCountry) return true;
  const m = url.match(/\/hotel\/([a-z]{2})\//i);
  if (!m?.[1]) return true;
  const pathLabel = pathCountryCodeToDiscoveryLabel(m[1]);
  if (!pathLabel) return true;
  const pathCanon = canonicalCountryForDiscoveryCompare(pathLabel);
  const targetCanon = canonicalCountryForDiscoveryCompare(normalizedTargetCountry);
  if (!pathCanon || !targetCanon) return true;
  return pathCanon === targetCanon;
}

function extractBookingSlug(url: string) {
  const match = url.match(/booking\.com\/hotel\/[a-z]{2}\/([^/?#]+?)(?:\.[a-z-]+)?\.html/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function inferBookingUrlTypeBucket(url: string) {
  const slug = extractBookingSlug(url) ?? "";

  if (!slug) return "unknown";
  if (/\bstudio\b/.test(slug)) return "studio_like";
  if (
    /\b(apartment|appartement|apart|aparthotel|residence|residences|flat|suite)\b/.test(
      slug
    )
  ) {
    return "apartment_like";
  }
  if (/\b(villa|house|maison|riad|dar|home)\b/.test(slug)) {
    return "house_like";
  }
  if (/\b(hotel|boutique|hostel|resort|spa)\b/.test(slug)) {
    return "hotel_like";
  }

  return "unknown";
}

function rankBookingComparableUrl(target: ExtractedListing, url: string) {
  const slug = extractBookingSlug(url) ?? "";
  const normalizedTargetType = getNormalizedComparableType(target);
  const candidateType = inferBookingUrlTypeBucket(url);
  const title = `${target.title ?? ""} ${target.locationLabel ?? ""}`.toLowerCase();
  const locationBonus =
    ["gueliz", "guéliz", "marrakech"].reduce(
      (sum, token) => sum + (slug.includes(token.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ? 8 : 0),
      0
    );
  const bedroomBonus = target.bedrooms && slug.includes(`${target.bedrooms}`)
    ? 6
    : /\b(2br|2-bedroom|2-bed|2ch|2-ch)\b/.test(slug)
      ? 6
      : 0;

  let score = 0;
  if (normalizedTargetType !== "unknown" && candidateType === normalizedTargetType) {
    score += 40;
  } else if (candidateType === "unknown") {
    score += 8;
  }

  if (title.includes("appartement") && /\b(appartement|apartment|apart|residence)\b/.test(slug)) {
    score += 18;
  }

  if (title.includes("hotel") && /\bhotel\b/.test(slug)) {
    score += 10;
  }

  score += bedroomBonus + locationBonus;

  if (normalizedTargetType === "villa_like") {
    const h = slug.toLowerCase();
    if (/\bvilla\b/i.test(h)) score += 20;
    if (/\briad\b/i.test(h)) score += 20;
    if (/\bhouse\b/i.test(h)) score += 16;
    if (/\bhome\b/i.test(h)) score += 12;
    if (/\bguesthouse\b/i.test(h)) score += 16;
    if (/\bdar\b/i.test(h)) score += 16;
    if (/\bmaison\b/i.test(h)) score += 16;
    if (/\bhotel\b/i.test(h)) score -= 24;
    if (/\bhostel\b/i.test(h)) score -= 20;
    if (/\bapartment\b/i.test(h)) score -= 22;
    if (/\bstudio\b/i.test(h)) score -= 22;
    if (/\broom\b/i.test(h)) score -= 14;
  }

  return score;
}

function isTargetVariant(url: string, target: ExtractedListing) {
  const targetSlug = extractBookingSlug(target.url ?? "");
  const candidateSlug = extractBookingSlug(url);
  if (!targetSlug || !candidateSlug) return false;
  return candidateSlug === targetSlug;
}

function normalizeBookingHotelUrl(url: string | null | undefined) {
  if (!url) return null;
  const absolute = url.startsWith("http") ? url : `https://www.booking.com${url}`;
  return absolute.split("?")[0];
}

function collectBookingHotelUrlsFromText(text: string) {
  return [...text.matchAll(/https:\\\/\\\/www\.booking\.com\\\/hotel\\\/[a-z]{2}\\\/[A-Za-z0-9\-_.]+(?:\.[a-z-]+)?\.html/gi)]
    .map((match) => match[0].replaceAll("\\/", "/").split("?")[0])
    .filter(Boolean);
}

function extractBookingSearchQueries(target: ExtractedListing): string[] {
  const rawTitle = normalizeSearchToken(target.title ?? "");
  const rawLocation = normalizeSearchToken(target.locationLabel ?? "");
  const titleParts = rawTitle
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const locationParts = rawLocation
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const tailLocation = titleParts.length > 1 ? titleParts.slice(-2).join(" ") : "";
  const broadLocation = locationParts.length > 0 ? locationParts.slice(-2).join(" ") : "";
  const propertyHint = target.bedrooms ? `${target.bedrooms} bedroom` : target.propertyType ?? "";

  const geoCity =
    locationParts.length >= 2 && locationParts[0]?.trim() && locationParts[locationParts.length - 1]?.trim()
      ? locationParts[0].trim()
      : "";
  const geoCountry =
    locationParts.length >= 2 && geoCity ? locationParts[locationParts.length - 1].trim() : "";
  const propertyTypeToken = normalizeSearchToken(target.propertyType ?? "").trim();

  const strongGeoQueries: string[] = [];
  if (geoCity && geoCountry) {
    if (propertyTypeToken) {
      strongGeoQueries.push(normalizeSearchToken(`${geoCity} ${geoCountry} ${propertyTypeToken}`));
    }
    strongGeoQueries.push(normalizeSearchToken(`${geoCity} ${geoCountry}`));
    strongGeoQueries.push(normalizeSearchToken(`${geoCity} accommodation`));
    strongGeoQueries.push(normalizeSearchToken(`${geoCity} ${geoCountry} booking`));
  }

  const legacyQueries = [
    [tailLocation, propertyHint].filter(Boolean).join(" ").trim(),
    tailLocation,
    broadLocation,
    rawLocation,
    rawTitle,
    normalizeSearchToken(target.description?.slice(0, 80) ?? ""),
  ].filter(Boolean);

  const merged = [...strongGeoQueries, ...legacyQueries];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const q of merged) {
    const k = normalizeSearchToken(q);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    ordered.push(k);
  }
  return ordered;
}

function buildBookingCompetitorCandidatesResult(input: {
  target: ExtractedListing;
  maxResults: number;
  skipAb: boolean;
  guardCountry: string | null;
  sourceAEmbeddedCandidates: string[];
  sourceBNetworkCandidates: string[];
  sourceCSearchCandidates: string[];
  sourceCSearchCandidatesRaw: string[];
  sourceCAttempt: {
    urls: string[];
    sourceQueries: Array<{ query: string; url: string; candidates: number }>;
  };
}): CompetitorCandidate[] {
  const {
    target,
    maxResults,
    skipAb,
    guardCountry,
    sourceAEmbeddedCandidates,
    sourceBNetworkCandidates,
    sourceCSearchCandidates,
    sourceCSearchCandidatesRaw,
    sourceCAttempt,
  } = input;

  const dedupedCandidates = [
    ...new Set(
      skipAb
        ? [...sourceCSearchCandidates, ...sourceAEmbeddedCandidates, ...sourceBNetworkCandidates]
        : [...sourceAEmbeddedCandidates, ...sourceBNetworkCandidates, ...sourceCSearchCandidates]
    ),
  ];

  if (skipAb) {
    console.log("[market][booking-discovery]", {
      mode: "strict_comparable_geo",
      normalizedTargetCountry: guardCountry,
      skipEmbeddedAndNetwork: true,
      sourceC_beforeCountryGuard: sourceCSearchCandidatesRaw.length,
      sourceC_afterCountryGuard: sourceCSearchCandidates.length,
      mergedCandidateCount: dedupedCandidates.length,
    });
  }

  const rejectedCandidates = dedupedCandidates
    .filter((url) => !isLikelyBookingHotelUrl(url) || isTargetVariant(url, target))
    .map((url) => ({
      url,
      reason: !isLikelyBookingHotelUrl(url) ? "not_a_listing_url" : "target_variant",
    }));

  const validListingCandidates = dedupedCandidates.filter(
    (url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target)
  );
  const rankedValidListingCandidates = [...validListingCandidates].sort(
    (a, b) => rankBookingComparableUrl(target, b) - rankBookingComparableUrl(target, a)
  );

  debugBookingComparableLog("[guest-audit][comparables][booking-source-debug]", {
    targetUrl: target.url ?? null,
    targetTitle: target.title ?? null,
    targetLocation: target.locationLabel ?? null,
    sourceAttemptOrder: ["embedded_listing_page", "network_payloads", "interactive_home_search"],
    sourceA_embeddedCandidates: sourceAEmbeddedCandidates,
    sourceB_networkCandidates: sourceBNetworkCandidates,
    sourceC_searchCandidates: {
      queries: sourceCAttempt.sourceQueries,
      urls: sourceCSearchCandidates,
    },
    dedupedCandidates,
    validListingCandidates: rankedValidListingCandidates,
    rejectedCandidates,
    finalCandidateCount: rankedValidListingCandidates.slice(0, maxResults).length,
  });

  const unique = rankedValidListingCandidates.slice(0, maxResults);

  return unique.map((url) => ({
    url: url as string,
    platform: "booking",
    title: null,
    price: null,
    latitude: null,
    longitude: null,
  }));
}

async function collectEmbeddedBookingCandidates(
  page: import("playwright").Page,
  target: ExtractedListing
) {
  const html = await page.content();
  const candidateUrls = new Set<string>();

  for (const url of collectBookingHotelUrlsFromText(html)) {
    if (!isLikelyBookingHotelUrl(url) || isTargetVariant(url, target)) continue;
    candidateUrls.add(url);
  }

  const scriptJsonTexts = await page.$$eval(
    'script[type="application/json"]',
    (elements) => elements.map((el) => el.textContent || "")
  );

  for (const text of scriptJsonTexts) {
    for (const url of collectBookingHotelUrlsFromText(text)) {
      if (!isLikelyBookingHotelUrl(url) || isTargetVariant(url, target)) continue;
      candidateUrls.add(url);
    }
  }

  return [...candidateUrls];
}

async function collectInteractiveSearchCandidates(input: {
  page: import("playwright").Page;
  target: ExtractedListing;
  queries: string[];
  maxResults: number;
  abortSignal?: AbortSignal | null;
}) {
  const collectedUrls: string[] = [];
  const sourceQueries: Array<{ query: string; url: string; candidates: number }> = [];
  const inputSelector =
    'input[name="ss"], input[placeholder*="destination" i], input[aria-label*="destination" i]';

  for (const query of input.queries) {
    if (isBookingDiscoveryAborted(input.abortSignal)) {
      break;
    }

    await input.page.goto("https://www.booking.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await input.page.waitForTimeout(1200);
    const searchInput = input.page.locator(inputSelector).first();
    if ((await searchInput.count()) === 0) {
      continue;
    }

    await searchInput.click().catch(() => null);
    await searchInput.fill(query).catch(() => null);
    await input.page.waitForTimeout(700);
    await input.page.keyboard.press("Enter").catch(() => null);
    await input.page.waitForTimeout(3200);
    await input.page.waitForLoadState("load").catch(() => null);
    await input.page.waitForTimeout(800);

    const pageUrls = await input.page.$$eval(
      'a[href*="/hotel/"]',
      (elements) =>
        elements
          .map((el) => el.getAttribute("href"))
          .filter(Boolean)
          .map((href) => {
            if (!href) return null;
            if (href.startsWith("http")) return href.split("?")[0];
            return `https://www.booking.com${href.split("?")[0]}`;
          })
    );

    let queryCount = 0;
    for (const rawUrl of pageUrls) {
      const url = normalizeBookingHotelUrl(rawUrl);
      if (!url) continue;
      if (!isLikelyBookingHotelUrl(url)) continue;
      if (isTargetVariant(url, input.target)) continue;
      if (!collectedUrls.includes(url)) {
        collectedUrls.push(url);
        queryCount += 1;
      }
    }

    sourceQueries.push({
      query,
      url: input.page.url(),
      candidates: queryCount,
    });

    if (collectedUrls.length >= input.maxResults) {
      break;
    }
  }

  return {
    urls: collectedUrls,
    sourceQueries,
  };
}

function hasEnoughRankedFromEmbeddedNetwork(
  target: ExtractedListing,
  sourceA: string[],
  sourceB: string[],
  guardCountry: string | null,
  needCount: number
): boolean {
  const pool = [...new Set([...sourceA, ...sourceB])];
  const valid = pool.filter(
    (url) =>
      isLikelyBookingHotelUrl(url) &&
      !isTargetVariant(url, target) &&
      (!guardCountry || isBookingDiscoveryUrlAllowedForTargetCountry(url, guardCountry))
  );
  const ranked = [...valid].sort(
    (a, b) => rankBookingComparableUrl(target, b) - rankBookingComparableUrl(target, a)
  );
  return ranked.length >= needCount;
}

export async function searchBookingCompetitorCandidates(
  target: ExtractedListing,
  maxResults = 5,
  discoveryGeo?: { normalizedTargetCountry: string | null; skipEmbeddedAndNetwork: boolean } | null,
  abortSignal?: AbortSignal | null
): Promise<CompetitorCandidate[]> {
  const queries = [...new Set(extractBookingSearchQueries(target))];

  if (queries.length === 0 || isBookingDiscoveryAborted(abortSignal)) {
    return [];
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const skipAb = Boolean(discoveryGeo?.skipEmbeddedAndNetwork);
  const guardCountry = discoveryGeo?.normalizedTargetCountry ?? null;
  const interactiveCap = Math.min(Math.max(maxResults * 2, 8), 24);

  const networkResponseBodies: string[] = [];
  let sourceAEmbeddedCandidates: string[] = [];
  let sourceBNetworkCandidates: string[] = [];
  let sourceCSearchCandidates: string[] = [];
  let sourceCSearchCandidatesRaw: string[] = [];
  let sourceCAttempt: {
    urls: string[];
    sourceQueries: Array<{ query: string; url: string; candidates: number }>;
  } = { urls: [], sourceQueries: [] };

  try {
    page.on("response", async (response) => {
      if (isBookingDiscoveryAborted(abortSignal)) {
        return;
      }
      const url = response.url();
      if (!/dml\/graphql|orca|acid_carousel|carousel|recommend|similar|nearby/i.test(url)) {
        return;
      }
      try {
        const text = await response.text();
        networkResponseBodies.push(text);
      } catch {
        // Ignore unreadable response bodies.
      }
    });

    if (isBookingDiscoveryAborted(abortSignal)) {
      return [];
    }

    await page.goto(target.url ?? "", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(2000);
    await page.waitForLoadState("load").catch(() => null);
    await page.waitForTimeout(800);

    if (isBookingDiscoveryAborted(abortSignal)) {
      sourceBNetworkCandidates = skipAb
        ? []
        : [
            ...new Set(
              networkResponseBodies.flatMap((text) => collectBookingHotelUrlsFromText(text))
            ),
          ].filter((url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target));
      return buildBookingCompetitorCandidatesResult({
        target,
        maxResults,
        skipAb,
        guardCountry,
        sourceAEmbeddedCandidates: [],
        sourceBNetworkCandidates,
        sourceCSearchCandidates: [],
        sourceCSearchCandidatesRaw: [],
        sourceCAttempt: { urls: [], sourceQueries: [] },
      });
    }

    sourceAEmbeddedCandidates = skipAb
      ? []
      : await collectEmbeddedBookingCandidates(page, target);

    sourceBNetworkCandidates = skipAb
      ? []
      : [
          ...new Set(
            networkResponseBodies.flatMap((text) => collectBookingHotelUrlsFromText(text))
          ),
        ].filter((url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target));

    if (isBookingDiscoveryAborted(abortSignal)) {
      return buildBookingCompetitorCandidatesResult({
        target,
        maxResults,
        skipAb,
        guardCountry,
        sourceAEmbeddedCandidates,
        sourceBNetworkCandidates,
        sourceCSearchCandidates: [],
        sourceCSearchCandidatesRaw: [],
        sourceCAttempt: { urls: [], sourceQueries: [] },
      });
    }

    const enoughFromAb =
      !skipAb &&
      hasEnoughRankedFromEmbeddedNetwork(
        target,
        sourceAEmbeddedCandidates,
        sourceBNetworkCandidates,
        guardCountry,
        maxResults
      );

    if (!enoughFromAb && !isBookingDiscoveryAborted(abortSignal)) {
      sourceCAttempt = await collectInteractiveSearchCandidates({
        page,
        target,
        queries,
        maxResults: interactiveCap,
        abortSignal,
      });
      sourceCSearchCandidatesRaw = sourceCAttempt.urls.filter(
        (url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target)
      );
      sourceCSearchCandidates = guardCountry
        ? sourceCSearchCandidatesRaw.filter((u) =>
            isBookingDiscoveryUrlAllowedForTargetCountry(u, guardCountry)
          )
        : sourceCSearchCandidatesRaw;

      if (
        skipAb &&
        guardCountry &&
        sourceCSearchCandidates.length === 0 &&
        !isBookingDiscoveryAborted(abortSignal)
      ) {
        const rawLocationFb = normalizeSearchToken(target.locationLabel ?? "");
        const locationPartsFb = rawLocationFb
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        if (locationPartsFb.length >= 2) {
          const cityFb = locationPartsFb[0];
          const countryFb = locationPartsFb[locationPartsFb.length - 1];
          const ptFb = normalizeSearchToken(target.propertyType ?? "").trim();
          const fallbackQueries: string[] = [];
          if (ptFb) fallbackQueries.push(normalizeSearchToken(`${cityFb} ${countryFb} ${ptFb}`));
          fallbackQueries.push(normalizeSearchToken(`${cityFb} ${countryFb}`));
          const fallbackQueriesDistinct = [...new Set(fallbackQueries)].slice(0, 2);
          if (fallbackQueriesDistinct.length > 0) {
            const sourceCFallbackAttempt = await collectInteractiveSearchCandidates({
              page,
              target,
              queries: fallbackQueriesDistinct,
              maxResults: interactiveCap,
              abortSignal,
            });
            const fallbackRaw = sourceCFallbackAttempt.urls.filter(
              (url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target)
            );
            sourceCSearchCandidatesRaw = [...sourceCSearchCandidatesRaw, ...fallbackRaw];
            sourceCSearchCandidates = guardCountry
              ? fallbackRaw.filter((u) =>
                  isBookingDiscoveryUrlAllowedForTargetCountry(u, guardCountry)
                )
              : fallbackRaw;
            sourceCAttempt = {
              urls: [...sourceCAttempt.urls, ...sourceCFallbackAttempt.urls],
              sourceQueries: [
                ...sourceCAttempt.sourceQueries,
                ...sourceCFallbackAttempt.sourceQueries,
              ],
            };
          }
        }
      }
    }

    return buildBookingCompetitorCandidatesResult({
      target,
      maxResults,
      skipAb,
      guardCountry,
      sourceAEmbeddedCandidates,
      sourceBNetworkCandidates,
      sourceCSearchCandidates,
      sourceCSearchCandidatesRaw,
      sourceCAttempt,
    });
  } catch (error) {
    console.error("Booking competitor search failed:", error);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}

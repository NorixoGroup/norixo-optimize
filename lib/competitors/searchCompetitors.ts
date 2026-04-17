import { extractListing } from "@/lib/extractors";
import type { ExtractedListing } from "@/lib/extractors/types";
import { chromium, type Browser, type Page } from "playwright-core";
import { searchAgodaCompetitorCandidates } from "./agoda-search";
import type { SearchCompetitorsInput, SearchCompetitorsResult } from "./types";
import { searchAirbnbCompetitorCandidates } from "./airbnb-search";
import { searchBookingCompetitorCandidates } from "./booking-search";
import { searchVrboCompetitorCandidates } from "./vrbo-search";
import {
  evaluateComparableCandidates,
  filterComparableListings,
  getNormalizedComparableType,
  guessListingCity,
  guessListingLanguage,
  guessListingNeighborhood,
} from "./filterComparableListings";

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_RADIUS_KM = 1;
const AIRBNB_COMPETITOR_PRICE_ATTEMPT_LIMIT = 3;
const AIRBNB_COMPETITOR_PRICE_NIGHTS = 5;
const AIRBNB_COMPETITOR_PRICE_TIMEOUT_MS = 15000;
const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

function debugComparablesLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

async function getCandidateUrls(
  target: ExtractedListing,
  maxResults: number
): Promise<string[]> {
  switch (target.platform) {
    case "airbnb": {
      try {
        const candidates = await searchAirbnbCompetitorCandidates(target, maxResults);
        return candidates.map((c) => c.url).filter(Boolean);
      } catch (error) {
        console.error("Error searching Airbnb competitors", error);
        return [];
      }
    }

    case "booking": {
      try {
        const candidates = await searchBookingCompetitorCandidates(target, maxResults);
        return candidates.map((c) => c.url).filter(Boolean);
      } catch (error) {
        console.error("Error searching Booking.com competitors", error);
        return [];
      }
    }

    case "vrbo": {
      try {
        const candidates = await searchVrboCompetitorCandidates(target, maxResults);
        return candidates.map((c) => c.url).filter(Boolean);
      } catch (error) {
        console.error("Error searching VRBO competitors", error);
        return [];
      }
    }

    case "agoda": {
      try {
        const candidates = await searchAgodaCompetitorCandidates(target, maxResults);
        return candidates.map((c) => c.url).filter(Boolean);
      } catch (error) {
        console.error("Error searching Agoda competitors", error);
        return [];
      }
    }

    default:
      return [];
  }
}

function isUsableListing(listing: ExtractedListing, target: ExtractedListing): boolean {
  if (!listing) return false;

  if (!listing.url || typeof listing.url !== "string") return false;
  if (listing.url === target.url) return false;

  const hasTitle = typeof listing.title === "string" && listing.title.trim().length > 0;
  const hasPhotos = Array.isArray(listing.photos) && listing.photos.length > 0;
  const hasAmenities = Array.isArray(listing.amenities) && listing.amenities.length > 0;

  // At least one core field should be meaningful for the listing to be comparable
  return hasTitle || hasPhotos || hasAmenities;
}

function buildListingKey(listing: ExtractedListing): string {
  const url = listing.url ?? "";
  const externalId = listing.externalId ?? "";
  const platform = listing.platform ?? "";
  const title = (listing.title ?? "").toLowerCase();
  const price =
    typeof listing.price === "number" && Number.isFinite(listing.price)
      ? listing.price.toFixed(2)
      : "";

  return [platform, externalId, url, title, price].join("|");
}

function dedupeListings(
  listings: ExtractedListing[],
  target: ExtractedListing
): ExtractedListing[] {
  const seen = new Set<string>();
  const result: ExtractedListing[] = [];

  for (const listing of listings) {
    if (!isUsableListing(listing, target)) continue;

    const key = buildListingKey(listing);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(listing);
  }

  return result;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getBrightDataCdpEndpoint() {
  const browserHost = readEnv("BRIGHTDATA_BROWSER_HOST");
  const browserUsername = readEnv("BRIGHTDATA_BROWSER_USERNAME");
  const browserPassword = readEnv("BRIGHTDATA_BROWSER_PASSWORD");

  if (browserHost && browserUsername && browserPassword) {
    const port = readEnv("BRIGHTDATA_BROWSER_PORT") ?? "9222";
    const hostWithPort = browserHost.includes(":") ? browserHost : `${browserHost}:${port}`;
    return `wss://${encodeURIComponent(browserUsername)}:${encodeURIComponent(
      browserPassword
    )}@${hostWithPort}`;
  }

  const host = readEnv("BRIGHTDATA_HOST");
  const port = readEnv("BRIGHTDATA_PORT");
  const username = readEnv("BRIGHTDATA_USERNAME");
  const password = readEnv("BRIGHTDATA_PASSWORD");

  if (!host || port !== "9222" || !username || !password) return null;

  const hostWithPort = host.includes(":") ? host : `${host}:${port}`;
  return `wss://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostWithPort}`;
}

function buildAirbnbCompetitorPricingUrl(url: string) {
  const target = new URL(url);
  if (/airbnb\.com$/i.test(target.hostname)) {
    target.hostname = "www.airbnb.fr";
  }
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 14);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + AIRBNB_COMPETITOR_PRICE_NIGHTS);

  target.searchParams.set("check_in", checkIn.toISOString().slice(0, 10));
  target.searchParams.set("check_out", checkOut.toISOString().slice(0, 10));
  target.searchParams.set("adults", "2");
  return {
    url: target.toString(),
    nights: AIRBNB_COMPETITOR_PRICE_NIGHTS,
  };
}

function parseCurrencyFromText(text: string) {
  if (text.includes("€")) return "EUR";
  if (text.includes("$")) return "USD";
  if (text.includes("£")) return "GBP";
  return null;
}

function parsePriceNumber(text: string) {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseAirbnbTotalPrice(text: string) {
  const normalized = text.replace(/\u00a0|\u202f/g, " ").replace(/\s+/g, " ").trim();
  if (!/(au total|total|totale)/i.test(normalized)) return null;

  const match =
    normalized.match(/([€$£])\s*(\d[\d\s.,]*)\s*(?:au\s*total|total|totale)/i) ??
    normalized.match(/(\d[\d\s.,]*)\s*([€$£])\s*(?:au\s*total|total|totale)/i);

  if (!match) return null;

  const symbolFirst = /[€$£]/.test(match[1] ?? "");
  const rawPrice = symbolFirst ? match[2] : match[1];
  const currencySymbol = symbolFirst ? match[1] : match[2];
  const value = parsePriceNumber(rawPrice ?? "");
  if (value == null || value <= 0 || value > 50000) return null;

  return {
    totalPrice: Math.round(value),
    currency: parseCurrencyFromText(currencySymbol ?? normalized),
  };
}

function getRemainingTimeout(startedAt: number) {
  return Math.max(1000, AIRBNB_COMPETITOR_PRICE_TIMEOUT_MS - (Date.now() - startedAt));
}

async function readAirbnbCompetitorTotalPrice(page: Page, startedAt: number) {
  await page
    .waitForSelector('[data-testid="book-it-default"], [data-testid="price-element"], body', {
      timeout: Math.min(4000, getRemainingTimeout(startedAt)),
    })
    .catch(() => {});
  await page.waitForTimeout(Math.min(1500, getRemainingTimeout(startedAt))).catch(() => {});

  const candidates = await page.evaluate(`
    (() => {
      const values = [];
      const pushText = (source, text) => {
        const normalized = (text || "").replace(/\\s+/g, " ").trim();
        if (!normalized || normalized.length > 260) return;
        if (!/[€$£]/.test(normalized)) return;
        if (!/(au total|total|totale)/i.test(normalized)) return;
        values.push({ source, text: normalized });
      };

      document
        .querySelectorAll('[data-testid="book-it-default"], [data-testid="book-it-default"] span')
        .forEach((element) => pushText("book-it-default", element.textContent));
      document
        .querySelectorAll('[data-testid="price-element"], [data-testid="price-element"] span')
        .forEach((element) => pushText("price-element", element.textContent));

      return values.slice(0, 20);
    })()
  `);

  if (!Array.isArray(candidates)) return null;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const text = (candidate as { text?: unknown }).text;
    if (typeof text !== "string") continue;

    const parsed = parseAirbnbTotalPrice(text);
    if (parsed) return parsed;
  }

  return null;
}

async function fetchAirbnbCompetitorPriceWithCdp(url: string) {
  const endpoint = getBrightDataCdpEndpoint();
  if (!endpoint) return null;

  const pricingUrl = buildAirbnbCompetitorPricingUrl(url);
  const startedAt = Date.now();
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.connectOverCDP(endpoint, {
      timeout: Math.min(3000, getRemainingTimeout(startedAt)),
    });
    page = await browser.newPage();
    await page.goto(pricingUrl.url, {
      waitUntil: "commit",
      timeout: Math.min(11000, getRemainingTimeout(startedAt)),
    });

    const parsed = await readAirbnbCompetitorTotalPrice(page, startedAt);
    if (!parsed) {
      console.log("[pricing][competitor]", {
        url,
        totalPrice: null,
        pricePerNight: null,
        nights: pricingUrl.nights,
        currency: null,
      });
      return null;
    }

    const pricePerNight = Math.round((parsed.totalPrice / pricingUrl.nights) * 100) / 100;
    console.log("[pricing][competitor]", {
      url,
      totalPrice: parsed.totalPrice,
      pricePerNight,
      nights: pricingUrl.nights,
      currency: parsed.currency,
    });

    return {
      totalPrice: parsed.totalPrice,
      pricePerNight,
      nights: pricingUrl.nights,
      currency: parsed.currency,
    };
  } catch (error) {
    console.log("[pricing][competitor]", {
      url,
      totalPrice: null,
      pricePerNight: null,
      nights: pricingUrl.nights,
      currency: null,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function enrichAirbnbCompetitorPrices(competitors: ExtractedListing[]) {
  let attempted = 0;
  let successful = 0;

  for (const competitor of competitors) {
    if (successful >= AIRBNB_COMPETITOR_PRICE_ATTEMPT_LIMIT) break;
    if (attempted >= AIRBNB_COMPETITOR_PRICE_ATTEMPT_LIMIT) break;
    if (competitor.platform !== "airbnb") continue;
    if (typeof competitor.price === "number" && Number.isFinite(competitor.price)) continue;

    attempted += 1;
    const pricing = await fetchAirbnbCompetitorPriceWithCdp(competitor.url);
    if (!pricing) continue;

    competitor.price = pricing.pricePerNight;
    competitor.currency = pricing.currency;
    Object.assign(competitor, {
      pricePerNight: pricing.pricePerNight,
      totalPrice: pricing.totalPrice,
      priceNights: pricing.nights,
      priceSource: "cdp_avg_nightly_from_total",
    });
    successful += 1;
  }
}

export async function searchCompetitorsAroundTarget(
  input: SearchCompetitorsInput
): Promise<SearchCompetitorsResult> {
  const maxResults = Math.min(input.maxResults ?? DEFAULT_MAX_RESULTS, 5);
  const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;
  const candidateFetchLimit = Math.max(maxResults * 4, 12);

  const candidateUrls = await getCandidateUrls(input.target, candidateFetchLimit);

  const uniqueUrls = [...new Set(candidateUrls.map((url) => url?.trim() || ""))]
    .filter((url) => Boolean(url) && url !== input.target.url)
    .slice(0, candidateFetchLimit);

  const extractedResults = await Promise.allSettled(
    uniqueUrls.map((url) => extractListing(url))
  );

  const rawCompetitors: ExtractedListing[] = extractedResults
    .filter(
      (result): result is PromiseFulfilledResult<ExtractedListing> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value)
    .filter((listing) => listing && listing.url !== input.target.url);

  const sanitizedCompetitors = dedupeListings(rawCompetitors, input.target);
  const candidateDecisions = evaluateComparableCandidates(
    input.target,
    sanitizedCompetitors
  );

  const competitors = filterComparableListings(
    input.target,
    sanitizedCompetitors,
    maxResults
  );
  await enrichAirbnbCompetitorPrices(competitors);

  debugComparablesLog("[guest-audit][comparables][pipeline-debug]", {
    target: {
      title: input.target.title ?? null,
      platform: input.target.platform ?? null,
      propertyType: input.target.propertyType ?? null,
      normalizedTargetType: getNormalizedComparableType(input.target),
      capacity: input.target.capacity ?? null,
      bedrooms: input.target.bedrooms ?? null,
      bathrooms: input.target.bathrooms ?? null,
      locationLabel: input.target.locationLabel ?? null,
    },
    platform: input.target.platform ?? null,
    source: "searchCompetitorsAroundTarget",
    searchResultCountRaw: uniqueUrls.length,
    rawCandidates: sanitizedCompetitors.map((listing) => ({
      id: listing.externalId ?? null,
      url: listing.url ?? null,
      title: listing.title ?? null,
      platform: listing.platform ?? null,
      propertyType: listing.propertyType ?? null,
      normalizedType: getNormalizedComparableType(listing),
      city: guessListingCity(listing),
      neighborhood: guessListingNeighborhood(listing),
      languageGuess: guessListingLanguage(listing),
      capacity: listing.capacity ?? null,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      photosCount: Array.isArray(listing.photos)
        ? listing.photos.filter(Boolean).length
        : typeof listing.photosCount === "number"
          ? listing.photosCount
          : 0,
      ratingValue:
        typeof listing.ratingValue === "number"
          ? listing.ratingValue
          : typeof listing.rating === "number"
            ? listing.rating
            : null,
      reviewCount: typeof listing.reviewCount === "number" ? listing.reviewCount : null,
      amenitiesCount: Array.isArray(listing.amenities)
        ? listing.amenities.filter(Boolean).length
        : 0,
      locationLabel: listing.locationLabel ?? null,
    })),
    filterResultCount: competitors.length,
    rejectedCandidates: candidateDecisions
      .filter((decision) => !decision.accepted)
      .map((decision) => ({
        id: decision.candidate.externalId ?? null,
        url: decision.candidate.url ?? null,
        title: decision.candidate.title ?? null,
        platform: decision.candidate.platform ?? null,
        normalizedType: decision.candidateNormalizedType,
        normalizedTargetType: decision.targetNormalizedType,
        city: decision.candidateCity,
        neighborhood: decision.candidateNeighborhood,
        languageGuess: decision.candidateLanguageGuess,
        bedrooms: decision.candidate.bedrooms ?? null,
        bathrooms: decision.candidate.bathrooms ?? null,
        capacity: decision.candidate.capacity ?? null,
        reasons: decision.reasons,
      })),
    retainedCandidates: competitors.map((listing) => ({
      id: listing.externalId ?? null,
      url: listing.url ?? null,
      title: listing.title ?? null,
      platform: listing.platform ?? null,
      normalizedType: getNormalizedComparableType(listing),
      city: guessListingCity(listing),
      neighborhood: guessListingNeighborhood(listing),
      languageGuess: guessListingLanguage(listing),
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      capacity: listing.capacity ?? null,
    })),
    finalInjectedCount: competitors.length,
  });

  return {
    target: input.target,
    competitors,
    attempted: uniqueUrls.length,
    selected: competitors.length,
    radiusKm,
    maxResults,
  };
}

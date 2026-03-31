import { chromium } from "playwright";
import type { CompetitorCandidate } from "./types";
import type { ExtractedListing } from "@/lib/extractors/types";
import { getNormalizedComparableType } from "./filterComparableListings";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

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

  return [
    [tailLocation, propertyHint].filter(Boolean).join(" ").trim(),
    tailLocation,
    broadLocation,
    rawLocation,
    rawTitle,
    normalizeSearchToken(target.description?.slice(0, 80) ?? ""),
  ].filter(Boolean);
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
}) {
  const collectedUrls: string[] = [];
  const sourceQueries: Array<{ query: string; url: string; candidates: number }> = [];
  const inputSelector =
    'input[name="ss"], input[placeholder*="destination" i], input[aria-label*="destination" i]';

  for (const query of input.queries) {
    await input.page.goto("https://www.booking.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await input.page.waitForTimeout(3000);
    const searchInput = input.page.locator(inputSelector).first();
    if ((await searchInput.count()) === 0) {
      continue;
    }

    await searchInput.click().catch(() => null);
    await searchInput.fill(query).catch(() => null);
    await input.page.waitForTimeout(1500);
    await input.page.keyboard.press("Enter").catch(() => null);
    await input.page.waitForTimeout(7000);
    await input.page.waitForLoadState("networkidle").catch(() => null);

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

export async function searchBookingCompetitorCandidates(
  target: ExtractedListing,
  maxResults = 5
): Promise<CompetitorCandidate[]> {
  const queries = [...new Set(extractBookingSearchQueries(target))];

  if (queries.length === 0) {
    return [];
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const networkResponseBodies: string[] = [];
    page.on("response", async (response) => {
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

    await page.goto(target.url ?? "", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(5000);
    await page.waitForLoadState("networkidle").catch(() => null);

    const sourceAEmbeddedCandidates = await collectEmbeddedBookingCandidates(page, target);

    const sourceBNetworkCandidates = [
      ...new Set(
        networkResponseBodies.flatMap((text) => collectBookingHotelUrlsFromText(text))
      ),
    ].filter((url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target));

    const sourceCAttempt = await collectInteractiveSearchCandidates({
      page,
      target,
      queries,
      maxResults: Math.max(maxResults * 4, 12),
    });
    const sourceCSearchCandidates = sourceCAttempt.urls.filter(
      (url) => isLikelyBookingHotelUrl(url) && !isTargetVariant(url, target)
    );

    const sourceAttemptOrder = ["embedded_listing_page", "network_payloads", "interactive_home_search"];
    const dedupedCandidates = [
      ...new Set([
        ...sourceAEmbeddedCandidates,
        ...sourceBNetworkCandidates,
        ...sourceCSearchCandidates,
      ]),
    ];

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
      sourceAttemptOrder,
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

    await browser.close();

    return unique.map((url) => ({
      url: url as string,
      platform: "booking",
      title: null,
      price: null,
      latitude: null,
      longitude: null,
    }));
  } catch (error) {
    await browser.close();
    console.error("Booking competitor search failed:", error);
    return [];
  }
}

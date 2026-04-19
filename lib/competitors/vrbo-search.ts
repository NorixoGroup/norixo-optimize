import { chromium } from "playwright";
import type { CompetitorCandidate } from "./types";
import type { ExtractedListing } from "@/lib/extractors/types";

function buildVrboSearchUrl(target: ExtractedListing): string | null {
  const query =
    target.locationLabel ||
    target.title ||
    target.description?.slice(0, 80) ||
    "";

  if (!query) return null;

  return `https://www.vrbo.com/search/keywords:${encodeURIComponent(query)}`;
}

function isVrboListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("vrbo.com")) return false;
    const listingId = parsed.pathname.match(/\/p\/?([a-z0-9]+)$/i)?.[1] ?? null;
    if (listingId && !/\d/.test(listingId)) return false;
    return (
      /^\/p\/[a-z0-9]+$/i.test(parsed.pathname) ||
      /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:location\/)?p\/?[a-z0-9]+$/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export async function searchVrboCompetitorCandidates(
  target: ExtractedListing,
  maxResults = 5
): Promise<CompetitorCandidate[]> {
  const searchUrl = buildVrboSearchUrl(target);

  if (!searchUrl) {
    return [];
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(4000);

    const links = await page.$$eval(
      'a[href*="vrbo.com"], a[href*="/"]',
      (elements) =>
        elements
          .map((el) => el.getAttribute("href"))
          .filter(Boolean)
          .map((href) => {
            if (!href) return null;
            if (href.startsWith("http")) return href.split("?")[0];
            return `https://www.vrbo.com${href.split("?")[0]}`;
          })
    );

    const unique = [...new Set(links)]
      .filter((url): url is string => typeof url === "string" && isVrboListingUrl(url))
      .slice(0, maxResults);

    await browser.close();

    return unique.map((url) => ({
      url: url as string,
      platform: "vrbo",
      title: null,
      price: null,
      latitude: null,
      longitude: null,
    }));
  } catch (error) {
    await browser.close();
    console.error("Vrbo competitor search failed:", error);
    return [];
  }
}

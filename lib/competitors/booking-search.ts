import { chromium } from "playwright";
import type { CompetitorCandidate } from "./types";
import type { ExtractedListing } from "@/lib/extractors/types";

function buildBookingSearchUrl(target: ExtractedListing): string | null {
  const query =
    target.locationLabel ||
    target.title ||
    target.description?.slice(0, 80) ||
    "";

  if (!query) return null;

  const url = new URL("https://www.booking.com/searchresults.html");
  url.searchParams.set("ss", query);
  url.searchParams.set("lang", "en-us");
  url.searchParams.set("src", "searchresults");

  return url.toString();
}

export async function searchBookingCompetitorCandidates(
  target: ExtractedListing,
  maxResults = 5
): Promise<CompetitorCandidate[]> {
  const searchUrl = buildBookingSearchUrl(target);

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
      'a[data-testid="title-link"], a[href*="/hotel/"]',
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

    const unique = [...new Set(links)].filter(Boolean).slice(0, maxResults);

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
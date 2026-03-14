import { chromium } from "playwright";
import type { CompetitorCandidate } from "./types";
import type { ExtractedListing } from "@/lib/extractors/types";

export async function searchAirbnbCompetitorCandidates(
  target: ExtractedListing,
  maxResults = 5
): Promise<CompetitorCandidate[]> {

  const query =
    target.locationLabel ||
    target.title ||
    target.description?.slice(0, 80) ||
    "";

  if (!query) {
    return [];
  }

  const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(query)}/homes`;

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  try {

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(4000);

    const links = await page.$$eval(
      'a[href*="/rooms/"]',
      (elements) =>
        elements.map((el) => {
          const href = el.getAttribute("href");
          return href ? `https://www.airbnb.com${href.split("?")[0]}` : null;
        })
    );

    const unique = [...new Set(links)].filter(Boolean).slice(0, maxResults);

    await browser.close();

    return unique.map((url) => ({
      url: url as string,
      platform: "airbnb",
      title: null,
      price: null,
      latitude: null,
      longitude: null
    }));

  } catch (error) {

    await browser.close();

    console.error("Airbnb competitor search failed:", error);

    return [];
  }
}
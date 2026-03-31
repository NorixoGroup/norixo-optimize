import { chromium } from "playwright";
import type { CompetitorCandidate } from "./types";
import type { ExtractedListing } from "@/lib/extractors/types";

function extractAirbnbRoomId(url?: string | null) {
  return url?.match(/\/rooms\/(\d+)/)?.[1] ?? null;
}

function normalizeSearchToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s,-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLocationHintsFromHtml(html: string) {
  const locality = html.match(/"addressLocality":"([^"]+)"/i)?.[1] ?? null;
  const canonicalTitle =
    html.match(/<title>([^<]+)<\/title>/i)?.[1]?.replace(/\s*-\s*Airbnb\s*$/i, "") ?? null;

  const titleLocation = canonicalTitle?.split(" - ").find((segment) => segment.includes(","));

  return [locality, titleLocation, canonicalTitle]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(normalizeSearchToken);
}

export async function searchAirbnbCompetitorCandidates(
  target: ExtractedListing,
  maxResults = 5
): Promise<CompetitorCandidate[]> {

  const fallbackQuery =
    target.locationLabel || target.title || target.description?.slice(0, 80) || "";

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  try {
    const inferredQueries = new Set<string>();

    if (target.url) {
      await page.goto(target.url, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      const html = await page.content();
      for (const value of extractLocationHintsFromHtml(html)) {
        if (value) inferredQueries.add(value);
      }
    }

    if (fallbackQuery) {
      inferredQueries.add(normalizeSearchToken(fallbackQuery));
    }

    const queries = [...inferredQueries].filter(Boolean);
    if (queries.length === 0) {
      await browser.close();
      return [];
    }

    const targetRoomId = extractAirbnbRoomId(target.url);
    const collected = new Set<string>();

    for (const query of queries) {
      const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(query)}/homes`;

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      const links = await page.$$eval(
        'a[href*="/rooms/"]',
        (elements) =>
          elements.map((el) => {
            const href = el.getAttribute("href");
            return href ? `https://www.airbnb.com${href.split("?")[0]}` : null;
          })
      );

      for (const link of [...new Set(links)].filter(Boolean)) {
        const roomId = extractAirbnbRoomId(link as string);
        if (targetRoomId && roomId === targetRoomId) continue;
        collected.add(link as string);
        if (collected.size >= Math.max(maxResults * 4, 12)) break;
      }

      if (collected.size >= Math.max(maxResults * 4, 12)) break;
    }

    const unique = [...collected].slice(0, maxResults);

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

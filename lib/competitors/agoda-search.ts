import { chromium } from "playwright";
import type { CompetitorCandidate } from "./types";
import type { ExtractedListing } from "@/lib/extractors/types";

function normalizeAgodaUrl(url: string | null | undefined) {
  if (!url) return null;
  const absolute = url.startsWith("http") ? url : `https://www.agoda.com${url}`;
  return absolute.split("?")[0];
}

function isLikelyAgodaHotelUrl(url: string) {
  return /agoda\.com\/.+\/hotel\/[^/?#]+\.html/i.test(url);
}

function extractAgodaCitySlug(target: ExtractedListing) {
  const fromUrl = target.url?.match(/\/hotel\/([^/?#]+\.html)/i)?.[1];
  if (fromUrl) return fromUrl.replace(/\.html$/i, "");

  const location = (target.locationLabel ?? target.title ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return location || null;
}

function isTargetVariant(url: string, target: ExtractedListing) {
  const normalizedTarget = normalizeAgodaUrl(target.url);
  const normalizedCandidate = normalizeAgodaUrl(url);
  return Boolean(normalizedTarget && normalizedCandidate && normalizedTarget === normalizedCandidate);
}

export async function searchAgodaCompetitorCandidates(
  target: ExtractedListing,
  maxResults = 5
): Promise<CompetitorCandidate[]> {
  const citySlug = extractAgodaCitySlug(target);
  if (!citySlug) return [];

  const cityUrl = `https://www.agoda.com/fr-fr/city/${citySlug}.html`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(cityUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(6000);

    const links = await page.$$eval("a[href]", (elements) =>
      elements
        .map((el) => el.getAttribute("href"))
        .filter(Boolean)
        .map((href) => {
          if (!href) return null;
          if (href.startsWith("http")) return href.split("?")[0];
          return `https://www.agoda.com${href.split("?")[0]}`;
        })
    );

    const normalizedLinks = links
      .map(normalizeAgodaUrl)
      .filter((url): url is string => typeof url === "string" && url.length > 0);

    const unique = [...new Set(normalizedLinks)]
      .filter((url) => isLikelyAgodaHotelUrl(url))
      .filter((url) => !isTargetVariant(url, target))
      .slice(0, Math.max(maxResults * 4, 12));

    await browser.close();

    return unique.map((url) => ({
      url,
      platform: "agoda",
      title: null,
      price: null,
      latitude: null,
      longitude: null,
    }));
  } catch (error) {
    await browser.close();
    console.error("Agoda competitor search failed:", error);
    return [];
  }
}

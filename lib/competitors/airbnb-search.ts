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

function isVillaTypedSearchQuery(q: string): boolean {
  const n = normalizeSearchToken(q);
  if (!n) return false;
  const lower = n.toLowerCase();
  if (/\b(villa|villas|maison|house)\b/.test(lower)) return true;
  if (/\bprivate\b/.test(lower) && /\bvilla\b/.test(lower)) return true;
  return false;
}

function logAirbnbDiscoveryQuery(payload: {
  query: string;
  linksCount: number;
  collectedCount: number;
  sampleTitles: string[];
}): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][airbnb-discovery-query]", JSON.stringify(payload));
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

function buildOrderedAirbnbSearchQueries(input: {
  htmlHints: string[];
  locationLabel: string | null | undefined;
  title: string | null | undefined;
  fallbackQuery: string;
}): string[] {
  const explicitOrdered: string[] = [];
  const seenExplicit = new Set<string>();
  for (const raw of [input.locationLabel, input.title, input.fallbackQuery]) {
    const k = normalizeSearchToken(raw ?? "");
    if (!k || seenExplicit.has(k)) continue;
    seenExplicit.add(k);
    explicitOrdered.push(k);
  }

  const priorityExplicit = explicitOrdered.filter(isVillaTypedSearchQuery);
  const restExplicit = explicitOrdered.filter((q) => !isVillaTypedSearchQuery(q));

  const priorityHtml = input.htmlHints.filter((q) => isVillaTypedSearchQuery(q));
  const restHtml = input.htmlHints.filter((q) => !isVillaTypedSearchQuery(q));

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (list: string[]) => {
    for (const q of list) {
      if (!q || seen.has(q)) continue;
      seen.add(q);
      out.push(q);
    }
  };

  push(priorityExplicit);
  push(priorityHtml);
  push(restExplicit);
  push(restHtml);

  return out;
}

export async function searchAirbnbCompetitorCandidates(
  target: ExtractedListing,
  maxResults = 5
): Promise<CompetitorCandidate[]> {
  const fallbackQuery =
    target.locationLabel || target.title || target.description?.slice(0, 80) || "";

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  try {
    const htmlHints: string[] = [];

    if (target.url) {
      await page.goto(target.url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page.waitForTimeout(5000);

      const html = await page.content();
      for (const value of extractLocationHintsFromHtml(html)) {
        if (value) htmlHints.push(value);
      }
    }

    const queries = buildOrderedAirbnbSearchQueries({
      htmlHints,
      locationLabel: target.locationLabel,
      title: target.title,
      fallbackQuery,
    });

    if (queries.length === 0) {
      await browser.close();
      return [];
    }

    const targetRoomId = extractAirbnbRoomId(target.url);
    const collectedTitles = new Map<string, string | null>();
    const collectCap = Math.max(maxResults * 4, 12);

    const addCollected = (url: string, listingTitle: string | null) => {
      if (targetRoomId && extractAirbnbRoomId(url) === targetRoomId) return;
      const trimmedTitle =
        listingTitle && listingTitle.trim() ? listingTitle.trim().slice(0, 240) : null;
      if (!collectedTitles.has(url)) {
        collectedTitles.set(url, trimmedTitle);
        return;
      }
      const prev = collectedTitles.get(url);
      if (!prev && trimmedTitle) {
        collectedTitles.set(url, trimmedTitle);
      }
    };

    for (const query of queries) {
      const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(query)}/homes`;

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page.waitForTimeout(5000);

      const rows = await page.$$eval(
        'a[href*="/rooms/"]',
        (elements) => {
          const MAX_LEN = 240;
          const clean = (s: string | null | undefined) => {
            if (!s) return "";
            return s.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
          };
          const resolveNearbyParent = (linkEl: Element): Element | null => {
            const byItemprop = linkEl.closest("[itemprop]");
            if (byItemprop) return byItemprop;
            const byTestid = linkEl.closest("[data-testid]");
            if (byTestid) return byTestid;
            const byDiv = linkEl.closest("div");
            if (byDiv) return byDiv;
            let cur: Element | null = linkEl.parentElement;
            let last: Element | null = null;
            for (let i = 0; i < 4 && cur; i++) {
              last = cur;
              cur = cur.parentElement;
            }
            return last;
          };
          return elements.map((el) => {
            const href = el.getAttribute("href");
            const abs = href ? `https://www.airbnb.com${href.split("?")[0]}` : null;
            const aria = el.getAttribute("aria-label");
            const titleAttr = el.getAttribute("title");
            const linkText = (el.textContent || "").replace(/\s+/g, " ").trim();
            const parentEl = resolveNearbyParent(el);
            const parentText = parentEl
              ? (parentEl.textContent || "").replace(/\s+/g, " ").trim()
              : "";
            const candidates = [
              clean(aria),
              clean(titleAttr),
              clean(linkText),
              clean(parentText),
            ];
            const titleGuess = candidates.find((c) => c.length > 0) || null;
            return { href: abs, title: titleGuess };
          });
        }
      );

      const byHref = new Map<string, string | null>();
      for (const row of rows) {
        if (!row.href) continue;
        const t = row.title?.trim() || null;
        if (!byHref.has(row.href)) {
          byHref.set(row.href, t);
        } else if (!byHref.get(row.href) && t) {
          byHref.set(row.href, t);
        }
      }

      const linksCount = byHref.size;
      for (const [href, t] of byHref) {
        addCollected(href, t);
        if (collectedTitles.size >= collectCap) break;
      }

      const sampleTitles = [...byHref.values()]
        .filter((t): t is string => Boolean(t && t.trim()))
        .slice(0, 8);

      logAirbnbDiscoveryQuery({
        query,
        linksCount,
        collectedCount: collectedTitles.size,
        sampleTitles,
      });

      if (collectedTitles.size >= collectCap) break;
    }

    const uniqueUrls = [...collectedTitles.keys()].slice(0, maxResults);

    await browser.close();

    return uniqueUrls.map((url) => ({
      url,
      platform: "airbnb",
      title: collectedTitles.get(url) ?? null,
      price: null,
      latitude: null,
      longitude: null,
    }));
  } catch (error) {
    await browser.close();

    console.error("Airbnb competitor search failed:", error);

    return [];
  }
}

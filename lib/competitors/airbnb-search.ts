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

function airbnbStayNightsFromUrl(url: string | null | undefined): number | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const ci = u.searchParams.get("check_in")?.trim();
    const co = u.searchParams.get("check_out")?.trim();
    if (!ci || !co) return null;
    const d1 = Date.parse(ci.slice(0, 10));
    const d2 = Date.parse(co.slice(0, 10));
    if (!Number.isFinite(d1) || !Number.isFinite(d2)) return null;
    const nights = Math.round((d2 - d1) / 86_400_000);
    return nights > 0 ? nights : null;
  } catch {
    return null;
  }
}

function parseAirbnbSnippetPriceNumber(raw: string): number | null {
  let value = raw.replace(/[^\d.,\s]/g, "").replace(/\s+/g, "").trim();
  if (!value) return null;
  const hasComma = value.includes(",");
  const hasDot = value.includes(".");
  if (hasComma && hasDot) {
    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");
    value =
      lastComma > lastDot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (hasComma) {
    value = /^\d+,\d{1,2}$/.test(value) ? value.replace(",", ".") : value.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, "");
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseAirbnbSnippetCurrency(text: string): string | null {
  if (text.includes("€") || /\bEUR\b/i.test(text)) return "EUR";
  if (text.includes("$") || /\bUSD\b/i.test(text)) return "USD";
  if (text.includes("£") || /\bGBP\b/i.test(text)) return "GBP";
  if (/\bMAD\b|\bDH\b|د\.?\s?م\.?/i.test(text)) return "MAD";
  return null;
}

function parseAirbnbSearchSnippetPricing(
  text: string,
  targetStayNights: number | null
): Pick<CompetitorCandidate, "price" | "currency" | "rawStayPrice" | "stayNights" | "priceBasis"> & {
  source: "nightly" | "total" | null;
  rawTotalMatched: string | null;
} {
  const normalized = text
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/(\d)(€|\$|£)/g, "$1 $2")
    .replace(/\b(total|totale)(Show|Free)\b/gi, "$1 $2")
    .replace(/\b(per\s+night|par\s+nuit|night)(Show|Free)\b/gi, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const currency = parseAirbnbSnippetCurrency(normalized);
  const nightlyMatch =
    normalized.match(
      /(?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?)\s*([\d\s.,]+)\s*(?:\/\s*n(?:ight|uit)|per\s+night|par\s+nuit)\b/i
    ) ??
    normalized.match(
      /([\d\s.,]+)\s*(?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?)\s*(?:\/\s*n(?:ight|uit)|per\s+night|par\s+nuit)\b/i
    ) ??
    normalized.match(
      /(?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?)\s*([\d\s.,]+)\s*night\b/i
    ) ??
    normalized.match(
      /([\d\s.,]+)\s*(?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?)\s*night\b/i
    );
  if (nightlyMatch?.[1]) {
    const nightlyPrice = parseAirbnbSnippetPriceNumber(nightlyMatch[1]);
    if (nightlyPrice != null) {
      return {
        price: Math.round(nightlyPrice * 100) / 100,
        currency,
        rawStayPrice:
          targetStayNights != null && targetStayNights > 0
            ? Math.round(nightlyPrice * targetStayNights * 100) / 100
            : null,
        stayNights: targetStayNights,
        priceBasis: "nightly",
        source: "nightly",
        rawTotalMatched: null,
      };
    }
  }

  const totalMatch =
    normalized.match(
      /((?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?)\s*([\d][\d\s.,]{0,12}))\s*(?:au\s+total|total|totale)\b/i
    ) ??
    normalized.match(
      /(([\d][\d\s.,]{0,12})\s*(?:€|[$£]|\b(?:EUR|USD|GBP|MAD|DH)\b|د\.?\s?م\.?))\s*(?:au\s+total|total|totale)\b/i
    );
  if (totalMatch?.[1] && totalMatch?.[2]) {
    const rawTotalMatched = totalMatch[1].trim();
    const totalPrice = parseAirbnbSnippetPriceNumber(totalMatch[2]);
    if (totalPrice != null) {
      const nightlyPrice =
        targetStayNights != null && targetStayNights > 0
          ? Math.round((totalPrice / targetStayNights) * 100) / 100
          : null;
      return {
        price: nightlyPrice,
        currency,
        rawStayPrice: Math.round(totalPrice * 100) / 100,
        stayNights: targetStayNights,
        priceBasis: nightlyPrice != null ? "nightly" : undefined,
        source: "total",
        rawTotalMatched,
      };
    }
  }

  return {
    price: null,
    currency,
    rawStayPrice: null,
    stayNights: targetStayNights,
    priceBasis: undefined,
    source: null,
    rawTotalMatched: null,
  };
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

function logAirbnbBuiltQuery(payload: {
  query: string;
  source: "location" | "title_with_city" | "title" | "fallback";
  hasLocationContext: boolean;
}): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][airbnb-query-built]", JSON.stringify(payload));
}

function logAirbnbQueryGuard(payload: {
  originalQuery: string;
  guardedQuery: string;
  reason: "title_only_replaced_with_city" | "title_only_fallback_replaced_with_city";
  locationContext: string;
}): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log("[market][airbnb-query-guard]", JSON.stringify(payload));
}

function extractPrimaryLocationContext(locationLabel: string | null | undefined): string {
  const normalizedLocation = normalizeSearchToken(locationLabel ?? "");
  if (!normalizedLocation) return "";
  return normalizedLocation.split(",")[0]?.trim() || normalizedLocation;
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
  const locationQuery = normalizeSearchToken(input.locationLabel ?? "");
  const titleQuery = normalizeSearchToken(input.title ?? "");
  const fallbackQuery = normalizeSearchToken(input.fallbackQuery ?? "");
  const locationContext = extractPrimaryLocationContext(input.locationLabel);
  const hasLocationContext = Boolean(locationContext);

  const addExplicitQuery = (
    query: string,
    source: "location" | "title_with_city" | "title" | "fallback"
  ) => {
    if (!query || seenExplicit.has(query)) return;
    seenExplicit.add(query);
    explicitOrdered.push(query);
    logAirbnbBuiltQuery({
      query,
      source,
      hasLocationContext,
    });
  };

  addExplicitQuery(locationQuery, "location");

  let effectiveTitleQuery = titleQuery;
  if (titleQuery) {
    const titleContainsLocation =
      hasLocationContext && titleQuery.toLowerCase().includes(locationContext.toLowerCase());
    effectiveTitleQuery =
      hasLocationContext && !titleContainsLocation
        ? normalizeSearchToken(`${titleQuery} ${locationContext}`)
        : titleQuery;
    if (hasLocationContext && !titleContainsLocation && effectiveTitleQuery !== titleQuery) {
      logAirbnbQueryGuard({
        originalQuery: titleQuery,
        guardedQuery: effectiveTitleQuery,
        reason: "title_only_replaced_with_city",
        locationContext,
      });
    }
    addExplicitQuery(
      effectiveTitleQuery,
      hasLocationContext && !titleContainsLocation ? "title_with_city" : "title"
    );
  }

  let effectiveFallbackQuery = fallbackQuery;
  if (fallbackQuery && hasLocationContext) {
    const fallbackContainsLocation = fallbackQuery.toLowerCase().includes(locationContext.toLowerCase());
    if (!fallbackContainsLocation) {
      effectiveFallbackQuery = effectiveTitleQuery || normalizeSearchToken(`${fallbackQuery} ${locationContext}`);
      if (effectiveFallbackQuery && effectiveFallbackQuery !== fallbackQuery) {
        logAirbnbQueryGuard({
          originalQuery: fallbackQuery,
          guardedQuery: effectiveFallbackQuery,
          reason: "title_only_fallback_replaced_with_city",
          locationContext,
        });
      }
    }
  }

  addExplicitQuery(effectiveFallbackQuery, "fallback");

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
  const targetStayNights = airbnbStayNightsFromUrl(target.url ?? null);

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

    return uniqueUrls.map((url) => {
      const title = collectedTitles.get(url) ?? null;
      const pricing = parseAirbnbSearchSnippetPricing(title ?? "", targetStayNights);
      if (process.env.DEBUG_MARKET_PIPELINE === "true" && pricing.source) {
        console.log(
          "[market][airbnb-snippet-price-parse-result]",
          JSON.stringify({
            url,
            title,
            source: pricing.source,
            rawTotalMatched: pricing.rawTotalMatched,
            rawStayPrice: pricing.rawStayPrice,
            stayNights: pricing.stayNights ?? null,
            nightlyPrice: pricing.price,
            currency: pricing.currency ?? null,
            priceBasis: pricing.priceBasis ?? null,
          })
        );
      }
      return {
        url,
        platform: "airbnb",
        title,
        price: pricing.price,
        currency: pricing.currency,
        rawStayPrice: pricing.rawStayPrice,
        stayNights: pricing.stayNights,
        priceBasis: pricing.priceBasis,
        latitude: null,
        longitude: null,
      };
    });
  } catch (error) {
    await browser.close();

    console.error("Airbnb competitor search failed:", error);

    return [];
  }
}

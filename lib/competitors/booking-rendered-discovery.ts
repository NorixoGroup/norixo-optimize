/**
 * Fallback discovery : SERP Booking rendue (Playwright persistent context).
 * Hors pipeline principale sauf si appelé explicitement depuis booking-search.
 */
import { chromium } from "playwright";
import type { ExtractedListing } from "@/lib/extractors/types";

const DEBUG_MARKET_PIPELINE = process.env.DEBUG_MARKET_PIPELINE === "true";
const BOOKING_RENDERED_PROFILE = "/tmp/lco-booking-profile";

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s,-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveTargetCityCountryForLog(target: ExtractedListing): {
  resolvedCity: string | null;
  resolvedCountry: string | null;
} {
  const raw = normalizeToken(target.locationLabel ?? "");
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      resolvedCity: parts.slice(0, -1).join(", ").trim() || null,
      resolvedCountry: parts[parts.length - 1] ?? null,
    };
  }
  if (parts.length === 1) {
    return { resolvedCity: parts[0] ?? null, resolvedCountry: null };
  }
  const t = normalizeToken(target.title ?? "");
  const tp = t.split(",").map((p) => p.trim()).filter(Boolean);
  if (tp.length >= 2) {
    return {
      resolvedCity: tp.slice(0, -1).join(", ").trim() || null,
      resolvedCountry: tp[tp.length - 1] ?? null,
    };
  }
  if (tp.length === 1) {
    return { resolvedCity: tp[0] ?? null, resolvedCountry: null };
  }
  return { resolvedCity: null, resolvedCountry: null };
}

function emitRenderedDiscovery(payload: Record<string, unknown>) {
  console.log("[market][booking-rendered-discovery]", JSON.stringify(payload));
}

function buildRenderedSerpSearchUrl(target: ExtractedListing): string | null {
  const rawLocation = normalizeToken(target.locationLabel ?? "");
  const parts = rawLocation.split(",").map((p) => p.trim()).filter(Boolean);
  let city: string;
  let countryTail: string;
  if (parts.length >= 2) {
    countryTail = parts[parts.length - 1] ?? "";
    city = parts.slice(0, -1).join(", ").trim();
  } else if (parts.length === 1) {
    city = parts[0] ?? "";
    countryTail = "";
  } else {
    const rawTitle = normalizeToken(target.title ?? "");
    const tp = rawTitle.split(",").map((p) => p.trim()).filter(Boolean);
    if (tp.length >= 2) {
      countryTail = tp[tp.length - 1] ?? "";
      city = tp.slice(0, -1).join(", ").trim();
    } else if (tp.length === 1) {
      city = tp[0] ?? "";
      countryTail = "";
    } else {
      return null;
    }
  }
  if (!city) return null;

  const checkin = new Date();
  checkin.setDate(checkin.getDate() + 14);
  const checkout = new Date(checkin);
  checkout.setDate(checkout.getDate() + 3);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const ss = countryTail ? `${city}, ${countryTail}` : city;
  const params = new URLSearchParams({
    ss,
    ssne: city,
    ssne_untouched: city,
    checkin: fmt(checkin),
    checkout: fmt(checkout),
    group_adults: "2",
    no_rooms: "1",
    group_children: "0",
    selected_currency: "EUR",
    lang: "fr",
  });
  return `https://www.booking.com/searchresults.fr.html?${params.toString()}`;
}

function normalizeHotelMaHref(href: string): string | null {
  if (!href || !href.includes("/hotel/ma/")) return null;
  if (/\/hotel\/index/i.test(href)) return null;
  if (href.startsWith("http")) return href.split("?")[0] ?? null;
  return `https://www.booking.com${href.split("?")[0]}`;
}

export async function discoverBookingCandidatesWithRenderedSerp(input: {
  target: ExtractedListing;
  maxUrls?: number;
  abortSignal?: AbortSignal | null;
}): Promise<string[]> {
  const max = Math.min(20, Math.max(1, input.maxUrls ?? 20));
  const { resolvedCity, resolvedCountry } = resolveTargetCityCountryForLog(input.target);

  emitRenderedDiscovery({
    enabled: true,
    phase: "start",
    targetTitle: input.target.title ?? null,
    targetLocationLabel: input.target.locationLabel ?? null,
    resolvedCity,
    resolvedCountry,
  });

  if (input.abortSignal?.aborted) {
    emitRenderedDiscovery({
      enabled: true,
      phase: "done",
      returnedCount: 0,
      uniqueLinksCount: 0,
      finalUrl: null,
      reason: "aborted_before_playwright",
    });
    return [];
  }

  const targetUrl = buildRenderedSerpSearchUrl(input.target);
  if (!targetUrl) {
    emitRenderedDiscovery({
      enabled: true,
      phase: "done",
      returnedCount: 0,
      uniqueLinksCount: 0,
      finalUrl: null,
      reason: "no_geo_for_serp_url",
    });
    return [];
  }

  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null = null;
  let finalUrlForDone: string | null = null;
  try {
    context = await chromium.launchPersistentContext(BOOKING_RENDERED_PROFILE, {
      headless: true,
      viewport: { width: 1365, height: 900 },
      locale: "fr-FR",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });
    const page = context.pages()[0] ?? (await context.newPage());

    if (input.abortSignal?.aborted) {
      emitRenderedDiscovery({
        enabled: true,
        phase: "done",
        returnedCount: 0,
        uniqueLinksCount: 0,
        finalUrl: null,
        reason: "aborted_after_context",
      });
      return [];
    }

    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    let finalUrl = page.url();
    finalUrlForDone = finalUrl;

    try {
      const acceptBtn = page
        .locator('button:has-text("Accepter"), button:has-text("Accept")')
        .first();
      if (await acceptBtn.isVisible({ timeout: 3000 })) {
        await acceptBtn.click();
        await page.waitForTimeout(800).catch(() => null);
        finalUrl = page.url();
        finalUrlForDone = finalUrl;
      }
    } catch {
      /* pas de bannière */
    }

    if (input.abortSignal?.aborted) {
      emitRenderedDiscovery({
        enabled: true,
        phase: "done",
        returnedCount: 0,
        uniqueLinksCount: 0,
        finalUrl,
        reason: "aborted_after_goto",
      });
      return [];
    }

    try {
      await page.waitForSelector('a[href*="/hotel/ma/"]', { timeout: 25_000 });
    } catch {
      /* on tente quand même l’extraction */
    }

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const hotelHrefs = (await page
      .$$eval('a[href*="/hotel/ma/"]', (els) =>
        els.map((e) => e.getAttribute("href")).filter(Boolean)
      )
      .catch(() => [])) as string[];

    const normalized = hotelHrefs
      .map((h) => normalizeHotelMaHref(h))
      .filter((u): u is string => Boolean(u));
    const unique = [...new Set(normalized)];
    const out = unique.slice(0, max);

    const cityNeedle = normalizeToken(
      (input.target.locationLabel ?? "").split(",")[0] ||
        (input.target.title ?? "").split(",")[0] ||
        ""
    );
    const containsTargetCity =
      cityNeedle.length >= 3 && bodyText.toLowerCase().includes(cityNeedle.toLowerCase());

    emitRenderedDiscovery({
      enabled: true,
      phase: "done",
      returnedCount: out.length,
      uniqueLinksCount: unique.length,
      finalUrl,
      hotelLinksCount: hotelHrefs.length,
      reason: out.length > 0 ? "success" : "no_hotel_links_extracted",
      containsTargetCity,
      ...(DEBUG_MARKET_PIPELINE
        ? {
            containsBlueMirage: /blue mirage/i.test(bodyText),
            containsWishIsBouzid: /wish is bouzid/i.test(bodyText),
            containsDarSofiane: /dar sofiane/i.test(bodyText),
          }
        : {}),
    });

    return out;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[booking][rendered-discovery] failed", message);
    emitRenderedDiscovery({
      enabled: true,
      phase: "error",
      message,
      finalUrl: finalUrlForDone,
    });
    return [];
  } finally {
    await context?.close().catch(() => null);
  }
}

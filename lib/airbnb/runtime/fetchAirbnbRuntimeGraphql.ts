import { chromium } from "playwright";
import { parseAirbnbCurrency } from "./parseAirbnbCurrency";

export type AirbnbRuntimePriceResult = {
  targetUrl: string;
  source: "airbnb_runtime_graphql";
  totalPrice: number | null;
  nightlyPrice: number | null;
  originalTotalPrice: number | null;
  cleaningFee: number | null;
  serviceFee: number | null;
  taxes: number | null;
  currency: string | null;
  stayNights: number | null;
  rawMatches: string[];
  confidence: "high" | "medium" | "low" | "none";
  cacheStatus?: "hit" | "miss";
};

const AIRBNB_RUNTIME_CACHE_TTL_MS = 15 * 60 * 1000;

const airbnbRuntimePriceCache = new Map<
  string,
  { expiresAt: number; value: AirbnbRuntimePriceResult }
>();


type AirbnbPriceBreakdown = {
  originalTotalPrice: number | null;
  nightlySubtotal: number | null;
  cleaningFee: number | null;
  serviceFee: number | null;
  taxes: number | null;
};

function collectPriceBreakdownFromPayload(payload: unknown): AirbnbPriceBreakdown {
  const result: AirbnbPriceBreakdown = {
    originalTotalPrice: null,
    nightlySubtotal: null,
    cleaningFee: null,
    serviceFee: null,
    taxes: null,
  };

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }

    const record = value as Record<string, unknown>;
    const description =
      typeof record.description === "string" ? record.description.toLowerCase() : "";
    const priceString =
      typeof record.priceString === "string" ? record.priceString : null;
    const originalPriceString =
      typeof record.originalPriceString === "string" ? record.originalPriceString : null;

    if (originalPriceString && result.originalTotalPrice == null) {
      result.originalTotalPrice = parseAirbnbCurrency(originalPriceString);
    }

    if (priceString) {
      const amount = parseAirbnbCurrency(priceString);

      if (amount != null) {
        if (/nuits?|nights?/.test(description) && result.nightlySubtotal == null) {
          result.nightlySubtotal = amount;
        }

        if (/ménage|cleaning/.test(description) && result.cleaningFee == null) {
          result.cleaningFee = amount;
        }

        if (/service|plateforme|airbnb/.test(description) && result.serviceFee == null) {
          result.serviceFee = amount;
        }

        if (/tax|taxe|taxes/.test(description) && result.taxes == null) {
          result.taxes = amount;
        }
      }
    }

    for (const entry of Object.values(record)) visit(entry);
  };

  visit(payload);

  return result;
}

function extractNightCount(url: string): number | null {
  try {
    const u = new URL(url);

    const checkIn = u.searchParams.get("check_in");
    const checkOut = u.searchParams.get("check_out");

    if (!checkIn || !checkOut) return null;

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    const diff = end.getTime() - start.getTime();

    return Math.round(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export async function fetchAirbnbRuntimeGraphql(
  targetUrl: string
): Promise<AirbnbRuntimePriceResult> {
  const cacheKey = targetUrl;
  const cached = airbnbRuntimePriceCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      cacheStatus: "hit",
    };
  }

  const nights = extractNightCount(targetUrl);

  const ws = `wss://${process.env.BRIGHTDATA_BROWSER_USERNAME}:${process.env.BRIGHTDATA_BROWSER_PASSWORD}@${process.env.BRIGHTDATA_BROWSER_HOST}:${process.env.BRIGHTDATA_BROWSER_PORT}`;

  const browser = await chromium.connectOverCDP(ws);

  const page = await browser.newPage({
    locale: "fr-FR",
  });

  const rawMatches = new Set<string>();
  const pricingPayloads: string[] = [];

  page.on("response", async (res) => {
    try {
      const url = res.url();

      if (!url.includes("/api/v3/")) return;

      const txt = await res.text();

      if (/cleaning|service|fee|total|price|nightly|rate|tax/i.test(txt)) {
        pricingPayloads.push(txt);
      }

      const matches = txt.match(/[0-9]{1,3}(?:[\s\u00A0][0-9]{3})?\s?€/g);

      if (matches?.length) {
        for (const m of matches) {
          rawMatches.add(m);
        }
      }
    } catch {}
  });

  try {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    await page.waitForTimeout(12000);
  } finally {
    await browser.close().catch(() => {});
  }


  const breakdown = collectPriceBreakdownFromPayload(
    pricingPayloads.map((p) => {
      try {
        return JSON.parse(p);
      } catch {
        return null;
      }
    })
  );

  const parsed = [...rawMatches]
    .map((v) => ({
      raw: v,
      value: parseAirbnbCurrency(v),
    }))
    .filter((v) => v.value && v.value > 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  const totalPrice =
    parsed.find((v) => v.value && v.value >= 100 && v.value < 1500)?.value || null;

  const nightlyPrice =
    totalPrice && nights && nights > 0
      ? Number((totalPrice / nights).toFixed(2))
      : null;

  const confidence: AirbnbRuntimePriceResult["confidence"] =
    totalPrice && nightlyPrice && nights && nights > 0
      ? "high"
      : totalPrice
        ? "medium"
        : "none";

  const result: AirbnbRuntimePriceResult = {
    targetUrl,
    source: "airbnb_runtime_graphql",
    totalPrice,
    nightlyPrice,
    originalTotalPrice: breakdown.originalTotalPrice,
    cleaningFee: breakdown.cleaningFee,
    serviceFee: breakdown.serviceFee,
    taxes: breakdown.taxes,
    currency: totalPrice ? "EUR" : null,
    stayNights: nights,
    rawMatches: [...rawMatches],
    confidence,
    cacheStatus: "miss",
  };

  airbnbRuntimePriceCache.set(cacheKey, {
    expiresAt: Date.now() + AIRBNB_RUNTIME_CACHE_TTL_MS,
    value: result,
  });

  return result;
}

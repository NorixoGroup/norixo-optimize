import { chromium } from "playwright";
import { parseAirbnbCurrency } from "./parseAirbnbCurrency";

export type AirbnbRuntimePriceResult = {
  targetUrl: string;
  source: "airbnb_runtime_graphql";
  totalPrice: number | null;
  nightlyPrice: number | null;
  currency: string | null;
  stayNights: number | null;
  rawMatches: string[];
};

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
  const nights = extractNightCount(targetUrl);

  const ws = `wss://${process.env.BRIGHTDATA_BROWSER_USERNAME}:${process.env.BRIGHTDATA_BROWSER_PASSWORD}@${process.env.BRIGHTDATA_BROWSER_HOST}:${process.env.BRIGHTDATA_BROWSER_PORT}`;

  const browser = await chromium.connectOverCDP(ws);

  const page = await browser.newPage({
    locale: "fr-FR",
  });

  const rawMatches = new Set<string>();

  page.on("response", async (res) => {
    try {
      const url = res.url();

      if (!url.includes("/api/v3/")) return;

      const txt = await res.text();

      const matches = txt.match(/[0-9]{1,3}(?:[\s\u00A0][0-9]{3})?\s?€/g);

      if (matches?.length) {
        for (const m of matches) {
          rawMatches.add(m);
        }
      }
    } catch {}
  });

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  await page.waitForTimeout(12000);

  await browser.close();

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

  return {
    targetUrl,
    source: "airbnb_runtime_graphql",
    totalPrice,
    nightlyPrice,
    currency: totalPrice ? "EUR" : null,
    stayNights: nights,
    rawMatches: [...rawMatches],
  };
}

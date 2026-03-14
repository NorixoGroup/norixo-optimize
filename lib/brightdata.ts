import { chromium } from "playwright-core";

function getBrowserWsEndpoint(): string {
  const host = process.env.BRIGHTDATA_HOST;
  const username = process.env.BRIGHTDATA_USERNAME;
  const password = process.env.BRIGHTDATA_PASSWORD;

  if (!host || !username || !password) {
    throw new Error(
      "Missing Bright Data env vars: BRIGHTDATA_HOST / BRIGHTDATA_USERNAME / BRIGHTDATA_PASSWORD"
    );
  }

  return `wss://${username}:${password}@${host}:9222`;
}

export async function fetchUnlockedHtml(url: string): Promise<string> {
  const wsEndpoint = getBrowserWsEndpoint();
  const browser = await chromium.connectOverCDP(wsEndpoint);

  try {
    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    await page.waitForTimeout(5000);

    const html = await page.content();
    await page.close();

    return html;
  } finally {
    await browser.close();
  }
}
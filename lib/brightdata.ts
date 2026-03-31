import { chromium, type Page } from "playwright-core";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

function debugGuestAuditLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

async function safeWait(page: Page, ms: number) {
  if (page.isClosed()) return;
  await page.waitForTimeout(ms).catch(() => {});
}

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

export type CapturedNetworkPayload = {
  url: string;
  contentType: string | null;
  bodyText: string;
};

export type UnlockedPageData = {
  html: string;
  payloads: CapturedNetworkPayload[];
  data?: Record<string, unknown>;
};

async function getPageHtml(page: Page): Promise<string> {
  try {
    debugGuestAuditLog("[guest-audit][brightdata] first content attempt");
    return await page.content();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugGuestAuditLog("[guest-audit][brightdata] first content failed", {
      message,
    });

    if (!message.includes("page is navigating")) {
      throw error;
    }
  }

  await safeWait(page, 2500);

  try {
    debugGuestAuditLog("[guest-audit][brightdata] retrying content after wait");
    const html = await page.content();
    debugGuestAuditLog("[guest-audit][brightdata] second content success");
    return html;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugGuestAuditLog("[guest-audit][brightdata] second content failed", {
      message,
    });
  }

  try {
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    debugGuestAuditLog("[guest-audit][brightdata] outerHTML fallback success");
    return html;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugGuestAuditLog("[guest-audit][brightdata] outerHTML fallback failed", {
      message,
    });
    throw error;
  }
}

export async function fetchUnlockedHtml(url: string): Promise<string> {
  const wsEndpoint = getBrowserWsEndpoint();
  const browser = await chromium.connectOverCDP(wsEndpoint);
  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;

  try {
    page = await browser.newPage();

    debugGuestAuditLog("[guest-audit][brightdata] goto start", { url });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    debugGuestAuditLog("[guest-audit][brightdata] goto done");

    await page.waitForLoadState?.("domcontentloaded").catch(() => {});
    await safeWait(page, 2000);
    return await getPageHtml(page);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    await browser.close();
  }
}

export async function fetchUnlockedPageData(
  url: string,
  options?: {
    payloadUrlPattern?: RegExp;
    maxPayloads?: number;
    afterLoad?: (page: Page) => Promise<Record<string, unknown> | void>;
  }
): Promise<UnlockedPageData> {
  const wsEndpoint = getBrowserWsEndpoint();
  const browser = await chromium.connectOverCDP(wsEndpoint);
  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;
  const payloads: CapturedNetworkPayload[] = [];
  const payloadUrlPattern =
    options?.payloadUrlPattern ??
    /(property|hotel|listing|review|facility|amenity|photo|gallery|location)/i;
  const maxPayloads = options?.maxPayloads ?? 40;
  let extraData: Record<string, unknown> | undefined;

  try {
    page = await browser.newPage();

    page.on("response", async (response) => {
      if (payloads.length >= maxPayloads) return;

      const responseUrl = response.url();
      if (!payloadUrlPattern.test(responseUrl)) return;

      const contentType = response.headers()["content-type"] ?? null;
      const isJsonLike =
        (contentType != null && /json|javascript|text\/plain/i.test(contentType)) ||
        /\.(json)(?:[?#]|$)/i.test(responseUrl);
      if (!isJsonLike) return;

      try {
        const bodyText = await response.text();
        const trimmed = bodyText.trim();
        if (!trimmed || trimmed.length < 2) return;
        if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return;

        payloads.push({
          url: responseUrl,
          contentType,
          bodyText: trimmed,
        });
      } catch {
        // ignore unreadable payloads
      }
    });

    debugGuestAuditLog("[guest-audit][brightdata] goto start", { url });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    debugGuestAuditLog("[guest-audit][brightdata] goto done");

    await page.waitForLoadState?.("domcontentloaded").catch(() => {});
    await safeWait(page, 3500);

    if (options?.afterLoad) {
      try {
        const result = await options.afterLoad(page);
        if (result && typeof result === "object") {
          extraData = result;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        debugGuestAuditLog("[guest-audit][brightdata] afterLoad failed", {
          message,
        });
      }
    }

    const html = await getPageHtml(page);

    return {
      html,
      payloads,
      data: extraData,
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    await browser.close();
  }
}

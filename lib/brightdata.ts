import net from "node:net";
import tls from "node:tls";
import { chromium, type Browser, type Page, type Response } from "playwright-core";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

function debugGuestAuditLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

async function safeWait(page: Page, ms: number) {
  if (page.isClosed()) return;
  await page.waitForTimeout(ms).catch(() => {});
}

type BrightDataTransport = "cdp" | "proxy";
type BrightDataTransportPreference = BrightDataTransport | "auto";

type BrightDataConfig = {
  host: string;
  port: string;
  username: string;
  password: string;
  transport: BrightDataTransport;
};

type BrightDataRequestOptions = {
  platform?: string;
  preferredTransport?: BrightDataTransportPreference;
};

function getScraperMode(): "brightdata" | "fallback" {
  const explicitMode = (process.env.SCRAPER_MODE ?? "").trim().toLowerCase();
  if (["fallback", "direct", "local"].includes(explicitMode)) return "fallback";
  if (["brightdata", "bright_data", "proxy", "browser"].includes(explicitMode)) {
    return "brightdata";
  }

  const useBrightData = (process.env.USE_BRIGHTDATA ?? "").trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(useBrightData)) return "fallback";

  return "brightdata";
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeTransportPreference(
  value: string | null | undefined
): BrightDataTransportPreference | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "proxy" || normalized === "http") return "proxy";
  if (normalized === "cdp" || normalized === "browser") return "cdp";
  if (normalized === "auto") return "auto";
  return null;
}

function getRequestedTransport(
  options: BrightDataRequestOptions | undefined,
  defaultTransport: BrightDataTransportPreference
): BrightDataTransportPreference {
  const platformKey = options?.platform
    ? `${options.platform.toUpperCase()}_SCRAPER_TRANSPORT`
    : null;
  const platformTransport = platformKey
    ? normalizeTransportPreference(process.env[platformKey])
    : null;

  return (
    platformTransport ??
    normalizeTransportPreference(process.env.SCRAPER_TRANSPORT) ??
    options?.preferredTransport ??
    defaultTransport
  );
}

function getBrightDataProxyConfig(): BrightDataConfig | null {
  const host = readEnv("BRIGHTDATA_PROXY_HOST") ?? readEnv("BRIGHTDATA_HOST");
  const legacyPort = readEnv("BRIGHTDATA_PORT");
  const port =
    readEnv("BRIGHTDATA_PROXY_PORT") ??
    (legacyPort && legacyPort !== "9222" ? legacyPort : null);
  const username = readEnv("BRIGHTDATA_PROXY_USERNAME") ?? readEnv("BRIGHTDATA_USERNAME");
  const password = readEnv("BRIGHTDATA_PROXY_PASSWORD") ?? readEnv("BRIGHTDATA_PASSWORD");

  if (!host || !port || !username || !password) return null;

  return {
    host,
    port,
    username,
    password,
    transport: "proxy",
  };
}

function getBrightDataCdpConfig(): BrightDataConfig | null {
  const browserHost = readEnv("BRIGHTDATA_BROWSER_HOST");
  const browserUsername = readEnv("BRIGHTDATA_BROWSER_USERNAME");
  const browserPassword = readEnv("BRIGHTDATA_BROWSER_PASSWORD");

  if (browserHost && browserUsername && browserPassword) {
    return {
      host: browserHost,
      port: readEnv("BRIGHTDATA_BROWSER_PORT") ?? "9222",
      username: browserUsername,
      password: browserPassword,
      transport: "cdp",
    };
  }

  const host = readEnv("BRIGHTDATA_HOST");
  const port = readEnv("BRIGHTDATA_PORT");
  const username = readEnv("BRIGHTDATA_USERNAME");
  const password = readEnv("BRIGHTDATA_PASSWORD");

  if (!host || port !== "9222" || !username || !password) return null;

  return {
    host,
    port,
    username,
    password,
    transport: "cdp",
  };
}

function getBrightDataConfigAttempts(
  options: BrightDataRequestOptions | undefined,
  defaultTransport: BrightDataTransportPreference
): {
  requestedTransport: BrightDataTransportPreference;
  configs: BrightDataConfig[];
} {
  const requestedTransport = getRequestedTransport(options, defaultTransport);
  const proxyConfig = getBrightDataProxyConfig();
  const cdpConfig = getBrightDataCdpConfig();

  const configs =
    requestedTransport === "cdp"
      ? [cdpConfig, proxyConfig]
      : requestedTransport === "proxy"
        ? [proxyConfig, cdpConfig]
        : [proxyConfig, cdpConfig];

  return {
    requestedTransport,
    configs: configs.filter((config): config is BrightDataConfig => Boolean(config)),
  };
}

function buildHostWithPort(host: string, port: string) {
  return host.includes(":") ? host : `${host}:${port}`;
}

async function openBrightDataBrowser(config: BrightDataConfig): Promise<{
  browser: Browser;
  transport: BrightDataTransport;
}> {
  const hostWithPort = buildHostWithPort(config.host, config.port);

  const wsEndpoint = `wss://${encodeURIComponent(config.username)}:${encodeURIComponent(
    config.password
  )}@${hostWithPort}`;
  return {
    browser: await chromium.connectOverCDP(wsEndpoint),
    transport: "cdp",
  };
}

async function readSocketUntil(socket: net.Socket, marker: string): Promise<{
  head: string;
  rest: Buffer;
}> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      const index = buffer.indexOf(marker);
      if (index === -1) return;

      socket.off("data", onData);
      socket.off("error", reject);
      resolve({
        head: buffer.slice(0, index).toString("utf8"),
        rest: buffer.slice(index + marker.length),
      });
    };

    socket.on("data", onData);
    socket.once("error", reject);
  });
}

async function collectSocket(socket: net.Socket, initial: Buffer): Promise<Buffer> {
  const chunks = initial.length > 0 ? [initial] : [];

  return new Promise((resolve, reject) => {
    socket.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.once("end", () => resolve(Buffer.concat(chunks)));
    socket.once("error", reject);
  });
}

function parseHttpStatus(head: string) {
  return Number.parseInt(head.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/i)?.[1] ?? "", 10);
}

function decodeHttpBody(head: string, body: Buffer) {
  if (/transfer-encoding:\s*chunked/i.test(head)) {
    const raw = body.toString("utf8");
    let cursor = 0;
    let decoded = "";

    while (cursor < raw.length) {
      const nextLine = raw.indexOf("\r\n", cursor);
      if (nextLine === -1) break;
      const size = Number.parseInt(raw.slice(cursor, nextLine).split(";", 1)[0], 16);
      if (!Number.isFinite(size) || size <= 0) break;
      const start = nextLine + 2;
      decoded += raw.slice(start, start + size);
      cursor = start + size + 2;
    }

    return decoded || raw;
  }

  return body.toString("utf8");
}

async function fetchBrightDataProxyHtml(
  url: string,
  config: BrightDataConfig,
  redirectCount = 0
): Promise<string> {
  if (redirectCount > 3) {
    throw new Error("BrightData proxy redirect limit exceeded");
  }

  const target = new URL(url);
  if (target.protocol !== "https:") {
    return fetchFallbackHtml(url, "brightdata_proxy_requires_https_target");
  }

  const hostWithPort = buildHostWithPort(config.host, config.port);
  const [proxyHost, proxyPort] = hostWithPort.split(":");
  const proxySocket = net.connect(Number(proxyPort), proxyHost);
  const proxyAuth = Buffer.from(`${config.username}:${config.password}`).toString("base64");

  proxySocket.write(
    [
      `CONNECT ${target.hostname}:443 HTTP/1.1`,
      `Host: ${target.hostname}:443`,
      `Proxy-Authorization: Basic ${proxyAuth}`,
      "Proxy-Connection: close",
      "",
      "",
    ].join("\r\n")
  );

  const connectResponse = await readSocketUntil(proxySocket, "\r\n\r\n");
  const connectStatus = parseHttpStatus(connectResponse.head);
  if (connectStatus !== 200) {
    proxySocket.destroy();
    throw new Error(`BrightData proxy CONNECT failed with status ${connectStatus}`);
  }

  const secureSocket = tls.connect({
    socket: proxySocket,
    servername: target.hostname,
    rejectUnauthorized: false,
  });

  await new Promise<void>((resolve, reject) => {
    secureSocket.once("secureConnect", resolve);
    secureSocket.once("error", reject);
  });

  secureSocket.write(
    [
      `GET ${target.pathname}${target.search} HTTP/1.1`,
      `Host: ${target.host}`,
      "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language: fr-FR,fr;q=0.9,en;q=0.8",
      "Accept-Encoding: identity",
      "Connection: close",
      "",
      "",
    ].join("\r\n")
  );

  const responseHead = await readSocketUntil(secureSocket, "\r\n\r\n");
  const responseStatus = parseHttpStatus(responseHead.head);
  const body = await collectSocket(secureSocket, responseHead.rest);

  if ([301, 302, 303, 307, 308].includes(responseStatus)) {
    const location = responseHead.head.match(/\nlocation:\s*([^\r\n]+)/i)?.[1]?.trim();
    if (location) {
      return fetchBrightDataProxyHtml(new URL(location, target).toString(), config, redirectCount + 1);
    }
  }

  if (responseStatus < 200 || responseStatus >= 400) {
    throw new Error(`BrightData proxy target returned status ${responseStatus}`);
  }

  return decodeHttpBody(responseHead.head, body);
}

async function fetchFallbackHtml(url: string, reason: string): Promise<string> {
  console.info("[extractor] using fallback", { url, reason });

  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Fallback fetch failed with status ${response.status}`);
  }

  return response.text();
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

async function fetchBrightDataCdpHtml(url: string, config: BrightDataConfig): Promise<string> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    const opened = await openBrightDataBrowser(config);
    browser = opened.browser;

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
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export async function fetchUnlockedHtml(
  url: string,
  options?: BrightDataRequestOptions
): Promise<string> {
  if (getScraperMode() === "fallback") {
    return fetchFallbackHtml(url, "scraper_mode_fallback");
  }

  const { requestedTransport, configs } = getBrightDataConfigAttempts(options, "proxy");
  let lastError: string | null = null;

  for (const config of configs) {
    console.info("[extractor] using brightdata", {
      url,
      platform: options?.platform ?? null,
      requestedTransport,
      transport: config.transport,
      port: config.port,
    });

    try {
      return config.transport === "proxy"
        ? await fetchBrightDataProxyHtml(url, config)
        : await fetchBrightDataCdpHtml(url, config);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.info("[extractor] brightdata transport failed", {
        url,
        platform: options?.platform ?? null,
        transport: config.transport,
        reason: lastError,
      });
    }
  }

  return fetchFallbackHtml(
    url,
    lastError ? `brightdata_failed:${lastError}` : "brightdata_config_missing"
  );
}

async function fetchBrightDataCdpPageData(
  url: string,
  config: BrightDataConfig,
  options?: {
    payloadUrlPattern?: RegExp;
    maxPayloads?: number;
    afterLoad?: (page: Page) => Promise<Record<string, unknown> | void>;
  }
): Promise<UnlockedPageData> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  const payloads: CapturedNetworkPayload[] = [];
  const payloadUrlPattern =
    options?.payloadUrlPattern ??
    /(property|hotel|listing|review|facility|amenity|photo|gallery|location)/i;
  const maxPayloads = options?.maxPayloads ?? 40;
  let extraData: Record<string, unknown> | undefined;

  try {
    const opened = await openBrightDataBrowser(config);
    browser = opened.browser;

    page = await browser.newPage();

    page.on("response", async (response: Response) => {
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
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export async function fetchUnlockedPageData(
  url: string,
  options?: {
    payloadUrlPattern?: RegExp;
    maxPayloads?: number;
    afterLoad?: (page: Page) => Promise<Record<string, unknown> | void>;
  } & BrightDataRequestOptions
): Promise<UnlockedPageData> {
  if (getScraperMode() === "fallback") {
    return {
      html: await fetchFallbackHtml(url, "scraper_mode_fallback"),
      payloads: [],
    };
  }

  const { requestedTransport, configs } = getBrightDataConfigAttempts(options, "proxy");
  let lastError: string | null = null;

  for (const [attemptIndex, config] of configs.entries()) {
    console.info("[extractor] using brightdata", {
      attempt: attemptIndex + 1,
      attemptsMax: configs.length,
      url,
      platform: options?.platform ?? null,
      requestedTransport,
      transport: config.transport,
      port: config.port,
    });

    try {
      return config.transport === "proxy"
        ? {
            html: await fetchBrightDataProxyHtml(url, config),
            payloads: [],
          }
        : await fetchBrightDataCdpPageData(url, config, options);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.info("[extractor] brightdata transport failed", {
        url,
        platform: options?.platform ?? null,
        transport: config.transport,
        attempt: attemptIndex + 1,
        reason: lastError,
      });
    }
  }

  return {
    html: await fetchFallbackHtml(
      url,
      lastError ? `brightdata_failed:${lastError}` : "brightdata_config_missing"
    ),
    payloads: [],
  };
}

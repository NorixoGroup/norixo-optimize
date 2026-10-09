import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createSocket } from "node:dgram";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer as createSecureServer } from "node:https";
import { tmpdir } from "node:os";
import { createConnection, type AddressInfo, type Socket } from "node:net";
import { execFileSync } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { startContactFormPinnedBrowserProxy } from "../lib/backlinks/services/contactFormPinnedBrowserProxy";

const LOCAL_CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const NAVIGATION_TIMEOUT_MS = 500;
const SCENARIO_WAIT_MS = 150;

type Outcome = "PASS" | "FAIL" | "BLOCKED" | "UNPROVEN";
type Scenario = {
  id: string;
  action: string;
  observed: string;
  requests: Record<string, number>;
  result: Outcome;
  detail?: string;
};

type Fixture = {
  baseUrl: string;
  redirectUrl: string;
  websocketUrl: string;
  icePort: number;
  requestCounts: Map<string, number>;
  websocketConnections: () => number;
  udpPackets: () => number;
  close: () => Promise<void>;
};

type SecureFixture = {
  baseUrl: string;
  forbiddenUrl: string;
  requestCounts: Map<string, number>;
  close: () => Promise<void>;
};

function countRequest(counts: Map<string, number>, request: IncomingMessage): void {
  const key = `${request.method ?? "UNKNOWN"} ${request.url ?? "/"}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function snapshotCounts(counts: Map<string, number>): Map<string, number> {
  return new Map(counts);
}

function countsSince(counts: Map<string, number>, before: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...counts.entries()]
      .map(([key, value]) => [key, value - (before.get(key) ?? 0)] as const)
      .filter(([, value]) => value > 0),
  );
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return (server.address() as AddressInfo).port;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error == null ? resolve() : reject(error)));
}

async function createFixture(): Promise<Fixture> {
  const requestCounts = new Map<string, number>();
  let websocketCount = 0;
  let udpPacketCount = 0;
  let redirectUrl = "";

  const destinationServer = createServer((request, response) => {
    countRequest(requestCounts, request);
    response.end("destination");
  });
  const destinationPort = await listen(destinationServer);
  redirectUrl = `http://127.0.0.1:${destinationPort}/redirect-destination`;

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    countRequest(requestCounts, request);
    if (request.url === "/download") {
      response.setHeader("content-disposition", "attachment; filename=fixture.txt");
      response.end("fixture download");
      return;
    }
    if (request.url === "/redirect") {
      response.writeHead(302, { location: redirectUrl });
      response.end();
      return;
    }
    if (request.url === "/hold") return;
    if (request.url === "/sw.js") {
      response.setHeader("content-type", "application/javascript");
      response.end("self.addEventListener('message', (event) => { if (event.data === 'network') event.waitUntil(fetch('/sw-post', { method: 'POST' })); });");
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end("<!doctype html><title>Local fixture</title><a id=download href=/download download>download</a><form id=form action=/html-post method=post><button type=submit>submit</button></form>");
  });
  server.on("upgrade", (request, socket) => {
    countRequest(requestCounts, request);
    websocketCount += 1;
    socket.destroy();
  });
  const port = await listen(server);

  const udp = createSocket("udp4");
  udp.on("message", () => { udpPacketCount += 1; });
  await new Promise<void>((resolve, reject) => {
    udp.once("error", reject);
    udp.bind(0, "127.0.0.1", () => {
      udp.off("error", reject);
      resolve();
    });
  });
  const icePort = (udp.address() as AddressInfo).port;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    redirectUrl,
    websocketUrl: `ws://127.0.0.1:${port}/socket`,
    icePort,
    requestCounts,
    websocketConnections: () => websocketCount,
    udpPackets: () => udpPacketCount,
    close: async () => {
      udp.close();
      await Promise.all([closeServer(server), closeServer(destinationServer)]);
    },
  };
}

async function createSecureFixture(): Promise<SecureFixture> {
  const requestCounts = new Map<string, number>();
  const certificateDirectory = mkdtempSync(`${tmpdir()}/norixo-preflight-`);
  const keyPath = `${certificateDirectory}/key.pem`;
  const certificatePath = `${certificateDirectory}/cert.pem`;
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certificatePath, "-days", "1", "-subj", "/CN=fixture.test"], { stdio: "ignore" });
  const credentials = { key: await (await import("node:fs/promises")).readFile(keyPath), cert: await (await import("node:fs/promises")).readFile(certificatePath) };
  const forbiddenServer = createSecureServer(credentials, (request, response) => { countRequest(requestCounts, request); response.end("forbidden"); });
  const forbiddenPort = await listen(forbiddenServer);
  const server = createSecureServer(credentials, (request, response) => {
    countRequest(requestCounts, request);
    if (request.url === "/redirect") {
      response.writeHead(302, { location: `https://forbidden.test:${forbiddenPort}/forbidden-destination` });
      response.end();
      return;
    }
    response.end("secure fixture");
  });
  const port = await listen(server);
  return {
    baseUrl: `https://fixture.test:${port}`,
    forbiddenUrl: `https://forbidden.test:${forbiddenPort}/forbidden-destination`,
    requestCounts,
    close: async () => {
      await Promise.all([closeServer(server), closeServer(forbiddenServer)]);
      rmSync(certificateDirectory, { recursive: true, force: true });
    },
  };
}

async function openProtectedPage(browser: Browser, fixture: Fixture): Promise<{
  context: BrowserContext;
  page: Page;
  websocketAttempts: () => number;
}> {
  const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: "block" });
  const page = await context.newPage();
  let websocketAttempts = 0;
  await page.routeWebSocket("**/*", () => { websocketAttempts += 1; });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const target = new URL(request.url());
    if ((method !== "GET" && method !== "HEAD") || target.origin !== fixture.baseUrl) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  return { context, page, websocketAttempts: () => websocketAttempts };
}

function record(scenarios: Scenario[], id: string, action: string, observed: string, requests: Record<string, number>, assertion: () => void): void {
  try {
    assertion();
    scenarios.push({ id, action, observed, requests, result: "PASS" });
  } catch (error) {
    scenarios.push({
      id,
      action,
      observed,
      requests,
      result: "FAIL",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main(): Promise<void> {
  assert(existsSync(LOCAL_CHROME_EXECUTABLE), `Chromium executable is unavailable: ${LOCAL_CHROME_EXECUTABLE}`);
  const scenarios: Scenario[] = [];
  const fixture = await createFixture();
  const secureFixture = await createSecureFixture();
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      executablePath: LOCAL_CHROME_EXECUTABLE,
      headless: true,
      args: ["--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"],
    });
    const version = browser.version();

    {
      const context = await browser.newContext({ serviceWorkers: "allow" });
      const page = await context.newPage();
      const before = snapshotCounts(fixture.requestCounts);
      await page.goto(`${fixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
      await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.evaluate(() => navigator.serviceWorker.controller?.postMessage("network"));
      await page.waitForTimeout(SCENARIO_WAIT_MS * 2);
      const requests = countsSince(fixture.requestCounts, before);
      record(scenarios, "service-worker-control", "Control: activate a worker and ask it to POST.", "An allowed worker was activated and received a message requesting a POST.", requests, () => {
        assert.equal(requests["GET /sw.js"], 1);
        assert.equal(requests["POST /sw-post"], 1);
      });
      await context.close();
    }

    {
      const { context, page } = await openProtectedPage(browser, fixture);
      const before = snapshotCounts(fixture.requestCounts);
      await page.goto(`${fixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const result = await page.evaluate(async () => {
        try {
          await navigator.serviceWorker.register("/sw.js");
          return "registered";
        } catch {
          return "rejected";
        }
      });
      await page.waitForTimeout(SCENARIO_WAIT_MS * 2);
      const requests = countsSince(fixture.requestCounts, before);
      record(scenarios, "service-worker", "Register a local service worker with serviceWorkers:block.", `navigator.serviceWorker.register returned ${result}; worker script and worker POST counters were inspected.`, requests, () => {
        assert.equal(result, "registered");
        assert.equal(requests["GET /sw.js"] ?? 0, 0);
        assert.equal(requests["POST /sw-post"] ?? 0, 0);
      });
      await context.close();
    }

    {
      const securePort = Number(new URL(secureFixture.baseUrl).port);
      let pinnedProxyConnects = 0;
      const proxy = await startContactFormPinnedBrowserProxy({
        target: { authorityHostname: "fixture.test", socketAddress: "127.0.0.1", socketFamily: 4, port: securePort },
        openPinnedSocket: async (): Promise<Socket> => new Promise((resolve, reject) => {
          const socket = createConnection({ host: "127.0.0.1", port: securePort }, () => { pinnedProxyConnects += 1; resolve(socket); });
          socket.once("error", reject);
        }),
      });
      const pinnedBrowser = await chromium.launch({
        executablePath: LOCAL_CHROME_EXECUTABLE,
        headless: true,
        args: [
          `--proxy-server=http://${proxy.host}:${proxy.port}`,
          "--proxy-bypass-list=<-loopback>",
          "--disable-quic",
          "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
          "--ignore-certificate-errors",
        ],
      });
      try {
        const context = await pinnedBrowser.newContext({ serviceWorkers: "block" });
        const page = await context.newPage();
        await page.route("**/*", async (route) => {
          const request = route.request();
          const target = new URL(request.url());
          if ((request.method() !== "GET" && request.method() !== "HEAD") || target.hostname !== "fixture.test" || target.port !== String(securePort)) await route.abort("blockedbyclient");
          else await route.continue();
        });
        const before = snapshotCounts(secureFixture.requestCounts);
        const redirectOutcome = await page.goto(`${secureFixture.baseUrl}/redirect`, { waitUntil: "domcontentloaded" }).then(() => "allowed").catch(() => "blocked");
        const redirectRequests = countsSince(secureFixture.requestCounts, before);
        record(scenarios, "redirect-pinned-proxy", "Navigate through the production-shaped pinned proxy and validate every intercepted destination.", `Navigation ${redirectOutcome}; proxy opened ${pinnedProxyConnects} pinned connection(s); forbidden destination=${secureFixture.forbiddenUrl}.`, redirectRequests, () => {
          assert.equal(redirectOutcome, "blocked");
          assert.ok(pinnedProxyConnects >= 1);
          assert.equal(redirectRequests["GET /redirect"], 1);
          assert.equal(redirectRequests["GET /forbidden-destination"] ?? 0, 0);
        });
        const icePage = await context.newPage();
        await icePage.route("**/*", async (route) => {
          const request = route.request();
          const target = new URL(request.url());
          if ((request.method() !== "GET" && request.method() !== "HEAD") || target.hostname !== "fixture.test" || target.port !== String(securePort)) await route.abort("blockedbyclient");
          else await route.continue();
        });
        await icePage.goto(`${secureFixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
        const beforePackets = fixture.udpPackets();
        await icePage.evaluate(async (icePort) => {
          const connection = new RTCPeerConnection({ iceServers: [{ urls: `stun:127.0.0.1:${icePort}` }] });
          connection.createDataChannel("fixture");
          await connection.setLocalDescription(await connection.createOffer());
          await new Promise((resolve) => setTimeout(resolve, 250));
          connection.close();
        }, fixture.icePort);
        record(scenarios, "webrtc-pinned-proxy", "Gather ICE candidates through the production-shaped pinned proxy.", `UDP fixture received ${fixture.udpPackets() - beforePackets} packet(s) while the pinned proxy was active.`, {}, () => assert.equal(fixture.udpPackets() - beforePackets, 0));
        await context.close();
      } finally {
        await pinnedBrowser.close();
        await proxy.close();
      }
    }

    {
      const { context, page } = await openProtectedPage(browser, fixture);
      await page.goto(`${fixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const before = snapshotCounts(fixture.requestCounts);
      const outcome = await page.evaluate(async () => {
        const fetchOutcome = await fetch("/fetch-post", { method: "POST" }).then(() => "allowed").catch(() => "blocked");
        const xhrOutcome = await new Promise<string>((resolve) => {
          const request = new XMLHttpRequest();
          request.addEventListener("load", () => resolve("allowed"), { once: true });
          request.addEventListener("error", () => resolve("blocked"), { once: true });
          request.open("POST", "/xhr-post");
          request.send();
        });
        return { fetchOutcome, xhrOutcome };
      });
      const requests = countsSince(fixture.requestCounts, before);
      record(scenarios, "fetch-post", "Issue fetch and XHR POST requests.", `fetch=${outcome.fetchOutcome}; XHR=${outcome.xhrOutcome}.`, requests, () => {
        assert.equal(outcome.fetchOutcome, "blocked");
        assert.equal(outcome.xhrOutcome, "blocked");
        assert.equal(requests["POST /fetch-post"] ?? 0, 0);
        assert.equal(requests["POST /xhr-post"] ?? 0, 0);
      });
      await context.close();
    }

    {
      const { context, page } = await openProtectedPage(browser, fixture);
      await page.goto(`${fixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const before = snapshotCounts(fixture.requestCounts);
      const outcomes = await page.evaluate(async () => Promise.all(["PUT", "PATCH", "DELETE"].map(async (method) => fetch(`/${method.toLowerCase()}`, { method }).then(() => "allowed").catch(() => "blocked"))));
      const requests = countsSince(fixture.requestCounts, before);
      record(scenarios, "other-http-methods", "Issue PUT, PATCH, and DELETE fetch requests.", `Methods resolved as ${outcomes.join(", ")}.`, requests, () => {
        assert.deepEqual(outcomes, ["blocked", "blocked", "blocked"]);
        for (const method of ["PUT", "PATCH", "DELETE"]) assert.equal(requests[`${method} /${method.toLowerCase()}`] ?? 0, 0);
      });
      await context.close();
    }

    {
      const { context, page } = await openProtectedPage(browser, fixture);
      await page.goto(`${fixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const before = snapshotCounts(fixture.requestCounts);
      const statuses = await page.evaluate(async () => [await fetch("/get-only"), await fetch("/head-only", { method: "HEAD" })].map((response) => response.status));
      const requests = countsSince(fixture.requestCounts, before);
      record(scenarios, "get-head", "Issue GET and HEAD requests.", `Responses returned ${statuses.join(" and ")}.`, requests, () => {
        assert.deepEqual(statuses, [200, 200]);
        assert.equal(requests["GET /get-only"], 1);
        assert.equal(requests["HEAD /head-only"], 1);
      });
      await context.close();
    }

    {
      const { context, page, websocketAttempts } = await openProtectedPage(browser, fixture);
      await page.goto(`${fixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const beforeServerConnections = fixture.websocketConnections();
      const outcome = await page.evaluate((url) => new Promise<string>((resolve) => {
        const socket = new WebSocket(url);
        socket.addEventListener("error", () => resolve("error"), { once: true });
        setTimeout(() => resolve("pending"), 100);
      }), fixture.websocketUrl);
      record(scenarios, "websocket", "Open a local WebSocket.", `Browser result ${outcome}; route observed ${websocketAttempts()} socket attempt(s).`, {}, () => {
        assert.ok(websocketAttempts() >= 1);
        assert.equal(fixture.websocketConnections() - beforeServerConnections, 0);
      });
      await context.close();
    }

    {
      const { context, page } = await openProtectedPage(browser, fixture);
      await page.goto(`${fixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const beforePackets = fixture.udpPackets();
      const observed = await page.evaluate(async (icePort) => {
        const connection = new RTCPeerConnection({ iceServers: [{ urls: `stun:127.0.0.1:${icePort}` }] });
        connection.createDataChannel("fixture");
        await connection.setLocalDescription(await connection.createOffer());
        await new Promise((resolve) => setTimeout(resolve, 250));
        const candidateCount = connection.localDescription?.sdp.match(/^a=candidate:/gm)?.length ?? 0;
        connection.close();
        return candidateCount;
      }, fixture.icePort);
      record(scenarios, "webrtc-unpinned-harness", "Gather ICE candidates from the old unproxied harness.", `Chromium exposed ${observed} candidate(s); UDP fixture received ${fixture.udpPackets() - beforePackets} packet(s).`, {}, () => assert.ok(fixture.udpPackets() - beforePackets > 0));
      await context.close();
    }

    {
      const { context, page } = await openProtectedPage(browser, fixture);
      await page.goto(`${fixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
      let popupClosed = false;
      page.on("popup", (popup) => { void popup.close().then(() => { popupClosed = true; }); });
      await page.evaluate((url) => window.open(url), `${fixture.baseUrl}/popup`);
      await page.waitForTimeout(SCENARIO_WAIT_MS);
      record(scenarios, "popup", "Open a same-fixture popup.", `Popup was observed and closed=${popupClosed}.`, {}, () => assert.equal(popupClosed, true));
      await context.close();
    }

    {
      const { context, page } = await openProtectedPage(browser, fixture);
      await page.goto(`${fixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
      let downloadResult = "not-observed";
      page.on("download", (download) => { void download.cancel().then(() => { downloadResult = "cancelled"; }); });
      await page.locator("#download").click();
      await page.waitForTimeout(SCENARIO_WAIT_MS);
      record(scenarios, "download", "Click the local download link.", `Download event result ${downloadResult}.`, {}, () => assert.equal(downloadResult, "cancelled"));
      await context.close();
    }

    {
      const { context, page } = await openProtectedPage(browser, fixture);
      const before = snapshotCounts(fixture.requestCounts);
      const navigation = await page.goto(`${fixture.baseUrl}/redirect`, { waitUntil: "domcontentloaded" }).then(() => "allowed").catch(() => "blocked");
      const requests = countsSince(fixture.requestCounts, before);
      record(scenarios, "redirect-unpinned-harness", "Navigate through the old harness redirect route.", `Navigation ${navigation}; the destination server counter is retained.`, requests, () => {
        assert.equal(navigation, "allowed");
        assert.equal(requests["GET /redirect-destination"], 1);
      });
      await context.close();
    }

    {
      const { context, page } = await openProtectedPage(browser, fixture);
      const startedAt = Date.now();
      const outcome = await page.goto(`${fixture.baseUrl}/hold`, { timeout: NAVIGATION_TIMEOUT_MS }).then(() => "allowed").catch(() => "timed-out");
      const elapsedMs = Date.now() - startedAt;
      record(scenarios, "timeout", "Navigate to a fixture that never responds.", `Navigation ${outcome} after ${elapsedMs}ms.`, {}, () => {
        assert.equal(outcome, "timed-out");
        assert.ok(elapsedMs >= NAVIGATION_TIMEOUT_MS && elapsedMs < NAVIGATION_TIMEOUT_MS + 1_000);
      });
      await context.close();
    }

    {
      const { context, page } = await openProtectedPage(browser, fixture);
      await page.goto(`${fixture.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const before = snapshotCounts(fixture.requestCounts);
      await page.locator("#form button").click();
      await page.waitForTimeout(SCENARIO_WAIT_MS);
      const requests = countsSince(fixture.requestCounts, before);
      record(scenarios, "form-submission", "Submit a local HTML form.", "Browser remained on the fixture page after blocked form submission.", requests, () => assert.equal(requests["POST /html-post"] ?? 0, 0));
      await context.close();
    }

    console.log(JSON.stringify({
      playwrightVersion: "1.59.1",
      chromiumVersion: version,
      fixtureServersStarted: true,
      scenarios,
      actualNetworkRequestCounts: Object.fromEntries(fixture.requestCounts),
    }, null, 2));
    assert.equal(scenarios.filter((scenario) => scenario.result === "FAIL").length, 0, "browser runtime smoke contains failing scenarios");
  } finally {
    await browser?.close();
    await fixture.close();
    await secureFixture.close();
    console.log("CLEANUP_CONFIRMED");
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

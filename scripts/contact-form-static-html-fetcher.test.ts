import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";

import { contactFormStaticHtmlFetcherTestHooks, type ContactFormStaticHtmlAddress } from "../lib/backlinks/http/contactFormStaticHtmlFetcher";

const PUBLIC: ContactFormStaticHtmlAddress = { address: "93.184.216.34", family: 4 };
const PRIVATE: ContactFormStaticHtmlAddress = { address: "127.0.0.1", family: 4 };
const IPV6_PRIVATE: ContactFormStaticHtmlAddress = { address: "::ffff:127.0.0.1", family: 6 };
const HTML = { status: 200, headers: { "content-type": "text/html", "content-length": "13" }, body: "<form></form>" };

function resolver(addresses: readonly ContactFormStaticHtmlAddress[] = [PUBLIC]) { return async () => addresses; }
async function fetchTest(url: string, input: { addresses?: readonly ContactFormStaticHtmlAddress[]; transport?: Parameters<typeof contactFormStaticHtmlFetcherTestHooks.fetchInternal>[1]["transport"] } = {}) {
  return contactFormStaticHtmlFetcherTestHooks.fetchInternal(url, { resolveHostname: resolver(input.addresses), transport: input.transport ?? (async () => HTML) });
}
async function expectFailure(url: string, code: string, input: Parameters<typeof fetchTest>[1] = {}) {
  const result = await fetchTest(url, input);
  assert.equal(result.ok, false, `${url} should fail`);
  if (!result.ok) assert.equal(result.safeErrorCode, code);
}

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return (server.address() as AddressInfo).port;
}

void (async () => {
  const valid = await fetchTest("https://example.com/contact");
  assert.deepEqual(valid, { ok: true, originalUrl: "https://example.com/contact", finalUrl: "https://example.com/contact", html: "<form></form>", contentType: "text/html", redirectCount: 0 });

  await expectFailure("http://example.com", "CONTACT_FORM_STATIC_HTTPS_REQUIRED");
  await expectFailure("https://user:pass@example.com", "CONTACT_FORM_STATIC_CREDENTIALS_REJECTED");
  await expectFailure("https://127.0.0.1", "CONTACT_FORM_STATIC_HOSTNAME_REJECTED");
  await expectFailure("https://localhost", "CONTACT_FORM_STATIC_HOSTNAME_REJECTED");
  await expectFailure("https://example.com:8443", "CONTACT_FORM_STATIC_PORT_REJECTED");
  await expectFailure("https://example.com", "CONTACT_FORM_STATIC_DNS_UNSAFE", { addresses: [PRIVATE] });
  await expectFailure("https://example.com", "CONTACT_FORM_STATIC_DNS_UNSAFE", { addresses: [IPV6_PRIVATE] });
  await expectFailure("https://example.com", "CONTACT_FORM_STATIC_DNS_UNSAFE", { addresses: [PUBLIC, PRIVATE] });
  await expectFailure("https://example.com", "CONTACT_FORM_STATIC_DNS_FAILED", { addresses: [] });

  const pinned: string[] = [];
  const rebound = await fetchTest("https://example.com/start", {
    transport: async (target) => {
      pinned.push(target.address.address);
      return target.url.pathname === "/start"
        ? { status: 302, headers: { location: "/final", "content-type": "text/html" }, body: "" }
        : HTML;
    },
  });
  assert.equal(rebound.ok, true);
  assert.deepEqual(pinned, [PUBLIC.address, PUBLIC.address], "each request must receive a pinned address");

  let dnsLookups = 0;
  let connections = 0;
  const rebindingRejected = await contactFormStaticHtmlFetcherTestHooks.fetchInternal("https://example.com/start", {
    resolveHostname: async () => (++dnsLookups === 1 ? [PUBLIC] : [PRIVATE]),
    transport: async () => { connections += 1; return { status: 302, headers: { location: "/final", "content-type": "text/html" }, body: "" }; },
  });
  assert.deepEqual(rebindingRejected, { ok: false, originalUrl: "https://example.com/start", safeErrorCode: "CONTACT_FORM_STATIC_DNS_UNSAFE" });
  assert.equal(connections, 1, "DNS rebinding is rejected before a second connection");

  await expectFailure("https://example.com/start", "CONTACT_FORM_STATIC_REDIRECT_FORBIDDEN", { transport: async () => ({ status: 302, headers: { location: "https://other.example/final", "content-type": "text/html" }, body: "" }) });
  await expectFailure("https://example.com/start", "CONTACT_FORM_STATIC_PORT_REJECTED", { transport: async () => ({ status: 302, headers: { location: "https://example.com:8443/final", "content-type": "text/html" }, body: "" }) });
  await expectFailure("https://example.com/start", "CONTACT_FORM_STATIC_HTTPS_REQUIRED", { transport: async () => ({ status: 302, headers: { location: "http://example.com/final", "content-type": "text/html" }, body: "" }) });
  await expectFailure("https://example.com/start", "CONTACT_FORM_STATIC_REDIRECT_LIMIT", { transport: async () => ({ status: 302, headers: { location: "/again", "content-type": "text/html" }, body: "" }) });
  await expectFailure("https://example.com", "CONTACT_FORM_STATIC_RESPONSE_TOO_LARGE", { transport: async () => ({ status: 200, headers: { "content-type": "text/html" }, body: "a".repeat(1024 * 1024 + 1) }) });
  await expectFailure("https://example.com", "CONTACT_FORM_STATIC_RESPONSE_TRUNCATED", { transport: async () => ({ status: 200, headers: { "content-type": "text/html", "content-length": "999" }, body: "x" }) });
  await expectFailure("https://example.com", "CONTACT_FORM_STATIC_RESPONSE_COMPRESSED", { transport: async () => ({ status: 200, headers: { "content-type": "text/html", "content-encoding": "gzip" }, body: "x" }) });
  await expectFailure("https://example.com", "CONTACT_FORM_STATIC_RESPONSE_NOT_HTML", { transport: async () => ({ status: 200, headers: { "content-type": "image/png" }, body: "x" }) });

  const directory = mkdtempSync(`${tmpdir()}/norixo-static-fetcher-`);
  const keyPath = `${directory}/key.pem`; const certPath = `${directory}/cert.pem`;
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=fixture.test", "-addext", "subjectAltName=DNS:fixture.test"], { stdio: "ignore" });
  const certificate = readFileSync(certPath);
  const received: string[] = [];
  const server = createServer({ key: readFileSync(keyPath), cert: certificate }, (request, response) => { received.push(`${request.method} ${request.url}`); response.setHeader("content-type", "text/html"); response.end("<form></form>"); });
  try {
    const port = await listen(server);
    const signal = new AbortController().signal;
    const target = { url: new URL(`https://fixture.test:${port}/`), hostname: "fixture.test", address: PRIVATE };
    const trusted = await contactFormStaticHtmlFetcherTestHooks.requestPinnedTarget(target, signal, { ca: certificate });
    assert.equal(trusted.status, 200, "TLS validates a trusted certificate for the validated hostname");
    assert.deepEqual(received, ["GET /"], "the real transport emits only one GET and fetches no secondary resource");
    await assert.rejects(() => contactFormStaticHtmlFetcherTestHooks.requestPinnedTarget({ ...target, hostname: "wrong.test" }, signal, { ca: certificate }), /CONTACT_FORM_STATIC_TLS_FAILED|ERR_TLS_CERT_ALTNAME_INVALID/);
    await assert.rejects(() => contactFormStaticHtmlFetcherTestHooks.requestPinnedTarget(target, signal), /CONTACT_FORM_STATIC_TLS_FAILED|self-signed/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error == null ? resolve() : reject(error)));
  }

  const stalledSockets = new Set<import("node:stream").Duplex>();
  const stalled = createServer({ key: readFileSync(keyPath), cert: certificate }, () => undefined);
  stalled.on("connection", (socket) => { stalledSockets.add(socket); socket.once("close", () => stalledSockets.delete(socket)); });
  try {
    const port = await listen(stalled);
    const target = { url: new URL(`https://fixture.test:${port}/stall`), hostname: "fixture.test", address: PRIVATE };
    await assert.rejects(() => contactFormStaticHtmlFetcherTestHooks.requestPinnedTarget(target, new AbortController().signal, { ca: certificate }), /CONTACT_FORM_STATIC_TIMEOUT/);
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(stalledSockets.size, 0, "timed-out sockets are destroyed");
  } finally {
    await new Promise<void>((resolve, reject) => stalled.close((error) => error == null ? resolve() : reject(error)));
  }
  rmSync(directory, { recursive: true, force: true });
  console.log("PASS — contact-form static HTML fetcher");
})().catch((error) => { console.error(error); process.exitCode = 1; });

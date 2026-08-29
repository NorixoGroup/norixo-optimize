import assert from "node:assert/strict";

import { fetchHttp } from "../lib/backlinks/http";
import { isUnsafeIpAddress, resolveSafeHttpTarget } from "../lib/backlinks/http";
import type { DnsLookup, HttpFetchRequest, HttpFetchTransportInput, HttpFetchTransportResponse } from "../lib/backlinks/http";

const publicDns: DnsLookup = async (hostname) => {
  if (hostname === "example.com") return [{ address: "93.184.216.34", family: 4 }];
  if (hostname === "redirect.example") return [{ address: "93.184.216.35", family: 4 }];
  if (hostname === "private.example") return [{ address: "10.0.0.10", family: 4 }];
  if (hostname === "private6.example") return [{ address: "fc00::1", family: 6 }];
  if (hostname === "mixed.example") return [{ address: "93.184.216.36", family: 4 }, { address: "10.0.0.11", family: 4 }];
  return [{ address: "93.184.216.37", family: 4 }];
};

function response(overrides: Partial<HttpFetchTransportResponse> = {}): HttpFetchTransportResponse {
  return {
    status: 200,
    headers: { "content-type": "text/html" },
    body: "<html><body>Example Domain</body></html>",
    ...overrides,
  };
}

function request(url: string, overrides: Partial<HttpFetchRequest> = {}): HttpFetchRequest {
  return {
    url,
    timeoutMs: 10_000,
    maxRedirects: 3,
    maxResponseBytes: 64_000,
    userAgent: "NorixoBacklinkVerificationSmoke/1.0",
    ...overrides,
  };
}

async function assertBlocked(url: string): Promise<void> {
  await assert.rejects(() => resolveSafeHttpTarget(url, publicDns), /HTTP target is not allowed/);
}

async function main(): Promise<void> {
  const boundTargets: HttpFetchTransportInput[] = [];
  const okTransport = async (input: HttpFetchTransportInput) => {
    boundTargets.push(input);
    return response();
  };

  const normalResponse = await fetchHttp(request("https://example.com"), { dnsLookup: publicDns, transport: okTransport });
  assert.equal(normalResponse.status, 200);
  assert.equal(new URL(normalResponse.finalUrl).origin, "https://example.com");
  assert.equal(normalResponse.redirected, false);
  assert.equal(normalResponse.redirectCount, 0);
  const boundTarget = boundTargets[0];
  assert.ok(boundTarget);
  assert.equal(boundTarget?.address, "93.184.216.34");
  assert.equal(boundTarget?.hostname, "example.com");
  assert.equal(boundTarget?.headers["user-agent"], "NorixoBacklinkVerificationSmoke/1.0");

  await fetchHttp(request("http://example.com"), { dnsLookup: publicDns, transport: okTransport });
  await assertBlocked("file:///etc/passwd");
  await assertBlocked("ftp://example.com/file");
  await assertBlocked("data:text/plain,hello");
  await assertBlocked("http://user:pass@example.com/");
  await assertBlocked("http://localhost/");
  await assertBlocked("http://localhost./");
  await assertBlocked("http://127.0.0.1/");
  await assertBlocked("http://127.0.0.2/");
  await assertBlocked("http://127.1/");
  await assertBlocked("http://2130706433/");
  await assertBlocked("http://0x7f000001/");
  await assertBlocked("http://0177.0.0.1/");
  await assertBlocked("http://0.0.0.0/");
  await assertBlocked("http://10.0.0.1/");
  await assertBlocked("http://172.16.0.1/");
  await assertBlocked("http://172.31.255.255/");
  await assertBlocked("http://192.168.1.1/");
  await assertBlocked("http://169.254.1.1/");
  await assertBlocked("http://169.254.169.254/");
  await assertBlocked("http://100.64.0.1/");
  await assertBlocked("http://[::1]/");
  await assertBlocked("http://[fe80::1]/");
  await assertBlocked("http://[fc00::1]/");
  await assertBlocked("http://[fd00::1]/");
  await assertBlocked("http://[::ffff:127.0.0.1]/");
  await assertBlocked("http://[::ffff:10.0.0.1]/");
  await assertBlocked("http://[::ffff:192.168.1.1]/");
  await assert.doesNotReject(() => resolveSafeHttpTarget("https://example.com", publicDns));
  await assert.rejects(() => resolveSafeHttpTarget("https://private.example", publicDns), /HTTP target is not allowed/);
  await assert.rejects(() => resolveSafeHttpTarget("https://private6.example", publicDns), /HTTP target is not allowed/);
  await assert.rejects(() => resolveSafeHttpTarget("https://mixed.example", publicDns), /HTTP target is not allowed/);
  assert.equal(isUnsafeIpAddress("169.254.169.254"), true);

  const redirectResponse = await fetchHttp(request("https://redirect.example/start"), {
    dnsLookup: publicDns,
    transport: async (input) =>
      input.url.pathname === "/start"
        ? response({ status: 302, headers: { location: "https://example.com/final" } })
        : response(),
  });
  assert.equal(redirectResponse.status, 200);
  assert.equal(redirectResponse.redirected, true);
  assert.equal(redirectResponse.redirectCount, 1);

  await assert.rejects(
    () => fetchHttp(request("https://redirect.example/start"), {
      dnsLookup: publicDns,
      transport: async () => response({ status: 302, headers: { location: "http://127.0.0.1/private" } }),
    }),
    /HTTP target is not allowed/,
  );
  await assert.rejects(
    () => fetchHttp(request("https://redirect.example/start"), {
      dnsLookup: publicDns,
      transport: async () => response({ status: 302, headers: { location: "http://169.254.169.254/latest" } }),
    }),
    /HTTP target is not allowed/,
  );
  await assert.rejects(
    () => fetchHttp(request("https://redirect.example/start"), {
      dnsLookup: publicDns,
      transport: async () => response({ status: 302, headers: { location: "file:///etc/passwd" } }),
    }),
    /HTTP target is not allowed/,
  );

  const redirectHops: string[] = [];
  await fetchHttp(request("https://redirect.example/first"), {
    dnsLookup: publicDns,
    transport: async (input) => {
      redirectHops.push(input.hostname);
      return input.url.pathname === "/first"
        ? response({ status: 302, headers: { location: "https://example.com/second" } })
        : response();
    },
  });
  assert.deepEqual(redirectHops, ["redirect.example", "example.com"]);

  await assert.rejects(
    () => fetchHttp(request("https://example.com/large"), {
      dnsLookup: publicDns,
      transport: async () => response({ headers: { "content-length": "64001" } }),
    }),
    /size limit/,
  );

  await assert.rejects(
    () => fetchHttp(request("https://example.com/slow", { timeoutMs: 1 }), {
      dnsLookup: publicDns,
      transport: async ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        }),
    }),
    /timed out/,
  );

  console.info("Backlink HTTP fetcher smoke passed.");
}

void main();

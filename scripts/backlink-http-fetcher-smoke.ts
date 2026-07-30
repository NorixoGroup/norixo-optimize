import assert from "node:assert/strict";

import { fetchHttp } from "../lib/backlinks/http";

async function expectTimeout(): Promise<void> {
  await assert.rejects(
    fetchHttp({
      url: "https://example.com",
      timeoutMs: 1,
      maxRedirects: 0,
      maxResponseBytes: 64_000,
    }),
    /timed out/,
  );
}

async function main(): Promise<void> {
  const normalResponse = await fetchHttp({
    url: "https://example.com",
    timeoutMs: 10_000,
    maxRedirects: 0,
    maxResponseBytes: 64_000,
    userAgent: "NorixoBacklinkVerificationSmoke/1.0",
  });

  assert.equal(normalResponse.status, 200);
  assert.equal(new URL(normalResponse.finalUrl).origin, "https://example.com");
  assert.equal(normalResponse.redirected, false);
  assert.equal(normalResponse.redirectCount, 0);
  assert.match(normalResponse.body, /Example Domain/);
  assert.match(normalResponse.contentType ?? "", /text\/html/);

  await expectTimeout();

  const redirectResponse = await fetchHttp({
    url: "https://httpbin.org/redirect/1",
    timeoutMs: 10_000,
    maxRedirects: 1,
    maxResponseBytes: 64_000,
  });

  assert.equal(redirectResponse.status, 200);
  assert.equal(redirectResponse.redirected, true);
  assert.equal(redirectResponse.redirectCount, 1);

  console.info("Backlink HTTP fetcher smoke passed.");
}

void main();

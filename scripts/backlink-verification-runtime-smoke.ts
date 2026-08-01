import assert from "node:assert/strict";

import { executeBacklinkVerification } from "../lib/backlinks/verification";
import type { HttpFetchRequest, HttpFetchResponse } from "../lib/backlinks/http";

const input = {
  sourceUrl: "https://publisher.example/resources",
  targetUrl: "https://norixo.io/calculators/revpar",
  checkedAt: "2026-07-31T12:00:00.000Z",
  policy: {},
  http: {
    timeoutMs: 5_000,
    maxRedirects: 3,
    maxResponseBytes: 64_000,
  },
};

function responseFixture(overrides: Partial<HttpFetchResponse> = {}): HttpFetchResponse {
  return {
    finalUrl: input.sourceUrl,
    status: 200,
    headers: { "content-type": "text/html" },
    body: `<html><body><a href="${input.targetUrl}">Norixo RevPAR</a></body></html>`,
    redirected: false,
    redirectCount: 0,
    fetchedAt: input.checkedAt,
    contentType: "text/html",
    contentLength: null,
    ...overrides,
  };
}

function fixtureFetcher(response: HttpFetchResponse): (request: HttpFetchRequest) => Promise<HttpFetchResponse> {
  return async () => response;
}

async function main(): Promise<void> {
  const foundResponse = responseFixture();
  const found = await executeBacklinkVerification(input, { fetcher: fixtureFetcher(foundResponse) });
  assert.equal(found.kind, "verified");
  if (found.kind === "verified") {
    assert.equal(found.verification.status, "FOUND");
  }

  const absent = await executeBacklinkVerification(
    input,
    { fetcher: fixtureFetcher(responseFixture({ body: "<html><body>No link</body></html>" })) },
  );
  assert.equal(absent.kind, "verified");
  if (absent.kind === "verified") {
    assert.equal(absent.verification.status, "NOT_FOUND");
  }

  const notFound = await executeBacklinkVerification(
    input,
    { fetcher: fixtureFetcher(responseFixture({ status: 404, body: "<html><body>Missing</body></html>" })) },
  );
  assert.deepEqual(notFound.kind === "http_unusable" ? notFound.reason : undefined, "http_client_error");

  const serverError = await executeBacklinkVerification(
    input,
    { fetcher: fixtureFetcher(responseFixture({ status: 500 })) },
  );
  assert.deepEqual(serverError.kind === "http_unusable" ? serverError.reason : undefined, "http_server_error");

  const fetchError = await executeBacklinkVerification(input, {
    fetcher: async () => {
      throw new Error("HTTP fetch timed out after 5000ms.");
    },
  });
  assert.deepEqual(fetchError, {
    kind: "fetch_error",
    error: { code: "FETCH_ERROR", message: "HTTP fetch timed out after 5000ms." },
  });

  const nonHtml = await executeBacklinkVerification(
    input,
    { fetcher: fixtureFetcher(responseFixture({ contentType: "application/pdf", body: "%PDF" })) },
  );
  assert.deepEqual(nonHtml.kind === "http_unusable" ? nonHtml.reason : undefined, "unsupported_content_type");

  const redirectedResponse = responseFixture({
    finalUrl: "https://publisher.example/final-resources",
    redirected: true,
    redirectCount: 1,
  });
  const redirected = await executeBacklinkVerification(input, { fetcher: fixtureFetcher(redirectedResponse) });
  assert.equal(redirected.kind, "verified");
  if (redirected.kind === "verified") {
    assert.equal(redirected.response.finalUrl, redirectedResponse.finalUrl);
    assert.equal(redirected.response.redirectCount, 1);
  }

  const repeated = await executeBacklinkVerification(input, { fetcher: fixtureFetcher(foundResponse) });
  assert.deepEqual(repeated, found);
  assert.equal(foundResponse.body.includes("Norixo RevPAR"), true);
  assert.equal(input.sourceUrl, "https://publisher.example/resources");

  console.info("PASS — Backlink verification runtime smoke");
}

void main();

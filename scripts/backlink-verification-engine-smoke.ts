import assert from "node:assert/strict";

import { runVerification } from "../lib/backlinks/verification";

const policy = {
  acceptCanonical: false,
  followRedirects: true,
  maxRedirects: 3,
  strictAnchor: false,
  strictRel: false,
};

const request = {
  sourceUrl: " https://source.example/resource ",
  targetUrl: " https://norixo.io/calculator ",
  checkedAt: " 2026-07-31T12:00:00.000Z ",
  policy,
  evidence: {
    matchedHref: " https://norixo.io/calculator ",
    sourceUrl: "https://incorrect.example",
    targetUrl: "https://incorrect-target.example",
    checkedAt: "2020-01-01T00:00:00.000Z",
  },
};

const result = runVerification(request);

assert.equal(result.status, "FOUND");
assert.equal(result.evidence.sourceUrl, "https://source.example/resource");
assert.equal(result.evidence.targetUrl, "https://norixo.io/calculator");
assert.equal(result.evidence.checkedAt, "2026-07-31T12:00:00.000Z");
assert.equal(result.evidence.matchedHref, "https://norixo.io/calculator");
assert.equal(request.evidence.sourceUrl, "https://incorrect.example");
assert.equal(request.evidence.matchedHref, " https://norixo.io/calculator ");

const unknownResult = runVerification({
  sourceUrl: " ",
  targetUrl: "https://norixo.io/calculator",
  checkedAt: "2026-07-31T12:00:00.000Z",
  policy,
  evidence: {},
});

assert.equal(unknownResult.status, "UNKNOWN");

console.info("Backlink verification engine smoke passed.");

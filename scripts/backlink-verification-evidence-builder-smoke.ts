import assert from "node:assert/strict";

import { buildVerificationEvidence } from "../lib/backlinks/verification";
import type { HtmlLinkObservation } from "../lib/backlinks/html";

const links: HtmlLinkObservation[] = [
  {
    index: 0,
    rawHref: "/different",
    resolvedUrl: "https://example.com/different",
    hrefKind: "relative",
    text: "Different",
    rel: ["nofollow"],
  },
  {
    index: 1,
    rawHref: "/target",
    resolvedUrl: "https://example.com/target",
    hrefKind: "relative",
    text: "First target",
    rel: ["sponsored", "nofollow"],
    target: "_blank",
    title: "First title",
  },
  {
    index: 2,
    rawHref: "/target",
    resolvedUrl: "https://example.com/target",
    hrefKind: "relative",
    text: "Second target",
    rel: [],
  },
];

const request = {
  sourceUrl: "https://source.example/resources",
  targetUrl: "https://example.com/target",
  checkedAt: "2026-07-31T12:00:00.000Z",
  links,
};

const evidence = buildVerificationEvidence(request);
assert.deepEqual(evidence, {
  sourceUrl: "https://source.example/resources",
  targetUrl: "https://example.com/target",
  checkedAt: "2026-07-31T12:00:00.000Z",
  matchedHref: "https://example.com/target",
  matchedAnchor: "First target",
  matchedRel: "sponsored nofollow",
});
assert.deepEqual(links[1]?.rel, ["sponsored", "nofollow"]);

const noMatchEvidence = buildVerificationEvidence({
  ...request,
  targetUrl: "https://example.com/missing",
});
assert.equal(noMatchEvidence.matchedHref, undefined);
assert.equal(noMatchEvidence.matchedAnchor, undefined);
assert.equal(noMatchEvidence.matchedRel, undefined);

const distinctUrlEvidence = buildVerificationEvidence({
  ...request,
  targetUrl: "https://example.com/target?source=other",
});
assert.equal(distinctUrlEvidence.matchedHref, undefined);

console.info("Backlink verification evidence builder smoke passed.");

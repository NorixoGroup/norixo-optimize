import assert from "node:assert/strict";

import { extractHtmlAnchors } from "../lib/backlinks/html";
import type { ParsedHtmlDocument } from "../lib/backlinks/html";

const document: ParsedHtmlDocument = {
  url: "https://example.com/resources",
  status: 200,
  contentType: "text/html",
  html: `
    <html><body>
      <a href=" /relative ">Discover <strong>Norixo</strong></a>
      <a href="/relative" rel="nofollow sponsored" target=" _blank " title=" Resource ">Second</a>
      <a href="" rel="   " target=" " title=" ">Third</a>
      <a>Without href</a>
      <a href="/relative">Duplicate</a>
    </body></html>
  `,
  fetchedAt: "2026-07-31T12:00:00.000Z",
  isHtml: true,
  isEmpty: false,
};

const result = extractHtmlAnchors(document);
assert.equal(result.documentUrl, document.url);
assert.equal(result.anchorCount, 5);
assert.deepEqual(
  result.anchors.map((anchor) => anchor.index),
  [0, 1, 2, 3, 4],
);
assert.equal(result.anchors[0]?.href, "/relative");
assert.equal(result.anchors[0]?.text, "Discover Norixo");
assert.deepEqual(result.anchors[1]?.rel, ["nofollow", "sponsored"]);
assert.equal(result.anchors[1]?.target, "_blank");
assert.equal(result.anchors[1]?.title, "Resource");
assert.equal(result.anchors[2]?.href, undefined);
assert.deepEqual(result.anchors[2]?.rel, []);
assert.equal(result.anchors[3]?.href, undefined);
assert.equal(result.anchors[3]?.text, "Without href");
assert.equal(result.anchors[4]?.href, "/relative");
assert.equal(document.html.includes("Discover <strong>Norixo</strong>"), true);

assert.deepEqual(
  extractHtmlAnchors({ ...document, isHtml: false }),
  { documentUrl: document.url, anchorCount: 0, anchors: [] },
);
assert.deepEqual(
  extractHtmlAnchors({ ...document, isEmpty: true }),
  { documentUrl: document.url, anchorCount: 0, anchors: [] },
);

console.info("Backlink HTML anchor extractor smoke passed.");

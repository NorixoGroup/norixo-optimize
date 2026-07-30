import assert from "node:assert/strict";

import { buildHtmlLinkObservations } from "../lib/backlinks/html";
import type {
  HtmlAnchorExtractionResult,
  ParsedHtmlDocument,
} from "../lib/backlinks/html";

const document: ParsedHtmlDocument = {
  url: "https://example.com/blog/page",
  status: 200,
  contentType: "text/html",
  html: "<html></html>",
  fetchedAt: "2026-07-31T12:00:00.000Z",
  baseUrl: "/assets/",
  isHtml: true,
  isEmpty: false,
};

const extraction: HtmlAnchorExtractionResult = {
  documentUrl: "https://different.example/document",
  anchorCount: 11,
  anchors: [
    { index: 0, href: "http://other.example/path", text: "HTTP", rel: [] },
    { index: 1, href: "https://secure.example/path", text: "HTTPS", rel: [] },
    { index: 2, href: "guide", text: "Relative", rel: ["nofollow"] },
    { index: 3, href: "//cdn.example.com/file", text: "Protocol", rel: [] },
    { index: 4, href: "#pricing", text: "Fragment", rel: [] },
    { index: 5, href: "mailto:test@example.com", text: "Mail", rel: [] },
    { index: 6, href: "tel:+33123456789", text: "Phone", rel: [] },
    { index: 7, href: "javascript:void(0)", text: "Script", rel: [] },
    { index: 8, href: "data:text/plain,hello", text: "Other", rel: [] },
    { index: 9, text: "Missing", rel: [] },
    { index: 10, href: "guide", text: "Duplicate", rel: [] },
  ],
};

const result = buildHtmlLinkObservations(document, extraction);
assert.equal(result.documentUrl, document.url);
assert.equal(result.effectiveBaseUrl, "https://example.com/assets/");
assert.equal(result.linkCount, 11);
assert.deepEqual(
  result.links.map((link) => link.index),
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
);
assert.equal(result.links[0]?.resolvedUrl, "http://other.example/path");
assert.equal(result.links[1]?.resolvedUrl, "https://secure.example/path");
assert.equal(result.links[2]?.resolvedUrl, "https://example.com/assets/guide");
assert.equal(result.links[3]?.resolvedUrl, "https://cdn.example.com/file");
assert.equal(result.links[4]?.hrefKind, "fragment");
assert.equal(result.links[5]?.hrefKind, "mailto");
assert.equal(result.links[6]?.hrefKind, "tel");
assert.equal(result.links[7]?.hrefKind, "javascript");
assert.equal(result.links[8]?.hrefKind, "other_scheme");
assert.equal(result.links[9]?.hrefKind, "empty");
assert.equal(result.links[10]?.resolvedUrl, "https://example.com/assets/guide");
assert.deepEqual(extraction.anchors[2]?.rel, ["nofollow"]);
assert.equal(extraction.documentUrl, "https://different.example/document");
assert.equal(document.baseUrl, "/assets/");

const relativeBaseResult = buildHtmlLinkObservations(
  { ...document, baseUrl: "../resources/" },
  { ...extraction, anchors: [{ index: 0, href: "tool", text: "Tool", rel: [] }] },
);
assert.equal(relativeBaseResult.effectiveBaseUrl, "https://example.com/resources/");
assert.equal(relativeBaseResult.links[0]?.resolvedUrl, "https://example.com/resources/tool");

const invalidBaseResult = buildHtmlLinkObservations(
  { ...document, baseUrl: "javascript:alert(1)" },
  { ...extraction, anchors: [{ index: 0, href: "tool", text: "Tool", rel: [] }] },
);
assert.equal(invalidBaseResult.effectiveBaseUrl, "https://example.com/blog/page");
assert.equal(invalidBaseResult.links[0]?.resolvedUrl, "https://example.com/blog/tool");

const invalidHrefResult = buildHtmlLinkObservations(
  document,
  { ...extraction, anchors: [{ index: 0, href: "http://", text: "Invalid", rel: [] }] },
);
assert.equal(invalidHrefResult.links[0]?.hrefKind, "invalid");

assert.deepEqual(
  buildHtmlLinkObservations({ ...document, isHtml: false }, extraction),
  {
    documentUrl: document.url,
    effectiveBaseUrl: "https://example.com/assets/",
    linkCount: 0,
    links: [],
  },
);
assert.deepEqual(
  buildHtmlLinkObservations({ ...document, isEmpty: true }, extraction),
  {
    documentUrl: document.url,
    effectiveBaseUrl: "https://example.com/assets/",
    linkCount: 0,
    links: [],
  },
);

console.info("Backlink link observation builder smoke passed.");

import assert from "node:assert/strict";

import { parseHtmlDocument } from "../lib/backlinks/html";

const completeDocument = {
  url: "https://example.com/document",
  status: 200,
  contentType: "text/html; charset=utf-8",
  body: "<!doctype html><html lang=\" fr-FR \"><head><title> Norixo   Resource </title><base href=\" https://norixo.io/ \"></head><body></body></html>",
  fetchedAt: "2026-07-31T12:00:00.000Z",
};

const parsedCompleteDocument = parseHtmlDocument(completeDocument);
assert.equal(parsedCompleteDocument.isHtml, true);
assert.equal(parsedCompleteDocument.isEmpty, false);
assert.equal(parsedCompleteDocument.title, "Norixo Resource");
assert.equal(parsedCompleteDocument.language, "fr-FR");
assert.equal(parsedCompleteDocument.baseUrl, "https://norixo.io/");

const detectedDocument = parseHtmlDocument({
  ...completeDocument,
  contentType: null,
  body: "  <html><head><title>Detected</title></head><body></body></html>",
});
assert.equal(detectedDocument.isHtml, true);

const jsonDocument = parseHtmlDocument({
  ...completeDocument,
  contentType: "application/json",
  body: '{"title":"not html"}',
});
assert.equal(jsonDocument.isHtml, false);

const emptyDocument = parseHtmlDocument({
  ...completeDocument,
  body: "   ",
});
assert.equal(emptyDocument.isEmpty, true);
assert.equal(emptyDocument.title, undefined);

const bomDocument = parseHtmlDocument({
  ...completeDocument,
  body: "\uFEFF<html><head><title>BOM removed</title></head></html>",
});
assert.equal(bomDocument.html.startsWith("\uFEFF"), false);
assert.equal(completeDocument.body.startsWith("\uFEFF"), false);
assert.equal(completeDocument.body, "<!doctype html><html lang=\" fr-FR \"><head><title> Norixo   Resource </title><base href=\" https://norixo.io/ \"></head><body></body></html>");

console.info("Backlink HTML document parser smoke passed.");

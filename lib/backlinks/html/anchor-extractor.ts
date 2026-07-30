import { load } from "cheerio";

import type {
  HtmlAnchorExtractionResult,
  HtmlAnchorObservation,
  ParsedHtmlDocument,
} from "./types";

function normalizeOptionalAttribute(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === "" ? undefined : normalized;
}

function normalizeAnchorText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeRel(value: string | undefined): string[] {
  const normalized = normalizeOptionalAttribute(value);
  return normalized == null ? [] : normalized.split(/\s+/);
}

export function extractHtmlAnchors(document: ParsedHtmlDocument): HtmlAnchorExtractionResult {
  if (!document.isHtml || document.isEmpty) {
    return {
      documentUrl: document.url,
      anchorCount: 0,
      anchors: [],
    };
  }

  const $ = load(document.html);
  const anchors: HtmlAnchorObservation[] = $("a")
    .toArray()
    .map((element, index) => ({
      ...(normalizeOptionalAttribute($(element).attr("href")) == null
        ? {}
        : { href: normalizeOptionalAttribute($(element).attr("href")) }),
      text: normalizeAnchorText($(element).text()),
      rel: normalizeRel($(element).attr("rel")),
      ...(normalizeOptionalAttribute($(element).attr("target")) == null
        ? {}
        : { target: normalizeOptionalAttribute($(element).attr("target")) }),
      ...(normalizeOptionalAttribute($(element).attr("title")) == null
        ? {}
        : { title: normalizeOptionalAttribute($(element).attr("title")) }),
      index,
    }));

  return {
    documentUrl: document.url,
    anchorCount: anchors.length,
    anchors,
  };
}

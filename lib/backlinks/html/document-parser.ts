import { load } from "cheerio";

import type { HtmlDocumentInput, ParsedHtmlDocument } from "./types";

const htmlContentTypes = new Set(["text/html", "application/xhtml+xml"]);
const knownNonHtmlContentTypes = ["application/json", "text/plain", "application/pdf", "image/", "video/"];
const htmlMarkers = /^\s*(?:<!doctype\s+html\b|<html\b|<head\b|<body\b)/i;

function normalizeOptionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === "" ? undefined : normalized;
}

function normalizeTitle(value: string): string | undefined {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized === "" ? undefined : normalized;
}

function isHtmlContent(contentType: string | null, html: string): boolean {
  const normalizedContentType = contentType?.split(";", 1)[0]?.trim().toLowerCase();

  if (normalizedContentType != null && htmlContentTypes.has(normalizedContentType)) {
    return true;
  }

  if (
    normalizedContentType != null &&
    knownNonHtmlContentTypes.some((type) => normalizedContentType === type || normalizedContentType.startsWith(type))
  ) {
    return false;
  }

  return htmlMarkers.test(html);
}

export function parseHtmlDocument(input: HtmlDocumentInput): ParsedHtmlDocument {
  const html = input.body.startsWith("\uFEFF") ? input.body.slice(1) : input.body;
  const isEmpty = html.trim() === "";
  const isHtml = isHtmlContent(input.contentType, html);
  const document: ParsedHtmlDocument = {
    url: input.url,
    status: input.status,
    contentType: input.contentType,
    html,
    fetchedAt: input.fetchedAt,
    isHtml,
    isEmpty,
  };

  if (!isHtml || isEmpty) {
    return document;
  }

  const $ = load(html);
  const title = normalizeTitle($("title").first().text());
  const language = normalizeOptionalValue($("html").first().attr("lang"));
  const baseUrl = normalizeOptionalValue($("base").first().attr("href"));

  return {
    ...document,
    ...(title == null ? {} : { title }),
    ...(language == null ? {} : { language }),
    ...(baseUrl == null ? {} : { baseUrl }),
  };
}

import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";

import { fetchUnlockedHtml } from "../lib/brightdata";

function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

loadDotEnvLocal();

const TARGET_URL =
  process.argv[2] ??
  "https://www.airbnb.fr/rooms/40771562?adults=4&check_in=2026-05-20&check_out=2026-05-25&guests=4";

const MAX_HITS = 60;
const SEARCH_TERMS = ["901", "€", "eur", "total", "price", "amount", "rate", "nightly", "localized"];
const PATH_HINT_RE = /price|amount|total|rate|nightly|localized|displayprice|discountedprice|priceitems/i;
const VALUE_HINT_RE =
  /901|€|\beur\b|\btotal\b|\bprice\b|\bamount\b|\brate\b|\bnightly\b|\blocalized\b/i;

type SearchHit = {
  blobLabel: string;
  path: string;
  key: string;
  valuePreview: string;
  parentKeys: string[];
  parentPreview: string;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function safePreview(value: unknown, maxLen = 220): string {
  if (value == null) return String(value);

  try {
    const json = JSON.stringify(value, (_, entry) => {
      if (typeof entry === "string" && entry.length > 180) {
        return `${entry.slice(0, 180)}...`;
      }
      return entry;
    });
    if (!json) return String(value);
    return json.length > maxLen ? `${json.slice(0, maxLen)}...` : json;
  } catch {
    return `[unserializable:${Array.isArray(value) ? "array" : typeof value}]`;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/");
}

function extractBalancedJsonSubstring(source: string, startIndex: number): string | null {
  const opening = source[startIndex];
  const closing = opening === "{" ? "}" : opening === "[" ? "]" : null;
  if (!closing) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === opening) depth += 1;
    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function parseLooseJsonFromScript(raw: string): unknown | null {
  const trimmed = raw.trim();
  const startIndex = trimmed.search(/[\[{]/);
  if (startIndex === -1) return null;

  const balanced = extractBalancedJsonSubstring(trimmed, startIndex);
  if (!balanced) return null;

  try {
    return JSON.parse(balanced);
  } catch {
    return null;
  }
}

function extractJsonValueAfterMarker(source: string, marker: string): unknown | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;

  const afterMarker = source.slice(markerIndex + marker.length);
  const jsonStartOffset = afterMarker.search(/[\[{]/);
  if (jsonStartOffset === -1) return null;

  const jsonStart = markerIndex + marker.length + jsonStartOffset;
  const jsonString = extractBalancedJsonSubstring(source, jsonStart);
  if (!jsonString) return null;

  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

function extractJsonLd(html: string): unknown[] {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      blocks.push(JSON.parse(decodeHtmlEntities(raw)));
    } catch {
      const parsed = parseLooseJsonFromScript(decodeHtmlEntities(raw));
      if (parsed) blocks.push(parsed);
    }
  });

  return blocks;
}

function extractStructuredScriptData(html: string): unknown[] {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];

  $("script").each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw || raw.length < 2) return;
    if (!(raw.startsWith("{") || raw.startsWith("["))) return;

    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // ignore
    }
  });

  return blocks;
}

function extractBootstrapLikeData(html: string): Array<{ label: string; data: unknown }> {
  const $ = cheerio.load(html);
  const blocks: Array<{ label: string; data: unknown }> = [];

  $("script").each((index, el) => {
    const raw = $(el).html();
    if (!raw) return;

    const attrs = {
      id: $(el).attr("id") ?? null,
      type: $(el).attr("type") ?? null,
      deferredState: $(el).attr("data-deferred-state") ?? null,
      state: $(el).attr("data-state") ?? null,
    };

    const label = `script#${index}:${attrs.id ?? "no-id"}:${attrs.type ?? "text/javascript"}`;

    if (raw.includes("window.__INITIAL_STATE__")) {
      const parsed = extractJsonValueAfterMarker(raw, "window.__INITIAL_STATE__");
      if (parsed) blocks.push({ label: `${label}:__INITIAL_STATE__`, data: parsed });
    }

    if (raw.includes("niobeMinimalClientData")) {
      const parsed = extractJsonValueAfterMarker(raw, "niobeMinimalClientData");
      if (parsed) blocks.push({ label: `${label}:niobeMinimalClientData`, data: parsed });
    }

    if (attrs.deferredState || /application\/json|text\/json/i.test(attrs.type ?? "")) {
      const parsed = parseLooseJsonFromScript(raw);
      if (parsed) blocks.push({ label: `${label}:jsonish`, data: parsed });
    }
  });

  return blocks;
}

function collectHits(
  value: unknown,
  blobLabel: string,
  hits: SearchHit[],
  path: string[] = [],
  parent: Record<string, unknown> | null = null
): void {
  if (hits.length >= MAX_HITS) return;
  if (value == null) return;

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      if (hits.length >= MAX_HITS) return;
      collectHits(entry, blobLabel, hits, [...path, String(index)], parent);
    });
    return;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    Object.entries(record).forEach(([key, entry]) => {
      if (hits.length >= MAX_HITS) return;

      const currentPath = [...path, key];
      const pathText = currentPath.join(".");

      if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
        const rawText = typeof entry === "string" ? entry : String(entry);
        const normalizedText = normalizeWhitespace(rawText);
        const matchesValue = VALUE_HINT_RE.test(normalizedText);
        const matchesPath = PATH_HINT_RE.test(pathText);

        if (matchesValue || matchesPath) {
          hits.push({
            blobLabel,
            path: pathText,
            key,
            valuePreview: safePreview(entry, 220),
            parentKeys: parent ? Object.keys(parent).slice(0, 25) : Object.keys(record).slice(0, 25),
            parentPreview: safePreview(parent ?? record, 500),
          });
        }
      }

      collectHits(entry, blobLabel, hits, currentPath, record);
    });
  }
}

async function main() {
  console.log(
    JSON.stringify({
      event: "debug_airbnb_target_price_start",
      targetUrl: TARGET_URL,
      searchTerms: SEARCH_TERMS,
    })
  );

  const html = await fetchUnlockedHtml(TARGET_URL, {
    platform: "airbnb",
    preferredTransport: "proxy",
  });

  const bootstrapBlocks = extractBootstrapLikeData(html);
  const structuredBlocks = extractStructuredScriptData(html);
  const jsonLdBlocks = extractJsonLd(html);

  const blobs: Array<{ label: string; data: unknown }> = [
    ...bootstrapBlocks,
    ...structuredBlocks.map((data, index) => ({ label: `structuredScriptData#${index}`, data })),
    ...jsonLdBlocks.map((data, index) => ({ label: `jsonLd#${index}`, data })),
  ];

  const hits: SearchHit[] = [];
  blobs.forEach(({ label, data }) => {
    if (hits.length >= MAX_HITS) return;
    collectHits(data, label, hits);
  });

  const uniqueHits = Array.from(
    new Map(hits.map((hit) => [`${hit.blobLabel}:${hit.path}:${hit.valuePreview}`, hit])).values()
  );

  console.log(
    JSON.stringify({
      event: "debug_airbnb_target_price_summary",
      targetUrl: TARGET_URL,
      htmlLength: html.length,
      bootstrapBlocksCount: bootstrapBlocks.length,
      structuredBlocksCount: structuredBlocks.length,
      jsonLdBlocksCount: jsonLdBlocks.length,
      hitsCount: uniqueHits.length,
    })
  );

  uniqueHits.slice(0, MAX_HITS).forEach((hit, index) => {
    console.log(
      JSON.stringify({
        event: "debug_airbnb_target_price_hit",
        index: index + 1,
        ...hit,
      })
    );
  });
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      event: "debug_airbnb_target_price_error",
      message: error instanceof Error ? error.message : String(error),
    })
  );
  process.exitCode = 1;
});

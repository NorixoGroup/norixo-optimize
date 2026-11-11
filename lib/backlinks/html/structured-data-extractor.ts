import { load } from "cheerio";

import type { HtmlStructuredDataExtractionResult, HtmlStructuredPersonObservation, ParsedHtmlDocument } from "./types";

const MAX_SCRIPT_TAGS = 10;
const MAX_SCRIPT_LENGTH = 50_000;
const MAX_GRAPH_ITEMS = 50;
const MAX_FIELD_LENGTH = 200;
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function normalizeBoundedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized === "" || normalized.length > MAX_FIELD_LENGTH ? null : normalized;
}

function normalizeEmailValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return EMAIL.test(normalized) ? normalized : null;
}

function isPersonType(value: unknown): boolean {
  if (typeof value === "string") return value === "Person";
  return Array.isArray(value) && value.includes("Person");
}

function toPersonObservation(entry: unknown): HtmlStructuredPersonObservation | null {
  if (typeof entry !== "object" || entry == null || Array.isArray(entry)) return null;
  const record = entry as Record<string, unknown>;
  if (!isPersonType(record["@type"])) return null;
  const email = normalizeEmailValue(record.email);
  if (email == null) return null;
  return { email, name: normalizeBoundedText(record.name), jobTitle: normalizeBoundedText(record.jobTitle) };
}

/**
 * Only a fixed, shallow shape is understood: a single object, a top-level
 * array of objects, or an object with a `@graph` array. No recursion into
 * nested properties, and the number of flattened entries is capped.
 */
function flattenJsonLdEntries(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed.slice(0, MAX_GRAPH_ITEMS);
  if (typeof parsed === "object" && parsed != null) {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record["@graph"])) return (record["@graph"] as unknown[]).slice(0, MAX_GRAPH_ITEMS);
    return [parsed];
  }
  return [];
}

/**
 * Extracts schema.org Person entries from JSON-LD <script> tags only; never
 * throws on malformed input. Both the number and the size of scripts read,
 * and the number of entries flattened per script, are bounded.
 */
export function extractStructuredPersons(document: ParsedHtmlDocument): HtmlStructuredDataExtractionResult {
  if (!document.isHtml || document.isEmpty) {
    return { documentUrl: document.url, persons: [] };
  }
  const $ = load(document.html);
  const scripts = $('script[type="application/ld+json"]').toArray().slice(0, MAX_SCRIPT_TAGS);
  const persons: HtmlStructuredPersonObservation[] = [];
  for (const script of scripts) {
    const raw = $(script).text();
    if (raw.length === 0 || raw.length > MAX_SCRIPT_LENGTH) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    for (const entry of flattenJsonLdEntries(parsed)) {
      const person = toPersonObservation(entry);
      if (person != null) persons.push(person);
    }
  }
  return { documentUrl: document.url, persons };
}

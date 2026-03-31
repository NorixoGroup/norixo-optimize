import * as cheerio from "cheerio";
import { fetchUnlockedPageData } from "@/lib/brightdata";
import {
  buildFieldMeta,
  buildPhotoMeta,
  inferDescriptionQuality,
  inferTitleQuality,
} from "./quality";
import {
  dedupeImageUrls,
  extractImageUrlsFromUnknown,
  normalizeWhitespace,
  uniqueStrings,
} from "./shared";
import type { ExtractorResult } from "./types";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

type TextCandidate = {
  source: string;
  value: string;
};

type NumberCandidate = {
  source: string;
  value: number;
  scale?: number | null;
};

type TotalHint = {
  source: string;
  count: number;
};

type PreviewCandidate = {
  source: string;
  value: string;
};

type KeySummary = {
  source: string;
  keys: string[];
};

function debugVrboLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

function isNoiseSourcePath(path: string): boolean {
  const lower = path.toLowerCase();
  return [
    "landingdiscovery",
    "offers.groups",
    ".cards.",
    "applicationname",
    "uisprime",
    "track",
    "trvl-px",
    "ppid",
    "beacon",
    "analytics",
    "telemetry",
    "demandsolutions",
    "exp-aws",
    "onetrust",
    "config.json",
    "cookieconsent",
  ].some((needle) => lower.includes(needle));
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseMaybeNumber(text: string): number | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const match = normalized.match(/-?\d+(?:[.,]\d+)?/);
  if (!match?.[0]) return null;

  const value = Number.parseFloat(match[0].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function findFirstMatchNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = parseMaybeNumber(match[1]);
    if (value != null) return value;
  }
  return null;
}

function findAllMatchNumbers(text: string, patterns: RegExp[]): number[] {
  const values: number[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (!match[1]) continue;
      const parsed = parseMaybeNumber(match[1]);
      if (parsed != null) values.push(parsed);
    }
  }
  return values;
}

function collectNearbySectionText(
  $: cheerio.CheerioAPI,
  headingPatterns: RegExp[],
  maxItems = 8
): string[] {
  const values: string[] = [];

  $("h1, h2, h3, h4, strong").each((_, el) => {
    const headingText = normalizeWhitespace($(el).text());
    if (!headingPatterns.some((pattern) => pattern.test(headingText))) return;

    const container =
      $(el).closest("section, article, div").first().length > 0
        ? $(el).closest("section, article, div").first()
        : $(el).parent();

    container
      .find("p, li, span")
      .each((__, node) => {
        const text = normalizeWhitespace($(node).text());
        if (!text) return;
        values.push(text);
      });
  });

  return uniqueStrings(values).slice(0, maxItems);
}

function collectNearbySectionParagraphs(
  $: cheerio.CheerioAPI,
  headingPatterns: RegExp[],
  maxItems = 12
): string[] {
  const values: string[] = [];

  $("h1, h2, h3, h4, strong").each((_, el) => {
    const headingText = normalizeWhitespace($(el).text());
    if (!headingPatterns.some((pattern) => pattern.test(headingText))) return;

    const container =
      $(el).closest("section, article, div").first().length > 0
        ? $(el).closest("section, article, div").first()
        : $(el).parent();

    container
      .find("p")
      .each((__, node) => {
        const text = normalizeWhitespace($(node).text());
        if (!text) return;
        values.push(text);
      });
  });

  return uniqueStrings(values).slice(0, maxItems);
}

function extractVisibleTextNodes(
  $: cheerio.CheerioAPI,
  selectors: string,
  maxItems = 20
): string[] {
  return uniqueStrings(
    $(selectors)
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get()
      .filter(Boolean)
  ).slice(0, maxItems);
}

function extractVrboDescriptionFromDom($: cheerio.CheerioAPI): string {
  const sectionText = collectNearbySectionParagraphs(
    $,
    [/à propos de/i, /plus de détails/i, /description/i, /about this property/i, /details/i],
    20
  ).join(" ");

  const directText = [
    ...$('[data-stid*="description"] p, [data-stid*="summary"] p, [class*="description"] p')
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get(),
    ...$('[data-stid*="description"], [data-stid*="summary"], [class*="description"]')
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get(),
  ]
    .filter(Boolean)
    .join(" ");

  return normalizeWhitespace([sectionText, directText].filter(Boolean).join(" "));
}

function parseVrboPhotoCountFromText(text: string): number | null {
  return findFirstMatchNumber(text, [
    /(\d{1,3})\s*\/\s*(?:\d{1,3}\s*)?photos?/i,
    /(?:voir|afficher|toutes?|all)\s+(?:les\s+)?(?:\w+\s+)?(\d{1,3})\s+photos?/i,
    /(\d{1,3})\s+photos?/i,
  ]);
}

function extractLocationFromTitle(value: string): string | null {
  const normalized = normalizeWhitespace(value);
  const parts = normalized.split(",").map((part) => normalizeWhitespace(part)).filter(Boolean);
  if (parts.length < 2) return null;

  const tail = parts[parts.length - 1];
  return tail.length >= 3 && tail.length <= 80 ? tail : null;
}

function normalizeTitle(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\s+[|:-]\s+(?:vrbo|abritel|homeaway|expedia|hotels\.com).*$/i, "")
      .replace(/^(?:vrbo|abritel|homeaway)\s*[:|-]\s*/i, "")
  );
}

function normalizeTextCandidate(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\s+[|:-]\s+(?:vrbo|abritel|homeaway|expedia|hotels\.com).*$/i, "")
      .trim()
  );
}

function isGenericTitle(value: string): boolean {
  const normalized = normalizeTitle(value).toLowerCase();
  if (!normalized || normalized.length < 8) return true;

  return [
    "vrbo",
    "abritel",
    "homeaway",
    "expedia",
    "hotels.com",
    "vacation rental",
    "holiday rental",
    "uis-prime-track-api-v2",
  ].some((needle) => normalized === needle || normalized.startsWith(`${needle} `));
}

function isBadTitleSource(source: string): boolean {
  const lower = source.toLowerCase();
  return (
    lower.endsWith(".applicationname") ||
    lower.endsWith(".appname") ||
    lower.includes(".tracking") ||
    lower.includes(".analytics") ||
    lower.includes(".telemetry")
  );
}

function isBadDescriptionValue(value: string): boolean {
  const lower = normalizeWhitespace(value).toLowerCase();
  if (!lower) return true;

  return (
    lower.startsWith("passer à la section principale") ||
    lower.includes("ouvrez l’appli carnets de voyages") ||
    lower.includes("publier votre annonce") ||
    lower.includes("se connecter") ||
    lower.includes("téléchargez l’application") ||
    lower.includes("download the app") ||
    lower.includes("sign in") ||
    lower.includes("aidevoyages") ||
    lower.includes("avis voyageurs") ||
    lower.includes("animaux de compagnie seront affichés") ||
    lower.includes("de 2 à 17 ans")
  );
}

function previewCandidates(candidates: TextCandidate[], limit = 8): PreviewCandidate[] {
  return candidates
    .map((candidate) => ({
      source: candidate.source,
      value: normalizeWhitespace(candidate.value).slice(0, 180),
    }))
    .filter((candidate) => candidate.value.length > 0)
    .slice(0, limit);
}

function summarizeTopLevelKeys(value: unknown, source: string): KeySummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    source,
    keys: Object.keys(value as Record<string, unknown>).slice(0, 20),
  };
}

function previewValues(values: string[], limit = 12): string[] {
  return uniqueStrings(values.map((value) => normalizeWhitespace(value)).filter(Boolean)).slice(0, limit);
}

function isLikelyVrboListingPhotoUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;

  const lower = value.toLowerCase();
  if (
    lower.includes("thumbnail") ||
    lower.includes("thumb") ||
    lower.includes("icon") ||
    lower.includes("logo") ||
    lower.includes("avatar") ||
    lower.includes("placeholder") ||
    lower.includes("map") ||
    lower.includes("sprite")
  ) {
    return false;
  }

  return (
    lower.includes("vrbo.com") ||
    lower.includes("homeaway.com") ||
    lower.includes("abritel") ||
    lower.includes("vrbo-static.com") ||
    lower.includes("expediacdn.com") ||
    lower.includes("travel-assets.com") ||
    lower.includes("trvl-media.com") ||
    lower.includes("mediaim.expedia.com")
  );
}

function parseVrboExternalId(url: string): string | null {
  const pathMatch = url.match(/\/(?:p\/)?(\d+)(?:[/?#]|$)/i);
  if (pathMatch?.[1]) return pathMatch[1];

  const queryMatch = url.match(/[?&](?:propertyId|listingId|id)=([^&#]+)/i);
  return queryMatch?.[1] ?? null;
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const blocks: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;

    const parsed = safeJsonParse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (item && typeof item === "object") {
          blocks.push(item as Record<string, unknown>);
        }
      });
      return;
    }

    if (parsed && typeof parsed === "object") {
      blocks.push(parsed as Record<string, unknown>);
    }
  });

  return blocks;
}

function extractJsonLdAmenityCandidates(jsonLdBlocks: Record<string, unknown>[]): string[] {
  return uniqueStrings(
    jsonLdBlocks.flatMap((block) => {
      const amenityFeature = block.amenityFeature;
      if (!Array.isArray(amenityFeature)) return [];
      return amenityFeature.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const name = typeof record.name === "string" ? record.name : "";
        return name ? [normalizeWhitespace(name)] : [];
      });
    })
  );
}

function extractJsonLdHostCandidates(jsonLdBlocks: Record<string, unknown>[]): string[] {
  return uniqueStrings(
    jsonLdBlocks.flatMap((block) => {
      const provider = block.provider;
      if (!provider || typeof provider !== "object") return [];
      const record = provider as Record<string, unknown>;
      return typeof record.name === "string" ? [normalizeWhitespace(record.name)] : [];
    })
  );
}

function extractStructuredScriptData(html: string): unknown[] {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];

  $("script").each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw || raw.length < 2) return;

    if (raw.startsWith("{") || raw.startsWith("[")) {
      const direct = safeJsonParse(raw);
      if (direct != null) {
        blocks.push(direct);
        return;
      }
    }

    const assignmentPatterns = [
      /__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/,
      /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/,
      /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?})\s*;/,
      /window\.__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*;/,
    ];

    for (const pattern of assignmentPatterns) {
      const match = raw.match(pattern);
      if (!match?.[1]) continue;
      const parsed = safeJsonParse(match[1]);
      if (parsed != null) {
        blocks.push(parsed);
        break;
      }
    }
  });

  return blocks;
}

function collectStringValuesByKeyPattern(
  value: unknown,
  pattern: RegExp,
  path = "root",
  depth = 0
): TextCandidate[] {
  if (depth > 10 || value == null) return [];

  if (typeof value === "string") return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectStringValuesByKeyPattern(item, pattern, `${path}.${index}`, depth + 1)
    );
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.entries(record).flatMap(([key, entry]) => {
      const nextPath = `${path}.${key}`;
      if (isNoiseSourcePath(nextPath)) return [];
      const direct =
        pattern.test(key) && typeof entry === "string"
          ? [{ source: nextPath, value: normalizeTextCandidate(entry) }]
          : [];
      return [...direct, ...collectStringValuesByKeyPattern(entry, pattern, nextPath, depth + 1)];
    });
  }

  return [];
}

function collectNumberValuesByKeyPattern(
  value: unknown,
  pattern: RegExp,
  path = "root",
  depth = 0
): NumberCandidate[] {
  if (depth > 10 || value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectNumberValuesByKeyPattern(item, pattern, `${path}.${index}`, depth + 1)
    );
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.entries(record).flatMap(([key, entry]) => {
      const nextPath = `${path}.${key}`;
      if (isNoiseSourcePath(nextPath)) return [];
      const direct =
        pattern.test(key) && (typeof entry === "number" || typeof entry === "string")
          ? (() => {
              const parsed =
                typeof entry === "number" ? entry : parseMaybeNumber(normalizeWhitespace(entry));
              if (parsed == null) return [];
              return [{ source: nextPath, value: parsed }];
            })()
          : [];
      return [...direct, ...collectNumberValuesByKeyPattern(entry, pattern, nextPath, depth + 1)];
    });
  }

  return [];
}

function collectArrayLengthHintsByKeyPattern(
  value: unknown,
  pattern: RegExp,
  path = "root",
  depth = 0
): TotalHint[] {
  if (depth > 10 || value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectArrayLengthHintsByKeyPattern(item, pattern, `${path}.${index}`, depth + 1)
    );
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.entries(record).flatMap(([key, entry]) => {
      const nextPath = `${path}.${key}`;
      if (isNoiseSourcePath(nextPath)) return [];
      const direct =
        pattern.test(key) && Array.isArray(entry) && entry.length > 0
          ? [{ source: nextPath, count: entry.length }]
          : [];
      return [
        ...direct,
        ...collectArrayLengthHintsByKeyPattern(entry, pattern, nextPath, depth + 1),
      ];
    });
  }

  return [];
}

function pickBestTitleCandidate(candidates: TextCandidate[]): TextCandidate | null {
  const scored = candidates
    .map((candidate) => {
      if (isBadTitleSource(candidate.source)) return null;
      const value = normalizeTitle(candidate.value);
      if (!value || isGenericTitle(value)) return null;

      let score = value.length;
      const lowerSource = candidate.source.toLowerCase();
      if (lowerSource.includes("payload")) score += 300;
      if (lowerSource.includes("json_embedded")) score += 250;
      if (lowerSource.includes("h1")) score += 220;
      if (lowerSource.includes("json_ld")) score += 180;
      if (lowerSource.includes("og:title")) score += 120;
      if (lowerSource.includes("document_title")) score += 80;
      if (value.length < 18) score -= 120;
      if (value.length > 140) score -= 80;

      return {
        source: candidate.source,
        value,
        score,
      };
    })
    .filter((candidate): candidate is { source: string; value: string; score: number } =>
      Boolean(candidate)
    )
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  return { source: scored[0].source, value: scored[0].value };
}

function scoreDescriptionCandidate(candidate: TextCandidate): number {
  const value = normalizeWhitespace(candidate.value);
  if (!value) return -1;
  if (isBadDescriptionValue(value)) return -1;

  const lowerSource = candidate.source.toLowerCase();
  const lowerValue = value.toLowerCase();
  let score = Math.min(value.length, 2000);

  if (lowerSource.includes("payload")) score += 320;
  if (lowerSource.includes("json_embedded")) score += 260;
  if (lowerSource.includes("description")) score += 220;
  if (lowerSource.includes("summary")) score += 120;
  if (lowerSource.includes("about")) score += 120;
  if (lowerSource.includes("json_ld")) score += 100;
  if (lowerSource.includes("meta_description")) score -= 160;
  if (lowerSource.includes("og_description")) score -= 120;
  if (lowerSource.includes("body_fallback")) score -= 300;
  if (lowerSource.includes("host")) score -= 180;
  if (lowerSource.includes("rule")) score -= 180;

  if (value.length < 120) score -= 260;
  if (value.length > 1800) score -= 120;
  if (!/[.!?]/.test(value)) score -= 60;
  if (
    lowerValue.includes("cookie") ||
    lowerValue.includes("privacy") ||
    lowerValue.includes("terms") ||
    lowerValue.includes("sign in") ||
    lowerValue.includes("download the app")
  ) {
    score -= 600;
  }

  return score;
}

function pickBestDescriptionCandidate(candidates: TextCandidate[]): TextCandidate | null {
  const scored = candidates
    .map((candidate) => ({
      source: candidate.source,
      value: normalizeWhitespace(candidate.value),
      score: scoreDescriptionCandidate(candidate),
    }))
    .filter((candidate) => candidate.value.length > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  return { source: scored[0].source, value: scored[0].value };
}

function extractAmenityStrings(value: unknown, path = "root", depth = 0): TextCandidate[] {
  if (depth > 8 || value == null) return [];

  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    if (!normalized) return [];
    return [{ source: path, value: normalized }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => extractAmenityStrings(item, `${path}.${index}`, depth + 1));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const directValues = ["name", "label", "title", "text", "value"].flatMap((key) =>
      typeof record[key] === "string"
        ? isNoiseSourcePath(`${path}.${key}`)
          ? []
          : [{ source: `${path}.${key}`, value: normalizeWhitespace(record[key] as string) }]
        : []
    );

    return [
      ...directValues,
      ...Object.entries(record).flatMap(([key, entry]) =>
        isNoiseSourcePath(`${path}.${key}`)
          ? []
          :
        /amenit|feature|facility|highlight/i.test(key)
          ? extractAmenityStrings(entry, `${path}.${key}`, depth + 1)
          : []
      ),
    ];
  }

  return [];
}

function looksUsefulAmenity(value: string): boolean {
  const normalized = normalizeWhitespace(value);
  const lower = normalized.toLowerCase();
  if (!normalized || normalized.length < 3 || normalized.length > 80) return false;

  if (
    lower.includes("cookie") ||
    lower.includes("privacy") ||
    lower.includes("sign in") ||
    lower.includes("download") ||
    lower.includes("view all") ||
    lower.includes("see all") ||
    lower.includes("more details") ||
    lower.includes("avis voyageurs") ||
    lower.includes("exceptionnel") ||
    lower.includes("photo") ||
    lower.includes("carte")
  ) {
    return false;
  }

  return [
    "wifi",
    "internet",
    "wi-fi",
    "kitchen",
    "cuisine",
    "pool",
    "piscine",
    "parking",
    "air conditioning",
    "climatisation",
    "washer",
    "lave-linge",
    "dryer",
    "sèche-linge",
    "tv",
    "télévision",
    "heating",
    "chauffage",
    "beach",
    "plage",
    "balcony",
    "balcon",
    "hot tub",
    "jacuzzi",
    "coffee",
    "café",
    "pet",
    "animaux",
    "fireplace",
    "cheminée",
    "bbq",
    "barbecue",
    "ocean view",
    "sea view",
    "vue",
    "terrasse",
  ].some((keyword) => lower.includes(keyword));
}

function buildAmenityCandidates($: cheerio.CheerioAPI, payloadBlocks: unknown[], scriptBlocks: unknown[]) {
  return uniqueStrings(
    [
      ...payloadBlocks.flatMap((block, index) =>
        extractAmenityStrings(block, `payload.${index}`)
          .map((candidate) => candidate.value)
          .filter(looksUsefulAmenity)
      ),
      ...scriptBlocks.flatMap((block, index) =>
        extractAmenityStrings(block, `json_embedded.${index}`)
          .map((candidate) => candidate.value)
          .filter(looksUsefulAmenity)
      ),
      ...extractVisibleTextNodes(
        $,
        '[data-stid*="amenit"], [class*="amenit"], [class*="feature"] li, [class*="feature"] span, [class*="amenities"] li, [class*="amenities"] span',
        50
      ).filter(looksUsefulAmenity),
      ...collectNearbySectionText($, [/équipements?/i, /amenities/i, /services?/i], 50).filter(
        looksUsefulAmenity
      ),
    ]
  ).slice(0, 60);
}

function extractRulesFromDom($: cheerio.CheerioAPI): string[] {
  return uniqueStrings(
    [
      ...collectNearbySectionText($, [/arrivée/i, /départ/i, /règlement/i, /house rules/i, /conditions?/i], 40),
      ...extractVisibleTextNodes(
        $,
        '[data-stid*="checkin"], [data-stid*="checkout"], [class*="check-in"], [class*="check-out"], [class*="house-rules"] li, [class*="house-rules"] span',
        40
      ),
    ]
  )
    .filter((value) => value.length >= 4 && value.length <= 180)
    .slice(0, 12);
}

function extractHostFromDom($: cheerio.CheerioAPI): string | null {
  const values = uniqueStrings(
    [
      ...collectNearbySectionText($, [/hôte/i, /hébergé par/i, /proposé par/i, /hosted by/i, /managed by/i], 12),
      ...extractVisibleTextNodes(
        $,
        '[data-stid*="host"], [data-stid*="owner"], [class*="host"], [class*="owner"], [class*="manager"]',
        12
      ),
    ]
  ).filter((value) => value.length >= 3 && value.length <= 120);

  return values[0] ?? null;
}

function extractStructureFromDom(bodyText: string): {
  capacity: number | null;
  bedrooms: number | null;
  bedCount: number | null;
  bathrooms: number | null;
} {
  return {
    capacity:
      findFirstMatchNumber(bodyText, [/(\d+)\s+voyageurs?/i, /(\d+)\s+guests?/i, /(\d+)\s+personnes?/i]) ??
      null,
    bedrooms:
      findFirstMatchNumber(bodyText, [/(\d+)\s+chambres?/i, /(\d+)\s+bedrooms?/i]) ?? null,
    bedCount: findFirstMatchNumber(bodyText, [/(\d+)\s+lits?/i, /(\d+)\s+beds?/i]) ?? null,
    bathrooms:
      findFirstMatchNumber(bodyText, [/(\d+(?:[.,]\d+)?)\s+salles?\s+de\s+bain/i, /(\d+(?:[.,]\d+)?)\s+bathrooms?/i]) ??
      null,
  };
}

function pickBestCountHint(hints: TotalHint[], minimum: number): TotalHint | null {
  const valid = hints
    .filter((hint) => hint.count >= minimum && hint.count <= 500)
    .sort((a, b) => b.count - a.count);
  return valid[0] ?? null;
}

function buildReviewCandidates(
  payloadBlocks: unknown[],
  scriptBlocks: unknown[],
  lodgingJson: Record<string, unknown> | null,
  $: cheerio.CheerioAPI,
  bodyText: string
): { rating: NumberCandidate | null; reviewCount: NumberCandidate | null } {
  const structuredReviewCounts = [
    ...payloadBlocks.flatMap((block, index) =>
      collectNumberValuesByKeyPattern(block, /(reviewcount|countofreviews|reviewscount)/i, `payload.${index}`)
    ),
    ...scriptBlocks.flatMap((block, index) =>
      collectNumberValuesByKeyPattern(
        block,
        /(reviewcount|countofreviews|reviewscount)/i,
        `json_embedded.${index}`
      )
    ),
  ].filter((candidate) => candidate.value >= 1 && candidate.value <= 100000);

  const structuredRatings = [
    ...payloadBlocks.flatMap((block, index) =>
      collectNumberValuesByKeyPattern(
        block,
        /(ratingvalue|averagerating|reviewscore|ratingscore|guestrating)/i,
        `payload.${index}`
      )
    ),
    ...scriptBlocks.flatMap((block, index) =>
      collectNumberValuesByKeyPattern(
        block,
        /(ratingvalue|averagerating|reviewscore|ratingscore|guestrating)/i,
        `json_embedded.${index}`
      )
    ),
  ].filter((candidate) => candidate.value > 0 && candidate.value <= 10);

  const jsonLdAggregate =
    lodgingJson &&
    typeof lodgingJson.aggregateRating === "object" &&
    lodgingJson.aggregateRating
      ? (lodgingJson.aggregateRating as Record<string, unknown>)
      : null;

  const jsonLdRating =
    jsonLdAggregate && (typeof jsonLdAggregate.ratingValue === "string" || typeof jsonLdAggregate.ratingValue === "number")
      ? {
          source: "json_ld.aggregateRating.ratingValue",
          value:
            typeof jsonLdAggregate.ratingValue === "number"
              ? jsonLdAggregate.ratingValue
              : (parseMaybeNumber(jsonLdAggregate.ratingValue) ?? 0),
          scale:
            typeof jsonLdAggregate.bestRating === "number"
              ? jsonLdAggregate.bestRating
              : typeof jsonLdAggregate.bestRating === "string"
                ? parseMaybeNumber(jsonLdAggregate.bestRating)
                : null,
        }
      : null;

  const jsonLdReviewCount =
    jsonLdAggregate &&
    (typeof jsonLdAggregate.reviewCount === "string" || typeof jsonLdAggregate.reviewCount === "number")
      ? {
          source: "json_ld.aggregateRating.reviewCount",
          value:
            typeof jsonLdAggregate.reviewCount === "number"
              ? jsonLdAggregate.reviewCount
              : (parseMaybeNumber(jsonLdAggregate.reviewCount) ?? 0),
        }
      : null;

  const domRatingText =
    $('[data-stid*="rating"], [class*="rating"], [aria-label*="rating"]')
      .map((_, el) => $(el).text())
      .get()
      .find((value) => parseMaybeNumber(value) != null) ?? "";
  const domRatingValue = parseMaybeNumber(domRatingText);
  const domRating =
    domRatingValue != null && domRatingValue > 0 && domRatingValue <= 10
      ? {
          source: "html_rating",
          value: domRatingValue,
          scale: domRatingValue <= 5 ? 5 : 10,
        }
      : null;

  const domReviewCountText =
    $('[data-stid*="review"], [class*="review-count"], [aria-label*="review"]')
      .map((_, el) => $(el).text())
      .get()
      .find((value) => /review/i.test(value) && parseMaybeNumber(value) != null) ?? "";
  const domReviewCountValue = parseMaybeNumber(domReviewCountText);
  const domReviewCount =
    domReviewCountValue != null && domReviewCountValue >= 1 && domReviewCountValue <= 100000
      ? {
          source: "html_review_count",
          value: domReviewCountValue,
        }
      : null;

  const bodyRatingValue = findFirstMatchNumber(bodyText, [
    /\b(\d{1,2}(?:[.,]\d)?)\s*(?:sur|\/)\s*10\b/i,
    /\b(\d{1,2}(?:[.,]\d)?)\s*\/\s*5\b/i,
  ]);
  const fallbackBodyRatingValue =
    bodyRatingValue ??
    findAllMatchNumbers(bodyText, [/\b(\d{1,2}(?:[.,]\d)?)\b/g])
      .find((value) => value > 0 && value <= 10) ??
    null;
  const bodyRating =
    fallbackBodyRatingValue != null && fallbackBodyRatingValue > 0 && fallbackBodyRatingValue <= 10
      ? {
          source: "body_review_rating",
          value: fallbackBodyRatingValue,
          scale: /sur\s*10|\/\s*10/i.test(bodyText) ? 10 : bodyText.includes("/5") ? 5 : 10,
        }
      : null;

  const bodyReviewCountValue = findFirstMatchNumber(bodyText, [
    /(\d+)\s+avis(?:\s+externes?)?/i,
    /(\d+)\s+reviews?/i,
  ]);
  const bodyReviewCount =
    bodyReviewCountValue != null && bodyReviewCountValue >= 1 && bodyReviewCountValue <= 100000
      ? {
          source: "body_review_count",
          value: bodyReviewCountValue,
        }
      : null;

  const ratingCandidate =
    structuredRatings[0] ??
    (jsonLdRating && jsonLdRating.value > 0 && jsonLdRating.value <= 10 ? jsonLdRating : null) ??
    domRating ??
    bodyRating;
  const reviewCountCandidate =
    structuredReviewCounts[0] ??
    (jsonLdReviewCount && jsonLdReviewCount.value >= 1 ? jsonLdReviewCount : null) ??
    domReviewCount ??
    bodyReviewCount;

  if (ratingCandidate && !ratingCandidate.scale) {
    ratingCandidate.scale = ratingCandidate.value <= 5 ? 5 : 10;
  }

  return {
    rating: ratingCandidate ?? null,
    reviewCount: reviewCountCandidate ?? null,
  };
}

export async function extractVrbo(url: string): Promise<ExtractorResult> {
  const pageData = await fetchUnlockedPageData(url, {
    payloadUrlPattern:
      /(vrbo|homeaway|abritel|property|listing|review|amenit|feature|facility|photo|gallery|location|travel-assets|trvl-media|expedia)/i,
    maxPayloads: 60,
  });
  const html = pageData.html;
  const payloadBlocks = pageData.payloads
    .map((payload) => safeJsonParse(payload.bodyText))
    .filter((block): block is unknown => block != null);

  const $ = cheerio.load(html);
  const bodyText = normalizeWhitespace($("body").text());
  const jsonLdBlocks = extractJsonLd(html);
  const structuredScriptData = extractStructuredScriptData(html);

  const lodgingJson =
    jsonLdBlocks.find((item) => {
      const type = typeof item["@type"] === "string" ? item["@type"].toLowerCase() : "";
      return ["lodgingbusiness", "house", "apartment", "residence", "vacationrental"].includes(type);
    }) ?? null;
  const jsonLdAmenityCandidates = extractJsonLdAmenityCandidates(jsonLdBlocks);
  const jsonLdHostCandidates = extractJsonLdHostCandidates(jsonLdBlocks);

  const titleCandidates: TextCandidate[] = [
    ...payloadBlocks.flatMap((block, index) =>
      collectStringValuesByKeyPattern(
        block,
        /(headline|listingname|propertyname|propertytitle|displayname|name|title)/i,
        `payload.${index}`
      )
    ),
    ...structuredScriptData.flatMap((block, index) =>
      collectStringValuesByKeyPattern(
        block,
        /(headline|listingname|propertyname|propertytitle|displayname|name|title)/i,
        `json_embedded.${index}`
      )
    ),
    { source: "h1", value: $("h1").first().text() },
    { source: "og:title", value: $('meta[property="og:title"]').attr("content") || "" },
    { source: "twitter:title", value: $('meta[name="twitter:title"]').attr("content") || "" },
    { source: "document_title", value: $("title").text() },
    {
      source: "json_ld_name",
      value: typeof lodgingJson?.name === "string" ? lodgingJson.name : "",
    },
  ];
  const selectedTitleCandidate =
    pickBestTitleCandidate(titleCandidates) ?? {
      source: "fallback_default",
      value: "Untitled Vrbo listing",
    };

  const descriptionCandidates: TextCandidate[] = [
    ...payloadBlocks.flatMap((block, index) =>
      collectStringValuesByKeyPattern(
        block,
        /(description|listingdescription|descriptiontext|summary|overview|about)/i,
        `payload.${index}`
      )
    ),
    ...structuredScriptData.flatMap((block, index) =>
      collectStringValuesByKeyPattern(
        block,
        /(description|listingdescription|descriptiontext|summary|overview|about)/i,
        `json_embedded.${index}`
      )
    ),
    {
      source: "html_description_section",
      value: extractVrboDescriptionFromDom($),
    },
    {
      source: "json_ld_description",
      value: typeof lodgingJson?.description === "string" ? lodgingJson.description : "",
    },
    {
      source: "meta_description",
      value: $('meta[name="description"]').attr("content") || "",
    },
    {
      source: "og_description",
      value: $('meta[property="og:description"]').attr("content") || "",
    },
    {
      source: "body_fallback",
      value: bodyText.slice(0, 2500),
    },
  ];
  const selectedDescriptionCandidate =
    pickBestDescriptionCandidate(descriptionCandidates) ?? {
      source: "body_fallback",
      value: bodyText.slice(0, 2500),
    };

  const payloadPhotos = payloadBlocks
    .flatMap((block) => extractImageUrlsFromUnknown(block))
    .filter(isLikelyVrboListingPhotoUrl);
  const embeddedPhotos = structuredScriptData
    .flatMap((block) => extractImageUrlsFromUnknown(block))
    .filter(isLikelyVrboListingPhotoUrl);
  const jsonLdPhotos = jsonLdBlocks
    .flatMap((block) => extractImageUrlsFromUnknown(block))
    .filter(isLikelyVrboListingPhotoUrl);
  const domPhotos = [
    ...$('meta[property="og:image"]').map((_, el) => $(el).attr("content") || "").get(),
    ...$('meta[name="twitter:image"]').map((_, el) => $(el).attr("content") || "").get(),
    ...$("img")
      .map((_, el) => $(el).attr("src") || $(el).attr("data-src") || "")
      .get(),
  ].filter(isLikelyVrboListingPhotoUrl);

  const photos = dedupeImageUrls(
    uniqueStrings([...payloadPhotos, ...embeddedPhotos, ...jsonLdPhotos, ...domPhotos]).filter(
      isLikelyVrboListingPhotoUrl
    )
  ).slice(0, 120);

  const bodyPhotoTotal = parseVrboPhotoCountFromText(bodyText);
  const photoTotalHints = [
    ...payloadBlocks.flatMap((block, index) =>
      collectArrayLengthHintsByKeyPattern(
        block,
        /(images|photos|photoUrls|gallery|galleryimages)/i,
        `payload.${index}`
      )
    ),
    ...structuredScriptData.flatMap((block, index) =>
      collectArrayLengthHintsByKeyPattern(
        block,
        /(images|photos|photoUrls|gallery|galleryimages)/i,
        `json_embedded.${index}`
      )
    ),
    { source: "payload_urls", count: payloadPhotos.length },
    { source: "json_embedded_urls", count: embeddedPhotos.length },
    { source: "json_ld_urls", count: jsonLdPhotos.length },
    { source: "html_gallery_urls", count: domPhotos.length },
    ...(bodyPhotoTotal != null
      ? [{ source: "body_photo_total", count: bodyPhotoTotal }]
      : []),
  ];
  const bestPhotoHint = pickBestCountHint(photoTotalHints, Math.max(photos.length, 1));
  const photosCount = bestPhotoHint?.count && bestPhotoHint.count > photos.length ? bestPhotoHint.count : photos.length;
  const photoSource =
    bestPhotoHint?.source ??
    (payloadPhotos.length > 0
      ? "payload_images"
      : embeddedPhotos.length > 0
        ? "json_embedded_images"
        : jsonLdPhotos.length > 0
          ? "json_ld_images"
          : domPhotos.length > 0
            ? "html_gallery"
            : null);

  const amenityCandidates = buildAmenityCandidates($, payloadBlocks, structuredScriptData);

  const price =
    parseMaybeNumber(
      $('[data-stid*="price"], [class*="price"]').first().text() ||
        (typeof lodgingJson?.priceRange === "string" ? lodgingJson.priceRange : "") ||
        ""
    ) ?? null;

  const { rating: ratingCandidate, reviewCount: reviewCountCandidate } = buildReviewCandidates(
    payloadBlocks,
    structuredScriptData,
    lodgingJson,
    $,
    bodyText
  );
  const structureFromDom = extractStructureFromDom(bodyText);

  const capacity =
    [
      ...payloadBlocks.flatMap((block, index) =>
        collectNumberValuesByKeyPattern(block, /(sleeps|maxguests|guestcount|capacity)/i, `payload.${index}`)
      ),
      ...structuredScriptData.flatMap((block, index) =>
        collectNumberValuesByKeyPattern(
          block,
          /(sleeps|maxguests|guestcount|capacity)/i,
          `json_embedded.${index}`
        )
      ),
    ].find((candidate) => candidate.value > 0 && candidate.value <= 50)?.value ??
    findFirstMatchNumber(bodyText, [/sleeps\s+(\d+)/i, /(\d+)\s+guests?/i, /accommodates\s+(\d+)/i]) ??
    structureFromDom.capacity;

  const bedrooms =
    [
      ...payloadBlocks.flatMap((block, index) =>
        collectNumberValuesByKeyPattern(block, /(bedrooms|bedroomcount)/i, `payload.${index}`)
      ),
      ...structuredScriptData.flatMap((block, index) =>
        collectNumberValuesByKeyPattern(block, /(bedrooms|bedroomcount)/i, `json_embedded.${index}`)
      ),
    ].find((candidate) => candidate.value >= 0 && candidate.value <= 20)?.value ??
    findFirstMatchNumber(bodyText, [/(\d+)\s+bedrooms?/i, /(\d+)\s+bedroom/i]) ??
    structureFromDom.bedrooms;

  const bedCount =
    [
      ...payloadBlocks.flatMap((block, index) =>
        collectNumberValuesByKeyPattern(block, /(beds|bedcount)/i, `payload.${index}`)
      ),
      ...structuredScriptData.flatMap((block, index) =>
        collectNumberValuesByKeyPattern(block, /(beds|bedcount)/i, `json_embedded.${index}`)
      ),
    ].find((candidate) => candidate.value >= 0 && candidate.value <= 40)?.value ??
    findFirstMatchNumber(bodyText, [/(\d+)\s+beds?/i]) ??
    structureFromDom.bedCount;

  const bathrooms =
    [
      ...payloadBlocks.flatMap((block, index) =>
        collectNumberValuesByKeyPattern(block, /(bathrooms|bathroomcount)/i, `payload.${index}`)
      ),
      ...structuredScriptData.flatMap((block, index) =>
        collectNumberValuesByKeyPattern(block, /(bathrooms|bathroomcount)/i, `json_embedded.${index}`)
      ),
    ].find((candidate) => candidate.value >= 0 && candidate.value <= 20)?.value ??
    findFirstMatchNumber(bodyText, [/(\d+(?:\.\d+)?)\s+bathrooms?/i, /(\d+(?:\.\d+)?)\s+bathroom/i]) ??
    structureFromDom.bathrooms;

  const propertyTypeCandidate =
    [
      ...payloadBlocks.flatMap((block, index) =>
        collectStringValuesByKeyPattern(block, /(propertytype|hometype|accommodationtype)/i, `payload.${index}`)
      ),
      ...structuredScriptData.flatMap((block, index) =>
        collectStringValuesByKeyPattern(
          block,
          /(propertytype|hometype|accommodationtype)/i,
          `json_embedded.${index}`
        )
      ),
      {
        source: "json_ld_type",
        value: typeof lodgingJson?.["@type"] === "string" ? String(lodgingJson["@type"]) : "",
      },
    ].find((candidate) => normalizeWhitespace(candidate.value).length > 0) ?? null;
  const propertyType =
    propertyTypeCandidate?.value ||
    bodyText.match(/\b(apartment|villa|house|studio|loft|condo|cabin|cottage|chalet)\b/i)?.[1] ||
    null;

  const locationCandidates = uniqueStrings(
    [
      ...payloadBlocks.flatMap((block, index) =>
        collectStringValuesByKeyPattern(block, /(city|locality|addresslocality|neighborhood|region)/i, `payload.${index}`).map(
          (candidate) => candidate.value
        )
      ),
      ...structuredScriptData.flatMap((block, index) =>
        collectStringValuesByKeyPattern(
          block,
          /(city|locality|addresslocality|neighborhood|region)/i,
          `json_embedded.${index}`
        ).map((candidate) => candidate.value)
      ),
      typeof lodgingJson?.address === "object" &&
      lodgingJson.address &&
      typeof (lodgingJson.address as Record<string, unknown>).addressLocality === "string"
        ? [String((lodgingJson.address as Record<string, unknown>).addressLocality)]
        : [],
    ].flat()
  );
  const locationLabel = locationCandidates[0] ?? null;
  const fallbackLocationFromTitle = !locationLabel
    ? extractLocationFromTitle(selectedTitleCandidate.value)
    : null;

  const hostCandidates = uniqueStrings(
    [
      ...payloadBlocks.flatMap((block, index) =>
        collectStringValuesByKeyPattern(block, /(host|owner|manager)/i, `payload.${index}`).map(
          (candidate) => candidate.value
        )
      ),
      ...structuredScriptData.flatMap((block, index) =>
        collectStringValuesByKeyPattern(block, /(host|owner|manager)/i, `json_embedded.${index}`).map(
          (candidate) => candidate.value
        )
      ),
    ].flat()
  ).filter((value) => value.length >= 3 && value.length <= 120);
  const hostInfo = hostCandidates[0] ?? jsonLdHostCandidates[0] ?? extractHostFromDom($) ?? null;

  const rules = uniqueStrings(
    [
      ...payloadBlocks.flatMap((block, index) =>
        collectStringValuesByKeyPattern(block, /(houserules|checkin|checkout|rule|policy)/i, `payload.${index}`).map(
          (candidate) => candidate.value
        )
      ),
      ...structuredScriptData.flatMap((block, index) =>
        collectStringValuesByKeyPattern(
          block,
          /(houserules|checkin|checkout|rule|policy)/i,
          `json_embedded.${index}`
        ).map((candidate) => candidate.value)
      ),
    ].flat()
  )
    .filter((value) => value.length >= 6 && value.length <= 180)
    .slice(0, 12);
  const finalRules = rules.length > 0 ? rules : extractRulesFromDom($);

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (
    typeof lodgingJson?.geo === "object" &&
    lodgingJson.geo &&
    typeof (lodgingJson.geo as Record<string, unknown>).latitude === "number" &&
    typeof (lodgingJson.geo as Record<string, unknown>).longitude === "number"
  ) {
    latitude = (lodgingJson.geo as Record<string, unknown>).latitude as number;
    longitude = (lodgingJson.geo as Record<string, unknown>).longitude as number;
  }

  const normalizedTitle = normalizeTitle(selectedTitleCandidate.value);
  const normalizedDescription = normalizeWhitespace(selectedDescriptionCandidate.value);
  const normalizedPropertyType = propertyType ? normalizeWhitespace(propertyType) : null;
  const normalizedLocation = locationLabel
    ? normalizeWhitespace(locationLabel)
    : fallbackLocationFromTitle || null;

  const warnings = [
    normalizedDescription.length === 0
      ? "description_missing"
      : selectedDescriptionCandidate.source.includes("meta") ||
          selectedDescriptionCandidate.source.includes("og") ||
          selectedDescriptionCandidate.source.includes("body_fallback")
        ? "description_partial"
        : null,
    photosCount === 0 ? "photos_not_found" : photosCount < 10 ? "photos_weak" : null,
  ].filter((warning): warning is string => Boolean(warning));

  const titleConfidence = selectedTitleCandidate.source.startsWith("payload")
    ? 0.97
    : selectedTitleCandidate.source.startsWith("json_embedded")
      ? 0.95
      : selectedTitleCandidate.source === "h1"
        ? 0.92
        : 0.6;
  const descriptionConfidence =
    selectedDescriptionCandidate.source.startsWith("payload") ||
    selectedDescriptionCandidate.source.startsWith("json_embedded")
      ? 0.92
      : selectedDescriptionCandidate.source === "html_description_section"
        ? 0.76
        : 0.52;
  const photoConfidence =
    photoSource?.startsWith("payload") || photoSource?.startsWith("json_embedded") ? 0.94 : 0.6;

  debugVrboLog("[guest-audit][vrbo][listing-source-probe]", {
    payloadUrls: pageData.payloads.map((payload) => payload.url),
    interestingScriptKeys: [
      ...structuredScriptData
        .map((block, index) => summarizeTopLevelKeys(block, `json_embedded.${index}`))
        .filter((value): value is KeySummary => Boolean(value))
        .slice(0, 12),
      ...jsonLdBlocks
        .map((block, index) => summarizeTopLevelKeys(block, `json_ld.${index}`))
        .filter((value): value is KeySummary => Boolean(value))
        .slice(0, 12),
    ],
    embeddedCandidates: {
      title: previewCandidates(titleCandidates, 12),
      description: previewCandidates(descriptionCandidates, 12),
    },
    galleryCandidates: {
      photoHints: photoTotalHints
        .filter((hint) => hint.count > 0)
        .slice(0, 20)
        .map((hint) => ({ source: hint.source, count: hint.count })),
      payloadImageUrls: payloadPhotos.slice(0, 10),
      embeddedImageUrls: embeddedPhotos.slice(0, 10),
      jsonLdImageUrls: jsonLdPhotos.slice(0, 10),
      domImageUrls: domPhotos.slice(0, 10),
    },
    amenitiesCandidates: {
      jsonLd: jsonLdAmenityCandidates.slice(0, 20),
      payload: previewValues(
        payloadBlocks.flatMap((block, index) =>
          extractAmenityStrings(block, `payload.${index}`).map((candidate) => candidate.value)
        ),
        20
      ),
      embedded: previewValues(
        structuredScriptData.flatMap((block, index) =>
          extractAmenityStrings(block, `json_embedded.${index}`).map((candidate) => candidate.value)
        ),
        20
      ),
      dom: previewValues(
        [
          ...extractVisibleTextNodes(
            $,
            '[data-stid*="amenit"], [class*="amenit"], [class*="feature"] li, [class*="feature"] span, [class*="amenities"] li, [class*="amenities"] span',
            40
          ),
          ...collectNearbySectionText($, [/équipements?/i, /amenities/i, /services?/i], 40),
        ],
        20
      ),
    },
    descriptionCandidates: previewCandidates(descriptionCandidates, 16),
    hostCandidates: {
      jsonLd: jsonLdHostCandidates.slice(0, 10),
      embedded: previewValues(hostCandidates, 10),
      dom: previewValues(
        [
          ...collectNearbySectionText($, [/hôte/i, /hébergé par/i, /proposé par/i, /hosted by/i, /managed by/i], 12),
          ...extractVisibleTextNodes(
            $,
            '[data-stid*="host"], [data-stid*="owner"], [class*="host"], [class*="owner"], [class*="manager"]',
            12
          ),
        ],
        10
      ),
    },
    rulesCandidates: {
      embedded: previewValues(rules, 12),
      dom: previewValues(extractRulesFromDom($), 12),
    },
  });

  debugVrboLog("[guest-audit][vrbo][source-debug]", {
    networkPayloads: {
      count: pageData.payloads.length,
      matchedUrls: pageData.payloads.slice(0, 15).map((payload) => payload.url),
    },
    title: {
      selected: {
        source: selectedTitleCandidate.source,
        value: normalizedTitle,
      },
      candidates: previewCandidates(titleCandidates),
    },
    description: {
      selected: {
        source: selectedDescriptionCandidate.source,
        length: normalizedDescription.length,
        preview: normalizedDescription.slice(0, 200),
      },
      candidates: previewCandidates(descriptionCandidates),
    },
    photos: {
      source: photoSource,
      urlsCount: photos.length,
      totalHints: photoTotalHints
        .filter((hint) => hint.count > 0)
        .slice(0, 12)
        .map((hint) => ({ source: hint.source, count: hint.count })),
    },
    amenities: {
      payloadPreview: payloadBlocks
        .flatMap((block, index) =>
          extractAmenityStrings(block, `payload.${index}`)
            .map((candidate) => candidate.value)
            .filter(looksUsefulAmenity)
        )
        .slice(0, 12),
      htmlPreview: $('[data-stid*="amenit"], [class*="amenit"], [class*="feature"] li, [class*="feature"] span')
        .map((_, el) => normalizeWhitespace($(el).text()))
        .get()
        .filter(looksUsefulAmenity)
        .slice(0, 12),
      selected: amenityCandidates.slice(0, 12),
    },
    review: {
      selected: {
        rating: ratingCandidate,
        reviewCount: reviewCountCandidate,
      },
    },
    structure: {
      selected: {
        capacity,
        bedrooms,
        bedCount,
        bathrooms,
        propertyType: normalizedPropertyType,
      },
    },
    host: {
      selected: hostInfo,
      candidates: uniqueStrings([...hostCandidates, ...(hostInfo ? [hostInfo] : [])]).slice(0, 12),
    },
    rules: {
      selected: finalRules.slice(0, 12),
    },
    location: {
      selected: normalizedLocation,
      candidates: locationCandidates.slice(0, 12),
    },
    sourceCandidates: {
      title: previewCandidates(titleCandidates, 12),
      description: previewCandidates(descriptionCandidates, 12),
      photoHints: photoTotalHints
        .filter((hint) => hint.count > 0)
        .slice(0, 20)
        .map((hint) => ({ source: hint.source, count: hint.count })),
      amenities: amenityCandidates.slice(0, 20),
      review: {
        ratingSource: ratingCandidate?.source ?? null,
        reviewCountSource: reviewCountCandidate?.source ?? null,
      },
    },
    domSignals: {
      hasGallery: $('img').length > 8,
      hasAmenities: $('[data-stid*="amenit"], [class*="amenit"], [class*="feature"]').length > 0,
      hasDescription:
        $('[data-stid*="description"], [data-stid*="summary"], [class*="description"]').length > 0,
      hasHost: /host|owner|manager/i.test(bodyText),
      hasRules: /check[- ]?in|check[- ]?out|house rules/i.test(bodyText),
      hasLocation: /map|location|neighborhood/i.test(bodyText),
      hasStructuredData:
        jsonLdBlocks.length > 0 || structuredScriptData.length > 0 || payloadBlocks.length > 0,
    },
  });

  debugVrboLog("[guest-audit][vrbo][FINAL-PHOTOS]", {
    urlsCount: photos.length,
    confirmedTotal: bestPhotoHint?.count ?? null,
    chosenTotal: photosCount,
    source: photoSource,
  });

  debugVrboLog("[guest-audit][vrbo][FINAL-AMENITIES]", {
    rawItems: {
      jsonLd: jsonLdAmenityCandidates.slice(0, 20),
      payload: previewValues(
        payloadBlocks.flatMap((block, index) =>
          extractAmenityStrings(block, `payload.${index}`).map((candidate) => candidate.value)
        ),
        20
      ),
      embedded: previewValues(
        structuredScriptData.flatMap((block, index) =>
          extractAmenityStrings(block, `json_embedded.${index}`).map((candidate) => candidate.value)
        ),
        20
      ),
      dom: previewValues(
        [
          ...extractVisibleTextNodes(
            $,
            '[data-stid*="amenit"], [class*="amenit"], [class*="feature"] li, [class*="feature"] span, [class*="amenities"] li, [class*="amenities"] span',
            40
          ),
          ...collectNearbySectionText($, [/équipements?/i, /amenities/i, /services?/i], 40),
        ],
        20
      ),
    },
    normalizedItems: amenityCandidates,
    finalItems: amenityCandidates,
    finalCount: amenityCandidates.length,
    source:
      amenityCandidates.length > 0
        ? payloadBlocks.length > 0
          ? "payload_or_embedded_amenities"
          : "html_amenities"
        : null,
  });

  debugVrboLog("[guest-audit][vrbo][debug]", {
    title: {
      source: selectedTitleCandidate.source,
      value: normalizedTitle,
    },
    description: {
      source: selectedDescriptionCandidate.source,
      length: normalizedDescription.length,
      preview: normalizedDescription.slice(0, 200),
    },
    photos: {
      source: photoSource,
      count: photosCount,
      urlsCount: photos.length,
      totalHints: photoTotalHints
        .filter((hint) => hint.count > 0)
        .slice(0, 8)
        .map((hint) => ({ source: hint.source, count: hint.count })),
    },
    amenities: {
      source:
        amenityCandidates.length > 0
          ? payloadBlocks.length > 0
            ? "payload_amenities"
            : structuredScriptData.length > 0
              ? "json_embedded_amenities"
              : "html_amenities"
          : null,
      count: amenityCandidates.length,
      preview: amenityCandidates.slice(0, 10),
    },
    review: {
      rating: {
        source: ratingCandidate?.source ?? null,
        value: ratingCandidate?.value ?? null,
        scale: ratingCandidate?.scale ?? null,
      },
      reviewCount: {
        source: reviewCountCandidate?.source ?? null,
        value: reviewCountCandidate?.value ?? null,
      },
    },
    structure: {
      source: "payload_or_embedded",
      value: {
        capacity,
        bedrooms,
        bedCount,
        bathrooms,
        propertyType: normalizedPropertyType,
      },
    },
    host: {
      source: hostInfo ? "payload_or_embedded" : null,
      value: hostInfo,
    },
    rules: {
      source: finalRules.length > 0 ? (rules.length > 0 ? "payload_or_embedded" : "html_rules") : null,
      value: finalRules.slice(0, 6),
    },
    location: {
      source: normalizedLocation ? "payload_or_embedded" : null,
      value: normalizedLocation,
    },
    domSignals: {
      hasGallery: $('img').length > 8,
      hasAmenities: $('[data-stid*="amenit"], [class*="amenit"], [class*="feature"]').length > 0,
      hasDescription:
        $('[data-stid*="description"], [data-stid*="summary"], [class*="description"]').length > 0,
      hasHost: /host|owner|manager/i.test(bodyText),
      hasRules: /check[- ]?in|check[- ]?out|house rules/i.test(bodyText),
      hasLocation: /map|location|neighborhood/i.test(bodyText),
      hasStructuredData: jsonLdBlocks.length > 0 || structuredScriptData.length > 0 || payloadBlocks.length > 0,
    },
  });

  return {
    url,
    sourceUrl: url,
    platform: "vrbo",
    sourcePlatform: "vrbo",
    externalId: parseVrboExternalId(url),
    title: normalizedTitle,
    titleMeta: {
      ...buildFieldMeta({
        source: selectedTitleCandidate.source,
        value: normalizedTitle,
        quality: inferTitleQuality(normalizedTitle),
      }),
      confidence: titleConfidence,
    },
    description: normalizedDescription,
    descriptionMeta: {
      ...buildFieldMeta({
        source: selectedDescriptionCandidate.source,
        value: normalizedDescription,
        quality: inferDescriptionQuality(normalizedDescription),
      }),
      confidence: descriptionConfidence,
    },
    amenities: amenityCandidates,
    hostInfo,
    rules: finalRules,
    locationDetails: locationCandidates.slice(0, 8),
    photos,
    photosCount,
    photoMeta: {
      ...buildPhotoMeta({
        source: photoSource,
        photos: photos.slice(0, photosCount),
      }),
      count: photosCount,
      confidence: photoConfidence,
    },
    structure: {
      capacity,
      bedrooms,
      bedCount,
      bathrooms,
      propertyType: normalizedPropertyType,
      locationLabel: normalizedLocation,
    },
    price,
    currency: null,
    latitude,
    longitude,
    capacity,
    bedrooms,
    bedCount,
    bathrooms,
    locationLabel: normalizedLocation,
    propertyType: normalizedPropertyType,
    rating: ratingCandidate?.value ?? null,
    ratingValue: ratingCandidate?.value ?? null,
    ratingScale: ratingCandidate?.scale ?? null,
    reviewCount: reviewCountCandidate?.value ?? null,
    occupancyObservation: {
      status: "unavailable",
      rate: null,
      unavailableDays: 0,
      availableDays: 0,
      observedDays: 0,
      windowDays: 60,
      source: null,
      message: "Donnees d'occupation non disponibles pour cette annonce",
    },
    extractionMeta: {
      extractor: "vrbo",
      extractedAt: new Date().toISOString(),
      warnings,
    },
  };
}

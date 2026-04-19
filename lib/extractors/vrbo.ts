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

function parseVrboCadPrice(text: string): { price: number; currency: "CAD" } | null {
  const normalized = normalizeWhitespace(text.replace(/\u00a0|\u202f/g, " "));
  if (!/(?:ca\s*\$|\$\s*ca|cad)/i.test(normalized)) return null;

  const match =
    normalized.match(/\b(?:ca\s*\$|\$\s*ca)\s*(\d[\d\s.,]*)/i) ??
    normalized.match(/\bcad\s+(\d[\d\s.,]*)/i) ??
    normalized.match(/(\d[\d\s.,]*)\s*\$\s*ca\b/i) ??
    normalized.match(/\b(\d[\d\s.,]*)\s+cad\b/i);
  const price = match?.[1] ? parseMaybeNumber(match[1]) : null;
  if (price == null || price <= 0 || price > 100000) return null;

  return { price, currency: "CAD" };
}

function collectVrboPriceTexts(
  $: cheerio.CheerioAPI,
  bodyText: string,
  lodgingJson: Record<string, unknown> | null
): string[] {
  const attributeTexts: string[] = [];
  $('[aria-label], [title], [data-testid], [data-stid]').each((_, el) => {
    const attributes = (el as { attribs?: Record<string, string> }).attribs ?? {};
    for (const [key, value] of Object.entries(attributes)) {
      if (key !== "aria-label" && key !== "title" && !key.startsWith("data-")) continue;
      if (/(?:\b(?:ca\s*\$|\$\s*ca)\s*\d|\bcad\s+\d|\d[\d\s.,]*\s*\$\s*ca\b|\b\d[\d\s.,]*\s+cad\b)/i.test(value)) {
        attributeTexts.push(value);
      }
    }
  });

  const bodyCadTexts = Array.from(
    bodyText.matchAll(/\b(?:ca\s*\$|\$\s*ca)\s*\d[\d\s.,]*|\bcad\s+\d[\d\s.,]*|\b\d[\d\s.,]*\s*\$\s*ca\b|\b\d[\d\s.,]*\s+cad\b/gi)
  ).map((match) => match[0]);

  return uniqueStrings([
    ...extractVisibleTextNodes($, '[data-stid*="price"], [data-testid*="price"], [class*="price"]', 30),
    ...attributeTexts,
    ...bodyCadTexts,
    typeof lodgingJson?.priceRange === "string" ? lodgingJson.priceRange : "",
  ]);
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

function extractVrboEmbeddedSectionFromBody(
  bodyText: string,
  headingPatterns: RegExp[],
  stopPatterns: RegExp[] = []
): string | null {
  const normalized = normalizeWhitespace(bodyText);
  if (!normalized) return null;

  let sectionStart = -1;
  for (const pattern of headingPatterns) {
    const match = pattern.exec(normalized);
    if (match && match.index >= 0) {
      sectionStart = match.index;
      break;
    }
  }
  if (sectionStart < 0) return null;

  let sectionText = normalized.slice(sectionStart, Math.min(normalized.length, sectionStart + 2400));
  for (const stopPattern of stopPatterns) {
    const stopMatch = stopPattern.exec(sectionText);
    if (stopMatch && stopMatch.index > 0) {
      sectionText = sectionText.slice(0, stopMatch.index);
      break;
    }
  }

  sectionText = normalizeWhitespace(
    sectionText
      .replace(/^(?:à propos de cet hébergement|a propos de cet hebergement|about this property|qui vous reçoit\s*\??|your host)\s*/i, "")
      .replace(
        /\b(?:bodySubSections?|subSections?|primary|secondary|header|value|text|itemType|contentType|cta|sectionType|sectionId)\b/gi,
        " "
      )
      .replace(/[{}[\]"]+/g, " ")
  );

  return sectionText.length >= 30 ? sectionText : null;
}

function countVrboEmbeddedNoiseTokens(value: string): number {
  const noisePatterns = [
    /__typename/gi,
    /\bsubtext\b/gi,
    /\bheaderimage\b/gi,
    /\bmark\b/gi,
    /\belementsv2\b/gi,
    /\bpropertycontentref\b/gi,
    /\bexpando\b/gi,
    /\bexpandanalytics\b/gi,
    /\bcollapseanalytics\b/gi,
  ];
  return noisePatterns.reduce((total, pattern) => total + Array.from(value.matchAll(pattern)).length, 0);
}

function decodeVrboEmbeddedMarkup(value: string): string {
  let decoded = value;

  decoded = decoded
    .replace(/\\\\u003[cC]br\\\\u003[eE]/g, "\n")
    .replace(/\\u003[cC]br\\u003[eE]/g, "\n")
    .replace(/\\\\u003[cC]/g, "<")
    .replace(/\\\\u003[eE]/g, ">")
    .replace(/\\u003[cC]/g, "<")
    .replace(/\\u003[eE]/g, ">")
    .replace(/\\\\u0026/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

  const extractedFields = Array.from(
    decoded.matchAll(/"(?:value|text|content)"\s*:\s*"([^"]{8,})"/gi)
  ).map((match) => normalizeWhitespace(match[1]));

  const structuredNoisePattern =
    /\b(?:__typename|subText|headerImage|mark|elementsV2|propertyContentRef|expando|expandAnalytics|collapseAnalytics)\b/gi;
  const base = extractedFields.length > 0 ? extractedFields.join(" ") : decoded;

  return normalizeWhitespace(
    base
      .replace(/<br\s*\/?>/gi, " ")
      .replace(structuredNoisePattern, " ")
      .replace(/[{}[\]]+/g, " ")
      .replace(/"(?:(?:value|text|content|header|primary|secondary|bodySubSections|subSections|elementsV2))"\s*:/gi, " ")
      .replace(/\\[nrt]/g, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function extractReadableVrboEmbeddedDescription(value: string): string {
  const techNoisePattern =
    /(?:__typename|subText|headerImage|mark|elementsV2|PropertyContentSubSection|PropertyContentElementGroup|LodgingHeader|MarkupText|ClientSideAnalytics|referrerId|linkName|propertyContentRef|expando|expandAnalytics|collapseAnalytics)/gi;

  const decoded = value
    .replace(/\\\\u003[cC]br\\\\u003[eE]/g, "\n")
    .replace(/\\u003[cC]br\\u003[eE]/g, "\n")
    .replace(/\\\\u003[cC]/g, "<")
    .replace(/\\\\u003[eE]/g, ">")
    .replace(/\\u003[cC]/g, "<")
    .replace(/\\u003[eE]/g, ">")
    .replace(/\\\\u002[fF]/g, "/")
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\\//g, "/")
    .replace(/\\\\u0026/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

  const markupAnchor = decoded.search(/MarkupText/i);
  const anchored = markupAnchor >= 0 ? decoded.slice(markupAnchor, markupAnchor + 5000) : decoded;

  const extractedFromFields = Array.from(
    anchored.matchAll(/"(?:value|text|content)"\s*:\s*"((?:\\.|[^"\\]){24,})"/gi)
  )
    .map((match) => normalizeWhitespace(match[1]))
    .filter((text) => text.length >= 24 && !techNoisePattern.test(text));

  const extracted =
    extractedFromFields.length > 0
      ? extractedFromFields.join(" ")
      : normalizeWhitespace(
          anchored
            .replace(techNoisePattern, " ")
            .replace(/[{}[\]]+/g, " ")
            .replace(/"(?:(?:value|text|content|header|primary|secondary|bodySubSections|subSections|elementsV2))"\s*:/gi, " ")
        );

  const hardStopMatch = extracted.match(
    /\b(?:PropertyContentSubSection|PropertyContentElementGroup|LodgingHeader|ClientSideAnalytics|referrerId|linkName)\b/i
  );
  const cropped = hardStopMatch ? extracted.slice(0, hardStopMatch.index) : extracted;

  let cleaned = normalizeWhitespace(
    cropped
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\\[nrt]/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
  );

  // Final targeted cleanup for serialized technical prefix fragments.
  cleaned = cleaned
    .replace(/^(?:(?:upText|subText|text|content|value)\b(?:\s*[:=,-]?\s*)?|[\\,:;\-|[\]{}()])+?/i, "")
    .replace(/^(?:[\\,:;\-|[\]{}()]\s*)+/i, "")
    .trim();

  const firstReadableIndex = cleaned.search(/[A-Za-zÀ-ÿ0-9«“"'(✨⭐🌟💫🔥]/u);
  if (firstReadableIndex > 0 && firstReadableIndex < 80) {
    cleaned = cleaned.slice(firstReadableIndex).trim();
  }

  return normalizeWhitespace(cleaned);
}

function parseVrboPhotoCountFromText(text: string): number | null {
  return findFirstMatchNumber(text, [
    /(\d{1,3})\s*\/\s*(?:\d{1,3}\s*)?photos?/i,
    /(?:voir|afficher|show|view|toutes?|all)\s+(?:les\s+)?(?:\w+\s+)?(\d{1,3})\s+photos?/i,
    /(\d{1,3})\s+photos?/i,
  ]);
}

function parseVrboGalleryBadgeCount(value: string, context: string): number | null {
  if (!/photos?|gallery|galerie/i.test(context)) return null;

  const match = normalizeWhitespace(value).match(/\b(\d{1,3})\s*\+/);
  if (!match?.[1]) return null;

  const count = Number.parseInt(match[1], 10) + 1;
  return Number.isFinite(count) ? count : null;
}

function extractVrboDomPhotoTotal($: cheerio.CheerioAPI, minimum: number): TotalHint | null {
  const candidates: TotalHint[] = [];

  $('button, a, [role="button"], [aria-label], [title], [data-stid], [data-testid]').each((_, el) => {
    const attributes = (el as { attribs?: Record<string, string> }).attribs ?? {};
    const values = [
      normalizeWhitespace($(el).text()),
      ...Object.entries(attributes)
        .filter(([key]) => key === "aria-label" || key === "title" || key.startsWith("data-"))
        .map(([, value]) => normalizeWhitespace(value)),
    ].filter(Boolean);
    const context = values.join(" ");
    if (!/photos?|gallery|galerie/i.test(context)) return;

    for (const value of values) {
      const count = parseVrboPhotoCountFromText(value) ?? parseVrboGalleryBadgeCount(value, context);
      if (count != null && count > minimum && count <= 500) {
        candidates.push({ source: "dom_gallery_label", count });
      }
    }
  });

  return pickBestCountHint(candidates, minimum + 1);
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
  const original = normalizeTitle(value);
  const normalized = original.toLowerCase();
  if (!normalized || normalized.length < 8) return true;

  const technicalTokens = [
    "discoveryoverlayheading",
    "__typename",
    "virtualagent",
    "localization",
    "activityindicator",
    "egds",
    "uilink",
    "httpuri",
    "session",
    "overlay",
  ];
  if (technicalTokens.some((token) => normalized.includes(token))) return true;

  if (!/\s/.test(original) && /[a-z][A-Z]/.test(original) && /^[A-Za-z0-9_]+$/.test(original)) return true;

  const blockedGeographicTitles = new Set(
    [
      "provence-alpes-côte d'azur",
      "provence-alpes-cote d'azur",
      "maroc",
      "marrakech",
      "aghouatim",
      "région de marrakech-safi",
      "region de marrakech-safi",
      "province d'al haouz",
      "province d al haouz",
      "locations de vacances",
      "accueil",
      "home",
    ].map((entry) => entry.toLowerCase())
  );
  if (blockedGeographicTitles.has(normalized)) return true;

  const hasListingSignal = /\b(appartement|studio|villa|maison|chalet|loft|duplex|penthouse|pool|piscine|terrasse|balcon|bedroom|bedrooms|chambre|chambres|guest|sleeps?|proche|près|near|view|vue|wifi|parking|climatisation|air conditioning)\b/i.test(
    original
  );
  if (!hasListingSignal) {
    const words = original.split(/\s+/).filter(Boolean);
    const looksLikeAdministrativeOnly = /\b(région|region|province|département|departement|district|county|state|pays|country)\b/i.test(
      original
    );
    const looksLikeLocationOnlyTokens = words.length <= 5 && words.every((word) =>
      /^[A-ZÀ-ÖØ-Ý][\p{L}\p{M}'’.-]*$/u.test(word)
    );
    if (looksLikeAdministrativeOnly || looksLikeLocationOnlyTokens) return true;
  }

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

function extractKeywordProbe(text: string, pattern: RegExp, radius = 120): string | null {
  const match = pattern.exec(text);
  if (!match || match.index < 0) return null;
  const start = Math.max(0, match.index - radius);
  const end = Math.min(text.length, match.index + radius);
  return normalizeWhitespace(text.slice(start, end));
}

function isLikelyVrboListingPhotoUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;

  const lower = value.toLowerCase();
  if (
    /\.svg(?:[?#]|$)/i.test(lower) ||
    lower.includes("thumbnail") ||
    lower.includes("thumb") ||
    lower.includes("/egds/marks/") ||
    lower.includes("/flags/") ||
    lower.includes("/travel-assets-manager/pictograms-vrbo/") ||
    lower.includes("icon") ||
    lower.includes("logo") ||
    lower.includes("avatar") ||
    lower.includes("placeholder") ||
    lower.includes("map") ||
    lower.includes("sprite") ||
    lower.includes("analytics") ||
    lower.includes("tracking") ||
    lower.includes("beacon") ||
    lower.includes("pixel") ||
    lower.includes("bat.bing.com") ||
    lower.includes("/action/")
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

function isVrboHomeUrl(finalUrl: string): boolean {
  const normalized = finalUrl.trim();
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/g, "");
    return (host === "vrbo.com" || host === "www.vrbo.com") && path.length === 0;
  } catch {
    return /^https?:\/\/(?:www\.)?vrbo\.com\/?(?:[?#].*)?$/i.test(normalized);
  }
}

function isVrboAcquisitionNoiseTitle(value: string | null | undefined): boolean {
  const normalized = normalizeWhitespace(value ?? "").toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes("discoveryoverlayheading") ||
    normalized.includes("book your vacation home rentals") ||
    normalized.includes("vacation home rentals") ||
    normalized.includes("find your place to stay")
  );
}

function readFirstHtmlHeading(html: string): string {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match?.[1]) return "";
  return normalizeWhitespace(match[1].replace(/<[^>]+>/g, " "));
}

function getVrboListingSignals(
  html: string,
  bodyText: string,
  finalUrl: string,
  $: cheerio.CheerioAPI
) {
  const hasQuiVousRecoit = /qui vous reçoit/i.test(bodyText);
  const hasVoirLeProfil = /voir le profil|view profile/i.test(bodyText);
  const hasPresentation = /présentation/i.test(bodyText);
  const hasAboutThisProperty =
    /à propos de cet hébergement|a propos de cet hebergement|about this property/i.test(bodyText);
  const hasExternalReviews = /avis externes|external reviews?/i.test(bodyText);
  const hasPriceBox = normalizeWhitespace(
    $('[data-stid*="price"], [class*="price"], [data-testid*="price"], [class*="Price"]').first().text()
  ).length > 0;
  const hasPropertyId =
    /h[ée]bergement\s*n[°ºo]?\s*\d+/i.test(bodyText) ||
    /property\s*#\s*\d+/i.test(bodyText) ||
    /\/(?:location-vacances|vacation-rental|vacation-rentals)\/p?\d+/i.test(finalUrl);
  const hasGalleryCount =
    parseVrboPhotoCountFromText(bodyText) != null ||
    /galerie photos|photos?\s*(?:de|du)|show all photos?/i.test(bodyText);

  const h1Text = readFirstHtmlHeading(html);
  const hasH1 = h1Text.length >= 6;
  const hasStructureContext =
    /(?:\b\d+\s+)?(?:chambres?|bedrooms?|salles?\s+de\s+bain|bathrooms?|voyageurs?|guests?|personnes?)/i.test(
      bodyText
    );

  return {
    hasQuiVousRecoit,
    hasVoirLeProfil,
    hasPresentation,
    hasAboutThisProperty,
    hasExternalReviews,
    hasPriceBox,
    hasPropertyId,
    hasGalleryCount,
    hasH1,
    hasStructureContext,
    hasH1AndStructure: hasH1 && hasStructureContext,
    homeUrl: isVrboHomeUrl(finalUrl),
  };
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
        /amenit|commodit|feature|facility|highlight/i.test(key)
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

function extractKnownVrboAmenityLabelsFromDom($: cheerio.CheerioAPI): string[] {
  const labels: string[] = [];

  $("li, span, p, [aria-label], [title], [data-stid], [data-testid], [class]").each((_, el) => {
    const attributes = (el as { attribs?: Record<string, string> }).attribs ?? {};
    const values = [
      normalizeWhitespace($(el).text()),
      attributes["aria-label"],
      attributes.title,
      attributes["data-stid"],
      attributes["data-testid"],
      attributes.class,
    ]
      .map((value) => normalizeWhitespace(value ?? ""))
      .filter((value) => value.length >= 3 && value.length <= 160);
    const context = values.join(" ").toLowerCase();

    if (/\bpiscine\b|\bpool\b/.test(context)) labels.push(context.includes("piscine") ? "Piscine" : "Pool");
    if (/climatisation|air[-\s]?conditioning/.test(context)) {
      labels.push(context.includes("climatisation") ? "Climatisation" : "Air conditioning");
    }
  });

  return uniqueStrings(labels.filter(looksUsefulAmenity));
}

function buildAmenityCandidates(
  $: cheerio.CheerioAPI,
  payloadBlocks: unknown[],
  scriptBlocks: unknown[],
  bodyText = ""
) {
  const amenityAttributeTexts: string[] = [];
  $('[aria-label], [title]').each((_, el) => {
    const attributes = (el as { attribs?: Record<string, string> }).attribs ?? {};
    for (const key of ["aria-label", "title"]) {
      const value = attributes[key];
      if (typeof value === "string" && looksUsefulAmenity(value)) {
        amenityAttributeTexts.push(value);
      }
    }
  });
  const amenitySectionText = extractVrboEmbeddedSectionFromBody(
    bodyText,
    [/équipements?/i, /commodit[ée]s?/i, /popular amenities/i, /amenities/i, /services?/i],
    [/emplacement/i, /location/i, /h[oô]te/i, /host/i, /avis/i, /reviews?/i, /règlement/i, /house rules/i]
  ) ?? "";
  const amenitySectionTexts = [
    /\bpiscine\b/i.test(amenitySectionText) ? "Piscine" : "",
    /\bclimatisation\b/i.test(amenitySectionText) ? "Climatisation" : "",
    /\bpool\b/i.test(amenitySectionText) ? "Pool" : "",
    /\bair conditioning\b/i.test(amenitySectionText) ? "Air conditioning" : "",
  ].filter(Boolean);

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
        '[data-stid*="amenit"], [data-stid*="feature"], [data-stid*="commodit"], [data-testid*="amenit"], [data-testid*="feature"], [data-testid*="commodit"], [class*="amenit"], [class*="commodit"], [class*="feature"] li, [class*="feature"] span, [class*="amenities"] li, [class*="amenities"] span',
        50
      ).filter(looksUsefulAmenity),
      ...collectNearbySectionText($, [/équipements?/i, /commodit[ée]s?/i, /popular amenities/i, /amenities/i, /services?/i], 50).filter(
        looksUsefulAmenity
      ),
      ...amenityAttributeTexts,
      ...amenitySectionTexts,
      ...extractKnownVrboAmenityLabelsFromDom($),
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

  return values.find(
    (value) =>
      !/^(?:h[oô]te|host|owner|manager|annonceur|contact)$/i.test(value) &&
      !/^(?:voir|contacter|contact)\b/i.test(value) &&
      !/^(?:(?:arabe|fran[çc]ais|english|anglais|espagnol|spanish|allemand|german|italien|italian|portugais|portuguese)\s*,?\s*)+$/i.test(value) &&
      !isValidVrboHostName(value)
  ) ?? null;
}

function cleanVrboHostNameCandidate(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\b(?:voir le profil|view profile)\b.*$/iu, "")
    .replace(/^(?:h[oô]te|host|owner|manager|h[ée]berg[ée]\s+par|propos[ée]\s+par)\s*[:\-–]?\s*/iu, "")
    .replace(/\b(?:h[oô]te|host|owner|manager|profil|profile)\b.*$/iu, "")
    .replace(/[|•·,:;.!?]+$/g, "")
    .trim();
}

function isValidVrboHostName(value: string): boolean {
  const normalized = cleanVrboHostNameCandidate(value);
  if (!normalized) return false;
  if (normalized.length < 3 || normalized.length > 60) return false;
  if (/\d/.test(normalized)) return false;

  const lower = normalized.toLowerCase();
  const blockedPhrases = [
    "sub sections",
    "discoveryoverlayheading",
    "host",
    "owner",
    "voir le profil",
    "view profile",
    "appartement",
    "studio",
    "villa",
    "maison",
    "professionnel",
    "hôte",
    "profil",
    "profile",
  ];
  if (blockedPhrases.some((phrase) => lower.includes(phrase))) return false;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (!words.every((word) => /^[A-ZÀ-ÖØ-Ý][\p{L}\p{M}'’.-]*$/u.test(word))) return false;

  return true;
}

function extractVrboHostName($: cheerio.CheerioAPI, bodyText: string): string | null {
  const embeddedHostSection = extractVrboEmbeddedSectionFromBody(
    bodyText,
    [/qui vous reçoit\s*\??/i, /your host/i, /h[ée]berg[ée]\s+par/i, /propos[ée]\s+par/i],
    [/à propos de cet hébergement|a propos de cet hebergement|about this property|avis|reviews|emplacement|conditions/i]
  );

  const embeddedHostCandidates = embeddedHostSection
    ? uniqueStrings(
        [
          ...Array.from(
            embeddedHostSection.matchAll(
              /([A-ZÀ-ÖØ-Ý][\p{L}\p{M}'’.-]+(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}\p{M}'’.-]+){1,3})/gu
            )
          ).map((match) => cleanVrboHostNameCandidate(match[1])),
        ].filter(Boolean)
      )
    : [];
  const embeddedHostCandidate = embeddedHostCandidates.find((candidate) => isValidVrboHostName(candidate)) ?? null;
  debugVrboLog("[vrbo][embedded-host-candidate]", {
    sectionPreview: embeddedHostSection?.slice(0, 220) ?? null,
    candidates: embeddedHostCandidates.slice(0, 12),
    selected: embeddedHostCandidate,
    source: embeddedHostCandidate ? "embedded_host_section" : null,
  });

  const hostContextSelector =
    '[data-testid*="host"], [data-testid*="owner"], [data-testid*="profile"], [data-stid*="host"], [data-stid*="owner"], [data-stid*="profile"], [class*="host"], [class*="owner"], [class*="profile"]';
  const hostAttributeValues: string[] = [];
  $(`${hostContextSelector}, [aria-label], [title]`).each((_, el) => {
    const attributes = (el as { attribs?: Record<string, string> }).attribs ?? {};
    const attributeContext = normalizeWhitespace(Object.values(attributes).join(" "));
    if (!/h[oô]te|host|owner|manager|profil|profile|h[ée]berg[ée]\s+par|propos[ée]\s+par/i.test(attributeContext)) {
      return;
    }

    for (const key of ["aria-label", "title"]) {
      const value = attributes[key];
      if (typeof value === "string" && value.trim()) {
        hostAttributeValues.push(normalizeWhitespace(value));
      }
    }
  });
  const hostContextValues = uniqueStrings(
    [
      ...collectNearbySectionText(
        $,
        [/qui vous reçoit/i, /voir le profil/i, /view profile/i, /h[oô]te/i, /hosted by/i, /owner/i, /h[ée]berg[ée]\s+par/i, /propos[ée]\s+par/i],
        30
      ),
      ...extractVisibleTextNodes($, hostContextSelector, 40),
      ...hostAttributeValues,
      ...extractVisibleTextNodes($, "a, button", 20).filter((text) => /voir le profil|view profile/i.test(text)),
    ]
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean)
  );
  const hostContextTexts = hostContextValues.filter((value) =>
    /qui vous reçoit|voir le profil|view profile|h[oô]te|hosted by|owner|host|profile|profil|h[ée]berg[ée]\s+par|propos[ée]\s+par/i.test(value)
  );
  const hostCandidateTexts = hostContextTexts.length > 0
    ? uniqueStrings([...hostContextTexts, ...hostContextValues])
    : hostContextTexts;

  const extractedCandidates = uniqueStrings(
    [
      ...(embeddedHostCandidate ? [embeddedHostCandidate] : []),
      ...hostCandidateTexts.flatMap((text) => {
      const captures: string[] = [];

      const anchoredMatch =
        text.match(
          /(?:qui vous reçoit\s*\??|h[oô]te(?:\s*:)?|hosted by|owner(?:\s*:)?|managed by|h[ée]berg[ée]\s+par|propos[ée]\s+par)\s*[:\-–]?\s*([A-ZÀ-ÖØ-Ý][\p{L}\p{M}'’.-]*(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}\p{M}'’.-]*){1,3})/iu
        ) ??
        text.match(
          /([A-ZÀ-ÖØ-Ý][\p{L}\p{M}'’.-]*(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}\p{M}'’.-]*){1,3})\s*(?:voir le profil|view profile)/iu
        );

      if (anchoredMatch?.[1]) {
        captures.push(anchoredMatch[1]);
      }

      for (const token of text.matchAll(/([A-ZÀ-ÖØ-Ý][\p{L}\p{M}'’.-]+(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}\p{M}'’.-]+){1,3})/gu)) {
        captures.push(token[1]);
      }

      return captures.map(cleanVrboHostNameCandidate).filter(Boolean);
    }),
    ]
  );

  debugVrboLog("[guest-audit][vrbo][host-candidates-before-validation]", {
    context: previewValues(hostContextTexts, 20),
    candidates: previewValues(extractedCandidates, 20),
  });

  for (const candidate of extractedCandidates) {
    if (isValidVrboHostName(candidate)) {
      return cleanVrboHostNameCandidate(candidate);
    }
  }

  return null;
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

function parseReviewScopedRatingCandidates(text: string, source: string): NumberCandidate[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const candidates: NumberCandidate[] = [];
  const allowKeywordContext = !source.startsWith("body_review_scope");
  const pushCandidate = (rawValue: string | undefined, scale: number | null, label: string) => {
    if (!rawValue) return;
    const parsed = parseMaybeNumber(rawValue);
    if (parsed == null || parsed <= 0 || parsed > 10) return;
    candidates.push({
      source: `${source}.${label}`,
      value: parsed,
      scale,
    });
  };

  for (const match of normalized.matchAll(/(?:^|[^\d])(\d{1,2}(?:[.,]\d)?)\s*(?:sur|\/)\s*10\b/gi)) {
    pushCandidate(match[1], 10, "out_of_10");
  }
  for (const match of normalized.matchAll(/(?:^|[^\d])(\d(?:[.,]\d)?)\s*\/\s*5\b/gi)) {
    pushCandidate(match[1], 5, "out_of_5");
  }
  if (allowKeywordContext) {
    for (const match of normalized.matchAll(
      /\b(?:exceptionnel|excellent|fabuleux|superbe|very good|wonderful|rating|note|évaluation|review score)\b[^\d]{0,24}(\d{1,2}(?:[.,]\d)?)/gi
    )) {
      pushCandidate(match[1], 10, "keyword_prefix");
    }
    for (const match of normalized.matchAll(
      /(\d{1,2}(?:[.,]\d)?)\b[^\d]{0,24}\b(?:exceptionnel|excellent|fabuleux|superbe|very good|wonderful|rating|note|évaluation|review score)\b/gi
    )) {
      pushCandidate(match[1], 10, "keyword_suffix");
    }
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.value}:${candidate.scale ?? "null"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseReviewScopedCountCandidates(text: string, source: string): NumberCandidate[] {
  if (source.startsWith("body_review_scope")) {
    return [];
  }

  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const candidates: NumberCandidate[] = [];
  const pushCandidate = (rawValue: string | undefined, label: string) => {
    if (!rawValue) return;
    const parsed = parseMaybeNumber(rawValue);
    if (parsed == null || parsed < 1 || parsed > 100000) return;
    candidates.push({
      source: `${source}.${label}`,
      value: parsed,
    });
  };

  for (const match of normalized.matchAll(
    /(?:^|[^\d])(\d{1,5})\s+(?:avis(?:\s+externes?)?|avis voyageurs|reviews?|guest reviews?|commentaires?)(?:\b|$)/gi
  )) {
    pushCandidate(match[1], "count_explicit_prefix");
  }
  for (const match of normalized.matchAll(
    /\b(?:avis(?:\s+externes?)?|avis voyageurs|reviews?|guest reviews?|commentaires?)\s*[:\-]?\s*(\d{1,5})\b/gi
  )) {
    pushCandidate(match[1], "count_explicit_suffix");
  }

  const seen = new Set<number>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.value)) return false;
    seen.add(candidate.value);
    return true;
  });
}

function detectExplicitNoReviewsSignal(texts: string[]): { matched: boolean; preview: string | null } {
  const decodeEscapedSequences = (value: string): string =>
    value
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/\\n|\\r|\\t/g, " ")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");

  const patterns = [
    /aucun avis pour le moment/i,
    /aucun avis\b/i,
    /aucune?\s+(?:[ée]valuation|evaluation)s?\b/i,
    /soyez la premi[eè]re personne [àa] laisser un avis/i,
    /soyez la (?:1(?:re|ère)|premi[eè]re) personne [àa] laisser un avis/i,
    /be the first to leave a review/i,
    /be the first to leave review/i,
    /no reviews yet/i,
    /no reviews for this property/i,
    /no guest reviews/i,
  ];

  for (const text of texts) {
    const normalizedVariants = uniqueStrings(
      [normalizeWhitespace(text), normalizeWhitespace(decodeEscapedSequences(text))].filter(Boolean)
    );
    if (normalizedVariants.length === 0) continue;

    for (const normalized of normalizedVariants) {
      for (const pattern of patterns) {
        const match = pattern.exec(normalized);
        if (!match || match.index < 0) continue;
        const start = Math.max(0, match.index - 80);
        const end = Math.min(normalized.length, match.index + 180);
        return {
          matched: true,
          preview: normalized.slice(start, end),
        };
      }
    }
  }

  return { matched: false, preview: null };
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

  const domReviewTexts = uniqueStrings(
    [
      ...$(
        '[data-stid*="review"], [data-stid*="rating"], [class*="review"], [class*="rating"], [aria-label*="review"], [aria-label*="rating"]'
      )
        .map((_, el) => normalizeWhitespace($(el).text()))
        .get(),
    ].filter(Boolean)
  ).slice(0, 60);

  const domRatingCandidates = domReviewTexts.flatMap((text, index) =>
    parseReviewScopedRatingCandidates(text, `html_review_scope.${index}`)
  );
  const domReviewCountCandidates = domReviewTexts.flatMap((text, index) =>
    parseReviewScopedCountCandidates(text, `html_review_scope.${index}`)
  );
  const domRating = domRatingCandidates[0] ?? null;
  const domReviewCount = domReviewCountCandidates[0] ?? null;

  const bodyRatingCandidates = parseReviewScopedRatingCandidates(bodyText, "body_review_scope");
  const bodyReviewCountCandidates = parseReviewScopedCountCandidates(bodyText, "body_review_scope");
  const bodyRating = bodyRatingCandidates[0] ?? null;
  const bodyReviewCount = bodyReviewCountCandidates[0] ?? null;

  const ratingCandidates = [
    ...structuredRatings,
    ...(jsonLdRating ? [jsonLdRating] : []),
    ...domRatingCandidates,
    ...bodyRatingCandidates,
    ...(domRating ? [domRating] : []),
    ...(bodyRating ? [bodyRating] : []),
  ];
  const reviewCountCandidates = [
    ...structuredReviewCounts,
    ...(jsonLdReviewCount ? [jsonLdReviewCount] : []),
    ...domReviewCountCandidates,
    ...(domReviewCount ? [domReviewCount] : []),
  ];

  debugVrboLog("[vrbo][review-count-candidates-safe]", {
    structured: structuredReviewCounts
      .map((candidate) => ({ source: candidate.source, value: candidate.value }))
      .slice(0, 20),
    jsonLd: jsonLdReviewCount
      ? [{ source: jsonLdReviewCount.source, value: jsonLdReviewCount.value }]
      : [],
    dom: domReviewCountCandidates
      .map((candidate) => ({ source: candidate.source, value: candidate.value }))
      .slice(0, 20),
    body: bodyReviewCountCandidates
      .map((candidate) => ({ source: candidate.source, value: candidate.value }))
      .slice(0, 20),
  });

  debugVrboLog("[vrbo][review-hardening-input]", {
    ratingCandidateList: ratingCandidates.map((candidate) => ({
      source: candidate.source,
      value: candidate.value,
      scale: candidate.scale ?? null,
    })).slice(0, 30),
    reviewCountCandidateList: reviewCountCandidates.map((candidate) => ({
      source: candidate.source,
      value: candidate.value,
    })).slice(0, 30),
  });

  const ratingCandidate =
    structuredRatings[0] ??
    (jsonLdRating && jsonLdRating.value > 0 && jsonLdRating.value <= 10 ? jsonLdRating : null) ??
    domRating ??
    bodyRating;
  const reviewCountCandidate =
    structuredReviewCounts[0] ??
    (jsonLdReviewCount && jsonLdReviewCount.value >= 1 ? jsonLdReviewCount : null) ??
    domReviewCount;

  if (ratingCandidate && !ratingCandidate.scale) {
    ratingCandidate.scale = ratingCandidate.value <= 5 ? 5 : 10;
  }

  const isStructuredRatingSource = (source: string): boolean =>
    source.startsWith("payload.") ||
    source.startsWith("json_embedded.") ||
    source === "json_ld.aggregateRating.ratingValue";
  const isExplicitRatingSource = (source: string): boolean =>
    /\.(out_of_10|out_of_5|keyword_prefix|keyword_suffix)$/.test(source);

  const hardenedRatingCandidate =
    ratingCandidate &&
    ratingCandidate.value < 5 &&
    !isStructuredRatingSource(ratingCandidate.source) &&
    !isExplicitRatingSource(ratingCandidate.source)
      ? null
      : ratingCandidate;

  const reviewSectionNoReviewsSignal = detectExplicitNoReviewsSignal(domReviewTexts);
  debugVrboLog("[vrbo][review-section-no-reviews-probe]", {
    matched: reviewSectionNoReviewsSignal.matched,
    preview: reviewSectionNoReviewsSignal.preview,
    source: reviewSectionNoReviewsSignal.matched ? "review_dom_section" : null,
  });

  const noReviewProbeTexts = [
    bodyText,
    ...payloadBlocks.slice(0, 8).flatMap((block) => {
      try {
        const serialized = JSON.stringify(block);
        return serialized ? [serialized.slice(0, 20000)] : [];
      } catch {
        return [];
      }
    }),
    ...scriptBlocks.slice(0, 8).flatMap((block) => {
      try {
        const serialized = JSON.stringify(block);
        return serialized ? [serialized.slice(0, 20000)] : [];
      } catch {
        return [];
      }
    }),
  ];

  const fallbackNoReviewsSignal = detectExplicitNoReviewsSignal(noReviewProbeTexts);
  const noReviewsSignal = reviewSectionNoReviewsSignal.matched
    ? reviewSectionNoReviewsSignal
    : fallbackNoReviewsSignal;
  const noReviewsSignalSource = reviewSectionNoReviewsSignal.matched
    ? "review_dom_section"
    : fallbackNoReviewsSignal.matched
      ? "global_probe"
      : null;
  debugVrboLog("[vrbo][no-reviews-signal-final]", {
    matched: noReviewsSignal.matched,
    preview: noReviewsSignal.preview,
    source: noReviewsSignalSource,
  });

  let finalRatingCandidate = hardenedRatingCandidate;
  let finalReviewCountCandidate = reviewCountCandidate;
  let noReviewsGuardReason = "none";

  if (reviewSectionNoReviewsSignal.matched) {
    finalReviewCountCandidate = {
      source: "no_reviews_review_section",
      value: 0,
    };
    if (!(finalRatingCandidate && isStructuredRatingSource(finalRatingCandidate.source))) {
      finalRatingCandidate = null;
    }
    noReviewsGuardReason = finalRatingCandidate
      ? "no_reviews_review_section_with_structured_rating"
      : "no_reviews_review_section_zero_reviews";
  } else if (noReviewsSignal.matched) {
    finalReviewCountCandidate = {
      source: "no_reviews_signal",
      value: 0,
    };
    if (!(finalRatingCandidate && isStructuredRatingSource(finalRatingCandidate.source))) {
      finalRatingCandidate = null;
    }
    noReviewsGuardReason = finalRatingCandidate
      ? "no_reviews_signal_with_structured_rating"
      : "no_reviews_signal_zero_reviews";
  }

  debugVrboLog("[vrbo][rating-final-input]", {
    ratingCandidateList: ratingCandidates.map((candidate) => ({
      source: candidate.source,
      value: candidate.value,
      scale: candidate.scale ?? null,
    })).slice(0, 30),
  });
  debugVrboLog("[vrbo][rating-final-selected]", {
    selectedRating: finalRatingCandidate
      ? {
          source: finalRatingCandidate.source,
          value: finalRatingCandidate.value,
          scale: finalRatingCandidate.scale ?? null,
        }
      : null,
  });
  debugVrboLog("[vrbo][review-final-after-no-reviews-guard]", {
    matched: noReviewsSignal.matched,
    preview: noReviewsSignal.preview,
    source: noReviewsSignalSource,
    rating: finalRatingCandidate
      ? {
          source: finalRatingCandidate.source,
          value: finalRatingCandidate.value,
          scale: finalRatingCandidate.scale ?? null,
        }
      : null,
    reviewCount: finalReviewCountCandidate
      ? {
          source: finalReviewCountCandidate.source,
          value: finalReviewCountCandidate.value,
        }
      : null,
    reviewCountSource: finalReviewCountCandidate?.source ?? null,
    reason: noReviewsGuardReason,
  });
  debugVrboLog("[vrbo][review-count-final-safe]", {
    reviewCount: finalReviewCountCandidate ? finalReviewCountCandidate.value : null,
    source: finalReviewCountCandidate?.source ?? null,
    rating: finalRatingCandidate ? finalRatingCandidate.value : null,
    reason: noReviewsGuardReason,
  });

  debugVrboLog("[vrbo][review-hardening-selected]", {
    selectedRating: finalRatingCandidate
      ? {
          source: finalRatingCandidate.source,
          value: finalRatingCandidate.value,
          scale: finalRatingCandidate.scale ?? null,
        }
      : null,
    selectedReviewCount: finalReviewCountCandidate
      ? {
          source: finalReviewCountCandidate.source,
          value: finalReviewCountCandidate.value,
        }
      : null,
  });

  return {
    rating: finalRatingCandidate ?? null,
    reviewCount: finalReviewCountCandidate ?? null,
  };
}

export async function extractVrbo(url: string): Promise<ExtractorResult> {
  const pageData = await fetchUnlockedPageData(url, {
    platform: "vrbo",
    preferredTransport: "cdp",
    payloadUrlPattern:
      /(vrbo|homeaway|abritel|property|listing|review|amenit|feature|facility|photo|gallery|location|travel-assets|trvl-media|expedia)/i,
    maxPayloads: 60,
    afterLoad: async (page) => {
      let documentTitle: string | null = null;
      try {
        documentTitle = await page.title();
      } catch {
        documentTitle = null;
      }

      return {
        finalUrl: page.url(),
        documentTitle,
      };
    },
  });

  const acquisitionData = pageData.data && typeof pageData.data === "object" ? pageData.data : null;
  const finalUrl =
    acquisitionData && typeof acquisitionData.finalUrl === "string" && acquisitionData.finalUrl.trim().length > 0
      ? acquisitionData.finalUrl
      : url;
  const navigationDocumentTitle =
    acquisitionData && typeof acquisitionData.documentTitle === "string" ? acquisitionData.documentTitle : null;

  const html = pageData.html;
  const payloadBlocks = pageData.payloads
    .map((payload) => safeJsonParse(payload.bodyText))
    .filter((block): block is unknown => block != null);

  const $ = cheerio.load(html);
  const bodyText = normalizeWhitespace($("body").text());
  const listingSignals = getVrboListingSignals(html, bodyText, finalUrl, $);
  const documentTitle = navigationDocumentTitle ?? (normalizeWhitespace($("title").first().text()) || null);
  const upstreamErrorTitle = documentTitle
    ? /^(?:\d{3}\s*)?(?:bad gateway|gateway timeout|service unavailable|proxy error)$/i.test(documentTitle)
    : false;
  const upstreamErrorBody =
    /\b(?:bad gateway|gateway timeout|service unavailable|proxy error)\b/i.test(bodyText) &&
    bodyText.length <= 3000 &&
    !listingSignals.hasPropertyId &&
    !listingSignals.hasH1AndStructure;
  if (upstreamErrorTitle || upstreamErrorBody) {
    return {
      url,
      sourceUrl: url,
      platform: "vrbo",
      sourcePlatform: "vrbo",
      externalId: parseVrboExternalId(url),
      title: "",
      titleMeta: buildFieldMeta({
        source: "upstream_error_page",
        value: "",
        quality: "missing",
      }),
      description: "",
      descriptionMeta: buildFieldMeta({
        source: "upstream_error_page",
        value: "",
        quality: "missing",
      }),
      amenities: [],
      hostInfo: null,
      hostName: null,
      rules: [],
      locationDetails: [],
      photos: [],
      photosCount: 0,
      photoMeta: {
        ...buildPhotoMeta({
          source: "upstream_error_page",
          photos: [],
        }),
        count: 0,
        confidence: 0,
      },
      structure: {
        capacity: null,
        bedrooms: null,
        bedCount: null,
        bathrooms: null,
        propertyType: null,
        locationLabel: null,
      },
      price: null,
      currency: null,
      latitude: null,
      longitude: null,
      capacity: null,
      bedrooms: null,
      bedCount: null,
      bathrooms: null,
      locationLabel: null,
      propertyType: null,
      rating: null,
      ratingValue: null,
      ratingScale: null,
      reviewCount: null,
      occupancyObservation: {
        status: "unavailable",
        rate: null,
        unavailableDays: 0,
        availableDays: 0,
        observedDays: 0,
        windowDays: 60,
        source: null,
        message: "Page VRBO non exploitable: erreur upstream/proxy detectee",
      },
      extractionMeta: {
        extractor: "vrbo",
        extractedAt: new Date().toISOString(),
        warnings: ["upstream_error_page"],
      },
    };
  }
  const hasRejectedHomeTitle = isVrboAcquisitionNoiseTitle(documentTitle);
  const hasStrongListingCore =
    listingSignals.hasPropertyId ||
    listingSignals.hasQuiVousRecoit ||
    listingSignals.hasVoirLeProfil ||
    listingSignals.hasAboutThisProperty ||
    listingSignals.hasH1AndStructure;
  const hasPartialListingCore =
    listingSignals.hasPresentation ||
    listingSignals.hasPriceBox ||
    listingSignals.hasGalleryCount ||
    listingSignals.hasH1;
  const acquisitionClassification: "listing" | "partial_listing" | "home_or_overlay" | "unknown" =
    listingSignals.homeUrl || hasRejectedHomeTitle
      ? "home_or_overlay"
      : hasStrongListingCore && (listingSignals.hasPriceBox || listingSignals.hasGalleryCount)
        ? "listing"
        : hasStrongListingCore || hasPartialListingCore
          ? "partial_listing"
          : "unknown";

  debugVrboLog("[vrbo][acquisition-url]", {
    inputUrl: url,
    finalUrl,
    documentTitle,
  });
  debugVrboLog("[vrbo][acquisition-page-signals]", {
    hasQuiVousRecoit: listingSignals.hasQuiVousRecoit,
    hasVoirLeProfil: listingSignals.hasVoirLeProfil,
    hasPresentation: listingSignals.hasPresentation,
    hasAboutThisProperty: listingSignals.hasAboutThisProperty,
    hasExternalReviews: listingSignals.hasExternalReviews,
    hasPriceBox: listingSignals.hasPriceBox,
    hasPropertyId: listingSignals.hasPropertyId,
    hasGalleryCount: listingSignals.hasGalleryCount,
  });
  debugVrboLog("[vrbo][acquisition-classification]", {
    classification: acquisitionClassification,
    homeUrl: listingSignals.homeUrl,
    hasRejectedHomeTitle,
  });

  const jsonLdBlocks = extractJsonLd(html);
  const structuredScriptData = extractStructuredScriptData(html);

  const graphqlPayloadSignals = {
    title: previewCandidates(
      [
        ...payloadBlocks.flatMap((block, index) =>
          collectStringValuesByKeyPattern(block, /(title|name|headline)/i, `payload.${index}`)
        ),
        ...structuredScriptData.flatMap((block, index) =>
          collectStringValuesByKeyPattern(block, /(title|name|headline)/i, `json_embedded.${index}`)
        ),
      ],
      24
    ),
    ratingReview: [
      ...payloadBlocks.flatMap((block, index) =>
        collectNumberValuesByKeyPattern(
          block,
          /(aggregateRating|ratingvalue|averagerating|reviewscore|reviewcount|countofreviews)/i,
          `payload.${index}`
        )
      ),
      ...structuredScriptData.flatMap((block, index) =>
        collectNumberValuesByKeyPattern(
          block,
          /(aggregateRating|ratingvalue|averagerating|reviewscore|reviewcount|countofreviews)/i,
          `json_embedded.${index}`
        )
      ),
    ]
      .map((candidate) => ({
        source: candidate.source,
        value: candidate.value,
        scale: candidate.scale ?? null,
      }))
      .slice(0, 24),
    host: previewCandidates(
      [
        ...payloadBlocks.flatMap((block, index) =>
          collectStringValuesByKeyPattern(block, /(host|owner|profile)/i, `payload.${index}`)
        ),
        ...structuredScriptData.flatMap((block, index) =>
          collectStringValuesByKeyPattern(block, /(host|owner|profile)/i, `json_embedded.${index}`)
        ),
      ],
      24
    ),
    description: previewCandidates(
      [
        ...payloadBlocks.flatMap((block, index) =>
          collectStringValuesByKeyPattern(block, /(description|summary|about)/i, `payload.${index}`)
        ),
        ...structuredScriptData.flatMap((block, index) =>
          collectStringValuesByKeyPattern(block, /(description|summary|about)/i, `json_embedded.${index}`)
        ),
      ],
      24
    ),
  };
  debugVrboLog("[vrbo][graphql-payload-signals]", graphqlPayloadSignals);

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
  debugVrboLog("[vrbo][title-candidates-safe]", {
    titleCandidates: titleCandidates
      .map((candidate) => {
        const normalized = normalizeTitle(candidate.value);
        return {
          source: candidate.source,
          preview: normalized.slice(0, 200),
          generic: normalized ? isGenericTitle(normalized) : true,
        };
      })
      .filter((candidate) => candidate.preview.length > 0),
  });
  debugVrboLog("[guest-audit][vrbo][debug-title-candidates]", {
    titleCandidates: titleCandidates.map((candidate) => ({
      source: candidate.source,
      preview: normalizeWhitespace(candidate.value).slice(0, 200),
    })),
  });
  const selectedTitleCandidate =
    pickBestTitleCandidate(titleCandidates) ?? {
      source: "fallback_default",
      value: "Untitled Vrbo listing",
    };
  debugVrboLog("[vrbo][title-final-safe]", {
    source: selectedTitleCandidate.source,
    value: normalizeTitle(selectedTitleCandidate.value),
    generic: isGenericTitle(selectedTitleCandidate.value),
  });

  const embeddedAboutRaw = extractVrboEmbeddedSectionFromBody(
    bodyText,
    [/à propos de cet hébergement/i, /a propos de cet hebergement/i, /about this property/i],
    [
      /qui vous reçoit/i,
      /your host/i,
      /emplacement|discover the area/i,
      /avis|reviews/i,
      /conditions|r[eè]gles/i,
      /voir le profil|view profile/i,
    ]
  );
  const embeddedAboutCleaned = embeddedAboutRaw ? extractReadableVrboEmbeddedDescription(embeddedAboutRaw) : null;
  const embeddedAboutNoiseCount = embeddedAboutCleaned
    ? Array.from(
        embeddedAboutCleaned.matchAll(/\b(?:__typename|PropertyContent|ClientSideAnalytics|LodgingHeader)\b/gi)
      ).length
    : 0;
  const embeddedAboutCandidate =
    embeddedAboutCleaned && embeddedAboutNoiseCount <= 3 ? embeddedAboutCleaned : "";

  debugVrboLog("[vrbo][embedded-about-candidate]", {
    source: embeddedAboutCandidate ? "embedded_about_section" : null,
    preview: embeddedAboutCandidate.slice(0, 240) || null,
  });
  debugVrboLog("[vrbo][embedded-about-readable-extraction]", {
    before: embeddedAboutRaw?.slice(0, 220) ?? null,
    after: embeddedAboutCleaned?.slice(0, 220) ?? null,
    kept: Boolean(embeddedAboutCandidate),
  });

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
      source: "embedded_about_section",
      value: embeddedAboutCandidate,
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
  debugVrboLog("[guest-audit][vrbo][debug-description-candidates]", {
    descriptionCandidates: descriptionCandidates.map((candidate) => {
      const normalized = normalizeWhitespace(candidate.value);
      return {
        source: candidate.source,
        length: normalized.length,
        preview: normalized.slice(0, 200),
      };
    }),
  });
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
  const bodyGalleryBadgeTotal =
    Array.from(
      bodyText.matchAll(
        /(?:photos?|galerie|gallery)[^.;]{0,80}\b\d{1,3}\+|\b\d{1,3}\+[^.;]{0,80}(?:photos?|galerie|gallery)/gi
      )
    )
      .map((match) => parseVrboGalleryBadgeCount(match[0], match[0]))
      .find((count): count is number => count != null && count > photos.length && count <= 500) ?? null;
  const domPhotoTotal = extractVrboDomPhotoTotal($, photos.length);
  const explicitPhotoTotalHints = [
    ...payloadBlocks.flatMap((block, index) =>
      collectNumberValuesByKeyPattern(
        block,
        /^(?:photoCount|photosCount|imageCount|imagesCount|galleryCount|galleryImageCount|totalImageCount|mediaCount)$/i,
        `payload.${index}`
      )
    ),
    ...structuredScriptData.flatMap((block, index) =>
      collectNumberValuesByKeyPattern(
        block,
        /^(?:photoCount|photosCount|imageCount|imagesCount|galleryCount|galleryImageCount|totalImageCount|mediaCount)$/i,
        `json_embedded.${index}`
      )
    ),
  ]
    .filter((candidate) => Number.isFinite(candidate.value) && candidate.value > photos.length && candidate.value <= 500)
    .map((candidate) => ({ source: candidate.source, count: candidate.value }));
  const photoTotalHints = [
    ...explicitPhotoTotalHints,
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
    ...(bodyGalleryBadgeTotal != null
      ? [{ source: "body_gallery_badge", count: bodyGalleryBadgeTotal }]
      : []),
    ...(domPhotoTotal ? [domPhotoTotal] : []),
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

  const amenityCandidates = buildAmenityCandidates($, payloadBlocks, structuredScriptData, bodyText);
  console.log("[vrbo][debug][amenities-candidates]", {
    amenityStringsPreview: previewValues(
      [
        ...jsonLdAmenityCandidates,
        ...payloadBlocks.flatMap((block, index) =>
          extractAmenityStrings(block, `payload.${index}`).map((candidate) => candidate.value)
        ),
        ...structuredScriptData.flatMap((block, index) =>
          extractAmenityStrings(block, `json_embedded.${index}`).map((candidate) => candidate.value)
        ),
        ...extractVisibleTextNodes(
          $,
          '[data-stid*="amenit"], [data-stid*="feature"], [data-stid*="commodit"], [data-testid*="amenit"], [data-testid*="feature"], [data-testid*="commodit"], [class*="amenit"], [class*="commodit"], [class*="feature"] li, [class*="feature"] span, [class*="amenities"] li, [class*="amenities"] span',
          40
        ),
        ...collectNearbySectionText($, [/équipements?/i, /commodit[ée]s?/i, /popular amenities/i, /amenities/i, /services?/i], 40),
      ],
      20
    ),
    finalAmenitiesPreview: amenityCandidates.slice(0, 20),
    finalAmenitiesCount: amenityCandidates.length,
  });

  const priceTexts = collectVrboPriceTexts($, bodyText, lodgingJson);
  const cadPrice = priceTexts.map(parseVrboCadPrice).find((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)) ?? null;
  const fallbackPrice = priceTexts
    .map(parseMaybeNumber)
    .find((value): value is number => value != null && value > 0 && value <= 100000) ?? null;
  const price = cadPrice?.price ?? fallbackPrice;
  const currency = cadPrice?.currency ?? null;
  console.log("[vrbo][debug][price-candidates]", {
    priceTextsPreview: priceTexts.slice(0, 10),
    cadPriceCandidate: cadPrice,
    priceRangeCandidate: typeof lodgingJson?.priceRange === "string" ? lodgingJson.priceRange : null,
    bodyHasCadSignal: /\bCAD\b|CA\s*\$|\$\s*CA/i.test(bodyText),
    finalPrice: price,
    finalCurrency: currency,
  });

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
  const countryCandidates = uniqueStrings(
    [
      ...payloadBlocks.flatMap((block, index) =>
        collectStringValuesByKeyPattern(block, /(country|addresscountry)/i, `payload.${index}`).map(
          (candidate) => candidate.value
        )
      ),
      ...structuredScriptData.flatMap((block, index) =>
        collectStringValuesByKeyPattern(block, /(country|addresscountry)/i, `json_embedded.${index}`).map(
          (candidate) => candidate.value
        )
      ),
      typeof lodgingJson?.address === "object" &&
      lodgingJson.address &&
      typeof (lodgingJson.address as Record<string, unknown>).addressCountry === "string"
        ? [String((lodgingJson.address as Record<string, unknown>).addressCountry)]
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
  const hostInfoCandidate = hostCandidates[0] ?? jsonLdHostCandidates[0] ?? extractHostFromDom($) ?? null;

  const hostDebugCandidates = [
    ...hostCandidates.map((value) => ({ source: "payload_or_embedded", preview: value.slice(0, 200) })),
    ...jsonLdHostCandidates.map((value) => ({ source: "json_ld", preview: value.slice(0, 200) })),
    ...collectNearbySectionText(
      $,
      [/qui vous reçoit/i, /voir le profil/i, /view profile/i, /h[oô]te/i, /hosted by/i, /owner/i],
      24
    ).map((value) => ({ source: "nearby_host_section", preview: value.slice(0, 200) })),
    ...extractVisibleTextNodes(
      $,
      '[data-testid*="host"], [data-testid*="owner"], [data-testid*="profile"], [data-stid*="host"], [data-stid*="owner"], [data-stid*="profile"], [class*="host"], [class*="owner"], [class*="profile"]',
      30
    ).map((value) => ({ source: "visible_host_selector", preview: value.slice(0, 200) })),
    ...extractVisibleTextNodes($, "a, button", 40)
      .filter((value) => /voir le profil|view profile/i.test(value))
      .map((value) => ({ source: "visible_profile_cta", preview: value.slice(0, 200) })),
  ];
  debugVrboLog("[guest-audit][vrbo][debug-host-candidates]", {
    hostCandidates: hostDebugCandidates,
  });
  console.log("[vrbo][debug][host-source-snippets]", {
    hostDomTextsPreview: previewValues(
      [
        ...collectNearbySectionText(
          $,
          [/qui vous reçoit/i, /voir le profil/i, /view profile/i, /h[oô]te/i, /hosted by/i, /owner/i],
          24
        ),
        ...extractVisibleTextNodes(
          $,
          '[data-testid*="host"], [data-testid*="owner"], [data-testid*="profile"], [data-stid*="host"], [data-stid*="owner"], [data-stid*="profile"], [class*="host"], [class*="owner"], [class*="profile"]',
          30
        ),
      ],
      15
    ),
    hostAriaPreview: previewValues(
      $('[aria-label]')
        .map((_, el) => normalizeWhitespace($(el).attr("aria-label") ?? ""))
        .get()
        .filter((value) => /h[oô]te|host|owner|manager|profil|profile|voir le profil|view profile/i.test(value)),
      15
    ),
    hostTitleAttrPreview: previewValues(
      $('[title]')
        .map((_, el) => normalizeWhitespace($(el).attr("title") ?? ""))
        .get()
        .filter((value) => /h[oô]te|host|owner|manager|profil|profile|voir le profil|view profile/i.test(value)),
      15
    ),
    hostJsonPreview: previewValues([...hostCandidates, ...jsonLdHostCandidates], 10),
  });

  debugVrboLog("[guest-audit][vrbo][debug-dom-probe]", {
    probes: {
      quiVousRecoit: {
        present: /qui vous reçoit/i.test(bodyText),
        nearbyText: extractKeywordProbe(bodyText, /qui vous reçoit/i),
      },
      voirLeProfil: {
        present: /voir le profil/i.test(bodyText),
        nearbyText: extractKeywordProbe(bodyText, /voir le profil/i),
      },
      viewProfile: {
        present: /view profile/i.test(bodyText),
        nearbyText: extractKeywordProbe(bodyText, /view profile/i),
      },
      presentation: {
        present: /présentation/i.test(bodyText),
        nearbyText: extractKeywordProbe(bodyText, /présentation/i),
      },
      aProposHebergement: {
        present: /à propos de cet hébergement|a propos de cet hebergement/i.test(bodyText),
        nearbyText: extractKeywordProbe(bodyText, /à propos de cet hébergement|a propos de cet hebergement/i),
      },
      aboutThisProperty: {
        present: /about this property/i.test(bodyText),
        nearbyText: extractKeywordProbe(bodyText, /about this property/i),
      },
      avis: {
        present: /avis/i.test(bodyText),
        nearbyText: extractKeywordProbe(bodyText, /avis/i),
      },
      avisExternes: {
        present: /avis externes/i.test(bodyText),
        nearbyText: extractKeywordProbe(bodyText, /avis externes/i),
      },
    },
  });

  const hostName = extractVrboHostName($, bodyText);
  const normalizedHostInfoCandidate = hostInfoCandidate ? normalizeWhitespace(hostInfoCandidate) : "";
  const hostInfo =
    normalizedHostInfoCandidate &&
    normalizedHostInfoCandidate !== hostName &&
    !isValidVrboHostName(normalizedHostInfoCandidate) &&
    !/^(?:h[oô]te|host|owner|manager|annonceur|contact)$/i.test(normalizedHostInfoCandidate) &&
    !/^(?:voir|contacter|contact)\b/i.test(normalizedHostInfoCandidate) &&
    !/^(?:(?:arabe|fran[çc]ais|english|anglais|espagnol|spanish|allemand|german|italien|italian|portugais|portuguese)\s*,?\s*)+$/i.test(normalizedHostInfoCandidate)
      ? normalizedHostInfoCandidate
      : null;
  console.log("[vrbo][debug][host-candidates]", {
    hostCandidatesPreview: hostCandidates.slice(0, 10),
    jsonLdHostCandidatesPreview: jsonLdHostCandidates.slice(0, 10),
    domHostCandidate: extractHostFromDom($),
    finalHostName: hostName,
    finalHostInfo: hostInfo,
  });

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
  const explicitCountrySignalText = normalizeWhitespace(countryCandidates.join(" "))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const countrySignalText = normalizeWhitespace(
    [...countryCandidates, normalizedLocation ?? "", normalizedTitle, normalizedDescription, bodyText].join(" ")
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const moroccoLocalSignalCount = [
    /\bsidi bouzid\b/,
    /\bel jadida\b/,
    /\bazemmour\b/,
    /\bmazagan\b/,
    /\bmoulay abdallah\b/,
  ].filter((pattern) => pattern.test(countrySignalText)).length;
  const country =
    /\b(?:maroc|morocco)\b/.test(explicitCountrySignalText)
      ? "morocco"
      : /\b(?:tunisia|tunisie|tn)\b/.test(explicitCountrySignalText)
      ? "tunisia"
      : /\b(?:maroc|morocco)\b/.test(countrySignalText) || moroccoLocalSignalCount >= 2
      ? "morocco"
      : null;

  debugVrboLog("[guest-audit][vrbo][debug-final-selection]", {
    title: normalizedTitle,
    rating: ratingCandidate?.value ?? null,
    reviewCount: reviewCountCandidate?.value ?? null,
    hostName,
    description: normalizedDescription.slice(0, 200),
  });

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

  console.log("[vrbo][debug][photo-count-candidates]", {
    photosLength: photos.length,
    payloadImagesCount: payloadPhotos.length,
    bestPhotoHint: bestPhotoHint ?? null,
    photoHintCandidatesPreview: photoTotalHints
      .filter((hint) => hint.count > 0)
      .slice(0, 10)
      .map((hint) => ({ source: hint.source, count: hint.count })),
    bodyPhotoBadgeMatchesPreview: Array.from(
      bodyText.matchAll(/(?:photos?|galerie|gallery)[^.;]{0,80}\b\d{1,3}\+|\b\d{1,3}\+[^.;]{0,80}(?:photos?|galerie|gallery)/gi)
    )
      .map((match) => normalizeWhitespace(match[0]))
      .slice(0, 10),
    finalPhotosCount: photosCount,
    finalPhotoMeta: {
      source: photoSource,
      count: photosCount,
      confidence: photoConfidence,
    },
  });

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
      source: hostName ? "dom_host_context" : hostInfo ? "payload_or_embedded" : null,
      value: hostName ?? hostInfo,
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

  console.log("[vrbo][extract][summary]", {
    url,
    title: normalizedTitle,
    price,
    currency,
    photosCount,
    photosLength: photos.length,
    hostName,
    hostInfo,
    amenitiesPreview: amenityCandidates.slice(0, 10),
    location: normalizedLocation,
    country,
    rating: ratingCandidate?.value ?? null,
    reviewCount: reviewCountCandidate?.value ?? null,
  });

  return {
    url,
    sourceUrl: url,
    platform: "vrbo",
    sourcePlatform: "vrbo",
    externalId: parseVrboExternalId(url),
    ...(country ? { country } : { country: null }),
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
    hostName,
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
    currency,
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

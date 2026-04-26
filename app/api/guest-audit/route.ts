import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { chromium, type Page } from "playwright";
import { searchCompetitorsAroundTarget } from "@/lib/competitors/searchCompetitors";
import { extractListing, resolveExtractor } from "@/lib/extractors";
import type { ExtractedListing } from "@/lib/extractors/types";
import { buildGuestAuditPreview } from "@/lib/guestAudit/buildGuestAuditPreview";
import { buildTrustInsight } from "@/lib/guestAudit/buildTrustInsight";
import {
  validateExtractedGuestListing,
  validateGuestListingUrl,
} from "@/lib/guestAudit/shared";

const guestAuditRateByKey = new Map<string, number>();
const GUEST_AUDIT_RATE_WINDOW_MS = Number.parseInt(
  process.env.GUEST_AUDIT_RATE_LIMIT_MS ?? "8000",
  10
);

function getGuestAuditRateKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return ip || "unknown";
}

function allowGuestAuditRequest(rateKey: string): boolean {
  const now = Date.now();
  const last = guestAuditRateByKey.get(rateKey) ?? 0;
  if (now - last < GUEST_AUDIT_RATE_WINDOW_MS) {
    return false;
  }
  guestAuditRateByKey.set(rateKey, now);
  return true;
}

const guestAuditCache = new Map<string, ReturnType<typeof buildGuestAuditPreview>>();
const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";
const ENABLE_TRUST_DEBUG = process.env.NODE_ENV !== "production";
const MARKET_SEARCH_TIMEOUT_MS = Number.parseInt(
  process.env.GUEST_AUDIT_MARKET_TIMEOUT_MS ?? "120000",
  10
);
const AIRBNB_REALISTIC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const RATING_CONTEXT_PATTERNS = [
  /(?:note|rating|évaluation)\s*[:\-]?\s*([0-5](?:[.,]\d{1,2})?)/i,
  /([0-5](?:[.,]\d{1,2})?)\s*(?:\/\s*5)?\s*★/i,
  /★\s*([0-5](?:[.,]\d{1,2})?)/i,
];

const REVIEW_COUNT_PATTERNS = [
  /\((\d[\d\s.,]*)\s*(?:commentaires|avis|reviews)\)/i,
  /(\d[\d\s.,]*)\s*(?:commentaires|avis|reviews)\b/i,
];

const HOST_PATTERNS = [
  /H[oô]te\s*:?\s*([^\n•|]+)/i,
  /Hosted by\s+([^\n•|]+)/i,
];

const TRUST_BADGE_KEYWORDS = [
  "superhost",
  "super hote",
  "superhote",
  "guest favorite",
  "coup de coeur",
  "logement prefere",
  "hebergement prefere",
  "prefere des voyageurs",
  "hote premium",
  "premium host",
  "premium owner",
  "proprietaire premium",
  "top host",
  "highly rated host",
];

const AIRBNB_CONTENT_SELECTORS = [
  "main",
  "[data-plugin-in-point-id='PDP_HEADER']",
  "[data-section-id]",
  "[data-testid='pdp-title']",
  "h1",
];

const AIRBNB_LISTING_SELECTORS = [
  "[data-plugin-in-point-id='PDP_HEADER']",
  "[data-section-id='TITLE_DEFAULT']",
  "[data-section-id='DESCRIPTION_DEFAULT']",
  "[data-section-id='BOOK_IT_SIDEBAR']",
  "[data-testid='pdp-title']",
];

const AIRBNB_LISTING_HINT_PATTERNS = [
  /logement entier/i,
  /\bchambres?\b/i,
  /\bcommentaires?\b/i,
  /\bavis\b/i,
  /h[oô]te\s*:/i,
  /hosted by/i,
  /superh[oô]te/i,
  /guest favorite/i,
  /coup de coeur/i,
];

type TrustExtractionDebug = {
  contentLength: number;
  bodyTextLength: number;
  bodyTopLines: string[];
  reviewLocatorSamples: string[];
  hostLocatorSamples: string[];
  headingSamples: string[];
  sectionSamples: string[];
  ratingRegexMatches: Array<{ source: string; sample: string; match: string }>;
  reviewRegexMatches: Array<{ source: string; sample: string; match: string }>;
  hostRegexMatches: Array<{ source: string; sample: string; match: string }>;
  trustBadgeRegexMatches: Array<{ source: string; keyword: string; sample: string }>;
  isLikelyListingPdp: boolean;
  matchedListingSelectors: string[];
  matchedListingHints: string[];
  ratingLineSamples: string[];
  reviewLineSamples: string[];
  hostLineSamples: string[];
  extractedCandidates: {
    rating: number | null;
    reviewCount: number | null;
    hostName: string | null;
    trustBadge: string | null;
  };
};

type AirbnbPlaywrightFallback = {
  rating: number | null;
  reviewCount: number | null;
  hostName: string | null;
  trustBadge: string | null;
  bodySnippet: string | null;
  isBlocked: boolean;
  reason: "airbnb_blocked" | "airbnb_partial_fallback";
  fallbackUsed: true;
  debugTrustExtraction?: TrustExtractionDebug | null;
};

type TrustSignalsPayload = {
  rating: number | null;
  reviewCount: number | null;
  hostName: string | null;
  trustBadge: string | null;
  extractionStatus: "complete" | "partial" | "blocked";
};

type DebugRoutePath =
  | "primary"
  | "fallback-partial"
  | "fallback-blocked"
  | "fallback-error";

type DebugPrimaryExtraction = {
  extractorKey: string | null;
  extractorRunName: string | null;
  extractionMetaExtractor: string | null;
  extractedFieldKeys: string[];
  trustFieldSnapshot: {
    rating: number | string | null;
    ratingValue: number | string | null;
    reviewCount: number | string | null;
    hostInfo: string | null;
    hostName: string | null;
    highlights: string[];
    badges: string[];
    trustBadge: string | null;
  };
  structuredDataCandidates: Record<string, unknown> | null;
  rawPayloadCandidates: Record<string, unknown> | null;
};

function getAuditCacheKey(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

function normalizeRatingToFive(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value <= 5) return Math.max(0, Math.min(5, value));
  if (value <= 10) return Math.max(0, Math.min(5, value / 2));
  return null;
}

function extractHostName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw
    .replace(/^(?:h[oô]te\s*:?\s*|hosted by\s+)/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!normalized) return null;
  if (normalized.length < 2 || normalized.length > 60) return null;
  if (
    /<[^>]+>|<!doctype|<html|https?:\/\/|data-testid|function\s*\(|\{|\}|=|\/rooms\//i.test(
      normalized
    )
  ) {
    return null;
  }
  if (!/^[\p{L}\p{M}'’.\- ]+$/u.test(normalized)) return null;
  if (normalized.split(/\s+/).length > 6) return null;
  return normalized;
}

function normalizeTextForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getSignificantLines(value: string, limit = 20): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1)
    .slice(0, limit);
}

function getLinesMatchingPattern(value: string, pattern: RegExp, limit = 8): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => pattern.test(line))
    .slice(0, limit);
}

function collectRegexMatches(
  candidates: Array<{ source: string; text: string }>,
  patterns: RegExp[],
  groupIndex = 1
): Array<{ source: string; sample: string; match: string }> {
  const output: Array<{ source: string; sample: string; match: string }> = [];
  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const match = candidate.text.match(pattern);
      if (!match) continue;
      output.push({
        source: candidate.source,
        sample: candidate.text.slice(0, 180),
        match: (match[groupIndex] ?? match[0] ?? "").toString(),
      });
      if (output.length >= 12) return output;
    }
  }
  return output;
}

function collectTrustBadgeMatches(
  candidates: Array<{ source: string; text: string }>
): Array<{ source: string; keyword: string; sample: string }> {
  const output: Array<{ source: string; keyword: string; sample: string }> = [];
  for (const candidate of candidates) {
    const normalized = normalizeTextForMatch(candidate.text);
    for (const keyword of TRUST_BADGE_KEYWORDS) {
      if (!normalized.includes(keyword)) continue;
      output.push({
        source: candidate.source,
        keyword,
        sample: candidate.text.slice(0, 180),
      });
      if (output.length >= 12) return output;
    }
  }
  return output;
}

function detectTrustBadgeFromStrings(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeTextForMatch(value);
    if (
      normalized.includes("superhost") ||
      normalized.includes("super hote") ||
      normalized.includes("superhote")
    ) {
      return "Superhôte";
    }
    if (
      normalized.includes("guest favorite") ||
      normalized.includes("coup de coeur")
    ) {
      return "Coup de cœur voyageurs";
    }
    if (
      normalized.includes("logement prefere") ||
      normalized.includes("hebergement prefere") ||
      normalized.includes("prefere des voyageurs")
    ) {
      return "Logement préféré des voyageurs";
    }
    if (
      normalized.includes("hote premium") ||
      normalized.includes("premium host") ||
      normalized.includes("premium owner") ||
      normalized.includes("proprietaire premium") ||
      normalized.includes("top host") ||
      normalized.includes("highly rated host")
    ) {
      return "Hôte premium";
    }
  }
  return null;
}

function parseNumericString(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.replace(",", ".").match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntegerCountString(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.replace(/\s+/g, " ").match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function inferPropertyTypeFromLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeTextForMatch(value);
  if (normalized.includes("appartement") || normalized.includes("apartment")) return "apartment";
  if (normalized.includes("villa")) return "villa";
  if (normalized.includes("riad")) return "riad";
  if (normalized.includes("maison") || normalized.includes("house")) return "house";
  if (normalized.includes("studio")) return "studio";
  return null;
}

async function collectLocatorTexts(
  page: Page,
  selector: string,
  source: string
): Promise<Array<{ source: string; text: string }>> {
  try {
    const texts = await page.locator(selector).allTextContents();
    return texts
      .map((text) => text.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((text) => ({ source, text }));
  } catch {
    return [];
  }
}

async function waitForAirbnbRenderableContent(page: Page) {
  await page.waitForSelector("body", { timeout: 15000 });
  await Promise.any(
    AIRBNB_CONTENT_SELECTORS.map((selector) =>
      page.waitForSelector(selector, { timeout: 12000 })
    )
  ).catch(() => undefined);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => undefined);
  await page.waitForTimeout(450);
}

async function handleAirbnbCookieConsent(page: Page) {
  const consentSelectors = [
    "button:has-text('Accepter tout')",
    "button:has-text('Tout accepter')",
    "button:has-text('Accepter')",
    "button:has-text('Accept all')",
    "button:has-text('I agree')",
    "button[id*='accept']",
    "[data-testid*='accept']",
  ];

  for (const selector of consentSelectors) {
    try {
      const button = page.locator(selector).first();
      if (!(await button.isVisible({ timeout: 500 }).catch(() => false))) continue;
      await button.click({ timeout: 1000 });
      if (ENABLE_TRUST_DEBUG || DEBUG_GUEST_AUDIT) {
        console.log("[guest-audit][airbnb][trust-debug] cookie consent clicked", { selector });
      }
      await page.waitForTimeout(250);
      break;
    } catch {
      continue;
    }
  }
}

async function detectLikelyAirbnbListingPage(page: Page, bodyText: string) {
  const matchedListingSelectors: string[] = [];
  for (const selector of AIRBNB_LISTING_SELECTORS) {
    try {
      const isVisible = await page
        .locator(selector)
        .first()
        .isVisible({ timeout: 600 })
        .catch(() => false);
      if (isVisible) matchedListingSelectors.push(selector);
    } catch {
      continue;
    }
  }

  const matchedListingHints = AIRBNB_LISTING_HINT_PATTERNS
    .map((pattern) => {
      const match = bodyText.match(pattern);
      return match?.[0] ?? null;
    })
    .filter((value): value is string => Boolean(value));

  const isLikelyListingPdp =
    matchedListingSelectors.length >= 1 &&
    matchedListingHints.length >= 1;

  return {
    isLikelyListingPdp,
    matchedListingSelectors,
    matchedListingHints,
  };
}

function extractRatingFromCandidates(
  candidates: Array<{ source: string; text: string }>
): number | null {
  for (const candidate of candidates) {
    if (candidate.source === "review-score-locator") {
      const numeric = parseNumericString(candidate.text);
      if (numeric != null) return normalizeRatingToFive(numeric);
    }
  }

  for (const candidate of candidates) {
    for (const pattern of RATING_CONTEXT_PATTERNS) {
      const match = candidate.text.match(pattern);
      if (!match?.[1]) continue;
      const numeric = parseNumericString(match[1]);
      if (numeric != null) return normalizeRatingToFive(numeric);
    }
  }

  return null;
}

function extractReviewCountFromCandidates(
  candidates: Array<{ source: string; text: string }>
): number | null {
  for (const candidate of candidates) {
    for (const pattern of REVIEW_COUNT_PATTERNS) {
      const match = candidate.text.match(pattern);
      if (!match?.[1]) continue;
      const parsed = parseIntegerCountString(match[1]);
      if (parsed != null) return parsed;
    }
  }

  return null;
}

function extractHostFromCandidates(
  candidates: Array<{ source: string; text: string }>
): string | null {
  for (const candidate of candidates) {
    for (const pattern of HOST_PATTERNS) {
      const match = candidate.text.match(pattern);
      if (!match?.[1]) continue;
      const host = extractHostName(match[1]);
      if (host) return host;
    }
  }

  for (const candidate of candidates) {
    if (candidate.source !== "host-locator") continue;
    const host = extractHostName(candidate.text);
    if (host) return host;
  }

  return null;
}

async function extractAirbnbFallbackWithPlaywright(
  url: string
): Promise<AirbnbPlaywrightFallback> {
  const defaultFallback: AirbnbPlaywrightFallback = {
    rating: null,
    reviewCount: null,
    hostName: null,
    trustBadge: null,
    bodySnippet: null,
    isBlocked: false,
    reason: "airbnb_partial_fallback",
    fallbackUsed: true,
    debugTrustExtraction: null,
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: AIRBNB_REALISTIC_USER_AGENT,
      viewport: { width: 1366, height: 900 },
      locale: "fr-FR",
      timezoneId: "Europe/Paris",
      javaScriptEnabled: true,
      extraHTTPHeaders: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await waitForAirbnbRenderableContent(page);
    await handleAirbnbCookieConsent(page);
    await waitForAirbnbRenderableContent(page);
    const hostFromPageRaw = await page.evaluate(() => {
      const text = document.body?.innerText ?? "";
      const match =
        text.match(/H[oô]te\s*:\s*([A-ZÀ-Ý][\p{L}\p{M}'’\-\s]{2,60})/u) ||
        text.match(/Hosted by\s+([A-ZÀ-Ý][\p{L}\p{M}'’\-\s]{2,60})/iu);
      return match?.[1] ?? null;
    });
    const hostFromPage = extractHostName(hostFromPageRaw);
    console.log("[guest-audit][airbnb][playwright] host extracted", {
      hostFromPage,
    });

    const content = await page.content();
    const bodyText = (await page.locator("body").innerText().catch(() => "")) ?? "";
    const [reviewScoreLocatorSamples, reviewLocatorSamples, hostLocatorSamples, headingSamples, sectionSamples] =
      await Promise.all([
        collectLocatorTexts(page, "span[data-testid='review-score']", "review-score-locator"),
        collectLocatorTexts(page, "[data-testid*='review']", "review-locator"),
        collectLocatorTexts(page, "[data-testid*='host']", "host-locator"),
        collectLocatorTexts(page, "h1, h2, h3", "heading-locator"),
        collectLocatorTexts(page, "section span, section div", "section-locator"),
      ]);
    const locatorCandidates = [
      ...reviewScoreLocatorSamples,
      ...reviewLocatorSamples,
      ...hostLocatorSamples,
      ...headingSamples,
      ...sectionSamples,
    ];

    const textCandidates: Array<{ source: string; text: string }> = [
      { source: "body-innerText", text: bodyText },
      ...locatorCandidates,
    ].filter((entry) => entry.text.trim().length > 0);

    const rating = extractRatingFromCandidates(textCandidates);
    const reviewCount = extractReviewCountFromCandidates(textCandidates);
    const hostNameFromCandidates = extractHostFromCandidates(textCandidates);
    const hostName = hostNameFromCandidates ?? hostFromPage;
    const trustBadge = detectTrustBadgeFromStrings(
      textCandidates.map((candidate) => candidate.text)
    );
    const ratingRegexMatches = collectRegexMatches(textCandidates, RATING_CONTEXT_PATTERNS);
    const reviewRegexMatches = collectRegexMatches(textCandidates, REVIEW_COUNT_PATTERNS);
    const hostRegexMatches = collectRegexMatches(textCandidates, HOST_PATTERNS);
    const trustBadgeRegexMatches = collectTrustBadgeMatches(textCandidates);
    const listingDetection = await detectLikelyAirbnbListingPage(page, bodyText);
    const ratingLineSamples = getLinesMatchingPattern(bodyText, /(?:★|note|rating|évaluation)/i, 6);
    const reviewLineSamples = getLinesMatchingPattern(
      bodyText,
      /(?:commentaires?|avis|reviews?)/i,
      6
    );
    const hostLineSamples = getLinesMatchingPattern(bodyText, /(?:h[oô]te\s*:|hosted by)/i, 6);
    const bodyTopLines = getSignificantLines(bodyText, 20);
    const debugTrustExtraction: TrustExtractionDebug = {
      contentLength: content.length,
      bodyTextLength: bodyText.length,
      bodyTopLines,
      reviewLocatorSamples: [...reviewScoreLocatorSamples, ...reviewLocatorSamples]
        .map((item) => item.text)
        .slice(0, 20),
      hostLocatorSamples: hostLocatorSamples.map((item) => item.text).slice(0, 20),
      headingSamples: headingSamples.map((item) => item.text).slice(0, 20),
      sectionSamples: sectionSamples.map((item) => item.text).slice(0, 20),
      ratingRegexMatches,
      reviewRegexMatches,
      hostRegexMatches,
      trustBadgeRegexMatches,
      isLikelyListingPdp: listingDetection.isLikelyListingPdp,
      matchedListingSelectors: listingDetection.matchedListingSelectors,
      matchedListingHints: listingDetection.matchedListingHints,
      ratingLineSamples,
      reviewLineSamples,
      hostLineSamples,
      extractedCandidates: {
        rating,
        reviewCount,
        hostName,
        trustBadge: trustBadge ?? null,
      },
    };
    const hasAnyTrustSignal =
      rating != null || reviewCount != null || hostName != null || trustBadge != null;
    const hasVisibleHostLine =
      hostLineSamples.some((line) => /h[oô]te\s*:/i.test(line)) ||
      bodyText.includes("Hôte :") ||
      bodyText.includes("Hote :");
    const hasExplicitErrorPage =
      bodyText.includes("La page que vous recherchez semble introuvable.") ||
      bodyText.includes("Code d'erreur : 404") ||
      bodyText.includes("Page introuvable") ||
      bodyText.includes("This page could not be found");
    const isBlocked =
      hasExplicitErrorPage ||
      (!listingDetection.isLikelyListingPdp && !hasAnyTrustSignal && !hasVisibleHostLine);

    if (ENABLE_TRUST_DEBUG || DEBUG_GUEST_AUDIT) {
      console.log("[guest-audit][airbnb][trust-debug] block-decision", {
        hasExplicitErrorPage,
        isLikelyListingPdp: listingDetection.isLikelyListingPdp,
        hasAnyTrustSignal,
        hasVisibleHostLine,
        isBlocked,
      });
      console.log("[guest-audit][airbnb][trust-debug] listing-pdp-check", {
        isLikelyListingPdp: listingDetection.isLikelyListingPdp,
        matchedListingSelectors: listingDetection.matchedListingSelectors,
        matchedListingHints: listingDetection.matchedListingHints,
      });
      console.log("[guest-audit][airbnb][trust-debug] content lengths", {
        contentLength: content.length,
        bodyTextLength: bodyText.length,
      });
      console.log("[guest-audit][airbnb][trust-debug] body top lines", bodyTopLines);
      console.log("[guest-audit][airbnb][trust-debug] rating line samples", ratingLineSamples);
      console.log("[guest-audit][airbnb][trust-debug] review line samples", reviewLineSamples);
      console.log("[guest-audit][airbnb][trust-debug] host line samples", hostLineSamples);
      console.log(
        "[guest-audit][airbnb][trust-debug] review locator samples",
        debugTrustExtraction.reviewLocatorSamples
      );
      console.log(
        "[guest-audit][airbnb][trust-debug] host locator samples",
        debugTrustExtraction.hostLocatorSamples
      );
      console.log(
        "[guest-audit][airbnb][trust-debug] heading samples",
        debugTrustExtraction.headingSamples
      );
      console.log(
        "[guest-audit][airbnb][trust-debug] section samples",
        debugTrustExtraction.sectionSamples
      );
      console.log(
        "[guest-audit][airbnb][trust-debug] rating regex matches",
        debugTrustExtraction.ratingRegexMatches
      );
      console.log(
        "[guest-audit][airbnb][trust-debug] review regex matches",
        debugTrustExtraction.reviewRegexMatches
      );
      console.log(
        "[guest-audit][airbnb][trust-debug] host regex matches",
        debugTrustExtraction.hostRegexMatches
      );
      console.log(
        "[guest-audit][airbnb][trust-debug] trust badge matches",
        debugTrustExtraction.trustBadgeRegexMatches
      );
      console.log(
        "[guest-audit][airbnb][trust-debug] extracted candidates",
        debugTrustExtraction.extractedCandidates
      );
    }

    if (isBlocked) {
      console.warn("Airbnb page invalid / blocked");
      await context.close();
      return {
        rating: null,
        reviewCount: null,
        hostName: null,
        trustBadge: null,
        bodySnippet: null,
        isBlocked: true,
        reason: "airbnb_blocked",
        fallbackUsed: true,
        debugTrustExtraction: ENABLE_TRUST_DEBUG ? debugTrustExtraction : null,
      };
    }

    await context.close();

    return {
      rating,
      reviewCount,
      hostName,
      trustBadge: trustBadge ?? null,
      bodySnippet: bodyText.slice(0, 2500) || null,
      isBlocked: false,
      reason: "airbnb_partial_fallback",
      fallbackUsed: true,
      debugTrustExtraction: ENABLE_TRUST_DEBUG ? debugTrustExtraction : null,
    };
  } catch (error) {
    console.error("[guest-audit][airbnb][playwright-fallback] extraction failed", error);
    return defaultFallback;
  } finally {
    await browser.close();
  }
}

function buildFallbackExtractedListing(params: {
  normalizedUrl: string;
  platform: ExtractedListing["platform"];
  fallback: AirbnbPlaywrightFallback | null;
}): ExtractedListing {
  const { normalizedUrl, platform, fallback } = params;
  const isBlocked = fallback?.isBlocked === true;
  const fallbackExtractor =
    platform === "airbnb"
      ? isBlocked
        ? "airbnb-playwright-blocked"
        : "airbnb-playwright-fallback"
      : `${platform}-fallback`;
  return {
    url: normalizedUrl,
    canonicalUrl: normalizedUrl,
    sourceUrl: normalizedUrl,
    platform,
    sourcePlatform: platform,
    title: isBlocked ? "Annonce non accessible" : "Annonce analysee partiellement",
    description: isBlocked ? "" : fallback?.bodySnippet ?? "",
    amenities: [],
    highlights: !isBlocked && fallback?.trustBadge ? [fallback.trustBadge] : [],
    hostInfo: fallback?.hostName ?? null,
    photos: [],
    photosCount: 0,
    rating: fallback?.rating ?? null,
    ratingValue: fallback?.rating ?? null,
    ratingScale: 5,
    reviewCount: fallback?.reviewCount ?? null,
    occupancyObservation: {
      status: "unavailable",
      rate: null,
      unavailableDays: 0,
      availableDays: 0,
      observedDays: 0,
      windowDays: 60,
      source: "playwright-fallback",
      message: "Donnees d'occupation non disponibles",
    },
    extractionMeta: {
      extractor: fallbackExtractor,
      extractedAt: new Date().toISOString(),
      warnings: [isBlocked ? "airbnb_blocked" : "partial_extraction_fallback"],
    },
  };
}

function buildGuestAuditResponse(
  guestAudit: ReturnType<typeof buildGuestAuditPreview>,
  extracted: ExtractedListing,
  options?: {
    fallbackUsed?: boolean;
    trustBadge?: string | null;
    extractionFailed?: boolean;
    reason?: "airbnb_blocked" | "airbnb_partial_fallback" | null;
  }
) {
  const extractedRecord = extracted as Record<string, unknown>;
  const extractedRatingValue =
    typeof extractedRecord.ratingValue === "string"
      ? parseNumericString(extractedRecord.ratingValue)
      : null;
  const extractedRating =
    typeof extractedRecord.rating === "string"
      ? parseNumericString(extractedRecord.rating)
      : null;
  const ratingValue =
    typeof extracted.ratingValue === "number"
      ? extracted.ratingValue
      : extractedRatingValue != null
        ? extractedRatingValue
      : typeof extracted.rating === "number"
        ? extracted.rating
        : extractedRating != null
          ? extractedRating
        : null;
  const ratingScale = typeof extracted.ratingScale === "number" ? extracted.ratingScale : 5;
  const normalizedRating =
    ratingValue == null ? null : normalizeRatingToFive((ratingValue / ratingScale) * 5);
  const productRating =
    extracted.platform === "booking" ? ratingValue : normalizedRating;
  const extractedReviewCount =
    typeof extractedRecord.reviewCount === "string"
      ? parseIntegerCountString(extractedRecord.reviewCount)
      : null;
  const reviewCount =
    typeof extracted.reviewCount === "number"
      ? Math.max(0, Math.round(extracted.reviewCount))
      : extractedReviewCount != null
        ? extractedReviewCount
        : null;
  const hostName =
    extractHostName(typeof extracted.hostName === "string" ? extracted.hostName : null) ??
    extractHostName(typeof extractedRecord.hostName === "string" ? extractedRecord.hostName : null);
  const hostInfo = typeof extracted.hostInfo === "string" ? extracted.hostInfo : null;
  const extraBadges = Array.isArray(extractedRecord.badges)
    ? extractedRecord.badges.filter((value): value is string => typeof value === "string")
    : [];
  const highlightCandidates = [
    ...(Array.isArray(extracted.highlights) ? extracted.highlights : []),
    ...extraBadges,
  ];
  const rawTrustBadge =
    typeof extractedRecord.trustBadge === "string" ? extractedRecord.trustBadge : null;
  const detectedTrustBadge =
    options?.trustBadge ??
    detectTrustBadgeFromStrings([
      ...highlightCandidates,
      rawTrustBadge,
      extracted.hostInfo ?? null,
      typeof extractedRecord.hostName === "string" ? extractedRecord.hostName : null,
    ]);
  const extractionStatus: TrustSignalsPayload["extractionStatus"] =
    options?.extractionFailed || options?.reason === "airbnb_blocked"
      ? "blocked"
      : [productRating, reviewCount, hostName, detectedTrustBadge].filter(
            (value) => value != null
          ).length === 4
        ? "complete"
        : "partial";
  const trustSignals: TrustSignalsPayload = {
    rating: productRating,
    reviewCount,
    hostName,
    trustBadge: detectedTrustBadge ?? null,
    extractionStatus,
  };
  const trustInsight = buildTrustInsight({
    rating: trustSignals.rating,
    reviewCount: trustSignals.reviewCount,
    hostName: trustSignals.hostName,
    trustBadge: trustSignals.trustBadge,
  });
  const extractedPrice =
    typeof extracted.price === "number"
      ? extracted.price
      : parseNumericValue(extractedRecord.price) ??
        parseNumericValue(extractedRecord.priceValue) ??
        null;
  const extractedCurrency =
    typeof extracted.currency === "string"
      ? extracted.currency
      : typeof extractedRecord.currency === "string"
        ? extractedRecord.currency
        : typeof extractedRecord.priceCurrency === "string"
          ? extractedRecord.priceCurrency
          : null;
  const extractedPriceSource =
    typeof extractedRecord.priceSource === "string"
      ? extractedRecord.priceSource
      : typeof extractedRecord.price_source === "string"
        ? extractedRecord.price_source
        : null;
  const extractedEurApprox =
    typeof extractedRecord.eurApprox === "number"
      ? extractedRecord.eurApprox
      : parseNumericValue(extractedRecord.eurApprox);
  const inferredPropertyType =
    typeof extracted.propertyType === "string" && extracted.propertyType.trim().length > 0
      ? extracted.propertyType
      : inferPropertyTypeFromLabel(extracted.locationLabel) ??
        inferPropertyTypeFromLabel(extractedRecord.locationLabel);

  const baseResponse = {
    ...guestAudit,
    price: extractedPrice,
    currency: extractedCurrency,
    priceSource: extractedPriceSource,
    eurApprox: extractedEurApprox,
    propertyType: inferredPropertyType,
    rating: productRating,
    reviewCount,
    hostName,
    hostInfo,
    trustBadge: detectedTrustBadge ?? null,
    trustSignals,
    trustInsight,
    fallbackUsed: Boolean(options?.fallbackUsed),
    raw_payload: extracted,
  };

  if (options?.extractionFailed) {
    return {
      ...baseResponse,
      score: 0,
      summary:
        "Annonce non accessible actuellement. Relancez l'analyse dans quelques instants.",
      insights: ["Airbnb a temporairement bloque l'extraction de cette annonce."],
      recommendations: ["Reessayez l'audit ou utilisez un lien d'annonce public complet."],
      marketComparison: null,
      estimatedRevenue: null,
      bookingPotential: null,
      extractionFailed: true,
      reason: options?.reason ?? "airbnb_blocked",
      trustSignals: {
        ...trustSignals,
        extractionStatus: "blocked" as const,
      },
    };
  }

  return baseResponse;
}

export async function POST(request: NextRequest) {
  try {
    if (!allowGuestAuditRequest(getGuestAuditRateKey(request))) {
      return NextResponse.json(
        { error: "Trop de requêtes. Réessayez dans quelques instants." },
        { status: 429 }
      );
    }

    const body = (await request.json()) as {
      url?: string;
      forceComparables?: boolean;
      comparables?: {
        sourcePriority?: string[];
        city?: string | null;
        country?: string | null;
        propertyType?: string | null;
        max?: number | null;
      };
    };

    if (!body.url) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    const validation = validateGuestListingUrl(body.url);

    if (!validation.valid || !validation.normalizedUrl) {
      return NextResponse.json(
        { error: validation.reason || "URL invalide" },
        { status: 400 }
      );
    }

    const normalizedUrl = validation.normalizedUrl;
    const comparablesOverride =
      body.forceComparables === true && body.comparables && typeof body.comparables === "object"
        ? {
            sourcePriority: Array.isArray(body.comparables.sourcePriority)
              ? body.comparables.sourcePriority.filter((value): value is string => typeof value === "string")
              : undefined,
            city: typeof body.comparables.city === "string" ? body.comparables.city.trim() : null,
            country: typeof body.comparables.country === "string" ? body.comparables.country.trim() : null,
            propertyType: typeof body.comparables.propertyType === "string" ? body.comparables.propertyType.trim() : null,
            max: typeof body.comparables.max === "number" && Number.isFinite(body.comparables.max)
              ? body.comparables.max
              : null,
          }
        : undefined;
    const auditKey = getAuditCacheKey(normalizedUrl);
    const forceFreshInDev =
      request.nextUrl.searchParams.get("fresh") === "1" ||
      request.nextUrl.searchParams.get("bypassCache") === "1" ||
      (ENABLE_TRUST_DEBUG && request.headers.get("x-lco-force-fresh") === "1") ||
      Boolean(comparablesOverride);

    if (forceFreshInDev) {
      guestAuditCache.delete(auditKey);
      console.log("[guest-audit][route] cache bypass forced", {
        auditKey,
        normalizedUrl,
      });
    }

    const cachedAudit = forceFreshInDev ? undefined : guestAuditCache.get(auditKey);
    console.log("[guest-audit][route] cache check", {
      auditKey,
      normalizedUrl,
      forceFreshInDev,
      cacheHit: Boolean(cachedAudit),
    });

    if (cachedAudit) {
      const cachedPayload = cachedAudit as unknown as {
        fallbackUsed?: boolean;
        extractionFailed?: boolean;
        reason?: string | null;
      };
      const cachedRoutePath: DebugRoutePath =
        cachedPayload.extractionFailed || cachedPayload.reason === "airbnb_blocked"
          ? "fallback-blocked"
          : cachedPayload.fallbackUsed
            ? "fallback-partial"
            : "primary";
      console.log("[guest-audit][route] response served from cache", {
        auditKey,
        routePath: cachedRoutePath,
      });
      console.log("[guest-audit][route] final response sent", {
        routePath: cachedRoutePath,
        source: "cache",
      });
      return NextResponse.json({
        guestAudit: cachedAudit,
        ...(ENABLE_TRUST_DEBUG ? { debugRoutePath: cachedRoutePath } : {}),
      });
    }

    let extracted: ExtractedListing | null = null;
    let extractionValidation: ReturnType<typeof validateExtractedGuestListing> | null = null;
    let debugPrimaryExtraction: DebugPrimaryExtraction | null = null;
    const resolvedExtractor = resolveExtractor(normalizedUrl);
    console.log("[guest-audit][route] extractor resolved", {
      auditKey,
      normalizedUrl,
      extractorKey: resolvedExtractor.extractorKey,
      extractorRunName: resolvedExtractor.run.name || "anonymous",
    });

    try {
      extracted = await extractListing(normalizedUrl);
      extractionValidation = validateExtractedGuestListing(extracted);

      if (ENABLE_TRUST_DEBUG && extracted) {
        const extractedRecord = extracted as Record<string, unknown>;
        const highlights = Array.isArray(extractedRecord.highlights)
          ? extractedRecord.highlights.filter((value): value is string => typeof value === "string")
          : [];
        const badges = Array.isArray(extractedRecord.badges)
          ? extractedRecord.badges.filter((value): value is string => typeof value === "string")
          : [];
        const trustBadge =
          typeof extractedRecord.trustBadge === "string" ? extractedRecord.trustBadge : null;
        const hostName =
          typeof extractedRecord.hostName === "string" ? extractedRecord.hostName : null;
        const structuredDataCandidates =
          typeof extractedRecord.structuredData === "object" && extractedRecord.structuredData !== null
            ? (extractedRecord.structuredData as Record<string, unknown>)
            : typeof extractedRecord.structured_data === "object" &&
                extractedRecord.structured_data !== null
              ? (extractedRecord.structured_data as Record<string, unknown>)
              : null;
        const rawPayloadCandidates =
          typeof extractedRecord.raw_payload === "object" && extractedRecord.raw_payload !== null
            ? (extractedRecord.raw_payload as Record<string, unknown>)
            : typeof extractedRecord.rawPayload === "object" && extractedRecord.rawPayload !== null
              ? (extractedRecord.rawPayload as Record<string, unknown>)
              : null;

        debugPrimaryExtraction = {
          extractorKey: resolvedExtractor.extractorKey,
          extractorRunName: resolvedExtractor.run.name || null,
          extractionMetaExtractor:
            typeof extracted.extractionMeta?.extractor === "string"
              ? extracted.extractionMeta.extractor
              : null,
          extractedFieldKeys: Object.keys(extractedRecord),
          trustFieldSnapshot: {
            rating:
              typeof extractedRecord.rating === "number" || typeof extractedRecord.rating === "string"
                ? (extractedRecord.rating as number | string)
                : null,
            ratingValue:
              typeof extractedRecord.ratingValue === "number" ||
              typeof extractedRecord.ratingValue === "string"
                ? (extractedRecord.ratingValue as number | string)
                : null,
            reviewCount:
              typeof extractedRecord.reviewCount === "number" ||
              typeof extractedRecord.reviewCount === "string"
                ? (extractedRecord.reviewCount as number | string)
                : null,
            hostInfo:
              typeof extractedRecord.hostInfo === "string" ? extractedRecord.hostInfo : null,
            hostName,
            highlights,
            badges,
            trustBadge,
          },
          structuredDataCandidates,
          rawPayloadCandidates,
        };

        console.log("[guest-audit][route] primary extracted trust fields", {
          auditKey,
          normalizedUrl,
          debugPrimaryExtraction,
        });
      }
    } catch (error) {
      console.error("[guest-audit] primary extraction failed", error);
    }

    if (extracted && extractionValidation?.valid) {
      console.log("[guest-audit][route] primary extraction success", {
        auditKey,
        normalizedUrl,
      });
    } else {
      console.log("[guest-audit][route] primary extraction invalid", {
        auditKey,
        normalizedUrl,
        validationReason: extractionValidation?.reason ?? null,
      });
    }

    if (!extracted || !extractionValidation?.valid) {
      const isVrboWithoutFallback = validation.platform === "vrbo";
      if (isVrboWithoutFallback) {
        console.log("[guest-audit][route] vrbo primary invalid; no playwright fallback configured", {
          auditKey,
          normalizedUrl,
          validationReason: extractionValidation?.reason ?? null,
        });
        console.log("[vrbo][fallback][nav-start]", {
          url: normalizedUrl,
          platform: validation.platform,
        });
      } else {
        console.log("[guest-audit][route] playwright fallback start", {
          auditKey,
          normalizedUrl,
          platform: validation.platform,
        });
      }
      const fallback =
        validation.platform === "airbnb"
          ? await extractAirbnbFallbackWithPlaywright(normalizedUrl)
          : null;
      if (isVrboWithoutFallback) {
        console.log("[vrbo][fallback][nav-result]", {
          requestedUrl: normalizedUrl,
          finalUrl: null,
          status: null,
          pageTitle: null,
          bodySnippetPreview: null,
        });
        console.log("[vrbo][fallback][error-detail]", {
          requestedUrl: normalizedUrl,
          errorName: null,
          errorMessage: null,
          timeoutOrNavStage: "skipped_non_airbnb_fallback",
        });
      }

      const fallbackExtracted = buildFallbackExtractedListing({
        normalizedUrl,
        platform: validation.platform,
        fallback,
      });
      if (isVrboWithoutFallback) {
        const prevOcc = fallbackExtracted.occupancyObservation;
        fallbackExtracted.occupancyObservation = {
          status: prevOcc?.status ?? "unavailable",
          rate: prevOcc?.rate ?? null,
          unavailableDays: prevOcc?.unavailableDays ?? 0,
          availableDays: prevOcc?.availableDays ?? 0,
          observedDays: prevOcc?.observedDays ?? 0,
          windowDays: prevOcc?.windowDays ?? 60,
          source: "primary-invalid-no-vrbo-fallback",
          message: prevOcc?.message ?? null,
        };
        fallbackExtracted.extractionMeta = {
          extractor: "vrbo-primary-invalid-no-fallback",
          extractedAt: new Date().toISOString(),
          warnings: ["primary_extraction_invalid_no_vrbo_fallback"],
        };
      }
      const fallbackGuestAuditBase = buildGuestAuditPreview({
        extracted: fallbackExtracted,
        competitors: [],
      });
      const fallbackGuestAudit = buildGuestAuditResponse(
        fallbackGuestAuditBase,
        fallbackExtracted,
        {
          fallbackUsed: !isVrboWithoutFallback,
          trustBadge: fallback?.isBlocked ? null : fallback?.trustBadge ?? null,
          extractionFailed: fallback?.isBlocked === true,
          reason: fallback?.reason ?? null,
        }
      );

      guestAuditCache.set(
        auditKey,
        fallbackGuestAudit as ReturnType<typeof buildGuestAuditPreview>
      );

      const fallbackRoutePath: DebugRoutePath | "primary-invalid-no-fallback" =
        isVrboWithoutFallback
          ? "primary-invalid-no-fallback"
          : fallback?.isBlocked === true
            ? "fallback-blocked"
            : fallback?.debugTrustExtraction
              ? "fallback-partial"
              : "fallback-error";
      if (isVrboWithoutFallback) {
        console.log("[guest-audit][route] vrbo primary invalid no fallback", { auditKey, normalizedUrl });
      } else if (fallbackRoutePath === "fallback-blocked") {
        console.log("[guest-audit][route] playwright fallback blocked", { auditKey, normalizedUrl });
      } else if (fallbackRoutePath === "fallback-partial") {
        console.log("[guest-audit][route] playwright fallback partial", { auditKey, normalizedUrl });
      } else {
        console.log("[guest-audit][route] playwright fallback error", { auditKey, normalizedUrl });
      }
      console.log("[guest-audit][route] final response sent", {
        routePath: fallbackRoutePath,
        source: isVrboWithoutFallback ? "primary-invalid-no-vrbo-fallback" : "fallback",
      });

      return NextResponse.json({
        guestAudit: fallbackGuestAudit,
        ...(ENABLE_TRUST_DEBUG
          ? {
              debugRoutePath: fallbackRoutePath,
              debugTrustExtraction: fallback?.debugTrustExtraction ?? null,
              debugPrimaryExtraction,
            }
          : {}),
      });
    }

    const competitorMaxResults = Math.min(Math.max(Math.round(comparablesOverride?.max ?? 5), 1), 5);
    const competitorAbortController = new AbortController();
    let timeoutHandle: NodeJS.Timeout | null = null;
    if (Number.isFinite(MARKET_SEARCH_TIMEOUT_MS) && MARKET_SEARCH_TIMEOUT_MS > 0) {
      timeoutHandle = setTimeout(() => {
        console.warn("[guest-audit][runtime-timeout]", {
          label: "competitor_search",
          timeoutMs: MARKET_SEARCH_TIMEOUT_MS,
        });
        competitorAbortController.abort();
      }, MARKET_SEARCH_TIMEOUT_MS);
    }

    const competitorBundle = await (async () => {
      try {
        return await searchCompetitorsAroundTarget({
          target: extracted,
          maxResults: competitorMaxResults,
          radiusKm: 1,
          abortSignal: competitorAbortController.signal,
          comparables: comparablesOverride,
        });
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    })();

    if (DEBUG_GUEST_AUDIT) {
      console.log("[guest-audit][comparables][pipeline-debug]", {
        stage: "builder_injection",
        platform: extracted.platform ?? null,
        inputCompetitorsCount: competitorBundle.competitors.length,
      });
    }

    const guestAuditBase = buildGuestAuditPreview({
      extracted,
      competitors: competitorBundle.competitors,
    });
    const guestAudit = buildGuestAuditResponse(guestAuditBase, extracted);
    guestAuditCache.set(auditKey, guestAudit as ReturnType<typeof buildGuestAuditPreview>);
    console.log("[guest-audit][route] final response sent", {
      routePath: "primary",
      source: "fresh-extraction",
      auditKey,
      normalizedUrl,
    });

    return NextResponse.json({
      guestAudit,
      ...(ENABLE_TRUST_DEBUG
        ? { debugRoutePath: "primary" as const, debugPrimaryExtraction }
        : {}),
    });
  } catch (error) {
    console.error("Guest audit generation failed:", error);
    console.log("[guest-audit][route] playwright fallback error");
    console.log("[guest-audit][route] final response sent", {
      routePath: "fallback-error",
      source: "route-catch",
    });
    const emergencyGuestAudit = {
      listing_url: "",
      title: "Annonce analysee partiellement",
      platform: "other" as const,
      score: 0,
      insights: [],
      recommendations: [],
      summary: "Analyse partielle disponible. Certaines donnees n'ont pas pu etre chargees.",
      marketComparison: null,
      estimatedRevenue: null,
      bookingPotential: null,
      occupancyObservation: {
        status: "unavailable" as const,
        rate: null,
        unavailableDays: 0,
        availableDays: 0,
        observedDays: 0,
        windowDays: 60,
        source: "emergency-fallback",
      },
      subScores: [],
      rating: null,
      reviewCount: null,
      hostName: null,
      hostInfo: null,
      trustBadge: null,
      trustSignals: {
        rating: null,
        reviewCount: null,
        hostName: null,
        trustBadge: null,
        extractionStatus: "partial" as const,
      },
      trustInsight: buildTrustInsight({
        rating: null,
        reviewCount: null,
        hostName: null,
        trustBadge: null,
      }),
      fallbackUsed: true,
      raw_payload: null,
    };

    return NextResponse.json({
      guestAudit: emergencyGuestAudit,
      ...(ENABLE_TRUST_DEBUG
        ? { debugRoutePath: "fallback-error" as const, debugPrimaryExtraction: null }
        : {}),
    });
  }
}

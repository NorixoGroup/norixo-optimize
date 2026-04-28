import * as cheerio from "cheerio";
import type { ExtractorResult, OccupancyObservation } from "./types";
import { fetchUnlockedHtml, fetchUnlockedPageData } from "@/lib/brightdata";
import {
  buildFieldMeta,
  buildPhotoMeta,
  inferDescriptionQuality,
  inferTitleQuality,
} from "./quality";
import {
  extractImageUrlsFromUnknown,
  normalizeWhitespace,
  uniqueStrings,
} from "./shared";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

function debugGuestAuditLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

const DEBUG_AIRBNB_PRICE = process.env.DEBUG_AIRBNB_PRICE === "true";

function airbnbPriceDebug(payload: Record<string, unknown>): void {
  if (!DEBUG_AIRBNB_PRICE) return;
  try {
    console.log("[airbnb][price-debug]", JSON.stringify(payload));
  } catch {
    console.log("[airbnb][price-debug]", JSON.stringify({ error: "serialize_failed" }));
  }
}

function airbnbUrlHasStayDates(url: string): boolean {
  try {
    const u = new URL(url);
    const ci = u.searchParams.get("check_in")?.trim();
    const co = u.searchParams.get("check_out")?.trim();
    return Boolean(ci && co);
  } catch {
    return false;
  }
}

function airbnbStayNightsFromUrl(url: string): number | null {
  try {
    const u = new URL(url);
    const ci = u.searchParams.get("check_in")?.trim();
    const co = u.searchParams.get("check_out")?.trim();
    if (!ci || !co) return null;
    const d1 = Date.parse(ci.length >= 10 ? ci.slice(0, 10) : ci);
    const d2 = Date.parse(co.length >= 10 ? co.slice(0, 10) : co);
    if (!Number.isFinite(d1) || !Number.isFinite(d2)) return null;
    const nights = Math.round((d2 - d1) / 86400000);
    return nights > 0 ? nights : null;
  } catch {
    return null;
  }
}

function isPlausibleAirbnbStayPrice(n: number): boolean {
  return Number.isFinite(n) && n > 1 && n <= 5000;
}

const AIRBNB_PRICE_FEE_OR_TAX_LINE =
  /cleaning\s*fee|service\s*fee|frais\s*d[ée]?\s*m[ée]nages?|airbnb\s*fee|occupancy\s*tax|tourism\s*tax|taxes?\s*(?:\(|$)|heating\s*fee|damage\s*deposit|service\s*de\s*ménage/i;

const AIRBNB_BOOTSTRAP_PRICE_KEY_PATTERNS = [
  /displayPrice$/i,
  /PriceString$/i,
  /localizedPrice$/i,
  /structuredDisplayPrice/i,
  /nightlyPrice$/i,
  /totalPrice(?:Localized)?$/i,
];

const AIRBNB_STRUCTURED_DESCRIPTION_KEYS = [
  /^htmlDescription$/i,
  /^description$/i,
  /^sharingConfigDescription$/i,
  /^summary$/i,
  /^localizedListingDescription$/i,
  /^sharingDescription$/i,
  /^detailedDescription$/i,
  /^listingDescription$/i,
  /^longDescription$/i,
];

const AIRBNB_STRUCTURED_AMENITIES_PATH = /(amenit|previewamenitiesgroups|seeallamenitiesgroups)/i;
const AIRBNB_BOOTSTRAP_KEYWORDS = [
  "__INITIAL_STATE__",
  "niobeMinimalClientData",
  "data-deferred-state",
  "stayProductDetailPage",
  "photoTour",
  "presentation",
  "sections",
] as const;
const AIRBNB_GENERIC_TITLE_PATTERNS = [
  /^airbnb[:\s-]/i,
  /living area/i,
  /^living room$/i,
  /^bedroom$/i,
  /^kitchen$/i,
  /^bathroom$/i,
  /^dining room$/i,
  /^salon$/i,
  /^chambre$/i,
  /^cuisine$/i,
  /^salle de bain$/i,
  /what this place offers/i,
  /lo que ofrece este lugar/i,
  /¿qué ofrece este lugar\??/i,
  /ce que propose ce logement/i,
  /ce logement propose/i,
  /where you[' ]?ll sleep/i,
  /où vous dormirez/i,
  /things to know/i,
  /lo que debes saber/i,
  /à savoir/i,
  /servicios incluidos/i,
  /servicios no incluidos/i,
  /what this place includes/i,
  /^services?$/i,
  /^servicios$/i,
  /^amenities$/i,
  /^comodidades$/i,
  /^no incluidos?$/i,
  /^not included$/i,
  /^cocina$/i,
  /^wifi$/i,
  /^area para trabajar$/i,
  /^workspace$/i,
];
const AIRBNB_GENERIC_DESCRIPTION_PATTERNS = [
  /what this place offers/i,
  /ce que propose ce logement/i,
  /about this place/i,
  /a propos de ce logement/i,
  /about the place/i,
  /where you[' ]?ll sleep/i,
  /où vous dormirez/i,
  /things to know/i,
  /à savoir/i,
  /guest access/i,
  /acces des voyageurs/i,
  /show more/i,
  /afficher plus/i,
];
const AIRBNB_TRUST_BADGE_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: "Superhôte",
    patterns: [/superhost/i, /superh[oô]te/i, /\bsuper host\b/i],
  },
  {
    label: "Coup de cœur voyageurs",
    patterns: [/guest favorite/i, /coup de c[oœ]ur/i, /favorite among guests/i],
  },
  {
    label: "Logement préféré des voyageurs",
    patterns: [/logement pr[ée]f[ée]r[ée]/i, /h[eé]bergement pr[ée]f[ée]r[ée]/i, /traveler favorite/i],
  },
];
const AIRBNB_HOST_REJECT_SUBSTRINGS = [
  "airbnb",
  ".com",
  "www.",
  "http",
  "/",
  "<",
  ">",
  "photo de profil",
  "profil d'hôte",
  "profil d’hôte",
  "host profile photo",
  "choisissez une langue",
  "centre d'aide",
  "devenir hôte",
];
const AIRBNB_NAVIGATION_NOISE_PATTERNS = [
  /choisissez une langue/i,
  /centre d[' ]aide/i,
  /devenir h[oô]te/i,
  /confidentialit[eé]/i,
  /conditions/i,
  /cookies?/i,
  /s[' ]?identifier/i,
  /inscription/i,
  /airbnb/i,
];

type AirbnbBootstrapScriptDiagnostic = {
  label: string;
  type: string;
  length: number;
  hasInitialState: boolean;
  hasNiobeMinimalClientData: boolean;
  hasDeferredState: boolean;
  hasStayProductDetailPage: boolean;
  hasPhotoTour: boolean;
  hasPresentation: boolean;
  hasSections: boolean;
};

type AirbnbGalleryPathDiagnostic = {
  blockIndex: number;
  path: string;
  valueType: string;
  arrayLength: number;
  imageCount: number;
  category: "listing_gallery" | "blocked_gallery" | "non_listing";
  sampleUrls: string[];
  sampleObjects: unknown[];
  pathScore: number;
};

type LabeledTextCandidate = {
  source: string;
  value: string;
};

type AirbnbCalendarDay = {
  date: string;
  available: boolean | null;
  unavailable: boolean | null;
};

type AirbnbCalendarCandidate = {
  source: string;
  days: AirbnbCalendarDay[];
};

type AirbnbCalendarDebugBranch = {
  path: string;
  value: unknown;
};

type AirbnbSectionContainerMatch = {
  path: string;
  sectionContainer: Record<string, unknown>;
};

type SelectedLabeledText = {
  source: string;
  value: string;
};

type AirbnbCdpListingSignals = {
  price: number | null;
  currency: string | null;
  priceSource: "cdp_dom" | null;
  hostName: string | null;
  trustBadge: string | null;
};

function parseExternalId(url: string): string | null {
  const match = url.match(/\/rooms\/(\d+)/);
  return match?.[1] ?? null;
}

function parseMaybePrice(text: string): number | null {
  const numeric = text.replace(/[^\d.,]/g, "").trim();
  if (!numeric) return null;

  const hasComma = numeric.includes(",");
  const hasDot = numeric.includes(".");
  let cleaned = numeric;

  if (hasComma && hasDot) {
    const commaIndex = numeric.lastIndexOf(",");
    const dotIndex = numeric.lastIndexOf(".");
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    cleaned = numeric
      .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");
  } else if (hasComma) {
    cleaned = /^\d{1,3}(,\d{3})+$/.test(numeric)
      ? numeric.replace(/,/g, "")
      : numeric.replace(",", ".");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(numeric)) {
    cleaned = numeric.replace(/\./g, "");
  }

  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function getCurrencyFromPriceText(text: string): string | null {
  if (text.includes("€")) return "EUR";
  if (text.includes("$")) return "USD";
  if (text.includes("£")) return "GBP";
  if (/\b(?:mad|dh|dirhams?)\b|د\.?\s?م\.?/i.test(text)) return "MAD";
  return null;
}

function parseAirbnbDisplayedPrice(
  text: string,
  source?: string
): { price: number; currency: string | null } | null {
  const normalized = normalizeWhitespace(text).replace(/\u00a0|\u202f/g, " ");
  if (AIRBNB_PRICE_FEE_OR_TAX_LINE.test(normalized)) return null;

  const src = source ?? "";
  const hasNightlyMarker = /\/\s*nuit|par\s+nuit|per\s+night/i.test(normalized);
  const isTrustedPriceSource =
    /book-it|price-element|jsonld/i.test(src) || /bootstrap-script/i.test(src);
  const hasCurrencyMarker = /[€$£]|\b(?:mad|dh|dirhams?)\b|د\.?\s?م\.?/i.test(normalized);

  if (hasSemanticReviewCountContext(normalized, src) && !hasCurrencyMarker) return null;
  if (
    hasSemanticRatingContext(normalized, src) &&
    !hasNightlyMarker &&
    !isTrustedPriceSource &&
    !hasCurrencyMarker
  ) {
    return null;
  }

  if (!hasCurrencyMarker && !hasNightlyMarker) return null;
  if (!hasNightlyMarker && !isTrustedPriceSource) return null;

  const match =
    normalized.match(/(?:€|[$£]|\b(?:MAD|DH|dirhams?)\b|د\.?\s?م\.?)\s*(\d[\d\s.,]*)/i) ??
    normalized.match(/(\d[\d\s.,]*)\s*(?:€|[$£]|\b(?:MAD|DH|dirhams?)\b|د\.?\s?م\.?)/i) ??
    normalized.match(/(\d[\d\s.,]*)\s*(?:\/\s*nuit|par\s+nuit|per\s+night)/i);
  if (!match?.[1]) return null;

  const price = parseMaybePrice(match[1]);
  if (price == null || price <= 1 || price > 5000) return null;

  const currency = getCurrencyFromPriceText(normalized);
  if (currency == null && !isTrustedPriceSource && !hasNightlyMarker) return null;

  if (price < 10 && !isTrustedPriceSource && !hasNightlyMarker) {
    const couldBeRating = /^[€$£]?\s*[0-5]([.,]\d)?\b/u.test(normalized.trim());
    if (couldBeRating) return null;
  }

  return {
    price: Math.round(price),
    currency,
  };
}

function maybeConvertAirbnbTotalToNightly(
  parsed: { price: number; currency: string | null },
  text: string,
  stayNights: number | null
): { price: number; currency: string | null } {
  const nt = stayNights;
  if (!nt || nt <= 0 || parsed.price < 60) return parsed;
  if (/par\s+nuit|per\s+night|\/\s*nuit\b/i.test(text)) {
    return parsed;
  }
  const mentionsTotal =
    /\b(?:total|subtotal|amount\s*due|pour\s+\d+|for\s+\d+|au\s+total|en\s+total)\b/i.test(
      text
    );
  const explicitNights = text.match(/(\d+)\s*(?:nights?|nuits?)\b/i);
  const divisor = explicitNights ? parseInt(explicitNights[1]!, 10) : nt;
  if (!Number.isFinite(divisor) || divisor <= 0) return parsed;
  const perNight = parsed.price / divisor;
  if (
    (mentionsTotal || parsed.price >= divisor * 35) &&
    perNight >= 8 &&
    perNight <= 4000
  ) {
    const nightly = Math.round(perNight * 100) / 100;
    return { price: nightly, currency: parsed.currency };
  }
  return parsed;
}

function pickAirbnbHostNameFromCandidates(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const fromContext = extractHostNameFromVisibleText(value);
    if (fromContext) return fromContext;

    const direct = sanitizeHostNameCandidate(
      stripTrailingAirbnbHostBadges(normalizeWhitespace(value))
    );
    if (direct) return direct;
  }

  return null;
}

async function extractAirbnbPriceWithCdp(url: string): Promise<AirbnbCdpListingSignals | null> {
  if (!airbnbUrlHasStayDates(url)) {
    return null;
  }

  const logCdpPriceProbe = (fields: {
    transportUsed: string;
    afterloadHasRenderedSignals: boolean;
    candidatesCount: number;
    firstAcceptedSource: string | null;
    noPriceReason: string | null;
  }) => {
    airbnbPriceDebug({
      cdp_transport_used: fields.transportUsed,
      cdp_afterload_has_rendered_signals: fields.afterloadHasRenderedSignals,
      cdp_price_candidates_count: fields.candidatesCount,
      cdp_first_accepted_source: fields.firstAcceptedSource,
      cdp_no_price_reason: fields.noPriceReason,
    });
  };

  const previousAirbnbTransport = process.env.AIRBNB_SCRAPER_TRANSPORT;
  process.env.AIRBNB_SCRAPER_TRANSPORT = "cdp";

  try {
    const urlsToTry = [url];

    for (const targetUrl of urlsToTry) {
      const pageData = await fetchUnlockedPageData(targetUrl, {
        platform: "airbnb",
        preferredTransport: "cdp",
        maxPayloads: 0,
        payloadUrlPattern: /$a/,
        afterLoad: async (page) => {
          await page
            .waitForSelector('[data-testid="book-it-default"], [data-testid="price-element"]', {
              timeout: 18_000,
            })
            .catch(() => {});
          await page
            .waitForFunction(
              () => {
                const re =
                  /[€$£]|\b(?:mad|dh|dirhams?)\b|د\.?\s?م\.?|\/\s*nuit|par\s+nuit|per\s+night/i;
                const sels = [
                  '[data-testid="book-it-default"]',
                  '[data-testid="price-element"]',
                ];
                for (const sel of sels) {
                  for (const el of document.querySelectorAll(sel)) {
                    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
                    if (t.length > 0 && re.test(t)) return true;
                  }
                }
                return false;
              },
              { timeout: 12_000 }
            )
            .catch(() => {});
          await page.waitForTimeout(2500).catch(() => {});
          for (const ratio of [0.35, 0.65, 0.9]) {
            await page
              .evaluate((scrollRatio) => {
                window.scrollTo(0, Math.floor(document.body.scrollHeight * scrollRatio));
              }, ratio)
              .catch(() => {});
            await page.waitForTimeout(500).catch(() => {});
          }

          const priceCandidates = await page.evaluate(`
            (() => {
              const values = [];
              const hostCandidates = [];
              const badgeCandidates = [];
              const pushText = (source, text) => {
                const normalized = (text || "").replace(/\\s+/g, " ").trim();
                if (!normalized || normalized.length > 240) return;
                if (!/[€$£]|\\b(?:mad|dh|dirhams?)\\b|د\\.?\\s?م\\.?|\\/\\s*nuit|par\\s+nuit|per\\s+night/i.test(normalized)) return;
                values.push({ source, text: normalized });
              };
              const pushHostText = (text) => {
                const normalized = (text || "").replace(/\\s+/g, " ").trim();
                if (!normalized || normalized.length > 240) return;
                if (!/hôte|hote|host|proposé par|propose par|chez/i.test(normalized)) return;
                hostCandidates.push(normalized);
              };
              const pushBadgeText = (text) => {
                const normalized = (text || "").replace(/\\s+/g, " ").trim();
                if (!normalized || normalized.length > 240) return;
                if (!/superhost|superhôte|superhote|guest favorite|coup de cœur|coup de coeur|préféré|prefere/i.test(normalized)) return;
                badgeCandidates.push(normalized);
              };

              const collect = (source, selector) => {
                document.querySelectorAll(selector).forEach((element) => {
                  pushText(source, element.textContent);
                  pushText(source + ":aria", element.getAttribute("aria-label"));
                  pushText(source + ":content", element.getAttribute("content"));
                });
              };

              collect("book-it-default", '[data-testid="book-it-default"]');
              collect("book-it-default", '[data-testid="book-it-default"] span');
              collect("price-element", '[data-testid="price-element"], [data-testid="price-element"] span');
              collect("price-text-elements", "span, div, button");
              document
                .querySelectorAll('[data-testid*="host"], [data-section-id*="HOST"], [aria-label*="host"], [aria-label*="hôte"], a[href*="/users/show"], h2, h3')
                .forEach((element) => {
                  pushHostText(element.textContent);
                  pushHostText(element.getAttribute("aria-label"));
                  pushBadgeText(element.textContent);
                  pushBadgeText(element.getAttribute("aria-label"));
                });

              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              while (walker.nextNode()) {
                pushText("text-node", walker.currentNode.textContent);
                pushHostText(walker.currentNode.textContent);
                pushBadgeText(walker.currentNode.textContent);
              }

              return {
                prices: values.slice(0, 50),
                hosts: Array.from(new Set(hostCandidates)).slice(0, 40),
                badges: Array.from(new Set(badgeCandidates)).slice(0, 20)
              };
            })()
          `);

          return { airbnbRenderedSignals: priceCandidates };
        },
      });

      const meta = pageData.scrapeMeta;
      const transportUsed = meta?.transportUsed ?? "unknown";
      const signalsRaw = pageData.data?.airbnbRenderedSignals;
      const afterloadHasRenderedSignals =
        signalsRaw != null && typeof signalsRaw === "object";

      const renderedSignals =
        pageData.data?.airbnbRenderedSignals &&
        typeof pageData.data.airbnbRenderedSignals === "object"
          ? (pageData.data.airbnbRenderedSignals as Record<string, unknown>)
          : {};
      const candidates = Array.isArray(renderedSignals.prices)
        ? renderedSignals.prices
        : [];
      const hostCandidates = Array.isArray(renderedSignals.hosts) ? renderedSignals.hosts : [];
      const badgeCandidates = Array.isArray(renderedSignals.badges)
        ? renderedSignals.badges.filter((value): value is string => typeof value === "string")
        : [];
      const hostName = pickAirbnbHostNameFromCandidates(hostCandidates);
      const badgeDetection = detectTrustBadgesFromTexts(badgeCandidates);

      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") continue;
        const text = (candidate as { text?: unknown }).text;
        const source = (candidate as { source?: unknown }).source;
        if (typeof text !== "string") continue;

        const src = typeof source === "string" ? source : undefined;
        const parsed = parseAirbnbDisplayedPrice(text, src);
        if (!parsed) continue;

        const stayNights = airbnbStayNightsFromUrl(url);
        const adjusted = maybeConvertAirbnbTotalToNightly(parsed, text, stayNights);
        if (adjusted.price !== parsed.price) {
          airbnbPriceDebug({
            rawPrice: parsed.price,
            nights: stayNights,
            selectedSource: "cdp_dom",
            normalizedNightlyPrice: adjusted.price,
            price: adjusted.price,
            currency: adjusted.currency,
            reason: "resolved_total_to_nightly",
          });
        }

        logCdpPriceProbe({
          transportUsed,
          afterloadHasRenderedSignals,
          candidatesCount: candidates.length,
          firstAcceptedSource: src ?? null,
          noPriceReason: null,
        });

        return {
          price: adjusted.price,
          currency: adjusted.currency,
          priceSource: "cdp_dom",
          hostName,
          trustBadge: badgeDetection.badges[0] ?? null,
        };
      }

      if (hostName || badgeDetection.badges[0]) {
        logCdpPriceProbe({
          transportUsed,
          afterloadHasRenderedSignals,
          candidatesCount: candidates.length,
          firstAcceptedSource: null,
          noPriceReason: "host_only_no_price",
        });
        return {
          price: null,
          currency: null,
          priceSource: null,
          hostName,
          trustBadge: badgeDetection.badges[0] ?? null,
        };
      }

      const noPriceReason = meta?.cdpFallbackProxyNoAfterload
        ? "cdp_fallback_proxy_no_afterload"
        : !afterloadHasRenderedSignals
          ? "no_rendered_signals"
          : candidates.length === 0
            ? "zero_price_candidates"
            : "no_parseable_price";

      logCdpPriceProbe({
        transportUsed,
        afterloadHasRenderedSignals,
        candidatesCount: candidates.length,
        firstAcceptedSource: null,
        noPriceReason,
      });
    }
  } catch (error) {
    airbnbPriceDebug({
      found: false,
      reason: "cdp_error",
      hasDates: airbnbUrlHasStayDates(url),
      nights: airbnbStayNightsFromUrl(url),
      candidatesCount: 0,
      selectedSource: null,
      price: null,
      currency: null,
      rejectedReasons: [error instanceof Error ? error.message : String(error)].slice(0, 3),
      cdp_transport_used: "unknown",
      cdp_afterload_has_rendered_signals: false,
      cdp_price_candidates_count: 0,
      cdp_first_accepted_source: null,
      cdp_no_price_reason: "cdp_error",
    });
    debugGuestAuditLog("[airbnb][price-debug] cdp failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (previousAirbnbTransport === undefined) {
      delete process.env.AIRBNB_SCRAPER_TRANSPORT;
    } else {
      process.env.AIRBNB_SCRAPER_TRANSPORT = previousAirbnbTransport;
    }
  }

  return null;
}

function parseMaybeNumber(text: string): number | null {
  const cleaned = text.replace(/[^\d.]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseLocalizedDecimal(text: string): number | null {
  const normalized = normalizeWhitespace(text).replace(/\u202f/g, " ").trim();
  if (!normalized) return null;
  const match = normalized.match(/-?\d[\d\s.,]*/);
  if (!match) return null;

  let raw = match[0].replace(/\s/g, "");
  if (raw.includes(",") && raw.includes(".")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (raw.includes(",") && !raw.includes(".")) {
    raw = raw.replace(",", ".");
  } else {
    raw = raw.replace(/,/g, "");
  }

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLocalizedInteger(text: string): number | null {
  const normalized = normalizeWhitespace(text).replace(/\u202f/g, " ").trim();
  if (!normalized) return null;
  const match = normalized.match(/\d[\d\s.,]*/);
  if (!match) return null;
  const digitsOnly = match[0].replace(/[^\d]/g, "");
  if (!digitsOnly) return null;
  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRatingCandidate(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  if (value <= 5) return Number(value.toFixed(2));
  if (value <= 10) return Number((value / 2).toFixed(2));
  return null;
}

function hasSemanticRatingContext(text: string, source: string): boolean {
  return /note|[eé]valuation|rating|★|review-score/i.test(`${source} ${text}`);
}

function hasSemanticReviewCountContext(text: string, source: string): boolean {
  return /commentaires?|avis|reviews?|review-count|review/i.test(`${source} ${text}`);
}

function hasHostContext(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("hôte") ||
    t.includes("hote") ||
    t.includes("host") ||
    t.includes("hosted by") ||
    t.includes("chez") ||
    t.includes("proposé par") ||
    t.includes("propose par")
  );
}

function stripTrailingAirbnbHostBadges(value: string): string {
  return value
    .replace(/\s*(Superhost|Superh[oô]te)$/iu, "")
    .replace(/([a-zà-ÿ])(?:Superhost|Superh[oô]te)$/iu, "$1")
    .replace(/\s*(Guest Favorite|Coup de c[oœ]ur voyageurs)$/iu, "")
    .replace(/([a-zà-ÿ])(?:Guest Favorite|Coup de c[oœ]ur voyageurs)$/iu, "$1")
    .replace(/\s*(Logement pr[ée]f[ée]r[ée] des voyageurs)$/iu, "")
    .replace(/([a-zà-ÿ])(?:Logement pr[ée]f[ée]r[ée] des voyageurs)$/iu, "$1")
    .trim();
}

function validateHostNameCandidate(value: string): { value: string | null; reason: string | null } {
  const normalized = normalizeWhitespace(value)
    .replace(/^(?:h[oô]te|hosted by)\s*:?/i, "")
    .replace(/\s*[·|•].*$/g, "")
    .trim();

  if (!normalized) return { value: null, reason: "empty" };
  if (normalized.length < 3 || normalized.length > 40) {
    return { value: null, reason: "invalid_length" };
  }
  const lower = normalized.toLowerCase();
  if (
    AIRBNB_HOST_REJECT_SUBSTRINGS.some((needle) =>
      lower.includes(needle.toLowerCase())
    )
  ) {
    return { value: null, reason: "contains_forbidden_token" };
  }
  if (/[<>{}=]|https?:\/\/|\/rooms\/|data-testid|function\s*\(/i.test(normalized)) {
    return { value: null, reason: "looks_like_html_or_url" };
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    return { value: null, reason: "looks_like_domain" };
  }
  if (!/^[\p{L}\p{M}'’.\- ]+$/u.test(normalized)) {
    return { value: null, reason: "contains_invalid_characters" };
  }
  if (!/^\p{Lu}/u.test(normalized)) {
    return { value: null, reason: "must_start_with_uppercase" };
  }
  const letterMatches = normalized.match(/\p{L}/gu) ?? [];
  if (letterMatches.length < 2) {
    return { value: null, reason: "not_enough_letters" };
  }
  if (/^[a-z]{1,2}$/i.test(normalized)) {
    return { value: null, reason: "too_short_alpha_token" };
  }
  if (/^[^a-zA-Z]+$/.test(normalized)) {
    return { value: null, reason: "no_latin_letters" };
  }
  if (!/\p{Lu}/u.test(normalized)) {
    return { value: null, reason: "missing_uppercase" };
  }
  if (normalized === normalized.toLowerCase()) {
    return { value: null, reason: "only_lowercase" };
  }
  if (!normalized.includes(" ") && /[a-z]+[A-Z][a-z]+[A-Z][a-z]+/.test(normalized)) {
    return { value: null, reason: "looks_like_technical_token" };
  }
  if (/\d/.test(normalized)) {
    return { value: null, reason: "contains_digits" };
  }
  if (normalized.split(/\s+/).length > 4) {
    return { value: null, reason: "too_many_words" };
  }
  return { value: normalized, reason: null };
}

function sanitizeHostNameCandidate(value: string): string | null {
  return validateHostNameCandidate(value).value;
}

function extractHostMatchesFromVisibleText(value: string): string[] {
  const matches: string[] = [];
  const patterns = [
    /h[oô]te\s*:?\s*([\p{L}\p{M}'’.\-]+(?:\s+[\p{L}\p{M}'’.\-]+){0,4})/giu,
    /hosted by\s+([\p{L}\p{M}'’.\-]+(?:\s+[\p{L}\p{M}'’.\-]+){0,4})/giu,
  ];
  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value)) !== null) {
      if (match[1]) matches.push(match[1]);
    }
  });
  return uniqueStrings(matches);
}

function extractHostNameFromVisibleText(value: string): string | null {
  const candidates = extractHostMatchesFromVisibleText(value);
  for (const candidate of candidates) {
    const sanitized = sanitizeHostNameCandidate(candidate);
    if (sanitized) return stripTrailingAirbnbHostBadges(sanitized);
  }
  return null;
}

function detectTrustBadgesFromTexts(values: string[]): {
  badges: string[];
  rejected: Array<{ text: string; reason: string }>;
} {
  const rejected: Array<{ text: string; reason: string }> = [];
  const scopedValues = values.filter((value) => {
    const normalized = normalizeWhitespace(value);
    if (!normalized) return false;
    if (AIRBNB_NAVIGATION_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      rejected.push({ text: normalized.slice(0, 180), reason: "navigation_noise" });
      return false;
    }
    if (!/h[oô]te|host|logement|annonce|voyageur|guest|commentaires?|avis|reviews?/i.test(normalized)) {
      rejected.push({ text: normalized.slice(0, 180), reason: "missing_listing_context" });
      return false;
    }
    return true;
  });
  const found: string[] = [];
  AIRBNB_TRUST_BADGE_RULES.forEach((rule) => {
    const isMatch = scopedValues.some((value) =>
      rule.patterns.some((pattern) => pattern.test(value))
    );
    if (isMatch) found.push(rule.label);
  });
  return {
    badges: uniqueStrings(found),
    rejected,
  };
}

function findFirstMatchNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = Number.parseFloat(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function decodeAirbnbHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/");
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const blocks: Record<string, unknown>[] = [];
  const pushParsedBlock = (parsed: unknown) => {
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (item && typeof item === "object") {
          blocks.push(item as Record<string, unknown>);
        }
      });
    } else if (parsed && typeof parsed === "object") {
      blocks.push(parsed as Record<string, unknown>);
    }
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;

    try {
      pushParsedBlock(JSON.parse(decodeAirbnbHtmlEntities(raw)));
    } catch {
      const parsed = parseLooseJsonFromScript(decodeAirbnbHtmlEntities(raw));
      if (parsed) pushParsedBlock(parsed);
    }
  });

  const rawScriptMatches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of rawScriptMatches) {
    const raw = match[1];
    if (!raw) continue;

    try {
      pushParsedBlock(JSON.parse(decodeAirbnbHtmlEntities(raw)));
    } catch {
      const parsed = parseLooseJsonFromScript(decodeAirbnbHtmlEntities(raw));
      if (parsed) pushParsedBlock(parsed);
    }
  }

  return blocks;
}

function extractStructuredScriptData(html: string): unknown[] {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];

  $("script").each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw || raw.length < 2) return;

    if (!(raw.startsWith("{") || raw.startsWith("["))) {
      return;
    }

    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // ignore non-json scripts
    }
  });

  return blocks;
}

function countAirbnbSections(value: unknown): number {
  if (!value) return 0;

  if (Array.isArray(value)) {
    return value.reduce<number>((total, item) => total + countAirbnbSections(item), 0);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const ownSections = Array.isArray(record.sections) ? record.sections.length : 0;
    return (
      ownSections +
      Object.values(record).reduce<number>(
        (total, entry) => total + countAirbnbSections(entry),
        0
      )
    );
  }

  return 0;
}

function extractAirbnbPhotoUrlsFromRawHtml(html: string): string[] {
  const decoded = decodeAirbnbHtmlEntities(html);
  const matches = decoded.match(
    /https?:\/\/a0\.muscache\.com\/[^"'<>\\\s)]+?\.(?:jpe?g|png|webp)(?:\?[^"'<>\\\s)]*)?/gi
  );

  return dedupeAirbnbPhotoUrls(
    (matches ?? []).filter((value) => !/platform-assets|favicon|icon/i.test(value))
  );
}

function extractAirbnbPhotoUrlsFromDom($: cheerio.CheerioAPI): string[] {
  const values: string[] = [];

  $('img[src*="muscache"], img[srcset*="muscache"], source[srcset*="muscache"]').each(
    (_, el) => {
      const src = $(el).attr("src");
      if (src) values.push(src);

      const srcset = $(el).attr("srcset");
      if (!srcset) return;

      srcset.split(",").forEach((entry) => {
        const candidate = entry.trim().split(/\s+/)[0];
        if (candidate) values.push(candidate);
      });
    }
  );

  return dedupeAirbnbPhotoUrls(values.map(decodeAirbnbHtmlEntities));
}

function buildAirbnbPhotoPageUrl(url: string): string | null {
  const externalId = parseExternalId(url);
  if (!externalId) return null;

  try {
    const parsed = new URL(url);
    parsed.pathname = `/rooms/${externalId}/photos`;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchDirectAirbnbHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      debugGuestAuditLog("[airbnb][photos-debug] direct supplemental fetch failed", {
        url,
        status: response.status,
      });
      return null;
    }

    return await response.text();
  } catch (error) {
    debugGuestAuditLog("[airbnb][photos-debug] direct supplemental fetch failed", {
      url,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function getAirbnbSupplementalHtmlQuality(html: string) {
  const structuredScriptData = extractStructuredScriptData(html);
  const bootstrapData = extractAirbnbBootstrapData(html).blocks;
  const { accepted: bootstrapPhotoSources } =
    collectAirbnbStructuredGallerySources(bootstrapData);
  const photoCount = Math.max(
    mergeAirbnbPhotoSources(bootstrapPhotoSources).length,
    mergeAirbnbPhotoUrlSets([
      extractAirbnbPhotoUrlsFromRawHtml(html),
      structuredScriptData.flatMap((block) => extractImageUrlsFromUnknown(block)),
    ]).length
  );
  const amenityCount = Math.max(
    extractAirbnbVisibleAmenityButtonCount(html) ?? 0,
    extractAirbnbAmenityTitlesFromRawHtml(html).length,
    extractAirbnbAmenitiesFromStructuredData([...bootstrapData, ...structuredScriptData]).length
  );

  return {
    photoCount,
    amenityCount,
    score: photoCount + amenityCount,
  };
}

async function fetchAirbnbSupplementalPhotoHtml(url: string): Promise<string | null> {
  const photoPageUrl = buildAirbnbPhotoPageUrl(url);
  if (!photoPageUrl) return null;

  try {
    let html = await fetchUnlockedHtml(photoPageUrl, {
      platform: "airbnb",
      preferredTransport: "proxy",
    });
    let quality = getAirbnbSupplementalHtmlQuality(html);

    if (quality.photoCount < 12 && quality.amenityCount < 10) {
      const directHtml = await fetchDirectAirbnbHtml(photoPageUrl);
      if (directHtml) {
        const directQuality = getAirbnbSupplementalHtmlQuality(directHtml);
        if (directQuality.score > quality.score) {
          html = directHtml;
          quality = directQuality;
        }
      }
    }

    debugGuestAuditLog("[airbnb][photos-debug] supplemental photo page fetched", {
      url: photoPageUrl,
      length: html.length,
      photoCount: quality.photoCount,
      amenityCount: quality.amenityCount,
    });
    return html;
  } catch (error) {
    debugGuestAuditLog("[airbnb][photos-debug] supplemental photo page failed", {
      url: photoPageUrl,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

const AIRBNB_TEXT_AMENITY_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "Wifi", patterns: [/\bwifi\b/i, /\bwi-fi\b/i] },
  { label: "Cuisine équipée", patterns: [/\bcuisine\b/i, /\bkitchen\b/i] },
  { label: "Parking", patterns: [/\bparking\b/i] },
  { label: "Balcon", patterns: [/\bbalcon\b/i, /\bbalcony\b/i] },
  { label: "Draps fournis", patterns: [/\bdraps?\b/i, /\blinge de lit\b/i] },
  { label: "Serviettes fournies", patterns: [/\bserviettes?\b/i, /\btowels?\b/i] },
  { label: "Lit parapluie", patterns: [/\blit parapluie\b/i, /\bcrib\b/i] },
  { label: "Chaise haute", patterns: [/\bchaise haute\b/i, /\bhigh chair\b/i] },
  { label: "Lave-linge", patterns: [/\bmachine à laver\b/i, /\blave-linge\b/i, /\bwasher\b/i] },
  { label: "Climatisation", patterns: [/\bclimatisation\b/i, /\bair conditioning\b/i] },
  { label: "Piscine", patterns: [/\bpiscine\b/i, /\bpool\b/i] },
  { label: "Télévision", patterns: [/\btélévision\b/i, /\btv\b/i] },
];

function extractAirbnbAmenityFallbacksFromText(text: string): string[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  return AIRBNB_TEXT_AMENITY_RULES.flatMap((rule) =>
    rule.patterns.some((pattern) => pattern.test(normalized)) ? [rule.label] : []
  );
}

function isUsefulAirbnbAmenityLabel(value: string): boolean {
  const normalized = normalizeWhitespace(value);
  if (normalized.length < 2 || normalized.length > 100) return false;

  return !/^(?:Amenity|AmenitiesGroup|LocationDetail|BasicListItem|Cuisine et salle à manger|Salle de bain|Chambre et linge|Divertissement|Famille|Chauffage et climatisation|Sécurité à la maison|Internet et bureau|Parking et installations|Services|Non inclus)$/i.test(
    normalized
  ) &&
    !/afficher|show all|voir plus|en savoir plus|indisponible|non inclus|découvrez d'autres|airbnb|★|^\d+\s+lits?$/i.test(
      normalized
    );
}

function extractAirbnbVisibleAmenityButtonCount(html: string): number | null {
  const decoded = decodeAirbnbHtmlEntities(html);
  const match =
    decoded.match(/afficher\s+(?:les\s+)?(\d{1,3})\s+[ée]quipements?/i) ??
    decoded.match(/show\s+all\s+(\d{1,3})\s+amenit(?:y|ies)/i);

  if (!match?.[1]) return null;

  const count = Number.parseInt(match[1], 10);
  return Number.isFinite(count) && count > 0 ? count : null;
}

function normalizeAirbnbAmenityKey(value: string): string {
  const normalized = normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(?:gratuit|gratuite|prive|privee|partage|partagee)\b/g, "")
    .replace(/\b(?:dans le logement|sur place|a proximite|disponible)\b/g, "")
    .replace(/[:;,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/\bwi-?fi\b/.test(normalized)) return "wifi";
  if (/\b(?:cuisine|kitchen)\b/.test(normalized)) return "cuisine";
  if (/\b(?:parking|stationnement|garage)\b/.test(normalized)) return "parking";
  if (/\b(?:lave linge|machine a laver|washer)\b/.test(normalized)) return "lave-linge";
  if (/\b(?:seche linge|dryer)\b/.test(normalized)) return "seche-linge";
  if (/\b(?:television|tv)\b/.test(normalized)) return "television";
  if (/\b(?:patio|balcon|balcony)\b/.test(normalized)) return "balcon";
  if (/\b(?:climatisation|air conditioning)\b/.test(normalized)) return "climatisation";
  if (/\b(?:seche cheveux|hair dryer)\b/.test(normalized)) return "seche-cheveux";
  if (/\b(?:lit parapluie|crib)\b/.test(normalized)) return "lit-parapluie";
  if (/\b(?:chaise haute|high chair)\b/.test(normalized)) return "chaise-haute";

  return normalized;
}

function cleanAirbnbAmenityLabel(value: string): string {
  const cleaned = normalizeWhitespace(value)
    .replace(/^priv[ée]\s*:\s*/i, "")
    .replace(/\s*\((?:Gratuit|Free)\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+:\s+/g, " : ")
    .trim();

  return cleaned ? cleaned.charAt(0).toLocaleUpperCase("fr-FR") + cleaned.slice(1) : "";
}

function dedupeAirbnbAmenities(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanAirbnbAmenityLabel(value);
    if (!isUsefulAirbnbAmenityLabel(cleaned)) continue;

    const key = normalizeAirbnbAmenityKey(cleaned);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function pickAirbnbAmenitySourceClosestToCount(
  sources: Array<{ label: string; values: string[] }>,
  visibleCount: number | null
): string {
  if (!visibleCount) return "structured";

  return sources
    .filter((source) => source.values.length > 0)
    .sort((a, b) => {
      const aDistance = Math.abs(a.values.length - visibleCount);
      const bDistance = Math.abs(b.values.length - visibleCount);
      if (aDistance !== bDistance) return aDistance - bDistance;
      return b.values.length - a.values.length;
    })[0]?.label ?? "structured";
}

function decodeJsonStringLiteral(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return value;
  }
}

function extractAirbnbAmenityTitlesFromRawHtml(html: string): string[] {
  const decoded = decodeAirbnbHtmlEntities(html);
  const matches = decoded.matchAll(
    /"__typename"\s*:\s*"Amenity"[^{}]{0,800}?"available"\s*:\s*true[^{}]{0,800}?"title"\s*:\s*"([^"]{2,140})"/gi
  );

  return uniqueStrings(
    [...matches]
      .map((match) => decodeJsonStringLiteral(match[1]))
      .map(normalizeWhitespace)
      .filter(isUsefulAirbnbAmenityLabel)
  ).slice(0, 100);
}

function extractAirbnbVisibleAmenitiesFromDom($: cheerio.CheerioAPI): string[] {
  const candidates = $(
    '[data-testid*="amenity"], [aria-label*="amenity"], [aria-label*="équipement"], li, span'
  )
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(
      (value) =>
        isUsefulAirbnbAmenityLabel(value) &&
        AIRBNB_TEXT_AMENITY_RULES.some((rule) =>
          rule.patterns.some((pattern) => pattern.test(value))
        )
    );

  return uniqueStrings(candidates).slice(0, 80);
}

function extractBalancedJsonSubstring(source: string, startIndex: number): string | null {
  const opening = source[startIndex];
  const closing = opening === "{" ? "}" : opening === "[" ? "]" : "";
  if (!closing) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  return null;
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

function getAirbnbValueType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function scoreAirbnbGalleryDiagnosticPath(path: string) {
  const lower = path.toLowerCase();
  let score = 0;

  if (lower.includes("stayproductdetailpage.phototour")) score += 100;
  if (lower.includes("presentation.stayproductdetailpage")) score += 60;
  if (lower.includes("stayproductdetailpage")) score += 45;
  if (lower.includes("sections")) score += 30;
  if (lower.includes("gallery")) score += 25;
  if (lower.includes("slideshow")) score += 20;
  if (lower.includes("media")) score += 15;
  if (lower.includes("images")) score += 12;
  if (lower.includes("photos")) score += 12;
  if (lower.includes("imagetour")) score += 10;
  if (lower.includes("imggallery")) score += 10;
  if (lower.includes("imagegallery")) score += 10;
  if (lower.includes("items")) score += 8;
  if (lower.includes("data")) score += 5;
  if (/hero|preview|cover|thumb|thumbnail|small/.test(lower)) score -= 80;

  return score;
}

function categorizeAirbnbGalleryPath(path: string): "listing_gallery" | "blocked_gallery" | "non_listing" {
  const lower = path.toLowerCase();

  if (/hero|preview|cover|thumb|thumbnail|small/.test(lower)) {
    return "blocked_gallery";
  }

  if (
    /stayproductdetailpage|presentation|phototour|gallery|slideshow|media|sections|images|photos/.test(
      lower
    )
  ) {
    return "listing_gallery";
  }

  return "non_listing";
}

function collectAirbnbGalleryPathDiagnostics(
  value: unknown,
  blockIndex: number,
  path: string[] = []
): AirbnbGalleryPathDiagnostic[] {
  if (!value) return [];

  const joinedPath = path.join(".");
  const matchesGalleryKeyword =
    joinedPath.length > 0 &&
    /phototour|images|photos|imagegallery|sections|items|data|presentation\.stayproductdetailpage|stayproductdetailpage|media|slideshow|gallery/i.test(
      joinedPath
    );
  const directUrls = extractImageUrlsFromUnknown(value).filter(isLikelyAirbnbPhotoUrl);
  const diagnostics: AirbnbGalleryPathDiagnostic[] = [];

  if (matchesGalleryKeyword) {
    diagnostics.push({
      blockIndex,
      path: joinedPath,
      valueType: getAirbnbValueType(value),
      arrayLength: Array.isArray(value) ? value.length : 0,
      imageCount: directUrls.length,
      category: categorizeAirbnbGalleryPath(joinedPath),
      sampleUrls: directUrls.slice(0, 3),
      sampleObjects:
        Array.isArray(value)
          ? value
              .filter((item) => typeof item === "object" && item !== null)
              .slice(0, 3)
          : typeof value === "object" && value !== null
            ? [value]
            : [],
      pathScore: scoreAirbnbGalleryDiagnosticPath(joinedPath),
    });
  }

  if (Array.isArray(value)) {
    return diagnostics.concat(
      value.flatMap((item, index) =>
        collectAirbnbGalleryPathDiagnostics(item, blockIndex, [...path, String(index)])
      )
    );
  }

  if (typeof value === "object") {
    return diagnostics.concat(
      Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
        collectAirbnbGalleryPathDiagnostics(entry, blockIndex, [...path, key])
      )
    );
  }

  return diagnostics;
}

function buildBootstrapScriptLabel(
  index: number,
  attrs: Record<string, string | undefined>
) {
  return (
    attrs.id ||
    attrs["data-deferred-state"] ||
    attrs["data-state"] ||
    attrs.type ||
    `script-${index}`
  );
}

function extractAirbnbBootstrapData(html: string): {
  blocks: unknown[];
  scriptCount: number;
  diagnostics: AirbnbBootstrapScriptDiagnostic[];
} {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];
  const diagnostics: AirbnbBootstrapScriptDiagnostic[] = [];
  let scriptCount = 0;

  $("script").each((index, el) => {
    scriptCount += 1;
    const raw = $(el).html();
    if (!raw) return;

    const attrs = {
      id: $(el).attr("id"),
      type: $(el).attr("type"),
      "data-deferred-state": $(el).attr("data-deferred-state"),
      "data-state": $(el).attr("data-state"),
    };
    const label = buildBootstrapScriptLabel(index, attrs);
    const type = attrs.type || "text/javascript";
    const hasInitialState = raw.includes("__INITIAL_STATE__");
    const hasNiobeMinimalClientData = raw.includes("niobeMinimalClientData");
    const hasDeferredState =
      Boolean(attrs["data-deferred-state"]) || raw.includes("data-deferred-state");
    const hasStayProductDetailPage = raw.includes("stayProductDetailPage");
    const hasPhotoTour = raw.includes("photoTour");
    const hasPresentation = raw.includes("presentation");
    const hasSections = raw.includes("sections");
    const isCandidate =
      hasInitialState ||
      hasNiobeMinimalClientData ||
      hasDeferredState ||
      hasStayProductDetailPage ||
      hasPhotoTour ||
      hasPresentation ||
      hasSections;

    if (isCandidate) {
      diagnostics.push({
        label,
        type,
        length: raw.length,
        hasInitialState,
        hasNiobeMinimalClientData,
        hasDeferredState,
        hasStayProductDetailPage,
        hasPhotoTour,
        hasPresentation,
        hasSections,
      });
    }

    if (raw.includes("window.__INITIAL_STATE__")) {
      const parsed = extractJsonValueAfterMarker(raw, "window.__INITIAL_STATE__");
      if (parsed) {
        blocks.push(parsed);
      }
    }

    if (raw.includes("niobeMinimalClientData")) {
      const parsed = extractJsonValueAfterMarker(raw, "niobeMinimalClientData");
      if (parsed) {
        blocks.push(parsed);
      }
    }

    if (hasDeferredState || /application\/json|text\/json/i.test(type)) {
      const parsed = parseLooseJsonFromScript(raw);
      if (parsed) {
        blocks.push(parsed);
      }
    }

    if (isCandidate && !hasInitialState && !hasNiobeMinimalClientData && !hasDeferredState) {
      const parsed = parseLooseJsonFromScript(raw);
      if (parsed) {
        blocks.push(parsed);
      }
    }
  });

  return { blocks, scriptCount, diagnostics };
}

function isLikelyAirbnbPhotoUrl(value: string): boolean {
  return getAirbnbPhotoUrlRejectionReason(value) === null;
}

function getAirbnbPhotoUrlRejectionReason(value: string): string | null {
  if (!/^https?:\/\//i.test(value)) {
    return "not_http_url";
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return "invalid_url";
  }

  const hostname = url.hostname.toLowerCase();
  const lower = value.toLowerCase();
  const hasKnownAirbnbImageHost =
    hostname.includes("muscache.com") ||
    hostname.includes("airbnbusercontent.com") ||
    hostname.includes("airbnb.com");
  const hasKnownAirbnbImagePath =
    lower.includes("/im/pictures/") ||
    lower.includes("/pictures/") ||
    lower.includes("/im/ml/") ||
    lower.includes("/hosting/") ||
    lower.includes("/images/");

  if (!hasKnownAirbnbImageHost || !hasKnownAirbnbImagePath) {
    return "unknown_airbnb_image_host_or_path";
  }

  if (
    lower.includes("avatar") ||
    lower.includes("profile") ||
    lower.includes("user") ||
    (lower.includes("host") && !lower.includes("/hosting/") && !lower.includes("/hosting-")) ||
    lower.includes("icon") ||
    lower.includes("logo") ||
    lower.includes("placeholder") ||
    lower.includes("thumbnail") ||
    lower.includes("thumb")
  ) {
    return "non_listing_asset";
  }

  return null;
}

type AirbnbPhotoSource = {
  label: string;
  priority: number;
  urls: string[];
  sectionId?: string | null;
  sectionComponentType?: string | null;
};

type AirbnbRejectedPhotoSource = {
  label: string;
  reasonRejected: string;
  sectionId: string | null;
  sectionComponentType: string | null;
  rawCount: number;
};

type AirbnbPhotoTourSectionMatch = {
  path: string;
  sectionContainer: Record<string, unknown>;
};

type AirbnbCalendarSectionMatch = {
  path: string;
  sectionContainer: Record<string, unknown>;
};

const AIRBNB_NON_LISTING_SECTION_PATTERN =
  /what_counts_as_a_pet|service animals|policies_default|book_it_floating_footer|accessibility|legal|help|guest safety|modal/i;

function mergeAirbnbPhotoUrlSets(sources: string[][]): string[] {
  // Airbnb often spreads the real listing gallery across several sections.
  return dedupeAirbnbPhotoUrls(sources.flatMap((source) => source));
}

function mergeAirbnbPhotoSources(sources: AirbnbPhotoSource[]): string[] {
  return mergeAirbnbPhotoUrlSets(sources.map((source) => source.urls));
}

function dedupeAirbnbPhotoSources(sources: AirbnbPhotoSource[]): AirbnbPhotoSource[] {
  const seen = new Set<string>();

  return sources.filter((source) => {
    const key = `${source.priority}:${source.label}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isBlockedAirbnbGalleryPath(path: string[]) {
  return path.some((segment) =>
    /previewimages|heroimages|coverimages|thumbnail|thumbnails|thumb|smallimages/i.test(segment)
  );
}

function getAirbnbSectionMetadata(record: Record<string, unknown>) {
  return {
    sectionId: typeof record.sectionId === "string" ? record.sectionId : null,
    sectionComponentType:
      typeof record.sectionComponentType === "string" ? record.sectionComponentType : null,
    title: typeof record.title === "string" ? record.title : null,
  };
}

function getObjectKeys(value: unknown): string[] {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>)
    : [];
}

function collectPhotoTourInterestingPaths(
  value: unknown,
  path: string[] = []
): string[] {
  if (!value) return [];

  const joinedPath = path.join(".");
  const matches =
    joinedPath.length > 0 &&
    /image|images|media|mediaitems|photo|phototour|imagegallery|baseurl|picture/i.test(
      joinedPath
    )
      ? [joinedPath]
      : [];

  if (Array.isArray(value)) {
    return matches.concat(
      value.flatMap((item, index) =>
        collectPhotoTourInterestingPaths(item, [...path, String(index)])
      )
    );
  }

  if (typeof value === "object") {
    return matches.concat(
      Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
        collectPhotoTourInterestingPaths(entry, [...path, key])
      )
    );
  }

  return matches;
}

function getAirbnbPhotoTourSectionsFromSectionsArray(
  root: unknown,
  path: string[] = []
): AirbnbPhotoTourSectionMatch[] {
  if (!root) return [];

  if (Array.isArray(root)) {
    return root.flatMap((item, index) =>
      getAirbnbPhotoTourSectionsFromSectionsArray(item, [...path, String(index)])
    );
  }

  if (typeof root === "object") {
    const record = root as Record<string, unknown>;
    const matches: AirbnbPhotoTourSectionMatch[] = [];

    for (const [key, entry] of Object.entries(record)) {
      const nextPath = [...path, key];

      if (key === "sections" && Array.isArray(entry)) {
        entry.forEach((item, index) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return;

          const sectionContainer = item as Record<string, unknown>;
          const metadata = getAirbnbSectionMetadata(sectionContainer);
          if (
            metadata.sectionComponentType === "PHOTO_TOUR_SCROLLABLE" ||
            metadata.sectionId === "PHOTO_TOUR_SCROLLABLE_MODAL"
          ) {
            matches.push({
              path: [...nextPath, String(index)].join("."),
              sectionContainer,
            });
          }
        });
      }

      matches.push(...getAirbnbPhotoTourSectionsFromSectionsArray(entry, nextPath));
    }

    return matches;
  }

  return [];
}

function getAirbnbCalendarSectionsFromSectionsArray(
  root: unknown,
  path: string[] = []
): AirbnbCalendarSectionMatch[] {
  if (!root) return [];

  if (Array.isArray(root)) {
    return root.flatMap((item, index) =>
      getAirbnbCalendarSectionsFromSectionsArray(item, [...path, String(index)])
    );
  }

  if (typeof root === "object") {
    const record = root as Record<string, unknown>;
    const matches: AirbnbCalendarSectionMatch[] = [];

    for (const [key, entry] of Object.entries(record)) {
      const nextPath = [...path, key];

      if (key === "sections" && Array.isArray(entry)) {
        entry.forEach((item, index) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return;

          const sectionContainer = item as Record<string, unknown>;
          const metadata = getAirbnbSectionMetadata(sectionContainer);
          if (
            metadata.sectionComponentType === "AVAILABILITY_CALENDAR_DEFAULT" ||
            metadata.sectionId === "AVAILABILITY_CALENDAR_DEFAULT" ||
            metadata.sectionComponentType === "BOOK_IT_CALENDAR_SHEET" ||
            metadata.sectionId === "BOOK_IT_CALENDAR_SHEET"
          ) {
            matches.push({
              path: [...nextPath, String(index)].join("."),
              sectionContainer,
            });
          }
        });
      }

      matches.push(...getAirbnbCalendarSectionsFromSectionsArray(entry, nextPath));
    }

    return matches;
  }

  return [];
}

function isNonListingAirbnbSection(record: Record<string, unknown>, path: string[]) {
  const metadata = getAirbnbSectionMetadata(record);
  const joinedPath = path.join(".").toLowerCase();
  const joinedValues = Object.values(record)
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
  const combined = [
    joinedPath,
    metadata.sectionId ?? "",
    metadata.sectionComponentType ?? "",
    metadata.title ?? "",
    joinedValues,
  ]
    .join(" ")
    .toLowerCase();

  return (
    AIRBNB_NON_LISTING_SECTION_PATTERN.test(combined) ||
    /policy|policies|host|profile/.test(combined)
  );
}

function hasClearAirbnbGallerySignals(record: Record<string, unknown>, path: string[]) {
  const joinedPath = path.join(".").toLowerCase();
  const metadata = getAirbnbSectionMetadata(record);
  const combined = [
    joinedPath,
    metadata.sectionId ?? "",
    metadata.sectionComponentType ?? "",
    metadata.title ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return /phototour|imagegallery|gallery|photos|hero|mediaitems/.test(combined);
}

function isPhotoTourScrollableSection(record: Record<string, unknown>) {
  const metadata = getAirbnbSectionMetadata(record);

  return (
    metadata.sectionComponentType === "PHOTO_TOUR_SCROLLABLE" ||
    metadata.sectionId === "PHOTO_TOUR_SCROLLABLE_MODAL"
  );
}

function extractAirbnbPhotoTourUrlsDeep(section: unknown): string[] {
  const matchedUrls: string[] = [];
  const targetedKeys = new Set([
    "baseUrl",
    "url",
    "imageUrl",
    "pictureUrl",
    "originalUrl",
    "largeUrl",
    "xlPictureUrl",
    "previewEncodedPng",
    "images",
    "mediaItems",
    "photos",
    "imageGallery",
    "items",
    "sections",
    "photoTour",
    "picture",
    "src",
  ]);

  function visit(value: unknown) {
    if (!value) return;

    if (typeof value === "string") {
      if (isLikelyAirbnbPhotoUrl(value)) {
        matchedUrls.push(value);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
      return;
    }

    if (typeof value === "object") {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (targetedKeys.has(key)) {
          matchedUrls.push(
            ...extractImageUrlsFromUnknown(entry).filter(isLikelyAirbnbPhotoUrl)
          );
        }
        visit(entry);
      }
    }
  }

  visit(section);

  return dedupeAirbnbPhotoUrls(matchedUrls);
}

function extractAirbnbPhotoTourUrlsFromSectionContainer(sectionContainer: unknown): string[] {
  if (!sectionContainer || typeof sectionContainer !== "object" || Array.isArray(sectionContainer)) {
    return [];
  }

  const record = sectionContainer as Record<string, unknown>;
  const section = record.section;
  if (!section) {
    return [];
  }

  const sectionRecord =
    section && typeof section === "object" && !Array.isArray(section)
      ? (section as Record<string, unknown>)
      : {};
  const mediaItems = Array.isArray(sectionRecord.mediaItems) ? sectionRecord.mediaItems : [];
  const rawUrlsBeforeFilter: string[] = [];
  const urlsAfterFilter: string[] = [];
  const mediaItemUrls = mediaItems.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const mediaItem = item as Record<string, unknown>;
    const image =
      mediaItem.image && typeof mediaItem.image === "object" && !Array.isArray(mediaItem.image)
        ? (mediaItem.image as Record<string, unknown>)
        : {};
    const baseUrl = typeof mediaItem.baseUrl === "string" ? mediaItem.baseUrl : null;
    const url = typeof mediaItem.url === "string" ? mediaItem.url : null;
    const src = typeof mediaItem.src === "string" ? mediaItem.src : null;
    const pictureUrl =
      typeof mediaItem.pictureUrl === "string" ? mediaItem.pictureUrl : null;
    const imageBaseUrl = typeof image.baseUrl === "string" ? image.baseUrl : null;
    const imageUrl = typeof image.url === "string" ? image.url : null;
    const imageSrc = typeof image.src === "string" ? image.src : null;
    const previewEncodedPng =
      typeof mediaItem.previewEncodedPng === "string" ? mediaItem.previewEncodedPng : null;

    const orderedCandidates = [
      baseUrl,
      url,
      src,
      pictureUrl,
      imageBaseUrl,
      imageUrl,
      imageSrc,
      previewEncodedPng,
    ];
    const stringCandidates = orderedCandidates.filter(
      (value): value is string => typeof value === "string"
    );

    rawUrlsBeforeFilter.push(...stringCandidates);

    const acceptedCandidates = stringCandidates.filter((candidate) => {
      const accepted = isLikelyAirbnbPhotoUrl(candidate);
      if (accepted) {
        urlsAfterFilter.push(candidate);
      }
      return accepted;
    });

    return acceptedCandidates;
  });
  const dedupedMediaItemUrls = dedupeAirbnbPhotoUrls(mediaItemUrls);

  debugGuestAuditLog("[guest-audit][airbnb][photo-tour] mediaItems summary:", {
    mediaItemsCount: mediaItems.length,
    rawUrlCandidates: rawUrlsBeforeFilter.length,
    acceptedAfterFilter: urlsAfterFilter.length,
    extractedUrls: mediaItemUrls.length,
    dedupedCount: dedupedMediaItemUrls.length,
  });

  if (dedupedMediaItemUrls.length > 0) {
    return dedupedMediaItemUrls;
  }

  return extractAirbnbPhotoTourUrlsDeep(section);
}

function extractAirbnbPhotoTourImagesFromSection(section: unknown): string[] {
  const targetedKeys = new Set([
    "images",
    "mediaItems",
    "photos",
    "imageGallery",
    "items",
    "sections",
    "presentation",
    "photoTour",
    "baseUrl",
    "url",
    "imageUrl",
    "picture",
    "src",
    "originalPicture",
    "large",
    "xlPicture",
    "displaySrc",
  ]);

  const targetedUrls: string[] = [];

  function visit(value: unknown, path: string[] = []) {
    if (!value) return;

    if (typeof value === "string") {
      if (isLikelyAirbnbPhotoUrl(value)) {
        targetedUrls.push(value);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index)]));
      return;
    }

    if (typeof value === "object") {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        const nextPath = [...path, key];
        if (targetedKeys.has(key)) {
          targetedUrls.push(
            ...extractImageUrlsFromUnknown(entry).filter(isLikelyAirbnbPhotoUrl)
          );
        }
        visit(entry, nextPath);
      }
    }
  }

  visit(section);

  const broadUrls =
    targetedUrls.length <= 2
      ? extractImageUrlsFromUnknown(section).filter(isLikelyAirbnbPhotoUrl)
      : [];

  return dedupeAirbnbPhotoUrls([...targetedUrls, ...broadUrls]);
}

function collectRawAirbnbPhotoTourUrls(section: unknown): string[] {
  const urls = extractImageUrlsFromUnknown(section).filter(isLikelyAirbnbPhotoUrl);
  return urls;
}

function extractAirbnbSectionGalleryUrls(record: Record<string, unknown>): string[] {
  const candidates = [
    record.items,
    record.data,
    record.images,
    record.imageGallery,
    record.photoTour,
    record.mediaItems,
  ];

  return dedupeAirbnbPhotoUrls(
    candidates
      .flatMap((value) => extractImageUrlsFromUnknown(value))
      .filter(isLikelyAirbnbPhotoUrl)
  );
}

function isLikelyAirbnbGallerySection(record: Record<string, unknown>, path: string[]) {
  const joinedPath = path.join(".").toLowerCase();
  const joinedValues = Object.values(record)
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (!joinedPath.includes("sections") || isBlockedAirbnbGalleryPath(path)) {
    return false;
  }

  if (isNonListingAirbnbSection(record, path)) {
    return false;
  }

  return (
    hasClearAirbnbGallerySignals(record, path) ||
    /photo|gallery/.test(joinedValues) ||
    typeof record.sectionId === "string" &&
      /photo|gallery/.test(record.sectionId.toLowerCase())
  );
}

function collectAirbnbStructuredGallerySources(bootstrapData: unknown[]): {
  accepted: AirbnbPhotoSource[];
  rejected: AirbnbRejectedPhotoSource[];
} {
  const accepted: AirbnbPhotoSource[] = [];
  const rejected: AirbnbRejectedPhotoSource[] = [];
  const matchedPhotoTourSections = bootstrapData.flatMap((block) =>
    getAirbnbPhotoTourSectionsFromSectionsArray(block)
  );

  debugGuestAuditLog(
    "[guest-audit][airbnb][photo-tour] matched sections count:",
    matchedPhotoTourSections.length
  );

  matchedPhotoTourSections.forEach(({ path, sectionContainer }) => {
    const metadata = getAirbnbSectionMetadata(sectionContainer);
    const sectionRecord =
      sectionContainer.section && typeof sectionContainer.section === "object"
        ? (sectionContainer.section as Record<string, unknown>)
        : {};
    const interestingPaths = uniqueStrings(
      collectPhotoTourInterestingPaths(sectionContainer.section).slice(0, 30)
    );
    const rawUrls = collectRawAirbnbPhotoTourUrls(sectionContainer.section);
    const deepUrls = extractAirbnbPhotoTourUrlsFromSectionContainer(sectionContainer);

    debugGuestAuditLog("[guest-audit][airbnb][photo-tour] matched section container:", {
      path,
      sectionComponentType: metadata.sectionComponentType,
      sectionId: metadata.sectionId,
      keys: Object.keys(sectionContainer),
    });
    debugGuestAuditLog("[guest-audit][airbnb][photo-tour] keys:", {
      section: getObjectKeys(sectionContainer.section),
      preview: getObjectKeys(sectionRecord.preview),
      mediaItems: getObjectKeys(sectionRecord.mediaItems),
      images: getObjectKeys(sectionRecord.images),
      photoTour: getObjectKeys(sectionRecord.photoTour),
      imageGallery: getObjectKeys(sectionRecord.imageGallery),
      interestingPaths,
    });
    debugGuestAuditLog("[guest-audit][airbnb][photo-tour] raw count:", rawUrls.length);
    debugGuestAuditLog("[guest-audit][airbnb][photo-tour] deduped count:", deepUrls.length);
    debugGuestAuditLog("[guest-audit][airbnb][photo-tour] sample urls:", deepUrls.slice(0, 5));

    if (deepUrls.length > 0) {
      accepted.push({
        label: `photo_tour_section_container:${path}`,
        priority: 1000,
        urls: deepUrls,
        sectionId: metadata.sectionId,
        sectionComponentType: metadata.sectionComponentType,
      });
    }
  });

  bootstrapData
    .flatMap((block) => flattenStructuredObjects(block))
    .forEach(({ path, record }) => {
      const joinedPath = path.join(".");
      const metadata = getAirbnbSectionMetadata(record);

      if (isBlockedAirbnbGalleryPath(path)) {
        return;
      }

      if (isPhotoTourScrollableSection(record) && !isNonListingAirbnbSection(record, path)) {
        const interestingPaths = uniqueStrings(
          collectPhotoTourInterestingPaths(record).slice(0, 30)
        );
        const sectionRecord =
          record.section && typeof record.section === "object"
            ? (record.section as Record<string, unknown>)
            : {};
        const rawUrls = collectRawAirbnbPhotoTourUrls(record);
        const deepUrls = extractAirbnbPhotoTourUrlsDeep(record);
        const urls = extractAirbnbPhotoTourImagesFromSection(record);
        debugGuestAuditLog("[guest-audit][airbnb][photo-tour] path:", joinedPath);
        debugGuestAuditLog("[guest-audit][airbnb][photo-tour] found section", {
          sectionComponentType: metadata.sectionComponentType,
          sectionId: metadata.sectionId,
          extractedRawUrlsCount: rawUrls.length,
          extractedUrlsSample: rawUrls.slice(0, 5),
          finalDedupedCount: urls.length,
        });
        debugGuestAuditLog("[guest-audit][airbnb][photo-tour] keys:", {
          section: Object.keys(record),
          nestedSection: getObjectKeys(record.section),
          preview: getObjectKeys(sectionRecord.preview),
          mediaItems: getObjectKeys(sectionRecord.mediaItems),
          images: getObjectKeys(sectionRecord.images),
          photoTour: getObjectKeys(sectionRecord.photoTour),
          imageGallery: getObjectKeys(sectionRecord.imageGallery),
          interestingPaths,
        });
        debugGuestAuditLog("[guest-audit][airbnb][photo-tour] deep raw count:", rawUrls.length);
        debugGuestAuditLog("[guest-audit][airbnb][photo-tour] deep deduped count:", deepUrls.length);
        debugGuestAuditLog(
          "[guest-audit][airbnb][photo-tour] sample urls:",
          deepUrls.slice(0, 5)
        );

        if (deepUrls.length >= 5) {
          accepted.push({
            label: `photo_tour_scrollable_deep:${joinedPath}`,
            priority: 1000,
            urls: deepUrls,
            sectionId: metadata.sectionId,
            sectionComponentType: metadata.sectionComponentType,
          });
          return;
        }

        if (urls.length > 0) {
          accepted.push({
            label: joinedPath,
            priority: 400,
            urls,
            sectionId: metadata.sectionId,
            sectionComponentType: metadata.sectionComponentType,
          });
        }
        return;
      }

      if (/stayproductdetailpage\.phototour/i.test(joinedPath)) {
        const urls = dedupeAirbnbPhotoUrls(extractImageUrlsFromUnknown(record));
        if (urls.length > 0) {
          accepted.push({
            label: joinedPath,
            priority: 300,
            urls,
            sectionId: metadata.sectionId,
            sectionComponentType: metadata.sectionComponentType,
          });
        }
        return;
      }

      if (/presentation\.stayproductdetailpage\.sections/i.test(joinedPath)) {
        const urls = extractAirbnbSectionGalleryUrls(record);
        if (urls.length === 0) {
          return;
        }

        if (isNonListingAirbnbSection(record, path)) {
          rejected.push({
            label: joinedPath,
            reasonRejected: "non_listing_section",
            sectionId: metadata.sectionId,
            sectionComponentType: metadata.sectionComponentType,
            rawCount: urls.length,
          });
          return;
        }

        if (!hasClearAirbnbGallerySignals(record, path)) {
          rejected.push({
            label: joinedPath,
            reasonRejected: "missing_gallery_signals",
            sectionId: metadata.sectionId,
            sectionComponentType: metadata.sectionComponentType,
            rawCount: urls.length,
          });
          return;
        }

        if (urls.length <= 2) {
          rejected.push({
            label: joinedPath,
            reasonRejected: "too_small_for_gallery_section",
            sectionId: metadata.sectionId,
            sectionComponentType: metadata.sectionComponentType,
            rawCount: urls.length,
          });
          return;
        }

        accepted.push({
          label: joinedPath,
          priority: 200,
          urls,
          sectionId: metadata.sectionId,
          sectionComponentType: metadata.sectionComponentType,
        });
        return;
      }

      if (isLikelyAirbnbGallerySection(record, path)) {
        const urls = extractAirbnbSectionGalleryUrls(record);
        if (urls.length === 0) {
          return;
        }

        if (urls.length <= 2 && /mediaitem/i.test(joinedPath)) {
          rejected.push({
            label: joinedPath,
            reasonRejected: "isolated_media_item",
            sectionId: metadata.sectionId,
            sectionComponentType: metadata.sectionComponentType,
            rawCount: urls.length,
          });
          return;
        }

        accepted.push({
          label: joinedPath,
          priority: 100,
          urls,
          sectionId: metadata.sectionId,
          sectionComponentType: metadata.sectionComponentType,
        });
        return;
      }
    })
  ;

  return {
    accepted: dedupeAirbnbPhotoSources(accepted).sort((a, b) => b.priority - a.priority),
    rejected,
  };
}

function flattenStructuredObjects(value: unknown, path: string[] = []): Array<{
  path: string[];
  record: Record<string, unknown>;
}> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (Array.isArray(value)) {
      return value.flatMap((item) => flattenStructuredObjects(item, path));
    }
    return [];
  }

  const record = value as Record<string, unknown>;
  const current = [{ path, record }];

  return current.concat(
    Object.entries(record).flatMap(([key, entry]) =>
      flattenStructuredObjects(entry, [...path, key])
    )
  );
}

function scoreAirbnbStructuredRecord(record: Record<string, unknown>, path: string[]) {
  const joinedPath = path.join(".").toLowerCase();
  let score = 0;

  if (/stayproductdetailpage|listing|pdp|presentation/i.test(joinedPath)) score += 8;
  if ("images" in record) score += 5;
  if ("description" in record) score += 4;
  if ("title" in record || "name" in record) score += 4;
  if ("amenities" in record || "previewAmenitiesGroups" in record) score += 3;
  if ("avgRatingLocalized" in record || "starRating" in record || "reviewCount" in record) {
    score += 2;
  }

  return score;
}

function findBestAirbnbStructuredRecord(bootstrapData: unknown[]): Record<string, unknown> | null {
  return bootstrapData
    .flatMap((block) => flattenStructuredObjects(block))
    .sort(
      (a, b) =>
        scoreAirbnbStructuredRecord(b.record, b.path) -
        scoreAirbnbStructuredRecord(a.record, a.path)
    )[0]
    ?.record ?? null;
}

function findStructuredString(
  value: unknown,
  keyPatterns: RegExp[],
  minLength = 1,
  path: string[] = []
): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => findStructuredString(item, keyPatterns, minLength, path));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const matches: string[] = [];

    for (const [key, entry] of Object.entries(record)) {
      const nextPath = [...path, key];
      if (typeof entry === "string") {
        const normalized = normalizeWhitespace(entry);
        if (
          normalized.length >= minLength &&
          keyPatterns.some((pattern) => pattern.test(key)) &&
          !/metadata|seo|breadcrumb/i.test(nextPath.join("."))
        ) {
          matches.push(normalized);
        }
      } else {
        matches.push(...findStructuredString(entry, keyPatterns, minLength, nextPath));
      }
    }

    return matches;
  }

  return [];
}

function findStructuredHostNameCandidates(value: unknown, path: string[] = []): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return uniqueStrings(
      value.flatMap((item) => findStructuredHostNameCandidates(item, path))
    );
  }

  if (typeof value !== "object") return [];

  const matches: string[] = [];
  const record = value as Record<string, unknown>;

  for (const [key, entry] of Object.entries(record)) {
    const nextPath = [...path, key];
    const pathText = nextPath.join(".").toLowerCase();
    const keyLooksLikeName = /(?:^|\.)(?:name|first_?name|display_?name)$/i.test(key);
    const pathLooksLikeHost =
      /host|h[oô]te|user|profile|person|owner|primaryhost/i.test(pathText);

    if (typeof entry === "string") {
      const normalized = normalizeWhitespace(entry);
      if (
        normalized &&
        pathLooksLikeHost &&
        (keyLooksLikeName || /host_?name|primaryhost/i.test(pathText))
      ) {
        matches.push(normalized);
      }
      continue;
    }

    matches.push(...findStructuredHostNameCandidates(entry, nextPath));
  }

  return uniqueStrings(matches);
}

function isGenericAirbnbTitle(value: string) {
  const normalized = normalizeWhitespace(value);
  return (
    normalized.length < 6 ||
    AIRBNB_GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    looksLikeAirbnbAmenityLabel(normalized) ||
    looksLikeAirbnbBedSummary(normalized) ||
    looksLikeAirbnbRoomSummary(normalized)
  );
}

function isUsefulAirbnbDescription(value: string) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length < 120) return false;
  if (AIRBNB_GENERIC_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  return /[.!?]/.test(normalized) || normalized.split(" ").length >= 25;
}

function scoreAirbnbDescriptionCandidate(source: string, value: string) {
  const normalized = normalizeWhitespace(value);
  let score = Math.min(normalized.length, 1800);

  if (/[.!?]/.test(normalized)) score += 120;
  if (normalized.split(" ").length >= 40) score += 120;
  if (normalized.split(" ").length >= 80) score += 120;
  if (normalized.includes("\n")) score += 30;
  if (/bootstrap_structured|best_structured_record/.test(source)) score += 240;
  if (/description_modal_section|description_default_section/.test(source)) score += 260;
  if (/description_modal_section/.test(source) && normalized.length >= 320) score += 220;
  if (/json_ld_description/.test(source)) score += 90;
  if (/meta_description|og_description/.test(source)) score -= 120;
  if (/description_section_default|description_testid/.test(source)) score -= 60;
  if (normalized.length <= 180) score -= 180;
  if (!/[.!?]/.test(normalized)) score -= 120;

  if (AIRBNB_GENERIC_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    score -= 300;
  }

  return score;
}

function looksLikeAirbnbBedSummary(value: string) {
  const normalized = normalizeWhitespace(value).toLowerCase();

  return (
    /(^|\b)\d+\s+(double|single|queen|king|sofa|couch|bunk|twin)\s+beds?/.test(normalized) ||
    /(^|\b)\d+\s+(lit|lits|canape|canapes)/.test(normalized) ||
    /\b\d+\s+bedrooms?\b/.test(normalized) ||
    /\b\d+\s+beds?\b/.test(normalized) ||
    /\b\d+(?:\.\d+)?\s+baths?\b/.test(normalized) ||
    /\b\d+\s+chambres?\b/.test(normalized) ||
    /\b\d+\s+lits?\b/.test(normalized) ||
    /\b\d+(?:\.\d+)?\s+salles? de bain\b/.test(normalized)
  );
}

function looksLikeAirbnbRoomSummary(value: string) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return /^(\d+\s+\w+\s*[·,-]\s*)+\d+\s+\w+/.test(normalized);
}

function looksLikeAirbnbAmenityLabel(value: string) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);

  return (
    words.length <= 4 &&
    /^(wifi|kitchen|cocina|services?|servicios|amenities|comodidades|workspace|area para trabajar|no incluidos?|not included)$/i.test(
      normalized
    )
  );
}

function getAirbnbDescriptionSectionsFromSectionsArray(
  root: unknown,
  path: string[] = []
): AirbnbSectionContainerMatch[] {
  if (!root || typeof root !== "object") {
    return [];
  }

  if (Array.isArray(root)) {
    return root.flatMap((entry, index) =>
      getAirbnbDescriptionSectionsFromSectionsArray(entry, [...path, String(index)])
    );
  }

  const record = root as Record<string, unknown>;
  const matches: AirbnbSectionContainerMatch[] = [];

  for (const [key, value] of Object.entries(record)) {
    const nextPath = [...path, key];

    if (key === "sections" && Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;

        const sectionContainer = entry as Record<string, unknown>;
        const sectionComponentType =
          typeof sectionContainer.sectionComponentType === "string"
            ? sectionContainer.sectionComponentType
            : "";
        const sectionId =
          typeof sectionContainer.sectionId === "string"
            ? sectionContainer.sectionId
            : "";

        if (
          sectionComponentType === "PDP_DESCRIPTION_MODAL" ||
          sectionComponentType === "PDP_DESCRIPTION_DEFAULT" ||
          sectionId === "DESCRIPTION_MODAL" ||
          sectionId === "DESCRIPTION_DEFAULT" ||
          sectionId === "DESCRIPTION" ||
          (sectionComponentType.includes("DESCRIPTION") &&
            !/(CALENDAR|AMENIT|PHOTO|MAP|REVIEW|POLICY|RULES|LOCATION|HOST)/i.test(
              sectionComponentType
            ))
        ) {
          matches.push({
            path: [...nextPath, String(index)].join("."),
            sectionContainer,
          });
        }
      });
    }

    matches.push(...getAirbnbDescriptionSectionsFromSectionsArray(value, nextPath));
  }

  return matches;
}

function extractAirbnbDescriptionCandidatesFromSectionContainer(
  sectionContainer: Record<string, unknown>,
  path: string
): LabeledTextCandidate[] {
  const section = sectionContainer.section;

  if (!section || typeof section !== "object") {
    return [];
  }

  const structuredCandidates = [
    ...findStructuredString(
      section,
      AIRBNB_STRUCTURED_DESCRIPTION_KEYS,
      80,
      [path, "section"]
    ).map((value) => ({
      source: "description_modal_section_structured",
      value,
    })),
    ...findStructuredString(
      section,
      [/html/i, /body/i, /content/i, /detail/i, /message/i, /description/i],
      120,
      [path, "section"]
    ).map((value) => ({
      source: "description_modal_section_fallback",
      value,
    })),
  ];

  return structuredCandidates;
}

function looksLikeLikelyListingTitle(value: string) {
  const normalized = normalizeWhitespace(value);
  const words = normalized.split(/\s+/).filter(Boolean);

  if (normalized.length < 18) return false;
  if (words.length < 4) return false;
  if (/[?؟]$/.test(normalized)) return false;
  if (looksLikeAirbnbAmenityLabel(normalized)) return false;
  if (looksLikeAirbnbBedSummary(normalized)) return false;
  if (looksLikeAirbnbRoomSummary(normalized)) return false;
  if (AIRBNB_GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))) return false;

  return true;
}

function sanitizeAirbnbTitleCandidate(source: string, value: string) {
  let normalized = normalizeWhitespace(value);

  if (!normalized) return "";

  if (source === "document_title" && /\s[-|·]\s.*airbnb/i.test(normalized)) {
    normalized = normalized.split(/\s[-|·]\s/)[0]?.trim() ?? normalized;
  }

  if (/document_title|og:title|twitter:title|json_ld_name/i.test(source)) {
    normalized = normalized.replace(/\s*[-|·]\s*airbnb.*$/i, "").trim();
  }

  return normalized;
}

function getAirbnbTitleSourcePriority(source: string) {
  if (source === "h1") return 1;
  if (source === "document_title") return 2;
  if (source === "og:title") return 3;
  if (source === "twitter:title") return 4;
  if (source === "json_ld_name") return 5;
  if (source === "structured_record") return 6;
  return 10;
}

function toTitleCaseFrenchLabel(value: string) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isPlausibleAirbnbStructuredLocationHint(value: string): boolean {
  const n = normalizeWhitespace(value);
  if (n.length < 3 || n.length > 80) return false;
  if (/^\d+$/.test(n)) return false;
  if (looksLikeAirbnbBedSummary(n) || looksLikeAirbnbRoomSummary(n)) return false;
  if (AIRBNB_GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(n))) return false;
  return true;
}

function extractAirbnbLocationFromOgTitle(ogTitle: string | undefined): string | null {
  const raw = normalizeWhitespace(ogTitle ?? "");
  if (!raw) return null;
  const parts = raw.split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const propertyFirst =
    /^(appartement|apartment|maison|house|studio|villa|chambre|room|guest|loft|rental\s+unit|logement|guesthouse|guest\s+suite|cabin)/i.test(
      parts[0] ?? ""
    );
  const citySegment = propertyFirst ? parts[1] : parts[0];
  if (!citySegment) return null;
  const withoutRating = citySegment.replace(/\s*★.*$/u, "").trim();
  if (!withoutRating || withoutRating.length < 3) return null;
  if (/^[\d\s★.\-]+$/u.test(withoutRating)) return null;
  return withoutRating;
}

function normalizeAirbnbLocationForFallback(value: string | null) {
  if (!value) return null;

  const normalized = normalizeWhitespace(value)
    .replace(/\s+[·|]\s+.*/g, "")
    .replace(/\s+-\s+.*/g, "")
    .replace(/\s+\|\s+.*/g, "")
    .trim();

  if (!normalized || normalized.length > 60) return null;
  if (looksLikeAirbnbBedSummary(normalized) || isGenericAirbnbTitle(normalized)) return null;
  if (/[.!?]/.test(normalized)) return null;

  const commaParts = normalized
    .split(",")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  const candidate = commaParts[0] ?? normalized;

  if (!candidate || candidate.length > 40) return null;
  return candidate;
}

function getFrenchPropertyTypeLabel(propertyType: string | null, titleCandidates: LabeledTextCandidate[]) {
  const normalized = normalizeWhitespace(propertyType ?? "").toLowerCase();
  const combinedTitleText = titleCandidates.map((candidate) => candidate.value).join(" ").toLowerCase();

  if (/studio/.test(normalized) || /\bstudio\b/.test(combinedTitleText)) return "Studio";
  if (/apartment|flat|condo/.test(normalized)) return "Appartement";
  if (/villa/.test(normalized)) return "Villa";
  if (/house/.test(normalized)) return "Maison";
  if (/loft/.test(normalized)) return "Loft";
  if (/riad/.test(normalized)) return "Riad";
  if (/guesthouse/.test(normalized)) return "Maison d'hotes";
  if (/residence/.test(normalized)) return "Logement";

  return "Logement entier";
}

function buildAirbnbTitleFallback(input: {
  propertyType: string | null;
  locationLabel: string | null;
  titleCandidates: LabeledTextCandidate[];
}) {
  const propertyLabel = getFrenchPropertyTypeLabel(input.propertyType, input.titleCandidates);
  const locality = normalizeAirbnbLocationForFallback(input.locationLabel);

  return locality ? `${propertyLabel} a ${toTitleCaseFrenchLabel(locality)}` : propertyLabel;
}

function toIsoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeCalendarDate(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toIsoDay(parsed);
}

function parseAirbnbCalendarDay(value: unknown): AirbnbCalendarDay | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const date =
    normalizeCalendarDate(record.date) ||
    normalizeCalendarDate(record.calendarDate) ||
    normalizeCalendarDate(record.day) ||
    normalizeCalendarDate(record.localDate) ||
    normalizeCalendarDate(record.dayDate) ||
    normalizeCalendarDate(record.availableDate) ||
    normalizeCalendarDate(record.checkinDate) ||
    normalizeCalendarDate(record.dateString);

  if (!date) return null;

  let available: boolean | null = null;
  let unavailable: boolean | null = null;

  const booleanCandidates = [
    record.available,
    record.isAvailable,
    record.availableForCheckin,
    record.availableForCheckout,
    record.bookable,
    record.isBookable,
    record.isReservable,
    typeof record.closed === "boolean" ? !record.closed : null,
  ];

  booleanCandidates.forEach((candidate) => {
    if (typeof candidate === "boolean") {
      available = candidate;
      unavailable = !candidate;
    }
  });

  if (typeof record.isUnavailable === "boolean") {
    unavailable = record.isUnavailable;
    available = !record.isUnavailable;
  }

  if (typeof record.isBlocked === "boolean") {
    unavailable = record.isBlocked;
    available = !record.isBlocked;
  }

  const statusCandidates = [
    record.status,
    record.availability,
    record.availabilityStatus,
    record.bookingStatus,
    record.dayStatus,
    record.state,
    record.availableType,
    record.type,
    record.reason,
  ]
    .filter((candidate): candidate is string => typeof candidate === "string")
    .map((candidate) => candidate.toLowerCase());

  if (statusCandidates.some((status) => /blocked|unavailable|reserved|booked|not.?bookable/.test(status))) {
    unavailable = true;
    available = false;
  } else if (statusCandidates.some((status) => /available|bookable|free|open/.test(status))) {
    available = true;
    unavailable = false;
  }

  if (available == null && unavailable == null) {
    return null;
  }

  return { date, available, unavailable };
}

function collectCalendarDays(value: unknown): AirbnbCalendarDay[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const direct = parseAirbnbCalendarDay(item);
      return direct ? [direct] : collectCalendarDays(item);
    });
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const dateKeyDays = Object.entries(record).flatMap(([key, entry]) => {
      const normalizedKey = normalizeCalendarDate(key);
      if (!normalizedKey) return [];

      if (typeof entry === "boolean") {
        return [{ date: normalizedKey, available: entry, unavailable: !entry }];
      }

      if (typeof entry === "string") {
        const lower = entry.toLowerCase();
        if (/blocked|unavailable|reserved|booked|not.?bookable/.test(lower)) {
          return [{ date: normalizedKey, available: false, unavailable: true }];
        }
        if (/available|bookable|free|open/.test(lower)) {
          return [{ date: normalizedKey, available: true, unavailable: false }];
        }
      }

      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const nestedRecord = entry as Record<string, unknown>;
        const nested = parseAirbnbCalendarDay({
          ...nestedRecord,
          date: nestedRecord.date ?? normalizedKey,
        });
        return nested ? [nested] : [];
      }

      return [];
    });
    if (dateKeyDays.length > 0) {
      return dateKeyDays;
    }

    const direct = parseAirbnbCalendarDay(value);
    if (direct) return [direct];

    return Object.values(record).flatMap((entry) =>
      collectCalendarDays(entry)
    );
  }

  return [];
}

function collectCalendarDaysFromRawString(raw: string): AirbnbCalendarDay[] {
  if (!/\d{4}-\d{2}-\d{2}/.test(raw)) {
    return [];
  }

  const days: AirbnbCalendarDay[] = [];
  const objectPattern =
    /\{[^{}]{0,1200}"(?:date|calendarDate|day|localDate|dayDate|dateString)"\s*:\s*"[^"]+"[^{}]{0,1600}\}/g;
  const matches = raw.match(objectPattern) ?? [];

  matches.forEach((fragment) => {
    const dateMatch = fragment.match(
      /"(?:date|calendarDate|day|localDate|dayDate|dateString)"\s*:\s*"([^"]+)"/
    );
    const date = normalizeCalendarDate(dateMatch?.[1] ?? null);
    if (!date) return;

    let available: boolean | null = null;
    let unavailable: boolean | null = null;

    const trueAvailablePattern =
      /"(?:available|isAvailable|availableForCheckin|availableForCheckout|bookable|isBookable|isReservable)"\s*:\s*true/i;
    const falseAvailablePattern =
      /"(?:available|isAvailable|availableForCheckin|availableForCheckout|bookable|isBookable|isReservable)"\s*:\s*false/i;

    if (trueAvailablePattern.test(fragment)) {
      available = true;
      unavailable = false;
    } else if (falseAvailablePattern.test(fragment)) {
      available = false;
      unavailable = true;
    }

    if (/"(?:isUnavailable|isBlocked)"\s*:\s*true/i.test(fragment)) {
      available = false;
      unavailable = true;
    }

    const statusMatch = fragment.match(
      /"(?:status|availability|availabilityStatus|bookingStatus|dayStatus|type|reason)"\s*:\s*"([^"]+)"/i
    );
    const status = statusMatch?.[1]?.toLowerCase() ?? "";

    if (/blocked|unavailable|reserved|booked|not.?bookable/.test(status)) {
      unavailable = true;
      available = false;
    } else if (/available|bookable|free|open/.test(status)) {
      available = true;
      unavailable = false;
    }

    if (available == null && unavailable == null) return;
    days.push({ date, available, unavailable });
  });

  return days;
}

function collectCalendarDaysForPath(value: unknown, path: string) {
  const lowerPath = path.toLowerCase();

  if (Array.isArray(value)) {
    const normalizedDates = value
      .map((entry) => normalizeCalendarDate(entry))
      .filter((entry): entry is string => Boolean(entry));

    if (normalizedDates.length > 0) {
      if (/unavailable|blocked|reserved|booked|closed/.test(lowerPath)) {
        return normalizedDates.map((date) => ({
          date,
          available: false,
          unavailable: true,
        }));
      }

      if (/available|bookable|open|free/.test(lowerPath)) {
        return normalizedDates.map((date) => ({
          date,
          available: true,
          unavailable: false,
        }));
      }

      if (/checkout_only/.test(lowerPath)) {
        return normalizedDates.map((date) => ({
          date,
          available: true,
          unavailable: false,
        }));
      }
    }
  }

  return collectCalendarDays(value);
}

function collectCalendarRelevantBranches(
  value: unknown,
  path: string[] = []
): AirbnbCalendarDebugBranch[] {
  if (!value) return [];

  const joinedPath = path.join(".");
  const matches: AirbnbCalendarDebugBranch[] =
    joinedPath &&
    /calendar|availability|month|months|day|days|date|dates|calendardays|dayavailabilities|daystates|unavailabledates|availabledates|blockeddates/i.test(
      joinedPath
    )
      ? [{ path: joinedPath, value }]
      : [];

  if (Array.isArray(value)) {
    const nestedBranches: AirbnbCalendarDebugBranch[] = value.flatMap((entry, index) =>
      collectCalendarRelevantBranches(entry, [...path, String(index)])
    );

    return [...matches, ...nestedBranches];
  }

  if (typeof value === "object") {
    const nestedBranches: AirbnbCalendarDebugBranch[] = Object.entries(
      value as Record<string, unknown>
    ).flatMap(([key, entry]) => collectCalendarRelevantBranches(entry, [...path, key]));

    return [...matches, ...nestedBranches];
  }

  return matches;
}

function collectAirbnbAltCalendarBranches(
  value: unknown,
  path: string[] = []
): AirbnbCalendarDebugBranch[] {
  if (!value) return [];

  const joinedPath = path.join(".");
  const matches: AirbnbCalendarDebugBranch[] =
    joinedPath &&
    /data\.node|data\.node\.pdppresentation|calendar|availability|staycalendar|bookit|month|months|day|days|date|dates|available|unavailable|blocked/i.test(
      joinedPath
    )
      ? [{ path: joinedPath, value }]
      : [];

  if (Array.isArray(value)) {
    const nestedBranches: AirbnbCalendarDebugBranch[] = value.flatMap((entry, index) =>
      collectAirbnbAltCalendarBranches(entry, [...path, String(index)])
    );

    return [...matches, ...nestedBranches];
  }

  if (typeof value === "object") {
    const nestedBranches: AirbnbCalendarDebugBranch[] = Object.entries(
      value as Record<string, unknown>
    ).flatMap(([key, entry]) => collectAirbnbAltCalendarBranches(entry, [...path, key]));

    return [...matches, ...nestedBranches];
  }

  return matches;
}

function safePreview(value: unknown, maxLen = 600): string {
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

function scoreCalendarPath(path: string) {
  const lower = path.toLowerCase();
  let score = 0;

  if (lower.includes("niobeclientdata")) score += 60;
  if (lower.includes("availabilitycalendar")) score += 70;
  if (lower.includes("calendarmonths")) score += 65;
  if (lower.includes("stayproductdetailpage")) score += 40;
  if (lower.includes("presentation")) score += 25;
  if (lower.includes("monthly")) score += 15;
  if (lower.includes("calendar")) score += 20;
  if (lower.includes("availability")) score += 20;
  if (lower.includes("days")) score += 10;

  return score;
}

function hasCalendarStructureHint(value: unknown, path: string) {
  if (!value || typeof value !== "object") return false;

  const keys = Object.keys(value as Record<string, unknown>).join(" ").toLowerCase();
  const combined = `${path.toLowerCase()} ${keys}`;

  return /niobeclientdata|stayproductdetailpage|presentation|node|calendar|availability|month|months|day|days|bookable|blocked|unavailable/.test(
    combined
  );
}

function collectAirbnbCalendarCandidatesFromRawStrings(
  value: unknown,
  path: string[] = []
): AirbnbCalendarCandidate[] {
  if (!value) return [];

  const joinedPath = path.join(".");
  const candidates: AirbnbCalendarCandidate[] = [];

  if (typeof value === "string") {
    if (
      /calendar|availability|month|months|day|days|bookable|blocked|unavailable|stayproductdetailpage|niobeclientdata/i.test(
        joinedPath
      ) ||
      /calendar|availability|month|months|day|days|bookable|blocked|unavailable/i.test(value)
    ) {
      const days = collectCalendarDaysFromRawString(value);
      if (days.length >= 7) {
        candidates.push({
          source: `${joinedPath || "raw_string"}:embedded`,
          days,
        });
      }
    }

    return candidates;
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectAirbnbCalendarCandidatesFromRawStrings(entry, [...path, String(index)])
    );
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
      collectAirbnbCalendarCandidatesFromRawStrings(entry, [...path, key])
    );
  }

  return [];
}

function extractCalendarCandidatesFromSectionContainer(
  sectionContainer: Record<string, unknown>,
  path: string
): AirbnbCalendarCandidate[] {
  const section =
    sectionContainer.section &&
    typeof sectionContainer.section === "object" &&
    !Array.isArray(sectionContainer.section)
      ? (sectionContainer.section as Record<string, unknown>)
      : null;

  if (!section) {
    debugGuestAuditLog("[guest-audit][airbnb][calendar] matched section container:", {
      path,
      sectionComponentType: sectionContainer.sectionComponentType ?? null,
      sectionId: sectionContainer.sectionId ?? null,
      hasSection: false,
    });
    debugGuestAuditLog("[guest-audit][airbnb][calendar] section keys:", []);
    debugGuestAuditLog("[guest-audit][airbnb][calendar] raw day candidates count:", 0);
    return [];
  }

  const directCandidates = [
    ...collectAirbnbCalendarCandidates(section, [path, "section"]),
    ...collectAirbnbCalendarCandidatesFromRawStrings(section, [path, "section"]),
  ];
  const relevantBranches = collectCalendarRelevantBranches(section, [path, "section"]);

  const explicitTargets = [
    sectionContainer.data,
    sectionContainer.node,
    section.calendarMonths,
    section.months,
    section.days,
    section.dates,
    section.dayAvailabilities,
    section.dayStates,
    section.calendarDays,
    section.availability,
    section.availabilityCalendar,
    section.data,
    section.node,
    section.pdpPresentation,
    section.stayProductDetailPage,
  ];
  const selectedSource = `calendar_section:${path}`;
  const previewTargets = {
    calendarMonths: section.calendarMonths,
    months: section.months,
    days: section.days,
    dates: section.dates,
    dayAvailabilities: section.dayAvailabilities,
    dayStates: section.dayStates,
    calendarDays: section.calendarDays,
    availability: section.availability,
    availabilityCalendar: section.availabilityCalendar,
    metadata: section.metadata,
    loggingData: section.loggingData,
    metadataAvailabilityCalendar:
      section.metadata &&
      typeof section.metadata === "object" &&
      !Array.isArray(section.metadata)
        ? (section.metadata as Record<string, unknown>).availabilityCalendar
        : null,
    metadataCalendarMonths:
      section.metadata &&
      typeof section.metadata === "object" &&
      !Array.isArray(section.metadata)
        ? (section.metadata as Record<string, unknown>).calendarMonths
        : null,
    metadataDays:
      section.metadata &&
      typeof section.metadata === "object" &&
      !Array.isArray(section.metadata)
        ? (section.metadata as Record<string, unknown>).days
        : null,
    metadataMonths:
      section.metadata &&
      typeof section.metadata === "object" &&
      !Array.isArray(section.metadata)
        ? (section.metadata as Record<string, unknown>).months
        : null,
  };

  const explicitDays = explicitTargets.flatMap((entry, index) =>
    collectCalendarDaysForPath(entry, `${selectedSource}.explicit.${index}`)
  );
  const branchCandidates = relevantBranches.flatMap((branch) => {
    const days = collectCalendarDaysForPath(branch.value, branch.path);
    if (days.length > 0) {
      debugGuestAuditLog("[guest-audit][airbnb][calendar][branchAccepted]", {
        path: branch.path,
        daysCount: days.length,
        sample: days.slice(0, 3),
      });
      return [
        {
          source: branch.path,
          days,
        },
      ];
    }

    debugGuestAuditLog("[guest-audit][airbnb][calendar][branchRejected]", {
      path: branch.path,
      reason: "no_parseable_days",
      valueType: Array.isArray(branch.value) ? "array" : typeof branch.value,
    });
    return [];
  });
  const uniqueDays = new Map<string, AirbnbCalendarDay>();

  [
    ...directCandidates.flatMap((candidate) => candidate.days),
    ...branchCandidates.flatMap((candidate) => candidate.days),
    ...explicitDays,
  ].forEach((day) => {
    if (!uniqueDays.has(day.date)) {
      uniqueDays.set(day.date, day);
    }
  });

  const metadata = getAirbnbSectionMetadata(sectionContainer);

  debugGuestAuditLog("[guest-audit][airbnb][calendar][section]", {
    path,
    sectionComponentType: metadata.sectionComponentType,
    sectionId: metadata.sectionId,
  });
  debugGuestAuditLog("[guest-audit][airbnb][calendar] matched section container:", {
    path,
    sectionComponentType: metadata.sectionComponentType,
    sectionId: metadata.sectionId,
  });
  debugGuestAuditLog("[guest-audit][airbnb][calendar] section keys:", Object.keys(section));
  debugGuestAuditLog("[guest-audit][airbnb][calendar][preview]", {
    section: safePreview(section, 900),
    calendarMonths: safePreview(previewTargets.calendarMonths),
    months: safePreview(previewTargets.months),
    days: safePreview(previewTargets.days),
    dates: safePreview(previewTargets.dates),
    dayAvailabilities: safePreview(previewTargets.dayAvailabilities),
    dayStates: safePreview(previewTargets.dayStates),
    calendarDays: safePreview(previewTargets.calendarDays),
    availability: safePreview(previewTargets.availability),
    availabilityCalendar: safePreview(previewTargets.availabilityCalendar),
    metadata: safePreview(previewTargets.metadata),
    loggingData: safePreview(previewTargets.loggingData),
    metadataAvailabilityCalendar: safePreview(previewTargets.metadataAvailabilityCalendar),
    metadataCalendarMonths: safePreview(previewTargets.metadataCalendarMonths),
    metadataDays: safePreview(previewTargets.metadataDays),
    metadataMonths: safePreview(previewTargets.metadataMonths),
  });
  debugGuestAuditLog(
    "[guest-audit][airbnb][calendar][paths]",
    relevantBranches.slice(0, 30).map((branch) => branch.path)
  );
  debugGuestAuditLog(
    "[guest-audit][airbnb][calendar] raw day candidates count:",
    uniqueDays.size
  );

  if (uniqueDays.size === 0) {
    debugGuestAuditLog("[guest-audit][airbnb][calendar][branchRejected]", {
      path,
      reason: "section_without_parseable_calendar_days",
      sectionComponentType: metadata.sectionComponentType,
      sectionId: metadata.sectionId,
    });
    return [];
  }

  debugGuestAuditLog("[guest-audit][airbnb][calendar][branchAccepted]", {
    path,
    source: selectedSource,
    daysCount: uniqueDays.size,
    sample: [...uniqueDays.values()].slice(0, 3),
  });

  return [
    {
      source: selectedSource,
      days: [...uniqueDays.values()],
    },
  ];
}

function collectAirbnbAltCalendarCandidates(
  sources: unknown[],
  sourceLabel: "bootstrapData" | "structuredScriptData"
): AirbnbCalendarCandidate[] {
  const branches = sources
    .flatMap((source) => collectAirbnbAltCalendarBranches(source))
    .filter(
      (branch, index, array) =>
        array.findIndex((candidate) => candidate.path === branch.path) === index
    )
    .slice(0, 80);

  const candidates: AirbnbCalendarCandidate[] = [];

  branches.forEach((branch) => {
    debugGuestAuditLog("[guest-audit][airbnb][calendar][alt-source-preview]", {
      sourceLabel,
      path: branch.path,
      preview: safePreview(branch.value, 700),
    });

    const days = collectCalendarDaysForPath(branch.value, branch.path);

    if (days.length >= 7) {
      debugGuestAuditLog("[guest-audit][airbnb][calendar][alt-source-accepted]", {
        sourceLabel,
        path: branch.path,
        daysCount: days.length,
        sample: days.slice(0, 3),
      });
      candidates.push({
        source: `alt:${branch.path}`,
        days,
      });
      return;
    }

    debugGuestAuditLog("[guest-audit][airbnb][calendar][alt-source-rejected]", {
      sourceLabel,
      path: branch.path,
      reason: "no_parseable_days",
      valueType: Array.isArray(branch.value) ? "array" : typeof branch.value,
    });
  });

  return candidates;
}

function collectAirbnbCalendarCandidates(
  value: unknown,
  path: string[] = []
): AirbnbCalendarCandidate[] {
  if (!value) return [];

  const joinedPath = path.join(".");
  const candidates: AirbnbCalendarCandidate[] = [];

  if (typeof value === "object" && !Array.isArray(value)) {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = [...path, key];
      const joinedNextPath = nextPath.join(".");
      const isCalendarKey = /availabilitycalendar|calendarmonths|calendar|availability|days|available|unavailable|blocked|bookable/i.test(
        joinedNextPath
      );
      const days = collectCalendarDaysForPath(entry, joinedNextPath);

      if ((isCalendarKey || hasCalendarStructureHint(entry, joinedNextPath)) && days.length >= 7) {
        candidates.push({
          source: joinedNextPath,
          days,
        });
      }

      candidates.push(...collectAirbnbCalendarCandidates(entry, nextPath));
    }
  } else if (
    Array.isArray(value) &&
    (/calendar|availability|days|month|months|niobeclientdata|stayproductdetailpage/i.test(joinedPath) ||
      value.length >= 7)
  ) {
    const days = collectCalendarDaysForPath(value, joinedPath);
    if (days.length >= 7) {
      candidates.push({
        source: joinedPath,
        days,
      });
    }
  }

  return candidates;
}

function buildOccupancyObservation(
  candidates: AirbnbCalendarCandidate[]
): OccupancyObservation {
  const windowDays = 60;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + windowDays - 1);
  const startIso = toIsoDay(start);
  const endIso = toIsoDay(end);

  const normalizedCandidates = candidates
    .map((candidate) => {
      const uniqueDays = new Map<string, AirbnbCalendarDay>();
      candidate.days.forEach((day) => {
        if (day.date < startIso || day.date > endIso) return;
        if (!uniqueDays.has(day.date)) {
          uniqueDays.set(day.date, day);
        }
      });

      const observedDays = [...uniqueDays.values()];
      const unavailableDays = observedDays.filter((day) => day.unavailable).length;
      const availableDays = observedDays.filter((day) => day.available).length;

      return {
        source: candidate.source,
        days: observedDays,
        observedDays: observedDays.length,
        unavailableDays,
        availableDays,
        score: scoreCalendarPath(candidate.source),
      };
    })
    .filter((candidate) => candidate.observedDays > 0)
    .sort((a, b) => {
      const aIsExplicitSection = a.source.startsWith("calendar_section:");
      const bIsExplicitSection = b.source.startsWith("calendar_section:");

      if (aIsExplicitSection !== bIsExplicitSection) {
        return aIsExplicitSection ? -1 : 1;
      }
      if (b.observedDays !== a.observedDays) return b.observedDays - a.observedDays;
      return b.score - a.score;
    });

  debugGuestAuditLog(
    "[guest-audit][airbnb][calendar] candidates:",
    normalizedCandidates.map((candidate) => ({
      source: candidate.source,
      observedDays: candidate.observedDays,
      unavailableDays: candidate.unavailableDays,
      availableDays: candidate.availableDays,
    }))
  );

  const selected = normalizedCandidates[0] ?? null;

  debugGuestAuditLog(
    "[guest-audit][airbnb][calendar] selectedSource:",
    selected?.source ?? null
  );
  debugGuestAuditLog(
    "[guest-audit][airbnb][calendar] daysFound:",
    selected?.observedDays ?? 0
  );
  debugGuestAuditLog(
    "[guest-audit][airbnb][calendar] sample:",
    selected?.days.slice(0, 5) ?? []
  );
  debugGuestAuditLog(
    "[guest-audit][airbnb][calendar] observedDays:",
    selected?.observedDays ?? 0
  );
  debugGuestAuditLog(
    "[guest-audit][airbnb][calendar] unavailableDays:",
    selected?.unavailableDays ?? 0
  );

  if (!selected) {
    debugGuestAuditLog("[guest-audit][airbnb][calendar] rate:", null);
    return {
      rate: null,
      unavailableDays: 0,
      availableDays: 0,
      observedDays: 0,
      windowDays,
      source: null,
    };
  }

  const rate =
    selected.observedDays > 0
      ? Math.round((selected.unavailableDays / selected.observedDays) * 100)
      : null;

  debugGuestAuditLog("[guest-audit][airbnb][calendar] rate:", rate);

  return {
    rate,
    unavailableDays: selected.unavailableDays,
    availableDays: selected.availableDays,
    observedDays: selected.observedDays,
    windowDays,
    source: selected.source,
  };
}

function selectBestAirbnbTitle(candidates: LabeledTextCandidate[]): SelectedLabeledText | null {
  const normalizedCandidates = candidates
    .map((candidate) => ({
      source: candidate.source,
      value: sanitizeAirbnbTitleCandidate(candidate.source, candidate.value),
    }))
    .filter((candidate) => candidate.value.length > 0)
    .sort((a, b) => getAirbnbTitleSourcePriority(a.source) - getAirbnbTitleSourcePriority(b.source));
  const rejected = normalizedCandidates
    .filter(
      (candidate) =>
        isGenericAirbnbTitle(candidate.value) ||
        (candidate.source === "structured_record" &&
          !looksLikeLikelyListingTitle(candidate.value))
    )
    .map((candidate) => ({
      source: candidate.source,
      value: candidate.value,
    }));
  const selectedCandidate =
    normalizedCandidates.find(
      (candidate) =>
        !isGenericAirbnbTitle(candidate.value) &&
        (candidate.source !== "structured_record" ||
          looksLikeLikelyListingTitle(candidate.value))
    ) ?? null;

  debugGuestAuditLog(
    "[guest-audit][airbnb][title] candidates:",
    normalizedCandidates.map((candidate) => ({
      source: candidate.source,
      value: candidate.value,
    }))
  );
  debugGuestAuditLog("[guest-audit][airbnb][title] rejected:", rejected);
  debugGuestAuditLog(
    "[guest-audit][airbnb][title] selected:",
    selectedCandidate?.value ?? null
  );

  return selectedCandidate ?? null;
}

function selectBestAirbnbDescription(candidates: LabeledTextCandidate[]) {
  const normalizedCandidates = candidates
    .map((candidate) => ({
      source: candidate.source,
      value: normalizeWhitespace(candidate.value),
    }))
    .filter((candidate) => candidate.value.length > 0)
    .map((candidate) => ({
      ...candidate,
      useful: isUsefulAirbnbDescription(candidate.value),
      score: scoreAirbnbDescriptionCandidate(candidate.source, candidate.value),
    }))
    .sort((a, b) => b.score - a.score);

  const selected =
    normalizedCandidates.find((candidate) => candidate.useful) ??
    normalizedCandidates[0] ??
    null;

  debugGuestAuditLog(
    "[guest-audit][airbnb][description] candidates:",
    normalizedCandidates.map((candidate) => ({
      source: candidate.source,
      length: candidate.value.length,
      useful: candidate.useful,
      score: candidate.score,
      preview: candidate.value.slice(0, 120),
    }))
  );
  debugGuestAuditLog(
    "[guest-audit][airbnb][description] selectedSource:",
    selected?.source ?? null
  );
  debugGuestAuditLog(
    "[guest-audit][airbnb][description] selectedLength:",
    selected?.value.length ?? 0
  );
  debugGuestAuditLog(
    "[guest-audit][airbnb][description] selectedPreview:",
    selected?.value.slice(0, 160) ?? ""
  );

  return selected ?? null;
}

function findStructuredNumber(
  value: unknown,
  keyPatterns: RegExp[],
  path: string[] = []
): number | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStructuredNumber(item, keyPatterns, path);
      if (found !== null) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const [key, entry] of Object.entries(record)) {
      const nextPath = [...path, key];

      if (keyPatterns.some((pattern) => pattern.test(key))) {
        if (typeof entry === "number" && Number.isFinite(entry)) return entry;
        if (typeof entry === "string") {
          const parsed = parseMaybeNumber(entry);
          if (parsed !== null) return parsed;
        }
      }

      const nested = findStructuredNumber(entry, keyPatterns, nextPath);
      if (nested !== null) return nested;
    }
  }

  return null;
}

function extractAirbnbAmenitiesFromStructuredData(bootstrapData: unknown[]): string[] {
  const amenityMatches = bootstrapData
    .flatMap((block) => flattenStructuredObjects(block))
    .filter(({ path }) => path.some((segment) => AIRBNB_STRUCTURED_AMENITIES_PATH.test(segment)))
    .flatMap(({ record }) =>
      Object.entries(record).flatMap(([key, value]) => {
        if (!/title|name|label|amenit/i.test(key)) return [];
        return typeof value === "string" ? [normalizeWhitespace(value)] : [];
      })
    );

  const fallbackMatches = findStructuredString(
    bootstrapData,
    [/amenit/i, /facility/i, /label/i, /title/i],
    2
  );

  const matches = [...amenityMatches, ...fallbackMatches].filter(
    (value) =>
      isUsefulAirbnbAmenityLabel(value) &&
      !/show all|voir plus|en savoir plus|superhost|disponibilite|availability|guest favorite|favori/i.test(
        value
      )
  );

  return uniqueStrings(matches).slice(0, 80);
}

function dedupeAirbnbPhotoUrls(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!isLikelyAirbnbPhotoUrl(value)) continue;

    const normalized = normalizeAirbnbPhotoUrl(value);
    if (!normalized) continue;

    const assetKey = getAirbnbPhotoAssetKey(normalized);
    if (!assetKey || seen.has(assetKey)) continue;

    seen.add(assetKey);
    result.push(normalized);
  }

  return result;
}

function normalizeAirbnbPhotoUrl(value: string): string {
  try {
    const parsed = new URL(value.trim());
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname
      .replace(/\/im\/pictures\//i, "/pictures/")
      .replace(/\/im\/ml\//i, "/pictures/")
      .replace(/\/original\//i, "/")
      .replace(/\/large\//i, "/")
      .replace(/\/medium\//i, "/")
      .replace(/\/small\//i, "/")
      .replace(/\/xl\//i, "/")
      .replace(/\/xlarge\//i, "/");

    return parsed.toString();
  } catch {
    return "";
  }
}

function getAirbnbPhotoAssetKey(value: string): string {
  try {
    const parsed = new URL(value);
    const lowerPath = parsed.pathname.toLowerCase();

    // Prefer Airbnb picture ids when present; they are the most stable asset key.
    const pictureIdMatch = lowerPath.match(
      /\/pictures\/([a-z0-9-]{12,}|[a-z0-9]+(?:-[a-z0-9]+){2,})/i
    );
    if (pictureIdMatch?.[1]) {
      return `picture:${pictureIdMatch[1].toLowerCase()}`;
    }

    const pathWithoutExtension = lowerPath.replace(/\.(jpg|jpeg|png|webp)$/i, "");
    const trimmedPath = pathWithoutExtension
      .replace(/\/original\//i, "/")
      .replace(/\/large\//i, "/")
      .replace(/\/medium\//i, "/")
      .replace(/\/small\//i, "/")
      .replace(/\/xl\//i, "/")
      .replace(/\/xlarge\//i, "/");
    const pathParts = trimmedPath.split("/").filter(Boolean);
    const tail = pathParts.slice(-2).join("/");

    return tail ? `path:${tail}` : "";
  } catch {
    return "";
  }
}

type AirbnbStablePropertyPick = {
  propertyType: string | null;
  comparableClassificationText: string;
  selectedSource: string;
  candidates: Array<{ source: string; value: string }>;
  rejectedReasons: string[];
};

function mapAirbnbJsonLdTypeToPropertyWord(schemaType: unknown): string | null {
  if (typeof schemaType !== "string") return null;
  const t = schemaType.replace(/^https?:\/\/schema\.org\//i, "").toLowerCase();
  if (t === "apartment") return "apartment";
  if (t === "residence") return "apartment";
  if (t === "house") return "house";
  if (t === "hotel") return "hotel";
  if (t === "lodgingbusiness") return null;
  return null;
}

function isCanonicalAirbnbOgTitleLine(og: string): boolean {
  const n = normalizeWhitespace(og);
  if (n.length < 8) return false;
  return (
    /·/.test(n) &&
    /appartement|apartment|studio|maison|house|villa|chambre|room|loft|guest\s+suite/i.test(n)
  );
}

function extractStructuredLodgingCategoryHint(record: unknown): string | null {
  if (!record) return null;
  const hits = findStructuredString(
    record,
    [
      /propertyType/i,
      /^roomType$/i,
      /listingRoomType/i,
      /accommodationCategory/i,
      /^sharingDeviceType$/i,
    ],
    3
  );
  const hit = hits.find((h) =>
    /\b(apartment|studio|flat|maison|house|villa|loft|entire|private\s+room|chambre)\b/i.test(h)
  );
  return hit ? hit.slice(0, 160) : null;
}

function deriveStableAirbnbPropertyClassification(input: {
  lodgingJson: Record<string, unknown> | null;
  bestStructuredRecord: unknown;
  ogTitle: string;
  metaDescription: string;
  selectedDescription: string;
}): AirbnbStablePropertyPick {
  const rejectedReasons: string[] = [];
  const candidates: Array<{ source: string; value: string }> = [];

  const ldWord = input.lodgingJson
    ? mapAirbnbJsonLdTypeToPropertyWord(input.lodgingJson["@type"])
    : null;
  if (ldWord) {
    candidates.push({ source: "json_ld_type", value: ldWord });
  } else if (input.lodgingJson && input.lodgingJson["@type"] === "LodgingBusiness") {
    rejectedReasons.push("json_ld_lodging_business_generic");
  }

  const structHint = extractStructuredLodgingCategoryHint(input.bestStructuredRecord);
  if (structHint) {
    candidates.push({ source: "structured_record", value: structHint });
  }

  const og = normalizeWhitespace(input.ogTitle);
  if (isCanonicalAirbnbOgTitleLine(og)) {
    candidates.push({ source: "og_title_canonical", value: og });
  } else if (og.length > 0) {
    rejectedReasons.push("og_title_not_canonical_multipart");
  }

  const meta = normalizeWhitespace(input.metaDescription);
  if (meta.length > 12 && /logement entier|entire place/i.test(meta)) {
    candidates.push({ source: "meta_description", value: meta.slice(0, 260) });
  }

  let propertyType: string | null = null;
  let selectedSource = "none";

  if (structHint) {
    const m = structHint.match(/\b(studio|apartment|flat|maison|house|villa|loft|condo)\b/i);
    if (m) {
      propertyType = m[1].toLowerCase();
      if (propertyType === "flat") propertyType = "apartment";
      selectedSource = "structured_record";
    }
  }

  if (!propertyType && ldWord) {
    propertyType = ldWord;
    selectedSource = "json_ld_type";
  }

  if (!propertyType && isCanonicalAirbnbOgTitleLine(og)) {
    const firstSeg = og.split(/\s*·\s*/)[0]?.trim() ?? "";
    const m = firstSeg.match(
      /^(appartement|apartment|studio|maison|house|villa|chambre|room|loft)/i
    );
    if (m) {
      let w = m[1].toLowerCase();
      if (w === "appartement") w = "apartment";
      if (w === "chambre" || w === "room") w = "room";
      propertyType = w;
      selectedSource = "og_title_first_segment";
    }
  }

  if (!propertyType && meta.length > 12 && /logement entier/i.test(meta)) {
    if (/appartement/i.test(meta)) {
      propertyType = "apartment";
      selectedSource = "meta_description";
    } else if (/\bstudio\b/i.test(meta) && !/appartement/i.test(meta)) {
      propertyType = "studio";
      selectedSource = "meta_description";
    }
  }

  let comparableClassificationText = "";
  const ogCand = candidates.find((c) => c.source === "og_title_canonical");
  const metaCand = candidates.find((c) => c.source === "meta_description");
  if (ogCand) {
    comparableClassificationText = ogCand.value;
  } else if (metaCand) {
    comparableClassificationText = metaCand.value;
  } else if (structHint) {
    comparableClassificationText = structHint;
  } else if (ldWord) {
    comparableClassificationText = ldWord;
  } else {
    const desc = normalizeWhitespace(input.selectedDescription);
    if (desc.length > 24 && /logement entier|appartement|\bstudio\b/i.test(desc)) {
      comparableClassificationText = desc.slice(0, 260);
      if (selectedSource === "none") {
        selectedSource = "selected_description_fallback";
      }
      if (!propertyType) {
        if (/appartement/i.test(desc)) propertyType = "apartment";
        else if (/\bstudio\b/i.test(desc)) propertyType = "studio";
      }
    } else {
      rejectedReasons.push("no_stable_classification_source");
      comparableClassificationText = propertyType ?? "";
    }
  }

  if (!comparableClassificationText && propertyType) {
    comparableClassificationText = propertyType;
  }

  debugGuestAuditLog("[guest-audit][airbnb][property-type]", {
    selected: propertyType,
    selectedSource,
    comparableClassificationText: comparableClassificationText.slice(0, 220),
    candidates: candidates.map((c) => ({
      source: c.source,
      preview: c.value.slice(0, 140),
    })),
    rejectedReasons,
  });

  return {
    propertyType,
    comparableClassificationText,
    selectedSource,
    candidates,
    rejectedReasons,
  };
}

export async function extractAirbnb(url: string): Promise<ExtractorResult> {
  const html = await fetchUnlockedHtml(url, {
    platform: "airbnb",
    preferredTransport: "proxy",
  });
  const $ = cheerio.load(html);
  const bodyText = normalizeWhitespace($("body").text());
  const jsonLdBlocks = extractJsonLd(html);
  const structuredScriptData = extractStructuredScriptData(html);
  const {
    blocks: bootstrapData,
    scriptCount,
    diagnostics: bootstrapDiagnostics,
  } = extractAirbnbBootstrapData(html);
  const sectionsCount = countAirbnbSections(bootstrapData) + countAirbnbSections(structuredScriptData);
  debugGuestAuditLog("[airbnb][debug]", {
    hasBootstrap: bootstrapData.length > 0,
    hasStructured: structuredScriptData.length > 0,
    hasJsonLd: jsonLdBlocks.length,
    sectionsCount,
  });
  const bootstrapGalleryDiagnostics = DEBUG_GUEST_AUDIT
    ? bootstrapData
        .flatMap((block, blockIndex) => collectAirbnbGalleryPathDiagnostics(block, blockIndex))
        .sort((a, b) => {
          if (b.imageCount !== a.imageCount) return b.imageCount - a.imageCount;
          return b.pathScore - a.pathScore;
        })
        .slice(0, 20)
    : [];
  const explicitCalendarCandidates = bootstrapData.flatMap((block) =>
    getAirbnbCalendarSectionsFromSectionsArray(block).flatMap(({ path, sectionContainer }) =>
      extractCalendarCandidatesFromSectionContainer(sectionContainer, path)
    )
  );
  const altBootstrapCalendarCandidates = collectAirbnbAltCalendarCandidates(
    bootstrapData,
    "bootstrapData"
  );
  const altStructuredCalendarCandidates = collectAirbnbAltCalendarCandidates(
    structuredScriptData,
    "structuredScriptData"
  );
  const bestStructuredRecord = findBestAirbnbStructuredRecord(bootstrapData);
  const descriptionSectionCandidates = bootstrapData.flatMap((block) =>
    getAirbnbDescriptionSectionsFromSectionsArray(block).flatMap(({ path, sectionContainer }) =>
      extractAirbnbDescriptionCandidatesFromSectionContainer(sectionContainer, path)
    )
  );

  const lodgingJson =
    jsonLdBlocks.find(
      (item) =>
        item["@type"] === "LodgingBusiness" ||
        item["@type"] === "House" ||
        item["@type"] === "Apartment" ||
        item["@type"] === "Residence"
    ) ?? null;
  let ratingJson =
    jsonLdBlocks.find(
      (item) =>
        item.aggregateRating &&
        typeof item.aggregateRating === "object" &&
        !Array.isArray(item.aggregateRating)
    ) ?? lodgingJson;

  const titleCandidates: LabeledTextCandidate[] = [
    ...findStructuredString(
      bestStructuredRecord,
      [/title/i, /^name$/i, /listingName/i],
      5
    ).map((value) => ({ source: "structured_record", value })),
    {
      source: "h1",
      value: $("h1").first().text(),
    },
    {
      source: "og:title",
      value: $('meta[property="og:title"]').attr("content") || "",
    },
    {
      source: "twitter:title",
      value: $('meta[name="twitter:title"]').attr("content") || "",
    },
    {
      source: "document_title",
      value: $("title").text(),
    },
    {
      source: "json_ld_name",
      value: typeof lodgingJson?.name === "string" ? lodgingJson.name : "",
    },
  ];

  const selectedDescriptionCandidate = selectBestAirbnbDescription([
    ...descriptionSectionCandidates,
    ...findStructuredString(bootstrapData, AIRBNB_STRUCTURED_DESCRIPTION_KEYS, 80).map(
      (value) => ({
        source: "bootstrap_structured",
        value,
      })
    ),
    ...findStructuredString(bestStructuredRecord, AIRBNB_STRUCTURED_DESCRIPTION_KEYS, 80).map(
      (value) => ({
        source: "best_structured_record",
        value,
      })
    ),
    ...findStructuredString(structuredScriptData, AIRBNB_STRUCTURED_DESCRIPTION_KEYS, 80).map(
      (value) => ({
        source: "structured_script_data",
        value,
      })
    ),
    {
      source: "description_section_default",
      value: $('[data-section-id="DESCRIPTION_DEFAULT"]').text(),
    },
    {
      source: "description_section_any",
      value: $('[data-section-id*="DESCRIPTION"]').text(),
    },
    {
      source: "description_testid",
      value: $('[data-testid="listing-description"]').text(),
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
      source: "json_ld_description",
      value: typeof lodgingJson?.description === "string" ? lodgingJson.description : "",
    },
  ]);
  const description = selectedDescriptionCandidate?.value ?? "";

  const jsonLdPhotos = jsonLdBlocks.flatMap((block) => extractImageUrlsFromUnknown(block));
  const structuredPhotos = structuredScriptData.flatMap((block) =>
    extractImageUrlsFromUnknown(block)
  );
  const rawHtmlPhotos = extractAirbnbPhotoUrlsFromRawHtml(html);
  const domPhotos = extractAirbnbPhotoUrlsFromDom($);
  const primaryPhotoCount = mergeAirbnbPhotoUrlSets([
    jsonLdPhotos,
    structuredPhotos,
    rawHtmlPhotos,
    domPhotos,
  ]).length;
  const supplementalHtml = primaryPhotoCount < 12 ? await fetchAirbnbSupplementalPhotoHtml(url) : null;
  const supplementalJsonLdBlocks = supplementalHtml ? extractJsonLd(supplementalHtml) : [];
  const supplementalStructuredScriptData = supplementalHtml
    ? extractStructuredScriptData(supplementalHtml)
    : [];
  const supplementalBootstrapData = supplementalHtml
    ? extractAirbnbBootstrapData(supplementalHtml).blocks
    : [];
  const supplementalDom = supplementalHtml ? cheerio.load(supplementalHtml) : null;
  const allJsonLdBlocks = [...jsonLdBlocks, ...supplementalJsonLdBlocks];
  const allStructuredScriptData = [
    ...structuredScriptData,
    ...supplementalStructuredScriptData,
  ];
  const photoBootstrapData = [...bootstrapData, ...supplementalBootstrapData];
  ratingJson =
    allJsonLdBlocks.find(
      (item) =>
        item.aggregateRating &&
        typeof item.aggregateRating === "object" &&
        !Array.isArray(item.aggregateRating)
    ) ?? ratingJson;
  const supplementalJsonLdPhotos = supplementalJsonLdBlocks.flatMap((block) =>
    extractImageUrlsFromUnknown(block)
  );
  const supplementalStructuredPhotos = supplementalStructuredScriptData.flatMap((block) =>
    extractImageUrlsFromUnknown(block)
  );
  const supplementalRawHtmlPhotos = supplementalHtml
    ? extractAirbnbPhotoUrlsFromRawHtml(supplementalHtml)
    : [];
  const supplementalDomPhotos = supplementalDom ? extractAirbnbPhotoUrlsFromDom(supplementalDom) : [];
  const {
    accepted: bootstrapPhotoSources,
    rejected: rejectedBootstrapPhotoSources,
  } = collectAirbnbStructuredGallerySources(photoBootstrapData);
  debugGuestAuditLog(
    "[guest-audit][airbnb][photos] unique candidate sources count:",
    bootstrapPhotoSources.length
  );
  const bestBootstrapPriority = bootstrapPhotoSources[0]?.priority ?? 0;
  const selectedBootstrapSources = bootstrapPhotoSources.filter(
    (source) => source.priority === bestBootstrapPriority
  );
  const selectedBootstrapRawUrls = selectedBootstrapSources.flatMap((source) => source.urls);
  // Merge sections from the same gallery level instead of keeping only a preview subset.
  const bootstrapPhotos = mergeAirbnbPhotoSources(selectedBootstrapSources);
  const fallbackRawUrls = [
    ...jsonLdPhotos,
    ...structuredPhotos,
    ...rawHtmlPhotos,
    ...domPhotos,
    ...supplementalJsonLdPhotos,
    ...supplementalStructuredPhotos,
    ...supplementalRawHtmlPhotos,
    ...supplementalDomPhotos,
  ].filter(isLikelyAirbnbPhotoUrl);
  const fallbackJsonPhotos = mergeAirbnbPhotoUrlSets([
    jsonLdPhotos,
    structuredPhotos,
    rawHtmlPhotos,
    domPhotos,
    supplementalJsonLdPhotos,
    supplementalStructuredPhotos,
    supplementalRawHtmlPhotos,
    supplementalDomPhotos,
  ]);
  const fallbackUsed = bootstrapPhotos.length === 0;
  const selectedRawCount = fallbackUsed
    ? fallbackRawUrls.length
    : selectedBootstrapRawUrls.length;
  const photos = (bootstrapPhotos.length > 0 ? bootstrapPhotos : fallbackJsonPhotos).slice(
      0,
      200
    );

  const bootstrapCandidatePaths = DEBUG_GUEST_AUDIT
    ? flattenStructuredObjects(bootstrapData)
        .map(({ path }) => path.join("."))
        .filter((joinedPath) =>
          AIRBNB_BOOTSTRAP_KEYWORDS.some((keyword) =>
            joinedPath.toLowerCase().includes(keyword.toLowerCase())
          )
        )
        .filter(Boolean)
        .slice(0, 10)
    : [];

  debugGuestAuditLog("[guest-audit][airbnb][bootstrap] script count:", scriptCount);
  bootstrapDiagnostics.forEach((diagnostic) => {
    debugGuestAuditLog("[guest-audit][airbnb][bootstrap] candidate script:", diagnostic);
  });
  debugGuestAuditLog(
    "[guest-audit][airbnb][bootstrap] candidate paths:",
    bootstrapCandidatePaths
  );
  bootstrapGalleryDiagnostics.forEach((diagnostic) => {
    debugGuestAuditLog("[guest-audit][airbnb][bootstrap] gallery candidate:", {
      blockIndex: diagnostic.blockIndex,
      path: diagnostic.path,
      type: diagnostic.valueType,
      arrayLength: diagnostic.arrayLength,
      imageCount: diagnostic.imageCount,
      category: diagnostic.category,
      sampleUrls: diagnostic.sampleUrls,
      sampleObjects: diagnostic.sampleObjects,
    });
  });

  debugGuestAuditLog("[guest-audit][airbnb][photos] input url:", url);
  debugGuestAuditLog("[guest-audit][airbnb][photos] bootstrap blocks:", bootstrapData.length);
  debugGuestAuditLog("[guest-audit][airbnb][photos] fallback source counts:", {
    jsonLd: jsonLdPhotos.length,
    structured: structuredPhotos.length,
    rawHtml: rawHtmlPhotos.length,
    dom: domPhotos.length,
    supplementalJsonLd: supplementalJsonLdPhotos.length,
    supplementalStructured: supplementalStructuredPhotos.length,
    supplementalRawHtml: supplementalRawHtmlPhotos.length,
    supplementalDom: supplementalDomPhotos.length,
  });
  debugGuestAuditLog("[airbnb][photos-debug]", {
    structuredGalleryCount: bootstrapPhotoSources.length,
    photoTourSectionCount: selectedBootstrapSources.length,
    bootstrapPhotoCount: mergeAirbnbPhotoSources(bootstrapPhotoSources).length,
    rawHtmlPhotoCount: rawHtmlPhotos.length + supplementalRawHtmlPhotos.length,
    domPhotoCount: domPhotos.length + supplementalDomPhotos.length,
    supplementalFetched: Boolean(supplementalHtml),
    finalPhotosCount: photos.length,
  });
  bootstrapPhotoSources.forEach((source) => {
    debugGuestAuditLog("[guest-audit][airbnb][photos] candidate source:", {
      label: source.label,
      priority: source.priority,
      rawCount: source.urls.length,
      sample: source.urls.slice(0, 3),
      sectionId: source.sectionId ?? null,
      sectionComponentType: source.sectionComponentType ?? null,
    });
  });
  rejectedBootstrapPhotoSources.forEach((source) => {
    debugGuestAuditLog("[guest-audit][airbnb][photos] candidate rejected:", {
      label: source.label,
      reasonRejected: source.reasonRejected,
      sectionId: source.sectionId,
      sectionComponentType: source.sectionComponentType,
      rawCount: source.rawCount,
    });
  });
  debugGuestAuditLog(
    "[guest-audit][airbnb][photos] selected priority:",
    fallbackUsed ? 0 : bestBootstrapPriority
  );
  debugGuestAuditLog(
    "[guest-audit][airbnb][photos] selected labels:",
    fallbackUsed ? ["fallback_json"] : selectedBootstrapSources.map((source) => source.label)
  );
  debugGuestAuditLog("[guest-audit][airbnb][photos] merged before dedupe:", selectedRawCount);
  debugGuestAuditLog(
    "[guest-audit][airbnb][photos] after dedupe:",
    fallbackUsed ? fallbackJsonPhotos.length : bootstrapPhotos.length
  );
  debugGuestAuditLog(
    "[guest-audit][airbnb][photos] sample urls:",
    photos.slice(0, 5)
  );
  debugGuestAuditLog("[guest-audit][airbnb][photos] fallback used:", fallbackUsed);
  debugGuestAuditLog("[guest-audit][airbnb][photos] final photosCount:", photos.length);

  const occupancyObservation = buildOccupancyObservation([
    ...explicitCalendarCandidates,
    ...altBootstrapCalendarCandidates,
    ...altStructuredCalendarCandidates,
    ...collectAirbnbCalendarCandidates(bootstrapData),
    ...collectAirbnbCalendarCandidates(structuredScriptData),
    ...collectAirbnbCalendarCandidatesFromRawStrings(bootstrapData),
    ...collectAirbnbCalendarCandidatesFromRawStrings(structuredScriptData),
  ]);

  const amenityKeywords = [
    "wifi",
    "wi-fi",
    "kitchen",
    "air conditioning",
    "heating",
    "parking",
    "washer",
    "dryer",
    "coffee",
    "workspace",
    "pool",
    "tv",
    "balcony",
    "elevator",
    "breakfast",
    "shower",
    "hair dryer",
    "iron",
    "crib",
    "high chair",
    "smoke alarm",
    "first aid kit",
  ];

  const visibleAmenityButtonCount =
    extractAirbnbVisibleAmenityButtonCount(html) ??
    (supplementalHtml ? extractAirbnbVisibleAmenityButtonCount(supplementalHtml) : null);
  const structuredAmenities = dedupeAirbnbAmenities([
    ...extractAirbnbAmenitiesFromStructuredData([...bootstrapData, ...supplementalBootstrapData]),
    ...extractAirbnbAmenitiesFromStructuredData(allStructuredScriptData),
  ]);
  const rawHtmlAmenities = dedupeAirbnbAmenities([
    ...extractAirbnbAmenityTitlesFromRawHtml(html),
    ...(supplementalHtml ? extractAirbnbAmenityTitlesFromRawHtml(supplementalHtml) : []),
  ]);
  const domVisibleAmenities = dedupeAirbnbAmenities([
    ...extractAirbnbVisibleAmenitiesFromDom($),
    ...(supplementalDom ? extractAirbnbVisibleAmenitiesFromDom(supplementalDom) : []),
  ]);
  const textAmenityFallbacks = extractAirbnbAmenityFallbacksFromText(
    [
      bodyText,
      description,
      decodeAirbnbHtmlEntities(html),
      supplementalHtml ? decodeAirbnbHtmlEntities(supplementalHtml) : "",
      $('meta[property="og:title"]').attr("content") ?? "",
    ].join(" ")
  );
  const fallbackAmenities = dedupeAirbnbAmenities(
    [
      ...$("[data-testid], [aria-label], li, span, div")
        .map((_, el) => $(el).text())
        .get()
        .filter((text) => {
          const value = text.toLowerCase();
          return (
            value.length >= 3 &&
            value.length <= 80 &&
            amenityKeywords.some((keyword) => value.includes(keyword))
          );
        }),
      ...textAmenityFallbacks,
    ]
  ).slice(0, 60);
  const amenitySourceOrder = [
    { label: "structured", values: structuredAmenities },
    { label: "rawHtml", values: rawHtmlAmenities },
    { label: "domVisible", values: domVisibleAmenities },
  ];
  const preferredAmenitySource = pickAirbnbAmenitySourceClosestToCount(
    amenitySourceOrder,
    visibleAmenityButtonCount
  );
  const preferredAmenities =
    amenitySourceOrder.find((source) => source.label === preferredAmenitySource)?.values ?? [];
  const reliableAmenities = dedupeAirbnbAmenities([
    ...preferredAmenities,
    ...rawHtmlAmenities,
    ...domVisibleAmenities,
    ...structuredAmenities,
  ]);
  const dedupedAmenities = dedupeAirbnbAmenities([
    ...reliableAmenities,
    ...(reliableAmenities.length < 5 ? fallbackAmenities : []),
  ]);
  const finalAmenityLimit = visibleAmenityButtonCount
    ? Math.min(visibleAmenityButtonCount, dedupedAmenities.length)
    : Math.min(60, dedupedAmenities.length);
  const amenities = dedupedAmenities.slice(0, finalAmenityLimit);
  debugGuestAuditLog("[airbnb][amenities-debug]", {
    structuredAmenitiesCount: structuredAmenities.length,
    textFallbackAmenitiesCount: fallbackAmenities.length,
    domVisibleAmenitiesCount: domVisibleAmenities.length + rawHtmlAmenities.length,
    finalAmenitiesCount: amenities.length,
    amenitiesSample: amenities.slice(0, 12),
  });
  debugGuestAuditLog("[airbnb][amenities-quality-debug]", {
    visibleAmenityButtonCount,
    structuredAmenitiesCount: structuredAmenities.length,
    rawHtmlAmenitiesCount: rawHtmlAmenities.length,
    domVisibleAmenitiesCount: domVisibleAmenities.length,
    textFallbackAmenitiesCount: fallbackAmenities.length,
    dedupedAmenitiesCount: dedupedAmenities.length,
    finalAmenitiesCount: amenities.length,
    amenitiesSample: amenities.slice(0, 12),
  });

  let price: number | null = null;
  let currency: string | null = null;
  let priceSource:
    | "cdp_dom"
    | "dom_book_it"
    | "meta_product"
    | "jsonld_pricerange"
    | "bootstrap_script"
    | null = null;
  let cdpListingSignals: AirbnbCdpListingSignals | null = null;

  const hasStayDates = airbnbUrlHasStayDates(url);
  const stayNights = airbnbStayNightsFromUrl(url);
  const priceRejectedReasons: string[] = [];
  let priceCandidatesScanned = 0;

  if (!hasStayDates) {
    airbnbPriceDebug({
      found: false,
      reason: "no_dates_no_price",
      hasDates: false,
      nights: null,
      candidatesCount: 0,
      selectedSource: null,
      price: null,
      currency: null,
      rejectedReasons: [],
    });
  } else {
    const tryApplyParsed = (
      parsed: { price: number; currency: string | null } | null,
      rawText: string,
      source: NonNullable<typeof priceSource>,
      rejectTag: string
    ): boolean => {
      if (!parsed || !isPlausibleAirbnbStayPrice(parsed.price)) {
        priceRejectedReasons.push(rejectTag);
        return false;
      }
      const adjusted = maybeConvertAirbnbTotalToNightly(parsed, rawText, stayNights);
      if (!isPlausibleAirbnbStayPrice(adjusted.price)) {
        priceRejectedReasons.push(`${rejectTag}_after_nightly_adjust`);
        return false;
      }
      if (adjusted.price !== parsed.price) {
        airbnbPriceDebug({
          rawPrice: parsed.price,
          nights: stayNights,
          selectedSource: source,
          normalizedNightlyPrice: adjusted.price,
          price: adjusted.price,
          currency: adjusted.currency,
          reason: "resolved_total_to_nightly",
        });
      }
      price = adjusted.price;
      currency = adjusted.currency;
      priceSource = source;
      return true;
    };

    const bookItContainer = $('[data-testid="book-it-default"]').first();
    const bookItAmount = $('[data-testid="book-it-price-amount"]').first();
    const bookItCombined = normalizeWhitespace(
      [bookItContainer.text(), bookItAmount.text()].filter(Boolean).join(" ")
    );
    priceCandidatesScanned += 1;
    if (!bookItCombined) {
      priceRejectedReasons.push("dom_book_it_empty");
    } else if (AIRBNB_PRICE_FEE_OR_TAX_LINE.test(bookItCombined)) {
      priceRejectedReasons.push("dom_book_it_fee_context");
    } else {
      const parsedBook = parseAirbnbDisplayedPrice(bookItCombined, "book-it-default");
      tryApplyParsed(parsedBook, bookItCombined, "dom_book_it", "dom_book_it_invalid");
    }

    if (price === null) {
      const metaAmount = $('meta[property="product:price:amount"]').attr("content")?.trim();
      const metaCurrency = $('meta[property="product:price:currency"]').attr("content")?.trim();
      priceCandidatesScanned += 1;
      if (metaAmount && metaCurrency) {
        const n = parseMaybePrice(metaAmount);
        if (n != null && isPlausibleAirbnbStayPrice(n)) {
          const adj = maybeConvertAirbnbTotalToNightly(
            { price: Math.round(n), currency: metaCurrency.toUpperCase() },
            metaAmount,
            stayNights
          );
          if (isPlausibleAirbnbStayPrice(adj.price)) {
            price = adj.price;
            currency = adj.currency;
            priceSource = "meta_product";
          } else {
            priceRejectedReasons.push("meta_product_after_adjust_invalid");
          }
        } else {
          priceRejectedReasons.push("meta_product_amount_invalid");
        }
      } else {
        priceRejectedReasons.push("meta_product_missing");
      }
    }

    if (price === null && lodgingJson?.priceRange && typeof lodgingJson.priceRange === "string") {
      const pr = lodgingJson.priceRange;
      priceCandidatesScanned += 1;
      const parsedRange = parseAirbnbDisplayedPrice(pr, "jsonld-pricerange");
      tryApplyParsed(parsedRange, pr, "jsonld_pricerange", "jsonld_pricerange_invalid");
    }

    if (price === null) {
      const bootstrapStrings = uniqueStrings([
        ...findStructuredString(bestStructuredRecord, AIRBNB_BOOTSTRAP_PRICE_KEY_PATTERNS, 4),
        ...findStructuredString(bootstrapData, AIRBNB_BOOTSTRAP_PRICE_KEY_PATTERNS, 4),
        ...findStructuredString(allStructuredScriptData, AIRBNB_BOOTSTRAP_PRICE_KEY_PATTERNS, 4),
      ]).slice(0, 45);
      priceCandidatesScanned += bootstrapStrings.length;
      for (const s of bootstrapStrings) {
        if (AIRBNB_PRICE_FEE_OR_TAX_LINE.test(s)) {
          priceRejectedReasons.push("bootstrap_fee_context");
          continue;
        }
        if (tryApplyParsed(parseAirbnbDisplayedPrice(s, "bootstrap-script"), s, "bootstrap_script", "bootstrap_row_invalid")) {
          break;
        }
      }
    }

    if (price === null) {
      cdpListingSignals = await extractAirbnbPriceWithCdp(url);
      priceCandidatesScanned += 20;
      if (cdpListingSignals?.price != null) {
        price = cdpListingSignals.price;
        currency = cdpListingSignals.currency ?? currency;
        priceSource = "cdp_dom";
      } else {
        priceRejectedReasons.push("cdp_no_price");
      }
    }

    airbnbPriceDebug({
      found: price != null,
      reason: price != null ? "resolved" : "no_price_matched",
      hasDates: true,
      nights: stayNights,
      candidatesCount: priceCandidatesScanned,
      selectedSource: priceSource,
      price,
      currency,
      rejectedReasons: uniqueStrings(priceRejectedReasons).slice(0, 14),
    });
  }

  debugGuestAuditLog("[airbnb][price-debug]", {
    found: price != null,
    price,
    currency,
    source: priceSource,
  });

  const ratingStructuredCandidate =
    findStructuredNumber(bestStructuredRecord, [/ratingValue/i, /starRating/i, /avgRating/i]) ??
    findStructuredNumber(bootstrapData, [/ratingValue/i, /starRating/i, /avgRating/i]) ??
    findStructuredNumber(allStructuredScriptData, [/ratingValue/i, /starRating/i, /avgRating/i]) ??
    findStructuredNumber(allJsonLdBlocks, [/ratingValue/i, /starRating/i, /avgRating/i]) ??
    (typeof ratingJson?.aggregateRating === "object" &&
    ratingJson.aggregateRating &&
    typeof (ratingJson.aggregateRating as Record<string, unknown>).ratingValue === "string"
      ? parseLocalizedDecimal(
          (ratingJson.aggregateRating as Record<string, unknown>).ratingValue as string
        )
      : null);
  const ratingTextCandidateInputs: Array<{ source: string; text: string | undefined }> = [
    { source: "og:title", text: $('meta[property="og:title"]').attr("content") || undefined },
    { source: "selector:review-score", text: $('[data-testid="review-score"]').first().text() || undefined },
    { source: "selector:rating-testid", text: $('[data-testid*="rating"]').first().text() || undefined },
    { source: "selector:review-testid", text: $('[data-testid*="review"]').first().text() || undefined },
    { source: "selector:aria-rating", text: $('[aria-label*="rating"]').first().attr("aria-label") || undefined },
    { source: "meta:itemprop:ratingValue", text: $('meta[itemprop="ratingValue"]').attr("content") || undefined },
    {
      source: "structured:avgRatingLocalized",
      text: findStructuredString(bestStructuredRecord, [/avgRatingLocalized/i, /reviewScore/i], 1)[0],
    },
    { source: "body:star-prefix", text: bodyText.match(/★\s*([0-5](?:[.,]\d{1,2})?)/i)?.[0] },
    { source: "body:star-suffix", text: bodyText.match(/([0-5](?:[.,]\d{1,2})?)\s*(?:\/\s*5)?\s*★/i)?.[0] },
    {
      source: "body:rating-word",
      text: bodyText.match(/(?:note|rating|évaluation)\s*[:\-]?\s*([0-5](?:[.,]\d{1,2})?)/i)?.[0],
    },
  ];
  const ratingTextCandidates = uniqueStrings(
    ratingTextCandidateInputs
      .map((entry) => entry.text)
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
  );
  const ratingRejectedCandidates: Array<{ source: string; text: string; reason: string }> = [];
  let ratingTextCandidate: number | null = null;
  for (const candidate of ratingTextCandidateInputs) {
    if (!candidate.text || !candidate.text.trim()) continue;
    const normalizedText = normalizeWhitespace(candidate.text);
    if (!hasSemanticRatingContext(normalizedText, candidate.source)) {
      ratingRejectedCandidates.push({
        source: candidate.source,
        text: normalizedText.slice(0, 140),
        reason: "missing_semantic_context",
      });
      continue;
    }
    const parsed = parseLocalizedDecimal(normalizedText);
    if (parsed == null) {
      ratingRejectedCandidates.push({
        source: candidate.source,
        text: normalizedText.slice(0, 140),
        reason: "not_a_number",
      });
      continue;
    }
    const normalizedParsed = normalizeRatingCandidate(parsed);
    if (normalizedParsed == null) {
      ratingRejectedCandidates.push({
        source: candidate.source,
        text: normalizedText.slice(0, 140),
        reason: "out_of_rating_range",
      });
      continue;
    }
    ratingTextCandidate = normalizedParsed;
    break;
  }
  const normalizedStructuredRating = normalizeRatingCandidate(ratingStructuredCandidate);
  if (ratingStructuredCandidate != null && normalizedStructuredRating == null) {
    ratingRejectedCandidates.push({
      source: "structured:rating",
      text: String(ratingStructuredCandidate),
      reason: "out_of_rating_range",
    });
  }
  const rating =
    normalizedStructuredRating != null ? normalizedStructuredRating : ratingTextCandidate;

  const reviewStructuredCandidate =
    findStructuredNumber(bestStructuredRecord, [/reviewCount/i, /visibleReviewCount/i]) ??
    findStructuredNumber(bootstrapData, [/reviewCount/i, /visibleReviewCount/i, /numberOfReviews/i, /ratingCount/i]) ??
    findStructuredNumber(allStructuredScriptData, [/reviewCount/i, /visibleReviewCount/i, /numberOfReviews/i, /ratingCount/i]) ??
    findStructuredNumber(allJsonLdBlocks, [/reviewCount/i, /visibleReviewCount/i, /numberOfReviews/i, /ratingCount/i]) ??
    (typeof ratingJson?.aggregateRating === "object" &&
    ratingJson.aggregateRating &&
    typeof (ratingJson.aggregateRating as Record<string, unknown>).reviewCount === "string"
      ? parseLocalizedInteger(
          (ratingJson.aggregateRating as Record<string, unknown>).reviewCount as string
        )
      : typeof ratingJson?.aggregateRating === "object" &&
          ratingJson.aggregateRating &&
          typeof (ratingJson.aggregateRating as Record<string, unknown>).ratingCount === "string"
        ? parseLocalizedInteger(
            (ratingJson.aggregateRating as Record<string, unknown>).ratingCount as string
          )
      : null);
  const reviewTextCandidateInputs: Array<{ source: string; text: string | undefined }> = [
    { source: "selector:review-count", text: $('[data-testid="review-count"]').first().text() || undefined },
    { source: "selector:review-testid", text: $('[data-testid*="review"]').first().text() || undefined },
    { source: "meta:itemprop:reviewCount", text: $('meta[itemprop="reviewCount"]').attr("content") || undefined },
    { source: "body:reviews-parenthesis", text: bodyText.match(/\((\d[\d\s.,]*)\s*(?:commentaires|avis|reviews)\)/i)?.[0] },
    { source: "body:reviews-word", text: bodyText.match(/(\d[\d\s.,]*)\s*(?:commentaires|avis|reviews)\b/i)?.[0] },
  ];
  const reviewTextCandidates = uniqueStrings(
    reviewTextCandidateInputs
      .map((entry) => entry.text)
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
  );
  const reviewRejectedCandidates: Array<{ source: string; text: string; reason: string }> = [];
  let reviewTextCandidate: number | null = null;
  for (const candidate of reviewTextCandidateInputs) {
    if (!candidate.text || !candidate.text.trim()) continue;
    const normalizedText = normalizeWhitespace(candidate.text);
    if (!hasSemanticReviewCountContext(normalizedText, candidate.source)) {
      reviewRejectedCandidates.push({
        source: candidate.source,
        text: normalizedText.slice(0, 140),
        reason: "missing_semantic_context",
      });
      continue;
    }
    const parsed = parseLocalizedInteger(normalizedText);
    if (parsed == null) {
      reviewRejectedCandidates.push({
        source: candidate.source,
        text: normalizedText.slice(0, 140),
        reason: "not_an_integer",
      });
      continue;
    }
    reviewTextCandidate = parsed;
    break;
  }
  const reviewCountCandidate =
    reviewStructuredCandidate != null ? reviewStructuredCandidate : reviewTextCandidate;
  const normalizedReviewCount =
    reviewCountCandidate == null ? null : Math.max(0, Math.round(reviewCountCandidate));

  const capacity =
    findStructuredNumber(bestStructuredRecord, [/guestCapacity/i, /personCapacity/i, /capacity/i]) ??
    findFirstMatchNumber(bodyText, [
      /(\d+)\s+guests?/i,
      /(\d+)\s+voyageurs?/i,
      /guest favorite.*?(\d+)\s+guests?/i,
      /accommodates\s+(\d+)/i,
    ]) ?? null;

  const bedrooms =
    findStructuredNumber(bestStructuredRecord, [/bedroomCount/i, /^bedrooms$/i]) ??
    findFirstMatchNumber(bodyText, [
      /(\d+)\s+bedrooms?/i,
      /(\d+)\s+chambres?/i,
    ]) ?? null;

  const bedCount =
    findStructuredNumber(bestStructuredRecord, [/bedCount/i, /^beds$/i]) ??
    findFirstMatchNumber(bodyText, [/(\d+)\s+beds?/i, /(\d+)\s+lits?/i]) ??
    null;

  const bathrooms =
    findStructuredNumber(bestStructuredRecord, [/bathroomCount/i, /^bathrooms$/i]) ??
    findFirstMatchNumber(bodyText, [
      /(\d+(?:\.\d+)?)\s+bathrooms?/i,
      /(\d+(?:\.\d+)?)\s+salles? de bain/i,
    ]) ?? null;

  const ogTitleMeta = $('meta[property="og:title"]').attr("content") || "";
  const ogLocationLine = extractAirbnbLocationFromOgTitle(ogTitleMeta);
  const structuredLocationMatches = findStructuredString(
    bestStructuredRecord,
    [
      /locationLabel/i,
      /localizedCityName/i,
      /localizedCity$/i,
      /cityName$/i,
      /defaultCity$/i,
      /addressLocality/i,
    ],
    2
  );
  const structuredLocationPick =
    structuredLocationMatches.find(isPlausibleAirbnbStructuredLocationHint) ?? null;
  const jsonLdLocality =
    typeof lodgingJson?.address === "object" &&
    lodgingJson.address &&
    typeof (lodgingJson.address as Record<string, unknown>).addressLocality === "string"
      ? ((lodgingJson.address as Record<string, unknown>).addressLocality as string)
      : "";
  const locationLabel =
    structuredLocationPick ||
    ogLocationLine ||
    (jsonLdLocality && isPlausibleAirbnbStructuredLocationHint(jsonLdLocality) ? jsonLdLocality : null) ||
    ogTitleMeta ||
    $('meta[name="description"]').attr("content") ||
    null;

  const metaDescriptionRaw = $('meta[name="description"]').attr("content") || "";
  const stableAirbnbProperty = deriveStableAirbnbPropertyClassification({
    lodgingJson,
    bestStructuredRecord,
    ogTitle: ogTitleMeta,
    metaDescription: metaDescriptionRaw,
    selectedDescription: description,
  });

  const bodyVisibleText = normalizeWhitespace(
    $("body")
      .clone()
      .find("script, style, noscript, template")
      .remove()
      .end()
      .text()
  );
  const hostVisibleSources = [
    ...$('[data-testid*="host"], [aria-label*="host"], [aria-label*="hôte"]')
      .map((_, el) => ({
        source: "host-locator",
        text: normalizeWhitespace($(el).text()),
      }))
      .get(),
    ...$("h2, h3, span")
      .map((_, el) => ({
        source: "host-visible",
        text: normalizeWhitespace($(el).text()),
      }))
      .get(),
  ].filter((entry) => entry.text.length > 0);
  const hostTextCandidates = uniqueStrings([
    bodyVisibleText,
    ...hostVisibleSources.map((entry) => entry.text),
  ]).filter((text) => hasHostContext(text));
  const airbnbHostBlocks = uniqueStrings([
    ...$('[data-testid="pdp-host-info"]')
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get(),
    ...$('[data-testid="host-profile"]')
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get(),
  ]).filter((text) => text.length > 0);
  const structuredHostNameCandidates = uniqueStrings([
    ...findStructuredHostNameCandidates(bestStructuredRecord),
    ...findStructuredHostNameCandidates(bootstrapData),
    ...findStructuredHostNameCandidates(structuredScriptData),
  ]);

  const hostCandidateInputs: Array<{ source: string; text: string }> = [
    { source: "body-visible", text: bodyVisibleText },
    ...hostVisibleSources,
  ]
    .filter((entry) => entry.text.length > 0)
    .filter((entry) => hasHostContext(entry.text));

  const hostRejectedCandidates: Array<{ source: string; text: string; reason: string }> = [];
  let hostName: string | null = null;
  debugGuestAuditLog("[guest-audit][airbnb][trust][host] airbnb-block candidates", {
    count: airbnbHostBlocks.length,
    samples: airbnbHostBlocks.slice(0, 6),
  });

  for (const candidate of structuredHostNameCandidates) {
    if (hostName) break;
    const cleanedCandidate = stripTrailingAirbnbHostBadges(
      normalizeWhitespace(candidate).replace(/[.,;:!?]+$/g, "").trim()
    );
    const validation = validateHostNameCandidate(cleanedCandidate);
    if (!validation.value) {
      hostRejectedCandidates.push({
        source: "structured-host",
        text: cleanedCandidate.slice(0, 140),
        reason: validation.reason ?? "rejected",
      });
      continue;
    }

    hostName = stripTrailingAirbnbHostBadges(validation.value);
    debugGuestAuditLog("[guest-audit][airbnb][trust][host] structured accepted", {
      candidate: hostName,
    });
  }

  for (const text of airbnbHostBlocks) {
    const match =
      text.match(/h[oô]te\s*:\s*([A-ZÀ-Ý][\p{L}\p{M}'’\-\s]{2,60})/u) ||
      text.match(/hosted by\s+([A-ZÀ-Ý][\p{L}\p{M}'’\-\s]{2,60})/iu);

    if (!match?.[1]) {
      hostRejectedCandidates.push({
        source: "airbnb-block",
        text: text.slice(0, 140),
        reason: "missing_host_regex_match",
      });
      continue;
    }

    const candidate = stripTrailingAirbnbHostBadges(
      normalizeWhitespace(match[1]).replace(/[.,;:!?]+$/g, "").trim()
    );
    const validation = validateHostNameCandidate(candidate);
    if (!validation.value) {
      hostRejectedCandidates.push({
        source: "airbnb-block",
        text: candidate.slice(0, 140),
        reason: validation.reason ?? "rejected",
      });
      debugGuestAuditLog("[guest-audit][airbnb][trust][host] rejected candidate", {
        source: "airbnb-block",
        candidate: candidate.slice(0, 140),
        reason: validation.reason ?? "rejected",
      });
      continue;
    }

    const cleanedHost = stripTrailingAirbnbHostBadges(validation.value);
    debugGuestAuditLog("[guest-audit][airbnb][trust][host] cleaned trailing badge", {
      before: validation.value,
      after: cleanedHost,
    });
    hostName = cleanedHost;
    debugGuestAuditLog("[guest-audit][airbnb][trust][host] airbnb-block accepted", {
      candidate: cleanedHost,
    });
    debugGuestAuditLog("[guest-audit][airbnb][trust][host] accepted candidate", {
      source: "airbnb-block",
      candidate: cleanedHost,
    });
    break;
  }

  for (const entry of hostCandidateInputs) {
    if (hostName) break;
    debugGuestAuditLog("[guest-audit][airbnb][trust][host] candidate source", {
      source: entry.source,
      text: entry.text.slice(0, 180),
    });
    const match =
      entry.text.match(/h[oô]te\s*:\s*([A-ZÀ-Ý][\p{L}\p{M}'’\-\s]{1,60})/u) ||
      entry.text.match(/hosted by\s+([A-ZÀ-Ý][\p{L}\p{M}'’\-\s]{1,60})/iu) ||
      entry.text.match(/propos[ée]\s+par\s+([A-ZÀ-Ý][\p{L}\p{M}'’\-\s]{1,60})/iu) ||
      entry.text.match(/chez\s+([A-ZÀ-Ý][\p{L}\p{M}'’\-\s]{1,60})/iu);

    if (!match?.[1]) {
      hostRejectedCandidates.push({
        source: entry.source,
        text: entry.text.slice(0, 140),
        reason: "missing_host_regex_match",
      });
      continue;
    }

    const candidate = stripTrailingAirbnbHostBadges(
      normalizeWhitespace(match[1]).replace(/[.,;:!?]+$/g, "").trim()
    );
    const validation = validateHostNameCandidate(candidate);
    if (!validation.value) {
      hostRejectedCandidates.push({
        source: entry.source,
        text: candidate.slice(0, 140),
        reason: validation.reason ?? "rejected",
      });
      debugGuestAuditLog("[guest-audit][airbnb][trust][host] rejected candidate", {
        source: entry.source,
        candidate: candidate.slice(0, 140),
        reason: validation.reason ?? "rejected",
      });
      continue;
    }

    const cleanedHost = stripTrailingAirbnbHostBadges(validation.value);
    debugGuestAuditLog("[guest-audit][airbnb][trust][host] cleaned trailing badge", {
      before: validation.value,
      after: cleanedHost,
    });
    hostName = cleanedHost;
    debugGuestAuditLog("[guest-audit][airbnb][trust][host] accepted candidate", {
      source: entry.source,
      candidate: cleanedHost,
    });
    break;
  }
  if (!hostName && cdpListingSignals?.hostName) {
    hostName = cdpListingSignals.hostName;
    debugGuestAuditLog("[guest-audit][airbnb][trust][host] cdp accepted", {
      candidate: hostName,
    });
  }
  const hostInfo = hostName;

  const badgeCandidateTexts = uniqueStrings([
    ...findStructuredString(
      bestStructuredRecord,
      [/badge/i, /highlight/i, /superhost/i, /guestFavorite/i, /travelerFavorite/i],
      2
    ),
    ...findStructuredString(
      bootstrapData,
      [/badge/i, /highlight/i, /superhost/i, /guestFavorite/i, /travelerFavorite/i],
      2
    ).slice(0, 60),
    ...findStructuredString(
      structuredScriptData,
      [/badge/i, /highlight/i, /superhost/i, /guestFavorite/i, /travelerFavorite/i],
      2
    ).slice(0, 60),
    ...$('[data-testid*="badge"], [data-testid*="highlight"], [data-testid*="superhost"]')
      .map((_, el) => $(el).text())
      .get(),
  ]);
  const badgeDetection = detectTrustBadgesFromTexts(badgeCandidateTexts);
  const badges = badgeDetection.badges;
  const reviewTrustBadge =
    normalizedReviewCount != null && normalizedReviewCount > 0 ? "Avis vérifiés" : null;
  const cdpTrustBadge = cdpListingSignals?.trustBadge ?? null;
  const highlights = uniqueStrings([
    ...badges,
    ...(cdpTrustBadge ? [cdpTrustBadge] : []),
    ...(reviewTrustBadge ? [reviewTrustBadge] : []),
  ]);
  const trustBadge = badges[0] ?? cdpTrustBadge ?? reviewTrustBadge;

  debugGuestAuditLog("[guest-audit][airbnb][trust] rating candidate:", {
    structured: ratingStructuredCandidate,
    textSamples: ratingTextCandidates.slice(0, 6),
    rejected: ratingRejectedCandidates.slice(0, 10),
    selected: rating,
  });
  debugGuestAuditLog("[guest-audit][airbnb][trust] reviewCount candidate:", {
    structured: reviewStructuredCandidate,
    textSamples: reviewTextCandidates.slice(0, 6),
    rejected: reviewRejectedCandidates.slice(0, 10),
    selected: normalizedReviewCount,
  });
  debugGuestAuditLog("[guest-audit][airbnb][trust] hostName candidate:", {
    visibleSamples: hostTextCandidates.slice(0, 6),
    rejected: hostRejectedCandidates.slice(0, 10),
    selected: hostName,
  });
  debugGuestAuditLog("[guest-audit][airbnb][trust] badges candidate:", {
    textSamples: badgeCandidateTexts.slice(0, 6),
    rejected: badgeDetection.rejected.slice(0, 10),
    selected: badges,
  });

  const propertyType = stableAirbnbProperty.propertyType;

  const selectedTitleCandidate = selectBestAirbnbTitle(titleCandidates);
  const title =
    selectedTitleCandidate?.value ||
    buildAirbnbTitleFallback({
      propertyType,
      locationLabel,
      titleCandidates,
    });

  debugGuestAuditLog("[guest-audit][airbnb][title] finalSource:", selectedTitleCandidate?.source ?? "fallback_localized");
  debugGuestAuditLog("[guest-audit][airbnb][title] selected:", title);

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

  const normalizedTitle = normalizeWhitespace(title);
  const normalizedDescription = normalizeWhitespace(description);
  const normalizedOccupancyObservation: OccupancyObservation = {
    status: occupancyObservation.rate == null ? "unavailable" : "available",
    rate: occupancyObservation.rate,
    unavailableDays: occupancyObservation.unavailableDays,
    availableDays: occupancyObservation.availableDays,
    observedDays: occupancyObservation.observedDays,
    windowDays: occupancyObservation.windowDays,
    source: occupancyObservation.source,
    message:
      occupancyObservation.rate == null
        ? "Donnees d'occupation non disponibles pour cette annonce"
        : null,
  };
  const normalizedStructure = {
    capacity,
    bedrooms,
    bedCount,
    bathrooms,
    propertyType: propertyType ?? null,
    locationLabel: locationLabel ?? null,
  };
  const photoSource = fallbackUsed
    ? "fallback_json"
    : selectedBootstrapSources.map((source) => source.label).join(" | ") || null;
  const warnings = [
    normalizedDescription.length === 0 ? "missing_description" : null,
    photos.length === 0 ? "missing_photos" : null,
    normalizedOccupancyObservation.status === "unavailable"
      ? "occupancy_observation_unavailable"
      : null,
  ].filter((warning): warning is string => Boolean(warning));

  debugGuestAuditLog("[airbnb][result]", {
    title: normalizedTitle,
    descriptionLength: normalizedDescription.length,
    photosCount: photos.length,
    amenitiesCount: amenities.length,
    rating,
    reviewCount: normalizedReviewCount,
  });
  debugGuestAuditLog("[airbnb][final-merge-debug]", {
    title: normalizedTitle,
    descriptionLength: normalizedDescription.length,
    price,
    currency,
    priceSource,
    photosCount: photos.length,
    amenitiesCount: amenities.length,
    rating,
    reviewCount: normalizedReviewCount,
  });

  return {
    url,
    sourceUrl: url,
    platform: "airbnb",
    canonicalUrl: url,
    sourcePlatform: "airbnb",
    externalId: parseExternalId(url),
    title: normalizedTitle,
    titleMeta: buildFieldMeta({
      source: selectedTitleCandidate?.source ?? "fallback_localized",
      value: normalizedTitle,
      quality: inferTitleQuality(normalizedTitle),
    }),
    description: normalizedDescription,
    descriptionMeta: buildFieldMeta({
      source: selectedDescriptionCandidate?.source ?? null,
      value: normalizedDescription,
      quality: inferDescriptionQuality(normalizedDescription),
    }),
    amenities,
    photos,
    photosCount: photos.length,
    photoMeta: buildPhotoMeta({
      source: photoSource,
      photos,
    }),
    structure: normalizedStructure,
    price,
    currency,
    ...(priceSource ? { priceSource } : {}),
    latitude,
    longitude,
    capacity,
    guestCapacity: capacity,
    bedrooms,
    bedroomCount: bedrooms,
    bedCount,
    bathrooms,
    bathroomCount: bathrooms,
    locationLabel: locationLabel ? normalizeWhitespace(locationLabel) : null,
    propertyType: propertyType ? normalizeWhitespace(propertyType) : null,
    airbnbComparableClassificationText:
      stableAirbnbProperty.comparableClassificationText.trim().length > 0
        ? stableAirbnbProperty.comparableClassificationText.trim()
        : null,
    rating,
    ratingValue: rating,
    reviewCount: normalizedReviewCount,
    hostInfo,
    hostName,
    highlights,
    badges,
    trustBadge,
    occupancyObservation: normalizedOccupancyObservation,
    extractionMeta: {
      extractor: "airbnb",
      extractedAt: new Date().toISOString(),
      warnings,
    },
  };
}

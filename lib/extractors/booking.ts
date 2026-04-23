import * as cheerio from "cheerio";
import { buildBookingUrlWithDates, bookingUrlHasStayDates } from "./booking-url";
import type { ExtractListingOptions, ExtractorResult } from "./types";
import { fetchUnlockedPageData } from "@/lib/brightdata";
import {
  buildFieldMeta,
  buildPhotoMeta,
  inferDescriptionQuality,
  inferTitleQuality,
} from "./quality";
import {
  dedupeBookingListingPhotoUrls,
  extractImageUrlsFromUnknown,
  getBookingImageAssetKey,
  isLikelyBookingListingPhotoUrl,
  normalizeWhitespace,
  uniqueStrings,
} from "./shared";

const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";
/** Logs pipeline Booking / marché : activer avec DEBUG_BOOKING_PIPELINE=true (ou DEBUG_GUEST_AUDIT). */
const DEBUG_BOOKING_PIPELINE =
  process.env.DEBUG_BOOKING_PIPELINE === "true" || DEBUG_GUEST_AUDIT;

function bookingPipelineLog(tag: string, payload: Record<string, unknown>) {
  if (!DEBUG_BOOKING_PIPELINE) return;
  console.log(tag, payload);
}
const BOOKING_HOST_REJECT_SUBSTRINGS = [
  "booking",
  ".com",
  "www.",
  "http",
  "/",
  "<",
  ">",
  "sign in",
  "se connecter",
  "check-in",
  "check-out",
];
const BOOKING_TRUST_BADGE_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: "Genius",
    patterns: [/\bgenius\b/i],
  },
  {
    label: "Travel Sustainable",
    patterns: [/travel sustainable/i, /voyage durable/i, /duurzaam reizen/i],
  },
  {
    label: "Preferred Partner",
    patterns: [/preferred partner/i, /partenaire pr[ée]f[ée]r[ée]/i],
  },
];

function debugGuestAuditLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

/** Compacte les milliers espacés (ex. "1 234,50 €") pour le parseur numérique. */
function compactBookingPriceNumberTokens(text: string): string {
  return text.replace(
    /\b(\d{1,3}(?:[ \u00a0\u202f]\d{3})+)([.,]\d{1,2})?\b/g,
    (_, intPart: string, dec?: string) =>
      String(intPart).replace(/[ \u00a0\u202f]/g, "") + (dec ?? ""),
  );
}

function parseBookingPriceFromText(text: string): number | null {
  const normalized = normalizeWhitespace(compactBookingPriceNumberTokens(normalizeWhitespace(text)));
  const match =
    normalized.match(/(?:€|EUR)\s*(\d{1,4}(?:[.,]\d{1,2})?)/i) ??
    normalized.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|EUR)\b/i) ??
    normalized.match(/(?:US\$|\$|USD)\s*(\d{1,4}(?:[.,]\d{1,2})?)/i) ??
    normalized.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:US\$|\$|USD)\b/i) ??
    normalized.match(/(?:£|GBP)\s*(\d{1,4}(?:[.,]\d{1,2})?)/i) ??
    normalized.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:£|GBP)\b/i) ??
    normalized.match(/(?:MAD|DH|د\.?\s*م\.?|dirham)\s*(\d{2,4}(?:[.,]\d{1,2})?)/i) ??
    normalized.match(/(\d{2,4}(?:[.,]\d{1,2})?)\s*(?:MAD|DH|د\.?\s*م\.?|dirham)\b/i);

  if (!match?.[1]) return null;

  const value = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 20 || value > 5000) return null;
  return value;
}

function parseBookingCurrencyFromText(text: string): string | null {
  if (/€|\bEUR\b/i.test(text)) return "EUR";
  if (/US\$|\$|\bUSD\b/i.test(text)) return "USD";
  if (/£|\bGBP\b/i.test(text)) return "GBP";
  if (/\bMAD\b|\bDH\b|د\.?\s*م\.?|dirham/i.test(text)) return "MAD";
  return null;
}

/** Retire bruit CTA souvent concaténé au même nœud DOM que le prix (sans inventer de montant). */
function normalizeBookingPriceSnippetForReliability(text: string): string {
  let s = normalizeWhitespace(text);
  if (!s) return s;
  s = s.replace(
    /\s*(?:·|•|\||—|,)\s*(?:(?:voir|afficher)\s+(?:les\s+)?tarifs|show\s+prices).*$/i,
    "",
  );
  s = s.replace(/\s+(?:voir|afficher)\s+(?:les\s+)?tarifs\s*\.?\s*$/i, "");
  s = s.replace(/\s+show\s+prices\s*\.?\s*$/i, "");
  return normalizeWhitespace(s);
}

/** Raison de rejet pour logs [booking][price][candidate] ; null = passerait le filtre fiabilité. */
function getBookingPriceRejectReason(text: string): string | null {
  const normalized = normalizeBookingPriceSnippetForReliability(text);
  if (!normalized) return "empty";
  if (/we price match|price match/i.test(normalized)) return "price_match_banner";
  const looksCtaOnly =
    /^(?:show prices|voir les tarifs|afficher les tarifs)\b/i.test(normalized) &&
    parseBookingPriceFromText(normalized) == null;
  if (looksCtaOnly) return "cta_only_no_amount";

  const price = parseBookingPriceFromText(normalized);
  if (price == null) return "unparseable_amount";
  if (price <= 20) return "amount_out_of_band";
  if (parseBookingCurrencyFromText(normalized) === null) return "no_currency_in_snippet";
  return null;
}

function isReliableBookingPriceText(text: string): boolean {
  const normalized = normalizeBookingPriceSnippetForReliability(text);
  if (!normalized) return false;
  if (/we price match|price match/i.test(normalized)) return false;
  if (
    /^(?:show prices|voir les tarifs|afficher les tarifs)\s*\.?\s*$/i.test(normalized) &&
    parseBookingPriceFromText(normalized) == null
  ) {
    return false;
  }

  const price = parseBookingPriceFromText(normalized);
  if (price == null || price <= 20) return false;

  return parseBookingCurrencyFromText(normalized) !== null;
}

function findReliableBookingPriceText(candidates: string[]): string {
  return candidates.map(normalizeWhitespace).find(isReliableBookingPriceText) ?? "";
}

function isBookingChallengePage(input: {
  html: string;
  bodyText: string;
  url: string;
}): boolean {
  const text = `${input.url}\n${input.bodyText}\n${input.html.slice(0, 2000)}`;
  const hasChallengeSignal =
    /chal_t=|JavaScript is disabled|verify that you'?re not a robot|not a robot|captcha/i.test(text);
  if (hasChallengeSignal) return true;

  const hasMinimalHotelSignal =
    /data-testid=["'](?:title|price-and-discounted-price|property-most-popular-facilities)|application\/ld\+json|hotel_id|b_hotel_id/i.test(
      input.html
    );

  return !hasMinimalHotelSignal && input.html.length < 12000;
}

async function fetchBookingPriceRecoveryPageData(url: string) {
  const fetchUrl = buildBookingUrlWithDates(url);
  return fetchUnlockedPageData(fetchUrl, {
    platform: "booking",
    preferredTransport: "cdp",
    payloadUrlPattern: /(price|availability|availabilities|room|hotel|property|block)/i,
    maxPayloads: 30,
    afterLoad: async (page) => {
      await page.waitForLoadState?.("domcontentloaded").catch(() => {});
      await page.waitForTimeout(8000).catch(() => {});
      const priceCandidates = await page.evaluate(() => {
        const normalize = (value: string | null | undefined) =>
          (value ?? "").replace(/\s+/g, " ").trim();
        return [
          '[data-testid="price-and-discounted-price"]',
          '[data-testid="price-for-x-nights"]',
          '[data-testid*="price"]',
          '[class*="price"]',
        ]
          .flatMap((selector) =>
            Array.from(document.querySelectorAll(selector))
              .slice(0, 12)
              .map((element) => ({
                selector,
                text: normalize(element.textContent).slice(0, 220),
              }))
          )
          .filter((candidate) => candidate.text);
      });

      return { bookingPriceRecoveryCandidates: priceCandidates };
    },
  });
}

type BookingOccupancyDayState = "available" | "blocked" | "booked" | "unknown";

type BookingOccupancyDaySignal = {
  date: string;
  state: BookingOccupancyDayState;
  reason: string;
  path: string;
  sample: string;
};

type BookingOccupancyCandidate = {
  source: string;
  rawSignals: number;
  availableDays: number;
  blockedDays: number;
  bookedDays: number;
  unknownDays: number;
  observedDays: number;
  sample: BookingOccupancyDaySignal[];
};

function getLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToLocalIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return getLocalIsoDate(date);
}

function normalizeBookingCalendarDate(value: string): string | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;

  const isoMatch = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = normalized.match(/\b(\d{4})\/(\d{2})\/(\d{2})\b/);
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function inferBookingOccupancyStateFromText(text: string): BookingOccupancyDayState | null {
  const normalized = normalizeWhitespace(text).toLowerCase();
  if (!normalized) return null;

  if (
    /booked|reserved|sold out|sold-out|reserve|réservé|reser[vr][ée]|complet/.test(normalized)
  ) {
    return "booked";
  }

  if (
    /not available|unavailable|fully blocked|indisponible|non disponible|ferme|ferm[ée]|blocked|closed|past/.test(
      normalized
    )
  ) {
    return "blocked";
  }

  if (
    /available|bookable|disponible|select|choisir|check-in available|check in available/.test(
      normalized
    )
  ) {
    return "available";
  }

  if (/unknown|n\/a|na/.test(normalized)) {
    return "unknown";
  }

  return null;
}

function parseBookingBooleanSignal(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value !== "string") return null;
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function collectBookingRecordTextSignals(record: Record<string, unknown>): string[] {
  const textKeys = [
    "status",
    "state",
    "availability",
    "bookability",
    "label",
    "ariaLabel",
    "className",
    "text",
    "title",
    "role",
    "tagName",
    "parentClassName",
    "parentAriaLabel",
    "parentText",
    "parentTitle",
    "parentRole",
    "grandParentClassName",
    "grandParentAriaLabel",
    "grandParentText",
    "grandParentTitle",
    "grandParentRole",
    "buttonClassName",
    "buttonAriaLabel",
    "buttonText",
    "buttonTitle",
  ];

  const texts = textKeys
    .map((key) => record[key])
    .filter((value): value is string => typeof value === "string")
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);

  const objectKeys = [
    "dataset",
    "parentDataset",
    "grandParentDataset",
    "buttonDataset",
  ];

  const serializedObjects = objectKeys
    .map((key) => record[key])
    .filter((value): value is Record<string, unknown> => isRecord(value))
    .map((value) => normalizeWhitespace(JSON.stringify(value)))
    .filter(Boolean);

  return texts.concat(serializedObjects);
}

function inferBookingOccupancyAssessmentFromRecord(record: Record<string, unknown>): {
  state: BookingOccupancyDayState | null;
  reason: string | null;
} {
  const availableKeys = ["available", "isAvailable", "bookable", "isBookable"];
  for (const key of availableKeys) {
    if (record[key] === true) return { state: "available", reason: `explicit_${key}` };
  }

  const blockedKeys = [
    "blocked",
    "isBlocked",
    "unavailable",
    "isUnavailable",
    "soldOut",
    "isSoldOut",
    "closed",
    "isClosed",
    "disabled",
    "isDisabled",
  ];
  for (const key of blockedKeys) {
    if (record[key] === true) return { state: "blocked", reason: `explicit_${key}` };
  }

  const ariaDisabled = parseBookingBooleanSignal(record.ariaDisabled);
  const disabled = parseBookingBooleanSignal(record.disabled);
  const parentAriaDisabled = parseBookingBooleanSignal(record.parentAriaDisabled);
  const buttonAriaDisabled = parseBookingBooleanSignal(record.buttonAriaDisabled);
  const closestButtonDisabled = parseBookingBooleanSignal(record.closestButtonDisabled);

  if (
    ariaDisabled === true ||
    disabled === true ||
    parentAriaDisabled === true ||
    buttonAriaDisabled === true ||
    closestButtonDisabled === true
  ) {
    return { state: "blocked", reason: "disabled_signal" };
  }

  const textSignals = collectBookingRecordTextSignals(record);
  for (const signal of textSignals) {
    const inferred = inferBookingOccupancyStateFromText(signal);
    if (inferred === "booked") {
      return { state: "booked", reason: "text_booked_signal" };
    }
    if (inferred === "blocked") {
      return { state: "blocked", reason: "text_blocked_signal" };
    }
  }

  for (const signal of textSignals) {
    const inferred = inferBookingOccupancyStateFromText(signal);
    if (inferred === "available") {
      return { state: "available", reason: "text_available_signal" };
    }
  }

  const hasDateSignal =
    typeof record.dataDate === "string" ||
    typeof record.date === "string" ||
    typeof record.calendarDate === "string";

  if (!hasDateSignal) {
    return { state: null, reason: null };
  }

  const tagName = typeof record.tagName === "string" ? record.tagName.toUpperCase() : "";
  const role = typeof record.role === "string" ? record.role.toLowerCase() : "";
  const parentRole = typeof record.parentRole === "string" ? record.parentRole.toLowerCase() : "";
  const buttonTagName =
    typeof record.buttonTagName === "string" ? record.buttonTagName.toUpperCase() : "";
  const tabIndex =
    typeof record.tabIndex === "number"
      ? record.tabIndex
      : typeof record.tabIndex === "string"
        ? Number.parseInt(record.tabIndex, 10)
        : null;

  const hasSelectableControl =
    tagName === "BUTTON" ||
    buttonTagName === "BUTTON" ||
    role === "button" ||
    role === "gridcell" ||
    role === "checkbox" ||
    parentRole === "button" ||
    parentRole === "gridcell" ||
    closestButtonDisabled === false ||
    disabled === false ||
    ariaDisabled === false ||
    tabIndex === 0;

  if (hasSelectableControl) {
    return {
      state: "unknown",
      reason: "date_cell_selectable_but_no_reliable_availability_signal",
    };
  }

  return { state: "unknown", reason: "date_cell_without_clear_state" };
}

function extractBookingOccupancySignalsFromUnknown(
  value: unknown,
  path: string[] = []
): BookingOccupancyDaySignal[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      extractBookingOccupancySignalsFromUnknown(entry, [...path, String(index)])
    );
  }

  if (!isRecord(value)) {
    return [];
  }

  const dateCandidateKeys = [
    "date",
    "dataDate",
    "calendarDate",
    "day",
    "dayDate",
    "checkin",
    "checkout",
    "localDate",
    "dateString",
  ];
  const date =
    dateCandidateKeys
      .map((key) => {
        const candidate = value[key];
        return typeof candidate === "string" ? normalizeBookingCalendarDate(candidate) : null;
      })
      .find((candidate) => candidate != null) ?? null;
  const assessment = inferBookingOccupancyAssessmentFromRecord(value);
  const state = assessment.state;
  const sample = normalizeWhitespace(JSON.stringify(value).slice(0, 1200));

  const ownSignal =
    date && state
      ? [
          {
            date,
            state,
            reason: assessment.reason ?? "unknown",
            path: path.join("."),
            sample,
          },
        ]
      : [];

  const nestedSignals = Object.entries(value).flatMap(([key, entry]) => {
    if (
      key === "dataset" ||
      key === "parentDataset" ||
      key === "grandParentDataset" ||
      key === "buttonDataset"
    ) {
      return [];
    }

    return extractBookingOccupancySignalsFromUnknown(entry, [...path, key]);
  });

  return ownSignal.concat(nestedSignals);
}

function scoreBookingOccupancyCandidate(candidate: BookingOccupancyCandidate) {
  return candidate.observedDays * 10 + candidate.blockedDays * 3 + candidate.availableDays * 2 + candidate.unknownDays;
}

function summarizeBookingOccupancyCandidate(
  source: string,
  signals: BookingOccupancyDaySignal[],
  windowDays = 60
): BookingOccupancyCandidate {
  const j0 = getLocalIsoDate(new Date());
  const windowEnd = addDaysToLocalIsoDate(j0, windowDays - 1);

  const byDate = new Map<string, BookingOccupancyDaySignal>();
  for (const signal of signals) {
    if (signal.date < j0 || signal.date > windowEnd) continue;

    const existing = byDate.get(signal.date);
    if (!existing) {
      byDate.set(signal.date, signal);
      continue;
    }

    const priority = { booked: 4, blocked: 3, unknown: 2, available: 1 };
    if (priority[signal.state] > priority[existing.state]) {
      byDate.set(signal.date, signal);
    }
  }

  const values = [...byDate.values()];
  const availableDays = values.filter((signal) => signal.state === "available").length;
  const blockedDays = values.filter((signal) => signal.state === "blocked").length;
  const bookedDays = values.filter((signal) => signal.state === "booked").length;
  const unknownDays = values.filter((signal) => signal.state === "unknown").length;

  return {
    source,
    rawSignals: signals.length,
    availableDays,
    blockedDays,
    bookedDays,
    unknownDays,
    observedDays: availableDays + blockedDays + bookedDays,
    sample: values.slice(0, 30),
  };
}

function buildBookingOccupancyObservation(
  input: {
    payloads: Array<{ url: string; bodyText: string }>;
    structuredScriptData: unknown[];
    domCalendarSignals: unknown;
    calendarOpenDebug?: Record<string, unknown> | null;
  }
) {
  const payloadSignals = input.payloads.flatMap((payload, index) => {
    try {
      return extractBookingOccupancySignalsFromUnknown(
        JSON.parse(payload.bodyText),
        [`payload`, String(index)]
      );
    } catch {
      return [];
    }
  });

  const scriptSignals = input.structuredScriptData.flatMap((entry, index) =>
    extractBookingOccupancySignalsFromUnknown(entry, ["script", String(index)])
  );
  const domSignals = extractBookingOccupancySignalsFromUnknown(input.domCalendarSignals, ["dom"]);

  const candidates = [
    summarizeBookingOccupancyCandidate("network_payload_calendar", payloadSignals),
    summarizeBookingOccupancyCandidate("structured_script_calendar", scriptSignals),
    summarizeBookingOccupancyCandidate("dom_calendar", domSignals),
  ];

  const selected =
    candidates
      .filter((candidate) => candidate.rawSignals > 0)
      .sort((a, b) => scoreBookingOccupancyCandidate(b) - scoreBookingOccupancyCandidate(a))[0] ??
    null;

  const inferredStatus =
    selected == null
      ? "unavailable"
      : selected.observedDays === 0
        ? "unavailable"
        : selected.availableDays > 0 &&
            (selected.blockedDays > 0 || selected.bookedDays > 0 || selected.unknownDays > 0)
        ? "partial"
        : (selected.blockedDays > 0 || selected.bookedDays > 0) && selected.availableDays === 0
          ? "blocked"
        : selected.availableDays > 0
            ? "available"
            : selected.unknownDays > 0
              ? "unknown"
              : "unavailable";
  const openedCalendar = Boolean(
    input.calendarOpenDebug &&
      ((typeof input.calendarOpenDebug.dialogCount === "number" &&
        input.calendarOpenDebug.dialogCount > 0) ||
        (typeof input.calendarOpenDebug.gridCellCount === "number" &&
          input.calendarOpenDebug.gridCellCount > 0) ||
        (typeof input.calendarOpenDebug.dateNodeCount === "number" &&
          input.calendarOpenDebug.dateNodeCount > 0))
  );
  const reason =
    selected && selected.observedDays > 0
      ? "observed_calendar_days"
      : selected && selected.unknownDays > 0
        ? "calendar_days_without_reliable_availability_signals"
      : openedCalendar
        ? "calendar_opened_but_no_parseable_days"
        : "no_calendar_source_detected";

  const effectiveSource =
    selected && selected.observedDays === 0 && selected.unknownDays > 0
      ? `${selected.source}_partial`
      : selected?.source ?? null;

  const occupancyObservation =
    selected && selected.observedDays > 0
      ? {
          status: "available" as const,
          rate: Math.round((((selected.blockedDays + selected.bookedDays) / selected.observedDays) * 100) * 10) / 10,
          unavailableDays: selected.blockedDays + selected.bookedDays,
          availableDays: selected.availableDays,
          observedDays: selected.observedDays,
          windowDays: 60,
          source: effectiveSource,
          message: null,
        }
      : {
          status: "unavailable" as const,
          rate: null,
          unavailableDays: 0,
          availableDays: 0,
          observedDays: 0,
          windowDays: 60,
          source: effectiveSource,
          message:
            selected && selected.unknownDays > 0
              ? "Le calendrier public Booking est visible, mais il n'expose pas de signal fiable permettant de distinguer les jours disponibles des jours reserves sur cette page."
              : "Donnees d'occupation non disponibles pour cette annonce",
        };

  debugGuestAuditLog("[guest-audit][occupancy][debug]", {
    platform: "booking",
    source: effectiveSource,
    rawSignals: {
      networkPayloadCalendar: candidates[0].rawSignals,
      structuredScriptCalendar: candidates[1].rawSignals,
      domCalendar: candidates[2].rawSignals,
    },
    observedDays: selected?.observedDays ?? 0,
    availableDays: selected?.availableDays ?? 0,
    blockedDays: selected?.blockedDays ?? 0,
    bookedDays: selected?.bookedDays ?? 0,
    unknownDays: selected?.unknownDays ?? 0,
    inferredStatus,
    sample: selected?.sample ?? [],
  });
  debugGuestAuditLog("[guest-audit][booking][calendar-day-classification-debug]", {
    j0: getLocalIsoDate(new Date()),
    windowEnd: addDaysToLocalIsoDate(getLocalIsoDate(new Date()), 59),
    sample: (selected?.sample ?? []).slice(0, 30).map((item) => {
      let parsedSample: Record<string, unknown> | null = null;
      try {
        parsedSample = JSON.parse(item.sample) as Record<string, unknown>;
      } catch {
        parsedSample = null;
      }
      return {
        date: item.date,
        text: parsedSample?.text ?? null,
        ariaLabel: parsedSample?.ariaLabel ?? null,
        ariaDisabled: parsedSample?.ariaDisabled ?? null,
        disabled: parsedSample?.disabled ?? null,
        className: parsedSample?.className ?? null,
        dataset: parsedSample?.dataset ?? null,
        inferredState: item.state,
        reason: item.reason,
      };
    }),
    counts: {
      available: selected?.availableDays ?? 0,
      blocked: selected?.blockedDays ?? 0,
      booked: selected?.bookedDays ?? 0,
      unknown: selected?.unknownDays ?? 0,
    },
  });
  debugGuestAuditLog("[guest-audit][booking][raw-cell-sample]", {
    sample: (selected?.sample ?? []).slice(0, 30).map((item) => {
      let parsedSample: Record<string, unknown> | null = null;
      try {
        parsedSample = JSON.parse(item.sample) as Record<string, unknown>;
      } catch {
        parsedSample = null;
      }
      return {
        date: item.date,
        text: parsedSample?.text ?? null,
        ariaLabel: parsedSample?.ariaLabel ?? null,
        disabled: parsedSample?.disabled ?? null,
        ariaDisabled: parsedSample?.ariaDisabled ?? null,
        className: parsedSample?.className ?? null,
        role: parsedSample?.role ?? null,
        tabIndex: parsedSample?.tabIndex ?? null,
        dataset: parsedSample?.dataset ?? null,
        parentClassName: parsedSample?.parentClassName ?? null,
        grandParentClassName: parsedSample?.grandParentClassName ?? null,
        inferredState: item.state,
        reason: item.reason,
      };
    }),
  });
  debugGuestAuditLog("[guest-audit][booking][available-day-debug]", {
    sample: (selected?.sample ?? [])
      .filter((item) => item.state === "available")
      .slice(0, 20)
      .map((item) => {
        let parsedSample: Record<string, unknown> | null = null;
        try {
          parsedSample = JSON.parse(item.sample) as Record<string, unknown>;
        } catch {
          parsedSample = null;
        }
        return {
          date: item.date,
          text: parsedSample?.text ?? null,
          ariaLabel: parsedSample?.ariaLabel ?? null,
          ariaDisabled: parsedSample?.ariaDisabled ?? null,
          disabled: parsedSample?.disabled ?? null,
          className: parsedSample?.className ?? null,
          dataset: parsedSample?.dataset ?? null,
          reasonWhyAvailable: item.reason,
        };
      }),
  });
  debugGuestAuditLog("[guest-audit][booking][blocked-booked-day-debug]", {
    sample: (selected?.sample ?? [])
      .filter((item) => item.state === "blocked" || item.state === "booked")
      .slice(0, 20)
      .map((item) => {
        let parsedSample: Record<string, unknown> | null = null;
        try {
          parsedSample = JSON.parse(item.sample) as Record<string, unknown>;
        } catch {
          parsedSample = null;
        }
        return {
          date: item.date,
          text: parsedSample?.text ?? null,
          ariaLabel: parsedSample?.ariaLabel ?? null,
          ariaDisabled: parsedSample?.ariaDisabled ?? null,
          disabled: parsedSample?.disabled ?? null,
          className: parsedSample?.className ?? null,
          dataset: parsedSample?.dataset ?? null,
          inferredState: item.state,
          reasonWhyBlockedOrBooked: item.reason,
        };
      }),
  });
  debugGuestAuditLog("[guest-audit][occupancy][final]", {
    platform: "booking",
    source: effectiveSource,
    status: inferredStatus,
    openedCalendar,
    observedDays: selected?.observedDays ?? 0,
    availableDays: selected?.availableDays ?? 0,
    blockedDays: selected?.blockedDays ?? 0,
    bookedDays: selected?.bookedDays ?? 0,
    unavailableDays:
      (selected?.blockedDays ?? 0) + (selected?.bookedDays ?? 0),
    unknownDays: selected?.unknownDays ?? 0,
    windowDays: 60,
    reason,
    sample: selected?.sample ?? [],
  });

  return occupancyObservation;
}

function parseBookingReviewCountFromText(text: string): number | null {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return null;

  const patterns = [
    /commentaires?\s+clients?\s*\(\s*(\d[\d\s.,]*)\s*\)/i,
    /\brated\s+by\s+(\d[\d\s.,]*)\s+guests?\b/i,
    /\b(\d[\d\s.,]*)\s+guest\s+reviews?\b/i,
    /\b(\d[\d\s.,]*)\s+customer\s+reviews?\b/i,
    /\b(\d[\d\s.,]*)\s+commentaires\b/i,
    /\b(\d[\d\s.,]*)\s+avis\b/i,
    /\b(\d[\d\s.,]*)\s+reviews?\b/i,
    /\b(\d[\d\s.,]*)\s+review\b/i,
    /\b(\d[\d\s.,]*)\s+comentarios?\b/i,
    /\b(\d[\d\s.,]*)\s+reseñas?\b/i,
    /\b(\d[\d\s.,]*)\s+valoraciones?\b/i,
    /\bavis\s*[:(]?\s*(\d[\d\s.,]*)/i,
    /\breviews?\s*[:(]?\s*(\d[\d\s.,]*)/i,
    /\bcommentaires\s*[:(]?\s*(\d[\d\s.,]*)/i,
    /\bbewertung(?:en)?\s*[:(]?\s*(\d[\d\s.,]*)/i,
    /\bopinions?\s*[:(]?\s*(\d[\d\s.,]*)/i,
    /\bopinii\s*[:(]?\s*(\d[\d\s.,]*)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;

    const matchStart = match.index ?? 0;
    const matchEnd = matchStart + (match[0]?.length ?? 0);
    const windowStart = Math.max(0, matchStart - 40);
    const windowEnd = Math.min(normalized.length, matchEnd + 40);
    const windowText = normalized.slice(windowStart, windowEnd).toLowerCase();
    if (
      /\bphotos?\b/.test(windowText) ||
      /\bchambres?\b/.test(windowText) ||
      /\brooms?\b/.test(windowText) ||
      /\bmbps\b/.test(windowText) ||
      /\bwifi\b|\bwi\s*fi\b/.test(windowText) ||
      /[€$]|\beur\b|\busd\b|\bcad\b|\bmad\b/.test(windowText) ||
      /\bm2\b|\bsqm\b|\bsq\s*m\b/.test(windowText) ||
      /\badults?\b|\benfants?\b|\bchildren\b|\bchild\b/.test(windowText) ||
      /\bnuits?\b|\bnights?\b|\bnight\b/.test(windowText) ||
      /\bbathrooms?\b|\bbathroom\b|\bsalles?\s+de\s+bain\b|\bsalle\s+de\s+bain\b/.test(windowText) ||
      /\bbeds?\b|\bbed\b|\blits?\b|\blit\b/.test(windowText)
    ) {
      continue;
    }

    const digitsOnly = match[1].replace(/[^\d]/g, "");
    const value = Number.parseInt(digitsOnly, 10);
    if (Number.isFinite(value) && value > 0 && value <= 10000) return value;
  }

  return null;
}

function parseBookingRatingFromText(text: string): number | null {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return null;

  const labeledPatterns = [
    /(?:puntuaci[oó]n|valoraci[oó]n|score|rated?)\s*:?\s*(\d+(?:[.,]\d+)?)/i,
    /^(\d+(?:[.,]\d+)?)(?:\s|$)/,
  ];

  for (const pattern of labeledPatterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;

    const value = Number.parseFloat(match[1].replace(",", "."));
    if (Number.isFinite(value) && value >= 0 && value <= 10) {
      return value;
    }
  }

  const candidates = normalized.match(/\d+(?:[.,]\d+)?/g) ?? [];

  for (const candidate of candidates) {
    const value = Number.parseFloat(candidate.replace(",", "."));
    if (Number.isFinite(value) && value >= 0 && value <= 10) {
      return value;
    }
  }

  return null;
}

function cleanBookingDescription(raw: string): string {
  if (!raw) return raw;

  let text = raw;

  // supprimer blocs JS type window.utag_data / dataLayer
  text = text.replace(/window\.[\s\S]*?};?/gi, "");
  text = text.replace(/window\.dataLayer[\s\S]*?\];?/gi, "");

  // supprimer lignes contenant beaucoup de symboles techniques
  text = text
    .split("\n")
    .filter((line) => {
      const l = line.trim();
      if (!l) return false;

      // filtre brut anti JS / tracking
      if (
        l.includes("window.") ||
        l.includes("dataLayer") ||
        l.includes("{") ||
        l.includes("}") ||
        l.includes("=")
      ) {
        return false;
      }

      return true;
    })
    .join(" ");

  const startMarkers = [
    /l['’]h[eé]bergement/i,
    /cet appartement/i,
    /cette villa/i,
    /situ[eé]\s+[aà]/i,
    /se situe\s+[aà]/i,
    /dot[eé]\s+de/i,
  ];
  const startIndex = startMarkers
    .map((pattern) => text.search(pattern))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (typeof startIndex === "number" && startIndex >= 0) {
    text = text.slice(startIndex);
  }

  const endMarkers = [
    /les distances indiqu[eé]es/i,
    /ses points forts/i,
    /environs de l['’][eé]tablissement/i,
    /commentaires clients/i,
    /r[eè]gles de la maison/i,
    /mentions l[eé]gales/i,
  ];
  const endIndex = endMarkers
    .map((pattern) => text.search(pattern))
    .filter((index) => index > 0)
    .sort((a, b) => a - b)[0];
  if (typeof endIndex === "number" && endIndex > 0) {
    text = text.slice(0, endIndex);
  }

  // normalisation espaces
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

function stripBookingHostTrailingBadges(value: string): string {
  return value
    .replace(
      /\s*(Superhost|Superh[oô]te|Genius|Travel Sustainable|Preferred Partner|Partenaire pr[ée]f[ée]r[ée])$/iu,
      ""
    )
    .trim();
}

function hasBookingHostContext(text: string): boolean {
  return /hosted by|managed by|property managed by|your host|h[oô]te\s*:|propri[eé]taire\s*:|g[eé]r[eé]\s+par/i.test(
    text
  );
}

function validateBookingHostNameCandidate(value: string): {
  value: string | null;
  reason: string | null;
} {
  const normalized = stripBookingHostTrailingBadges(
    normalizeWhitespace(value).replace(/[.,;:!?]+$/g, "").trim()
  );
  if (!normalized) return { value: null, reason: "empty" };
  if (normalized.length < 3 || normalized.length > 60) {
    return { value: null, reason: "invalid_length" };
  }
  const lower = normalized.toLowerCase();
  if (
    BOOKING_HOST_REJECT_SUBSTRINGS.some((needle) => lower.includes(needle.toLowerCase()))
  ) {
    return { value: null, reason: "contains_forbidden_token" };
  }
  if (/<[^>]+>|<!doctype|<html|https?:\/\/|data-testid|function\s*\(/i.test(normalized)) {
    return { value: null, reason: "looks_like_html_or_url" };
  }
  if (!/^[\p{L}\p{M}'’.\- ]+$/u.test(normalized)) {
    return { value: null, reason: "contains_invalid_characters" };
  }
  if (normalized.split(/\s+/).length > 6) {
    return { value: null, reason: "too_many_words" };
  }
  if (/^(?:the|your)\s+(?:host|property|owner|manager)$/i.test(normalized)) {
    return { value: null, reason: "generic_label" };
  }
  const letters = normalized.match(/\p{L}/gu) ?? [];
  if (letters.length < 2) return { value: null, reason: "not_enough_letters" };
  if (/^[a-z]{1,2}$/i.test(normalized)) {
    return { value: null, reason: "too_short_alpha_token" };
  }
  return { value: normalized, reason: null };
}

function extractBookingHostNameFromVisibleSources(input: {
  $: cheerio.CheerioAPI;
  bodyVisibleText: string;
}): {
  hostName: string | null;
  source: string | null;
  rejected: Array<{ source: string; reason: string; sample: string }>;
} {
  const { $, bodyVisibleText } = input;
  const candidates: Array<{ source: string; text: string }> = [
    ...$(
      '[data-testid*="host"], [data-testid*="managed"], [data-testid*="owner"], [aria-label*="Hosted by" i], [aria-label*="Managed by" i], [aria-label*="Hôte" i]'
    )
      .map((_, el) => ({
        source: "host-locator",
        text: normalizeWhitespace($(el).text() || $(el).attr("aria-label") || ""),
      }))
      .get(),
    {
      source: "body-visible",
      text: normalizeWhitespace(bodyVisibleText),
    },
  ]
    .map((item) => ({ source: item.source, text: normalizeWhitespace(item.text) }))
    .filter((item) => item.text.length > 0)
    .filter((item) => hasBookingHostContext(item.text));

  const rejected: Array<{ source: string; reason: string; sample: string }> = [];
  for (const candidate of candidates) {
    const match =
      candidate.text.match(
        /(?:hosted by|managed by|property managed by|your host|h[oô]te\s*:|propri[eé]taire\s*:|g[eé]r[eé]\s+par)\s*([A-ZÀ-Ý][\p{L}\p{M}'’.\- ]{1,60})/iu
      ) ?? null;
    if (!match?.[1]) {
      rejected.push({
        source: candidate.source,
        reason: "missing_host_regex_match",
        sample: candidate.text.slice(0, 160),
      });
      continue;
    }

    const validation = validateBookingHostNameCandidate(match[1]);
    if (!validation.value) {
      rejected.push({
        source: candidate.source,
        reason: validation.reason ?? "rejected",
        sample: match[1].slice(0, 160),
      });
      continue;
    }

    return { hostName: validation.value, source: candidate.source, rejected };
  }

  return { hostName: null, source: null, rejected };
}

function detectBookingTrustBadgeFromVisibleSources(input: {
  $: cheerio.CheerioAPI;
  bodyVisibleText: string;
}): { trustBadge: string | null; source: string | null } {
  const { $, bodyVisibleText } = input;
  const selectorTexts = uniqueStrings(
    $(
      '[data-testid*="badge"], [data-testid*="genius"], [data-testid*="sustainable"], [data-testid*="preferred"], [aria-label*="Genius" i], [aria-label*="Travel Sustainable" i], [aria-label*="Preferred" i]'
    )
      .map((_, el) => normalizeWhitespace($(el).text() || $(el).attr("aria-label") || ""))
      .get()
      .filter((text) => text.length > 0)
  );

  const bodySignals = BOOKING_TRUST_BADGE_RULES.flatMap((rule) =>
    rule.patterns.some((pattern) => pattern.test(bodyVisibleText))
      ? [{ source: "body-visible", text: bodyVisibleText }]
      : []
  );

  const candidates = [
    ...selectorTexts.map((text) => ({ source: "badge-locator", text })),
    ...bodySignals,
  ];

  for (const candidate of candidates) {
    for (const rule of BOOKING_TRUST_BADGE_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(candidate.text))) {
        return { trustBadge: rule.label, source: candidate.source };
      }
    }
  }

  return { trustBadge: null, source: null };
}

function extractBookingStructuredReviewData(
  context: BookingStructuredPropertyContext | null
): {
  rating: { source: string; value: string; parsed: number | null } | null;
  reviewCount: { source: string; value: string; parsed: number | null } | null;
} {
  if (!context) {
    return { rating: null, reviewCount: null };
  }

  const reviewsEntry = context.property.reviews;
  if (!isRecord(reviewsEntry)) {
    return { rating: null, reviewCount: null };
  }

  const reviewsCountValue =
    typeof reviewsEntry.reviewsCount === "number"
      ? reviewsEntry.reviewsCount
      : typeof reviewsEntry.reviewsCount === "string"
        ? Number.parseInt(reviewsEntry.reviewsCount, 10)
        : null;

  const totalQuestion = Array.isArray(reviewsEntry.questions)
    ? reviewsEntry.questions.find(
        (question) =>
          isRecord(question) &&
          question.name === "total" &&
          (typeof question.score === "number" || typeof question.score === "string")
      )
    : null;

  const totalScoreValue =
    isRecord(totalQuestion) && typeof totalQuestion.score === "number"
      ? totalQuestion.score
      : isRecord(totalQuestion) && typeof totalQuestion.score === "string"
        ? Number.parseFloat(totalQuestion.score.replace(",", "."))
        : null;

  return {
    rating:
      totalScoreValue != null && Number.isFinite(totalScoreValue)
        ? {
            source: "structured_property_reviews",
            value: String(totalScoreValue),
            parsed: totalScoreValue >= 0 && totalScoreValue <= 10 ? totalScoreValue : null,
          }
        : null,
    reviewCount:
      reviewsCountValue != null && Number.isFinite(reviewsCountValue)
        ? {
            source: "structured_property_reviews",
            value: String(reviewsCountValue),
            parsed:
              reviewsCountValue > 0 && reviewsCountValue <= 10000 ? reviewsCountValue : null,
          }
        : null,
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

function parseBookingExternalId(url: string): string | null {
  const match = url.match(/hotel\/[^/]+\/([^./?#]+)/i);
  return match?.[1] ?? null;
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const blocks: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item && typeof item === "object") blocks.push(item as Record<string, unknown>);
        });
      } else if (parsed && typeof parsed === "object") {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // ignore
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

function isGalleryLikeKey(key: string): boolean {
  return /(gallery|photos?|images?)/i.test(key);
}

function extractBookingStructuredGallerySources(
  value: unknown,
  parentKey = ""
): string[][] {
  if (!value) return [];

  if (Array.isArray(value)) {
    const directUrls = value
      .flatMap((item) => extractImageUrlsFromUnknown(item))
      .filter(isLikelyBookingListingPhotoUrl);
    const nested = value.flatMap((item) => extractBookingStructuredGallerySources(item, parentKey));

    if (isGalleryLikeKey(parentKey) && directUrls.length > 0) {
      return [directUrls, ...nested];
    }

    return nested;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sources: string[][] = [];

    for (const [key, entry] of Object.entries(record)) {
      if (isGalleryLikeKey(key)) {
        const candidate = extractImageUrlsFromUnknown(entry).filter(
          isLikelyBookingListingPhotoUrl
        );

        if (candidate.length > 0) {
          sources.push(candidate);
        }
      }

      sources.push(...extractBookingStructuredGallerySources(entry, key));
    }

    return sources;
  }

  return [];
}

function scoreBookingPhotoSource(source: string[]): number {
  const deduped = dedupeBookingListingPhotoUrls(source);

  if (deduped.length === 0) return 0;

  const galleryLikeCount = deduped.filter((photo) => {
    const lower = photo.toLowerCase();
    return lower.includes("/xdata/images/hotel/") || lower.includes("/hotelimages/");
  }).length;

  return deduped.length * 10 + galleryLikeCount;
}

function pickFirstTextCandidate(
  candidates: Array<{ source: string; value: string }>
) {
  return (
    candidates
      .map((candidate) => ({
        source: candidate.source,
        value: normalizeWhitespace(candidate.value),
      }))
      .find((candidate) => candidate.value.length > 0) ?? null
  );
}

function scoreBookingDescriptionCandidate(candidate: { source: string; value: string }) {
  const value = normalizeWhitespace(candidate.value);
  if (!value) return -1;

  const lowerSource = candidate.source.toLowerCase();
  const lowerValue = value.toLowerCase();
  let score = value.length;

  if (
    lowerSource.includes("property_description") ||
    lowerSource.includes("property_description_content")
  ) {
    score += 320;
  }

  if (lowerSource.includes("json_ld_description")) {
    score += 180;
    if (value.length >= 400) score += 60;
  }
  if (lowerSource.includes("meta_description") || lowerSource.includes("og_description")) {
    score -= 120;
  }
  if (lowerSource.includes("body_fallback")) score -= 220;

  if (/[.!?]/.test(value)) score += 80;
  if (value.split(/\s+/).length >= 40) score += 80;
  if (value.split(/\s+/).length >= 80) score += 80;
  if (value.length < 120) score -= 180;

  if (
    lowerValue.includes("great location") ||
    lowerValue.includes("top reasons to stay") ||
    lowerValue.includes("most popular facilities") ||
    lowerValue.includes("availability") ||
    lowerValue.includes("select your room") ||
    lowerValue.includes("you might be eligible") ||
    lowerValue.includes("breakfast available")
  ) {
    score -= 220;
  }

  return score;
}

function pickBestBookingDescriptionCandidate(
  candidates: Array<{ source: string; value: string }>
) {
  return (
    candidates
      .map((candidate) => ({
        source: candidate.source,
        value: normalizeWhitespace(candidate.value),
      }))
      .filter((candidate) => candidate.value.length > 0)
      .sort((a, b) => scoreBookingDescriptionCandidate(b) - scoreBookingDescriptionCandidate(a))[0] ??
    null
  );
}

function extractBookingReviewCountCandidate(input: {
  $: cheerio.CheerioAPI;
  hotelJson: Record<string, unknown> | null;
  bodyVisibleText: string;
}) {
  const { $, hotelJson, bodyVisibleText } = input;

  const structuredValue =
    typeof hotelJson?.aggregateRating === "object" &&
    hotelJson.aggregateRating &&
    typeof (hotelJson.aggregateRating as Record<string, unknown>).reviewCount === "string"
      ? ((hotelJson.aggregateRating as Record<string, unknown>).reviewCount as string)
      : typeof hotelJson?.aggregateRating === "object" &&
          hotelJson.aggregateRating &&
          typeof (hotelJson.aggregateRating as Record<string, unknown>).reviewCount === "number"
        ? String((hotelJson.aggregateRating as Record<string, unknown>).reviewCount)
        : "";

  const rawCandidates = [
    {
      source: "json_ld_aggregate_rating",
      value: structuredValue,
      parsed: parseBookingReviewCountFromText(structuredValue),
    },
    ...$('[data-testid="review-score-component"]')
      .slice(0, 1)
      .map((_, el) => {
        const value = $(el).text();
        return {
          source: "review-score-component",
          value,
          parsed: parseBookingReviewCountFromText(value),
        };
      })
      .get(),
    ...$('[data-testid="review-score-right-component"]')
      .slice(0, 1)
      .map((_, el) => {
        const value = $(el).text();
        return {
          source: "review-score-right-component",
          value,
          parsed: parseBookingReviewCountFromText(value),
        };
      })
      .get(),
    {
      source: "body_visible_review_context",
      value: bodyVisibleText,
      parsed: parseBookingReviewCountFromText(bodyVisibleText),
    },
  ]
    .map((candidate) => ({
      source: candidate.source,
      value: normalizeWhitespace(candidate.value),
      parsed: candidate.parsed,
    }))
    .filter((candidate) => candidate.value.length > 0 && candidate.parsed != null && candidate.parsed > 0);

  const selected =
    rawCandidates.find((candidate) => candidate.source === "json_ld_aggregate_rating") ??
    rawCandidates[0] ??
    null;

  const distinctParsedValues = [...new Set(rawCandidates.map((candidate) => candidate.parsed))];

  return {
    selected,
    ambiguous: distinctParsedValues.length > 1,
  };
}

function pickBestPhotoSource(sources: string[][]): string[] {
  return sources
    .map((source) => dedupeBookingListingPhotoUrls(source.filter(isLikelyBookingListingPhotoUrl)))
    .filter((source) => source.length > 0)
    .sort((a, b) => scoreBookingPhotoSource(b) - scoreBookingPhotoSource(a))[0] ?? [];
}

type BookingStructuredCache = Record<string, unknown>;

type BookingStructuredPropertyContext = {
  cache: BookingStructuredCache;
  propertyKey: string;
  property: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getBookingStructuredPropertyContext(
  blocks: unknown[]
): BookingStructuredPropertyContext | null {
  for (const block of blocks) {
    if (!isRecord(block)) continue;
    if (!isRecord(block.ROOT_QUERY)) continue;

    const cache = block as BookingStructuredCache;
    const rootQuery = cache.ROOT_QUERY as Record<string, unknown>;
    const propertyRef = Object.values(rootQuery)
      .filter(isRecord)
      .find((entry) => typeof entry.__ref === "string" && entry.__ref.startsWith("Property:{"));

    const propertyKey =
      (typeof propertyRef?.__ref === "string" ? propertyRef.__ref : null) ??
      Object.keys(cache).find((key) => key.startsWith("Property:{")) ??
      null;

    if (!propertyKey) continue;

    const property = cache[propertyKey];
    if (!isRecord(property)) continue;

    return {
      cache,
      propertyKey,
      property,
    };
  }

  return null;
}

function resolveBookingStructuredRef(
  cache: BookingStructuredCache,
  value: unknown
): Record<string, unknown> | null {
  if (!isRecord(value) || typeof value.__ref !== "string") return null;
  const resolved = cache[value.__ref];
  return isRecord(resolved) ? resolved : null;
}

function extractBookingPhotoUrlFromStructuredPhoto(photo: Record<string, unknown>): string | null {
  const preferredKeys = [
    'resource({"size":"max1280x900"})',
    'resource({"size":"max1024x768"})',
    'resource({"size":"max500"})',
    'resource({"size":"max300"})',
    'resource({"size":"max200"})',
    "photoUri",
    "thumbnailUri",
  ];

  for (const key of preferredKeys) {
    const value = photo[key];
    if (typeof value === "string" && isLikelyBookingListingPhotoUrl(value)) {
      return value;
    }

    if (isRecord(value) && typeof value.absoluteUrl === "string") {
      if (isLikelyBookingListingPhotoUrl(value.absoluteUrl)) {
        return value.absoluteUrl;
      }
    }
  }

  return null;
}

function extractBookingStructuredGalleryPhotos(
  context: BookingStructuredPropertyContext | null
): string[] {
  if (!context) return [];

  const propertyGalleryEntry = Object.entries(context.property).find(([key]) =>
    key.startsWith("propertyGallery(")
  )?.[1];

  if (!isRecord(propertyGalleryEntry)) return [];

  const mainGalleryRefs = Array.isArray(propertyGalleryEntry.mainGalleryPhotos)
    ? propertyGalleryEntry.mainGalleryPhotos
    : [];
  const roomPhotoGroups = Array.isArray(propertyGalleryEntry.roomPhotos)
    ? propertyGalleryEntry.roomPhotos
    : [];

  const galleryUrls = mainGalleryRefs
    .map((entry) => resolveBookingStructuredRef(context.cache, entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map(extractBookingPhotoUrlFromStructuredPhoto)
    .filter((url): url is string => Boolean(url));

  const roomUrls = roomPhotoGroups.flatMap((group) => {
    if (!isRecord(group) || !Array.isArray(group.photos)) return [];

    return group.photos
      .map((entry) => resolveBookingStructuredRef(context.cache, entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .map(extractBookingPhotoUrlFromStructuredPhoto)
      .filter((url): url is string => Boolean(url));
  });

  return dedupeBookingListingPhotoUrls([...galleryUrls, ...roomUrls]);
}

function shouldKeepBookingStructuredAmenityTitle(title: string): boolean {
  const normalized = normalizeWhitespace(title);
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  if (
    lower.includes("todo el alojamiento es para ti") ||
    lower.includes("entire property") ||
    lower.includes("m²") ||
    lower.includes("tamaño") ||
    lower.includes("size")
  ) {
    return false;
  }

  return normalized.length >= 3 && normalized.length <= 80;
}

function extractBookingAmenityTitlesFromStructuredEntity(
  cache: BookingStructuredCache,
  entity: unknown
): string[] {
  if (!entity) return [];

  if (isRecord(entity)) {
    if (typeof entity.title === "string" && shouldKeepBookingStructuredAmenityTitle(entity.title)) {
      return [normalizeWhitespace(entity.title)];
    }

    const resolved = resolveBookingStructuredRef(cache, entity);
    if (resolved) {
      const directTitle =
        typeof resolved.title === "string" && shouldKeepBookingStructuredAmenityTitle(resolved.title)
          ? [normalizeWhitespace(resolved.title)]
          : [];

      const instanceTitles = Array.isArray(resolved.instances)
        ? resolved.instances
            .map((instance) => resolveBookingStructuredRef(cache, instance))
            .filter((instance): instance is Record<string, unknown> => Boolean(instance))
            .flatMap((instance) =>
              typeof instance.title === "string" &&
              shouldKeepBookingStructuredAmenityTitle(instance.title)
                ? [normalizeWhitespace(instance.title)]
                : []
            )
        : [];

      return uniqueStrings([...directTitle, ...instanceTitles]);
    }
  }

  return [];
}

function extractBookingStructuredAmenities(
  context: BookingStructuredPropertyContext | null
): string[] {
  if (!context) return [];

  const amenityKeys = Object.keys(context.property).filter(
    (key) =>
      key.startsWith("highlights(") ||
      key.startsWith("accommodationHighlights(") ||
      key.startsWith("commonAmenities(") ||
      key.startsWith("facilities(")
  );

  const amenities = amenityKeys.flatMap((key) => {
    const entry = context.property[key];

    if (Array.isArray(entry)) {
      return entry.flatMap((item) => {
        if (isRecord(item) && Array.isArray(item.entities)) {
          return item.entities.flatMap((entity) =>
            extractBookingAmenityTitlesFromStructuredEntity(context.cache, entity)
          );
        }

        return extractBookingAmenityTitlesFromStructuredEntity(context.cache, item);
      });
    }

    if (isRecord(entry) && Array.isArray(entry.entities)) {
      return entry.entities.flatMap((entity) =>
        extractBookingAmenityTitlesFromStructuredEntity(context.cache, entity)
      );
    }

    return [];
  });

  return uniqueStrings(amenities).slice(0, 60);
}

export async function extractBooking(
  url: string,
  options?: ExtractListingOptions
): Promise<ExtractorResult> {
  const bookingTimingT0 = Date.now();
  const logBookingTiming = (phase: string, extra?: Record<string, unknown>) => {
    console.info("[booking][timing]", {
      phase,
      ms: Date.now() - bookingTimingT0,
      url: url.slice(0, 96),
      ...extra,
    });
  };

  const inputHadStayDates = bookingUrlHasStayDates(url);
  const listingFetchUrl = buildBookingUrlWithDates(url);
  console.info("[booking][stay-dates]", {
    inputHadStayDates,
    fetchHasStayDates: bookingUrlHasStayDates(listingFetchUrl),
    fetchUrlPreview: listingFetchUrl.slice(0, 220),
  });
  // Dates = meilleure probabilité de prix, pas une garantie (challenge, dispo vide, DOM incomplet).
  const pageData = await fetchUnlockedPageData(listingFetchUrl, {
    platform: "booking",
    preferredTransport: "cdp",
    payloadUrlPattern:
      /(calendar|availability|availabilities|checkin|checkout|dates|stay|room|property|hotel|listing|review|facility|amenity|photo|gallery|location)/i,
    maxPayloads: 80,
    afterLoad: async (page) => {
      const attempts: Array<Record<string, unknown>> = [];
      const clickedSelectors: string[] = [];
      let successfulAttempt: number | null = null;

      const collectCalendarState = async () =>
        page.evaluate(() => {
          const normalizeText = (value: string | null | undefined) =>
            (value ?? "").replace(/\s+/g, " ").trim();
          const looksLikeCalendarText = (value: string) =>
            /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miercoles|jueves|viernes|sabado|domingo|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|available|unavailable|booked|not available|disponible|indisponible|complet|fecha|date d[' ]arrivee|date de depart|check[- ]?in|check[- ]?out)\b/i.test(
              value
            );
          const isVisible = (element: Element) => {
            const htmlElement = element as HTMLElement;
            const style = window.getComputedStyle(htmlElement);
            const rect = htmlElement.getBoundingClientRect();
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0
            );
          };

          const dialogSelectors = [
            '[role="dialog"]',
            '[data-testid*="calendar"]',
            '[data-testid*="datepicker"]',
            '[data-testid*="searchbox-datepicker"]',
            '[class*="datepicker"]',
            '[class*="calendar"]',
          ].join(",");

          const dialogs = Array.from(document.querySelectorAll(dialogSelectors))
            .filter(isVisible)
            .slice(0, 20)
            .map((element) => ({
              text: normalizeText(element.textContent).slice(0, 260),
              dataTestid: element.getAttribute("data-testid"),
              ariaLabel: element.getAttribute("aria-label"),
              className: element.getAttribute("class")?.slice(0, 160) ?? null,
            }));

          const visibleMonthLabels = Array.from(
            document.querySelectorAll(
              [
                '[data-testid*="month"]',
                '[data-testid*="calendar"] h3',
                '[data-testid*="calendar"] h4',
                '[data-testid*="datepicker"] h3',
                '[data-testid*="datepicker"] h4',
                '[role="dialog"] h3',
                '[role="dialog"] h4',
              ].join(",")
            )
          )
            .filter(isVisible)
            .map((element) => normalizeText(element.textContent))
            .filter((text) =>
              /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/i.test(
                text
              )
            )
            .slice(0, 12);

          const dateNodes = Array.from(
            document.querySelectorAll(
              [
                '[data-date]',
                '[role="gridcell"]',
                '[role="gridcell"][aria-label]',
                'button[data-date]',
                '[aria-label*="available" i]',
                '[aria-label*="unavailable" i]',
                '[aria-label*="booked" i]',
                '[aria-label*="not available" i]',
                '[aria-label*="disponible" i]',
                '[aria-label*="indisponible" i]',
              ].join(",")
            )
          )
            .filter(isVisible)
            .map((element) => {
              const text = normalizeText(element.textContent).slice(0, 120);
              const dataDate = element.getAttribute("data-date");
              const ariaLabel = element.getAttribute("aria-label");
              const parent = element.parentElement;
              const grandParent = parent?.parentElement ?? null;
              const closestButton = element.closest("button");
              const getDataset = (node: Element | null) =>
                node ? { ...(node as HTMLElement).dataset } : null;
              return {
                text,
                dataDate,
                ariaLabel,
                ariaDisabled: element.getAttribute("aria-disabled"),
                disabled:
                  element instanceof HTMLButtonElement
                    ? element.disabled
                    : element.getAttribute("disabled") != null,
                className: element.getAttribute("class")?.slice(0, 160) ?? null,
                tagName: element.tagName,
                role: element.getAttribute("role"),
                title: element.getAttribute("title"),
                tabIndex:
                  element instanceof HTMLElement ? element.tabIndex : null,
                dataset: getDataset(element),
                parentClassName: parent?.getAttribute("class")?.slice(0, 160) ?? null,
                parentAriaLabel: parent?.getAttribute("aria-label") ?? null,
                parentAriaDisabled: parent?.getAttribute("aria-disabled") ?? null,
                parentText: normalizeText(parent?.textContent).slice(0, 120),
                parentTitle: parent?.getAttribute("title") ?? null,
                parentRole: parent?.getAttribute("role") ?? null,
                parentDataset: getDataset(parent),
                grandParentClassName:
                  grandParent?.getAttribute("class")?.slice(0, 160) ?? null,
                grandParentAriaLabel: grandParent?.getAttribute("aria-label") ?? null,
                grandParentText: normalizeText(grandParent?.textContent).slice(0, 120),
                grandParentTitle: grandParent?.getAttribute("title") ?? null,
                grandParentRole: grandParent?.getAttribute("role") ?? null,
                grandParentDataset: getDataset(grandParent),
                buttonTagName: closestButton?.tagName ?? null,
                buttonClassName:
                  closestButton?.getAttribute("class")?.slice(0, 160) ?? null,
                buttonAriaLabel: closestButton?.getAttribute("aria-label") ?? null,
                buttonAriaDisabled: closestButton?.getAttribute("aria-disabled") ?? null,
                buttonText: normalizeText(closestButton?.textContent).slice(0, 120),
                buttonTitle: closestButton?.getAttribute("title") ?? null,
                buttonDataset: getDataset(closestButton),
                closestButtonDisabled: closestButton?.disabled ?? null,
                id: element.getAttribute("id"),
              };
            })
            .filter((node) => {
              if (node.dataDate) return true;
              if (node.ariaLabel && looksLikeCalendarText(node.ariaLabel)) return true;
              if (node.text && looksLikeCalendarText(node.text)) return true;
              return false;
            })
            .slice(0, 200)
            ;

          const gridCellCount = dateNodes.filter(
            (node) => node.dataDate || node.ariaLabel || node.text
          ).length;

          return {
            dialogCount: dialogs.length,
            dialogTestids: dialogs
              .map((dialog) => dialog.dataTestid)
              .filter((value): value is string => Boolean(value)),
            visibleMonthLabels,
            gridCellCount,
            dateNodeCount: dateNodes.length,
            dateNodes,
            sampleDateNodes: dateNodes.slice(0, 12),
          };
        });
      const mergeCalendarDateNodes = (
        nodes: Array<Record<string, unknown>>
      ): Array<Record<string, unknown>> => {
        const byDate = new Map<string, Record<string, unknown>>();

        const getPriority = (node: Record<string, unknown>) => {
          const text = normalizeWhitespace(String(node.text ?? ""));
          const ariaLabel = normalizeWhitespace(String(node.ariaLabel ?? ""));
          const className = normalizeWhitespace(String(node.className ?? ""));
          const combined = `${text} ${ariaLabel} ${className}`.toLowerCase();
          if (/booked|reserved|sold out|sold-out|réservé|reserve|complet/.test(combined)) return 4;
          if (
            node.ariaDisabled === "true" ||
            node.disabled === true ||
            /unavailable|disabled|blocked|closed|past|indisponible|non disponible|ferme/.test(
              combined
            )
          ) {
            return 3;
          }
          if (/unknown|indeterm/.test(combined)) return 2;
          return 1;
        };

        for (const node of nodes) {
          const date = typeof node.dataDate === "string" ? node.dataDate : null;
          if (!date) continue;
          const existing = byDate.get(date);
          if (!existing || getPriority(node) > getPriority(existing)) {
            byDate.set(date, node);
          }
        }

        return [...byDate.values()].sort((a, b) =>
          String(a.dataDate ?? "").localeCompare(String(b.dataDate ?? ""))
        );
      };
      const isSuccessfulCalendarState = (state: {
        dialogCount: number;
        dialogTestids: string[];
        gridCellCount: number;
        dateNodeCount: number;
      }) =>
        state.dialogTestids.includes("searchbox-datepicker-calendar") ||
        (state.dialogCount > 0 && state.gridCellCount >= 14) ||
        state.dateNodeCount >= 14;

      const calendarTriggers = [
        '[data-testid="date-display-field-start"]',
        '[data-testid="date-display-field-end"]',
        '[data-testid="searchbox-dates-container"]',
        '[data-testid*="date-display-field"]',
        '[data-testid*="date"]',
        '[data-testid*="calendar"]',
        '[aria-label*="check-in" i]',
        '[aria-label*="check out" i]',
        '[aria-label*="check-out" i]',
        '[aria-label*="dates" i]',
        '[aria-label*="calend" i]',
      ];

      let successfulCalendarState:
        | {
            dialogCount: number;
            dialogTestids: string[];
            visibleMonthLabels: string[];
            gridCellCount: number;
            dateNodeCount: number;
            dateNodes: unknown[];
            sampleDateNodes: unknown[];
          }
        | null = null;
      const successfulStates: Array<{
        dialogCount: number;
        dialogTestids: string[];
        visibleMonthLabels: string[];
        gridCellCount: number;
        dateNodeCount: number;
        dateNodes: unknown[];
        sampleDateNodes: unknown[];
      }> = [];
      const payloadUrlsAfterOpen = new Set<string>();
      const payloadUrlsAfterMonthNav = new Set<string>();
      const calendarResponsePattern =
        /(calendar|availability|availabilities|checkin|checkout|dates|stay|searchbox-datepicker|datepicker)/i;
      let calendarPhase: "before_open" | "after_open" | "after_month_nav" = "before_open";
      const responseListener = (response: { url: () => string }) => {
        const responseUrl = response.url();
        if (!calendarResponsePattern.test(responseUrl)) return;
        if (calendarPhase === "after_open") payloadUrlsAfterOpen.add(responseUrl);
        if (calendarPhase === "after_month_nav") payloadUrlsAfterMonthNav.add(responseUrl);
      };
      page.on("response", responseListener);

      for (let cycle = 1; cycle <= 3; cycle += 1) {
        await page.waitForTimeout(450).catch(() => {});

        for (const selector of calendarTriggers) {
          const locator = page.locator(selector).first();
          const count = await locator.count().catch(() => 0);
          if (count <= 0) {
            attempts.push({ cycle, selector, found: false });
            continue;
          }

          const urlBefore = page.url();
          const text = await locator.textContent().catch(() => null);
          const ariaLabel = await locator.getAttribute("aria-label").catch(() => null);
          const interactions: string[] = [];

          await locator.waitFor({ state: "visible", timeout: 1500 }).catch(() => {});
          await locator.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(250).catch(() => {});
          await locator.focus().then(() => interactions.push("focus")).catch(() => {});

          let state = await collectCalendarState();
          if (!isSuccessfulCalendarState(state)) {
            await locator.click({ timeout: 1800 }).then(() => interactions.push("click")).catch(() => {});
            await page.waitForTimeout(700).catch(() => {});
            state = await collectCalendarState();
          }
          if (!isSuccessfulCalendarState(state)) {
            await locator.focus().then(() => interactions.push("refocus")).catch(() => {});
            await page.keyboard.press("Enter").then(() => interactions.push("enter")).catch(() => {});
            await page.waitForTimeout(700).catch(() => {});
            state = await collectCalendarState();
          }
          if (!isSuccessfulCalendarState(state)) {
            await locator.focus().then(() => interactions.push("refocus-space")).catch(() => {});
            await page.keyboard.press("Space").then(() => interactions.push("space")).catch(() => {});
            await page.waitForTimeout(700).catch(() => {});
            state = await collectCalendarState();
          }
          if (!isSuccessfulCalendarState(state)) {
            await locator
              .click({ timeout: 1800, force: true })
              .then(() => interactions.push("force-click"))
              .catch(() => {});
            await page.waitForTimeout(900).catch(() => {});
            state = await collectCalendarState();
          }

          const urlAfter = page.url();
          const navigationChanged = urlAfter !== urlBefore;
          const chromeError = urlAfter.startsWith("chrome-error://chromewebdata/");

          attempts.push({
            cycle,
            selector,
            found: true,
            text: normalizeWhitespace(text ?? "").slice(0, 120),
            ariaLabel,
            interactions,
            urlBefore,
            urlAfter,
            navigationChanged,
            chromeError,
            result: state,
          });

          if (navigationChanged && chromeError) {
            await page.waitForTimeout(600).catch(() => {});
            continue;
          }

          if (isSuccessfulCalendarState(state)) {
            clickedSelectors.push(selector);
            successfulAttempt = attempts.length;
            successfulCalendarState = state;
            successfulStates.push(state);
            calendarPhase = "after_open";
            break;
          }
        }

        if (successfulCalendarState) break;
      }

      const finalCalendarState = successfulCalendarState ?? (await collectCalendarState());
      if (successfulCalendarState) {
        const nextMonthSelectors = [
          'button[aria-label*="next" i]',
          'button[aria-label*="suivant" i]',
          'button[aria-label*="siguiente" i]',
          'button[aria-label*="volgende" i]',
          'button[aria-label*="weiter" i]',
        ];

        for (let monthStep = 0; monthStep < 2; monthStep += 1) {
          calendarPhase = "after_month_nav";
          let advanced = false;
          for (const selector of nextMonthSelectors) {
            const locator = page.locator(selector).first();
            const count = await locator.count().catch(() => 0);
            if (count <= 0) continue;
            await locator.scrollIntoViewIfNeeded().catch(() => {});
            const clicked = await locator
              .click({ timeout: 1500 })
              .then(() => true)
              .catch(() => false);
            if (!clicked) continue;
            await page.waitForTimeout(700).catch(() => {});
            const nextState = await collectCalendarState();
            if (isSuccessfulCalendarState(nextState)) {
              successfulStates.push(nextState);
              advanced = true;
            }
            break;
          }
          if (!advanced) break;
        }
      }
      const openedCalendar = isSuccessfulCalendarState(finalCalendarState);
      const finalReason = openedCalendar
        ? "opened_dom_calendar"
        : "no_stable_calendar_open";
      const mergedDateNodes = mergeCalendarDateNodes(
        successfulStates.flatMap((state) =>
          Array.isArray(state.dateNodes)
            ? (state.dateNodes as Array<Record<string, unknown>>)
            : []
        )
      );

      return await page.evaluate((calendarState) => {
        const isVisible = (element: Element) => {
          const htmlElement = element as HTMLElement;
          const style = window.getComputedStyle(htmlElement);
          const rect = htmlElement.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0
          );
        };

        const nodes = Array.from(
          document.querySelectorAll(
            [
              '[data-date]',
              '[aria-label*="available" i]',
              '[aria-label*="unavailable" i]',
              '[aria-label*="booked" i]',
              '[aria-label*="disponible" i]',
              '[aria-label*="indisponible" i]',
              '[role="gridcell"][aria-label]',
              'button[aria-label]',
            ].join(",")
          )
        )
          .filter(isVisible)
          .slice(0, 500)
          .map((element) => ({
            text: (element.textContent ?? "").trim(),
            dataDate: element.getAttribute("data-date"),
            ariaLabel: element.getAttribute("aria-label"),
            ariaDisabled: element.getAttribute("aria-disabled"),
            disabled:
              element instanceof HTMLButtonElement
                ? element.disabled
                : element.getAttribute("disabled") != null,
            className: element.getAttribute("class"),
            tagName: element.tagName,
            role: element.getAttribute("role"),
            title: element.getAttribute("title"),
            tabIndex:
              element instanceof HTMLElement ? element.tabIndex : null,
            dataset: { ...(element as HTMLElement).dataset },
            parentClassName: element.parentElement?.getAttribute("class") ?? null,
            parentAriaLabel: element.parentElement?.getAttribute("aria-label") ?? null,
            parentAriaDisabled:
              element.parentElement?.getAttribute("aria-disabled") ?? null,
            parentText: (element.parentElement?.textContent ?? "").trim(),
            parentTitle: element.parentElement?.getAttribute("title") ?? null,
            parentRole: element.parentElement?.getAttribute("role") ?? null,
            parentDataset: element.parentElement
              ? { ...(element.parentElement as HTMLElement).dataset }
              : null,
            grandParentClassName:
              element.parentElement?.parentElement?.getAttribute("class") ?? null,
            grandParentAriaLabel:
              element.parentElement?.parentElement?.getAttribute("aria-label") ?? null,
            grandParentText:
              (element.parentElement?.parentElement?.textContent ?? "").trim(),
            grandParentTitle:
              element.parentElement?.parentElement?.getAttribute("title") ?? null,
            grandParentRole:
              element.parentElement?.parentElement?.getAttribute("role") ?? null,
            grandParentDataset: element.parentElement?.parentElement
              ? {
                  ...(element.parentElement.parentElement as HTMLElement).dataset,
                }
              : null,
            buttonTagName: element.closest("button")?.tagName ?? null,
            buttonClassName: element.closest("button")?.getAttribute("class") ?? null,
            buttonAriaLabel:
              element.closest("button")?.getAttribute("aria-label") ?? null,
            buttonAriaDisabled:
              element.closest("button")?.getAttribute("aria-disabled") ?? null,
            buttonText: (element.closest("button")?.textContent ?? "").trim(),
            buttonTitle: element.closest("button")?.getAttribute("title") ?? null,
            buttonDataset: element.closest("button")
              ? { ...(element.closest("button") as HTMLElement).dataset }
              : null,
            closestButtonDisabled:
              element.closest("button") instanceof HTMLButtonElement
                ? (element.closest("button") as HTMLButtonElement).disabled
                : null,
          }));

        return {
          bookingCalendarNodes:
            Array.isArray(calendarState.dateNodes) && calendarState.dateNodes.length > 0
              ? calendarState.dateNodes
              : nodes,
          bookingCalendarOpenDebug: calendarState,
        };
      }, {
        attempts,
        clickedSelectors,
        successfulAttempt,
        openedCalendar,
        openedDialog: finalCalendarState.dialogCount > 0,
        dialogCount: finalCalendarState.dialogCount,
        dialogTestids: finalCalendarState.dialogTestids,
        gridCellCount: finalCalendarState.gridCellCount,
        dateNodeCount: finalCalendarState.dateNodeCount,
        finalSource: openedCalendar ? "dom_calendar" : null,
        navigationChanged: attempts.some(
          (attempt) =>
            typeof attempt.navigationChanged === "boolean" && attempt.navigationChanged
        ),
        finalReason,
        monthsVisited: Array.from(
          new Set(
            successfulStates.flatMap((state) =>
              Array.isArray(state.visibleMonthLabels) ? state.visibleMonthLabels : []
            )
          )
        ),
        payloadUrlsAfterOpen: Array.from(payloadUrlsAfterOpen),
        payloadUrlsAfterMonthNav: Array.from(payloadUrlsAfterMonthNav),
        dateNodes: mergedDateNodes,
        sampleDateNodes: finalCalendarState.sampleDateNodes,
      });
    },
  });
  logBookingTiming("main_unlocked_fetch_done", {
    htmlLength: pageData.html?.length ?? 0,
    payloadCount: pageData.payloads.length,
    competitorLight: Boolean(options?.skipBookingPriceRecovery),
  });
  const html = pageData.html;
  const $ = cheerio.load(html);
  const bodyText = normalizeWhitespace($("body").text());
  const bodyVisibleText = normalizeWhitespace(
    $("body")
      .clone()
      .find("script, style, noscript, template")
      .remove()
      .end()
      .text()
  );
  const bookingChallengeDetected = isBookingChallengePage({
    html,
    bodyText: bodyVisibleText || bodyText,
    url: listingFetchUrl,
  });

  if (bookingChallengeDetected) {
    console.warn("[booking][challenge-detected]", {
      url: listingFetchUrl,
      htmlLength: html.length,
      snippet: (bodyVisibleText || bodyText).slice(0, 180),
    });
  }
  const jsonLdBlocks = extractJsonLd(html);
  const structuredScriptData = extractStructuredScriptData(html);
  const structuredPropertyContext =
    getBookingStructuredPropertyContext(structuredScriptData);
  const bookingCalendarOpenDebug =
    pageData.data?.bookingCalendarOpenDebug &&
    typeof pageData.data.bookingCalendarOpenDebug === "object"
      ? (pageData.data.bookingCalendarOpenDebug as Record<string, unknown>)
      : null;
  const calendarNetworkUrls = pageData.payloads.map((payload) => payload.url);

  debugGuestAuditLog("[guest-audit][booking][calendar-stability-debug]", {
    ...(bookingCalendarOpenDebug ?? {}),
    networkUrls: calendarNetworkUrls,
  });

  const hotelJson =
    jsonLdBlocks.find(
      (item) =>
        item["@type"] === "Hotel" ||
        item["@type"] === "LodgingBusiness" ||
        item["@type"] === "Apartment"
    ) ?? null;

  const selectedTitleCandidate =
    pickFirstTextCandidate([
      {
        source: "og:title",
        value: $('meta[property="og:title"]').attr("content") || "",
      },
      {
        source: "twitter:title",
        value: $('meta[name="twitter:title"]').attr("content") || "",
      },
      {
        source: "h1",
        value: $("h1").first().text(),
      },
      {
        source: "document_title",
        value: $("title").text(),
      },
      {
        source: "json_ld_name",
        value: typeof hotelJson?.name === "string" ? hotelJson.name : "",
      },
    ]) ?? { source: "fallback_default", value: "Untitled Booking listing" };

  const descriptionCandidates = [
    {
      source: "property_description",
      value: $('[data-testid="property-description"]').text(),
    },
    {
      source: "property_description_content",
      value: $('[id*="property_description_content"]').text(),
    },
    {
      source: "json_ld_description",
      value: typeof hotelJson?.description === "string" ? hotelJson.description : "",
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
      value: cleanBookingDescription(bodyVisibleText).slice(0, 2500),
    },
  ];

  const selectedDescriptionCandidate =
    pickBestBookingDescriptionCandidate(descriptionCandidates) ?? {
      source: "body_fallback",
      value: cleanBookingDescription(bodyVisibleText).slice(0, 2500),
    };

  const title = selectedTitleCandidate.value;
  const description = selectedDescriptionCandidate.value;

  const jsonLdPhotos = jsonLdBlocks.flatMap((block) => extractImageUrlsFromUnknown(block));
  const structuredGallerySources = structuredScriptData.flatMap((block) =>
    extractBookingStructuredGallerySources(block)
  );
  const galleryDomPhotos = [
    ...$('[data-testid*="gallery"] img, [data-testid*="photo"] img, [aria-label*="photo"] img')
      .map((_, el) => $(el).attr("src") || $(el).attr("data-src") || "")
      .get(),
    ...$('a[href*="xdata/images/hotel"], img[src*="xdata/images/hotel"]')
      .map((_, el) => $(el).attr("href") || $(el).attr("src") || "")
      .get(),
  ];
  const metaPhotos = uniqueStrings([
    ...$('meta[property="og:image"]').map((_, el) => $(el).attr("content") || "").get(),
    ...$('meta[name="twitter:image"]').map((_, el) => $(el).attr("content") || "").get(),
  ]);

  const structuredPhotos = pickBestPhotoSource(structuredGallerySources);
  const structuredPropertyGalleryPhotos =
    extractBookingStructuredGalleryPhotos(structuredPropertyContext);
  const jsonLdPhotoSet = dedupeBookingListingPhotoUrls(
    jsonLdPhotos.filter(isLikelyBookingListingPhotoUrl)
  );
  const domPhotoSet = dedupeBookingListingPhotoUrls(
    galleryDomPhotos.filter(isLikelyBookingListingPhotoUrl)
  );
  const metaPhotoSet = dedupeBookingListingPhotoUrls(
    metaPhotos.filter(isLikelyBookingListingPhotoUrl)
  );

  const photos =
    (structuredPropertyGalleryPhotos.length >= 8
      ? structuredPropertyGalleryPhotos
      : structuredPhotos.length >= 8
      ? structuredPhotos
      : jsonLdPhotoSet.length >= 8
        ? jsonLdPhotoSet
        : domPhotoSet.length >= 8
          ? domPhotoSet
          : pickBestPhotoSource([
              structuredPropertyGalleryPhotos,
              structuredPhotos,
              jsonLdPhotoSet,
              domPhotoSet,
              metaPhotoSet,
            ])
    )
      .filter((photo, index, source) => {
        const assetKey = getBookingImageAssetKey(photo);
        return Boolean(assetKey) && source.findIndex((item) => getBookingImageAssetKey(item) === assetKey) === index;
      })
      .slice(0, 80);
  const photoSource =
    structuredPropertyGalleryPhotos.length >= 8
      ? "structured_property_gallery"
      : structuredPhotos.length >= 8
      ? "structured_gallery"
      : jsonLdPhotoSet.length >= 8
        ? "json_ld"
        : domPhotoSet.length >= 8
          ? "dom_gallery"
          : metaPhotoSet.length > 0
            ? "meta_images"
            : null;
  const photoTotalHints = {
    structuredPropertyGalleryCount: structuredPropertyGalleryPhotos.length,
    structuredSources: structuredGallerySources.length,
    structuredBestCount: structuredPhotos.length,
    jsonLdCount: jsonLdPhotoSet.length,
    domCount: domPhotoSet.length,
    metaCount: metaPhotoSet.length,
  };

  const structuredAmenities =
    extractBookingStructuredAmenities(structuredPropertyContext);
  const popularFacilitiesAmenities = $('[data-testid="property-most-popular-facilities"] *')
    .map((_, el) => $(el).text())
    .get();
  const propertyFacilitiesAmenities = $('[data-testid="property-facilities"] *')
    .map((_, el) => $(el).text())
    .get();
  const scannedAmenities = $("li, span, div")
    .map((_, el) => $(el).text())
    .get()
    .filter((text) => {
      const value = text.toLowerCase();
      return (
        value.length >= 3 &&
        value.length <= 80 &&
        [
          "wifi",
          "parking",
          "air conditioning",
          "kitchen",
          "breakfast",
          "pool",
          "balcony",
          "family rooms",
          "non-smoking",
          "washing machine",
          "private bathroom",
          "terrace",
          "garden",
          "elevator",
          "coffee machine",
          "tv",
          "heating",
          "dryer",
          "hair dryer",
          "iron",
        ].some((keyword) => value.includes(keyword))
      );
    });
  const amenities = uniqueStrings([
    ...structuredAmenities,
    ...popularFacilitiesAmenities,
    ...propertyFacilitiesAmenities,
    ...scannedAmenities,
  ]).slice(0, 60);
  const amenitiesSource =
    structuredAmenities.length > 0
      ? "structured_property_highlights"
      : popularFacilitiesAmenities.length > 0
      ? "property_most_popular_facilities"
      : propertyFacilitiesAmenities.length > 0
        ? "property_facilities"
        : scannedAmenities.length > 0
          ? "dom_keyword_scan"
          : null;
  const domSignals = {
    hasGallery:
      structuredPropertyGalleryPhotos.length > 0 ||
      structuredGallerySources.length > 0 ||
      galleryDomPhotos.length > 0 ||
      $('[data-testid*="gallery"], [data-testid*="photo"], [aria-label*="photo"]').length > 0,
    hasAmenities:
      structuredAmenities.length > 0 ||
      popularFacilitiesAmenities.length > 0 ||
      propertyFacilitiesAmenities.length > 0 ||
      $('[data-testid="property-most-popular-facilities"], [data-testid="property-facilities"]').length > 0,
    hasStructuredData: structuredScriptData.length > 0 || jsonLdBlocks.length > 0,
  };

  bookingPipelineLog("[booking][amenities][summary]", {
    count: amenities.length,
    source: amenitiesSource,
    structuredCount: structuredAmenities.length,
    popularCount: popularFacilitiesAmenities.length,
    facilitiesCount: propertyFacilitiesAmenities.length,
    scannedCount: scannedAmenities.length,
  });

  const initialPriceCandidateTexts = [
    !bookingChallengeDetected
      ? $('[data-testid="price-and-discounted-price"]').first().text()
      : "",
    !bookingChallengeDetected ? $('[data-testid="price-for-x-nights"]').first().text() : "",
    !bookingChallengeDetected && typeof hotelJson?.priceRange === "string"
      ? hotelJson.priceRange
      : "",
  ].map(normalizeWhitespace);
  const initialPriceLabels = [
    "dom_price_and_discounted",
    "dom_price_for_x_nights",
    "json_ld_priceRange",
  ];
  initialPriceCandidateTexts.forEach((raw, i) => {
    const reason = getBookingPriceRejectReason(raw);
    bookingPipelineLog("[booking][price][candidate]", {
      stage: "initial",
      label: initialPriceLabels[i] ?? `idx_${i}`,
      preview: raw.slice(0, 160),
      len: raw.length,
      rejectReason: reason,
      accepted: reason === null,
    });
  });
  const initialPriceText = findReliableBookingPriceText(initialPriceCandidateTexts);
  let priceText = initialPriceText;

  const shouldAttemptPriceRecovery =
    !initialPriceText &&
    !bookingChallengeDetected &&
    !options?.skipBookingPriceRecovery &&
    bookingUrlHasStayDates(listingFetchUrl);

  if (shouldAttemptPriceRecovery) {
    console.warn("[booking][price-recovery-triggered]", {
      url,
      reason: "missing_price",
      initialPriceCandidateTexts,
    });
    const recoveryT0 = Date.now();

    const recoveryPageData = await fetchBookingPriceRecoveryPageData(url);
    logBookingTiming("price_recovery_fetch_done", { msRecovery: Date.now() - recoveryT0 });
    const recoveryBodyText = normalizeWhitespace(cheerio.load(recoveryPageData.html)("body").text());
    const recoveryStillChallenged = isBookingChallengePage({
      html: recoveryPageData.html,
      bodyText: recoveryBodyText,
      url,
    });

    if (recoveryStillChallenged) {
      console.warn("[booking][challenge-detected]", {
        url,
        htmlLength: recoveryPageData.html.length,
        recovery: true,
        snippet: recoveryBodyText.slice(0, 180),
      });
    } else {
      const priceSourceRoot = cheerio.load(recoveryPageData.html);
      const candidates = recoveryPageData.data?.bookingPriceRecoveryCandidates;
      const priceRecoveryCandidates = Array.isArray(candidates)
        ? candidates.filter(
            (candidate): candidate is { selector?: string; text?: string } =>
              typeof candidate === "object" && candidate !== null
          )
        : [];
      const recoveryPriceCandidateTexts = [
        ...priceRecoveryCandidates.map((candidate) => candidate.text ?? ""),
        priceSourceRoot('[data-testid="price-and-discounted-price"]').first().text(),
        priceSourceRoot('[data-testid="price-for-x-nights"]').first().text(),
      ].map(normalizeWhitespace);
      recoveryPriceCandidateTexts.forEach((raw, i) => {
        const reason = getBookingPriceRejectReason(raw);
        const rec = i < priceRecoveryCandidates.length ? priceRecoveryCandidates[i] : null;
        bookingPipelineLog("[booking][price][candidate]", {
          stage: "recovery",
          label:
            rec?.selector != null
              ? `recovery_${String(rec.selector)}`
              : i >= recoveryPriceCandidateTexts.length - 2
                ? "recovery_dom_price_testid"
                : `recovery_idx_${i}`,
          preview: raw.slice(0, 160),
          len: raw.length,
          rejectReason: reason,
          accepted: reason === null,
        });
      });
      priceText = findReliableBookingPriceText(recoveryPriceCandidateTexts);
      if (priceText) {
        console.warn("[booking][price-recovery-candidate-selected]", {
          url,
          priceText,
          parsedPrice: parseBookingPriceFromText(priceText),
          currency: parseBookingCurrencyFromText(priceText),
        });
      }
    }
  } else if (!initialPriceText) {
    const skipReason = bookingChallengeDetected
      ? "challenge_page_no_recovery"
      : options?.skipBookingPriceRecovery
        ? "competitor_light_extraction"
        : !bookingUrlHasStayDates(listingFetchUrl)
          ? "no_valid_stay_dates_on_fetch_url"
          : "unknown";
    console.info("[booking][price-recovery-skipped]", {
      url: listingFetchUrl,
      reason: skipReason,
      hadInitialPrice: Boolean(initialPriceText),
    });
  }
  const price = parseBookingPriceFromText(priceText) ?? null;
  const currency = price !== null ? parseBookingCurrencyFromText(priceText) : null;
  if (price != null) {
    bookingPipelineLog("[booking][price][accepted]", {
      path: initialPriceText ? "initial" : "recovery",
      preview: (priceText ?? "").slice(0, 200),
      price,
      currency,
    });
  } else {
    bookingPipelineLog("[booking][price][rejected]", {
      path: initialPriceText ? "initial" : "recovery_or_empty",
      preview: (priceText ?? "").slice(0, 200),
      reason: priceText ? getBookingPriceRejectReason(priceText) : "no_candidate_text",
    });
  }

  const reviewScoreComponentText = $('[data-testid="review-score-component"]').first().text();
  const reviewScoreRightComponentText = $('[data-testid="review-score-right-component"]').first().text();
  const structuredReviewData =
    extractBookingStructuredReviewData(structuredPropertyContext);
  const jsonLdRatingValue =
    typeof hotelJson?.aggregateRating === "object" &&
    hotelJson.aggregateRating &&
    typeof (hotelJson.aggregateRating as Record<string, unknown>).ratingValue === "string"
      ? ((hotelJson.aggregateRating as Record<string, unknown>).ratingValue as string)
      : typeof hotelJson?.aggregateRating === "object" &&
          hotelJson.aggregateRating &&
          typeof (hotelJson.aggregateRating as Record<string, unknown>).ratingValue === "number"
        ? String((hotelJson.aggregateRating as Record<string, unknown>).ratingValue)
      : "";
  const ratingCandidates = [
    {
      source: "review-score-component",
      value: normalizeWhitespace(reviewScoreComponentText),
      parsed: parseBookingRatingFromText(reviewScoreComponentText),
    },
    {
      source: "review-score-right-component",
      value: normalizeWhitespace(reviewScoreRightComponentText),
      parsed: parseBookingRatingFromText(reviewScoreRightComponentText),
    },
    {
      source: structuredReviewData.rating?.source ?? "structured_property_reviews",
      value: normalizeWhitespace(structuredReviewData.rating?.value ?? ""),
      parsed: structuredReviewData.rating?.parsed ?? null,
    },
    {
      source: "json_ld_aggregate_rating",
      value: normalizeWhitespace(jsonLdRatingValue),
      parsed: parseBookingRatingFromText(jsonLdRatingValue),
    },
    ...$('[data-testid*="review-score"], [aria-label*="Scored" i], [aria-label*="Rated" i]')
      .slice(0, 4)
      .map((_, el) => {
        const value = normalizeWhitespace($(el).text() || $(el).attr("aria-label") || "");
        return {
          source: "review-score-visible",
          value,
          parsed: parseBookingRatingFromText(value),
        };
      })
      .get(),
    ...(() => {
      const ratingContextMatch =
        bodyVisibleText.match(
          /(?:puntuaci[oó]n|valoraci[oó]n|score|rated?|review score)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i
        ) ?? null;
      if (!ratingContextMatch) return [];
      const value = normalizeWhitespace(ratingContextMatch[0]);
      return [
        {
          source: "body_visible_rating_context",
          value,
          parsed: parseBookingRatingFromText(value),
        },
      ];
    })(),
  ].filter((candidate) => candidate.value.length > 0 && candidate.parsed != null);

  const reviewCountCandidate = extractBookingReviewCountCandidate({
    $,
    hotelJson,
    bodyVisibleText,
  });
  const selectedReviewCountCandidate =
    structuredReviewData.reviewCount?.parsed != null
      ? structuredReviewData.reviewCount
      : reviewCountCandidate.selected;
  const selectedReviewCountSource = selectedReviewCountCandidate?.source ?? null;
  const selectedReviewCountRawValue = selectedReviewCountCandidate?.value ?? "";
  const reviewCount = selectedReviewCountCandidate?.parsed ?? null;

  const jsonLdRatingCandidate =
    ratingCandidates.find((candidate) => candidate.source === "json_ld_aggregate_rating") ?? null;
  const preferredRatingCandidate = ratingCandidates[0] ?? null;
  const useJsonLdForReviewPair =
    selectedReviewCountSource === "json_ld_aggregate_rating" && jsonLdRatingCandidate != null;
  const structuredRatingCandidate =
    ratingCandidates.find((candidate) => candidate.source === "structured_property_reviews") ??
    null;
  const useStructuredForReviewPair =
    selectedReviewCountSource === "structured_property_reviews" &&
    structuredRatingCandidate != null;
  const selectedRatingCandidate = useJsonLdForReviewPair
    ? jsonLdRatingCandidate
    : useStructuredForReviewPair
      ? structuredRatingCandidate
      : preferredRatingCandidate;
  const selectedRatingSource = selectedRatingCandidate?.source ?? null;
  const selectedRatingRawValue = selectedRatingCandidate?.value ?? "";
  const rating = selectedRatingCandidate?.parsed ?? null;
  const hostExtraction = extractBookingHostNameFromVisibleSources({
    $,
    bodyVisibleText,
  });
  const hostName = hostExtraction.hostName;
  const trustBadgeDetection = detectBookingTrustBadgeFromVisibleSources({
    $,
    bodyVisibleText,
  });
  const trustBadge = trustBadgeDetection.trustBadge;
  const badges = trustBadge ? [trustBadge] : [];
  const highlights = trustBadge ? [trustBadge] : [];

  const capacity =
    findFirstMatchNumber(bodyText, [
      /sleeps\s+(\d+)/i,
      /(\d+)\s+guests?/i,
      /(\d+)\s+voyageurs?/i,
      /max(?:imum)?\s+(\d+)/i,
    ]) ?? null;

  const bedrooms =
    findFirstMatchNumber(bodyText, [
      /(\d+)\s+bedrooms?/i,
      /(\d+)\s+chambres?/i,
      /(\d+)\s+bedroom apartment/i,
    ]) ?? null;

  const bathrooms =
    findFirstMatchNumber(bodyText, [
      /(\d+(?:\.\d+)?)\s+bathrooms?/i,
      /(\d+(?:\.\d+)?)\s+salles? de bain/i,
    ]) ?? (bodyText.toLowerCase().includes("private bathroom") ? 1 : null);

  const locationLabel =
    $('meta[property="og:title"]').attr("content") ||
    $('[data-testid="breadcrumb"]').text() ||
    (typeof hotelJson?.address === "object" &&
    hotelJson.address &&
    typeof (hotelJson.address as Record<string, unknown>).addressLocality === "string"
      ? ((hotelJson.address as Record<string, unknown>).addressLocality as string)
      : "") ||
    null;

  const propertyType =
    bodyText.match(
      /\b(apartment|flat|villa|house|studio|loft|riad|condo|guesthouse|hotel|aparthotel)\b/i
    )?.[1] ||
    (typeof hotelJson?.["@type"] === "string" ? (hotelJson["@type"] as string) : null);

  let latitude: number | null = null;
  let longitude: number | null = null;

  if (
    typeof hotelJson?.geo === "object" &&
    hotelJson.geo &&
    typeof (hotelJson.geo as Record<string, unknown>).latitude === "number" &&
    typeof (hotelJson.geo as Record<string, unknown>).longitude === "number"
  ) {
    latitude = (hotelJson.geo as Record<string, unknown>).latitude as number;
    longitude = (hotelJson.geo as Record<string, unknown>).longitude as number;
  }

  const normalizedTitle = normalizeWhitespace(title);
  const normalizedDescription = normalizeWhitespace(description);
  bookingPipelineLog("[booking][description][selected]", {
    source: selectedDescriptionCandidate.source,
    length: normalizedDescription.length,
    preview: normalizedDescription.slice(0, 120),
  });
  const normalizedLocation = locationLabel ? normalizeWhitespace(locationLabel) : null;
  const normalizedPropertyType = propertyType ? normalizeWhitespace(propertyType) : null;
  const occupancyObservation = buildBookingOccupancyObservation({
    payloads: pageData.payloads,
    structuredScriptData,
    domCalendarSignals: pageData.data?.bookingCalendarNodes ?? null,
    calendarOpenDebug: bookingCalendarOpenDebug,
  });
  const truthProbeSourceCandidates = [
    "dom_calendar_cells",
    "dom_calendar_wrappers",
    "payloads_after_open",
    "payloads_after_month_nav",
    "structured_scripts",
  ];
  const truthProbeNodes = Array.isArray(pageData.data?.bookingCalendarNodes)
    ? (pageData.data?.bookingCalendarNodes as Array<Record<string, unknown>>)
    : [];
  const j0 = getLocalIsoDate(new Date());
  const windowEnd = addDaysToLocalIsoDate(j0, 59);
  const truthProbeWindowNodes = truthProbeNodes.filter((node) => {
    const date = typeof node.dataDate === "string" ? node.dataDate : null;
    return Boolean(date && date >= j0 && date <= windowEnd);
  });
  const truthProbeAssessments = truthProbeWindowNodes.map((node) => {
    const assessment = inferBookingOccupancyAssessmentFromRecord(node);
    return { node, assessment };
  });
  const truthProbeBlockedFound = truthProbeAssessments.some(
    ({ assessment }) => assessment.state === "blocked"
  );
  const truthProbeBookedFound = truthProbeAssessments.some(
    ({ assessment }) => assessment.state === "booked"
  );

  debugGuestAuditLog("[guest-audit][booking][calendar-truth-probe]", {
    openedCalendar:
      bookingCalendarOpenDebug?.finalSource === "dom_calendar" ||
      (typeof bookingCalendarOpenDebug?.dialogCount === "number" &&
        bookingCalendarOpenDebug.dialogCount > 0),
    monthsVisited: bookingCalendarOpenDebug?.monthsVisited ?? [],
    visibleMonthLabels: bookingCalendarOpenDebug?.monthsVisited ?? [],
    payloadUrlsAfterOpen: bookingCalendarOpenDebug?.payloadUrlsAfterOpen ?? [],
    payloadUrlsAfterMonthNav: bookingCalendarOpenDebug?.payloadUrlsAfterMonthNav ?? [],
    calendarDomNodesCount: truthProbeNodes.length,
    trueBlockedSignalsFound: truthProbeBlockedFound ? "yes" : "no",
    trueBookedSignalsFound: truthProbeBookedFound ? "yes" : "no",
    sourceCandidatesExamined: truthProbeSourceCandidates,
  });
  const warnings = [
    selectedDescriptionCandidate.source === "meta_description" ||
    selectedDescriptionCandidate.source === "og_description" ||
    selectedDescriptionCandidate.source === "body_fallback"
      ? "description_partial"
      : null,
    descriptionCandidates.filter(
      (candidate) => normalizeWhitespace(candidate.value).length >= 120
    ).length > 1
      ? "description_multiple_sources"
      : null,
    photos.length === 0 ? "photos_not_found" : null,
    reviewCountCandidate.ambiguous ? "review_count_ambiguous" : null,
    bookingChallengeDetected ? "booking_challenge_detected" : null,
  ].filter((warning): warning is string => Boolean(warning));

  bookingPipelineLog("[booking][extract][final]", {
    price,
    currency,
    descriptionLen: normalizedDescription.length,
    amenitiesCount: amenities.length,
    locationLabel: normalizedLocation,
    propertyType: normalizedPropertyType,
  });

  debugGuestAuditLog("[guest-audit][booking][browser-debug]", {
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
      count: photos.length,
      totalHints: photoTotalHints,
    },
    review: {
      rating: {
        source: selectedRatingSource,
        value: selectedRatingRawValue,
      },
      reviewCount: {
        source: selectedReviewCountSource,
        value: selectedReviewCountRawValue,
      },
    },
    trust: {
      hostName: {
        source: hostExtraction.source,
        value: hostName,
        rejectedSamples: hostExtraction.rejected.slice(0, 8),
      },
      trustBadge: {
        source: trustBadgeDetection.source,
        value: trustBadge,
      },
    },
    amenities: {
      source: amenitiesSource,
      count: amenities.length,
      preview: amenities.slice(0, 10),
    },
    domSignals,
  });

  logBookingTiming("extract_total", {
    challenge: bookingChallengeDetected,
    priced: price != null,
    titleSource: selectedTitleCandidate.source,
    inputHadStayDates,
    fetchHadStayDates: bookingUrlHasStayDates(listingFetchUrl),
    skippedPriceRecovery: !initialPriceText && !shouldAttemptPriceRecovery,
  });

  return {
    url,
    sourceUrl: url,
    platform: "booking",
    externalId: parseBookingExternalId(url),
    title: normalizedTitle,
    titleMeta: buildFieldMeta({
      source: selectedTitleCandidate.source,
      value: normalizedTitle,
      quality: inferTitleQuality(normalizedTitle),
    }),
    description: normalizedDescription,
    descriptionMeta: buildFieldMeta({
      source: selectedDescriptionCandidate.source,
      value: normalizedDescription,
      quality: inferDescriptionQuality(normalizedDescription),
    }),
    amenities,
    highlights,
    badges,
    trustBadge,
    hostInfo: hostName,
    hostName,
    photos,
    photosCount: photos.length,
    photoMeta: buildPhotoMeta({
      source: photoSource,
      photos,
    }),
    structure: {
      capacity,
      bedrooms,
      bedCount: null,
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
    bathrooms,
    locationLabel: normalizedLocation,
    propertyType: normalizedPropertyType,
    rating,
    ratingValue: rating,
    ratingScale: 10,
    reviewCount,
    occupancyObservation,
    extractionMeta: {
      extractor: "booking",
      extractedAt: new Date().toISOString(),
      warnings,
    },
  };
}

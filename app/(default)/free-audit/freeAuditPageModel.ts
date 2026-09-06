import type {
  FreeAuditMarketOverviewInput,
  FreeAuditPricingPreviewPlatform,
  FreeAuditPricingPreviewPropertyType,
} from "@/lib/freeAudit/publicPricingPreviewContract";

const SUPPORTED_PROTOCOLS = new Set(["https:", "http:"]);

export const FREE_AUDIT_ALLOWED_PAYLOAD_KEYS = Object.freeze([
  "listingUrl",
  "country",
  "city",
  "platform",
  "propertyType",
] as const);

export const FREE_AUDIT_HANDOFF_ALLOWED_KEYS = Object.freeze([
  "listingUrl",
  "platform",
  "country",
  "city",
  "propertyType",
  "origin",
  "createdAt",
] as const);

export const FREE_AUDIT_PLATFORM_OPTIONS = Object.freeze([
  "airbnb",
  "booking",
  "expedia",
  "agoda",
  "vrbo",
] as const satisfies readonly FreeAuditPricingPreviewPlatform[]);

export const FREE_AUDIT_PROPERTY_TYPE_OPTIONS = Object.freeze([
  "studio",
  "apartment",
  "villa",
  "riad",
  "room",
  "hotel",
] as const satisfies readonly FreeAuditPricingPreviewPropertyType[]);

export type FreeAuditFormField =
  | "listingUrl"
  | "country"
  | "city"
  | "platform"
  | "propertyType";

export type FreeAuditFormErrorCode =
  | "listing_url_invalid"
  | "country_required"
  | "city_required"
  | "platform_required"
  | "property_type_required";

export type FreeAuditPreviewErrorStatus =
  | "invalid_request"
  | "rate_limited"
  | "unavailable"
  | "network_error"
  | "unknown_error";

export type FreeAuditDeltaDirection =
  | "above_median"
  | "below_median"
  | "at_median";

export type FreeAuditFormValues = Readonly<{
  listingUrl: string;
  country: string;
  city: string;
  platform: "" | FreeAuditPricingPreviewPlatform;
  propertyType: "" | FreeAuditPricingPreviewPropertyType;
}>;

export type FreeAuditListingPreviewInput = FreeAuditMarketOverviewInput & Readonly<{
  listingUrl: string;
}>;

export type FreeAuditFormValidationResult =
  | {
      ok: true;
      payload: FreeAuditListingPreviewInput;
      normalizedListingUrl: string;
      detectedPlatform: FreeAuditPricingPreviewPlatform;
    }
  | {
      ok: false;
      errors: Partial<Record<FreeAuditFormField, FreeAuditFormErrorCode>>;
      normalizedListingUrl: string | null;
      detectedPlatform: FreeAuditPricingPreviewPlatform | null;
    };

export type FreeAuditHandoffDraftInput = Readonly<{
  listingUrl: string;
  platform: FreeAuditPricingPreviewPlatform;
  country: string;
  city: string;
  propertyType: FreeAuditPricingPreviewPropertyType;
  origin: "free_audit";
  createdAt: string;
}>;

function ensureUrlProtocol(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^(?:www\.)?[a-z0-9-]+\.[a-z.]{2,}(?:\/|$)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function parseListingUrl(value: string): URL | null {
  const withProtocol = ensureUrlProtocol(value);
  if (!withProtocol) {
    return null;
  }

  try {
    const parsed = new URL(withProtocol);
    if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeListingUrl(value: string): string | null {
  const parsed = parseListingUrl(value);
  if (parsed == null) {
    return null;
  }

  parsed.hash = "";
  return parsed.toString();
}

export function detectSupportedPlatformFromListingUrl(
  value: string,
): FreeAuditPricingPreviewPlatform | null {
  const parsed = parseListingUrl(value);
  if (parsed == null) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const pathname = parsed.pathname.toLowerCase();

  if (/^(.+\.)?airbnb\.[a-z.]+$/i.test(hostname) && pathname.includes("/rooms/")) {
    return "airbnb";
  }

  if (/^(.+\.)?booking\.[a-z.]+$/i.test(hostname) && pathname.startsWith("/hotel/")) {
    return "booking";
  }

  if (/^(.+\.)?expedia\.[a-z.]+$/i.test(hostname) && pathname.length > 1) {
    return "expedia";
  }

  if (/^(.+\.)?agoda\.[a-z.]+$/i.test(hostname) && pathname.length > 1) {
    return "agoda";
  }

  if (
    /^(?:.+\.)?(?:vrbo|homeaway|abritel)\.[a-z.]+$/i.test(hostname) &&
    pathname.length > 1
  ) {
    return "vrbo";
  }

  return null;
}

function normalizeTextField(value: string): string {
  return value.trim();
}

export function validateFreeAuditForm(
  values: FreeAuditFormValues,
): FreeAuditFormValidationResult {
  const errors: Partial<Record<FreeAuditFormField, FreeAuditFormErrorCode>> = {};
  const normalizedListingUrl = normalizeListingUrl(values.listingUrl);
  const detectedPlatform = detectSupportedPlatformFromListingUrl(values.listingUrl);

  if (normalizedListingUrl == null || detectedPlatform == null) {
    errors.listingUrl = "listing_url_invalid";
  }

  const country = normalizeTextField(values.country);
  if (!country) {
    errors.country = "country_required";
  }

  const city = normalizeTextField(values.city);
  if (!city) {
    errors.city = "city_required";
  }

  const platform =
    FREE_AUDIT_PLATFORM_OPTIONS.find((candidate) => candidate === values.platform) ??
    detectedPlatform;
  if (platform == null) {
    errors.platform = "platform_required";
  }

  if (platform != null && detectedPlatform != null && platform !== detectedPlatform) {
    errors.listingUrl = "listing_url_invalid";
  }

  const propertyType = FREE_AUDIT_PROPERTY_TYPE_OPTIONS.find(
    (candidate) => candidate === values.propertyType,
  );
  if (propertyType == null) {
    errors.propertyType = "property_type_required";
  }

  if (
    Object.keys(errors).length > 0 ||
    normalizedListingUrl == null ||
    detectedPlatform == null ||
    platform == null ||
    propertyType == null
  ) {
    return {
      ok: false,
      errors,
      normalizedListingUrl,
      detectedPlatform,
    };
  }

  return {
    ok: true,
    payload: Object.freeze({
      listingUrl: normalizedListingUrl,
      country,
      city,
      platform,
      propertyType,
    }),
    normalizedListingUrl,
    detectedPlatform,
  };
}

export function buildFreeAuditHandoffDraftInput(
  validation: Extract<FreeAuditFormValidationResult, { ok: true }>,
): FreeAuditHandoffDraftInput {
  return Object.freeze({
    listingUrl: validation.normalizedListingUrl,
    platform: validation.payload.platform,
    country: validation.payload.country,
    city: validation.payload.city,
    propertyType: validation.payload.propertyType,
    origin: "free_audit",
    createdAt: new Date().toISOString(),
  });
}

export function getDeltaDirection(
  value: number,
): FreeAuditDeltaDirection {
  if (value > 0) {
    return "above_median";
  }
  if (value < 0) {
    return "below_median";
  }
  return "at_median";
}

export function formatPercentValue(value: number): string {
  const absolute = Math.abs(value);
  if (!Number.isFinite(absolute)) {
    return "0";
  }

  const rounded = Math.round(absolute * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatCurrencyValue(
  locale: string,
  currency: string,
  value: number,
): string {
  const maximumFractionDigits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export function mapPreviewErrorStatus(
  value: string | null | undefined,
): FreeAuditPreviewErrorStatus {
  switch (value) {
    case "invalid_request":
      return "invalid_request";
    case "rate_limited":
      return "rate_limited";
    case "unavailable":
      return "unavailable";
    default:
      return "unknown_error";
  }
}

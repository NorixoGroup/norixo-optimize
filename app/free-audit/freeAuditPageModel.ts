import type {
  FreeAuditPricingPreviewConfidenceLevel,
  FreeAuditPricingPreviewInput,
  FreeAuditPricingPreviewPlatform,
  FreeAuditPricingPreviewPositioningBand,
  FreeAuditPricingPreviewPropertyType,
  FreeAuditPricingPreviewSampleBand,
} from "@/lib/freeAudit/publicPricingPreviewContract";

const SUPPORTED_PROTOCOLS = new Set(["https:", "http:"]);

export const FREE_AUDIT_ALLOWED_PAYLOAD_KEYS = Object.freeze([
  "country",
  "city",
  "platform",
  "propertyType",
  "guestCapacity",
  "declaredNightlyPrice",
  "currency",
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

export const FREE_AUDIT_CURRENCY_OPTIONS = Object.freeze([
  "EUR",
  "USD",
  "GBP",
  "MAD",
  "AED",
  "CAD",
  "CHF",
] as const);

export const FREE_AUDIT_CAPACITY_OPTIONS = Object.freeze([
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
] as const);

export type FreeAuditFormField =
  | "listingUrl"
  | "country"
  | "city"
  | "platform"
  | "propertyType"
  | "guestCapacity"
  | "declaredNightlyPrice"
  | "currency";

export type FreeAuditFormErrorCode =
  | "listing_url_invalid"
  | "country_required"
  | "city_required"
  | "platform_required"
  | "property_type_required"
  | "guest_capacity_required"
  | "declared_price_invalid"
  | "currency_required";

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
  guestCapacity: string;
  declaredNightlyPrice: string;
  currency: string;
}>;

export type FreeAuditFormValidationResult =
  | {
      ok: true;
      payload: FreeAuditPricingPreviewInput;
      normalizedListingUrl: string | null;
      detectedPlatform: FreeAuditPricingPreviewPlatform | null;
    }
  | {
      ok: false;
      errors: Partial<Record<FreeAuditFormField, FreeAuditFormErrorCode>>;
      normalizedListingUrl: string | null;
      detectedPlatform: FreeAuditPricingPreviewPlatform | null;
    };

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

function parseGuestCapacity(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return parsed >= 10 ? 10 : parsed;
}

function parseDeclaredNightlyPrice(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

export function validateFreeAuditForm(
  values: FreeAuditFormValues,
): FreeAuditFormValidationResult {
  const errors: Partial<Record<FreeAuditFormField, FreeAuditFormErrorCode>> = {};
  const normalizedListingUrl = values.listingUrl.trim()
    ? normalizeListingUrl(values.listingUrl)
    : null;
  const detectedPlatform = values.listingUrl.trim()
    ? detectSupportedPlatformFromListingUrl(values.listingUrl)
    : null;

  if (values.listingUrl.trim() && (normalizedListingUrl == null || detectedPlatform == null)) {
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

  const propertyType = FREE_AUDIT_PROPERTY_TYPE_OPTIONS.find(
    (candidate) => candidate === values.propertyType,
  );
  if (propertyType == null) {
    errors.propertyType = "property_type_required";
  }

  const guestCapacity = parseGuestCapacity(values.guestCapacity);
  if (guestCapacity == null) {
    errors.guestCapacity = "guest_capacity_required";
  }

  const declaredNightlyPrice = parseDeclaredNightlyPrice(values.declaredNightlyPrice);
  if (declaredNightlyPrice == null) {
    errors.declaredNightlyPrice = "declared_price_invalid";
  }

  const currency = normalizeCurrency(values.currency);
  if (!FREE_AUDIT_CURRENCY_OPTIONS.some((candidate) => candidate === currency)) {
    errors.currency = "currency_required";
  }

  if (
    Object.keys(errors).length > 0 ||
    platform == null ||
    propertyType == null ||
    guestCapacity == null ||
    declaredNightlyPrice == null
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
      country,
      city,
      platform,
      propertyType,
      guestCapacity,
      declaredNightlyPrice,
      currency,
    }),
    normalizedListingUrl,
    detectedPlatform,
  };
}

export function getPositioningLabelKey(
  value: FreeAuditPricingPreviewPositioningBand,
): FreeAuditPricingPreviewPositioningBand {
  return value;
}

export function getConfidenceLevelLabelKey(
  value: FreeAuditPricingPreviewConfidenceLevel,
): FreeAuditPricingPreviewConfidenceLevel {
  return value;
}

export function getSampleBandLabelKey(
  value: FreeAuditPricingPreviewSampleBand,
): FreeAuditPricingPreviewSampleBand {
  return value;
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

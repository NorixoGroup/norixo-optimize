"use client";

import { parsePropertyTypeOverride } from "@/lib/listings/propertyTypeOverrideOptions";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import { supabase } from "@/lib/supabase";

export const GUEST_AUDIT_DRAFT_KEY = "lco_guest_audit_draft";
export const GUEST_AUDIT_DRAFTS_KEY = "lco_guest_audit_drafts";
export const GUEST_AUDIT_TOKEN_KEY = "lco_guest_audit_token";
const GUEST_AUDIT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const GUEST_AUDIT_DRAFT_CONTRACT_VERSION = "v1";

const GUEST_AUDIT_ALLOWED_PLATFORMS = new Set([
  "airbnb",
  "booking",
  "vrbo",
  "agoda",
  "expedia",
  "other",
] as const);

type GuestAuditDraftStatus = "pending" | "processing" | "completed" | "failed";
type GuestAuditPaymentStatus = "unpaid" | "paid";
type GuestAuditDraftOrigin = "guest_audit" | "free_audit";

export type GuestAuditDraft = {
  draft_contract_version?: typeof GUEST_AUDIT_DRAFT_CONTRACT_VERSION;
  origin?: GuestAuditDraftOrigin;
  id?: string;
  guest_token?: string;
  listing_url: string;
  /** Saisie utilisateur (audit public) — transmis au workspace si recréation manuelle. */
  property_type_override?: string;
  country?: string;
  city?: string;
  guest_capacity?: number;
  declared_nightly_price?: number;
  currency?: string;
  title?: string;
  platform?: string;
  selected_offer?: string;
  persisted_audit_id?: string;
  generated_at: string;
  created_at?: string;
  updated_at?: string;
  status?: GuestAuditDraftStatus;
  payment_status?: GuestAuditPaymentStatus;
  preview_payload?: unknown;
  full_payload?: unknown;
  result: {
    score?: number;
    insights?: string[];
    recommendations?: string[];
    raw_payload?: unknown;
  };
};

export type FreeAuditGuestDraftInput = Readonly<{
  listingUrl: string | null;
  platform: "airbnb" | "booking" | "expedia" | "agoda" | "vrbo";
  country: string;
  city: string;
  propertyType: "studio" | "apartment" | "villa" | "riad" | "room" | "hotel";
  guestCapacity: number;
  declaredNightlyPrice: number;
  currency: string;
  createdAt?: string;
}>;

export type GuestAuditDraftAuditNewPrefill = Readonly<{
  origin: "free_audit";
  listingUrl: string | null;
  platform: string | null;
  country: string | null;
  city: string | null;
  propertyTypeOverride: string | null;
  guestCapacity: number | null;
  declaredNightlyPrice: number | null;
  currency: string | null;
}>;

function normalizeDraftUrl(listingUrl: string) {
  return normalizeSourceUrl(listingUrl) ?? listingUrl.trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeOptionalString(value: unknown, maxLength = 240): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function sanitizeOptionalTimestamp(value: unknown): string | undefined {
  const candidate = sanitizeOptionalString(value, 80);
  if (!candidate) {
    return undefined;
  }

  return Number.isNaN(new Date(candidate).getTime()) ? undefined : candidate;
}

function sanitizeOptionalStatus(value: unknown): GuestAuditDraftStatus | undefined {
  switch (value) {
    case "pending":
    case "processing":
    case "completed":
    case "failed":
      return value;
    default:
      return undefined;
  }
}

function sanitizeOptionalPaymentStatus(value: unknown): GuestAuditPaymentStatus | undefined {
  switch (value) {
    case "unpaid":
    case "paid":
      return value;
    default:
      return undefined;
  }
}

function sanitizeOptionalOrigin(value: unknown): GuestAuditDraftOrigin | undefined {
  switch (value) {
    case "guest_audit":
    case "free_audit":
      return value;
    default:
      return undefined;
  }
}

function sanitizeOptionalPlatform(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return GUEST_AUDIT_ALLOWED_PLATFORMS.has(
    normalized as (typeof GUEST_AUDIT_ALLOWED_PLATFORMS extends Set<infer T> ? T : never)
  )
    ? normalized
    : undefined;
}

function sanitizeOptionalCurrency(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : undefined;
}

function sanitizeOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const rounded = Math.trunc(value);
  return rounded > 0 ? rounded : undefined;
}

function sanitizeOptionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function sanitizeGuestAuditResult(value: unknown): GuestAuditDraft["result"] {
  if (!isPlainObject(value)) {
    return {};
  }

  const result: GuestAuditDraft["result"] = {};

  if (typeof value.score === "number" && Number.isFinite(value.score)) {
    result.score = value.score;
  }

  if (Array.isArray(value.insights) && value.insights.every((entry) => typeof entry === "string")) {
    result.insights = value.insights;
  }

  if (
    Array.isArray(value.recommendations) &&
    value.recommendations.every((entry) => typeof entry === "string")
  ) {
    result.recommendations = value.recommendations;
  }

  if ("raw_payload" in value) {
    result.raw_payload = value.raw_payload;
  }

  return result;
}

function sanitizeGuestAuditDraft(value: unknown): GuestAuditDraft | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const generatedAt =
    sanitizeOptionalTimestamp(value.generated_at) ??
    sanitizeOptionalTimestamp(value.created_at) ??
    sanitizeOptionalTimestamp(value.updated_at);
  if (!generatedAt) {
    return null;
  }

  const listingUrlRaw =
    typeof value.listing_url === "string" ? value.listing_url.trim() : "";
  const listingUrl = listingUrlRaw ? normalizeDraftUrl(listingUrlRaw) : "";

  return {
    draft_contract_version: GUEST_AUDIT_DRAFT_CONTRACT_VERSION,
    origin: sanitizeOptionalOrigin(value.origin),
    id: sanitizeOptionalString(value.id, 320),
    guest_token: sanitizeOptionalString(value.guest_token, 320),
    listing_url: listingUrl,
    property_type_override: parsePropertyTypeOverride(value.property_type_override),
    country: sanitizeOptionalString(value.country, 120),
    city: sanitizeOptionalString(value.city, 120),
    guest_capacity: sanitizeOptionalPositiveInteger(value.guest_capacity),
    declared_nightly_price: sanitizeOptionalPositiveNumber(value.declared_nightly_price),
    currency: sanitizeOptionalCurrency(value.currency),
    title: sanitizeOptionalString(value.title, 240),
    platform: sanitizeOptionalPlatform(value.platform),
    selected_offer: sanitizeOptionalString(value.selected_offer, 64),
    persisted_audit_id: sanitizeOptionalString(value.persisted_audit_id, 128),
    generated_at: generatedAt,
    created_at: sanitizeOptionalTimestamp(value.created_at),
    updated_at: sanitizeOptionalTimestamp(value.updated_at),
    status: sanitizeOptionalStatus(value.status),
    payment_status: sanitizeOptionalPaymentStatus(value.payment_status),
    preview_payload: value.preview_payload,
    full_payload: value.full_payload,
    result: sanitizeGuestAuditResult(value.result),
  };
}

function loadLegacyGuestAuditDraft(): GuestAuditDraft | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(GUEST_AUDIT_DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = sanitizeGuestAuditDraft(JSON.parse(raw));
    if (!parsed) {
      window.localStorage.removeItem(GUEST_AUDIT_DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(GUEST_AUDIT_DRAFT_KEY);
    return null;
  }
}

function getStoredDrafts(): GuestAuditDraft[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(GUEST_AUDIT_DRAFTS_KEY);
  if (!raw) {
    const legacyDraft = loadLegacyGuestAuditDraft();
    return legacyDraft ? [legacyDraft] : [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(GUEST_AUDIT_DRAFTS_KEY);
      return [];
    }

    const sanitized = parsed
      .map((entry) => sanitizeGuestAuditDraft(entry))
      .filter((entry): entry is GuestAuditDraft => entry != null);

    if (sanitized.length !== parsed.length) {
      saveStoredDrafts(sanitized);
    }

    return sanitized;
  } catch {
    window.localStorage.removeItem(GUEST_AUDIT_DRAFTS_KEY);
    return [];
  }
}

function saveStoredDrafts(drafts: GuestAuditDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_AUDIT_DRAFTS_KEY, JSON.stringify(drafts));
}

export function getOrCreateGuestAuditToken() {
  if (typeof window === "undefined") {
    return "guest-server";
  }

  const existingToken = window.localStorage.getItem(GUEST_AUDIT_TOKEN_KEY);
  if (existingToken) return existingToken;

  const token =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(GUEST_AUDIT_TOKEN_KEY, token);
  return token;
}

export function saveGuestAuditDraft(draft: GuestAuditDraft) {
  if (typeof window === "undefined") return;

  const guestToken = draft.guest_token ?? getOrCreateGuestAuditToken();
  const normalizedUrl = normalizeDraftUrl(draft.listing_url);
  const now = new Date().toISOString();
  const nextDraft: GuestAuditDraft = {
    ...draft,
    draft_contract_version: GUEST_AUDIT_DRAFT_CONTRACT_VERSION,
    id: draft.id ?? `${guestToken}:${normalizedUrl}`,
    guest_token: guestToken,
    listing_url: normalizedUrl,
    generated_at: draft.generated_at ?? now,
    created_at: draft.created_at ?? now,
    updated_at: now,
    status:
      draft.status ?? (draft.full_payload || draft.result.raw_payload ? "completed" : "processing"),
    payment_status: draft.payment_status ?? "unpaid",
  };

  const drafts = getStoredDrafts().filter(
    (existingDraft) =>
      !(
        (existingDraft.guest_token ?? guestToken) === guestToken &&
        normalizeDraftUrl(existingDraft.listing_url) === normalizedUrl
      )
  );

  const nextDrafts = [nextDraft, ...drafts].slice(0, 12);
  saveStoredDrafts(nextDrafts);
  window.localStorage.setItem(GUEST_AUDIT_DRAFT_KEY, JSON.stringify(nextDraft));
}

export function loadGuestAuditDraft(listingUrl?: string): GuestAuditDraft | null {
  const drafts = getStoredDrafts();
  if (drafts.length === 0) return null;

  const guestToken = typeof window === "undefined" ? null : getOrCreateGuestAuditToken();
  const normalizedUrl = listingUrl !== undefined ? normalizeDraftUrl(listingUrl) : null;

  return (
    drafts.find((draft) => {
      if (guestToken && draft.guest_token && draft.guest_token !== guestToken) {
        return false;
      }

      if (normalizedUrl) {
        return normalizeDraftUrl(draft.listing_url) === normalizedUrl;
      }

      return true;
    }) ?? null
  );
}

export function clearGuestAuditDraft(listingUrl?: string) {
  if (typeof window === "undefined") return;

  if (listingUrl === undefined) {
    window.localStorage.removeItem(GUEST_AUDIT_DRAFT_KEY);
    window.localStorage.removeItem(GUEST_AUDIT_DRAFTS_KEY);
    return;
  }

  const guestToken = getOrCreateGuestAuditToken();
  const normalizedUrl = normalizeDraftUrl(listingUrl);
  const nextDrafts = getStoredDrafts().filter(
    (draft) =>
      !(
        (draft.guest_token ?? guestToken) === guestToken &&
        normalizeDraftUrl(draft.listing_url) === normalizedUrl
      )
  );

  saveStoredDrafts(nextDrafts);

  if (nextDrafts[0]) {
    window.localStorage.setItem(GUEST_AUDIT_DRAFT_KEY, JSON.stringify(nextDrafts[0]));
  } else {
    window.localStorage.removeItem(GUEST_AUDIT_DRAFT_KEY);
  }
}

export function isGuestAuditDraftExpired(draft: GuestAuditDraft) {
  const generatedAt = new Date(draft.updated_at ?? draft.generated_at).getTime();

  if (Number.isNaN(generatedAt)) {
    return true;
  }

  return Date.now() - generatedAt > GUEST_AUDIT_MAX_AGE_MS;
}

export function isFreeAuditGuestDraft(
  draft: GuestAuditDraft | null | undefined,
): draft is GuestAuditDraft & { origin: "free_audit" } {
  return draft?.origin === "free_audit";
}

export function saveFreeAuditGuestDraft(input: FreeAuditGuestDraftInput) {
  const now = sanitizeOptionalTimestamp(input.createdAt) ?? new Date().toISOString();

  saveGuestAuditDraft({
    draft_contract_version: GUEST_AUDIT_DRAFT_CONTRACT_VERSION,
    origin: "free_audit",
    listing_url: input.listingUrl ?? "",
    property_type_override: input.propertyType,
    country: input.country.trim(),
    city: input.city.trim(),
    guest_capacity: input.guestCapacity,
    declared_nightly_price: input.declaredNightlyPrice,
    currency: input.currency.trim().toUpperCase(),
    platform: input.platform,
    generated_at: now,
    created_at: now,
    status: "pending",
    payment_status: "unpaid",
    result: {},
  });
}

export function consumeFreeAuditGuestDraftForAuditNew(): GuestAuditDraftAuditNewPrefill | null {
  const draft = loadGuestAuditDraft();
  if (!isFreeAuditGuestDraft(draft)) {
    return null;
  }

  if (isGuestAuditDraftExpired(draft)) {
    clearGuestAuditDraft(draft.listing_url);
    return null;
  }

  const prefill: GuestAuditDraftAuditNewPrefill = {
    origin: "free_audit",
    listingUrl: draft.listing_url || null,
    platform: draft.platform ?? null,
    country: draft.country ?? null,
    city: draft.city ?? null,
    propertyTypeOverride: parsePropertyTypeOverride(draft.property_type_override) ?? null,
    guestCapacity: draft.guest_capacity ?? null,
    declaredNightlyPrice: draft.declared_nightly_price ?? null,
    currency: draft.currency ?? null,
  };

  clearGuestAuditDraft(draft.listing_url);
  return prefill;
}

export async function restoreGuestAuditDraft(): Promise<{
  restored: boolean;
  auditId?: string | null;
  cached?: boolean;
  draft?: GuestAuditDraft | null;
  error?: string;
}> {
  const draft = loadGuestAuditDraft();

  if (!draft) {
    return { restored: false };
  }

  if (isGuestAuditDraftExpired(draft)) {
    clearGuestAuditDraft(draft.listing_url);
    return { restored: false };
  }

  if (isFreeAuditGuestDraft(draft)) {
    return {
      restored: true,
      cached: true,
      draft,
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { restored: false, error: "Session introuvable" };
  }

  if (draft.full_payload || draft.result.raw_payload) {
    return {
      restored: true,
      cached: true,
      draft,
    };
  }

  const response = await fetch("/api/listings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      url: draft.listing_url,
      title: draft.title,
      platform: draft.platform,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      restored: false,
      error: data?.error || "Impossible de restaurer le brouillon d’audit",
    };
  }

  clearGuestAuditDraft(draft.listing_url);

  return {
    restored: true,
    auditId: data?.auditId ?? null,
  };
}

export async function persistGuestAuditDraftAfterPayment(
  checkoutSessionId: string
): Promise<{
  persisted: boolean;
  auditId?: string | null;
  status?:
    | "restored"
    | "already_restored"
    | "payment_not_confirmed"
    | "payment_not_found"
    | "invalid_request"
    | "restore_failed";
  error?: string;
}> {
  const draft = loadGuestAuditDraft();

  if (!draft) {
    return {
      persisted: false,
      status: "restore_failed",
      error: "Aucun brouillon d'audit a restaurer",
    };
  }

  if (isGuestAuditDraftExpired(draft)) {
    clearGuestAuditDraft(draft.listing_url);
    return {
      persisted: false,
      status: "restore_failed",
      error: "Le brouillon d'audit a expire",
    };
  }

  if (draft.persisted_audit_id) {
    return {
      persisted: true,
      auditId: draft.persisted_audit_id,
      status: "already_restored",
    };
  }

  const payload = draft.full_payload ?? draft.result.raw_payload ?? draft.preview_payload;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      persisted: false,
      status: "restore_failed",
      error: "Le brouillon d'audit est incomplet",
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      persisted: false,
      status: "restore_failed",
      error: "Session introuvable",
    };
  }

  const response = await fetch("/api/audits/restore", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      checkoutSessionId,
      url: draft.listing_url,
      title: draft.title,
      platform: draft.platform,
      generatedAt: draft.generated_at,
      preview: payload,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      persisted: false,
      status:
        typeof data?.status === "string"
          ? (data.status as
              | "payment_not_confirmed"
              | "payment_not_found"
              | "invalid_request"
              | "restore_failed")
          : "restore_failed",
      error: data?.error || "Impossible de persister l'audit paye",
    };
  }

  const auditId = data?.auditId ?? null;

  saveGuestAuditDraft({
    ...draft,
    payment_status: "paid",
    persisted_audit_id: auditId,
  });

  return {
    persisted: true,
    auditId,
    status:
      data?.status === "already_restored" ? "already_restored" : "restored",
  };
}

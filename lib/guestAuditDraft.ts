"use client";

import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import { supabase } from "@/lib/supabase";

export const GUEST_AUDIT_DRAFT_KEY = "lco_guest_audit_draft";
export const GUEST_AUDIT_DRAFTS_KEY = "lco_guest_audit_drafts";
export const GUEST_AUDIT_TOKEN_KEY = "lco_guest_audit_token";
const GUEST_AUDIT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type GuestAuditDraftStatus = "pending" | "processing" | "completed" | "failed";
type GuestAuditPaymentStatus = "unpaid" | "paid";

export type GuestAuditDraft = {
  id?: string;
  guest_token?: string;
  listing_url: string;
  /** Saisie utilisateur (audit public) — transmis au workspace si recréation manuelle. */
  property_type_override?: string;
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

function normalizeDraftUrl(listingUrl: string) {
  return normalizeSourceUrl(listingUrl) ?? listingUrl.trim();
}

function loadLegacyGuestAuditDraft(): GuestAuditDraft | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(GUEST_AUDIT_DRAFT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as GuestAuditDraft;
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
    return Array.isArray(parsed) ? (parsed as GuestAuditDraft[]) : [];
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
  const normalizedUrl = listingUrl ? normalizeDraftUrl(listingUrl) : null;

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

  if (!listingUrl) {
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

export async function persistGuestAuditDraftAfterPayment(): Promise<{
  persisted: boolean;
  auditId?: string | null;
  error?: string;
}> {
  const draft = loadGuestAuditDraft();

  if (!draft) {
    return { persisted: false, error: "Aucun brouillon d'audit a restaurer" };
  }

  if (isGuestAuditDraftExpired(draft)) {
    clearGuestAuditDraft(draft.listing_url);
    return { persisted: false, error: "Le brouillon d'audit a expire" };
  }

  if (draft.persisted_audit_id) {
    return {
      persisted: true,
      auditId: draft.persisted_audit_id,
    };
  }

  const payload = draft.full_payload ?? draft.result.raw_payload ?? draft.preview_payload;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      persisted: false,
      error: "Le brouillon d'audit est incomplet",
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { persisted: false, error: "Session introuvable" };
  }

  const response = await fetch("/api/audits/restore", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
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
  };
}

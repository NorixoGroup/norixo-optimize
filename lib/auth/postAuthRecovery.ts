"use client";

import {
  clearGuestAuditDraft,
  isGuestAuditDraftExpired,
  loadGuestAuditDraft,
  restoreGuestAuditDraft,
} from "@/lib/guestAuditDraft";
import { hasCompletedOnboarding } from "@/lib/onboarding";

type PostAuthUser = Parameters<typeof hasCompletedOnboarding>[0];

type PostAuthRecoveryParams = {
  user: PostAuthUser;
  router: { replace: (href: string) => void };
  searchParams: { get(name: string): string | null };
  setInfo?: (value: string | null) => void;
};

export async function runPostAuthRecovery({
  user,
  router,
  searchParams,
  setInfo,
}: PostAuthRecoveryParams) {
  const storedDraft = loadGuestAuditDraft();

  if (storedDraft && isGuestAuditDraftExpired(storedDraft)) {
    clearGuestAuditDraft();
  }

  const target = hasCompletedOnboarding(user) ? "/dashboard" : "/onboarding";
  const nextTarget = searchParams.get("next") || "/audit/new?restored=1";
  const recoverableDraft = loadGuestAuditDraft();

  if (!recoverableDraft) {
    router.replace(target);
    return;
  }

  if (setInfo) {
    setInfo("Nous avons retrouve votre audit temporaire. Restauration en cours...");
  }

  const restoration = await restoreGuestAuditDraft();

  if (restoration.restored) {
    if (restoration.cached) {
      router.replace(nextTarget);
      return;
    }

    router.replace(
      restoration.auditId ? `/dashboard/audits/${restoration.auditId}` : "/dashboard/audits"
    );
    return;
  }

  if (setInfo) {
    setInfo("Votre brouillon d’audit n’a pas pu etre restaure automatiquement.");
  }
  router.replace(target);
}

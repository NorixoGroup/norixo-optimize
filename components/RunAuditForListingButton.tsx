"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type RunAuditForListingButtonProps = {
  listingId: string;
};

type RunAuditResult =
  | { success: true; auditId: string | null }
  | { success: false; code?: string; message: string };

export type RunAuditForListingOptions = {
  marketCountryOverride?: string | null;
  marketCityOverride?: string | null;
  propertyTypeOverride?: string | null;
};

export async function runAuditForListing(
  listingId: string,
  options?: RunAuditForListingOptions
): Promise<RunAuditResult> {
  let accessToken: string | null = null;
  {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    accessToken = session?.access_token ?? null;
  }
  if (!accessToken) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error) {
      accessToken = data.session?.access_token ?? null;
    }
  }

  const payload: Record<string, string> = { listingId };
  const co =
    options?.marketCountryOverride != null ? String(options.marketCountryOverride).trim() : "";
  const ci = options?.marketCityOverride != null ? String(options.marketCityOverride).trim() : "";
  const pt =
    options?.propertyTypeOverride != null ? String(options.propertyTypeOverride).trim() : "";
  if (co !== "") payload.marketCountryOverride = co;
  if (ci !== "") payload.marketCityOverride = ci;
  if (pt !== "") payload.propertyTypeOverride = pt;

  const response = await fetch("/api/audits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as {
    auditId?: string | null;
    code?: string;
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    const errorCode = typeof data.error === "string" ? data.error : undefined;
    const message =
      typeof data.message === "string" && data.message.trim() !== ""
        ? data.message
        : errorCode ?? "Échec du lancement de l’audit";
    return {
      success: false,
      code: typeof data.code === "string" ? data.code : errorCode,
      message,
    };
  }

  return {
    success: true,
    auditId: data?.auditId ?? null,
  };
}

export function RunAuditForListingButton({ listingId }: RunAuditForListingButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [bookingExtractionUnavailable, setBookingExtractionUnavailable] = useState(false);

  async function handleClick() {
    if (loading || isQuotaError) return;
    setLoading(true);
    setError(null);
    setIsQuotaError(false);
    setBookingExtractionUnavailable(false);

    try {
      const result = await runAuditForListing(listingId);

      if (!result.success) {
        if (result.code === "booking_extraction_unavailable") {
          setBookingExtractionUnavailable(true);
          setError(null);
          setIsQuotaError(false);
        } else if (result.code === "quota_exceeded") {
          setError(result.message);
          setIsQuotaError(true);
          setBookingExtractionUnavailable(false);
        } else {
          setError(result.message);
          setIsQuotaError(false);
          setBookingExtractionUnavailable(false);
        }
        setLoading(false);
        return;
      }

      if (result.auditId) {
        router.push(`/dashboard/audits/${result.auditId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Une erreur inconnue est survenue"
      );
      setIsQuotaError(false);
      setBookingExtractionUnavailable(false);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || isQuotaError}
        className="nk-ghost-btn text-[11px] font-semibold uppercase tracking-[0.16em] disabled:opacity-60"
      >
        {loading ? "Audit en cours..." : "Lancer un audit"}
      </button>
      {bookingExtractionUnavailable && (
        <div className="max-w-[280px] space-y-2 rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 text-[11px] leading-snug text-amber-950">
          <p className="font-semibold text-amber-950">
            Analyse Booking temporairement indisponible
          </p>
          <p className="text-amber-900/95">
            Booking bloque temporairement l’accès à cette annonce. L’audit n’a pas été exécuté et
            aucun crédit n’a été débité. Réessayez dans quelques minutes ou sélectionnez d’autres
            dates.
          </p>
          <p className="text-[10px] font-medium text-amber-800/90">Votre solde reste inchangé.</p>
          <button
            type="button"
            onClick={() => {
              setBookingExtractionUnavailable(false);
              setError(null);
            }}
            className="nk-ghost-btn !px-2 !py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
          >
            Réessayer
          </button>
        </div>
      )}
      {error && !bookingExtractionUnavailable && (
        <span className="text-[11px] text-red-600 max-w-[260px]">
          {error}
        </span>
      )}
      {isQuotaError && (
        <Link
          href="/dashboard/billing"
          className="text-[11px] font-semibold text-slate-900 underline underline-offset-2"
        >
          Débloquer en Pro
        </Link>
      )}
    </div>
  );
}

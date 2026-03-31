"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuditLaunchOverlay } from "@/components/AuditLaunchOverlay";
import { supabase } from "@/lib/supabase";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { runAuditForListing } from "@/components/RunAuditForListingButton";

const LOADING_STEPS = [
  "Extraction du logement...",
  "Recherche des concurrents comparables...",
  "Analyse IA de l’annonce...",
  "Préparation du rapport final...",
];

export default function NewListingPage() {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("airbnb");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (!isSubmitting) {
      setStepIndex(0);
      setProgress(8);
      return;
    }

    const stepTimer = window.setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 2200);

    const progressTimer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        return prev + 6;
      });
    }, 500);

    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(progressTimer);
    };
  }, [isSubmitting]);

  const currentStep = useMemo(
    () => LOADING_STEPS[stepIndex] ?? LOADING_STEPS[0],
    [stepIndex]
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsQuotaError(false);
    setIsSubmitting(true);
    setStepIndex(0);
    setProgress(10);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Utilisateur non authentifié");
      }

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
      });

      const effectiveWorkspaceId = workspace?.id;

      if (!effectiveWorkspaceId) {
        throw new Error(
          "Impossible d'initialiser le workspace pour cet utilisateur"
        );
      }

      const normalizedUrl = normalizeSourceUrl(url);

      const { data: existingListings, error: existingListingsError } = await supabase
        .from("listings")
        .select("id, source_url")
        .eq("workspace_id", effectiveWorkspaceId);

      if (existingListingsError) {
        throw new Error(
          existingListingsError.message ||
            "Impossible de vérifier les annonces existantes"
        );
      }

      const existingListing = (existingListings ?? []).find(
        (listing) => normalizeSourceUrl(listing.source_url) === normalizedUrl
      );

      let listingRow = existingListing ?? null;

      if (!listingRow) {
        const { data: createdListing, error: listingError } = await supabase
          .from("listings")
          .insert({
            workspace_id: effectiveWorkspaceId,
            created_by: user.id,
            source_platform: platform,
            source_url: url,
            title: title || "Annonce sans titre",
          })
          .select("id, source_url")
          .single();

        if (listingError || !createdListing) {
          throw new Error(listingError?.message || "Échec de création de l’annonce");
        }

        listingRow = createdListing;
      }

      const auditResult = await runAuditForListing(listingRow.id as string);

      if (!auditResult.success) {
        if (auditResult.code === "quota_exceeded") {
          setError(
            "Vous avez atteint la limite du plan gratuit (3 audits). Passez au Pro pour débloquer des audits illimités."
          );
          setIsQuotaError(true);
        } else {
          setError(auditResult.message);
          setIsQuotaError(false);
        }
        setIsSubmitting(false);
        return;
      }

      setProgress(100);

      setTimeout(() => {
        if (auditResult.auditId) {
          router.push(`/dashboard/audits/${auditResult.auditId}`);
        } else {
          router.push("/dashboard/listings");
        }
      }, 350);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Une erreur inconnue est survenue"
      );
      setIsQuotaError(false);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 text-sm">
      <div className="nk-card nk-card-hover nk-page-header-card px-6 py-7 md:flex md:items-center md:justify-between md:gap-10 md:px-8">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted">Nouvel audit</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            Ajouter une annonce à suivre
          </h1>
          <p className="nk-body-muted text-[15px] leading-relaxed text-slate-700">
            Collez l’URL publique de votre annonce. Nous créerons une fiche dans votre workspace
            pour pouvoir l’auditer et suivre ses futures optimisations.
          </p>
        </div>
      </div>

      <div className="relative">
      {isSubmitting && (
        <AuditLaunchOverlay
          currentStep={currentStep}
          progress={progress}
          steps={LOADING_STEPS}
          stepIndex={stepIndex}
        />
      )}

      <div className={isSubmitting ? "pointer-events-none opacity-50" : ""}>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_360px]">
          <div className="nk-card nk-card-hover p-6 md:p-7">
            <p className="nk-section-title">Paramètres de l’annonce</p>
            <p className="mt-1 text-xs text-slate-600">
              Ces informations servent à créer la fiche de base avant de lancer un audit détaillé.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">
                  URL de l’annonce
                </label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                  required
                  placeholder="https://www.airbnb.com/rooms/..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">
                  Titre personnalisé (optionnel)
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  type="text"
                  placeholder="Ex : Studio moderne au cœur de Guéliz"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">
                  Plateforme
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="airbnb">Airbnb</option>
                  <option value="booking">Booking</option>
                  <option value="vrbo">Vrbo</option>
                </select>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <p>{error}</p>
                  {isQuotaError && (
                    <div className="mt-2">
                      <Link
                        href="/dashboard/billing"
                        className="text-xs font-semibold text-slate-900 underline underline-offset-2"
                      >
                        Passer au plan Pro
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Analyse en cours..." : "Lancer l’audit"}
                </button>

                <span className="text-xs text-slate-500">
                  Audit automatique + comparables proches
                </span>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="nk-card nk-card-hover p-6">
              <p className="nk-section-title">
                Ce que l’outil analyse
              </p>

              <ul className="mt-4 space-y-3 text-sm text-slate-800">
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Qualité et ordre des photos</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Qualité de la description</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Équipements manquants</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Forces SEO et conversion</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Comparaison avec concurrents proches</span>
                </li>
              </ul>
            </div>

            <div className="nk-card nk-card-hover p-6">
              <p className="nk-section-title">
                Conseil
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Pour un audit plus juste, utilise directement l’URL publique exacte
                de l’annonce et choisis la bonne plateforme. L’outil comparera
                ensuite ton logement à des annonces réellement proches.
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuditLaunchOverlay } from "@/components/AuditLaunchOverlay";
import { supabase } from "@/lib/supabase";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { getWorkspacePlan } from "@/lib/billing/getWorkspacePlan";
import { runAuditForListing } from "@/components/RunAuditForListingButton";

const LOADING_STEPS_DEFAULT = [
  "Extraction de l’annonce (texte, photos, structure)…",
  "Recherche de concurrents comparables à proximité…",
  "Analyse IA et lecture marché…",
  "Construction du rapport et des priorités…",
];

const LOADING_STEPS_BOOKING = [
  "Extraction Booking.com (page publique, calendrier, équipements)…",
  "Découverte des comparables — étape souvent longue sur Booking…",
  "Analyse IA avec le contexte concurrentiel réel…",
  "Finalisation du rapport (scores, axes d’amélioration)…",
];

const OVERLAY_HINTS_DEFAULT = [
  "Connexion sécurisée à la page publique de l’annonce…",
  "Normalisation des données pour une comparaison équitable…",
  "Les étapes avancent selon la réponse des plateformes (pas de pourcentage fixe).",
];

const OVERLAY_HINTS_BOOKING = [
  "Récupération via passerelle sécurisée — merci de laisser cet onglet ouvert.",
  "Booking peut imposer des vérifications : le serveur réessaie avec des stratégies adaptées.",
  "La phase « comparables » enchaîne plusieurs extractions ; c’est souvent la plus longue.",
];

export default function NewListingPage() {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("airbnb");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);

  const loadingSteps = useMemo(() => {
    return url.toLowerCase().includes("booking") ? LOADING_STEPS_BOOKING : LOADING_STEPS_DEFAULT;
  }, [url]);

  const overlayHints = useMemo(() => {
    return url.toLowerCase().includes("booking") ? OVERLAY_HINTS_BOOKING : OVERLAY_HINTS_DEFAULT;
  }, [url]);

  const stepIntervalMs = useMemo(
    () => (url.toLowerCase().includes("booking") ? 4500 : 2400),
    [url]
  );

  useEffect(() => {
    if (!isSubmitting) {
      setStepIndex(0);
      setHintIndex(0);
      return;
    }

    const stepTimer = window.setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, loadingSteps.length - 1));
    }, stepIntervalMs);

    const hintTimer = window.setInterval(() => {
      setHintIndex((prev) => prev + 1);
    }, 3200);

    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(hintTimer);
    };
  }, [isSubmitting, loadingSteps.length, stepIntervalMs]);

  const currentStep = useMemo(
    () => loadingSteps[stepIndex] ?? loadingSteps[0],
    [loadingSteps, stepIndex]
  );

  const rotatingHint = useMemo(() => {
    return overlayHints[hintIndex % overlayHints.length] ?? overlayHints[0];
  }, [hintIndex, overlayHints]);

  function detectPlatformFromInput(
    nextUrl: string
  ): "airbnb" | "booking" | "vrbo" | "agoda" | "expedia" | null {
    const value = nextUrl.trim().toLowerCase();
    if (!value) return null;
    if (value.includes("airbnb")) return "airbnb";
    if (value.includes("booking")) return "booking";
    if (value.includes("vrbo") || value.includes("abritel")) return "vrbo";
    if (value.includes("agoda")) return "agoda";
    if (value.includes("expedia")) return "expedia";
    return null;
  }

  useEffect(() => {
    const detectedPlatform = detectPlatformFromInput(url);
    if (detectedPlatform && detectedPlatform !== platform) {
      setPlatform(detectedPlatform);
    }
  }, [url, platform]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsQuotaError(false);
    setIsSubmitting(true);
    setStepIndex(0);
    setHintIndex(0);

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

      try {
        const plan = await getWorkspacePlan(effectiveWorkspaceId, supabase);
        setPlanCode(plan.planCode);
      } catch {
        setPlanCode(null);
      }

      const auditResult = await runAuditForListing(listingRow.id as string);

      if (!auditResult.success) {
        if (auditResult.code === "quota_exceeded") {
          setError(auditResult.message);
          setIsQuotaError(true);
        } else {
          setError(auditResult.message);
          setIsQuotaError(false);
        }
        setIsSubmitting(false);
        return;
      }

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

  console.log("[NEW AUDIT PAGE DEBUG]", {
    workspaceId: null,
    planCode,
    auditCount: null,
    canCreateAudit: null,
    upgradeCTA: isQuotaError ? "upgrade" : "launch",
  });

  return (
    <div className="space-y-7 md:space-y-8 text-sm">
      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-6 py-7 md:flex md:items-center md:justify-between md:gap-10 md:px-8 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="max-w-3xl space-y-2.5">
          <p className="nk-kicker-muted">Nouvel audit</p>
          <h1 className="nk-page-title nk-page-title-dashboard">
            Ajouter une annonce à suivre
          </h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted text-[15px] leading-7 text-slate-600">
            Collez l’URL publique de votre annonce. Nous créerons une fiche dans votre workspace
            pour pouvoir l’auditer et suivre ses futures optimisations.
          </p>
        </div>
      </div>

      <div className="relative">
      {isSubmitting && (
        <AuditLaunchOverlay
          currentStep={currentStep}
          steps={loadingSteps}
          stepIndex={stepIndex}
          statusHint={rotatingHint}
        />
      )}

      <div className={isSubmitting ? "pointer-events-none opacity-50" : ""}>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_360px]">
          <div className="nk-card nk-card-hover p-6 md:p-7 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
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
                  onChange={(e) => {
                    const nextUrl = e.target.value;
                    setUrl(nextUrl);
                    const detectedPlatform = detectPlatformFromInput(nextUrl);
                    if (detectedPlatform) {
                      setPlatform(detectedPlatform);
                    }
                  }}
                  type="url"
                  required
                  placeholder="https://www.airbnb.com/rooms/..."
                  className="nk-form-field"
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
                  className="nk-form-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">
                  Plateforme
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="nk-form-select"
                >
                  <option value="airbnb">Airbnb</option>
                  <option value="booking">Booking</option>
                  <option value="vrbo">Vrbo</option>
                  <option value="agoda">Agoda</option>
                  <option value="expedia">Expedia</option>
                </select>
              </div>

              {error && (
                <div
                  className={
                    isQuotaError
                      ? "rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-3 text-sm text-slate-700"
                      : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  }
                >
                  {!isQuotaError ? (
                    <p>{error}</p>
                  ) : (
                    <div className="rounded-2xl border border-blue-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.95)_55%,rgba(238,242,255,0.92)_100%)] px-4 py-4 text-slate-800 shadow-[0_12px_28px_rgba(59,130,246,0.13)] ring-1 ring-white/75">
                      <p className="text-sm font-semibold text-slate-950">
                        Débloquez votre audit complet en 30 secondes
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        Vous n’avez plus de crédits disponibles pour lancer un nouvel audit.
                        Choisissez une offre pour continuer et débloquer immédiatement vos
                        prochaines analyses.
                      </p>

                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                        <div className="relative overflow-hidden rounded-xl border border-blue-200/80 bg-blue-50/75 px-3 py-2.5">
                          <span className="absolute inset-x-0 top-0 h-0.5 bg-blue-400/80" />
                          <p className="font-semibold text-slate-900">Starter — 9 €</p>
                          <p className="mt-1 text-slate-600">1 audit ponctuel</p>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-indigo-200/85 bg-indigo-50/85 px-3 py-2.5 shadow-[0_8px_18px_rgba(99,102,241,0.12)] ring-1 ring-indigo-100/70">
                          <span className="absolute inset-x-0 top-0 h-0.5 bg-indigo-400/85" />
                          <p className="font-semibold text-slate-900">Pack 5 audits — 39 €</p>
                          <p className="mt-1 text-slate-600">5 audits</p>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-cyan-200/80 bg-cyan-50/75 px-3 py-2.5">
                          <span className="absolute inset-x-0 top-0 h-0.5 bg-cyan-400/80" />
                          <p className="font-semibold text-slate-900">Pack 15 audits — 99 €</p>
                          <p className="mt-1 text-slate-600">15 audits</p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <Link
                          href="/dashboard/billing"
                          className="inline-flex items-center justify-center rounded-xl border !border-blue-500/85 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_52%,#7c3aed_100%)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white !shadow-[0_14px_32px_rgba(59,130,246,0.32)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70"
                        >
                          Voir les offres et débloquer mes audits
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col items-start gap-2 pt-2 sm:flex-row sm:items-center sm:gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || isQuotaError}
                  className="inline-flex items-center justify-center rounded-xl border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:cursor-not-allowed disabled:opacity-70"
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
            <div className="nk-card-accent nk-card-accent-purple nk-card-hover p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
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

            <div className="nk-card-accent nk-card-hover p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
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

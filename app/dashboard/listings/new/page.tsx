"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ensureWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";

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

      const workspace = await ensureWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
      });

      const effectiveWorkspaceId = workspace?.id;

      if (!effectiveWorkspaceId) {
        throw new Error(
          "Impossible d'initialiser le workspace pour cet utilisateur"
        );
      }
      const { data: listingRow, error: listingError } = await supabase
        .from("listings")
        .insert({
          workspace_id: effectiveWorkspaceId,
          created_by: user.id,
          source_platform: platform,
          source_url: url,
          title: title || "Untitled listing",
        })
        .select()
        .single();

      if (listingError || !listingRow) {
        throw new Error(listingError?.message || "Échec de création de l’annonce");
      }

      setProgress(100);

      setTimeout(() => {
        router.push("/dashboard/listings");
      }, 350);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Une erreur inconnue est survenue"
      );
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
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl shadow-black/40">
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
                <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-emerald-500/25 border-t-emerald-400" />
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  Audit en cours
                </p>
                <p className="text-xs text-neutral-400">
                  Merci de patienter pendant l’analyse.
                </p>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-neutral-300">{currentStep}</span>
              <span className="font-medium text-emerald-400">{progress}%</span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-5 space-y-2">
              {LOADING_STEPS.map((step, index) => {
                const isDone = index < stepIndex;
                const isCurrent = index === stepIndex;

                return (
                  <div
                    key={step}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      isCurrent
                        ? "bg-emerald-500/10 text-emerald-300"
                        : isDone
                        ? "text-neutral-300"
                        : "text-neutral-500"
                    }`}
                  >
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        isCurrent
                          ? "bg-emerald-400"
                          : isDone
                          ? "bg-emerald-700"
                          : "bg-neutral-700"
                      }`}
                    />
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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
                  {error}
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
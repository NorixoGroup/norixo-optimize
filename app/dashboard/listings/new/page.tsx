"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          title,
          platform,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Échec de génération de l’audit");
      }

      try {
        const rawAudits = localStorage.getItem("lco_audits");
        const audits = rawAudits ? JSON.parse(rawAudits) : [];
        audits.push(data.audit);
        localStorage.setItem("lco_audits", JSON.stringify(audits));

        const rawListings = localStorage.getItem("lco_listings_v1");
        const listings = rawListings ? JSON.parse(rawListings) : [];
        listings.push(data.listing);
        localStorage.setItem("lco_listings_v1", JSON.stringify(listings));
      } catch (storageError) {
        console.warn("Local storage update failed:", storageError);
      }

      setProgress(100);

      setTimeout(() => {
        router.push(`/dashboard/audits/${data.auditId}`);
      }, 350);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Une erreur inconnue est survenue"
      );
      setIsSubmitting(false);
    }
  }

  return (
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
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-8 shadow-xl shadow-black/20">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Lancer un audit d’annonce
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Colle l’URL publique d’une annonce Airbnb, Booking ou Vrbo. L’outil
              va extraire les données, analyser l’annonce et la comparer à des
              logements similaires à proximité.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  URL de l’annonce
                </label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                  required
                  placeholder="https://www.airbnb.com/rooms/..."
                  className="w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Titre personnalisé (optionnel)
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  type="text"
                  placeholder="Ex : Studio moderne au cœur de Guéliz"
                  className="w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Plateforme
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3.5 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="airbnb">Airbnb</option>
                  <option value="booking">Booking</option>
                  <option value="vrbo">Vrbo</option>
                </select>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Analyse en cours..." : "Lancer l’audit"}
                </button>

                <span className="text-xs text-neutral-500">
                  Audit automatique + comparables proches
                </span>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-xl shadow-black/20">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                Ce que l’outil analyse
              </p>

              <ul className="mt-4 space-y-3 text-sm text-neutral-300">
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

            <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-xl shadow-black/20">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                Conseil
              </p>
              <p className="mt-4 text-sm leading-6 text-neutral-400">
                Pour un audit plus juste, utilise directement l’URL publique exacte
                de l’annonce et choisis la bonne plateforme. L’outil comparera
                ensuite ton logement à des annonces réellement proches.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
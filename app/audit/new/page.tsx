"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuditLaunchOverlay } from "@/components/AuditLaunchOverlay";
import {
  clearGuestAuditDraft,
  type GuestAuditDraft,
  getOrCreateGuestAuditToken,
  isGuestAuditDraftExpired,
  loadGuestAuditDraft,
  saveGuestAuditDraft,
} from "@/lib/guestAuditDraft";
import {
  detectPlatformFromUrl,
  detectSiteFromUrl,
  formatPlatformLabel,
  validateGuestListingUrl,
} from "@/lib/guestAudit/shared";
import { supabase } from "@/lib/supabase";

const LOADING_STEPS = [
  "Extraction du logement...",
  "Recherche des concurrents comparables...",
  "Analyse IA de l’annonce...",
  "Préparation de l’aperçu...",
];

type GuestAuditPreview = {
  listing_url: string;
  title: string;
  platform: string;
  score: number;
  insights: string[];
  recommendations: string[];
  summary: string | null;
  marketComparison?: string | null;
  estimatedRevenue: string | null;
  bookingPotential?: string | null;
  subScores?: Array<{
    key: string;
    label: string;
    status: "scored" | "partial" | "unavailable";
    score: number | null;
    weight: number;
    reason?: string;
  }>;
  occupancyObservation?: {
    status?: "available" | "unavailable";
    rate: number | null;
    unavailableDays: number;
    availableDays: number;
    observedDays: number;
    windowDays: number;
    source: string | null;
  } | null;
  marketPositioning?: {
    status: "ok" | "partial" | "insufficient_data" | "blocked";
    comparableCount: number;
    summary: string;
    comparables?: Array<{
      id?: string;
      url?: string;
      title?: string;
      propertyType?: string | null;
      capacity?: number | null;
      bedrooms?: number | null;
      bathrooms?: number | null;
      photosCount?: number | null;
      ratingValue?: number | null;
      reviewCount?: number | null;
      amenitiesCount?: number | null;
    }>;
    metrics: Array<{
      key:
        | "photos"
        | "rating"
        | "reviews"
        | "amenities"
        | "title"
        | "description"
        | "structure";
      label: string;
      subjectValue: number | string | null;
      marketAverage: number | null;
      position: "above" | "average" | "below" | "unknown";
      note: string | null;
    }>;
  } | null;
};

const PAYWALL_OFFERS = [
  {
    code: "audit_test",
    name: "Audit test",
    price: "9 €",
    detail: "1 audit ponctuel",
    note: "Ideal pour tester la valeur du rapport",
    highlighted: false,
    cta: "Continuer avec l'audit test",
  },
  {
    code: "pack_5",
    name: "Pack 5 audits",
    price: "39 €",
    detail: "5 audits, soit 7,80 € / audit",
    note: "Recommande pour comparer plusieurs annonces ou suivre vos optimisations",
    highlighted: true,
    cta: "Continuer avec le pack 5 audits",
  },
  {
    code: "pack_15",
    name: "Pack 15 audits",
    price: "99 €",
    detail: "15 audits, soit 6,60 € / audit",
    note: "Pense pour les usages reguliers ou multi-biens",
    highlighted: false,
    cta: "Continuer avec le pack 15 audits",
  },
] as const;

function normalizeRenderedStrings(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function getSubScore(
  subScores: GuestAuditPreview["subScores"],
  key: string
) {
  return subScores?.find((subScore) => subScore.key === key) ?? null;
}

function getStatusChipClasses(status: "scored" | "partial" | "unavailable") {
  if (status === "scored") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "partial") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function getDescriptionStatusLabel(
  subScore: ReturnType<typeof getSubScore>
) {
  if (!subScore || subScore.status === "unavailable") {
    return "Description non recuperee";
  }
  if (subScore.status === "partial") {
    return "Description partielle";
  }
  return "Description complete";
}

function getPhotoStatusLabel(subScore: ReturnType<typeof getSubScore>) {
  if (!subScore || subScore.status === "unavailable") {
    return "Aucune photo detectee";
  }
  if (subScore.status === "partial") {
    return "Galerie partielle";
  }
  return "Galerie complete";
}

function buildFastPreview({
  url,
  title,
  platform,
}: {
  url: string;
  title: string;
  platform: string;
}): GuestAuditPreview {
  return {
    listing_url: url,
    title: title.trim() || "Annonce en cours d'analyse",
    platform,
    score: 7.8,
    insights: [
      "Votre annonce semble correcte, mais certains signaux visibles limitent encore sa conversion.",
    ],
    recommendations: [
      "Commencez par clarifier les visuels et la promesse principale pour renforcer l'impact de la fiche.",
    ],
    summary: "Aperçu rapide disponible pendant que l'analyse complète se termine.",
    marketComparison: null,
    estimatedRevenue: null,
    bookingPotential: null,
    occupancyObservation: null,
    marketPositioning: {
      status: "partial",
      comparableCount: 0,
      summary: "Comparaison locale en cours de chargement.",
      comparables: [],
      metrics: [],
    },
    subScores: [
      {
        key: "photos",
        label: "Photos",
        status: "partial",
        score: 6.9,
        weight: 0.2,
        reason: "estimation_rapide",
      },
      {
        key: "description",
        label: "Description",
        status: "partial",
        score: 7.4,
        weight: 0.15,
        reason: "estimation_rapide",
      },
    ],
  };
}

export default function PublicAuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("other");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(8);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guestAudit, setGuestAudit] = useState<GuestAuditPreview | null>(null);
  const [fastPreview, setFastPreview] = useState<GuestAuditPreview | null>(null);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<(typeof PAYWALL_OFFERS)[number]["code"]>(
    "audit_test"
  );

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsAuthenticated(Boolean(session));
    }

    loadSession();

    if (typeof window !== "undefined") {
      const storedDraft = loadGuestAuditDraft();
      if (!storedDraft) {
        return;
      }

      if (isGuestAuditDraftExpired(storedDraft)) {
        clearGuestAuditDraft();
        return;
      }

      setGuestAudit(buildPreviewFromDraft(storedDraft));
      if (storedDraft.selected_offer) {
        setSelectedOffer(storedDraft.selected_offer as (typeof PAYWALL_OFFERS)[number]["code"]);
      }
    }
  }, []);

  useEffect(() => {
    const initialUrl = searchParams.get("url")?.trim() ?? "";
    const initialTitle = searchParams.get("title")?.trim() ?? "";
    const initialPlatform = searchParams.get("platform")?.trim() ?? "";
    const initialOffer = searchParams.get("offer")?.trim() ?? "";

    if (initialUrl && !url) {
      setUrl(initialUrl);
    }

    if (initialTitle && !title) {
      setTitle(initialTitle);
    }

    if (initialPlatform && platform === "other") {
      setPlatform(initialPlatform);
    }

    if (initialOffer && PAYWALL_OFFERS.some((offer) => offer.code === initialOffer)) {
      setSelectedOffer(initialOffer as (typeof PAYWALL_OFFERS)[number]["code"]);
    }

    if ((!initialUrl || !initialTitle || !initialPlatform) && typeof window !== "undefined") {
      const storedDraft = loadGuestAuditDraft();
      if (storedDraft && !isGuestAuditDraftExpired(storedDraft)) {
        if (!initialUrl && !url && storedDraft.listing_url) {
          setUrl(storedDraft.listing_url);
        }
        if (!initialTitle && !title && storedDraft.title) {
          setTitle(storedDraft.title);
        }
        if (!initialPlatform && platform === "other" && storedDraft.platform) {
          setPlatform(storedDraft.platform);
        }
        if (storedDraft.selected_offer) {
          setSelectedOffer(
            storedDraft.selected_offer as (typeof PAYWALL_OFFERS)[number]["code"]
          );
        }
      }
    }
  }, [platform, searchParams, title, url]);

  useEffect(() => {
    const detectedPlatform = detectSiteFromUrl(url).platformCategory;

    if (detectedPlatform !== platform) {
      setPlatform(detectedPlatform);
    }
  }, [platform, url]);

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
  const displayPreview = useMemo(
    () => guestAudit ?? fastPreview,
    [guestAudit, fastPreview]
  );
  const isRestoredDraftView = useMemo(
    () => searchParams.get("restored") === "1",
    [searchParams]
  );
  const selectedOfferConfig = useMemo(
    () => PAYWALL_OFFERS.find((offer) => offer.code === selectedOffer) ?? PAYWALL_OFFERS[0],
    [selectedOffer]
  );
  const detectedSite = useMemo(() => detectSiteFromUrl(url), [url]);
  const renderedInsights = useMemo(
    () => normalizeRenderedStrings(displayPreview?.insights ?? []),
    [displayPreview]
  );
  const visibleInsights = useMemo(() => renderedInsights.slice(0, 2), [renderedInsights]);
  const renderedRecommendations = useMemo(
    () => normalizeRenderedStrings(displayPreview?.recommendations ?? []),
    [displayPreview]
  );
  const visibleRecommendation = useMemo(
    () => renderedRecommendations[0] ?? null,
    [renderedRecommendations]
  );
  const descriptionSubScore = useMemo(
    () => getSubScore(displayPreview?.subScores, "description"),
    [displayPreview]
  );
  const photoSubScore = useMemo(
    () => getSubScore(displayPreview?.subScores, "photos"),
    [displayPreview]
  );

  useEffect(() => {
    if (!displayPreview?.listing_url) return;

    const storedDraft = loadGuestAuditDraft(displayPreview.listing_url);
    if (!storedDraft || isGuestAuditDraftExpired(storedDraft)) return;

    saveGuestAuditDraft({
      ...storedDraft,
      selected_offer: selectedOffer,
    });
  }, [displayPreview?.listing_url, selectedOffer]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validation = validateGuestListingUrl(url);

    if (!validation.valid) {
      setError(validation.reason || "URL invalide");
      return;
    }

    const normalizedUrl = validation.normalizedUrl ?? url.trim();
    const existingDraft = loadGuestAuditDraft(normalizedUrl);

    if (existingDraft && !isGuestAuditDraftExpired(existingDraft) && existingDraft.full_payload) {
      setGuestAudit(buildPreviewFromDraft(existingDraft));
      setFastPreview(null);
      setIsBackgroundLoading(false);
      return;
    }

    setGuestAudit(null);
    setFastPreview(null);
    setIsBackgroundLoading(false);
    clearGuestAuditDraft(normalizedUrl);

    setIsSubmitting(true);
    setStepIndex(0);
    setProgress(10);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        const response = await fetch("/api/listings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            url: normalizedUrl,
            title,
            platform,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Impossible de lancer l’audit");
        }

        setProgress(100);

        window.setTimeout(() => {
          if (data?.auditId) {
            router.push(`/dashboard/audits/${data.auditId}`);
          } else {
            router.push("/dashboard/audits");
          }
        }, 350);

        return;
      }

      let resolved = false;
      const guestToken = getOrCreateGuestAuditToken();
      const fallbackPreview = buildFastPreview({
        url: normalizedUrl,
        title,
        platform,
      });

      saveGuestAuditDraft({
        guest_token: guestToken,
        listing_url: normalizedUrl,
        title,
        platform,
        selected_offer: selectedOffer,
        generated_at: new Date().toISOString(),
        status: "pending",
        payment_status: "unpaid",
        preview_payload: fallbackPreview,
        result: {
          score: fallbackPreview.score,
          insights: fallbackPreview.insights,
          recommendations: fallbackPreview.recommendations,
          raw_payload: fallbackPreview,
        },
      });

      const previewTimer = window.setTimeout(() => {
        if (resolved) return;
        setFastPreview(fallbackPreview);
        setIsSubmitting(false);
        setIsBackgroundLoading(true);
        setStepIndex(1);
        setProgress(68);
        saveGuestAuditDraft({
          guest_token: guestToken,
          listing_url: normalizedUrl,
          title,
          platform,
          selected_offer: selectedOffer,
          generated_at: new Date().toISOString(),
          status: "processing",
          payment_status: "unpaid",
          preview_payload: fallbackPreview,
          result: {
            score: fallbackPreview.score,
            insights: fallbackPreview.insights,
            recommendations: fallbackPreview.recommendations,
            raw_payload: fallbackPreview,
          },
        });
      }, 3500);

      const response = await fetch("/api/guest-audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const data = await response.json();
      resolved = true;
      window.clearTimeout(previewTimer);

      if (!response.ok) {
        throw new Error(data?.error || "Impossible de générer l’aperçu invité");
      }

      const preview = data?.guestAudit as GuestAuditPreview | undefined;

      if (!preview) {
        throw new Error("Aperçu invité introuvable");
      }

      setGuestAudit(preview);
      setFastPreview(null);
      setIsBackgroundLoading(false);
      saveGuestAuditDraft({
        guest_token: guestToken,
        listing_url: preview.listing_url,
        title: preview.title,
        platform: preview.platform,
        selected_offer: selectedOffer,
        generated_at: new Date().toISOString(),
        status: "completed",
        payment_status: "unpaid",
        preview_payload: fallbackPreview,
        full_payload: preview,
        result: {
          score: preview.score,
          insights: preview.insights,
          recommendations: preview.recommendations,
          raw_payload: preview,
        },
      });
      setProgress(100);
      setIsSubmitting(false);
    } catch (err) {
      setIsBackgroundLoading(false);
      setError(err instanceof Error ? err.message : "Une erreur inconnue est survenue");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="nk-section space-y-8 text-sm">
      <div className="nk-card nk-card-hover nk-page-header-card px-6 py-7 md:flex md:items-center md:justify-between md:gap-10 md:px-8">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted">Audit gratuit</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            Lancez un audit gratuit sans inscription
          </h1>
          <p className="nk-body-muted text-[15px] leading-relaxed text-slate-700">
            Collez l’URL publique de votre annonce pour obtenir un aperçu immédiat
            de sa performance. Connecté, l’audit est enregistré dans votre workspace.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 md:mt-0">
          <p className="font-semibold text-slate-900">
            {isAuthenticated ? "Mode compte connecté" : "Mode invité"}
          </p>
          <p className="mt-1 leading-5">
            {isAuthenticated
              ? "Votre audit sera enregistré et accessible depuis votre dashboard."
              : "Aperçu instantané, sans enregistrement en base de données."}
          </p>
        </div>
      </div>

      <div className="relative">
        {isSubmitting && isAuthenticated && (
          <AuditLaunchOverlay
            currentStep={currentStep}
            progress={progress}
            steps={LOADING_STEPS}
            stepIndex={stepIndex}
          />
        )}

        <div className={isSubmitting && isAuthenticated ? "pointer-events-none opacity-50" : ""}>
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_360px]">
            <div className="nk-card nk-card-hover p-6 md:p-7">
              <p className="nk-section-title">Paramètres de l’annonce</p>
              <p className="mt-1 text-xs text-slate-600">
                Utilisez l’URL publique exacte de votre annonce pour générer un audit
                cohérent et comparable.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">
                    URL de l’annonce
                  </label>
                  <input
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setError(null);
                      setGuestAudit(null);
                      clearGuestAuditDraft();
                    }}
                    type="url"
                    required
                    placeholder="https://www.airbnb.com/rooms/..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {url.trim() && (
                    <p className="mt-2 text-xs text-slate-500">
                      Plateforme detectee depuis l&apos;URL : {detectedSite.detectedSiteLabel}
                    </p>
                  )}
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
                    <option value="agoda">Agoda</option>
                    <option value="other">Autre</option>
                  </select>
                </div>

                {error && (
                  <div className="whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Analyse en cours..." : "Lancer l’audit gratuit"}
                  </button>

                  <span className="text-xs text-slate-500">
                    {isAuthenticated
                      ? "Audit enregistré dans votre dashboard"
                      : "Aperçu immédiat sans inscription"}
                  </span>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              {!isAuthenticated && (isSubmitting || isBackgroundLoading) && (
                <div className="nk-card nk-card-hover p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="nk-section-title">
                        {isBackgroundLoading ? "Aperçu rapide prêt" : "Analyse en cours..."}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {isBackgroundLoading
                          ? "Le score estimé est déjà visible. Nous continuons à charger la comparaison avec le marché et les détails complets."
                          : "Nous préparons une première lecture immédiate pendant que l'analyse complète avance en arrière-plan."}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {isBackgroundLoading ? "Comparaison avec le marché..." : "Analyse en cours..."}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="h-3 w-28 rounded-full bg-slate-200" />
                    <div className="h-12 rounded-2xl bg-slate-100" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="h-24 rounded-2xl bg-slate-100" />
                      <div className="h-24 rounded-2xl bg-slate-100" />
                    </div>
                  </div>
                </div>
              )}

              <div className="nk-card nk-card-hover p-6">
                <p className="nk-section-title">Ce que l’outil analyse</p>

                <ul className="mt-4 space-y-3 text-sm text-slate-800">
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Qualité et ordre des photos</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Qualité de la description et clarté du message</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Comparaison avec des annonces proches</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Leviers d’optimisation à plus fort impact</span>
                  </li>
                </ul>
              </div>

              <div className="nk-card nk-card-hover p-6">
                <p className="nk-section-title">Pourquoi commencer en invité</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Obtenez un aperçu concret de la qualité de votre annonce, puis créez
                  un compte pour débloquer le rapport complet et conserver l’historique.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {displayPreview && (!isAuthenticated || isRestoredDraftView) && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="nk-card nk-card-hover p-6">
            {isBackgroundLoading ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                Aperçu rapide affiché. Nous enrichissons le benchmark local et l&apos;analyse complète en arrière-plan.
              </div>
            ) : null}
            <p className="nk-section-title">Aperçu du résultat</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {displayPreview.title || "Annonce sans titre"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{displayPreview.listing_url}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
              Plateforme : {formatPlatformLabel(displayPreview.platform)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-medium ${getStatusChipClasses(
                  descriptionSubScore?.status ?? "unavailable"
                )}`}
              >
                {getDescriptionStatusLabel(descriptionSubScore)}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-medium ${getStatusChipClasses(
                  photoSubScore?.status ?? "unavailable"
                )}`}
              >
                {getPhotoStatusLabel(photoSubScore)}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Score global
                </p>
                <p className="mt-2 text-3xl font-semibold text-emerald-600">
                  {displayPreview.score.toFixed(1)}
                  <span className="text-base text-emerald-500"> / 10</span>
                </p>
                {displayPreview.estimatedRevenue && (
                  <p className="mt-2 text-xs leading-5 text-emerald-700">
                    {displayPreview.estimatedRevenue}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Lecture rapide
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-800">
                  {displayPreview.summary ?? "Donnée non disponible pour cette annonce."}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Insights visibles
              </p>
              {visibleInsights.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
                  {visibleInsights.map((insight) => (
                    <li key={insight} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      {insight}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                  Analyse partielle disponible en mode invité.
                </p>
              )}
            </div>

            {visibleRecommendation ? (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Recommandation visible
                </p>
                <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-slate-800">
                  {visibleRecommendation}
                </div>
              </div>
            ) : null}

            <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(241,245,249,0.92)_100%)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Suite de l&apos;analyse
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    Votre annonce a du potentiel, mais vous perdez des réservations.
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
                    Le reste du rapport détaille les sous-scores, le benchmark local complet et les
                    recommandations prioritaires pour améliorer la conversion.
                  </p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  🔒 Verrouille
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/90 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Sous-scores detailles
                  </p>
                  <div className="mt-3 space-y-3 blur-[3px] opacity-75">
                    <div className="space-y-2">
                      <div className="h-2.5 w-20 rounded-full bg-slate-200" />
                      <div className="h-2.5 w-full rounded-full bg-slate-100" />
                      <div className="h-2.5 w-4/5 rounded-full bg-slate-100" />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center bg-white/35">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                      🔒 Verrouille
                    </span>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/90 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Benchmark local complet
                  </p>
                  <div className="mt-3 space-y-3 blur-[3px] opacity-75">
                    <div className="grid gap-2">
                      <div className="h-8 rounded-xl bg-slate-100" />
                      <div className="h-8 rounded-xl bg-slate-100" />
                      <div className="h-8 rounded-xl bg-slate-100" />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center bg-white/35">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                      🔒 Verrouille
                    </span>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/90 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Recommandations actionnables
                  </p>
                  <div className="mt-3 space-y-3 blur-[3px] opacity-75">
                    <div className="space-y-2">
                      <div className="h-10 rounded-xl bg-slate-100" />
                      <div className="h-10 rounded-xl bg-slate-100" />
                      <div className="h-10 rounded-xl bg-slate-100" />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center bg-white/35">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                      🔒 Verrouille
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="nk-card nk-card-hover p-6">
            <div className="rounded-3xl border border-orange-200 bg-[linear-gradient(180deg,rgba(255,247,237,1)_0%,rgba(255,255,255,0.98)_100%)] p-6 shadow-[0_20px_50px_rgba(249,115,22,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                {isAuthenticated ? "Resultat restaure" : "Debloquez votre audit complet"}
              </p>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">
                {isAuthenticated
                  ? "Votre analyse calculee a ete retrouvee"
                  : "Continuez pour voir toute l&apos;analyse"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {isAuthenticated
                  ? "Nous avons reaffiche votre resultat local sans relancer une recherche complete."
                  : "Ce que vous allez débloquer :"}
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                <li>• benchmark local complet</li>
                <li>• recommandations priorisées</li>
                <li>• lecture détaillée des points faibles</li>
                <li>• historique de vos audits</li>
              </ul>

              <div className="mt-5 space-y-3">
                {PAYWALL_OFFERS.map((offer) => (
                  <button
                    key={offer.name}
                    type="button"
                    onClick={() => setSelectedOffer(offer.code)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition duration-150 ${
                      selectedOffer === offer.code
                        ? "border-orange-300 bg-white shadow-[0_16px_36px_rgba(249,115,22,0.12)] ring-2 ring-orange-200/70"
                        : offer.highlighted
                          ? "border-orange-200 bg-white/90 hover:border-orange-300"
                          : "border-slate-200 bg-white/80 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{offer.name}</p>
                        <p className="mt-1 text-[12px] leading-5 text-slate-600">{offer.detail}</p>
                        <p className="mt-2 text-[12px] leading-5 text-slate-700">{offer.note}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold tracking-tight text-slate-950">
                          {offer.price}
                        </p>
                        {offer.highlighted ? (
                          <span className="mt-1 inline-flex rounded-full bg-orange-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                            Recommande
                          </span>
                        ) : null}
                        {selectedOffer === offer.code ? (
                          <span className="mt-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            Selectionne
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5">
                {isAuthenticated ? (
                  <Link
                    href={`/dashboard/billing?source=audit-preview&offer=${selectedOffer}`}
                    className="nk-primary-btn w-full justify-center text-xs font-semibold uppercase tracking-[0.18em]"
                  >
                    {selectedOfferConfig.cta.replace("Continuer", "Continuer")}
                  </Link>
                ) : (
                  <>
                    <Link
                      href={`/sign-up?next=${encodeURIComponent(`/audit/new?restored=1&offer=${selectedOffer}`)}`}
                      className="nk-primary-btn w-full justify-center text-xs font-semibold uppercase tracking-[0.18em]"
                    >
                      {selectedOfferConfig.cta}
                    </Link>
                    <div className="mt-3">
                      <Link
                        href={`/sign-in?next=${encodeURIComponent(`/audit/new?restored=1&offer=${selectedOffer}`)}`}
                        className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
                      >
                        J&apos;ai déjà un compte
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function buildPreviewFromDraft(draft: GuestAuditDraft): GuestAuditPreview {
  const payloadCandidate =
    draft.full_payload ?? draft.preview_payload ?? draft.result.raw_payload ?? null;
  const rawPayload =
    payloadCandidate &&
    typeof payloadCandidate === "object" &&
    !Array.isArray(payloadCandidate)
      ? (payloadCandidate as {
          summary?: string | null;
          marketComparison?: string | null;
          estimatedRevenue?: string | null;
          bookingPotential?: string | null;
          occupancyObservation?: GuestAuditPreview["occupancyObservation"];
          marketPositioning?: GuestAuditPreview["marketPositioning"];
          subScores?: GuestAuditPreview["subScores"];
          insights?: string[];
          recommendations?: string[];
          score?: number;
          title?: string;
          listing_url?: string;
          platform?: string;
        })
      : null;

  return {
    listing_url: rawPayload?.listing_url ?? draft.listing_url,
    title: rawPayload?.title ?? draft.title ?? "Annonce sans titre",
    platform:
      rawPayload?.platform ??
      draft.platform ??
      detectPlatformFromUrl(rawPayload?.listing_url ?? draft.listing_url),
    score: rawPayload?.score ?? draft.result.score ?? 0,
    insights: rawPayload?.insights ?? draft.result.insights ?? [],
    recommendations: rawPayload?.recommendations ?? draft.result.recommendations ?? [],
    summary: rawPayload?.summary ?? null,
    marketComparison: rawPayload?.marketComparison ?? null,
    estimatedRevenue: rawPayload?.estimatedRevenue ?? null,
    bookingPotential: rawPayload?.bookingPotential ?? null,
    occupancyObservation: rawPayload?.occupancyObservation ?? null,
    marketPositioning: rawPayload?.marketPositioning ?? null,
    subScores: rawPayload?.subScores ?? [],
  };
}

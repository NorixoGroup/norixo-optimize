"use client";

import Link from "next/link";

import { GridStack } from "@/components/ui/GridStack";
import { HeroTitle } from "@/components/ui/HeroTitle";
import { SectionDescription } from "@/components/ui/SectionDescription";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SectionStack } from "@/components/ui/SectionStack";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

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
  rating?: number | null;
  reviewCount?: number | null;
  hostName?: string | null;
  hostInfo?: string | null;
  trustBadge?: string | null;
  fallbackUsed?: boolean;
  extractionFailed?: boolean;
  reason?: string;
  trustSignals?: {
    rating: number | null;
    reviewCount: number | null;
    hostName: string | null;
    trustBadge: string | null;
    extractionStatus: "complete" | "partial" | "blocked";
  } | null;
  trustInsight?: {
    score: number;
    label: string;
    summary: string;
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

function getSubScore(subScores: GuestAuditPreview["subScores"], key: string) {
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

function getDescriptionStatusLabel(subScore: ReturnType<typeof getSubScore>) {
  if (!subScore || subScore.status === "unavailable") {
    return "Description non récupérée";
  }
  if (subScore.status === "partial") {
    return "Description partielle";
  }
  return "Description complète";
}

function getPhotoStatusLabel(subScore: ReturnType<typeof getSubScore>) {
  if (!subScore || subScore.status === "unavailable") {
    return "Aucune photo détectée";
  }
  if (subScore.status === "partial") {
    return "Galerie partielle";
  }
  return "Galerie complète";
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
  const [selectedOffer, setSelectedOffer] = useState<
    (typeof PAYWALL_OFFERS)[number]["code"]
  >("audit_test");
  const activeSubmitIdRef = useRef(0);
  const previewTimerRef = useRef<number | null>(null);

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

      const initialUrl = searchParams.get("url")?.trim() ?? "";
      const isExplicitRestore = searchParams.get("restored") === "1";
      const shouldRestoreDraftResult =
        isExplicitRestore ||
        (initialUrl.length > 0 && initialUrl === storedDraft.listing_url);

      if (shouldRestoreDraftResult) {
        setGuestAudit(buildPreviewFromDraft(storedDraft));
      }

      if (storedDraft.selected_offer) {
        setSelectedOffer(
          storedDraft.selected_offer as (typeof PAYWALL_OFFERS)[number]["code"]
        );
      }
    }
  }, [searchParams]);

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

    if (
      initialOffer &&
      PAYWALL_OFFERS.some((offer) => offer.code === initialOffer)
    ) {
      setSelectedOffer(
        initialOffer as (typeof PAYWALL_OFFERS)[number]["code"]
      );
    }

    if (
      (!initialUrl || !initialTitle || !initialPlatform) &&
      typeof window !== "undefined"
    ) {
      const storedDraft = loadGuestAuditDraft();
      if (storedDraft && !isGuestAuditDraftExpired(storedDraft)) {
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
    // Synchronise uniquement si l’URL est non vide, détectée, différente et reconnue
    if (
      url &&
      detectedPlatform &&
      detectedPlatform !== platform &&
      detectedPlatform !== "other"
    ) {
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

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, []);

  const currentStep = useMemo(
    () => LOADING_STEPS[stepIndex] ?? LOADING_STEPS[0],
    [stepIndex]
  );
  const displayPreview = useMemo(
    () => guestAudit ?? fastPreview,
    [guestAudit, fastPreview]
  );
  const isProvisionalPreview = isBackgroundLoading && !guestAudit;
  const isAirbnbBlockedPreview = displayPreview?.reason === "airbnb_blocked";
  const isRestoredDraftView = useMemo(
    () => searchParams.get("restored") === "1",
    [searchParams]
  );
  const selectedOfferConfig = useMemo(
    () =>
      PAYWALL_OFFERS.find((offer) => offer.code === selectedOffer) ??
      PAYWALL_OFFERS[0],
    [selectedOffer]
  );
  const detectedSite = useMemo(() => detectSiteFromUrl(url), [url]);
  const renderedInsights = useMemo(
    () => normalizeRenderedStrings(displayPreview?.insights ?? []),
    [displayPreview]
  );
  const visibleInsights = useMemo(
    () => renderedInsights.slice(0, 2),
    [renderedInsights]
  );
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
    const submitId = activeSubmitIdRef.current + 1;
    activeSubmitIdRef.current = submitId;

    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
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

      if (submitId !== activeSubmitIdRef.current) {
        return;
      }

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

        if (submitId !== activeSubmitIdRef.current) {
          return;
        }

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

      previewTimerRef.current = window.setTimeout(() => {
        if (resolved || submitId !== activeSubmitIdRef.current) return;
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
      console.log("DEBUG API RESPONSE:", data);
      resolved = true;
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }

      if (submitId !== activeSubmitIdRef.current) {
        return;
      }

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
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      if (submitId !== activeSubmitIdRef.current) {
        return;
      }
      setIsBackgroundLoading(false);
      setError(
        err instanceof Error ? err.message : "Une erreur inconnue est survenue"
      );
      setIsSubmitting(false);
    }
  }

  if (displayPreview && (!isAuthenticated || isRestoredDraftView)) {
    const debugPreview = displayPreview as GuestAuditPreview &
      Record<string, unknown>;
    console.log("DEBUG displayPreview FULL:", displayPreview);
    console.log(
      "DEBUG rating metric:",
      displayPreview?.marketPositioning?.metrics
    );
    console.log("DEBUG raw_payload:", debugPreview?.raw_payload);
    console.log("DEBUG full_payload:", debugPreview?.full_payload);
    console.log("DEBUG preview_payload:", debugPreview?.preview_payload);
    console.log("DEBUG subject:", debugPreview?.subject);
  }

  return (
    <main className="nk-section space-y-7 text-sm md:space-y-9">
      <div className="nk-card nk-card-hover nk-page-header-card nk-border nk-card-lg w-full max-w-full overflow-x-hidden border border-slate-300/70 bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.12),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.12),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(15,23,42,0.12)] md:flex md:items-center md:justify-between md:gap-8 md:overflow-visible md:px-8 md:py-6">
        <div className="max-w-full min-w-0 space-y-3 md:max-w-2xl md:space-y-2">
          <p className="nk-kicker-muted inline-flex items-center gap-2 rounded-full border border-emerald-100/80 bg-white/80 px-3.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            Audit en mode invité
          </p>
          <HeroTitle className="mt-1 text-[1.7rem] tracking-tight md:text-[2.8rem]">
            Découvrez un premier aperçu de votre annonce
          </HeroTitle>
          <SectionDescription className="nk-body-muted mt-1 max-w-none text-[13px] leading-[1.45] md:max-w-xl md:text-[0.95rem] md:leading-6">
            Obtenez une première lecture structurée de la performance de votre
            annonce. Créez ensuite votre compte pour débloquer l’analyse complète
            et vos recommandations priorisées.
          </SectionDescription>
        </div>
        <div className="nk-card-sm mt-4 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/80 via-emerald-50/60 to-slate-50 px-3 py-2 text-[11px] text-slate-600 shadow-sm md:mt-0 md:px-4 md:py-2.5 md:text-xs">
          <p className="font-semibold text-slate-900">
            {isAuthenticated ? "Mode compte connecté" : "Mode invité"}
          </p>
          <p className="mt-1 leading-5">
            {isAuthenticated
              ? "Votre audit est enregistré et reste accessible depuis votre dashboard."
              : "Aperçu instantané, sans création de compte ni engagement."}
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
          <SectionStack size="md" className="mx-auto max-w-md space-y-6 md:max-w-none md:space-y-8">
            <Card
              variant="default"
              className="nk-card nk-card-hover nk-card-md nk-border border border-slate-300/70 space-y-6 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] ring-1 ring-emerald-50/90 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)] md:space-y-8 md:p-6"
            >
              <SectionTitle className="nk-section-title text-slate-900">
                Paramètres de l’annonce
              </SectionTitle>
              <SectionDescription className="mt-1 text-slate-600">
                Utilisez l’URL publique exacte de votre annonce pour générer un
                audit cohérent, comparable et directement exploitable.
              </SectionDescription>

              <form
                onSubmit={handleSubmit}
                className="mt-4 space-y-4 rounded-2xl border border-slate-300/75 bg-[radial-gradient(circle_at_top_left,rgba(226,232,240,0.7),transparent_55%),rgba(248,250,252,0.98)] px-3.5 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.85),0_12px_28px_rgba(15,23,42,0.07)] transition-colors duration-150 ease-out md:px-4 md:py-4"
              >
                <div>
                  <label className="mb-0.5 block text-sm font-medium text-slate-900">
                    URL de l’annonce
                  </label>
                  <input
                    value={url}
                    onChange={(e) => {
                      const previousListingUrl =
                        guestAudit?.listing_url ?? fastPreview?.listing_url ?? null;
                      const nextUrl = e.target.value;
                      activeSubmitIdRef.current += 1;
                      if (previewTimerRef.current) {
                        window.clearTimeout(previewTimerRef.current);
                        previewTimerRef.current = null;
                      }
                      setUrl(nextUrl);
                      setError(null);
                      setGuestAudit(null);
                      setFastPreview(null);
                      setIsBackgroundLoading(false);
                      setIsSubmitting(false);
                      if (previousListingUrl) {
                        clearGuestAuditDraft(previousListingUrl);
                      }
                    }}
                    type="url"
                    required
                    placeholder="https://www.airbnb.com/rooms/123456789"
                    className="w-full rounded-2xl border border-slate-300 bg-white/95 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all duration-150 ease-out placeholder:text-slate-500 hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/30 shadow-[0_1px_2px_rgba(15,23,42,0.06)] focus:shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_10px_30px_rgba(15,23,42,0.10)]"
                  />
                  {url.trim() && (
                    <p className="mt-2 text-xs text-slate-500">
                      Plateforme détectée depuis l&apos;URL :{" "}
                      {detectedSite.detectedSiteLabel}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-0.5 block text-sm font-medium text-slate-900">
                    Titre personnalisé (optionnel)
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    type="text"
                    placeholder="Studio moderne au centre de Guéliz avec balcon"
                    className="w-full rounded-2xl border border-slate-300 bg-white/95 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all duration-150 ease-out placeholder:text-slate-500 hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/30 shadow-[0_1px_2px_rgba(15,23,42,0.06)] focus:shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_10px_30px_rgba(15,23,42,0.10)]"
                  />
                </div>

                <div>
                  <label className="mb-0.5 block text-sm font-medium text-slate-900">
                    Plateforme
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white/95 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all duration-150 ease-out hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/30 shadow-[0_1px_2px_rgba(15,23,42,0.06)] focus:shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_10px_30px_rgba(15,23,42,0.10)]"
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

                <div className="flex flex-wrap items-center gap-3 pt-0.5">
                  <PrimaryButton
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] shadow-[0_14px_38px_rgba(249,115,22,0.42)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_18px_46px_rgba(249,115,22,0.5)]"
                  >
                    {isSubmitting ? "Analyse en cours..." : "Lancer l’audit"}
                  </PrimaryButton>

                  <span className="text-xs font-medium text-slate-600">
                    {isAuthenticated
                      ? "Audit complet enregistré dans votre dashboard"
                      : "Aperçu immédiat en mode invité, sans inscription"}
                  </span>
                </div>
              </form>
            </Card>

            <div className="space-y-6 md:space-y-8">
              <GridStack gap="md" className="md:grid-cols-2">
                <Card
                  variant="soft"
                  className="nk-card nk-card-hover nk-card-sm h-full min-h-[220px] border border-slate-300/70 bg-gradient-to-b from-white via-slate-50/70 to-white space-y-6 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.08)] ring-1 ring-emerald-50/90 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)] md:space-y-8 md:p-6"
                >
                  <SectionTitle className="nk-section-title text-slate-900">
                    Ce que l’outil analyse
                  </SectionTitle>

                  <ul className="mt-2 space-y-2 text-sm text-slate-800">
                    <li className="flex items-start gap-3.5">
                      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-200/70">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-current"
                        />
                      </span>
                      <span className="leading-6">
                        <span className="font-medium text-slate-900">
                          Qualité, ordre et lisibilité
                        </span>{" "}
                        de la galerie photo
                      </span>
                    </li>
                    <li className="flex items-start gap-3.5">
                      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-sm ring-1 ring-amber-200/70">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-current"
                        />
                      </span>
                      <span className="leading-6">
                        <span className="font-medium text-slate-900">
                          Clarté de la promesse
                        </span>{" "}
                        et qualité de la description
                      </span>
                    </li>
                    <li className="flex items-start gap-3.5">
                      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-100 text-blue-700 shadow-sm ring-1 ring-blue-200/70">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-current"
                        />
                      </span>
                      <span className="leading-6">
                        <span className="font-medium text-slate-900">
                          Positionnement
                        </span>{" "}
                        de l’annonce face aux offres proches
                      </span>
                    </li>
                    <li className="flex items-start gap-3.5">
                      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-violet-100 text-violet-700 shadow-sm ring-1 ring-violet-200/70">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-current"
                        />
                      </span>
                      <span className="leading-6">
                        <span className="font-medium text-slate-900">
                          Leviers d’optimisation
                        </span>{" "}
                        à plus fort impact sur la conversion
                      </span>
                    </li>
                  </ul>
                </Card>

                <Card
                  variant="soft"
                  className="nk-card nk-card-hover nk-card-sm h-full min-h-[220px] border border-amber-200/80 bg-gradient-to-b from-amber-50/85 via-amber-50/55 to-white space-y-6 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.08)] ring-1 ring-amber-50/80 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)] md:space-y-8 md:p-6"
                >

                  <SectionTitle className="nk-section-title mt-3 text-slate-900">
                    Pourquoi commencer en invité
                  </SectionTitle>

                  <ul className="mt-1.5 space-y-2 text-sm leading-6 text-slate-800">
                    <li className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full border border-amber-300 bg-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]" />
                      <span className="text-sm leading-6 text-slate-800">
                        Validez la valeur du rapport avant de créer un compte.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full border border-amber-300 bg-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]" />
                      <span className="text-sm leading-6 text-slate-800">
                        Passez en mode connecté pour conserver l’historique et
                        suivre vos optimisations.
                      </span>
                    </li>
                  </ul>
                </Card>
              </GridStack>
            </div>
          </SectionStack>
        </div>
      </div>

      {displayPreview && (!isAuthenticated || isRestoredDraftView) && (
        <div className="mx-auto grid max-w-md grid-cols-1 items-start gap-8 md:max-w-none md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          {isAirbnbBlockedPreview ? (
            <div className="nk-card nk-card-hover nk-card-lg nk-border rounded-2xl border border-emerald-300/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.72)_0%,rgba(255,247,237,0.7)_52%,rgba(255,255,255,0.98)_100%)] space-y-6 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-emerald-100/80 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_46px_rgba(15,23,42,0.12)] md:space-y-8 md:p-6">
              <div className="rounded-2xl border border-emerald-200/80 bg-white/85 px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                <SectionLabel className="nk-section-title text-lg text-emerald-700 tracking-widest uppercase mb-1">
                  APERÇU DU RÉSULTAT
                </SectionLabel>
                <h2 className="mt-3 text-2xl font-extrabold leading-tight text-slate-900 md:text-[2rem]">
                  Votre annonce est bien visible… mais certaines données avancées sont protégées
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  Nous avons détecté votre annonce, mais Airbnb limite l&apos;accès à certaines informations détaillées.
                </p>
              </div>

              <div className="rounded-2xl border border-orange-200/80 bg-white/90 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                  Valeur déjà disponible
                </p>
                <ul className="mt-3 space-y-2.5 text-sm font-medium text-slate-800">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Analyse partielle déjà disponible</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
                    <span>Benchmark complet accessible dans la version complète</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Recommandations personnalisées pour augmenter vos réservations</span>
                  </li>
                </ul>
              </div>

              <a
                href="#plan-action-premium"
                className="inline-flex w-full items-center justify-center rounded-xl border border-orange-500/80 bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(249,115,22,0.28)] transition-all duration-200 hover:scale-[1.01] hover:bg-orange-600"
              >
                Débloquer l’analyse complète
              </a>
            </div>
          ) : null}

          {!isAirbnbBlockedPreview && (
          <div className="nk-card nk-card-hover nk-card-lg nk-border rounded-2xl border border-slate-300/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] space-y-6 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-emerald-50/90 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_46px_rgba(15,23,42,0.12)] md:space-y-8 md:p-6">
              {isBackgroundLoading ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                Aperçu rapide affiché. Nous enrichissons le benchmark local et
                l&apos;analyse complète en arrière-plan.
              </div>
            ) : null}

            <div className="border-b border-slate-200/80 pb-4">
              <SectionLabel className="nk-section-title text-lg text-emerald-700 tracking-widest uppercase mb-1">
                APERÇU DU RÉSULTAT
              </SectionLabel>
                <h2 className="mt-3 text-3xl font-extrabold text-slate-900 leading-tight">
                  {title.trim() ? title.trim() : "Annonce analysée automatiquement"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 font-medium">
                  Résumé automatique de votre annonce
                </p>
                {(() => {
                  const ratingMetric = displayPreview.marketPositioning?.metrics?.find(
                    (metric) => metric.key === "rating"
                  );
                  const reviewsMetric = displayPreview.marketPositioning?.metrics?.find(
                    (metric) => metric.key === "reviews"
                  );

                  const previewWithMeta = displayPreview as GuestAuditPreview &
                    Record<string, unknown>;

                  const toRecord = (
                    value: unknown
                  ): Record<string, unknown> | null =>
                    value && typeof value === "object" && !Array.isArray(value)
                      ? (value as Record<string, unknown>)
                      : null;

                  const getByPath = (
                    source: Record<string, unknown>,
                    path: string
                  ): unknown => {
                    const keys = path.split(".");
                    let current: unknown = source;
                    for (const key of keys) {
                      const record = toRecord(current);
                      if (!record || !(key in record)) return null;
                      current = record[key];
                    }
                    return current;
                  };

                  const parseNumeric = (value: unknown): number | null => {
                    if (typeof value === "number" && Number.isFinite(value)) {
                      return value;
                    }
                    if (typeof value !== "string") return null;
                    const match = value.replace(",", ".").match(/-?\d+(?:[.,]\d+)?/);
                    if (!match) return null;
                    const parsed = Number(match[0].replace(",", "."));
                    return Number.isFinite(parsed) ? parsed : null;
                  };

                  const normalizeRatingToFive = (value: unknown): number | null => {
                    const parsed = parseNumeric(value);
                    if (parsed == null) return null;
                    const rawText = typeof value === "string" ? value.toLowerCase() : "";

                    if (rawText.includes("/10") || rawText.includes("sur 10")) {
                      return Math.min(5, Math.max(0, parsed / 2));
                    }
                    if (rawText.includes("/5") || rawText.includes("sur 5")) {
                      return Math.min(5, Math.max(0, parsed));
                    }
                    if (parsed <= 5) {
                      return Math.min(5, Math.max(0, parsed));
                    }
                    if (parsed <= 10) {
                      return Math.min(5, Math.max(0, parsed / 2));
                    }
                    return null;
                  };

                  const normalizeReviewCount = (value: unknown): number | null => {
                    if (typeof value === "number" && Number.isFinite(value)) {
                      return Math.max(0, Math.round(value));
                    }
                    if (typeof value !== "string") return null;
                    const cleaned = value.replace(/[^\d]/g, "");
                    if (!cleaned) return null;
                    const parsed = Number(cleaned);
                    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
                  };

                  const toText = (value: unknown): string | null =>
                    typeof value === "string" && value.trim() ? value.trim() : null;

                  const trustSignalsRecord = toRecord(previewWithMeta.trustSignals);
                  const trustSignalsExtractionStatusRaw = toText(
                    trustSignalsRecord?.extractionStatus
                  );
                  const trustSignalsExtractionStatus:
                    | "complete"
                    | "partial"
                    | "blocked"
                    | null =
                    trustSignalsExtractionStatusRaw === "complete" ||
                    trustSignalsExtractionStatusRaw === "partial" ||
                    trustSignalsExtractionStatusRaw === "blocked"
                      ? trustSignalsExtractionStatusRaw
                      : null;
                  const trustSignalsRating = normalizeRatingToFive(
                    trustSignalsRecord?.rating
                  );
                  const trustSignalsReviewCount = normalizeReviewCount(
                    trustSignalsRecord?.reviewCount
                  );
                  const trustSignalsHostName = toText(trustSignalsRecord?.hostName);
                  const trustSignalsBadge = toText(trustSignalsRecord?.trustBadge);

                  const candidateObjects: Record<string, unknown>[] = [previewWithMeta];
                  const nestedCandidates = [
                    previewWithMeta.raw_payload,
                    previewWithMeta.full_payload,
                    previewWithMeta.preview_payload,
                    toRecord(previewWithMeta.result)?.raw_payload,
                    previewWithMeta.subject,
                    previewWithMeta.host,
                    previewWithMeta.airbnb,
                  ];
                  for (const candidate of nestedCandidates) {
                    const record = toRecord(candidate);
                    if (record) {
                      candidateObjects.push(record);
                    }
                  }

                  const getCandidatesFromPaths = (paths: string[]) =>
                    candidateObjects.flatMap((source) =>
                      paths.map((path) => getByPath(source, path))
                    );

                  const ratingCandidates: unknown[] = [
                    ratingMetric?.subjectValue,
                    ...getCandidatesFromPaths([
                      "rating",
                      "overall_rating",
                      "overallRating",
                      "ratingValue",
                      "review_score",
                      "reviewScore",
                      "stars",
                    ]),
                  ];
                  const fallbackRatingOnFive =
                    ratingCandidates
                      .map((candidate) => normalizeRatingToFive(candidate))
                      .find((value) => value != null) ?? null;
                  const ratingOnFive =
                    trustSignalsRating ??
                    (trustSignalsExtractionStatus === "blocked"
                      ? null
                      : fallbackRatingOnFive);

                  const reviewCandidates: unknown[] = [
                    reviewsMetric?.subjectValue,
                    ...getCandidatesFromPaths([
                      "reviewCount",
                      "reviewsCount",
                      "review_count",
                      "reviews",
                      "numberOfReviews",
                      "totalReviews",
                      "commentsCount",
                    ]),
                  ];
                  const fallbackReviewCount =
                    reviewCandidates
                      .map((candidate) => normalizeReviewCount(candidate))
                      .find((value) => value != null) ?? null;
                  const reviewCount =
                    trustSignalsReviewCount ??
                    (trustSignalsExtractionStatus === "blocked"
                      ? null
                      : fallbackReviewCount);

                  const hostCandidates: unknown[] = [
                    ...getCandidatesFromPaths([
                      "hostInfo",
                      "hostName",
                      "host_info",
                      "host_name",
                      "host",
                      "host.name",
                      "host.value",
                      "host.displayName",
                      "name",
                      "displayName",
                    ]),
                  ];
                  const fallbackHostName =
                    hostCandidates
                      .map((candidate) => {
                        const direct = toText(candidate);
                        if (direct) return direct;
                        const record = toRecord(candidate);
                        if (!record) return null;
                        return (
                          toText(record.name) ??
                          toText(record.value) ??
                          toText(record.hostName) ??
                          toText(record.host_name) ??
                          toText(record.displayName) ??
                          null
                        );
                      })
                      .find((value) => value != null) ?? null;
                  const hostName =
                    trustSignalsHostName ??
                    (trustSignalsExtractionStatus === "blocked"
                      ? null
                      : fallbackHostName);

                  const normalizeTextForMatch = (value: string) =>
                    value
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "");

                  const extractBadgeLabel = (raw: unknown): string | null => {
                    if (raw === true) return "Superhôte";
                    if (raw === false || raw == null) return null;

                    const textCandidates: string[] = [];
                    const pushText = (value: unknown) => {
                      const text = toText(value);
                      if (text) textCandidates.push(text);
                    };

                    pushText(raw);
                    if (Array.isArray(raw)) {
                      raw.forEach((item) => {
                        pushText(item);
                        const itemRecord = toRecord(item);
                        if (itemRecord) {
                          pushText(itemRecord.label);
                          pushText(itemRecord.name);
                          pushText(itemRecord.title);
                          pushText(itemRecord.text);
                          pushText(itemRecord.value);
                        }
                      });
                    }

                    const record = toRecord(raw);
                    if (record) {
                      pushText(record.label);
                      pushText(record.name);
                      pushText(record.title);
                      pushText(record.text);
                      pushText(record.value);
                    }

                    for (const text of textCandidates) {
                      const normalized = normalizeTextForMatch(text);
                      if (
                        normalized.includes("superhost") ||
                        normalized.includes("super hote") ||
                        normalized.includes("superhote")
                      ) {
                        return "Superhôte";
                      }
                      if (
                        normalized.includes("coup de coeur") ||
                        normalized.includes("guest favorite")
                      ) {
                        return "Coup de cœur voyageurs";
                      }
                      if (
                        normalized.includes("logement prefere") ||
                        normalized.includes("hebergement prefere") ||
                        normalized.includes("prefere des voyageurs")
                      ) {
                        return "Logement préféré des voyageurs";
                      }
                    }

                    return null;
                  };

                  const badgeCandidates: unknown[] = [
                    ...getCandidatesFromPaths([
                      "badge",
                      "badgeLabel",
                      "trustBadge",
                      "trust_badge",
                      "airbnbBadge",
                      "airbnb_badge",
                      "guestFavorite",
                      "guest_favorite",
                      "isSuperhost",
                      "superhost",
                      "highlights",
                      "badges",
                      "labels",
                      "tags",
                    ]),
                  ];
                  const fallbackTrustBadgeLabel =
                    badgeCandidates
                      .map((candidate) => extractBadgeLabel(candidate))
                      .find((value) => value != null) ?? null;
                  const trustBadgeLabel =
                    trustSignalsBadge ??
                    (trustSignalsExtractionStatus === "blocked"
                      ? null
                      : fallbackTrustBadgeLabel);

                  const hasRating = ratingOnFive != null;
                  const hasReviews = reviewCount != null;
                  const hasHost = hostName != null;
                  const hasBadge = trustBadgeLabel != null;
                  const hasAnyTrustSignal =
                    hasRating || hasReviews || hasHost || hasBadge;

                  const trustTitle =
                    trustSignalsExtractionStatus === "blocked"
                      ? "Certaines informations Airbnb sont protégées"
                      : trustSignalsExtractionStatus === "partial"
                        ? hasAnyTrustSignal
                          ? "Annonce avec signaux partiels de confiance"
                          : "Informations Airbnb partiellement disponibles"
                        : hasBadge
                          ? "Annonce avec premiers signaux de confiance"
                          : hasRating && hasReviews
                            ? "Annonce bien notée par les voyageurs"
                            : hasHost
                              ? "Hôte identifié sur l’annonce"
                              : "Certaines informations ne sont pas disponibles";

                  const trustCaption =
                    trustSignalsExtractionStatus === "blocked"
                      ? "Certaines données détaillées restent protégées sur Airbnb."
                      : trustSignalsExtractionStatus === "partial"
                        ? hasAnyTrustSignal
                          ? "Nous affichons les informations fiables déjà récupérées sur l’annonce."
                          : "Certaines informations publiques n'ont pas pu être récupérées intégralement."
                        : hasRating && hasReviews && hasHost
                          ? "Données issues directement de votre annonce Airbnb"
                          : hasAnyTrustSignal
                            ? "Informations visibles par les voyageurs sur la plateforme"
                            : "Certaines informations publiques n'ont pas pu être récupérées.";

                  return (
                    <div className="mt-4 rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50 via-amber-50/45 to-white px-4 py-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                      <span className="inline-flex rounded-full border border-emerald-400/70 bg-emerald-200/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-900">
                        {trustTitle}
                      </span>
                      <div className="mt-3 space-y-1 text-slate-900">
                        {trustBadgeLabel ? (
                          <p className="inline-flex rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
                            {trustBadgeLabel}
                          </p>
                        ) : null}
                        {hasRating ? (
                          <p className="flex items-center gap-2 text-lg font-bold leading-tight text-slate-900">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/80 bg-amber-100 text-amber-700 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]">
                              <svg
                                viewBox="0 0 20 20"
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                                fill="currentColor"
                              >
                                <path d="M10 2.2l2 4.08 4.5.65-3.25 3.16.77 4.46L10 12.4 6 14.55l.77-4.46L3.52 6.93l4.48-.65L10 2.2z" />
                              </svg>
                            </span>
                            <span>{`${ratingOnFive.toFixed(1)} / 5`}</span>
                          </p>
                        ) : null}
                        {!hasRating &&
                        !hasAnyTrustSignal &&
                        trustSignalsExtractionStatus == null ? (
                          <p className="text-lg font-bold leading-tight text-slate-900">
                            Note indisponible
                          </p>
                        ) : null}
                        {hasReviews ? (
                          <p className="text-sm font-medium text-slate-600">
                            {`${reviewCount.toLocaleString("fr-FR")} avis`}
                          </p>
                        ) : null}
                        {!hasReviews &&
                        !hasAnyTrustSignal &&
                        trustSignalsExtractionStatus == null ? (
                          <p className="text-sm font-medium text-slate-600">
                            Avis indisponibles
                          </p>
                        ) : null}
                        {!hasAnyTrustSignal &&
                        trustSignalsExtractionStatus === "partial" ? (
                          <p className="text-sm font-medium text-slate-600">
                            Données Airbnb partiellement disponibles
                          </p>
                        ) : null}
                        {!hasAnyTrustSignal &&
                        trustSignalsExtractionStatus === "blocked" ? (
                          <p className="text-sm font-medium text-slate-600">
                            Certaines informations détaillées sont protégées sur Airbnb
                          </p>
                        ) : null}
                        {hasHost ? (
                          <p className="text-xs font-medium text-slate-500">
                            Hôte : {hostName}
                          </p>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        {trustCaption}
                      </p>
                    </div>
                  );
                })()}

              <div className="mt-6 md:mt-8">
                <div className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-orange-400 bg-gradient-to-br from-orange-100 via-orange-50 to-white px-6 py-6 text-center text-orange-800 shadow-[0_16px_34px_rgba(249,115,22,0.18)]">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-orange-300 bg-orange-100/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75)]">
                    <span className="h-3 w-3 rounded-full bg-orange-500 shadow-[0_0_0_5px_rgba(249,115,22,0.2)]" />
                  </span>
                  <p className="text-lg font-bold leading-tight md:text-[1.15rem]">
                    Des voyageurs consultent votre annonce… mais ne réservent pas.
                  </p>
                  <span className="mt-1 text-xs font-semibold text-orange-700">
                    Le rapport complet vous montre comment débloquer plus de réservations.
                  </span>
                </div>
              </div>

              <a
                href={displayPreview.listing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
              >
                Voir l’annonce analysée
                <svg
                  viewBox="0 0 20 20"
                  className="h-3 w-3"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M8 6h6v6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 14L14 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <p className="nk-text-secondary mt-1 text-xs uppercase tracking-[0.16em]">
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
            </div>

            <div className="space-y-6 pt-6 md:space-y-8 md:pt-8">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="nk-card-highlight flex h-full flex-col justify-between rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/60 p-4 shadow-[0_10px_26px_rgba(16,185,129,0.09)] md:p-6">
                  <SectionLabel className="mb-1 text-base font-bold uppercase tracking-wide text-emerald-700">SCORE GLOBAL</SectionLabel>
                  {isProvisionalPreview ? (
                    <span className="mt-2 inline-flex w-fit rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
                      Score provisoire
                    </span>
                  ) : null}
                  <p className="mt-3 text-5xl font-extrabold text-emerald-600 drop-shadow-sm">
                    {isProvisionalPreview ? "…" : displayPreview.score.toFixed(1)}
                    <span className="text-2xl text-emerald-400 font-bold"> / 10</span>
                  </p>
                  <p className="mt-2 text-xs font-semibold text-emerald-700">
                    {isProvisionalPreview
                      ? "Score en cours de consolidation avec l’analyse complète"
                      : "Bon score… mais encore loin d’un niveau optimal"}
                  </p>
                  <p className="mt-1 text-xs text-orange-600 font-medium">
                    {isProvisionalPreview
                      ? "→ Le score final sera affiché dès la fin de l’analyse"
                      : "→ Des réservations passent encore à côté"}
                  </p>
                  {!isProvisionalPreview && displayPreview.estimatedRevenue && (
                    <p className="mt-2 text-xs leading-5 text-emerald-700">
                      {displayPreview.estimatedRevenue}
                    </p>
                  )}
                </div>

                <div className="nk-card-sm nk-border flex h-full flex-col rounded-2xl border border-slate-300/75 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.07)] md:p-6">
                  <SectionLabel className="mb-1 text-[15px] font-bold uppercase tracking-wide text-slate-900">Analyse instantanée</SectionLabel>
                  <p className="mt-2 text-base font-semibold leading-7 text-slate-800">
                    {displayPreview.summary ??
                      "Votre annonce présente un bon potentiel mais peut encore progresser."}
                  </p>
                </div>
              </div>

              {displayPreview.trustInsight ? (
                <div
                  className={`rounded-2xl border p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] md:p-5 ${
                    displayPreview.trustInsight.score < 40
                      ? "border-rose-200 bg-rose-50/70"
                      : displayPreview.trustInsight.score < 60
                        ? "border-amber-200 bg-amber-50/75"
                        : displayPreview.trustInsight.score < 80
                          ? "border-emerald-200 bg-emerald-50/70"
                          : "border-emerald-300 bg-emerald-50"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Confiance
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-semibold text-slate-900">
                      {displayPreview.trustInsight.label}
                    </p>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        displayPreview.trustInsight.score < 40
                          ? "border-rose-200 bg-rose-100 text-rose-700"
                          : displayPreview.trustInsight.score < 60
                            ? "border-amber-200 bg-amber-100 text-amber-700"
                            : "border-emerald-200 bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {displayPreview.trustInsight.score}/100
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {displayPreview.trustInsight.summary}
                  </p>
                </div>
              ) : null}

              <div>
                <SectionLabel>Ce que vous découvrez déjà</SectionLabel>
                {visibleInsights.length > 0 ? (
                  <>
                    <p className="mt-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Ce que vous faites bien… mais pas encore optimisé
                    </p>
                    <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                    {visibleInsights.map((insight, i) => (
                      <li
                        key={insight}
                        className="flex items-start gap-3.5 rounded-xl border border-slate-300/80 bg-gradient-to-b from-white to-slate-50/80 px-4 py-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.1)]"
                      >
                        {i % 2 === 0 ? (
                          <span className="mt-1 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                            <svg
                              viewBox="0 0 20 20"
                              className="h-4 w-4"
                              aria-hidden="true"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path d="M4.5 10.5l3.2 3.2 7.8-7.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        ) : (
                          <span className="mt-1 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                            <svg
                              viewBox="0 0 20 20"
                              className="h-4 w-4"
                              aria-hidden="true"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            >
                              <circle cx="9" cy="9" r="4.3" />
                              <path d="M12.5 12.5L16 16" strokeLinecap="round" />
                            </svg>
                          </span>
                        )}
                        <span className="font-semibold leading-6 text-slate-900">{insight}</span>
                      </li>
                    ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-3 rounded-2xl border border-slate-300/75 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                    Analyse partielle disponible en mode invité.
                  </p>
                )}
              </div>

              {visibleRecommendation ? (
                <div>
                  <SectionLabel className="text-orange-700 font-bold">
                    Action immédiate recommandée
                  </SectionLabel>
                  <div className="nk-card-sm mt-3 rounded-2xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 via-white to-orange-100 p-5 text-orange-800 shadow-[0_12px_28px_rgba(249,115,22,0.2)] md:p-6">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                      Correction rapide = impact direct sur vos réservations
                    </p>
                    <p className="text-base font-semibold leading-7 text-orange-900 md:text-lg">
                      {visibleRecommendation}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 font-medium">
                Certaines optimisations simples peuvent faire la différence entre une annonce vue… et une annonce réservée.
              </div>

              <div className="nk-card-lg nk-border rounded-3xl border border-slate-300/75 bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(241,245,249,0.96)_100%)] space-y-6 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.07)] md:space-y-8 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <SectionLabel>Débloquez l’analyse complète</SectionLabel>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      Vous avez déjà une bonne base… mais vous perdez des réservations chaque semaine.
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Le rapport complet vous montre exactement où vous perdez des revenus — et comment les récupérer rapidement.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-700">
                      <svg
                        viewBox="0 0 20 20"
                        className="h-2.5 w-2.5"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M6.5 9V7.8a3.5 3.5 0 117 0V9" strokeLinecap="round" />
                        <rect x="5.2" y="9" width="9.6" height="7.2" rx="1.6" />
                      </svg>
                    </span>
                    Verrouillé
                  </span>
                </div>

                <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-3">
                  <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white/90 px-4 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                    <SectionLabel>Sous-scores détaillés</SectionLabel>
                    <div className="mt-3 space-y-3 opacity-90 blur-[1px]">
                      <div className="space-y-2">
                        <div className="h-2.5 w-20 rounded-full bg-slate-300" />
                        <div className="h-2.5 w-full rounded-full bg-slate-200" />
                        <div className="h-2.5 w-4/5 rounded-full bg-slate-200" />
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center bg-gradient-to-b from-white/10 via-white/35 to-white/65">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-600">
                          <svg
                            viewBox="0 0 20 20"
                            className="h-2.5 w-2.5"
                            aria-hidden="true"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M6.5 9V7.8a3.5 3.5 0 117 0V9" strokeLinecap="round" />
                            <rect x="5.2" y="9" width="9.6" height="7.2" rx="1.6" />
                          </svg>
                        </span>
                        Verrouillé
                      </span>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white/90 px-4 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                    <SectionLabel>Benchmark local complet</SectionLabel>
                    <div className="mt-3 space-y-3 opacity-90 blur-[1px]">
                      <div className="grid gap-2">
                        <div className="h-8 rounded-xl bg-slate-200" />
                        <div className="h-8 rounded-xl bg-slate-200" />
                        <div className="h-8 rounded-xl bg-slate-200" />
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center bg-gradient-to-b from-white/10 via-white/35 to-white/65">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-600">
                          <svg
                            viewBox="0 0 20 20"
                            className="h-2.5 w-2.5"
                            aria-hidden="true"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M6.5 9V7.8a3.5 3.5 0 117 0V9" strokeLinecap="round" />
                            <rect x="5.2" y="9" width="9.6" height="7.2" rx="1.6" />
                          </svg>
                        </span>
                        Verrouillé
                      </span>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white/90 px-4 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                    <SectionLabel>Recommandations actionnables</SectionLabel>
                    <div className="mt-3 space-y-3 opacity-90 blur-[1px]">
                      <div className="space-y-2">
                        <div className="h-10 rounded-xl bg-slate-200" />
                        <div className="h-10 rounded-xl bg-slate-200" />
                        <div className="h-10 rounded-xl bg-slate-200" />
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center bg-gradient-to-b from-white/10 via-white/35 to-white/65">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-600">
                          <svg
                            viewBox="0 0 20 20"
                            className="h-2.5 w-2.5"
                            aria-hidden="true"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M6.5 9V7.8a3.5 3.5 0 117 0V9" strokeLinecap="round" />
                            <rect x="5.2" y="9" width="9.6" height="7.2" rx="1.6" />
                          </svg>
                        </span>
                        Verrouillé
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              </div>
          </div>
          )}

          <div className="space-y-8 md:space-y-10">
            <div id="plan-action-premium" className="nk-card nk-card-hover nk-card-lg rounded-2xl border border-slate-200 bg-white space-y-6 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-0.5 md:space-y-8 md:p-6">
              <Card
                variant="pricing"
                className="p-4 shadow-none backdrop-blur-sm md:p-6"
              >
              <p className="text-xs font-medium text-slate-500">
                Plan d’action premium
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {isAuthenticated
                  ? "Votre analyse calculée a été retrouvée"
                  : "Débloquez le plan d’action complet de votre annonce"}
              </h2>
              <SectionDescription className="mt-2 text-sm text-slate-500">
                {isAuthenticated
                  ? "Nous avons réaffiché votre résultat local sans relancer une analyse complète."
                  : "Ce que vous débloquez immédiatement :"}
              </SectionDescription>

              <ul className="mt-6 rounded-xl border border-slate-100 bg-white px-4 text-sm md:mt-8">
                <li className="flex items-start gap-3.5 border-b border-slate-100 py-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <circle cx="10" cy="10" r="5.8" />
                      <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">Plan d’action complet</p>
                    <p className="text-xs text-slate-500">
                      Ordre exact des actions à appliquer pour améliorer la conversion.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5 border-b border-slate-100 py-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M4 6.2h12" strokeLinecap="round" />
                      <path d="M6 10h8" strokeLinecap="round" />
                      <path d="M8 13.8h4" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">Priorisation claire</p>
                    <p className="text-xs text-slate-500">
                      Quoi faire maintenant, quoi faire ensuite, et pourquoi.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5 border-b border-slate-100 py-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M5.2 4.5h9.6a1 1 0 011 1v9a1 1 0 01-1 1H5.2a1 1 0 01-1-1v-9a1 1 0 011-1z" />
                      <path d="M6.8 12l2-2.2 1.6 1.2 2.8-3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">Rapport complet actionnable</p>
                    <p className="text-xs text-slate-500">
                      Au-delà de l’aperçu affiché à gauche.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5 py-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <circle cx="10" cy="10" r="5.6" />
                      <path d="M10 6.9v3.3l2.2 1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">Suivi historique</p>
                    <p className="text-xs text-slate-500">
                      Pour suivre vos progrès annonce par annonce.
                    </p>
                  </div>
                </li>
              </ul>

              <div className="mt-6 space-y-6 md:mt-8 md:space-y-8">
                <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-center">
                  <p className="text-sm font-bold text-orange-900">
                    Vous perdez des réservations chaque semaine
                  </p>
                  <p className="mt-1 text-xs font-medium text-orange-800">
                    Votre annonce est vue… mais vos concurrents convertissent mieux.
                  </p>
                  <p className="mt-1 text-xs text-orange-700">
                    Quelques optimisations peuvent augmenter vos revenus rapidement.
                  </p>
                </div>
                <div className="space-y-3">
                  {PAYWALL_OFFERS.map((offer) => (
                    <button
                      key={offer.name}
                      type="button"
                      onClick={() => setSelectedOffer(offer.code)}
                      className={`w-full rounded-2xl text-left transition-all duration-200 ${
                        offer.highlighted
                          ? "nk-card-highlight border border-orange-300 bg-orange-50/70 px-4 py-4 shadow-sm md:scale-[1.01] md:px-5 md:py-5"
                          : "nk-card-sm border border-slate-200 bg-white px-3.5 py-3 shadow-sm hover:border-orange-300 hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)] md:px-4 md:py-4"
                      } ${
                        selectedOffer === offer.code
                          ? "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-200 shadow-[0_10px_24px_rgba(16,185,129,0.18)]"
                          : offer.highlighted
                            ? "hover:border-orange-500"
                            : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 md:gap-5">
                        <div className="min-w-0 flex-1 pr-1">
                          <p className="text-sm font-semibold leading-5 text-slate-900">
                            {offer.name}
                          </p>
                          <p className="mt-1 text-[12px] leading-5 text-slate-600">
                            {offer.detail} — <b>{offer.name === "Audit test" ? "1 annonce" : offer.name === "Pack 5 audits" ? "5 annonces" : "15 annonces"}</b>
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-emerald-700">
                            Toutes les fonctionnalités incluses. Seule la quantité d’annonces change.
                          </p>
                          <p className="mt-2 text-[11px] leading-5 text-slate-600">
                            {offer.note}
                          </p>
                        </div>
                        <div className="shrink-0 space-y-1 text-right">
                          <p className="text-2xl font-semibold leading-none tracking-tight text-slate-950">
                            {offer.price}
                          </p>
                          {offer.highlighted ? (
                            <>
                              <span className="mt-1 inline-flex rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                                Recommandé
                              </span>
                              <p className="mt-1 max-w-[170px] text-[11px] font-medium leading-4 text-slate-500">
                                Choisi par les hôtes qui veulent maximiser leurs revenus
                              </p>
                            </>
                          ) : null}
                          {selectedOffer === offer.code ? (
                            <span className="mt-2 inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                              Sélectionné
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 md:mt-8">
                <p className="mb-3 mt-6 text-center text-xs text-orange-700 md:mt-8">
                  Sans plan d’action clair, vous laissez des réservations à vos concurrents.
                </p>
                <p className="mb-2 text-center text-xs font-medium text-slate-600">
                  Accès immédiat • Résultat en moins de 30 secondes
                </p>
                {isAuthenticated ? (
                  <Link
                    href={`/dashboard/billing?source=audit-preview&offer=${selectedOffer}`}
                    aria-label={`Débloquer mes réservations maintenant - ${selectedOfferConfig.name}`}
                    className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-orange-500/80 bg-orange-500 px-6 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_14px_30px_rgba(249,115,22,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70 md:h-[50px] md:px-7"
                  >
                    Débloquer mes réservations maintenant
                  </Link>
                ) : (
                  <>
                    <Link
                      href={`/sign-up?next=${encodeURIComponent(
                        `/audit/new?restored=1&offer=${selectedOffer}`
                      )}`}
                      aria-label={`Débloquer mes réservations maintenant - ${selectedOfferConfig.name}`}
                      className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-orange-500/80 bg-orange-500 px-6 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_14px_30px_rgba(249,115,22,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70 md:h-[50px] md:px-7"
                    >
                      Débloquer mes réservations maintenant
                    </Link>
                    <div className="mt-2.5 text-center md:mt-3">
                      <Link
                        href={`/sign-in?next=${encodeURIComponent(
                          `/audit/new?restored=1&offer=${selectedOffer}`
                        )}`}
                        className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
                      >
                        J&apos;ai déjà un compte
                      </Link>
                    </div>
                  </>
                )}
                <div className="mt-6 border-t border-slate-200" />
                <div className="mt-6 space-y-1 text-center text-xs text-slate-500">
                  <p className="flex items-center justify-center gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <svg
                        viewBox="0 0 20 20"
                        className="h-2.5 w-2.5"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path
                          d="M5.2 10.3l2.2 2.3 7-7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    Accès immédiat après paiement
                  </p>
                  <p className="flex items-center justify-center gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <svg
                        viewBox="0 0 20 20"
                        className="h-2.5 w-2.5"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path
                          d="M5.2 10.3l2.2 2.3 7-7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    Aucune compétence technique requise
                  </p>
                  <p className="flex items-center justify-center gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <svg
                        viewBox="0 0 20 20"
                        className="h-2.5 w-2.5"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path
                          d="M5.2 10.3l2.2 2.3 7-7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    Résultats concrets en quelques minutes
                  </p>
                </div>
                <p className="mt-3 text-center text-[11px] text-slate-400">
                  Paiement sécurisé • Sans engagement
                </p>
              </div>
              </Card>
            </div>

            <div className="w-full min-h-[280px] rounded-2xl border border-slate-200 bg-gradient-to-b from-white via-slate-50/40 to-slate-50/80 p-7 shadow-[0_20px_48px_rgba(15,23,42,0.08)] md:min-h-[320px] md:p-8">
              <div className="flex h-full flex-col">
                <h3 className="text-[1.15rem] font-semibold leading-7 text-slate-900">
                  Ce que vous allez récupérer
                </h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Le rapport complet vous aide à transformer une annonce correcte
                  en annonce qui convertit mieux.
                </p>

                <ul className="mt-6 space-y-4">
                  <li className="flex items-start gap-3.5 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                      >
                        <path
                          d="M4.8 10.2l2.7 2.8 7.2-7.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <p className="text-sm font-semibold text-slate-900">
                      Plus de clarté sur les points faibles
                    </p>
                  </li>
                  <li className="flex items-start gap-3.5 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M4.5 6.3h11" strokeLinecap="round" />
                        <path d="M6.3 10h7.4" strokeLinecap="round" />
                        <path d="M8 13.7h4" strokeLinecap="round" />
                      </svg>
                    </span>
                    <p className="text-sm font-semibold text-slate-900">
                      Un plan d’action priorisé
                    </p>
                  </li>
                  <li className="flex items-start gap-3.5 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M5.2 5.2h9.6v9.6H5.2z" />
                        <path
                          d="M7 10.2l2 2 4-4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <p className="text-sm font-semibold text-slate-900">
                      Des optimisations applicables rapidement
                    </p>
                  </li>
                </ul>

                <div className="mt-auto border-t border-slate-200/80 pt-5">
                  <p className="text-xs font-medium text-slate-500">
                    Lecture simple • Actions concrètes • Impact visible
                  </p>
                </div>
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
    recommendations:
      rawPayload?.recommendations ?? draft.result.recommendations ?? [],
    summary: rawPayload?.summary ?? null,
    marketComparison: rawPayload?.marketComparison ?? null,
    estimatedRevenue: rawPayload?.estimatedRevenue ?? null,
    bookingPotential: rawPayload?.bookingPotential ?? null,
    occupancyObservation: rawPayload?.occupancyObservation ?? null,
    marketPositioning: rawPayload?.marketPositioning ?? null,
    subScores: rawPayload?.subScores ?? [],
  };
}

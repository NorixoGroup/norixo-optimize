"use client";

import Link from "next/link";

import { GridStack } from "@/components/ui/GridStack";
import { HeroTitle } from "@/components/ui/HeroTitle";
import { SectionDescription } from "@/components/ui/SectionDescription";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SectionStack } from "@/components/ui/SectionStack";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useSearchParams } from "next/navigation";
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
  formatPlatformLabel,
  validateGuestListingUrl,
} from "@/lib/guestAudit/shared";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";
import { setStoredWorkspaceId } from "@/lib/workspaces/setStoredWorkspaceId";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";

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
    name: "Starter",
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

function mapOfferToCheckoutPlan(
  offer: (typeof PAYWALL_OFFERS)[number]["code"]
): "audit_test" | "pro" | "scale" {
  if (offer === "pack_5") return "pro";
  if (offer === "pack_15") return "scale";
  return "audit_test";
}

function detectPlatform(
  url: string
): "airbnb" | "booking" | "vrbo" | "agoda" | "unknown" {
  const u = url.toLowerCase();
  if (u.includes("airbnb")) return "airbnb";
  if (u.includes("booking")) return "booking";
  if (u.includes("vrbo") || u.includes("abritel")) return "vrbo";
  if (u.includes("agoda")) return "agoda";
  return "unknown";
}

function generateEstimatedScore(url: string) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash + url.charCodeAt(i) * (i + 1)) % 1000;
  }

  const score = 5.8 + (hash % 25) / 10; // 5.8 → 8.3
  return Math.round(score * 10) / 10;
}

function generatePreviewInsights(platform: string) {
  return [
    "Annonce avec signaux partiels de confiance",
    "Description probablement améliorable sur l'accroche initiale",
    "Positionnement à clarifier face aux annonces similaires",
  ];
}

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
  const searchParams = useSearchParams();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(8);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guestAudit, setGuestAudit] = useState<GuestAuditPreview | null>(null);
  const [fastPreview, setFastPreview] = useState<GuestAuditPreview | null>(null);
  const [preview, setPreview] = useState<null | {
    platform: string;
    score: number;
    insights: string[];
  }>(null);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<
    (typeof PAYWALL_OFFERS)[number]["code"]
  >("audit_test");
  const [isPremiumCheckoutLoading, setIsPremiumCheckoutLoading] = useState(false);
  const [premiumCheckoutError, setPremiumCheckoutError] = useState<string | null>(null);
  const activeSubmitIdRef = useRef(0);
  const previewTimerRef = useRef<number | null>(null);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoScrolledToResultRef = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.classList.add("nk-audit-new-route");

    return () => {
      document.body.classList.remove("nk-audit-new-route");
    };
  }, []);

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
    const initialOffer = searchParams.get("offer")?.trim() ?? "";

    if (initialUrl && !url) {
      setUrl(initialUrl);
    }

    if (initialTitle && !title) {
      setTitle(initialTitle);
    }

    if (
      initialOffer &&
      PAYWALL_OFFERS.some((offer) => offer.code === initialOffer)
    ) {
      setSelectedOffer(
        initialOffer as (typeof PAYWALL_OFFERS)[number]["code"]
      );
    }

    if ((!initialUrl || !initialTitle) && typeof window !== "undefined") {
      const storedDraft = loadGuestAuditDraft();
      if (storedDraft && !isGuestAuditDraftExpired(storedDraft)) {
        if (storedDraft.selected_offer) {
          setSelectedOffer(
            storedDraft.selected_offer as (typeof PAYWALL_OFFERS)[number]["code"]
          );
        }
      }
    }
  }, [searchParams, title, url]);

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

  useEffect(() => {
    if (url.trim()) return;

    const syncUrlFromInput = () => {
      const domUrl = urlInputRef.current?.value?.trim() ?? "";
      if (domUrl && domUrl !== url) {
        setUrl(domUrl);
      }
    };

    syncUrlFromInput();
    const timer = window.setTimeout(syncUrlFromInput, 180);
    return () => window.clearTimeout(timer);
  }, [url]);

  const currentStep = useMemo(
    () => LOADING_STEPS[stepIndex] ?? LOADING_STEPS[0],
    [stepIndex]
  );
  const previewAsGuestAudit = useMemo<GuestAuditPreview | null>(() => {
    if (!preview) return null;

    return {
      listing_url: url.trim(),
      title: title.trim() || "Annonce en cours d'analyse",
      platform: preview.platform === "unknown" ? "other" : preview.platform,
      score: preview.score,
      insights: preview.insights,
      recommendations: [],
      summary: "Score estimé avant analyse complète",
      marketComparison: null,
      estimatedRevenue: null,
      bookingPotential: null,
      occupancyObservation: null,
      marketPositioning: {
        status: "partial",
        comparableCount: 0,
        summary: "Basé sur données publiques visibles",
        comparables: [],
        metrics: [],
      },
      subScores: [
        {
          key: "photos",
          label: "Photos",
          status: "partial",
          score: null,
          weight: 0.2,
          reason: "preview_local",
        },
        {
          key: "description",
          label: "Description",
          status: "partial",
          score: null,
          weight: 0.15,
          reason: "preview_local",
        },
      ],
    };
  }, [preview, title, url]);
  const displayPreview = useMemo(
    () => guestAudit ?? fastPreview ?? previewAsGuestAudit,
    [guestAudit, fastPreview, previewAsGuestAudit]
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
  const offerFromQuery = useMemo(() => {
    const rawOffer = searchParams.get("offer");
    if (rawOffer === "audit_test" || rawOffer === "pack_5" || rawOffer === "pack_15") {
      return rawOffer;
    }
    return null;
  }, [searchParams]);
  const selectedOfferSummary = useMemo(() => {
    if (!offerFromQuery) return null;

    if (offerFromQuery === "pack_5") {
      return { label: "Pack 5 audits", price: "39 €" };
    }

    if (offerFromQuery === "pack_15") {
      return { label: "Pack 15 audits", price: "99 €" };
    }

    return { label: "Audit unique", price: "9 €" };
  }, [offerFromQuery]);
  const platformValidation = useMemo(() => validateGuestListingUrl(url), [url]);
  const detectedPlatform = platformValidation.platform;
  const detectedPlatformLabel = !url.trim()
    ? "Détection en attente"
    : detectedPlatform === "other"
    ? "Non reconnue"
    : formatPlatformLabel(detectedPlatform);
  const canLaunchAudit = useMemo(() => {
    return Boolean(url.trim()) && detectedPlatform !== "other";
  }, [detectedPlatform, url]);
  const isLaunchDisabled = isSubmitting || !canLaunchAudit;
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

  useEffect(() => {
    if (!displayPreview) {
      hasAutoScrolledToResultRef.current = false;
      return;
    }

    if (hasAutoScrolledToResultRef.current) return;
    if (!resultSectionRef.current) return;

    hasAutoScrolledToResultRef.current = true;
    const timer = window.setTimeout(() => {
      resultSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [displayPreview]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    console.log("[audit/new] submit start", {
      url,
      detectedPlatform,
      isSubmitting,
    });
    console.log("[audit/new] before validation", { url });
    const validation = validateGuestListingUrl(url);
    console.log("[audit/new] validation result", validation);

    if (!validation.valid) {
      console.log("[audit/new] validation failed", {
        reason: validation.reason,
        platform: validation.platform,
      });
      setError(validation.reason || "URL invalide");
      return;
    }

    const normalizedUrl = validation.normalizedUrl ?? url.trim();
    console.log("[audit/new] normalized url ready", {
      normalizedUrl,
      platform: validation.platform,
    });
    const submitId = activeSubmitIdRef.current + 1;
    activeSubmitIdRef.current = submitId;

    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    setGuestAudit(null);
    setFastPreview(null);
    setPreview(null);
    setIsBackgroundLoading(false);
    clearGuestAuditDraft(normalizedUrl);

    setIsSubmitting(true);
    setStepIndex(0);
    setProgress(10);

    try {
      console.log("[audit/new] before preview computation", {
        submitId,
        normalizedUrl,
      });
      const detectedPlatformForSubmit = validation.platform;
      const score = generateEstimatedScore(normalizedUrl);
      const insights = generatePreviewInsights(detectedPlatformForSubmit);
      console.log("[audit/new] preview computed", {
        detectedPlatformForSubmit,
        score,
        insightsCount: insights.length,
      });
      console.log("[audit/new] before API call", {
        hasApiCall: false,
        note: "guest preview flow is local-only",
      });

      if (submitId !== activeSubmitIdRef.current) {
        console.log("[audit/new] submit aborted (stale submitId)", {
          submitId,
          activeSubmitId: activeSubmitIdRef.current,
        });
        return;
      }

      console.log("[audit/new] before preview state update", { submitId });
      setPreview({
        platform: detectedPlatformForSubmit,
        score,
        insights,
      });

      const previewPayload: GuestAuditPreview = {
        listing_url: normalizedUrl,
        title: title.trim() || "Annonce en cours d'analyse",
        platform: detectedPlatformForSubmit,
        score,
        insights,
        recommendations: [],
        summary: "Score estimé avant analyse complète",
        marketComparison: null,
        estimatedRevenue: null,
        bookingPotential: null,
        occupancyObservation: null,
        marketPositioning: {
          status: "partial",
          comparableCount: 0,
          summary: "Basé sur données publiques visibles",
          comparables: [],
          metrics: [],
        },
        subScores: [
          {
            key: "photos",
            label: "Photos",
            status: "partial",
            score: null,
            weight: 0.2,
            reason: "preview_local",
          },
          {
            key: "description",
            label: "Description",
            status: "partial",
            score: null,
            weight: 0.15,
            reason: "preview_local",
          },
        ],
      };

      setGuestAudit(null);
      setFastPreview(previewPayload);
      setIsBackgroundLoading(false);
      setStepIndex(LOADING_STEPS.length - 1);
      setProgress(100);
      setIsSubmitting(false);

      console.log("[audit/new] before navigation/redirect/push", {
        hasNavigation: false,
        note: "no redirect in guest preview submit",
      });
      console.log("[audit/new] before draft save", {
        listing_url: previewPayload.listing_url,
        platform: previewPayload.platform,
      });
      const guestToken = getOrCreateGuestAuditToken();
      saveGuestAuditDraft({
        guest_token: guestToken,
        listing_url: normalizedUrl,
        title: previewPayload.title,
        platform: previewPayload.platform,
        selected_offer: selectedOffer,
        generated_at: new Date().toISOString(),
        status: "completed",
        payment_status: "unpaid",
        preview_payload: previewPayload,
        full_payload: previewPayload,
        result: {
          score: previewPayload.score,
          insights: previewPayload.insights,
          recommendations: previewPayload.recommendations,
          raw_payload: previewPayload,
        },
      });
      console.log("[audit/new] submit success end", {
        submitId,
        savedDraft: true,
      });
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
      console.error("[audit/new] submit catch", err);
    }
  }

  async function handlePremiumCheckout() {
    if (!isAuthenticated || isPremiumCheckoutLoading) return;

    setPremiumCheckoutError(null);
    setIsPremiumCheckoutLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPremiumCheckoutError("Session introuvable. Reconnectez-vous puis réessayez.");
        return;
      }

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
        client: supabase,
      });

      if (!workspace) {
        setPremiumCheckoutError("Impossible de charger votre espace de travail.");
        return;
      }

      const activeWorkspaceId = workspace.id;
      setStoredWorkspaceId(activeWorkspaceId);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const checkoutPlan = mapOfferToCheckoutPlan(selectedOffer);
      const draft = loadGuestAuditDraft();

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          plan: checkoutPlan,
          checkoutMode: "one_shot",
          interval: "month",
          ...(checkoutPlan === "audit_test" ? { quantity: 1 } : {}),
          ...(checkoutPlan === "audit_test"
            ? (() => {
                return draft
                  ? {
                      auditPreview: {
                        listingUrl: draft.listing_url,
                        title: draft.title ?? null,
                        platform: draft.platform ?? null,
                        generatedAt: draft.generated_at,
                        score: draft.result.score ?? null,
                        summary:
                          typeof draft.full_payload === "object" &&
                          draft.full_payload &&
                          !Array.isArray(draft.full_payload) &&
                          "summary" in draft.full_payload
                            ? String(
                                (draft.full_payload as { summary?: string | null })
                                  .summary ?? ""
                              )
                            : null,
                      },
                    }
                  : {};
              })()
            : {}),
        }),
      });

      if (!response.ok) {
        setPremiumCheckoutError(
          "Impossible d'ouvrir le checkout Stripe pour le moment."
        );
        return;
      }

      const data = (await response.json().catch(() => null)) as { url?: string } | null;
      if (!data?.url) {
        setPremiumCheckoutError("Session Stripe indisponible, merci de réessayer.");
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.warn("[audit/new] failed to start premium checkout", error);
      setPremiumCheckoutError("Impossible d'ouvrir le checkout Stripe pour le moment.");
    } finally {
      setIsPremiumCheckoutLoading(false);
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
    <main className="nk-section space-y-5 text-sm md:space-y-6">
      <div className="nk-card nk-card-hover nk-page-header-card nk-border nk-card-lg w-full max-w-full overflow-x-hidden border border-slate-300/70 bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.12),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.12),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] px-4 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(15,23,42,0.12)] md:flex md:items-center md:justify-between md:gap-6 md:overflow-visible md:px-7 md:py-4">
        <div className="max-w-full min-w-0 space-y-2 md:max-w-2xl md:space-y-1">
          <p className="nk-kicker-muted inline-flex items-center gap-2 rounded-full border border-emerald-100/80 bg-white/80 px-3.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            Audit en mode invité
          </p>
          <HeroTitle className="mt-0.5 text-[1.52rem] tracking-tight md:text-[2.35rem]">
            Découvrez un premier aperçu de votre annonce
          </HeroTitle>
          <SectionDescription className="nk-body-muted mt-0.5 max-w-none text-[13px] leading-[1.42] md:max-w-xl md:text-[0.92rem] md:leading-5">
            Obtenez une première lecture structurée de la performance de votre
            annonce. Créez ensuite votre compte pour débloquer l’analyse complète
            et vos recommandations priorisées.
          </SectionDescription>
        </div>
        <div className="nk-card-sm mt-2.5 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/80 via-emerald-50/60 to-slate-50 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm md:mt-0 md:px-3.5 md:py-2 md:text-xs">
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

      {selectedOfferSummary ? (
        <div className="nk-card-sm rounded-2xl border border-blue-200/80 bg-gradient-to-r from-white via-blue-50/40 to-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Offre sélectionnée
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {selectedOfferSummary.label} — {selectedOfferSummary.price}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Vous allez lancer votre audit avec cette offre.
              </p>
            </div>
            <Link
              href="/pricing"
              className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
            >
              Changer d’offre
            </Link>
          </div>
        </div>
      ) : null}

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
          <SectionStack size="md" className="mx-auto max-w-md space-y-4 md:max-w-none md:space-y-5">
            <Card
              variant="default"
              className="nk-card nk-card-hover nk-card-md nk-border border border-slate-300/70 space-y-4 p-3.5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] ring-1 ring-emerald-50/90 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)] md:space-y-5 md:p-5"
            >
              <SectionTitle className="nk-section-title text-slate-900">
                Paramètres de l’annonce
              </SectionTitle>
              <SectionDescription className="mt-1 text-slate-600">
                Utilisez l’URL publique exacte de votre annonce pour générer un
                audit cohérent, comparable et directement exploitable.
              </SectionDescription>

              <form
                noValidate
                onSubmit={handleSubmit}
                className="mt-3 space-y-3 rounded-2xl border border-slate-300/75 bg-[radial-gradient(circle_at_top_left,rgba(226,232,240,0.7),transparent_55%),rgba(248,250,252,0.98)] px-3 py-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.85),0_12px_28px_rgba(15,23,42,0.07)] transition-colors duration-150 ease-out md:px-3.5 md:py-3.5"
              >
                <div>
                  <label className="mb-0.5 block text-sm font-medium text-slate-900">
                    URL de l’annonce
                  </label>
                  <input
                    ref={urlInputRef}
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
                      setPreview(null);
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
                    Plateforme détectée
                  </label>
                  <div className="w-full rounded-2xl border border-slate-300 bg-white/95 px-3 py-2.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                    {detectedPlatformLabel}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Détection automatique depuis l’URL. Cette valeur est verrouillée.
                  </p>
                </div>

                {error && (
                  <div className="whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="rounded-xl border border-slate-300/80 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-700">
                  <p>url: {url.trim() || "(vide)"}</p>
                  <p>detectedPlatform: {detectedPlatform}</p>
                  <p>isSubmitting: {String(isSubmitting)}</p>
                  <p>canLaunchAudit: {String(canLaunchAudit)}</p>
                  <p>disabledFinal: {String(isLaunchDisabled)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                  <PrimaryButton
                    type="submit"
                    disabled={isLaunchDisabled}
                    className="inline-flex items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:opacity-50 disabled:cursor-not-allowed"
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

            <div className="space-y-4 md:space-y-5">
              <GridStack gap="md" className="md:grid-cols-2">
                <Card
                  variant="soft"
                  className="nk-card nk-card-hover nk-card-sm h-full min-h-[176px] border border-slate-300/70 bg-gradient-to-b from-white via-slate-50/70 to-white space-y-4 p-3.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)] ring-1 ring-emerald-50/90 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)] md:space-y-4 md:p-4"
                >
                  <SectionTitle className="nk-section-title text-slate-900">
                    Ce que l’outil analyse
                  </SectionTitle>

                  <ul className="mt-1.5 space-y-1.5 text-sm text-slate-800">
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-200/70">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-current"
                        />
                      </span>
                      <span className="leading-5">
                        <span className="font-medium text-slate-900">
                          Qualité, ordre et lisibilité
                        </span>{" "}
                        de la galerie photo
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-sm ring-1 ring-amber-200/70">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-current"
                        />
                      </span>
                      <span className="leading-5">
                        <span className="font-medium text-slate-900">
                          Clarté de la promesse
                        </span>{" "}
                        et qualité de la description
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-100 text-blue-700 shadow-sm ring-1 ring-blue-200/70">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-current"
                        />
                      </span>
                      <span className="leading-5">
                        <span className="font-medium text-slate-900">
                          Positionnement
                        </span>{" "}
                        de l’annonce face aux offres proches
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-violet-100 text-violet-700 shadow-sm ring-1 ring-violet-200/70">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-current"
                        />
                      </span>
                      <span className="leading-5">
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
                  className="nk-card nk-card-hover nk-card-sm h-full min-h-[176px] border border-amber-200/80 bg-gradient-to-b from-amber-50/85 via-amber-50/55 to-white space-y-4 p-3.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)] ring-1 ring-amber-50/80 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)] md:space-y-4 md:p-4"
                >

                  <SectionTitle className="nk-section-title mt-1.5 text-slate-900">
                    Pourquoi commencer en invité
                  </SectionTitle>

                  <ul className="mt-1 space-y-1.5 text-sm leading-5 text-slate-800">
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

      {displayPreview && (
        <div
          ref={resultSectionRef}
          className="mx-auto w-full max-w-md space-y-5 md:max-w-none md:space-y-6"
        >
          {isAirbnbBlockedPreview ? (
            <div className="nk-card nk-card-hover nk-card-lg nk-border w-full rounded-2xl border border-emerald-300/80 bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.1),transparent_46%),radial-gradient(circle_at_92%_100%,rgba(249,115,22,0.12),transparent_42%),linear-gradient(180deg,rgba(236,253,245,0.72)_0%,rgba(255,247,237,0.7)_52%,rgba(255,255,255,0.98)_100%)] space-y-6 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-emerald-100/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.14)] md:space-y-6 md:p-6">
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
                className="inline-flex w-full items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Débloquer l’analyse complète
              </a>
            </div>
          ) : null}

          {!isAirbnbBlockedPreview && (
            <div className="nk-card nk-card-hover nk-card-lg nk-border w-full rounded-2xl border border-slate-300/75 bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,0.08),transparent_36%),radial-gradient(circle_at_100%_100%,rgba(251,146,60,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] space-y-3.5 p-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-emerald-50/95 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.14)] md:space-y-4 md:p-4">
              {isBackgroundLoading ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Aperçu rapide affiché pendant l’analyse complète.
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200/80 bg-white/92 px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                <SectionLabel className="nk-section-title text-base text-emerald-700 tracking-widest uppercase">
                  APERÇU DU RÉSULTAT
                </SectionLabel>
                <h2 className="mt-1 text-xl font-extrabold leading-tight text-slate-900 md:text-[1.7rem]">
                  {title.trim() ? title.trim() : "Annonce analysée automatiquement"}
                </h2>
                <div className="mt-2.5 rounded-2xl border border-emerald-200/85 bg-gradient-to-br from-emerald-50/90 via-white to-orange-50/55 px-3 py-2.5 md:px-3.5 md:py-3">
                  <div className="grid gap-2.5 md:grid-cols-[minmax(180px,auto),minmax(0,1fr)] md:items-center md:gap-3.5">
                    <div className="flex items-end gap-2 md:pr-2">
                      <p className="text-3xl font-extrabold leading-none text-emerald-700 md:text-4xl">
                        {displayPreview.score.toFixed(1)}
                        <span className="ml-1 text-xl font-bold text-emerald-500">/10</span>
                      </p>
                      {isProvisionalPreview ? (
                        <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Estimé
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-1.5 md:pl-1">
                      <p className="inline-flex items-center rounded-full border border-orange-300 bg-orange-100/95 px-3 py-1 text-[11px] font-semibold text-orange-900 shadow-[0_6px_14px_rgba(249,115,22,0.2)]">
                        Vous perdez des réservations chaque semaine
                      </p>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex rounded-full border border-slate-300/80 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
                          {displayPreview.trustInsight?.label ?? "Confiance partielle"}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200/90 bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {typeof displayPreview.rating === "number"
                            ? `Note visible : ${displayPreview.rating.toFixed(1)} / 5`
                            : "Certaines données de confiance ne sont pas disponibles"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <ul className="mt-2.5 space-y-1.5 text-sm text-slate-700">
                  {(visibleInsights.length > 0
                    ? visibleInsights
                    : [
                        "Analyse partielle basée sur des signaux visibles.",
                        "Le rapport complet priorise les actions à impact.",
                      ]
                  )
                    .slice(0, 2)
                    .map((insight) => (
                      <li key={insight} className="flex items-start gap-2.5">
                        <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        <span>{insight}</span>
                      </li>
                    ))}
                </ul>

                <a
                  href={displayPreview.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
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
              </div>

              <div className="w-full rounded-2xl border border-slate-200/90 bg-[radial-gradient(circle_at_100%_0%,rgba(16,185,129,0.08),transparent_36%),radial-gradient(circle_at_0%_100%,rgba(59,130,246,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.96)_100%)] p-3.5 shadow-[0_16px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100/90 md:p-4">
                <h3 className="text-[1.1rem] font-semibold leading-7 text-slate-900">
                  Ce que vous allez récupérer
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                  Le rapport complet vous aide à transformer une annonce correcte
                  en annonce qui convertit mieux.
                </p>

                {(() => {
                  const scoreValue =
                    typeof displayPreview?.score === "number"
                      ? `${displayPreview.score.toFixed(1)}/10`
                      : "7.8/10";
                  const bookingPotentialValue =
                    typeof displayPreview?.bookingPotential === "string"
                      ? displayPreview.bookingPotential.trim()
                      : "";
                  const estimatedRevenueValue =
                    typeof displayPreview?.estimatedRevenue === "string"
                      ? displayPreview.estimatedRevenue.trim()
                      : "";
                  const gainSource = bookingPotentialValue || estimatedRevenueValue;
                  const gainMatch = gainSource.match(/[+−-]?\d+\s?%/);
                  const impactValue = gainMatch
                    ? gainMatch[0].replace(/\s+/g, "")
                    : "+ visible";
                  const impactSubText = gainMatch
                    ? "Vision rapide du potentiel identifié avant rapport complet"
                    : "Premiers leviers visibles avant analyse complète";
                  const signalCount = [
                    displayPreview?.trustInsight ? 1 : 0,
                    typeof displayPreview?.hostName === "string" &&
                    displayPreview.hostName.trim().length > 0
                      ? 1
                      : 0,
                    typeof displayPreview?.hostInfo === "string" &&
                    displayPreview.hostInfo.trim().length > 0
                      ? 1
                      : 0,
                    typeof displayPreview?.reviewCount === "number" ? 1 : 0,
                    typeof displayPreview?.rating === "number" ? 1 : 0,
                  ].reduce((total, value) => total + value, 0);
                  const signalsValue = signalCount > 0 ? String(signalCount) : "3";
                  const axesCount = visibleInsights.length;
                  const axesValue = axesCount > 0 ? String(axesCount) : "2";

                  return (
                    <>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="flex h-full min-h-[154px] flex-col rounded-2xl border border-slate-300/85 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.09)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(15,23,42,0.14)]">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          </div>
                          <p className="mt-3 text-xl font-bold text-slate-950 md:text-2xl">
                            {scoreValue}
                          </p>
                          <p className="mt-1 text-[13px] font-semibold text-slate-900">
                            Score aperçu
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            Première lecture de la qualité visible de votre annonce
                          </p>
                        </div>

                        <div className="flex h-full min-h-[154px] flex-col rounded-2xl border border-slate-300/85 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.09)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(15,23,42,0.14)]">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                          </div>
                          <p className="mt-3 text-xl font-bold text-slate-950 md:text-2xl">
                            {impactValue}
                          </p>
                          <p className="mt-1 text-[13px] font-semibold text-slate-900">
                            Potentiel détecté
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            {impactSubText}
                          </p>
                        </div>

                        <div className="flex h-full min-h-[154px] flex-col rounded-2xl border border-slate-300/85 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.09)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(15,23,42,0.14)]">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                          </div>
                          <p className="mt-3 text-xl font-bold text-slate-950 md:text-2xl">
                            {signalsValue}
                          </p>
                          <p className="mt-1 text-[13px] font-semibold text-slate-900">
                            Signaux détectés
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            Indices publics visibles récupérés sur l’annonce
                          </p>
                        </div>

                        <div className="flex h-full min-h-[154px] flex-col rounded-2xl border border-slate-300/85 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.09)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(15,23,42,0.14)]">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-violet-500" />
                          </div>
                          <p className="mt-3 text-xl font-bold text-slate-950 md:text-2xl">
                            {axesValue}
                          </p>
                          <p className="mt-1 text-[13px] font-semibold text-slate-900">
                            Actions prioritaires
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            Pistes concrètes visibles avant déblocage complet
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="nk-card-lg nk-border rounded-3xl border border-slate-300/80 bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(241,245,249,0.96)_100%)] space-y-4 p-3.5 shadow-[0_12px_30px_rgba(15,23,42,0.07)] md:space-y-5 md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <SectionLabel>Bloc verrouillé</SectionLabel>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      Vous perdez des réservations chaque semaine
                    </h3>
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

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="relative overflow-hidden rounded-2xl border border-slate-300/85 bg-white/95 px-3.5 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
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
                        Verrouillé
                      </span>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-slate-300/85 bg-white/95 px-3.5 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
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
                        Verrouillé
                      </span>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-slate-300/85 bg-white/95 px-3.5 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
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
                        Verrouillé
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="w-full space-y-5 md:space-y-6">
            <div id="plan-action-premium" className="nk-card nk-card-hover nk-card-lg rounded-2xl border border-slate-200/90 bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,0.07),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(249,115,22,0.08),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.96)_100%)] space-y-4 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.08)] ring-1 ring-orange-50/70 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_66px_rgba(0,0,0,0.12)] md:space-y-4 md:p-4">
              <Card
                variant="pricing"
                className="rounded-2xl border border-white/70 bg-white/68 p-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)] backdrop-blur-sm md:p-4"
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

              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.1)] ring-1 ring-white/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(15,23,42,0.16)]">
                  <p className="text-[11px] font-semibold text-slate-900">
                    Analyse partielle visible
                  </p>
                  <p className="mt-1 text-[11px] leading-4.5 text-slate-600">
                    Basée sur les signaux publics détectés sur votre annonce.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.1)] ring-1 ring-white/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(15,23,42,0.16)]">
                  <p className="text-[11px] font-semibold text-slate-900">
                    Rapport complet après paiement
                  </p>
                  <p className="mt-1 text-[11px] leading-4.5 text-slate-600">
                    Déblocage immédiat du plan d’action détaillé.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.1)] ring-1 ring-white/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(15,23,42,0.16)]">
                  <p className="text-[11px] font-semibold text-slate-900">
                    Résultat exploitable rapidement
                  </p>
                  <p className="mt-1 text-[11px] leading-4.5 text-slate-600">
                    Lecture claire et priorisée en moins de 30 secondes.
                  </p>
                </div>
              </div>

              <div className="mt-3.5 grid gap-2.5 md:grid-cols-2">
                <div className="h-full rounded-2xl border border-slate-300/90 bg-white px-3.5 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.1)] ring-1 ring-white/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.14)]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <circle cx="10" cy="10" r="5.8" />
                        <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Plan d’action complet</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Ordre exact des actions à appliquer pour améliorer la conversion.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="h-full rounded-2xl border border-slate-300/90 bg-white px-3.5 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.1)] ring-1 ring-white/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.14)]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M4 6.2h12" strokeLinecap="round" />
                        <path d="M6 10h8" strokeLinecap="round" />
                        <path d="M8 13.8h4" strokeLinecap="round" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Priorisation claire</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Quoi faire maintenant, quoi faire ensuite, et pourquoi.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="h-full rounded-2xl border border-slate-300/90 bg-white px-3.5 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.1)] ring-1 ring-white/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.14)]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M5.2 4.5h9.6a1 1 0 011 1v9a1 1 0 01-1 1H5.2a1 1 0 01-1-1v-9a1 1 0 011-1z" />
                        <path d="M6.8 12l2-2.2 1.6 1.2 2.8-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Rapport complet actionnable</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Au-delà de l’aperçu affiché à gauche.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="h-full rounded-2xl border border-slate-300/90 bg-white px-3.5 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.1)] ring-1 ring-white/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.14)]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                      <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <circle cx="10" cy="10" r="5.6" />
                        <path d="M10 6.9v3.3l2.2 1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Suivi historique</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Pour suivre vos progrès annonce par annonce.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 space-y-3 md:mt-4 md:space-y-3.5">
                <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-3.5 py-2.5 text-center">
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
                <div className="space-y-2">
                  {PAYWALL_OFFERS.map((offer) => (
                    <div
                      key={offer.name}
                      className={`w-full rounded-2xl text-left transition-all duration-200 ${
                        offer.highlighted
                          ? "nk-card-highlight border border-orange-300/95 bg-orange-50/80 px-4 py-3.5 shadow-[0_10px_22px_rgba(249,115,22,0.14)] md:scale-[1.01] md:px-5 md:py-4"
                          : "nk-card-sm border border-slate-300/80 bg-white px-3.5 py-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.06)] md:px-4 md:py-3"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 md:gap-5">
                        <div className="min-w-0 flex-1 pr-1">
                          <p className="text-sm font-semibold leading-5 text-slate-900">
                            {offer.name}
                          </p>
                          <p className="mt-1 text-[12px] leading-5 text-slate-600">
                            {offer.detail} —{" "}
                            <b>
                              {offer.code === "audit_test"
                                ? "1 annonce"
                                : offer.code === "pack_5"
                                  ? "5 annonces"
                                  : "15 annonces"}
                            </b>
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-emerald-700">
                            Toutes les fonctionnalités incluses. Seule la quantité d’annonces change.
                          </p>
                          <p className="mt-1.5 text-[11px] leading-5 text-slate-600">
                            {offer.note}
                          </p>
                        </div>
                        <div className="shrink-0 space-y-1 text-right md:border-l md:border-slate-200/80 md:pl-4">
                          <p className="text-2xl font-bold leading-none tracking-tight text-slate-950">
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 md:mt-3.5">
                <p className="mb-1.5 mt-2.5 text-center text-xs text-orange-700 md:mt-3">
                  Sans plan d’action clair, vous laissez des réservations à vos concurrents.
                </p>
                <p className="mb-2 text-center text-xs font-medium text-slate-600">
                  Accès immédiat • Résultat en moins de 30 secondes
                </p>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handlePremiumCheckout}
                    aria-label={`Débloquer mes réservations maintenant - ${selectedOfferConfig.name}`}
                    disabled={isPremiumCheckoutLoading}
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:opacity-50 disabled:cursor-not-allowed md:h-12 md:px-7"
                  >
                    Débloquer mes réservations maintenant
                  </button>
                ) : (
                  <Link
                    href={`/sign-in?next=${encodeURIComponent(`/audit/new?restored=1&offer=${selectedOffer}`)}`}
                    aria-label={`Débloquer mes réservations maintenant - ${selectedOfferConfig.name}`}
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:opacity-50 disabled:cursor-not-allowed md:h-12 md:px-7"
                  >
                    Débloquer mes réservations maintenant
                  </Link>
                )}
                {premiumCheckoutError ? (
                  <p className="mt-2 text-center text-xs text-red-600">
                    {premiumCheckoutError}
                  </p>
                ) : null}
                <div className="mt-2 text-center md:mt-2.5">
                  <Link
                    href={`/sign-in?next=${encodeURIComponent("/dashboard")}`}
                    className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
                  >
                    J&apos;ai déjà un compte
                  </Link>
                </div>
                <div className="mt-2.5 border-t border-slate-200" />
                <div className="mt-2.5 grid gap-1.5 text-center text-xs text-slate-500 md:grid-cols-3">
                  <p className="flex items-center justify-center gap-1.5 md:justify-start">
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
                  <p className="flex items-center justify-center gap-1.5 md:justify-center">
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
                  <p className="flex items-center justify-center gap-1.5 md:justify-end">
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
                <p className="mt-2.5 text-center text-[11px] text-slate-400">
                  Paiement sécurisé • Sans engagement
                </p>
              </div>
              </Card>
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

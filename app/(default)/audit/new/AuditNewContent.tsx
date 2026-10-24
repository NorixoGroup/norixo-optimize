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
import { useTranslation } from "@/components/i18n/useTranslation";
import { auditNewCopy, type AuditNewErrorCode } from "@/data/auditNewI18n";
import {
  clearGuestAuditDraft,
  consumeFreeAuditGuestDraftForAuditNew,
  type GuestAuditDraft,
  isGuestAuditDraftExpired,
  loadGuestAuditDraft,
  saveGuestAuditDraft,
} from "@/lib/guestAuditDraft";
import {
  detectPlatformFromUrl,
  formatPlatformLabel,
  getGuestListingReasonCode,
  validateGuestListingUrl,
} from "@/lib/guestAudit/shared";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";
import { setStoredWorkspaceId } from "@/lib/workspaces/setStoredWorkspaceId";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/listings/propertyTypeOverrideOptions";
import { draftHasRealResult } from "@/lib/guestAudit/draftResult";
import { getAuditEntryDestinations } from "@/lib/guestAudit/entryDestination";

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

// Display text of the offers lives in data/auditNewI18n.ts; codes, plan mapping and amounts stay here.
const PAYWALL_OFFERS = [
  { code: "audit_test", highlighted: false },
  { code: "pack_5", highlighted: true },
  { code: "pack_15", highlighted: false },
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
): "airbnb" | "booking" | "vrbo" | "agoda" | "expedia" | "unknown" {
  const u = url.toLowerCase();
  if (u.includes("airbnb")) return "airbnb";
  if (u.includes("booking")) return "booking";
  if (u.includes("vrbo") || u.includes("abritel")) return "vrbo";
  if (u.includes("agoda")) return "agoda";
  if (u.includes("expedia")) return "expedia";
  return "unknown";
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


export default function PublicAuditPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { copy: t } = useTranslation(auditNewCopy);
  const loadingSteps = useMemo(() => [...t.loadingSteps], [t]);
  // Read inside an effect that must not re-run when the language changes.
  const untitledListingRef = useRef(t.untitledListing);
  untitledListingRef.current = t.untitledListing;

  const [url, setUrl] = useState("");
  const [propertyTypeOverride, setPropertyTypeOverride] = useState("");
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<AuditNewErrorCode | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(8);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [guestAudit, setGuestAudit] = useState<GuestAuditPreview | null>(null);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<
    (typeof PAYWALL_OFFERS)[number]["code"]
  >("audit_test");
  const [isPremiumCheckoutLoading, setIsPremiumCheckoutLoading] = useState(false);
  const [premiumCheckoutError, setPremiumCheckoutError] = useState<AuditNewErrorCode | null>(null);
  const activeSubmitIdRef = useRef(0);
  const previewTimerRef = useRef<number | null>(null);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoScrolledToResultRef = useRef(false);
  const hasConsumedFreeAuditDraftRef = useRef(false);

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

      const authed = Boolean(session);
      setIsAuthenticated(authed);

      if (!session?.access_token) {
        setIsPlatformAdmin(false);
      } else {
        try {
          const res = await fetch("/api/admin/me", {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
          });
          const body = (await res.json().catch(() => null)) as { isAdminPrivate?: boolean } | null;
          setIsPlatformAdmin(Boolean(res.ok && body?.isAdminPrivate));
        } catch {
          setIsPlatformAdmin(false);
        }
      }
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
      if (!hasConsumedFreeAuditDraftRef.current && initialUrl.length === 0) {
        const freeAuditPrefill = consumeFreeAuditGuestDraftForAuditNew();
        if (freeAuditPrefill) {
          hasConsumedFreeAuditDraftRef.current = true;

          if (freeAuditPrefill.listingUrl) {
            setUrl(freeAuditPrefill.listingUrl);
          }

          if (
            freeAuditPrefill.propertyTypeOverride &&
            PROPERTY_TYPE_OPTIONS.some(
              (option) => option.value === freeAuditPrefill.propertyTypeOverride
            )
          ) {
            setPropertyTypeOverride(freeAuditPrefill.propertyTypeOverride);
          }

          return;
        }
      }

      const isExplicitRestore = searchParams.get("restored") === "1";
      const shouldRestoreDraftResult =
        isExplicitRestore ||
        (initialUrl.length > 0 && initialUrl === storedDraft.listing_url);

      if (shouldRestoreDraftResult && draftHasRealResult(storedDraft)) {
        setGuestAudit(buildPreviewFromDraft(storedDraft, untitledListingRef.current));
      }

      if (
        typeof storedDraft.property_type_override === "string" &&
        PROPERTY_TYPE_OPTIONS.some((o) => o.value === storedDraft.property_type_override)
      ) {
        setPropertyTypeOverride(storedDraft.property_type_override);
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
        if (
          typeof storedDraft.property_type_override === "string" &&
          PROPERTY_TYPE_OPTIONS.some((o) => o.value === storedDraft.property_type_override)
        ) {
          setPropertyTypeOverride(storedDraft.property_type_override);
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
      setStepIndex((prev) => Math.min(prev + 1, loadingSteps.length - 1));
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
  }, [isSubmitting, loadingSteps.length]);

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
    () => loadingSteps[stepIndex] ?? loadingSteps[0],
    [loadingSteps, stepIndex]
  );
  const displayPreview = guestAudit;
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
  const entryDestinations = useMemo(
    () => getAuditEntryDestinations({ isAuthenticated, offer: offerFromQuery }),
    [isAuthenticated, offerFromQuery]
  );
  const selectedOfferSummary = useMemo(() => {
    if (!offerFromQuery) return null;

    const offer = t.offers[offerFromQuery];
    return { label: offer.summaryLabel, price: offer.price };
  }, [offerFromQuery, t]);
  const platformValidation = useMemo(() => validateGuestListingUrl(url), [url]);
  const detectedPlatform = platformValidation.platform;
  const detectedPlatformLabel = !url.trim()
    ? t.platformPending
    : detectedPlatform === "other"
    ? t.platformUnknown
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
      property_type_override: propertyTypeOverride.trim() || undefined,
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
      setError(getGuestListingReasonCode(validation.reason) ?? "url_invalid");
      return;
    }

    if (!propertyTypeOverride.trim()) {
      setError("property_type_required");
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
    setIsBackgroundLoading(false);
    clearGuestAuditDraft(normalizedUrl);

    setIsSubmitting(true);
    setStepIndex(0);
    setProgress(10);

    try {
      if (submitId !== activeSubmitIdRef.current) {
        return;
      }

      // The guest audit is disabled: nothing is analysed or saved here. Send the visitor to the real, credit-gated flow.
      router.push(entryDestinations.auditHref);
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
      setError("unknown_error");
      setIsSubmitting(false);
      console.error("[audit/new] submit catch", err);
    }
  }

  async function handlePremiumCheckout() {
    if (isPlatformAdmin) {
      setPremiumCheckoutError(null);
      return;
    }

    if (!isAuthenticated || isPremiumCheckoutLoading) return;

    setPremiumCheckoutError(null);
    setIsPremiumCheckoutLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPremiumCheckoutError("session_not_found");
        return;
      }

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
        client: supabase,
      });

      if (!workspace) {
        setPremiumCheckoutError("workspace_load_failed");
        return;
      }

      const storedWorkspaceId = getStoredWorkspaceId();
      const activeWorkspaceId = (storedWorkspaceId?.trim() || workspace.id).trim();
      if (!activeWorkspaceId) {
        setPremiumCheckoutError("workspace_not_found");
        return;
      }
      setStoredWorkspaceId(activeWorkspaceId);

      console.info("[audit/new][checkout] workspace_id_sent_by_billing", {
        workspace_id_sent_by_billing: activeWorkspaceId,
        resolved_fallback_workspace_id: workspace.id,
      });

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
        setPremiumCheckoutError("checkout_unavailable");
        return;
      }

      const data = (await response.json().catch(() => null)) as { url?: string } | null;
      if (!data?.url) {
        setPremiumCheckoutError("checkout_session_unavailable");
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.warn("[audit/new] failed to start premium checkout", error);
      setPremiumCheckoutError("checkout_unavailable");
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
            {t.kicker}
          </p>
          <HeroTitle className="mt-0.5 text-[1.52rem] tracking-tight md:text-[2.35rem]">
            {t.heroTitle}
          </HeroTitle>
          <SectionDescription className="nk-body-muted mt-0.5 max-w-none text-[13px] leading-[1.42] md:max-w-xl md:text-[0.92rem] md:leading-5">
            {t.heroDescription}
          </SectionDescription>
        </div>
        <div className="nk-card-sm mt-2.5 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/80 via-emerald-50/60 to-slate-50 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm md:mt-0 md:px-3.5 md:py-2 md:text-xs">
          <p className="font-semibold text-slate-900">
            {isAuthenticated ? t.modeConnected : t.modeGuest}
          </p>
          <p className="mt-1 leading-5">
            {isAuthenticated && isPlatformAdmin ? (
              <>{t.adminUnlimited}</>
            ) : isAuthenticated ? (
              t.connectedSaved
            ) : (
              t.guestInstant
            )}
          </p>
        </div>
      </div>

      {selectedOfferSummary ? (
        <div className="nk-card-sm rounded-2xl border border-blue-200/80 bg-gradient-to-r from-white via-blue-50/40 to-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t.selectedOffer}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {selectedOfferSummary.label} — {selectedOfferSummary.price}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {t.selectedOfferHint}
              </p>
            </div>
            {!isPlatformAdmin ? (
              <Link
                href={entryDestinations.billingHref}
                className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
              >
                {t.changeOffer}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="relative">
        {isSubmitting && (
          <AuditLaunchOverlay
            currentStep={currentStep}
            progress={progress}
            steps={loadingSteps}
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
                {t.formTitle}
              </SectionTitle>
              <SectionDescription className="mt-1 text-slate-600">
                {t.formDescription}
              </SectionDescription>

              <form
                noValidate
                onSubmit={handleSubmit}
                className="mt-3 space-y-3 rounded-2xl border border-slate-300/75 bg-[radial-gradient(circle_at_top_left,rgba(226,232,240,0.7),transparent_55%),rgba(248,250,252,0.98)] px-3 py-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.85),0_12px_28px_rgba(15,23,42,0.07)] transition-colors duration-150 ease-out md:px-3.5 md:py-3.5"
              >
                <div>
                  <label className="mb-0.5 block text-sm font-medium text-slate-900">
                    {t.urlLabel}
                  </label>
                  <input
                    ref={urlInputRef}
                    value={url}
                    onChange={(e) => {
                      const previousListingUrl =
                        guestAudit?.listing_url ?? null;
                      const nextUrl = e.target.value;
                      activeSubmitIdRef.current += 1;
                      if (previewTimerRef.current) {
                        window.clearTimeout(previewTimerRef.current);
                        previewTimerRef.current = null;
                      }
                      setUrl(nextUrl);
                      setError(null);
                      setGuestAudit(null);
                      setIsBackgroundLoading(false);
                      setIsSubmitting(false);
                      if (previousListingUrl) {
                        clearGuestAuditDraft(previousListingUrl);
                      }
                    }}
                    type="url"
                    required
                    placeholder={t.urlPlaceholder}
                    className="w-full rounded-2xl border border-slate-300 bg-white/95 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all duration-150 ease-out placeholder:text-slate-500 hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/30 shadow-[0_1px_2px_rgba(15,23,42,0.06)] focus:shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_10px_30px_rgba(15,23,42,0.10)]"
                  />
                </div>

                <div>
                  <label className="mb-0.5 block text-sm font-medium text-slate-900">
                    {t.propertyTypeLabel}{" "}
                    <span className="font-normal text-slate-500">{t.required}</span>
                  </label>
                  <select
                    value={propertyTypeOverride}
                    onChange={(e) => {
                      setPropertyTypeOverride(e.target.value);
                      setError(null);
                    }}
                    required
                    className={`nk-form-select w-full rounded-2xl text-sm ${
                      error === "property_type_required"
                        ? "ring-2 ring-amber-400/85 ring-offset-2 ring-offset-white"
                        : ""
                    }`}
                  >
                    {PROPERTY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value || "auto"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {t.propertyTypeHint}
                  </p>
                </div>

                <div>
                  <label className="mb-0.5 block text-sm font-medium text-slate-900">
                    {t.titleLabel}
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    type="text"
                    placeholder={t.titlePlaceholder}
                    className="w-full rounded-2xl border border-slate-300 bg-white/95 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all duration-150 ease-out placeholder:text-slate-500 hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/30 shadow-[0_1px_2px_rgba(15,23,42,0.06)] focus:shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_10px_30px_rgba(15,23,42,0.10)]"
                  />
                </div>

                <div>
                  <label className="mb-0.5 block text-sm font-medium text-slate-900">
                    {t.platformDetected}
                  </label>
                  <div className="w-full rounded-2xl border border-slate-300 bg-white/95 px-3 py-2.5 text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                    {detectedPlatformLabel}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {t.platformHint}
                  </p>
                </div>

                {error && (
                  <div className="whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {t.errors[error]}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                  <PrimaryButton
                    type="submit"
                    disabled={isLaunchDisabled}
                    className="inline-flex items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? t.launchBusy : t.launch}
                  </PrimaryButton>

                  <span className="text-xs font-medium text-slate-600">
                    {isAuthenticated
                      ? t.submitHintConnected
                      : t.submitHintGuest}
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
                    {t.analyzesTitle}
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
                          {t.analyzesItems[0].strong}
                        </span>{" "}
                        {t.analyzesItems[0].rest}
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
                          {t.analyzesItems[1].strong}
                        </span>{" "}
                        {t.analyzesItems[1].rest}
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
                          {t.analyzesItems[2].strong}
                        </span>{" "}
                        {t.analyzesItems[2].rest}
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
                          {t.analyzesItems[3].strong}
                        </span>{" "}
                        {t.analyzesItems[3].rest}
                      </span>
                    </li>
                  </ul>
                </Card>

                <Card
                  variant="soft"
                  className="nk-card nk-card-hover nk-card-sm h-full min-h-[176px] border border-amber-200/80 bg-gradient-to-b from-amber-50/85 via-amber-50/55 to-white space-y-4 p-3.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)] ring-1 ring-amber-50/80 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)] md:space-y-4 md:p-4"
                >

                  <SectionTitle className="nk-section-title mt-1.5 text-slate-900">
                    {t.whyGuestTitle}
                  </SectionTitle>

                  <ul className="mt-1 space-y-1.5 text-sm leading-5 text-slate-800">
                    <li className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full border border-amber-300 bg-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]" />
                      <span className="text-sm leading-6 text-slate-800">
                        {t.whyGuestItems[0]}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full border border-amber-300 bg-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]" />
                      <span className="text-sm leading-6 text-slate-800">
                        {t.whyGuestItems[1]}
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
                  {t.previewLabel}
                </SectionLabel>
                <h2 className="mt-3 text-2xl font-extrabold leading-tight text-slate-900 md:text-[2rem]">
                  {t.blockedTitle}
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  {t.blockedBody}
                </p>
              </div>

              <div className="rounded-2xl border border-orange-200/80 bg-white/90 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                  {t.valueAvailableTitle}
                </p>
                <ul className="mt-3 space-y-2.5 text-sm font-medium text-slate-800">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{t.valueAvailableItems[0]}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1 h-2 w-2 rounded-full bg-orange-400" />
                    <span>{t.valueAvailableItems[1]}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    <span>{t.valueAvailableItems[2]}</span>
                  </li>
                </ul>
              </div>

              <a
                href="#plan-action-premium"
                className="inline-flex w-full items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.unlockFull}
              </a>
            </div>
          ) : null}

          {!isAirbnbBlockedPreview && (
            <div className="nk-card nk-card-hover nk-card-lg nk-border w-full rounded-2xl border border-slate-300/75 bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,0.08),transparent_36%),radial-gradient(circle_at_100%_100%,rgba(251,146,60,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] space-y-3.5 p-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-emerald-50/95 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.14)] md:space-y-4 md:p-4">
              {isBackgroundLoading ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {t.quickPreviewNote}
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200/80 bg-white/92 px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                <SectionLabel className="nk-section-title text-base text-emerald-700 tracking-widest uppercase">
                  {t.previewLabel}
                </SectionLabel>
                <h2 className="mt-1 text-xl font-extrabold leading-tight text-slate-900 md:text-[1.7rem]">
                  {title.trim() ? title.trim() : t.analyzedAutomatically}
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
                          {t.estimated}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-1.5 md:pl-1">
                      <p className="inline-flex items-center rounded-full border border-orange-300 bg-orange-100/95 px-3 py-1 text-[11px] font-semibold text-orange-900 shadow-[0_6px_14px_rgba(249,115,22,0.2)]">
                        {t.losingBookings}
                      </p>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex rounded-full border border-slate-300/80 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
                          {displayPreview.trustInsight?.label ?? t.trustPartial}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200/90 bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {typeof displayPreview.rating === "number"
                            ? t.visibleRating(displayPreview.rating.toFixed(1))
                            : t.trustUnavailable}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <ul className="mt-2.5 space-y-1.5 text-sm text-slate-700">
                  {(visibleInsights.length > 0
                    ? visibleInsights
                    : [...t.fallbackInsights]
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
                  {t.viewAnalyzedListing}
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
                  {t.whatYouGetTitle}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                  {t.whatYouGetBody}
                </p>

                {(() => {
                  const scoreValue =
                    typeof displayPreview?.score === "number"
                      ? `${displayPreview.score.toFixed(1)}/10`
                      : "—";
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
                    : t.impactVisible;
                  const impactSubText = gainMatch
                    ? t.impactSubWithGain
                    : t.impactSubNoGain;
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
                  const signalsValue = signalCount > 0 ? String(signalCount) : "—";
                  const axesCount = visibleInsights.length;
                  const axesValue = axesCount > 0 ? String(axesCount) : "—";

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
                            {t.statScoreTitle}
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            {t.statScoreSub}
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
                            {t.statPotentialTitle}
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
                            {t.statSignalsTitle}
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            {t.statSignalsSub}
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
                            {t.statActionsTitle}
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            {t.statActionsSub}
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
                    <SectionLabel>{t.lockedBlock}</SectionLabel>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      {t.losingBookings}
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
                    {t.locked}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="relative overflow-hidden rounded-2xl border border-slate-300/85 bg-white/95 px-3.5 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
                    <SectionLabel>{t.lockedItems[0]}</SectionLabel>
                    <div className="mt-3 space-y-3 opacity-90 blur-[1px]">
                      <div className="space-y-2">
                        <div className="h-2.5 w-20 rounded-full bg-slate-300" />
                        <div className="h-2.5 w-full rounded-full bg-slate-200" />
                        <div className="h-2.5 w-4/5 rounded-full bg-slate-200" />
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center bg-gradient-to-b from-white/10 via-white/35 to-white/65">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                        {t.locked}
                      </span>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-slate-300/85 bg-white/95 px-3.5 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
                    <SectionLabel>{t.lockedItems[1]}</SectionLabel>
                    <div className="mt-3 space-y-3 opacity-90 blur-[1px]">
                      <div className="grid gap-2">
                        <div className="h-8 rounded-xl bg-slate-200" />
                        <div className="h-8 rounded-xl bg-slate-200" />
                        <div className="h-8 rounded-xl bg-slate-200" />
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center bg-gradient-to-b from-white/10 via-white/35 to-white/65">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                        {t.locked}
                      </span>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-slate-300/85 bg-white/95 px-3.5 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
                    <SectionLabel>{t.lockedItems[2]}</SectionLabel>
                    <div className="mt-3 space-y-3 opacity-90 blur-[1px]">
                      <div className="space-y-2">
                        <div className="h-10 rounded-xl bg-slate-200" />
                        <div className="h-10 rounded-xl bg-slate-200" />
                        <div className="h-10 rounded-xl bg-slate-200" />
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center bg-gradient-to-b from-white/10 via-white/35 to-white/65">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                        {t.locked}
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
                {t.premiumKicker}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {isAuthenticated && isPlatformAdmin
                  ? t.premiumHeadingAdmin
                  : isAuthenticated
                    ? t.premiumHeadingAuthenticated
                    : t.premiumHeadingGuest}
              </h2>
              <SectionDescription className="mt-2 text-sm text-slate-500">
                {isAuthenticated && isPlatformAdmin
                  ? t.premiumDescriptionAdmin
                  : isAuthenticated
                    ? t.premiumDescriptionAuthenticated
                    : t.premiumDescriptionGuest}
              </SectionDescription>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.1)] ring-1 ring-white/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(15,23,42,0.16)]">
                  <p className="text-[11px] font-semibold text-slate-900">
                    {t.benefitPartialTitle}
                  </p>
                  <p className="mt-1 text-[11px] leading-4.5 text-slate-600">
                    {t.benefitPartialBody}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.1)] ring-1 ring-white/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(15,23,42,0.16)]">
                  <p className="text-[11px] font-semibold text-slate-900">
                    {isAuthenticated && isPlatformAdmin
                      ? t.benefitFullTitleAdmin
                      : t.benefitFullTitle}
                  </p>
                  <p className="mt-1 text-[11px] leading-4.5 text-slate-600">
                    {isAuthenticated && isPlatformAdmin
                      ? t.benefitFullBodyAdmin
                      : t.benefitFullBody}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.1)] ring-1 ring-white/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(15,23,42,0.16)]">
                  <p className="text-[11px] font-semibold text-slate-900">
                    {t.benefitFastTitle}
                  </p>
                  <p className="mt-1 text-[11px] leading-4.5 text-slate-600">
                    {t.benefitFastBody}
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
                      <p className="text-sm font-semibold text-slate-900">{t.features[0].title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {t.features[0].body}
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
                      <p className="text-sm font-semibold text-slate-900">{t.features[1].title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {t.features[1].body}
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
                      <p className="text-sm font-semibold text-slate-900">{t.features[2].title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {t.features[2].body}
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
                      <p className="text-sm font-semibold text-slate-900">{t.features[3].title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {t.features[3].body}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 space-y-3 md:mt-4 md:space-y-3.5">
                {isAuthenticated && isPlatformAdmin ? (
                  <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/40 px-4 py-5 text-center shadow-[0_10px_28px_rgba(124,58,237,0.08)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700">
                      {t.adminPanelTitle}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {t.adminPanelBody}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {t.adminPanelHelp}
                    </p>
                    <Link
                      href="/dashboard/listings"
                      className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg border border-violet-300 bg-white px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-800 shadow-sm transition hover:bg-violet-50 md:h-12"
                    >
                      {t.adminPanelOpen}
                    </Link>
                  </div>
                ) : null}
                {!(isAuthenticated && isPlatformAdmin) ? (
                  <>
                <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-3.5 py-2.5 text-center">
                  <p className="text-sm font-bold text-orange-900">
                    {t.losingBookings}
                  </p>
                  <p className="mt-1 text-xs font-medium text-orange-800">
                    {t.seenButCompetitors}
                  </p>
                  <p className="mt-1 text-xs text-orange-700">
                    {t.fewOptimizations}
                  </p>
                </div>
                <div className="space-y-2">
                  {PAYWALL_OFFERS.map((offer) => (
                    <div
                      key={offer.code}
                      className={`w-full rounded-2xl text-left transition-all duration-200 ${
                        offer.highlighted
                          ? "nk-card-highlight border border-orange-300/95 bg-orange-50/80 px-4 py-3.5 shadow-[0_10px_22px_rgba(249,115,22,0.14)] md:scale-[1.01] md:px-5 md:py-4"
                          : "nk-card-sm border border-slate-300/80 bg-white px-3.5 py-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.06)] md:px-4 md:py-3"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 md:gap-5">
                        <div className="min-w-0 flex-1 pr-1">
                          <p className="text-sm font-semibold leading-5 text-slate-900">
                            {t.offers[offer.code].name}
                          </p>
                          <p className="mt-1 text-[12px] leading-5 text-slate-600">
                            {t.offers[offer.code].detail} —{" "}
                            <b>
                              {t.offers[offer.code].listings}
                            </b>
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-emerald-700">
                            {t.offerIncluded}
                          </p>
                          <p className="mt-1.5 text-[11px] leading-5 text-slate-600">
                            {t.offers[offer.code].note}
                          </p>
                        </div>
                        <div className="shrink-0 space-y-1 text-right md:border-l md:border-slate-200/80 md:pl-4">
                          <p className="text-2xl font-bold leading-none tracking-tight text-slate-950">
                            {t.offers[offer.code].price}
                          </p>
                          {offer.highlighted ? (
                            <>
                              <span className="mt-1 inline-flex rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                                {t.recommended}
                              </span>
                              <p className="mt-1 max-w-[170px] text-[11px] font-medium leading-4 text-slate-500">
                                {t.recommendedNote}
                              </p>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                  </>
                ) : null}
              </div>

              <div className="mt-3 md:mt-3.5">
                {!(isAuthenticated && isPlatformAdmin) ? (
                  <>
                <p className="mb-1.5 mt-2.5 text-center text-xs text-orange-700 md:mt-3">
                  {t.closingLine}
                </p>
                <p className="mb-2 text-center text-xs font-medium text-slate-600">
                  {t.immediateAccess}
                </p>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handlePremiumCheckout}
                    aria-label={t.unlockAria(t.offers[selectedOfferConfig.code].name)}
                    disabled={isPremiumCheckoutLoading}
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:opacity-50 disabled:cursor-not-allowed md:h-12 md:px-7"
                  >
                    {t.unlockCta}
                  </button>
                ) : (
                  <Link
                    href={`/sign-in?next=${encodeURIComponent(`/audit/new?restored=1&offer=${selectedOffer}`)}`}
                    aria-label={t.unlockAria(t.offers[selectedOfferConfig.code].name)}
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:opacity-50 disabled:cursor-not-allowed md:h-12 md:px-7"
                  >
                    {t.unlockCta}
                  </Link>
                )}
                {premiumCheckoutError ? (
                  <p className="mt-2 text-center text-xs text-red-600">
                    {t.errors[premiumCheckoutError]}
                  </p>
                ) : null}
                  </>
                ) : null}
                <div className="mt-2 text-center md:mt-2.5">
                  <Link
                    href={`/sign-in?next=${encodeURIComponent("/dashboard")}`}
                    className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
                  >
                    {t.alreadyAccount}
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
                    {t.trustItems[0]}
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
                    {t.trustItems[1]}
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
                    {t.trustItems[2]}
                  </p>
                </div>
                <p className="mt-2.5 text-center text-[11px] text-slate-400">
                  {t.securePayment}
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

function buildPreviewFromDraft(draft: GuestAuditDraft, untitledListing: string): GuestAuditPreview {
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
    title: rawPayload?.title ?? draft.title ?? untitledListing,
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

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuditLaunchOverlay } from "@/components/AuditLaunchOverlay";
import { supabase } from "@/lib/supabase";
import { applyStayDatesToListingUrl } from "@/lib/listings/applyStayDatesToListingUrl";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { getWorkspacePlan } from "@/lib/billing/getWorkspacePlan";
import { runAuditForListing } from "@/components/RunAuditForListingButton";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/listings/propertyTypeOverrideOptions";

const AUDIT_POLL_MS = 2500;
const AUDIT_STALE_MS = 45 * 60 * 1000;
const AUDIT_REDIRECT_MAX_AGE_MS = 10 * 60 * 1000;

function activeAuditKey(workspaceId: string) {
  return `norixo_active_audit:${workspaceId}`;
}

function auditRedirectKey(workspaceId: string) {
  return `norixo_audit_redirect:${workspaceId}`;
}

/** Date locale au format yyyy-mm-dd (champ `input type="date"`). */
function todayIsoDateLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ActiveAuditPending = {
  listingId: string;
  workspaceId: string;
  startedAt: number;
};

let globalAuditPoll: ReturnType<typeof setInterval> | null = null;

function disarmGlobalAuditPoll() {
  if (globalAuditPoll != null) {
    clearInterval(globalAuditPoll);
    globalAuditPoll = null;
  }
}

function armGlobalAuditPoll(
  workspaceId: string,
  handlers: { onFound: (auditId: string) => void; onStale: () => void }
) {
  disarmGlobalAuditPoll();
  const tick = async () => {
    const raw = sessionStorage.getItem(activeAuditKey(workspaceId));
    if (!raw) {
      disarmGlobalAuditPoll();
      return;
    }
    let pending: ActiveAuditPending;
    try {
      pending = JSON.parse(raw) as ActiveAuditPending;
    } catch {
      disarmGlobalAuditPoll();
      sessionStorage.removeItem(activeAuditKey(workspaceId));
      return;
    }
    if (Date.now() - pending.startedAt > AUDIT_STALE_MS) {
      disarmGlobalAuditPoll();
      sessionStorage.removeItem(activeAuditKey(workspaceId));
      handlers.onStale();
      return;
    }
    const threshold = new Date(pending.startedAt - 120_000).toISOString();
    const { data } = await supabase
      .from("audits")
      .select("id")
      .eq("listing_id", pending.listingId)
      .eq("workspace_id", workspaceId)
      .gte("created_at", threshold)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      disarmGlobalAuditPoll();
      sessionStorage.removeItem(activeAuditKey(workspaceId));
      handlers.onFound(data.id);
    }
  };
  void tick();
  globalAuditPoll = setInterval(() => void tick(), AUDIT_POLL_MS);
}

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

const ADVANCED_MARKET_TIER_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "haut_standing", label: "Haut standing" },
  { value: "premium", label: "Premium" },
  { value: "luxe_experientiel", label: "Luxe expérientiel" },
  { value: "ultra_luxe", label: "Ultra-luxe" },
] as const;

const ADVANCED_SIGNAL_OPTIONS = [
  { value: "private_pool", label: "Piscine privée" },
  { value: "sea_view", label: "Vue mer" },
  { value: "beachfront", label: "Beachfront" },
  { value: "jacuzzi", label: "Jacuzzi" },
  { value: "parking", label: "Parking" },
  { value: "ac", label: "Climatisation" },
  { value: "wifi", label: "Wifi" },
  { value: "gym", label: "Gym" },
  { value: "terrace", label: "Terrasse" },
  { value: "concierge", label: "Conciergerie" },
] as const;

export default function NewListingPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [url, setUrl] = useState("");
  const [propertyTypeOverride, setPropertyTypeOverride] = useState("");
  const [stayCheckIn, setStayCheckIn] = useState("");
  const [stayCheckOut, setStayCheckOut] = useState("");
  const [platform, setPlatform] = useState("airbnb");
  const [advancedBedrooms, setAdvancedBedrooms] = useState("");
  const [advancedBathrooms, setAdvancedBathrooms] = useState("");
  const [advancedGuests, setAdvancedGuests] = useState("");
  const [advancedBeds, setAdvancedBeds] = useState("");
  const [advancedMinStay, setAdvancedMinStay] = useState("");
  const [advancedMarketTier, setAdvancedMarketTier] = useState("");
  const [advancedSignals, setAdvancedSignals] = useState<string[]>([]);
const SHOW_ADVANCED_MARKET_SETTINGS = false;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [bookingExtractionUnavailable, setBookingExtractionUnavailable] = useState(false);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const [resumeAuditUi, setResumeAuditUi] = useState(false);
  const [formGateError, setFormGateError] = useState<string | null>(null);
  const [formGateMissingLabels, setFormGateMissingLabels] = useState<string[]>([]);
  const [formGateDateOrder, setFormGateDateOrder] = useState(false);
  const [invalidFields, setInvalidFields] = useState<{
    url?: boolean;
    dates?: boolean;
    platform?: boolean;
    propertyType?: boolean;
  }>({});
  const stayCheckInRef = useRef<HTMLInputElement | null>(null);
  const stayCheckOutRef = useRef<HTMLInputElement | null>(null);

  const minStayCheckInIso = useMemo(() => todayIsoDateLocal(), []);
  const minStayCheckOutIso = useMemo(() => {
    const cin = stayCheckIn.trim();
    if (cin) return addDaysToIsoDate(cin, 1);
    return addDaysToIsoDate(minStayCheckInIso, 1);
  }, [stayCheckIn, minStayCheckInIso]);

  function openNativeDatePicker(ref: { current: HTMLInputElement | null }) {
    const input = ref.current;
    if (!input || input.disabled) return;
    try {
      const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
      if (typeof pickerInput.showPicker === "function") {
        pickerInput.showPicker();
        return;
      }
    } catch {
      // Fallback below for browsers that throw on showPicker.
    }
    input.focus();
  }

  const workspaceForPollRef = useRef<string | null>(null);
  const pollHandlersRef = useRef({
    onFound: (_auditId: string) => {},
    onStale: () => {},
  });
  pollHandlersRef.current = {
    onFound(auditId: string) {
      setIsSubmitting(false);
      setResumeAuditUi(false);
      setBookingExtractionUnavailable(false);
      setError(null);
      setFormGateError(null);
      setFormGateMissingLabels([]);
      setFormGateDateOrder(false);
      setInvalidFields({});
      const ws = workspaceForPollRef.current;
      if (ws) sessionStorage.removeItem(auditRedirectKey(ws));
      router.replace(`/dashboard/audits/${auditId}`);
    },
    onStale() {
      setIsSubmitting(false);
      setResumeAuditUi(false);
      setError(
        "L’analyse a pris trop de temps ou a échoué. Vous pouvez relancer un audit."
      );
    },
  };

  useEffect(() => {
    let cancelled = false;

    async function bootRecovery() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user || cancelled) return;

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
      });
      const ws = workspace?.id;
      if (!ws || cancelled) return;

      workspaceForPollRef.current = ws;

      const rk = auditRedirectKey(ws);
      const redirectRaw = sessionStorage.getItem(rk);
      if (redirectRaw) {
        try {
          const parsed = JSON.parse(redirectRaw) as { auditId?: string; ts?: number };
          if (
            parsed.auditId &&
            typeof parsed.ts === "number" &&
            Date.now() - parsed.ts < AUDIT_REDIRECT_MAX_AGE_MS
          ) {
            disarmGlobalAuditPoll();
            sessionStorage.removeItem(rk);
            router.replace(`/dashboard/audits/${parsed.auditId}`);
            return;
          }
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem(rk);
      }

      const rawPending = sessionStorage.getItem(activeAuditKey(ws));
      if (!rawPending) return;

      let pending: ActiveAuditPending;
      try {
        pending = JSON.parse(rawPending) as ActiveAuditPending;
      } catch {
        sessionStorage.removeItem(activeAuditKey(ws));
        return;
      }
      if (pending.workspaceId !== ws) {
        sessionStorage.removeItem(activeAuditKey(ws));
        return;
      }
      if (Date.now() - pending.startedAt > AUDIT_STALE_MS) {
        sessionStorage.removeItem(activeAuditKey(ws));
        setError("Délai dépassé : l’audit précédent n’a pas pu être confirmé.");
        return;
      }

      setIsSubmitting(true);
      setResumeAuditUi(true);
      armGlobalAuditPoll(ws, {
        onFound: (id) => pollHandlersRef.current.onFound(id),
        onStale: () => pollHandlersRef.current.onStale(),
      });
    }

    void bootRecovery();

    return () => {
      cancelled = true;
    };
  }, [router]);

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
  ): "airbnb" | "booking" | null {
    const value = nextUrl.trim().toLowerCase();
    if (!value) return null;
    if (value.includes("airbnb")) return "airbnb";
    if (value.includes("booking")) return "booking";
    return null;
  }

  useEffect(() => {
    const detectedPlatform = detectPlatformFromInput(url);
    if (detectedPlatform && detectedPlatform !== platform) {
      setPlatform(detectedPlatform);
    }
  }, [url, platform]);

  useEffect(() => {
    const cin = stayCheckIn.trim();
    if (!cin) return;
    setStayCheckOut((prev) => {
      const p = prev.trim();
      if (!p) return prev;
      const minOut = addDaysToIsoDate(cin, 1);
      if (p < minOut) return "";
      return prev;
    });
  }, [stayCheckIn]);

  useEffect(() => {
    setFormGateError(null);
    setFormGateMissingLabels([]);
    setFormGateDateOrder(false);
    setInvalidFields({});
  }, [
    url,
    stayCheckIn,
    stayCheckOut,
    platform,
  ]);

  function validateListingFormGate(): {
    ok: boolean;
    missingLabels: string[];
    dateOrderError: boolean;
    highlights: typeof invalidFields;
  } {
    const missingLabels: string[] = [];
    const highlights: typeof invalidFields = {};

    if (!url.trim()) {
      missingLabels.push("URL de l’annonce");
      highlights.url = true;
    }
    if (!stayCheckIn.trim()) {
      missingLabels.push("date d’arrivée");
      highlights.dates = true;
    }
    if (!stayCheckOut.trim()) {
      missingLabels.push("date de départ");
      highlights.dates = true;
    }
    const cin = stayCheckIn.trim();
    const cout = stayCheckOut.trim();
    let dateOrderError = false;
    if (cin && cout) {
      const minOut = addDaysToIsoDate(cin, 1);
      if (cout <= cin || cout < minOut) {
        dateOrderError = true;
        highlights.dates = true;
      }
    }

    if (!platform.trim()) {
      missingLabels.push("plateforme");
      highlights.platform = true;
    }

    if (!propertyTypeOverride.trim()) {
      missingLabels.push("type de logement");
      highlights.propertyType = true;
    }

    const ok = missingLabels.length === 0 && !dateOrderError;
    return { ok, missingLabels, dateOrderError, highlights };
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsQuotaError(false);
    setBookingExtractionUnavailable(false);

    const gate = validateListingFormGate();
    if (!gate.ok) {
      const typeMissing = !propertyTypeOverride.trim();
      const otherMissing = gate.missingLabels.filter((l) => l !== "type de logement");
      const parts: string[] = [];
      if (typeMissing) {
        parts.push("Veuillez choisir le type de logement.");
      }
      if (otherMissing.length > 0) {
        parts.push(
          `Complétez les champs obligatoires avant de lancer l’audit : ${otherMissing.join(", ")}.`
        );
      }
      if (gate.dateOrderError) {
        parts.push("La date de départ doit être après la date d’arrivée.");
      }
      const primaryMessage =
        parts.join(" ") ||
        "Complétez les champs obligatoires avant de lancer l’audit : URL, dates et type de logement.";
      setFormGateError(primaryMessage);
      setFormGateMissingLabels(gate.missingLabels);
      setFormGateDateOrder(gate.dateOrderError);
      setInvalidFields(gate.highlights);
      return;
    }
    setFormGateError(null);
    setFormGateMissingLabels([]);
    setFormGateDateOrder(false);
    setInvalidFields({});

    setIsSubmitting(true);
    setStepIndex(0);
    setHintIndex(0);

    let auditPendingWorkspace: string | null = null;

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

      workspaceForPollRef.current = effectiveWorkspaceId;

      const trimmedListingUrl = url.trim();
      const cin = stayCheckIn.trim();
      const cout = stayCheckOut.trim();

      const finalUrl = applyStayDatesToListingUrl(trimmedListingUrl, {
        checkIn: cin,
        checkOut: cout,
      });
      const normalizedUrl = normalizeSourceUrl(finalUrl);

      if (process.env.NODE_ENV === "development") {
        console.log("[listing-new][geo-overrides-submit]", {
          country: null,
          city: null,
          url: finalUrl,
          note: "pays/ville déduits côté extraction",
        });
      }

      const { data: existingListings, error: existingListingsError } = await supabase
        .from("listings")
        .select("id, source_url")
        .eq("workspace_id", effectiveWorkspaceId)
        .is("deleted_at", null);

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
            source_url: finalUrl,
            title: "Annonce sans titre",
            market_country_override: null,
            market_city_override: null,
          })
          .select("id, source_url")
          .single();

        if (listingError || !createdListing) {
          throw new Error(listingError?.message || "Échec de création de l’annonce");
        }

        listingRow = createdListing;
      } else {
        const { error: geoUpdateError } = await supabase
          .from("listings")
          .update({
            source_url: finalUrl,
          })
          .eq("id", listingRow.id)
          .eq("workspace_id", effectiveWorkspaceId);

        if (geoUpdateError) {
          throw new Error(
            geoUpdateError.message || "Impossible de mettre à jour l’URL de l’annonce"
          );
        }
      }

      if (process.env.NODE_ENV === "development") {
        const { data: geoCheckRow } = await supabase
          .from("listings")
          .select("id, market_country_override, market_city_override")
          .eq("id", listingRow.id)
          .eq("workspace_id", effectiveWorkspaceId)
          .maybeSingle();
        console.log(
          "[listing-new][geo-overrides-db-check]",
          JSON.stringify({
            id: geoCheckRow?.id ?? null,
            market_country_override: geoCheckRow?.market_country_override ?? null,
            market_city_override: geoCheckRow?.market_city_override ?? null,
          })
        );
      }

      try {
        const plan = await getWorkspacePlan(effectiveWorkspaceId, supabase);
        setPlanCode(plan.planCode);
      } catch {
        setPlanCode(null);
      }

      const sk = activeAuditKey(effectiveWorkspaceId);
      const existingRaw = sessionStorage.getItem(sk);

      if (existingRaw) {
        try {
          const ex = JSON.parse(existingRaw) as ActiveAuditPending;
          if (ex.workspaceId === effectiveWorkspaceId && ex.listingId !== listingRow.id) {
            setError(
              "Un audit est déjà en cours pour une autre annonce. Patientez la fin du traitement ou revenez sur cette page."
            );
            setIsSubmitting(false);
            setResumeAuditUi(false);
            return;
          }
          if (
            ex.workspaceId === effectiveWorkspaceId &&
            ex.listingId === listingRow.id &&
            Date.now() - ex.startedAt < AUDIT_STALE_MS
          ) {
            setResumeAuditUi(true);
            setIsSubmitting(true);
            armGlobalAuditPoll(effectiveWorkspaceId, {
              onFound: (id) => pollHandlersRef.current.onFound(id),
              onStale: () => pollHandlersRef.current.onStale(),
            });
            return;
          }
        } catch {
          sessionStorage.removeItem(sk);
        }
      }

      const pendingPayload: ActiveAuditPending = {
        listingId: listingRow.id as string,
        workspaceId: effectiveWorkspaceId,
        startedAt: Date.now(),
      };
      sessionStorage.setItem(sk, JSON.stringify(pendingPayload));
      auditPendingWorkspace = effectiveWorkspaceId;
      setResumeAuditUi(false);
      armGlobalAuditPoll(effectiveWorkspaceId, {
        onFound: (id) => pollHandlersRef.current.onFound(id),
        onStale: () => pollHandlersRef.current.onStale(),
      });

      const auditResult = await runAuditForListing(listingRow.id as string, {
        propertyTypeOverride: propertyTypeOverride.trim(),
      });

      disarmGlobalAuditPoll();
      sessionStorage.removeItem(sk);
      auditPendingWorkspace = null;

      if (!auditResult.success) {
        if (auditResult.code === "booking_extraction_unavailable") {
          setBookingExtractionUnavailable(true);
          setError(null);
          setIsQuotaError(false);
        } else if (auditResult.code === "quota_exceeded") {
          setBookingExtractionUnavailable(false);
          setError(auditResult.message);
          setIsQuotaError(true);
        } else {
          setBookingExtractionUnavailable(false);
          setError(auditResult.message);
          setIsQuotaError(false);
        }
        setIsSubmitting(false);
        setResumeAuditUi(false);
        return;
      }

      if (auditResult.auditId) {
        sessionStorage.setItem(
          auditRedirectKey(effectiveWorkspaceId),
          JSON.stringify({ auditId: auditResult.auditId, ts: Date.now() })
        );
        if (pathname === "/dashboard/listings/new") {
          setTimeout(() => {
            sessionStorage.removeItem(auditRedirectKey(effectiveWorkspaceId));
            router.push(`/dashboard/audits/${auditResult.auditId}`);
          }, 350);
        }
        setIsSubmitting(false);
        setResumeAuditUi(false);
      } else {
        setIsSubmitting(false);
        setResumeAuditUi(false);
        router.push("/dashboard/listings");
      }
    } catch (err) {
      disarmGlobalAuditPoll();
      if (auditPendingWorkspace) {
        sessionStorage.removeItem(activeAuditKey(auditPendingWorkspace));
      }
      setError(
        err instanceof Error ? err.message : "Une erreur inconnue est survenue"
      );
      setIsQuotaError(false);
      setBookingExtractionUnavailable(false);
      setIsSubmitting(false);
      setResumeAuditUi(false);
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
    <div className="space-y-4 md:space-y-5 text-sm">
      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-6 py-5 md:flex md:items-center md:justify-between md:gap-10 md:px-8 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="max-w-3xl space-y-2">
          <p className="nk-kicker-muted">Nouvel audit</p>
          <h1 className="nk-page-title nk-page-title-dashboard">
            Ajouter une annonce à suivre
          </h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted text-sm leading-6 text-slate-600">
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
          isAuditLoading={isSubmitting}
          leadTitle={resumeAuditUi ? "Audit toujours en cours" : undefined}
          leadSubtitle={
            resumeAuditUi
              ? "L’analyse continue — vous pouvez naviguer dans le dashboard."
              : undefined
          }
          backgroundNote={
            resumeAuditUi
              ? "Vous pouvez changer de page, l’analyse continue en arrière-plan."
              : "⚡ Votre écran restera actif pendant l’analyse"
          }
        />
      )}

      <div className={isSubmitting ? "pointer-events-none opacity-50" : ""}>
        <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1.3fr)_340px]">
          <div className="nk-card nk-card-hover p-4 md:p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
            <p className="nk-section-title text-slate-900">Paramètres de l’annonce</p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Ces informations servent à créer la fiche de base avant de lancer un audit détaillé.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">
                  URL de l’annonce{" "}
                  <span className="font-normal text-slate-500">(obligatoire)</span>
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
                  placeholder="https://www.airbnb.com/rooms/..."
                  className={`nk-form-field rounded-xl transition-shadow ${
                    invalidFields.url
                      ? "ring-2 ring-amber-400/85 ring-offset-2 ring-offset-white"
                      : ""
                  } min-h-10 px-3.5 py-2 text-sm`}
                />
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  La localisation du logement est détectée automatiquement depuis l’annonce.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    Type de logement{" "}
                    <span className="font-normal text-slate-500">(obligatoire)</span>
                  </label>
                  <select
                    value={propertyTypeOverride}
                    onChange={(e) => setPropertyTypeOverride(e.target.value)}
                    disabled={isSubmitting}
                    required
                    className={`nk-form-select rounded-xl ${
                      invalidFields.propertyType
                        ? "ring-2 ring-amber-400/85 ring-offset-2 ring-offset-white"
                        : ""
                    } min-h-10 px-3.5 py-2 text-sm`}
                  >
                    {PROPERTY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value || "auto"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Choisissez le type réel du logement pour obtenir des comparables fiables.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    Plateforme{" "}
                    <span className="font-normal text-slate-500">(obligatoire)</span>
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className={`nk-form-select rounded-xl transition-shadow ${
                      invalidFields.platform
                        ? "ring-2 ring-amber-400/85 ring-offset-2 ring-offset-white"
                        : ""
                    } min-h-10 px-3.5 py-2 text-sm`}
                  >
                    <option value="airbnb">Airbnb</option>
                    <option value="booking">Booking</option>
                  </select>
                </div>
              </div>

              <div
                className={`grid gap-3 sm:grid-cols-2 ${
                  invalidFields.dates
                    ? "rounded-xl p-0.5 ring-2 ring-amber-400/80 ring-offset-1 ring-offset-white"
                    : ""
                }`}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => openNativeDatePicker(stayCheckInRef)}
                >
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    Date d’arrivée{" "}
                    <span className="font-normal text-slate-500">(obligatoire)</span>
                  </label>
                  <input
                    ref={stayCheckInRef}
                    value={stayCheckIn}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStayCheckIn(v);
                      setStayCheckOut((prev) => {
                        const p = prev.trim();
                        if (!v || !p) return prev;
                        const minOut = addDaysToIsoDate(v, 1);
                        if (p < minOut) return "";
                        return prev;
                      });
                    }}
                    type="date"
                    min={minStayCheckInIso}
                    disabled={isSubmitting}
                    onFocus={() => openNativeDatePicker(stayCheckInRef)}
                    className="nk-form-field min-h-10 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div
                  className="cursor-pointer"
                  onClick={() => openNativeDatePicker(stayCheckOutRef)}
                >
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    Date de départ{" "}
                    <span className="font-normal text-slate-500">(obligatoire)</span>
                  </label>
                  <input
                    ref={stayCheckOutRef}
                    value={stayCheckOut}
                    onChange={(e) => {
                      const v = e.target.value;
                      const cin = stayCheckIn.trim();
                      const minOut = cin
                        ? addDaysToIsoDate(cin, 1)
                        : addDaysToIsoDate(minStayCheckInIso, 1);
                      if (v && v < minOut) return;
                      setStayCheckOut(v);
                    }}
                    type="date"
                    min={minStayCheckOutIso}
                    disabled={isSubmitting}
                    onFocus={() => openNativeDatePicker(stayCheckOutRef)}
                    className="nk-form-field min-h-10 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500">
                Choisissez des dates disponibles pour récupérer un prix fiable.
              </p>
              <p className="mt-0.5 flex gap-2 text-[10px] leading-snug text-amber-900/90">
                <span
                  className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-amber-400/80 bg-amber-50 text-[9px] font-bold text-amber-700"
                  aria-hidden
                >
                  !
                </span>
                <span>
                  <span className="font-semibold">Important :</span> respectez le minimum de nuits
                  de l’annonce. Si la durée choisie est trop courte, Airbnb ou Booking peut ne pas
                  afficher de prix.
                </span>
              </p>

              {SHOW_ADVANCED_MARKET_SETTINGS ? (
              <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,250,252,0.93)_100%)] px-3.5 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.05),0_1px_0_rgba(255,255,255,0.68)_inset] md:px-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-800">
                    Paramètres avancés du marché
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Optionnel — aide l’audit à mieux cibler les comparables dès le départ.
                  </p>
                </div>

                <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                  <div className="flex h-full flex-col">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                        Profil du bien
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          {
                            label: "Chambres",
                            value: advancedBedrooms,
                            setter: setAdvancedBedrooms,
                            options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"],
                          },
                          {
                            label: "Salles de bain",
                            value: advancedBathrooms,
                            setter: setAdvancedBathrooms,
                            options: ["1", "2", "3", "4", "5", "6", "7", "8+"],
                          },
                          {
                            label: "Voyageurs",
                            value: advancedGuests,
                            setter: setAdvancedGuests,
                            options: ["2", "4", "6", "8", "10", "12", "14", "16", "20+"],
                          },
                          {
                            label: "Lits",
                            value: advancedBeds,
                            setter: setAdvancedBeds,
                            options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"],
                          },
                          {
                            label: "Durée min. (nuits)",
                            value: advancedMinStay,
                            setter: setAdvancedMinStay,
                            options: ["1", "2", "3", "5", "7", "14"],
                          },
                        ].map(({ label, value, setter, options }) => (
                          <div key={label}>
                            <label className="mb-1 block text-[10px] font-medium text-slate-600">
                              {label}
                            </label>
                            <select
                              value={value}
                              onChange={(e) => setter(e.target.value)}
                              disabled={isSubmitting}
                              className="nk-form-select min-h-9 rounded-xl px-2.5 py-1.5 text-[11px]"
                            >
                              <option value="">—</option>
                              {options.map((option) => (
                                <option key={option} value={option}>
                                  {label === "Durée min. (nuits)" && !option.includes("+")
                                    ? `${option} nuit${option === "1" ? "" : "s"}`
                                    : option}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                        Positionnement marché
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ADVANCED_MARKET_TIER_OPTIONS.map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setAdvancedMarketTier((current) => (current === value ? "" : value))
                            }
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.04em] transition ${
                              advancedMarketTier === value
                                ? "border-blue-500/60 bg-blue-50 text-blue-700 shadow-sm"
                                : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Signaux différenciants
                    </p>
                    <p className="mt-0.5 text-[9px] text-slate-500">
                      Les équipements servent de signaux de pondération, pas de filtres stricts.
                    </p>
                    <div className="mt-2 grid gap-x-2.5 gap-y-1.5 sm:grid-cols-2">
                      {ADVANCED_SIGNAL_OPTIONS.map(({ value, label }) => (
                        <label
                          key={value}
                          className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/75 px-2.5 py-1.5 text-[10px] text-slate-600 transition hover:border-slate-300 hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={advancedSignals.includes(value)}
                            onChange={(e) => {
                              setAdvancedSignals((current) =>
                                e.target.checked
                                  ? [...current, value]
                                  : current.filter((item) => item !== value)
                              );
                            }}
                            disabled={isSubmitting}
                            className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-400/50"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              ) : null}

              {formGateError ? (
                <div
                  className="rounded-2xl border border-amber-300/90 bg-gradient-to-b from-amber-50/98 to-amber-50/80 px-4 py-3.5 text-sm text-amber-950 shadow-[0_10px_28px_rgba(217,119,6,0.12)] ring-1 ring-amber-200/70"
                  role="alert"
                >
                  <p className="font-semibold leading-snug">{formGateError}</p>
                  {formGateMissingLabels.length > 0 ? (
                    <p className="mt-2 text-xs leading-relaxed text-amber-900/95">
                      Champs manquants :{" "}
                      {formGateMissingLabels
                        .map((s) => (s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s))
                        .join(", ")}
                      .
                    </p>
                  ) : null}
                  {formGateDateOrder && formGateMissingLabels.length > 0 ? (
                    <p className="mt-2 text-xs font-medium text-amber-900">
                      La date de départ doit être après la date d’arrivée.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {(error || bookingExtractionUnavailable) && (
                <div
                  className={
                    isQuotaError
                      ? "rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-3 text-sm text-slate-700"
                      : bookingExtractionUnavailable
                        ? "rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/98 to-amber-50/85 px-4 py-3.5 text-sm text-amber-950 shadow-[0_10px_28px_rgba(217,119,6,0.10)] ring-1 ring-amber-200/60"
                        : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  }
                >
                  {!isQuotaError && bookingExtractionUnavailable ? (
                    <div className="space-y-2" role="alert">
                      <p className="font-semibold text-amber-950">
                        Analyse Booking temporairement indisponible
                      </p>
                      <p className="leading-relaxed text-amber-900/95">
                        Booking bloque temporairement l’accès à cette annonce. L’audit n’a pas été
                        exécuté et aucun crédit n’a été débité. Réessayez dans quelques minutes ou
                        sélectionnez d’autres dates.
                      </p>
                      <p className="text-xs font-medium text-amber-800/90">
                        Votre solde reste inchangé.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setBookingExtractionUnavailable(false);
                          setError(null);
                        }}
                        className="mt-1 inline-flex items-center justify-center rounded-xl border border-amber-300/80 bg-white/90 px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                      >
                        Réessayer
                      </button>
                    </div>
                  ) : !isQuotaError ? (
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

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Conseils rapides
                </p>
                <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-slate-600">
                  <li>• Collez simplement l’URL publique de l’annonce.</li>
                  <li>• Utilisez des dates réellement disponibles.</li>
                  <li>• Les paramètres avancés sont facultatifs.</li>
                </ul>
              </div>

              <div className="flex flex-col items-start gap-1.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || isQuotaError}
                  className="inline-flex items-center justify-center rounded-xl border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Analyse en cours..." : "Lancer l’audit"}
                </button>

                <span className="text-[10px] text-slate-500">
                  Audit automatique + comparables proches
                </span>
              </div>
            </form>
          </div>

          <div className="space-y-3.5">
            <div className="nk-card-accent nk-card-accent-purple nk-card-hover flex h-full flex-col p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="nk-section-title mb-0 text-slate-900">Ce que l’audit prend en compte</p>
                <span className="inline-flex items-center rounded-full border border-violet-200/90 bg-violet-50/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-800">
                  Analyse automatique
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                L’audit combine les signaux publics de l’annonce avec votre contexte marché pour
                mieux cibler les comparables dès le départ.
              </p>

              <ul className="mt-3.5 space-y-2.5 text-[13px] text-slate-800">
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>La localisation et la plateforme sont détectées automatiquement depuis l’annonce.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>Les comparables sont filtrés par type de logement et cohérence locale.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>Le prix est recalculé à la nuit pour éviter les faux écarts marché.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>L’analyse évalue photos, description, SEO et potentiel de conversion.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>Les recommandations sont priorisées selon leur impact business estimé.</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

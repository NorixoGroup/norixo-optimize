"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { pricingPlans } from "@/lib/billing/pricingPlans";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
import {
  loadGuestAuditDraft,
  persistGuestAuditDraftAfterPayment,
  saveGuestAuditDraft,
} from "@/lib/guestAuditDraft";
import { supabase } from "@/lib/supabase";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";
import { setStoredWorkspaceId } from "@/lib/workspaces/setStoredWorkspaceId";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { ensureWorkspaceSubscription } from "@/lib/billing/ensureWorkspaceSubscription";
import {
  getBillingUpsellState,
  OFFER_CREDIT_TOTALS,
  type UpsellAction,
} from "@/lib/billing/productStrategy";

type CheckoutResult = { ok: true } | { ok: false; message: string };

function formatEuroPerAudit(value: number): string {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

/** Messages API Stripe / auth parfois en anglais : homogénéise l’affichage billing. */
function normalizeCheckoutErrorMessage(
  plan: "audit_test" | "pro" | "scale",
  raw: string | null
): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  const lower = trimmed.toLowerCase();

  if (
    lower === "failed to create checkout session" ||
    lower.includes("failed to create checkout session")
  ) {
    return plan === "scale"
      ? "Le paiement du pack Scale n’a pas pu s’ouvrir pour le moment. Réessayez dans quelques instants ou contactez-nous si le problème persiste."
      : plan === "pro"
        ? "Le paiement du pack Pro n’a pas pu s’ouvrir pour le moment. Réessayez dans quelques instants."
        : "Le paiement n’a pas pu s’ouvrir pour le moment. Réessayez dans quelques instants.";
  }

  if (lower === "unauthorized") {
    return "Votre session a expiré. Reconnectez-vous puis réessayez.";
  }

  if (
    lower === "workspace not found" ||
    lower === "forbidden workspace" ||
    lower.includes("unable to verify workspace") ||
    lower.includes("unable to load workspace") ||
    lower.includes("unable to load billing profile")
  ) {
    return "Espace de travail ou facturation introuvable. Rechargez la page ou reconnectez-vous.";
  }

  if (lower.includes("workspaceid requis") || lower.includes("workspace_id requis")) {
    return "Le workspace de facturation n’a pas été transmis. Rechargez la page Facturation et réessayez.";
  }

  if (
    trimmed.toLowerCase().includes("stripe") &&
    (trimmed.toLowerCase().includes("price") ||
      trimmed.toLowerCase().includes("price id") ||
      trimmed.toLowerCase().includes("configuré"))
  ) {
    return plan === "scale"
      ? "Le pack Scale n’est pas disponible pour le moment. Réessayez plus tard ou contactez le support."
      : plan === "pro"
        ? "Le pack Pro n’est pas disponible pour le moment. Réessayez plus tard ou contactez le support."
        : "Le paiement n’est pas disponible pour le moment. Réessayez plus tard.";
  }

  if (
    trimmed.toLowerCase().includes("application url") ||
    trimmed.toLowerCase().includes("next_public_app_url")
  ) {
    return "Le service de paiement est momentanément indisponible. Réessayez plus tard.";
  }

  if (trimmed.length > 0) {
    return trimmed;
  }

  return plan === "scale"
    ? "Le paiement du pack Scale n’a pas pu s’ouvrir. Réessayez dans un instant."
    : plan === "pro"
      ? "Le paiement du pack Pro n’a pas pu s’ouvrir. Réessayez dans un instant."
      : "Le paiement n’a pas pu démarrer. Réessayez dans un instant.";
}

const CHECKOUT_LOADING_LABEL = "Ouverture du paiement...";

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [checkoutStatus, setCheckoutStatus] = useState<"success" | "cancel" | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<"audit_test" | "pro" | "scale" | null>(null);
  const [freeNotice, setFreeNotice] = useState<string | null>(null);
  const [proNotice, setProNotice] = useState<string | null>(null);
  const [scaleNotice, setScaleNotice] = useState<string | null>(null);
  /** Checkout en cours : verrou UI + libellé du bouton actif (null = aucun). */
  const [checkoutInFlight, setCheckoutInFlight] = useState<
    "audit_test" | "pro" | "scale" | null
  >(null);
  /** Verrou synchrone anti double-clic avant le premier await (même plan = préflight Starter autorisé). */
  const checkoutActivePlanRef = useRef<"audit_test" | "pro" | "scale" | null>(null);
  const [hasAuditTestPurchase, setHasAuditTestPurchase] = useState(false);
  const [auditTestPurchaseCount, setAuditTestPurchaseCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const [availableAuditCredits, setAvailableAuditCredits] = useState(0);
  const [grantedAuditCredits, setGrantedAuditCredits] = useState(0);
  const [consumedAuditCredits, setConsumedAuditCredits] = useState(0);

  const freePlan = pricingPlans.find((plan) => plan.code === "free");
  const proPlan = pricingPlans.find((plan) => plan.code === "pro");
  const scalePlan = pricingPlans.find((plan) => plan.code === "scale");
  /** Pro = pack ponctuel 5 audits (prix affiché = tarif pack dans pricingPlans). */
  const proPrice = proPlan?.monthly ?? 39;
  /** Scale = pack ponctuel : le prix affiché suit toujours le tarif pack (monthly dans pricingPlans). */
  const scalePrice = scalePlan?.monthly ?? 99;
  const auditTestTotalPrice = 9;
  const hasUsedFreeAudit = auditCount > 0 || hasAuditTestPurchase;
  const auditTestStatusLabel = hasAuditTestPurchase
    ? auditCount > 0
      ? "Audit test achete et visible dans vos audits"
      : "Audit test achete"
    : null;
  const starterTotalAudits = OFFER_CREDIT_TOTALS.starter;
  const proTotalAudits = OFFER_CREDIT_TOTALS.pro;
  const scaleTotalAudits = OFFER_CREDIT_TOTALS.scale;
  const proUnitEuro =
    proTotalAudits > 0 ? Math.round((proPrice / proTotalAudits) * 100) / 100 : 0;
  const scaleUnitEuro =
    scaleTotalAudits > 0 ? Math.round((scalePrice / scaleTotalAudits) * 100) / 100 : 0;
  const proSavingsVsStarterPack = proTotalAudits * auditTestTotalPrice - proPrice;
  const scaleSavingsVsStarterPack = scaleTotalAudits * auditTestTotalPrice - scalePrice;
  const proUnitForCompare = proTotalAudits > 0 ? proPrice / proTotalAudits : 0;
  const scaleUnitForCompare = scaleTotalAudits > 0 ? scalePrice / scaleTotalAudits : 0;
  const scaleUnitCostReductionVsPro =
    proUnitForCompare > 0
      ? Math.round(
          ((proUnitForCompare - scaleUnitForCompare) / proUnitForCompare) * 100
        )
      : 0;
  const remainingAuditCredits = Math.max(grantedAuditCredits - consumedAuditCredits, 0);
  const starterRemainingAudits = remainingAuditCredits;
  const proRemainingAudits = remainingAuditCredits;
  const scaleRemainingAudits = remainingAuditCredits;
  const activePlanCode = planCode === "scale" ? "scale" : planCode === "pro" ? "pro" : "free";
  const activePlanTotal =
    activePlanCode === "scale" ? scaleTotalAudits : activePlanCode === "pro" ? proTotalAudits : starterTotalAudits;
  const activePlanRemaining =
    activePlanCode === "scale"
      ? scaleRemainingAudits
      : activePlanCode === "pro"
        ? proRemainingAudits
        : starterRemainingAudits;
  const checkoutLocked = loadingPlan || checkoutInFlight !== null;
  const upsellState = getBillingUpsellState(activePlanCode, activePlanRemaining);
  const hasFrequentStarterPurchases =
    activePlanCode === "free" && auditTestPurchaseCount >= 2;
  const hasFrequentProConsumption =
    activePlanCode === "pro" && grantedAuditCredits >= proTotalAudits * 2;
  const behaviorUpsell: {
    show: boolean;
    tone: "soft" | "critical";
    message: string | null;
    action: UpsellAction;
    ctaLabel: string | null;
  } = hasFrequentStarterPurchases
    ? {
        show: true,
        tone: "soft",
        message:
          "Vous rachetez souvent des audits unitaires. Le pack Pro (5 audits, paiement unique) réduit le coût par audit et sécurise votre rythme.",
        action: "upgrade_pro",
        ctaLabel: "Acheter le pack Pro (5 audits)",
      }
    : hasFrequentProConsumption && activePlanRemaining <= 2
      ? {
          show: true,
          tone: "critical",
          message:
            "Votre cadence est élevée : le pack Scale (15 audits, paiement unique — même offre que la carte) sécurise le volume avec un meilleur coût par audit.",
          action: "upgrade_scale",
          ctaLabel: "Acheter le pack Scale (15 audits)",
        }
      : activePlanCode === "scale" && activePlanRemaining === 0
        ? {
            show: true,
            tone: "critical",
            message:
              "Vos crédits Scale sont épuisés. Rechargez maintenant pour éviter d’interrompre vos optimisations en cours.",
            action: "buy_top_up",
            ctaLabel: "Acheter 1 audit",
          }
        : {
            show: false,
            tone: "soft",
            message: null,
            action: null,
            ctaLabel: null,
          };
  const recommendedOfferCode =
    behaviorUpsell.action === "upgrade_pro"
      ? "pro"
      : behaviorUpsell.action === "upgrade_scale"
        ? "scale"
        : null;
  const strategicRecommendedOfferCode =
    recommendedOfferCode ??
    (activePlanCode === "free" ? "pro" : activePlanCode === "pro" ? "scale" : null);
  const starterBadgeText =
    activePlanCode === "free"
      ? loadingPlan
        ? "Nouveaux audits —/1"
        : `Nouveaux audits : ${starterRemainingAudits}/${starterTotalAudits}`
      : "1 audit";
  const billingUiReady = !loadingPlan;
  /** Inclure la query (retour Stripe, etc.) pour relire plan + crédits après chaque achat. */
  const billingSearchSignature = searchParams.toString();

  useEffect(() => {
    let mounted = true;
  
    async function loadPlan() {
      try {
        setLoadingPlan(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
  
        if (!user) return;
  
        const workspace = await getOrCreateWorkspaceForUser({
          userId: user.id,
          email: user.email ?? null,
          client: supabase,
        });
  
        if (!workspace || !mounted) return;
  
        const storedWorkspaceId = getStoredWorkspaceId();
        const activeWorkspaceId = storedWorkspaceId ?? workspace.id;
        setStoredWorkspaceId(activeWorkspaceId);
        setCurrentWorkspaceId(activeWorkspaceId);
  
        const [subscriptionResult, metricsResult, creditsResult] =
          await Promise.allSettled([
            ensureWorkspaceSubscription(activeWorkspaceId, supabase),
            Promise.all([
              supabase
                .from("usage_events")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", activeWorkspaceId)
                .eq("event_type", "audit_test_purchased"),
              supabase
                .from("audits")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", activeWorkspaceId),
            ]),
            getWorkspaceAuditCredits(activeWorkspaceId, supabase),
          ]);
  
        if (!mounted) return;
  
        const subscription =
          subscriptionResult.status === "fulfilled" ? subscriptionResult.value : null;
  
        setPlanCode(subscription?.plan_code ?? "free");
  
        if (metricsResult.status === "fulfilled") {
          const [
            { count: purchasedCount, error: usageError },
            { count: createdAuditCount, error: auditsError },
          ] = metricsResult.value;
  
          if (usageError) {
            console.warn("Failed to load audit_test purchase events", usageError);
            setHasAuditTestPurchase(false);
            setAuditTestPurchaseCount(0);
          } else {
            setHasAuditTestPurchase((purchasedCount ?? 0) > 0);
            setAuditTestPurchaseCount(purchasedCount ?? 0);
          }
  
          if (auditsError) {
            console.warn("Failed to load audit count for billing", auditsError);
            setAuditCount(0);
          } else {
            setAuditCount(createdAuditCount ?? 0);
          }
        } else {
          setHasAuditTestPurchase(false);
          setAuditTestPurchaseCount(0);
          setAuditCount(0);
        }
  
        if (creditsResult.status === "fulfilled") {
          setAvailableAuditCredits(creditsResult.value.available);
          setGrantedAuditCredits(creditsResult.value.granted);
          setConsumedAuditCredits(creditsResult.value.consumed);
          console.info("[billing][balance] client_billing_snapshot", {
            workspaceId: activeWorkspaceId,
            granted: creditsResult.value.granted,
            consumed: creditsResult.value.consumed,
            available: creditsResult.value.available,
            billingSearchSignature,
          });
        } else {
          setAvailableAuditCredits(0);
          setGrantedAuditCredits(0);
          setConsumedAuditCredits(0);
        }
      } finally {
        if (mounted) {
          setLoadingPlan(false);
        }
      }
    }
  
    void loadPlan();
  
    return () => {
      mounted = false;
    };
  }, [billingSearchSignature]);
    

  useEffect(() => {
    let mounted = true;

    async function handleCheckoutState() {
      const status = searchParams.get("checkout");
      const success = searchParams.get("success");
      const canceled = searchParams.get("canceled");
      const plan = searchParams.get("plan");

      if (plan === "audit_test" || plan === "pro" || plan === "scale") {
        setCheckoutPlan(plan);
      }

      if (status === "success" || success === "true") {
        setCheckoutStatus("success");

        if (plan === "audit_test") {
          const persistence = await persistGuestAuditDraftAfterPayment();

          if (!mounted) return;

          if (!persistence.persisted) {
            console.warn("Failed to persist paid guest audit after checkout", {
              error: persistence.error ?? null,
            });
          }
        }

        router.replace("/dashboard/billing");
        return;
      }

      if (status === "cancel" || canceled === "true") {
        setCheckoutStatus("cancel");
        router.replace("/dashboard/billing");
      }
    }

    void handleCheckoutState();

    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  function releaseCheckoutLock() {
    checkoutActivePlanRef.current = null;
    setCheckoutInFlight(null);
  }

  async function handleCheckout(
    plan: "audit_test" | "pro" | "scale",
    options?: { quantity?: number },
    meta?: { continuationAfterAuditPreflight?: boolean }
  ): Promise<CheckoutResult> {
    if (loadingPlan) {
      releaseCheckoutLock();
      return {
        ok: false,
        message: "Chargement du plan en cours. Réessayez dans un instant.",
      };
    }

    const active = checkoutActivePlanRef.current;
    if (active !== null && active !== plan) {
      return {
        ok: false,
        message: "Un paiement est déjà en cours. Patientez quelques secondes.",
      };
    }
    if (
      active !== null &&
      active === plan &&
      !(meta?.continuationAfterAuditPreflight && plan === "audit_test")
    ) {
      return {
        ok: false,
        message: "Un paiement est déjà en cours. Patientez quelques secondes.",
      };
    }
    if (active === null) {
      checkoutActivePlanRef.current = plan;
      setCheckoutInFlight(plan);
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        releaseCheckoutLock();
        return { ok: false, message: "Vous devez être connecté pour continuer." };
      }

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
        client: supabase,
      });

      if (!workspace) {
        releaseCheckoutLock();
        return {
          ok: false,
          message: "Workspace introuvable. Réessayez plus tard.",
        };
      }

      if (!currentWorkspaceId?.trim()) {
        releaseCheckoutLock();
        return {
          ok: false,
          message: "Chargement du workspace en cours. Patientez un instant puis réessayez.",
        };
      }

      const checkoutWorkspaceId = currentWorkspaceId.trim();
      setStoredWorkspaceId(checkoutWorkspaceId);

      console.info("[billing][checkout] workspace_id_sent_by_billing", {
        plan,
        workspace_id_sent_by_billing: checkoutWorkspaceId,
        resolved_fallback_workspace_id: workspace.id,
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          workspaceId: checkoutWorkspaceId,
          plan,
          ...(plan === "scale" || plan === "pro"
            ? { checkoutMode: "one_shot" as const }
            : { interval: "month" as const }),
          ...(plan === "audit_test" ? { quantity: options?.quantity ?? 1 } : {}),
          ...(plan === "audit_test"
            ? (() => {
                const draft = loadGuestAuditDraft();
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
                            ? String((draft.full_payload as { summary?: string | null }).summary ?? "")
                            : null,
                      },
                    }
                  : {};
              })()
            : {}),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.warn("Failed to start Stripe checkout", {
          plan,
          status: response.status,
          error: data?.error ?? null,
        });
        const apiMsg =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : null;
        releaseCheckoutLock();
        return {
          ok: false,
          message: normalizeCheckoutErrorMessage(
            plan,
            apiMsg ??
              "Le paiement n’a pas pu démarrer. Vérifiez votre connexion ou réessayez plus tard."
          ),
        };
      }

      if (data?.url) {
        window.location.href = data.url as string;
        return { ok: true };
      }

      releaseCheckoutLock();
      return {
        ok: false,
        message: "Réponse de paiement incomplète (URL de redirection manquante).",
      };
    } catch (error) {
      console.warn(`Stripe checkout error for ${plan}`, error);
      releaseCheckoutLock();
      return {
        ok: false,
        message: "Erreur lors du démarrage du paiement. Réessayez plus tard.",
      };
    }
  }

  async function handleUpgradeToPro() {
    setProNotice(null);
    const result = await handleCheckout("pro");
    if (!result.ok) {
      setProNotice(
        result.message || "Impossible d’ouvrir le paiement du pack Pro pour le moment."
      );
    }
  }

  async function handleProCardCTA() {
    setProNotice(null);
    if (loadingPlan) {
      setProNotice("Chargement du plan en cours. Patientez un instant.");
      return;
    }
    const result = await handleCheckout("pro");
    if (!result.ok) {
      setProNotice(
        result.message || "Impossible d’ouvrir le paiement du pack Pro pour le moment."
      );
    }
  }

  async function handleAuditTestCheckout() {
    setFreeNotice(null);

    if (loadingPlan) {
      return;
    }

    const draft = loadGuestAuditDraft();
    const isCreditTopUp = hasUsedFreeAudit;

    if (!isCreditTopUp && (draft?.payment_status === "paid" || draft?.persisted_audit_id)) {
      console.info("[billing][audit_test] blocked duplicate payment from local draft", {
        workspaceId: currentWorkspaceId,
        generatedAt: draft?.generated_at ?? null,
        persistedAuditId: draft?.persisted_audit_id ?? null,
      });
      setFreeNotice("Cet audit test est deja debloque pour cette annonce.");
      return;
    }

    if (checkoutActivePlanRef.current !== null) {
      return;
    }
    checkoutActivePlanRef.current = "audit_test";
    setCheckoutInFlight("audit_test");

    if (!isCreditTopUp && draft?.generated_at && currentWorkspaceId) {
      const { data: existingAudits, error } = await supabase
        .from("audits")
        .select("id, result_payload")
        .eq("workspace_id", currentWorkspaceId)
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) {
        console.warn("Failed to verify duplicate audit_test payment state", error);
      } else {
        const matchingAudit = (existingAudits ?? []).find((audit) => {
          const payload =
            audit &&
            typeof audit === "object" &&
            "result_payload" in audit &&
            audit.result_payload &&
            typeof audit.result_payload === "object"
              ? (audit.result_payload as { guest_draft_generated_at?: string })
              : null;

          return payload?.guest_draft_generated_at === draft.generated_at;
        });

        if (matchingAudit && typeof matchingAudit === "object" && "id" in matchingAudit) {
          saveGuestAuditDraft({
            ...draft,
            payment_status: "paid",
            persisted_audit_id: String(matchingAudit.id),
          });
          console.info("[billing][audit_test] blocked duplicate payment from persisted audit", {
            workspaceId: currentWorkspaceId,
            generatedAt: draft.generated_at,
            auditId: matchingAudit.id,
          });
          releaseCheckoutLock();
          setFreeNotice("Cet audit test a deja ete achete pour cette annonce.");
          return;
        }
      }
    }

    const result = await handleCheckout("audit_test", undefined, {
      continuationAfterAuditPreflight: true,
    });

    if (!result.ok) {
      setFreeNotice(
        result.message || "Impossible d'ouvrir le paiement de l'audit test pour le moment."
      );
    }
  }

  async function handleScaleCTA() {
    setScaleNotice(null);
    const result = await handleCheckout("scale");

    if (!result.ok) {
      setScaleNotice(
        result.message ||
          "Impossible d’ouvrir le paiement du pack Scale pour le moment."
      );
    }
  }

  return (
    <div className="space-y-7 text-sm md:space-y-8">
      {checkoutStatus === "success" && (
        <div className="nk-card-accent nk-card-accent-emerald nk-card-hover flex flex-col items-start justify-between gap-2 rounded-2xl border border-emerald-200/85 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-[0_10px_24px_rgba(5,150,105,0.12),0_1px_0_rgba(255,255,255,0.62)_inset] sm:flex-row sm:items-center">
          <span>
            {checkoutPlan === "audit_test"
              ? "Paiement reussi. Votre audit test est maintenant debloque."
              : checkoutPlan === "scale"
              ? "Paiement réussi. Votre pack Scale (15 audits) est disponible."
              : checkoutPlan === "pro"
              ? "Paiement réussi. Votre pack Pro (5 audits) est disponible."
              : "Paiement réussi. Votre achat est confirmé."}
          </span>
          {(checkoutPlan === "pro" || checkoutPlan === "scale") && (
            <Link
              href="/dashboard/listings"
              className="nk-ghost-btn text-[11px] font-semibold uppercase tracking-[0.16em]"
            >
              Voir les annonces
            </Link>
          )}
        </div>
      )}

      {checkoutStatus === "cancel" && (
        <div className="nk-card-accent nk-card-hover rounded-2xl border border-amber-200/85 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[0_10px_24px_rgba(180,83,9,0.1),0_1px_0_rgba(255,255,255,0.62)_inset]">
          {checkoutPlan === "audit_test"
            ? "Le paiement de l'audit test a ete annule. Vous pourrez reessayer a tout moment."
            : checkoutPlan === "scale"
            ? "L’achat du pack Scale a été annulé. Vous pouvez réessayer depuis cette page."
            : checkoutPlan === "pro"
            ? "L’achat du pack Pro a été annulé. Vous pouvez réessayer depuis cette page."
            : "Le paiement a été annulé. Vous pouvez réessayer depuis cette page."}
        </div>
      )}

      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:px-8 xl:px-10 xl:py-9 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="space-y-2.5">
          <p className="nk-kicker-muted">BILLING</p>
          <h1 className="nk-page-title nk-page-title-dashboard">
            Augmentez vos réservations avec une analyse intelligente
          </h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted max-w-2xl text-[15px] leading-7 text-slate-600">
            Choisissez le plan adapté à votre volume pour gagner en rentabilité: moins de rachats unitaires, meilleur coût par audit et continuité d’usage.
          </p>
          <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/10 bg-slate-900 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_8px_26px_rgba(15,23,42,0.22)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]" />
              <span className="font-semibold normal-case tracking-normal text-white/95">
                Crédits disponibles :{" "}
                <span className="tabular-nums text-white">
                  {loadingPlan ? "—" : availableAuditCredits}
                </span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              +20% de reservations en moyenne
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              Identifiez les actions qui génèrent du revenu
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Analyse basee sur vos donnees reelles
            </span>
          </div>
        </div>
      </div>

      {billingUiReady ? (
      <>
      <div className="mt-5 grid gap-6 md:grid-cols-3 md:gap-7 xl:gap-8">
        <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_18px_50px_rgba(15,23,42,0.15)]">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Starter
            </p>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {starterBadgeText}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {freePlan?.audience ?? "Idéal pour tester la valeur du rapport"}
          </p>
          <p className="mt-3 text-5xl font-semibold leading-none tracking-[-0.03em] text-slate-950 md:text-6xl">
            {auditTestTotalPrice} €
          </p>
          <p className="mt-1 text-[15px] font-medium text-slate-600">
            audit unique
          </p>
          <p className="mt-2 text-[15px] font-medium leading-6 text-slate-600">
            Soit {auditTestTotalPrice} € par audit — idéal pour un besoin ponctuel, mais vite
            coûteux si vous auditez régulièrement.
          </p>
          <ul className="mt-3 space-y-1.5 text-[15px] leading-7 text-slate-700">
            <li>• 1 audit sur l’annonce de votre choix</li>
            <li>• Lecture conversion immédiate</li>
            <li>• Recommandations prioritaires</li>
            <li>• Achat unitaire à {auditTestTotalPrice} € / audit</li>
          </ul>
          <div className="mt-5 flex-1" />
          <button
            type="button"
            onClick={() => void handleAuditTestCheckout()}
            disabled={checkoutLocked}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPlan
              ? "Verification..."
              : checkoutInFlight === "audit_test"
                ? CHECKOUT_LOADING_LABEL
                : "Payer 9 €"}
          </button>
          {freeNotice ? (
            <p className="mt-2 text-[11px] text-slate-700">{freeNotice}</p>
          ) : null}
          {auditTestStatusLabel ? (
            <p className="mt-2 text-[11px] text-emerald-700">{auditTestStatusLabel}</p>
          ) : null}
        </div>

        <div className={`relative z-10 flex h-full scale-[1.03] flex-col rounded-2xl border border-orange-300 bg-gradient-to-b from-orange-50/80 via-white to-white p-4 shadow-[0_20px_50px_rgba(249,115,22,0.25)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_20px_50px_rgba(249,115,22,0.25)] md:scale-[1.04] ${
          strategicRecommendedOfferCode === "pro"
            ? "ring-2 ring-emerald-300/80"
            : "ring-1 ring-orange-200/70"
        }`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
              Pro
            </p>
            <div className="flex items-center gap-1.5">
              {strategicRecommendedOfferCode === "pro" ? (
                <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  OFFRE RECOMMANDÉE
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-full border border-orange-300/40 bg-orange-500/10 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500">
                LE PLUS POPULAIRE
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {proPlan?.audience ?? "Le meilleur équilibre pour comparer plusieurs annonces"}
          </p>
          <p className="mt-3 text-5xl font-semibold leading-none tracking-[-0.03em] text-slate-950 md:text-6xl">
            {proPrice} €
          </p>
          <p className="mt-1 text-[15px] font-medium text-orange-700">
            Pack 5 audits (paiement unique)
          </p>
          <p className="mt-2 text-[15px] font-medium leading-6 text-slate-600">
            Pack ponctuel, sans abonnement. Soit ~{formatEuroPerAudit(proUnitEuro)} par audit, avec{" "}
            {proSavingsVsStarterPack} € économisés vs {proTotalAudits} achats unitaires.
          </p>
          <ul className="mt-3 space-y-1.5 text-[15px] leading-7 text-slate-700">
            <li>• 5 audits à utiliser après achat (pas de mensualité)</li>
            <li>• Comparaison entre plusieurs annonces</li>
            <li>• Priorisation claire des actions</li>
            <li>• Moins de rachats unitaires, plus de continuité</li>
          </ul>
          <div className="mt-5 flex-1" />
          <button
            type="button"
            onClick={() => void handleProCardCTA()}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={checkoutLocked}
          >
            {loadingPlan
              ? "Verification..."
              : checkoutInFlight === "pro"
                ? CHECKOUT_LOADING_LABEL
                : "Acheter le pack Pro (5 audits)"}
          </button>
          {proNotice ? (
            <p className="mt-2 text-[11px] text-red-600">{proNotice}</p>
          ) : null}
        </div>

        <div className={`flex h-full flex-col rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50/70 to-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_18px_50px_rgba(15,23,42,0.15)] ${
          strategicRecommendedOfferCode === "scale"
            ? "ring-2 ring-violet-300/75"
            : ""
        }`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Scale
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {scalePlan?.audience ?? "Pensé pour les portefeuilles plus larges"}
          </p>
          <p className="mt-3 text-5xl font-semibold leading-none tracking-[-0.03em] text-slate-950 md:text-6xl">
            {scalePrice} €
          </p>
          <p className="mt-1 text-[15px] font-medium text-sky-700">
            Pack 15 audits (paiement unique)
          </p>
          <p className="mt-2 text-[15px] font-medium leading-6 text-slate-600">
            Pack ponctuel, sans abonnement. Soit ~{formatEuroPerAudit(scaleUnitEuro)} par audit, avec{" "}
            {scaleSavingsVsStarterPack} € économisés vs {scaleTotalAudits} achats unitaires.
          </p>
          <ul className="mt-3 space-y-1.5 text-[15px] leading-7 text-slate-700">
            <li>• 15 audits à utiliser après achat (pas de mensualité)</li>
            <li>• Coût unitaire optimisé ({scaleUnitCostReductionVsPro}% de moins qu’en Pro)</li>
            <li>• Suivi multi-annonces simplifié</li>
            <li>• Adapté aux équipes et conciergeries</li>
          </ul>
          <div className="mt-5 flex-1" />
          <button
            type="button"
            onClick={() => void handleScaleCTA()}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={checkoutLocked}
          >
            {loadingPlan
              ? "Verification..."
              : checkoutInFlight === "scale"
                ? CHECKOUT_LOADING_LABEL
                : "Acheter le pack Scale (15 audits)"}
          </button>
          {scaleNotice ? (
            <p className="mt-2 text-[11px] text-slate-700">{scaleNotice}</p>
          ) : null}
        </div>
      </div>

      {!loadingPlan && upsellState.show ? (
        <div
          className={`rounded-2xl border px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${
            upsellState.tone === "empty"
              ? "border-orange-300 bg-orange-50"
              : upsellState.tone === "critical"
                ? "border-amber-300 bg-amber-50"
                : "border-slate-200 bg-white"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              upsellState.tone === "empty"
                ? "text-orange-800"
                : upsellState.tone === "critical"
                  ? "text-amber-800"
                  : "text-slate-800"
            }`}
          >
            {upsellState.message}
          </p>
          {upsellState.tone === "empty" ? (
            <div className="mt-3">
              {upsellState.action === "upgrade_pro" ? (
                <button
                  type="button"
                  onClick={() => void handleUpgradeToPro()}
                  disabled={checkoutLocked}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "pro"
                    ? CHECKOUT_LOADING_LABEL
                    : upsellState.ctaLabel}
                </button>
              ) : upsellState.action === "upgrade_scale" ? (
                <button
                  type="button"
                  onClick={() => void handleScaleCTA()}
                  disabled={checkoutLocked}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "scale"
                    ? CHECKOUT_LOADING_LABEL
                    : upsellState.ctaLabel}
                </button>
              ) : upsellState.action === "buy_top_up" ? (
                <button
                  type="button"
                  onClick={() => void handleAuditTestCheckout()}
                  disabled={checkoutLocked}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "audit_test"
                    ? CHECKOUT_LOADING_LABEL
                    : upsellState.ctaLabel}
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">
            Solde pour de nouveaux audits : {activePlanRemaining}/{activePlanTotal} (crédits restants sur
            le plafond de votre offre — pas le nombre de rapports déjà dans l’historique). Anticipez pour
            éviter tout arrêt d’audit.
          </p>
        </div>
      ) : null}

      {!loadingPlan && behaviorUpsell.show ? (
        <div
          className={`rounded-2xl border px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${
            behaviorUpsell.tone === "critical"
              ? "border-violet-300 bg-violet-50"
              : "border-blue-200 bg-blue-50"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              behaviorUpsell.tone === "critical" ? "text-violet-800" : "text-blue-800"
            }`}
          >
            {behaviorUpsell.message}
          </p>
          {behaviorUpsell.action ? (
            <div className="mt-3">
              {behaviorUpsell.action === "upgrade_pro" ? (
                <button
                  type="button"
                  onClick={() => void handleUpgradeToPro()}
                  disabled={checkoutLocked}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "pro"
                    ? CHECKOUT_LOADING_LABEL
                    : behaviorUpsell.ctaLabel}
                </button>
              ) : behaviorUpsell.action === "upgrade_scale" ? (
                <button
                  type="button"
                  onClick={() => void handleScaleCTA()}
                  disabled={checkoutLocked}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "scale"
                    ? CHECKOUT_LOADING_LABEL
                    : behaviorUpsell.ctaLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleAuditTestCheckout()}
                  disabled={checkoutLocked}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "audit_test"
                    ? CHECKOUT_LOADING_LABEL
                    : behaviorUpsell.ctaLabel}
                </button>
              )}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">
            Basé sur votre consommation récente (solde pour nouveaux audits : {activePlanRemaining}/
            {activePlanTotal}) pour préserver la continuité d’usage.
            {behaviorUpsell.action === "upgrade_scale"
              ? " Le bouton ci-dessus déclenche le même achat que sur la carte Scale (pack, paiement unique)."
              : null}
          </p>
        </div>
      ) : null}

      </>
      ) : (
        <div className="h-2" aria-hidden="true" />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  defaultBillingCycle,
  pricingPlans,
  type BillingCycle,
} from "@/lib/billing/pricingPlans";
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
import { getWorkspacePlan } from "@/lib/billing/getWorkspacePlan";
import {
  getBillingUpsellState,
  OFFER_CREDIT_TOTALS,
  type UpsellAction,
} from "@/lib/billing/productStrategy";

function formatSubscriptionStatus(status: string | null): string {
  if (!status) return "Inconnu";

  switch (status) {
    case "active":
      return "Actif";
    case "trialing":
      return "Essai";
    case "past_due":
      return "Paiement en retard";
    case "canceled":
      return "Annule";
    case "unpaid":
      return "Impayé";
    default:
      return status;
  }
}

function mapOfferToBillingSelection(
  offer: string | null
): "audit_test" | "pro" | "scale" | null {
  if (offer === "audit_test") return "audit_test";
  if (offer === "pack_5") return "pro";
  if (offer === "pack_15") return "scale";
  return null;
}

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(defaultBillingCycle);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [hasProStripeSubscription, setHasProStripeSubscription] = useState(false);
  const [nextBillingAt, setNextBillingAt] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<"success" | "cancel" | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<"audit_test" | "pro" | "scale" | null>(null);
  const [freeNotice, setFreeNotice] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [scaleNotice, setScaleNotice] = useState<string | null>(null);
  const [hasAuditTestPurchase, setHasAuditTestPurchase] = useState(false);
  const [auditTestPurchaseCount, setAuditTestPurchaseCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const [availableAuditCredits, setAvailableAuditCredits] = useState(0);
  const [grantedAuditCredits, setGrantedAuditCredits] = useState(0);
  const [consumedAuditCredits, setConsumedAuditCredits] = useState(0);

  const isPro = !loadingPlan && planCode === "pro";
  const freePlan = pricingPlans.find((plan) => plan.code === "free");
  const proPlan = pricingPlans.find((plan) => plan.code === "pro");
  const scalePlan = pricingPlans.find((plan) => plan.code === "scale");
  const proPrice =
    billingCycle === "yearly" ? proPlan?.yearly ?? 390 : proPlan?.monthly ?? 39;
  const scalePrice =
    billingCycle === "yearly" ? scalePlan?.yearly ?? 790 : scalePlan?.monthly ?? 79;
  const billingSuffix = billingCycle === "yearly" ? "/an" : "/mois";
  const starterUnitPrice = 9;
  const proUnitPrice = 7.8;
  const scaleUnitPrice = 5.27;
  const proSavingsVsStarterPack = 45 - 39;
  const scaleSavingsVsStarterPack = 135 - 79;
  const scaleUnitCostReductionVsPro = Math.round(
    ((proUnitPrice - scaleUnitPrice) / proUnitPrice) * 100
  );
  const requestedOffer = searchParams.get("offer");
  const selectedCard = mapOfferToBillingSelection(requestedOffer);
  const hasUsedFreeAudit = auditCount > 0 || hasAuditTestPurchase;
  const shouldShowPaidAuditTest = selectedCard === "audit_test" || hasUsedFreeAudit;
  const auditTestTotalPrice = 9;
  const auditTestStatusLabel = hasAuditTestPurchase
    ? auditCount > 0
      ? "Audit test achete et visible dans vos audits"
      : "Audit test achete"
    : null;
  const starterTotalAudits = OFFER_CREDIT_TOTALS.starter;
  const proTotalAudits = OFFER_CREDIT_TOTALS.pro;
  const scaleTotalAudits = OFFER_CREDIT_TOTALS.scale;
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
          "Vous rachetez souvent des audits unitaires. Pro vous aide à réduire le coût par audit et à garder un rythme d’optimisation continu.",
        action: "upgrade_pro",
        ctaLabel: "Activer Pro (5 audits)",
      }
    : hasFrequentProConsumption && activePlanRemaining <= 2
      ? {
          show: true,
          tone: "critical",
          message:
            "Votre cadence est élevée. Scale sécurise la continuité d’usage avec un coût par audit plus avantageux.",
          action: "upgrade_scale",
          ctaLabel: "Passer à Scale (15 audits)",
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
        ? "—/1"
        : `${starterRemainingAudits}/${starterTotalAudits}`
      : "1 audit";
  const proBadgeText =
    activePlanCode === "pro"
      ? loadingPlan
        ? "—/5"
        : `${proRemainingAudits}/${proTotalAudits}`
      : "5 audits";
  const scaleBadgeText =
    activePlanCode === "scale"
      ? loadingPlan
        ? "—/15"
        : `${scaleRemainingAudits}/${scaleTotalAudits}`
      : "15 audits";
  const proManageActionEnabled = isPro && hasProStripeSubscription;
  const billingUiReady = !loadingPlan;

  useEffect(() => {
    console.log("[billing][credits-debug]", {
      grantedAuditCredits,
      consumedAuditCredits,
      activePlanCode,
    });
  }, [grantedAuditCredits, consumedAuditCredits, activePlanCode]);

  useEffect(() => {
    let mounted = true;

    async function loadPlan() {
      try {
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

        const plan = await getWorkspacePlan(activeWorkspaceId, supabase);
        if (!mounted) return;

        setPlanCode(plan.planCode);
        setSubscriptionStatus(plan.status ?? null);

        try {
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("current_period_end, stripe_subscription_id")
            .eq("workspace_id", activeWorkspaceId)
            .maybeSingle();

          if (!mounted) return;

          const raw =
            subscription && "current_period_end" in subscription
              ? (subscription.current_period_end as string | null)
              : null;
          setNextBillingAt(raw ?? null);
          const hasStripeSubId =
            Boolean(
              subscription &&
                "stripe_subscription_id" in subscription &&
                subscription.stripe_subscription_id
            );
          setHasProStripeSubscription(hasStripeSubId);
        } catch {
          if (mounted) {
            setNextBillingAt(null);
            setHasProStripeSubscription(false);
          }
        }

        try {
          const [{ count: purchasedCount, error: usageError }, { count: createdAuditCount, error: auditsError }] =
            await Promise.all([
              supabase
                .from("usage_events")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", activeWorkspaceId)
                .eq("event_type", "audit_test_purchased"),
              supabase
                .from("audits")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", activeWorkspaceId),
            ]);

          if (!mounted) return;

          if (usageError) {
            console.warn("Failed to load audit_test purchase events", usageError);
          } else {
            setHasAuditTestPurchase((purchasedCount ?? 0) > 0);
            setAuditTestPurchaseCount(purchasedCount ?? 0);
          }

          if (auditsError) {
            console.warn("Failed to load audit count for billing", auditsError);
          } else {
            setAuditCount(createdAuditCount ?? 0);
          }
        } catch {
          if (mounted) {
            setHasAuditTestPurchase(false);
            setAuditTestPurchaseCount(0);
            setAuditCount(0);
          }
        }

        const credits = await getWorkspaceAuditCredits(activeWorkspaceId, supabase);

        if (!mounted) return;

        setAvailableAuditCredits(credits.available);
        setGrantedAuditCredits(credits.granted);
        setConsumedAuditCredits(credits.consumed);
        console.info("[billing][audit_credits] balance", {
          workspaceId: activeWorkspaceId,
          granted: credits.granted,
          consumed: credits.consumed,
          available: credits.available,
        });

        console.info("[billing][audit_test] workspace state loaded", {
          workspaceId: activeWorkspaceId,
        });
      } finally {
        if (mounted) {
          setLoadingPlan(false);
        }
      }
    }

    loadPlan();

    return () => {
      mounted = false;
    };
  }, []);

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

  useEffect(() => {
    if (loadingPlan) return;

    console.info("[billing][audit_test][decision]", {
      workspaceId: currentWorkspaceId,
      requestedOffer,
      selectedCard,
      planCode,
      auditCount,
      hasAuditTestPurchase,
      hasUsedFreeAudit,
      shouldShowPaidAuditTest,
      displayedPrice: shouldShowPaidAuditTest ? "9€" : "1 audit gratuit",
      displayedCta: shouldShowPaidAuditTest ? "Payer 9 €" : "Commencer gratuitement",
    });
  }, [
    loadingPlan,
    currentWorkspaceId,
    requestedOffer,
    selectedCard,
    planCode,
    auditCount,
    hasAuditTestPurchase,
    hasUsedFreeAudit,
    shouldShowPaidAuditTest,
  ]);

  async function handleCheckout(
    plan: "audit_test" | "pro" | "scale",
    options?: { quantity?: number }
  ) {
    if (loadingPlan) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
        client: supabase,
      });

      if (!workspace) return;

      const storedWorkspaceId = getStoredWorkspaceId();
      const activeWorkspaceId = storedWorkspaceId ?? workspace.id;
      setStoredWorkspaceId(activeWorkspaceId);
      console.info("[billing][audit_test] sending workspace_id", {
        plan,
        resolvedWorkspaceId: workspace.id,
        storedWorkspaceId,
        activeWorkspaceId,
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
          workspaceId: activeWorkspaceId,
          plan,
          interval: billingCycle === "yearly" ? "year" : "month",
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

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.warn("Failed to start Stripe checkout", {
          plan,
          status: response.status,
          error: data?.error ?? null,
        });
        return false;
      }

      const data = await response.json();

      if (data?.url) {
        window.location.href = data.url as string;
        return true;
      }
    } catch (error) {
      console.warn(`Stripe checkout error for ${plan}`, error);
    }

    return false;
  }

  async function handleUpgradeToPro() {
    await handleCheckout("pro");
  }

  async function handleAuditTestCheckout() {
    setFreeNotice(null);

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
          setFreeNotice("Cet audit test a deja ete achete pour cette annonce.");
          return;
        }
      }
    }

    const started = await handleCheckout("audit_test");

    if (!started) {
      setFreeNotice("Impossible d'ouvrir le paiement de l'audit test pour le moment.");
    }
  }

  function handleDiscoveryCTA() {
    setFreeNotice("L offre Starter s active lors de votre premier audit.");
  }

  async function handleOpenPortal() {
    if (!isPro || loadingPlan) return;

    setPortalError(null);
    setPortalLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPortalError("You must be signed in to manage your subscription.");
        setPortalLoading(false);
        return;
      }

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
        client: supabase,
      });

      if (!workspace) {
        setPortalError("Workspace not found. Please try again later.");
        setPortalLoading(false);
        return;
      }

      const storedWorkspaceId = getStoredWorkspaceId();
      const activeWorkspaceId =
        currentWorkspaceId ?? storedWorkspaceId ?? workspace.id;
      setStoredWorkspaceId(activeWorkspaceId);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ workspaceId: activeWorkspaceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPortalError(
          data?.error || "Unable to open billing portal. Please try again."
        );
        setPortalLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url as string;
      } else {
        setPortalError("Billing portal URL is missing. Please try again.");
        setPortalLoading(false);
      }
    } catch (error) {
      console.warn("Stripe portal error", error);
      setPortalError("Unable to open billing portal. Please try again.");
      setPortalLoading(false);
    }
  }

  async function handleScaleCTA() {
    setScaleNotice(null);
    const started = await handleCheckout("scale");

    if (!started) {
      setScaleNotice("Impossible d'ouvrir le checkout Scale pour le moment.");
    }
  }

  return (
    <div className="space-y-7 text-sm md:space-y-8">
      {checkoutStatus === "success" && (
        <div className="nk-card-accent nk-card-accent-emerald nk-card-hover flex flex-col items-start justify-between gap-2 rounded-2xl border border-emerald-200/85 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-[0_10px_24px_rgba(5,150,105,0.12),0_1px_0_rgba(255,255,255,0.62)_inset] sm:flex-row sm:items-center">
          <span>
            {checkoutPlan === "audit_test"
              ? "Paiement reussi. Votre audit test est maintenant debloque."
              : "Paiement réussi. Votre plan Pro est maintenant actif."}
          </span>
          {isPro && checkoutPlan !== "audit_test" && (
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
            : "Le paiement a été annulé. Vous pourrez passer au Pro à tout moment."}
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
      <div className="mt-5 grid gap-4 md:grid-cols-3 md:gap-5 xl:gap-6">
        <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
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
          <p className="mt-3 text-[42px] font-bold leading-none tracking-[-0.03em] text-slate-950 md:text-[48px]">
            {auditTestTotalPrice} €
          </p>
          <p className="mt-1 text-[12px] font-medium text-slate-600">
            audit unique
          </p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Coût / audit
            </span>
            <span className="text-[12px] font-bold text-slate-900">9 €/audit</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Idéal pour un besoin ponctuel, mais vite coûteux si vous auditez régulièrement.
          </p>
          <ul className="mt-4 space-y-1.5 text-[12px] leading-5 text-slate-700">
            <li>• 1 audit sur l’annonce de votre choix</li>
            <li>• Lecture conversion immédiate</li>
            <li>• Recommandations prioritaires</li>
            <li>• Achat unitaire à {starterUnitPrice} € / audit</li>
          </ul>
          <div className="mt-5 flex-1" />
          <button
            type="button"
            onClick={handleAuditTestCheckout}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 transition-all duration-200 hover:bg-slate-50"
          >
            {loadingPlan
              ? "Verification..."
              : "Payer 9 €"}
          </button>
          {freeNotice ? (
            <p className="mt-2 text-[11px] text-slate-700">{freeNotice}</p>
          ) : null}
          {auditTestStatusLabel ? (
            <p className="mt-2 text-[11px] text-emerald-700">{auditTestStatusLabel}</p>
          ) : null}
        </div>

        <div className={`relative z-10 flex h-full scale-[1.01] flex-col rounded-2xl border border-orange-300 bg-gradient-to-b from-orange-50/80 via-white to-white p-4 shadow-[0_20px_50px_rgba(249,115,22,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(249,115,22,0.25)] md:scale-[1.02] ${
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
              <span className="inline-flex items-center rounded-full border border-orange-300 bg-orange-100 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                LE PLUS POPULAIRE
              </span>
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-white/90 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                {proBadgeText}
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {proPlan?.audience ?? "Le meilleur équilibre pour comparer plusieurs annonces"}
          </p>
          <p className="mt-3 text-[42px] font-bold leading-none tracking-[-0.03em] text-slate-950 md:text-[48px]">
            {proPrice} €
          </p>
          <p className="mt-1 text-[12px] font-medium text-orange-700">
            5 audits inclus
          </p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-600">
              Coût / audit
            </span>
            <span className="text-[12px] font-bold text-orange-800">7,80 €/audit</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Soit ~7,80 € par audit, avec {proSavingsVsStarterPack} € économisés vs 5 achats unitaires.
          </p>
          <ul className="mt-4 space-y-1.5 text-[12px] leading-5 text-slate-700">
            <li>• 5 audits utilisables librement</li>
            <li>• Comparaison entre plusieurs annonces</li>
            <li>• Priorisation claire des actions</li>
            <li>• Moins de rachats unitaires, plus de continuité</li>
          </ul>
          <div className="mt-5 flex-1" />
          <button
            type="button"
            onClick={proManageActionEnabled ? handleOpenPortal : handleUpgradeToPro}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-orange-500 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_26px_rgba(249,115,22,0.24)] transition-all duration-200 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loadingPlan || (proManageActionEnabled ? portalLoading : false)}
          >
            {loadingPlan
              ? "Verification..."
              : proManageActionEnabled
                ? portalLoading
                  ? "Ouverture..."
                  : "Plan Pro actif"
                : "Choisir Pro et accélérer"}
          </button>
          {isPro && subscriptionStatus ? (
            <p className="mt-2 text-[11px] text-emerald-700">
              Statut : {formatSubscriptionStatus(subscriptionStatus)}
            </p>
          ) : null}
          {isPro && nextBillingAt ? (
            <p className="mt-1 text-[11px] text-emerald-700">
              Prochaine facturation : {new Date(nextBillingAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>

        <div className={`flex h-full flex-col rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50/70 to-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(56,189,248,0.14)] ${
          strategicRecommendedOfferCode === "scale"
            ? "ring-2 ring-violet-300/75"
            : ""
        }`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
              Scale
            </p>
            <div className="flex items-center gap-1.5">
              {strategicRecommendedOfferCode === "scale" ? (
                <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-100 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700">
                  OFFRE RECOMMANDÉE
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                COÛT/AUDIT LE PLUS BAS
              </span>
              <span className="inline-flex items-center rounded-full border border-sky-200 bg-white/90 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                {scaleBadgeText}
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {scalePlan?.audience ?? "Pensé pour les portefeuilles plus larges"}
          </p>
          <p className="mt-3 text-[42px] font-bold leading-none tracking-[-0.03em] text-slate-950 md:text-[48px]">
            {scalePrice} €
          </p>
          <p className="mt-1 text-[12px] font-medium text-sky-700">
            15 audits inclus
          </p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">
              Coût / audit
            </span>
            <span className="text-[12px] font-bold text-sky-800">5,27 €/audit</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Soit ~5,27 € par audit, avec {scaleSavingsVsStarterPack} € économisés vs 15 achats unitaires.
          </p>
          <ul className="mt-4 space-y-1.5 text-[12px] leading-5 text-slate-700">
            <li>• 15 audits à utiliser selon vos besoins</li>
            <li>• Coût unitaire optimisé ({scaleUnitCostReductionVsPro}% de moins qu’en Pro)</li>
            <li>• Suivi multi-annonces simplifié</li>
            <li>• Adapté aux équipes et conciergeries</li>
          </ul>
          <div className="mt-5 flex-1" />
          <button
            type="button"
            onClick={handleScaleCTA}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loadingPlan}
          >
            {loadingPlan ? "Verification..." : "Passer à Scale et sécuriser le volume"}
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
                  onClick={handleUpgradeToPro}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-orange-500 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_26px_rgba(249,115,22,0.24)] transition-all duration-200 hover:bg-orange-400"
                >
                  {upsellState.ctaLabel}
                </button>
              ) : upsellState.action === "upgrade_scale" ? (
                <button
                  type="button"
                  onClick={handleScaleCTA}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-orange-500 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_26px_rgba(249,115,22,0.24)] transition-all duration-200 hover:bg-orange-400"
                >
                  {upsellState.ctaLabel}
                </button>
              ) : upsellState.action === "buy_top_up" ? (
                <button
                  type="button"
                  onClick={handleAuditTestCheckout}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 transition-all duration-200 hover:bg-slate-50"
                >
                  {upsellState.ctaLabel}
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">
            Crédits: {activePlanRemaining}/{activePlanTotal} restants sur votre plan actuel. Anticipez maintenant pour éviter tout arrêt d’audit.
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
                  onClick={handleUpgradeToPro}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-orange-500 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_26px_rgba(249,115,22,0.24)] transition-all duration-200 hover:bg-orange-400"
                >
                  {behaviorUpsell.ctaLabel}
                </button>
              ) : behaviorUpsell.action === "upgrade_scale" ? (
                <button
                  type="button"
                  onClick={handleScaleCTA}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-orange-500 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_12px_26px_rgba(249,115,22,0.24)] transition-all duration-200 hover:bg-orange-400"
                >
                  {behaviorUpsell.ctaLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAuditTestCheckout}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 transition-all duration-200 hover:bg-slate-50"
                >
                  {behaviorUpsell.ctaLabel}
                </button>
              )}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">
            Basé sur votre consommation récente ({activePlanRemaining}/{activePlanTotal} crédits restants) pour préserver la continuité d’usage.
          </p>
        </div>
      ) : null}

      {portalError ? <p className="text-[11px] text-red-600">{portalError}</p> : null}
      </>
      ) : (
        <div className="h-2" aria-hidden="true" />
      )}
    </div>
  );
}

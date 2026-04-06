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
  const [nextBillingAt, setNextBillingAt] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<"success" | "cancel" | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<"audit_test" | "pro" | "scale" | null>(null);
  const [freeNotice, setFreeNotice] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [scaleNotice, setScaleNotice] = useState<string | null>(null);
  const [hasAuditTestPurchase, setHasAuditTestPurchase] = useState(false);
  const [auditCount, setAuditCount] = useState(0);
  const [availableAuditCredits, setAvailableAuditCredits] = useState(0);

  const isPro = !loadingPlan && planCode === "pro";
  const freePlan = pricingPlans.find((plan) => plan.code === "free");
  const proPlan = pricingPlans.find((plan) => plan.code === "pro");
  const scalePlan = pricingPlans.find((plan) => plan.code === "scale");
  const proPrice =
    billingCycle === "yearly" ? proPlan?.yearly ?? 390 : proPlan?.monthly ?? 39;
  const scalePrice =
    billingCycle === "yearly" ? scalePlan?.yearly ?? 790 : scalePlan?.monthly ?? 79;
  const billingSuffix = billingCycle === "yearly" ? "/an" : "/mois";
  const requestedOffer = searchParams.get("offer");
  const selectedCard = mapOfferToBillingSelection(requestedOffer);
  const hasUsedFreeAudit = auditCount > 0 || hasAuditTestPurchase;
  const shouldShowPaidAuditTest = selectedCard === "audit_test" || hasUsedFreeAudit;
  const auditTestStatusLabel = hasAuditTestPurchase
    ? auditCount > 0
      ? "Audit test achete et visible dans vos audits"
      : "Audit test achete"
    : null;

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
            .select("current_period_end")
            .eq("workspace_id", activeWorkspaceId)
            .maybeSingle();

          if (!mounted) return;

          const raw =
            subscription && "current_period_end" in subscription
              ? (subscription.current_period_end as string | null)
              : null;
          setNextBillingAt(raw ?? null);
        } catch {
          if (mounted) {
            setNextBillingAt(null);
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
          }

          if (auditsError) {
            console.warn("Failed to load audit count for billing", auditsError);
          } else {
            setAuditCount(createdAuditCount ?? 0);
          }
        } catch {
          if (mounted) {
            setHasAuditTestPurchase(false);
            setAuditCount(0);
          }
        }

        const credits = await getWorkspaceAuditCredits(activeWorkspaceId, supabase);

        if (!mounted) return;

        setAvailableAuditCredits(credits.available);
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

  async function handleCheckout(plan: "audit_test" | "pro" | "scale") {
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

    if (draft?.payment_status === "paid" || draft?.persisted_audit_id) {
      console.info("[billing][audit_test] blocked duplicate payment from local draft", {
        workspaceId: currentWorkspaceId,
        generatedAt: draft?.generated_at ?? null,
        persistedAuditId: draft?.persisted_audit_id ?? null,
      });
      setFreeNotice("Cet audit test est deja debloque pour cette annonce.");
      return;
    }

    if (draft?.generated_at && currentWorkspaceId) {
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
    setFreeNotice("L offre Decouverte s active lors de votre premier audit.");
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
        body: JSON.stringify({ workspaceId: workspace.id }),
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
    <div className="space-y-8">
      {checkoutStatus === "success" && (
        <div className="nk-card nk-card-hover flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
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
        <div className="nk-card nk-card-hover rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {checkoutPlan === "audit_test"
            ? "Le paiement de l'audit test a ete annule. Vous pourrez reessayer a tout moment."
            : "Le paiement a été annulé. Vous pourrez passer au Pro à tout moment."}
        </div>
      )}

      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:px-8 xl:px-10 xl:py-9 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="space-y-2">
          <p className="nk-kicker-muted">BILLING</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            Augmentez vos réservations avec une analyse intelligente
          </h1>
          <p className="nk-body-muted max-w-2xl text-[15px] leading-relaxed text-slate-700">
            Choisissez le plan adapte pour optimiser vos annonces et maximiser vos revenus.
          </p>
          <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              +20% de reservations en moyenne
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              Identifiez les actions qui generent du revenu
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Analyse basee sur vos donnees reelles
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-3 text-sm text-slate-700 nk-card-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_44px_rgba(15,23,42,0.12)]">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {freePlan?.name}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {freePlan?.audience}
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              {freePlan?.description}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {shouldShowPaidAuditTest ? "9€" : "1 audit gratuit"}
            </p>
            <p className="mt-1 text-[13px] font-medium text-slate-500">
              {shouldShowPaidAuditTest
                ? "Paiement unique pour debloquer l'audit test"
                : "Puis 9€ / audit"}
            </p>
            {auditTestStatusLabel ? (
              <p className="mt-2 text-[11px] font-medium text-emerald-700">
                {auditTestStatusLabel}
              </p>
            ) : null}
            {availableAuditCredits > 0 ? (
              <p className="mt-1 text-[11px] text-slate-600">
                Credits d&apos;audit disponibles : {availableAuditCredits}
              </p>
            ) : null}
          </div>
          <ul className="mt-2 flex-1 space-y-2 text-sm leading-6 text-slate-800">
            {freePlan?.features.map((feature) => (
              <li key={feature} className="ml-4 list-disc">
                {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={shouldShowPaidAuditTest ? handleAuditTestCheckout : handleDiscoveryCTA}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            {loadingPlan
              ? "Verification..."
              : hasAuditTestPurchase
                ? "Audit test achete"
                : shouldShowPaidAuditTest
                ? "Payer 9 €"
                : isPro
                  ? "Disponible"
                  : "Commencer gratuitement"}
          </button>
          {freeNotice && (
            <p className="mt-2 text-[11px] text-slate-700">{freeNotice}</p>
          )}
          {hasAuditTestPurchase ? (
            <p className="mt-2 text-[11px] text-slate-600">
              {auditCount > 0
                ? "Votre premier audit paye est maintenant disponible dans le dashboard."
                : "Votre achat one-shot a bien ete enregistre."}
            </p>
          ) : null}
        </div>

        <div
          className={`relative flex h-full flex-col justify-between rounded-2xl border border-emerald-300 bg-gradient-to-b from-emerald-50/70 via-white to-white px-3.5 py-3 text-sm text-slate-700 nk-card-highlight transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-[0_24px_60px_rgba(16,185,129,0.22)] ${
            selectedCard === "pro" ? "ring-2 ring-emerald-300/90" : "ring-1 ring-emerald-200"
          }`}
        >
          <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm">
            Le plus populaire
          </div>
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Pro
            </p>
            <p className="mt-2 text-sm font-semibold text-emerald-900">
              {proPlan?.audience}
            </p>
            <p className="mt-1 text-[13px] leading-6 text-emerald-800">
              {proPlan?.description}
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-800">
              {proPrice}€
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Sans engagement - annulable a tout moment
            </p>
            <p className="mt-1 text-[11px] text-emerald-900/70">
              Offre de lancement
            </p>
            <p className="text-[11px] text-emerald-900/60">(au lieu de 49€)</p>
          </div>
          <ul className="mt-2 flex-1 space-y-2 text-sm leading-6 text-emerald-900">
            {proPlan?.features.map((feature) => (
              <li key={feature} className="ml-4 list-disc">
                {feature}
              </li>
            ))}
            <li className="ml-4 list-disc">
              Ideal pour les conciergeries qui veulent analyser plusieurs annonces
            </li>
            <li className="ml-4 list-disc font-medium text-emerald-950">
              Rentabilise des plusieurs audits
            </li>
          </ul>
          {isPro ? (
            <>
              <div className="relative z-10 mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-[13px] font-semibold text-emerald-800">
                
                
                
                
                
                
                
                
                
                ✓ Plan Pro actif
              </div>
              <p className="mt-1 text-[11px] text-emerald-800">
                Toutes les fonctionnalites Pro sont deja activees.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={handleUpgradeToPro}
              className="relative z-10 mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loadingPlan}
            >
              {loadingPlan ? "Verification..." : "Passer en Pro et augmenter vos reservations"}
            </button>
          )}
          <p className="mt-2 text-[11px] text-emerald-800">
            {isPro
              ? "Vous etes actuellement sur le plan Pro."
              : "Passez en Pro pour debloquer les insights avances."}
          </p>
          {!isPro && (
            <p className="mt-1 text-[11px] text-emerald-700">Sans engagement • Annulation a tout moment</p>
          )}
          {!isPro && (
            <p className="mt-1 text-[11px] text-emerald-800/70">
              Tarif amene a evoluer avec les prochaines fonctionnalites
            </p>
          )}
          {isPro && subscriptionStatus && (
            <p className="mt-1 text-[11px] text-emerald-700">
              Statut : {formatSubscriptionStatus(subscriptionStatus)}
            </p>
          )}
          {isPro && nextBillingAt && (
            <p className="mt-1 text-[11px] text-emerald-700">
              Prochaine facturation : {new Date(nextBillingAt).toLocaleDateString()}
            </p>
          )}
          <p className="mt-1 text-[11px] text-emerald-700">
            Gerez ou resiliez a tout moment.
          </p>
          {portalError && (
            <p className="mt-2 text-[11px] text-red-600">{portalError}</p>
          )}
        </div>

        <div className="relative flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-3 text-sm text-slate-700 nk-card-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_44px_rgba(15,23,42,0.12)]">
          <div className="absolute right-4 top-4 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm">
            Premium
          </div>
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Scale
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {scalePlan?.audience}
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              {scalePlan?.description}
            </p>
            <p className="mt-2 text-[11px] font-medium text-slate-500">
              Ideal pour les conciergeries et portefeuilles multi-logements
            </p>
            {scalePlan?.note && (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {scalePlan.note}
              </p>
            )}
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {scalePrice}€
            </p>
          </div>
          <ul className="mt-2 flex-1 space-y-2 text-sm leading-6 text-slate-800">
            {scalePlan?.features.map((feature) => (
              <li key={feature} className="ml-4 list-disc">
                {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleScaleCTA}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-950 px-4 text-[13px] font-semibold text-slate-50 transition hover:bg-slate-900"
          >
            Passer a Scale
          </button>
          <p className="mt-2 text-[11px] text-slate-500">Sans engagement • Annulation a tout moment</p>
          {scaleNotice && (
            <p className="mt-2 text-[11px] text-slate-700">{scaleNotice}</p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
import { getWorkspacePlan } from "@/lib/billing/getWorkspacePlan";
import { supabase } from "@/lib/supabase";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import {
  emptyOwnerProfile,
  emptyPreferencesDraft,
  loadStoredOwnerProfile,
  loadStoredPreferences,
  type OwnerProfileDraft,
  type PreferencesDraft,
} from "@/lib/workspaces/workspaceSettings";

type DashboardListingRow = {
  id: string;
  workspace_id: string;
  created_at?: string;
  audits: {
    overall_score: number | null;
    created_at: string;
    result_payload: unknown;
  }[];
};

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
};

function getOverviewCopy(locale: "fr" | "en") {
  if (locale === "en") {
    return {
      kicker: "Overview",
      headingPrefix: "Overview of",
      fallbackWorkspaceName: "your workspace",
      headerDescription:
        "Track your listings, recent audits, and overall conversion performance from one shared workspace view.",
      identity: "Workspace identity",
      owner: "Owner profile",
      language: "Language",
      currency: "Currency",
      notProvided: "Not provided",
      freePlan: "Free plan",
      proPlan: "Pro plan",
      unlimitedAudits: "unlimited audits",
      auditsUsedSingular: "audit used",
      auditsUsedPlural: "audits used",
      trackedSingular: "tracked listing",
      trackedPlural: "tracked listings",
      availableAuditSingular: "available audit",
      availableAuditPlural: "available audits",
      launchAudit: "Launch a new audit",
      discoverPro: "Discover Pro",
      manageSubscription: "Manage subscription",
      proMessage: "Use Pro mode to audit your key listings with more depth.",
      freeMessage: "Upgrade to Pro to unlock Optimized Listing and deeper insights.",
      activity: "Recent activity",
      auditsThisWeek: "audits this week",
      scoreChange: "Average score change",
      listingsAdded: "new listings added",
      overallScore: "Overall score",
      trackedListings: "Tracked listings",
      auditedListings: "Audited listings",
      averageScore: "Average score",
      bestScore: "Best score",
      trackedListingsText: "Total listings tracked in this workspace.",
      auditedListingsText: "Listings with at least one audit available.",
      averageScoreText: "Average score across the latest audits.",
      bestScoreText: "Best current performance across your listings.",
      quickSummary: "Quick summary",
      currentSituation: "Current situation",
      ifFewAudits: "If you have few audits",
      ifFewAuditsText:
        "Start by adding 2 to 3 listings so you can compare outcomes and identify recurring weak points faster.",
      ifLowScore: "If your score is low",
      ifLowScoreText:
        "Prioritize photos, amenities, and the first lines of the description before anything else.",
      ifGoodScore: "If your score is already strong",
      ifGoodScoreText:
        "Focus on market positioning and the gap versus comparable nearby competitors.",
      recommendation: "Recommendation",
      nextAction: "Next action",
      nextActionText:
        "Add a new listing or relaunch an audit to measure how it positions against nearby competitors.",
      addListing: "Add a listing",
    };
  }

  return {
    kicker: "Vue d’ensemble",
    headingPrefix: "Aperçu de",
    fallbackWorkspaceName: "votre workspace",
    headerDescription:
      "Suivez vos annonces, vos audits récents et votre performance de conversion depuis une vue workspace partagée.",
    identity: "Identité du workspace",
    owner: "Profil propriétaire",
    language: "Langue",
    currency: "Devise",
    notProvided: "Non renseigné",
    freePlan: "Plan Gratuit",
    proPlan: "Plan Pro",
    unlimitedAudits: "audits illimités",
    auditsUsedSingular: "audit utilisé",
    auditsUsedPlural: "audits utilisés",
    trackedSingular: "annonce suivie",
    trackedPlural: "annonces suivies",
    availableAuditSingular: "audit disponible",
    availableAuditPlural: "audits disponibles",
    launchAudit: "Lancer un nouvel audit",
    discoverPro: "Découvrir le plan Pro",
    manageSubscription: "Gérer l’abonnement",
    proMessage: "Profitez du mode Pro pour auditer vos annonces clés avec plus de profondeur.",
    freeMessage: "Passez en Pro pour débloquer l’Optimized Listing et des insights avancés.",
    activity: "Activité récente",
    auditsThisWeek: "audits cette semaine",
    scoreChange: "Évolution du score moyen",
    listingsAdded: "nouvelles annonces ajoutées",
    overallScore: "Score global",
    trackedListings: "Annonces suivies",
    auditedListings: "Annonces auditées",
    averageScore: "Score moyen",
    bestScore: "Meilleur score",
    trackedListingsText: "Nombre total d’annonces suivies dans cet espace.",
    auditedListingsText: "Annonces ayant au moins un audit disponible.",
    averageScoreText: "Moyenne des scores sur les derniers audits.",
    bestScoreText: "Meilleure performance actuelle parmi vos annonces.",
    quickSummary: "Résumé rapide",
    currentSituation: "Situation actuelle",
    ifFewAudits: "Si vous avez peu d’audits",
    ifFewAuditsText:
      "Commencez par ajouter 2 à 3 annonces pour comparer les résultats et mieux identifier les points faibles récurrents.",
    ifLowScore: "Si votre score est bas",
    ifLowScoreText:
      "Priorisez les photos, les équipements et les premières lignes de description avant tout le reste.",
    ifGoodScore: "Si votre score est déjà bon",
    ifGoodScoreText:
      "Travaillez surtout le positionnement marché et l’écart avec les concurrents comparables à proximité.",
    recommendation: "Recommandation",
    nextAction: "Prochaine action",
    nextActionText:
      "Ajoutez une nouvelle annonce ou relancez un audit pour mesurer son positionnement face aux concurrents proches.",
    addListing: "Ajouter une annonce",
  };
}

export default function DashboardPage() {
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfileDraft>(emptyOwnerProfile);
  const [preferences, setPreferences] = useState<PreferencesDraft>(emptyPreferencesDraft);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [availableAuditCredits, setAvailableAuditCredits] = useState(0);
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [listings, setListings] = useState<DashboardListingRow[]>([]);
  const [referenceNow] = useState(() => Date.now());

  const isPro = planCode === "pro";

  useEffect(() => {
    async function loadOverview() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setWorkspace(null);
        setOwnerProfile(emptyOwnerProfile);
        setPreferences(emptyPreferencesDraft);
        setListings([]);
        setPlanCode("free");
        setQuotaUsed(null);
        setQuotaLimit(null);
        return;
      }

      const resolvedWorkspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
        client: supabase,
      });

      if (!resolvedWorkspace) {
        setWorkspace(null);
        setOwnerProfile(emptyOwnerProfile);
        setPreferences(emptyPreferencesDraft);
        setListings([]);
        setPlanCode("free");
        setQuotaUsed(null);
        setQuotaLimit(null);
        return;
      }

      setWorkspace({
        id: resolvedWorkspace.id,
        name: resolvedWorkspace.name,
        slug: resolvedWorkspace.slug,
        owner_user_id: resolvedWorkspace.owner_user_id,
      });

      setOwnerProfile(
        loadStoredOwnerProfile({
          accountId: user.id,
          workspaceId: resolvedWorkspace.id,
          displayName:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : typeof user.user_metadata?.display_name === "string"
              ? user.user_metadata.display_name
              : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : null,
          email: user.email ?? null,
          workspaceName: resolvedWorkspace.name,
          roleLabel:
            resolvedWorkspace.owner_user_id === user.id
              ? "Propriétaire du workspace"
              : "Membre du workspace",
        })
      );

      setPreferences(
        loadStoredPreferences({
          accountId: user.id,
          workspaceId: resolvedWorkspace.id,
        })
      );

      const { data, error } = await supabase
        .from("listings")
        .select(
          `id,
           workspace_id,
           created_at,
           audits (
             overall_score,
             created_at,
             result_payload
           )`
        )
        .eq("workspace_id", resolvedWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load listings for dashboard", error);
        setListings([]);
      } else if (Array.isArray(data)) {
        setListings(data as DashboardListingRow[]);
      }

      try {
        const plan = await getWorkspacePlan(resolvedWorkspace.id, supabase);
        setPlanCode(plan.planCode);

        const credits = await getWorkspaceAuditCredits(resolvedWorkspace.id, supabase);
        setAvailableAuditCredits(credits.available);
        console.info("[dashboard][workspace_plan] resolved", {
          workspaceId: resolvedWorkspace.id,
          planCode: plan.planCode,
          status: plan.status,
        });
        console.info("[dashboard][audit_credits] balance", {
          workspaceId: resolvedWorkspace.id,
          granted: credits.granted,
          consumed: credits.consumed,
          available: credits.available,
        });

        if (plan.planCode === "free") {
          const { count, error: countError } = await supabase
            .from("audits")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", resolvedWorkspace.id);

          if (countError) {
            console.warn("Failed to load audit count on dashboard", countError);
            setQuotaUsed(null);
            setQuotaLimit(1);
            return;
          }

          setQuotaUsed(count ?? 0);
          setQuotaLimit(1);
        } else {
          setQuotaUsed(null);
          setQuotaLimit(null);
        }
      } catch (planError) {
        console.warn("Failed to load workspace plan on dashboard", planError);
        setPlanCode(null);
        setQuotaUsed(null);
        setQuotaLimit(null);
      }
    }

    void loadOverview();
  }, []);

  const locale = preferences.language === "en" ? "en" : "fr";
  const copy = getOverviewCopy(locale);

  const totalAudits = listings.filter(
    (listing) => Array.isArray(listing.audits) && listing.audits.length > 0
  ).length;

  const averageScore = listings.length
    ? (
        listings.reduce((sum, listing) => {
          const latestAudit = Array.isArray(listing.audits)
            ? [...listing.audits].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0]
            : undefined;

          return sum + Number(latestAudit?.overall_score ?? 0);
        }, 0) / listings.length
      ).toFixed(1)
    : "–";

  const bestScore =
    listings.length > 0
      ? Math.max(
          ...listings.map((listing) => {
            const latestAudit = Array.isArray(listing.audits)
              ? [...listing.audits].sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )[0]
              : undefined;

            return Number(latestAudit?.overall_score ?? 0);
          })
        ).toFixed(1)
      : "–";

  const scoreValueClass =
    "text-4xl font-bold tracking-tight text-slate-900 md:text-[2.6rem]";
  const scoreSuffixClass = "ml-1 text-base font-medium text-slate-400 md:text-lg";
  const oneWeekAgo = referenceNow - 7 * 24 * 60 * 60 * 1000;

  const recentAudits = listings.flatMap((listing) =>
    Array.isArray(listing.audits)
      ? listing.audits.filter(
          (audit) => new Date(audit.created_at).getTime() >= oneWeekAgo
        )
      : []
  );

  const newListingsThisWeek = listings.filter((listing) =>
    listing.created_at ? new Date(listing.created_at).getTime() >= oneWeekAgo : false
  ).length;

  const scoreDelta = listings.reduce((sum, listing) => {
    if (!Array.isArray(listing.audits) || listing.audits.length < 2) {
      return sum;
    }

    const sorted = [...listing.audits].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return sum + (Number(sorted[0]?.overall_score ?? 0) - Number(sorted[1]?.overall_score ?? 0));
  }, 0);

  const formattedScoreDelta =
    scoreDelta === 0 ? "0.0" : `${scoreDelta > 0 ? "+" : ""}${scoreDelta.toFixed(1)}`;

  const workspaceDisplayName =
    ownerProfile.conciergeName || workspace?.name || copy.fallbackWorkspaceName;
  const workspaceBio = ownerProfile.bio || copy.headerDescription;
  const workspaceOwnerName =
    `${ownerProfile.firstName} ${ownerProfile.lastName}`.trim() || copy.notProvided;
  const workspaceLanguageLabel =
    preferences.language === "en"
      ? "English"
      : preferences.language === "fr"
      ? "Français"
      : copy.notProvided;
  const workspaceCurrencyLabel = preferences.currency || copy.notProvided;
  const workspaceInitials = (workspaceDisplayName || "WS")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const hasFreePlanWithQuota =
    planCode === "free" && quotaLimit !== null && quotaUsed !== null;

  let planBadgeText: string;

  if (hasFreePlanWithQuota) {
    planBadgeText = `${copy.freePlan} • ${quotaUsed}/${quotaLimit} ` +
      (quotaLimit! > 1 ? copy.auditsUsedPlural : copy.auditsUsedSingular);
  } else if (planCode && planCode !== "free") {
    const count = availableAuditCredits;

    if (typeof count === "number") {
      const suffix = count === 1 ? copy.availableAuditSingular : copy.availableAuditPlural;
      planBadgeText = `${copy.proPlan} • ${count} ${suffix}`;
    } else {
      planBadgeText = copy.proPlan;
    }
  } else {
    planBadgeText = copy.freePlan;
  }

  return (
    <div className="space-y-7 md:space-y-8 text-sm">
      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:flex md:items-center md:justify-between md:gap-10 md:px-8 xl:px-10 xl:py-9 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="max-w-3xl space-y-2.5">
          <p className="nk-kicker-muted">{copy.kicker}</p>
          <h1 className="nk-page-title nk-page-title-dashboard">
            {copy.headingPrefix} {workspaceDisplayName}
          </h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted text-[15px] leading-7 text-slate-600">
            {workspaceBio}
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">
              {ownerProfile.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ownerProfile.logoDataUrl}
                  alt={workspaceDisplayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                workspaceInitials
              )}
            </div>
            <div className="grid flex-1 gap-3 md:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.identity}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{workspaceDisplayName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.owner}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{workspaceOwnerName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.language}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{workspaceLanguageLabel}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.currency}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{workspaceCurrencyLabel}</p>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 font-medium text-slate-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {planBadgeText}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {listings.length}{" "}
              {listings.length === 1 ? copy.trackedSingular : copy.trackedPlural}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {totalAudits}{" "}
              {totalAudits === 1 ? copy.availableAuditSingular : copy.availableAuditPlural}
            </span>
            {availableAuditCredits > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 font-medium text-orange-800">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                {availableAuditCredits} credit{availableAuditCredits > 1 ? "s" : ""} d&apos;audit
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 text-left md:mt-0 md:text-right">
          {isPro ? (
            <>
              <Link
                href="/dashboard/listings/new"
                className="nk-primary-btn px-6 py-3 text-base font-semibold uppercase tracking-[0.18em] shadow-[0_18px_40px_rgba(15,23,42,0.24)] transition-all duration-200 hover:scale-[1.02] hover:brightness-105 hover:shadow-[0_22px_48px_rgba(15,23,42,0.28)]"
              >
                Lancer un nouvel audit
              </Link>
              <p className="mt-2 text-xs leading-5 text-slate-500">{copy.proMessage}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                <Link
                  href="/dashboard/billing"
                  className="font-semibold underline underline-offset-2"
                >
                  {copy.manageSubscription}
                </Link>
              </p>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/billing"
                className="nk-primary-btn px-6 py-3 text-base font-semibold uppercase tracking-[0.18em] shadow-[0_18px_40px_rgba(15,23,42,0.24)] transition-all duration-200 hover:scale-[1.02] hover:brightness-105 hover:shadow-[0_22px_48px_rgba(15,23,42,0.28)]"
              >
                {copy.discoverPro}
              </Link>
              <p className="mt-2 text-xs leading-5 text-slate-500">{copy.freeMessage}</p>
            </>
          )}

          <div className="nk-card-accent nk-card-accent-blue mt-4 rounded-2xl border border-slate-200/85 bg-white/95 px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.62)_inset]">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              {copy.activity}
            </p>
            <div className="mt-3 space-y-2 text-[13px] text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">+{recentAudits.length}</span>{" "}
                {copy.auditsThisWeek}
              </p>
              <p>
                {copy.scoreChange}{" "}
                <span className="font-semibold text-emerald-600">{formattedScoreDelta}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-900">{newListingsThisWeek}</span>{" "}
                {copy.listingsAdded}
              </p>
            </div>
          </div>

          <div className="nk-card-accent nk-card-accent-emerald mt-4 rounded-[22px] border border-emerald-200/85 bg-emerald-50/90 px-4 py-4 shadow-[0_10px_22px_rgba(5,150,105,0.12),0_1px_0_rgba(255,255,255,0.62)_inset]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {copy.overallScore}
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-3xl font-bold tracking-tight text-slate-900">
                {averageScore}
                {averageScore !== "–" && (
                  <span className="ml-1 text-sm font-medium text-slate-400">/10</span>
                )}
              </p>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-600 shadow-sm">
                {formattedScoreDelta}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid nk-grid-gap md:grid-cols-4">
        <div className="nk-card-accent nk-card-accent-blue nk-card-hover rounded-2xl border border-slate-200/85 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12),0_1px_0_rgba(255,255,255,0.68)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            {copy.trackedListings}
          </p>
          <p className={`${scoreValueClass} mt-3`}>{listings.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.trackedListingsText}</p>
        </div>

        <div className="nk-card-accent nk-card-accent-blue nk-card-hover rounded-2xl border border-slate-200/85 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12),0_1px_0_rgba(255,255,255,0.68)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            {copy.auditedListings}
          </p>
          <p className={`${scoreValueClass} mt-3`}>{totalAudits}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.auditedListingsText}</p>
        </div>

        <div className="nk-card-accent nk-card-hover rounded-2xl border border-amber-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,251,235,0.95)_100%)] p-5 shadow-[0_12px_30px_rgba(180,83,9,0.1),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-amber-300/90 hover:shadow-[0_18px_42px_rgba(180,83,9,0.15),0_1px_0_rgba(255,255,255,0.68)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            {copy.averageScore}
          </p>
          <p className={`${scoreValueClass} mt-3 text-amber-600`}>
            {averageScore}
            {averageScore !== "–" && <span className={scoreSuffixClass}>/10</span>}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.averageScoreText}</p>
        </div>

        <div className="nk-card-accent nk-card-accent-emerald nk-card-hover rounded-2xl border border-emerald-200/85 bg-emerald-50/90 p-5 shadow-[0_12px_30px_rgba(5,150,105,0.11),0_1px_0_rgba(255,255,255,0.64)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-300/90 hover:shadow-[0_18px_42px_rgba(5,150,105,0.16),0_1px_0_rgba(255,255,255,0.7)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {copy.bestScore}
          </p>
          <p className={`${scoreValueClass} mt-3 text-emerald-600`}>
            {bestScore}
            {bestScore !== "–" && <span className={scoreSuffixClass}>/10</span>}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.bestScoreText}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_380px]">
        <div className="nk-card-accent nk-card-accent-blue relative overflow-hidden rounded-[32px] nk-border nk-card-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-5 md:p-6 shadow-[0_16px_38px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.66)_inset]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">{copy.quickSummary}</p>
              <h2 className="mt-2 text-base font-semibold text-slate-900">
                {copy.currentSituation}
              </h2>
            </div>
          </div>

          <div className="mt-5 grid nk-grid-gap md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/85 bg-white/95 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_16px_34px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.68)_inset]">
              <p className="text-[11px] font-semibold text-slate-900">{copy.ifFewAudits}</p>
              <p className="mt-2 text-xs leading-6 text-slate-700">{copy.ifFewAuditsText}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/85 bg-white/95 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_16px_34px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.68)_inset]">
              <p className="text-[11px] font-semibold text-slate-900">{copy.ifLowScore}</p>
              <p className="mt-2 text-xs leading-6 text-slate-700">{copy.ifLowScoreText}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/85 bg-white/95 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_16px_34px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.68)_inset]">
              <p className="text-[11px] font-semibold text-slate-900">{copy.ifGoodScore}</p>
              <p className="mt-2 text-xs leading-6 text-slate-700">{copy.ifGoodScoreText}</p>
            </div>
          </div>
        </div>

        <div className="nk-card-accent nk-card-accent-purple relative overflow-hidden rounded-[32px] nk-border nk-card-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-5 md:p-6 shadow-[0_16px_38px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.66)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-700">{copy.recommendation}</p>
          <h2 className="mt-2 text-base font-semibold text-slate-900">{copy.nextAction}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">{copy.nextActionText}</p>

          <div className="mt-5">
            <Link
              href="/dashboard/listings/new"
              className="nk-primary-btn w-full justify-center text-xs font-semibold uppercase tracking-[0.18em] sm:w-auto"
            >
              Lancer un nouvel audit
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

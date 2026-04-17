"use client";

import Link from "next/link";
import { runAuditForListing } from "@/components/RunAuditForListingButton";
import { canCreateAudit } from "@/lib/billing/canCreateAudit";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
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
import { useEffect, useState } from "react";

type ListingPageRow = {
  id: string;
  workspace_id: string;
  source_url: string | null;
  source_platform: string | null;
  title: string | null;
  created_at: string;
  audits: {
    id: string;
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

function formatAuditDate(value?: string) {
  if (!value) return "–";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";

  return date.toISOString().slice(0, 16).replace("T", " ");
}

function lqiBadgeClass(label?: string) {
  switch (label) {
    case "needs_work":
      return "border-red-200 bg-red-50 text-red-700";
    case "improving":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "competitive":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "strong_performer":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "market_leader":
      return "border-emerald-300 bg-emerald-100 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getListingsCopy(locale: "fr" | "en") {
  if (locale === "en") {
    return {
      kicker: "Inventory",
      heading: "Tracked listings",
      subtitle: "Manage and monitor your listing performance in real time.",
      headerDescription:
        "Manage all audited listings from one place: platform, latest score, and direct access to the detailed report.",
      identity: "Workspace identity",
      owner: "Owner profile",
      language: "Language",
      currency: "Currency",
      notProvided: "Not provided",
      trackedSingular: "tracked listing",
      trackedPlural: "tracked listings",
      addListing: "Analyze a new listing",
      strategicListing:
        "Start with your most strategic listing to compare it against nearby competitors.",
      activeListings: "active listings",
      listingsWithAudit: "with audit",
      listingsWithoutAudit: "without audit",
      freePlan: "Free",
      proPlan: "Pro",
      proActive: "Pro plan active",
      auditsUsedSingular: "audit used",
      auditsUsedPlural: "audits used",
      unlimitedAudits: "Unlimited audits",
      auditTestActive: "Test audit active",
      pack5Active: "5-audit pack active",
      pack15Active: "15-audit pack active",
      singleAuditOneOff: "1 one-off audit",
      auditsAvailable: "audits available",
      auditsRemaining: "audits remaining",
      noAuditsAvailable: "No audits available",
      managePlan: "Manage plan",
      trackedList: "Tracked listings list",
      listing: "Listing",
      platform: "Platform",
      latestScore: "Latest score",
      qualityScore: "Quality score",
      latestAudit: "Latest audit",
      actions: "Actions",
      noListings: "No listings yet",
      noListingsText:
        "Add your first listing to analyze its conversion potential and get tailored recommendations.",
      addFirstListing: "Add a first listing",
      untitledListing: "Untitled listing",
      untitledListingSafe: "Untitled listing",
      viewPublicListing: "View public listing",
      urlUnavailable: "URL unavailable",
      unknownPlatform: "unknown",
      noAudit: "No audit",
      viewAudit: "View audit",
    };
  }

  return {
    kicker: "Inventaire",
    heading: "Annonces suivies",
    subtitle: "Gérez et suivez la performance de vos annonces en temps réel.",
    headerDescription:
      "Pilotez toutes les annonces auditées depuis un seul endroit: plateforme, dernier score et accès direct au rapport détaillé.",
    identity: "Identité du workspace",
    owner: "Profil propriétaire",
    language: "Langue",
    currency: "Devise",
    notProvided: "Non renseigné",
    trackedSingular: "annonce suivie",
    trackedPlural: "annonces suivies",
    addListing: "Analyser une nouvelle annonce",
    strategicListing:
      "Commencez par votre annonce la plus stratégique pour la comparer à ses concurrents proches.",
    activeListings: "annonces actives",
    listingsWithAudit: "avec audit",
    listingsWithoutAudit: "sans audit",
    freePlan: "Gratuit",
    proPlan: "Pro",
    proActive: "Plan Pro actif",
    auditsUsedSingular: "audit utilisé",
    auditsUsedPlural: "audits utilisés",
    unlimitedAudits: "Audits illimités",
    auditTestActive: "Audit test actif",
    pack5Active: "Pack 5 audits actif",
    pack15Active: "Pack 15 audits actif",
    singleAuditOneOff: "1 audit ponctuel",
    auditsAvailable: "audits disponibles",
    auditsRemaining: "audits restants",
    noAuditsAvailable: "Aucun audit disponible",
    managePlan: "Gérer le plan",
    trackedList: "Liste des annonces suivies",
    listing: "Annonce",
    platform: "Plateforme",
    latestScore: "Dernier score",
    qualityScore: "Score qualité",
    latestAudit: "Dernier audit",
    actions: "Actions",
    noListings: "Aucune annonce pour le moment",
    noListingsText:
      "Ajoutez votre première annonce pour analyser son potentiel de conversion et obtenir des recommandations adaptées.",
    addFirstListing: "Ajouter une première annonce",
    untitledListing: "Annonce sans titre",
    untitledListingSafe: "Annonce sans titre",
    viewPublicListing: "Voir l’annonce publique",
    urlUnavailable: "URL non disponible",
    unknownPlatform: "inconnue",
    noAudit: "Aucun audit",
    viewAudit: "Voir l’audit",
  };
}

function lqiLabelText(label: string | undefined, locale: "fr" | "en") {
  if (locale === "en") {
    switch (label) {
      case "needs_work":
        return "Needs work";
      case "improving":
        return "Improving";
      case "competitive":
        return "Competitive";
      case "strong_performer":
        return "Strong performer";
      case "market_leader":
        return "Market leader";
      default:
        return "No audit";
    }
  }

  switch (label) {
    case "needs_work":
      return "À améliorer";
    case "improving":
      return "En progression";
    case "competitive":
      return "Compétitif";
    case "strong_performer":
      return "Très performant";
    case "market_leader":
      return "Leader du marché";
    default:
      return "Aucun audit";
  }
}

export default function ListingsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfileDraft>(emptyOwnerProfile);
  const [preferences, setPreferences] = useState<PreferencesDraft>(emptyPreferencesDraft);
  const [listings, setListings] = useState<ListingPageRow[]>([]);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [creditsGranted, setCreditsGranted] = useState<number | null>(null);
  const [creditsAvailable, setCreditsAvailable] = useState<number | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [quotaOverlayOpen, setQuotaOverlayOpen] = useState(false);
  const [loadingAuditByListingId, setLoadingAuditByListingId] = useState<Record<string, boolean>>({});
  const [actionErrorByListingId, setActionErrorByListingId] = useState<Record<string, string>>({});

  const locale = preferences.language === "en" ? "en" : "fr";
  const copy = getListingsCopy(locale);

  const dedupedListings = (() => {
    const grouped = new Map<string, ListingPageRow>();

    for (const listing of listings) {
      const key = normalizeSourceUrl(listing.source_url) ?? `listing:${listing.id}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          ...listing,
          audits: Array.isArray(listing.audits) ? [...listing.audits] : [],
        });
        continue;
      }

      const mergedAudits = [...(existing.audits ?? []), ...(listing.audits ?? [])];
      const preferred =
        new Date(listing.created_at).getTime() > new Date(existing.created_at).getTime()
          ? listing
          : existing;

      grouped.set(key, {
        ...preferred,
        audits: mergedAudits,
      });
    }

    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  })();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setWorkspace(null);
        setOwnerProfile(emptyOwnerProfile);
        setPreferences(emptyPreferencesDraft);
        setListings([]);
        setPlanLabel(null);
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
        setPlanLabel(null);
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
        .select(`
          id,
          workspace_id,
          source_url,
          source_platform,
          title,
          created_at,
          audits (
            id,
            overall_score,
            created_at,
            result_payload
          )
        `)
        .eq("workspace_id", resolvedWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load listings:", error);
        setListings([]);
      } else {
        setListings((data ?? []) as ListingPageRow[]);
      }

      try {
        const quota = await canCreateAudit(resolvedWorkspace.id, supabase);
        setPlanLabel(quota.planCode === "free" ? copy.freePlan : copy.proPlan);

        if (quota.planCode === "free" && quota.limit !== null) {
          setQuotaUsed(quota.currentCount);
          setQuotaLimit(quota.limit);
        } else {
          setQuotaUsed(null);
          setQuotaLimit(null);
        }

        try {
          const credits = await getWorkspaceAuditCredits(resolvedWorkspace.id, supabase);
          setCreditsGranted(credits.granted);
          setCreditsAvailable(credits.available);
        } catch (creditsError) {
          console.warn("Failed to load workspace audit credits", creditsError);
          setCreditsGranted(null);
          setCreditsAvailable(null);
        }
      } catch (error) {
        console.warn("Failed to load audit quota info", error);
      }
    }

    void load();
  }, [copy.freePlan, copy.proPlan]);

  const workspaceDisplayName =
    ownerProfile.conciergeName || workspace?.name || copy.notProvided;
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
  const listingsWithAudit = dedupedListings.filter(
    (listing) => Array.isArray(listing.audits) && listing.audits.length > 0
  ).length;
  const listingsWithoutAudit = Math.max(dedupedListings.length - listingsWithAudit, 0);
  const totalPages = Math.max(1, Math.ceil(dedupedListings.length / itemsPerPage));
  const effectivePage = Math.min(currentPage, totalPages);
  const paginatedListings = dedupedListings.slice(
    (effectivePage - 1) * itemsPerPage,
    effectivePage * itemsPerPage
  );

  const hasFreePlanWithQuota =
    planLabel === copy.freePlan && quotaLimit !== null && quotaUsed !== null;
  const remainingFreeAudits = hasFreePlanWithQuota
    ? Math.max(quotaLimit! - quotaUsed!, 0)
    : null;

  let planTitle: string | null = null;
  let planDetail: string | null = null;

  if (hasFreePlanWithQuota) {
    // Cas "Audit test" gratuit, limite codee a 1 via canCreateAudit
    planTitle = copy.auditTestActive;

    if (remainingFreeAudits === 1) {
      planDetail = copy.singleAuditOneOff;
    } else if (remainingFreeAudits !== null) {
      if (remainingFreeAudits === 0) {
        planDetail = copy.noAuditsAvailable;
      } else {
        planDetail = `${remainingFreeAudits} ${copy.auditsRemaining}`;
      }
    }
  } else if (planLabel === copy.proPlan) {
    // Cas pack(s) payant(s) : on ne deduit pas la taille du pack,
    // on affiche uniquement les credits d'audit disponibles.
    const available = creditsAvailable;

    planTitle = copy.proPlan;

    if (typeof available === "number") {
      if (available === 0) {
        planDetail = copy.noAuditsAvailable;
      } else if (available === 1) {
        planDetail = copy.singleAuditOneOff;
      } else {
        planDetail = `${available} ${copy.auditsAvailable}`;
      }
    }
  }

  const isProStatusCard = planLabel === copy.proPlan;
  const proCreditsLine =
    typeof creditsAvailable === "number"
      ? `${creditsAvailable} audit disponible${creditsAvailable > 1 ? "s" : ""}`
      : copy.noAuditsAvailable;

  async function handleRunAuditFromRow(listingId: string) {
    if (loadingAuditByListingId[listingId]) return;

    setLoadingAuditByListingId((prev) => ({ ...prev, [listingId]: true }));
    setActionErrorByListingId((prev) => {
      const next = { ...prev };
      delete next[listingId];
      return next;
    });

    try {
      const result = await runAuditForListing(listingId);

      if (!result.success) {
        if (result.code === "quota_exceeded") {
          setQuotaOverlayOpen(true);
        } else {
          setActionErrorByListingId((prev) => ({
            ...prev,
            [listingId]: result.message,
          }));
        }
        return;
      }

      if (result.auditId) {
        window.location.href = `/dashboard/audits/${result.auditId}`;
      } else {
        window.location.reload();
      }
    } catch (error) {
      setActionErrorByListingId((prev) => ({
        ...prev,
        [listingId]:
          error instanceof Error ? error.message : "Une erreur inconnue est survenue",
      }));
    } finally {
      setLoadingAuditByListingId((prev) => ({ ...prev, [listingId]: false }));
    }
  }

  return (
    <div className="space-y-7 md:space-y-8 text-sm">
      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:flex md:items-center md:justify-between md:gap-10 md:px-8 xl:px-10 xl:py-9 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="max-w-3xl space-y-2.5">
          <p className="nk-kicker-muted">{copy.kicker}</p>
          <h1 className="nk-page-title nk-page-title-dashboard">
            {copy.heading}
          </h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard text-[13px] font-medium text-slate-700 md:text-sm">{copy.subtitle}</p>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted text-[15px] leading-7 text-slate-600">
            {copy.headerDescription}
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
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {dedupedListings.length}{" "}
              {dedupedListings.length === 1 ? copy.trackedSingular : copy.trackedPlural}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {dedupedListings.length} {copy.activeListings}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {listingsWithAudit} {copy.listingsWithAudit}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {listingsWithoutAudit} {copy.listingsWithoutAudit}
            </span>
          </div>
        </div>

        <div className="mt-5 text-left md:mt-0 md:text-right">
          <Link
            href="/dashboard/listings/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            {copy.addListing}
          </Link>
          <p className="mt-2 text-xs leading-5 text-slate-500">{copy.strategicListing}</p>
        </div>
      </div>

      {planTitle && (
        <div className="nk-card-accent nk-card-accent-blue flex flex-col items-start justify-between gap-3 rounded-2xl nk-border bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-3 text-xs text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_16px_34px_rgba(15,23,42,0.11),0_1px_0_rgba(255,255,255,0.68)_inset] sm:flex-row sm:items-center">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-900">
              {isProStatusCard ? "Plan Pro actif" : planTitle}
            </span>
            <span className="text-slate-600">
              {isProStatusCard ? proCreditsLine : planDetail}
            </span>
            {isProStatusCard ? (
              <span className="mt-1 text-slate-600">
                Rechargez vos crédits pour continuer vos analyses et lancer de
                nouveaux audits.
              </span>
            ) : null}
          </div>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center justify-center rounded-lg border border-emerald-300/75 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.14)] transition-all duration-200 hover:bg-emerald-100 hover:text-emerald-800"
          >
            {isProStatusCard ? "Voir les offres" : copy.managePlan}
          </Link>
        </div>
      )}

      <div className="nk-card nk-card-hover overflow-hidden rounded-[28px] nk-border bg-gradient-to-br from-slate-50 via-white to-slate-50/90 p-0 shadow-[0_14px_36px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.64)_inset]">
        <div className="border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur-sm">
          <p className="nk-section-title">{copy.trackedList}</p>
        </div>
        <div className="nk-table-shell overflow-x-auto bg-white/95">
          <table className="min-w-full text-left text-sm text-slate-900">
            <thead className="nk-table-header border-b border-slate-200/80 bg-slate-50/80 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.listing}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.platform}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.latestScore}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.qualityScore}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.latestAudit}</th>
                <th className="px-5 py-2.5 text-[10px] font-semibold text-slate-500">{copy.actions}</th>
              </tr>
            </thead>

            <tbody>
              {dedupedListings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10">
                    <div className="flex justify-center">
                      <div className="nk-empty-state nk-card nk-card-hover">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                          <span className="text-lg">＋</span>
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-slate-900">
                          {copy.noListings}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {copy.noListingsText}
                        </p>
                        <div className="mt-4 flex justify-center">
                          <Link href="/dashboard/listings/new" className="nk-primary-btn text-xs font-semibold">
                            {copy.addFirstListing}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedListings.map((listing) => {
                  const latestAudit = Array.isArray(listing.audits)
                    ? [...listing.audits].sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      )[0]
                    : undefined;

                  const auditResult =
                    latestAudit?.result_payload &&
                    typeof latestAudit.result_payload === "object"
                      ? (latestAudit.result_payload as {
                          listingQualityIndex?: { score?: number; label?: string };
                        })
                      : {};
                  const overallScore = Number(latestAudit?.overall_score ?? 0);

                  const lqi = auditResult?.listingQualityIndex;

                  const lqiScore =
                    typeof lqi?.score === "number" && Number.isFinite(lqi.score)
                      ? lqi.score
                      : null;

                  return (
                    <tr
                      key={listing.id}
                      className="border-t border-slate-100 nk-table-row-hover even:bg-slate-50/40"
                    >
                      <td className="px-5 py-2.5 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-900">
                            {listing.title?.trim() || copy.untitledListingSafe}
                          </span>
                          {listing.source_url ? (
                            <a
                              href={listing.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-orange-100 bg-orange-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-100 hover:text-orange-700"
                            >
                              <span>{copy.viewPublicListing}</span>
                              <span aria-hidden="true">↗</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">{copy.urlUnavailable}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-2.5 align-top">
                        <span className="nk-badge-neutral text-[11px] lowercase tracking-[0.08em]">
                          {listing.source_platform ?? copy.unknownPlatform}
                        </span>
                      </td>

                      <td className="px-5 py-2.5 align-top">
                        {latestAudit ? (
                          <span className="nk-badge-emerald text-[11px] font-semibold">
                            {overallScore.toFixed(1)}/10
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                            {copy.noAudit}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-2.5 align-top text-xs">
                        {latestAudit && lqiScore !== null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-900">
                              {Math.round(lqiScore)}/100
                            </span>
                            <span
                              className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${lqiBadgeClass(
                                lqi?.label
                              )}`}
                            >
                              {lqiLabelText(lqi?.label, locale)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                            <span>—</span>
                            <span>{copy.noAudit}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-2.5 align-top text-xs text-slate-500">
                        {latestAudit ? formatAuditDate(latestAudit.created_at) : "–"}
                      </td>

                      <td className="px-5 py-2.5 align-top text-right">
                        {latestAudit ? (
                          <Link
                            href={`/dashboard/audits/${latestAudit.id}`}
                            className="inline-flex items-center justify-center rounded-md border border-blue-300/70 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700 transition-all duration-200 hover:bg-blue-100 hover:text-blue-800"
                          >
                            {copy.viewAudit}
                          </Link>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              type="button"
                              onClick={() => void handleRunAuditFromRow(listing.id)}
                              disabled={Boolean(loadingAuditByListingId[listing.id])}
                              className="inline-flex items-center justify-center rounded-md border border-indigo-300/70 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-700 transition-all duration-200 hover:bg-indigo-100 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {loadingAuditByListingId[listing.id]
                                ? "Audit en cours..."
                                : "Lancer un audit"}
                            </button>
                            {actionErrorByListingId[listing.id] ? (
                              <span className="max-w-[220px] text-right text-[11px] text-red-600">
                                {actionErrorByListingId[listing.id]}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {dedupedListings.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-white/95 px-5 py-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700">Afficher :</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-400"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={effectivePage <= 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="font-medium text-slate-700">
                Page {effectivePage} sur {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={effectivePage >= totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {quotaOverlayOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 px-4 backdrop-blur-[2px]"
          onClick={() => setQuotaOverlayOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)] backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-slate-50/80 p-1.5 animate-pulse [animation-duration:4.5s]">
                <svg
                  viewBox="0 0 40 40"
                  className="h-9 w-9"
                  aria-hidden="true"
                  fill="none"
                >
                  <defs>
                    <linearGradient id="overlayNorixoN" x1="4" y1="6" x2="22" y2="30" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="55%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                  </defs>
                  <rect x="4" y="8" width="18" height="24" rx="5" fill="url(#overlayNorixoN)" />
                  <path d="M8.7 27V13l8.6 10.6V13" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="30.5" cy="11.2" r="3.2" fill="#cbd5e1" />
                  <path d="M29.6 15.4l-0.2 7.4M29.5 19.4l-6.1-3.1M29.5 19.7l4.1 3.5M29.4 22.8l-2.8 5.1" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="pt-1 text-base font-semibold text-slate-950">Crédits épuisés</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Vous n’avez plus de crédits disponibles pour lancer un nouvel audit.
              Choisissez une offre pour continuer vos analyses.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuotaOverlayOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Plus tard
              </button>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center justify-center rounded-md border border-blue-500/80 bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(59,130,246,0.28)] transition-all duration-200 hover:brightness-110"
              >
                Voir les offres
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

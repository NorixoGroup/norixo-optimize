"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuditInsightsPanel from "@/components/AuditInsightsPanel";
import { getWorkspacePlan } from "@/lib/billing/getWorkspacePlan";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
import { supabase } from "@/lib/supabase";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";
import { setStoredWorkspaceId } from "@/lib/workspaces/setStoredWorkspaceId";
import {
  emptyOwnerProfile,
  emptyPreferencesDraft,
  loadStoredOwnerProfile,
  loadStoredPreferences,
  type OwnerProfileDraft,
  type PreferencesDraft,
} from "@/lib/workspaces/workspaceSettings";

type AuditRow = {
  id: string;
  listing_id: string;
  overall_score: number | null;
  created_at: string;
  result_payload?: {
    summary?: string | null;
    insights?: string[];
    recommendations?: string[];
    marketComparison?: string | null;
    estimatedRevenue?: string | null;
    bookingPotential?: string | null;
    marketPositioning?: {
      status?: "ok" | "partial" | "insufficient_data" | "blocked";
      comparableCount?: number;
      summary?: string | null;
    } | null;
    occupancyObservation?: {
      rate?: number | null;
      unavailableDays?: number;
      availableDays?: number;
    } | null;
    strengths?: string[];
    weaknesses?: string[];
    content?: {
      strengths?: string[];
      weaknesses?: string[];
    };
    restored_after_payment?: boolean;
    source?: string | null;
    stripe_checkout_session_id?: string | null;
  } | null;
};

type ListingLookupRow = {
  id: string;
  title: string | null;
};

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
};

function formatAuditDate(value: string | undefined, locale: "fr" | "en") {
  if (!value) return "–";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";

  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getScoreStatus(score: number | null, locale: "fr" | "en") {
  if (score === null) {
    return {
      label: locale === "en" ? "Unavailable" : "Indisponible",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  if (score < 4) {
    return {
      label: locale === "en" ? "Low" : "Faible",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (score < 7) {
    return {
      label: locale === "en" ? "Medium" : "Moyen",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: locale === "en" ? "Good" : "Bon",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function getRevenueImpactCopy(score: number | null, currency: string, locale: "fr" | "en") {
  const normalizedCurrency =
    !currency || currency === "Non renseigné" || currency === "Not provided" ? "EUR" : currency;

  if (score === null) {
    return {
      value: locale === "en" ? "High potential" : "Potentiel de gain eleve",
      range:
        locale === "en"
          ? `Approx. +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}200 to +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}500 / month`
          : `≈ +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}200 a +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}500 / mois`,
      detail:
        locale === "en"
          ? "Estimated booking upside visible after the next optimization cycle."
          : "Le potentiel de reservation devient plus visible apres les prochaines optimisations.",
    };
  }

  if (score < 4) {
    return {
      value: locale === "en" ? "+12% estimated bookings" : "+12% de reservations estimees",
      range:
        locale === "en"
          ? `Approx. +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}200 to +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}500 / month`
          : `≈ +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}200 a +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}500 / mois`,
      detail:
        locale === "en"
          ? `Potential upside still substantial in ${normalizedCurrency}.`
          : `Potentiel de gain encore important en ${normalizedCurrency}.`,
    };
  }

  if (score < 7) {
    return {
      value: locale === "en" ? "Moderate upside" : "Potentiel modere",
      range:
        locale === "en"
          ? `Approx. +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}200 to +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}500 / month`
          : `≈ +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}200 a +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}500 / mois`,
      detail:
        locale === "en"
          ? "Several improvements can still unlock additional bookings."
          : "Plusieurs optimisations peuvent encore debloquer des reservations supplementaires.",
    };
  }

  return {
    value: locale === "en" ? "Low upside" : "Potentiel faible",
      range:
        locale === "en"
        ? `Approx. +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}200 to +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}500 / month`
        : `≈ +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}200 a +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}500 / mois`,
    detail:
      locale === "en"
        ? "Listing already performs well, focus on incremental gains."
        : "L annonce performe deja bien, priorisez les gains incrementaux.",
  };
}

function getPerformanceHeadline(score: number | null, locale: "fr" | "en") {
  if (score === null) {
    return locale === "en"
      ? "A useful first reading is already available."
      : "Une premiere lecture utile est deja disponible.";
  }

  if (score < 4) {
    return locale === "en"
      ? "This listing has strong upside if the basics are corrected."
      : "Cette annonce a un fort potentiel si les fondamentaux sont corriges.";
  }

  if (score < 7) {
    return locale === "en"
      ? "This listing is promising, but several visible signals still slow conversion."
      : "Cette annonce est prometteuse, mais plusieurs signaux visibles freinent encore la conversion.";
  }

  return locale === "en"
    ? "This listing is already solid, with a few optimizations left to capture."
    : "Cette annonce est deja solide, avec encore quelques optimisations a capter.";
}

function collectPayloadSnapshotStrings(
  payload: NonNullable<AuditRow["result_payload"]>,
  key: "strengths" | "weaknesses"
): string[] {
  const fromContent = payload.content?.[key];
  if (Array.isArray(fromContent)) {
    const out = fromContent
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((s) => s.trim());
    if (out.length > 0) return out;
  }
  const top = payload[key];
  if (Array.isArray(top)) {
    return top
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((s) => s.trim());
  }
  return [];
}

function buildStrengths(
  score: number | null,
  payload: AuditRow["result_payload"],
  locale: "fr" | "en"
) {
  if (payload) {
    const fromPayload = collectPayloadSnapshotStrings(payload, "strengths");
    if (fromPayload.length > 0) {
      return fromPayload.slice(0, 3);
    }
  }

  const strengths: string[] = [];

  if (score !== null && score >= 7) {
    strengths.push(
      locale === "en"
        ? "The overall presentation is already competitive."
        : "La presentation globale est deja competitive."
    );
  }

  if (payload?.marketPositioning?.status === "ok") {
    strengths.push(
      locale === "en"
        ? "A credible local benchmark is available for this listing."
        : "Un benchmark local credible est disponible pour cette annonce."
    );
  }

  if (payload?.occupancyObservation?.rate && payload.occupancyObservation.rate >= 0.6) {
    strengths.push(
      locale === "en"
        ? "Availability signals suggest healthy demand."
        : "Les signaux de disponibilite suggerent une demande saine."
    );
  }

  if (strengths.length === 0) {
    strengths.push(
      locale === "en"
        ? "No structured strengths block was returned in the latest audit payload."
        : "Aucune liste de points forts structuree n'a ete renvoyee dans le dernier rapport."
    );
  }

  return strengths.slice(0, 3);
}

function buildWeaknesses(
  score: number | null,
  recommendations: string[],
  payload: AuditRow["result_payload"],
  locale: "fr" | "en"
) {
  if (payload) {
    const fromPayload = collectPayloadSnapshotStrings(payload, "weaknesses");
    if (fromPayload.length > 0) {
      return fromPayload.slice(0, 3);
    }
  }

  const weaknesses: string[] = [];

  if (score !== null && score < 7) {
    weaknesses.push(
      locale === "en"
        ? "The listing still loses conversion on its most visible elements."
        : "L'annonce perd encore de la conversion sur ses elements les plus visibles."
    );
  }

  recommendations.slice(0, 2).forEach((item) => {
    weaknesses.push(item);
  });

  if (weaknesses.length === 0) {
    weaknesses.push(
      locale === "en"
        ? "No structured weaknesses block was returned in the latest audit payload."
        : "Aucune liste de points faibles structuree n'a ete renvoyee dans le dernier rapport."
    );
  }

  return weaknesses.slice(0, 3);
}

function buildQuickWins(recommendations: string[], locale: "fr" | "en") {
  if (recommendations.length > 0) {
    return recommendations.slice(0, 5);
  }

  return [
    locale === "en"
      ? "Clarify the main promise in the first lines of the listing."
      : "Clarifiez la promesse principale dans les premieres lignes de l'annonce.",
    locale === "en"
      ? "Refresh the lead photos to improve click-through rate."
      : "Rafraichissez les photos de tete pour ameliorer le taux de clic.",
    locale === "en"
      ? "Make the most differentiating amenities more visible."
      : "Rendez les equipements differenciants plus visibles.",
  ];
}

function getAuditsCopy(locale: "fr" | "en") {
  if (locale === "en") {
    return {
      kicker: "Performance",
      heading: "Performance audits",
      subtitle:
        "Analyze your listings and identify high-impact actions to increase bookings.",
      headerDescription:
        "Track the quality of your listings over time, compare results, and prioritize the next optimization moves.",
      identity: "Workspace identity",
      owner: "Owner profile",
      notProvided: "Not provided",
      auditsCount: "audits completed",
      averageScore: "Average score",
      lastAudit: "Last audit",
      improvementPotential: "Growth opportunity",
      improvementPotentialText:
        "Estimated gain possible by improving your listing.",
      estimatedImpact: "Estimated impact",
      freeLimitReached: "Free plan limit reached",
      freeLimitHelper: "Upgrade to Pro to unlock unlimited audits.",
      unlockPro: "Upgrade to Pro",
      proBadge: "Available on Pro",
      proActive: "Pro plan active",
      creditsActiveLabel: "Active credits",
      creditsAvailableSuffix: "audits available",
      creditsStatusSubtext: "Ready to use immediately to launch new audits",
      planVersusCreditsHint:
        "Billing tier for this workspace — not your remaining audit credits (see Billing).",
      creditsAvailableLabel: "Credits available",
      noCreditsAvailable: "No credits available",
      limitReachedCta: "Limit reached",
      aiInsights: "AI insights",
      summaryTitle: "Performance summary",
      summaryText:
        "Use audit history to identify which listings deserve immediate attention and where conversion gains are the easiest to unlock.",
      insightsTitle: "Insights & recommendations",
      insightsText:
        "Start with the actions most likely to improve visibility, conversion, and performance.",
      recommendedActions: "Recommended actions",
      insightOne: "Optimize the main photos",
      insightTwo: "Improve the listing title",
      insightThree: "Add more visible amenities",
      limitedRecommendations: "Explore deeper analysis",
      ctaLaunchAudit: "Launch an audit",
      ctaLaunchAuditLastCredit: "Launch an audit (last credit)",
      ctaLaunchAuditTwoLeft: "Launch an audit (2 left)",
      ctaBuyAudits: "Buy audits",
      ctaConsumesCredit: "Uses 1 credit",
      ctaBuyAuditsHelper: "Choose a pack or per-audit payment on the Billing page.",
      relaunchAuditLastCredit: "Relaunch audit (last credit)",
      relaunchAuditTwoLeft: "Relaunch audit (2 left)",
      ctaHelper: "Identify the actions that increase bookings.",
      reportsTitle: "Available reports",
      listing: "Listing",
      globalScore: "Global score",
      createdAt: "Created at",
      actions: "Actions",
      untitledListing: "Untitled listing",
      auditId: "Audit ID",
      noAudits: "No audits yet",
      noAuditsText:
        "Analyze your first listing to get a score, identify the highest-impact actions, and start building your optimization history.",
      firstAudit: "Analyze your first listing",
      viewReport: "View report",
      relaunchAudit: "Relaunch audit",
      delete: "Delete",
      noScore: "No score yet",
      unavailable: "Unavailable",
      activePlan: "High-impact tracking",
      activePlanText: "A clearer view of performance, conversion, and revenue potential.",
      deleteTitle: "Delete this audit?",
      deleteText: "This action is irreversible.",
      cancel: "Cancel",
      deleting: "Deleting...",
      deleted: "Audit deleted",
      deleteError: "Unable to delete this audit.",
      ownerBadge: "Owner",
      noLastAudit: "No recent audit",
      scoreStatus: "Status",
    };
  }

  return {
    kicker: "Performance",
    heading: "Audits de performance",
    subtitle:
      "Analysez vos annonces et identifiez les actions à fort impact pour augmenter vos réservations.",
    headerDescription:
      "Suivez la qualité de vos annonces dans le temps, comparez les résultats et priorisez les prochains leviers d’optimisation.",
    identity: "Identité du workspace",
    owner: "Profil propriétaire",
    notProvided: "Non renseigné",
    auditsCount: "audits réalisés",
    averageScore: "Score moyen",
    lastAudit: "Dernier audit",
    improvementPotential: "Opportunité de croissance",
    improvementPotentialText:
      "Estimation du gain possible en améliorant votre annonce.",
    estimatedImpact: "Impact estimé",
    freeLimitReached: "Vous avez atteint la limite du plan gratuit",
    freeLimitHelper:
      "Passez au plan Pro pour débloquer les audits illimités.",
    unlockPro: "Passer en Pro",
    proBadge: "Disponible en Pro",
    proActive: "Plan Pro actif",
    creditsActiveLabel: "Crédits actifs",
    creditsAvailableSuffix: "audits disponibles",
    creditsStatusSubtext: "Utilisables immédiatement pour lancer de nouveaux audits",
    planVersusCreditsHint:
      "Niveau d’offre facturation pour ce workspace — distinct du solde de crédits restants (voir Facturation).",
    creditsAvailableLabel: "Crédits disponibles",
    noCreditsAvailable: "Aucun crédit disponible",
    limitReachedCta: "Limite atteinte",
    aiInsights: "Insights IA",
    summaryTitle: "Synthèse de performance",
    summaryText:
      "Utilisez l’historique des audits pour repérer les annonces à traiter en priorité et les gains de conversion les plus accessibles.",
    insightsTitle: "Insights & recommandations",
    insightsText:
      "Commencez par les actions les plus susceptibles d’améliorer la visibilité, la conversion et la performance.",
    recommendedActions: "Actions recommandées",
    insightOne: "Optimiser les photos principales",
    insightTwo: "Améliorer le titre de l’annonce",
    insightThree: "Ajouter plus d’équipements visibles",
    limitedRecommendations: "Approfondissez l'analyse",
    ctaLaunchAudit: "Lancer un audit",
    ctaLaunchAuditLastCredit: "Lancer un audit (dernier crédit)",
    ctaLaunchAuditTwoLeft: "Lancer un audit (2 restants)",
    ctaBuyAudits: "Acheter des audits",
    ctaConsumesCredit: "Consomme 1 crédit",
    ctaBuyAuditsHelper: "Packs et paiement sur la page Facturation.",
    relaunchAuditLastCredit: "Relancer un audit (dernier crédit)",
    relaunchAuditTwoLeft: "Relancer un audit (2 restants)",
    ctaHelper: "Identifiez les actions qui augmentent vos réservations.",
    reportsTitle: "Rapports disponibles",
    listing: "Annonce",
    globalScore: "Score global",
    createdAt: "Créé le",
    actions: "Actions",
    untitledListing: "Annonce sans titre",
    auditId: "ID audit",
    noAudits: "Aucun audit pour le moment",
    noAuditsText:
      "Analysez votre première annonce pour obtenir un score, identifier les actions à fort impact et commencer votre historique d’optimisation.",
    firstAudit: "Analyser votre première annonce",
    viewReport: "Voir le rapport",
    relaunchAudit: "Relancer un audit",
    delete: "Supprimer",
    noScore: "Score indisponible",
    unavailable: "Indisponible",
    activePlan: "Suivi à fort impact",
    activePlanText: "Une lecture plus claire de la performance, de la conversion et du potentiel revenu.",
    deleteTitle: "Supprimer cet audit ?",
    deleteText: "Cette action est irréversible.",
    cancel: "Annuler",
    deleting: "Suppression...",
    deleted: "Audit supprimé",
    deleteError: "Impossible de supprimer cet audit.",
    ownerBadge: "Propriétaire",
    noLastAudit: "Aucun audit récent",
    scoreStatus: "Statut",
  };
}

export default function AuditsPage() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [listingTitles, setListingTitles] = useState<Record<string, string>>({});
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfileDraft>(emptyOwnerProfile);
  const [preferences, setPreferences] = useState<PreferencesDraft>(emptyPreferencesDraft);
  const [planCode, setPlanCode] = useState<string>("free");
  /** Solde crédits (même source que Facturation) ; null = pas encore chargé. */
  const [auditCreditsAvailable, setAuditCreditsAvailable] = useState<number | null>(null);
  const [auditToDelete, setAuditToDelete] = useState<AuditRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const locale = preferences.language === "en" ? "en" : "fr";
  const copy = getAuditsCopy(locale);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    async function load() {
      let user = null;

      try {
        const result = await supabase.auth.getUser();
        user = result?.data?.user ?? null;
      } catch (error) {
        console.warn("[audits] supabase auth getUser failed", error);
        user = null;
      }

      if (!user) {
        setAudits([]);
        setListingTitles({});
        setWorkspace(null);
        setWorkspaceId(null);
        setAuditCreditsAvailable(null);
        setOwnerProfile(emptyOwnerProfile);
        setPreferences(emptyPreferencesDraft);
        return;
      }

      const resolvedWorkspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
        client: supabase,
      });

      if (!resolvedWorkspace) {
        setAudits([]);
        setListingTitles({});
        setWorkspace(null);
        setWorkspaceId(null);
        setAuditCreditsAvailable(null);
        setOwnerProfile(emptyOwnerProfile);
        setPreferences(emptyPreferencesDraft);
        return;
      }

      const userMayUseWorkspace = async (workspaceId: string): Promise<boolean> => {
        const { data: member } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (member?.workspace_id) {
          return true;
        }

        const { data: owned } = await supabase
          .from("workspaces")
          .select("id")
          .eq("id", workspaceId)
          .eq("owner_user_id", user.id)
          .maybeSingle();

        return Boolean(owned?.id);
      };

      const storedWorkspaceId = getStoredWorkspaceId();
      let activeWorkspaceId = resolvedWorkspace.id;

      if (storedWorkspaceId) {
        const allowedStored = await userMayUseWorkspace(storedWorkspaceId);
        if (allowedStored) {
          activeWorkspaceId = storedWorkspaceId;
          setStoredWorkspaceId(storedWorkspaceId);
        } else {
          console.warn("[audits][active_workspace] stored_workspace_denied_fallback", {
            storedWorkspaceId,
            fallbackWorkspaceId: resolvedWorkspace.id,
            userId: user.id,
          });
          setStoredWorkspaceId(resolvedWorkspace.id);
        }
      } else {
        setStoredWorkspaceId(resolvedWorkspace.id);
      }

      let workspaceSummary: WorkspaceSummary = {
        id: resolvedWorkspace.id,
        name: resolvedWorkspace.name,
        slug: resolvedWorkspace.slug,
        owner_user_id: resolvedWorkspace.owner_user_id,
      };

      if (activeWorkspaceId !== resolvedWorkspace.id) {
        const { data: wsRow, error: wsRowError } = await supabase
          .from("workspaces")
          .select("id,name,slug,owner_user_id")
          .eq("id", activeWorkspaceId)
          .maybeSingle();

        if (!wsRowError && wsRow) {
          workspaceSummary = {
            id: wsRow.id,
            name: wsRow.name,
            slug: wsRow.slug,
            owner_user_id: wsRow.owner_user_id,
          };
        }
      }

      setWorkspaceId(activeWorkspaceId);
      setWorkspace(workspaceSummary);

      setOwnerProfile(
        loadStoredOwnerProfile({
          accountId: user.id,
          workspaceId: activeWorkspaceId,
          displayName:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : typeof user.user_metadata?.display_name === "string"
                ? user.user_metadata.display_name
                : typeof user.user_metadata?.name === "string"
                  ? user.user_metadata.name
                  : null,
          email: user.email ?? null,
          workspaceName: workspaceSummary.name,
          roleLabel:
            workspaceSummary.owner_user_id === user.id
              ? "Propriétaire du workspace"
              : "Membre du workspace",
        })
      );

      setPreferences(
        loadStoredPreferences({
          accountId: user.id,
          workspaceId: activeWorkspaceId,
        })
      );

      const plan = await getWorkspacePlan(activeWorkspaceId, supabase);
      setPlanCode(plan.planCode || "free");

      const creditBalances = await getWorkspaceAuditCredits(activeWorkspaceId, supabase);
      setAuditCreditsAvailable(creditBalances.available);

      const { data, error } = await supabase
        .from("audits")
        .select("id, listing_id, overall_score, created_at, result_payload")
        .eq("workspace_id", activeWorkspaceId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load audits:", error);
        setAudits([]);
        setListingTitles({});
        return;
      }

      const auditRows = (data ?? []) as AuditRow[];
      setAudits(auditRows);

      const uniqueListingIds = Array.from(new Set(auditRows.map((audit) => audit.listing_id)));

      if (uniqueListingIds.length === 0) {
        setListingTitles({});
        return;
      }

      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("id, title")
        .eq("workspace_id", activeWorkspaceId)
        .in("id", uniqueListingIds);

      if (listingsError) {
        console.error("Failed to load linked listings:", listingsError);
        setListingTitles({});
        return;
      }

      const titleMap = ((listingsData ?? []) as ListingLookupRow[]).reduce<Record<string, string>>(
        (accumulator, listing) => {
          if (listing.title?.trim()) {
            accumulator[listing.id] = listing.title.trim();
          }
          return accumulator;
        },
        {}
      );

      setListingTitles(titleMap);
    }

    void load();
  }, []);

  async function handleConfirmDelete() {
    if (!auditToDelete || !workspaceId || isDeleting) {
      return;
    }

    setIsDeleting(true);

    const { error } = await supabase
      .from("audits")
      .delete()
      .eq("id", auditToDelete.id)
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("Failed to delete audit:", error);
      setToast({ type: "error", message: copy.deleteError });
      setIsDeleting(false);
      return;
    }

    setAudits((current) => current.filter((audit) => audit.id !== auditToDelete.id));
    setAuditToDelete(null);
    setIsDeleting(false);
    setToast({ type: "success", message: copy.deleted });
  }

  const workspaceDisplayName =
    ownerProfile.conciergeName || workspace?.name || copy.notProvided;
  const workspaceOwnerName =
    `${ownerProfile.firstName} ${ownerProfile.lastName}`.trim() || copy.notProvided;
  const workspaceInitials = (workspaceDisplayName || "WS")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const averageScore = useMemo(() => {
    const scores = audits
      .map((audit) => audit.overall_score)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

    if (scores.length === 0) return null;

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }, [audits]);

  const latestAuditDate = audits[0]?.created_at ?? null;
  const revenueImpact = getRevenueImpactCopy(averageScore, "EUR", locale);
  const auditCount = audits.length;
  const FREE_LIMIT = 3;
  const plan = planCode || "free";
  const hasReachedLimit = plan === "free" && auditCount >= FREE_LIMIT;
  const isPro = plan === "pro";
  const creditsDepletedForCta = auditCreditsAvailable === 0;
  const headerPrimaryHref = creditsDepletedForCta ? "/dashboard/billing" : "/dashboard/listings/new";
  const headerPrimaryLabel = creditsDepletedForCta
    ? copy.ctaBuyAudits
    : auditCreditsAvailable === 1
      ? copy.ctaLaunchAuditLastCredit
      : auditCreditsAvailable === 2
        ? copy.ctaLaunchAuditTwoLeft
        : copy.ctaLaunchAudit;
  const emptyStatePrimaryHref = headerPrimaryHref;
  const emptyStatePrimaryLabel = creditsDepletedForCta ? copy.ctaBuyAudits : copy.firstAudit;
  const relaunchAuditHref = headerPrimaryHref;
  const relaunchAuditLabel = creditsDepletedForCta
    ? copy.ctaBuyAudits
    : auditCreditsAvailable === 1
      ? copy.relaunchAuditLastCredit
      : auditCreditsAvailable === 2
        ? copy.relaunchAuditTwoLeft
        : copy.relaunchAudit;
  const latestAudit = audits[0] ?? null;
  const latestAuditPayload =
    latestAudit?.result_payload && typeof latestAudit.result_payload === "object"
      ? latestAudit.result_payload
      : null;
  const auditPayloadRecommendations = Array.isArray(latestAuditPayload?.recommendations)
    ? latestAuditPayload.recommendations.filter((value) => typeof value === "string" && value.trim())
    : [];
  const auditPayloadInsights = Array.isArray(latestAuditPayload?.insights)
    ? latestAuditPayload.insights.filter((value) => typeof value === "string" && value.trim())
    : [];
  const hasPaidAuditSignal = audits.some((audit) => {
    const payload = audit.result_payload;
    return Boolean(
      payload?.restored_after_payment ||
        payload?.source === "stripe_webhook_audit_test" ||
        payload?.stripe_checkout_session_id
    );
  });
  const hasAuditInsightData =
    Boolean(latestAuditPayload?.summary?.trim()) ||
    auditPayloadInsights.length > 0 ||
    auditPayloadRecommendations.length > 0;
  const shouldLockInsights = !isPro && !hasPaidAuditSignal && !hasAuditInsightData;
  const insightLeadFromPayload = Boolean(
    latestAuditPayload?.summary?.trim() || auditPayloadInsights[0]
  );
  const insightUnavailableCopy =
    locale === "en"
      ? "No short summary is available yet for the latest audit. Open the full report for listing-specific findings."
      : "Aucune synthese courte n'est encore disponible pour le dernier audit. Ouvrez le rapport complet pour les constats detailles.";
  const displayedInsight = insightLeadFromPayload
    ? (latestAuditPayload?.summary?.trim() || auditPayloadInsights[0])!
    : insightUnavailableCopy;
  const firstPayloadRecommendation = auditPayloadRecommendations[0]?.trim() || null;
  const performanceHeadline = getPerformanceHeadline(latestAudit?.overall_score ?? null, locale);
  const strengths = buildStrengths(latestAudit?.overall_score ?? null, latestAuditPayload, locale);
  const weaknesses = buildWeaknesses(
    latestAudit?.overall_score ?? null,
    auditPayloadRecommendations,
    latestAuditPayload,
    locale
  );
  const quickWins = buildQuickWins(auditPayloadRecommendations, locale);
  const impactLine =
    latestAuditPayload?.estimatedRevenue?.trim() ||
    latestAuditPayload?.bookingPotential?.trim() ||
    revenueImpact.range;
  const marketTeaser =
    latestAuditPayload?.marketPositioning?.summary?.trim() ||
    latestAuditPayload?.marketComparison?.trim() ||
    null;
  const comparableCount = latestAuditPayload?.marketPositioning?.comparableCount ?? 0;
  const latestScore = latestAudit?.overall_score ?? null;
  const estimatedTopPercent =
    latestScore !== null ? Math.max(10, Math.min(90, Math.round((10 - latestScore) * 10))) : null;
  const quickWinCards = quickWins.slice(0, 3).map((item, index) => ({
    title: item,
    impact:
      latestScore !== null
        ? `+${Math.max(2, Math.round((10 - latestScore) + 2 + index))}%`
        : `+${4 + index}%`,
  }));
  const heroIntro =
    latestScore !== null && latestScore >= 7
      ? "Votre annonce est deja performante, mais vous laissez encore du potentiel inexploite."
      : "Votre annonce peut gagner en impact avec quelques optimisations bien ciblees.";
  const currentRevenueLabel =
    marketTeaser && comparableCount > 0
      ? "Base actuelle coherentement positionnee sur votre marche"
      : "Base actuelle a renforcer sur les signaux les plus visibles";
  const optimizedRevenueLabel =
    latestAuditPayload?.estimatedRevenue?.trim() ||
    revenueImpact.range;
  const impactBusinessLead =
    "Votre annonce fonctionne deja bien, mais elle peut generer davantage de revenus.";
  const heroTitle =
    latestScore !== null && latestScore >= 7
      ? "Votre annonce est déjà performante, avec un potentiel encore exploitable"
      : "Votre annonce peut encore mieux convertir avec quelques optimisations ciblées";
  const heroClosing =
    "Quelques optimisations simples peuvent améliorer vos résultats rapidement.";
  const insightsNarrative = marketTeaser
    ? `Les annonces similaires qui performent mieux mettent en avant des bénéfices plus lisibles, des équipements différenciants et une première impression plus forte. ${marketTeaser}`
    : "Les annonces similaires qui performent mieux utilisent des titres orientés bénéfices, valorisent les équipements clés et optimisent davantage la première photo.";

  useEffect(() => {
    if (audits.length === 0) return;

    console.info("[dashboard][audits][ai-insights]", {
      auditId: latestAudit?.id ?? null,
      plan,
      shouldLockInsights,
      hasPaidAuditSignal,
      hasAuditInsightData,
      hasSummary: Boolean(latestAuditPayload?.summary?.trim()),
      insightsCount: auditPayloadInsights.length,
      recommendationsCount: auditPayloadRecommendations.length,
      hasMarketTeaser: Boolean(marketTeaser),
      comparableCount,
      impactLine,
    });
  }, [
    audits,
    latestAudit?.id,
    plan,
    shouldLockInsights,
    hasPaidAuditSignal,
    hasAuditInsightData,
    latestAuditPayload?.summary,
    auditPayloadInsights.length,
    auditPayloadRecommendations.length,
    marketTeaser,
    comparableCount,
    impactLine,
  ]);

  return (
    <div className="space-y-7 md:space-y-8 text-sm">
      {toast && (
        <div className="fixed right-6 top-[96px] z-30">
          <div
            className={`rounded-2xl border px-4 py-3 text-xs font-medium shadow-[0_18px_45px_rgba(15,23,42,0.18)] ${
              toast.type === "success"
                ? "border-orange-200 bg-orange-50 text-orange-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

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
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
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
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{workspaceOwnerName}</p>
                  {workspace?.owner_user_id && (
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                      {copy.ownerBadge}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-start gap-x-2 gap-y-2 text-xs text-slate-600">
            <div className="flex min-w-0 max-w-full flex-col gap-2">
              <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.72)_inset]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {copy.creditsActiveLabel}
                </p>
                <p className="mt-2 text-2xl font-semibold leading-none tracking-tight text-slate-950 tabular-nums md:text-[1.75rem]">
                  {auditCreditsAvailable === null ? "—" : auditCreditsAvailable}{" "}
                  <span className="text-[15px] font-semibold leading-none text-slate-700 md:text-base">
                    {copy.creditsAvailableSuffix}
                  </span>
                </p>
                <p className="mt-2 text-[13px] leading-snug text-slate-600">
                  {copy.creditsStatusSubtext}
                </p>
                <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-500">
                  {auditCount} {copy.auditsCount}
                </p>
              </div>
              <p className="max-w-[min(100%,20rem)] text-[10px] font-medium leading-snug text-slate-500">
                {copy.planVersusCreditsHint}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {copy.lastAudit}:{" "}
              {latestAuditDate ? formatAuditDate(latestAuditDate, locale) : copy.noLastAudit}
            </span>
          </div>
        </div>

        <div className="mt-5 text-left md:mt-0 md:text-right">
          {!hasReachedLimit && (
            <>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <Link
                  href={headerPrimaryHref}
                  className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
                >
                  {headerPrimaryLabel}
                </Link>
              </div>
              {creditsDepletedForCta ? (
                <p className="mt-2 text-xs leading-5 text-slate-500">{copy.ctaBuyAuditsHelper}</p>
              ) : (
                <>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{copy.ctaHelper}</p>
                  {auditCreditsAvailable !== null && auditCreditsAvailable > 0 ? (
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{copy.ctaConsumesCredit}</p>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid nk-grid-gap xl:grid-cols-3">
        <div className="nk-card-accent nk-card-accent-blue nk-card-hover rounded-2xl border border-slate-200/85 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12),0_1px_0_rgba(255,255,255,0.68)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Score moyen du portefeuille
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {averageScore !== null ? (
              <>
                {averageScore.toFixed(1)}
                <span className="text-lg font-medium text-slate-400">/10</span>
              </>
            ) : (
              "—"
            )}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Une lecture globale pour suivre le niveau moyen de vos annonces actives.
          </p>
        </div>

        <div className="nk-card-accent nk-card-accent-emerald nk-card-hover rounded-2xl border border-emerald-200/85 bg-emerald-50/90 p-5 shadow-[0_12px_30px_rgba(5,150,105,0.11),0_1px_0_rgba(255,255,255,0.64)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-300/90 hover:shadow-[0_18px_42px_rgba(5,150,105,0.16),0_1px_0_rgba(255,255,255,0.7)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Potentiel de gain disponible
          </p>
          <p className="mt-3 text-xl font-semibold tracking-tight text-emerald-950">
            {revenueImpact.value}
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-900">{impactLine}</p>
        </div>

        <div className="nk-card-accent nk-card-hover rounded-2xl border border-slate-200/85 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12),0_1px_0_rgba(255,255,255,0.68)_inset]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Croissance encore accessible
          </p>
          <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
            {marketTeaser || "Des gains restent accessibles avec quelques optimisations bien ciblees."}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Priorisez les recommandations qui renforcent la premiere impression et la clarte de la valeur.
          </p>
        </div>
      </div>

      <div className="nk-card-accent nk-card-accent-purple relative overflow-hidden rounded-[32px] nk-border nk-card-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-5 md:p-6 shadow-[0_16px_38px_rgba(15,23,42,0.1),0_1px_0_rgba(255,255,255,0.66)_inset]">
        <AuditInsightsPanel
          locale={locale}
          title={copy.insightsTitle}
          badgeLabel={isPro ? copy.proActive : "Analyse disponible"}
          badgeTone={isPro ? "pro" : "available"}
          intro="Une lecture orientée business pour comprendre vite où agir, ce que vous pouvez gagner et quelles optimisations lancer en priorité."
          heroTitle={heroTitle}
          performanceHeadline={performanceHeadline}
          heroIntro={heroIntro}
          latestScore={latestScore}
          estimatedTopPercent={estimatedTopPercent}
          impactLine={impactLine}
          displayedInsight={displayedInsight}
          insightLeadFromPayload={insightLeadFromPayload}
          payloadFirstRecommendation={firstPayloadRecommendation}
          heroClosing={heroClosing}
          impactBusinessLead={impactBusinessLead}
          recommendations={quickWins}
          quickWinCards={quickWinCards}
          strengths={strengths}
          weaknesses={weaknesses}
          currentRevenueLabel={currentRevenueLabel}
          optimizedRevenueLabel={optimizedRevenueLabel}
          revenueImpactValue={revenueImpact.value}
          insightsNarrative={insightsNarrative}
          isPro={isPro}
          limitedRecommendations={copy.limitedRecommendations}
          marketTeaser={marketTeaser}
          upgradeHref="/dashboard/billing"
        />
      </div>

      <div className="nk-card nk-card-hover overflow-hidden rounded-[28px] nk-border bg-gradient-to-br from-slate-50 via-white to-slate-50/90 p-0 shadow-[0_14px_36px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.64)_inset]">
        <div className="border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur-sm">
          <p className="nk-section-title">{copy.reportsTitle}</p>
        </div>

        <div className="nk-table-shell overflow-x-auto bg-white/95">
          <table className="min-w-full text-left text-sm text-slate-900">
            <thead className="nk-table-header border-b border-slate-200/80 bg-slate-50/80 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold text-slate-500">{copy.listing}</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-slate-500">{copy.globalScore}</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-slate-500">{copy.createdAt}</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-slate-500">{copy.actions}</th>
              </tr>
            </thead>

            <tbody>
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10">
                    <div className="flex justify-center">
                      <div className="nk-empty-state nk-card nk-card-hover">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                          <span className="text-lg">＋</span>
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-slate-900">
                          {copy.noAudits}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {copy.noAuditsText}
                        </p>
                        <div className="mt-4 flex justify-center">
                          <Link
                            href={emptyStatePrimaryHref}
                            className="nk-primary-btn text-xs font-semibold"
                          >
                            {emptyStatePrimaryLabel}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                audits.map((audit) => {
                  const overallScore =
                    typeof audit.overall_score === "number" && Number.isFinite(audit.overall_score)
                      ? audit.overall_score
                      : null;
                  const listingTitle = listingTitles[audit.listing_id] || copy.untitledListing;
                  const scoreStatus = getScoreStatus(overallScore, locale);

                  return (
                    <tr
                      key={audit.id}
                      className="border-t border-slate-100 nk-table-row-hover even:bg-slate-50/40"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-900">{listingTitle}</span>
                          <span className="text-xs text-slate-500">
                            {copy.auditId} : {audit.id.slice(0, 12)}…
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          {overallScore !== null ? (
                            <span className="text-base font-semibold text-slate-900">
                              {overallScore.toFixed(1)}
                              <span className="text-xs font-medium text-slate-400">/10</span>
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-500">{copy.noScore}</span>
                          )}
                          <span
                            className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${scoreStatus.className}`}
                          >
                            {copy.scoreStatus} · {scoreStatus.label}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top text-xs text-slate-500">
                        {formatAuditDate(audit.created_at, locale)}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-nowrap items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/audits/${audit.id}`}
                            className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200/90 bg-white px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-800 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset] transition hover:border-slate-300 hover:bg-slate-50/90 sm:px-3 sm:text-[11px] sm:tracking-[0.14em]"
                          >
                            {copy.viewReport}
                          </Link>
                          <Link
                            href={relaunchAuditHref}
                            className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200/60 bg-slate-50/80 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:border-slate-300/80 hover:bg-slate-100/80 sm:px-3 sm:text-[11px] sm:tracking-[0.14em]"
                          >
                            {relaunchAuditLabel}
                          </Link>
                          <button
                            type="button"
                            onClick={() => setAuditToDelete(audit)}
                            className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-red-200/50 bg-transparent px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-600 transition hover:border-red-300/70 hover:bg-red-50/40 hover:text-red-700 sm:px-3 sm:text-[11px] sm:tracking-[0.14em]"
                          >
                            {copy.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {auditToDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.26)]">
            <h2 className="text-lg font-semibold text-slate-900">{copy.deleteTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{copy.deleteText}</p>

            <div className="mt-6 flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => setAuditToDelete(null)}
                disabled={isDeleting}
                className="nk-ghost-btn px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? copy.deleting : copy.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

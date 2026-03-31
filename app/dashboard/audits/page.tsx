"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AuditInsightsPanel from "@/components/AuditInsightsPanel";
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

const OFFER_CARDS = [
  {
    code: "audit_test",
    name: "Audit test",
    price: "9 €",
    badge: "Entrer simplement",
    description: "Parfait pour tester la valeur de l'outil sur une annonce, sans engagement.",
    detail: "1 audit ponctuel",
    note: "9 € / audit • Sans abonnement • Pour tester d'abord",
    cta: "Tester avec 1 audit",
  },
  {
    code: "pack_5",
    name: "Pack 5 audits",
    price: "39 €",
    badge: "Recommande",
    description: "Le meilleur equilibre pour comparer plusieurs annonces et optimiser efficacement.",
    detail: "5 audits, soit 7,80 € / audit",
    note: "Recommande pour les hotes actifs • Progression rapide sans surdimensionner",
    highlighted: true,
    cta: "Choisir le pack 5",
  },
  {
    code: "pack_15",
    name: "Pack 15 audits",
    price: "99 €",
    badge: "Meilleure rentabilite",
    description: "Pense pour les conciergeries, les portefeuilles multi-logements et les usages reguliers.",
    detail: "15 audits, soit 6,60 € / audit",
    note: "Ideal pour les usages reguliers • Annuel : -10 %",
    cta: "Voir l'offre 15 audits",
  },
] as const;

function OfferSummaryRow({
  name,
  price,
  badge,
  description,
  detail,
  note,
  cta,
  highlighted,
  onSelect,
}: ((typeof OFFER_CARDS)[number] & {
  highlighted?: boolean;
  onSelect: () => void;
})) {
  return (
    <div
      className={`rounded-[22px] border px-4 py-4 transition duration-150 ${
        highlighted
          ? "border-orange-300 bg-[linear-gradient(180deg,rgba(255,247,237,1)_0%,rgba(255,255,255,0.96)_100%)] shadow-[0_16px_36px_rgba(249,115,22,0.14)]"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{name}</p>
          <p className="mt-1 text-[12px] leading-5 text-slate-600">{detail}</p>
          <p className="mt-2 text-[12px] leading-5 text-slate-600">{description}</p>
          {highlighted ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
              Choisi par la majorite des utilisateurs pour progresser rapidement
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold tracking-tight text-slate-950">{price}</p>
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              highlighted ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {badge}
          </span>
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-slate-700">{note}</p>
      <button
        type="button"
        onClick={onSelect}
        className={`mt-3 inline-flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition duration-150 ${
          highlighted
            ? "bg-[linear-gradient(135deg,#f97316,#fb923c)] text-white shadow-[0_14px_28px_rgba(249,115,22,0.22)] hover:brightness-[0.98]"
            : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

function formatAuditDate(value?: string) {
  if (!value) return "–";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";

  return date.toISOString().slice(0, 16).replace("T", " ");
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

function getSimulatedInsight(score: number | null, locale: "fr" | "en") {
  if (score === null) {
    return locale === "en"
      ? "Your listing has room for optimization on its key conversion elements."
      : "Votre annonce peut encore être optimisée sur ses éléments clés de conversion.";
  }

  if (score < 5) {
    return locale === "en"
      ? "Your listing lacks optimization on the key elements that influence conversion."
      : "Votre annonce manque d’optimisation sur les éléments clés.";
  }

  if (score <= 7) {
    return locale === "en"
      ? "Your listing is solid but still offers opportunities to improve conversion rate and bookings."
      : "Votre annonce est correcte mais presente des opportunites d amelioration pour augmenter votre taux de conversion et vos reservations.";
  }

  return locale === "en"
    ? "Your listing is well optimized. Keep maintaining this level of quality."
    : "Votre annonce est bien optimisée, continuez à maintenir ce niveau.";
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

function buildStrengths(
  score: number | null,
  payload: AuditRow["result_payload"],
  locale: "fr" | "en"
) {
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
        ? "The audit already highlights a clear optimization path."
        : "L'audit met deja en evidence une trajectoire d'optimisation claire."
    );
  }

  return strengths.slice(0, 3);
}

function buildWeaknesses(
  score: number | null,
  recommendations: string[],
  locale: "fr" | "en"
) {
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
        ? "No major blocker detected yet, but the audit can still be refined."
        : "Aucun blocage majeur detecte pour l'instant, mais l'audit peut encore etre affine."
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
      language: "Language",
      currency: "Currency",
      notProvided: "Not provided",
      auditsCount: "audits generated",
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
      freeBadge: "Current plan: 3 audits included",
      proActive: "Pro plan active",
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
      cta: "Launch a new audit",
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
    language: "Langue",
    currency: "Devise",
    notProvided: "Non renseigné",
    auditsCount: "audits générés",
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
    freeBadge: "Plan actuel : 3 audits inclus",
    proActive: "Plan Pro actif",
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
    cta: "Lancer un nouvel audit",
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
  const router = useRouter();
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [listingTitles, setListingTitles] = useState<Record<string, string>>({});
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfileDraft>(emptyOwnerProfile);
  const [preferences, setPreferences] = useState<PreferencesDraft>(emptyPreferencesDraft);
  const [planCode, setPlanCode] = useState<string>("free");
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAudits([]);
        setListingTitles({});
        setWorkspace(null);
        setWorkspaceId(null);
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
        setOwnerProfile(emptyOwnerProfile);
        setPreferences(emptyPreferencesDraft);
        return;
      }

      setWorkspaceId(resolvedWorkspace.id);
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

      const plan = await getWorkspacePlan(resolvedWorkspace.id, supabase);
      setPlanCode(plan.planCode || "free");

      const { data, error } = await supabase
        .from("audits")
        .select("id, listing_id, overall_score, created_at, result_payload")
        .eq("workspace_id", resolvedWorkspace.id)
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
        .eq("workspace_id", resolvedWorkspace.id)
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

  const averageScore = useMemo(() => {
    const scores = audits
      .map((audit) => audit.overall_score)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

    if (scores.length === 0) return null;

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }, [audits]);

  const latestAuditDate = audits[0]?.created_at ?? null;
  const revenueImpact = getRevenueImpactCopy(averageScore, workspaceCurrencyLabel, locale);
  const simulatedInsight = getSimulatedInsight(averageScore, locale);
  const auditCount = audits.length;
  const FREE_LIMIT = 3;
  const plan = planCode || "free";
  const hasReachedLimit = plan === "free" && auditCount >= FREE_LIMIT;
  const shouldShowOfferCards = plan !== "pro";
  const isPro = true;
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
  const displayedInsight =
    latestAuditPayload?.summary?.trim() ||
    auditPayloadInsights[0] ||
    simulatedInsight;
  const performanceHeadline = getPerformanceHeadline(latestAudit?.overall_score ?? null, locale);
  const strengths = buildStrengths(latestAudit?.overall_score ?? null, latestAuditPayload, locale);
  const weaknesses = buildWeaknesses(
    latestAudit?.overall_score ?? null,
    auditPayloadRecommendations,
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
    <div className="space-y-8 text-sm">
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

      <div className="nk-card nk-card-hover nk-page-header-card px-6 py-7 md:flex md:items-center md:justify-between md:gap-10 md:px-8">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted">{copy.kicker}</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            {copy.heading}
          </h1>
          <p className="text-sm font-medium text-slate-800 md:text-[15px]">{copy.subtitle}</p>
          <p className="nk-body-muted text-[15px] leading-relaxed text-slate-700">
            {copy.headerDescription}
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
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
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{workspaceOwnerName}</p>
                  {workspace?.owner_user_id && (
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                      {copy.ownerBadge}
                    </span>
                  )}
                </div>
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
              <span className={`h-1.5 w-1.5 rounded-full ${isPro ? "bg-emerald-400" : "bg-orange-400"}`} />
              {isPro ? copy.proActive : copy.freeBadge}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {audits.length} {copy.auditsCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {copy.lastAudit}: {latestAuditDate ? formatAuditDate(latestAuditDate) : copy.noLastAudit}
            </span>
          </div>
        </div>

        <div className="mt-5 text-right md:mt-0">
          {!hasReachedLimit && (
            <div className="flex flex-col items-end gap-2">
              <Link
                href="/dashboard/listings/new"
                className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
              >
                {copy.cta}
              </Link>
            </div>
          )}
          {!hasReachedLimit && (
            <p className="mt-2 text-xs leading-5 text-slate-500">{copy.ctaHelper}</p>
          )}
        </div>
      </div>

      {shouldShowOfferCards && (
        <div className="rounded-[30px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-6 shadow-[0_22px_56px_rgba(15,23,42,0.11)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Offres
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900">
                Des formats simples, lisibles et adaptes a votre rythme d&apos;analyse.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Commencez avec un premier audit, mesurez la valeur du rapport, puis choisissez le bon niveau de volume.
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Annuel -10 %
            </span>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
            <p className="font-semibold text-slate-900">Logique de progression</p>
            <p className="mt-1">
              Commencez avec 1 audit pour valider la valeur du rapport. Le pack 5 est ensuite le
              choix le plus naturel pour comparer plusieurs annonces ou suivre vos optimisations.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {OFFER_CARDS.map((offer) => (
              <OfferSummaryRow
                key={offer.name}
                {...offer}
                onSelect={() =>
                  router.push(`/dashboard/billing?source=audits&offer=${offer.code}`)
                }
              />
            ))}
          </div>
          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              A retenir
            </p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              <p>• Apercu immediat, puis creation de compte pour acceder au rapport complet.</p>
              <p>• Audit test a 9 € pour verifier rapidement la valeur de l&apos;audit.</p>
              <p>• Pack 5 a 39 € pour comparer plusieurs annonces ou suivre vos optimisations.</p>
              <p>• Pack 15 a 99 € pour les usages reguliers, avec -10 % en annuel.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
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

        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Potentiel de gain disponible
          </p>
          <p className="mt-3 text-xl font-semibold tracking-tight text-emerald-950">
            {revenueImpact.value}
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-900">{impactLine}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm">
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

      <div className="nk-card nk-card-hover overflow-hidden p-0">
        <div className="border-b border-slate-200/80 px-5 py-4">
          <p className="nk-section-title">{copy.reportsTitle}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-900">
            <thead className="border-b border-slate-200/80 bg-slate-100 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">{copy.listing}</th>
                <th className="px-5 py-3 font-medium">{copy.globalScore}</th>
                <th className="px-5 py-3 font-medium">{copy.createdAt}</th>
                <th className="px-5 py-3 font-medium">{copy.actions}</th>
              </tr>
            </thead>

            <tbody>
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10">
                    <div className="flex justify-center">
                      <div className="nk-card nk-card-hover max-w-md border border-dashed border-slate-200 bg-white/95 p-6 text-center">
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
                          <Link href="/dashboard/listings/new" className="nk-primary-btn text-xs font-semibold">
                            {copy.firstAudit}
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
                      className="border-t border-slate-200/80 nk-table-row-hover"
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
                        {formatAuditDate(audit.created_at)}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/audits/${audit.id}`}
                            className="nk-ghost-btn h-9 text-[11px] font-semibold uppercase tracking-[0.16em]"
                          >
                            {copy.viewReport}
                          </Link>
                          <Link
                            href="/dashboard/listings/new"
                            className="nk-ghost-btn h-9 text-[11px] font-semibold uppercase tracking-[0.16em]"
                          >
                            {copy.relaunchAudit}
                          </Link>
                          <button
                            type="button"
                            onClick={() => setAuditToDelete(audit)}
                            className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700 transition hover:border-red-300 hover:bg-red-50"
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

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAuditToDelete(null)}
                disabled={isDeleting}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FileText, RotateCcw, Trash2 } from "lucide-react";
import AuditInsightsPanel from "@/components/AuditInsightsPanel";
import type { Locale } from "@/data/i18n";
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

function DashboardActionsTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group/act relative inline-flex shrink-0">
      {children}
      <span
        role="tooltip"
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-[min(100vw-1rem,18rem)] -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-left text-xs font-medium leading-snug text-white opacity-0 shadow-md transition-opacity duration-150 ease-out group-hover/act:opacity-100 group-focus-within/act:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

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
  source_url: string | null;
};

type ListingMeta = {
  title: string | null;
  source_url: string | null;
};

function getPlatformLabelFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const normalized = url.toLowerCase();
  if (normalized.includes("airbnb.")) return "Airbnb";
  if (normalized.includes("booking.")) return "Booking";
  if (normalized.includes("agoda.")) return "Agoda";
  if (normalized.includes("vrbo.") || normalized.includes("abritel.")) return "VRBO";
  if (normalized.includes("expedia.")) return "Expedia";
  return null;
}

function shortenListingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    const host = parsed.hostname.replace(/^www\./, "");
    const compact = `${host}${path === "/" ? "" : path}`;
    return compact.length > 56 ? `${compact.slice(0, 54)}…` : compact;
  } catch {
    return url.length > 56 ? `${url.slice(0, 54)}…` : url;
  }
}

function getListingDisplayLabel(meta: ListingMeta | undefined, untitled: string): string {
  const title = meta?.title?.trim();
  if (title) return title;
  const rawUrl = meta?.source_url?.trim();
  if (rawUrl) return shortenListingUrl(rawUrl);
  return untitled;
}

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
};

function formatAuditDate(value: string | undefined, locale: "fr" | "en" | "es") {
  if (!value) return "–";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";

  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : locale === "en" ? "en-GB" : "fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getScoreStatus(score: number | null, locale: "fr" | "en" | "es") {
  if (score === null) {
    return {
      label: locale === "es" ? "No disponible" : locale === "en" ? "Unavailable" : "Indisponible",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  if (score < 4) {
    return {
      label: locale === "es" ? "Bajo" : locale === "en" ? "Low" : "Faible",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (score < 7) {
    return {
      label: locale === "es" ? "Medio" : locale === "en" ? "Medium" : "Moyen",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: locale === "es" ? "Bueno" : locale === "en" ? "Good" : "Bon",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function getRevenueImpactCopy(score: number | null, currency: string, locale: "fr" | "en" | "es") {
  const normalizedCurrency =
    !currency || currency === "Non renseigné" || currency === "Not provided" ? "EUR" : currency;

  if (score === null) {
    return {
      value: locale === "es" ? "Alto potencial" : locale === "en" ? "High potential" : "Potentiel de gain eleve",
      range:
        locale === "es"
          ? `Aprox. +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}200 a +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}500 / mes`
          : locale === "en"
            ? `Approx. +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}200 to +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}500 / month`
            : `≈ +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}200 a +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}500 / mois`,
      detail:
        locale === "es"
          ? "El potencial de reservas será más visible después del próximo ciclo de optimización."
          : locale === "en"
            ? "Estimated booking upside visible after the next optimization cycle."
            : "Le potentiel de reservation devient plus visible apres les prochaines optimisations.",
    };
  }

  if (score < 4) {
    return {
      value: locale === "es" ? "+12% de reservas estimadas" : locale === "en" ? "+12% estimated bookings" : "+12% de reservations estimees",
      range:
        locale === "en"
          ? `Approx. +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}200 to +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}500 / month`
          : `≈ +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}200 a +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}500 / mois`,
      detail:
        locale === "es"
          ? `Potencial de mejora todavía importante en ${normalizedCurrency}.`
          : locale === "en"
            ? `Potential upside still substantial in ${normalizedCurrency}.`
            : `Potentiel de gain encore important en ${normalizedCurrency}.`,
    };
  }

  if (score < 7) {
    return {
      value: locale === "es" ? "Potencial moderado" : locale === "en" ? "Moderate upside" : "Potentiel modere",
      range:
        locale === "en"
          ? `Approx. +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}200 to +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}500 / month`
          : `≈ +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}200 a +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}500 / mois`,
      detail:
        locale === "es"
          ? "Varias mejoras todavía pueden desbloquear reservas adicionales."
          : locale === "en"
            ? "Several improvements can still unlock additional bookings."
            : "Plusieurs optimisations peuvent encore debloquer des reservations supplementaires.",
    };
  }

  return {
    value: locale === "es" ? "Potencial bajo" : locale === "en" ? "Low upside" : "Potentiel faible",
      range:
        locale === "en"
        ? `Approx. +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}200 to +${normalizedCurrency === "EUR" ? "EUR" : normalizedCurrency}500 / month`
        : `≈ +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}200 a +${normalizedCurrency === "EUR" ? "€" : `${normalizedCurrency} `}500 / mois`,
    detail:
      locale === "es"
        ? "El anuncio ya funciona bien; prioriza mejoras incrementales."
        : locale === "en"
          ? "Listing already performs well, focus on incremental gains."
          : "L annonce performe deja bien, priorisez les gains incrementaux.",
  };
}

function getPerformanceHeadline(score: number | null, locale: "fr" | "en" | "es") {
  if (score === null) {
    return locale === "es"
      ? "Ya hay una primera lectura útil disponible."
      : locale === "en"
        ? "A useful first reading is already available."
        : "Une premiere lecture utile est deja disponible.";
  }

  if (score < 4) {
    return locale === "es"
      ? "Este anuncio tiene un gran potencial si se corrigen los aspectos fundamentales."
      : locale === "en"
        ? "This listing has strong upside if the basics are corrected."
        : "Cette annonce a un fort potentiel si les fondamentaux sont corriges.";
  }

  if (score < 7) {
    return locale === "es"
      ? "Este anuncio es prometedor, pero varias señales visibles todavía frenan la conversión."
      : locale === "en"
        ? "This listing is promising, but several visible signals still slow conversion."
        : "Cette annonce est prometteuse, mais plusieurs signaux visibles freinent encore la conversion.";
  }

  return locale === "es"
    ? "Este anuncio ya es sólido, aunque todavía quedan algunas optimizaciones por aprovechar."
    : locale === "en"
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
  locale: "fr" | "en" | "es"
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
      locale === "es"
        ? "La presentación general ya es competitiva."
        : locale === "en"
          ? "The overall presentation is already competitive."
          : "La presentation globale est deja competitive."
    );
  }

  if (payload?.marketPositioning?.status === "ok") {
    strengths.push(
      locale === "es"
        ? "Hay una referencia local creíble disponible para este anuncio."
        : locale === "en"
          ? "A credible local benchmark is available for this listing."
          : "Un benchmark local credible est disponible pour cette annonce."
    );
  }

  if (payload?.occupancyObservation?.rate && payload.occupancyObservation.rate >= 0.6) {
    strengths.push(
      locale === "es"
        ? "Las señales de disponibilidad sugieren una demanda saludable."
        : locale === "en"
          ? "Availability signals suggest healthy demand."
          : "Les signaux de disponibilite suggerent une demande saine."
    );
  }

  if (strengths.length === 0) {
    strengths.push(
      locale === "es"
        ? "La última auditoría no devolvió una lista estructurada de puntos fuertes."
        : locale === "en"
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
  locale: "fr" | "en" | "es"
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
      locale === "es"
        ? "El anuncio todavía pierde conversión en sus elementos más visibles."
        : locale === "en"
          ? "The listing still loses conversion on its most visible elements."
          : "L'annonce perd encore de la conversion sur ses elements les plus visibles."
    );
  }

  recommendations.slice(0, 2).forEach((item) => {
    weaknesses.push(item);
  });

  if (weaknesses.length === 0) {
    weaknesses.push(
      locale === "es"
        ? "La última auditoría no devolvió una lista estructurada de puntos débiles."
        : locale === "en"
          ? "No structured weaknesses block was returned in the latest audit payload."
          : "Aucune liste de points faibles structuree n'a ete renvoyee dans le dernier rapport."
    );
  }

  return weaknesses.slice(0, 3);
}

function buildQuickWins(recommendations: string[], locale: "fr" | "en" | "es") {
  if (recommendations.length > 0) {
    return recommendations.slice(0, 5);
  }

  return [
    locale === "es"
      ? "Aclara la propuesta principal en las primeras líneas del anuncio."
      : locale === "en"
        ? "Clarify the main promise in the first lines of the listing."
        : "Clarifiez la promesse principale dans les premieres lignes de l'annonce.",
    locale === "es"
      ? "Actualiza las fotos principales para mejorar la tasa de clics."
      : locale === "en"
        ? "Refresh the lead photos to improve click-through rate."
        : "Rafraichissez les photos de tete pour ameliorer le taux de clic.",
    locale === "es"
      ? "Haz más visibles los servicios que diferencian tu alojamiento."
      : locale === "en"
        ? "Make the most differentiating amenities more visible."
        : "Rendez les equipements differenciants plus visibles.",
  ];
}

function getAuditsCopy(locale: Locale) {
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
      linkedListingColumn: "Linked listing",
      linkedListingHint: "Performance report for this listing",
      showingReportsFor: "Showing reports for",
      showAllReports: "Show all reports",
      noReportsForFilteredListing: "No reports for this listing in this workspace.",
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
      delete: "Delete report",
      noScore: "No score yet",
      unavailable: "Unavailable",
      activePlan: "High-impact tracking",
      activePlanText: "A clearer view of performance, conversion, and revenue potential.",
      deleteTitle: "Delete this audit report?",
      deleteText: "This action is irreversible.",
      cancel: "Cancel",
      deleting: "Deleting...",
      deleted: "Audit deleted",
      deleteError: "Unable to delete this audit.",
      ownerBadge: "Owner",
      noLastAudit: "No recent audit",
      scoreStatus: "Status",
      sourceListing: "View source listing ↗",
      showLabel: "Show:",
      previous: "Previous",
      next: "Next",
      pageLabel: "Page",
      pageSeparator: "of",
    };
  }

  if (locale === "es") {
    return {
      kicker: "Rendimiento",
      heading: "Auditorías de rendimiento",
      subtitle:
        "Analiza tus anuncios e identifica acciones de alto impacto para aumentar tus reservas.",
      headerDescription:
        "Sigue la calidad de tus anuncios en el tiempo, compara los resultados y prioriza las próximas optimizaciones.",
      identity: "Identidad del espacio de trabajo",
      owner: "Perfil del propietario",
      notProvided: "No indicado",
      auditsCount: "auditorías realizadas",
      averageScore: "Puntuación media",
      lastAudit: "Última auditoría",
      improvementPotential: "Oportunidad de crecimiento",
      improvementPotentialText:
        "Estimación del posible aumento al mejorar tu anuncio.",
      estimatedImpact: "Impacto estimado",
      freeLimitReached: "Has alcanzado el límite del plan gratuito",
      freeLimitHelper: "Pasa al plan Pro para desbloquear auditorías ilimitadas.",
      unlockPro: "Pasar a Pro",
      proBadge: "Disponible en Pro",
      proActive: "Plan Pro activo",
      creditsActiveLabel: "Créditos activos",
      creditsAvailableSuffix: "auditorías disponibles",
      creditsStatusSubtext: "Listos para usar inmediatamente y lanzar nuevas auditorías",
      planVersusCreditsHint:
        "Nivel de facturación de este espacio — distinto del saldo de créditos restantes (ver Facturación).",
      creditsAvailableLabel: "Créditos disponibles",
      noCreditsAvailable: "No hay créditos disponibles",
      limitReachedCta: "Límite alcanzado",
      aiInsights: "Insights IA",
      summaryTitle: "Resumen de rendimiento",
      summaryText:
        "Usa el historial de auditorías para identificar los anuncios que requieren atención inmediata y dónde es más fácil desbloquear mejoras de conversión.",
      insightsTitle: "Insights y recomendaciones",
      insightsText:
        "Empieza por las acciones con más probabilidad de mejorar la visibilidad, la conversión y el rendimiento.",
      recommendedActions: "Acciones recomendadas",
      insightOne: "Optimizar las fotos principales",
      insightTwo: "Mejorar el título del anuncio",
      insightThree: "Añadir equipamientos más visibles",
      limitedRecommendations: "Profundizar el análisis",
      ctaLaunchAudit: "Lanzar una auditoría",
      ctaLaunchAuditLastCredit: "Lanzar una auditoría (último crédito)",
      ctaLaunchAuditTwoLeft: "Lanzar una auditoría (2 restantes)",
      ctaBuyAudits: "Comprar auditorías",
      ctaConsumesCredit: "Consume 1 crédito",
      ctaBuyAuditsHelper: "Elige un pack o pago por auditoría en la página de Facturación.",
      relaunchAuditLastCredit: "Relanzar auditoría (último crédito)",
      relaunchAuditTwoLeft: "Relanzar auditoría (2 restantes)",
      ctaHelper: "Identifica las acciones que aumentan tus reservas.",
      reportsTitle: "Informes disponibles",
      linkedListingColumn: "Anuncio vinculado",
      linkedListingHint: "Informe de rendimiento para este anuncio",
      showingReportsFor: "Informes para",
      showAllReports: "Todos los informes",
      noReportsForFilteredListing: "No hay informes para este anuncio en este espacio.",
      listing: "Anuncio",
      globalScore: "Puntuación global",
      createdAt: "Creado el",
      actions: "Acciones",
      untitledListing: "Anuncio sin título",
      auditId: "ID auditoría",
      noAudits: "No hay auditorías por ahora",
      noAuditsText:
        "Analiza tu primer anuncio para obtener una puntuación, identificar acciones de alto impacto y empezar tu historial de optimización.",
      firstAudit: "Analizar tu primer anuncio",
      viewReport: "Ver informe",
      relaunchAudit: "Relanzar auditoría",
      delete: "Eliminar informe",
      noScore: "Puntuación no disponible",
      unavailable: "No disponible",
      activePlan: "Seguimiento de alto impacto",
      activePlanText: "Una lectura más clara del rendimiento, la conversión y el potencial de ingresos.",
      deleteTitle: "¿Eliminar este informe de auditoría?",
      deleteText: "Esta acción es irreversible.",
      cancel: "Cancelar",
      deleting: "Eliminando...",
      deleted: "Auditoría eliminada",
      deleteError: "No se puede eliminar esta auditoría.",
      ownerBadge: "Propietario",
      noLastAudit: "Ninguna auditoría reciente",
      scoreStatus: "Estado",
      sourceListing: "Ver anuncio original ↗",
      showLabel: "Mostrar:",
      previous: "Anterior",
      next: "Siguiente",
      pageLabel: "Página",
      pageSeparator: "de",
    };
  }

  if (locale === "de") {
    return {
      kicker: "Performance",
      heading: "Performance-Audits",
      subtitle:
        "Analysieren Sie Ihre Inserate und erkennen Sie Maßnahmen mit hoher Wirkung, um mehr Buchungen zu erzielen.",
      headerDescription:
        "Verfolgen Sie die Qualität Ihrer Inserate im Zeitverlauf, vergleichen Sie Ergebnisse und priorisieren Sie die nächsten Optimierungsschritte.",
      identity: "Workspace-Identität",
      owner: "Eigentümerprofil",
      notProvided: "Nicht angegeben",
      auditsCount: "abgeschlossene Audits",
      averageScore: "Durchschnittliche Bewertung",
      lastAudit: "Letztes Audit",
      improvementPotential: "Wachstumschance",
      improvementPotentialText:
        "Geschätzter möglicher Gewinn durch die Verbesserung Ihres Inserats.",
      estimatedImpact: "Geschätzte Auswirkung",
      freeLimitReached: "Sie haben das Limit des kostenlosen Tarifs erreicht",
      freeLimitHelper: "Wechseln Sie zu Pro, um unbegrenzte Audits freizuschalten.",
      unlockPro: "Zu Pro wechseln",
      proBadge: "Verfügbar in Pro",
      proActive: "Pro-Tarif aktiv",
      creditsActiveLabel: "Aktive Credits",
      creditsAvailableSuffix: "verfügbare Audits",
      creditsStatusSubtext: "Sofort einsetzbar, um neue Audits zu starten",
      planVersusCreditsHint:
        "Abrechnungsstufe für diesen Workspace — nicht Ihr verbleibendes Audit-Guthaben (siehe Abrechnung).",
      creditsAvailableLabel: "Verfügbare Credits",
      noCreditsAvailable: "Keine Credits verfügbar",
      limitReachedCta: "Limit erreicht",
      aiInsights: "KI-Insights",
      summaryTitle: "Performance-Zusammenfassung",
      summaryText:
        "Nutzen Sie den Audit-Verlauf, um Inserate mit unmittelbarem Handlungsbedarf zu erkennen und die einfachsten Conversion-Gewinne zu priorisieren.",
      insightsTitle: "Insights & Empfehlungen",
      insightsText:
        "Beginnen Sie mit den Maßnahmen, die Sichtbarkeit, Conversion und Performance am ehesten verbessern.",
      recommendedActions: "Empfohlene Maßnahmen",
      insightOne: "Hauptfotos optimieren",
      insightTwo: "Titel des Inserats verbessern",
      insightThree: "Mehr sichtbare Ausstattungen hinzufügen",
      limitedRecommendations: "Analyse vertiefen",
      ctaLaunchAudit: "Audit starten",
      ctaLaunchAuditLastCredit: "Audit starten (letzter Credit)",
      ctaLaunchAuditTwoLeft: "Audit starten (noch 2)",
      ctaBuyAudits: "Audits kaufen",
      ctaConsumesCredit: "Verbraucht 1 Credit",
      ctaBuyAuditsHelper: "Wählen Sie ein Paket oder Einzelzahlung auf der Abrechnungsseite.",
      relaunchAuditLastCredit: "Audit erneut starten (letzter Credit)",
      relaunchAuditTwoLeft: "Audit erneut starten (noch 2)",
      ctaHelper: "Erkennen Sie die Maßnahmen, die Ihre Buchungen steigern.",
      reportsTitle: "Verfügbare Berichte",
      linkedListingColumn: "Verknüpftes Inserat",
      linkedListingHint: "Performance-Bericht für dieses Inserat",
      showingReportsFor: "Berichte für",
      showAllReports: "Alle Berichte anzeigen",
      noReportsForFilteredListing: "Keine Berichte für dieses Inserat in diesem Workspace.",
      listing: "Inserat",
      globalScore: "Gesamtbewertung",
      createdAt: "Erstellt am",
      actions: "Aktionen",
      untitledListing: "Inserat ohne Titel",
      auditId: "Audit-ID",
      noAudits: "Noch keine Audits",
      noAuditsText:
        "Analysieren Sie Ihr erstes Inserat, um eine Bewertung zu erhalten, Maßnahmen mit hoher Wirkung zu erkennen und Ihren Optimierungsverlauf aufzubauen.",
      firstAudit: "Erstes Inserat analysieren",
      viewReport: "Bericht ansehen",
      relaunchAudit: "Audit erneut starten",
      delete: "Bericht löschen",
      noScore: "Noch keine Bewertung",
      unavailable: "Nicht verfügbar",
      activePlan: "Performance-Tracking mit hoher Wirkung",
      activePlanText: "Ein klarerer Blick auf Performance, Conversion und Umsatzpotenzial.",
      deleteTitle: "Diesen Audit-Bericht löschen?",
      deleteText: "Diese Aktion ist endgültig.",
      cancel: "Abbrechen",
      deleting: "Wird gelöscht...",
      deleted: "Audit gelöscht",
      deleteError: "Dieses Audit kann nicht gelöscht werden.",
      ownerBadge: "Eigentümer",
      noLastAudit: "Kein aktuelles Audit",
      scoreStatus: "Status",
      sourceListing: "Quellinserat ansehen ↗",
      showLabel: "Anzeigen:",
      previous: "Zurück",
      next: "Weiter",
      pageLabel: "Seite",
      pageSeparator: "von",
    };
  }

  if (locale === "it") {
    return {
      kicker: "Performance",
      heading: "Audit delle performance",
      subtitle:
        "Analizza i tuoi annunci e identifica le azioni ad alto impatto per aumentare le prenotazioni.",
      headerDescription:
        "Monitora la qualità dei tuoi annunci nel tempo, confronta i risultati e dai priorità alle prossime ottimizzazioni.",
      identity: "Identità del workspace",
      owner: "Profilo proprietario",
      notProvided: "Non fornito",
      auditsCount: "audit completati",
      averageScore: "Punteggio medio",
      lastAudit: "Ultimo audit",
      improvementPotential: "Opportunità di crescita",
      improvementPotentialText:
        "Stima del possibile guadagno migliorando il tuo annuncio.",
      estimatedImpact: "Impatto stimato",
      freeLimitReached: "Hai raggiunto il limite del piano gratuito",
      freeLimitHelper: "Passa a Pro per sbloccare audit illimitati.",
      unlockPro: "Passa a Pro",
      proBadge: "Disponibile su Pro",
      proActive: "Piano Pro attivo",
      creditsActiveLabel: "Crediti attivi",
      creditsAvailableSuffix: "audit disponibili",
      creditsStatusSubtext: "Pronti all’uso immediato per lanciare nuovi audit",
      planVersusCreditsHint:
        "Livello di fatturazione per questo workspace — distinto dai crediti audit rimanenti (vedi Fatturazione).",
      creditsAvailableLabel: "Crediti disponibili",
      noCreditsAvailable: "Nessun credito disponibile",
      limitReachedCta: "Limite raggiunto",
      aiInsights: "Insight IA",
      summaryTitle: "Riepilogo delle performance",
      summaryText:
        "Usa la cronologia degli audit per individuare gli annunci che richiedono attenzione immediata e dove è più facile sbloccare miglioramenti di conversione.",
      insightsTitle: "Insight e raccomandazioni",
      insightsText:
        "Inizia dalle azioni più propense a migliorare visibilità, conversione e performance.",
      recommendedActions: "Azioni consigliate",
      insightOne: "Ottimizzare le foto principali",
      insightTwo: "Migliorare il titolo dell’annuncio",
      insightThree: "Aggiungere più servizi visibili",
      limitedRecommendations: "Approfondisci l’analisi",
      ctaLaunchAudit: "Avvia un audit",
      ctaLaunchAuditLastCredit: "Avvia un audit (ultimo credito)",
      ctaLaunchAuditTwoLeft: "Avvia un audit (ne restano 2)",
      ctaBuyAudits: "Acquista audit",
      ctaConsumesCredit: "Consuma 1 credito",
      ctaBuyAuditsHelper: "Scegli un pacchetto o il pagamento per audit nella pagina Fatturazione.",
      relaunchAuditLastCredit: "Rilancia audit (ultimo credito)",
      relaunchAuditTwoLeft: "Rilancia audit (ne restano 2)",
      ctaHelper: "Identifica le azioni che aumentano le prenotazioni.",
      reportsTitle: "Report disponibili",
      linkedListingColumn: "Annuncio collegato",
      linkedListingHint: "Report delle performance per questo annuncio",
      showingReportsFor: "Report per",
      showAllReports: "Mostra tutti i report",
      noReportsForFilteredListing: "Nessun report per questo annuncio in questo workspace.",
      listing: "Annuncio",
      globalScore: "Punteggio globale",
      createdAt: "Creato il",
      actions: "Azioni",
      untitledListing: "Annuncio senza titolo",
      auditId: "ID audit",
      noAudits: "Nessun audit per ora",
      noAuditsText:
        "Analizza il tuo primo annuncio per ottenere un punteggio, identificare azioni ad alto impatto e iniziare la tua cronologia di ottimizzazione.",
      firstAudit: "Analizza il tuo primo annuncio",
      viewReport: "Visualizza report",
      relaunchAudit: "Rilancia audit",
      delete: "Elimina report",
      noScore: "Nessun punteggio disponibile",
      unavailable: "Non disponibile",
      activePlan: "Monitoraggio ad alto impatto",
      activePlanText: "Una lettura più chiara di performance, conversione e potenziale di ricavo.",
      deleteTitle: "Eliminare questo report di audit?",
      deleteText: "Questa azione è irreversibile.",
      cancel: "Annulla",
      deleting: "Eliminazione...",
      deleted: "Audit eliminato",
      deleteError: "Impossibile eliminare questo audit.",
      ownerBadge: "Proprietario",
      noLastAudit: "Nessun audit recente",
      scoreStatus: "Stato",
      sourceListing: "Visualizza annuncio sorgente ↗",
      showLabel: "Mostra:",
      previous: "Precedente",
      next: "Successivo",
      pageLabel: "Pagina",
      pageSeparator: "di",
    };
  }

  if (locale === "pt") {
    return {
      kicker: "Performance",
      heading: "Auditorias de performance",
      subtitle:
        "Analise os seus anúncios e identifique ações de alto impacto para aumentar as reservas.",
      headerDescription:
        "Acompanhe a qualidade dos seus anúncios ao longo do tempo, compare resultados e priorize os próximos passos de otimização.",
      identity: "Identidade do workspace",
      owner: "Perfil do proprietário",
      notProvided: "Não informado",
      auditsCount: "auditorias realizadas",
      averageScore: "Pontuação média",
      lastAudit: "Última auditoria",
      improvementPotential: "Oportunidade de crescimento",
      improvementPotentialText:
        "Estimativa do ganho possível ao melhorar o seu anúncio.",
      estimatedImpact: "Impacto estimado",
      freeLimitReached: "Atingiu o limite do plano gratuito",
      freeLimitHelper: "Mude para o Pro para desbloquear auditorias ilimitadas.",
      unlockPro: "Mudar para Pro",
      proBadge: "Disponível no Pro",
      proActive: "Plano Pro ativo",
      creditsActiveLabel: "Créditos ativos",
      creditsAvailableSuffix: "auditorias disponíveis",
      creditsStatusSubtext: "Prontos para uso imediato ao lançar novas auditorias",
      planVersusCreditsHint:
        "Nível de faturação deste workspace — distinto do saldo de créditos de auditoria restantes (ver Faturação).",
      creditsAvailableLabel: "Créditos disponíveis",
      noCreditsAvailable: "Sem créditos disponíveis",
      limitReachedCta: "Limite atingido",
      aiInsights: "Insights IA",
      summaryTitle: "Resumo de performance",
      summaryText:
        "Use o histórico de auditorias para identificar quais anúncios merecem atenção imediata e onde é mais fácil desbloquear ganhos de conversão.",
      insightsTitle: "Insights e recomendações",
      insightsText:
        "Comece pelas ações com maior probabilidade de melhorar visibilidade, conversão e performance.",
      recommendedActions: "Ações recomendadas",
      insightOne: "Otimizar as fotos principais",
      insightTwo: "Melhorar o título do anúncio",
      insightThree: "Adicionar mais comodidades visíveis",
      limitedRecommendations: "Aprofundar a análise",
      ctaLaunchAudit: "Lançar uma auditoria",
      ctaLaunchAuditLastCredit: "Lançar uma auditoria (último crédito)",
      ctaLaunchAuditTwoLeft: "Lançar uma auditoria (faltam 2)",
      ctaBuyAudits: "Comprar auditorias",
      ctaConsumesCredit: "Consome 1 crédito",
      ctaBuyAuditsHelper: "Escolha um pacote ou pagamento por auditoria na página de Faturação.",
      relaunchAuditLastCredit: "Relançar auditoria (último crédito)",
      relaunchAuditTwoLeft: "Relançar auditoria (faltam 2)",
      ctaHelper: "Identifique as ações que aumentam as suas reservas.",
      reportsTitle: "Relatórios disponíveis",
      linkedListingColumn: "Anúncio associado",
      linkedListingHint: "Relatório de performance para este anúncio",
      showingReportsFor: "Relatórios para",
      showAllReports: "Mostrar todos os relatórios",
      noReportsForFilteredListing: "Nenhum relatório para este anúncio neste workspace.",
      listing: "Anúncio",
      globalScore: "Pontuação global",
      createdAt: "Criado em",
      actions: "Ações",
      untitledListing: "Anúncio sem título",
      auditId: "ID da auditoria",
      noAudits: "Ainda não há auditorias",
      noAuditsText:
        "Analise o seu primeiro anúncio para obter uma pontuação, identificar ações de alto impacto e começar o seu histórico de otimização.",
      firstAudit: "Analisar o seu primeiro anúncio",
      viewReport: "Ver relatório",
      relaunchAudit: "Relançar auditoria",
      delete: "Eliminar relatório",
      noScore: "Ainda sem pontuação",
      unavailable: "Indisponível",
      activePlan: "Acompanhamento de alto impacto",
      activePlanText: "Uma leitura mais clara de performance, conversão e potencial de receita.",
      deleteTitle: "Eliminar este relatório de auditoria?",
      deleteText: "Esta ação é irreversível.",
      cancel: "Cancelar",
      deleting: "A eliminar...",
      deleted: "Auditoria eliminada",
      deleteError: "Não foi possível eliminar esta auditoria.",
      ownerBadge: "Proprietário",
      noLastAudit: "Nenhuma auditoria recente",
      scoreStatus: "Estado",
      sourceListing: "Ver anúncio de origem ↗",
      showLabel: "Mostrar:",
      previous: "Anterior",
      next: "Seguinte",
      pageLabel: "Página",
      pageSeparator: "de",
    };
  }

  if (locale === "nl") {
    return {
      kicker: "Prestaties",
      heading: "Prestatie-audits",
      subtitle:
        "Analyseer je advertenties en identificeer acties met hoge impact om meer boekingen te krijgen.",
      headerDescription:
        "Volg de kwaliteit van je advertenties in de tijd, vergelijk resultaten en geef prioriteit aan de volgende optimalisaties.",
      identity: "Workspace-identiteit",
      owner: "Eigenaarsprofiel",
      notProvided: "Niet opgegeven",
      auditsCount: "voltooide audits",
      averageScore: "Gemiddelde score",
      lastAudit: "Laatste audit",
      improvementPotential: "Groeikans",
      improvementPotentialText:
        "Geschatte winst die mogelijk is door je advertentie te verbeteren.",
      estimatedImpact: "Geschatte impact",
      freeLimitReached: "Je hebt de limiet van het gratis plan bereikt",
      freeLimitHelper: "Stap over op Pro om onbeperkte audits vrij te schakelen.",
      unlockPro: "Upgrade naar Pro",
      proBadge: "Beschikbaar in Pro",
      proActive: "Pro-plan actief",
      creditsActiveLabel: "Actieve credits",
      creditsAvailableSuffix: "beschikbare audits",
      creditsStatusSubtext: "Direct klaar voor gebruik om nieuwe audits te starten",
      planVersusCreditsHint:
        "Facturatieniveau voor deze workspace — niet je resterende auditcredits (zie Facturatie).",
      creditsAvailableLabel: "Beschikbare credits",
      noCreditsAvailable: "Geen credits beschikbaar",
      limitReachedCta: "Limiet bereikt",
      aiInsights: "AI-inzichten",
      summaryTitle: "Prestatieoverzicht",
      summaryText:
        "Gebruik de auditgeschiedenis om te zien welke advertenties meteen aandacht verdienen en waar conversiewinst het makkelijkst te behalen is.",
      insightsTitle: "Inzichten & aanbevelingen",
      insightsText:
        "Begin met de acties die de zichtbaarheid, conversie en prestaties waarschijnlijk het meest verbeteren.",
      recommendedActions: "Aanbevolen acties",
      insightOne: "Optimaliseer de hoofdfoto’s",
      insightTwo: "Verbeter de titel van de advertentie",
      insightThree: "Voeg meer zichtbare voorzieningen toe",
      limitedRecommendations: "Ga dieper in op de analyse",
      ctaLaunchAudit: "Start een audit",
      ctaLaunchAuditLastCredit: "Start een audit (laatste credit)",
      ctaLaunchAuditTwoLeft: "Start een audit (nog 2 over)",
      ctaBuyAudits: "Audits kopen",
      ctaConsumesCredit: "Verbruikt 1 credit",
      ctaBuyAuditsHelper: "Kies een pakket of betaling per audit op de facturatiepagina.",
      relaunchAuditLastCredit: "Audit opnieuw starten (laatste credit)",
      relaunchAuditTwoLeft: "Audit opnieuw starten (nog 2 over)",
      ctaHelper: "Ontdek welke acties je boekingen verhogen.",
      reportsTitle: "Beschikbare rapporten",
      linkedListingColumn: "Gekoppelde advertentie",
      linkedListingHint: "Prestatieverslag voor deze advertentie",
      showingReportsFor: "Rapporten voor",
      showAllReports: "Alle rapporten tonen",
      noReportsForFilteredListing: "Geen rapporten voor deze advertentie in deze workspace.",
      listing: "Advertentie",
      globalScore: "Totale score",
      createdAt: "Aangemaakt op",
      actions: "Acties",
      untitledListing: "Advertentie zonder titel",
      auditId: "Audit-ID",
      noAudits: "Nog geen audits",
      noAuditsText:
        "Analyseer je eerste advertentie om een score te krijgen, acties met hoge impact te identificeren en je optimalisatiegeschiedenis op te bouwen.",
      firstAudit: "Analyseer je eerste advertentie",
      viewReport: "Rapport bekijken",
      relaunchAudit: "Audit opnieuw starten",
      delete: "Rapport verwijderen",
      noScore: "Nog geen score",
      unavailable: "Niet beschikbaar",
      activePlan: "Monitoring met hoge impact",
      activePlanText: "Een duidelijker beeld van prestaties, conversie en omzetpotentieel.",
      deleteTitle: "Dit auditrapport verwijderen?",
      deleteText: "Deze actie is onomkeerbaar.",
      cancel: "Annuleren",
      deleting: "Verwijderen...",
      deleted: "Audit verwijderd",
      deleteError: "Kan deze audit niet verwijderen.",
      ownerBadge: "Eigenaar",
      noLastAudit: "Geen recente audit",
      scoreStatus: "Status",
      sourceListing: "Bronadvertentie bekijken ↗",
      showLabel: "Tonen:",
      previous: "Vorige",
      next: "Volgende",
      pageLabel: "Pagina",
      pageSeparator: "van",
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
    linkedListingColumn: "Annonce liée",
    linkedListingHint: "Rapport de performance pour cette annonce",
    showingReportsFor: "Rapports pour",
    showAllReports: "Tous les rapports",
    noReportsForFilteredListing: "Aucun rapport pour cette annonce dans ce workspace.",
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
    delete: "Supprimer le rapport",
    noScore: "Score indisponible",
    unavailable: "Indisponible",
    activePlan: "Suivi à fort impact",
    activePlanText: "Une lecture plus claire de la performance, de la conversion et du potentiel revenu.",
    deleteTitle: "Supprimer ce rapport d’audit ?",
    deleteText: "Cette action est irréversible.",
    cancel: "Annuler",
    deleting: "Suppression...",
    deleted: "Audit supprimé",
    deleteError: "Impossible de supprimer cet audit.",
    ownerBadge: "Propriétaire",
    noLastAudit: "Aucun audit récent",
    scoreStatus: "Statut",
    sourceListing: "Voir l’annonce source ↗",
    showLabel: "Afficher :",
    previous: "Précédent",
    next: "Suivant",
    pageLabel: "Page",
    pageSeparator: "sur",
  };
}

export default function AuditsPage() {
  const searchParams = useSearchParams();
  const filterListingId = searchParams.get("listingId");

  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [listingMetaById, setListingMetaById] = useState<Record<string, ListingMeta>>({});
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
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const locale = preferences.language === "es" ? "es" : preferences.language === "en" ? "en" : "fr";
  const copy = getAuditsCopy(locale);

  const displayedAudits = useMemo(() => {
    if (!filterListingId) return audits;
    return audits.filter((audit) => audit.listing_id === filterListingId);
  }, [audits, filterListingId]);

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1));
  }, [filterListingId]);

  const totalAuditTablePages = Math.max(1, Math.ceil(displayedAudits.length / itemsPerPage));
  const effectiveAuditTablePage = Math.min(currentPage, totalAuditTablePages);
  const paginatedDisplayedAudits = useMemo(
    () =>
      displayedAudits.slice(
        (effectiveAuditTablePage - 1) * itemsPerPage,
        effectiveAuditTablePage * itemsPerPage
      ),
    [displayedAudits, effectiveAuditTablePage, itemsPerPage]
  );

  const filterListingLabel = useMemo(
    () =>
      filterListingId
        ? getListingDisplayLabel(listingMetaById[filterListingId], copy.untitledListing)
        : "",
    [filterListingId, listingMetaById, copy.untitledListing]
  );

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
        setListingMetaById({});
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
        setListingMetaById({});
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
        setListingMetaById({});
        return;
      }

      const auditRows = (data ?? []) as AuditRow[];
      setAudits(auditRows);

      const uniqueListingIds = Array.from(new Set(auditRows.map((audit) => audit.listing_id)));

      if (uniqueListingIds.length === 0) {
        setListingMetaById({});
        return;
      }

      const { data: listingsData, error: listingsError } = await supabase
        .from("listings")
        .select("id, title, source_url")
        .eq("workspace_id", activeWorkspaceId)
        .in("id", uniqueListingIds);

      if (listingsError) {
        console.error("Failed to load linked listings:", listingsError);
        setListingMetaById({});
        return;
      }

      const metaMap = ((listingsData ?? []) as ListingLookupRow[]).reduce<
        Record<string, ListingMeta>
      >((accumulator, listing) => {
        accumulator[listing.id] = {
          title: listing.title?.trim() ? listing.title.trim() : null,
          source_url: listing.source_url?.trim() ? listing.source_url.trim() : null,
        };
        return accumulator;
      }, {});

      setListingMetaById(metaMap);
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
    locale === "es"
      ? "Aún no hay un resumen corto disponible para la última auditoría. Abre el informe completo para ver los hallazgos específicos del anuncio."
      : locale === "en"
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
      ? locale === "es"
        ? "Tu anuncio ya tiene buen rendimiento, pero todavía deja potencial sin aprovechar."
        : locale === "en"
          ? "Your listing already performs well, but there is still untapped potential."
          : "Votre annonce est deja performante, mais vous laissez encore du potentiel inexploite."
      : locale === "es"
        ? "Tu anuncio puede ganar impacto con algunas optimizaciones bien enfocadas."
        : locale === "en"
          ? "Your listing can gain impact with a few focused optimizations."
          : "Votre annonce peut gagner en impact avec quelques optimisations bien ciblees.";
  const currentRevenueLabel =
    marketTeaser && comparableCount > 0
      ? locale === "es"
        ? "Base actual posicionada de forma coherente en tu mercado"
        : locale === "en"
          ? "Current baseline coherently positioned in your market"
          : "Base actuelle coherentement positionnee sur votre marche"
      : locale === "es"
        ? "Base actual a reforzar en las señales más visibles"
        : locale === "en"
          ? "Current baseline to strengthen on the most visible signals"
          : "Base actuelle a renforcer sur les signaux les plus visibles";
  const optimizedRevenueLabel =
    latestAuditPayload?.estimatedRevenue?.trim() ||
    revenueImpact.range;
  const impactBusinessLead =
    locale === "es"
      ? "Tu anuncio ya funciona bien, pero puede generar más ingresos."
      : locale === "en"
        ? "Your listing already performs well, but it can generate more revenue."
        : "Votre annonce fonctionne deja bien, mais elle peut generer davantage de revenus.";
  const heroTitle =
    latestScore !== null && latestScore >= 7
      ? locale === "es"
        ? "Tu anuncio ya es competitivo, con potencial aún aprovechable"
        : locale === "en"
          ? "Your listing is already performing, with remaining potential to capture"
          : "Votre annonce est déjà performante, avec un potentiel encore exploitable"
      : locale === "es"
        ? "Tu anuncio puede convertir mejor con algunas optimizaciones específicas"
        : locale === "en"
          ? "Your listing can convert better with a few targeted optimizations"
          : "Votre annonce peut encore mieux convertir avec quelques optimisations ciblées";
  const heroClosing =
    locale === "es"
      ? "Algunas optimizaciones simples pueden mejorar tus resultados rápidamente."
      : locale === "en"
        ? "A few simple optimizations can improve your results quickly."
        : "Quelques optimisations simples peuvent améliorer vos résultats rapidement.";
  const insightsNarrative = marketTeaser
    ? locale === "es"
      ? `Los anuncios similares que rinden mejor destacan beneficios más claros, servicios diferenciadores y una primera impresión más fuerte. ${marketTeaser}`
      : locale === "en"
        ? `Similar listings that perform better highlight clearer benefits, differentiating amenities, and a stronger first impression. ${marketTeaser}`
        : `Les annonces similaires qui performent mieux mettent en avant des bénéfices plus lisibles, des équipements différenciants et une première impression plus forte. ${marketTeaser}`
    : locale === "es"
      ? "Los anuncios similares que rinden mejor usan títulos orientados a beneficios, destacan los servicios clave y optimizan más la primera foto."
      : locale === "en"
        ? "Similar listings that perform better use benefit-oriented titles, highlight key amenities, and optimize the first photo more."
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

      <div className="nk-card nk-card-hover overflow-hidden rounded-[28px] nk-border bg-gradient-to-br from-slate-50 via-white to-slate-50/90 p-0 shadow-[0_14px_36px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.64)_inset]">
        <div className="border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur-sm">
          <p className="nk-section-title">{copy.reportsTitle}</p>
        </div>

        {filterListingId ? (
          <div className="flex flex-col gap-2 border-b border-slate-200/80 bg-slate-50/50 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-600">
              {copy.showingReportsFor}{" "}
              <span className="font-semibold text-slate-900">{filterListingLabel}</span>
            </p>
            <Link
              href="/dashboard/audits"
              className="inline-flex w-fit shrink-0 items-center rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              {copy.showAllReports}
            </Link>
          </div>
        ) : null}

        <div className="nk-table-shell overflow-x-auto bg-white/95">
          <table className="min-w-full text-left text-sm text-slate-900">
            <thead className="nk-table-header border-b border-slate-200/80 bg-slate-50/80 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold text-slate-500">
                  {copy.linkedListingColumn}
                </th>
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
              ) : displayedAudits.length === 0 && filterListingId ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-600">
                    {copy.noReportsForFilteredListing}
                  </td>
                </tr>
              ) : (
                paginatedDisplayedAudits.map((audit) => {
                  const overallScore =
                    typeof audit.overall_score === "number" && Number.isFinite(audit.overall_score)
                      ? audit.overall_score
                      : null;
                  const listingMeta = listingMetaById[audit.listing_id];
                  const listingLabel = getListingDisplayLabel(
                    listingMeta,
                    copy.untitledListing
                  );
                  const sourceUrl = listingMeta?.source_url?.trim() || null;
                  const platformLabel = getPlatformLabelFromUrl(sourceUrl);
                  const scoreStatus = getScoreStatus(overallScore, locale);

                  return (
                    <tr
                      key={audit.id}
                      className="border-t border-slate-100 nk-table-row-hover even:bg-slate-50/40"
                    >
                      <td className="align-top px-5 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-900">{listingLabel}</span>
                          <div className="flex flex-wrap items-center gap-2">
                            {platformLabel ? (
                              <span className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                                {platformLabel}
                              </span>
                            ) : null}
                            {sourceUrl ? (
                              <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-semibold text-blue-600 transition hover:text-blue-800"
                              >
                                {copy.sourceListing}
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-500">{copy.linkedListingHint}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="align-top px-5 py-2.5">
                        <div className="flex flex-col gap-1">
                          {platformLabel ? (
                            <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                              {platformLabel}
                            </span>
                          ) : null}
                          {overallScore !== null ? (
                            <span className="text-base font-semibold text-slate-900">
                              {overallScore.toFixed(1)}
                              <span className="text-xs font-medium text-slate-400">/10</span>
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-500">{copy.noScore}</span>
                          )}
                          <span
                            className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${scoreStatus.className}`}
                          >
                            {copy.scoreStatus} · {scoreStatus.label}
                          </span>
                        </div>
                      </td>

                      <td className="align-top px-5 py-2.5 text-[11px] text-slate-500">
                        {formatAuditDate(audit.created_at, locale)}
                      </td>

                      <td className="relative overflow-visible px-5 py-2.5 align-top text-right">
                        <div className="flex flex-nowrap items-center justify-end gap-1.5">
                          <DashboardActionsTooltip label={copy.viewReport}>
                            <Link
                              aria-label={copy.viewReport}
                              href={`/dashboard/audits/${audit.id}`}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white/70 text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/35"
                            >
                              <FileText aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                            </Link>
                          </DashboardActionsTooltip>
                          <DashboardActionsTooltip label={copy.relaunchAudit}>
                            <Link
                              aria-label={relaunchAuditLabel}
                              href={relaunchAuditHref}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/70 text-slate-600 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30"
                            >
                              <RotateCcw aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                            </Link>
                          </DashboardActionsTooltip>
                          <DashboardActionsTooltip label={copy.delete}>
                            <button
                              type="button"
                              aria-label={copy.delete}
                              onClick={() => setAuditToDelete(audit)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white/70 text-red-500 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30"
                            >
                              <Trash2 aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                            </button>
                          </DashboardActionsTooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {displayedAudits.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-white/95 px-5 py-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700">{copy.showLabel}</span>
              <select
                value={itemsPerPage}
                onChange={(event) => {
                  setItemsPerPage(Number(event.target.value));
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
                disabled={effectiveAuditTablePage <= 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.previous}
              </button>
              <span className="font-medium text-slate-700">
                {copy.pageLabel} {effectiveAuditTablePage} {copy.pageSeparator} {totalAuditTablePages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalAuditTablePages))
                }
                disabled={effectiveAuditTablePage >= totalAuditTablePages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.next}
              </button>
            </div>
          </div>
        ) : null}
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

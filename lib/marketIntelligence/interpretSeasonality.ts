import type { SeasonalityEngineV1 } from "@/lib/marketIntelligence/buildSeasonalityEngineV1";

export type SeasonalityInsightBadgeTone = "green" | "yellow" | "blue" | "gray";

export type SeasonalityInsightPricingPressure = "up" | "down" | "neutral" | "unknown";

export type SeasonalityInsight = {
  badgeLabel: string;
  badgeTone: SeasonalityInsightBadgeTone;
  title: string;
  message: string;
  pricingPressure: SeasonalityInsightPricingPressure;
  opportunityScore: number | null;
  isActionable: boolean;
};

function grayUnknown(
  badgeLabel: string,
  title: string,
  message: string
): SeasonalityInsight {
  return {
    badgeLabel,
    badgeTone: "gray",
    title,
    message,
    pricingPressure: "unknown",
    opportunityScore: null,
    isActionable: false,
  };
}

/**
 * Traduit la sortie Seasonality Engine v1 en libellés produit prudents.
 * Lecture seule — ne modifie pas le scoring.
 */
export function interpretSeasonality(
  seasonality: SeasonalityEngineV1 | null
): SeasonalityInsight {
  if (seasonality == null) {
    return grayUnknown(
      "—",
      "Saisonnalité indisponible",
      "Les données de saisonnalité n’ont pas pu être calculées pour cet audit."
    );
  }

  if (seasonality.confidenceScore < 60 || seasonality.comparableCount < 5) {
    return grayUnknown(
      "Données saisonnières insuffisantes",
      "Contexte saisonnier limité",
      "Le volume d’observations ou le niveau de confiance est trop faible pour proposer une lecture fiable de la saisonnalité."
    );
  }

  const idx = seasonality.seasonalIndex;
  const label = seasonality.seasonLabel;

  if (label === "high" || (idx != null && idx >= 1.15)) {
    return {
      badgeLabel: "Haute saison",
      badgeTone: "green",
      title: "Demande saisonnière favorable",
      message:
        "Le marché observé est au-dessus de son niveau moyen sur cette période. Une optimisation du prix peut être envisagée, sans garantie de réservations.",
      pricingPressure: "up",
      opportunityScore: 0.8,
      isActionable: true,
    };
  }

  if (label === "low" || (idx != null && idx <= 0.9)) {
    return {
      badgeLabel: "Basse saison",
      badgeTone: "blue",
      title: "Demande saisonnière plus faible",
      message:
        "Le marché observé est sous son niveau moyen sur cette période. La priorité est de sécuriser la conversion et d’éviter un prix trop ambitieux.",
      pricingPressure: "down",
      opportunityScore: 0.5,
      isActionable: true,
    };
  }

  if (label === "shoulder") {
    return {
      badgeLabel: "Inter-saison",
      badgeTone: "yellow",
      title: "Marché stable sur ces dates",
      message:
        "Le marché observé est proche de son niveau moyen. La différence se joue surtout sur la clarté de l’annonce, les photos et le prix perçu.",
      pricingPressure: "neutral",
      opportunityScore: 0.6,
      isActionable: true,
    };
  }

  return grayUnknown(
    "Indéterminé",
    "Saisonnalité peu claire",
    "La saisonnalité ne permet pas encore une lecture actionnable avec les données disponibles."
  );
}

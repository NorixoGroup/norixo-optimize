import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

export function scoreTrust(listing: NormalizedListing): ScoreResult {
  const rating = typeof listing.rating === "number" ? listing.rating : null;
  const reviews = typeof listing.reviewsCount === "number" ? listing.reviewsCount : null;

  if (rating == null || reviews == null) {
    return {
      score: 5,
      reasons: [
        "Le volume d’avis est insuffisant pour évaluer pleinement la confiance perçue par les voyageurs.",
      ],
    };
  }

  let score: number;
  const reasons: string[] = [];

  if (rating >= 4.8 && reviews >= 50) {
    score = 9.5;
    reasons.push("La note est excellente avec un volume d’avis élevé, ce qui renforce fortement la confiance.");
  } else if (rating >= 4.6 && reviews >= 20) {
    score = 9;
    reasons.push("La note est très bonne avec un volume d’avis solide, ce qui rassure avant réservation.");
  } else if (rating >= 4.3 && reviews >= 10) {
    score = 8;
    reasons.push("La satisfaction client est bonne avec un nombre d’avis correct, ce qui soutient la crédibilité.");
  } else if (rating >= 4.0 && reviews >= 5) {
    score = 7;
    reasons.push("La note est correcte, mais davantage d’avis renforcerait la confiance des futurs voyageurs.");
  } else if (rating >= 3.5) {
    score = 5.5;
    reasons.push("Les avis sont mitigés ; traiter les points récurrents peut améliorer la conversion.");
  } else {
    score = 4;
    reasons.push("La note est faible, ce qui peut freiner la réservation tant que les causes ne sont pas corrigées.");
  }

  reasons.push(`L’annonce affiche une note de ${rating.toFixed(1)} basée sur ${reviews} avis.`);

  return {
    score: Math.max(0, Math.min(10, Number(score.toFixed(1)))),
    reasons,
  };
}

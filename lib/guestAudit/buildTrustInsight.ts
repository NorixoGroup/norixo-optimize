export type TrustSignals = {
  rating: number | null;
  reviewCount: number | null;
  hostName: string | null;
  trustBadge: string | null;
};

export type TrustInsight = {
  score: number;
  label: string;
  summary: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRatingToFive(rating: number | null): number | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  if (rating >= 0 && rating <= 5) return rating;
  if (rating > 5 && rating <= 10) return rating / 2;
  return null;
}

function computeReviewScore(reviewCount: number | null): number {
  if (reviewCount == null || !Number.isFinite(reviewCount)) return 0;
  if (reviewCount < 5) return 2;
  if (reviewCount < 20) return 8;
  if (reviewCount < 50) return 14;
  if (reviewCount < 120) return 19;
  if (reviewCount < 250) return 23;
  return 25;
}

function scoreToLabel(score: number): TrustInsight["label"] {
  if (score <= 39) return "Faible confiance";
  if (score <= 59) return "Confiance moyenne";
  if (score <= 79) return "Bonne confiance";
  return "Excellente confiance";
}

function buildSummary(input: {
  ratingOnFive: number | null;
  reviewCount: number | null;
  hostName: string | null;
  trustBadge: string | null;
}): string {
  const { ratingOnFive, reviewCount, hostName, trustBadge } = input;
  const segments: string[] = [];

  if (ratingOnFive != null) {
    const ratingTone =
      ratingOnFive >= 4.7
        ? "très rassurante"
        : ratingOnFive >= 4.3
          ? "solide"
          : "encore améliorable";
    segments.push(`Note ${ratingOnFive.toFixed(1)}/5 ${ratingTone}.`);
  } else {
    segments.push("Signaux de confiance partiels sur la note.");
  }

  if (reviewCount == null) {
    segments.push("Nombre d’avis non confirmé.");
  } else if (reviewCount < 20) {
    segments.push("Peu d’avis visibles: la preuve sociale reste limitée.");
  } else if (reviewCount < 80) {
    segments.push("Le volume d’avis apporte déjà de la crédibilité.");
  } else {
    segments.push("Le volume d’avis renforce fortement la crédibilité.");
  }

  if (trustBadge) {
    segments.push(`Badge « ${trustBadge} » détecté.`);
  } else {
    segments.push("Aucun badge de confiance visible pour l’instant.");
  }

  if (hostName) {
    segments.push("Hôte identifié sur l’annonce.");
  }

  return segments.join(" ");
}

export function buildTrustInsight(signals: TrustSignals): TrustInsight {
  const ratingOnFive = normalizeRatingToFive(signals.rating);
  const ratingScore = ratingOnFive == null ? 0 : Math.round((ratingOnFive / 5) * 55);
  const reviewScore = computeReviewScore(signals.reviewCount);
  const badgeBonus = signals.trustBadge ? 15 : 0;
  const hostBonus = signals.hostName ? 5 : 0;

  const score = clamp(
    Math.round(ratingScore + reviewScore + badgeBonus + hostBonus),
    0,
    100
  );

  return {
    score,
    label: scoreToLabel(score),
    summary: buildSummary({
      ratingOnFive,
      reviewCount: signals.reviewCount,
      hostName: signals.hostName,
      trustBadge: signals.trustBadge,
    }),
  };
}


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
  const hasLowSocialProof = reviewCount == null || reviewCount < 20;
  const hasNoStrongBadge = !trustBadge;
  const hasMidOrLowRatingSignal = ratingOnFive == null || ratingOnFive < 4.4;
  const hasStrongTrustBase =
    ratingOnFive != null &&
    ratingOnFive >= 4.6 &&
    reviewCount != null &&
    reviewCount >= 80 &&
    Boolean(trustBadge);

  if (hasStrongTrustBase) {
    return "Annonce très rassurante avec des signaux de confiance solides.";
  }

  if (hasLowSocialProof) {
    return "Les signaux de confiance restent limités : peu d’avis disponibles pour rassurer les voyageurs.";
  }

  if (hasMidOrLowRatingSignal && hasNoStrongBadge) {
    return "La confiance perçue est moyenne : la preuve sociale existe mais reste encore insuffisante.";
  }

  if (hasNoStrongBadge) {
    return "Annonce globalement crédible, mais certains signaux de confiance pourraient être renforcés.";
  }

  if (hostName) {
    return "Annonce crédible avec des signaux de confiance déjà visibles pour les voyageurs.";
  }

  return "La confiance perçue est correcte, avec encore une marge de renforcement sur la preuve sociale.";
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

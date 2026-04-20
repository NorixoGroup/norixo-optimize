import type { NormalizedListing } from "../listings/normalizeListing";

export type ScoreResult = {
  score: number; // 0 to 10
  reasons: string[];
};

export type PricingMarketData = {
  averagePrice: number;
  lowerBound?: number;
  upperBound?: number;
  currency?: string;
};

export function scorePricing(
  listing: NormalizedListing,
  marketData?: PricingMarketData
): ScoreResult {
  const price = typeof listing.price === "number" ? listing.price : null;

  if (!marketData || typeof marketData.averagePrice !== "number" || marketData.averagePrice <= 0) {
    return {
      score: 5,
      reasons: [
        "Les données marché sont insuffisantes ; le score prix reste neutre tant que des comparables fiables manquent.",
      ],
    };
  }

  if (price == null || price <= 0) {
    return {
      score: 5,
      reasons: [
        "Le prix de l’annonce est absent ou invalide ; le positionnement tarifaire ne peut pas être évalué correctement.",
      ],
    };
  }

  const { averagePrice } = marketData;
  const delta = price - averagePrice;
  const percentDiff = (delta / averagePrice) * 100;

  let score: number;
  const reasons: string[] = [];

  if (Math.abs(percentDiff) <= 10) {
    score = 9;
    reasons.push("Le prix est proche du marché local, ce qui soutient un bon équilibre conversion et valeur perçue.");
  } else if (Math.abs(percentDiff) <= 20) {
    score = 7;
    reasons.push("Le prix s’écarte modérément du marché ; le positionnement peut rester pertinent selon la proposition de valeur.");
  } else if (Math.abs(percentDiff) <= 35) {
    score = 5.5;
    reasons.push("Le prix s’écarte nettement du marché ; il faut valider la cohérence avec la qualité perçue.");
  } else {
    score = 4;
    reasons.push("Le prix est très éloigné des comparables, ce qui augmente le risque de baisse de conversion.");
  }

  if (percentDiff > 0) {
    reasons.push(
      `L’annonce semble positionnée environ ${percentDiff.toFixed(
        0
      )}% au-dessus de la moyenne locale d’après les données disponibles.`
    );
  } else if (percentDiff < 0) {
    reasons.push(
      `L’annonce semble positionnée environ ${Math.abs(percentDiff).toFixed(
        0
      )}% en dessous de la moyenne locale d’après les données disponibles.`
    );
  } else {
    reasons.push("Le prix de l’annonce est aligné avec la moyenne locale actuelle.");
  }

  return {
    score: Math.max(0, Math.min(10, Number(score.toFixed(1)))),
    reasons,
  };
}

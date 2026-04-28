export type MarketConfidenceLevel = "high" | "medium" | "low";

export type MarketFallbackLevel = "local" | "limited_local" | "insufficient";

export type MarketReliabilityDerived = {
  marketConfidence: MarketConfidenceLevel;
  fallbackLevel: MarketFallbackLevel;
  reliabilityTitle: string;
  reliabilityBadge: string;
  reliabilityMessage: string;
};

/** Message produit non bloquant (Booking + villa + échantillon réduit). */
export const BOOKING_VILLA_WEAK_MARKET_HINT =
  "Les villas sont parfois moins bien catégorisées sur Booking dans certaines zones. Pour enrichir l’analyse marché, lancez aussi un audit Airbnb sur le même bien ou une zone proche.";

const WEAK_BOOKING_FALLBACK_RELIABILITY: MarketReliabilityDerived = {
  marketConfidence: "medium",
  fallbackLevel: "limited_local",
  reliabilityTitle: "Base locale limitée",
  reliabilityBadge: "Fiabilité partielle",
  reliabilityMessage:
    "Les comparables retenus sont proches géographiquement mais seulement partiellement comparables sur la typologie ou la capacité. Les estimations marché et le positionnement tarifaire restent indicatifs.",
};

/**
 * Dérivé uniquement du nombre réel de comparables retenus pour l’audit.
 * `null` / non fini → traité comme 0 (marché insuffisant).
 *
 * `weakBookingFallbackComparableCount` : comparables issus du fallback Booking « weak market »
 * (typologie/capacité relâchées) — plafonne la confiance (jamais `high`, message explicite).
 */
export function deriveMarketReliabilityFromComparableCount(
  comparableCount: number | null | undefined,
  weakBookingFallbackComparableCount?: number | null
): MarketReliabilityDerived {
  const n =
    comparableCount == null || !Number.isFinite(comparableCount)
      ? 0
      : Math.max(0, Math.floor(comparableCount));

  const weakN =
    weakBookingFallbackComparableCount == null ||
    !Number.isFinite(weakBookingFallbackComparableCount)
      ? 0
      : Math.max(0, Math.floor(weakBookingFallbackComparableCount));

  let base: MarketReliabilityDerived;

  if (n >= 3) {
    base = {
      marketConfidence: "high",
      fallbackLevel: "local",
      reliabilityTitle: "Marché exploitable",
      reliabilityBadge: "Bonne fiabilité",
      reliabilityMessage:
        "Base marché exploitable avec plusieurs comparables cohérents.",
    };
  } else if (n >= 1) {
    base = {
      marketConfidence: "medium",
      fallbackLevel: "limited_local",
      reliabilityTitle: "Lecture limitée",
      reliabilityBadge: "Fiabilité partielle",
      reliabilityMessage:
        "Analyse basée sur un échantillon local limité. Les recommandations restent utiles, mais les estimations marché doivent être lues avec prudence.",
    };
  } else {
    base = {
      marketConfidence: "low",
      fallbackLevel: "insufficient",
      reliabilityTitle: "Marché local peu exploitable",
      reliabilityBadge: "Fiabilité faible",
      reliabilityMessage:
        "Aucun comparable local suffisamment fiable n’a été trouvé pour cette lecture. L’audit reste utile pour la qualité de l’annonce, mais les estimations marché et pricing doivent rester indicatives.",
    };
  }

  if (weakN <= 0 || n < 1) {
    return base;
  }

  const capped: MarketReliabilityDerived = {
    marketConfidence: base.marketConfidence === "high" ? "medium" : base.marketConfidence,
    fallbackLevel: base.fallbackLevel === "insufficient" ? "insufficient" : "limited_local",
    reliabilityTitle: WEAK_BOOKING_FALLBACK_RELIABILITY.reliabilityTitle,
    reliabilityBadge: WEAK_BOOKING_FALLBACK_RELIABILITY.reliabilityBadge,
    reliabilityMessage: WEAK_BOOKING_FALLBACK_RELIABILITY.reliabilityMessage,
  };

  if (process.env.DEBUG_MARKET_PIPELINE === "true") {
    console.log(
      "[market][confidence-weak-fallback-cap]",
      JSON.stringify({
        comparableCount: n,
        weakFallbackCount: weakN,
        originalMarketConfidence: base.marketConfidence,
        finalMarketConfidence: capped.marketConfidence,
        originalFallbackLevel: base.fallbackLevel,
        finalFallbackLevel: capped.fallbackLevel,
      })
    );
  }

  return capped;
}

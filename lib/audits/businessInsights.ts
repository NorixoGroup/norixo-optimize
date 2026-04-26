export type PricingInsightStatus = "UNDERPRICED" | "OPTIMAL" | "OVERPRICED";

export type PricingBusinessInsight = {
  status: PricingInsightStatus;
  medianPrice: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  priceDelta: number;
  priceDeltaPercent: number;
  recommendedPrice: number;
  recommendedDelta: number;
  monthlyImpactEstimate: number;
  message: string;
  currency: string;
};

const NIGHTS_PER_MONTH_BASE = 20;

type CompetitorPriceRow = {
  price: number;
  currency: string;
};

function normalizeCurrency(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().toUpperCase();
  return t.length > 0 ? t : null;
}

function medianSorted(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

type PricingInsightDebugNullReason =
  | "invalid_target_price"
  | "insufficient_priced_competitors"
  | "mixed_competitor_currencies"
  | "target_currency_mismatch"
  | "invalid_median";

function logPricingInsightDebug(payload: {
  targetPrice: number | null | undefined;
  targetCurrency: string | null | undefined;
  competitorsCount: number;
  pricedCompetitorsCount: number;
  currencies: string[];
  nullReason: PricingInsightDebugNullReason;
}): void {
  if (process.env.DEBUG_BUSINESS_INSIGHTS !== "true") return;
  const targetPriceJson =
    typeof payload.targetPrice === "number" && Number.isFinite(payload.targetPrice)
      ? payload.targetPrice
      : payload.targetPrice == null
        ? null
        : String(payload.targetPrice);
  const line = JSON.stringify({
    targetPrice: targetPriceJson,
    targetCurrency: payload.targetCurrency ?? null,
    competitorsCount: payload.competitorsCount,
    pricedCompetitorsCount: payload.pricedCompetitorsCount,
    currencies: [...payload.currencies],
    nullReason: payload.nullReason,
  });
  console.log("[businessInsights][pricing-debug]", line);
}

function buildPricingMessage(input: {
  status: PricingInsightStatus;
  priceDeltaPercent: number;
  monthlyImpactEstimate: number;
  currency: string;
}): string {
  const pct = Math.round(input.priceDeltaPercent * 10) / 10;
  const impact = Math.round(input.monthlyImpactEstimate);
  const sym = input.currency === "EUR" ? "€" : input.currency;

  const impactPhrase = `Impact mensuel estimé (base ${NIGHTS_PER_MONTH_BASE} nuits) : environ ${impact > 0 ? "+" : ""}${impact} ${sym}.`;
  const pctPhrase = `Écart vs médiane du marché : environ ${pct > 0 ? "+" : ""}${pct} %.`;

  if (input.status === "UNDERPRICED") {
    return (
      "Votre prix est inférieur au marché. Vous pourriez augmenter votre tarif sans impacter durablement votre taux de réservation. " +
      pctPhrase +
      " " +
      impactPhrase
    );
  }
  if (input.status === "OVERPRICED") {
    return (
      "Votre prix est au-dessus du marché, ce qui peut limiter votre visibilité et votre taux de réservation. " +
      pctPhrase +
      " " +
      impactPhrase
    );
  }
  return (
    "Votre positionnement prix est aligné avec le marché. " + pctPhrase + " " + impactPhrase
  );
}

/**
 * Insights business dérivés uniquement des prix comparables déjà présents dans le moteur d’audit.
 * Retourne null si moins de 2 comparables avec prix + devise, si la devise n’est pas homogène,
 * ou si le prix cible est invalide.
 */
export function generatePricingInsight(input: {
  targetPrice: number | null | undefined;
  /** Devise cible ; si fournie, doit correspondre à celle des comparables retenus. */
  targetCurrency?: string | null;
  competitors: Array<{ price?: number | null; currency?: string | null }>;
}): PricingBusinessInsight | null {
  const competitorsCount = input.competitors?.length ?? 0;

  const rows: CompetitorPriceRow[] = [];
  for (const c of input.competitors ?? []) {
    try {
      const p = c.price;
      const cur = normalizeCurrency(c.currency ?? null);
      if (p == null || typeof p !== "number" || !Number.isFinite(p) || p <= 0 || !cur) {
        continue;
      }
      rows.push({ price: p, currency: cur });
    } catch {
      continue;
    }
  }

  const pricedCompetitorsCount = rows.length;
  const currenciesFromRows = [...new Set(rows.map((r) => r.currency))].sort();

  let targetPrice: number;
  try {
    const raw = input.targetPrice;
    if (raw == null || typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
      logPricingInsightDebug({
        targetPrice: input.targetPrice,
        targetCurrency: input.targetCurrency ?? null,
        competitorsCount,
        pricedCompetitorsCount,
        currencies: currenciesFromRows,
        nullReason: "invalid_target_price",
      });
      return null;
    }
    targetPrice = raw;
  } catch {
    logPricingInsightDebug({
      targetPrice: input.targetPrice,
      targetCurrency: input.targetCurrency ?? null,
      competitorsCount,
      pricedCompetitorsCount,
      currencies: currenciesFromRows,
      nullReason: "invalid_target_price",
    });
    return null;
  }

  if (rows.length < 2) {
    logPricingInsightDebug({
      targetPrice,
      targetCurrency: input.targetCurrency ?? null,
      competitorsCount,
      pricedCompetitorsCount,
      currencies: currenciesFromRows,
      nullReason: "insufficient_priced_competitors",
    });
    return null;
  }

  const currencies = new Set(rows.map((r) => r.currency));
  if (currencies.size !== 1) {
    logPricingInsightDebug({
      targetPrice,
      targetCurrency: input.targetCurrency ?? null,
      competitorsCount,
      pricedCompetitorsCount,
      currencies: currenciesFromRows,
      nullReason: "mixed_competitor_currencies",
    });
    return null;
  }
  const currency = [...currencies][0]!;

  const targetCur = normalizeCurrency(input.targetCurrency ?? null);
  if (targetCur != null && targetCur !== currency) {
    logPricingInsightDebug({
      targetPrice,
      targetCurrency: input.targetCurrency ?? null,
      competitorsCount,
      pricedCompetitorsCount,
      currencies: currenciesFromRows,
      nullReason: "target_currency_mismatch",
    });
    return null;
  }

  const prices = rows.map((r) => r.price).sort((a, b) => a - b);
  const medianPrice = medianSorted(prices);
  if (!Number.isFinite(medianPrice) || medianPrice <= 0) {
    logPricingInsightDebug({
      targetPrice,
      targetCurrency: input.targetCurrency ?? null,
      competitorsCount,
      pricedCompetitorsCount,
      currencies: currenciesFromRows,
      nullReason: "invalid_median",
    });
    return null;
  }

  const sum = prices.reduce((a, b) => a + b, 0);
  const averagePrice = sum / prices.length;
  const minPrice = prices[0]!;
  const maxPrice = prices[prices.length - 1]!;

  const priceDelta = targetPrice - medianPrice;
  const priceDeltaPercent = (priceDelta / medianPrice) * 100;

  let status: PricingInsightStatus;
  if (priceDeltaPercent <= -10) {
    status = "UNDERPRICED";
  } else if (priceDeltaPercent >= 10) {
    status = "OVERPRICED";
  } else {
    status = "OPTIMAL";
  }

  let recommendedPrice: number;
  if (status === "UNDERPRICED") {
    recommendedPrice = Math.max(targetPrice, medianPrice * 0.95);
  } else if (status === "OVERPRICED") {
    recommendedPrice = Math.min(targetPrice, medianPrice * 0.97);
  } else {
    recommendedPrice = targetPrice;
  }

  recommendedPrice = roundMoney(recommendedPrice);
  const recommendedDelta = roundMoney(recommendedPrice - targetPrice);
  const monthlyImpactEstimate = roundMoney((recommendedPrice - targetPrice) * NIGHTS_PER_MONTH_BASE);

  const message = buildPricingMessage({
    status,
    priceDeltaPercent,
    monthlyImpactEstimate,
    currency,
  });

  return {
    status,
    medianPrice: roundMoney(medianPrice),
    averagePrice: roundMoney(averagePrice),
    minPrice: roundMoney(minPrice),
    maxPrice: roundMoney(maxPrice),
    priceDelta: roundMoney(priceDelta),
    priceDeltaPercent: roundMoney(priceDeltaPercent),
    recommendedPrice,
    recommendedDelta,
    monthlyImpactEstimate,
    message,
    currency,
  };
}

/*
 * Exemples de sortie cohérents (générés avec la même logique que ci-dessus) :
 *
 * UNDERPRICED (targetPrice 80, médiane marché 100, comparables EUR homogènes) :
 * {
 *   "status": "UNDERPRICED",
 *   "medianPrice": 100,
 *   "averagePrice": 100,
 *   "minPrice": 100,
 *   "maxPrice": 100,
 *   "priceDelta": -20,
 *   "priceDeltaPercent": -20,
 *   "recommendedPrice": 95,
 *   "recommendedDelta": 15,
 *   "monthlyImpactEstimate": 300,
 *   "message": "Votre prix est inférieur au marché. ... Impact mensuel estimé ... : environ +300 €.",
 *   "currency": "EUR"
 * }
 *
 * OVERPRICED (targetPrice 120, médiane 100) :
 * {
 *   "status": "OVERPRICED",
 *   "medianPrice": 100,
 *   "averagePrice": 100,
 *   "minPrice": 100,
 *   "maxPrice": 100,
 *   "priceDelta": 20,
 *   "priceDeltaPercent": 20,
 *   "recommendedPrice": 97,
 *   "recommendedDelta": -23,
 *   "monthlyImpactEstimate": -460,
 *   "message": "Votre prix est au-dessus du marché ... environ -460 €.",
 *   "currency": "EUR"
 * }
 *
 * OPTIMAL (targetPrice 98, médiane 100, écart dans la zone -10 % / +10 %) :
 * {
 *   "status": "OPTIMAL",
 *   "medianPrice": 100,
 *   "averagePrice": 100,
 *   "minPrice": 100,
 *   "maxPrice": 100,
 *   "priceDelta": -2,
 *   "priceDeltaPercent": -2,
 *   "recommendedPrice": 98,
 *   "recommendedDelta": 0,
 *   "monthlyImpactEstimate": 0,
 *   "message": "Votre positionnement prix est aligné avec le marché. ... environ 0 €.",
 *   "currency": "EUR"
 * }
 */

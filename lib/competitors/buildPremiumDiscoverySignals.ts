import type { ExtractedListing } from "@/lib/extractors/types";
import { isPremiumRefinementMode, type RefinementInput } from "./scoreRefinedComparable";
import { getNormalizedComparableType } from "./filterComparableListings";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * softMinPrice = 60 % du prix cible.
 * DISCOVERY HINT ONLY — jamais un filtre strict.
 * Certains marchés ont une offre limitée : un plancher prix trop agressif
 * retournerait zéro résultat. Les callers doivent traiter ce signal
 * comme un indicateur de down-ranking, pas de rejet.
 */
const SOFT_MIN_PRICE_RATIO = 0.6;

/** Attributs → tokens texte injectables dans les queries SERP (uniquement les différenciants premium). */
const ATTRIBUTE_QUERY_KEYWORDS: Record<string, string[]> = {
  private_pool: ["piscine", "pool", "avec piscine"],
  beachfront: ["plage", "beach", "beachfront"],
  jacuzzi: ["jacuzzi"],
  sea_view: ["vue mer", "sea view"],
};

/** Attributs → tokens slug pour boost de ranking (pas de rejet si absent). */
const ATTRIBUTE_BOOST_SIGNALS: Record<string, string[]> = {
  private_pool: ["piscine", "pool", "private-pool"],
  sea_view: ["sea-view", "vue-mer", "ocean-view"],
  beachfront: ["plage", "beach", "beachfront"],
  jacuzzi: ["jacuzzi", "hot-tub"],
  gym: ["gym", "fitness"],
  terrace: ["terrasse", "terrace"],
  concierge: ["concierge", "butler"],
  parking: ["parking"],
  ac: ["clim", "climatisation"],
};

/**
 * Tokens slug qui signalent une compatibilité de type avec la cible.
 * Soft-gate : la présence d'au moins un token est un signal positif.
 * Jamais utilisé comme rejet hard — un slug non standard peut quand même
 * être un comparable valide.
 */
const REQUIRED_SIGNALS_BY_TYPE: Record<string, string[]> = {
  villa_like: ["villa", "maison", "house", "home", "riad", "dar"],
  house_like: ["maison", "house", "home"],
  apartment_like: ["appartement", "apartment", "flat", "appart"],
  studio_like: ["studio"],
  room_like: ["chambre", "room", "suite"],
  hotel_like: ["hotel", "hostel", "guesthouse"],
  riad_like: ["riad", "dar"],
};

// ─── Public types ─────────────────────────────────────────────────────────────

export type PremiumDiscoverySignals = {
  /** Même gate que isPremiumRefinementMode : villa_like, tier luxe, ou prix ≥ 250. */
  premiumMode: boolean;

  /**
   * Tokens texte additionnels à injecter dans les queries SERP.
   * Exemples : "piscine", "4 chambres", "avec piscine".
   * Toujours additifs — les queries originales doivent être conservées.
   */
  queryKeywords: string[];

  /**
   * Prix plancher indicatif = 60 % du prix cible.
   * DISCOVERY HINT ONLY — jamais un filtre strict.
   * Airbnb ignore price_min sans checkin/checkout ; Booking ne supporte pas de filtre prix URL.
   * À utiliser uniquement pour du down-ranking ou des heuristiques futures côté caller.
   */
  softMinPrice: number | null;

  /** Capacité minimale — refinement.guests ou target.capacity/guestCapacity. */
  minGuests: number | null;

  /** Chambres minimales — refinement.bedrooms ou target.bedrooms/bedroomCount. */
  minBedrooms: number | null;

  /**
   * Tokens slug qui devraient apparaître dans les URLs candidates.
   * La présence de n'importe lequel est un signal positif (OR, pas AND).
   * Ne jamais rejeter hard si aucun token n'est présent — slug non standard possible.
   */
  requiredSignals: string[];

  /**
   * Tokens slug issus de refinement.attributes pour booster le ranking.
   * Présence = bonus, absence = neutre.
   */
  boostSignals: string[];
};

// ─── Private helpers ──────────────────────────────────────────────────────────

function parsePositiveInt(value: string | null | undefined): number | null {
  if (!value || value.endsWith("+")) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safePositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Dérive les signaux de discovery premium à partir de la cible et du refinement.
 * Fonction pure — aucun side-effect, aucun appel réseau, aucun Playwright.
 */
export function buildPremiumDiscoverySignals(
  target: ExtractedListing,
  refinement: RefinementInput
): PremiumDiscoverySignals {
  const premiumMode = isPremiumRefinementMode(target, refinement);
  const normalizedType = getNormalizedComparableType(target);
  const attrs = Array.isArray(refinement.attributes) ? refinement.attributes : [];

  // ── minGuests / minBedrooms ───────────────────────────────────────────────
  const minGuests =
    parsePositiveInt(refinement.guests) ??
    safePositiveInt(target.capacity ?? target.guestCapacity);

  const minBedrooms =
    parsePositiveInt(refinement.bedrooms) ??
    safePositiveInt(target.bedrooms ?? target.bedroomCount);

  // ── softMinPrice — hint seulement, 60 % du prix cible ────────────────────
  const targetPrice =
    typeof target.price === "number" && Number.isFinite(target.price) && target.price > 0
      ? target.price
      : null;
  // softMinPrice = discovery hint, never hard filter.
  const softMinPrice =
    premiumMode && targetPrice !== null
      ? Math.floor(targetPrice * SOFT_MIN_PRICE_RATIO)
      : null;

  // ── queryKeywords ─────────────────────────────────────────────────────────
  const queryKeywords: string[] = [];

  for (const attr of attrs) {
    const kws = ATTRIBUTE_QUERY_KEYWORDS[attr];
    if (!kws) continue;
    for (const kw of kws) {
      if (!queryKeywords.includes(kw)) queryKeywords.push(kw);
    }
  }

  if (minBedrooms !== null && minBedrooms >= 2) {
    const fr = `${minBedrooms} chambres`;
    const en = `${minBedrooms} bedroom`;
    if (!queryKeywords.includes(fr)) queryKeywords.push(fr);
    if (!queryKeywords.includes(en)) queryKeywords.push(en);
  }

  // ── requiredSignals — soft type-gate ─────────────────────────────────────
  const requiredSignals: string[] = REQUIRED_SIGNALS_BY_TYPE[normalizedType] ?? [];

  // ── boostSignals ──────────────────────────────────────────────────────────
  const boostSignals: string[] = [];
  for (const attr of attrs) {
    const tokens = ATTRIBUTE_BOOST_SIGNALS[attr];
    if (!tokens) continue;
    for (const t of tokens) {
      if (!boostSignals.includes(t)) boostSignals.push(t);
    }
  }

  return {
    premiumMode,
    queryKeywords,
    softMinPrice,
    minGuests,
    minBedrooms,
    requiredSignals,
    boostSignals,
  };
}

// ─── URL / query helpers (appelés uniquement depuis refine-market, jamais depuis le pipeline) ─

/**
 * Ajoute les params premium à une URL Airbnb /homes.
 *
 * Limitations connues :
 * - price_min est ignoré par Airbnb sans checkin/checkout ; inclus comme hint pour usage futur.
 * - min_bedrooms / adults sont best-effort selon la version de l'UI Airbnb.
 * - En cas d'URL malformée, retourne l'URL originale inchangée.
 */
export function applyPremiumSignalsToAirbnbUrl(
  baseUrl: string,
  signals: PremiumDiscoverySignals
): string {
  if (!signals.premiumMode) return baseUrl;

  try {
    const url = new URL(baseUrl);
    if (signals.minGuests !== null) {
      url.searchParams.set("adults", String(signals.minGuests));
    }
    if (signals.minBedrooms !== null) {
      url.searchParams.set("min_bedrooms", String(signals.minBedrooms));
    }
    // softMinPrice = discovery hint, never hard filter.
    // Airbnb ignore ce param sans date — inclus pour callers futurs date-aware.
    if (signals.softMinPrice !== null) {
      url.searchParams.set("price_min", String(signals.softMinPrice));
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Retourne une liste de queries enrichie avec les keywords premium en tête.
 * Les queries originales sont TOUJOURS conservées — les variants premium sont additionnels.
 * Dédoublonnage par token normalisé.
 */
export function applyPremiumSignalsToBookingQueries(
  queries: string[],
  signals: PremiumDiscoverySignals
): string[] {
  if (!signals.premiumMode || signals.queryKeywords.length === 0) return queries;

  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const enriched: string[] = [];
  const seen = new Set<string>();

  // Prepend keyword-enriched variants ancrant sur la première query (city anchor)
  const cityAnchor = queries[0] ?? "";
  if (cityAnchor) {
    for (const kw of signals.queryKeywords) {
      const enrichedQuery = `${kw} ${cityAnchor}`.trim();
      const k = normalize(enrichedQuery);
      if (k && !seen.has(k)) {
        seen.add(k);
        enriched.push(enrichedQuery);
      }
    }
  }

  // Append toutes les queries originales (preserve existing behavior)
  for (const q of queries) {
    const k = normalize(q);
    if (k && !seen.has(k)) {
      seen.add(k);
      enriched.push(q);
    }
  }

  return enriched;
}

import type { ExtractedListing } from "@/lib/extractors/types";
import { getNormalizedComparableType } from "./filterComparableListings";

// ─── Constants ────────────────────────────────────────────────────────────────

const LUXURY_MARKET_TIERS = new Set(["premium", "luxe_experientiel", "ultra_luxe"]);

/** Threshold (nightly price) above which premium scoring activates automatically. */
const PREMIUM_PRICE_AUTO_THRESHOLD = 250;

/** ratio = comp_price / target_price */
const PRICE_RATIO = {
  tightLow: 0.8,
  tightHigh: 1.2,
  closeLow: 0.6,
  closeHigh: 1.5,
  broadLow: 0.4,
  broadHigh: 2.5,
  severelyLow: 0.25,
} as const;

/** Attribute keyword map: refinement value → tokens to search in amenities/title/description */
const ATTRIBUTE_TOKENS: Record<string, string[]> = {
  private_pool: ["pool", "piscine", "private pool", "piscine privée", "piscine privee"],
  sea_view: ["sea view", "ocean view", "vue mer", "vue ocean", "vue sur mer", "ocean", "sea"],
  beachfront: ["beachfront", "beach front", "plage", "front de mer", "bord de mer"],
  jacuzzi: ["jacuzzi", "hot tub", "whirlpool", "spa", "balnéo", "balneo"],
  parking: ["parking", "garage", "car park", "stationnement"],
  ac: ["air conditioning", "climatisation", "clim", "a/c", "ac"],
  wifi: ["wifi", "wi-fi", "wireless", "internet"],
  gym: ["gym", "fitness", "salle de sport", "workout"],
  terrace: ["terrace", "terrasse", "balcon", "balcony", "rooftop"],
  concierge: ["concierge", "butler", "majordome", "personnel", "staff", "service"],
};

/** Score weight per attribute when matched in comparable. Capped at 20 total. */
const ATTRIBUTE_WEIGHTS: Record<string, number> = {
  private_pool: 6,
  sea_view: 4,
  beachfront: 4,
  jacuzzi: 3,
  gym: 3,
  concierge: 3,
  parking: 2,
  ac: 2,
  wifi: 2,
  terrace: 2,
};

// ─── Public types ─────────────────────────────────────────────────────────────

export type RefinementInput = {
  propType?: string | null;
  bedrooms?: string | null;
  bathrooms?: string | null;
  guests?: string | null;
  beds?: string | null;
  minStay?: string | null;
  /** "standard" | "haut_standing" | "premium" | "luxe_experientiel" | "ultra_luxe" */
  marketTier?: string | null;
  attributes?: string[];
};

export type RefinedComparableScoreBreakdown = {
  /** Clamped 0–100. */
  total: number;
  /** 0–25. Strong negative penalty in premium mode when type is incompatible. */
  typeCompatibility: number;
  /** 0–15. Guest capacity proximity. */
  capacityMatch: number;
  /** 0–15. Bedroom count proximity. */
  bedroomMatch: number;
  /** −30 to +25. Negative means price gap penalty. */
  priceSegment: number;
  /** 0–20. Bonus for requested attributes found in comparable. */
  amenitiesMatch: number;
  /** True when premium scoring rules are active. */
  premiumMode: boolean;
  /** Human-readable trace for debugging. */
  notes: string[];
};

export type RefinedComparableResult = {
  comparable: ExtractedListing;
  score: number;
  breakdown: RefinedComparableScoreBreakdown;
};

// ─── Private helpers ──────────────────────────────────────────────────────────

function safeNum(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function normalizeAmenityText(listing: ExtractedListing): string {
  const parts: string[] = [];
  if (Array.isArray(listing.amenities)) {
    parts.push(...listing.amenities.map((a) => (typeof a === "string" ? a : "")));
  }
  if (typeof listing.title === "string") parts.push(listing.title);
  if (typeof listing.description === "string") parts.push(listing.description.slice(0, 800));
  return parts.join(" ").toLowerCase();
}

function detectAttributeInListing(attribute: string, haystack: string): boolean {
  const tokens = ATTRIBUTE_TOKENS[attribute];
  if (!tokens) return false;
  return tokens.some((token) => haystack.includes(token));
}

// ─── Premium mode gate ────────────────────────────────────────────────────────

/**
 * Premium scoring activates when ANY of:
 *   - target normalized type is villa_like
 *   - refinement.marketTier is in {premium, luxe_experientiel, ultra_luxe}
 *   - target.price >= 250 (nightly)
 */
export function isPremiumRefinementMode(
  target: ExtractedListing,
  refinement: RefinementInput
): boolean {
  if (getNormalizedComparableType(target) === "villa_like") return true;
  if (refinement.marketTier && LUXURY_MARKET_TIERS.has(refinement.marketTier)) return true;
  const targetPrice = safeNum(target.price);
  if (targetPrice !== null && targetPrice >= PREMIUM_PRICE_AUTO_THRESHOLD) return true;
  return false;
}

// ─── Score dimensions ─────────────────────────────────────────────────────────

function scoreTypeCompatibility(
  targetType: string,
  comparableType: string,
  premiumMode: boolean,
  notes: string[]
): number {
  if (targetType === comparableType) {
    notes.push(`type_match: +25 (${comparableType})`);
    return 25;
  }

  // Premium: villa_like target vs incompatible type → heavy penalty applied as 0 score
  if (premiumMode && targetType === "villa_like") {
    if (comparableType === "apartment_like") {
      notes.push("type_mismatch_premium: villa vs apartment → 0");
      return 0;
    }
    if (comparableType === "hotel_like" || comparableType === "room_like") {
      notes.push("type_mismatch_premium: villa vs hotel/room → 0");
      return 0;
    }
  }

  // house_like ↔ villa_like are close
  const villaLike = new Set(["villa_like", "house_like"]);
  if (villaLike.has(targetType) && villaLike.has(comparableType)) {
    notes.push("type_near_match: villa/house family → +18");
    return 18;
  }

  // apartment ↔ studio are close
  const aprtLike = new Set(["apartment_like", "studio_like"]);
  if (aprtLike.has(targetType) && aprtLike.has(comparableType)) {
    notes.push("type_near_match: apartment/studio family → +18");
    return 18;
  }

  // Mild type mismatch (non-premium)
  notes.push(`type_mismatch: ${targetType} vs ${comparableType} → +8`);
  return 8;
}

function scoreCapacityMatch(
  targetCapacity: number | null,
  comparableCapacity: number | null,
  notes: string[]
): number {
  if (targetCapacity === null || comparableCapacity === null) {
    notes.push("capacity: unknown → +0");
    return 0;
  }
  const diff = Math.abs(targetCapacity - comparableCapacity);
  if (diff === 0) { notes.push(`capacity: exact match (${targetCapacity}) → +15`); return 15; }
  if (diff <= 2) { notes.push(`capacity: diff=${diff} → +12`); return 12; }
  if (diff <= 4) { notes.push(`capacity: diff=${diff} → +8`); return 8; }
  if (diff <= 6) { notes.push(`capacity: diff=${diff} → +4`); return 4; }
  notes.push(`capacity: diff=${diff} → +0`);
  return 0;
}

function scoreBedroomMatch(
  targetBedrooms: number | null,
  comparableBedrooms: number | null,
  notes: string[]
): number {
  if (targetBedrooms === null || comparableBedrooms === null) {
    notes.push("bedrooms: unknown → +0");
    return 0;
  }
  const diff = Math.abs(targetBedrooms - comparableBedrooms);
  if (diff === 0) { notes.push(`bedrooms: exact match (${targetBedrooms}) → +15`); return 15; }
  if (diff === 1) { notes.push(`bedrooms: diff=1 → +10`); return 10; }
  if (diff === 2) { notes.push(`bedrooms: diff=2 → +5`); return 5; }
  notes.push(`bedrooms: diff=${diff} → +0`);
  return 0;
}

function scorePriceSegment(
  targetPrice: number | null,
  comparablePrice: number | null,
  premiumMode: boolean,
  notes: string[]
): number {
  if (targetPrice === null || comparablePrice === null) {
    notes.push("price: unknown → +0");
    return 0;
  }

  const ratio = comparablePrice / targetPrice;
  notes.push(`price: ratio=${ratio.toFixed(2)} (comp=${comparablePrice} / target=${targetPrice})`);

  // Severely underpriced comparable vs premium target
  if (premiumMode && ratio < PRICE_RATIO.severelyLow) {
    notes.push("price: severely underpriced vs premium target → −30");
    return -30;
  }
  if (premiumMode && ratio < PRICE_RATIO.broadLow) {
    notes.push("price: underpriced vs premium target → −20");
    return -20;
  }

  // Non-premium penalty
  if (!premiumMode && ratio < PRICE_RATIO.broadLow) {
    notes.push("price: ratio < 0.4 → −10");
    return -10;
  }

  // Overpriced comparable
  if (ratio > PRICE_RATIO.broadHigh) {
    notes.push("price: ratio > 2.5 → −10");
    return -10;
  }

  // Positive scoring bands
  if (ratio >= PRICE_RATIO.tightLow && ratio <= PRICE_RATIO.tightHigh) {
    notes.push("price: tight range [0.8–1.2] → +25");
    return 25;
  }
  if (ratio >= PRICE_RATIO.closeLow && ratio <= PRICE_RATIO.closeHigh) {
    notes.push("price: close range [0.6–1.5] → +18");
    return 18;
  }
  // Broad range [0.4–2.5]
  notes.push("price: broad range [0.4–2.5] → +10");
  return 10;
}

function scoreAmenitiesMatch(
  comparable: ExtractedListing,
  refinement: RefinementInput,
  notes: string[]
): number {
  const attrs = refinement.attributes;
  if (!Array.isArray(attrs) || attrs.length === 0) return 0;

  const haystack = normalizeAmenityText(comparable);
  let score = 0;
  const matched: string[] = [];

  for (const attr of attrs) {
    if (detectAttributeInListing(attr, haystack)) {
      const weight = ATTRIBUTE_WEIGHTS[attr] ?? 1;
      score += weight;
      matched.push(attr);
    }
  }

  const capped = Math.min(score, 20);
  if (matched.length > 0) {
    notes.push(`amenities: matched=[${matched.join(",")}] raw=${score} capped=${capped}`);
  } else {
    notes.push("amenities: no match → +0");
  }
  return capped;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function scoreComparableForRefinement(
  target: ExtractedListing,
  comparable: ExtractedListing,
  refinement: RefinementInput
): RefinedComparableScoreBreakdown {
  const notes: string[] = [];
  const premiumMode = isPremiumRefinementMode(target, refinement);
  if (premiumMode) notes.push("mode: premium");

  const targetType = getNormalizedComparableType(target);
  const comparableType = getNormalizedComparableType(comparable);

  const targetCapacity = safeNum(target.capacity ?? target.guestCapacity);
  const comparableCapacity = safeNum(comparable.capacity ?? comparable.guestCapacity);

  const targetBedrooms = safeNum(target.bedrooms ?? target.bedroomCount);
  const comparableBedrooms = safeNum(comparable.bedrooms ?? comparable.bedroomCount);

  const targetPrice = safeNum(target.price);
  const comparablePrice = safeNum(comparable.price);

  const typeCompatibility = scoreTypeCompatibility(targetType, comparableType, premiumMode, notes);
  const capacityMatch = scoreCapacityMatch(targetCapacity, comparableCapacity, notes);
  const bedroomMatch = scoreBedroomMatch(targetBedrooms, comparableBedrooms, notes);
  const priceSegment = scorePriceSegment(targetPrice, comparablePrice, premiumMode, notes);
  const amenitiesMatch = scoreAmenitiesMatch(comparable, refinement, notes);

  const rawTotal = typeCompatibility + capacityMatch + bedroomMatch + priceSegment + amenitiesMatch;
  const total = Math.max(0, Math.min(100, rawTotal));

  notes.push(`total: raw=${rawTotal} clamped=${total}`);

  return {
    total,
    typeCompatibility,
    capacityMatch,
    bedroomMatch,
    priceSegment,
    amenitiesMatch,
    premiumMode,
    notes,
  };
}

/**
 * Scores and ranks all comparables by descending score.
 * Never rejects — all comparables are returned, even with score 0.
 * The caller decides the cutoff.
 */
export function rankRefinedComparables(
  comparables: ExtractedListing[],
  target: ExtractedListing,
  refinement: RefinementInput
): RefinedComparableResult[] {
  const results: RefinedComparableResult[] = comparables.map((comparable) => {
    const breakdown = scoreComparableForRefinement(target, comparable, refinement);
    return { comparable, score: breakdown.total, breakdown };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

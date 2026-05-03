import { extractListing } from "@/lib/extractors";
import { bookingUrlHasStayDates, buildBookingUrlWithDates, cleanBookingCanonicalUrl } from "@/lib/extractors/booking-url";
import type { ExtractedListing } from "@/lib/extractors/types";
import { chromium, type Browser, type Page } from "playwright-core";
import { searchAgodaCompetitorCandidates } from "./agoda-search";
import type { SearchCompetitorsInput, SearchCompetitorsResult } from "./types";
import { searchAirbnbCompetitorCandidates } from "./airbnb-search";
import {
  inferBookingCandidateTypeFromUrl,
  searchBookingCompetitorCandidates,
} from "./booking-search";
import { searchVrboCompetitorCandidates } from "./vrbo-search";
import {
  evaluateComparableCandidates,
  getNormalizedComparableType,
  guessListingCity,
  guessListingLanguage,
  guessListingNeighborhood,
} from "./filterComparableListings";
import { countEvaluateRejectionReasons, logMarketPipelineStage } from "./marketPipelineDebug";
import { auditPerfLog } from "@/lib/audits/auditPerfLog";
import {
  mapPropertyTypeOverrideToListingPropertyType,
  parsePropertyTypeOverride,
} from "@/lib/listings/propertyTypeOverrideOptions";

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_RADIUS_KM = 1;
const MAX_MARKET_COMPARABLES = 5;
const AIRBNB_COMPETITOR_PRICE_ATTEMPT_LIMIT = 3;
const AIRBNB_COMPETITOR_PRICE_NIGHTS = 5;
const AIRBNB_COMPETITOR_PRICE_TIMEOUT_MS = 15000;
const BOOKING_CANDIDATE_EXTRACTION_CAP = Number.parseInt(
  process.env.BOOKING_CANDIDATE_EXTRACTION_CAP ?? "5",
  10
);
/** Plafond URLs comparables (discovery) pour limiter les appels inutiles. */
const MARKET_DISCOVERY_URL_CAP = 12;
/** Arrêt de la boucle Booking après N rejets géo post-extraction consécutifs. */
const BOOKING_CONSECUTIVE_GEO_REJECT_LIMIT = 5;
const BOOKING_PRICED_COMPARABLE_STOP_TARGET = Number.parseInt(
  process.env.BOOKING_PRICED_COMPARABLE_STOP_TARGET ?? "3",
  10
);
/** URLs comparables Airbnb max. à découvrir si Booking ne remplit pas le quota (cible Airbnb uniquement). */
const AIRBNB_FALLBACK_COMPETITOR_DISCOVERY_MAX = Number.parseInt(
  process.env.AIRBNB_FALLBACK_COMPETITOR_DISCOVERY_MAX ?? "4",
  10
);
const DEBUG_BOOKING_PIPELINE =
  process.env.DEBUG_BOOKING_PIPELINE === "true" || process.env.DEBUG_GUEST_AUDIT === "true";
const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";
const DEBUG_MARKET_PIPELINE = process.env.DEBUG_MARKET_PIPELINE === "true";
/** Plafond perf : comparables marché utiles (extractions + filtre final). */
const MARKET_PIPELINE_MAX_COMPARABLES = 3;
const COMPETITOR_EXTRACT_CONCURRENCY = 3;
const COMPETITOR_BATCH_SIZE = 3;
const MAX_BOOKING_EXTRACTION_ATTEMPTS = 6;
/** Villa + Maroc : plus de tentatives d’extraction pour compenser les rejets evaluate (prix, etc.). */
const BOOKING_VILLA_MOROCCO_MAX_EXTRACTION_ATTEMPTS = 10;
/**
 * Comparables Booking : garde brute max en boucle d’extraction (avant slice final comparables).
 * Villa + Maroc uniquement (`bookingVillaMoroccoDiscoveryBoost`).
 */
const BOOKING_VILLA_MOROCCO_EXTRACTION_RAW_KEEP_CEILING = 10;
/** Plafond affichage / merge comparables pipeline pour villa Maroc (au‑delà de `MARKET_PIPELINE_MAX_COMPARABLES`). */
const BOOKING_VILLA_MOROCCO_PIPELINE_MAX_COMPARABLES = 6;
/** Discovery URLs min. pour villa Maroc Booking (dans la cap globale). */
const BOOKING_VILLA_MOROCCO_DISCOVERY_FETCH_MIN = 10;
const MAX_FALLBACK_EXTRACTION_ATTEMPTS = 6;

async function runLimitedConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const concurrency = Math.max(1, Math.min(limit, items.length));

  async function pump() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) break;
      results[i] = await worker(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => pump()));
  return results;
}

const WEAK_CITY_TOKENS = new Set([
  "cozy",
  "skyview",
  "golden",
  "modern",
  "stylish",
  "beautiful",
  "spacious",
  "charming",
  "central",
  "downtown",
  "view",
  "suite",
  "apartment",
  "appartement",
  "studio",
  "villa",
  "house",
  "hotel",
  "home",
  "near",
  "city",
  "center",
  "centre",
]);

/** Mots d’annonces Booking (titre/libellé slug) qui ne doivent jamais servir seuls de ville marché. */
const GENERIC_LODGING_MARKET_CITY_REJECT = new Set([
  ...WEAK_CITY_TOKENS,
  "terrasse",
  "piscine",
  "calme",
  "chambres",
  "chambre",
  "maison",
  "riad",
  "luxe",
  "large",
  "avec",
  "proche",
]);

/** Villes MA détectées dans les slugs `/hotel/ma/....html` (ordre décroissant de longueur pour priorité longest-match). */
const MOROCCO_BOOKING_SLUG_KNOWN_CITIES = [
  "chefchaouen",
  "ouarzazate",
  "essaouira",
  "casablanca",
  "marrakesh",
  "marrakech",
  "el jadida",
  "meknes",
  "rabat",
  "agadir",
  "tangier",
  "tanger",
  "tetouan",
  "fes",
  "fez",
  "safi",
].sort((a, b) => b.length - a.length);

function slugStripBookingLanguageSuffix(seg: string): string {
  return seg.replace(/\.(fr|en|de|com|es|it|nl|pt|pl|ca)$/i, "");
}

function escapeRegExpChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canonicalizeMoroccoSlugCityMatch(matched: string): string {
  const k = matched.toLowerCase().replace(/\s+/g, " ").trim();
  if (k === "marrakesh") return "marrakech";
  if (k === "tangier") return "tanger";
  if (k === "fez") return "fes";
  return k;
}

/** Extrait une ville canonique depuis le dernier segment d’URL Booking Maroc (`...-marrakech.fr.html`). */
export function extractMoroccoKnownCityFromBookingMaSlug(urlRaw: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(urlRaw.trim()).pathname);
  } catch {
    return null;
  }
  if (!/\/hotel\/ma\//i.test(pathname)) return null;
  const file = pathname.match(/\/hotel\/ma\/([^/]+)\.html$/i)?.[1];
  if (!file) return null;
  const base = slugStripBookingLanguageSuffix(file);
  const needle = base
    .replace(/-/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!needle) return null;

  for (const canon of MOROCCO_BOOKING_SLUG_KNOWN_CITIES) {
    const spaced = canon.trim();
    const inner = spaced.split(/\s+/).map(escapeRegExpChars).join("\\s+");
    const re = new RegExp(`\\b(?:${inner})\\b`, "i");
    if (re.test(needle)) {
      return canonicalizeMoroccoSlugCityMatch(spaced);
    }
  }
  return null;
}

/** Villes très courtes acceptées en libellé (ex. « Fès » → fes après normalisation). */
const SHORT_MARKET_CITY_EXCEPTIONS = new Set(["fes"]);

/** Rejet combiné WEAK_TOKENS + mots équipements / typo logement hors ville. */
function isRejectedStandaloneMarketCityGuess(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  const normalized = normalizeMarketText(value);
  if (!normalized) return true;
  if (GENERIC_LODGING_MARKET_CITY_REJECT.has(normalized)) return true;
  if (normalized.length < 4 && !SHORT_MARKET_CITY_EXCEPTIONS.has(normalized)) return true;
  return false;
}

type CompetitorPropertyKind =
  | "studio"
  | "apartment"
  | "villa"
  | "riad"
  | "house"
  | "hotel"
  | "room"
  | "unknown";

/** Priorité `target.propertyType` (ex. override manuel) pour filterCompetitorsByPropertyAndStructure. */
function targetKindFromListingPropertyType(
  propertyType: string | null | undefined
): CompetitorPropertyKind | null {
  if (typeof propertyType !== "string") return null;
  const t = propertyType.trim().toLowerCase();
  if (!t) return null;
  if (t === "studio") return "apartment";
  if (t === "appartement" || t === "apartment" || t === "flat") return "apartment";
  if (t === "villa") return "villa";
  if (t === "maison" || t === "house" || t === "home") return "villa";
  if (t === "riad" || t === "dar") return "riad";
  if (t === "chambre" || t === "room") return "room";
  if (t === "hotel" || t === "hôtel" || t === "h\u00f4tel") return "hotel";
  return null;
}

function safeListingNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function detectPropertyTypeFromListingText(
  title: string,
  description: string
): CompetitorPropertyKind {
  const text = `${title}\n${description}`.toLowerCase();

  if (/\bstudio\b/i.test(text)) return "studio";
  if (/\briad\b/i.test(text)) return "riad";
  if (/\b(apartment|appartement|flat)\b/i.test(text)) return "apartment";
  if (/\bvilla\b/i.test(text)) return "villa";
  if (/\b(maison|house)\b/i.test(text)) return "house";
  if (/\b(hotel|hostel|resort)\b/i.test(text)) return "hotel";

  return "unknown";
}

function isPropertyTypeComparable(
  target: CompetitorPropertyKind,
  candidate: CompetitorPropertyKind
): boolean {
  if (target === "unknown" || candidate === "unknown") return true;

  if (target === "apartment") {
    if (candidate === "villa" || candidate === "riad" || candidate === "house") return false;
    return candidate === "apartment" || candidate === "studio";
  }
  if (target === "villa") {
    if (candidate === "studio" || candidate === "apartment" || candidate === "hotel" || candidate === "room") {
      return false;
    }
    return candidate === "villa" || candidate === "riad" || candidate === "house";
  }
  if (target === "room") {
    if (candidate === "villa" || candidate === "hotel") return false;
    return candidate === "room";
  }

  return target === candidate;
}

function isBedroomOrCapacityWithinOne(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const tb = safeListingNumber(target.bedrooms ?? target.bedroomCount);
  const cb = safeListingNumber(candidate.bedrooms ?? candidate.bedroomCount);
  if (tb !== null && cb !== null) {
    return Math.abs(tb - cb) <= 1;
  }

  const tc = safeListingNumber(target.capacity ?? target.guestCapacity);
  const cc = safeListingNumber(candidate.capacity ?? candidate.guestCapacity);
  if (tc !== null && cc !== null) {
    return Math.abs(tc - cc) <= 1;
  }

  return true;
}

/** Extraction Booking uniquement : assouplit structure_too_far pour villa_like quand Booking sous-déclare les chambres mais le type/geo/prix sont plausibles. */
function isBookingVillaStructureSoftKeep(
  comparableTarget: ExtractedListing,
  listing: ExtractedListing,
  targetCity: string | null
): boolean {
  const marketTargetIsBooking =
    getMarketComparisonPlatform(comparableTarget.platform) === "booking";
  const targetTypeOk = getNormalizedComparableType(comparableTarget) === "villa_like";
  const listingPlatformOk = String(listing.platform ?? "").toLowerCase() === "booking";

  const pr = listing.price;
  const priceOk = typeof pr === "number" && Number.isFinite(pr) && pr > 0;

  const geoOk = isGeoCompatible(listing, targetCity);

  const ptRaw = (listing.propertyType ?? "").toLowerCase();
  const ptNorm = normalizeMarketText(listing.propertyType ?? "").toLowerCase();
  const normalizedComparable = getNormalizedComparableType(listing).toLowerCase();
  const hay = `${ptRaw} ${ptNorm} ${normalizedComparable}`;
  const typeSignalOk = [
    "villa",
    "maison",
    "house",
    "riad",
    "ryad",
    "dar",
    "guesthouse",
    "hotel",
  ].some((token) => hay.includes(token));

  const ok =
    marketTargetIsBooking &&
    targetTypeOk &&
    listingPlatformOk &&
    priceOk &&
    geoOk &&
    typeSignalOk;

  if (
    !ok &&
    DEBUG_MARKET_PIPELINE &&
    marketTargetIsBooking &&
    targetTypeOk &&
    listingPlatformOk &&
    priceOk
  ) {
    const rawU = listing.url?.trim() ?? "";
    const urlOut = rawU.length > 220 ? `${rawU.slice(0, 217)}...` : rawU;
    console.log(
      "[market][booking-villa-structure-soft-keep-debug]",
      JSON.stringify({
        url: urlOut,
        title: listing.title ?? null,
        targetCity,
        candidateCity: guessListingCity(listing),
        propertyType: listing.propertyType ?? null,
        normalizedType: getNormalizedComparableType(listing),
        price:
          typeof pr === "number" && Number.isFinite(pr) ? pr : listing.price ?? null,
        platformOk: marketTargetIsBooking,
        targetTypeOk,
        listingPlatformOk,
        priceOk,
        geoOk,
        typeSignalOk,
      })
    );
  }

  return ok;
}

function isBookingPriceRatioExtremeVsTarget(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const t =
    typeof target.price === "number" && Number.isFinite(target.price) && target.price > 0
      ? target.price
      : null;
  const c =
    typeof candidate.price === "number" &&
    Number.isFinite(candidate.price) &&
    candidate.price > 0
      ? candidate.price
      : null;
  if (t === null || c === null) return false;
  const ratio = c / t;
  return ratio < 0.33 || ratio > 3;
}

/** Aligné sur filterComparableListings (capacity / chambres / salles de bain). */
function structureAcceptableForBookingVillaPriceScrub(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const tb = safeListingNumber(target.bedrooms ?? target.bedroomCount);
  const cb = safeListingNumber(candidate.bedrooms ?? candidate.bedroomCount);
  if (tb !== null && cb !== null && Math.abs(tb - cb) > 2) return false;

  const tc = safeListingNumber(target.capacity ?? target.guestCapacity);
  const cc = safeListingNumber(candidate.capacity ?? candidate.guestCapacity);
  if (tc !== null && cc !== null && Math.abs(tc - cc) > 3) return false;

  const tba = safeListingNumber(target.bathrooms);
  const cba = safeListingNumber(candidate.bathrooms);
  if (tba !== null && cba !== null && Math.abs(tba - cba) > 2) return false;

  return true;
}

/** Ville / pays / quartier : cohérent avec les garde-fous de locationComparable (sans lat/lon). */
function geoAcceptableForBookingVillaPriceScrub(
  target: ExtractedListing,
  candidate: ExtractedListing,
  marketTargetCity: string | null
): boolean {
  const targetCityGuess = guessListingCity(target);
  const candidateCityGuess = guessListingCity(candidate);
  if (targetCityGuess && candidateCityGuess) {
    if (normalizeMarketText(targetCityGuess) !== normalizeMarketText(candidateCityGuess)) {
      return false;
    }
  }
  const cityForGeo = targetCityGuess ?? marketTargetCity;
  if (cityForGeo && !isGeoCompatible(candidate, cityForGeo)) {
    return false;
  }
  const targetCountry = normalizeCountry(guessListingCountry(target));
  const candidateCountry = normalizeCountry(guessListingCountry(candidate));
  if (targetCountry && candidateCountry && targetCountry !== candidateCountry) {
    return false;
  }
  const targetNeighborhood = guessListingNeighborhood(target);
  const candidateNeighborhood = guessListingNeighborhood(candidate);
  if (
    targetNeighborhood &&
    candidateNeighborhood &&
    targetNeighborhood !== candidateNeighborhood &&
    target.platform === candidate.platform
  ) {
    return false;
  }
  return true;
}

function shouldScrubBookingVillaOutlierPriceForEvaluation(
  evaluationTarget: ExtractedListing,
  candidate: ExtractedListing,
  marketTargetCity: string | null
): boolean {
  if (String(candidate.platform ?? "").toLowerCase() !== "booking") return false;
  if (getNormalizedComparableType(evaluationTarget) !== "villa_like") return false;
  if (getNormalizedComparableType(candidate) !== "villa_like") return false;
  if (!structureAcceptableForBookingVillaPriceScrub(evaluationTarget, candidate)) return false;
  if (!geoAcceptableForBookingVillaPriceScrub(evaluationTarget, candidate, marketTargetCity)) {
    return false;
  }
  return isBookingPriceRatioExtremeVsTarget(evaluationTarget, candidate);
}

function filterCompetitorsByPropertyAndStructure(
  target: ExtractedListing,
  orderedCandidates: ExtractedListing[],
  maxKeep: number
): ExtractedListing[] {
  const kindFromPropertyType = targetKindFromListingPropertyType(target.propertyType);
  let targetKind =
    kindFromPropertyType ??
    detectPropertyTypeFromListingText(target.title ?? "", target.description ?? "");
  if (targetKind === "house" && getNormalizedComparableType(target) === "villa_like") {
    targetKind = "villa";
  }
  const picked: ExtractedListing[] = [];

  for (const listing of orderedCandidates) {
    const propertyType = detectPropertyTypeFromListingText(
      listing.title ?? "",
      listing.description ?? ""
    );
    const bedrooms = safeListingNumber(listing.bedrooms ?? listing.bedroomCount);
    const capacity = safeListingNumber(listing.capacity ?? listing.guestCapacity);

    const typeOk = isPropertyTypeComparable(targetKind, propertyType);
    const structureOk = isBedroomOrCapacityWithinOne(target, listing);
    const targetVillaFamily =
      targetKind === "villa" || getNormalizedComparableType(target) === "villa_like";
    const titleTrim = (listing.title ?? "").trim();
    const cityGuessLower = (guessListingCity(listing) ?? "").toLowerCase();
    const weakQualityComparable =
      targetVillaFamily &&
      String(listing.platform ?? "").toLowerCase() === "booking" &&
      propertyType === "unknown" &&
      (!titleTrim ||
        /untitled/i.test(listing.title ?? "") ||
        cityGuessLower === "untitled" ||
        /\buntitled\b/i.test(cityGuessLower));
    const weakBookingMarketFallback =
      (listing as ExtractedListing & { weakBookingMarketFallback?: boolean })
        .weakBookingMarketFallback === true;
    const kept = weakBookingMarketFallback
      ? !weakQualityComparable
      : typeOk && structureOk && !weakQualityComparable;

    if (DEBUG_GUEST_AUDIT) {
      console.log("[filter][competitor]", {
        title: listing.title ?? "",
        propertyType,
        bedrooms,
        capacity,
        kept,
      });
    }

    if (!kept) continue;

    listing.propertyType = propertyType;
    picked.push(listing);
    if (picked.length >= maxKeep) break;
  }

  return picked;
}

/**
 * DEBUG uniquement : reproduit `filterCompetitorsByPropertyAndStructure` sans effet de bord,
 * pour journaliser rejet vs quota `maxKeep`.
 */
function debugTracePropertyStructureFilter(
  target: ExtractedListing,
  orderedCandidates: ExtractedListing[],
  maxKeep: number
): {
  trace: Array<{
    outcome: "kept" | "rejected_rules" | "skipped_quota";
    title: string | null;
    price: number | null;
    propertyTypeInferred: string;
    url: string;
    reasons?: string[];
  }>;
} {
  const kindFromPropertyType = targetKindFromListingPropertyType(target.propertyType);
  let targetKind =
    kindFromPropertyType ??
    detectPropertyTypeFromListingText(target.title ?? "", target.description ?? "");
  if (targetKind === "house" && getNormalizedComparableType(target) === "villa_like") {
    targetKind = "villa";
  }
  const picked: ExtractedListing[] = [];
  const trace: Array<{
    outcome: "kept" | "rejected_rules" | "skipped_quota";
    title: string | null;
    price: number | null;
    propertyTypeInferred: string;
    url: string;
    reasons?: string[];
  }> = [];

  for (const listing of orderedCandidates) {
    const propertyType = detectPropertyTypeFromListingText(
      listing.title ?? "",
      listing.description ?? ""
    );

    const typeOk = isPropertyTypeComparable(targetKind, propertyType);
    const structureOk = isBedroomOrCapacityWithinOne(target, listing);
    const targetVillaFamily =
      targetKind === "villa" || getNormalizedComparableType(target) === "villa_like";
    const titleTrim = (listing.title ?? "").trim();
    const cityGuessLower = (guessListingCity(listing) ?? "").toLowerCase();
    const weakQualityComparable =
      targetVillaFamily &&
      String(listing.platform ?? "").toLowerCase() === "booking" &&
      propertyType === "unknown" &&
      (!titleTrim ||
        /untitled/i.test(listing.title ?? "") ||
        cityGuessLower === "untitled" ||
        /\buntitled\b/i.test(cityGuessLower));
    const weakBookingMarketFallback =
      (listing as ExtractedListing & { weakBookingMarketFallback?: boolean })
        .weakBookingMarketFallback === true;
    const rowPass = weakBookingMarketFallback
      ? !weakQualityComparable
      : typeOk && structureOk && !weakQualityComparable;

    const urlRaw = (listing.url ?? "").trim();
    const urlOut = urlRaw.length > 240 ? `${urlRaw.slice(0, 237)}...` : urlRaw;
    const priceOut =
      typeof listing.price === "number" && Number.isFinite(listing.price) ? listing.price : null;

    if (!rowPass) {
      const reasons: string[] = [];
      if (weakBookingMarketFallback) {
        if (weakQualityComparable) reasons.push("weak_quality_comparable");
      } else {
        if (!typeOk) reasons.push("property_type_mismatch");
        if (!structureOk) reasons.push("structure_too_far");
        if (weakQualityComparable) reasons.push("weak_quality_comparable");
      }
      trace.push({
        outcome: "rejected_rules",
        title: listing.title ?? null,
        price: priceOut,
        propertyTypeInferred: propertyType,
        url: urlOut,
        reasons,
      });
      continue;
    }

    if (picked.length >= maxKeep) {
      trace.push({
        outcome: "skipped_quota",
        title: listing.title ?? null,
        price: priceOut,
        propertyTypeInferred: propertyType,
        url: urlOut,
        reasons: ["maxKeep_structure_filter_cap"],
      });
      continue;
    }

    picked.push(listing);
    trace.push({
      outcome: "kept",
      title: listing.title ?? null,
      price: priceOut,
      propertyTypeInferred: propertyType,
      url: urlOut,
    });
  }

  return { trace };
}

/** Override évaluation : comparables Booking marqués weak (marché local difficile) si seules raisons type/structure. */
function applyWeakBookingMarketEvalOverride(
  decisions: ReturnType<typeof evaluateComparableCandidates>,
  pipelineInput: SearchCompetitorsInput,
  comparableTarget: ExtractedListing,
  marketTargetCity: string | null
): ReturnType<typeof evaluateComparableCandidates> {
  if (getMarketComparisonPlatform(pipelineInput.target.platform) !== "booking") {
    return decisions;
  }
  if (getNormalizedComparableType(comparableTarget) !== "villa_like") {
    return decisions;
  }
  const weakOnlyReasons = new Set(["property_type_mismatch", "structure_too_far"]);
  return decisions.map((d) => {
    if (d.accepted) return d;
    const reasons = d.reasons ?? [];
    if (reasons.length === 0) return d;
    if (!reasons.every((r) => weakOnlyReasons.has(r))) return d;

    const weak =
      (d.candidate as ExtractedListing & { weakBookingMarketFallback?: boolean })
        .weakBookingMarketFallback === true;
    if (weak) {
      return { ...d, accepted: true, reasons: [] };
    }

    if (
      !isBookingVillaStructureSoftKeep(comparableTarget, d.candidate, marketTargetCity)
    ) {
      return d;
    }

    if (DEBUG_MARKET_PIPELINE) {
      const x = d.candidate;
      console.log(
        "[market][booking-final-guard-soft-keep]",
        JSON.stringify({
          url: x.url ?? null,
          title: x.title ?? null,
          propertyType: x.propertyType ?? null,
          normalizedType: getNormalizedComparableType(x),
          price:
            typeof x.price === "number" && Number.isFinite(x.price) ? x.price : x.price ?? null,
          reasons,
        })
      );
    }
    return { ...d, accepted: true, reasons: [] };
  });
}

type ComparableCandidateDecision = ReturnType<typeof evaluateComparableCandidates>[number];

const BOOKING_FINAL_GUARDRAIL_REASONS = new Set([
  "property_type_mismatch",
  "hotel_vs_apartment_mismatch",
  "city_mismatch",
  "neighborhood_mismatch",
  "low_quality_candidate",
  "price_outlier",
  "booking_morocco_villa_price_floor",
  "booking_morocco_villa_suspicious_low_price",
]);

/** Cible Booking : garder uniquement des comparables alignés sur la décision d’évaluation finale (aucune réinjection non acceptée). */
function isBookingTargetFinalComparableAllowed(
  decision: ComparableCandidateDecision | undefined,
  ctx?: {
    comparableTarget: ExtractedListing;
    listing: ExtractedListing;
    marketTargetCity: string | null;
  }
): boolean {
  if (!decision) return false;

  const reasons = decision.reasons ?? [];
  const hasBlockingReason = reasons.some((r) =>
    BOOKING_FINAL_GUARDRAIL_REASONS.has(r)
  );

  if (decision.accepted && !hasBlockingReason) {
    return true;
  }

  if (!ctx) return false;
  const uDecision = decision.candidate.url?.trim();
  const uListing = ctx.listing.url?.trim();
  if (!uDecision || !uListing || uDecision !== uListing) return false;

  if (getMarketComparisonPlatform(ctx.comparableTarget.platform) !== "booking") {
    return false;
  }
  if (getNormalizedComparableType(ctx.comparableTarget) !== "villa_like") {
    return false;
  }

  if (reasons.length === 0) return false;

  const onlyLegacyTypeOrStructure = reasons.every(
    (r) => r === "property_type_mismatch" || r === "structure_too_far"
  );
  if (!onlyLegacyTypeOrStructure) return false;

  if (
    !isBookingVillaStructureSoftKeep(
      ctx.comparableTarget,
      ctx.listing,
      ctx.marketTargetCity
    )
  ) {
    return false;
  }

  if (DEBUG_MARKET_PIPELINE) {
    const x = ctx.listing;
    console.log(
      "[market][booking-final-guard-soft-keep]",
      JSON.stringify({
        url: x.url ?? null,
        title: x.title ?? null,
        propertyType: x.propertyType ?? null,
        normalizedType: getNormalizedComparableType(x),
        price:
          typeof x.price === "number" && Number.isFinite(x.price)
            ? x.price
            : x.price ?? null,
        reasons,
      })
    );
  }

  return true;
}

/** Centres-ville connus si la cible Booking n’a pas de coordonnées (ex. page challenge). Remplit uniquement si lat ou lon manque. */
function resolveBookingTargetCoordinatesFallback(
  target: ExtractedListing,
  targetCity: string | null
): { latitude: number; longitude: number; source: string } | null {
  if (String(target.platform ?? "").toLowerCase() !== "booking") {
    return null;
  }
  if (
    typeof target.latitude === "number" &&
    Number.isFinite(target.latitude) &&
    typeof target.longitude === "number" &&
    Number.isFinite(target.longitude)
  ) {
    return null;
  }
  const city = normalizeMarketText(targetCity ?? "").trim().toLowerCase();
  if (!city) return null;
  if (city === "sidi bouzid" || (city.includes("sidi") && city.includes("bouzid"))) {
    return {
      latitude: 33.2316,
      longitude: -8.5007,
      source: "sidi_bouzid_center",
    };
  }
  if (city === "marrakech") {
    return {
      latitude: 31.6295,
      longitude: -7.9811,
      source: "marrakech_center",
    };
  }
  return null;
}

/** Haversine — même contrat que filterComparableListings (pour logs Booking uniquement). */
function getDistanceKm(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | null {
  if (
    typeof lat1 !== "number" ||
    !Number.isFinite(lat1) ||
    typeof lon1 !== "number" ||
    !Number.isFinite(lon1) ||
    typeof lat2 !== "number" ||
    !Number.isFinite(lat2) ||
    typeof lon2 !== "number" ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }
  const earthRadiusKm = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function debugComparablesLog(...args: unknown[]) {
  if (!DEBUG_GUEST_AUDIT) return;
  console.log(...args);
}

function isCompetitorSearchAborted(input: SearchCompetitorsInput) {
  return input.abortSignal?.aborted === true;
}

function hasPlausibleComparablePrice(listing: ExtractedListing) {
  return (
    typeof listing.price === "number" &&
    Number.isFinite(listing.price) &&
    listing.price > 0 &&
    listing.price <= 5000 &&
    typeof listing.currency === "string" &&
    listing.currency.trim().length > 0
  );
}

type CandidateSource = "booking" | "airbnb" | "vrbo" | "agoda";
type CandidateUrl = { url: string; source: CandidateSource; title?: string | null };

function isVrboTarget(target: ExtractedListing): boolean {
  return (
    String(target.platform ?? "").toLowerCase() === "vrbo" ||
    String(target.sourcePlatform ?? "").toLowerCase() === "vrbo"
  );
}

function getMarketComparisonPlatform(platform: unknown): CandidateSource | "unknown" {
  const normalized = typeof platform === "string" ? platform.toLowerCase() : "";
  if (normalized === "expedia") return "booking";
  if (
    normalized === "booking" ||
    normalized === "airbnb" ||
    normalized === "vrbo" ||
    normalized === "agoda"
  ) {
    return normalized;
  }
  return "unknown";
}

function getCompetitorSourcePriority(platform: unknown): string[] {
  const normalized = typeof platform === "string" ? platform.toLowerCase() : "";
  if (normalized === "airbnb") return ["booking", "airbnb_minimal_fallback"];
  if (normalized === "expedia") return ["booking"];
  return [getMarketComparisonPlatform(platform)];
}

function getBookingUrlHints(url: string): { cityHint: string | null; countryHint: string | null } {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/hotel\/([a-z]{2})\/([^/]+)\.html/i);
    const countryCode = match?.[1]?.toLowerCase() ?? null;
    const slug = (match?.[2] ?? "").toLowerCase();
    const normalizedSlug = normalizeMarketText(slug);

    const cityHint = normalizedSlug.includes("marrakech")
      ? "marrakech"
      : normalizedSlug.includes("las vegas")
        ? "las vegas"
        : normalizedSlug.includes("orlando")
          ? "orlando"
          : normalizedSlug.includes("brussels") || normalizedSlug.includes("bruxelles")
            ? "brussels"
            : normalizedSlug.includes("barcelona") || normalizedSlug.includes("barcelone")
              ? "barcelona"
          : normalizedSlug.includes("sidi") && normalizedSlug.includes("bouzid")
            ? "sidi bouzid"
          : KNOWN_CITY_NEIGHBORHOODS.marrakech.find((neighborhood) =>
              normalizedSlug.includes(neighborhood)
            ) ?? (normalizedSlug.includes("paris")
              ? "paris"
              : normalizedSlug.includes("nairobi")
                ? "nairobi"
                : null);

    const countryHint =
      countryCode === "ma" || normalizedSlug.includes("morocco") || normalizedSlug.includes("maroc")
        ? "morocco"
        : countryCode === "fr" || normalizedSlug.includes("france")
          ? "france"
          : countryCode === "ke" || normalizedSlug.includes("kenya")
            ? "kenya"
            : countryCode === "us" ||
                normalizedSlug.includes("united states") ||
                normalizedSlug.includes("usa")
              ? "united states"
              : countryCode === "be" || normalizedSlug.includes("belgium") || normalizedSlug.includes("belgique")
                ? "belgium"
                : countryCode === "es" || normalizedSlug.includes("spain") || normalizedSlug.includes("espana")
                  ? "spain"
              : null;

    return { cityHint, countryHint: normalizeCountry(countryHint) };
  } catch {
    return { cityHint: null, countryHint: null };
  }
}

function isBookingCandidateCoherentByHints(input: {
  targetCity: string | null;
  targetCountry: string | null;
  cityHint: string | null;
  countryHint: string | null;
  url: string;
}) {
  const { targetCity, targetCountry, cityHint, countryHint, url } = input;
  const normalizedTargetCity = normalizeMarketText(targetCity);
  const normalizedCityHint = normalizeMarketText(cityHint);
  const normalizedTargetCountry = normalizeCountry(targetCountry);
  const normalizedCountryHint = normalizeCountry(countryHint);
  const normalizedUrl = normalizeMarketText(url);
  const knownNeighborhoods = KNOWN_CITY_NEIGHBORHOODS[normalizedTargetCity] ?? [];

  const targetHasExploitableGeo =
    Boolean(normalizedTargetCity) || Boolean(normalizedTargetCountry);
  if (!targetHasExploitableGeo) {
    return true;
  }

  if (
    normalizedTargetCity &&
    normalizedCityHint &&
    normalizedCityHint !== normalizedTargetCity &&
    !knownNeighborhoods.includes(normalizedCityHint)
  ) {
    return false;
  }
  if (
    normalizedTargetCountry &&
    normalizedCountryHint &&
    normalizedCountryHint !== normalizedTargetCountry
  ) {
    return false;
  }
  const pathCountryCodeMatch = url.match(/\/hotel\/([a-z]{2})\//i);
  const pathCountryCode = pathCountryCodeMatch?.[1]?.toLowerCase() ?? null;
  let pathCountryLabel: string | null = null;
  if (pathCountryCode) {
    switch (pathCountryCode) {
      case "ma":
        pathCountryLabel = "morocco";
        break;
      case "fr":
        pathCountryLabel = "france";
        break;
      case "ke":
        pathCountryLabel = "kenya";
        break;
      case "us":
        pathCountryLabel = "united states";
        break;
      case "gb":
        pathCountryLabel = "united kingdom";
        break;
      case "ca":
        pathCountryLabel = "canada";
        break;
      case "be":
        pathCountryLabel = "belgium";
        break;
      case "es":
        pathCountryLabel = "spain";
        break;
      default:
        pathCountryLabel = null;
    }
  }
  const normalizedPathCountry = pathCountryLabel ? normalizeCountry(pathCountryLabel) : null;
  if (
    normalizedTargetCountry &&
    normalizedPathCountry &&
    normalizedPathCountry !== normalizedTargetCountry
  ) {
    return false;
  }
  if (normalizedTargetCountry === "morocco" && /\/hotel\/ma\//i.test(url)) return true;
  if (normalizedTargetCountry && normalizedCountryHint === normalizedTargetCountry) return true;
  if (normalizedTargetCity && normalizedCityHint === normalizedTargetCity) return true;
  if (normalizedTargetCity && knownNeighborhoods.includes(normalizedCityHint)) return true;
  if (normalizedTargetCity && normalizedUrl.includes(normalizedTargetCity)) return true;
  if (!normalizedCityHint && !normalizedCountryHint) return true;
  return false;
}

function guessListingCountry(listing: ExtractedListing): string | null {
  const text = `${listing.locationLabel ?? ""} ${listing.title ?? ""} ${listing.url ?? ""}`.toLowerCase();
  if (
    text.includes("morocco") ||
    text.includes("maroc") ||
    text.includes("marrakech") ||
    text.includes("marrakesh")
  ) {
    return "morocco";
  }
  if (text.includes("france") || text.includes("paris")) return "france";
  if (text.includes("kenya")) return "kenya";
  if (
    text.includes("united states") ||
    text.includes("united states of america") ||
    /\b(?:usa|u\.s\.a\.|u\.s\.)\b/i.test(text) ||
    /\b(?:las vegas|nevada|nv)\b/i.test(text)
  ) {
    return "united states";
  }
  return null;
}

function logMarketBookingExtractionRejected(
  reason: string,
  candidateUrl: string,
  listing: ExtractedListing | null
) {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;
  console.log(
    "[market][booking-extraction-rejected]",
    JSON.stringify({
      url:
        listing?.url && listing.url.trim().length > 0
          ? listing.url.length > 220
            ? `${listing.url.slice(0, 217)}...`
            : listing.url
          : candidateUrl.length > 220
            ? `${candidateUrl.slice(0, 217)}...`
            : candidateUrl,
      title: listing?.title ?? null,
      platform: listing?.platform ?? "booking",
      city: listing ? guessListingCity(listing) : null,
      country: listing ? guessListingCountry(listing) : null,
      propertyType: listing?.propertyType ?? null,
      bedrooms: listing?.bedrooms ?? null,
      bathrooms: listing?.bathrooms ?? null,
      capacity: listing?.capacity ?? null,
      price: listing?.price ?? null,
      currency: listing?.currency ?? null,
      reason,
    })
  );
}

/** Une ligne par tentative d’entrée brute avant dedupe Booking (voir `bookingRawCompetitors.push`). */
function logMarketDebugBookingRawKeepDecision(args: {
  listing: ExtractedListing | null;
  urlFallback: string;
  keep: boolean;
  reason?: string;
}): void {
  if (process.env.DEBUG_MARKET_PIPELINE !== "true") return;

  const l = args.listing;
  const urlRaw = ((l?.url ?? args.urlFallback) ?? "").trim();
  const url = urlRaw.length > 240 ? `${urlRaw.slice(0, 237)}...` : urlRaw;
  const titleRaw = typeof l?.title === "string" ? l.title.trim() : "";

  const priceNum =
    l && typeof l.price === "number" && Number.isFinite(l.price) ? l.price : null;

  const nightlyPriceDiagnostic =
    l?.priceBasis === "nightly" && priceNum !== null ? priceNum : null;

  const totalPrice =
    l && typeof l.rawStayPrice === "number" && Number.isFinite(l.rawStayPrice)
      ? l.rawStayPrice
      : null;

  const rating =
    l && typeof l.ratingValue === "number" && Number.isFinite(l.ratingValue)
      ? l.ratingValue
      : l && typeof l.rating === "number" && Number.isFinite(l.rating)
        ? l.rating
        : null;

  const payload = {
    title: titleRaw.length > 0 ? titleRaw : null,
    url,
    price: priceNum,
    nightlyPrice: nightlyPriceDiagnostic,
    totalPrice,
    rating,
    reviewCount:
      l && typeof l.reviewCount === "number" && Number.isFinite(l.reviewCount)
        ? l.reviewCount
        : null,
    propertyType: l?.propertyType ?? null,
    bedrooms: l?.bedrooms ?? l?.bedroomCount ?? null,
    capacity: l?.capacity ?? l?.guestCapacity ?? null,
    city: l ? guessListingCity(l) : null,
    address: l?.locationLabel ?? l?.structure?.locationLabel ?? null,
    country: l ? guessListingCountry(l) : null,
    hasPrice: l ? hasPlausibleComparablePrice(l) : false,
    hasTitle: titleRaw.length > 0,
    hasUrl: urlRaw.length > 0,
    keep: args.keep,
    ...(args.keep ? {} : { reason: args.reason ?? "unknown" }),
  };

  console.log("[market][debug][booking-raw-keep-decision]", JSON.stringify(payload));
}

function normalizeMarketText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bmarrakesh\b/g, "marrakech")
    .replace(/\bmarraquexe\b/g, "marrakech")
    .replace(/\bmarraquex\b/g, "marrakech");
}

/** Tokens ville « significatifs » pour matcher le slug Booking (tirets / + / %20 → espaces via normalizeMarketText). */
function significantCityTokensForBookingUrlMatch(normalizedCity: string): string[] {
  const tokens = normalizedCity.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  if (tokens.length === 1) {
    const t = tokens[0]!;
    return t.length >= 2 ? [t] : [];
  }
  return tokens.filter((t) => t.length > 2);
}

function escapeRegExpForCityToken(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeURIComponentSafeForSlug(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

/** Slug hôtel + URL complète normalisés — les tokens peuvent être collés (ex. sidibouzid) ou séparés par / - _. */
function bookingUrlNormalizedHaystackForCityMatch(url: string): string {
  let slugPart = "";
  try {
    const parsed = new URL(url);
    const m = parsed.pathname.match(/\/hotel\/[a-z]{2}\/([^/?#]+?)(?:\.[a-z-]+)?\.html/i);
    slugPart = m?.[1] ? decodeURIComponentSafeForSlug(m[1]) : parsed.pathname;
  } catch {
    slugPart = url;
  }
  return normalizeMarketText(`${slugPart} ${url}`);
}

function tokenAppearsInNormalizedBookingHaystack(haystack: string, token: string): boolean {
  if (!token) return false;
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegExpForCityToken(token)}([^a-z0-9]|$)`);
  if (re.test(haystack)) return true;
  if (token.length >= 4) {
    const compact = haystack.replace(/[^a-z0-9]+/g, "");
    if (compact.includes(token)) return true;
  }
  return false;
}

/**
 * Vérifie que le slug / l’URL contient tous les tokens significatifs (ex. sidi + bouzid).
 * Ne valide pas un seul token d’une ville à plusieurs mots significatifs.
 */
function bookingUrlContainsTargetCityTokens(url: string, targetCity: string | null): boolean {
  if (!targetCity?.trim()) return false;
  const normCity = normalizeMarketText(targetCity);
  const significant = significantCityTokensForBookingUrlMatch(normCity);
  if (significant.length === 0) return false;
  const haystack = bookingUrlNormalizedHaystackForCityMatch(url);
  for (const tok of significant) {
    if (!tokenAppearsInNormalizedBookingHaystack(haystack, tok)) return false;
  }
  return true;
}

/** Aligné sur refineBookingTargetType (booking-search) pour l’override extraction villa. */
function refineComparableTargetTypeForBookingExtraction(
  target: ExtractedListing,
  currentTargetType: string
): string {
  const slugMatch = target.url?.match(
    /booking\.com\/hotel\/[a-z]{2}\/([^/?#]+?)(?:\.[a-z-]+)?\.html/i
  );
  let slugPart = (slugMatch?.[1] ?? "").toLowerCase().replace(/-/g, " ");
  try {
    slugPart = decodeURIComponent(slugPart);
  } catch {
    /* ignore */
  }
  slugPart = slugPart.toLowerCase();
  const titlePart = normalizeMarketText(target.title ?? "");
  const propPart = normalizeMarketText(target.propertyType ?? "");
  const locPart = normalizeMarketText(target.locationLabel ?? "");
  const h = `${slugPart} ${titlePart} ${propPart} ${locPart}`.replace(/\s+/g, " ").trim();
  if (!h) return currentTargetType;
  if (/\bvilla\b/.test(h)) return "villa_like";
  if (/\bmaison\b/.test(h) && /\bpiscine\b/.test(h)) return "villa_like";
  if (/\briad\b/.test(h) || /\bdar\b/.test(h)) return "riad_like";
  if (/\b(apartment|appartement|flat)\b/.test(h)) return "apartment_like";
  if (/\bstudio\b/.test(h)) return "studio_like";
  if (/\b(chambre|chambres|room|rooms|suite|suites)\b/.test(h)) return "room_like";
  if (
    /\bhotel\b/.test(h) ||
    /\bhostel\b/.test(h) ||
    /\bguesthouse\b/.test(h) ||
    /\bguest house\b/.test(h) ||
    /\bmaison d hotes\b/.test(h) ||
    /\bmaison dhotes\b/.test(h)
  ) {
    return "hotel_like";
  }
  return currentTargetType;
}

function bookingUrlSupportsVillaExtractionTypeOverride(
  urlInferred: ReturnType<typeof inferBookingCandidateTypeFromUrl>
): boolean {
  return (
    urlInferred === "villa" ||
    urlInferred === "maison" ||
    urlInferred === "house" ||
    urlInferred === "holiday_home" ||
    urlInferred === "home"
  );
}

/** Slug + query uniquement : le chemin Booking contient toujours `/hotel/xx/` pour les fiches. */
function bookingUrlTypeHintHaystack(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
    const slugMatch = path.match(/^hotel\/[a-z]{2}\/(.+)\.html$/i);
    const slugPart = slugMatch?.[1] ?? path.replace(/^hotel\/[a-z]{2}\//i, "").replace(/\.html$/i, "");
    return `${slugPart} ${parsed.search}`.trim();
  } catch {
    return url;
  }
}

/** Signaux réservés à un comparable type hôtel (maison d'hôtes, guest house). */
const BOOKING_PREFILTER_HOTEL_ONLY_SIGNAL =
  /\bmaison d hotes\b|\bmaison dhotes\b|\bguesthouse\b|\bguest house\b/i;

const BOOKING_TYPE_PREFILTER_ALLOW: Record<string, readonly string[]> = {
  villa_like: ["villa", "villas", "private villa", "entire villa", "house", "maison"],
  apartment_like: ["apartment", "appartement", "flat"],
  room_like: ["room", "rooms", "chambre", "chambres", "suite", "suites"],
  hotel_like: [
    "hotel",
    "hotels",
    "hostel",
    "guesthouse",
    "guest house",
    "maison d hotes",
    "maison dhotes",
  ],
};

function bookingTypePrefilterAllowPhraseMatches(haystackNorm: string, phraseNorm: string): boolean {
  if (!phraseNorm) return false;
  if (phraseNorm.includes(" ")) {
    return haystackNorm.includes(phraseNorm);
  }
  try {
    return new RegExp(`\\b${phraseNorm.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`).test(
      haystackNorm
    );
  } catch {
    return false;
  }
}

/** Préfiltre slug/query Booking selon le type cible (allow list + signaux hotel-only). */
function passesBookingTypePrefilter(url: string, targetType: string): boolean {
  const allow = BOOKING_TYPE_PREFILTER_ALLOW[targetType];
  if (!allow || allow.length === 0) {
    return true;
  }
  const haystackNorm = normalizeMarketText(bookingUrlTypeHintHaystack(url));
  if (BOOKING_PREFILTER_HOTEL_ONLY_SIGNAL.test(haystackNorm) && targetType !== "hotel_like") {
    return false;
  }
  for (const phrase of allow) {
    const p = normalizeMarketText(phrase);
    if (p && bookingTypePrefilterAllowPhraseMatches(haystackNorm, p)) {
      return true;
    }
  }
  return false;
}

/** Villa_like uniquement : élargit le slug par rapport à passesBookingTypePrefilter strict, sans reprendre appartement/studio. */
const VILLA_TYPE_SOFT_RESTORE_NEGATIVE_RE =
  /\b(appartement|apartment|appart|studio)\b/;
const VILLA_TYPE_SOFT_RESTORE_POSITIVE_RE =
  /\b(villas?|riads?|ryad|dars?|maisons?|houses?|homes?|lodges?|palais|palaces?|residences?|resorts?|domaines?|kasbahs?|ksars?)\b/;

function bookingUrlPassesVillaTypeSoftRestoreHaystack(url: string): boolean {
  const h = normalizeMarketText(bookingUrlTypeHintHaystack(url));
  if (!h) return false;
  if (VILLA_TYPE_SOFT_RESTORE_NEGATIVE_RE.test(h)) return false;
  return VILLA_TYPE_SOFT_RESTORE_POSITIVE_RE.test(h);
}

type VillaAirbnbFallbackTypeClass = "keep" | "negative" | "no_type_signal";

/** Exige un signal explicite villa/maison dans l’URL ou le titre candidat ; signaux négatifs = rejet. */
function classifyVillaAirbnbFallbackAirbnbCandidate(
  url: string,
  title?: string | null
): VillaAirbnbFallbackTypeClass {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    /* ignore */
  }
  const fromUrl = normalizeMarketText(decoded);
  const fromTitle = normalizeMarketText(title ?? "");
  const haystack = [fromUrl, fromTitle].filter(Boolean).join(" ").trim();
  if (!haystack) return "no_type_signal";

  const negative =
    /\b(apartment|appartement|studio|riad|room|chambre|hotel|hostel|hostels)\b/.test(haystack);
  if (negative) return "negative";

  const positive = /\b(villa|villas|maison|house)\b/.test(haystack);
  if (positive) return "keep";

  return "no_type_signal";
}

function villaAirbnbStrongFallbackShadowTargets(
  base: ExtractedListing,
  city: string | null
): ExtractedListing[] {
  const c = normalizeMarketText(city);
  if (!c) {
    return [base];
  }
  const queries = [
    `villa ${c}`,
    `villa piscine ${c}`,
    `maison ${c}`,
    `private villa ${c}`,
  ];
  return queries.map((q) => {
    const label = normalizeMarketText(q) || q;
    return {
      ...base,
      title: label,
      locationLabel: label,
    };
  });
}

type BookingTargetGeoResolutionPayload = {
  targetUrl: string | null;
  extractedCity: string | null;
  slugCityCandidate: string | null;
  finalTargetCity: string | null;
  rejectedCityCandidates: string[];
  reason: string;
  /** Renseigné par l’appelant (discovery) lors du log DEBUG. */
  targetCountry: string | null;
};

function emptyBookingTargetGeoResolutionBase(
  listing: ExtractedListing
): BookingTargetGeoResolutionPayload {
  return {
    targetUrl: listing.url ?? null,
    extractedCity: null,
    slugCityCandidate: null,
    finalTargetCity: null,
    rejectedCityCandidates: [],
    reason: "",
    targetCountry: null,
  };
}

/**
 * Déduit la ville marché comparable :
 * Booking Maroc `/hotel/ma/` — ville dans le slug (allowlist) prioritaire sur le guess libellé ;
 * sinon libellés, puis slug, puis signal large ; mots génériques d’annonce rejetés (terrasse, …).
 */
function resolveMarketComparisonCityDetail(listing: ExtractedListing): {
  city: string | null;
  bookingGeoLog: BookingTargetGeoResolutionPayload | null;
} {
  const plat = String(listing.platform ?? "").toLowerCase();
  const isBookingPlatform = plat === "booking";

  const text = normalizeMarketText(
    `${listing.locationLabel ?? ""} ${listing.structure?.locationLabel ?? ""} ${listing.url ?? ""} ${
      isVrboTarget(listing) ? listing.description ?? "" : ""
    }`
  );

  const mkBookingLog = (fields: Partial<BookingTargetGeoResolutionPayload>): BookingTargetGeoResolutionPayload => ({
    ...emptyBookingTargetGeoResolutionBase(listing),
    ...fields,
    targetUrl: listing.url ?? null,
  });

  if (/\blas vegas\b/.test(text)) {
    return {
      city: "las vegas",
      bookingGeoLog: isBookingPlatform
        ? mkBookingLog({
            reason: "explicit_las_vegas",
            extractedCity: null,
            slugCityCandidate: null,
            finalTargetCity: "las vegas",
            rejectedCityCandidates: [],
          })
        : null,
    };
  }
  if (isVrboTarget(listing) && /\bsidi bouzid\b/.test(text)) {
    return { city: "sidi bouzid", bookingGeoLog: null };
  }
  if (isBookingPlatform && /\bsidi bouzid\b/.test(text)) {
    return {
      city: "sidi bouzid",
      bookingGeoLog: mkBookingLog({
        reason: "explicit_sidi_bouzid",
        extractedCity: null,
        slugCityCandidate: null,
        finalTargetCity: "sidi bouzid",
        rejectedCityCandidates: [],
      }),
    };
  }

  const locationOnlyLabel = [
    listing.structure?.locationLabel,
    listing.locationLabel,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(", ")
    .trim();

  const cityFromLocationSignals = normalizeMarketText(
    guessListingCity({
      ...listing,
      title: "",
      description: "",
      url: "",
      locationLabel: locationOnlyLabel || listing.locationLabel || "",
    } as ExtractedListing)
  );

  const slugCityCandidate = isBookingPlatform
    ? extractMoroccoKnownCityFromBookingMaSlug(listing.url ?? "")
    : null;

  const rejectedCityCandidates: string[] = [];

  if (cityFromLocationSignals && isRejectedStandaloneMarketCityGuess(cityFromLocationSignals)) {
    rejectedCityCandidates.push(cityFromLocationSignals);
  }

  const locationAccepted = Boolean(
    cityFromLocationSignals && !isRejectedStandaloneMarketCityGuess(cityFromLocationSignals)
  );
  const normLoc = locationAccepted ? normalizeMarketText(cityFromLocationSignals) : "";
  const normSlug = slugCityCandidate ? normalizeMarketText(slugCityCandidate) : "";
  const slugMatchesExtracted = Boolean(normLoc && normSlug && normLoc === normSlug);

  /** Slug MA fiable : prioritaire sur un quartier / sous-libellé (ex. aggada vs marrakech dans l’URL). */
  if (isBookingPlatform && slugCityCandidate) {
    if (slugMatchesExtracted && locationAccepted) {
      return {
        city: slugCityCandidate,
        bookingGeoLog: mkBookingLog({
          reason: "location_label_signals_accepted",
          extractedCity: cityFromLocationSignals || null,
          slugCityCandidate,
          finalTargetCity: slugCityCandidate,
          rejectedCityCandidates,
        }),
      };
    }

    const priorityRejected = [...rejectedCityCandidates];
    if (locationAccepted && !slugMatchesExtracted) {
      priorityRejected.push(cityFromLocationSignals);
    }

    return {
      city: slugCityCandidate,
      bookingGeoLog: mkBookingLog({
        reason: "slug_ma_known_city_priority",
        extractedCity: cityFromLocationSignals || null,
        slugCityCandidate,
        finalTargetCity: slugCityCandidate,
        rejectedCityCandidates: priorityRejected,
      }),
    };
  }

  if (locationAccepted) {
    return {
      city: cityFromLocationSignals,
      bookingGeoLog: isBookingPlatform
        ? mkBookingLog({
            reason: "location_label_signals_accepted",
            extractedCity: cityFromLocationSignals || null,
            slugCityCandidate,
            finalTargetCity: cityFromLocationSignals,
            rejectedCityCandidates,
          })
        : null,
    };
  }

  const cityFromBroadSignals = normalizeMarketText(guessListingCity(listing));
  if (cityFromBroadSignals && isRejectedStandaloneMarketCityGuess(cityFromBroadSignals)) {
    rejectedCityCandidates.push(cityFromBroadSignals);
  }

  if (cityFromBroadSignals && !isRejectedStandaloneMarketCityGuess(cityFromBroadSignals)) {
    return {
      city: cityFromBroadSignals,
      bookingGeoLog: isBookingPlatform
        ? mkBookingLog({
            reason: "broad_listing_signals_accepted",
            extractedCity: cityFromLocationSignals || null,
            slugCityCandidate,
            finalTargetCity: cityFromBroadSignals,
            rejectedCityCandidates,
          })
        : null,
    };
  }

  return {
    city: null,
    bookingGeoLog: isBookingPlatform
      ? mkBookingLog({
          reason: "fallback_null_no_reliable_city",
          extractedCity: cityFromLocationSignals || null,
          slugCityCandidate,
          finalTargetCity: null,
          rejectedCityCandidates,
        })
      : null,
  };
}

type ListingWithOptionalLocation = ExtractedListing & {
  location?: { city?: string | null } | null;
};

/**
 * Ville cible marché (searchCompetitorsAroundTarget) : uniquement labels + location.city éventuel.
 * N’utilise jamais title, description ni url de la cible.
 */
function resolveTargetMarketCityFromLocationOnly(target: ExtractedListing): string | null {
  const extended = target as ListingWithOptionalLocation;
  const locCityRaw = extended.location?.city;
  const locCity =
    typeof locCityRaw === "string" && locCityRaw.trim().length > 0 ? locCityRaw.trim() : "";

  const locationOnlyLabel = [
    target.structure?.locationLabel,
    target.locationLabel,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(", ")
    .trim();

  const syntheticLocationLabel = [locationOnlyLabel, locCity].filter(Boolean).join(", ").trim();
  if (!syntheticLocationLabel) return null;

  const guessed = guessListingCity({
    ...target,
    title: "",
    description: "",
    url: "",
    locationLabel: syntheticLocationLabel,
    structure: target.structure
      ? { ...target.structure, locationLabel: syntheticLocationLabel }
      : undefined,
  } as ExtractedListing);

  const normalized = normalizeMarketText(guessed);
  if (!normalized) return null;
  if (isRejectedStandaloneMarketCityGuess(normalized)) return null;
  return normalized;
}

function normalizeCountry(input: string | null): string | null {
  if (!input) return null;
  const normalized = normalizeMarketText(input);

  if (normalized.includes("morocco") || normalized.includes("maroc")) return "morocco";
  if (normalized.includes("france")) return "france";
  if (normalized.includes("kenya")) return "kenya";
  if (normalized.includes("belgium") || normalized.includes("belgique")) return "belgium";
  if (
    normalized.includes("spain") ||
    normalized.includes("espana") ||
    normalized.includes("espagne") ||
    normalized.includes("españa")
  ) {
    return "spain";
  }
  if (normalized.includes("portugal")) return "portugal";
  if (
    normalized.includes("italy") ||
    normalized.includes("italie") ||
    normalized.includes("italia")
  ) {
    return "italy";
  }
  if (
    normalized.includes("united kingdom") ||
    normalized.includes("royaume uni") ||
    normalized.includes("great britain") ||
    /\buk\b/.test(normalized)
  ) {
    return "united kingdom";
  }
  if (
    normalized.includes("united states") ||
    normalized.includes("united states of america") ||
    normalized.includes("etats unis") ||
    /\b(?:usa|u s a|u s|us)\b/i.test(normalized)
  ) {
    return "united states";
  }

  return normalized;
}

export function guessMarketComparisonCity(listing: ExtractedListing): string | null {
  return resolveMarketComparisonCityDetail(listing).city;
}

export function guessMarketComparisonCountry(listing: ExtractedListing): string | null {
  const url = listing.url ?? "";
  let hostTldCountry: string | null = null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const isAirbnbHost = host === "airbnb.com" || host.endsWith(".airbnb.com") || host.includes("airbnb.");
    if (isAirbnbHost) {
      if (host === "airbnb.fr" || host.endsWith(".airbnb.fr")) hostTldCountry = "france";
      else if (host === "airbnb.co.uk" || host.endsWith(".airbnb.co.uk")) hostTldCountry = "united kingdom";
      else if (host === "airbnb.es" || host.endsWith(".airbnb.es")) hostTldCountry = "spain";
      else if (host === "airbnb.de" || host.endsWith(".airbnb.de")) hostTldCountry = "germany";
      else if (host === "airbnb.it" || host.endsWith(".airbnb.it")) hostTldCountry = "italy";
      else if (host === "airbnb.be" || host.endsWith(".airbnb.be")) hostTldCountry = "belgium";
    }
  } catch {
    /* ignore */
  }

  if (/\/hotel\/ma\//i.test(url)) {
    return "morocco";
  }

  const text = `${listing.locationLabel ?? ""} ${listing.structure?.locationLabel ?? ""} ${url} ${
    isVrboTarget(listing) ? listing.description ?? "" : ""
  }`.toLowerCase();
  if (
    text.includes("morocco") ||
    text.includes("maroc") ||
    text.includes("marrakech") ||
    text.includes("marrakesh")
  ) {
    return "morocco";
  }
  if (
    text.includes("france") ||
    /\bparis\b/.test(text) ||
    /\btoulouse\b/.test(text) ||
    /\/fr\//i.test(listing.url ?? "") ||
    hostTldCountry === "france"
  ) {
    return "france";
  }
  if (text.includes("kenya")) return "kenya";
  if (
    text.includes("united states") ||
    text.includes("united states of america") ||
    /\b(?:usa|u\.s\.a\.|u\.s\.)\b/i.test(text) ||
    /\b(?:las vegas|nevada|nv)\b/i.test(text)
  ) {
    return "united states";
  }
  if (text.includes("belgium") || text.includes("belgique")) return "belgium";
  if (text.includes("spain") || text.includes("espana") || text.includes("españa")) return "spain";
  return null;
}

function buildBookingDiscoveryTarget(target: ExtractedListing): ExtractedListing {
  const targetCountry = guessMarketComparisonCountry(target);
  const { city: targetCity, bookingGeoLog } = resolveMarketComparisonCityDetail(target);

  if (DEBUG_MARKET_PIPELINE && bookingGeoLog) {
    console.log(
      "[market][debug][booking-target-geo-resolution]",
      JSON.stringify({
        ...bookingGeoLog,
        targetCountry: targetCountry ?? null,
      })
    );
  }

  const searchQuery = [targetCity, targetCountry].filter(Boolean).join(", ");
  if (!searchQuery) return target;

  return {
    ...target,
    title: searchQuery,
    locationLabel: searchQuery,
    description: `${searchQuery} ${target.description ?? ""}`.trim(),
  };
}

function isExpediaTarget(target: ExtractedListing): boolean {
  return (
    String(target.platform ?? "").toLowerCase() === "expedia" ||
    String(target.sourcePlatform ?? "").toLowerCase() === "expedia"
  );
}

const KNOWN_CITY_NEIGHBORHOODS: Record<string, string[]> = {
  marrakech: [
    "gueliz",
    "medina",
    "hivernage",
    "majorelle",
    "palmeraie",
    "agdal",
    "menara",
    "sidi ghanem",
    "semmlalia",
    "semelalia",
  ],
};

function isGeoCompatible(candidate: ExtractedListing, targetCity: string | null): boolean {
  const normalizedTargetCity = normalizeMarketText(targetCity);
  if (!normalizedTargetCity) return true;

  const candidateCity = normalizeMarketText(guessListingCity(candidate));
  const candidateText = normalizeMarketText(
    `${candidate.title ?? ""} ${candidate.url ?? ""} ${candidate.locationLabel ?? ""}`
  );
  const knownNeighborhoods = KNOWN_CITY_NEIGHBORHOODS[normalizedTargetCity] ?? [];

  return (
    candidateCity === normalizedTargetCity ||
    knownNeighborhoods.includes(candidateCity) ||
    candidateText.includes(normalizedTargetCity) ||
    knownNeighborhoods.some((neighborhood) => candidateText.includes(neighborhood))
  );
}

function hasApartmentSignalInTitle(candidate: ExtractedListing): boolean {
  return /\b(appartement|apartment|studio|flat)\b/i.test(candidate.title ?? "");
}

function isTypeCompatible(candidate: ExtractedListing, targetType: string): boolean {
  const candidateType = getNormalizedComparableType(candidate);
  const rawType = normalizeMarketText(candidate.propertyType);

  if (targetType === "unknown" || candidateType === "unknown") return true;
  if (candidateType === targetType || rawType === targetType) return true;

  if (targetType === "apartment_like") {
    if (
      ["apartment", "apartment_like", "entire_place", "studio"].includes(rawType) ||
      candidateType === "apartment_like" ||
      candidateType === "studio_like"
    ) {
      return true;
    }

    if ((rawType.includes("hotel") || candidateType === "hotel_like") && hasApartmentSignalInTitle(candidate)) {
      return true;
    }
  }

  if (targetType === "villa_like" && candidateType === "house_like") {
    return true;
  }

  return false;
}

async function getCandidateUrls(
  target: ExtractedListing,
  maxResults: number,
  sourcePriority?: CandidateSource[],
  comparableDiscoveryGeo?: {
    normalizedTargetCountry: string | null;
    skipEmbeddedAndNetwork: boolean;
  },
  abortSignal?: AbortSignal
): Promise<CandidateUrl[]> {
  const normalize = (urls: string[], source: CandidateSource) =>
    urls
      .map((url) => url?.trim() || "")
      .filter(Boolean)
      .map((url) => ({ url, source }));

  switch (sourcePriority?.[0] ?? getMarketComparisonPlatform(target.platform)) {
    case "airbnb": {
      const targetCity = guessMarketComparisonCity(target);
      const targetCountry = guessMarketComparisonCountry(target);
      const searchQuery = [targetCity, targetCountry].filter(Boolean).join(" ");
      const bookingDiscoveryTarget = searchQuery
        ? {
            ...target,
            title: `${searchQuery}, ${target.propertyType ?? "appartement"}`,
            locationLabel: searchQuery,
            description: `${target.description ?? ""} ${searchQuery}`.trim(),
          }
        : target;
      const bookingUrls = await (async () => {
        try {
          const candidates = await searchBookingCompetitorCandidates(
            bookingDiscoveryTarget,
            Math.max(maxResults * 2, 6),
            comparableDiscoveryGeo,
            abortSignal
          );
          return normalize(candidates.map((c) => c.url), "booking").map((row) => ({
            ...row,
            url: buildBookingUrlWithDates(row.url, bookingDiscoveryTarget.url ?? null),
          }));
        } catch (error) {
          console.error("Error searching Booking.com competitors for Airbnb target", error);
          return [] as CandidateUrl[];
        }
      })();

      const airbnbUrls = await (async () => {
        try {
          const candidates = await searchAirbnbCompetitorCandidates(target, maxResults);
          return candidates
            .map((c) => ({
              url: (c.url ?? "").trim(),
              source: "airbnb" as const,
              title: c.title ?? null,
            }))
            .filter((row) => row.url.length > 0);
        } catch (error) {
          console.error("Error searching Airbnb competitors", error);
          return [] as CandidateUrl[];
        }
      })();

      return [...bookingUrls, ...airbnbUrls];
    }
    case "booking": {
      try {
        const bookingDiscoveryTarget = buildBookingDiscoveryTarget(target);
        console.log("[market][booking-discovery-input]", {
          isExpediaTarget: isExpediaTarget(target),
          searchTargetLocationLabel: bookingDiscoveryTarget.locationLabel ?? null,
          searchTargetTitlePreview: (bookingDiscoveryTarget.title ?? "").slice(0, 120),
          sourceListingUrlCc: (() => {
            try {
              return new URL(target.url ?? "").pathname.match(/^\/hotel\/([a-z]{2})\//i)?.[1] ?? null;
            } catch {
              return null;
            }
          })(),
        });
        const candidates = await searchBookingCompetitorCandidates(
          bookingDiscoveryTarget,
          maxResults,
          comparableDiscoveryGeo,
          abortSignal
        );
        return normalize(candidates.map((c) => c.url), "booking").map((row) => ({
          ...row,
          url: buildBookingUrlWithDates(row.url, bookingDiscoveryTarget.url ?? null),
        }));
      } catch (error) {
        console.error("Error searching Booking.com competitors", error);
        return [];
      }
    }

    case "vrbo": {
      try {
        const targetCity = guessMarketComparisonCity(target);
        const targetCountry = guessMarketComparisonCountry(target);
        const searchQuery = [targetCity, targetCountry].filter(Boolean).join(", ");
        const vrboDiscoveryTarget = searchQuery
          ? {
              ...target,
              title: searchQuery,
              locationLabel: searchQuery,
              description: `${searchQuery} ${target.description ?? ""}`.trim(),
            }
          : target;
        const candidates = await searchVrboCompetitorCandidates(vrboDiscoveryTarget, maxResults);
        return normalize(candidates.map((c) => c.url), "vrbo");
      } catch (error) {
        console.error("Error searching VRBO competitors", error);
        return [];
      }
    }

    case "agoda": {
      try {
        const candidates = await searchAgodaCompetitorCandidates(target, maxResults);
        return normalize(candidates.map((c) => c.url), "agoda");
      } catch (error) {
        console.error("Error searching Agoda competitors", error);
        return [];
      }
    }

    default:
      return [];
  }
}

function isUsableListing(listing: ExtractedListing, target: ExtractedListing): boolean {
  if (!listing) return false;

  if (!listing.url || typeof listing.url !== "string") return false;
  if (listing.url === target.url) return false;

  const hasTitle = typeof listing.title === "string" && listing.title.trim().length > 0;
  const hasPhotos = Array.isArray(listing.photos) && listing.photos.length > 0;
  const hasAmenities = Array.isArray(listing.amenities) && listing.amenities.length > 0;
  const hasPrice = hasPlausibleComparablePrice(listing);

  // At least one core field should be meaningful for the listing to be comparable
  return hasTitle || hasPhotos || hasAmenities || hasPrice;
}

function buildListingKey(listing: ExtractedListing): string {
  const url = listing.url ?? "";
  const externalId = listing.externalId ?? "";
  const platform = listing.platform ?? "";
  const title = (listing.title ?? "").toLowerCase();
  const price =
    typeof listing.price === "number" && Number.isFinite(listing.price)
      ? listing.price.toFixed(2)
      : "";

  return [platform, externalId, url, title, price].join("|");
}

function dedupeListings(
  listings: ExtractedListing[],
  target: ExtractedListing
): ExtractedListing[] {
  const seen = new Set<string>();
  const result: ExtractedListing[] = [];

  for (const listing of listings) {
    if (!isUsableListing(listing, target)) continue;

    const key = buildListingKey(listing);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(listing);
  }

  return result;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getBrightDataCdpEndpoint() {
  const browserHost = readEnv("BRIGHTDATA_BROWSER_HOST");
  const browserUsername = readEnv("BRIGHTDATA_BROWSER_USERNAME");
  const browserPassword = readEnv("BRIGHTDATA_BROWSER_PASSWORD");

  if (browserHost && browserUsername && browserPassword) {
    const port = readEnv("BRIGHTDATA_BROWSER_PORT") ?? "9222";
    const hostWithPort = browserHost.includes(":") ? browserHost : `${browserHost}:${port}`;
    return `wss://${encodeURIComponent(browserUsername)}:${encodeURIComponent(
      browserPassword
    )}@${hostWithPort}`;
  }

  const host = readEnv("BRIGHTDATA_HOST");
  const port = readEnv("BRIGHTDATA_PORT");
  const username = readEnv("BRIGHTDATA_USERNAME");
  const password = readEnv("BRIGHTDATA_PASSWORD");

  if (!host || port !== "9222" || !username || !password) return null;

  const hostWithPort = host.includes(":") ? host : `${host}:${port}`;
  return `wss://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostWithPort}`;
}

function buildAirbnbCompetitorPricingUrl(url: string) {
  const target = new URL(url);
  if (/airbnb\.com$/i.test(target.hostname)) {
    target.hostname = "www.airbnb.fr";
  }
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 14);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + AIRBNB_COMPETITOR_PRICE_NIGHTS);

  target.searchParams.set("check_in", checkIn.toISOString().slice(0, 10));
  target.searchParams.set("check_out", checkOut.toISOString().slice(0, 10));
  target.searchParams.set("adults", "2");
  return {
    url: target.toString(),
    nights: AIRBNB_COMPETITOR_PRICE_NIGHTS,
  };
}

function parseCurrencyFromText(text: string) {
  if (text.includes("€")) return "EUR";
  if (text.includes("$")) return "USD";
  if (text.includes("£")) return "GBP";
  if (
    text.includes("MAD") ||
    text.includes("DH") ||
    text.includes("د.م.") ||
    text.toLowerCase().includes("dirham")
  ) {
    return "MAD";
  }
  return null;
}

function parsePriceNumber(text: string) {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseAirbnbTotalPrice(text: string) {
  const normalized = text.replace(/\u00a0|\u202f/g, " ").replace(/\s+/g, " ").trim();
  if (!/(au total|total|totale)/i.test(normalized)) return null;

  const match =
    normalized.match(/([€$£])\s*(\d[\d\s.,]*)\s*(?:au\s*total|total|totale)/i) ??
    normalized.match(/(\d[\d\s.,]*)\s*([€$£])\s*(?:au\s*total|total|totale)/i);

  if (match) {
    const symbolFirst = /[€$£]/.test(match[1] ?? "");
    const rawPrice = symbolFirst ? match[2] : match[1];
    const currencySymbol = symbolFirst ? match[1] : match[2];
    const value = parsePriceNumber(rawPrice ?? "");
    if (value == null || value <= 0 || value > 50000) return null;

    return {
      totalPrice: Math.round(value),
      currency: parseCurrencyFromText(currencySymbol ?? normalized),
    };
  }

  if (parseCurrencyFromText(normalized) === "MAD") {
    const madMatch =
      normalized.match(
        /(?:au\s*total|total|totale)[^\d]{0,80}(\d[\d\s.,]*)\s*(?:MAD|DH|د\.م\.|dirham)/i
      ) ??
      normalized.match(
        /(\d[\d\s.,]*)\s*(?:MAD|DH|د\.م\.)\s*(?:pour\s*)?(?:le\s*)?(?:au\s*)?(?:total|totale)/i
      );

    if (madMatch?.[1]) {
      const value = parsePriceNumber(madMatch[1]);
      if (value != null && value > 0 && value <= 50000) {
        return {
          totalPrice: Math.round(value),
          currency: "MAD" as const,
        };
      }
    }
  }

  return null;
}

function getRemainingTimeout(startedAt: number) {
  return Math.max(1000, AIRBNB_COMPETITOR_PRICE_TIMEOUT_MS - (Date.now() - startedAt));
}

async function readAirbnbCompetitorTotalPrice(page: Page, startedAt: number) {
  await page
    .waitForSelector('[data-testid="book-it-default"], [data-testid="price-element"], body', {
      timeout: Math.min(4000, getRemainingTimeout(startedAt)),
    })
    .catch(() => {});
  await page.waitForTimeout(Math.min(1500, getRemainingTimeout(startedAt))).catch(() => {});

  const candidates = await page.evaluate(`
    (() => {
      const values = [];
      const pushText = (source, text) => {
        const normalized = (text || "").replace(/\\s+/g, " ").trim();
        if (!normalized || normalized.length > 260) return;
        const hasWestern = /[€$£]/.test(normalized);
        const hasMad =
          /MAD|\\bDH\\b|د\\.م\\.|dirham/i.test(normalized);
        if (!hasWestern && !hasMad) return;
        if (!/(au total|total|totale)/i.test(normalized)) return;
        values.push({ source, text: normalized });
      };

      document
        .querySelectorAll('[data-testid="book-it-default"], [data-testid="book-it-default"] span')
        .forEach((element) => pushText("book-it-default", element.textContent));
      document
        .querySelectorAll('[data-testid="price-element"], [data-testid="price-element"] span')
        .forEach((element) => pushText("price-element", element.textContent));

      return values.slice(0, 20);
    })()
  `);

  if (!Array.isArray(candidates)) return null;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const text = (candidate as { text?: unknown }).text;
    if (typeof text !== "string") continue;

    const parsed = parseAirbnbTotalPrice(text);
    if (parsed) return parsed;
  }

  return null;
}

async function fetchAirbnbCompetitorPriceWithCdp(url: string) {
  const endpoint = getBrightDataCdpEndpoint();
  if (!endpoint) return null;

  const pricingUrl = buildAirbnbCompetitorPricingUrl(url);
  const startedAt = Date.now();
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.connectOverCDP(endpoint, {
      timeout: Math.min(3000, getRemainingTimeout(startedAt)),
    });
    page = await browser.newPage();
    await page.goto(pricingUrl.url, {
      waitUntil: "commit",
      timeout: Math.min(11000, getRemainingTimeout(startedAt)),
    });

    const parsed = await readAirbnbCompetitorTotalPrice(page, startedAt);
    if (!parsed) {
      console.log("[pricing][competitor]", {
        url,
        totalPrice: null,
        pricePerNight: null,
        nights: pricingUrl.nights,
        currency: null,
      });
      return null;
    }

    const pricePerNight = Math.round((parsed.totalPrice / pricingUrl.nights) * 100) / 100;
    console.log("[pricing][competitor]", {
      url,
      totalPrice: parsed.totalPrice,
      pricePerNight,
      nights: pricingUrl.nights,
      currency: parsed.currency,
    });

    return {
      totalPrice: parsed.totalPrice,
      pricePerNight,
      nights: pricingUrl.nights,
      currency: parsed.currency,
    };
  } catch (error) {
    console.log("[pricing][competitor]", {
      url,
      totalPrice: null,
      pricePerNight: null,
      nights: pricingUrl.nights,
      currency: null,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function enrichAirbnbCompetitorPrices(competitors: ExtractedListing[]) {
  let attempted = 0;
  let successful = 0;

  for (const competitor of competitors) {
    if (successful >= AIRBNB_COMPETITOR_PRICE_ATTEMPT_LIMIT) break;
    if (attempted >= AIRBNB_COMPETITOR_PRICE_ATTEMPT_LIMIT) break;
    if (competitor.platform !== "airbnb") continue;
    if (typeof competitor.price === "number" && Number.isFinite(competitor.price)) continue;

    attempted += 1;
    const pricing = await fetchAirbnbCompetitorPriceWithCdp(competitor.url);
    if (!pricing) continue;

    competitor.price = pricing.pricePerNight;
    competitor.currency = pricing.currency;
    const priceExtras: Record<string, unknown> = {
      pricePerNight: pricing.pricePerNight,
      totalPrice: pricing.totalPrice,
      priceNights: pricing.nights,
      priceSource: "cdp_avg_nightly_from_total",
    };
    if (pricing.currency === "MAD") {
      priceExtras.eurApprox = pricing.totalPrice * 0.1;
      priceExtras.eurApproxPerNight = pricing.pricePerNight * 0.1;
      priceExtras.eurApproxSource = "fixed_mad_to_eur_0_1";
    }
    Object.assign(competitor, priceExtras);
    successful += 1;
  }
}

export async function searchCompetitorsAroundTarget(
  input: SearchCompetitorsInput
): Promise<SearchCompetitorsResult> {
  const searchInput: SearchCompetitorsInput = (() => {
    const tgt = input.target;
    const p = String(tgt.platform ?? "").toLowerCase();
    if (p !== "booking") return input;
    const raw = tgt.url;
    if (typeof raw !== "string" || !raw.trim()) return input;
    const originalUrl = raw;
    const cleanedUrl = cleanBookingCanonicalUrl(originalUrl);
    if (DEBUG_MARKET_PIPELINE) {
      console.log(
        "[market][booking-target-url-normalized]",
        JSON.stringify({
          originalUrl,
          cleanedUrl,
          changed: originalUrl !== cleanedUrl,
        })
      );
    }
    if (originalUrl === cleanedUrl) return input;
    return { ...input, target: { ...tgt, url: cleanedUrl } };
  })();

  const overrideMax =
    typeof input.comparables?.max === "number" && Number.isFinite(input.comparables.max)
      ? input.comparables.max
      : null;
  const maxResults = Math.min(
    Math.max(Math.round(overrideMax ?? input.maxResults ?? DEFAULT_MAX_RESULTS), 1),
    MAX_MARKET_COMPARABLES
  );
  const pipelineMaxResultsBase = Math.min(maxResults, MARKET_PIPELINE_MAX_COMPARABLES);
  const marketPipelineT0 = Date.now();
  const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;
  const candidateFetchLimit = Math.min(
    Math.max(pipelineMaxResultsBase * 3, 8),
    MARKET_DISCOVERY_URL_CAP
  );
  const rawGeoCity =
    typeof input.comparables?.city === "string" ? input.comparables.city.trim() : "";
  const rawGeoCountry =
    typeof input.comparables?.country === "string" ? input.comparables.country.trim() : "";
  const geoOverrideApplied = Boolean(rawGeoCity && rawGeoCountry);
  console.log(
    "[market][geo-override]",
    JSON.stringify({
      marketCityOverride: rawGeoCity || null,
      marketCountryOverride: rawGeoCountry || null,
      applied: geoOverrideApplied,
    })
  );

  const overrideCity = normalizeMarketText(input.comparables?.city) || null;
  const overrideCountry = normalizeCountry(input.comparables?.country ?? null);
  const overridePropertyType = normalizeMarketText(input.comparables?.propertyType) || null;
  const overrideSourcePriority = (input.comparables?.sourcePriority ?? [])
    .map((source) => source.trim().toLowerCase())
    .filter((source): source is CandidateSource =>
      source === "booking" || source === "airbnb" || source === "vrbo" || source === "agoda"
    );
  let comparableTarget: ExtractedListing = input.comparables
    ? {
        ...searchInput.target,
        title: [overrideCity, overrideCountry, overridePropertyType].filter(Boolean).join(" ") || searchInput.target.title,
        description: [
          searchInput.target.description ?? "",
          overrideCity,
          overrideCountry,
          overridePropertyType,
        ].filter(Boolean).join(" "),
        locationLabel: [overrideCity, overrideCountry].filter(Boolean).join(", ") || searchInput.target.locationLabel,
        propertyType: overridePropertyType ?? searchInput.target.propertyType,
      }
    : searchInput.target;

  const parsedPropertyTypeOverride = parsePropertyTypeOverride(input.propertyTypeOverride);
  if (parsedPropertyTypeOverride) {
    comparableTarget = {
      ...comparableTarget,
      propertyType: mapPropertyTypeOverrideToListingPropertyType(parsedPropertyTypeOverride),
    };
  }

  const targetCity = overrideCity ?? resolveTargetMarketCityFromLocationOnly(comparableTarget);
  const targetCountry = overrideCountry ?? guessMarketComparisonCountry(comparableTarget);
  const targetPlatform = overrideSourcePriority[0] ?? getMarketComparisonPlatform(searchInput.target.platform);

  if (DEBUG_MARKET_PIPELINE) {
    const ext = comparableTarget as ListingWithOptionalLocation;
    console.log(
      "[market][target-city-debug]",
      JSON.stringify({
        targetTitle: comparableTarget.title ?? null,
        targetLocationLabel: comparableTarget.locationLabel ?? null,
        targetStructureLocationLabel: comparableTarget.structure?.locationLabel ?? null,
        targetLocationCity:
          typeof ext.location?.city === "string" ? ext.location.city : null,
        resolvedTargetCity: targetCity,
        normalizedTargetCity: normalizeMarketText(targetCity),
        platform: comparableTarget.platform ?? null,
      })
    );
  }
  const competitorSourcePriority =
    overrideSourcePriority.length > 0 ? overrideSourcePriority : getCompetitorSourcePriority(searchInput.target.platform);
  const isExpediaBookingMarket = targetPlatform === "booking" && isExpediaTarget(searchInput.target);
  /** Logs `[market][debug][*]` : comparables cible marché Booking uniquement. */
  const bookingMarketPipelineDebug =
    DEBUG_MARKET_PIPELINE &&
    getMarketComparisonPlatform(searchInput.target.platform) === "booking";

  const bookingTargetCoordinateFallback = resolveBookingTargetCoordinatesFallback(
    comparableTarget,
    targetCity
  );
  const comparableTargetForBookingGeo =
    bookingTargetCoordinateFallback
      ? {
          ...comparableTarget,
          latitude: comparableTarget.latitude ?? bookingTargetCoordinateFallback.latitude,
          longitude: comparableTarget.longitude ?? bookingTargetCoordinateFallback.longitude,
        }
      : comparableTarget;

  if (DEBUG_MARKET_PIPELINE && bookingTargetCoordinateFallback) {
    console.log(
      "[market][booking-target-coordinate-fallback]",
      JSON.stringify({
        targetCity,
        source: bookingTargetCoordinateFallback.source,
        latitude: bookingTargetCoordinateFallback.latitude,
        longitude: bookingTargetCoordinateFallback.longitude,
        originalLatitude: comparableTarget.latitude ?? null,
        originalLongitude: comparableTarget.longitude ?? null,
      })
    );
  }

  const hasComparableGeoOverride = Boolean(overrideCity) || Boolean(overrideCountry);
  const strictBookingComparableDiscovery =
    Boolean(input.comparables) &&
    overrideSourcePriority[0] === "booking" &&
    hasComparableGeoOverride;
  /** Garde pays : dès qu’on connaît le pays marché, on filtre les URLs /hotel/xx/ hors zone (ex. ES vs MA). */
  const discoveryGuardCountry = normalizeCountry(targetCountry);
  const comparableDiscoveryGeo =
    discoveryGuardCountry != null
      ? {
          normalizedTargetCountry: discoveryGuardCountry,
          skipEmbeddedAndNetwork: strictBookingComparableDiscovery,
        }
      : undefined;

  /** Discovery Booking : élargissement conservateur villa + pays maroc résolu (garde‑fous type/pays inchangés ailleurs). */
  const bookingVillaMoroccoDiscoveryBoost =
    getMarketComparisonPlatform(searchInput.target.platform) === "booking" &&
    !isExpediaTarget(searchInput.target) &&
    getNormalizedComparableType(comparableTarget) === "villa_like" &&
    comparableDiscoveryGeo?.normalizedTargetCountry === "morocco";

  /** Villa Maroc Booking : jusqu’à 6 finaux ; `comparables.max` peut plafonner en dessous (sinon non limité par MAX_MARKET_COMPARABLES). */
  const explicitComparableCapFromInput =
    overrideMax !== null && Number.isFinite(overrideMax) ? Math.max(1, Math.round(overrideMax)) : null;
  const pipelineComparableMax = bookingVillaMoroccoDiscoveryBoost
    ? Math.min(
        BOOKING_VILLA_MOROCCO_PIPELINE_MAX_COMPARABLES,
        explicitComparableCapFromInput ?? BOOKING_VILLA_MOROCCO_PIPELINE_MAX_COMPARABLES
      )
    : pipelineMaxResultsBase;

  console.log("[market][strategy]", {
    targetPlatform,
    targetCity,
    targetCountry,
    competitorSourcePriority,
    maxComparables: pipelineComparableMax,
    maxResultsRequested: maxResults,
    pipelineComparableMax,
    bookingVillaMoroccoDiscoveryBoost,
  });

  const competitorDiscoveryFetchLimitEffective = bookingVillaMoroccoDiscoveryBoost
    ? Math.min(
        MARKET_DISCOVERY_URL_CAP,
        Math.max(candidateFetchLimit, BOOKING_VILLA_MOROCCO_DISCOVERY_FETCH_MIN)
      )
    : candidateFetchLimit;

  console.log(
    "[market][diagnostic-start]",
    JSON.stringify({
      targetPlatform,
      targetCity,
      targetCountry,
      maxResults: pipelineComparableMax,
      candidateFetchLimit,
      candidateFetchLimitEffective: competitorDiscoveryFetchLimitEffective,
      geoOverrideApplied,
      hasComparableGeoOverride,
      strictBookingComparableDiscovery,
      skipEmbeddedAndNetwork: comparableDiscoveryGeo?.skipEmbeddedAndNetwork ?? false,
      guardCountry: comparableDiscoveryGeo?.normalizedTargetCountry ?? null,
      competitorSourcePriority,
    })
  );

  const normalizedEarlyCity = normalizeMarketText(targetCity);
  const normalizedEarlyCountry = normalizeCountry(targetCountry);
  const marketGeoInsufficient =
    !hasComparableGeoOverride && !normalizedEarlyCity && !normalizedEarlyCountry;

  let candidateUrls: CandidateUrl[] = [];
  const discoveryT0 = Date.now();
  if (marketGeoInsufficient) {
    console.log("[market][geo-insufficient]", {
      reason: "skip_booking_discovery_no_reliable_city_or_country",
      targetPlatform: searchInput.target.platform ?? null,
    });
    logMarketPipelineStage({
      stage: "skipped_booking_discovery_insufficient_geo",
      targetUrl: searchInput.target.url ?? null,
      targetPlatform: searchInput.target.platform ?? null,
    });
    auditPerfLog({
      step: "competitor-discovery",
      durationMs: Date.now() - discoveryT0,
      countIn: candidateFetchLimit,
      countOut: 0,
      platform: String(searchInput.target.platform ?? ""),
      note: "geo_insufficient_skipped",
    });
  } else {
    candidateUrls = await getCandidateUrls(
      comparableTarget,
      competitorDiscoveryFetchLimitEffective,
      overrideSourcePriority,
      comparableDiscoveryGeo,
      input.abortSignal
    );
    auditPerfLog({
      step: "competitor-discovery",
      durationMs: Date.now() - discoveryT0,
      countIn: competitorDiscoveryFetchLimitEffective,
      countOut: candidateUrls.length,
      platform: String(searchInput.target.platform ?? ""),
      note: null,
    });
  }
  const uniqueCandidates = candidateUrls
    .filter((candidate) => candidate.url !== searchInput.target.url)
    .filter((candidate, index, arr) => arr.findIndex((item) => item.url === candidate.url) === index)
    .slice(0, competitorDiscoveryFetchLimitEffective);

  logMarketPipelineStage({
    stage: "candidate_urls",
    targetUrl: searchInput.target.url ?? null,
    targetPlatform: searchInput.target.platform ?? null,
    countCandidateUrlsRaw: candidateUrls.length,
    countUniqueCandidates: uniqueCandidates.length,
  });

  console.log(
    "[market][booking-candidates]",
    JSON.stringify({
      totalUnique: uniqueCandidates.length,
      booking: uniqueCandidates.filter((c) => c.source === "booking").length,
      nonBooking: uniqueCandidates.filter((c) => c.source !== "booking").length,
    })
  );

  const extractOneComparable = async (candidate: CandidateUrl): Promise<ExtractedListing | null> => {
    if (isCompetitorSearchAborted(input)) {
      return null;
    }
    try {
      const fetchUrl =
        candidate.source === "booking"
          ? buildBookingUrlWithDates(candidate.url, searchInput.target.url ?? null)
          : candidate.url;
      if (candidate.source === "booking" && DEBUG_BOOKING_PIPELINE) {
        console.info("[market][booking-comparable-stay-dates]", {
          inputHadStayDates: bookingUrlHasStayDates(candidate.url),
          fetchUrlPreview: fetchUrl.slice(0, 220),
        });
      }
      const listing = await extractListing(
        fetchUrl,
        candidate.source === "booking" ? { skipBookingPriceRecovery: true } : undefined
      );
      if (listing && listing.url !== searchInput.target.url) {
        return listing;
      }
      return null;
    } catch (error) {
      console.warn("[market][competitor-extract-failed]", {
        url: candidate.url,
        source: candidate.source,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  const bookingCandidates = uniqueCandidates
    .filter((candidate) => candidate.source === "booking")
    .slice(0, competitorDiscoveryFetchLimitEffective);
  const fallbackCandidates = uniqueCandidates
    .filter((candidate) => candidate.source !== "booking")
    .slice(0, competitorDiscoveryFetchLimitEffective);

  auditPerfLog({
    step: "booking-candidates",
    durationMs: null,
    countIn: uniqueCandidates.length,
    countOut: bookingCandidates.length,
    platform: String(searchInput.target.platform ?? ""),
    note: null,
  });

  const normalizedTargetCityForPrefilter = normalizeMarketText(targetCity);
  const normalizedTargetCountryForPrefilter = normalizeCountry(targetCountry);
  if (
    !normalizedTargetCityForPrefilter &&
    !normalizedTargetCountryForPrefilter &&
    bookingCandidates.length > 0
  ) {
    console.log("[market][booking-prefilter-bypass]", {
      reason: "target_geo_not_exploitable",
      targetCity,
      targetCountry,
      bookingCandidateUrls: bookingCandidates.length,
    });
  }

  /** Booking + Expedia : comparables sur URLs Booking, même passeport tokens ville (pas Airbnb). */
  const isBookingTargetForGeoPrefilter = (() => {
    const p = String(searchInput.target.platform ?? "").toLowerCase();
    return p === "booking" || p === "expedia";
  })();

  const targetTypeForGeoPrefilter = getNormalizedComparableType(comparableTarget);

  console.log(
    "[market][booking-geo-prefilter-input]",
    JSON.stringify({
      count: bookingCandidates.length,
      sampleUrls: bookingCandidates.slice(0, 10).map((c) =>
        c.url.length > 220 ? `${c.url.slice(0, 217)}...` : c.url
      ),
      targetCity,
      targetCountry,
      targetPlatform: String(searchInput.target.platform ?? ""),
      targetType: targetTypeForGeoPrefilter,
      bookingOrExpediaMarket: isBookingTargetForGeoPrefilter,
    })
  );

  const bookingPreselectedAfterGeoHints = bookingCandidates.filter((candidate) => {
    const { cityHint, countryHint } = getBookingUrlHints(candidate.url);
    const hintOk = isBookingCandidateCoherentByHints({
      targetCity,
      targetCountry,
      cityHint,
      countryHint,
      url: candidate.url,
    });
    const urlTokensOk =
      isBookingTargetForGeoPrefilter &&
      bookingUrlContainsTargetCityTokens(candidate.url, targetCity);
    const accepted = hintOk || urlTokensOk;
    const normUrlHay = bookingUrlNormalizedHaystackForCityMatch(candidate.url);
    const urlNormalizedPreview =
      normUrlHay.length > 180 ? `${normUrlHay.slice(0, 177)}...` : normUrlHay;
    const cityTokens = significantCityTokensForBookingUrlMatch(normalizeMarketText(targetCity));

    const reason = accepted
      ? hintOk
        ? "accepted_coherent_hints"
        : "accepted_url_contains_target_city_tokens"
      : "rejected_hints_and_url_city_tokens";

    console.log(
      "[market][booking-geo-prefilter-decision]",
      JSON.stringify({
        url: candidate.url.length > 220 ? `${candidate.url.slice(0, 217)}...` : candidate.url,
        targetCity,
        targetCountry,
        hintOk,
        urlTokensOk,
        accepted,
        reason,
        urlNormalizedPreview,
        cityTokens,
      })
    );

    return accepted;
  });

  console.log(
    "[market][booking-geo-prefilter-output]",
    JSON.stringify({
      acceptedCount: bookingPreselectedAfterGeoHints.length,
      sampleAcceptedUrls: bookingPreselectedAfterGeoHints.slice(0, 10).map((c) =>
        c.url.length > 220 ? `${c.url.slice(0, 217)}...` : c.url
      ),
    })
  );

  const bookingPrefilterRejected =
    bookingCandidates.length - bookingPreselectedAfterGeoHints.length;
  if (bookingCandidates.length > 0) {
    console.log("[market][booking-prefilter-summary]", {
      candidatesIn: bookingCandidates.length,
      kept: bookingPreselectedAfterGeoHints.length,
      rejected: bookingPrefilterRejected,
    });
  }
  if (DEBUG_BOOKING_PIPELINE && bookingPrefilterRejected > 0) {
    console.log("[booking][competitors][prefilter_rejected_count]", {
      rejected: bookingPrefilterRejected,
      targetCity,
      targetCountry,
    });
  }

  let bookingPreselected = bookingPreselectedAfterGeoHints;

  if (
    BOOKING_TYPE_PREFILTER_ALLOW[targetTypeForGeoPrefilter] &&
    BOOKING_TYPE_PREFILTER_ALLOW[targetTypeForGeoPrefilter]!.length > 0
  ) {
    const beforeCount = bookingPreselected.length;
    const sampleRejected: string[] = [];
    const afterBookingTypePrefilter = bookingPreselected.filter((candidate) => {
      const ok = passesBookingTypePrefilter(candidate.url, targetTypeForGeoPrefilter);
      if (!ok && sampleRejected.length < 5) {
        const u = candidate.url?.trim() ?? "";
        sampleRejected.push(u.length > 160 ? `${u.slice(0, 157)}...` : u);
      }
      return ok;
    });
    console.log(
      "[market][booking-type-prefilter]",
      JSON.stringify({
        beforeCount,
        afterCount: afterBookingTypePrefilter.length,
        targetType: targetTypeForGeoPrefilter,
        rejectedCount: beforeCount - afterBookingTypePrefilter.length,
        sampleRejected,
      })
    );
    if (
      afterBookingTypePrefilter.length === 0 &&
      beforeCount > 0 &&
      isBookingTargetForGeoPrefilter
    ) {
      console.log(
        "[market][booking-type-prefilter-fallback-geo-pool]",
        JSON.stringify({
          reason: "type_prefilter_empty_restore_geo_accepted_pool",
          targetPlatform: String(searchInput.target.platform ?? ""),
          restoredCount: bookingPreselectedAfterGeoHints.length,
        })
      );
      bookingPreselected = bookingPreselectedAfterGeoHints;
    } else {
      bookingPreselected = afterBookingTypePrefilter;
    }
  }

  const bookingVillaPreselectedSoftCap = bookingVillaMoroccoDiscoveryBoost ? 10 : 5;
  if (
    targetTypeForGeoPrefilter === "villa_like" &&
    isBookingTargetForGeoPrefilter &&
    bookingPreselected.length < 3 &&
    bookingPreselectedAfterGeoHints.length > bookingPreselected.length
  ) {
    const beforeTypeCount = bookingPreselectedAfterGeoHints.length;
    const afterTypeCount = bookingPreselected.length;
    const seenUrls = new Set(
      bookingPreselected.map((c) => c.url.trim()).filter(Boolean)
    );
    const restored: CandidateUrl[] = [];
    for (const c of bookingPreselectedAfterGeoHints) {
      if (afterTypeCount + restored.length >= bookingVillaPreselectedSoftCap) {
        break;
      }
      const u = c.url.trim();
      if (!u || seenUrls.has(u)) continue;
      if (!bookingUrlPassesVillaTypeSoftRestoreHaystack(u)) continue;
      seenUrls.add(u);
      restored.push(c);
    }
    if (restored.length > 0) {
      bookingPreselected = [...bookingPreselected, ...restored].slice(
        0,
        bookingVillaPreselectedSoftCap
      );
      console.log(
        "[market][booking-type-prefilter-villa-soft-restore]",
        JSON.stringify({
          beforeTypeCount,
          afterTypeCount,
          restoredCount: restored.length,
          finalCount: bookingPreselected.length,
          sampleRestoredUrls: restored.slice(0, 5).map((c) => {
            const x = c.url.trim();
            return x.length > 160 ? `${x.slice(0, 157)}...` : x;
          }),
        })
      );
    }
  }

  logMarketPipelineStage({
    stage: "booking_prefilter",
    targetUrl: searchInput.target.url ?? null,
    targetPlatform: searchInput.target.platform ?? null,
    countBookingCandidateUrls: bookingCandidates.length,
    countBookingPreselected: bookingPreselected.length,
    countBookingPrefilterRejected: bookingCandidates.length - bookingPreselected.length,
  });
  if (DEBUG_BOOKING_PIPELINE && targetPlatform === "booking") {
    console.log("[booking][competitors][discovery]", {
      rawBookingCandidateUrls: bookingCandidates.length,
      afterHintFilter: bookingPreselected.length,
      totalUniqueCandidates: uniqueCandidates.length,
      targetCity,
      targetCountry,
    });
  }

  const bookingRawCompetitors: ExtractedListing[] = [];
  const bookingWeakMarketFallbackBuffer: Array<{
    listing: ExtractedListing;
    reason: "property_type_mismatch" | "structure_too_far";
    url: string;
  }> = [];
  const maxBookingExtractionAttempts = isExpediaBookingMarket
    ? 1
    : bookingVillaMoroccoDiscoveryBoost
      ? BOOKING_VILLA_MOROCCO_MAX_EXTRACTION_ATTEMPTS
      : MAX_BOOKING_EXTRACTION_ATTEMPTS;
  const bookingBatchSize = isExpediaBookingMarket ? 1 : COMPETITOR_BATCH_SIZE;
  const bookingComparableExtractionCap = maxBookingExtractionAttempts;
  /** Plafond de comparables bruts gardés avant filtre marché ; villa+MA peut dépasser le plafond pipeline de base pour meilleur classement prix. */
  const bookingLoopRawKeepsCeiling = bookingVillaMoroccoDiscoveryBoost
    ? Math.min(
        BOOKING_VILLA_MOROCCO_EXTRACTION_RAW_KEEP_CEILING,
        maxBookingExtractionAttempts,
        Math.max(pipelineComparableMax, bookingPreselected.length || 1)
      )
    : pipelineComparableMax;
  const bookingTargetMissingPrice =
    searchInput.target.platform === "booking" && !hasPlausibleComparablePrice(searchInput.target);
  const pricedComparableStopTarget = Math.min(
    3,
    pipelineComparableMax,
    Math.max(
      1,
      Number.isFinite(BOOKING_PRICED_COMPARABLE_STOP_TARGET)
        ? BOOKING_PRICED_COMPARABLE_STOP_TARGET
        : 2
    )
  );
  const effectivePricedComparableStopTarget = isExpediaBookingMarket
    ? 1
    : bookingVillaMoroccoDiscoveryBoost
      ? bookingLoopRawKeepsCeiling
      : pricedComparableStopTarget;
  const validComparableStopTarget = isExpediaBookingMarket ? 1 : bookingLoopRawKeepsCeiling;
  let pricedBookingComparables = 0;
  let bookingExtractListingReturned = 0;
  console.log("[market][budget] candidateExtractionCap", {
    source: "booking",
    candidateCount: bookingPreselected.length,
    maxBookingExtractionAttempts,
    bookingBatchSize,
    pricedComparableStopTarget: effectivePricedComparableStopTarget,
    validComparableStopTarget,
  });

  console.log("[market][booking-discovery]", {
    targetCity,
    targetCountry,
    targetPropertyType: getNormalizedComparableType(comparableTarget),
    candidateCount: bookingPreselected.length,
    batchMode: `batch_${COMPETITOR_BATCH_SIZE}_max_${maxBookingExtractionAttempts}`,
  });

  if (DEBUG_MARKET_PIPELINE) {
    console.log(
      "[market][debug][booking-discovery-depth]",
      JSON.stringify({
        targetType: getNormalizedComparableType(comparableTarget),
        guardCountry: comparableDiscoveryGeo?.normalizedTargetCountry ?? null,
        candidateFetchLimit,
        competitorDiscoveryFetchLimitEffective,
        MARKET_DISCOVERY_URL_CAP,
        bookingVillaMoroccoDiscoveryBoost,
        rawCandidateUrlsCount: candidateUrls.length,
        afterUniqueCandidatesCount: uniqueCandidates.length,
        afterGeoHintsPrefilterCount: bookingPreselectedAfterGeoHints.length,
        bookingCandidatesCount: bookingCandidates.length,
        fallbackCandidatesCount: fallbackCandidates.length,
        bookingVillaPreselectedSoftCap,
        selectedForExtractionCount: bookingPreselected.length,
        extractionAttemptsLimit: maxBookingExtractionAttempts,
      })
    );

    if (bookingCandidates.length > 0) {
      const urlKey = (u: string) => u.trim().toLowerCase();
      const selectedUrlSet = new Set(
        bookingPreselected.map((c) => urlKey(c.url)).filter(Boolean)
      );
      const geoUrlSet = new Set(
        bookingPreselectedAfterGeoHints.map((c) => urlKey(c.url)).filter(Boolean)
      );
      const typeAllowlistActive = Boolean(
        BOOKING_TYPE_PREFILTER_ALLOW[targetTypeForGeoPrefilter]?.length
      );

      const formatCandidateRow = (
        c: CandidateUrl,
        indexInBookingCandidates: number
      ): {
        index: number;
        url: string;
        title: string | null;
        source: CandidateSource;
      } => {
        const raw = (c.url ?? "").trim();
        const urlOut = raw.length > 220 ? `${raw.slice(0, 217)}...` : raw;
        return {
          index: indexInBookingCandidates,
          url: urlOut,
          title: typeof c.title === "string" && c.title.trim() ? c.title.trim() : null,
          source: c.source,
        };
      };

      const selectedMapped = bookingPreselected.map((c) => {
        const idx = bookingCandidates.findIndex(
          (bc) => urlKey(bc.url) === urlKey(c.url)
        );
        const row = formatCandidateRow(c, idx >= 0 ? idx : -1);

        let selectionReason = "";
        if (!geoUrlSet.has(urlKey(c.url))) {
          selectionReason = "unexpected_not_in_geo_pool";
        } else if (!typeAllowlistActive) {
          selectionReason = "geo_hints_only_type_allowlist_inactive";
        } else if (passesBookingTypePrefilter(c.url, targetTypeForGeoPrefilter)) {
          selectionReason = "geo_hints_and_booking_type_prefilter_allow";
        } else {
          selectionReason =
            "included_via_geo_then_villa_soft_restore_or_empty_type_fallback_elsewhere";
        }

        return { ...row, selectionReason };
      });

      const notSelectedMapped = bookingCandidates
        .map((c, bookingIndex) => {
          if (selectedUrlSet.has(urlKey(c.url))) return null;
          const row = formatCandidateRow(c, bookingIndex);
          let nonSelectionReason = "";

          if (!geoUrlSet.has(urlKey(c.url))) {
            nonSelectionReason =
              "excluded_geo_hints_prefilter_hints_and_url_city_tokens";
          } else if (
            typeAllowlistActive &&
            !passesBookingTypePrefilter(c.url, targetTypeForGeoPrefilter)
          ) {
            nonSelectionReason = "booking_type_prefilter_slug_pattern_allowlist";
          } else {
            nonSelectionReason =
              "other_post_geo_allowlist(slice_dedupe_villa_restore_see_prefilter_logs)";
          }

          return { ...row, nonSelectionReason };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);

      console.log(
        "[market][debug][booking-preselected-build]",
        JSON.stringify({
          bookingCandidatesCount: bookingCandidates.length,
          fallbackCandidatesCount: fallbackCandidates.length,
          bookingVillaPreselectedSoftCap,
          selectedForExtractionCount: bookingPreselected.length,
          extractionAttemptsLimit: maxBookingExtractionAttempts,
          typePrefilterAllowlistActive: typeAllowlistActive,
          bookingPreselectedAfterGeoHintsCount: bookingPreselectedAfterGeoHints.length,
          selected: selectedMapped,
          notSelected: notSelectedMapped,
        })
      );
    }
  }

  const tryBufferBookingWeakMarketFallback = (
    listing: ExtractedListing,
    reason: "property_type_mismatch" | "structure_too_far",
    candidateUrl: string
  ) => {
    if (String(searchInput.target.platform ?? "").toLowerCase() !== "booking") return;
    if (!targetCity?.trim()) return;
    if (getNormalizedComparableType(comparableTarget) !== "villa_like") return;
    const titleTrim = (listing.title ?? "").trim();
    if (!titleTrim || /untitled/i.test(listing.title ?? "")) return;
    if (!hasPlausibleComparablePrice(listing)) return;
    if (!isGeoCompatible(listing, targetCity)) return;
    if (!bookingUrlContainsTargetCityTokens(candidateUrl, targetCity)) return;
    if (String(listing.platform ?? "").toLowerCase() !== "booking") return;

    const key = candidateUrl.trim();
    const existing = bookingWeakMarketFallbackBuffer.findIndex((x) => x.url.trim() === key);
    if (existing >= 0) {
      if (
        reason === "structure_too_far" &&
        bookingWeakMarketFallbackBuffer[existing]!.reason === "property_type_mismatch"
      ) {
        bookingWeakMarketFallbackBuffer[existing] = { listing, reason, url: candidateUrl };
      }
      return;
    }
    bookingWeakMarketFallbackBuffer.push({ listing, reason, url: candidateUrl });
  };

  let consecutiveBookingGeoRejects = 0;
  if (bookingPreselected.length === 0) {
    console.log("[market][booking-loop-skipped]", { reason: "booking_preselected_empty" });
  }
  const bookingExtractLoopT0 = Date.now();
  let bookingBatchesUsed = 0;
  let bookingStoppedAfterEnough = false;
  let bookingMaxAttemptsReached = false;
  let bookingExtractionAttempts = 0;

  bookingBatchLoop: if (bookingPreselected.length > 0) {
    for (let off = 0; off < bookingPreselected.length; ) {
      if (bookingExtractionAttempts >= maxBookingExtractionAttempts) {
        break bookingBatchLoop;
      }
      if (bookingRawCompetitors.length >= validComparableStopTarget) {
        bookingStoppedAfterEnough = true;
        break bookingBatchLoop;
      }
      if (isCompetitorSearchAborted(input)) {
        console.log("[market][budget] timeoutAbort", {
          stage: "booking_loop",
          openedCandidates: bookingExtractionAttempts,
          keptCandidates: bookingRawCompetitors.length,
        });
        break bookingBatchLoop;
      }
      if (pricedBookingComparables >= effectivePricedComparableStopTarget) {
        console.log("[market][budget] stopEarlyEnoughComparables", {
          source: "booking",
          pricedComparables: pricedBookingComparables,
          keptCandidates: bookingRawCompetitors.length,
          validComparableStopTarget,
        });
        bookingStoppedAfterEnough = true;
        break bookingBatchLoop;
      }

      const remainingSlots = maxBookingExtractionAttempts - bookingExtractionAttempts;
      const batchUrls = bookingPreselected.slice(
        off,
        off + Math.min(bookingBatchSize, remainingSlots)
      );
      if (batchUrls.length === 0) break bookingBatchLoop;
      bookingBatchesUsed += 1;

      const extractedBatch = await runLimitedConcurrency(
        batchUrls,
        COMPETITOR_EXTRACT_CONCURRENCY,
        (c) => extractOneComparable(c)
      );
      bookingExtractionAttempts += batchUrls.length;
      bookingExtractListingReturned += extractedBatch.filter(Boolean).length;

      for (let bi = 0; bi < extractedBatch.length; bi++) {
        const listing = extractedBatch[bi];
        const batchCandidate = batchUrls[bi]!;
        const batchCandidateUrl = batchCandidate.url;
        if (!listing) {
          logMarketDebugBookingRawKeepDecision({
            listing: null,
            urlFallback: batchCandidateUrl,
            keep: false,
            reason: "extract_returned_null",
          });
          logMarketBookingExtractionRejected("extract_returned_null", batchCandidateUrl, null);
          continue;
        }
        if (DEBUG_MARKET_PIPELINE) {
          console.log(
            "[market][booking-extracted-coordinates-debug]",
            JSON.stringify({
              url: listing.url ?? batchCandidateUrl,
              title: listing.title ?? null,
              city: guessListingCity(listing),
              latitude: listing.latitude ?? null,
              longitude: listing.longitude ?? null,
              distanceKm: getDistanceKm(
                comparableTargetForBookingGeo.latitude,
                comparableTargetForBookingGeo.longitude,
                listing.latitude,
                listing.longitude
              ),
              targetLatitude: comparableTargetForBookingGeo.latitude ?? null,
              targetLongitude: comparableTargetForBookingGeo.longitude ?? null,
              targetCity,
              propertyType: listing.propertyType ?? null,
              price: listing.price ?? null,
            })
          );
        }
        if (bookingRawCompetitors.length >= validComparableStopTarget) {
          bookingStoppedAfterEnough = true;
          break bookingBatchLoop;
        }
        if (isCompetitorSearchAborted(input)) {
          console.log("[market][budget] timeoutAbort", {
            stage: "booking_loop",
            openedCandidates: bookingExtractionAttempts,
            keptCandidates: bookingRawCompetitors.length,
          });
          break bookingBatchLoop;
        }
        if (pricedBookingComparables >= effectivePricedComparableStopTarget) {
          console.log("[market][budget] stopEarlyEnoughComparables", {
            source: "booking",
            pricedComparables: pricedBookingComparables,
            keptCandidates: bookingRawCompetitors.length,
            validComparableStopTarget,
          });
          bookingStoppedAfterEnough = true;
          break bookingBatchLoop;
        }

        const geoCheck = isGeoCompatible(listing, targetCity);
        const distanceKmGuard = getDistanceKm(
          comparableTargetForBookingGeo.latitude,
          comparableTargetForBookingGeo.longitude,
          listing.latitude,
          listing.longitude
        );
        const candidateCityForGuard = guessListingCity(listing);
        const guardUrlRaw = listing.url ?? batchCandidateUrl;
        const guardUrlOut =
          guardUrlRaw.length > 220 ? `${guardUrlRaw.slice(0, 217)}...` : guardUrlRaw;
        if (DEBUG_MARKET_PIPELINE && !geoCheck) {
          console.log(
            "[market][booking-distance-guard]",
            JSON.stringify({
              url: guardUrlOut,
              title: listing.title ?? null,
              targetCity,
              candidateCity: candidateCityForGuard,
              targetLatitude: comparableTargetForBookingGeo.latitude ?? null,
              targetLongitude: comparableTargetForBookingGeo.longitude ?? null,
              latitude: listing.latitude ?? null,
              longitude: listing.longitude ?? null,
              distanceKm: distanceKmGuard,
              acceptedWithinRadius: distanceKmGuard === null ? null : distanceKmGuard <= 10,
            })
          );
        }

        const comparableNormType = getNormalizedComparableType(comparableTarget);
        const refinedComparableType = refineComparableTargetTypeForBookingExtraction(
          comparableTarget,
          comparableNormType
        );
        const effectiveVillaLikeTarget =
          refinedComparableType === "villa_like" || comparableNormType === "villa_like";
        const urlInferredForType = inferBookingCandidateTypeFromUrl(batchCandidateUrl);
        const villaUrlTypeOverrideEligible =
          effectiveVillaLikeTarget &&
          bookingUrlSupportsVillaExtractionTypeOverride(urlInferredForType);
        const baseTypeCheck = isTypeCompatible(listing, comparableNormType);
        let typeCheck = baseTypeCheck;
        let bookingVillaUrlTypeOverrideApplied = false;
        if (!typeCheck && villaUrlTypeOverrideEligible) {
          typeCheck = true;
          bookingVillaUrlTypeOverrideApplied = true;
        }
        if (!geoCheck || !typeCheck) {
          if (!geoCheck) {
            consecutiveBookingGeoRejects += 1;
            if (consecutiveBookingGeoRejects >= BOOKING_CONSECUTIVE_GEO_REJECT_LIMIT) {
              console.log("[market][budget] stopConsecutiveGeoRejects", {
                limit: BOOKING_CONSECUTIVE_GEO_REJECT_LIMIT,
                attempts: bookingExtractionAttempts,
              });
              break bookingBatchLoop;
            }
          } else {
            consecutiveBookingGeoRejects = 0;
          }
          const rejectReason =
            !geoCheck && !typeCheck
              ? "geo_and_type_mismatch"
              : !geoCheck
                ? "geo_mismatch"
                : "property_type_mismatch";
          if (geoCheck && !typeCheck && rejectReason === "property_type_mismatch") {
            tryBufferBookingWeakMarketFallback(
              listing,
              "property_type_mismatch",
              batchCandidateUrl
            );
          }
          logMarketDebugBookingRawKeepDecision({
            listing,
            urlFallback: batchCandidateUrl,
            keep: false,
            reason: rejectReason,
          });
          logMarketBookingExtractionRejected(rejectReason, batchCandidateUrl, listing);
          if (DEBUG_GUEST_AUDIT) {
            console.log("[market][candidate-rejected]", {
              platform: listing.platform ?? "booking",
              title: listing.title ?? null,
              city: guessListingCity(listing),
              country: guessListingCountry(listing),
              propertyType: listing.propertyType ?? null,
              geoCheck,
              typeCheck,
              reason: rejectReason,
            });
          }
          continue;
        }

        consecutiveBookingGeoRejects = 0;

        const structureMismatch = !isBedroomOrCapacityWithinOne(comparableTarget, listing);
        if (DEBUG_MARKET_PIPELINE) {
          const rawU = listing.url?.trim() ?? batchCandidateUrl;
          const urlOut = rawU.length > 220 ? `${rawU.slice(0, 217)}...` : rawU;
          console.log(
            "[market][booking-structure-soft-keep-precheck]",
            JSON.stringify({
              url: urlOut,
              title: listing.title ?? null,
              targetPropertyType: comparableTarget.propertyType ?? null,
              targetNormalizedType: getNormalizedComparableType(comparableTarget),
              targetPlatform: comparableTarget.platform ?? null,
              listingPlatform: listing.platform ?? null,
              candidateCity: guessListingCity(listing),
              targetCity,
              propertyType: listing.propertyType ?? null,
              candidateNormalizedType: getNormalizedComparableType(listing),
              price: listing.price ?? null,
              bedrooms: listing.bedrooms ?? listing.bedroomCount ?? null,
              capacity: listing.capacity ?? listing.guestCapacity ?? null,
              structureMismatch,
            })
          );
        }
        const villaStructureSoftKeep =
          structureMismatch &&
          isBookingVillaStructureSoftKeep(comparableTarget, listing, targetCity);
        if (structureMismatch && !villaStructureSoftKeep) {
          tryBufferBookingWeakMarketFallback(listing, "structure_too_far", batchCandidateUrl);
          logMarketDebugBookingRawKeepDecision({
            listing,
            urlFallback: batchCandidateUrl,
            keep: false,
            reason: "structure_too_far",
          });
          logMarketBookingExtractionRejected("structure_too_far", batchCandidateUrl, listing);
          if (DEBUG_GUEST_AUDIT) {
            console.log("[market][candidate-rejected]", {
              platform: listing.platform ?? "booking",
              title: listing.title ?? null,
              city: guessListingCity(listing),
              country: guessListingCountry(listing),
              propertyType: listing.propertyType ?? null,
              reason: "structure_too_far",
            });
          }
          continue;
        }
        if (villaStructureSoftKeep && DEBUG_MARKET_PIPELINE) {
          const rawU = listing.url?.trim() ?? batchCandidateUrl;
          const urlOut = rawU.length > 220 ? `${rawU.slice(0, 217)}...` : rawU;
          console.log(
            "[market][booking-villa-structure-extraction-soft-keep]",
            JSON.stringify({
              url: urlOut,
              title: listing.title ?? null,
              city: guessListingCity(listing),
              propertyType: listing.propertyType ?? null,
              bedrooms: listing.bedrooms ?? listing.bedroomCount ?? null,
              bathrooms: listing.bathrooms ?? null,
              capacity: listing.capacity ?? listing.guestCapacity ?? null,
              price:
                typeof listing.price === "number" && Number.isFinite(listing.price)
                  ? listing.price
                  : null,
            })
          );
        }

        const targetVillaFamilyPreFilter =
          detectPropertyTypeFromListingText(
            comparableTarget.title ?? "",
            comparableTarget.description ?? ""
          ) === "villa" || getNormalizedComparableType(comparableTarget) === "villa_like";
        const titleTrimPre = (listing.title ?? "").trim();
        const cityGuessLowerPre = (guessListingCity(listing) ?? "").toLowerCase();
        const detectedKindPre = detectPropertyTypeFromListingText(
          listing.title ?? "",
          listing.description ?? ""
        );
        const weakQualityPrePush =
          targetVillaFamilyPreFilter &&
          String(listing.platform ?? "").toLowerCase() === "booking" &&
          detectedKindPre === "unknown" &&
          (!titleTrimPre ||
            /untitled/i.test(listing.title ?? "") ||
            cityGuessLowerPre === "untitled" ||
            /\buntitled\b/i.test(cityGuessLowerPre));
        if (weakQualityPrePush) {
          logMarketDebugBookingRawKeepDecision({
            listing,
            urlFallback: batchCandidateUrl,
            keep: false,
            reason: "weak_booking_comparable",
          });
          logMarketBookingExtractionRejected("weak_booking_comparable", batchCandidateUrl, listing);
          if (DEBUG_GUEST_AUDIT) {
            console.log("[market][candidate-rejected]", {
              platform: listing.platform ?? "booking",
              title: listing.title ?? null,
              city: guessListingCity(listing),
              country: guessListingCountry(listing),
              propertyType: listing.propertyType ?? null,
              reason: "weak_booking_comparable",
            });
          }
          continue;
        }

        logMarketDebugBookingRawKeepDecision({
          listing,
          urlFallback: batchCandidateUrl,
          keep: true,
        });
        bookingRawCompetitors.push(listing);
        if (bookingVillaUrlTypeOverrideApplied && DEBUG_MARKET_PIPELINE) {
          console.log(
            "[market][competitor-kept]",
            JSON.stringify({
              stage: "booking_raw_pool",
              url: listing.url ?? batchCandidateUrl,
              title: listing.title ?? null,
              propertyType: listing.propertyType ?? null,
              urlInferredType: urlInferredForType,
              note: "booking_url_type_override:villa_like",
            })
          );
        }
        if (hasPlausibleComparablePrice(listing)) {
          pricedBookingComparables += 1;
        }

        if (
          isExpediaBookingMarket &&
          (pricedBookingComparables >= effectivePricedComparableStopTarget ||
            bookingRawCompetitors.length >= validComparableStopTarget)
        ) {
          console.log("[market][budget] stopEarlyEnoughComparables", {
            source: "booking",
            pricedComparables: pricedBookingComparables,
            keptCandidates: bookingRawCompetitors.length,
            validComparableStopTarget,
          });
          bookingStoppedAfterEnough = true;
          break bookingBatchLoop;
        }

        if (
          bookingTargetMissingPrice &&
          bookingExtractionAttempts >= bookingComparableExtractionCap &&
          bookingRawCompetitors.length === 0 &&
          pricedBookingComparables === 0
        ) {
          console.log("[market][budget] stopEarlyBookingWeakSignal", {
            attempts: bookingExtractionAttempts,
            reason: "exhausted_extraction_cap_unpriced_target_no_raw",
            candidateExtractionCap: bookingComparableExtractionCap,
          });
          break bookingBatchLoop;
        }
      }

      off += batchUrls.length;
      if (bookingRawCompetitors.length >= validComparableStopTarget) {
        bookingStoppedAfterEnough = true;
        break bookingBatchLoop;
      }
    }
    bookingMaxAttemptsReached =
      bookingExtractionAttempts >= maxBookingExtractionAttempts &&
      !bookingStoppedAfterEnough &&
      bookingRawCompetitors.length < validComparableStopTarget;
  }

  if (
    String(searchInput.target.platform ?? "").toLowerCase() === "booking" &&
    Boolean(targetCity?.trim()) &&
    getNormalizedComparableType(comparableTarget) === "villa_like" &&
    bookingRawCompetitors.length === 0 &&
    bookingWeakMarketFallbackBuffer.length > 0
  ) {
    const rank = (r: "property_type_mismatch" | "structure_too_far") =>
      r === "structure_too_far" ? 0 : 1;
    const sorted = [...bookingWeakMarketFallbackBuffer].sort(
      (a, b) => rank(a.reason) - rank(b.reason)
    );
    const seen = new Set<string>();
    const picked: typeof bookingWeakMarketFallbackBuffer = [];
    for (const item of sorted) {
      if (picked.length >= 3) break;
      const u = item.url.trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      picked.push(item);
    }

    for (const item of picked) {
      const urlRaw = item.listing.url?.trim() || item.url;
      console.log(
        "[market][booking-weak-market-fallback-candidate]",
        JSON.stringify({
          url: urlRaw.length > 220 ? `${urlRaw.slice(0, 217)}...` : urlRaw,
          title: item.listing.title ?? null,
          propertyType: item.listing.propertyType ?? null,
          bedrooms: item.listing.bedrooms ?? item.listing.bedroomCount ?? null,
          bathrooms: item.listing.bathrooms ?? null,
          price:
            typeof item.listing.price === "number" && Number.isFinite(item.listing.price)
              ? item.listing.price
              : null,
          reason: item.reason,
        })
      );
      const merged = {
        ...item.listing,
        url: urlRaw || item.url,
        weakBookingMarketFallback: true,
      } as ExtractedListing;
      logMarketDebugBookingRawKeepDecision({
        listing: merged,
        urlFallback: urlRaw,
        keep: true,
      });
      bookingRawCompetitors.push(merged);
      if (hasPlausibleComparablePrice(item.listing)) {
        pricedBookingComparables += 1;
      }
    }

    console.log(
      "[market][booking-weak-market-fallback-applied]",
      JSON.stringify({
        count: picked.length,
        reasons: picked.map((p) => p.reason),
        sampleUrls: picked.map((p) => {
          const u = (p.listing.url ?? p.url).trim();
          return u.length > 160 ? `${u.slice(0, 157)}...` : u;
        }),
      })
    );
  }

  if (DEBUG_MARKET_PIPELINE) {
    console.log(
      "[market][booking-raw-kept]",
      JSON.stringify({
        count: bookingRawCompetitors.length,
        entries: bookingRawCompetitors.slice(0, 5).map((listing) => {
          const rawUrl = listing.url?.trim() ?? "";
          const urlOut =
            rawUrl.length > 220 ? `${rawUrl.slice(0, 217)}...` : rawUrl;
          return {
            url: urlOut,
            title: listing.title ?? null,
            platform: listing.platform ?? null,
            city: guessListingCity(listing),
            country: guessListingCountry(listing),
            propertyType: listing.propertyType ?? null,
            normalizedType: getNormalizedComparableType(listing),
            bedrooms: listing.bedrooms ?? listing.bedroomCount ?? null,
            bathrooms: listing.bathrooms ?? null,
            capacity: listing.capacity ?? listing.guestCapacity ?? null,
            price:
              typeof listing.price === "number" && Number.isFinite(listing.price)
                ? listing.price
                : null,
            currency: listing.currency ?? null,
          };
        }),
      })
    );
  }

  auditPerfLog({
    step: "booking-extraction",
    durationMs: Date.now() - bookingExtractLoopT0,
    countIn: bookingExtractionAttempts,
    countOut: bookingRawCompetitors.length,
    platform: "booking",
    note: [
      "booking_batch_mode",
      `booking_batches_used:${bookingBatchesUsed}`,
      bookingStoppedAfterEnough ? "stopped_after_enough_comparables" : "",
      bookingMaxAttemptsReached ? "max_attempts_reached" : "",
      "parallel_limit_3",
    ]
      .filter(Boolean)
      .join(" "),
  });

  logMarketPipelineStage({
    stage: "booking_loop_done",
    targetUrl: searchInput.target.url ?? null,
    targetPlatform: searchInput.target.platform ?? null,
    bookingExtractionAttempts,
    countExtractListingReturned: bookingExtractListingReturned,
    countBookingRawCompetitors: bookingRawCompetitors.length,
    pricedBookingComparables,
  });

  console.log(
    "[market][booking-extraction-summary]",
    JSON.stringify({
      bookingPreselectedCount: bookingPreselected.length,
      bookingExtractionAttempts,
      bookingExtractListingReturned,
      bookingRawCompetitorsCount: bookingRawCompetitors.length,
      pricedBookingComparables,
    })
  );

  if (bookingMarketPipelineDebug) {
    console.log(
      "[market][debug][post-extraction]",
      JSON.stringify({
        extractedCount: bookingRawCompetitors.length,
        attempts: bookingExtractionAttempts,
        entries: bookingRawCompetitors.map((l) => ({
          title: l.title ?? null,
          price:
            typeof l.price === "number" && Number.isFinite(l.price) ? l.price : null,
          propertyType: l.propertyType ?? null,
          url: ((u: string) => (u.length > 240 ? `${u.slice(0, 237)}...` : u))(
            (l.url ?? "").trim()
          ),
        })),
      })
    );
  }

  const bookingSanitized = dedupeListings(bookingRawCompetitors, comparableTarget);
  const bookingOrdered = bookingSanitized;
  let bookingCompetitors = filterCompetitorsByPropertyAndStructure(
    comparableTarget,
    bookingOrdered,
    pipelineComparableMax
  );

  if (bookingMarketPipelineDebug) {
    const bookingStructureTraceStrict = debugTracePropertyStructureFilter(
      comparableTarget,
      bookingOrdered,
      pipelineComparableMax
    );
    console.log(
      "[market][debug][post-structure-filter]",
      JSON.stringify({
        phase: "booking_strict_structure_filter",
        maxKeep: pipelineComparableMax,
        keptCountAfterStrict: bookingCompetitors.length,
        orderedCount: bookingOrdered.length,
        relaxedFallbackEligible:
          bookingCompetitors.length === 0 && bookingOrdered.length > 0,
        rejectedRulesCount: bookingStructureTraceStrict.trace.filter(
          (t) => t.outcome === "rejected_rules"
        ).length,
        skippedQuotaCount: bookingStructureTraceStrict.trace.filter(
          (t) => t.outcome === "skipped_quota"
        ).length,
        trace: bookingStructureTraceStrict.trace,
      })
    );
  }

  if (bookingCompetitors.length === 0 && bookingOrdered.length > 0) {
    const relaxedFallback = bookingOrdered
      .filter((listing) =>
        isTypeCompatible(listing, getNormalizedComparableType(comparableTarget))
      )
      .filter((listing) => isBedroomOrCapacityWithinOne(comparableTarget, listing))
      .sort((a, b) => {
        const aPriced = hasPlausibleComparablePrice(a) ? 1 : 0;
        const bPriced = hasPlausibleComparablePrice(b) ? 1 : 0;
        return bPriced - aPriced;
      })
      .slice(0, Math.min(pipelineComparableMax, 2));

    if (relaxedFallback.length > 0) {
      console.log("[market][relaxed-fallback]", {
        reason: "strict_filters_returned_zero",
        selected: relaxedFallback.length,
      });
      bookingCompetitors = relaxedFallback;
    }
  }

  if (bookingMarketPipelineDebug) {
    console.log(
      "[market][debug][post-structure-filter]",
      JSON.stringify({
        phase: "booking_after_relaxed_fallback_if_any",
        keptCountFinal: bookingCompetitors.length,
        note: "Voir phase booking_strict_structure_filter pour trace règles / quota.",
      })
    );
  }

  const wouldFallbackForQuota = bookingCompetitors.length < pipelineComparableMax;
  let needsFallback = wouldFallbackForQuota;
  /** Au moins 1 comparable Booking retenu après filtres structure (spec utilisateur). */
  const bookingHasFilteredComparable = bookingCompetitors.length >= 1;
  /** Au moins 1 extrait Booking brut (contexte marché même si filtre strict écarte tout). */
  const bookingHasRawComparable = bookingRawCompetitors.length >= 1;
  let fallbackSkippedBookingHasContext = false;
  if (bookingHasFilteredComparable || bookingHasRawComparable) {
    if (wouldFallbackForQuota) {
      fallbackSkippedBookingHasContext = true;
    }
    needsFallback = false;
  }

  let airbnbDiscoveryMs = 0;
  const airbnbFallbackUrlBag: CandidateUrl[] = [];
  if (
    needsFallback &&
    String(searchInput.target.platform ?? "").toLowerCase() === "airbnb" &&
    !isCompetitorSearchAborted(input)
  ) {
    const shortfall = pipelineComparableMax - bookingCompetitors.length;
    const discoverCap = Math.min(
      MAX_FALLBACK_EXTRACTION_ATTEMPTS,
      Math.min(
        Number.isFinite(AIRBNB_FALLBACK_COMPETITOR_DISCOVERY_MAX)
          ? Math.max(AIRBNB_FALLBACK_COMPETITOR_DISCOVERY_MAX, 1)
          : 4,
        Math.max(shortfall + 1, 1)
      )
    );
    const airbnbDiscT0 = Date.now();
    try {
      const seenUrls = new Set<string>();
      const villaFallbackDiscovery =
        getNormalizedComparableType(comparableTarget) === "villa_like";
      const discoveryTargets = villaFallbackDiscovery
        ? villaAirbnbStrongFallbackShadowTargets(comparableTarget, targetCity)
        : [comparableTarget];

      for (const discoveryTarget of discoveryTargets) {
        if (airbnbFallbackUrlBag.length >= discoverCap) break;
        const found = await searchAirbnbCompetitorCandidates(discoveryTarget, discoverCap);
        for (const item of found) {
          const url = item.url?.trim() ?? "";
          if (!url || url === searchInput.target.url) continue;
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);
          airbnbFallbackUrlBag.push({
            url,
            source: "airbnb",
            title: item.title ?? null,
          });
          if (airbnbFallbackUrlBag.length >= discoverCap) break;
        }
      }
    } catch (error) {
      console.error("[market][airbnb-fallback-discovery]", error);
    }
    airbnbDiscoveryMs = Date.now() - airbnbDiscT0;
  }

  const fallbackExtractPoolFull: CandidateUrl[] = (() => {
    const seen = new Set<string>();
    const out: CandidateUrl[] = [];
    for (const c of [...fallbackCandidates, ...airbnbFallbackUrlBag]) {
      if (c.url === searchInput.target.url) continue;
      if (seen.has(c.url)) continue;
      seen.add(c.url);
      out.push(c);
    }
    return out;
  })();
  const fallbackLimitApplied =
    fallbackExtractPoolFull.length > MAX_FALLBACK_EXTRACTION_ATTEMPTS;

  const nonBookingCandidateCount = uniqueCandidates.filter((c) => c.source !== "booking").length;
  const FALLBACK_EXTRACT_CAP_ZERO_BOOKING = MAX_FALLBACK_EXTRACTION_ATTEMPTS;
  let fallbackExtractPoolForExtract = fallbackExtractPoolFull;
  const airbnbFallbackTargetType = getNormalizedComparableType(comparableTarget);
  if (airbnbFallbackTargetType === "villa_like") {
    const beforeAirbnbType = fallbackExtractPoolForExtract.length;
    const sampleRejected: string[] = [];
    let rejectedNoTypeSignalCount = 0;
    let rejectedNegativeTypeSignalCount = 0;
    fallbackExtractPoolForExtract = fallbackExtractPoolForExtract.filter((c) => {
      if (c.source !== "airbnb") return true;
      const decision = classifyVillaAirbnbFallbackAirbnbCandidate(c.url, c.title);
      if (decision === "keep") return true;
      if (decision === "negative") rejectedNegativeTypeSignalCount += 1;
      else rejectedNoTypeSignalCount += 1;
      if (sampleRejected.length < 5) {
        const u = c.url?.trim() ?? "";
        sampleRejected.push(u.length > 160 ? `${u.slice(0, 157)}...` : u);
      }
      return false;
    });
    console.log(
      "[market][airbnb-type-prefilter]",
      JSON.stringify({
        beforeCount: beforeAirbnbType,
        afterCount: fallbackExtractPoolForExtract.length,
        targetType: airbnbFallbackTargetType,
        rejectedNoTypeSignalCount,
        rejectedNegativeTypeSignalCount,
        sampleRejected,
      })
    );
  }
  if (
    geoOverrideApplied &&
    bookingCandidates.length === 0 &&
    fallbackExtractPoolForExtract.length > FALLBACK_EXTRACT_CAP_ZERO_BOOKING
  ) {
    const beforeCount = fallbackExtractPoolForExtract.length;
    fallbackExtractPoolForExtract = fallbackExtractPoolForExtract.slice(
      0,
      FALLBACK_EXTRACT_CAP_ZERO_BOOKING
    );
    console.log(
      "[market][performance-guard]",
      JSON.stringify({
        reason: "zero_booking_urls_cap_non_booking_fallback_extract",
        beforeCount,
        afterCount: fallbackExtractPoolForExtract.length,
        geoOverrideApplied,
        bookingCandidateCount: bookingCandidates.length,
        nonBookingCandidateCount,
      })
    );
  }

  logMarketPipelineStage({
    stage: "needs_fallback_decision",
    targetUrl: searchInput.target.url ?? null,
    targetPlatform: searchInput.target.platform ?? null,
    bookingCompetitorsLength: bookingCompetitors.length,
    fallbackCandidatesLength: fallbackCandidates.length,
    airbnbFallbackUrlsDiscovered: airbnbFallbackUrlBag.length,
    fallbackExtractPoolLength: fallbackExtractPoolForExtract.length,
    needsFallback,
    maxResults: pipelineComparableMax,
  });
  let fallbackExtractMs = 0;
  const fallbackRawCompetitors: ExtractedListing[] = [];
  let fallbackExtractionAttempts = 0;
  let fallbackBatchesUsed = 0;
  let fallbackStoppedAfterEnough = false;
  let fallbackMaxAttemptsReached = false;
  if (needsFallback && !isCompetitorSearchAborted(input)) {
    const fbExtractT0 = Date.now();
    const pool = fallbackExtractPoolForExtract;
    fallbackBatchLoop: for (let off = 0; off < pool.length; ) {
      if (fallbackExtractionAttempts >= MAX_FALLBACK_EXTRACTION_ATTEMPTS) {
        break fallbackBatchLoop;
      }
      if (isCompetitorSearchAborted(input)) {
        break fallbackBatchLoop;
      }

      const mergedSanitized = dedupeListings(
        [...bookingRawCompetitors, ...fallbackRawCompetitors],
        comparableTarget
      );
      const mergedFiltered = filterCompetitorsByPropertyAndStructure(
        comparableTarget,
        mergedSanitized,
        pipelineComparableMax
      );
      if (mergedFiltered.length >= pipelineComparableMax) {
        fallbackStoppedAfterEnough = true;
        break fallbackBatchLoop;
      }

      const remainingSlots = MAX_FALLBACK_EXTRACTION_ATTEMPTS - fallbackExtractionAttempts;
      const batchUrls = pool.slice(
        off,
        off + Math.min(COMPETITOR_BATCH_SIZE, remainingSlots)
      );
      if (batchUrls.length === 0) break fallbackBatchLoop;
      fallbackBatchesUsed += 1;

      const extractedBatch = await runLimitedConcurrency(
        batchUrls,
        COMPETITOR_EXTRACT_CONCURRENCY,
        (c) => extractOneComparable(c)
      );
      fallbackExtractionAttempts += batchUrls.length;
      for (const listing of extractedBatch) {
        if (listing) fallbackRawCompetitors.push(listing);
      }
      off += batchUrls.length;

      const mergedAfterBatch = dedupeListings(
        [...bookingRawCompetitors, ...fallbackRawCompetitors],
        comparableTarget
      );
      const mergedFilteredAfterBatch = filterCompetitorsByPropertyAndStructure(
        comparableTarget,
        mergedAfterBatch,
        pipelineComparableMax
      );
      if (mergedFilteredAfterBatch.length >= pipelineComparableMax) {
        fallbackStoppedAfterEnough = true;
        break fallbackBatchLoop;
      }
    }
    fallbackMaxAttemptsReached =
      fallbackExtractionAttempts >= MAX_FALLBACK_EXTRACTION_ATTEMPTS &&
      !fallbackStoppedAfterEnough;
    fallbackExtractMs = Date.now() - fbExtractT0;
  }
  const fallbackAborted = isCompetitorSearchAborted(input);
  const airbnbFallbackPerfNote = [
    !wouldFallbackForQuota ? "fallback_skipped_booking_sufficient" : "",
    fallbackSkippedBookingHasContext ? "fallback_skipped_booking_has_context" : "",
    fallbackLimitApplied ? "fallback_limit_applied" : "",
    "fallback_batch_mode",
    `fallback_batches_used:${fallbackBatchesUsed}`,
    fallbackStoppedAfterEnough ? "stopped_after_enough_comparables" : "",
    fallbackMaxAttemptsReached ? "max_attempts_reached" : "",
    "parallel_limit_3",
    `booking_extract_attempts:${bookingExtractionAttempts}`,
    `fallback_extract_attempts:${fallbackExtractionAttempts}`,
    `airbnb_discovered:${airbnbFallbackUrlBag.length}`,
    `total_extract_launches:${bookingExtractionAttempts + fallbackExtractionAttempts}`,
  ]
    .filter(Boolean)
    .join(" ");
  auditPerfLog({
    step: "airbnb-fallback",
    durationMs:
      needsFallback && !fallbackAborted ? airbnbDiscoveryMs + fallbackExtractMs : 0,
    countIn: needsFallback && !fallbackAborted ? fallbackExtractionAttempts : 0,
    countOut: fallbackRawCompetitors.length,
    platform: String(searchInput.target.platform ?? ""),
    note: airbnbFallbackPerfNote,
  });
  const rawCompetitors: ExtractedListing[] = [...bookingRawCompetitors, ...fallbackRawCompetitors];

  logMarketPipelineStage({
    stage: "raw_after_fallback_extract",
    targetUrl: searchInput.target.url ?? null,
    targetPlatform: searchInput.target.platform ?? null,
    countFallbackRawExtracted: fallbackRawCompetitors.length,
    countRawCompetitorsMerged: rawCompetitors.length,
  });

  const sanitizedCompetitors = dedupeListings(rawCompetitors, comparableTarget);

  const manualPropertyTypeLocked = Boolean(parsedPropertyTypeOverride);
  const originalTargetTypeForEval = getNormalizedComparableType(comparableTarget);
  const refinedTargetTypeForEvaluation = manualPropertyTypeLocked
    ? originalTargetTypeForEval
    : refineComparableTargetTypeForBookingExtraction(
        comparableTarget,
        originalTargetTypeForEval
      );
  const isBookingTargetForComparableEval =
    String(comparableTarget.platform ?? "").toLowerCase() === "booking";
  const applyVillaLikeEvaluationTarget =
    !manualPropertyTypeLocked &&
    isBookingTargetForComparableEval &&
    refinedTargetTypeForEvaluation === "villa_like";
  const targetPropertyTypeBeforeEval = comparableTarget.propertyType ?? null;
  const evaluationGeometryTarget: ExtractedListing =
    String(comparableTarget.platform ?? "").toLowerCase() === "booking"
      ? comparableTargetForBookingGeo
      : comparableTarget;
  const evaluationTarget: ExtractedListing = applyVillaLikeEvaluationTarget
    ? { ...evaluationGeometryTarget, propertyType: "villa" }
    : evaluationGeometryTarget;
  const targetPropertyTypeAfterEval = evaluationTarget.propertyType ?? null;

  if (
    DEBUG_MARKET_PIPELINE &&
    typeof input.propertyTypeOverride === "string" &&
    input.propertyTypeOverride.trim().length > 0
  ) {
    const rawOv = input.propertyTypeOverride.trim();
    console.log(
      "[market][property-type-override]",
      JSON.stringify({
        rawPropertyTypeOverride: rawOv,
        mappedPropertyType: parsedPropertyTypeOverride
          ? mapPropertyTypeOverrideToListingPropertyType(parsedPropertyTypeOverride)
          : null,
        normalizedComparableTarget: getNormalizedComparableType(comparableTarget),
        normalizedEvaluationTarget: getNormalizedComparableType(evaluationTarget),
        evaluationTargetPropertyType: evaluationTarget.propertyType ?? null,
        manualPropertyTypeLocked,
      })
    );
  }

  if (DEBUG_MARKET_PIPELINE) {
    console.log(
      "[market][type-diagnostic][target]",
      JSON.stringify({
        originalType: comparableTarget.propertyType ?? null,
        normalizedType: getNormalizedComparableType(comparableTarget),
        refinedType: getNormalizedComparableType(evaluationTarget),
        finalPropertyType: evaluationTarget.propertyType ?? null,
      })
    );
  }

  if (DEBUG_MARKET_PIPELINE) {
    console.log(
      "[market][evaluation-target-refinement]",
      JSON.stringify({
        originalTargetType: originalTargetTypeForEval,
        refinedTargetType: refinedTargetTypeForEvaluation,
        applied: applyVillaLikeEvaluationTarget,
        targetPropertyTypeBefore: targetPropertyTypeBeforeEval,
        targetPropertyTypeAfter: targetPropertyTypeAfterEval,
      })
    );
  }

  const scrubbedBookingPriceByUrl = new Map<string, ExtractedListing>();
  const evaluationCompetitors: ExtractedListing[] = sanitizedCompetitors.map((listing) => {
    if (
      !shouldScrubBookingVillaOutlierPriceForEvaluation(
        evaluationTarget,
        listing,
        targetCity
      )
    ) {
      return listing;
    }
    const scrubbed: ExtractedListing = { ...listing, price: null, currency: null };
    const u = listing.url?.trim();
    if (u) scrubbedBookingPriceByUrl.set(u, scrubbed);
    if (DEBUG_MARKET_PIPELINE) {
      const tPrice =
        typeof evaluationTarget.price === "number" &&
        Number.isFinite(evaluationTarget.price)
          ? evaluationTarget.price
          : null;
      const cBefore =
        typeof listing.price === "number" && Number.isFinite(listing.price)
          ? listing.price
          : null;
      const urlOut =
        u && u.length > 220 ? `${u.slice(0, 217)}...` : u ?? null;
      console.log(
        "[market][booking-price-scrubbed]",
        JSON.stringify({
          url: urlOut,
          title: listing.title ?? null,
          targetPrice: tPrice,
          candidatePriceBefore: cBefore,
          candidatePriceAfter: null,
          reason: "booking_price_outlier_scrubbed_not_rejected",
        })
      );
    }
    return scrubbed;
  });

  if (DEBUG_MARKET_PIPELINE) {
    const candidateDiagLimit = Math.min(10, sanitizedCompetitors.length);
    for (let i = 0; i < candidateDiagLimit; i++) {
      const candidate = sanitizedCompetitors[i]!;
      const rawUrl = candidate.url?.trim() ?? "";
      const urlOut = rawUrl.length > 160 ? `${rawUrl.slice(0, 157)}...` : rawUrl;
      console.log(
        "[market][type-diagnostic][candidate]",
        JSON.stringify({
          url: urlOut,
          title: candidate.title ?? null,
          platform: candidate.platform ?? null,
          rawType: candidate.propertyType ?? null,
          normalizedType: getNormalizedComparableType(candidate),
        })
      );
    }
  }

  /** Aligné sur la « cible » marché Booking (inclut Expedia → booking). */
  const logBookingComparablePipelineTrace =
    DEBUG_MARKET_PIPELINE &&
    getMarketComparisonPlatform(searchInput.target.platform) === "booking";

  const candidateEvalT0 = Date.now();
  let candidateDecisions = evaluateComparableCandidates(
    evaluationTarget,
    evaluationCompetitors,
    {
      normalizedTargetCountry:
        comparableDiscoveryGeo?.normalizedTargetCountry ?? discoveryGuardCountry,
    }
  );
  candidateDecisions = applyWeakBookingMarketEvalOverride(
    candidateDecisions,
    searchInput,
    comparableTarget,
    targetCity
  );

  if (bookingMarketPipelineDebug) {
    const rowUrl = (u: string) => (u.length > 240 ? `${u.slice(0, 237)}...` : u);
    const summarize = (d: (typeof candidateDecisions)[number]) => {
      const c = d.candidate;
      const u = (c.url ?? "").trim();
      return {
        title: c.title ?? null,
        price:
          typeof c.price === "number" && Number.isFinite(c.price) ? c.price : null,
        propertyType: c.propertyType ?? null,
        url: rowUrl(u),
        reasons: d.accepted ? undefined : d.reasons,
      };
    };
    console.log(
      "[market][debug][post-evaluate]",
      JSON.stringify({
        context: "after_evaluateComparableCandidates_and_weak_override",
        sanitizedInputCount: evaluationCompetitors.length,
        acceptedCount: candidateDecisions.filter((d) => d.accepted).length,
        rejectedCount: candidateDecisions.filter((d) => !d.accepted).length,
        accepted: candidateDecisions.filter((d) => d.accepted).map(summarize),
        rejected: candidateDecisions.filter((d) => !d.accepted).map(summarize),
      })
    );
  }

  if (DEBUG_MARKET_PIPELINE) {
    const bookingRawUrlSet = new Set(
      bookingRawCompetitors
        .map((l) => l.url?.trim())
        .filter((u): u is string => Boolean(u && u.length > 0))
    );
    const targetNormalizedTypeForEvalLog =
      getNormalizedComparableType(evaluationTarget);
    const rejectionLogEntries = candidateDecisions
      .filter((d) => !d.accepted)
      .slice(0, 10)
      .map((d) => {
        const c = d.candidate;
        const rawUrl = c.url?.trim() ?? "";
        const urlTruncated =
          rawUrl.length > 160 ? `${rawUrl.slice(0, 157)}...` : rawUrl;
        const bookingRawKeptThenEvaluateRejected =
          rawUrl.length > 0 && bookingRawUrlSet.has(rawUrl);
        return {
          platform: c.platform ?? null,
          title: c.title ?? null,
          url: urlTruncated,
          city: guessListingCity(c),
          country: guessListingCountry(c),
          propertyType: c.propertyType ?? null,
          normalizedType: d.candidateNormalizedType,
          candidateNormalizedType: d.candidateNormalizedType,
          targetNormalizedType: targetNormalizedTypeForEvalLog,
          targetCity: targetCity ?? null,
          targetCountry: targetCountry ?? null,
          targetBedrooms: evaluationTarget.bedrooms ?? evaluationTarget.bedroomCount ?? null,
          targetCapacity: evaluationTarget.capacity ?? evaluationTarget.guestCapacity ?? null,
          targetPrice:
            typeof evaluationTarget.price === "number" &&
            Number.isFinite(evaluationTarget.price)
              ? evaluationTarget.price
              : null,
          bookingRawKeptThenEvaluateRejected,
          bedrooms: c.bedrooms ?? c.bedroomCount ?? null,
          bathrooms: c.bathrooms ?? null,
          capacity: c.capacity ?? c.guestCapacity ?? null,
          price: typeof c.price === "number" && Number.isFinite(c.price) ? c.price : null,
          currency: c.currency ?? null,
          reasons: d.reasons,
          typeMismatch: d.candidateNormalizedType !== d.targetNormalizedType,
        };
      });
    console.log(
      "[market][candidate-evaluation-rejections]",
      JSON.stringify(rejectionLogEntries)
    );

    const acceptedDiag = candidateDecisions
      .filter((d) => d.accepted)
      .map((d) => {
        const c = d.candidate;
        const rawUrl = c.url?.trim() ?? "";
        const urlOut = rawUrl.length > 160 ? `${rawUrl.slice(0, 157)}...` : rawUrl;
        return {
          url: urlOut,
          title: c.title ?? null,
          candidateType: d.candidateNormalizedType,
          targetType: d.targetNormalizedType,
        };
      });
    console.log(
      "[market][type-diagnostic][accepted]",
      JSON.stringify(acceptedDiag)
    );

    const targetTypeDiag = getNormalizedComparableType(evaluationTarget);
    const mismatchedAcceptedCount = candidateDecisions.filter(
      (d) => d.accepted && d.candidateNormalizedType !== d.targetNormalizedType
    ).length;
    const matchedRejectedCount = candidateDecisions.filter(
      (d) => !d.accepted && d.candidateNormalizedType === d.targetNormalizedType
    ).length;
    console.log(
      "[market][type-diagnostic][summary]",
      JSON.stringify({
        targetType: targetTypeDiag,
        totalCandidates: evaluationCompetitors.length,
        acceptedCount: candidateDecisions.filter((d) => d.accepted).length,
        rejectedCount: candidateDecisions.filter((d) => !d.accepted).length,
        mismatchedAcceptedCount,
        matchedRejectedCount,
      })
    );
  }

  const evaluateAccepted = candidateDecisions.filter((d) => d.accepted).length;
  const evaluateRejected = candidateDecisions.filter((d) => !d.accepted).length;
  if (logBookingComparablePipelineTrace) {
    const acceptedComparableListings = candidateDecisions
      .filter((d) => d.accepted)
      .map((d) => d.candidate);
    console.log(
      "[market][booking-final-trace-after-evaluate]",
      JSON.stringify({
        count: acceptedComparableListings.length,
        entries: acceptedComparableListings.map((x) => ({
          url: x.url,
          title: x.title,
          price: x.price,
          propertyType: x.propertyType,
          normalizedType: getNormalizedComparableType(x),
        })),
      })
    );
  }
  const acceptedListingUrls = new Set(
    candidateDecisions
      .filter((d) => d.accepted)
      .map((d) => d.candidate.url?.trim())
      .filter((u): u is string => Boolean(u && u.length > 0))
  );

  const comparablePoolLimit = Math.max(pipelineComparableMax * 4, 12);
  const competitorsOrdered = candidateDecisions
    .filter((d) => d.accepted)
    .sort((a, b) => {
      const scoreDiff = b.comparableScore - a.comparableScore;
      if (scoreDiff !== 0) return scoreDiff;
      const distanceA =
        typeof a.distanceKm === "number" && Number.isFinite(a.distanceKm) ? a.distanceKm : 999;
      const distanceB =
        typeof b.distanceKm === "number" && Number.isFinite(b.distanceKm) ? b.distanceKm : 999;
      return distanceA - distanceB;
    })
    .slice(0, comparablePoolLimit)
    .map((d) => d.candidate);

  if (bookingMarketPipelineDebug) {
    const acceptedForPool = candidateDecisions.filter((d) => d.accepted);
    console.log(
      "[market][debug][post-filter]",
      JSON.stringify({
        context: "competitorsOrdered_pool_evaluate_accepted_sort_slice",
        comparablePoolLimit,
        keptCount: competitorsOrdered.length,
        acceptedBeforePoolCap: acceptedForPool.length,
        droppedOnlyByPoolCap: Math.max(
          0,
          acceptedForPool.length - competitorsOrdered.length
        ),
        kept: competitorsOrdered.map((x) => ({
          title: x.title ?? null,
          price:
            typeof x.price === "number" && Number.isFinite(x.price) ? x.price : null,
          propertyType: x.propertyType ?? null,
          url: ((u: string) => (u.length > 240 ? `${u.slice(0, 237)}...` : u))(
            (x.url ?? "").trim()
          ),
        })),
      })
    );
  }

  if (logBookingComparablePipelineTrace) {
    console.log(
      "[market][booking-final-trace-after-filter]",
      JSON.stringify({
        count: competitorsOrdered.length,
        entries: competitorsOrdered.map((x) => ({
          url: x.url,
          title: x.title,
          price: x.price,
          propertyType: x.propertyType,
          normalizedType: getNormalizedComparableType(x),
        })),
      })
    );
  }
  logMarketPipelineStage({
    stage: "after_filter_comparable_listings",
    targetUrl: searchInput.target.url ?? null,
    targetPlatform: searchInput.target.platform ?? null,
    countCompetitorsOrdered: competitorsOrdered.length,
    comparablePoolLimit,
  });

  const bookingMarketComparableMerge =
    getMarketComparisonPlatform(searchInput.target.platform) === "booking";
  /** Cible marché Booking/Expedia : même pool que competitorsOrdered pour ne pas perdre un comparable accepté en évaluation mais absent du pool booking filté en amont. */
  const bookingCompetitorsAccepted = bookingMarketComparableMerge
    ? competitorsOrdered
        .filter((listing) => String(listing.platform ?? "").toLowerCase() === "booking")
        .map((listing) => {
          const u = listing.url?.trim();
          if (!u) return listing;
          return scrubbedBookingPriceByUrl.get(u) ?? listing;
        })
    : bookingCompetitors
        .filter((listing) => {
          const u = listing.url?.trim();
          return Boolean(u && acceptedListingUrls.has(u));
        })
        .map((listing) => {
          const u = listing.url?.trim();
          if (!u) return listing;
          return scrubbedBookingPriceByUrl.get(u) ?? listing;
        });

  if (DEBUG_MARKET_PIPELINE) {
    console.log(
      "[market][booking-accepted-merge-source]",
      JSON.stringify({
        competitorsOrderedCount: competitorsOrdered.length,
        bookingCompetitorsAcceptedCount: bookingCompetitorsAccepted.length,
        bookingMarketComparableMerge,
        entries: bookingCompetitorsAccepted.map((x) => ({
          url: x.url,
          title: x.title,
          price: x.price,
          propertyType: x.propertyType,
          normalizedType: getNormalizedComparableType(x),
        })),
      })
    );
  }

  const evaluateRejectionReasonCounts = countEvaluateRejectionReasons(candidateDecisions);
  logMarketPipelineStage({
    stage: "evaluate_comparable_candidates",
    targetUrl: searchInput.target.url ?? null,
    targetPlatform: searchInput.target.platform ?? null,
    countSanitizedInput: sanitizedCompetitors.length,
    countEvaluateAccepted: evaluateAccepted,
    countEvaluateRejected: evaluateRejected,
    evaluateRejectionReasonCounts,
  });

  console.log(
    "[market][candidate-rejection-summary]",
    JSON.stringify({
      evaluateAccepted,
      evaluateRejected,
      evaluateRejectionReasonCounts,
    })
  );

  const fallbackCompetitors = filterCompetitorsByPropertyAndStructure(
    evaluationTarget,
    competitorsOrdered,
    pipelineComparableMax
  );

  if (bookingMarketPipelineDebug) {
    const tracePostEval = debugTracePropertyStructureFilter(
      evaluationTarget,
      competitorsOrdered,
      pipelineComparableMax
    );
    console.log(
      "[market][debug][post-structure-filter]",
      JSON.stringify({
        phase: "post_eval_competitorsOrdered_to_fallbackCompetitors",
        orderedForSecondPassCount: competitorsOrdered.length,
        fallbackKeptCount: fallbackCompetitors.length,
        rejectedRulesCount: tracePostEval.trace.filter((t) => t.outcome === "rejected_rules")
          .length,
        skippedQuotaCount: tracePostEval.trace.filter((t) => t.outcome === "skipped_quota")
          .length,
        trace: tracePostEval.trace,
      })
    );
  }

  auditPerfLog({
    step: "candidate-evaluation",
    durationMs: Date.now() - candidateEvalT0,
    countIn: sanitizedCompetitors.length,
    countOut: fallbackCompetitors.length,
    platform: String(searchInput.target.platform ?? ""),
    note: `evaluate_accepted:${evaluateAccepted}`,
  });
  logMarketPipelineStage({
    stage: "after_filter_property_structure",
    targetUrl: searchInput.target.url ?? null,
    targetPlatform: searchInput.target.platform ?? null,
    countBookingCompetitorsBranch: bookingCompetitorsAccepted.length,
    countFallbackCompetitorsBranch: fallbackCompetitors.length,
  });

  if (logBookingComparablePipelineTrace) {
    const mergedPreDedupe = [
      ...bookingCompetitorsAccepted,
      ...fallbackCompetitors,
    ];
    console.log(
      "[market][booking-final-trace-before-final]",
      JSON.stringify({
        count: mergedPreDedupe.length,
        entries: mergedPreDedupe.map((x) => ({
          url: x.url,
          title: x.title,
          price: x.price,
          propertyType: x.propertyType,
          normalizedType: getNormalizedComparableType(x),
        })),
      })
    );
  }

  let competitors = dedupeListings(
    [...bookingCompetitorsAccepted, ...fallbackCompetitors],
    comparableTarget
  ).slice(0, pipelineComparableMax);

  if (bookingMarketPipelineDebug) {
    console.log(
      "[market][debug][pre-final]",
      JSON.stringify({
        phase: "after_merge_dedupe_slice_before_emergency_or_guards",
        count: competitors.length,
        entries: competitors.map((x) => ({
          title: x.title ?? null,
          price:
            typeof x.price === "number" && Number.isFinite(x.price) ? x.price : null,
          propertyType: x.propertyType ?? null,
          platform: x.platform ?? null,
          url: ((u: string) => (u.length > 240 ? `${u.slice(0, 237)}...` : u))(
            (x.url ?? "").trim()
          ),
        })),
      })
    );
  }

  logMarketPipelineStage({
    stage: "before_emergency_fallback",
    targetUrl: searchInput.target.url ?? null,
    targetPlatform: searchInput.target.platform ?? null,
    countCompetitorsMerged: competitors.length,
  });
  if (competitors.length === 0 && sanitizedCompetitors.length > 0 && evaluateAccepted > 0) {
    const emergencyFallback = sanitizedCompetitors
      .map((listing) => {
        const u = listing.url?.trim();
        if (u && scrubbedBookingPriceByUrl.has(u)) {
          return scrubbedBookingPriceByUrl.get(u)!;
        }
        return listing;
      })
      .filter((listing) => isBedroomOrCapacityWithinOne(comparableTarget, listing))
      .sort((a, b) => {
        const aPriced = hasPlausibleComparablePrice(a) ? 1 : 0;
        const bPriced = hasPlausibleComparablePrice(b) ? 1 : 0;
        return bPriced - aPriced;
      })
      .slice(0, 1);

    if (emergencyFallback.length > 0) {
      const kept = emergencyFallback[0]!;
      if (hasPlausibleComparablePrice(kept)) {
        console.log("[market][relaxed-fallback]", {
          reason: "all_filters_returned_zero",
          selected: emergencyFallback.length,
        });
        competitors = emergencyFallback;
        logMarketPipelineStage({
          stage: "emergency_fallback_applied",
          targetUrl: searchInput.target.url ?? null,
          targetPlatform: searchInput.target.platform ?? null,
          countEmergencyKept: emergencyFallback.length,
        });
      } else {
        console.log("[market][relaxed-fallback]", {
          reason: "all_filters_returned_zero_unpriced_skipped",
          selected: 0,
        });
        logMarketPipelineStage({
          stage: "emergency_fallback_skipped_unpriced",
          targetUrl: searchInput.target.url ?? null,
          targetPlatform: searchInput.target.platform ?? null,
          countEmergencyKept: 0,
        });
      }
    }
  }

  if (getMarketComparisonPlatform(searchInput.target.platform) === "booking") {
    const beforeGuardCount = competitors.length;
    const decisionByUrl = new Map<string, ComparableCandidateDecision>();
    for (const d of candidateDecisions) {
      const u = d.candidate.url?.trim();
      if (u) decisionByUrl.set(u, d);
    }
    const removedBookingFinal: Array<{
      url: string;
      propertyType: string | null;
      reasons: string[];
    }> = [];
    const guarded: typeof competitors = [];
    for (const listing of competitors) {
      const rawU = listing.url?.trim();
      const decision = rawU ? decisionByUrl.get(rawU) : undefined;
      if (
        isBookingTargetFinalComparableAllowed(decision, {
          comparableTarget,
          listing,
          marketTargetCity: targetCity,
        })
      ) {
        guarded.push(listing);
      } else {
        const urlOut =
          rawU && rawU.length > 220 ? `${rawU.slice(0, 217)}...` : rawU ?? "";
        removedBookingFinal.push({
          url: urlOut,
          propertyType: listing.propertyType ?? null,
          reasons: decision?.reasons ?? [],
        });
      }
    }
    competitors = guarded;
    if (DEBUG_MARKET_PIPELINE) {
      console.log(
        "[market][booking-final-accepted-only-guard]",
        JSON.stringify({
          beforeCount: beforeGuardCount,
          afterCount: competitors.length,
          removedCount: removedBookingFinal.length,
          removed: removedBookingFinal,
        })
      );
    }
  }

  if (DEBUG_MARKET_PIPELINE) {
    console.log(
      "[market][booking-evaluation-guard]",
      JSON.stringify({
        bookingBefore: bookingCompetitors.length,
        bookingAfter: bookingCompetitorsAccepted.length,
        evaluateAccepted,
        finalCompetitors: competitors.length,
      })
    );
  }
  if (DEBUG_BOOKING_PIPELINE && targetPlatform === "booking") {
    console.log("[booking][competitors][final]", {
      competitorsReturned: competitors.length,
      pricedAmongFinal: competitors.filter(hasPlausibleComparablePrice).length,
      bookingRawExtracted: bookingRawCompetitors.length,
    });
  }
  if (competitors.some((listing) => listing.platform === "airbnb")) {
    await enrichAirbnbCompetitorPrices(competitors);
  }

  /**
   * Si la boucle Booking a déjà produit au moins 3 comparables pricés, le benchmark tarifaire
   * final ne doit pas mélanger des fallbacks sans prix (ex. Airbnb minimal) : on les retire
   * après enrichissement, tant qu'il reste au moins un comparable avec prix plausible (évite de
   * vider artificiellement le pool si aucun prix n'a survécu au merge final).
   */
  if (pricedBookingComparables >= pipelineComparableMax) {
    const pricedOnly = competitors.filter(hasPlausibleComparablePrice);
    if (pricedOnly.length > 0) {
      const dropped = competitors.length - pricedOnly.length;
      if (dropped > 0) {
        logMarketPipelineStage({
          stage: "benchmark_trim_unpriced_when_booking_priced_floor_met",
          targetUrl: searchInput.target.url ?? null,
          targetPlatform: searchInput.target.platform ?? null,
          pricedBookingComparables,
          priorFinalCount: competitors.length,
          droppedUnpricedCount: dropped,
          nextFinalCount: pricedOnly.length,
        });
      }
      competitors = pricedOnly;
    }
  }

  if (bookingMarketPipelineDebug) {
    console.log(
      "[market][debug][pre-final]",
      JSON.stringify({
        phase: "after_booking_guard_airbnb_enrich_benchmark_trim_ready_for_return",
        count: competitors.length,
        entries: competitors.map((x) => ({
          title: x.title ?? null,
          price:
            typeof x.price === "number" && Number.isFinite(x.price) ? x.price : null,
          propertyType: x.propertyType ?? null,
          platform: x.platform ?? null,
          url: ((u: string) => (u.length > 240 ? `${u.slice(0, 237)}...` : u))(
            (x.url ?? "").trim()
          ),
        })),
      })
    );

    const traceStructure1 = debugTracePropertyStructureFilter(
      comparableTarget,
      bookingOrdered,
      pipelineComparableMax
    );
    const traceStructure2 = debugTracePropertyStructureFilter(
      evaluationTarget,
      competitorsOrdered,
      pipelineComparableMax
    );
    const ercForLoss = evaluateRejectionReasonCounts;
    const pfCount = ercForLoss["booking_morocco_villa_price_floor"] ?? 0;
    const susCount = ercForLoss["booking_morocco_villa_suspicious_low_price"] ?? 0;
    const dropS1 =
      traceStructure1.trace.filter((t) => t.outcome !== "kept").length;
    const dropS2 =
      traceStructure2.trace.filter((t) => t.outcome !== "kept").length;

    console.log(
      "[market][debug][loss-breakdown]",
      JSON.stringify({
        discovered: bookingCandidates.length,
        extracted: bookingRawCompetitors.length,
        afterDedupeBooking: bookingSanitized.length,
        afterStructureBookingBranch: bookingCompetitors.length,
        mergedSanitizedForEvaluate: sanitizedCompetitors.length,
        afterEvaluate: evaluateAccepted,
        afterFilter: competitorsOrdered.length,
        finalComparables: competitors.length,
        droppedBy: {
          extraction: Math.max(0, bookingPreselected.length - bookingRawCompetitors.length),
          dedupe: Math.max(0, bookingRawCompetitors.length - bookingSanitized.length),
          structure: dropS1 + dropS2,
          structureFirstPassNonKept: dropS1,
          structureSecondPassNonKept: dropS2,
          evaluate: evaluateRejected,
          priceFloor: pfCount,
          suspiciousLowPrice: susCount,
          other:
            evaluateRejected > 0
              ? Math.max(0, evaluateRejected - pfCount - susCount)
              : 0,
        },
        evaluateRejectionReasonCounts: ercForLoss,
        note:
          "droppedBy.other approximatif si plusieurs raisons par candidat ; structure = somme des entrées non kept des deux passes simulées.",
      })
    );
  }

  if (competitors.length > 0 && competitors.every((listing) => !hasPlausibleComparablePrice(listing))) {
    const priorCount = competitors.length;
    console.log(
      "[market][benchmark-insufficient]",
      JSON.stringify({
        reason: "all_final_comparables_unpriced",
        priorCount,
        retainedForMarketContext: true,
        note:
          "Booking comparables use skipBookingPriceRecovery; hasPlausibleComparablePrice often false — clearing forced comparableCount=0",
      })
    );
    logMarketPipelineStage({
      stage: "final_competitors_unpriced_retained",
      targetUrl: searchInput.target.url ?? null,
      targetPlatform: searchInput.target.platform ?? null,
      priorCount,
    });
  }

  if (
    DEBUG_MARKET_PIPELINE &&
    targetPlatform === "booking" &&
    !isExpediaBookingMarket
  ) {
    console.log(
      "[market][booking-extraction-limit-debug]",
      JSON.stringify({
        requestedMaxResults: maxResults,
        effectiveMaxResults: pipelineComparableMax,
        pipelineComparableMax,
        explicitComparableCapFromInput,
        finalComparables: competitors.length,
        targetType: getNormalizedComparableType(comparableTarget),
        guardCountry: comparableDiscoveryGeo?.normalizedTargetCountry ?? null,
        targetPlatform,
        discovered: bookingCandidates.length,
        afterGeoHintsPrefilter: bookingPreselectedAfterGeoHints.length,
        extractionAttemptsLimit: maxBookingExtractionAttempts,
        extractionAttempts: bookingExtractionAttempts,
        extractedRawKept: bookingRawCompetitors.length,
        evaluateAccepted,
        evaluateRejected,
      })
    );
  }

  if (logBookingComparablePipelineTrace) {
    console.log(
      "[market][booking-final-trace-after-final]",
      JSON.stringify({
        count: competitors.length,
        entries: competitors.map((x) => ({
          url: x.url,
          title: x.title,
          price: x.price,
          propertyType: x.propertyType,
          normalizedType: getNormalizedComparableType(x),
        })),
      })
    );
    console.log(
      "[market][booking-pipeline-summary]",
      JSON.stringify({
        discovered: bookingCandidates.length,
        afterGeoHintsPrefilter: bookingPreselectedAfterGeoHints.length,
        extractionAttempts: bookingExtractionAttempts,
        extractListingNonNullReturns: bookingExtractListingReturned,
        extractedRawKept: bookingRawCompetitors.length,
        afterDedupeBooking: bookingSanitized.length,
        afterPropertyStructureBooking: bookingCompetitors.length,
        mergedSanitizedForEvaluation: sanitizedCompetitors.length,
        evaluateAccepted,
        evaluateRejected,
        afterFilterComparableListings: competitorsOrdered.length,
        finalComparables: competitors.length,
      })
    );
  }

  if (competitors.length === 0) {
    let zeroReason = "unknown";
    if (marketGeoInsufficient) {
      zeroReason = "geo_insufficient_discovery_skipped";
    } else if (uniqueCandidates.length === 0) {
      zeroReason = "zero_candidate_urls_after_discovery";
    } else if (bookingCandidates.length === 0) {
      zeroReason = "zero_booking_urls_in_unique_pool";
    } else if (bookingPreselected.length === 0) {
      zeroReason = "booking_hint_prefilter_rejected_all";
    } else if (bookingRawCompetitors.length === 0) {
      zeroReason = "booking_extraction_loop_produced_zero";
    } else if (sanitizedCompetitors.length === 0) {
      zeroReason = "sanitized_competitors_empty_after_dedupe";
    } else if (evaluateAccepted === 0 && evaluateRejected > 0) {
      zeroReason = "evaluate_comparable_rejected_all";
    } else if (evaluateAccepted > 0) {
      zeroReason = "lost_after_property_structure_merge_or_emergency";
    } else {
      zeroReason = "filters_merge_or_emergency_failed";
    }
    console.log(
      "[market][final-zero-reason]",
      JSON.stringify({
        zeroReason,
        uniqueCandidates: uniqueCandidates.length,
        bookingUrls: bookingCandidates.length,
        bookingPreselected: bookingPreselected.length,
        bookingRaw: bookingRawCompetitors.length,
        sanitized: sanitizedCompetitors.length,
        evaluateAccepted,
        evaluateRejected,
      })
    );
  }

  logMarketPipelineStage({
    stage: "search_competitors_return",
    targetUrl: searchInput.target.url ?? null,
    targetPlatform: searchInput.target.platform ?? null,
    countFinalCompetitors: competitors.length,
    attempted: uniqueCandidates.length,
    selected: competitors.length,
  });

  if (DEBUG_MARKET_PIPELINE) {
    for (const listing of competitors) {
      console.log("[market][competitor-kept]", {
        platform: listing.platform ?? null,
        title: listing.title ?? null,
        city: guessListingCity(listing),
        country: guessListingCountry(listing),
        propertyType: listing.propertyType ?? null,
        bedrooms: listing.bedrooms ?? listing.bedroomCount ?? null,
        price: typeof listing.price === "number" ? listing.price : null,
        currency: listing.currency ?? null,
      });
    }
  }

  debugComparablesLog("[guest-audit][comparables][pipeline-debug]", {
    target: {
      title: searchInput.target.title ?? null,
      platform: searchInput.target.platform ?? null,
      propertyType: searchInput.target.propertyType ?? null,
      normalizedTargetType: getNormalizedComparableType(searchInput.target),
      capacity: searchInput.target.capacity ?? null,
      bedrooms: searchInput.target.bedrooms ?? null,
      bathrooms: searchInput.target.bathrooms ?? null,
      locationLabel: searchInput.target.locationLabel ?? null,
    },
    platform: searchInput.target.platform ?? null,
    source: "searchCompetitorsAroundTarget",
    searchResultCountRaw: uniqueCandidates.length,
    rawCandidates: sanitizedCompetitors.map((listing) => ({
      id: listing.externalId ?? null,
      url: listing.url ?? null,
      title: listing.title ?? null,
      platform: listing.platform ?? null,
      propertyType: listing.propertyType ?? null,
      normalizedType: getNormalizedComparableType(listing),
      city: guessListingCity(listing),
      neighborhood: guessListingNeighborhood(listing),
      languageGuess: guessListingLanguage(listing),
      capacity: listing.capacity ?? null,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      photosCount: Array.isArray(listing.photos)
        ? listing.photos.filter(Boolean).length
        : typeof listing.photosCount === "number"
          ? listing.photosCount
          : 0,
      ratingValue:
        typeof listing.ratingValue === "number"
          ? listing.ratingValue
          : typeof listing.rating === "number"
            ? listing.rating
            : null,
      reviewCount: typeof listing.reviewCount === "number" ? listing.reviewCount : null,
      amenitiesCount: Array.isArray(listing.amenities)
        ? listing.amenities.filter(Boolean).length
        : 0,
      locationLabel: listing.locationLabel ?? null,
    })),
    filterResultCount: competitors.length,
    rejectedCandidates: candidateDecisions
      .filter((decision) => !decision.accepted)
      .map((decision) => ({
        id: decision.candidate.externalId ?? null,
        url: decision.candidate.url ?? null,
        title: decision.candidate.title ?? null,
        platform: decision.candidate.platform ?? null,
        normalizedType: decision.candidateNormalizedType,
        normalizedTargetType: decision.targetNormalizedType,
        city: decision.candidateCity,
        neighborhood: decision.candidateNeighborhood,
        languageGuess: decision.candidateLanguageGuess,
        bedrooms: decision.candidate.bedrooms ?? null,
        bathrooms: decision.candidate.bathrooms ?? null,
        capacity: decision.candidate.capacity ?? null,
        reasons: decision.reasons,
      })),
    retainedCandidates: competitors.map((listing) => ({
      id: listing.externalId ?? null,
      url: listing.url ?? null,
      title: listing.title ?? null,
      platform: listing.platform ?? null,
      normalizedType: getNormalizedComparableType(listing),
      city: guessListingCity(listing),
      neighborhood: guessListingNeighborhood(listing),
      languageGuess: guessListingLanguage(listing),
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      capacity: listing.capacity ?? null,
    })),
    finalInjectedCount: competitors.length,
  });

  console.info("[market][timing]", {
    phase: "searchCompetitorsAroundTarget_total",
    ms: Date.now() - marketPipelineT0,
    targetPlatform: searchInput.target.platform,
    competitorsReturned: competitors.length,
    bookingExtractionAttempts,
    pricedBookingComparables,
  });

  return {
    target: searchInput.target,
    competitors,
    attempted: uniqueCandidates.length,
    selected: competitors.length,
    radiusKm,
    maxResults: pipelineComparableMax,
  };
}

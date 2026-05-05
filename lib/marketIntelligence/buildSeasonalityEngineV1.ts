import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DEBUG_SEASON = process.env.DEBUG_SEASONALITY_ENGINE === "true";

function seLog(kind: "query" | "result" | "insufficient-data", payload: Record<string, unknown>) {
  if (!DEBUG_SEASON) return;
  console.warn(`[seasonality][${kind}] ${JSON.stringify(payload)}`);
}

export type BuildSeasonalityEngineV1Params = {
  city: string | null;
  country: string | null;
  propertyType: string | null;
  platform: string | null;
  checkIn: string | null;
  checkOut: string | null;
};

export type SeasonLabel = "high" | "shoulder" | "low" | "unknown";

export type SeasonalityEngineV1 = {
  stayMonth: number | null;
  stayNights: number | null;
  isWeekendStay: boolean | null;
  seasonLabel: SeasonLabel;
  seasonalMedianNightlyPrice: number | null;
  baselineMedianNightlyPrice: number | null;
  seasonalIndex: number | null;
  comparableCount: number;
  snapshotCount: number;
  confidenceScore: number;
  confidenceLabel: "very_low" | "low" | "moderate" | "good" | "high";
  warnings: string[];
};

type SnapshotRow = {
  id: string;
  created_at: string;
  platform: string;
  city: string | null;
  country: string | null;
  property_type: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
};

type ComparableRow = {
  snapshot_id: string;
  nightly_price: number | string | null;
  currency: string | null;
  platform: string | null;
};

function normStr(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function normPlatform(v: string | null): string | null {
  const n = normStr(v);
  return n ? n.toLowerCase() : null;
}

function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseIsoDate(s: string | null | undefined): string | null {
  const t = typeof s === "string" ? s.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

function nightsBetweenCheckInOut(checkInIso: string, checkOutIso: string): number | null {
  const a = new Date(`${checkInIso}T12:00:00.000Z`);
  const b = new Date(`${checkOutIso}T12:00:00.000Z`);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return null;
  const diff = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  if (diff <= 0) return null;
  return diff;
}

function monthFromIsoDate(iso: string): number | null {
  const m = Number.parseInt(iso.slice(5, 7), 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return null;
  return m;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Nuit = calendrier UTC du Soir (jour d’occupation) : checkIn + k pour k in 0..stayNights-1. */
function stayIncludesWeekendNight(checkInIso: string, stayNights: number): boolean {
  for (let k = 0; k < stayNights; k++) {
    const dayIso = addDaysIso(checkInIso, k);
    const d = new Date(`${dayIso}T12:00:00.000Z`);
    const w = d.getUTCDay();
    if (w === 5 || w === 6) return true;
  }
  return false;
}

function medianSorted(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const pos = (sortedAsc.length - 1) * 0.5;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo]!;
  const w = pos - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

function medianUnsorted(values: number[]): number {
  if (values.length === 0) return NaN;
  return medianSorted([...values].sort((a, b) => a - b));
}

function sampleStdev(values: number[], mu: number): number {
  if (values.length < 2) return 0;
  const v =
    values.reduce((acc, x) => acc + (x - mu) * (x - mu), 0) / Math.max(values.length - 1, 1);
  return Math.sqrt(Math.max(v, 0));
}

function pickDominantCurrency(
  rows: Array<{ currency: string }>
): { code: string | null; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const c = r.currency.trim().toUpperCase();
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [c, n] of counts) {
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return { code: best, counts };
}

function confidenceLabelFromScore(
  score: number
): SeasonalityEngineV1["confidenceLabel"] {
  if (score < 22) return "very_low";
  if (score < 40) return "low";
  if (score < 58) return "moderate";
  if (score < 72) return "good";
  return "high";
}

function ageDaysNewest(now: Date, newestIso: string | null): number | null {
  if (!newestIso) return null;
  const t = Date.parse(newestIso);
  if (!Number.isFinite(t)) return null;
  return Math.floor(Math.max(0, now.getTime() - t) / (24 * 60 * 60 * 1000));
}

function freshnessSubscore(ageDays: number | null): number {
  if (ageDays == null) return 0;
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.75;
  if (ageDays <= 90) return 0.45;
  return 0.2;
}

type MonthAttribution = { month: number; usedCreatedFallback: boolean };

function effectiveStayMonthForSnapshot(s: SnapshotRow): MonthAttribution | null {
  const ci = s.check_in != null ? parseIsoDate(String(s.check_in)) : null;
  if (ci) {
    const m = monthFromIsoDate(ci);
    if (m != null) return { month: m, usedCreatedFallback: false };
  }
  const t = Date.parse(s.created_at);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return { month: d.getUTCMonth() + 1, usedCreatedFallback: true };
}

function emptyResult(warnings: string[]): SeasonalityEngineV1 {
  return {
    stayMonth: null,
    stayNights: null,
    isWeekendStay: null,
    seasonLabel: "unknown",
    seasonalMedianNightlyPrice: null,
    baselineMedianNightlyPrice: null,
    seasonalIndex: null,
    comparableCount: 0,
    snapshotCount: 0,
    confidenceScore: 0,
    confidenceLabel: "very_low",
    warnings,
  };
}

/**
 * Lit Market Memory et compare la médiane du mois de séjour ciblé à une médiane baseline (même maille marché).
 * Lecture seule — ne modifie pas le scoring produit.
 *
 * Limites v1 :
 * - Mois d’attribution snapshot : `check_in` du snapshot si présent, sinon `created_at` (biais + warning).
 * - Week-end : jours UTC (voyage local non distingué).
 * - Devises : une seule devise dominante sur l’ensemble filtré.
 * - Baseline / saison : mêmes filtres géo/plateforme/type ; la saison filtre par mois d’effet.
 */
export async function buildSeasonalityEngineV1(
  params: BuildSeasonalityEngineV1Params
): Promise<SeasonalityEngineV1> {
  const warnings: string[] = [];
  const now = new Date();

  const city = normStr(params.city);
  const country = normStr(params.country);
  const propertyType = normStr(params.propertyType);
  const platform = normPlatform(params.platform);
  const checkIn = parseIsoDate(params.checkIn);
  const checkOut = parseIsoDate(params.checkOut);

  if (!platform) {
    warnings.push(
      "Aucune plateforme fournie : périmètre large, préférez `platform` pour une saisonnalité stable."
    );
  }

  if (!checkIn || !checkOut) {
    warnings.push("Dates de séjour invalides ou absentes (attendu yyyy-mm-dd).");
    seLog("insufficient-data", { reason: "bad_stay_dates", checkIn: params.checkIn, checkOut: params.checkOut });
    return emptyResult(warnings);
  }

  const stayNights = nightsBetweenCheckInOut(checkIn, checkOut);
  if (stayNights == null) {
    warnings.push("Séjour incohérent : check-out doit être après check-in.");
    seLog("insufficient-data", { reason: "non_positive_stay", checkIn, checkOut });
    return emptyResult(warnings);
  }

  const stayMonth = monthFromIsoDate(checkIn);
  if (stayMonth == null) {
    warnings.push("Impossible de déduire le mois de séjour.");
    return emptyResult(warnings);
  }

  const isWeekendStay = stayIncludesWeekendNight(checkIn, stayNights);

  const admin = createSupabaseAdminClient();
  const PAGE = 800;
  const snapshots: SnapshotRow[] = [];
  let snapFrom = 0;

  for (;;) {
    let q = admin
      .from("market_snapshots")
      .select(
        "id, created_at, platform, city, country, property_type, check_in, check_out, nights"
      )
      .order("created_at", { ascending: false })
      .range(snapFrom, snapFrom + PAGE - 1);

    if (platform) q = q.eq("platform", platform);
    if (city) q = q.not("city", "is", null).eq("city", city);
    if (country) q = q.not("country", "is", null).eq("country", country);
    if (propertyType) q = q.not("property_type", "is", null).eq("property_type", propertyType);

    const { data, error } = await q;
    if (error) {
      warnings.push(`Lecture snapshots impossible : ${error.message}`);
      seLog("insufficient-data", {
        reason: "snapshot_query_error",
        message: error.message,
        filters: { city, country, propertyType, platform },
      });
      return emptyResult(warnings);
    }
    const batch = (data ?? []) as SnapshotRow[];
    snapshots.push(...batch);
    if (batch.length < PAGE) break;
    snapFrom += PAGE;
  }

  const filteredSnapshots = snapshots.filter((s) => normPlatform(s.platform));
  const snapById = new Map(filteredSnapshots.map((s) => [s.id, s]));

  if (filteredSnapshots.length === 0) {
    seLog("insufficient-data", {
      reason: "no_matching_snapshots",
      filters: { city, country, propertyType, platform },
    });
    warnings.push("Aucun snapshot marché pour ces filtres.");
    return emptyResult(warnings);
  }

  const monthAttrBySnap = new Map<string, MonthAttribution>();
  let snapshotsWithCreatedFallback = 0;
  for (const s of filteredSnapshots) {
    const attr = effectiveStayMonthForSnapshot(s);
    if (attr) {
      monthAttrBySnap.set(s.id, attr);
      if (attr.usedCreatedFallback) snapshotsWithCreatedFallback += 1;
    }
  }

  if (snapshotsWithCreatedFallback > 0) {
    warnings.push(
      `${snapshotsWithCreatedFallback} snapshot(s) sans check_in exploitable : le mois d’effet utilise created_at (approximation faible).`
    );
  }

  const snapshotIds = filteredSnapshots.map((s) => s.id);
  const comparablesAccum: ComparableRow[] = [];
  const CHUNK = 120;

  for (let i = 0; i < snapshotIds.length; i += CHUNK) {
    const slice = snapshotIds.slice(i, i + CHUNK);
    let from = 0;
    for (;;) {
      const { data, error } = await admin
        .from("market_comparables")
        .select("snapshot_id, nightly_price, currency, platform")
        .in("snapshot_id", slice)
        .not("nightly_price", "is", null)
        .gt("nightly_price", 0)
        .not("currency", "is", null)
        .neq("currency", "")
        .range(from, from + PAGE - 1);

      if (error) {
        warnings.push(`Lecture comparables impossible : ${error.message}`);
        seLog("insufficient-data", { reason: "comparable_query_error", message: error.message });
        return emptyResult(warnings);
      }
      const rows = (data ?? []) as ComparableRow[];
      comparablesAccum.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }

  let usable = comparablesAccum
    .map((r) => ({
      snapshot_id: r.snapshot_id,
      nightly_price: toNum(r.nightly_price),
      currency: typeof r.currency === "string" ? r.currency.trim().toUpperCase() : "",
      platform: normPlatform(r.platform),
    }))
    .filter((r) => r.nightly_price != null && r.nightly_price > 0 && r.currency.length > 0)
    .filter((r) => snapById.has(r.snapshot_id))
    .filter((r) => !platform || r.platform === platform);

  if (usable.length === 0) {
    seLog("insufficient-data", {
      reason: "no_price_rows",
      filters: { city, country, propertyType, platform },
    });
    warnings.push("Aucun comparable avec prix nocturne et devise valides.");
    return emptyResult(warnings);
  }

  const { code: dominant, counts } = pickDominantCurrency(usable.map((u) => ({ currency: u.currency })));
  if (!dominant) {
    warnings.push("Impossible de déterminer une devise dominante.");
    return emptyResult(warnings);
  }

  if (counts.size > 1) {
    const dropped = usable.filter((u) => u.currency !== dominant).length;
    if (dropped > 0) {
      warnings.push(
        `Plusieurs devises ; agrégation en ${dominant} uniquement (${dropped} ligne(s) exclue(s)).`
      );
    }
  }

  usable = usable.filter((u) => u.currency === dominant);

  type Enriched = {
    snapshot_id: string;
    price: number;
    effectMonth: number;
    usedCreatedFallback: boolean;
  };

  const enriched: Enriched[] = [];
  for (const u of usable) {
    const attr = monthAttrBySnap.get(u.snapshot_id);
    if (!attr) continue;
    enriched.push({
      snapshot_id: u.snapshot_id,
      price: u.nightly_price as number,
      effectMonth: attr.month,
      usedCreatedFallback: attr.usedCreatedFallback,
    });
  }

  if (enriched.length === 0) {
    seLog("insufficient-data", { reason: "no_enriched_rows" });
    warnings.push("Aucune donnée exploitable après attribution de mois.");
    return emptyResult(warnings);
  }

  const baselinePrices = enriched.map((e) => e.price);
  const baselineMedianNightlyPrice = medianUnsorted(baselinePrices);
  if (!Number.isFinite(baselineMedianNightlyPrice) || baselineMedianNightlyPrice <= 0) {
    seLog("insufficient-data", { reason: "bad_baseline_median" });
    warnings.push("Médiane baseline invalide.");
    return emptyResult(warnings);
  }

  const seasonalRows = enriched.filter((e) => e.effectMonth === stayMonth);
  const seasonalPrices = seasonalRows.map((e) => e.price);
  const comparableCount = seasonalPrices.length;
  const snapshotCount = new Set(seasonalRows.map((e) => e.snapshot_id)).size;

  const MIN_SEASONAL = 5;
  let seasonalMedianNightlyPrice: number | null = null;
  let seasonalIndex: number | null = null;
  let seasonLabel: SeasonLabel = "unknown";

  if (comparableCount < MIN_SEASONAL) {
    warnings.push(
      `Moins de ${MIN_SEASONAL} comparables pour le mois ciblé : pas d’indice saisonnier fiable.`
    );
    seLog("insufficient-data", {
      reason: "low_seasonal_comparable_count",
      comparableCount,
      stayMonth,
      baselineComparableCount: baselinePrices.length,
    });
  } else {
    seasonalMedianNightlyPrice = medianUnsorted(seasonalPrices);
    if (Number.isFinite(seasonalMedianNightlyPrice) && seasonalMedianNightlyPrice > 0) {
      seasonalIndex = seasonalMedianNightlyPrice / baselineMedianNightlyPrice;
      if (seasonalIndex >= 1.15) seasonLabel = "high";
      else if (seasonalIndex <= 0.9) seasonLabel = "low";
      else seasonLabel = "shoulder";
    } else {
      warnings.push("Médiane saisonnière invalide.");
      seasonLabel = "unknown";
    }
  }

  const seasonalShareDateQuality =
    seasonalRows.length > 0
      ? seasonalRows.filter((e) => !e.usedCreatedFallback).length / seasonalRows.length
      : 0;

  const muS = seasonalPrices.length > 0 ? mean(seasonalPrices) : baselineMedianNightlyPrice;
  const stdevS = seasonalPrices.length > 0 ? sampleStdev(seasonalPrices, muS) : 0;
  const cvS = muS > 0 ? stdevS / muS : 0;
  const coherence01 = Math.max(0, Math.min(1, 1 - Math.min(cvS, 1.2) / 1.2));

  const seasonalSnapTimes = [...new Set(seasonalRows.map((e) => e.snapshot_id))]
    .map((id) => snapById.get(id)?.created_at)
    .filter((t): t is string => typeof t === "string" && t.length > 0);
  const newestSeasonal =
    seasonalSnapTimes.length > 0
      ? seasonalSnapTimes.reduce((a, b) => (a > b ? a : b))
      : null;
  const ageNewest = ageDaysNewest(now, newestSeasonal);

  const countScore = Math.min(1, comparableCount / 28) * 34;
  const snapshotScore = Math.min(1, snapshotCount / 12) * 22;
  const freshScore = freshnessSubscore(ageNewest) * 18;
  const cohScore = coherence01 * 14;
  const dateQualityScore = seasonalShareDateQuality * 12;

  let confidenceScore = Math.round(
    countScore + snapshotScore + freshScore + cohScore + dateQualityScore
  );
  if (comparableCount < MIN_SEASONAL) {
    confidenceScore = Math.min(confidenceScore, 35);
  }
  if (snapshotCount < 2) {
    confidenceScore = Math.min(confidenceScore, 45);
    warnings.push("Peu de snapshots distincts pour le mois ciblé.");
  }
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  seLog("query", {
    filters: { city, country, propertyType, platform },
    stayMonth,
    stayNights,
    isWeekendStay,
    snapshotsMatched: filteredSnapshots.length,
    comparablesRaw: comparablesAccum.length,
    baselineCount: baselinePrices.length,
    seasonalComparableCount: comparableCount,
    seasonalSnapshotCount: snapshotCount,
    dominantCurrency: dominant,
    snapshotsUsingCreatedFallback: snapshotsWithCreatedFallback,
    seasonalDateQualityShare: Math.round(seasonalShareDateQuality * 1000) / 1000,
  });

  seLog("result", {
    stayMonth,
    stayNights,
    isWeekendStay,
    seasonLabel,
    seasonalMedianNightlyPrice:
      seasonalMedianNightlyPrice != null
        ? Math.round(seasonalMedianNightlyPrice * 100) / 100
        : null,
    baselineMedianNightlyPrice: Math.round(baselineMedianNightlyPrice * 100) / 100,
    seasonalIndex: seasonalIndex != null ? Math.round(seasonalIndex * 1000) / 1000 : null,
    comparableCount,
    snapshotCount,
    confidenceScore,
    confidenceLabel: confidenceLabelFromScore(confidenceScore),
    warningsCount: warnings.length,
  });

  return {
    stayMonth,
    stayNights,
    isWeekendStay,
    seasonLabel,
    seasonalMedianNightlyPrice:
      seasonalMedianNightlyPrice != null && Number.isFinite(seasonalMedianNightlyPrice)
        ? Math.round(seasonalMedianNightlyPrice * 100) / 100
        : null,
    baselineMedianNightlyPrice: Math.round(baselineMedianNightlyPrice * 100) / 100,
    seasonalIndex:
      seasonalIndex != null && Number.isFinite(seasonalIndex)
        ? Math.round(seasonalIndex * 1000) / 1000
        : null,
    comparableCount,
    snapshotCount,
    confidenceScore,
    confidenceLabel: confidenceLabelFromScore(confidenceScore),
    warnings,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DEBUG_MI = process.env.DEBUG_MARKET_INTELLIGENCE === "true";

function miLog(kind: "query" | "result" | "insufficient-data", payload: Record<string, unknown>) {
  if (!DEBUG_MI) return;
  console.warn(`[market-intelligence][${kind}] ${JSON.stringify(payload)}`);
}

export type BuildMarketIntelligenceV1Params = {
  city: string | null;
  country: string | null;
  propertyType: string | null;
  platform: string | null;
};

export type MarketIntelligenceTrend = "up" | "down" | "stable" | "insufficient_data";

export type MarketIntelligenceDataFreshness = {
  newestSnapshotAt: string | null;
  oldestSnapshotAt: string | null;
  /** Jours entiers depuis le snapshot le plus récent (null si aucune donnée). */
  ageDaysNewest: number | null;
};

export type MarketIntelligenceV1 = {
  averageNightlyPrice: number | null;
  medianNightlyPrice: number | null;
  lowRange: number | null;
  highRange: number | null;
  comparableCount: number;
  snapshotCount: number;
  /** 0–100, score interne (voir limites dans la doc du module). */
  confidenceScore: number;
  confidenceLabel: "very_low" | "low" | "moderate" | "good" | "high";
  trend: MarketIntelligenceTrend;
  dataFreshness: MarketIntelligenceDataFreshness;
  warnings: string[];
};

type SnapshotRow = {
  id: string;
  created_at: string;
  platform: string;
  city: string | null;
  country: string | null;
  property_type: string | null;
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

function percentileLinear(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const pos = (sortedAsc.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo]!;
  const w = pos - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

function medianSorted(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return NaN;
  return percentileLinear(sortedAsc, 0.5);
}

function medianUnsorted(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return medianSorted(s);
}

function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
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

function confidenceLabelFromScore(score: number): MarketIntelligenceV1["confidenceLabel"] {
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
  const diffMs = now.getTime() - t;
  return Math.floor(Math.max(0, diffMs) / (24 * 60 * 60 * 1000));
}

function freshnessSubscore(ageDays: number | null): number {
  if (ageDays == null) return 0;
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.75;
  if (ageDays <= 90) return 0.45;
  return 0.2;
}

/**
 * Agrège les comparables persistés (Market Memory) pour une maille marché donnée.
 * Ne remplace pas l’extraction live ; lecture seule sur `market_snapshots` + `market_comparables`.
 *
 * Limites v1 :
 * - Les comparables ont souvent `city`/`country` nuls côté ligne ; le filtre géo utilise le **snapshot**.
 * - Multi-devises : on retient la devise majoritaire et on ignore les autres (warning).
 * - Pas de correction séjour / nuits : `nightly_price` tel que persisté.
 * - Tendance : médiane par snapshot puis agrégation par jour calendaire ; seuil ±5 % entre premier et dernier jour.
 */
export async function buildMarketIntelligenceV1(
  params: BuildMarketIntelligenceV1Params
): Promise<MarketIntelligenceV1> {
  const warnings: string[] = [];

  const city = normStr(params.city);
  const country = normStr(params.country);
  const propertyType = normStr(params.propertyType);
  const platform = normPlatform(params.platform);

  if (!platform) {
    warnings.push(
      "Aucune plateforme fournie : requête large, préférez passer `platform` pour un périmètre stable."
    );
  }

  const admin = createSupabaseAdminClient();

  const PAGE = 800;
  const snapshots: SnapshotRow[] = [];

  let snapFrom = 0;
  for (;;) {
    let q = admin
      .from("market_snapshots")
      .select("id, created_at, platform, city, country, property_type")
      .order("created_at", { ascending: false })
      .range(snapFrom, snapFrom + PAGE - 1);

    if (platform) {
      q = q.eq("platform", platform);
    }

    if (city) {
      q = q.not("city", "is", null).eq("city", city);
    }
    if (country) {
      q = q.not("country", "is", null).eq("country", country);
    }
    if (propertyType) {
      q = q.not("property_type", "is", null).eq("property_type", propertyType);
    }

    const { data, error } = await q;

    if (error) {
      warnings.push(`Lecture snapshots impossible : ${error.message}`);
      miLog("insufficient-data", {
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
    miLog("insufficient-data", {
      reason: "no_matching_snapshots",
      filters: { city, country, propertyType, platform },
      snapshotsTotalFetched: snapshots.length,
    });
    warnings.push("Aucun snapshot marché ne correspond aux filtres.");
    return emptyResult(warnings);
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
        miLog("insufficient-data", { reason: "comparable_query_error", message: error.message });
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
    miLog("insufficient-data", {
      reason: "no_price_rows",
      filters: { city, country, propertyType, platform },
      snapshotCount: filteredSnapshots.length,
    });
    warnings.push("Aucun comparable avec prix nocturne et devise valides pour ces filtres.");
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
        `Plusieurs devises détectées ; agrégation en ${dominant} uniquement (${dropped} ligne(s) exclue(s)).`
      );
    }
  }

  usable = usable.filter((u) => u.currency === dominant);
  const prices = usable.map((u) => u.nightly_price!);
  const distinctSnapshots = new Set(usable.map((u) => u.snapshot_id));

  const comparableCount = usable.length;
  const snapshotCount = distinctSnapshots.size;

  if (comparableCount < 5) {
    warnings.push(
      "Moins de 5 comparables : statistiques indicatives seulement, évitez une conclusion forte."
    );
    miLog("insufficient-data", {
      reason: "low_comparable_count",
      comparableCount,
      snapshotCount,
      filters: { city, country, propertyType, platform },
    });
  }

  const sortedPrices = [...prices].sort((a, b) => a - b);
  const medianNightlyPrice = medianSorted(sortedPrices);
  const averageNightlyPrice = mean(prices);

  let lowRange: number | null;
  let highRange: number | null;
  if (sortedPrices.length >= 5) {
    lowRange = percentileLinear(sortedPrices, 0.25);
    highRange = percentileLinear(sortedPrices, 0.75);
  } else {
    lowRange = sortedPrices[0] ?? null;
    highRange = sortedPrices[sortedPrices.length - 1] ?? null;
    if (sortedPrices.length > 0) {
      warnings.push("Effectif réduit : fourchettes min/max (pas de quartiles fiables).");
    }
  }

  const mu = averageNightlyPrice;
  const stdev = sampleStdev(prices, mu);
  const cv = mu > 0 ? stdev / mu : 1;
  const coherence01 = Math.max(0, Math.min(1, 1 - Math.min(cv, 1.2) / 1.2));

  const snapTimes = [...distinctSnapshots]
    .map((id) => snapById.get(id)?.created_at)
    .filter((t): t is string => typeof t === "string" && t.length > 0);
  const oldestSnapshotAt = snapTimes.length ? snapTimes.reduce((a, b) => (a < b ? a : b)) : null;
  const newestSnapshotAt = snapTimes.length ? snapTimes.reduce((a, b) => (a > b ? a : b)) : null;
  const now = new Date();
  const ageNewest = ageDaysNewest(now, newestSnapshotAt);

  const countScore = Math.min(1, comparableCount / 28) * 38;
  const snapshotScore = Math.min(1, snapshotCount / 12) * 22;
  const freshScore = freshnessSubscore(ageNewest) * 22;
  const cohScore = coherence01 * 18;

  let confidenceScore = Math.round(countScore + snapshotScore + freshScore + cohScore);
  if (comparableCount < 5) {
    confidenceScore = Math.min(confidenceScore, 38);
  }
  if (snapshotCount < 2) {
    confidenceScore = Math.min(confidenceScore, 45);
    warnings.push("Un seul snapshot source : la fraîcheur et la diversité temporelle sont limitées.");
  }
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  const trend = computeTrend(
    usable.map((u) => ({ snapshot_id: u.snapshot_id, nightly_price: u.nightly_price as number })),
    snapById
  );

  miLog("query", {
    filters: { city, country, propertyType, platform },
    snapshotsMatched: filteredSnapshots.length,
    comparableRowsRaw: comparablesAccum.length,
    comparableCount,
    snapshotCount,
    dominantCurrency: dominant,
    multiCurrency: counts.size > 1,
    cv: Math.round(cv * 1000) / 1000,
  });

  miLog("result", {
    averageNightlyPrice: Math.round(averageNightlyPrice * 100) / 100,
    medianNightlyPrice: Math.round(medianNightlyPrice * 100) / 100,
    lowRange: lowRange != null ? Math.round(lowRange * 100) / 100 : null,
    highRange: highRange != null ? Math.round(highRange * 100) / 100 : null,
    comparableCount,
    snapshotCount,
    confidenceScore,
    confidenceLabel: confidenceLabelFromScore(confidenceScore),
    trend,
    dataFreshness: {
      newestSnapshotAt,
      oldestSnapshotAt,
      ageDaysNewest: ageNewest,
    },
    warningsCount: warnings.length,
  });

  return {
    averageNightlyPrice: Number.isFinite(averageNightlyPrice)
      ? Math.round(averageNightlyPrice * 100) / 100
      : null,
    medianNightlyPrice: Number.isFinite(medianNightlyPrice)
      ? Math.round(medianNightlyPrice * 100) / 100
      : null,
    lowRange:
      lowRange != null && Number.isFinite(lowRange) ? Math.round(lowRange * 100) / 100 : null,
    highRange:
      highRange != null && Number.isFinite(highRange) ? Math.round(highRange * 100) / 100 : null,
    comparableCount,
    snapshotCount,
    confidenceScore,
    confidenceLabel: confidenceLabelFromScore(confidenceScore),
    trend,
    dataFreshness: {
      newestSnapshotAt,
      oldestSnapshotAt,
      ageDaysNewest: ageNewest,
    },
    warnings,
  };
}

function emptyResult(warnings: string[]): MarketIntelligenceV1 {
  return {
    averageNightlyPrice: null,
    medianNightlyPrice: null,
    lowRange: null,
    highRange: null,
    comparableCount: 0,
    snapshotCount: 0,
    confidenceScore: 0,
    confidenceLabel: "very_low",
    trend: "insufficient_data",
    dataFreshness: {
      newestSnapshotAt: null,
      oldestSnapshotAt: null,
      ageDaysNewest: null,
    },
    warnings,
  };
}

function computeTrend(
  usable: Array<{ snapshot_id: string; nightly_price: number }>,
  snapById: Map<string, SnapshotRow>
): MarketIntelligenceTrend {
  const bySnap = new Map<string, number[]>();
  for (const u of usable) {
    const arr = bySnap.get(u.snapshot_id) ?? [];
    arr.push(u.nightly_price);
    bySnap.set(u.snapshot_id, arr);
  }

  const dayToMedians = new Map<string, number[]>();
  for (const [sid, vals] of bySnap) {
    const snap = snapById.get(sid);
    if (!snap?.created_at) continue;
    const day = snap.created_at.slice(0, 10);
    const med = medianUnsorted(vals);
    if (!Number.isFinite(med)) continue;
    const arr = dayToMedians.get(day) ?? [];
    arr.push(med);
    dayToMedians.set(day, arr);
  }

  const days = [...dayToMedians.keys()].sort();
  if (days.length < 2) {
    return "insufficient_data";
  }

  const firstDayMed = medianUnsorted(dayToMedians.get(days[0]!)!);
  const lastDayMed = medianUnsorted(dayToMedians.get(days[days.length - 1]!)!);
  if (!Number.isFinite(firstDayMed) || !Number.isFinite(lastDayMed) || firstDayMed <= 0) {
    return "insufficient_data";
  }

  const ratio = lastDayMed / firstDayMed;
  if (ratio > 1.05) return "up";
  if (ratio < 0.95) return "down";
  return "stable";
}

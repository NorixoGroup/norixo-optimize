import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { parseBookingStayNightsFromUrl } from "@/lib/extractors/booking-url";
import type { ExtractedListing } from "@/lib/extractors/types";

const DEBUG_MM = process.env.DEBUG_MARKET_MEMORY === "true";

function mmLog(kind: string, payload?: Record<string, unknown>) {
  if (!DEBUG_MM) return;
  const line = `[market-memory][${kind}] ${JSON.stringify(payload ?? {})}`;
  console.warn(line);
}

export type MarketSnapshotBundleMeta = {
  attempted: number;
  selected: number;
  radiusKm: number;
  maxResults: number;
};

export type SaveMarketSnapshotInput = {
  target: ExtractedListing;
  competitors: ExtractedListing[];
  bundle: MarketSnapshotBundleMeta;
  /** Contexte additionnel (ex. listing_id, route) — jamais bloquant. */
  extraMetadata?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function locationCityCountry(target: ExtractedListing): { city: string | null; country: string | null } {
  const loc = (target as { location?: unknown }).location;
  if (!isRecord(loc)) return { city: null, country: null };
  const city = typeof loc.city === "string" && loc.city.trim() ? loc.city.trim() : null;
  const country = typeof loc.country === "string" && loc.country.trim() ? loc.country.trim() : null;
  return { city, country };
}

function parseBookingStayDatesFromUrl(url: string): { checkIn: string | null; checkOut: string | null } {
  try {
    const sp = new URL(url.trim()).searchParams;
    const ci = sp.get("checkin")?.trim() ?? "";
    const co = sp.get("checkout")?.trim() ?? "";
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (iso.test(ci) && iso.test(co)) return { checkIn: ci, checkOut: co };
  } catch {
    /* ignore */
  }
  return { checkIn: null, checkOut: null };
}

function snapshotStayFields(target: ExtractedListing): {
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
} {
  const nights =
    typeof target.stayNights === "number" && Number.isFinite(target.stayNights) && target.stayNights > 0
      ? Math.floor(target.stayNights)
      : parseBookingStayNightsFromUrl(target.url ?? "");
  if (target.platform === "booking" && typeof target.url === "string") {
    const { checkIn, checkOut } = parseBookingStayDatesFromUrl(target.url);
    return { checkIn, checkOut, nights };
  }
  return { checkIn: null, checkOut: null, nights };
}

function buildQuerySignature(parts: {
  platform: string;
  city: string | null;
  country: string | null;
  propertyType: string | null;
  radiusKm: number;
  maxResults: number;
  sourceUrl: string | null;
}): string {
  const payload = [
    parts.platform,
    parts.city ?? "",
    parts.country ?? "",
    parts.propertyType ?? "",
    String(parts.radiusKm),
    String(parts.maxResults),
    (parts.sourceUrl ?? "").trim().slice(0, 512),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function comparableUrl(c: ExtractedListing): string {
  const u = (c.url || c.sourceUrl || c.canonicalUrl || "").trim();
  return u;
}

function normalizedSignatureForComparable(c: ExtractedListing): string {
  const parts = [
    c.platform,
    comparableUrl(c).toLowerCase(),
    (c.title || "").slice(0, 160),
    (c.locationLabel || "").slice(0, 120),
    c.price != null && Number.isFinite(c.price) ? String(Math.round(c.price * 100) / 100) : "",
    c.latitude ?? "",
    c.longitude ?? "",
  ].join("|");
  return createHash("sha256").update(parts).digest("hex");
}

function dedupeKeyForComparable(c: ExtractedListing): string {
  const url = comparableUrl(c).toLowerCase();
  if (url.length > 0) return `url:${url}`;
  return `sig:${normalizedSignatureForComparable(c)}`;
}

function slimRawComparable(c: ExtractedListing): Record<string, unknown> {
  const desc =
    typeof c.description === "string" && c.description.length > 4000
      ? `${c.description.slice(0, 4000)}…`
      : c.description;
  return {
    ...c,
    description: desc,
    photos: Array.isArray(c.photos) ? c.photos.slice(0, 30) : c.photos,
  } as unknown as Record<string, unknown>;
}

/**
 * Persiste un snapshot marché + comparables (append-only).
 * Ne lance jamais d’erreur : en cas d’échec, log warning uniquement.
 */
export async function saveMarketSnapshot(input: SaveMarketSnapshotInput): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { city, country } = locationCityCountry(input.target);
    const platform = input.target.platform ?? "other";
    const propertyType =
      typeof input.target.propertyType === "string" && input.target.propertyType.trim()
        ? input.target.propertyType.trim()
        : null;
    const sourceUrl =
      typeof input.target.url === "string" && input.target.url.trim()
        ? input.target.url.trim()
        : typeof input.target.sourceUrl === "string"
          ? input.target.sourceUrl.trim()
          : null;
    const querySignature = buildQuerySignature({
      platform,
      city,
      country,
      propertyType,
      radiusKm: input.bundle.radiusKm,
      maxResults: input.bundle.maxResults,
      sourceUrl,
    });
    const { checkIn, checkOut, nights } = snapshotStayFields(input.target);

    const checkInDate = checkIn;
    const checkOutDate = checkOut;

    const metadata = {
      ...input.extraMetadata,
      bundle: {
        attempted: input.bundle.attempted,
        selected: input.bundle.selected,
        radiusKm: input.bundle.radiusKm,
        maxResults: input.bundle.maxResults,
      },
    };

    const seen = new Set<string>();
    const rows: Array<Record<string, unknown>> = [];
    let skipped = 0;
    for (const c of input.competitors) {
      const key = dedupeKeyForComparable(c);
      if (seen.has(key)) {
        skipped += 1;
        mmLog("dedupe-skipped", { key: key.slice(0, 80) });
        continue;
      }
      seen.add(key);
      const url = comparableUrl(c) || null;
      const sig = normalizedSignatureForComparable(c);
      const compStay = snapshotStayFields(c);
      const ratingVal =
        typeof c.rating === "number" && Number.isFinite(c.rating)
          ? c.rating
          : typeof c.ratingValue === "number" && Number.isFinite(c.ratingValue)
            ? c.ratingValue
            : null;
      const reviewCount =
        typeof c.reviewCount === "number" && Number.isFinite(c.reviewCount) ? Math.floor(c.reviewCount) : null;
      rows.push({
        platform: c.platform ?? "other",
        url,
        title: typeof c.title === "string" ? c.title.slice(0, 2000) : null,
        city: null,
        country: null,
        property_type:
          typeof c.propertyType === "string" && c.propertyType.trim() ? c.propertyType.trim() : null,
        nightly_price:
          typeof c.price === "number" && Number.isFinite(c.price) ? Math.round(c.price * 100) / 100 : null,
        total_price:
          typeof c.rawStayPrice === "number" && Number.isFinite(c.rawStayPrice)
            ? Math.round(c.rawStayPrice * 100) / 100
            : null,
        currency: typeof c.currency === "string" && c.currency.trim() ? c.currency.trim().toUpperCase() : null,
        rating: ratingVal,
        review_count: reviewCount,
        latitude:
          typeof c.latitude === "number" && Number.isFinite(c.latitude) ? Math.round(c.latitude * 1e6) / 1e6 : null,
        longitude:
          typeof c.longitude === "number" && Number.isFinite(c.longitude) ? Math.round(c.longitude * 1e6) / 1e6 : null,
        check_in: compStay.checkIn,
        check_out: compStay.checkOut,
        nights: compStay.nights,
        raw: slimRawComparable(c),
        normalized_signature: sig,
      });
    }

    const { data: snap, error: snapErr } = await admin
      .from("market_snapshots")
      .insert({
        platform,
        city,
        country,
        property_type: propertyType,
        check_in: checkInDate,
        check_out: checkOutDate,
        nights,
        source_url: sourceUrl,
        query_signature: querySignature,
        comparable_count: rows.length,
        confidence_score: null,
        metadata,
      })
      .select("id")
      .single();

    if (snapErr || !snap?.id) {
      mmLog("save-error", { phase: "snapshot", message: snapErr?.message ?? "no id" });
      return;
    }

    mmLog("snapshot-created", { snapshotId: snap.id, comparableCount: rows.length, skipped });

    if (rows.length === 0) {
      mmLog("comparables-saved", { snapshotId: snap.id, inserted: 0 });
      return;
    }

    const withSnapshot = rows.map((r) => ({ ...r, snapshot_id: snap.id }));
    const { error: compErr } = await admin.from("market_comparables").insert(withSnapshot);
    if (compErr) {
      mmLog("save-error", { phase: "comparables", message: compErr.message, snapshotId: snap.id });
      return;
    }

    mmLog("comparables-saved", { snapshotId: snap.id, inserted: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    mmLog("save-error", { phase: "outer", message: msg });
  }
}

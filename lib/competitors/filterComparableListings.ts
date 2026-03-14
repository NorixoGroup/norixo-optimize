import type { ExtractedListing } from "@/lib/extractors/types";

function normalizeType(value?: string | null): string {
  if (!value) return "unknown";

  const v = value.toLowerCase();

  if (v.includes("studio")) return "studio";
  if (
    v.includes("apartment") ||
    v.includes("flat") ||
    v.includes("appartement")
  ) {
    return "apartment";
  }
  if (v.includes("villa")) return "villa";
  if (v.includes("house") || v.includes("maison")) return "house";
  if (v.includes("riad")) return "riad";
  if (v.includes("loft")) return "loft";

  return v.trim();
}

function safeNumber(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

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
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function capacityCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const t = safeNumber(target.capacity);
  const c = safeNumber(candidate.capacity);

  if (t === null || c === null) return true;

  return Math.abs(t - c) <= 1;
}

function bedroomsCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const t = safeNumber(target.bedrooms);
  const c = safeNumber(candidate.bedrooms);

  if (t === null || c === null) return true;

  return Math.abs(t - c) <= 1;
}

function bathroomsCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const t = safeNumber(target.bathrooms);
  const c = safeNumber(candidate.bathrooms);

  if (t === null || c === null) return true;

  return Math.abs(t - c) <= 1;
}

function typeCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const targetType = normalizeType(target.propertyType);
  const candidateType = normalizeType(candidate.propertyType);

  if (targetType === "unknown" || candidateType === "unknown") return true;

  return targetType === candidateType;
}

function platformCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  if (!target.platform || !candidate.platform) return true;
  return target.platform === candidate.platform;
}

function locationCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const distanceKm = getDistanceKm(
    target.latitude,
    target.longitude,
    candidate.latitude,
    candidate.longitude
  );

  if (distanceKm === null) return true;

  return distanceKm <= 2;
}

function computeComparableScore(
  target: ExtractedListing,
  candidate: ExtractedListing
): number {
  let score = 0;

  if (platformCompatible(target, candidate)) score += 20;
  if (typeCompatible(target, candidate)) score += 40;

  const tCapacity = safeNumber(target.capacity);
  const cCapacity = safeNumber(candidate.capacity);
  if (tCapacity !== null && cCapacity !== null) {
    score += Math.max(0, 20 - Math.abs(tCapacity - cCapacity) * 8);
  }

  const tBedrooms = safeNumber(target.bedrooms);
  const cBedrooms = safeNumber(candidate.bedrooms);
  if (tBedrooms !== null && cBedrooms !== null) {
    score += Math.max(0, 12 - Math.abs(tBedrooms - cBedrooms) * 6);
  }

  const tBathrooms = safeNumber(target.bathrooms);
  const cBathrooms = safeNumber(candidate.bathrooms);
  if (tBathrooms !== null && cBathrooms !== null) {
    score += Math.max(0, 8 - Math.abs(tBathrooms - cBathrooms) * 4);
  }

  const distanceKm = getDistanceKm(
    target.latitude,
    target.longitude,
    candidate.latitude,
    candidate.longitude
  );

  if (distanceKm !== null) {
    score += Math.max(0, 15 - distanceKm * 5);
  }

  return score;
}

export function filterComparableListings(
  target: ExtractedListing,
  candidates: ExtractedListing[],
  maxResults = 5
): ExtractedListing[] {
  const filtered = candidates
    .filter((candidate) => candidate.url !== target.url)
    .filter((candidate) => typeCompatible(target, candidate))
    .filter((candidate) => capacityCompatible(target, candidate))
    .filter((candidate) => bedroomsCompatible(target, candidate))
    .filter((candidate) => bathroomsCompatible(target, candidate))
    .filter((candidate) => locationCompatible(target, candidate))
    .map((candidate) => ({
      candidate,
      comparableScore: computeComparableScore(target, candidate),
      distanceKm: getDistanceKm(
        target.latitude,
        target.longitude,
        candidate.latitude,
        candidate.longitude
      ),
    }))
    .sort((a, b) => {
      const scoreDiff = b.comparableScore - a.comparableScore;
      if (scoreDiff !== 0) return scoreDiff;

      const distanceA =
        typeof a.distanceKm === "number" && Number.isFinite(a.distanceKm)
          ? a.distanceKm
          : 999;
      const distanceB =
        typeof b.distanceKm === "number" && Number.isFinite(b.distanceKm)
          ? b.distanceKm
          : 999;

      return distanceA - distanceB;
    })
    .slice(0, maxResults);

  return filtered.map((item) => item.candidate);
}
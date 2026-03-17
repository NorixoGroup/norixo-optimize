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

function hasBasicData(listing: ExtractedListing): boolean {
  const hasTitle = typeof listing.title === "string" && listing.title.trim().length > 0;
  const hasPhotos = Array.isArray(listing.photos) && listing.photos.length > 0;
  const hasAmenities = Array.isArray(listing.amenities) && listing.amenities.length > 0;
  const hasPrice = safeNumber(listing.price) !== null;

  return hasTitle || hasPhotos || hasAmenities || hasPrice;
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

  // Allow a broader radius but avoid clearly different areas
  return distanceKm <= 50;
}

function priceCompatible(
  target: ExtractedListing,
  candidate: ExtractedListing
): boolean {
  const t = safeNumber(target.price);
  const c = safeNumber(candidate.price);

  if (t === null || c === null || t <= 0 || c <= 0) return true;

  const ratio = c / t;

  // Filter out extreme outliers (very underpriced or overpriced vs target)
  if (ratio < 0.33 || ratio > 3) return false;

  return true;
}

function computeCompletenessScore(listing: ExtractedListing): number {
  let score = 0;

  if (listing.title && listing.title.trim().length > 0) score += 2;

  const descriptionLength = listing.description?.trim().length ?? 0;
  if (descriptionLength > 0) score += descriptionLength > 120 ? 2 : 1;

  if (Array.isArray(listing.photos) && listing.photos.length > 0) {
    score += Math.min(3, listing.photos.length >= 10 ? 3 : 2);
  }

  if (Array.isArray(listing.amenities) && listing.amenities.length > 0) {
    score += listing.amenities.length >= 8 ? 2 : 1;
  }

  if (safeNumber(listing.price) !== null) score += 1;
  if (safeNumber(listing.rating) !== null && safeNumber(listing.reviewCount) !== null)
    score += 1;

  return Math.max(0, Math.min(10, score));
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

  const tPrice = safeNumber(target.price);
  const cPrice = safeNumber(candidate.price);
  if (tPrice !== null && tPrice > 0 && cPrice !== null && cPrice > 0) {
    const ratio = cPrice / tPrice;
    const deviation = Math.abs(ratio - 1);

    if (deviation <= 0.15) {
      score += 12;
    } else if (deviation <= 0.3) {
      score += 8;
    } else if (deviation <= 0.5) {
      score += 4;
    }
  }

  // Reward listings that have enough data to be meaningfully comparable
  score += computeCompletenessScore(candidate);

  return score;
}

export function filterComparableListings(
  target: ExtractedListing,
  candidates: ExtractedListing[],
  maxResults = 5
): ExtractedListing[] {
  const filtered = candidates
    .filter((candidate) => candidate.url !== target.url)
    .filter((candidate) => hasBasicData(candidate))
    .filter((candidate) => typeCompatible(target, candidate))
    .filter((candidate) => capacityCompatible(target, candidate))
    .filter((candidate) => bedroomsCompatible(target, candidate))
    .filter((candidate) => bathroomsCompatible(target, candidate))
    .filter((candidate) => locationCompatible(target, candidate))
    .filter((candidate) => priceCompatible(target, candidate))
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
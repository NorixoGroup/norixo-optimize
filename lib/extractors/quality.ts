import type { ListingFieldMeta, ListingFieldQuality, ListingPhotoMeta } from "./types";

function inferFieldConfidence(length: number, quality: ListingFieldQuality) {
  if (quality === "high") return length >= 900 ? 0.95 : 0.88;
  if (quality === "medium") return length >= 250 ? 0.72 : 0.65;
  return length > 0 ? 0.45 : 0.2;
}

export function inferTitleQuality(title: string): ListingFieldMeta["quality"] {
  const normalized = title.trim();
  if (normalized.length >= 32) return "high";
  if (normalized.length >= 18) return "medium";
  return "low";
}

export function inferDescriptionQuality(description: string): ListingFieldMeta["quality"] {
  const normalized = description.trim();
  if (normalized.length >= 1000) return "high";
  if (normalized.length >= 300) return "medium";
  return "low";
}

export function inferPhotoQuality(photoCount: number): ListingPhotoMeta["quality"] {
  if (photoCount >= 20) return "high";
  if (photoCount >= 10) return "medium";
  return "low";
}

export function buildFieldMeta(input: {
  source: string | null;
  value: string;
  quality: ListingFieldQuality;
}): ListingFieldMeta {
  const length = input.value.trim().length;

  return {
    source: input.source,
    length,
    quality: input.quality,
    confidence: inferFieldConfidence(length, input.quality),
  };
}

export function buildPhotoMeta(input: {
  source: string | null;
  photos: string[];
}): ListingPhotoMeta {
  const count = input.photos.length;
  const quality = inferPhotoQuality(count);

  return {
    count,
    source: input.source,
    quality,
    confidence: quality === "high" ? 0.92 : quality === "medium" ? 0.74 : 0.46,
  };
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => normalizeWhitespace(v)).filter(Boolean))];
}

export function normalizeImageUrlForDedup(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.search = "";

    // Booking gallery images often vary only by size segment.
    url.pathname = url.pathname
      .replace(/\/max\d+x\d+\//i, "/")
      .replace(/\/square\d+\//i, "/")
      .replace(/\/[a-z]\//i, "/");

    return url.toString();
  } catch {
    return trimmed;
  }
}

export function getBookingImageAssetKey(input: string): string {
  const normalizedUrl = normalizeImageUrlForDedup(input);
  if (!normalizedUrl) return "";

  try {
    const url = new URL(normalizedUrl);
    const lowerPath = url.pathname.toLowerCase();

    if (!isLikelyBookingListingPhotoUrl(normalizedUrl)) {
      return "";
    }

    let assetPath = url.pathname
      .replace(/\/max\d+x\d+\//i, "/")
      .replace(/\/square\d+\//i, "/")
      .replace(/\/[a-z]\//i, "/")
      .replace(/\.(jpg|jpeg|png|webp)$/i, "");

    if (lowerPath.includes("/xdata/images/hotel/")) {
      assetPath = assetPath.replace(/^.*\/xdata\/images\/hotel\//i, "");
    } else if (lowerPath.includes("/hotelimages/")) {
      assetPath = assetPath.replace(/^.*\/hotelimages\//i, "");
    }

    const parts = assetPath.split("/").filter(Boolean);
    const basename = parts[parts.length - 1] ?? "";

    return basename.toLowerCase();
  } catch {
    return "";
  }
}

export function dedupeImageUrls(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const originalUrl = value.trim();
    const normalized = normalizeImageUrlForDedup(originalUrl);

    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);

    // Normalize only to identify duplicate assets.
    // Preserve the original resource URL because CDN query parameters
    // can be required to access the image.
    result.push(originalUrl);
  }

  return result;
}

export function dedupeBookingListingPhotoUrls(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const originalUrl = value.trim();
    const assetKey = getBookingImageAssetKey(originalUrl);
    if (!assetKey || seen.has(assetKey)) continue;
    seen.add(assetKey);
    // Use normalization only to identify duplicate Booking assets.
    // Preserve the original CDN resource URL for downstream consumers.
    result.push(originalUrl);
  }

  return result;
}

export function isLikelyBookingListingPhotoUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;

  const lower = value.toLowerCase();

  if (
    lower.includes("thumbnail") ||
    lower.includes("thumb") ||
    lower.includes("small") ||
    lower.includes("portrait") ||
    lower.includes("landmark") ||
    lower.includes("logo") ||
    lower.includes("avatar") ||
    lower.includes("flag") ||
    lower.includes("sprite") ||
    lower.includes("icon") ||
    lower.includes("badge") ||
    lower.includes("map") ||
    lower.includes("static/img") ||
    lower.includes("transparent")
  ) {
    return false;
  }

  return (
    lower.includes("/xdata/images/hotel/") ||
    lower.includes("/hotelimages/") ||
    lower.includes("cf.bstatic.com")
  );
}

export function extractImageUrlsFromUnknown(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === "string") {
    return /^https?:\/\/.+\.(jpg|jpeg|png|webp)(?:\?.*)?$/i.test(value) ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractImageUrlsFromUnknown(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const directKeys = [
      "image",
      "images",
      "url",
      "src",
      "photo",
      "photos",
      "image_url",
      "imageUrl",
      "thumbnail_url",
      "thumbnailUrl",
    ];

    const directMatches = directKeys.flatMap((key) => extractImageUrlsFromUnknown(record[key]));
    const nestedMatches = Object.values(record).flatMap((entry) =>
      extractImageUrlsFromUnknown(entry)
    );

    return [...directMatches, ...nestedMatches];
  }

  return [];
}

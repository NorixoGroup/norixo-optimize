export type NormalizedListing = {
  platform: "airbnb" | "booking" | "vrbo" | "unknown";
  title: string;
  description: string;
  price: number | null;
  currency: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: string[];
  amenities: string[];
  rating: number | null;
  reviewsCount: number | null;
  city: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normalizePlatform(value: unknown): NormalizedListing["platform"] {
  if (typeof value !== "string") return "unknown";
  const v = value.toLowerCase();
  if (v.includes("airbnb")) return "airbnb";
  if (v.includes("booking")) return "booking";
  if (v.includes("vrbo")) return "vrbo";
  return "unknown";
}

export function normalizeListing(input: unknown): NormalizedListing {
  const base: NormalizedListing = {
    platform: "unknown",
    title: "",
    description: "",
    price: null,
    currency: null,
    latitude: null,
    longitude: null,
    photos: [],
    amenities: [],
    rating: null,
    reviewsCount: null,
    city: null,
  };

  if (!isRecord(input)) {
    return base;
  }

  const platformSource =
    (input.platform as unknown) ?? (input.source as unknown) ?? (input.channel as unknown);

  const title = toString(input.title) ?? toString((input as any).name) ?? "";
  const description =
    toString(input.description) ?? toString((input as any).summary) ?? "";

  const price = toNumber(input.price ?? (input as any).nightlyPrice ?? (input as any).basePrice);

  const currency =
    toString(input.currency ?? (input as any).currencyCode ?? (input as any).isoCurrencyCode);

  const latitude = toNumber(input.latitude ?? (input as any).lat);
  const longitude = toNumber(input.longitude ?? (input as any).lng ?? (input as any).lon);

  const photos =
    toStringArray(input.photos) ||
    toStringArray((input as any).images) ||
    toStringArray((input as any).photoUrls);

  const amenities =
    toStringArray(input.amenities) ||
    toStringArray((input as any).features) ||
    toStringArray((input as any).tags);

  const rating = toNumber(input.rating ?? (input as any).reviewScore ?? (input as any).score);
  const reviewsCount = toNumber(
    input.reviewsCount ?? (input as any).numberOfReviews ?? (input as any).reviews
  );

  const city =
    toString(input.city) ??
    toString((input as any).locationCity) ??
    (isRecord(input.location) ? toString((input.location as any).city) : null);

  return {
    ...base,
    platform: normalizePlatform(platformSource),
    title,
    description,
    price,
    currency,
    latitude,
    longitude,
    photos,
    amenities,
    rating,
    reviewsCount,
    city,
  };
}

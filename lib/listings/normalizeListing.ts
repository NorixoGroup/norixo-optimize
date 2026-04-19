export type NormalizedListing = {
  platform: "airbnb" | "booking" | "vrbo" | "agoda" | "expedia" | "unknown";
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

function getValue(record: Record<string, unknown>, key: string): unknown {
  return record[key];
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
  if (v.includes("agoda")) return "agoda";
  if (v.includes("expedia")) return "expedia";
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
    input.platform ?? input.source ?? input.channel;

  const title = toString(input.title) ?? toString(getValue(input, "name")) ?? "";
  const description =
    toString(input.description) ?? toString(getValue(input, "summary")) ?? "";

  const price = toNumber(input.price ?? getValue(input, "nightlyPrice") ?? getValue(input, "basePrice"));

  const currency =
    toString(input.currency ?? getValue(input, "currencyCode") ?? getValue(input, "isoCurrencyCode"));

  const latitude = toNumber(input.latitude ?? getValue(input, "lat"));
  const longitude = toNumber(input.longitude ?? getValue(input, "lng") ?? getValue(input, "lon"));

  const photos =
    toStringArray(input.photos).length > 0
      ? toStringArray(input.photos)
      : toStringArray(getValue(input, "images")).length > 0
        ? toStringArray(getValue(input, "images"))
        : toStringArray(getValue(input, "photoUrls"));

  const amenities =
    toStringArray(input.amenities).length > 0
      ? toStringArray(input.amenities)
      : toStringArray(getValue(input, "features")).length > 0
        ? toStringArray(getValue(input, "features"))
        : toStringArray(getValue(input, "tags"));

  const rating = toNumber(input.rating ?? getValue(input, "reviewScore") ?? getValue(input, "score"));
  const reviewsCount = toNumber(
    input.reviewsCount ?? getValue(input, "numberOfReviews") ?? getValue(input, "reviews")
  );

  const city =
    toString(input.city) ??
    toString(getValue(input, "locationCity")) ??
    (isRecord(input.location) ? toString(getValue(input.location, "city")) : null);

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

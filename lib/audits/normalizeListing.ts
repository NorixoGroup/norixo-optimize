export function normalizeListing(raw: any) {
  return {
    title: raw?.title ?? "",
    description: raw?.description ?? "",
    photos: Array.isArray(raw?.photos) ? raw.photos : [],
    amenities: Array.isArray(raw?.amenities) ? raw.amenities : [],
    price: raw?.price ?? null,
    rating: raw?.rating ?? null,
    reviewsCount: raw?.reviewsCount ?? 0,
    location: raw?.location ?? null,
    url: raw?.url ?? null,

    // ✅ AJOUT CRITIQUE
    platform: raw?.platform ?? raw?.source_platform ?? "unknown",
  };
}
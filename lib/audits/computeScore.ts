type ComputeScoreResult = {
  photoScore: number;
  descriptionScore: number;
  amenitiesScore: number;
  trustScore: number;

  overallScore: number;
  listingQuality: number;
  conversion: number;
};

export function computeScore(data: unknown): ComputeScoreResult {
  const d =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};

  const photos = Array.isArray(d.photos) ? d.photos : [];
  const description = typeof d.description === "string" ? d.description : "";
  const amenities = Array.isArray(d.amenities) ? d.amenities : [];
  const reviewsCount =
    typeof d.reviewsCount === "number" ? d.reviewsCount : 0;

  // 📸 PHOTO SCORE
  const photoScore = Math.min(10, photos.length);

  // 📝 DESCRIPTION SCORE
  const descriptionScore =
    description.length > 800 ? 9 :
    description.length > 400 ? 7 :
    description.length > 200 ? 5 : 3;

  // 🏠 AMENITIES SCORE
  const amenitiesScore =
    amenities.length > 20 ? 9 :
    amenities.length > 10 ? 7 :
    amenities.length > 5 ? 5 : 3;

  // ⭐ TRUST SCORE (ultra important business)
  const trustScore =
    reviewsCount > 20 ? 9 :
    reviewsCount > 5 ? 7 :
    reviewsCount > 0 ? 5 : 2;

  // 🎯 GLOBAL (qualité perçue)
  const listingQuality =
    (photoScore + descriptionScore + amenitiesScore) / 3;

  // 💰 CONVERSION (basé sur trust + description)
  const conversion =
    (trustScore * 0.6 + descriptionScore * 0.4);

  // 🧠 SCORE FINAL
  const overall =
    listingQuality * 0.6 +
    conversion * 0.4;

  return {
    photoScore,
    descriptionScore,
    amenitiesScore,
    trustScore,

    // ✅ aligné avec ton route.ts
    overallScore: Math.round(overall * 10) / 10,
    listingQuality: Math.round(listingQuality * 10) / 10,
    conversion: Math.round(conversion * 10) / 10,
  };
}
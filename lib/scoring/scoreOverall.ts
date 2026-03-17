export function scoreOverall(input: {
  photos: number;
  description: number;
  amenities: number;
  seo: number;
  trust: number;
  pricing: number;
}): number {
  const clamp = (v: number) => Math.max(0, Math.min(10, v));

  const photos = clamp(input.photos);
  const description = clamp(input.description);
  const amenities = clamp(input.amenities);
  const seo = clamp(input.seo);
  const trust = clamp(input.trust);
  const pricing = clamp(input.pricing);

  const weighted =
    photos * 0.22 +
    description * 0.22 +
    amenities * 0.18 +
    seo * 0.14 +
    trust * 0.12 +
    pricing * 0.12;

  const clamped = clamp(weighted);
  return Number(clamped.toFixed(1));
}

import { OpenAIConfigurationError, getOpenAIClient } from "@/lib/openai";

export type ListingPhotoCategory =
  | "living_room"
  | "bedroom"
  | "bathroom"
  | "kitchen"
  | "dining"
  | "exterior"
  | "pool"
  | "view"
  | "workspace"
  | "amenity"
  | "other";

export type ListingPhotoObservation = {
  index: number;
  category: ListingPhotoCategory;
  technicalQuality: number;
  lighting: number;
  composition: number;
  presentation: number;
  bookingAppeal: number;
  isLikelyDuplicate: boolean;
  duplicateOfIndex: number | null;
  strengths: string[];
  issues: string[];
};

export type ListingVisualAnalysis = {
  status: "analyzed" | "partial" | "unavailable";
  analyzedPhotoCount: number;
  totalPhotoCount: number;
  visualQuality: number | null;
  coverQuality: number | null;
  galleryOrder: number | null;
  visualDiversity: number | null;
  roomCoverage: number | null;
  photos: ListingPhotoObservation[];
  duplicateGroups: number[][];
  detectedCategories: ListingPhotoCategory[];
  missingImportantCategories: ListingPhotoCategory[];
  strengths: string[];
  weaknesses: string[];
  recommendedOrder: number[];
};

export type AnalyzeListingPhotosInput = {
  photos: string[];
  title?: string | null;
  description?: string | null;
  amenities?: string[];
  platform?: string | null;
};

export type SelectedListingPhoto = {
  index: number;
  url: string;
};

const CATEGORIES: readonly ListingPhotoCategory[] = [
  "living_room",
  "bedroom",
  "bathroom",
  "kitchen",
  "dining",
  "exterior",
  "pool",
  "view",
  "workspace",
  "amenity",
  "other",
];

const CORE_CATEGORIES: readonly ListingPhotoCategory[] = [
  "living_room",
  "bedroom",
  "bathroom",
  "kitchen",
];

const MAX_IMAGES = 12;
const MIN_ACCESSIBLE_IMAGES = 3;
const IMAGE_PREFLIGHT_TIMEOUT_MS = 8_000;
const IMAGE_PREFLIGHT_CONCURRENCY = 4;

const TRUSTED_LISTING_IMAGE_HOSTS: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  airbnb: Object.freeze([
    "a0.muscache.com",
  ]),
  booking: Object.freeze([
    "cf.bstatic.com",
  ]),
  agoda: Object.freeze([
    "pix8.agoda.net",
    "q-xx.bstatic.com",
  ]),
  vrbo: Object.freeze([
    "media.vrbo.com",
  ]),
});

function normalizeVisionPlatform(
  platform: string | null | undefined,
): string {
  return String(platform ?? "")
    .trim()
    .toLowerCase();
}

export function isTrustedListingImageUrl(
  rawUrl: string,
  platform: string | null | undefined,
): boolean {
  try {
    const url = new URL(rawUrl);
    const normalizedPlatform =
      normalizeVisionPlatform(platform);

    const allowedHosts =
      TRUSTED_LISTING_IMAGE_HOSTS[
        normalizedPlatform
      ];

    if (!allowedHosts) return false;

    if (url.protocol !== "https:") {
      return false;
    }

    if (
      url.username ||
      url.password
    ) {
      return false;
    }

    if (
      url.port &&
      url.port !== "443"
    ) {
      return false;
    }

    const hostname =
      url.hostname
        .toLowerCase();

    return allowedHosts.includes(
      hostname,
    );
  } catch {
    return false;
  }
}

async function isAccessibleImageUrl(
  url: string,
  platform: string | null | undefined,
): Promise<boolean> {
  if (
    !isTrustedListingImageUrl(
      url,
      platform,
    )
  ) {
    return false;
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      IMAGE_PREFLIGHT_TIMEOUT_MS,
    );

  try {
    const response =
      await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept:
            "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          Range: "bytes=0-0",
          "User-Agent":
            "NorixoListingVision/1.0",
        },
      });

    /*
     * Never follow a redirect here.
     *
     * Even a redirect originating from an
     * allowed CDN must be rejected rather than
     * allowing fetch() to contact an unchecked
     * destination.
     */
    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      try {
        await response.body?.cancel();
      } catch {
        // Best-effort body cancellation only.
      }

      return false;
    }

    const contentType =
      response.headers.get(
        "content-type",
      ) ?? "";

    const valid =
      response.ok &&
      /^image\//i.test(
        contentType,
      );

    /*
     * Range requests normally return only a
     * tiny response. If a CDN ignores Range and
     * starts a normal 200 body, cancel the stream
     * immediately instead of downloading the
     * complete image.
     */
    try {
      await response.body?.cancel();
    } catch {
      // Best-effort body cancellation only.
    }

    return valid;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function filterAccessibleListingPhotos(
  photos: SelectedListingPhoto[],
  platform: string | null | undefined,
): Promise<SelectedListingPhoto[]> {
  const accessible:
    SelectedListingPhoto[] = [];

  for (
    let offset = 0;
    offset < photos.length;
    offset +=
      IMAGE_PREFLIGHT_CONCURRENCY
  ) {
    const batch =
      photos.slice(
        offset,
        offset +
          IMAGE_PREFLIGHT_CONCURRENCY,
      );

    const checks =
      await Promise.all(
        batch.map(
          async (photo) => ({
            photo,
            accessible:
              await isAccessibleImageUrl(
                photo.url,
                platform,
              ),
          }),
        ),
      );

    for (const entry of checks) {
      if (entry.accessible) {
        accessible.push(
          entry.photo,
        );
      }
    }
  }

  return accessible;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10, value));
}

function round(value: number): number {
  return Number(clamp(value).toFixed(1));
}

function isHttpImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function selectListingPhotos(
  photos: string[] | undefined,
  limit = MAX_IMAGES,
): {
  selected: SelectedListingPhoto[];
  totalPhotoCount: number;
} {
  const unique: SelectedListingPhoto[] = [];
  const seen = new Set<string>();

  for (const [index, rawUrl] of (Array.isArray(photos) ? photos : []).entries()) {
    if (!isHttpImageUrl(rawUrl)) continue;

    const url = rawUrl.trim();
    if (seen.has(url)) continue;

    seen.add(url);
    unique.push({ index, url });
  }

  return {
    selected: unique.slice(0, Math.max(0, limit)),
    totalPhotoCount: unique.length,
  };
}

function boundedStrings(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, max);
}

function validCategory(value: unknown): ListingPhotoCategory {
  return typeof value === "string" &&
    CATEGORIES.includes(value as ListingPhotoCategory)
    ? (value as ListingPhotoCategory)
    : "other";
}

function finiteScore(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return round(Number.isFinite(number) ? number : 0);
}

export function normalizePhotoObservations(
  raw: unknown,
  validIndexes: number[],
): ListingPhotoObservation[] {
  if (!Array.isArray(raw)) return [];

  const allowed = new Set(validIndexes);
  const seen = new Set<number>();
  const observations: ListingPhotoObservation[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const record = item as Record<string, unknown>;
    const index = Number(record.index);

    if (!Number.isInteger(index) || !allowed.has(index) || seen.has(index)) {
      continue;
    }

    const rawDuplicate = Number(record.duplicateOfIndex);
    const validDuplicateOfIndex =
      Number.isInteger(rawDuplicate) &&
      allowed.has(rawDuplicate) &&
      rawDuplicate !== index
        ? rawDuplicate
        : null;

    const isLikelyDuplicate =
      Boolean(record.isLikelyDuplicate) &&
      validDuplicateOfIndex !== null;

    const duplicateOfIndex =
      isLikelyDuplicate
        ? validDuplicateOfIndex
        : null;

    observations.push({
      index,
      category: validCategory(record.category),
      technicalQuality: finiteScore(record.technicalQuality),
      lighting: finiteScore(record.lighting),
      composition: finiteScore(record.composition),
      presentation: finiteScore(record.presentation),
      bookingAppeal: finiteScore(record.bookingAppeal),
      isLikelyDuplicate,
      duplicateOfIndex,
      strengths: boundedStrings(record.strengths),
      issues: boundedStrings(record.issues),
    });

    seen.add(index);
  }

  return observations.sort((a, b) => a.index - b.index);
}

export function computeVisualQuality(
  photos: ListingPhotoObservation[],
): number | null {
  const usable = photos.filter(
    (photo) => !photo.isLikelyDuplicate || photo.duplicateOfIndex === null,
  );

  if (!usable.length) return null;

  const values = usable.map(
    (photo) =>
      photo.technicalQuality * 0.3 +
      photo.lighting * 0.25 +
      photo.composition * 0.25 +
      photo.presentation * 0.2,
  );

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function computeCoverQuality(
  photos: ListingPhotoObservation[],
): number | null {
  const cover = photos.find((photo) => photo.index === 0);
  if (!cover) return null;

  return round(
    cover.technicalQuality * 0.2 +
      cover.lighting * 0.2 +
      cover.composition * 0.25 +
      cover.presentation * 0.15 +
      cover.bookingAppeal * 0.2,
  );
}

export function computeVisualDiversity(
  photos: ListingPhotoObservation[],
): number | null {
  if (!photos.length) return null;

  const duplicates = photos.filter((photo) => photo.isLikelyDuplicate).length;
  const duplicateRatio = duplicates / photos.length;

  const categories = new Set(
    photos
      .filter((photo) => !photo.isLikelyDuplicate)
      .map((photo) => photo.category)
      .filter((category) => category !== "other"),
  );

  let score = 10 - duplicateRatio * 7;

  if (categories.size === 0) score -= 3;
  else if (categories.size === 1) score -= 2;
  else if (categories.size === 2) score -= 1;

  return round(score);
}

export function computeRoomCoverage(
  photos: ListingPhotoObservation[],
): number | null {
  if (!photos.length) return null;

  const categories = new Set(
    photos
      .filter((photo) => !photo.isLikelyDuplicate)
      .map((photo) => photo.category),
  );

  const coreFound = CORE_CATEGORIES.filter((category) =>
    categories.has(category),
  ).length;

  const secondary = [
    "dining",
    "exterior",
    "pool",
    "view",
    "workspace",
    "amenity",
  ] as const;

  const secondaryFound = secondary.filter((category) =>
    categories.has(category),
  ).length;

  // Core rooms provide up to 8 points. Secondary visual evidence can add
  // at most 2 points and therefore cannot hide missing core coverage.
  return round(coreFound * 2 + Math.min(2, secondaryFound * 0.5));
}

export function computeGalleryOrder(
  photos: ListingPhotoObservation[],
): number | null {
  if (!photos.length) return null;

  const ordered = [...photos].sort((a, b) => a.index - b.index);
  const firstFive = ordered.slice(0, 5);
  const cover = ordered.find((photo) => photo.index === 0);

  // Gallery order includes the listing cover as a first-class
  // component. If the original cover was not observable, Norixo
  // cannot truthfully score the gallery sequence.
  if (!cover) return null;

  const coverComponent = computeCoverQuality(photos)! / 10;

  const appeal =
    firstFive.reduce((sum, photo) => sum + photo.bookingAppeal, 0) /
    firstFive.length /
    10;

  const categoryCount = new Set(
    firstFive
      .filter((photo) => !photo.isLikelyDuplicate)
      .map((photo) => photo.category)
      .filter((category) => category !== "other"),
  ).size;

  const diversity = Math.min(1, categoryCount / Math.min(4, firstFive.length));

  const coreEarly = new Set(
    firstFive
      .map((photo) => photo.category)
      .filter((category) =>
        (CORE_CATEGORIES as readonly ListingPhotoCategory[]).includes(category),
      ),
  ).size;

  const coreRepresentation = Math.min(1, coreEarly / 3);

  const duplicateRatio =
    firstFive.filter((photo) => photo.isLikelyDuplicate).length /
    firstFive.length;

  const score =
    coverComponent * 3 +
    appeal * 3 +
    diversity * 2 +
    coreRepresentation * 2 -
    duplicateRatio * 2;

  return round(score);
}

function unavailable(totalPhotoCount: number): ListingVisualAnalysis {
  return {
    status: "unavailable",
    analyzedPhotoCount: 0,
    totalPhotoCount,
    visualQuality: null,
    coverQuality: null,
    galleryOrder: null,
    visualDiversity: null,
    roomCoverage: null,
    photos: [],
    duplicateGroups: [],
    detectedCategories: [],
    missingImportantCategories: [...CORE_CATEGORIES],
    strengths: [],
    weaknesses: [],
    recommendedOrder: [],
  };
}

function normalizeIndexes(value: unknown, allowed: Set<number>): number[] {
  if (!Array.isArray(value)) return [];

  const result: number[] = [];
  const seen = new Set<number>();

  for (const item of value) {
    const index = Number(item);
    if (!Number.isInteger(index) || !allowed.has(index) || seen.has(index)) {
      continue;
    }
    seen.add(index);
    result.push(index);
  }

  return result;
}

function normalizeDuplicateGroups(
  value: unknown,
  allowed: Set<number>,
): number[][] {
  if (!Array.isArray(value)) return [];

  return value
    .map((group) => normalizeIndexes(group, allowed))
    .filter((group) => group.length >= 2)
    .slice(0, 12);
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function analyzeListingPhotos(
  input: AnalyzeListingPhotosInput,
): Promise<ListingVisualAnalysis> {
  const { selected, totalPhotoCount } = selectListingPhotos(input.photos);

  if (!selected.length) return unavailable(totalPhotoCount);

  const accessiblePhotos =
    await filterAccessibleListingPhotos(
      selected,
      input.platform,
    );

  if (accessiblePhotos.length < MIN_ACCESSIBLE_IMAGES) {
    return unavailable(totalPhotoCount);
  }

  const validIndexes = accessiblePhotos.map((photo) => photo.index);
  const allowed = new Set(validIndexes);

  const prompt = `
Analyze the supplied short-term-rental listing photos.

You are a VISUAL OBSERVER, not the final Norixo scoring authority.

Rules:
- Analyze only what is actually visible.
- Never infer amenities, room types, luxury level, cleanliness, location,
  view, pool, parking or workspace unless visually supported.
- Listing text is contextual information only and is not proof.
- If uncertain about a room category, use "other".
- Evaluate photography and presentation, not property economic value.
- Do not claim booking conversion, occupancy, revenue or platform ranking.
- Detect duplicates only when images are visually very similar.
- The photo whose original index is 0 is the cover photo.
- Never invent photo indexes.
- recommendedOrder may contain only supplied original indexes.

Allowed categories:
${CATEGORIES.join(", ")}

For every image return:
index, category, technicalQuality, lighting, composition, presentation,
bookingAppeal, isLikelyDuplicate, duplicateOfIndex, strengths, issues.

All scores must be 0 to 10.

Also return:
duplicateGroups,
detectedCategories,
missingImportantCategories,
strengths,
weaknesses,
recommendedOrder.

Do NOT return final visualQuality, coverQuality, galleryOrder,
visualDiversity or roomCoverage scores.

Return only valid JSON.
`.trim();

  try {
    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_LISTING_VISION_MODEL ?? "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You analyze short-term-rental listing photography conservatively. Return only valid JSON.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${prompt}

Context only:
Platform: ${input.platform ?? "unknown"}
Title: ${input.title ?? ""}
Description: ${(input.description ?? "").slice(0, 1200)}
Amenities: ${(input.amenities ?? []).slice(0, 30).join(", ")}`,
            },
            ...accessiblePhotos.flatMap((photo) => [
              {
                type: "text" as const,
                text: `Original photo index: ${photo.index}`,
              },
              {
                type: "image_url" as const,
                image_url: {
                  url: photo.url,
                  detail: "low" as const,
                },
              },
            ]),
          ],
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject(content);

    if (!parsed) return unavailable(totalPhotoCount);

    const observations = normalizePhotoObservations(
      parsed.photos,
      validIndexes,
    );

    if (!observations.length) return unavailable(totalPhotoCount);

    const analyzedIndexes = new Set(observations.map((photo) => photo.index));

    const detectedCategories = Array.from(
      new Set(
        observations
          .map((photo) => photo.category)
          .filter((category) => category !== "other"),
      ),
    );

    const missingImportantCategories = CORE_CATEGORIES.filter(
      (category) =>
        !(detectedCategories as readonly ListingPhotoCategory[]).includes(category),
    );

    const status =
      accessiblePhotos.length === selected.length &&
      observations.length === selected.length
        ? "analyzed"
        : "partial";

    return {
      status,
      analyzedPhotoCount: observations.length,
      totalPhotoCount,
      visualQuality: computeVisualQuality(observations),
      coverQuality: computeCoverQuality(observations),
      galleryOrder: computeGalleryOrder(observations),
      visualDiversity: computeVisualDiversity(observations),
      roomCoverage: computeRoomCoverage(observations),
      photos: observations,
      duplicateGroups: normalizeDuplicateGroups(
        parsed.duplicateGroups,
        analyzedIndexes,
      ),
      detectedCategories,
      missingImportantCategories,
      strengths: boundedStrings(parsed.strengths, 8),
      weaknesses: boundedStrings(parsed.weaknesses, 8),
      recommendedOrder: normalizeIndexes(
        parsed.recommendedOrder,
        analyzedIndexes,
      ),
    };
  } catch (error) {
    if (!(error instanceof OpenAIConfigurationError)) {
      console.error("[listing-photo-vision][unavailable]", {
        message: error instanceof Error ? error.message : "unknown error",
      });
    }

    return unavailable(totalPhotoCount);
  }
}

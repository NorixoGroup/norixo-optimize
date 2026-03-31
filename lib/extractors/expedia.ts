import * as cheerio from "cheerio";
import type { ExtractorResult } from "./types";
import { fetchUnlockedHtml } from "@/lib/brightdata";
import {
  buildFieldMeta,
  buildPhotoMeta,
  inferDescriptionQuality,
  inferTitleQuality,
} from "./quality";
import {
  dedupeImageUrls,
  extractImageUrlsFromUnknown,
  normalizeWhitespace,
  uniqueStrings,
} from "./shared";

type TextCandidate = {
  source: string;
  value: string;
};

function parseMaybeNumber(text: string): number | null {
  const cleaned = text.replace(/[^\d.]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function findFirstMatchNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = Number.parseFloat(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function parseExpediaExternalId(url: string): string | null {
  const pathMatch = url.match(/Hotel-Information[^/]*\/([^/?#]+)/i);
  if (pathMatch?.[1]) return pathMatch[1];

  const queryMatch = url.match(/[?&](?:hotelId|propertyId)=([^&#]+)/i);
  return queryMatch?.[1] ?? null;
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const blocks: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item && typeof item === "object") {
            blocks.push(item as Record<string, unknown>);
          }
        });
      } else if (parsed && typeof parsed === "object") {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // ignore invalid json-ld
    }
  });

  return blocks;
}

function extractStructuredScriptData(html: string): unknown[] {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];

  $("script").each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw || raw.length < 2) return;

    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        blocks.push(JSON.parse(raw));
        return;
      } catch {
        // ignore
      }
    }

    const assignmentPatterns = [
      /__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/,
      /__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*;/,
      /window\.__STATE__\s*=\s*({[\s\S]*?})\s*;/,
      /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;/,
    ];

    for (const pattern of assignmentPatterns) {
      const match = raw.match(pattern);
      if (!match?.[1]) continue;

      try {
        blocks.push(JSON.parse(match[1]));
        break;
      } catch {
        // ignore
      }
    }
  });

  return blocks;
}

function collectStringValuesByKeyPattern(
  value: unknown,
  pattern: RegExp,
  path = "root"
): TextCandidate[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectStringValuesByKeyPattern(item, pattern, `${path}.${index}`)
    );
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.entries(record).flatMap(([key, entry]) => {
      const nextPath = `${path}.${key}`;
      const direct =
        pattern.test(key) && typeof entry === "string"
          ? [{ source: nextPath, value: normalizeWhitespace(entry) }]
          : [];
      return [...direct, ...collectStringValuesByKeyPattern(entry, pattern, nextPath)];
    });
  }

  return [];
}

function isLikelyExpediaListingPhotoUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;

  const lower = value.toLowerCase();
  if (
    lower.includes("thumbnail") ||
    lower.includes("thumb") ||
    lower.includes("icon") ||
    lower.includes("logo") ||
    lower.includes("avatar") ||
    lower.includes("placeholder") ||
    lower.includes("sprite") ||
    lower.includes("map")
  ) {
    return false;
  }

  return (
    lower.includes("expedia.com") ||
    lower.includes("hotels.com") ||
    lower.includes("expediacdn.com") ||
    lower.includes("travel-assets.com") ||
    lower.includes("trvl-media.com") ||
    lower.includes("mediaim.expedia.com")
  );
}

function pickFirstTextCandidate(candidates: TextCandidate[]) {
  return (
    candidates
      .map((candidate) => ({
        source: candidate.source,
        value: normalizeWhitespace(candidate.value),
      }))
      .find((candidate) => candidate.value.length > 0) ?? null
  );
}

function scoreDescriptionCandidate(candidate: TextCandidate): number {
  const value = normalizeWhitespace(candidate.value);
  if (!value) return -1;

  const lowerSource = candidate.source.toLowerCase();
  const lowerValue = value.toLowerCase();
  let score = value.length;

  if (
    lowerSource.includes("overview") ||
    lowerSource.includes("property_description") ||
    lowerSource.includes("propertydescription") ||
    lowerSource.includes("description")
  ) {
    score += 500;
  }

  if (lowerSource.includes("json_ld")) score += 220;
  if (lowerSource.includes("meta_description")) score += 60;
  if (lowerSource.includes("marketing")) score -= 120;

  if (value.length < 120) score -= 180;
  if (!/[.!?]/.test(value)) score -= 70;
  if (
    lowerValue.includes("great choice") ||
    lowerValue.includes("popular amenities") ||
    lowerValue.includes("choose your room") ||
    lowerValue.includes("collect stamps")
  ) {
    score -= 250;
  }

  return score;
}

function pickBestDescriptionCandidate(candidates: TextCandidate[]) {
  return (
    candidates
      .map((candidate) => ({
        source: candidate.source,
        value: normalizeWhitespace(candidate.value),
      }))
      .filter((candidate) => candidate.value.length > 0)
      .sort((a, b) => scoreDescriptionCandidate(b) - scoreDescriptionCandidate(a))[0] ?? null
  );
}

export async function extractExpedia(url: string): Promise<ExtractorResult> {
  const html = await fetchUnlockedHtml(url);
  const $ = cheerio.load(html);
  const bodyText = normalizeWhitespace($("body").text());
  const jsonLdBlocks = extractJsonLd(html);
  const structuredScriptData = extractStructuredScriptData(html);

  const hotelJson =
    jsonLdBlocks.find((item) =>
      ["Hotel", "LodgingBusiness", "Apartment", "Resort"].includes(String(item["@type"] ?? ""))
    ) ?? null;

  const selectedTitleCandidate =
    pickFirstTextCandidate([
      ...structuredScriptData.flatMap((block) =>
        collectStringValuesByKeyPattern(block, /^(propertyName|name|headline|title)$/i)
      ),
      {
        source: "h1",
        value: $("h1").first().text(),
      },
      {
        source: "og:title",
        value: $('meta[property="og:title"]').attr("content") || "",
      },
      {
        source: "document_title",
        value: $("title").text(),
      },
      {
        source: "json_ld_name",
        value: typeof hotelJson?.name === "string" ? hotelJson.name : "",
      },
    ]) ?? { source: "fallback_default", value: "Untitled Expedia listing" };

  const descriptionCandidates: TextCandidate[] = [
    ...structuredScriptData.flatMap((block) =>
      collectStringValuesByKeyPattern(
        block,
        /^(overview|propertyDescription|description|summary|about|marketingMessage)$/i
      )
    ),
    {
      source: "html_overview",
      value:
        $('[data-stid*="overview"] [data-stid*="content"]').text() ||
        $('[data-stid*="overview"]').text(),
    },
    {
      source: "html_property_description",
      value:
        $('[data-stid*="property-description"]').text() ||
        $('[id*="property-description"]').text(),
    },
    {
      source: "json_ld_description",
      value: typeof hotelJson?.description === "string" ? hotelJson.description : "",
    },
    {
      source: "meta_description",
      value: $('meta[name="description"]').attr("content") || "",
    },
    {
      source: "og_description",
      value: $('meta[property="og:description"]').attr("content") || "",
    },
    {
      source: "body_fallback",
      value: bodyText.slice(0, 2500),
    },
  ];

  const selectedDescriptionCandidate =
    pickBestDescriptionCandidate(descriptionCandidates) ?? {
      source: "body_fallback",
      value: bodyText.slice(0, 2500),
    };

  const title = normalizeWhitespace(selectedTitleCandidate.value);
  const description = normalizeWhitespace(selectedDescriptionCandidate.value);

  const jsonEmbeddedPhotos = structuredScriptData
    .flatMap((block) => extractImageUrlsFromUnknown(block))
    .filter(isLikelyExpediaListingPhotoUrl);
  const jsonLdPhotos = jsonLdBlocks
    .flatMap((block) => extractImageUrlsFromUnknown(block))
    .filter(isLikelyExpediaListingPhotoUrl);
  const domPhotos = [
    ...$('meta[property="og:image"]').map((_, el) => $(el).attr("content") || "").get(),
    ...$('meta[name="twitter:image"]').map((_, el) => $(el).attr("content") || "").get(),
    ...$('[data-stid*="gallery"] img, [data-stid*="image"] img, img')
      .map((_, el) => $(el).attr("src") || $(el).attr("data-src") || "")
      .get(),
  ].filter(isLikelyExpediaListingPhotoUrl);

  const photos = dedupeImageUrls(
    uniqueStrings([...jsonEmbeddedPhotos, ...jsonLdPhotos, ...domPhotos]).filter(
      isLikelyExpediaListingPhotoUrl
    )
  ).slice(0, 80);

  const photoSource =
    jsonEmbeddedPhotos.length > 0
      ? "json_embedded"
      : jsonLdPhotos.length > 0
        ? "json_ld"
        : domPhotos.length > 0
          ? "html_gallery"
          : null;

  const amenities = uniqueStrings([
    ...structuredScriptData.flatMap((block) =>
      collectStringValuesByKeyPattern(block, /^(amenit|facilit|feature|services?)$/i).map(
        (candidate) => candidate.value
      )
    ),
    ...$('[data-stid*="amenit"], [data-stid*="facilit"]')
      .map((_, el) => $(el).text())
      .get(),
    ...$("li, span, div")
      .map((_, el) => $(el).text())
      .get()
      .filter((text) => {
        const value = text.toLowerCase();
        return (
          value.length >= 3 &&
          value.length <= 80 &&
          [
            "wifi",
            "parking",
            "pool",
            "spa",
            "gym",
            "air conditioning",
            "restaurant",
            "breakfast",
            "kitchen",
            "washer",
            "dryer",
            "pet friendly",
            "beach",
            "tv",
          ].some((keyword) => value.includes(keyword))
        );
      }),
  ]).slice(0, 80);

  const structuredGuests = structuredScriptData.flatMap((block) =>
    collectStringValuesByKeyPattern(block, /^(guest|guests|maxGuests|occupancy)$/i)
  );
  const structuredBedrooms = structuredScriptData.flatMap((block) =>
    collectStringValuesByKeyPattern(block, /^(bedrooms?|bedroomCount)$/i)
  );
  const structuredBeds = structuredScriptData.flatMap((block) =>
    collectStringValuesByKeyPattern(block, /^(beds?|bedCount)$/i)
  );

  const capacity =
    parseMaybeNumber(structuredGuests[0]?.value ?? "") ??
    findFirstMatchNumber(bodyText, [/(\d+)\s+guests?/i, /sleeps\s+(\d+)/i]) ??
    null;
  const bedrooms =
    parseMaybeNumber(structuredBedrooms[0]?.value ?? "") ??
    findFirstMatchNumber(bodyText, [/(\d+)\s+bedrooms?/i]) ??
    null;
  const bedCount =
    parseMaybeNumber(structuredBeds[0]?.value ?? "") ??
    findFirstMatchNumber(bodyText, [/(\d+)\s+beds?/i]) ??
    null;

  const propertyTypeMatch = structuredScriptData
    .flatMap((block) => collectStringValuesByKeyPattern(block, /^(propertyType|lodgingType|type)$/i))
    .find((candidate) => candidate.value.length > 0);
  const propertyType =
    propertyTypeMatch?.value ||
    bodyText.match(/\b(hotel|resort|apartment|villa|house|studio|suite)\b/i)?.[1] ||
    (typeof hotelJson?.["@type"] === "string" ? hotelJson["@type"] : "") ||
    null;

  const locationLabel =
    $('[data-stid*="location"]').first().text() ||
    (typeof hotelJson?.address === "object" &&
    hotelJson.address &&
    typeof (hotelJson.address as Record<string, unknown>).addressLocality === "string"
      ? ((hotelJson.address as Record<string, unknown>).addressLocality as string)
      : "") ||
    null;

  const warnings = [
    description.length < 300 ? "description_too_short" : null,
    descriptionCandidates.filter((candidate) => normalizeWhitespace(candidate.value).length >= 120).length > 1
      ? "description_multiple_sources"
      : null,
  ].filter((warning): warning is string => Boolean(warning));

  const titleConfidence =
    selectedTitleCandidate.source.startsWith("json_") ? 0.9 : selectedTitleCandidate.source === "h1" ? 0.6 : 0.5;
  const descriptionConfidence =
    selectedDescriptionCandidate.source.startsWith("json_")
      ? 0.9
      : selectedDescriptionCandidate.source.startsWith("html_")
        ? 0.55
        : selectedDescriptionCandidate.source === "body_fallback"
          ? 0.4
          : 0.5;
  const photoConfidence =
    photoSource === "json_embedded"
      ? 0.9
      : photoSource === "json_ld"
        ? 0.85
        : photoSource === "html_gallery"
          ? 0.5
          : 0.4;

  return {
    url,
    sourceUrl: url,
    platform: "other",
    sourcePlatform: "other",
    externalId: parseExpediaExternalId(url),
    title,
    titleMeta: {
      ...buildFieldMeta({
        source: selectedTitleCandidate.source,
        value: title,
        quality: inferTitleQuality(title),
      }),
      confidence: titleConfidence,
    },
    description,
    descriptionMeta: {
      ...buildFieldMeta({
        source: selectedDescriptionCandidate.source,
        value: description,
        quality: inferDescriptionQuality(description),
      }),
      confidence: descriptionConfidence,
    },
    amenities,
    photos,
    photosCount: photos.length,
    photoMeta: {
      ...buildPhotoMeta({
        source: photoSource,
        photos,
      }),
      confidence: photoConfidence,
    },
    structure: {
      capacity,
      bedrooms,
      bedCount,
      bathrooms: null,
      propertyType: propertyType ? normalizeWhitespace(propertyType) : null,
      locationLabel: locationLabel ? normalizeWhitespace(locationLabel) : null,
    },
    capacity,
    bedrooms,
    bedCount,
    bathrooms: null,
    locationLabel: locationLabel ? normalizeWhitespace(locationLabel) : null,
    propertyType: propertyType ? normalizeWhitespace(propertyType) : null,
    occupancyObservation: {
      status: "unavailable",
      rate: null,
      unavailableDays: 0,
      availableDays: 0,
      observedDays: 0,
      windowDays: 60,
      source: null,
      message: "Donnees d'occupation non disponibles pour cette annonce",
    },
    extractionMeta: {
      extractor: "expedia",
      extractedAt: new Date().toISOString(),
      warnings,
    },
  };
}

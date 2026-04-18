import * as cheerio from "cheerio";
import type { ExtractorResult } from "./types";
import { fetchUnlockedHtml } from "@/lib/brightdata";
import {
  buildFieldMeta,
  buildPhotoMeta,
  inferDescriptionQuality,
  inferPhotoQuality,
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

function parseVisibleDecimalNumber(text: string): number | null {
  const normalized = text.trim().replace(/\s+/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseVisibleInteger(text: string): number | null {
  const normalized = text.replace(/\D/g, "");
  const value = Number.parseInt(normalized, 10);
  return Number.isFinite(value) ? value : null;
}

function extractVisibleReviewSummary(text: string): {
  rating: number | null;
  reviewCount: number | null;
} {
  const ratingMatch =
    text.match(/(?:Reviews|Avis(?:\s+voyageurs)?)\s*(10(?:[.,]0)?|[0-9](?:[.,]\d)?)\s*(?:\1\s*)?(?:out of|sur)\s*10/i) ??
    text.match(/(?:Reviews|Avis(?:\s+voyageurs)?)\s*(10(?:[.,]0)?|[0-9](?:[.,]\d)?)\s*(?:\1\s*)?\/\s*10/i);
  const rating = ratingMatch?.[1] ? parseVisibleDecimalNumber(ratingMatch[1]) : null;
  const reviewCountMatch =
    text.match(/See all\s+([\d\s,.]+)\s+reviews?/i) ??
    text.match(/(?:Voir|Afficher|Consulter)(?:\s+(?:tous|toutes|les|l'ensemble|l’ensemble))*\s+([\d\s,.]+)\s+avis/i) ??
    text.match(/(?:Reviews|Avis)[\s\S]{0,240}?([\d\s,.]+)\s+(?:reviews?|avis)/i);
  const reviewCount = reviewCountMatch?.[1] ? parseVisibleInteger(reviewCountMatch[1]) : null;

  return {
    rating: rating != null && rating > 0 && rating <= 10 ? rating : null,
    reviewCount:
      reviewCount != null && reviewCount > 0 && reviewCount < 100000
        ? Math.round(reviewCount)
        : null,
  };
}

function extractVisibleGalleryCount(text: string): number | null {
  const galleryMatch =
    text.match(/(?:Photo gallery|Galerie photos?)[\s\S]{0,1200}?([\d\s,.]+)\+\s*(?:Overview|Présentation|Aperçu|Chambres|Rooms|Avis|Reviews)/i) ??
    text.match(/([\d\s,.]+)\+\s*(?:Overview|Présentation|Aperçu|Chambres|Rooms)\b/i);
  const count = galleryMatch?.[1] ? parseVisibleInteger(galleryMatch[1]) : null;
  return count != null && count > 0 && count < 500 ? count : null;
}

function extractProfessionalHostInfo(text: string): string | null {
  if (/\bH[oô]te professionnel\b/i.test(text)) return "Hôte professionnel";
  if (/\bProfessional host\b/i.test(text)) return "Professional host";
  return null;
}

type ExpediaAmenityPattern = {
  label: string;
  pattern: RegExp;
};

const EXPEDIA_VISIBLE_AMENITY_PATTERNS: ExpediaAmenityPattern[] = [
  { label: "Piscine", pattern: /Piscine/i },
  { label: "Restaurant", pattern: /Restaurant/i },
  { label: "Salle de sport", pattern: /Salle de sport/i },
  { label: "Spa", pattern: /Spa(?=Wi-?Fi|Wifi|\s|$|[^A-Za-zÀ-ÖØ-öø-ÿ])/i },
  { label: "Wi-Fi gratuit", pattern: /Wi-?Fi gratuit/i },
  { label: "Climatisation", pattern: /Climatisation/i },
  { label: "Petit-déjeuner disponible", pattern: /Petit-d[eé]jeuner disponible/i },
  { label: "Parking", pattern: /Parking/i },
  { label: "Animaux de compagnie acceptés", pattern: /Animaux de compagnie accept[ée]s/i },
  { label: "Free WiFi", pattern: /Free WiFi/i },
  { label: "Air conditioning", pattern: /Air conditioning/i },
  { label: "Pool", pattern: /Pool/i },
  { label: "Gym", pattern: /Gym/i },
  { label: "Breakfast available", pattern: /Breakfast available/i },
  { label: "Pet friendly", pattern: /Pet friendly/i },
  { label: "Bar", pattern: /Bar(?=Housekeeping|\s|$|[^A-Za-zÀ-ÖØ-öø-ÿ])/i },
  { label: "Housekeeping", pattern: /Housekeeping/i },
  { label: "Kitchen", pattern: /Kitchen/i },
  { label: "Washer", pattern: /Washer/i },
  { label: "Dryer", pattern: /Dryer/i },
  { label: "Beach", pattern: /Beach/i },
];

function extractExpediaAmenityLabels(text: string): string[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];
  return EXPEDIA_VISIBLE_AMENITY_PATTERNS.filter((item) => item.pattern.test(normalized)).map(
    (item) => item.label
  );
}

function isPlausibleExpediaAmenityFallback(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (normalized.length < 3 || normalized.length > 80) return false;
  if (extractExpediaAmenityLabels(normalized).length > 1) return false;
  if (/packages|shop travel|where to|o[uù] allez|dates|travelers|voyageurs|search/i.test(normalized)) {
    return false;
  }
  return /\b(wifi|wi-fi|parking|pool|piscine|spa|gym|restaurant|breakfast|pet friendly|beach|climatisation|kitchen|washer|dryer|tv)\b/i.test(
    normalized
  );
}

function normalizeExpediaLocationLabel(text: string | null): string | null {
  const normalized = normalizeWhitespace(text ?? "");
  if (!normalized) return null;
  if (/o[uù]\s+allez|where to|dates|travelers|voyageurs|search|rechercher/i.test(normalized)) {
    return null;
  }
  if (/^allez$/i.test(normalized)) return null;
  return normalized;
}

function readExpediaAddressText(address: unknown, key: string): string | null {
  if (!address || typeof address !== "object") return null;
  const value = (address as Record<string, unknown>)[key];
  if (typeof value === "string") return normalizeExpediaLocationLabel(value);
  if (value && typeof value === "object" && typeof (value as Record<string, unknown>).name === "string") {
    return normalizeExpediaLocationLabel((value as Record<string, unknown>).name as string);
  }
  return null;
}

function normalizeExpediaCountryLabel(text: string | null): string | null {
  const normalized = normalizeExpediaLocationLabel(text);
  if (!normalized) return null;
  if (/^(?:us|usa|u\.s\.|u\.s\.a\.|united states of america)$/i.test(normalized)) {
    return "United States";
  }
  return normalized;
}

function inferExpediaCountryFromLocation(city: string | null, region: string | null): string | null {
  const text = normalizeWhitespace(`${city ?? ""} ${region ?? ""}`).toLowerCase();
  if (/\b(?:las vegas|nevada|nv)\b/i.test(text)) return "United States";
  return null;
}

function buildExpediaLocationLabel(address: unknown, fallbackText: string | null): string | null {
  const city = readExpediaAddressText(address, "addressLocality");
  const region = readExpediaAddressText(address, "addressRegion");
  const country =
    normalizeExpediaCountryLabel(readExpediaAddressText(address, "addressCountry")) ??
    inferExpediaCountryFromLocation(city, region);
  const structuredLabel = uniqueStrings([city, region, country].filter(Boolean) as string[]).join(", ");

  return normalizeExpediaLocationLabel(structuredLabel) ?? normalizeExpediaLocationLabel(fallbackText);
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
  const visibleGalleryCount = extractVisibleGalleryCount(bodyText);
  const photosCount =
    visibleGalleryCount != null ? Math.max(photos.length, visibleGalleryCount) : photos.length;

  const photoSource =
    jsonEmbeddedPhotos.length > 0
      ? "json_embedded"
      : jsonLdPhotos.length > 0
        ? "json_ld"
        : domPhotos.length > 0
          ? "html_gallery"
          : null;

  const amenityCandidateTexts = [
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
  ];
  const amenities = uniqueStrings([
    ...amenityCandidateTexts.flatMap(extractExpediaAmenityLabels),
    ...extractExpediaAmenityLabels(bodyText),
    ...amenityCandidateTexts.filter(isPlausibleExpediaAmenityFallback).map(normalizeWhitespace),
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

  const jsonLdAddress =
    typeof hotelJson?.address === "object" && hotelJson.address ? hotelJson.address : null;
  const locationLabel =
    buildExpediaLocationLabel(jsonLdAddress, $('[data-stid*="location"]').first().text());

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

  const hostName: string | null = null;
  const hostInfo = extractProfessionalHostInfo(bodyText);
  const { rating, reviewCount } = extractVisibleReviewSummary(bodyText);

  return {
    url,
    sourceUrl: url,
    platform: "expedia",
    sourcePlatform: "expedia",
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
    photosCount,
    photoMeta: {
      ...buildPhotoMeta({
        source: photoSource,
        photos,
      }),
      count: photosCount,
      quality: inferPhotoQuality(photosCount),
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
    hostName,
    hostInfo,
    rating,
    reviewCount,
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

import * as cheerio from "cheerio";
import type { ExtractorResult } from "./types";
import { fetchUnlockedHtml } from "@/lib/brightdata";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => normalizeWhitespace(v)).filter(Boolean))];
}

function parseMaybePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

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

function parseVrboExternalId(url: string): string | null {
  const match = url.match(/\/(\d+)(?:\?|$)/);
  return match?.[1] ?? null;
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

export async function extractVrbo(url: string): Promise<ExtractorResult> {
  const html = await fetchUnlockedHtml(url);
  const $ = cheerio.load(html);
  const bodyText = normalizeWhitespace($("body").text());
  const jsonLdBlocks = extractJsonLd(html);

  const lodgingJson =
    jsonLdBlocks.find(
      (item) =>
        item["@type"] === "LodgingBusiness" ||
        item["@type"] === "House" ||
        item["@type"] === "Apartment" ||
        item["@type"] === "Residence"
    ) ?? null;

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("h1").first().text() ||
    $("title").text() ||
    (typeof lodgingJson?.name === "string" ? lodgingJson.name : "") ||
    "Untitled Vrbo listing";

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    (typeof lodgingJson?.description === "string" ? lodgingJson.description : "") ||
    "";

  const photos = uniqueStrings([
    ...$('meta[property="og:image"]')
      .map((_, el) => $(el).attr("content") || "")
      .get(),
    ...$('meta[name="twitter:image"]')
      .map((_, el) => $(el).attr("content") || "")
      .get(),
    ...$("img")
      .map((_, el) => $(el).attr("src") || "")
      .get()
      .filter((src) => /^https?:\/\//.test(src)),
  ]).slice(0, 40);

  const amenities = uniqueStrings(
    $("li, span, div")
      .map((_, el) => $(el).text())
      .get()
      .filter((text) => {
        const value = text.toLowerCase();
        return (
          value.length >= 3 &&
          value.length <= 80 &&
          [
            "wifi",
            "kitchen",
            "air conditioning",
            "washer",
            "dryer",
            "parking",
            "pool",
            "hot tub",
            "beach",
            "balcony",
            "tv",
            "fireplace",
            "pet friendly",
            "coffee maker",
            "heating",
            "hair dryer",
            "iron",
          ].some((keyword) => value.includes(keyword))
        );
      })
  ).slice(0, 60);

  const price =
    parseMaybePrice(
      $('[data-stid*="price"], [class*="price"]').first().text() ||
        (typeof lodgingJson?.priceRange === "string" ? lodgingJson.priceRange : "") ||
        ""
    ) ?? null;

  const rating =
    parseMaybeNumber(
      (typeof lodgingJson?.aggregateRating === "object" &&
      lodgingJson.aggregateRating &&
      typeof (lodgingJson.aggregateRating as Record<string, unknown>).ratingValue ===
        "string"
        ? ((lodgingJson.aggregateRating as Record<string, unknown>)
            .ratingValue as string)
        : "") || ""
    ) ?? null;

  const reviewCount =
    parseMaybeNumber(
      (typeof lodgingJson?.aggregateRating === "object" &&
      lodgingJson.aggregateRating &&
      typeof (lodgingJson.aggregateRating as Record<string, unknown>).reviewCount ===
        "string"
        ? ((lodgingJson.aggregateRating as Record<string, unknown>)
            .reviewCount as string)
        : "") || ""
    ) ?? null;

  const capacity =
    findFirstMatchNumber(bodyText, [
      /sleeps\s+(\d+)/i,
      /(\d+)\s+guests?/i,
      /accommodates\s+(\d+)/i,
    ]) ?? null;

  const bedrooms =
    findFirstMatchNumber(bodyText, [
      /(\d+)\s+bedrooms?/i,
      /(\d+)\s+bedroom/i,
    ]) ?? null;

  const bathrooms =
    findFirstMatchNumber(bodyText, [
      /(\d+(?:\.\d+)?)\s+bathrooms?/i,
      /(\d+(?:\.\d+)?)\s+bathroom/i,
    ]) ?? null;

  const locationLabel =
    $('meta[property="og:title"]').attr("content") ||
    (typeof lodgingJson?.address === "object" &&
    lodgingJson.address &&
    typeof (lodgingJson.address as Record<string, unknown>).addressLocality === "string"
      ? ((lodgingJson.address as Record<string, unknown>).addressLocality as string)
      : "") ||
    null;

  const propertyType =
    bodyText.match(
      /\b(apartment|villa|house|studio|loft|condo|cabin|cottage|chalet)\b/i
    )?.[1] ||
    (typeof lodgingJson?.["@type"] === "string" ? (lodgingJson["@type"] as string) : null);

  let latitude: number | null = null;
  let longitude: number | null = null;

  if (
    typeof lodgingJson?.geo === "object" &&
    lodgingJson.geo &&
    typeof (lodgingJson.geo as Record<string, unknown>).latitude === "number" &&
    typeof (lodgingJson.geo as Record<string, unknown>).longitude === "number"
  ) {
    latitude = (lodgingJson.geo as Record<string, unknown>).latitude as number;
    longitude = (lodgingJson.geo as Record<string, unknown>).longitude as number;
  }

  return {
    url,
    platform: "vrbo",
    externalId: parseVrboExternalId(url),
    title: normalizeWhitespace(title),
    description: normalizeWhitespace(description || bodyText.slice(0, 2500)),
    amenities,
    photos,
    price,
    currency: null,
    latitude,
    longitude,
    capacity,
    bedrooms,
    bathrooms,
    locationLabel: locationLabel ? normalizeWhitespace(locationLabel) : null,
    propertyType: propertyType ? normalizeWhitespace(propertyType) : null,
    rating,
    reviewCount,
  };
}
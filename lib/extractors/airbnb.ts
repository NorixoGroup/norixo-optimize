import * as cheerio from "cheerio";
import type { ExtractorResult } from "./types";
import { fetchUnlockedHtml } from "@/lib/brightdata";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => normalizeWhitespace(v)).filter(Boolean))];
}

function parseExternalId(url: string): string | null {
  const match = url.match(/\/rooms\/(\d+)/);
  return match?.[1] ?? null;
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

export async function extractAirbnb(url: string): Promise<ExtractorResult> {
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
    "Untitled Airbnb listing";

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    $('[data-section-id="DESCRIPTION_DEFAULT"]').text() ||
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
      .filter((src) => /^https?:\/\//.test(src) && src.includes("muscache.com")),
  ]).slice(0, 40);

  const amenityKeywords = [
    "wifi",
    "wi-fi",
    "kitchen",
    "air conditioning",
    "heating",
    "parking",
    "washer",
    "dryer",
    "coffee",
    "workspace",
    "pool",
    "tv",
    "balcony",
    "elevator",
    "breakfast",
    "shower",
    "hair dryer",
    "iron",
    "crib",
    "high chair",
    "smoke alarm",
    "first aid kit",
  ];

  const amenities = uniqueStrings(
    $("[data-testid], [aria-label], li, span, div")
      .map((_, el) => $(el).text())
      .get()
      .filter((text) => {
        const value = text.toLowerCase();
        return (
          value.length >= 3 &&
          value.length <= 80 &&
          amenityKeywords.some((keyword) => value.includes(keyword))
        );
      })
  ).slice(0, 60);

  const price =
    parseMaybePrice(
      $('[data-testid="book-it-price-amount"]').first().text() ||
        $('meta[property="product:price:amount"]').attr("content") ||
        (typeof lodgingJson?.priceRange === "string" ? lodgingJson.priceRange : "") ||
        ""
    ) ?? null;

  const currency =
    $('meta[property="product:price:currency"]').attr("content") || null;

  const rating =
    parseMaybeNumber(
      $('[data-testid="review-score"]').first().text() ||
        $('meta[itemprop="ratingValue"]').attr("content") ||
        (typeof lodgingJson?.aggregateRating === "object" &&
        lodgingJson.aggregateRating &&
        typeof (lodgingJson.aggregateRating as Record<string, unknown>).ratingValue ===
          "string"
          ? ((lodgingJson.aggregateRating as Record<string, unknown>)
              .ratingValue as string)
          : "") ||
        ""
    ) ?? null;

  const reviewCount =
    parseMaybeNumber(
      $('[data-testid="review-count"]').first().text() ||
        $('meta[itemprop="reviewCount"]').attr("content") ||
        (typeof lodgingJson?.aggregateRating === "object" &&
        lodgingJson.aggregateRating &&
        typeof (lodgingJson.aggregateRating as Record<string, unknown>).reviewCount ===
          "string"
          ? ((lodgingJson.aggregateRating as Record<string, unknown>)
              .reviewCount as string)
          : "") ||
        ""
    ) ?? null;

  const capacity =
    findFirstMatchNumber(bodyText, [
      /(\d+)\s+guests?/i,
      /(\d+)\s+voyageurs?/i,
      /guest favorite.*?(\d+)\s+guests?/i,
      /accommodates\s+(\d+)/i,
    ]) ?? null;

  const bedrooms =
    findFirstMatchNumber(bodyText, [
      /(\d+)\s+bedrooms?/i,
      /(\d+)\s+chambres?/i,
    ]) ?? null;

  const bathrooms =
    findFirstMatchNumber(bodyText, [
      /(\d+(?:\.\d+)?)\s+bathrooms?/i,
      /(\d+(?:\.\d+)?)\s+salles? de bain/i,
    ]) ?? null;

  const locationLabel =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    (typeof lodgingJson?.address === "object" &&
    lodgingJson.address &&
    typeof (lodgingJson.address as Record<string, unknown>).addressLocality === "string"
      ? ((lodgingJson.address as Record<string, unknown>).addressLocality as string)
      : "") ||
    null;

  const propertyType =
    bodyText.match(
      /\b(apartment|flat|villa|house|studio|loft|riad|condo|guesthouse)\b/i
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
    platform: "airbnb",
    externalId: parseExternalId(url),
    title: normalizeWhitespace(title),
    description: normalizeWhitespace(description || bodyText.slice(0, 2500)),
    amenities,
    photos,
    price,
    currency,
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
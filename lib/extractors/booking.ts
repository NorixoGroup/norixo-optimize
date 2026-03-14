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

function parseBookingExternalId(url: string): string | null {
  const match = url.match(/hotel\/[^/]+\/([^./?#]+)/i);
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
          if (item && typeof item === "object") blocks.push(item as Record<string, unknown>);
        });
      } else if (parsed && typeof parsed === "object") {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // ignore
    }
  });

  return blocks;
}

export async function extractBooking(url: string): Promise<ExtractorResult> {
  const html = await fetchUnlockedHtml(url);
  const $ = cheerio.load(html);
  const bodyText = normalizeWhitespace($("body").text());
  const jsonLdBlocks = extractJsonLd(html);

  const hotelJson =
    jsonLdBlocks.find(
      (item) =>
        item["@type"] === "Hotel" ||
        item["@type"] === "LodgingBusiness" ||
        item["@type"] === "Apartment"
    ) ?? null;

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("h1").first().text() ||
    $("title").text() ||
    (typeof hotelJson?.name === "string" ? hotelJson.name : "") ||
    "Untitled Booking listing";

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    $('[data-testid="property-description"]').text() ||
    $('[id*="property_description_content"]').text() ||
    (typeof hotelJson?.description === "string" ? hotelJson.description : "") ||
    "";

  const photos = uniqueStrings([
    ...$('meta[property="og:image"]').map((_, el) => $(el).attr("content") || "").get(),
    ...$('meta[name="twitter:image"]').map((_, el) => $(el).attr("content") || "").get(),
    ...$("img")
      .map((_, el) => $(el).attr("src") || "")
      .get()
      .filter((src) => /^https?:\/\//.test(src)),
  ]).slice(0, 40);

  const amenities = uniqueStrings([
    ...$('[data-testid="property-most-popular-facilities"] *').map((_, el) => $(el).text()).get(),
    ...$('[data-testid="property-facilities"] *').map((_, el) => $(el).text()).get(),
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
            "air conditioning",
            "kitchen",
            "breakfast",
            "pool",
            "balcony",
            "family rooms",
            "non-smoking",
            "washing machine",
            "private bathroom",
            "terrace",
            "garden",
            "elevator",
            "coffee machine",
            "tv",
            "heating",
            "dryer",
            "hair dryer",
            "iron",
          ].some((keyword) => value.includes(keyword))
        );
      }),
  ]).slice(0, 60);

  const price =
    parseMaybePrice(
      $('[data-testid="price-and-discounted-price"]').first().text() ||
        $('[data-testid="price-for-x-nights"]').first().text() ||
        (typeof hotelJson?.priceRange === "string" ? hotelJson.priceRange : "") ||
        ""
    ) ?? null;

  const rating =
    parseMaybeNumber(
      $('[data-testid="review-score-component"]').first().text() ||
        $('[data-testid="review-score-right-component"]').first().text() ||
        (typeof hotelJson?.aggregateRating === "object" &&
        hotelJson.aggregateRating &&
        typeof (hotelJson.aggregateRating as Record<string, unknown>).ratingValue === "string"
          ? ((hotelJson.aggregateRating as Record<string, unknown>).ratingValue as string)
          : "") ||
        ""
    ) ?? null;

  const reviewCount =
    parseMaybeNumber(
      $('[data-testid="review-score-component"]').parent().text() ||
        (typeof hotelJson?.aggregateRating === "object" &&
        hotelJson.aggregateRating &&
        typeof (hotelJson.aggregateRating as Record<string, unknown>).reviewCount === "string"
          ? ((hotelJson.aggregateRating as Record<string, unknown>).reviewCount as string)
          : "") ||
        ""
    ) ?? null;

  const capacity =
    findFirstMatchNumber(bodyText, [
      /sleeps\s+(\d+)/i,
      /(\d+)\s+guests?/i,
      /(\d+)\s+voyageurs?/i,
      /max(?:imum)?\s+(\d+)/i,
    ]) ?? null;

  const bedrooms =
    findFirstMatchNumber(bodyText, [
      /(\d+)\s+bedrooms?/i,
      /(\d+)\s+chambres?/i,
      /(\d+)\s+bedroom apartment/i,
    ]) ?? null;

  const bathrooms =
    findFirstMatchNumber(bodyText, [
      /(\d+(?:\.\d+)?)\s+bathrooms?/i,
      /(\d+(?:\.\d+)?)\s+salles? de bain/i,
    ]) ?? (bodyText.toLowerCase().includes("private bathroom") ? 1 : null);

  const locationLabel =
    $('meta[property="og:title"]').attr("content") ||
    $('[data-testid="breadcrumb"]').text() ||
    (typeof hotelJson?.address === "object" &&
    hotelJson.address &&
    typeof (hotelJson.address as Record<string, unknown>).addressLocality === "string"
      ? ((hotelJson.address as Record<string, unknown>).addressLocality as string)
      : "") ||
    null;

  const propertyType =
    bodyText.match(
      /\b(apartment|flat|villa|house|studio|loft|riad|condo|guesthouse|hotel|aparthotel)\b/i
    )?.[1] ||
    (typeof hotelJson?.["@type"] === "string" ? (hotelJson["@type"] as string) : null);

  let latitude: number | null = null;
  let longitude: number | null = null;

  if (
    typeof hotelJson?.geo === "object" &&
    hotelJson.geo &&
    typeof (hotelJson.geo as Record<string, unknown>).latitude === "number" &&
    typeof (hotelJson.geo as Record<string, unknown>).longitude === "number"
  ) {
    latitude = (hotelJson.geo as Record<string, unknown>).latitude as number;
    longitude = (hotelJson.geo as Record<string, unknown>).longitude as number;
  }

  return {
    url,
    platform: "booking",
    externalId: parseBookingExternalId(url),
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
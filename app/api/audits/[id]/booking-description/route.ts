import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

function resolveLanguageFromLocale(locale: unknown): string {
  const value = typeof locale === "string" ? locale.toLowerCase() : "";
  const map: Record<string, string> = {
    en: "English",
    fr: "French",
    es: "Spanish",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    nl: "Dutch",
    ja: "Japanese",
    zh: "Simplified Chinese",
    ko: "Korean",
    ar: "Arabic",
  };
  return map[value] ?? "French";
}

type BookingDescriptionVariant = {
  label: string;
  description: string;
};

function cleanText(value: unknown, max = 2200) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b(?:EUR|USD|MAD)\b/gi, " ")
    .replace(/\b\d{6,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeArray(value: unknown, max = 20) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 140))
    .filter(Boolean)
    .slice(0, max);
}

function parseJsonObject(value: string) {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeDescription(value: unknown) {
  const text = cleanText(value, 1300);
  if (text.length > 1200) return text.slice(0, 1200).replace(/\s+\S*$/, "").trim();
  return text;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const { client, user, workspace } = await getRequestUserAndWorkspace(request);
  if (!user || !client || !workspace) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    currentTitle?: string;
    location?: string;
    amenities?: string[];
    visualSignals?: string[];
    platform?: string;
    locale?: string;
  } | null;

  const outputLanguage = resolveLanguageFromLocale(body?.locale);

  const { data: audit, error: auditError } = await client
    .from("audits")
    .select("id, listing_id, result_payload")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (auditError) {
    console.error("[booking-description-ai][audit-load-error]", { auditId: id, error: auditError.message });
    return NextResponse.json({ error: "Impossible de charger l’audit." }, { status: 500 });
  }

  if (!audit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: listing } = audit.listing_id
    ? await client
        .from("listings")
        .select("id, title, source_url")
        .eq("id", audit.listing_id)
        .eq("workspace_id", workspace.id)
        .maybeSingle()
    : { data: null };

  const payload = (audit.result_payload ?? {}) as Record<string, unknown>;

  const currentTitle = cleanText(
    body?.currentTitle || body?.title || listing?.title || payload.title || payload.listingTitle,
    220
  );

  const sourceDescription = cleanText(
    payload.description ||
      payload.listingDescription ||
      payload.sourceDescription ||
      payload.extractedDescription,
    2200
  );

  const location = cleanText(
    body?.location || payload.location || payload.city || payload.targetCity || payload.locationLabel,
    220
  );

  const amenities = [
    ...safeArray(body?.amenities, 18),
    ...safeArray(payload.amenities, 18),
    ...safeArray(payload.detectedAmenities, 18),
  ].filter((item, index, array) => array.indexOf(item) === index).slice(0, 22);

  const visualSignals = [
    ...safeArray(body?.visualSignals, 10),
    ...safeArray(payload.visualSignals, 10),
    ...safeArray(payload.photoSignals, 10),
    ...safeArray(payload.imageSignals, 10),
  ].filter((item, index, array) => array.indexOf(item) === index).slice(0, 12);

  const prompt = `LANGUAGE REQUIREMENT:
Write every generated description strictly in ${outputLanguage}. Do not mix languages.
All instructions below are written in English only for clarity. The generated descriptions must be written only in ${outputLanguage}.

You are a Booking.com conversion copywriter specialized in short-term rental listings.

Generate 5 optimized Booking.com descriptions in ${outputLanguage}.

Strict requirements:
- Each description must be between 1050 and 1200 characters.
- Target ideally 1100 to 1180 characters.
- Do not go below 1000 characters.
- Never exceed 1200 characters.
- Do not copy the current title.
- Never reuse the commercial name of the property, even if it appears in the title.
- Never use the listing name as the grammatical subject of a sentence.
- Avoid formulas such as "Tibidabo Apartments offers", "Villa XYZ welcomes you", or similar branded openings.
- Prefer neutral phrasing such as "the apartment", "the property", "the stay", "guests", "the spaces", "the kitchen", "the bedrooms", "the location".
- Do not invent amenities that are not present.
- Only mention detected amenities, known location details, the lodging type, and the intended traveler profile.
- Do not use HTML.
- Do not use emojis.
- Do not mention AI, audit, Norixo, or optimization.
- Do not use bullet lists inside the descriptions.
- Use a natural, professional, reassuring tone that is ready to paste into Booking.com.
- Make the text specific to this property, not generic.
- Avoid empty expressions such as "peaceful haven", "unforgettable experience", "memorable stay", "exceptional setting", or "everything is designed for".
- Avoid template-like phrasing such as "opens onto", "focuses on", or "fits into".
- Vary sentence openings and avoid starting every sentence with "the apartment".
- Do not repeat the same amenities multiple times.
- Each variant must follow a genuinely different angle: comfort, practicality, neighborhood, trust, short stay / business.
- If a data point looks noisy, dirty, or technical, ignore it.

Available data:
Current title: ${currentTitle}
Location: ${location}
Source description: ${sourceDescription}
Detected amenities: ${amenities.join(", ")}
Visual / photo signals: ${visualSignals.join(", ")}

Return only valid JSON:
{
  "variants": [
    {"label":"Comfort and relaxation","description":"..."},
    {"label":"Practical and smooth","description":"..."},
    {"label":"Location and neighborhood","description":"..."},
    {"label":"Premium and trust","description":"..."},
    {"label":"Short stay or business","description":"..."}
  ]
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_BOOKING_DESCRIPTION_MODEL ?? "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You write natural, concrete, trustworthy and conversion-oriented Booking.com descriptions. Always follow the requested output language.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject(content) as { variants?: BookingDescriptionVariant[] } | null;

    const variants = Array.isArray(parsed?.variants)
      ? parsed.variants
          .map((variant) => ({
            label: cleanText(variant.label, 80),
            description: normalizeDescription(variant.description),
          }))
          .filter((variant) => variant.label && variant.description.length >= 120)
          .slice(0, 5)
      : [];

    if (variants.length === 0) {
      console.error("[booking-description-ai][no-variants]", {
        auditId: id,
        contentPreview: content.slice(0, 800),
      });
      return NextResponse.json({ error: "No generated variants" }, { status: 502 });
    }

    return NextResponse.json({ variants });
  } catch (error) {
    console.error("[booking-description-ai][openai-error]", {
      auditId: id,
      message: error instanceof Error ? error.message : String(error),
      error,
    });
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }
}

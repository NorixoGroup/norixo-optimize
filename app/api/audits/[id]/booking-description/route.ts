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


Tu es expert Booking.com et copywriter hôtelier.

Generate 5 optimized Booking.com descriptions in ${outputLanguage}.

Contraintes strictes :
- Chaque description doit faire entre 1050 et 1200 caractères.
- Vise idéalement 1100 à 1180 caractères.
- Ne descends pas sous 1000 caractères.
- Ne dépasse jamais 1200 caractères.
- Ne recopie pas le titre actuel.
- Ne reprends jamais le nom commercial du logement, même s'il apparaît dans le titre.
- N'écris jamais le nom de l'annonce comme sujet de phrase.
- N'écris jamais des formules du type "Tibidabo Apartments propose", "Villa XYZ offre", "Appartement ABC vous accueille".
- Utilise plutôt : "cet appartement", "ce logement", "cette location", "vous", "votre séjour", "les espaces", "la cuisine", "les chambres", "l'emplacement".
- N'invente pas d'équipements absents.
- Ne parle que des équipements détectés, de la localisation connue, du type de logement et des voyageurs ciblés.
- N'utilise pas de HTML.
- N'utilise pas d'emojis.
- Ne mentionne pas "IA", "audit", "Norixo" ou "optimisation".
- Ne mets pas de listes.
- Style naturel, professionnel, rassurant, prêt à coller dans Booking.
- Texte spécifique à cette annonce, pas générique.
- Évite les expressions vides : "havre de paix", "expérience inoubliable", "séjour mémorable", "cadre exceptionnel", "tout est pensé pour".
- Évite les phrases template du type "ouvre sur une parenthèse", "met l'accent sur", "s'inscrit dans".
- Varie les débuts de phrases et évite de commencer chaque phrase par "cet appartement".
- Ne répète pas plusieurs fois les mêmes équipements.
- Chaque variante doit avoir un angle réellement différent : confort, praticité, quartier, confiance, court séjour.
- Si une donnée semble sale ou technique, ignore-la.

Données disponibles :
Titre actuel : ${currentTitle}
Localisation : ${location}
Description source : ${sourceDescription}
Équipements détectés : ${amenities.join(", ")}
Signaux visuels/photos : ${visualSignals.join(", ")}

Retourne uniquement un JSON valide :
{
  "variants": [
    {"label":"Confort & détente","description":"..."},
    {"label":"Pratique & fluide","description":"..."},
    {"label":"Quartier & emplacement","description":"..."},
    {"label":"Premium & confiance","description":"..."},
    {"label":"Court séjour / business","description":"..."}
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
            "Tu écris des descriptions Booking.com naturelles, concrètes, fiables et orientées conversion.",
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
          .filter((variant) => variant.label && variant.description.length >= 300)
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

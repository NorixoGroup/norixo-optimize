import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { buildAirbnbDescriptionPrompt } from "@/lib/audits/prompts/airbnbDescription.prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

type AirbnbDescriptionVariant = {
  mainAirbnb: string;
  logement: string;
  logementDetaille: string;
  acces: string;
  echanges: string;
  autresInfos: string;
};

function cleanText(value: unknown, max = 2400) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanParagraphText(value: unknown, max = 1800) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
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

function normalizeVariant(value: unknown) {
  const item = (value ?? {}) as Partial<AirbnbDescriptionVariant>;
  const mainAirbnb = cleanParagraphText(item.mainAirbnb, 700);
  const logement = cleanParagraphText(item.logement, 1800);
  const logementDetaille = cleanParagraphText(item.logementDetaille, 1800);
  const acces = cleanParagraphText(item.acces, 1400);
  const echanges = cleanParagraphText(item.echanges, 1400);
  const autresInfos = cleanParagraphText(item.autresInfos, 1400);

  if (
    mainAirbnb.length < 120 ||
    logement.length < 80 ||
    logementDetaille.length < 80 ||
    acces.length < 40 ||
    echanges.length < 40 ||
    autresInfos.length < 40
  ) {
    return null;
  }

  return {
    mainAirbnb,
    logement,
    logementDetaille,
    acces,
    echanges,
    autresInfos,
  };
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
    description?: string;
    amenities?: string[];
    visualSignals?: string[];
    platform?: string;
  } | null;

  const platform = cleanText(body?.platform, 80).toLowerCase();
  if (!platform.includes("airbnb")) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
  }

  const { data: audit, error: auditError } = await client
    .from("audits")
    .select("id, listing_id, result_payload")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (auditError) {
    console.error("[airbnb-description-ai][audit-load-error]", { auditId: id, error: auditError.message });
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
  const location = cleanText(
    body?.location || payload.location || payload.city || payload.targetCity || payload.locationLabel,
    220
  );
  const description = cleanText(
    body?.description ||
      payload.description ||
      payload.listingDescription ||
      payload.sourceDescription ||
      payload.extractedDescription,
    2400
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

  const prompt = buildAirbnbDescriptionPrompt({
    currentTitle,
    location,
    description,
    amenities,
    visualSignals,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_AIRBNB_DESCRIPTION_MODEL ?? "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content:
            "Tu écris des descriptions Airbnb naturelles, accueillantes, concrètes et orientées conversion.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject(content) as { variants?: unknown[] } | null;

    const variants = Array.isArray(parsed?.variants)
      ? parsed.variants
          .map((variant) => normalizeVariant(variant))
          .filter((variant): variant is AirbnbDescriptionVariant => Boolean(variant))
          .slice(0, 5)
      : [];

    if (variants.length === 0) {
      console.error("[airbnb-description-ai][no-variants]", {
        auditId: id,
        contentPreview: content.slice(0, 800),
      });
      return NextResponse.json({ error: "No generated variants" }, { status: 502 });
    }

    return NextResponse.json({ variants });
  } catch (error) {
    console.error("[airbnb-description-ai][openai-error]", {
      auditId: id,
      message: error instanceof Error ? error.message : String(error),
      error,
    });
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }
}

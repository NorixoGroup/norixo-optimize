import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { buildOptimizedTitlePrompt } from "@/lib/audits/prompts/optimizedTitle.prompt";

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

function cleanText(value: unknown, max = 400) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
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

function normalizeTitle(value: unknown) {
  const text = cleanText(value, 120).replace(/^[\d\s\-.)]+/, "").trim();
  if (text.length > 100) {
    return text.slice(0, 100).replace(/\s+\S*$/, "").trim();
  }
  return text;
}

function resolveOutputPlatform(value: unknown): "airbnb" | "booking" {
  const source = cleanText(value, 80).toLowerCase();
  if (source.includes("airbnb")) return "airbnb";
  return "booking";
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
    console.error("[optimized-title-ai][audit-load-error]", { auditId: id, error: auditError.message });
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
    2200
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

  const outputPlatform = resolveOutputPlatform(body?.platform || listing?.source_url || "");
  const promptBase = buildOptimizedTitlePrompt({
    currentTitle,
    location,
    description,
    amenities,
    visualSignals,
    outputPlatform,
  });

  const prompt = `${promptBase}

LANGUAGE REQUIREMENT:
Return all generated titles strictly in ${outputLanguage}. Do not mix languages.`;

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: process.env.OPENAI_OPTIMIZED_TITLE_MODEL ?? "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `You write natural, specific and conversion-oriented short-term rental listing titles.
Write every generated title strictly in ${outputLanguage}.
Never write French unless ${outputLanguage} is French.
Return only valid JSON.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject(content) as { variants?: unknown[] } | null;

    const variants = Array.isArray(parsed?.variants)
      ? parsed.variants
          .map((variant) => normalizeTitle(variant))
          .filter(Boolean)
          .filter((variant, index, array) => array.indexOf(variant) === index)
          .slice(0, 5)
      : [];

    if (variants.length === 0) {
      console.error("[optimized-title-ai][no-variants]", {
        auditId: id,
        contentPreview: content.slice(0, 800),
      });
      return NextResponse.json({ error: "No generated variants" }, { status: 502 });
    }

    return NextResponse.json({ variants });
  } catch (error) {
    console.error("[optimized-title-ai][openai-error]", {
      auditId: id,
      message: error instanceof Error ? error.message : String(error),
      error,
    });
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }
}

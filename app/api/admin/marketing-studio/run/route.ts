import { NextResponse } from "next/server";
import { runMarketingStudioPipeline } from "@/lib/marketing-ai/marketingStudioPipeline";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await runMarketingStudioPipeline({
      objective:
        typeof body.objective === "string" && body.objective.trim()
          ? body.objective.trim()
          : "Faire découvrir Norixo Optimize aux conciergeries et aux hôtes professionnels.",
      language: typeof body.language === "string" ? body.language : "fr",
      timeframe: typeof body.timeframe === "string" ? body.timeframe : "7 jours",
      channels: Array.isArray(body.channels) && body.channels.length
        ? body.channels.filter((channel: unknown) => typeof channel === "string")
        : ["Instagram", "Facebook", "LinkedIn", "SEO"],
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[marketing-studio] campaign generation failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Campaign generation failed.",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { runMarketingStudioOrchestratorV2 } from "@/lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await runMarketingStudioOrchestratorV2({
      name:
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : "Campagne test Marketing Studio V2",
      objective:
        typeof body.objective === "string" && body.objective.trim()
          ? body.objective.trim()
          : "Faire découvrir Norixo Optimize aux conciergeries et aux hôtes professionnels.",
      audience:
        typeof body.audience === "string" && body.audience.trim()
          ? body.audience.trim()
          : "Hôtes et conciergeries",
      language: typeof body.language === "string" ? body.language : "fr",
      channels:
        Array.isArray(body.channels) && body.channels.length
          ? body.channels
              .filter((channel: unknown): channel is string => typeof channel === "string")
              .map((channel: string) => channel.trim().toLowerCase())
          : ["facebook", "instagram"],
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

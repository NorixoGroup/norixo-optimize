import { NextResponse } from "next/server";
import { runMarketingStudioOrchestratorV2 } from "@/lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

export const runtime = "nodejs";

const IS_NON_PRODUCTION = process.env.NODE_ENV !== "production";

function logRunDebug(
  message: string,
  details: Record<string, unknown>,
) {
  if (!IS_NON_PRODUCTION) {
    return;
  }

  console.info(message, details);
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    logRunDebug("[MARKETING STUDIO RUN] started", {
      requestId,
    });

    const body = await request.json().catch(() => ({}));

    const result = await runMarketingStudioOrchestratorV2({
      name:
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : "Campagne marketing mensuelle",
      objective:
        typeof body.objective === "string" && body.objective.trim()
          ? body.objective.trim()
          : "Faire découvrir Norixo Optimize aux conciergeries et aux hôtes professionnels.",
      audience:
        typeof body.audience === "string" && body.audience.trim()
          ? body.audience.trim()
          : "Hôtes et conciergeries",
      language: typeof body.language === "string" ? body.language : "fr",
      tone: typeof body.tone === "string" ? body.tone : "professional",
      cta:
        typeof body.cta === "string" && body.cta.trim()
          ? body.cta.trim()
          : "Découvrir Norixo.io",
      durationDays:
        typeof body.durationDays === "number" && Number.isFinite(body.durationDays)
          ? body.durationDays
          : 30,
      channels:
        Array.isArray(body.channels) && body.channels.length
          ? body.channels
              .filter((channel: unknown): channel is string => typeof channel === "string")
              .map((channel: string) => channel.trim().toLowerCase())
          : ["facebook", "instagram", "linkedin", "tiktok"],
    });

    const videoAssets = (result.bundle.media?.assets ?? []).filter(
      (asset) => asset.kind === "video" || asset.kind === "reel",
    );
    const narratedMuxedAssets = videoAssets.filter(
      (asset) => asset.metadata?.hasMuxedNarration === true,
    );
    const narrationFailedAssets = videoAssets.filter((asset) =>
      (asset.warnings ?? []).some((warning) =>
        warning.startsWith("Narration échouée / vidéo non prête."),
      ),
    );
    const muxProviders = [
      ...new Set(
        narratedMuxedAssets
          .map((asset) => asset.metadata?.muxProvider)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    ];
    const narrationProviders = [
      ...new Set(
        narratedMuxedAssets
          .map((asset) => asset.metadata?.narrationProvider)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    ];
    const durationMs = Date.now() - startedAt;

    logRunDebug("[MARKETING STUDIO RUN] orchestrator completed", {
      requestId,
      durationMs,
      videoAssetCount: videoAssets.length,
      narratedMuxedAssetCount: narratedMuxedAssets.length,
      narrationFailedAssetCount: narrationFailedAssets.length,
      hasMuxedNarration: narratedMuxedAssets.length > 0,
      muxProviders,
      narrationProviders,
    });

    logRunDebug("[MARKETING STUDIO RUN] response ready", {
      requestId,
      durationMs,
    });

    return NextResponse.json(
      { ok: true, requestId, result },
      {
        headers: {
          "x-marketing-studio-request-id": requestId,
        },
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (IS_NON_PRODUCTION) {
      console.error("[MARKETING STUDIO RUN] failed", {
        requestId,
        durationMs,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage:
          error instanceof Error ? error.message : "Campaign generation failed.",
      });
    } else {
      console.error("[marketing-studio] campaign generation failed", error);
    }

    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: "Campaign generation failed.",
      },
      {
        status: 500,
        headers: {
          "x-marketing-studio-request-id": requestId,
        },
      },
    );
  }
}

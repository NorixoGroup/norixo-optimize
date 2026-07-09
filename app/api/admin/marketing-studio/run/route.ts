import { NextResponse } from "next/server";
import {
  buildMarketingStudioMediaPreflight,
  MARKETING_STUDIO_PRODUCTION_MEDIA_RUNTIME_ERROR,
} from "@/lib/marketing-ai/media/mediaConfiguration";
import { runMarketingStudioOrchestratorV2 } from "@/lib/marketing-ai/orchestrator/marketingStudioOrchestratorV2";

export const runtime = "nodejs";

const MARKETING_STUDIO_PAID_GENERATION_DISABLED_ERROR =
  "Paid generation disabled by safety guard.";

function isNonProduction() {
  return process.env.NODE_ENV !== "production";
}

function logRunDebug(
  message: string,
  details: Record<string, unknown>,
) {
  if (!isNonProduction()) {
    return;
  }

  console.info(message, details);
}

function isPaidGenerationEnabled() {
  return process.env.MARKETING_STUDIO_PAID_GENERATION_ENABLED === "true";
}

function buildOrchestratorInput(body: Record<string, unknown>) {
  return {
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
  };
}

type ExecuteMarketingStudioRunParams = {
  body: unknown;
  requestId?: string;
  startedAt?: number;
  runOrchestrator?: typeof runMarketingStudioOrchestratorV2;
};

type ExecuteMarketingStudioRunResult =
  | {
      ok: true;
      status: 200;
      requestId: string;
      result: Awaited<ReturnType<typeof runMarketingStudioOrchestratorV2>>;
    }
  | {
      ok: false;
      status: 503;
      requestId: string;
      error: string;
      mediaConfiguration?: {
        imageProvider: string;
        videoProvider: string;
        storageProvider: string;
        uploadEnabled: boolean;
        pollingEnabled: boolean;
      };
    };

export async function executeMarketingStudioRun(
  params: ExecuteMarketingStudioRunParams,
): Promise<ExecuteMarketingStudioRunResult> {
  const requestId = params.requestId ?? crypto.randomUUID();
  const startedAt = params.startedAt ?? Date.now();
  const body =
    typeof params.body === "object" && params.body !== null
      ? (params.body as Record<string, unknown>)
      : {};
  const paidGenerationEnabled = isPaidGenerationEnabled();

  console.info("[MARKETING STUDIO PAID GENERATION GUARD]", {
    requestId,
    paidGenerationEnabled,
  });

  if (!paidGenerationEnabled) {
    return {
      ok: false,
      status: 503,
      requestId,
      error: MARKETING_STUDIO_PAID_GENERATION_DISABLED_ERROR,
    };
  }

  const mediaPreflight = buildMarketingStudioMediaPreflight();
  const mediaConfiguration = {
    imageProvider: mediaPreflight.imageProvider,
    videoProvider: mediaPreflight.videoProvider,
    storageProvider: mediaPreflight.storageProvider,
    uploadEnabled: mediaPreflight.uploadEnabled,
    pollingEnabled: mediaPreflight.pollingEnabled,
  };

  logRunDebug("[MARKETING STUDIO RUN] started", {
    requestId,
  });

  console.info("[MARKETING STUDIO MEDIA PREFLIGHT]", {
    requestId,
    ...mediaConfiguration,
    productionReady: mediaPreflight.productionReady,
  });

  if (process.env.NODE_ENV === "production" && !mediaPreflight.productionReady) {
    logRunDebug("[MARKETING STUDIO RUN] preflight blocked", {
      requestId,
      durationMs: Date.now() - startedAt,
      ...mediaConfiguration,
    });

    return {
      ok: false,
      status: 503,
      requestId,
      error: MARKETING_STUDIO_PRODUCTION_MEDIA_RUNTIME_ERROR,
      mediaConfiguration,
    };
  }

  const result = await (params.runOrchestrator ?? runMarketingStudioOrchestratorV2)(
    buildOrchestratorInput(body),
  );

  const durationMs = Date.now() - startedAt;
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

  return {
    ok: true,
    status: 200,
    requestId,
    result,
  };
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const runResult = await executeMarketingStudioRun({
      body,
      requestId,
      startedAt,
    });

    if (!runResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          requestId: runResult.requestId,
          error: runResult.error,
          ...(runResult.mediaConfiguration
            ? { mediaConfiguration: runResult.mediaConfiguration }
            : {}),
        },
        {
          status: runResult.status,
          headers: {
            "x-marketing-studio-request-id": runResult.requestId,
          },
        },
      );
    }

    return NextResponse.json(
      { ok: true, requestId: runResult.requestId, result: runResult.result },
      {
        headers: {
          "x-marketing-studio-request-id": runResult.requestId,
        },
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (isNonProduction()) {
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

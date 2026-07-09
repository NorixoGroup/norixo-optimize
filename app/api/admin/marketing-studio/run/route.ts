import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  buildMarketingStudioMediaPreflight,
  MARKETING_STUDIO_PRODUCTION_MEDIA_RUNTIME_ERROR,
} from "@/lib/marketing-ai/media/mediaConfiguration";
import {
  buildMarketingStudioOrchestratorInput,
  enqueueMarketingStudioGenerationRun,
  type EnqueueMarketingStudioGenerationRunResult,
} from "@/lib/marketing-ai/runs/marketingStudioGenerationRunStore";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

const MARKETING_STUDIO_PAID_GENERATION_DISABLED_ERROR =
  "Paid generation disabled by safety guard.";

function isNonProduction() {
  return process.env.NODE_ENV !== "production";
}

function logRunDebug(message: string, details: Record<string, unknown>) {
  if (!isNonProduction()) {
    return;
  }

  console.info(message, details);
}

function isPaidGenerationEnabled() {
  return process.env.MARKETING_STUDIO_PAID_GENERATION_ENABLED === "true";
}

type ExecuteMarketingStudioRunParams = {
  body: unknown;
  requestId?: string;
  startedAt?: number;
  enqueueRun?: (params: {
    submissionKey: string;
    requestId: string;
    input: ReturnType<typeof buildMarketingStudioOrchestratorInput>;
  }) => Promise<EnqueueMarketingStudioGenerationRunResult>;
};

type ExecuteMarketingStudioRunResult =
  | {
      ok: true;
      status: 202;
      requestId: string;
      runId: string;
      campaignId: string;
      runStatus: string;
      wasCreated: boolean;
    }
  | {
      ok: false;
      status: 400 | 500 | 503;
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

  const submissionKey =
    typeof body.submissionKey === "string" && body.submissionKey.trim()
      ? body.submissionKey.trim()
      : "";

  if (!submissionKey) {
    return {
      ok: false,
      status: 400,
      requestId,
      error: "Missing submissionKey.",
    };
  }

  if (!params.enqueueRun) {
    return {
      ok: false,
      status: 500,
      requestId,
      error: "Marketing Studio generation enqueue is not configured.",
    };
  }

  const input = buildMarketingStudioOrchestratorInput(body);
  const enqueueResult = await params.enqueueRun({
    submissionKey,
    requestId,
    input,
  });

  logRunDebug("[MARKETING STUDIO RUN] enqueued", {
    requestId,
    runId: enqueueResult.runId,
    campaignId: enqueueResult.campaignId,
    runStatus: enqueueResult.status,
    wasCreated: enqueueResult.wasCreated,
    durationMs: Date.now() - startedAt,
  });

  return {
    ok: true,
    status: 202,
    requestId,
    runId: enqueueResult.runId,
    campaignId: enqueueResult.campaignId,
    runStatus: enqueueResult.status,
    wasCreated: enqueueResult.wasCreated,
  };
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const requestClient = createRequestSupabaseClient(request);
    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, requestId, error: "Unauthorized." },
        {
          status: 401,
          headers: {
            "x-marketing-studio-request-id": requestId,
          },
        },
      );
    }

    if (!isAdminPrivateEmail(user.email)) {
      return NextResponse.json(
        { ok: false, requestId, error: "Forbidden." },
        {
          status: 403,
          headers: {
            "x-marketing-studio-request-id": requestId,
          },
        },
      );
    }

    const { data: member } = await requestClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!member?.workspace_id) {
      return NextResponse.json(
        { ok: false, requestId, error: "Workspace not found." },
        {
          status: 400,
          headers: {
            "x-marketing-studio-request-id": requestId,
          },
        },
      );
    }

    const runResult = await executeMarketingStudioRun({
      body,
      requestId,
      startedAt,
      enqueueRun: async ({ submissionKey, input, requestId: nextRequestId }) =>
        enqueueMarketingStudioGenerationRun({
          workspaceId: member.workspace_id,
          createdBy: user.id,
          submissionKey,
          requestId: nextRequestId,
          input,
        }),
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
      {
        ok: true,
        requestId: runResult.requestId,
        runId: runResult.runId,
        campaignId: runResult.campaignId,
        runStatus: runResult.runStatus,
        wasCreated: runResult.wasCreated,
      },
      {
        status: 202,
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

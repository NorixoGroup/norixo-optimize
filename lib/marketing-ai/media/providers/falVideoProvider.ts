import type { MediaAssetRequest } from "../mediaAssetRequest";
import type {
  MediaProviderAdapter,
  MediaProviderGenerateResult,
} from "../mediaProviderAdapter";

const DEFAULT_FAL_VIDEO_MODEL =
  "fal-ai/minimax/hailuo-02/standard/text-to-video";
const FAL_QUEUE_BASE_URL = "https://queue.fal.run";

type FalQueueSubmitResponse = {
  request_id?: string;
  status?: string;
  status_url?: string;
  response_url?: string;
  error?: string;
  detail?: string;
  message?: string;
};

type FalQueueStatusResponse = {
  status?: string;
  error?: string;
  detail?: string;
  message?: string;
};

type FalQueueResultResponse = {
  status?: string;
  error?: string;
  detail?: string;
  message?: string;
  video?: { url?: string | null; file_name?: string | null } | null;
  thumbnail?: { url?: string | null } | null;
  response?: {
    video?: { url?: string | null; file_name?: string | null } | null;
    thumbnail?: { url?: string | null } | null;
  } | null;
  data?: {
    video?: { url?: string | null; file_name?: string | null } | null;
    thumbnail?: { url?: string | null } | null;
  } | null;
  output?: {
    video?: { url?: string | null; file_name?: string | null } | null;
    thumbnail?: { url?: string | null } | null;
  } | null;
};

function isFalVideoProviderEnabled(): boolean {
  return process.env.FAL_VIDEO_PROVIDER_ENABLED === "true";
}

function getFalApiKey(): string | null {
  const value = process.env.FAL_KEY;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getFalVideoModel(): string {
  const configured = process.env.FAL_VIDEO_MODEL;
  return typeof configured === "string" && configured.trim().length > 0
    ? configured.trim()
    : DEFAULT_FAL_VIDEO_MODEL;
}

function buildUnconfiguredResult(): MediaProviderGenerateResult {
  return {
    provider: "fal",
    status: "failed",
    error: "Provider not configured.",
  };
}

function buildFalHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function normalizeFalStatus(
  value: string | undefined,
): "queued" | "generating" | "generated" | "failed" {
  switch ((value ?? "").trim().toUpperCase()) {
    case "COMPLETED":
      return "generated";
    case "FAILED":
      return "failed";
    case "IN_QUEUE":
    case "QUEUED":
      return "queued";
    case "IN_PROGRESS":
    case "RUNNING":
    case "PROCESSING":
      return "generating";
    default:
      return "generating";
  }
}

function mapExpectedDurationToFalDuration(
  expectedDurationSeconds: number | undefined,
): number {
  if (
    typeof expectedDurationSeconds === "number" &&
    Number.isFinite(expectedDurationSeconds) &&
    expectedDurationSeconds > 0
  ) {
    return Math.max(4, Math.min(Math.round(expectedDurationSeconds), 10));
  }

  return 5;
}

function mapRatioToFalAspectRatio(
  ratio: MediaAssetRequest["ratio"],
): "1:1" | "4:5" | "9:16" | "16:9" {
  if (ratio === "4:5" || ratio === "9:16" || ratio === "16:9") {
    return ratio;
  }

  return "1:1";
}

function buildQueueBaseUrl(model: string): string {
  return `${FAL_QUEUE_BASE_URL}/${model}`;
}

function buildExternalJobId(model: string, requestId: string): string {
  return `${encodeURIComponent(model)}::${requestId}`;
}

function parseExternalJobId(externalJobId: string): {
  model: string;
  requestId: string;
} {
  const separatorIndex = externalJobId.indexOf("::");

  if (separatorIndex === -1) {
    return {
      model: getFalVideoModel(),
      requestId: externalJobId,
    };
  }

  return {
    model: decodeURIComponent(externalJobId.slice(0, separatorIndex)),
    requestId: externalJobId.slice(separatorIndex + 2),
  };
}

function readFalErrorMessage(body: {
  error?: string;
  detail?: string;
  message?: string;
} | null): string | null {
  return body?.error ?? body?.detail ?? body?.message ?? null;
}

async function parseFalJsonResponse<T extends object>(
  response: Response,
): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

function extractFalVideoUrl(body: FalQueueResultResponse | null): string | null {
  const candidates = [
    body?.video?.url,
    body?.response?.video?.url,
    body?.data?.video?.url,
    body?.output?.video?.url,
  ];

  return (
    candidates.find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    ) ?? null
  );
}

function extractFalThumbnailUrl(
  body: FalQueueResultResponse | null,
): string | null {
  const candidates = [
    body?.thumbnail?.url,
    body?.response?.thumbnail?.url,
    body?.data?.thumbnail?.url,
    body?.output?.thumbnail?.url,
  ];

  return (
    candidates.find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    ) ?? null
  );
}

async function downloadVideoBinary(videoUrl: string, requestId: string) {
  const response = await fetch(videoUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`fal video download failed: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    mimeType: response.headers.get("content-type") || "video/mp4",
    extension: "mp4",
    base64: buffer.toString("base64"),
    filename: `fal/${requestId}.mp4`,
    sizeBytes: buffer.byteLength,
  };
}

export const falVideoProvider: MediaProviderAdapter = {
  id: "fal",
  label: "fal.ai Video Provider",
  capabilities: ["video", "reel"],

  async generateImage() {
    return buildUnconfiguredResult();
  },

  async generateVideo(request) {
    if (!isFalVideoProviderEnabled()) {
      return buildUnconfiguredResult();
    }

    const apiKey = getFalApiKey();

    if (!apiKey) {
      return buildUnconfiguredResult();
    }

    const model = getFalVideoModel();

    try {
      const response = await fetch(buildQueueBaseUrl(model), {
        method: "POST",
        headers: buildFalHeaders(apiKey),
        body: JSON.stringify({
          prompt: request.prompt,
          aspect_ratio: mapRatioToFalAspectRatio(request.ratio),
          duration: mapExpectedDurationToFalDuration(
            request.expectedDurationSeconds,
          ),
        }),
        cache: "no-store",
      });

      const body = await parseFalJsonResponse<FalQueueSubmitResponse>(response);

      if (!response.ok) {
        throw new Error(
          `fal API request failed: ${
            readFalErrorMessage(body) ?? response.statusText ?? "Unknown error."
          }`,
        );
      }

      const requestId =
        typeof body?.request_id === "string" && body.request_id.trim().length > 0
          ? body.request_id.trim()
          : null;

      if (!requestId) {
        return {
          provider: "fal",
          status: "failed",
          error: "fal API request failed: missing request id.",
        };
      }

      const externalJobId = buildExternalJobId(model, requestId);
      const now = new Date().toISOString();

      return {
        provider: "fal",
        externalJobId,
        status: normalizeFalStatus(body?.status),
        asset: {
          id: request.id,
          kind: request.kind,
          status: "generating",
          platform: request.platform,
          ratio: request.ratio,
          language: request.targetLanguage,
          title: request.title,
          description: request.creativeBrief,
          prompt: request.prompt,
          negativePrompt: request.negativePrompt,
          previewUrl: null,
          downloadUrl: null,
          thumbnailUrl: null,
          generationProvider: "fal",
          providerJobId: requestId,
          metadata: {
            model,
            durationSeconds: request.expectedDurationSeconds,
          },
          warnings: [],
          createdAt: now,
          updatedAt: now,
        },
      };
    } catch (error) {
      return {
        provider: "fal",
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown fal video provider error.",
      };
    }
  },

  async getStatus(externalJobId) {
    if (!isFalVideoProviderEnabled()) {
      return buildUnconfiguredResult();
    }

    const apiKey = getFalApiKey();

    if (!apiKey) {
      return buildUnconfiguredResult();
    }

    const { model, requestId } = parseExternalJobId(externalJobId);
    const queueBaseUrl = buildQueueBaseUrl(model);

    try {
      const statusResponse = await fetch(
        `${queueBaseUrl}/requests/${encodeURIComponent(requestId)}/status`,
        {
          method: "GET",
          headers: buildFalHeaders(apiKey),
          cache: "no-store",
        },
      );
      const statusBody =
        await parseFalJsonResponse<FalQueueStatusResponse>(statusResponse);

      if (!statusResponse.ok) {
        throw new Error(
          `fal status request failed: ${
            readFalErrorMessage(statusBody) ??
            statusResponse.statusText ??
            "Unknown error."
          }`,
        );
      }

      const status = normalizeFalStatus(statusBody?.status);

      if (status !== "generated") {
        return {
          provider: "fal",
          externalJobId,
          status,
          error:
            status === "failed"
              ? readFalErrorMessage(statusBody) ?? "fal video generation failed."
              : undefined,
          asset: {
            generationProvider: "fal",
            providerJobId: requestId,
          },
        };
      }

      const resultResponse = await fetch(
        `${queueBaseUrl}/requests/${encodeURIComponent(requestId)}`,
        {
          method: "GET",
          headers: buildFalHeaders(apiKey),
          cache: "no-store",
        },
      );
      const resultBody =
        await parseFalJsonResponse<FalQueueResultResponse>(resultResponse);

      if (!resultResponse.ok) {
        throw new Error(
          `fal result request failed: ${
            readFalErrorMessage(resultBody) ??
            resultResponse.statusText ??
            "Unknown error."
          }`,
        );
      }

      const videoUrl = extractFalVideoUrl(resultBody);

      if (!videoUrl) {
        return {
          provider: "fal",
          externalJobId,
          status: "failed",
          error: "fal video generation failed: missing video asset URL.",
        };
      }

      const binary = await downloadVideoBinary(videoUrl, requestId);
      const thumbnailUrl = extractFalThumbnailUrl(resultBody);
      const now = new Date().toISOString();

      return {
        provider: "fal",
        externalJobId,
        status: "generated",
        internalBinary: {
          mimeType: binary.mimeType,
          extension: binary.extension,
          base64: binary.base64,
          filename: binary.filename,
        },
        asset: {
          status: "generated",
          previewUrl: videoUrl,
          downloadUrl: videoUrl,
          thumbnailUrl,
          generationProvider: "fal",
          providerJobId: requestId,
          metadata: {
            model,
            sizeBytes: binary.sizeBytes,
          },
          createdAt: now,
          updatedAt: now,
        },
      };
    } catch (error) {
      return {
        provider: "fal",
        externalJobId,
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown fal status polling error.",
      };
    }
  },
};

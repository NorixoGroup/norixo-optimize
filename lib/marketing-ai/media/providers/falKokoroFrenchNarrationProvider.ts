import { createMediaBinaryFilename, type MediaInternalBinary } from "../mediaBinary";
import type { MediaNarrationAsset } from "../mediaNarrationAsset";
import type {
  MediaNarrationProviderAdapter,
  MediaNarrationProviderGenerateResult,
} from "../mediaNarrationProviderAdapter";
import type { MediaNarrationRequest } from "../mediaNarrationRequest";

const FAL_QUEUE_BASE_URL = "https://queue.fal.run";
const DEFAULT_FAL_KOKORO_FRENCH_MODEL = "fal-ai/kokoro/french";
const DEFAULT_FAL_KOKORO_FRENCH_VOICE = "ff_siwis";
const DEFAULT_FAL_KOKORO_FRENCH_SPEED = 1;
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_MAX_POLL_ATTEMPTS = 90;

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
  audio?: {
    url?: string | null;
    content_type?: string | null;
    file_name?: string | null;
  } | null;
  response?: {
    audio?: {
      url?: string | null;
      content_type?: string | null;
      file_name?: string | null;
    } | null;
  } | null;
  data?: {
    audio?: {
      url?: string | null;
      content_type?: string | null;
      file_name?: string | null;
    } | null;
  } | null;
  output?: {
    audio?: {
      url?: string | null;
      content_type?: string | null;
      file_name?: string | null;
    } | null;
  } | null;
};

function getFalApiKey(): string | null {
  const value = process.env.FAL_KEY;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getFalKokoroFrenchModel(): string {
  const value = process.env.FAL_KOKORO_FRENCH_MODEL;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_FAL_KOKORO_FRENCH_MODEL;
}

function getFalKokoroFrenchVoice(request: MediaNarrationRequest): string {
  const preferredVoice = request.voiceHint?.trim();

  if (preferredVoice) {
    return preferredVoice;
  }

  const configuredVoice = process.env.FAL_KOKORO_FRENCH_VOICE?.trim();
  return configuredVoice || DEFAULT_FAL_KOKORO_FRENCH_VOICE;
}

function getFalKokoroFrenchSpeed(): number {
  const configured = Number.parseFloat(process.env.FAL_KOKORO_FRENCH_SPEED ?? "");

  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return DEFAULT_FAL_KOKORO_FRENCH_SPEED;
}

function readConfiguredInteger(
  names: readonly string[],
  minimumValue: number,
): number | null {
  for (const name of names) {
    const rawValue = process.env[name];
    const configured = Number.parseInt(rawValue ?? "", 10);

    if (Number.isFinite(configured) && configured >= minimumValue) {
      return configured;
    }
  }

  return null;
}

function getPollIntervalMs(): number {
  return (
    readConfiguredInteger(
      ["MEDIA_KOKORO_POLL_INTERVAL_MS", "MEDIA_POLL_INTERVAL_MS"],
      0,
    ) ?? DEFAULT_POLL_INTERVAL_MS
  );
}

function getMaxPollAttempts(): number {
  return (
    readConfiguredInteger(
      ["MEDIA_KOKORO_MAX_POLL_ATTEMPTS", "MEDIA_MAX_POLL_ATTEMPTS"],
      1,
    ) ?? DEFAULT_MAX_POLL_ATTEMPTS
  );
}

function buildFalHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function buildQueueBaseUrl(model: string): string {
  return `${FAL_QUEUE_BASE_URL}/${model}`;
}

function normalizeUrl(value: string | undefined | null): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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

function extractAudioFile(
  body: FalQueueResultResponse | null,
): { url: string; contentType: string | null; fileName: string | null } | null {
  const candidates = [
    body?.audio,
    body?.response?.audio,
    body?.data?.audio,
    body?.output?.audio,
  ];

  for (const candidate of candidates) {
    const url = normalizeUrl(candidate?.url);

    if (url) {
      return {
        url,
        contentType: normalizeUrl(candidate?.content_type),
        fileName: normalizeUrl(candidate?.file_name),
      };
    }
  }

  return null;
}

function inferExtension(params: {
  contentType: string | null;
  fileName: string | null;
  url: string;
}): string {
  const lowerContentType = params.contentType?.toLowerCase() ?? "";

  if (lowerContentType.includes("wav")) {
    return "wav";
  }

  if (lowerContentType.includes("mpeg") || lowerContentType.includes("mp3")) {
    return "mp3";
  }

  if (lowerContentType.includes("mp4") || lowerContentType.includes("m4a")) {
    return "m4a";
  }

  const fromFileName = params.fileName?.split(".").pop()?.trim().toLowerCase();
  if (fromFileName) {
    return fromFileName;
  }

  const fromUrl = params.url.split("?")[0]?.split(".").pop()?.trim().toLowerCase();
  if (fromUrl) {
    return fromUrl;
  }

  return "wav";
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isNonProductionEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function logKokoroDebug(
  level: "info" | "warn",
  message: string,
  details: Record<string, unknown>,
) {
  if (!isNonProductionEnvironment()) {
    return;
  }

  const logger = level === "warn" ? console.warn : console.info;
  logger("[fal-kokoro-french]", message, details);
}

async function downloadAudioBinary(
  audioUrl: string,
  request: MediaNarrationRequest,
): Promise<MediaInternalBinary & { mimeType: string }> {
  const response = await fetch(audioUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`fal Kokoro audio download failed: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType =
    response.headers.get("content-type")?.trim() || "audio/wav";
  const extension = inferExtension({
    contentType: mimeType,
    fileName: null,
    url: audioUrl,
  });

  return {
    mimeType,
    extension,
    base64: buffer.toString("base64"),
    filename: createMediaBinaryFilename({
      id: request.id,
      provider: "fal",
      extension,
    }),
  };
}

function buildNarrationAsset(params: {
  request: MediaNarrationRequest;
  providerJobId: string;
  voice: string;
  speed: number;
  model: string;
  audioUrl: string;
  mimeType: string;
}): MediaNarrationAsset {
  const now = new Date().toISOString();

  return {
    id: params.request.id,
    campaignId: params.request.campaignId,
    text: params.request.text,
    language: params.request.language,
    purpose: params.request.purpose,
    status: "generated",
    generationProvider: "fal",
    providerJobId: params.providerJobId,
    previewUrl: params.audioUrl,
    downloadUrl: params.audioUrl,
    metadata: {
      voice: params.voice,
      speed: params.speed,
      model: params.model,
      mimeType: params.mimeType,
      sourceUrl: params.audioUrl,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export const falKokoroFrenchNarrationProvider: MediaNarrationProviderAdapter = {
  id: "fal-kokoro-french",
  label: "fal.ai Kokoro French Narration Provider",

  async generateNarration(
    request,
  ): Promise<MediaNarrationProviderGenerateResult> {
    const normalizedLanguage = request.language.trim().toLowerCase();

    if (!(normalizedLanguage === "fr" || normalizedLanguage.startsWith("fr-"))) {
      return {
        provider: "fal",
        status: "failed",
        error:
          "fal Kokoro French narration provider only supports French narration requests.",
      };
    }

    const apiKey = getFalApiKey();

    if (!apiKey) {
      return {
        provider: "fal",
        status: "failed",
        error: "fal Kokoro French narration provider is not configured.",
      };
    }

    const model = getFalKokoroFrenchModel();
    const voice = getFalKokoroFrenchVoice(request);
    const speed = getFalKokoroFrenchSpeed();
    const pollIntervalMs = getPollIntervalMs();
    const maxPollAttempts = getMaxPollAttempts();

    try {
      const submitResponse = await fetch(buildQueueBaseUrl(model), {
        method: "POST",
        headers: buildFalHeaders(apiKey),
        body: JSON.stringify({
          prompt: request.text,
          voice,
          speed,
        }),
        cache: "no-store",
      });
      const submitBody =
        await parseFalJsonResponse<FalQueueSubmitResponse>(submitResponse);

      if (!submitResponse.ok) {
        throw new Error(
          `fal Kokoro submit failed: ${
            readFalErrorMessage(submitBody) ??
            submitResponse.statusText ??
            "Unknown error."
          }`,
        );
      }

      const requestId =
        typeof submitBody?.request_id === "string" &&
        submitBody.request_id.trim().length > 0
          ? submitBody.request_id.trim()
          : null;

      if (!requestId) {
        return {
          provider: "fal",
          status: "failed",
          error: "fal Kokoro submit failed: missing request id.",
        };
      }

      const statusUrl =
        normalizeUrl(submitBody?.status_url) ??
        `${buildQueueBaseUrl(model)}/requests/${encodeURIComponent(requestId)}/status`;
      const responseUrl =
        normalizeUrl(submitBody?.response_url) ??
        `${buildQueueBaseUrl(model)}/requests/${encodeURIComponent(requestId)}`;
      let lastQueueStatus = normalizeUrl(submitBody?.status) ?? "UNKNOWN";
      let lastResultStatus = "UNKNOWN";

      logKokoroDebug("info", "submitted narration job", {
        requestId,
        model,
        voice,
        speed,
        pollIntervalMs,
        maxPollAttempts,
      });

      for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
        if (attempt > 0) {
          await sleep(pollIntervalMs);
        }

        const statusResponse = await fetch(statusUrl, {
          method: "GET",
          headers: buildFalHeaders(apiKey),
          cache: "no-store",
        });
        const statusBody =
          await parseFalJsonResponse<FalQueueStatusResponse>(statusResponse);

        if (!statusResponse.ok) {
          throw new Error(
            `fal Kokoro status failed: ${
              readFalErrorMessage(statusBody) ??
              statusResponse.statusText ??
              "Unknown error."
            }`,
          );
        }

        lastQueueStatus = normalizeUrl(statusBody?.status) ?? lastQueueStatus;
        const status = normalizeFalStatus(statusBody?.status);

        if (status === "failed") {
          logKokoroDebug("warn", "narration job failed", {
            requestId,
            queueStatus: lastQueueStatus,
            attempt: attempt + 1,
            maxPollAttempts,
          });
          return {
            provider: "fal",
            status: "failed",
            error:
              readFalErrorMessage(statusBody) ??
              "fal Kokoro narration generation failed.",
          };
        }

        if (status !== "generated") {
          continue;
        }

        const resultResponse = await fetch(responseUrl, {
          method: "GET",
          headers: buildFalHeaders(apiKey),
          cache: "no-store",
        });
        const resultBody =
          await parseFalJsonResponse<FalQueueResultResponse>(resultResponse);

        if (!resultResponse.ok) {
          throw new Error(
            `fal Kokoro result failed: ${
              readFalErrorMessage(resultBody) ??
              resultResponse.statusText ??
              "Unknown error."
            }`,
          );
        }

        lastResultStatus = normalizeUrl(resultBody?.status) ?? lastResultStatus;
        const audioFile = extractAudioFile(resultBody);

        if (!audioFile) {
          logKokoroDebug("info", "result not ready yet despite completed queue status", {
            requestId,
            queueStatus: lastQueueStatus,
            resultStatus: lastResultStatus,
            attempt: attempt + 1,
            maxPollAttempts,
          });
          continue;
        }

        const binary = await downloadAudioBinary(audioFile.url, request);

        logKokoroDebug("info", "narration job completed", {
          requestId,
          queueStatus: lastQueueStatus,
          resultStatus: lastResultStatus,
          attempt: attempt + 1,
        });

        return {
          provider: "fal",
          status: "generated",
          asset: buildNarrationAsset({
            request,
            providerJobId: requestId,
            voice,
            speed,
            model,
            audioUrl: audioFile.url,
            mimeType: binary.mimeType,
          }),
          internalBinary: binary,
        };
      }

      logKokoroDebug("warn", "narration job timed out", {
        requestId,
        queueStatus: lastQueueStatus,
        resultStatus: lastResultStatus,
        pollIntervalMs,
        maxPollAttempts,
      });

      return {
        provider: "fal",
        status: "failed",
        error: "fal Kokoro narration timed out before completion.",
      };
    } catch (error) {
      return {
        provider: "fal",
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown fal Kokoro narration provider error.",
      };
    }
  },
};

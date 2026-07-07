import type { MarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import type { MediaAsset } from "@/lib/marketing-ai/media";
import type { TikTokOAuthServerConfig } from "@/lib/marketing-ai/tiktok/tiktokOAuth";

export const TIKTOK_TOKEN_ENDPOINT =
  "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_UPLOAD_INIT_ENDPOINT =
  "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
export const TIKTOK_STATUS_FETCH_ENDPOINT =
  "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

const FIVE_MB = 5 * 1024 * 1024;
const SIXTY_FOUR_MB = 64 * 1024 * 1024;

type TikTokTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type TikTokUploadInitResponse = {
  data?: {
    publish_id?: string;
    upload_url?: string;
  } | null;
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  } | null;
};

type TikTokStatusResponse = {
  data?: {
    status?: string;
    fail_reason?: string;
    uploaded_bytes?: number;
    downloaded_bytes?: number;
    publicaly_available_post_id?: Array<number | string>;
  } | null;
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  } | null;
};

export type TikTokTokenExchangeResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string | null;
      openId: string;
      expiresAt: string | null;
      refreshExpiresAt: string | null;
      grantedScopes: string[];
    }
  | {
      ok: false;
      error: "token_exchange_failed" | "invalid_tiktok_response";
    };

export type TikTokUploadPlan = {
  videoSize: number;
  chunkSize: number;
  totalChunkCount: number;
};

export type TikTokUploadInitResult =
  | {
      ok: true;
      publishId: string;
      uploadUrl: string;
      uploadPlan: TikTokUploadPlan;
    }
  | {
      ok: false;
      error: "upload_init_failed" | "invalid_tiktok_response";
    };

export type TikTokUploadStatusResult =
  | {
      ok: true;
      status: string;
      failReason: string | null;
      uploadedBytes: number | null;
      publiclyAvailablePostIds: Array<number | string>;
    }
  | {
      ok: false;
      error: "status_fetch_failed" | "invalid_tiktok_response";
    };

export type TikTokUploadReadinessResult =
  | {
      ok: true;
      asset: MediaAsset;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseGrantedScopes(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[,\s]+/g)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function toIsoFromSeconds(seconds: number | undefined) {
  if (!Number.isFinite(seconds) || !seconds || seconds <= 0) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

function readTikTokResponseJson(
  value: unknown,
): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}

async function parseTikTokJsonResponse<T extends object>(
  response: Response,
): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

export function resolveTikTokUploadPlan(videoSize: number): TikTokUploadPlan {
  if (!Number.isFinite(videoSize) || videoSize <= 0) {
    throw new Error("TikTok upload requires a positive video size.");
  }

  const chunkSize =
    videoSize < FIVE_MB ? videoSize : Math.min(videoSize, SIXTY_FOUR_MB);
  const totalChunkCount = Math.max(1, Math.ceil(videoSize / chunkSize));

  return {
    videoSize,
    chunkSize,
    totalChunkCount,
  };
}

export function buildTikTokUploadInitPayload(videoSize: number) {
  const uploadPlan = resolveTikTokUploadPlan(videoSize);

  return {
    source_info: {
      source: "FILE_UPLOAD" as const,
      video_size: uploadPlan.videoSize,
      chunk_size: uploadPlan.chunkSize,
      total_chunk_count: uploadPlan.totalChunkCount,
    },
  };
}

export function buildTikTokUploadChunkHeaders(params: {
  mimeType: string;
  firstByte: number;
  lastByte: number;
  totalByteLength: number;
}) {
  const byteLength = params.lastByte - params.firstByte + 1;

  return {
    "Content-Type": params.mimeType,
    "Content-Length": String(byteLength),
    "Content-Range": `bytes ${params.firstByte}-${params.lastByte}/${params.totalByteLength}`,
  };
}

function normalizeMediaAssetSourceUrl(asset: MediaAsset): string | null {
  if (typeof asset.downloadUrl === "string" && asset.downloadUrl.trim()) {
    return asset.downloadUrl.trim();
  }

  if (typeof asset.previewUrl === "string" && asset.previewUrl.trim()) {
    return asset.previewUrl.trim();
  }

  return null;
}

function isTikTokReadyVideoAsset(asset: MediaAsset) {
  return (
    (asset.kind === "reel" || asset.kind === "video") &&
    asset.status === "generated" &&
    asset.metadata?.hasMuxedNarration === true &&
    normalizeMediaAssetSourceUrl(asset) !== null
  );
}

export function resolveTikTokUploadMediaAsset(
  bundle: MarketingCampaignBundle,
): MediaAsset | null {
  const assets = bundle.media?.assets ?? [];

  return (
    assets.find(
      (asset) => asset.platform === "tiktok" && isTikTokReadyVideoAsset(asset),
    ) ??
    assets.find(
      (asset) => asset.platform === "instagram" && isTikTokReadyVideoAsset(asset),
    ) ??
    null
  );
}

export function evaluateTikTokUploadReadiness(
  bundle: MarketingCampaignBundle,
): TikTokUploadReadinessResult {
  if (!bundle.approval || !bundle.publisher) {
    return {
      ok: false,
      error: "Campaign bundle is invalid.",
      status: 400,
    };
  }

  if (bundle.approval.status !== "approved") {
    return {
      ok: false,
      error: "Campaign approval is not valid for TikTok upload.",
      status: 409,
    };
  }

  const tikTokChannel = bundle.publisher.channels.tiktok;

  if (
    tikTokChannel.status === "awaiting_tiktok_completion" ||
    tikTokChannel.platformUploadStatus === "SEND_TO_USER_INBOX"
  ) {
    return {
      ok: false,
      error: "TikTok upload already sent. Finish the post from the TikTok inbox notification.",
      status: 409,
    };
  }

  if (
    tikTokChannel.status === "publishing" ||
    (typeof tikTokChannel.publishAttemptId === "string" &&
      tikTokChannel.publishAttemptId.trim().length > 0)
  ) {
    return {
      ok: false,
      error: "TikTok upload already in progress.",
      status: 409,
    };
  }

  const asset = resolveTikTokUploadMediaAsset(bundle);

  if (!asset) {
    return {
      ok: false,
      error: "TikTok final narrated MP4 is missing.",
      status: 409,
    };
  }

  return {
    ok: true,
    asset,
  };
}

export function buildTikTokLockedResult(
  campaignRawResult: Record<string, unknown>,
  bundle: MarketingCampaignBundle,
  publishAttemptId: string,
  now: string,
) {
  return {
    ...campaignRawResult,
    bundle: {
      ...bundle,
      publisher: {
        ...bundle.publisher!,
        mode: "draft_only" as const,
        canPublish: false as const,
        channels: {
          ...bundle.publisher!.channels,
          tiktok: {
            ...bundle.publisher!.channels.tiktok,
            status: "publishing" as const,
            publishAttemptId,
            publishAttemptStartedAt: now,
            publishProvider: "tiktok" as const,
            platformUploadStatus: "PROCESSING_UPLOAD",
            lastPlatformUploadAt: undefined,
            externalCompletionRequired: true,
            externalCompletionMessage:
              "Video upload started. Finish the post from the TikTok inbox notification.",
          },
        },
      },
      updatedAt: now,
    },
  };
}

export function buildTikTokAwaitingCompletionResult(params: {
  campaignRawResult: Record<string, unknown>;
  bundle: MarketingCampaignBundle;
  publishId: string;
  uploadStatus: string;
  now: string;
}) {
  return {
    ...params.campaignRawResult,
    bundle: {
      ...params.bundle,
      publisher: {
        ...params.bundle.publisher!,
        mode: "draft_only" as const,
        canPublish: false as const,
        channels: {
          ...params.bundle.publisher!.channels,
          tiktok: {
            ...params.bundle.publisher!.channels.tiktok,
            status: "awaiting_tiktok_completion" as const,
            publishAttemptId: undefined,
            publishAttemptStartedAt: undefined,
            publishedAt: undefined,
            platformPostId: undefined,
            platformPublishId: params.publishId,
            publishProvider: "tiktok" as const,
            platformUploadStatus: params.uploadStatus,
            lastPlatformUploadAt: params.now,
            externalCompletionRequired: true,
            externalCompletionMessage:
              "Video sent to TikTok. Finish the publication from the TikTok inbox notification.",
          },
        },
      },
      updatedAt: params.now,
    },
  };
}

export function buildTikTokRollbackResult(
  campaignRawResult: Record<string, unknown>,
  bundle: MarketingCampaignBundle,
  now: string,
) {
  return {
    ...campaignRawResult,
    bundle: {
      ...bundle,
      publisher: {
        ...bundle.publisher!,
        mode: "draft_only" as const,
        canPublish: false as const,
        channels: {
          ...bundle.publisher!.channels,
          tiktok: {
            ...bundle.publisher!.channels.tiktok,
            status: "draft" as const,
            publishAttemptId: undefined,
            publishAttemptStartedAt: undefined,
            platformUploadStatus: undefined,
            lastPlatformUploadAt: undefined,
            externalCompletionRequired: undefined,
            externalCompletionMessage: undefined,
          },
        },
      },
      updatedAt: now,
    },
  };
}

export async function exchangeTikTokCodeForTokens(
  config: TikTokOAuthServerConfig,
  code: string,
): Promise<TikTokTokenExchangeResult> {
  const body = new URLSearchParams();
  body.set("client_key", config.clientKey);
  body.set("client_secret", config.clientSecret);
  body.set("code", code);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", config.redirectUri);

  const response = await fetch(TIKTOK_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as TikTokTokenResponse | null;

  if (!response.ok) {
    return {
      ok: false,
      error: "token_exchange_failed",
    };
  }

  if (
    !json ||
    typeof json.access_token !== "string" ||
    !json.access_token.trim() ||
    typeof json.open_id !== "string" ||
    !json.open_id.trim()
  ) {
    return {
      ok: false,
      error: "invalid_tiktok_response",
    };
  }

  return {
    ok: true,
    accessToken: json.access_token,
    refreshToken:
      typeof json.refresh_token === "string" && json.refresh_token.trim()
        ? json.refresh_token
        : null,
    openId: json.open_id,
    expiresAt: toIsoFromSeconds(json.expires_in),
    refreshExpiresAt: toIsoFromSeconds(json.refresh_expires_in),
    grantedScopes: parseGrantedScopes(json.scope),
  };
}

export async function refreshTikTokAccessToken(
  config: TikTokOAuthServerConfig,
  refreshToken: string,
): Promise<TikTokTokenExchangeResult> {
  const body = new URLSearchParams();
  body.set("client_key", config.clientKey);
  body.set("client_secret", config.clientSecret);
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);

  const response = await fetch(TIKTOK_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as TikTokTokenResponse | null;

  if (!response.ok) {
    return {
      ok: false,
      error: "token_exchange_failed",
    };
  }

  if (
    !json ||
    typeof json.access_token !== "string" ||
    !json.access_token.trim() ||
    typeof json.open_id !== "string" ||
    !json.open_id.trim()
  ) {
    return {
      ok: false,
      error: "invalid_tiktok_response",
    };
  }

  return {
    ok: true,
    accessToken: json.access_token,
    refreshToken:
      typeof json.refresh_token === "string" && json.refresh_token.trim()
        ? json.refresh_token
        : refreshToken,
    openId: json.open_id,
    expiresAt: toIsoFromSeconds(json.expires_in),
    refreshExpiresAt: toIsoFromSeconds(json.refresh_expires_in),
    grantedScopes: parseGrantedScopes(json.scope),
  };
}

export async function initializeTikTokInboxUpload(params: {
  accessToken: string;
  videoSize: number;
}): Promise<TikTokUploadInitResult> {
  const payload = buildTikTokUploadInitPayload(params.videoSize);
  const response = await fetch(TIKTOK_UPLOAD_INIT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = await parseTikTokJsonResponse<TikTokUploadInitResponse>(response);
  const uploadPlan = resolveTikTokUploadPlan(params.videoSize);
  const responseJson = readTikTokResponseJson(json);
  const data = readTikTokResponseJson(responseJson?.data);
  const publishId =
    typeof data?.publish_id === "string" ? data.publish_id.trim() : "";
  const uploadUrl =
    typeof data?.upload_url === "string" ? data.upload_url.trim() : "";

  if (!response.ok) {
    return {
      ok: false,
      error: "upload_init_failed",
    };
  }

  if (!publishId || !uploadUrl) {
    return {
      ok: false,
      error: "invalid_tiktok_response",
    };
  }

  return {
    ok: true,
    publishId,
    uploadUrl,
    uploadPlan,
  };
}

export async function uploadTikTokVideoFile(params: {
  uploadUrl: string;
  binary: Buffer;
  mimeType: string;
}) {
  const uploadPlan = resolveTikTokUploadPlan(params.binary.byteLength);

  for (let chunkIndex = 0; chunkIndex < uploadPlan.totalChunkCount; chunkIndex += 1) {
    const firstByte = chunkIndex * uploadPlan.chunkSize;
    const lastByte = Math.min(
      params.binary.byteLength - 1,
      firstByte + uploadPlan.chunkSize - 1,
    );
    const chunk = params.binary.subarray(firstByte, lastByte + 1);
    const response = await fetch(params.uploadUrl, {
      method: "PUT",
      headers: buildTikTokUploadChunkHeaders({
        mimeType: params.mimeType,
        firstByte,
        lastByte,
        totalByteLength: params.binary.byteLength,
      }),
      body: new Uint8Array(chunk),
      cache: "no-store",
    });

    if (![200, 201, 202, 206].includes(response.status)) {
      throw new Error(`TikTok FILE_UPLOAD failed with status ${response.status}.`);
    }
  }

  return uploadPlan;
}

export async function fetchTikTokUploadStatus(params: {
  accessToken: string;
  publishId: string;
}): Promise<TikTokUploadStatusResult> {
  const response = await fetch(TIKTOK_STATUS_FETCH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      publish_id: params.publishId,
    }),
    cache: "no-store",
  });
  const json = await parseTikTokJsonResponse<TikTokStatusResponse>(response);
  const responseJson = readTikTokResponseJson(json);
  const data = readTikTokResponseJson(responseJson?.data);

  if (!response.ok) {
    return {
      ok: false,
      error: "status_fetch_failed",
    };
  }

  if (!data || typeof data.status !== "string" || !data.status.trim()) {
    return {
      ok: false,
      error: "invalid_tiktok_response",
    };
  }

  return {
    ok: true,
    status: data.status.trim(),
    failReason:
      typeof data.fail_reason === "string" && data.fail_reason.trim()
        ? data.fail_reason
        : null,
    uploadedBytes:
      typeof data.uploaded_bytes === "number" ? data.uploaded_bytes : null,
    publiclyAvailablePostIds: Array.isArray(data.publicaly_available_post_id)
      ? data.publicaly_available_post_id
      : [],
  };
}

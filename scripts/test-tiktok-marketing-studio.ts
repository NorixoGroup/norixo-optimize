import type { MarketingCampaignBundle } from "../lib/marketing-ai/bundle/marketingCampaignBundle";
import {
  TIKTOK_MARKETING_STUDIO_SCOPES,
  buildTikTokOAuthLoginUrl,
  createTikTokOAuthState,
  readTikTokOAuthServerEnv,
} from "../lib/marketing-ai/tiktok/tiktokOAuth";
import {
  TIKTOK_STATUS_FETCH_ENDPOINT,
  TIKTOK_TOKEN_ENDPOINT,
  TIKTOK_UPLOAD_INIT_ENDPOINT,
  buildTikTokAwaitingCompletionResult,
  buildTikTokLockedResult,
  buildTikTokRollbackResult,
  buildTikTokUploadChunkHeaders,
  buildTikTokUploadInitPayload,
  evaluateTikTokUploadReadiness,
  exchangeTikTokCodeForTokens,
  fetchTikTokUploadStatus,
  initializeTikTokInboxUpload,
  refreshTikTokAccessToken,
  resolveTikTokUploadMediaAsset,
  uploadTikTokVideoFile,
} from "../lib/marketing-ai/tiktok/tiktokApi";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function buildTestBundle(): MarketingCampaignBundle {
  const now = new Date().toISOString();

  return {
    id: "tiktok-test-bundle",
    campaign: {
      id: "tiktok-test-campaign",
      name: "Campagne TikTok",
      objective: "education",
      audience: "Hotes",
      tone: "professional",
      cta: "Voir Norixo",
      websiteUrl: "https://norixo.io",
      language: "fr",
      platforms: ["facebook", "instagram", "linkedin", "tiktok"],
      formats: ["reel"],
      durationDays: 30,
      startDate: now,
      endDate: now,
      hashtags: ["#Norixo"],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    },
    approval: {
      status: "approved",
      requiredApprover: "Mohamed",
      requiresHumanValidation: true,
      approvedAt: now,
      approvedBy: "Mohamed",
      publisherReady: true,
      notes: [],
    },
    publisher: {
      mode: "draft_only",
      canPublish: false,
      requiresApproval: true,
      channels: {
        facebook: {
          platform: "facebook",
          status: "draft",
          copy: "Facebook copy",
          caption: "Facebook caption",
          hashtags: ["#Facebook"],
          assetPrompt: "Facebook asset prompt",
          videoPrompt: "Facebook video prompt",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        instagram: {
          platform: "instagram",
          status: "draft",
          copy: "Instagram copy",
          caption: "Instagram caption",
          hashtags: ["#Instagram"],
          assetPrompt: "Instagram asset prompt",
          videoPrompt: "Instagram video prompt",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        linkedin: {
          platform: "linkedin",
          status: "draft",
          copy: "LinkedIn copy",
          caption: "LinkedIn caption",
          hashtags: ["#LinkedIn"],
          assetPrompt: "LinkedIn asset prompt",
          videoPrompt: "LinkedIn video prompt",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        tiktok: {
          platform: "tiktok",
          status: "draft",
          copy: "Photo faible, confiance perdue.",
          caption:
            "Photo faible. Confiance plus basse. Une friction. Une action claire.",
          hashtags: ["#Norixo", "#TikTokHosts", "#ShortTermRental"],
          assetPrompt: "TikTok asset prompt",
          videoPrompt:
            "TikTok-native 10 second reel with one friction point and one fast action cue.",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
      },
    },
    media: {
      requests: [],
      assets: [
        {
          id: "instagram-final-reel",
          kind: "reel",
          status: "generated",
          platform: "instagram",
          ratio: "9:16",
          format: "mp4",
          language: "fr",
          title: "Instagram final reel",
          previewUrl: "https://storage.test/instagram-final-reel.mp4",
          downloadUrl: "https://storage.test/instagram-final-reel.mp4",
          generationProvider: "fal",
          metadata: {
            hasMuxedNarration: true,
            narrationLanguage: "fr",
            narrationProvider: "fal-ai/kokoro/french",
            sourceVideoAssetId: "seedance-source",
            sourceAudioAssetId: "kokoro-source",
          },
          warnings: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    notes: [],
    approvalRequired: true,
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const oauthConfig = readTikTokOAuthServerEnv({
    NODE_ENV: "test",
    TIKTOK_CLIENT_KEY: "tiktok-client-key",
    TIKTOK_CLIENT_SECRET: "tiktok-client-secret",
    TIKTOK_REDIRECT_URI: "https://norixo.io/api/admin/marketing-studio/tiktok/callback",
  } as NodeJS.ProcessEnv);

  assert(oauthConfig.ok, "Expected TikTok OAuth env to validate.");
  assert(
    TIKTOK_MARKETING_STUDIO_SCOPES.length === 1 &&
      TIKTOK_MARKETING_STUDIO_SCOPES[0] === "video.upload",
    "Expected TikTok scope to stay limited to video.upload.",
  );

  const oauthUrl = buildTikTokOAuthLoginUrl(
    oauthConfig.config,
    createTikTokOAuthState(),
  );
  assert(
    oauthUrl.toString().startsWith("https://www.tiktok.com/v2/auth/authorize/"),
    "Expected TikTok OAuth authorization URL.",
  );
  assert(
    oauthUrl.searchParams.get("scope") === "video.upload",
    "Expected TikTok OAuth URL to request only video.upload.",
  );

  const uploadPayload = buildTikTokUploadInitPayload(6 * 1024 * 1024);
  assert(
    uploadPayload.source_info.source === "FILE_UPLOAD" &&
      uploadPayload.source_info.video_size === 6 * 1024 * 1024 &&
      uploadPayload.source_info.chunk_size === 6 * 1024 * 1024 &&
      uploadPayload.source_info.total_chunk_count === 1,
    "Expected TikTok upload init payload to use FILE_UPLOAD in a single chunk for the current MP4 size.",
  );

  const chunkHeaders = buildTikTokUploadChunkHeaders({
    mimeType: "video/mp4",
    firstByte: 0,
    lastByte: 1023,
    totalByteLength: 1024,
  });
  assert(
    chunkHeaders["Content-Type"] === "video/mp4" &&
      chunkHeaders["Content-Length"] === "1024" &&
      chunkHeaders["Content-Range"] === "bytes 0-1023/1024",
    "Expected TikTok PUT upload headers to preserve Content-Type, Content-Length and Content-Range exactly.",
  );

  const bundle = buildTestBundle();
  const readiness = evaluateTikTokUploadReadiness(bundle);
  assert(readiness.ok, "Expected approved TikTok bundle to be uploadable.");
  assert(
    readiness.asset.metadata?.hasMuxedNarration === true &&
      readiness.asset.metadata?.narrationLanguage === "fr",
    "Expected TikTok readiness to use the final muxed French reel asset.",
  );
  assert(
    resolveTikTokUploadMediaAsset(bundle)?.id === "instagram-final-reel",
    "Expected TikTok to reuse the existing final muxed reel asset instead of the silent Seedance source.",
  );

  const blockedApproval = evaluateTikTokUploadReadiness({
    ...bundle,
    approval: {
      ...bundle.approval!,
      status: "pending_review",
    },
  });
  assert(
    !blockedApproval.ok &&
      blockedApproval.error === "Campaign approval is not valid for TikTok upload.",
    "Expected TikTok upload to require approval.",
  );

  const blockedDoubleUpload = evaluateTikTokUploadReadiness({
    ...bundle,
    publisher: {
      ...bundle.publisher!,
      channels: {
        ...bundle.publisher!.channels,
        tiktok: {
          ...bundle.publisher!.channels.tiktok,
          status: "awaiting_tiktok_completion",
          platformUploadStatus: "SEND_TO_USER_INBOX",
        },
      },
    },
  });
  assert(
    !blockedDoubleUpload.ok &&
      blockedDoubleUpload.error.includes("Finish the post from the TikTok inbox"),
    "Expected TikTok upload to block a second upload while completion is pending in TikTok.",
  );

  const lockNow = new Date().toISOString();
  const lockedResult = buildTikTokLockedResult(
    { bundle },
    bundle,
    "attempt-123",
    lockNow,
  );
  assert(
    (lockedResult.bundle as MarketingCampaignBundle).publisher?.channels.tiktok
      .status === "publishing",
    "Expected TikTok lock result to move the channel to publishing.",
  );

  const awaitingResult = buildTikTokAwaitingCompletionResult({
    campaignRawResult: { bundle },
    bundle,
    publishId: "v_inbox_file~v2.123456789",
    uploadStatus: "SEND_TO_USER_INBOX",
    now: lockNow,
  });
  const awaitingChannel = (awaitingResult.bundle as MarketingCampaignBundle).publisher
    ?.channels.tiktok;
  assert(
    awaitingChannel?.status === "awaiting_tiktok_completion" &&
      awaitingChannel.platformPublishId === "v_inbox_file~v2.123456789" &&
      awaitingChannel.platformUploadStatus === "SEND_TO_USER_INBOX" &&
      awaitingChannel.publishProvider === "tiktok" &&
      awaitingChannel.externalCompletionRequired === true,
    "Expected TikTok success state to stay awaiting_tiktok_completion with publish_id and upload status, never published.",
  );
  assert(
    awaitingChannel?.publishedAt === undefined &&
      awaitingChannel?.platformPostId === undefined,
    "Expected TikTok upload flow to avoid any published post markers.",
  );

  const rollbackResult = buildTikTokRollbackResult({ bundle }, bundle, lockNow);
  assert(
    (rollbackResult.bundle as MarketingCampaignBundle).publisher?.channels.tiktok
      .status === "draft",
    "Expected TikTok rollback to restore a coherent draft state.",
  );

  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{
    url: string;
    method: string;
    body?: string;
    headers: Record<string, string>;
  }> = [];
  const uploadBinary = Buffer.alloc(6 * 1024 * 1024, 7);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    fetchCalls.push({
      url,
      method,
      body:
        typeof init?.body === "string"
          ? init.body
          : init?.body instanceof Uint8Array
            ? `binary:${init.body.byteLength}`
            : undefined,
      headers: Object.fromEntries(headers.entries()),
    });

    if (url === TIKTOK_TOKEN_ENDPOINT) {
      const body = String(init?.body ?? "");

      if (body.includes("grant_type=authorization_code")) {
        return new Response(
          JSON.stringify({
            access_token: "tiktok-access-token",
            refresh_token: "tiktok-refresh-token",
            open_id: "open-id-123",
            expires_in: 86400,
            refresh_expires_in: 31536000,
            scope: "video.upload",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (body.includes("grant_type=refresh_token")) {
        return new Response(
          JSON.stringify({
            access_token: "tiktok-access-token-refreshed",
            refresh_token: "tiktok-refresh-token-2",
            open_id: "open-id-123",
            expires_in: 86400,
            refresh_expires_in: 31536000,
            scope: "video.upload",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    if (url === TIKTOK_UPLOAD_INIT_ENDPOINT) {
      return new Response(
        JSON.stringify({
          data: {
            publish_id: "v_inbox_file~v2.123456789",
            upload_url:
              "https://open-upload.tiktokapis.com/video/?upload_id=12345&upload_token=test-token",
          },
          error: {
            code: "ok",
            message: "",
            log_id: "log-123",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (
      url ===
        "https://open-upload.tiktokapis.com/video/?upload_id=12345&upload_token=test-token" &&
      method === "PUT"
    ) {
      return new Response(null, { status: 201 });
    }

    if (url === TIKTOK_STATUS_FETCH_ENDPOINT) {
      return new Response(
        JSON.stringify({
          data: {
            status: "SEND_TO_USER_INBOX",
            uploaded_bytes: 6 * 1024 * 1024,
            publicaly_available_post_id: [],
          },
          error: {
            code: "ok",
            message: "",
            log_id: "log-456",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const tokenResult = await exchangeTikTokCodeForTokens(
      oauthConfig.config,
      "oauth-code-123",
    );
    assert(tokenResult.ok, "Expected TikTok token exchange to succeed.");
    assert(
      tokenResult.accessToken === "tiktok-access-token" &&
        tokenResult.refreshToken === "tiktok-refresh-token" &&
        tokenResult.openId === "open-id-123",
      "Expected TikTok token exchange to return access token, refresh token and open_id.",
    );

    const refreshResult = await refreshTikTokAccessToken(
      oauthConfig.config,
      "tiktok-refresh-token",
    );
    assert(refreshResult.ok, "Expected TikTok refresh token flow to succeed.");
    assert(
      refreshResult.accessToken === "tiktok-access-token-refreshed",
      "Expected TikTok refresh token flow to return a refreshed access token.",
    );

    const initResult = await initializeTikTokInboxUpload({
      accessToken: "tiktok-access-token",
      videoSize: uploadBinary.byteLength,
    });
    assert(initResult.ok, "Expected TikTok upload init to succeed.");
    assert(
      initResult.publishId === "v_inbox_file~v2.123456789" &&
        initResult.uploadUrl ===
          "https://open-upload.tiktokapis.com/video/?upload_id=12345&upload_token=test-token",
      "Expected TikTok upload init to return publish_id and the exact upload_url.",
    );

    await uploadTikTokVideoFile({
      uploadUrl: initResult.uploadUrl,
      binary: uploadBinary,
      mimeType: "video/mp4",
    });

    const statusResult = await fetchTikTokUploadStatus({
      accessToken: "tiktok-access-token",
      publishId: initResult.publishId,
    });
    assert(statusResult.ok, "Expected TikTok status fetch to succeed.");
    assert(
      statusResult.status === "SEND_TO_USER_INBOX",
      "Expected TikTok status fetch to return SEND_TO_USER_INBOX for the Upload API flow.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const tokenRequest = fetchCalls.find((call) => call.url === TIKTOK_TOKEN_ENDPOINT);
  assert(tokenRequest, "Expected TikTok token exchange request.");
  assert(
    tokenRequest.headers["content-type"] === "application/x-www-form-urlencoded",
    "Expected TikTok token exchange request content-type.",
  );

  const uploadInitRequest = fetchCalls.find(
    (call) => call.url === TIKTOK_UPLOAD_INIT_ENDPOINT,
  );
  assert(uploadInitRequest, "Expected TikTok upload init request.");
  assert(
    uploadInitRequest.headers.authorization === "Bearer tiktok-access-token",
    "Expected TikTok upload init to use bearer auth.",
  );
  assert(
    uploadInitRequest.body ===
      JSON.stringify(buildTikTokUploadInitPayload(uploadBinary.byteLength)),
    "Expected TikTok upload init payload to match the FILE_UPLOAD schema exactly.",
  );

  const uploadPutRequest = fetchCalls.find(
    (call) =>
      call.url ===
        "https://open-upload.tiktokapis.com/video/?upload_id=12345&upload_token=test-token" &&
      call.method === "PUT",
  );
  assert(uploadPutRequest, "Expected TikTok PUT file upload request.");
  assert(
    uploadPutRequest.headers["content-type"] === "video/mp4" &&
      uploadPutRequest.headers["content-range"] ===
        `bytes 0-${uploadBinary.byteLength - 1}/${uploadBinary.byteLength}` &&
      uploadPutRequest.headers["content-length"] === String(uploadBinary.byteLength),
    "Expected TikTok PUT upload headers to preserve the exact Content-Range contract.",
  );

  const statusRequest = fetchCalls.find(
    (call) => call.url === TIKTOK_STATUS_FETCH_ENDPOINT,
  );
  assert(statusRequest, "Expected TikTok status fetch request.");
  assert(
    statusRequest.body ===
      JSON.stringify({ publish_id: "v_inbox_file~v2.123456789" }),
    "Expected TikTok status fetch to preserve publish_id.",
  );

  console.log(
    JSON.stringify(
      {
        oauthScopeVerified: true,
        tokenExchangeVerified: true,
        refreshTokenFlowVerified: true,
        initUploadEndpointVerified: true,
        fileUploadPayloadVerified: true,
        publishIdVerified: true,
        uploadUrlVerified: true,
        putUploadVerified: true,
        contentRangeVerified: true,
        statusFetchVerified: true,
        approvalRequiredVerified: true,
        doubleUploadBlockedVerified: true,
        awaitingTikTokCompletionVerified: true,
        neverPublishedAfterUploadVerified: true,
        finalMuxedAssetSelectedVerified: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

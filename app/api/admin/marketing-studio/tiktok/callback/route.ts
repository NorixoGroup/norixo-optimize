import { NextRequest, NextResponse } from "next/server";
import { exchangeTikTokCodeForTokens } from "@/lib/marketing-ai/tiktok/tiktokApi";
import { persistTikTokConnection } from "@/lib/marketing-ai/tiktok/tiktokConnectionStore";
import {
  TIKTOK_OAUTH_ACTOR_COOKIE_NAME,
  TIKTOK_OAUTH_FLOW_COOKIE_NAME,
  TIKTOK_OAUTH_FLOW_COOKIE_VALUE,
  TIKTOK_OAUTH_STATE_COOKIE_NAME,
  isTikTokOAuthState,
  parseTikTokOAuthActor,
  readTikTokOAuthServerEnv,
} from "@/lib/marketing-ai/tiktok/tiktokOAuth";

export const runtime = "nodejs";

const MARKETING_STUDIO_DASHBOARD_PATH = "/dashboard/admin/marketing-studio";

function buildDashboardRedirect(
  request: NextRequest,
  tikTokStatus: string,
  extraParams?: Record<string, string>,
) {
  const url = new URL(MARKETING_STUDIO_DASHBOARD_PATH, request.url);

  url.searchParams.set("tiktok", tikTokStatus);

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

function createNoStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.delete(TIKTOK_OAUTH_STATE_COOKIE_NAME);
  response.cookies.delete(TIKTOK_OAUTH_FLOW_COOKIE_NAME);
  response.cookies.delete(TIKTOK_OAUTH_ACTOR_COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  const callbackError = request.nextUrl.searchParams.get("error");
  const callbackCode = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  const callbackState = request.nextUrl.searchParams.get("state")?.trim() ?? "";
  const storedState =
    request.cookies.get(TIKTOK_OAUTH_STATE_COOKIE_NAME)?.value?.trim() ?? "";
  const storedFlow =
    request.cookies.get(TIKTOK_OAUTH_FLOW_COOKIE_NAME)?.value?.trim() ?? "";
  const actor = parseTikTokOAuthActor(
    request.cookies.get(TIKTOK_OAUTH_ACTOR_COOKIE_NAME)?.value?.trim() ?? "",
  );

  if (callbackError) {
    return createNoStoreRedirect(
      buildDashboardRedirect(request, "oauth_error", {
        reason: "tiktok_denied",
      }),
    );
  }

  if (!callbackCode) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing OAuth code.",
      },
      { status: 400 },
    );
  }

  if (!callbackState) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing OAuth state.",
      },
      { status: 400 },
    );
  }

  const envValidation = readTikTokOAuthServerEnv();

  if (!envValidation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing TikTok OAuth environment variables.",
        missing: envValidation.missing,
      },
      { status: 500 },
    );
  }

  if (!storedState) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing OAuth session state.",
      },
      { status: 401 },
    );
  }

  if (storedFlow !== TIKTOK_OAUTH_FLOW_COOKIE_VALUE) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  if (
    !isTikTokOAuthState(callbackState) ||
    !isTikTokOAuthState(storedState) ||
    storedState !== callbackState
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid OAuth state.",
      },
      { status: 400 },
    );
  }

  const tokenExchange = await exchangeTikTokCodeForTokens(
    envValidation.config,
    callbackCode,
  );

  if (!tokenExchange.ok) {
    await persistTikTokConnection({
      provider: "tiktok",
      status: "error",
      openId: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
      grantedScopes: [],
      lastConnectedByUserId: actor?.userId ?? null,
      lastConnectedByEmail: actor?.email ?? null,
    });

    return createNoStoreRedirect(
      buildDashboardRedirect(request, "oauth_error", {
        reason: tokenExchange.error,
      }),
    );
  }

  await persistTikTokConnection({
    provider: "tiktok",
    status: "connected",
    openId: tokenExchange.openId,
    accessToken: tokenExchange.accessToken,
    refreshToken: tokenExchange.refreshToken,
    expiresAt: tokenExchange.expiresAt,
    refreshExpiresAt: tokenExchange.refreshExpiresAt,
    grantedScopes: tokenExchange.grantedScopes,
    lastConnectedByUserId: actor?.userId ?? null,
    lastConnectedByEmail: actor?.email ?? null,
  });

  return createNoStoreRedirect(buildDashboardRedirect(request, "connected"));
}

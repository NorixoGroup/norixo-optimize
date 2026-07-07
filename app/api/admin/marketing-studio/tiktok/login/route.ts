import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  TIKTOK_OAUTH_ACTOR_COOKIE_NAME,
  TIKTOK_OAUTH_FLOW_COOKIE_NAME,
  TIKTOK_OAUTH_FLOW_COOKIE_VALUE,
  TIKTOK_OAUTH_STATE_COOKIE_NAME,
  buildTikTokOAuthLoginUrl,
  createTikTokOAuthState,
  readTikTokOAuthEnv,
  serializeTikTokOAuthActor,
} from "@/lib/marketing-ai/tiktok/tiktokOAuth";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

function setTikTokOAuthCookies(
  response: NextResponse,
  params: {
    state: string;
    userId: string;
    email: string | null;
  },
) {
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set({
    name: TIKTOK_OAUTH_STATE_COOKIE_NAME,
    value: params.state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set({
    name: TIKTOK_OAUTH_FLOW_COOKIE_NAME,
    value: TIKTOK_OAUTH_FLOW_COOKIE_VALUE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set({
    name: TIKTOK_OAUTH_ACTOR_COOKIE_NAME,
    value: serializeTikTokOAuthActor({
      userId: params.userId,
      email: params.email,
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function GET(request: NextRequest) {
  const requestClient = createRequestSupabaseClient(request);
  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!isAdminPrivateEmail(user.email)) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const envValidation = readTikTokOAuthEnv();

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

  const state = createTikTokOAuthState();
  const loginUrl = buildTikTokOAuthLoginUrl(envValidation.config, state);
  const wantsJson =
    request.headers.get("x-tiktok-oauth-mode")?.trim().toLowerCase() === "json";
  const response = wantsJson
    ? NextResponse.json({
        ok: true,
        url: loginUrl.toString(),
      })
    : NextResponse.redirect(loginUrl);

  setTikTokOAuthCookies(response, {
    state,
    userId: user.id,
    email: user.email ?? null,
  });

  return response;
}

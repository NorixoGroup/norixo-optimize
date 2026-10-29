import { NextRequest, NextResponse } from "next/server";
import {
  attachAdminSessionCookie,
  createMarketingStudioOAuthState,
  getAdminOAuthStateSecret,
  getBearerAccessToken,
} from "@/lib/auth/adminAccess";
import { isAdminPrivateUser } from "@/lib/auth/isAdminEmail";
import {
  META_OAUTH_FLOW_COOKIE_NAME,
  META_OAUTH_FLOW_COOKIE_VALUE,
  META_OAUTH_STATE_COOKIE_NAME,
  buildMetaOAuthLoginUrl,
  readMetaOAuthEnv,
} from "@/lib/marketing-ai/meta/metaOAuth";
import {
  MARKETING_STUDIO_NON_PRODUCTION_MESSAGE,
  isVercelProductionEnvironment,
} from "@/lib/marketing-ai/safety/providerProductionGate";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

function setMetaOAuthCookies(
  response: NextResponse,
  params: {
    state: string;
  },
) {
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set({
    name: META_OAUTH_STATE_COOKIE_NAME,
    value: params.state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set({
    name: META_OAUTH_FLOW_COOKIE_NAME,
    value: META_OAUTH_FLOW_COOKIE_VALUE,
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

  if (!isAdminPrivateUser(user)) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  if (!isVercelProductionEnvironment()) {
    return NextResponse.json(
      { ok: false, error: MARKETING_STUDIO_NON_PRODUCTION_MESSAGE },
      { status: 503 },
    );
  }

  const envValidation = readMetaOAuthEnv();

  if (!envValidation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing Meta OAuth environment variables.",
        missing: envValidation.missing,
      },
      { status: 500 },
    );
  }

  const oauthSecret = getAdminOAuthStateSecret();
  const state = oauthSecret
    ? createMarketingStudioOAuthState(
        { provider: "meta", userId: user.id, email: user.email },
        oauthSecret,
      )
    : null;
  if (!state) {
    return NextResponse.json(
      { ok: false, error: "Admin OAuth configuration unavailable." },
      { status: 503 },
    );
  }
  const loginUrl = buildMetaOAuthLoginUrl(envValidation.config, state);
  const wantsJson =
    request.headers.get("x-meta-oauth-mode")?.trim().toLowerCase() === "json";
  const response = wantsJson
    ? NextResponse.json({
        ok: true,
        url: loginUrl.toString(),
      })
    : NextResponse.redirect(loginUrl);

  setMetaOAuthCookies(response, {
    state,
  });

  // Keep the admin session cookie alive for the whole OAuth round trip: the
  // callback re-verifies it before any provider token is exchanged or stored.
  if (!attachAdminSessionCookie(response, user, getBearerAccessToken(request))) {
    return NextResponse.json(
      { ok: false, error: "Admin session configuration unavailable." },
      { status: 503 },
    );
  }

  return response;
}

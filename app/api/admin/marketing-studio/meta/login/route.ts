import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  META_OAUTH_FLOW_COOKIE_NAME,
  META_OAUTH_FLOW_COOKIE_VALUE,
  META_OAUTH_STATE_COOKIE_NAME,
  buildMetaOAuthLoginUrl,
  createMetaOAuthState,
  readMetaOAuthEnv,
} from "@/lib/marketing-ai/meta/metaOAuth";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

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

  const state = createMetaOAuthState();
  const loginUrl = buildMetaOAuthLoginUrl(envValidation.config, state);
  const response = NextResponse.redirect(loginUrl);

  response.headers.set("Cache-Control", "no-store");
  response.cookies.set({
    name: META_OAUTH_STATE_COOKIE_NAME,
    value: state,
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

  return response;
}

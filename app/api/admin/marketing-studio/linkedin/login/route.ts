import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  LINKEDIN_OAUTH_ACTOR_COOKIE_NAME,
  LINKEDIN_OAUTH_FLOW_COOKIE_NAME,
  LINKEDIN_OAUTH_FLOW_COOKIE_VALUE,
  LINKEDIN_OAUTH_STATE_COOKIE_NAME,
  buildLinkedInOAuthLoginUrl,
  createLinkedInOAuthState,
  readLinkedInOAuthEnv,
  serializeLinkedInOAuthActor,
} from "@/lib/marketing-ai/linkedin/linkedinOAuth";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

function setLinkedInOAuthCookies(
  response: NextResponse,
  params: {
    state: string;
    userId: string;
    email: string | null;
  },
) {
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set({
    name: LINKEDIN_OAUTH_STATE_COOKIE_NAME,
    value: params.state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set({
    name: LINKEDIN_OAUTH_FLOW_COOKIE_NAME,
    value: LINKEDIN_OAUTH_FLOW_COOKIE_VALUE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set({
    name: LINKEDIN_OAUTH_ACTOR_COOKIE_NAME,
    value: serializeLinkedInOAuthActor({
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

  const envValidation = readLinkedInOAuthEnv();

  if (!envValidation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing LinkedIn OAuth environment variables.",
        missing: envValidation.missing,
      },
      { status: 500 },
    );
  }

  const state = createLinkedInOAuthState();
  const loginUrl = buildLinkedInOAuthLoginUrl(envValidation.config, state);
  const wantsJson =
    request.headers.get("x-linkedin-oauth-mode")?.trim().toLowerCase() ===
    "json";
  const response = wantsJson
    ? NextResponse.json({
        ok: true,
        url: loginUrl.toString(),
      })
    : NextResponse.redirect(loginUrl);

  setLinkedInOAuthCookies(response, {
    state,
    userId: user.id,
    email: user.email ?? null,
  });

  return response;
}

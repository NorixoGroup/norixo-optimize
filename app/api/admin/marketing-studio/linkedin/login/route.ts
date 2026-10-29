import { NextRequest, NextResponse } from "next/server";
import { attachAdminSessionCookie, getBearerAccessToken } from "@/lib/auth/adminAccess";
import { isAdminPrivateUser } from "@/lib/auth/isAdminEmail";
import {
  LINKEDIN_OAUTH_FLOW_COOKIE_NAME,
  LINKEDIN_OAUTH_FLOW_COOKIE_VALUE,
  LINKEDIN_OAUTH_STATE_COOKIE_NAME,
  buildLinkedInOAuthLoginUrl,
  createLinkedInOAuthState,
  readLinkedInOAuthServerEnv,
} from "@/lib/marketing-ai/linkedin/linkedinOAuth";
import {
  MARKETING_STUDIO_NON_PRODUCTION_MESSAGE,
  isVercelProductionEnvironment,
} from "@/lib/marketing-ai/safety/providerProductionGate";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

function setLinkedInOAuthCookies(
  response: NextResponse,
  params: {
    state: string;
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
}

export async function GET(request: NextRequest) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (auth.status === "workspace_forbidden" || !isAdminPrivateUser(auth.user)) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  if (!isVercelProductionEnvironment()) {
    return NextResponse.json(
      { ok: false, error: MARKETING_STUDIO_NON_PRODUCTION_MESSAGE },
      { status: 503 },
    );
  }

  const envValidation = readLinkedInOAuthServerEnv();

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

  const state = createLinkedInOAuthState(
    {
      userId: auth.user.id,
      workspaceId: auth.workspace.id,
      email: auth.user.email,
    },
    envValidation.config.clientSecret,
  );
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
  });

  // Keep the admin session cookie alive for the whole OAuth round trip: the
  // callback re-verifies it before any provider token is exchanged or stored.
  if (!attachAdminSessionCookie(response, auth.user, getBearerAccessToken(request))) {
    return NextResponse.json(
      { ok: false, error: "Admin session configuration unavailable." },
      { status: 503 },
    );
  }

  return response;
}

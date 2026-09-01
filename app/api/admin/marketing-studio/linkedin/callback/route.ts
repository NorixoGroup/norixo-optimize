import { NextRequest, NextResponse } from "next/server";
import {
  exchangeLinkedInCodeForAccessToken,
  resolveLinkedInOrganization,
} from "@/lib/marketing-ai/linkedin/linkedinApi";
import { persistLinkedInConnection } from "@/lib/marketing-ai/linkedin/linkedinConnectionStore";
import {
  LINKEDIN_OAUTH_ACTOR_COOKIE_NAME,
  LINKEDIN_OAUTH_FLOW_COOKIE_NAME,
  LINKEDIN_OAUTH_FLOW_COOKIE_VALUE,
  LINKEDIN_OAUTH_STATE_COOKIE_NAME,
  parseLinkedInOAuthState,
  parseLinkedInOAuthActor,
  readLinkedInOAuthServerEnv,
} from "@/lib/marketing-ai/linkedin/linkedinOAuth";

export const runtime = "nodejs";

const MARKETING_STUDIO_DASHBOARD_PATH = "/dashboard/admin/marketing-studio";

function buildDashboardRedirect(
  request: NextRequest,
  linkedInStatus: string,
  extraParams?: Record<string, string>,
) {
  const url = new URL(MARKETING_STUDIO_DASHBOARD_PATH, request.url);

  url.searchParams.set("linkedin", linkedInStatus);

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
  response.cookies.delete(LINKEDIN_OAUTH_STATE_COOKIE_NAME);
  response.cookies.delete(LINKEDIN_OAUTH_FLOW_COOKIE_NAME);
  response.cookies.delete(LINKEDIN_OAUTH_ACTOR_COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  const callbackError = request.nextUrl.searchParams.get("error");
  const callbackCode = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  const callbackState = request.nextUrl.searchParams.get("state")?.trim() ?? "";
  const storedState =
    request.cookies.get(LINKEDIN_OAUTH_STATE_COOKIE_NAME)?.value?.trim() ?? "";
  const storedFlow =
    request.cookies.get(LINKEDIN_OAUTH_FLOW_COOKIE_NAME)?.value?.trim() ?? "";
  const actor = parseLinkedInOAuthActor(
    request.cookies.get(LINKEDIN_OAUTH_ACTOR_COOKIE_NAME)?.value?.trim() ?? "",
  );

  if (callbackError) {
    return createNoStoreRedirect(
      buildDashboardRedirect(request, "oauth_error", {
        reason: "linkedin_denied",
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

  if (!storedState) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing OAuth session state.",
      },
      { status: 401 },
    );
  }

  if (storedFlow !== LINKEDIN_OAUTH_FLOW_COOKIE_VALUE) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const callbackBinding = parseLinkedInOAuthState(callbackState, envValidation.config.clientSecret);
  const storedBinding = parseLinkedInOAuthState(storedState, envValidation.config.clientSecret);
  if (!callbackBinding || !storedBinding || storedState !== callbackState || callbackBinding.userId !== storedBinding.userId || callbackBinding.workspaceId !== storedBinding.workspaceId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid OAuth state.",
      },
      { status: 400 },
    );
  }

  const tokenExchange = await exchangeLinkedInCodeForAccessToken(
    envValidation.config,
    callbackCode,
  );

  if (!tokenExchange.ok) {
    return createNoStoreRedirect(
      buildDashboardRedirect(request, "oauth_error", {
        reason: tokenExchange.error,
      }),
    );
  }

  const organizationResolution = await resolveLinkedInOrganization(
    envValidation.config,
    tokenExchange.accessToken,
  );

  if (!organizationResolution.ok) {
    await persistLinkedInConnection({
      workspaceId: callbackBinding.workspaceId,
      provider: "linkedin",
      status: "error",
      accessToken: null,
      expiresAt: tokenExchange.expiresAt,
      organizationUrn: null,
      organizationId: null,
      grantedScopes: tokenExchange.grantedScopes,
      lastConnectedByUserId: callbackBinding.userId,
      lastConnectedByEmail: actor?.userId === callbackBinding.userId ? actor.email : null,
    });

    return createNoStoreRedirect(
      buildDashboardRedirect(request, "organization_error", {
        reason: organizationResolution.error,
      }),
    );
  }

  await persistLinkedInConnection({
    workspaceId: callbackBinding.workspaceId,
    provider: "linkedin",
    status: "connected",
    accessToken: tokenExchange.accessToken,
    expiresAt: tokenExchange.expiresAt,
    organizationUrn: organizationResolution.organization.organizationUrn,
    organizationId: organizationResolution.organization.organizationId,
    grantedScopes: tokenExchange.grantedScopes,
    lastConnectedByUserId: callbackBinding.userId,
    lastConnectedByEmail: actor?.userId === callbackBinding.userId ? actor.email : null,
  });

  return createNoStoreRedirect(buildDashboardRedirect(request, "connected"));
}

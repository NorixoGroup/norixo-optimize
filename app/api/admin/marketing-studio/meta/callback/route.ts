import { NextRequest, NextResponse } from "next/server";
import {
  META_OAUTH_FLOW_COOKIE_NAME,
  META_OAUTH_FLOW_COOKIE_VALUE,
  META_OAUTH_STATE_COOKIE_NAME,
  readMetaOAuthServerEnv,
  isMetaOAuthState,
} from "@/lib/marketing-ai/meta/metaOAuth";
import {
  META_ACCOUNT_SELECTION_COOKIE_NAME,
  serializeMetaAccountSelectionState,
} from "@/lib/marketing-ai/meta/metaAccountSelection";
import {
  createMetaReadOnlySelectionState,
  exchangeMetaCodeForUserAccessToken,
  enrichMetaFacebookPagesWithInstagramAccounts,
  fetchMetaFacebookPages,
} from "@/lib/marketing-ai/meta/metaGraph";

export const runtime = "nodejs";

const MARKETING_STUDIO_DASHBOARD_PATH = "/dashboard/admin/marketing-studio";

function buildDashboardRedirect(
  request: NextRequest,
  metaStatus: string,
  extraParams?: Record<string, string>,
) {
  const url = new URL(MARKETING_STUDIO_DASHBOARD_PATH, request.url);

  url.searchParams.set("meta", metaStatus);

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
  response.cookies.delete(META_OAUTH_STATE_COOKIE_NAME);
  response.cookies.delete(META_OAUTH_FLOW_COOKIE_NAME);
  return response;
}

function setMetaAccountSelectionCookie(
  response: NextResponse,
  value: ReturnType<typeof createMetaReadOnlySelectionState>,
) {
  response.cookies.set({
    name: META_ACCOUNT_SELECTION_COOKIE_NAME,
    value: serializeMetaAccountSelectionState(value),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function GET(request: NextRequest) {
  const callbackError = request.nextUrl.searchParams.get("error");
  const callbackCode = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  const callbackState = request.nextUrl.searchParams.get("state")?.trim() ?? "";
  const storedState =
    request.cookies.get(META_OAUTH_STATE_COOKIE_NAME)?.value?.trim() ?? "";
  const storedFlow =
    request.cookies.get(META_OAUTH_FLOW_COOKIE_NAME)?.value?.trim() ?? "";

  if (callbackError) {
    return createNoStoreRedirect(
      buildDashboardRedirect(request, "oauth_error", {
        reason: "meta_denied",
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

  const envValidation = readMetaOAuthServerEnv();

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

  if (!storedState) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing OAuth session state.",
      },
      { status: 401 },
    );
  }

  if (storedFlow !== META_OAUTH_FLOW_COOKIE_VALUE) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  if (
    !isMetaOAuthState(callbackState) ||
    !isMetaOAuthState(storedState) ||
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

  const tokenExchange = await exchangeMetaCodeForUserAccessToken(
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

  const pagesResult = await fetchMetaFacebookPages(
    envValidation.config,
    tokenExchange.accessToken,
  );

  if (!pagesResult.ok) {
    return createNoStoreRedirect(
      buildDashboardRedirect(request, "pages_error", {
        reason: pagesResult.error,
      }),
    );
  }

  if (pagesResult.pages.length === 0) {
    const response = createNoStoreRedirect(
      buildDashboardRedirect(request, "no_pages"),
    );
    setMetaAccountSelectionCookie(
      response,
      createMetaReadOnlySelectionState([]),
    );
    return response;
  }

  const instagramResult = await enrichMetaFacebookPagesWithInstagramAccounts(
    envValidation.config,
    tokenExchange.accessToken,
    pagesResult.pages,
  );

  if (!instagramResult.ok) {
    const response = createNoStoreRedirect(
      buildDashboardRedirect(request, "instagram_error", {
        reason: instagramResult.error,
      }),
    );
    setMetaAccountSelectionCookie(
      response,
      createMetaReadOnlySelectionState(pagesResult.pages, [], [
        "La detection Instagram Business a echoue pour les Pages detectees.",
      ]),
    );
    return response;
  }

  const selectionState = createMetaReadOnlySelectionState(
    instagramResult.pages,
    instagramResult.instagramAccounts,
    instagramResult.warnings,
  );
  const response = createNoStoreRedirect(
    buildDashboardRedirect(
      request,
      instagramResult.instagramAccounts.length > 0
        ? "instagram_detected"
        : "pages_detected",
    ),
  );

  setMetaAccountSelectionCookie(response, selectionState);

  return response;
}

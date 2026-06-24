import { NextRequest, NextResponse } from "next/server";
import {
  META_OAUTH_STATE_COOKIE_NAME,
  isMetaOAuthState,
  readMetaOAuthServerEnv,
} from "@/lib/marketing-ai/meta/metaOAuth";

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
  return response;
}

export async function GET(request: NextRequest) {
  const callbackError = request.nextUrl.searchParams.get("error");
  const callbackCode = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  const callbackState = request.nextUrl.searchParams.get("state")?.trim() ?? "";
  const storedState =
    request.cookies.get(META_OAUTH_STATE_COOKIE_NAME)?.value?.trim() ?? "";

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

  void envValidation.config;

  return createNoStoreRedirect(
    buildDashboardRedirect(request, "callback_received"),
  );
}

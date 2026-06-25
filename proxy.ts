import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/data/i18n";

function resolveRequestLocale(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];

  if (firstSegment && isLocale(firstSegment)) {
    return firstSegment;
  }

  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const configuredKey = process.env.INDEXNOW_KEY?.trim();
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(
    "x-norixo-locale",
    resolveRequestLocale(request.nextUrl.pathname),
  );

  if (!configuredKey) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (request.nextUrl.pathname !== `/${configuredKey}.txt`) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  requestHeaders.set("x-indexnow-rewrite", "1");
  return NextResponse.rewrite(new URL("/indexnow-key", request.url), {
    request: {
      headers: requestHeaders,
    },
  });
}

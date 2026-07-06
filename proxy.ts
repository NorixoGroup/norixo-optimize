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

  if (configuredKey && request.nextUrl.pathname === `/${configuredKey}.txt`) {
    return new NextResponse(configuredKey, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(
    "x-norixo-locale",
    resolveRequestLocale(request.nextUrl.pathname),
  );

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

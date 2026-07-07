import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/data/i18n";

const STATIC_PUBLIC_CACHE = "public, s-maxage=31536000, stale-while-revalidate=60";
const STATIC_PUBLIC_ROUTES = new Set([
  "/",
  "/pricing",
  "/demo",
  "/how-it-works",
  "/booking-optimization",
  "/privacy",
  "/legal",
  "/contact",
]);
const STATIC_PUBLIC_PREFIXES = [
  "/guides",
  "/countries",
  "/rankings",
  "/articles",
  "/tools",
  "/reports",
  "/airbnb-optimizer",
  "/solutions",
] as const;
const LOCALIZED_PUBLIC_CHILDREN = new Set(["pricing", "demo", "how-it-works"]);

function resolveRequestLocale(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];

  if (firstSegment && isLocale(firstSegment)) {
    return firstSegment;
  }

  return defaultLocale;
}

function isPublicSeoPathname(pathname: string) {
  if (STATIC_PUBLIC_ROUTES.has(pathname)) {
    return true;
  }

  if (
    STATIC_PUBLIC_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }

  const segments = pathname.split("/").filter(Boolean);
  const [firstSegment, secondSegment] = segments;

  if (!firstSegment || !isLocale(firstSegment)) {
    return false;
  }

  return (
    segments.length === 1 ||
    (segments.length === 2 && Boolean(secondSegment) && LOCALIZED_PUBLIC_CHILDREN.has(secondSegment))
  );
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

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (isPublicSeoPathname(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", STATIC_PUBLIC_CACHE);
  }

  return response;
}

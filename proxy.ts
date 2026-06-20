import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const configuredKey = process.env.INDEXNOW_KEY?.trim();

  if (!configuredKey) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname !== `/${configuredKey}.txt`) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-indexnow-rewrite", "1");

  return NextResponse.rewrite(new URL("/indexnow-key", request.url), {
    request: {
      headers: requestHeaders,
    },
  });
}

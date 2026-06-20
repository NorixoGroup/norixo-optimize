import { NextRequest } from "next/server";
import { notFound } from "next/navigation";

export async function GET(request: NextRequest) {
  const configuredKey = process.env.INDEXNOW_KEY?.trim();
  const isRewrittenRequest = request.headers.get("x-indexnow-rewrite") === "1";

  if (!configuredKey || !isRewrittenRequest) {
    notFound();
  }

  return new Response(configuredKey, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=300",
    },
  });
}

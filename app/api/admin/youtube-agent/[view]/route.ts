import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";
import { handleStudioRequest } from "@/lib/youtube-agent/studioService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lecture seule : le Nomad Studio ne parle qu'au pont local du YouTube Agent
// (loopback). Accès réservé aux admins privés, vérifié avant tout appel au pont.
export async function GET(request: NextRequest, context: { params: Promise<{ view: string }> }) {
  const requestClient = createRequestSupabaseClient(request);
  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isAdminPrivateEmail(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { view } = await context.params;
  const result = await handleStudioRequest({ view, params: request.nextUrl.searchParams });

  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}

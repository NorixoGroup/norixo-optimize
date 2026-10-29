import { NextRequest, NextResponse } from "next/server";
import {
  clearAdminSessionResponse,
  createAdminSessionResponse,
  getBearerAccessToken,
} from "@/lib/auth/adminAccess";
import { isAdminPrivateUser } from "@/lib/auth/isAdminEmail";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const accessToken = getBearerAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const requestClient = createRequestSupabaseClient(request);
  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!isAdminPrivateUser(user)) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  return createAdminSessionResponse(user, accessToken);
}

export async function DELETE() {
  return clearAdminSessionResponse();
}

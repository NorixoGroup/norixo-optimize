import { NextRequest, NextResponse } from "next/server";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestClient = createRequestSupabaseClient(request);
  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ isAdminPrivate: false }, { status: 401 });
  }

  return NextResponse.json({
    isAdminPrivate: isAdminPrivateEmail(user.email),
  });
}

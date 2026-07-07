import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { readLinkedInConnectionStatus } from "@/lib/marketing-ai/linkedin/linkedinConnectionStore";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const requestClient = createRequestSupabaseClient(request);
    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (!isAdminPrivateEmail(user.email)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden." },
        { status: 403 },
      );
    }

    const connection = await readLinkedInConnectionStatus();

    return NextResponse.json(
      {
        ok: true,
        connection,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[marketing-studio][linkedin][status] failed", error);

    return NextResponse.json(
      { ok: false, error: "LinkedIn status route failed." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { readLinkedInConnectionStatus } from "@/lib/marketing-ai/linkedin/linkedinConnectionStore";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestUserAndWorkspace(request);
    if (auth.status === "unauthenticated") {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden." },
        { status: 403 },
      );
    }

    const connection = await readLinkedInConnectionStatus(auth.workspace.id);

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

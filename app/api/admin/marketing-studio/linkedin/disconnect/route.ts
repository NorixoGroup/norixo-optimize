import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { disconnectLinkedInConnection } from "@/lib/marketing-ai/linkedin/linkedinConnectionStore";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestUserAndWorkspace(request);
    if (auth.status === "unauthenticated") {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    await disconnectLinkedInConnection(auth.workspace.id);

    return NextResponse.json({
      ok: true,
      connection: {
        provider: "linkedin",
        connected: false,
        status: "disconnected",
      },
    });
  } catch (error) {
    console.error("[marketing-studio][linkedin][disconnect] failed", error);
    return NextResponse.json(
      { ok: false, error: "LinkedIn local disconnect failed." },
      { status: 500 },
    );
  }
}

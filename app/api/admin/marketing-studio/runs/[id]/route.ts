import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { readMarketingStudioGenerationRunStatus } from "@/lib/marketing-ai/runs/marketingStudioGenerationRunStore";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const runId = typeof id === "string" ? id.trim() : "";

    if (!runId) {
      return NextResponse.json(
        { ok: false, error: "Missing runId." },
        { status: 400 },
      );
    }

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

    const { data: member } = await requestClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!member?.workspace_id) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found." },
        { status: 400 },
      );
    }

    const run = await readMarketingStudioGenerationRunStatus({
      runId,
      workspaceId: member.workspace_id,
    });

    if (!run) {
      return NextResponse.json(
        { ok: false, error: "Generation run not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      run,
    });
  } catch (error) {
    console.error("[marketing-studio] generation run status route failed", error);

    return NextResponse.json(
      { ok: false, error: "Generation run status route failed." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

/**
 * Lecture seule : état d’un audit persisté (l’insert n’a lieu qu’à la fin du POST /api/audits).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { client, user, workspace } = await getRequestUserAndWorkspace(request);
  if (!user || !client || !workspace) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await client
    .from("audits")
    .select("id, created_at")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    status: "completed" as const,
    created_at: data.created_at,
    completed_at: data.created_at,
    error_message: null as string | null,
  });
}

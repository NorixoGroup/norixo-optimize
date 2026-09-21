import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { runBacklinkAutonomyProductionPreview } from "@/lib/automation/backlink-autonomy-production-preview";

type PreviewBody = { workspaceLimit?: number; promotionLimitPerWorkspace?: number };
function parseBody(value: unknown): PreviewBody | null {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>, allowed = ["workspaceLimit", "promotionLimitPerWorkspace"];
  if (!Object.keys(record).every((key) => allowed.includes(key))) return null;
  for (const key of allowed) if (record[key] != null && (typeof record[key] !== "number" || !Number.isInteger(record[key]) || record[key] < 1 || record[key] > 100)) return null;
  return { ...(typeof record.workspaceLimit === "number" ? { workspaceLimit: record.workspaceLimit } : {}), ...(typeof record.promotionLimitPerWorkspace === "number" ? { promotionLimitPerWorkspace: record.promotionLimitPerWorkspace } : {}) };
}

/** Authenticated preview only: this route has no apply/live/execute input. */
export async function POST(request: NextRequest) {
  const context = await getRequestUserAndWorkspace(request);
  if (context.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context.status === "workspace_forbidden" || !isAdminPrivateEmail(context.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = parseBody(await request.json().catch(() => null));
  if (body == null) return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: "Invalid autonomy preview input" } }, { status: 400 });
  try { return NextResponse.json({ ok: true, result: await runBacklinkAutonomyProductionPreview(body) }); }
  catch { console.error("[automation/backlinks/autonomy/preview] request failed"); return NextResponse.json({ ok: false, error: { code: "AUTONOMY_PREVIEW_FAILED", message: "Unable to preview backlink autonomy" } }, { status: 500 }); }
}

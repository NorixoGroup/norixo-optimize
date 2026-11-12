import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  BacklinkCampaignApplyAuthorizationError,
  setBacklinkCampaignApplyAuthorization,
} from "@/lib/automation/repositories/backlinkCampaignApplyAuthorizationRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type AuthorizationRequestBody = { enabled: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(value: unknown): AuthorizationRequestBody | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "enabled" || typeof value.enabled !== "boolean") return null;
  return { enabled: value.enabled };
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/**
 * Human-authenticated only — intentionally uses the caller's own session
 * client, never the service_role admin client. The actual enforcement is the
 * set_backlink_campaign_apply_authorization RPC's own auth.uid() check; this
 * route cannot bypass it even if this gate were ever removed by mistake.
 * Authorizing campaign-apply never authorizes a send: campaign_prepare and
 * draft_prepare only ever create internal rows, and dry_run_only plus the
 * send trigger remain independently enforced further downstream.
 */
export async function POST(request: NextRequest) {
  const context = await getRequestUserAndWorkspace(request);
  if (context.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (context.status === "workspace_forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isAdminPrivateEmail(context.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = parseBody(await request.json().catch(() => null));
  if (body === null) {
    return errorResponse(400, "INVALID_INPUT", "La requête d'autorisation est invalide.");
  }

  try {
    const result = await setBacklinkCampaignApplyAuthorization(context.client, {
      workspaceId: context.workspace.id,
      enabled: body.enabled,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const code = error instanceof BacklinkCampaignApplyAuthorizationError ? error.code : null;
    if (code === "CAMPAIGN_APPLY_AUTHORIZATION_UNAUTHORIZED") {
      return errorResponse(403, code, "Vous n'êtes pas autorisé à effectuer cette opération.");
    }
    if (code === "CAMPAIGN_APPLY_AUTHORIZATION_WORKSPACE_NOT_FOUND") {
      return errorResponse(404, code, "Workspace introuvable.");
    }
    console.error("[automation/backlinks/campaign-apply-authorization] request failed");
    return errorResponse(500, "CAMPAIGN_APPLY_AUTHORIZATION_FAILED", "L'opération a échoué.");
  }
}

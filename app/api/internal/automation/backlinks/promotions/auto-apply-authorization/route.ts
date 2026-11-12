import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  BacklinkPromotionAutoApplyAuthorizationError,
  setBacklinkPromotionAutoApplyAuthorization,
} from "@/lib/automation/repositories/backlinkPromotionAutoApplyAuthorizationRepository";
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
 * set_backlink_promotion_auto_apply_authorization RPC's own auth.uid() check;
 * this route cannot bypass it even if this gate were ever removed by mistake.
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
    const result = await setBacklinkPromotionAutoApplyAuthorization(context.client, {
      workspaceId: context.workspace.id,
      enabled: body.enabled,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const code = error instanceof BacklinkPromotionAutoApplyAuthorizationError ? error.code : null;
    if (code === "PROMOTION_AUTO_APPLY_AUTHORIZATION_UNAUTHORIZED") {
      return errorResponse(403, code, "Vous n'êtes pas autorisé à effectuer cette opération.");
    }
    if (code === "PROMOTION_AUTO_APPLY_AUTHORIZATION_WORKSPACE_NOT_FOUND") {
      return errorResponse(404, code, "Workspace introuvable.");
    }
    console.error("[automation/backlinks/promotions/auto-apply-authorization] request failed");
    return errorResponse(500, "PROMOTION_AUTO_APPLY_AUTHORIZATION_FAILED", "L'opération a échoué.");
  }
}

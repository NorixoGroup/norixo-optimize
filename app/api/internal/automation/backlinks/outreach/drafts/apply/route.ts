import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { createBacklinkOutreachDraftRouteServices } from "@/lib/backlinks/services/outreachDraftRouteService";
import { BacklinkOutreachDraftError } from "@/lib/backlinks/services/outreachDraftService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const channels = ["email", "linkedin", "contact_form"] as const;
function parse(value: unknown) { if (typeof value !== "object" || value == null || Array.isArray(value)) return null; const record = value as Record<string, unknown>; const keys = Object.keys(record); if (keys.length !== 5 || !["campaignId", "opportunityId", "contactId", "channel", "confirm"].every((key) => keys.includes(key))) return null; return typeof record.campaignId === "string" && typeof record.opportunityId === "string" && typeof record.contactId === "string" && record.confirm === true && channels.includes(record.channel as typeof channels[number]) ? { campaignId: record.campaignId, opportunityId: record.opportunityId, contactId: record.contactId, channel: record.channel as typeof channels[number] } : null; }

type DraftCreationError = {
  code:
    | "DRAFT_KEY_RESERVATION_UNAVAILABLE"
    | "DRAFT_WORKSPACE_PERMISSION_DENIED"
    | "DRAFT_CREATION_CONFLICT"
    | "DRAFT_CREATION_UNAVAILABLE";
  message: string;
  stage: "key_reservation" | "workspace_permission" | "creation" | "eligibility" | "unexpected";
  structuredCode: string | null;
};

function structuredErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error == null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

export function classifyDraftCreationError(error: unknown): DraftCreationError {
  if (error instanceof BacklinkRepositoryError) {
    if (error.operation === "reserveBacklinkOutreachKey") {
      return { code: "DRAFT_KEY_RESERVATION_UNAVAILABLE", message: "Draft key reservation is unavailable.", stage: "key_reservation", structuredCode: error.code };
    }
    if (error.code === "FORBIDDEN" || (error.code === "DATABASE" && structuredErrorCode(error.cause) === "42501")) {
      return { code: "DRAFT_WORKSPACE_PERMISSION_DENIED", message: "Draft creation is not permitted for this workspace.", stage: "workspace_permission", structuredCode: error.code };
    }
    if (error.code === "CONFLICT") {
      return { code: "DRAFT_CREATION_CONFLICT", message: "A draft already exists for this selection.", stage: "creation", structuredCode: error.code };
    }
    return { code: "DRAFT_CREATION_UNAVAILABLE", message: "Draft creation unavailable.", stage: "creation", structuredCode: error.code };
  }
  if (error instanceof BacklinkOutreachDraftError) {
    return { code: "DRAFT_CREATION_UNAVAILABLE", message: "Draft creation unavailable.", stage: "eligibility", structuredCode: error.code };
  }
  return { code: "DRAFT_CREATION_UNAVAILABLE", message: "Draft creation unavailable.", stage: "unexpected", structuredCode: null };
}

export async function POST(request: NextRequest) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = parse(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  try {
    const result = await createBacklinkOutreachDraftRouteServices(auth.client, createSupabaseAdminClient()).create({
      ...input,
      workspaceId: auth.workspace.id,
      actorUserId: auth.user.id,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const diagnostic = classifyDraftCreationError(error);
    console.error("[backlinks-draft-apply-error]", {
      stage: diagnostic.stage,
      safeCode: diagnostic.code,
      structuredCode: diagnostic.structuredCode,
    });
    return NextResponse.json(
      { error: { code: diagnostic.code, message: diagnostic.message } },
      { status: 409 },
    );
  }
}

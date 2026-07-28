import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  getCampaign,
  updateCampaign,
  type UpdateCampaignInput,
} from "@/lib/backlinks/services/campaignService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

function responseForError(error: unknown) {
  const code =
    typeof error === "object" && error != null && "code" in error && typeof error.code === "string"
      ? error.code
      : null;
  const message = error instanceof Error ? error.message : "Impossible de traiter la campagne.";

  if (code === "NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
  if (code === "VALIDATION") return NextResponse.json({ error: message }, { status: 400 });
  if (code === "CONFLICT") return NextResponse.json({ error: message }, { status: 409 });
  if (code === "FORBIDDEN") return NextResponse.json({ error: message }, { status: 403 });

  console.error("[backlinks/campaign] request failed", error);
  return NextResponse.json({ error: "Impossible de traiter la campagne." }, { status: 500 });
}

async function getContext(request: NextRequest) {
  const { client, user, workspace } = await getRequestUserAndWorkspace(request);
  if (!client || !user || !workspace) return null;
  if (!isAdminPrivateEmail(user.email)) return "forbidden" as const;
  return { client, workspace };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const requestContext = await getContext(request);
  if (requestContext == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (requestContext === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    return NextResponse.json(await getCampaign(requestContext.client, requestContext.workspace.id, id));
  } catch (error) {
    return responseForError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const requestContext = await getContext(request);
  if (requestContext == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (requestContext === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body == null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await updateCampaign(requestContext.client, requestContext.workspace.id, id, body as UpdateCampaignInput),
    );
  } catch (error) {
    return responseForError(error);
  }
}

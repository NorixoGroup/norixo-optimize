import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  createOutreach,
  listOutreach,
  type CreateOutreachInput,
} from "@/lib/backlinks/services/outreachService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

function responseForError(error: unknown) {
  const code =
    typeof error === "object" && error != null && "code" in error && typeof error.code === "string"
      ? error.code
      : null;
  const message = error instanceof Error ? error.message : "Impossible de traiter l’outreach.";

  if (code === "NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
  if (code === "VALIDATION") return NextResponse.json({ error: message }, { status: 400 });
  if (code === "CONFLICT") return NextResponse.json({ error: message }, { status: 409 });
  if (code === "FORBIDDEN") return NextResponse.json({ error: message }, { status: 403 });

  console.error("[backlinks/outreach] request failed", error);
  return NextResponse.json({ error: "Impossible de traiter l’outreach." }, { status: 500 });
}

async function getContext(request: NextRequest) {
  const result = await getRequestUserAndWorkspace(request);
  if (result.status === "unauthenticated") return null;
  if (result.status === "workspace_forbidden") return "forbidden" as const;
  if (!isAdminPrivateEmail(result.user.email)) return "forbidden" as const;
  return { client: result.client, user: result.user, workspace: result.workspace };
}

export async function GET(request: NextRequest) {
  const context = await getContext(request);
  if (context == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    return NextResponse.json(await listOutreach(context.client, context.workspace.id));
  } catch (error) {
    return responseForError(error);
  }
}

export async function POST(request: NextRequest) {
  const context = await getContext(request);
  if (context == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body == null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await createOutreach(context.client, context.workspace.id, context.user.id, body as CreateOutreachInput),
      { status: 201 },
    );
  } catch (error) {
    return responseForError(error);
  }
}

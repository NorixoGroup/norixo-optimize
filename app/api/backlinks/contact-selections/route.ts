import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { assertContactSelectionAuthority, listContactSelectionCases, recordContactSelectionDecision } from "@/lib/backlinks/repositories/contactSelectionRepository";
import { parseContactSelectionDecision } from "@/lib/backlinks/services/contactSelectionReviewService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

async function context(request: NextRequest) {
  const auth = await getRequestUserAndWorkspace(request);
  if (auth.status === "unauthenticated") return null;
  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) return "forbidden" as const;
  return auth;
}

function responseFor(error: unknown) {
  if (error instanceof BacklinkRepositoryError && error.code === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (error instanceof BacklinkRepositoryError && (error.code === "VALIDATION" || error.code === "NOT_FOUND")) return NextResponse.json({ error: "Contact selection is no longer available." }, { status: 409 });
  return NextResponse.json({ error: "Contact selection is unavailable." }, { status: 409 });
}

export async function GET(request: NextRequest) {
  const auth = await context(request);
  if (auth == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await assertContactSelectionAuthority(auth.client, auth.workspace.id);
    const cases = await listContactSelectionCases(auth.client, auth.workspace.id);
    return NextResponse.json({ cases });
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await context(request);
  if (auth == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = parseContactSelectionDecision(await request.json().catch(() => null));
  if (input == null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    await assertContactSelectionAuthority(auth.client, auth.workspace.id);
    const result = await recordContactSelectionDecision(auth.client, auth.workspace.id, input);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return responseFor(error);
  }
}

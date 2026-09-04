import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { getContactFormCampaignReport } from "@/lib/backlinks/services/contactFormCampaignReportingService";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await getRequestUserAndWorkspace(request);

  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.status === "workspace_forbidden" || !isAdminPrivateEmail(auth.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    return NextResponse.json({
      ok: true,
      result: await getContactFormCampaignReport(auth.client, auth.workspace.id, id),
    });
  } catch (error) {
    const code =
      typeof error === "object" &&
      error != null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;

    if (code === "NOT_FOUND") {
      const message =
        error instanceof Error
          ? error.message
          : "The requested record was not found.";

      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error("[backlinks/contact-form-report] request failed", error);
    return NextResponse.json(
      { error: "Impossible de charger le reporting des formulaires." },
      { status: 500 },
    );
  }
}

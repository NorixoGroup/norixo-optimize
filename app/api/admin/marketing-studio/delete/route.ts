import { NextResponse } from "next/server";
import { requireMarketingStudioAdmin } from "@/lib/auth/adminAccess";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const campaignId =
      typeof body.campaignId === "string" && body.campaignId.trim()
        ? body.campaignId.trim()
        : null;

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: "Missing campaign id." },
        { status: 400 }
      );
    }

    const admin = await requireMarketingStudioAdmin(request);
    if (!admin.ok) return admin.response;
    const { client: supabase, workspace } = admin.access;

    const { error } = await supabase
      .from("marketing_campaigns")
      .delete()
      .eq("id", campaignId)
      .eq("workspace_id", workspace.id);

    if (error) {
      console.error("[marketing-studio] delete failed", error);
      return NextResponse.json(
        { ok: false, error: error.message, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[marketing-studio] delete route failed", error);
    return NextResponse.json(
      { ok: false, error: "Delete route failed." },
      { status: 500 }
    );
  }
}

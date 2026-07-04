import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const campaignId = typeof id === "string" ? id.trim() : "";

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: "Missing campaignId." },
        { status: 400 },
      );
    }

    const requestClient = createRequestSupabaseClient(request);
    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (!isAdminPrivateEmail(user.email)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden." },
        { status: 403 },
      );
    }

    const { data: member } = await requestClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!member?.workspace_id) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found." },
        { status: 400 },
      );
    }

    const { data: campaign, error: campaignError } = await requestClient
      .from("marketing_campaigns")
      .select("id, status, created_at, updated_at, raw_result")
      .eq("id", campaignId)
      .eq("workspace_id", member.workspace_id)
      .maybeSingle();

    if (campaignError) {
      return NextResponse.json(
        { ok: false, error: campaignError.message },
        { status: 500 },
      );
    }

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: "Campaign not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      campaign: {
        id: campaign.id,
        status: campaign.status,
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
      },
      result: campaign.raw_result,
    });
  } catch (error) {
    console.error("[marketing-studio] campaign read route failed", error);

    return NextResponse.json(
      { ok: false, error: "Campaign read route failed." },
      { status: 500 },
    );
  }
}

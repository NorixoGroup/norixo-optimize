import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { isMarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { campaignId?: unknown }
      | null;
    const campaignId =
      typeof body?.campaignId === "string" ? body.campaignId.trim() : "";

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
      .select("id, status, raw_result")
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

    if (!isPlainObject(campaign.raw_result) || !isPlainObject(campaign.raw_result.bundle)) {
      return NextResponse.json(
        { ok: false, error: "Campaign bundle is missing." },
        { status: 400 },
      );
    }

    const currentBundle = campaign.raw_result.bundle;

    if (
      !isMarketingCampaignBundle(currentBundle) ||
      !currentBundle.review ||
      !currentBundle.approval
    ) {
      return NextResponse.json(
        { ok: false, error: "Campaign bundle is invalid." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const approvedBy = user.email?.trim() || user.id;
    const nextBundle = {
      ...currentBundle,
      review: currentBundle.review
        ? {
            ...currentBundle.review,
            status: "approved" as const,
            updatedAt: now,
          }
        : undefined,
      approval: currentBundle.approval
        ? {
            ...currentBundle.approval,
            status: "approved" as const,
            requiresHumanValidation: true as const,
            approvedAt: now,
            approvedBy,
            publisherReady: true,
          }
        : undefined,
      updatedAt: now,
    };
    const nextResult = {
      ...campaign.raw_result,
      bundle: nextBundle,
    };

    const { error: updateError } = await requestClient
      .from("marketing_campaigns")
      .update({
        status: "approved",
        raw_result: nextResult,
        updated_at: now,
      })
      .eq("id", campaign.id)
      .eq("workspace_id", member.workspace_id);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      campaign: {
        id: campaign.id,
        status: "approved",
      },
      result: nextResult,
    });
  } catch (error) {
    console.error("[marketing-studio] approve route failed", error);

    return NextResponse.json(
      { ok: false, error: "Approve route failed." },
      { status: 500 },
    );
  }
}

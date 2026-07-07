import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { isMarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import {
  buildLinkedInLockedResult,
  buildLinkedInPublishedResult,
  buildLinkedInRollbackResult,
  evaluateLinkedInPublishReadiness,
  publishLinkedInTextPost,
} from "@/lib/marketing-ai/linkedin/linkedinApi";
import { readLinkedInConnectionForPublish } from "@/lib/marketing-ai/linkedin/linkedinConnectionStore";
import { readLinkedInOAuthServerEnv } from "@/lib/marketing-ai/linkedin/linkedinOAuth";
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
      .select("id, status, raw_result, updated_at")
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

    if (campaign.status !== "approved") {
      return NextResponse.json(
        { ok: false, error: "Campaign must be approved before publishing." },
        { status: 409 },
      );
    }

    if (
      !isPlainObject(campaign.raw_result) ||
      !isPlainObject(campaign.raw_result.bundle)
    ) {
      return NextResponse.json(
        { ok: false, error: "Campaign bundle is missing." },
        { status: 400 },
      );
    }

    const currentBundle = campaign.raw_result.bundle;

    if (!isMarketingCampaignBundle(currentBundle) || !currentBundle.publisher) {
      return NextResponse.json(
        { ok: false, error: "Campaign bundle is invalid." },
        { status: 400 },
      );
    }

    const readiness = evaluateLinkedInPublishReadiness(currentBundle);

    if (!readiness.ok) {
      return NextResponse.json(
        { ok: false, error: readiness.error },
        { status: readiness.status },
      );
    }

    const linkedInConnection = await readLinkedInConnectionForPublish();

    if (!linkedInConnection || linkedInConnection.status !== "connected") {
      return NextResponse.json(
        { ok: false, error: "LinkedIn connection is not available." },
        { status: 409 },
      );
    }

    if (!linkedInConnection.organizationUrn) {
      return NextResponse.json(
        { ok: false, error: "LinkedIn organization URN is missing." },
        { status: 409 },
      );
    }

    if (!linkedInConnection.accessToken) {
      return NextResponse.json(
        { ok: false, error: "LinkedIn access token is missing." },
        { status: 409 },
      );
    }

    const envValidation = readLinkedInOAuthServerEnv();

    if (!envValidation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing LinkedIn OAuth environment variables.",
          missing: envValidation.missing,
        },
        { status: 500 },
      );
    }

    const publishAttemptId = crypto.randomUUID();
    const lockStartedAt = new Date().toISOString();
    const lockedResult = buildLinkedInLockedResult(
      campaign.raw_result,
      currentBundle,
      publishAttemptId,
      lockStartedAt,
    );

    const { data: lockedCampaign, error: lockError } = await requestClient
      .from("marketing_campaigns")
      .update({
        status: "approved",
        raw_result: lockedResult,
        updated_at: lockStartedAt,
      })
      .eq("id", campaign.id)
      .eq("workspace_id", member.workspace_id)
      .eq("updated_at", campaign.updated_at)
      .select("id, updated_at")
      .maybeSingle();

    if (lockError) {
      return NextResponse.json(
        { ok: false, error: lockError.message },
        { status: 500 },
      );
    }

    if (!lockedCampaign) {
      return NextResponse.json(
        { ok: false, error: "LinkedIn publish lock could not be acquired." },
        { status: 409 },
      );
    }

    const publishResult = await publishLinkedInTextPost(envValidation.config, {
      accessToken: linkedInConnection.accessToken,
      organizationUrn: linkedInConnection.organizationUrn,
      message: readiness.message,
    });

    if (!publishResult.ok) {
      const rollbackAt = new Date().toISOString();
      const rollbackResult = buildLinkedInRollbackResult(
        campaign.raw_result,
        currentBundle,
        rollbackAt,
      );

      const { data: rolledBackCampaign, error: rollbackError } =
        await requestClient
          .from("marketing_campaigns")
          .update({
            status: "approved",
            raw_result: rollbackResult,
            updated_at: rollbackAt,
          })
          .eq("id", campaign.id)
          .eq("workspace_id", member.workspace_id)
          .eq("updated_at", lockStartedAt)
          .select("id")
          .maybeSingle();

      if (rollbackError || !rolledBackCampaign) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "LinkedIn publish failed and the publish lock could not be rolled back automatically.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { ok: false, error: "LinkedIn publish failed.", reason: publishResult.error },
        { status: 502 },
      );
    }

    const now = new Date().toISOString();
    const nextResult = buildLinkedInPublishedResult(
      campaign.raw_result,
      currentBundle,
      publishResult.postId,
      now,
    );

    const { data: updatedCampaign, error: updateError } = await requestClient
      .from("marketing_campaigns")
      .update({
        status: "approved",
        raw_result: nextResult,
        updated_at: now,
      })
      .eq("id", campaign.id)
      .eq("workspace_id", member.workspace_id)
      .eq("updated_at", lockStartedAt)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedCampaign) {
      return NextResponse.json(
        {
          ok: false,
          error:
            updateError?.message ??
            "LinkedIn publish succeeded but the final campaign state could not be persisted.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      campaign: {
        id: campaign.id,
        status: "approved",
      },
      linkedin: {
        postId: publishResult.postId,
      },
      result: nextResult,
    });
  } catch (error) {
    console.error("[marketing-studio][linkedin][publish-post] failed", error);

    return NextResponse.json(
      { ok: false, error: "LinkedIn publish route failed." },
      { status: 500 },
    );
  }
}

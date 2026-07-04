import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { isMarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import type { MarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import { publishMetaFacebookTextPost } from "@/lib/marketing-ai/meta/metaGraph";
import {
  readMetaConnectionForPublish,
} from "@/lib/marketing-ai/meta/metaConnectionStore";
import { readMetaOAuthServerEnv } from "@/lib/marketing-ai/meta/metaOAuth";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveFacebookPublishMessage(bundle: MarketingCampaignBundle) {
  const finalCaption =
    bundle.publisher?.channels.facebook.publisherOutput?.finalCaption?.trim() ?? "";
  if (finalCaption) {
    return finalCaption;
  }

  const caption = bundle.publisher?.channels.facebook.caption?.trim() ?? "";
  if (caption) {
    return caption;
  }

  const copy = bundle.publisher?.channels.facebook.copy?.trim() ?? "";
  return copy;
}

function buildLockedResult(
  campaignRawResult: Record<string, unknown>,
  bundle: MarketingCampaignBundle,
  publishAttemptId: string,
  now: string,
) {
  return {
    ...campaignRawResult,
    bundle: {
      ...bundle,
      publisher: {
        ...bundle.publisher!,
        mode: "draft_only" as const,
        canPublish: false as const,
        channels: {
          ...bundle.publisher!.channels,
          facebook: {
            ...bundle.publisher!.channels.facebook,
            status: "publishing" as const,
            publishAttemptId,
            publishAttemptStartedAt: now,
          },
        },
      },
      updatedAt: now,
    },
  };
}

function buildPublishedResult(
  campaignRawResult: Record<string, unknown>,
  bundle: MarketingCampaignBundle,
  postId: string,
  now: string,
) {
  return {
    ...campaignRawResult,
    bundle: {
      ...bundle,
      publisher: {
        ...bundle.publisher!,
        mode: "draft_only" as const,
        canPublish: false as const,
        channels: {
          ...bundle.publisher!.channels,
          facebook: {
            ...bundle.publisher!.channels.facebook,
            status: "published" as const,
            publishAttemptId: undefined,
            publishAttemptStartedAt: undefined,
            publishedAt: now,
            platformPostId: postId,
          },
        },
      },
      updatedAt: now,
    },
  };
}

function buildRollbackResult(
  campaignRawResult: Record<string, unknown>,
  bundle: MarketingCampaignBundle,
  now: string,
) {
  return {
    ...campaignRawResult,
    bundle: {
      ...bundle,
      publisher: {
        ...bundle.publisher!,
        mode: "draft_only" as const,
        canPublish: false as const,
        channels: {
          ...bundle.publisher!.channels,
          facebook: {
            ...bundle.publisher!.channels.facebook,
            publishAttemptId: undefined,
            publishAttemptStartedAt: undefined,
          },
        },
      },
      updatedAt: now,
    },
  };
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

    if (!isPlainObject(campaign.raw_result) || !isPlainObject(campaign.raw_result.bundle)) {
      return NextResponse.json(
        { ok: false, error: "Campaign bundle is missing." },
        { status: 400 },
      );
    }

    const currentBundle = campaign.raw_result.bundle;

    if (
      !isMarketingCampaignBundle(currentBundle) ||
      !currentBundle.approval ||
      !currentBundle.publisher
    ) {
      return NextResponse.json(
        { ok: false, error: "Campaign bundle is invalid." },
        { status: 400 },
      );
    }

    if (currentBundle.approval.status !== "approved") {
      return NextResponse.json(
        { ok: false, error: "Campaign approval is not valid for publishing." },
        { status: 409 },
      );
    }

    const facebookChannel = currentBundle.publisher.channels.facebook;

    if (
      facebookChannel.status === "published" ||
      (typeof facebookChannel.platformPostId === "string" &&
        facebookChannel.platformPostId.trim().length > 0)
    ) {
      return NextResponse.json(
        { ok: false, error: "Facebook post already published." },
        { status: 409 },
      );
    }

    if (
      facebookChannel.status === "publishing" ||
      (typeof facebookChannel.publishAttemptId === "string" &&
        facebookChannel.publishAttemptId.trim().length > 0)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Facebook publish already in progress or requires manual verification.",
        },
        { status: 409 },
      );
    }

    const message = resolveFacebookPublishMessage(currentBundle);

    if (!message.trim()) {
      return NextResponse.json(
        { ok: false, error: "Facebook publish text is empty." },
        { status: 400 },
      );
    }

    const metaConnection = await readMetaConnectionForPublish();

    if (!metaConnection || metaConnection.status !== "connected") {
      return NextResponse.json(
        { ok: false, error: "Meta connection is not available." },
        { status: 409 },
      );
    }

    if (!metaConnection.facebookPageId) {
      return NextResponse.json(
        { ok: false, error: "Facebook page is missing." },
        { status: 409 },
      );
    }

    if (!metaConnection.facebookPageAccessToken) {
      return NextResponse.json(
        { ok: false, error: "Facebook page access token is missing." },
        { status: 409 },
      );
    }

    const envValidation = readMetaOAuthServerEnv();

    if (!envValidation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing Meta OAuth environment variables.",
          missing: envValidation.missing,
        },
        { status: 500 },
      );
    }

    const publishAttemptId = crypto.randomUUID();
    const lockStartedAt = new Date().toISOString();
    const lockedResult = buildLockedResult(
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
        { ok: false, error: "Facebook publish lock could not be acquired." },
        { status: 409 },
      );
    }

    const publishResult = await publishMetaFacebookTextPost(envValidation.config, {
      pageId: metaConnection.facebookPageId,
      pageAccessToken: metaConnection.facebookPageAccessToken,
      message,
    });

    if (!publishResult.ok) {
      const rollbackAt = new Date().toISOString();
      const rollbackResult = buildRollbackResult(
        campaign.raw_result,
        currentBundle,
        rollbackAt,
      );

      const { data: rolledBackCampaign, error: rollbackError } = await requestClient
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
              "Facebook publish failed and the publish lock could not be rolled back automatically.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { ok: false, error: "Facebook publish failed.", reason: publishResult.error },
        { status: 502 },
      );
    }

    const now = new Date().toISOString();
    const nextResult = buildPublishedResult(
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
            "Facebook publish succeeded but the final campaign state could not be persisted.",
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
      facebook: {
        postId: publishResult.postId,
      },
      result: nextResult,
    });
  } catch (error) {
    console.error("[marketing-studio][meta][publish-facebook] failed", error);

    return NextResponse.json(
      { ok: false, error: "Facebook publish route failed." },
      { status: 500 },
    );
  }
}

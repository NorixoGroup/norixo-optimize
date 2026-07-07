import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { isMarketingCampaignBundle } from "@/lib/marketing-ai/bundle/marketingCampaignBundle";
import {
  buildTikTokAwaitingCompletionResult,
  buildTikTokLockedResult,
  buildTikTokRollbackResult,
  evaluateTikTokUploadReadiness,
  fetchTikTokUploadStatus,
  initializeTikTokInboxUpload,
  uploadTikTokVideoFile,
} from "@/lib/marketing-ai/tiktok/tiktokApi";
import { readTikTokConnectionForUpload } from "@/lib/marketing-ai/tiktok/tiktokConnectionStore";
import { readTikTokOAuthServerEnv } from "@/lib/marketing-ai/tiktok/tiktokOAuth";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function downloadFinalVideoBinary(asset: {
  previewUrl?: string | null;
  downloadUrl?: string | null;
}) {
  const sourceUrl =
    typeof asset.downloadUrl === "string" && asset.downloadUrl.trim().length > 0
      ? asset.downloadUrl.trim()
      : typeof asset.previewUrl === "string" && asset.previewUrl.trim().length > 0
        ? asset.previewUrl.trim()
        : null;

  if (!sourceUrl) {
    throw new Error("TikTok final MP4 URL is missing.");
  }

  const response = await fetch(sourceUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TikTok final MP4 download failed with status ${response.status}.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    buffer,
    mimeType: response.headers.get("content-type")?.trim() || "video/mp4",
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
        { ok: false, error: "Campaign must be approved before TikTok upload." },
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

    const readiness = evaluateTikTokUploadReadiness(currentBundle);

    if (!readiness.ok) {
      return NextResponse.json(
        { ok: false, error: readiness.error },
        { status: readiness.status },
      );
    }

    const tikTokConnection = await readTikTokConnectionForUpload();

    if (!tikTokConnection || tikTokConnection.status !== "connected") {
      return NextResponse.json(
        { ok: false, error: "TikTok connection is not available." },
        { status: 409 },
      );
    }

    if (!tikTokConnection.accessToken) {
      return NextResponse.json(
        { ok: false, error: "TikTok access token is missing." },
        { status: 409 },
      );
    }

    const envValidation = readTikTokOAuthServerEnv();

    if (!envValidation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing TikTok OAuth environment variables.",
          missing: envValidation.missing,
        },
        { status: 500 },
      );
    }

    const publishAttemptId = crypto.randomUUID();
    const lockStartedAt = new Date().toISOString();
    const lockedResult = buildTikTokLockedResult(
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
        { ok: false, error: "TikTok upload lock could not be acquired." },
        { status: 409 },
      );
    }

    try {
      const downloadedVideo = await downloadFinalVideoBinary(readiness.asset);
      const initUpload = await initializeTikTokInboxUpload({
        accessToken: tikTokConnection.accessToken,
        videoSize: downloadedVideo.buffer.byteLength,
      });

      if (!initUpload.ok) {
        throw new Error(`TikTok upload init failed: ${initUpload.error}.`);
      }

      await uploadTikTokVideoFile({
        uploadUrl: initUpload.uploadUrl,
        binary: downloadedVideo.buffer,
        mimeType: downloadedVideo.mimeType,
      });

      const statusFetch = await fetchTikTokUploadStatus({
        accessToken: tikTokConnection.accessToken,
        publishId: initUpload.publishId,
      });

      if (!statusFetch.ok) {
        throw new Error(`TikTok status fetch failed: ${statusFetch.error}.`);
      }

      const now = new Date().toISOString();
      const nextResult = buildTikTokAwaitingCompletionResult({
        campaignRawResult: campaign.raw_result,
        bundle: currentBundle,
        publishId: initUpload.publishId,
        uploadStatus: statusFetch.status,
        now,
      });

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
        .select("id, status, raw_result")
        .maybeSingle();

      if (updateError || !updatedCampaign) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "TikTok upload succeeded but the campaign state could not be updated automatically.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          campaign: {
            id: updatedCampaign.id,
            status: updatedCampaign.status,
          },
          tiktok: {
            publishId: initUpload.publishId,
            uploadStatus: statusFetch.status,
          },
          result: updatedCampaign.raw_result,
        },
        { status: 200 },
      );
    } catch (error) {
      const rollbackAt = new Date().toISOString();
      const rollbackResult = buildTikTokRollbackResult(
        campaign.raw_result,
        currentBundle,
        rollbackAt,
      );

      await requestClient
        .from("marketing_campaigns")
        .update({
          status: "approved",
          raw_result: rollbackResult,
          updated_at: rollbackAt,
        })
        .eq("id", campaign.id)
        .eq("workspace_id", member.workspace_id)
        .eq("updated_at", lockStartedAt);

      return NextResponse.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "TikTok upload failed.",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("[marketing-studio][tiktok][upload-video] failed", error);

    return NextResponse.json(
      { ok: false, error: "TikTok upload route failed." },
      { status: 500 },
    );
  }
}

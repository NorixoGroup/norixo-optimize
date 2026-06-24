import type { MarketingCampaignBundle } from "../bundle/marketingCampaignBundle";
import type {
  MetaPreviewAsset,
  MetaPlatformPreview,
  MetaPreviewModel,
} from "./metaPreviewModel";

const PREVIEW_PLATFORMS = ["facebook", "instagram", "linkedin"] as const;

function resolveApprovalStatus(
  status: MarketingCampaignBundle["approval"] extends infer Approval
    ? Approval extends { status?: infer Status }
      ? Status | undefined
      : undefined
    : undefined,
): MetaPreviewModel["approvalStatus"] {
  return status === "approved" || status === "rejected" ? status : "pending_review";
}

function resolvePreviewAsset(
  platform: string,
  bundle: NonNullable<MarketingCampaignBundle["publisher"]>["channels"]["facebook"],
): MetaPreviewAsset {
  const preferredAsset =
    platform === "instagram"
      ? bundle.assetReferences?.reel ??
        bundle.assetReferences?.video ??
        bundle.assetReferences?.image
      : bundle.assetReferences?.image ??
        bundle.assetReferences?.video ??
        bundle.assetReferences?.reel;

  if (!preferredAsset) {
    return {
      kind: platform === "instagram" ? "reel" : "text_only",
      prompt: bundle.videoPrompt || bundle.assetPrompt || undefined,
      warnings: [],
    };
  }

  return {
    kind: preferredAsset.kind,
    assetUrl: preferredAsset.publicUrl,
    thumbnailUrl: preferredAsset.thumbnailUrl,
    altText: undefined,
    prompt: preferredAsset.prompt,
    warnings: preferredAsset.status === "missing" ? ["Asset missing."] : [],
  };
}

export function buildMetaPreviewModel(
  bundle: MarketingCampaignBundle,
): MetaPreviewModel {
  const previews: MetaPlatformPreview[] = [];

  for (const platform of PREVIEW_PLATFORMS) {
    const channel = bundle.publisher?.channels[platform];

    if (!channel) {
      continue;
    }

    const publisherOutput = channel.publisherOutput;

    previews.push({
      platform,
      status: "ready_for_review",
      title: publisherOutput?.finalTitle ?? channel.platform,
      caption: publisherOutput?.finalCaption ?? channel.caption,
      cta: publisherOutput?.finalCta ?? "",
      hashtags: publisherOutput?.finalHashtags ?? channel.hashtags,
      asset: resolvePreviewAsset(platform, channel),
      platformNotes: publisherOutput?.platformNotes ?? [],
      manualPublishChecklist: publisherOutput?.manualPublishChecklist ?? [],
      warnings: publisherOutput?.warnings ?? [],
      approvalRequired: true,
      publishAction: "manual_review_required",
    });
  }

  return {
    mode: "preview_only",
    canPublish: false,
    requiresApproval: true,
    previews,
    approvalStatus: resolveApprovalStatus(bundle.approval?.status),
    updatedAt: bundle.review?.updatedAt ?? new Date().toISOString(),
  };
}

import type { MarketingCampaignBundle } from "../bundle/marketingCampaignBundle";
import type { MediaAsset } from "../media";
import type {
  MetaPreviewAsset,
  MetaPlatformPreview,
  MetaPreviewModel,
} from "./metaPreviewModel";

const PREVIEW_PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok"] as const;

function resolveApprovalStatus(
  status: MarketingCampaignBundle["approval"] extends infer Approval
    ? Approval extends { status?: infer Status }
      ? Status | undefined
      : undefined
    : undefined,
): MetaPreviewModel["approvalStatus"] {
  return status === "approved" || status === "rejected" ? status : "pending_review";
}

function mapMediaAssetKindToPreviewKind(
  kind: MediaAsset["kind"],
): MetaPreviewAsset["kind"] {
  switch (kind) {
    case "video":
      return "video";
    case "reel":
      return "reel";
    case "carousel":
      return "carousel";
    case "story":
    case "thumbnail":
    case "cover":
    case "image":
    default:
      return "image";
  }
}

function findFirstMatchingMediaAsset(
  assets: MediaAsset[],
  criteria: Array<{
    platform: MediaAsset["platform"];
    kind?: MediaAsset["kind"] | MediaAsset["kind"][];
  }>,
): MediaAsset | null {
  for (const rule of criteria) {
    const kinds = Array.isArray(rule.kind)
      ? rule.kind
      : rule.kind
        ? [rule.kind]
        : null;
    const match =
      assets.find(
        (asset) =>
          asset.platform === rule.platform &&
          (kinds === null || kinds.includes(asset.kind)),
      ) ?? null;

    if (match) {
      return match;
    }
  }

  return null;
}

function findMediaAssetForPlatform(
  platform: MetaPlatformPreview["platform"],
  assets: MediaAsset[],
): MediaAsset | null {
  if (platform === "facebook") {
    return findFirstMatchingMediaAsset(assets, [
      { platform: "facebook", kind: "image" },
      { platform: "generic", kind: "image" },
    ]);
  }

  if (platform === "instagram") {
    return findFirstMatchingMediaAsset(assets, [
      { platform: "instagram", kind: "reel" },
      { platform: "instagram", kind: "video" },
      { platform: "instagram", kind: "image" },
    ]);
  }

  if (platform === "tiktok") {
    return findFirstMatchingMediaAsset(assets, [
      { platform: "tiktok", kind: "reel" },
      { platform: "tiktok", kind: "video" },
      { platform: "instagram", kind: "reel" },
      { platform: "instagram", kind: "video" },
    ]);
  }

  return findFirstMatchingMediaAsset(assets, [
    { platform: "linkedin", kind: "cover" },
    { platform: "linkedin", kind: "image" },
    { platform: "generic", kind: "image" },
  ]);
}

function buildPreviewAssetFromMediaAsset(asset: MediaAsset): MetaPreviewAsset {
  return {
    kind: mapMediaAssetKindToPreviewKind(asset.kind),
    assetUrl: asset.downloadUrl ?? asset.previewUrl ?? undefined,
    thumbnailUrl: asset.thumbnailUrl ?? undefined,
    altText: undefined,
    prompt: asset.prompt,
    warnings:
      asset.warnings && asset.warnings.length > 0
        ? asset.warnings
        : asset.status === "missing"
          ? ["Media asset has not been generated yet."]
          : [],
  };
}

function buildLegacyPreviewAsset(
  platform: MetaPlatformPreview["platform"],
  channel: NonNullable<MarketingCampaignBundle["publisher"]>["channels"]["facebook"],
): MetaPreviewAsset {
  const preferredAsset =
    platform === "instagram" || platform === "tiktok"
      ? channel.assetReferences?.reel ??
        channel.assetReferences?.video ??
        channel.assetReferences?.image
      : channel.assetReferences?.image ??
        channel.assetReferences?.video ??
        channel.assetReferences?.reel;

  if (!preferredAsset) {
    return {
      kind: platform === "instagram" ? "reel" : "text_only",
      prompt: channel.videoPrompt || channel.assetPrompt || undefined,
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

function buildPreviewAsset(
  bundle: MarketingCampaignBundle,
  platform: MetaPlatformPreview["platform"],
  channel: NonNullable<MarketingCampaignBundle["publisher"]>["channels"]["facebook"],
): MetaPreviewAsset {
  const mediaAsset = findMediaAssetForPlatform(platform, bundle.media?.assets ?? []);

  if (mediaAsset) {
    return buildPreviewAssetFromMediaAsset(mediaAsset);
  }

  return buildLegacyPreviewAsset(platform, channel);
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
      status: channel.status,
      title: publisherOutput?.finalTitle ?? channel.platform,
      caption: publisherOutput?.finalCaption ?? channel.caption,
      cta: publisherOutput?.finalCta ?? "",
      hashtags: publisherOutput?.finalHashtags ?? channel.hashtags,
      asset: buildPreviewAsset(bundle, platform, channel),
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

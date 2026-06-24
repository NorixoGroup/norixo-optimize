import type { MarketingCampaign } from "../campaigns/campaignModel";
import type { MarketingCampaignMemory } from "../campaigns/campaignMemory";
import {
  isMarketingCommunity,
  type MarketingCommunity,
} from "../community/communityModel";
import type {
  PlannerOutput,
  PublisherOutput,
  SocialOutput,
  VideoScene,
} from "../contracts/agentContracts";
import type { MediaAsset } from "../media";
import type { MediaAssetRequest } from "../media/mediaAssetRequest";
import type { PublisherAssetReferences } from "../publication/assetReferences";
import {
  isMarketingLocalization,
  type MarketingLocalization,
} from "../localization/localizationModel";

export type MarketingCampaignBundleCreative = {
  creativeConcept: string;
  visualStyle: string;
  layout: string;
  overlays: string[];
  imagePrompt: string;
  negativePrompt: string;
  videoPrompt: string;
  brandChecklist: string[];
};

export type MarketingCampaignBundleVideo = {
  storyboard: string;
  script: string;
  timeline: string;
  scenes: VideoScene[];
  voice: string;
  transitions: string[];
  captions: string;
  videoPrompt: string;
};

export type MarketingCampaignBundleLocalization = Record<
  string,
  MarketingLocalization
>;

export type MarketingCampaignBundleCommunityDiscovery = {
  communities: MarketingCommunity[];
  warnings: string[];
};

export type MarketingCampaignBundleReview = {
  status: "draft" | "ready_for_review" | "approved" | "rejected";
  approvalRequired: true;
  summary: string;
  notes: string[];
  updatedAt: string;
};

export type MarketingCampaignBundleApproval = {
  status: "pending_review" | "approved" | "rejected";
  requiredApprover: string;
  requiresHumanValidation: true;
  approvedAt: string | null;
  approvedBy: string | null;
  publisherReady: boolean;
  notes: string[];
};

export type MarketingCampaignBundlePublisherLocalizedVariant = {
  title: string;
  caption: string;
  cta: string;
  hashtags: string[];
};

export type MarketingCampaignBundlePublisherChannelDraft = {
  platform: "facebook" | "instagram" | "linkedin";
  status: "draft" | "ready_for_review";
  copy: string;
  caption: string;
  hashtags: string[];
  assetPrompt: string;
  videoPrompt: string;
  assetReferences?: PublisherAssetReferences;
  localizedVariants: Record<string, MarketingCampaignBundlePublisherLocalizedVariant>;
  publisherOutput?: PublisherOutput;
  approvalRequired: true;
  publishAction: "manual_review_required";
};

export type MarketingCampaignBundlePublisher = {
  mode: "draft_only";
  canPublish: false;
  requiresApproval: true;
  channels: {
    facebook: MarketingCampaignBundlePublisherChannelDraft;
    instagram: MarketingCampaignBundlePublisherChannelDraft;
    linkedin: MarketingCampaignBundlePublisherChannelDraft;
  };
};

export type MarketingCampaignBundleMedia = {
  requests: MediaAssetRequest[];
  assets: MediaAsset[];
};

export type CreateMarketingCampaignBundleInput = {
  id?: string;
  campaign: MarketingCampaign;
  campaignMemory?: MarketingCampaignMemory;
  planning?: PlannerOutput;
  social?: SocialOutput;
  creative?: MarketingCampaignBundleCreative;
  video?: MarketingCampaignBundleVideo;
  localization?: MarketingCampaignBundleLocalization;
  communityDiscovery?: MarketingCampaignBundleCommunityDiscovery;
  review?: MarketingCampaignBundleReview;
  approval?: MarketingCampaignBundleApproval;
  publisher?: MarketingCampaignBundlePublisher;
  media?: MarketingCampaignBundleMedia;
  notes?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type MarketingCampaignBundle = {
  id: string;
  campaign: MarketingCampaign;
  campaignMemory?: MarketingCampaignMemory;
  planning?: PlannerOutput;
  social?: SocialOutput;
  creative?: MarketingCampaignBundleCreative;
  video?: MarketingCampaignBundleVideo;
  localization?: MarketingCampaignBundleLocalization;
  communityDiscovery?: MarketingCampaignBundleCommunityDiscovery;
  review?: MarketingCampaignBundleReview;
  approval?: MarketingCampaignBundleApproval;
  publisher?: MarketingCampaignBundlePublisher;
  media?: MarketingCampaignBundleMedia;
  notes: string[];
  approvalRequired: true;
  createdAt: string;
  updatedAt: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isBundleCreative(value: unknown): value is MarketingCampaignBundleCreative {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.creativeConcept === "string" &&
    typeof value.visualStyle === "string" &&
    typeof value.layout === "string" &&
    typeof value.imagePrompt === "string" &&
    typeof value.negativePrompt === "string" &&
    typeof value.videoPrompt === "string" &&
    isStringArray(value.overlays) &&
    isStringArray(value.brandChecklist)
  );
}

function isVideoScene(value: unknown): value is VideoScene {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.scene === "number" &&
    typeof value.duration === "string" &&
    typeof value.visual === "string" &&
    typeof value.onScreenText === "string" &&
    typeof value.voiceOver === "string" &&
    typeof value.transition === "string"
  );
}

function isBundleVideo(value: unknown): value is MarketingCampaignBundleVideo {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.storyboard === "string" &&
    typeof value.script === "string" &&
    typeof value.timeline === "string" &&
    Array.isArray(value.scenes) &&
    value.scenes.every(isVideoScene) &&
    typeof value.voice === "string" &&
    isStringArray(value.transitions) &&
    typeof value.captions === "string" &&
    typeof value.videoPrompt === "string"
  );
}

function isBundleLocalization(
  value: unknown,
): value is MarketingCampaignBundleLocalization {
  if (!isPlainObject(value)) {
    return false;
  }

  return Object.values(value).every(isMarketingLocalization);
}

function isBundleCommunityDiscovery(
  value: unknown,
): value is MarketingCampaignBundleCommunityDiscovery {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    Array.isArray(value.communities) &&
    value.communities.every(isMarketingCommunity) &&
    isStringArray(value.warnings)
  );
}

function isBundleReview(value: unknown): value is MarketingCampaignBundleReview {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    (value.status === "draft" ||
      value.status === "ready_for_review" ||
      value.status === "approved" ||
      value.status === "rejected") &&
    value.approvalRequired === true &&
    typeof value.summary === "string" &&
    isStringArray(value.notes) &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

function isBundleApproval(value: unknown): value is MarketingCampaignBundleApproval {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    (value.status === "pending_review" ||
      value.status === "approved" ||
      value.status === "rejected") &&
    typeof value.requiredApprover === "string" &&
    value.requiresHumanValidation === true &&
    (value.approvedAt === null ||
      (typeof value.approvedAt === "string" &&
        normalizeDateString(value.approvedAt) !== null)) &&
    (value.approvedBy === null || typeof value.approvedBy === "string") &&
    typeof value.publisherReady === "boolean" &&
    isStringArray(value.notes)
  );
}

function isBundlePublisherLocalizedVariant(
  value: unknown,
): value is MarketingCampaignBundlePublisherLocalizedVariant {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.title === "string" &&
    typeof value.caption === "string" &&
    typeof value.cta === "string" &&
    isStringArray(value.hashtags)
  );
}

function isAssetReference(value: unknown): value is NonNullable<PublisherAssetReferences[keyof PublisherAssetReferences]> {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    (value.kind === "image" ||
      value.kind === "video" ||
      value.kind === "reel" ||
      value.kind === "carousel") &&
    (value.status === "missing" ||
      value.status === "generated" ||
      value.status === "uploaded") &&
    (value.prompt === undefined || typeof value.prompt === "string") &&
    (value.localPath === undefined || typeof value.localPath === "string") &&
    (value.publicUrl === undefined || typeof value.publicUrl === "string") &&
    (value.thumbnailUrl === undefined || typeof value.thumbnailUrl === "string")
  );
}

function isPublisherAssetReferences(
  value: unknown,
): value is PublisherAssetReferences {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    (value.image === undefined || isAssetReference(value.image)) &&
    (value.video === undefined || isAssetReference(value.video)) &&
    (value.reel === undefined || isAssetReference(value.reel))
  );
}

function isBundlePublisherChannelDraft(
  value: unknown,
): value is MarketingCampaignBundlePublisherChannelDraft {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    (value.platform === "facebook" ||
      value.platform === "instagram" ||
      value.platform === "linkedin") &&
    (value.status === "draft" || value.status === "ready_for_review") &&
    typeof value.copy === "string" &&
    typeof value.caption === "string" &&
    isStringArray(value.hashtags) &&
    typeof value.assetPrompt === "string" &&
    typeof value.videoPrompt === "string" &&
    (value.assetReferences === undefined ||
      isPublisherAssetReferences(value.assetReferences)) &&
    isPlainObject(value.localizedVariants) &&
    Object.values(value.localizedVariants).every(isBundlePublisherLocalizedVariant) &&
    (value.publisherOutput === undefined || isBundlePublisherOutput(value.publisherOutput)) &&
    value.approvalRequired === true &&
    value.publishAction === "manual_review_required"
  );
}

function isBundlePublisherOutput(value: unknown): value is PublisherOutput {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.finalTitle === "string" &&
    typeof value.finalCaption === "string" &&
    typeof value.finalCta === "string" &&
    isStringArray(value.finalHashtags) &&
    isStringArray(value.platformNotes) &&
    isStringArray(value.manualPublishChecklist) &&
    isStringArray(value.warnings) &&
    value.approvalRequired === true
  );
}

function isBundlePublisher(value: unknown): value is MarketingCampaignBundlePublisher {
  if (!isPlainObject(value) || !isPlainObject(value.channels)) {
    return false;
  }

  return (
    value.mode === "draft_only" &&
    value.canPublish === false &&
    value.requiresApproval === true &&
    isBundlePublisherChannelDraft(value.channels.facebook) &&
    isBundlePublisherChannelDraft(value.channels.instagram) &&
    isBundlePublisherChannelDraft(value.channels.linkedin)
  );
}

function isBundleMediaAssetRequest(value: unknown): value is MediaAssetRequest {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    (value.kind === "image" ||
      value.kind === "video" ||
      value.kind === "reel" ||
      value.kind === "story" ||
      value.kind === "carousel" ||
      value.kind === "thumbnail" ||
      value.kind === "cover") &&
    (value.platform === "facebook" ||
      value.platform === "instagram" ||
      value.platform === "linkedin" ||
      value.platform === "generic") &&
    (value.ratio === "1:1" ||
      value.ratio === "4:5" ||
      value.ratio === "9:16" ||
      value.ratio === "16:9") &&
    typeof value.targetLanguage === "string" &&
    typeof value.title === "string" &&
    typeof value.creativeBrief === "string" &&
    typeof value.prompt === "string" &&
    (value.negativePrompt === undefined || typeof value.negativePrompt === "string") &&
    (value.expectedDurationSeconds === undefined ||
      typeof value.expectedDurationSeconds === "number") &&
    typeof value.required === "boolean"
  );
}

function isBundleMediaAsset(value: unknown): value is MediaAsset {
  if (!isPlainObject(value)) {
    return false;
  }

  const metadata = value.metadata;

  return (
    typeof value.id === "string" &&
    (value.kind === "image" ||
      value.kind === "video" ||
      value.kind === "reel" ||
      value.kind === "story" ||
      value.kind === "carousel" ||
      value.kind === "thumbnail" ||
      value.kind === "cover") &&
    (value.status === "missing" ||
      value.status === "queued" ||
      value.status === "generating" ||
      value.status === "generated" ||
      value.status === "approved" ||
      value.status === "rejected" ||
      value.status === "downloaded" ||
      value.status === "published" ||
      value.status === "failed") &&
    (value.platform === "facebook" ||
      value.platform === "instagram" ||
      value.platform === "linkedin" ||
      value.platform === "generic") &&
    (value.ratio === "1:1" ||
      value.ratio === "4:5" ||
      value.ratio === "9:16" ||
      value.ratio === "16:9") &&
    (value.format === undefined ||
      value.format === "png" ||
      value.format === "jpg" ||
      value.format === "webp" ||
      value.format === "mp4" ||
      value.format === "mov" ||
      value.format === "gif") &&
    (value.language === undefined || typeof value.language === "string") &&
    (value.variant === undefined || typeof value.variant === "string") &&
    (value.title === undefined || typeof value.title === "string") &&
    (value.description === undefined || typeof value.description === "string") &&
    (value.prompt === undefined || typeof value.prompt === "string") &&
    (value.negativePrompt === undefined || typeof value.negativePrompt === "string") &&
    (value.previewUrl === undefined || value.previewUrl === null || typeof value.previewUrl === "string") &&
    (value.downloadUrl === undefined || value.downloadUrl === null || typeof value.downloadUrl === "string") &&
    (value.thumbnailUrl === undefined || value.thumbnailUrl === null || typeof value.thumbnailUrl === "string") &&
    (value.generationProvider === undefined ||
      value.generationProvider === null ||
      typeof value.generationProvider === "string") &&
    (value.providerJobId === undefined ||
      value.providerJobId === null ||
      typeof value.providerJobId === "string") &&
    (metadata === undefined || isPlainObject(metadata)) &&
    (value.warnings === undefined || isStringArray(value.warnings)) &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

function isBundleMedia(value: unknown): value is MarketingCampaignBundleMedia {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    Array.isArray(value.requests) &&
    value.requests.every(isBundleMediaAssetRequest) &&
    Array.isArray(value.assets) &&
    value.assets.every(isBundleMediaAsset)
  );
}

function normalizeDateString(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function isMarketingCampaignLike(value: unknown): value is MarketingCampaign {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.objective === "string" &&
    typeof value.audience === "string" &&
    typeof value.tone === "string" &&
    typeof value.cta === "string" &&
    typeof value.websiteUrl === "string" &&
    typeof value.language === "string" &&
    Array.isArray(value.platforms) &&
    Array.isArray(value.formats) &&
    typeof value.durationDays === "number" &&
    Array.isArray(value.hashtags) &&
    typeof value.status === "string" &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

function isOptionalObject(value: unknown) {
  return value === undefined || isPlainObject(value);
}

export function isMarketingCampaignBundle(
  value: unknown,
): value is MarketingCampaignBundle {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isMarketingCampaignLike(value.campaign) &&
    isOptionalObject(value.campaignMemory) &&
    isOptionalObject(value.planning) &&
    isOptionalObject(value.social) &&
    (value.creative === undefined || isBundleCreative(value.creative)) &&
    (value.video === undefined || isBundleVideo(value.video)) &&
    (value.localization === undefined ||
      isBundleLocalization(value.localization)) &&
    (value.communityDiscovery === undefined ||
      isBundleCommunityDiscovery(value.communityDiscovery)) &&
    (value.review === undefined || isBundleReview(value.review)) &&
    (value.approval === undefined || isBundleApproval(value.approval)) &&
    (value.publisher === undefined || isBundlePublisher(value.publisher)) &&
    (value.media === undefined || isBundleMedia(value.media)) &&
    isStringArray(value.notes) &&
    value.approvalRequired === true &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function createMarketingCampaignBundle(
  input: CreateMarketingCampaignBundleInput,
): MarketingCampaignBundle {
  const createdAt = normalizeDateString(input.createdAt ?? "") ?? new Date().toISOString();
  const updatedAt = normalizeDateString(input.updatedAt ?? createdAt) ?? createdAt;

  return {
    id: input.id?.trim() || `marketing-campaign-bundle-${createdAt}`,
    campaign: input.campaign,
    campaignMemory: input.campaignMemory,
    planning: input.planning,
    social: input.social,
    creative: input.creative,
    video: input.video,
    localization: input.localization,
    communityDiscovery: input.communityDiscovery,
    review: input.review,
    approval: input.approval,
    publisher: input.publisher,
    media: input.media,
    notes: isStringArray(input.notes) ? input.notes : [],
    approvalRequired: true,
    createdAt,
    updatedAt,
  };
}

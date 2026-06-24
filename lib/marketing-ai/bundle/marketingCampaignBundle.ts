import type { MarketingCampaign } from "../campaigns/campaignModel";
import type { MarketingCampaignMemory } from "../campaigns/campaignMemory";
import type { CommunityWorkspace } from "../community/communityWorkspace";
import type {
  PlannerOutput,
  SocialOutput,
  VideoScene,
} from "../contracts/agentContracts";
import type { LocalizationWorkspace } from "../localization/localizationWorkspace";
import type { PublicationWorkspace } from "../publication/publicationWorkspace";

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

export type CreateMarketingCampaignBundleInput = {
  id?: string;
  campaign: MarketingCampaign;
  campaignMemory?: MarketingCampaignMemory;
  planning?: PlannerOutput;
  social?: SocialOutput;
  creative?: MarketingCampaignBundleCreative;
  video?: MarketingCampaignBundleVideo;
  publicationWorkspace?: PublicationWorkspace;
  communityWorkspace?: CommunityWorkspace;
  localizationWorkspace?: LocalizationWorkspace;
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
  publicationWorkspace?: PublicationWorkspace;
  communityWorkspace?: CommunityWorkspace;
  localizationWorkspace?: LocalizationWorkspace;
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
    isOptionalObject(value.publicationWorkspace) &&
    isOptionalObject(value.communityWorkspace) &&
    isOptionalObject(value.localizationWorkspace) &&
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
    publicationWorkspace: input.publicationWorkspace,
    communityWorkspace: input.communityWorkspace,
    localizationWorkspace: input.localizationWorkspace,
    notes: isStringArray(input.notes) ? input.notes : [],
    approvalRequired: true,
    createdAt,
    updatedAt,
  };
}

import type { MarketingCampaign } from "../campaigns/campaignModel";
import type {
  CreativeOutput,
  SocialOutput,
  VideoOutput,
} from "../contracts/agentContracts";
import type { MarketingQualityGateResult } from "../quality/qualityGate";
import {
  createPublicationPack,
  normalizePublicationPackPlatform,
  type PublicationPackPlatform,
  type PublicationPack,
} from "./publicationPack";

export type PublicationPackBuilderInput = {
  campaign: MarketingCampaign;
  social: SocialOutput;
  creative: CreativeOutput;
  video: VideoOutput;
  quality?: MarketingQualityGateResult;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolvePublicationPlatform(
  campaign: MarketingCampaign,
  social: SocialOutput,
): PublicationPackPlatform {
  const socialPlatform = normalizePublicationPackPlatform(social.targetPlatform);

  if (socialPlatform) {
    return socialPlatform;
  }

  for (const platform of campaign.platforms) {
    const normalizedPlatform = normalizePublicationPackPlatform(platform);

    if (normalizedPlatform) {
      return normalizedPlatform;
    }
  }

  return "instagram";
}

function extractQualitySummary(
  quality: MarketingQualityGateResult | undefined,
): string | undefined {
  return normalizeOptionalString((quality as { summary?: string } | undefined)?.summary);
}

export function isPublicationPackBuilderInput(
  value: unknown,
): value is PublicationPackBuilderInput {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isPlainObject(value.campaign) &&
    typeof value.campaign.id === "string" &&
    typeof value.campaign.language === "string" &&
    Array.isArray(value.campaign.platforms) &&
    Array.isArray(value.campaign.formats) &&
    isPlainObject(value.social) &&
    typeof value.social.title === "string" &&
    typeof value.social.caption === "string" &&
    typeof value.social.cta === "string" &&
    typeof value.social.targetPlatform === "string" &&
    isOptionalString(value.social.hook) &&
    isStringArray(value.social.hashtags) &&
    isPlainObject(value.creative) &&
    isOptionalString(value.creative.creativeConcept) &&
    isOptionalString(value.creative.gptImagePrompt) &&
    isPlainObject(value.video) &&
    (value.video.videoTitle === undefined || typeof value.video.videoTitle === "string") &&
    (value.quality === undefined || isPlainObject(value.quality))
  );
}

export function buildPublicationPack(
  input: PublicationPackBuilderInput,
): PublicationPack {
  const now = new Date().toISOString();

  return createPublicationPack({
    campaignId: input.campaign.id,
    platform: resolvePublicationPlatform(input.campaign, input.social),
    format: input.campaign.formats[0],
    language: input.campaign.language,
    status: "draft",
    title: input.social.title,
    hook: normalizeOptionalString(input.social.hook),
    caption: input.social.caption,
    cta: input.social.cta,
    hashtags: input.social.hashtags,
    visualBrief: normalizeOptionalString(input.creative.creativeConcept),
    imagePrompt: normalizeOptionalString(input.creative.gptImagePrompt),
    videoPrompt: undefined,
    assetReferences: input.creative.gptImagePrompt
      ? {
          image: {
            id: "hero-image",
            kind: "image",
            status: "missing",
            prompt: normalizeOptionalString(input.creative.gptImagePrompt),
          },
        }
      : undefined,
    approvalRequired: true,
    qualitySummary: extractQualitySummary(input.quality),
    createdAt: now,
    updatedAt: now,
  });
}

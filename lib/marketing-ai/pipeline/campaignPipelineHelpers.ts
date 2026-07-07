import type { MarketingCampaignPlatform } from "../campaigns/campaignModel";

export function resolveCampaignDurationDays(timeframe: string): number {
  const normalizedTimeframe = timeframe.trim().toLowerCase();

  if (normalizedTimeframe === "7 jours") {
    return 7;
  }

  if (normalizedTimeframe === "14 jours") {
    return 14;
  }

  if (normalizedTimeframe === "30 jours") {
    return 30;
  }

  return 7;
}

export function resolveCampaignPlatforms(
  channels: string[],
): MarketingCampaignPlatform[] {
  const platforms = channels
    .map((channel) => channel.trim().toLowerCase())
    .flatMap((channel): MarketingCampaignPlatform[] => {
      if (channel === "instagram") {
        return ["instagram"];
      }

      if (channel === "facebook") {
        return ["facebook"];
      }

      if (channel === "linkedin") {
        return ["linkedin"];
      }

      if (channel === "tiktok") {
        return ["tiktok"];
      }

      return [];
    });

  return platforms.length ? Array.from(new Set(platforms)) : ["instagram"];
}

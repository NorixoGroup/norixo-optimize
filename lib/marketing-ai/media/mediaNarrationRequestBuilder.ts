import type { MarketingCampaignBundle } from "../bundle/marketingCampaignBundle";
import type { MediaAsset } from "./mediaAsset";
import type { MediaNarrationRequest } from "./mediaNarrationRequest";

function nonEmpty(value: string | undefined | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function pickFirstNonEmpty(
  ...values: Array<string | undefined | null>
): string | null {
  for (const value of values) {
    const normalized = nonEmpty(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function buildNarrationTextFromScenes(
  bundle: MarketingCampaignBundle,
): string | null {
  const sceneVoiceOvers =
    bundle.video?.scenes
      ?.map((scene) => nonEmpty(scene.voiceOver))
      .filter((value): value is string => value !== null) ?? [];

  return sceneVoiceOvers.length > 0 ? sceneVoiceOvers.join(" ") : null;
}

export function resolveNarrationTextFromBundle(
  bundle: MarketingCampaignBundle,
): string | null {
  return pickFirstNonEmpty(
    bundle.video?.script,
    buildNarrationTextFromScenes(bundle),
    bundle.campaign.objective,
    bundle.campaign.name,
  );
}

export function buildNarrationRequestFromBundle(input: {
  bundle: MarketingCampaignBundle;
  videoAsset: MediaAsset;
}): MediaNarrationRequest | null {
  const text = resolveNarrationTextFromBundle(input.bundle);

  if (!text) {
    return null;
  }

  return {
    id: `${input.videoAsset.id}-narration`,
    campaignId: input.bundle.campaign.id,
    text,
    language: input.bundle.campaign.language?.trim() || "fr",
    purpose: "video_voiceover",
    relatedVideoAssetId: input.videoAsset.id,
  };
}

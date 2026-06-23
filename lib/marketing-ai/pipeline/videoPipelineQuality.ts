import {
  addCampaignGeneratedVariant,
  addCampaignMemoryWarning,
  type MarketingCampaignMemory,
} from "../campaigns/campaignMemory";
import type { MarketingCampaignFormat } from "../campaigns/campaignModel";
import type { VideoOutput } from "../contracts/agentContracts";
import {
  addQualityImprovement,
  addQualityIssue,
  addQualityWarning,
  type MarketingQualityGateResult,
} from "../quality/qualityGate";

function resolveMemoryFormat(
  value: string | null | undefined,
): MarketingCampaignFormat | null {
  const normalizedValue = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (
    normalizedValue === "post" ||
    normalizedValue === "carousel" ||
    normalizedValue === "reel" ||
    normalizedValue === "story" ||
    normalizedValue === "short_video"
  ) {
    return normalizedValue;
  }

  return null;
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

export function applyVideoPipelineQuality(input: {
  videoOutput: VideoOutput | null;
  campaignMemory: MarketingCampaignMemory;
  qualityGate: MarketingQualityGateResult;
}): {
  campaignMemory: MarketingCampaignMemory;
  qualityGate: MarketingQualityGateResult;
} {
  let { videoOutput, campaignMemory, qualityGate } = input;

  if (videoOutput) {
    const resolvedVideoFormat = resolveMemoryFormat(videoOutput.format);

    campaignMemory = addCampaignGeneratedVariant(campaignMemory, {
      id: `video-${new Date().toISOString()}`,
      source: "video",
      format: resolvedVideoFormat ?? undefined,
      topic: videoOutput.videoTitle || videoOutput.hook,
      contentRef: videoOutput.hook,
      createdAt: new Date().toISOString(),
    });

    if (videoOutput.scenes.length === 0) {
      qualityGate = addQualityIssue(qualityGate, {
        type: "clarity",
        severity: "error",
        message: "Video output contains no scenes.",
        scoreImpact: 20,
      });
    }

    if (isBlank(videoOutput.videoTitle)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Video output contains an empty title.",
      });
    }

    if (isBlank(videoOutput.hook)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Video output contains an empty hook.",
      });
    }

    if (isBlank(videoOutput.cta)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "cta",
        message: "Video output contains an empty CTA.",
      });
    }

    if (isBlank(videoOutput.caption)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Video output contains an empty caption.",
      });
    }

    if (
      videoOutput.scenes.some(
        (scene) =>
          isBlank(scene.visual) ||
          isBlank(scene.onScreenText) ||
          isBlank(scene.voiceOver),
      )
    ) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Video output contains incomplete scene details.",
      });
    }

    if (videoOutput.assetChecklist.length === 0) {
      qualityGate = addQualityImprovement(qualityGate, {
        type: "compliance",
        message: "Video output could include an asset checklist.",
      });
    }
  } else {
    campaignMemory = addCampaignMemoryWarning(campaignMemory, {
      code: "video_output_unparsed",
      message: "Video output could not be parsed.",
      severity: "warning",
      createdAt: new Date().toISOString(),
    });
    qualityGate = addQualityIssue(qualityGate, {
      type: "clarity",
      severity: "error",
      message: "Video output could not be parsed.",
      scoreImpact: 20,
    });
  }

  return { campaignMemory, qualityGate };
}

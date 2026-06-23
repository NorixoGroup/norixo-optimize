import {
  addCampaignGeneratedVariant,
  addCampaignMemoryWarning,
  type MarketingCampaignMemory,
} from "../campaigns/campaignMemory";
import type { MarketingCampaignPlatform } from "../campaigns/campaignModel";
import type { SocialOutput } from "../contracts/agentContracts";
import {
  addQualityImprovement,
  addQualityIssue,
  addQualityWarning,
  type MarketingQualityGateResult,
} from "../quality/qualityGate";

function resolveMemoryPlatform(
  value: string | null | undefined,
): MarketingCampaignPlatform | null {
  const normalizedValue = value?.trim().toLowerCase();

  if (
    normalizedValue === "instagram" ||
    normalizedValue === "facebook" ||
    normalizedValue === "linkedin"
  ) {
    return normalizedValue;
  }

  return null;
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

export function applySocialPipelineQuality(input: {
  socialOutput: SocialOutput | null;
  campaignMemory: MarketingCampaignMemory;
  qualityGate: MarketingQualityGateResult;
}): {
  campaignMemory: MarketingCampaignMemory;
  qualityGate: MarketingQualityGateResult;
} {
  let { socialOutput, campaignMemory, qualityGate } = input;

  if (socialOutput) {
    const socialPlatform = resolveMemoryPlatform(socialOutput.targetPlatform);

    campaignMemory = addCampaignGeneratedVariant(campaignMemory, {
      id: `social-${new Date().toISOString()}`,
      source: "social",
      platform: socialPlatform ?? undefined,
      topic: socialOutput.title,
      contentRef: socialOutput.hook,
      createdAt: new Date().toISOString(),
    });

    if (isBlank(socialOutput.caption)) {
      qualityGate = addQualityIssue(qualityGate, {
        type: "clarity",
        severity: "error",
        message: "Social output contains an empty caption.",
        scoreImpact: 20,
      });
    }

    if (isBlank(socialOutput.hook)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Social output contains an empty hook.",
      });
    }

    if (isBlank(socialOutput.cta)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "cta",
        message: "Social output contains an empty CTA.",
      });
    }

    if (socialOutput.hashtags.length === 0) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "platform_fit",
        message: "Social output contains no hashtags.",
      });
    }

    if (isBlank(socialOutput.imagePrompt)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Social output contains an empty image prompt.",
      });
    }

    if (isBlank(socialOutput.videoPrompt)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Social output contains an empty video prompt.",
      });
    }

    if (socialOutput.approvalChecklist.length === 0) {
      qualityGate = addQualityImprovement(qualityGate, {
        type: "compliance",
        message: "Social output could include an approval checklist.",
      });
    }
  } else {
    campaignMemory = addCampaignMemoryWarning(campaignMemory, {
      code: "social_output_unparsed",
      message: "Social output could not be parsed.",
      severity: "warning",
      createdAt: new Date().toISOString(),
    });
    qualityGate = addQualityIssue(qualityGate, {
      type: "clarity",
      severity: "error",
      message: "Social output could not be parsed.",
      scoreImpact: 20,
    });
  }

  return { campaignMemory, qualityGate };
}

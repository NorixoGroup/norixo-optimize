import {
  addCampaignGeneratedVariant,
  addCampaignMemoryWarning,
  type MarketingCampaignMemory,
} from "../campaigns/campaignMemory";
import type { MarketingCampaignFormat } from "../campaigns/campaignModel";
import type { CreativeOutput } from "../contracts/agentContracts";
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

export function applyCreativePipelineQuality(input: {
  creativeOutput: CreativeOutput | null;
  campaignMemory: MarketingCampaignMemory;
  qualityGate: MarketingQualityGateResult;
}): {
  campaignMemory: MarketingCampaignMemory;
  qualityGate: MarketingQualityGateResult;
} {
  let { creativeOutput, campaignMemory, qualityGate } = input;

  if (creativeOutput) {
    const creativeFormat = resolveMemoryFormat(creativeOutput.assetFormat);

    campaignMemory = addCampaignGeneratedVariant(campaignMemory, {
      id: `creative-${new Date().toISOString()}`,
      source: "creative",
      format: creativeFormat ?? undefined,
      topic: creativeOutput.mainTextOverlay || creativeOutput.creativeConcept,
      contentRef: creativeOutput.creativeConcept,
      createdAt: new Date().toISOString(),
    });

    if (isBlank(creativeOutput.gptImagePrompt)) {
      qualityGate = addQualityIssue(qualityGate, {
        type: "clarity",
        severity: "error",
        message: "Creative output contains an empty GPT image prompt.",
        scoreImpact: 20,
      });
    }

    if (isBlank(creativeOutput.creativeConcept)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Creative output contains an empty creative concept.",
      });
    }

    if (isBlank(creativeOutput.mainTextOverlay)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Creative output contains an empty main text overlay.",
      });
    }

    if (isBlank(creativeOutput.secondaryTextOverlay)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "clarity",
        message: "Creative output contains an empty secondary text overlay.",
      });
    }

    if (isBlank(creativeOutput.assetFormat)) {
      qualityGate = addQualityWarning(qualityGate, {
        type: "platform_fit",
        message: "Creative output contains an empty asset format.",
      });
    }

    if (creativeOutput.brandChecklist.length === 0) {
      qualityGate = addQualityImprovement(qualityGate, {
        type: "compliance",
        message: "Creative output could include a brand checklist.",
      });
    }
  } else {
    campaignMemory = addCampaignMemoryWarning(campaignMemory, {
      code: "creative_output_unparsed",
      message: "Creative output could not be parsed.",
      severity: "warning",
      createdAt: new Date().toISOString(),
    });
    qualityGate = addQualityIssue(qualityGate, {
      type: "clarity",
      severity: "error",
      message: "Creative output could not be parsed.",
      scoreImpact: 20,
    });
  }

  return { campaignMemory, qualityGate };
}

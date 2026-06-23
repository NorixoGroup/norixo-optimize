import {
  addCampaignMemoryEntry,
  addCampaignMemoryWarning,
  addCampaignPublishedTopic,
  addCampaignUsedFormat,
  type MarketingCampaignMemory,
} from "../campaigns/campaignMemory";
import type { MarketingCampaignFormat } from "../campaigns/campaignModel";
import type { PlannerOutput } from "../contracts/agentContracts";
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

export function applyPlannerPipelineQuality(input: {
  plannerOutput: PlannerOutput | null;
  campaignMemory: MarketingCampaignMemory;
  qualityGate: MarketingQualityGateResult;
}): {
  campaignMemory: MarketingCampaignMemory;
  qualityGate: MarketingQualityGateResult;
} {
  let { plannerOutput, campaignMemory, qualityGate } = input;

  if (plannerOutput) {
    if (plannerOutput.items.length === 0) {
      qualityGate = addQualityIssue(qualityGate, {
        type: "clarity",
        severity: "error",
        message: "Planner output contains no items.",
        scoreImpact: 25,
      });
    }

    const normalizedTopics = plannerOutput.items
      .map((item) => item.topic.trim())
      .filter(Boolean);
    const normalizedFormats = plannerOutput.items
      .map((item) => item.format.trim().toLowerCase())
      .filter(Boolean);
    const hasDuplicateTopics =
      new Set(normalizedTopics).size !== normalizedTopics.length;
    const hasRepeatedFormats =
      new Set(normalizedFormats).size !== normalizedFormats.length;

    for (const item of plannerOutput.items) {
      const resolvedFormat = resolveMemoryFormat(item.format);

      if (resolvedFormat) {
        campaignMemory = addCampaignUsedFormat(campaignMemory, resolvedFormat);
      }

      campaignMemory = addCampaignPublishedTopic(campaignMemory, item.topic);

      if (isBlank(item.topic)) {
        qualityGate = addQualityWarning(qualityGate, {
          type: "clarity",
          message: "Planner item contains an empty topic.",
        });
      }

      if (isBlank(item.format)) {
        qualityGate = addQualityWarning(qualityGate, {
          type: "clarity",
          message: "Planner item contains an empty format.",
        });
      }

      if (isBlank(item.channel)) {
        qualityGate = addQualityWarning(qualityGate, {
          type: "platform_fit",
          message: "Planner item contains an empty channel.",
        });
      }

      if (isBlank(item.cta)) {
        qualityGate = addQualityWarning(qualityGate, {
          type: "cta",
          message: "Planner item contains an empty CTA.",
        });
      }
    }

    if (hasDuplicateTopics) {
      qualityGate = addQualityImprovement(qualityGate, {
        type: "duplicate_topic",
        message: "Planner output contains duplicated topics that could be diversified.",
      });
    }

    if (hasRepeatedFormats) {
      qualityGate = addQualityImprovement(qualityGate, {
        type: "repeated_format",
        message: "Planner output repeats formats and could use more variation.",
      });
    }

    campaignMemory = addCampaignMemoryEntry(campaignMemory, {
      type: "updated",
      message: "Planner output parsed.",
      createdAt: new Date().toISOString(),
    });
  } else {
    campaignMemory = addCampaignMemoryWarning(campaignMemory, {
      code: "planner_output_unparsed",
      message: "Planner output could not be parsed.",
      severity: "warning",
      createdAt: new Date().toISOString(),
    });
    qualityGate = addQualityIssue(qualityGate, {
      type: "clarity",
      severity: "error",
      message: "Planner output could not be parsed.",
      scoreImpact: 25,
    });
  }

  return { campaignMemory, qualityGate };
}

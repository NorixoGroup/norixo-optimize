import type {
  MarketingCampaign,
  MarketingCampaignFormat,
  MarketingCampaignObjective,
  MarketingCampaignPlatform,
} from "./campaignModel";
import {
  normalizeCampaignFormat,
  normalizeCampaignPlatform,
} from "./campaignModel";

export type MarketingCampaignMemoryEntry = {
  type:
    | "created"
    | "updated"
    | "variant_added"
    | "warning_added"
    | "topic_recorded"
    | "format_recorded";
  message: string;
  createdAt: string;
};

export type MarketingCampaignGeneratedVariant = {
  id: string;
  source: "social" | "creative" | "video" | "manual";
  platform?: MarketingCampaignPlatform;
  format?: MarketingCampaignFormat;
  topic: string;
  contentRef?: string;
  createdAt: string;
};

export type MarketingCampaignMemoryWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  createdAt: string;
};

export type MarketingCampaignMemory = {
  campaignId: string;
  objective: MarketingCampaignObjective;
  audience: string;
  tone: string;
  cta: string;
  hashtags: string[];
  platforms: MarketingCampaignPlatform[];
  usedFormats: MarketingCampaignFormat[];
  publishedTopics: string[];
  generatedVariants: MarketingCampaignGeneratedVariant[];
  history: MarketingCampaignMemoryEntry[];
  warnings: MarketingCampaignMemoryWarning[];
  createdAt: string;
  updatedAt: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeDateString(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function createUpdatedMemory(
  memory: MarketingCampaignMemory,
  updates: Partial<MarketingCampaignMemory>,
): MarketingCampaignMemory {
  return {
    ...memory,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

function isMarketingCampaignMemoryEntry(
  value: unknown,
): value is MarketingCampaignMemoryEntry {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    (value.type === "created" ||
      value.type === "updated" ||
      value.type === "variant_added" ||
      value.type === "warning_added" ||
      value.type === "topic_recorded" ||
      value.type === "format_recorded") &&
    typeof value.message === "string" &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null
  );
}

function isMarketingCampaignGeneratedVariant(
  value: unknown,
): value is MarketingCampaignGeneratedVariant {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    (value.source === "social" ||
      value.source === "creative" ||
      value.source === "video" ||
      value.source === "manual") &&
    (value.platform === undefined ||
      (typeof value.platform === "string" &&
        normalizeCampaignPlatform(value.platform) !== null)) &&
    (value.format === undefined ||
      (typeof value.format === "string" &&
        normalizeCampaignFormat(value.format) !== null)) &&
    typeof value.topic === "string" &&
    (value.contentRef === undefined || typeof value.contentRef === "string") &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null
  );
}

function isMarketingCampaignMemoryWarning(
  value: unknown,
): value is MarketingCampaignMemoryWarning {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    (value.severity === "info" ||
      value.severity === "warning" ||
      value.severity === "error") &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null
  );
}

export function createCampaignMemoryFromCampaign(
  campaign: MarketingCampaign,
): MarketingCampaignMemory {
  return {
    campaignId: campaign.id,
    objective: campaign.objective,
    audience: campaign.audience,
    tone: campaign.tone,
    cta: campaign.cta,
    hashtags: [...campaign.hashtags],
    platforms: [...campaign.platforms],
    usedFormats: [],
    publishedTopics: [],
    generatedVariants: [],
    history: [
      {
        type: "created",
        message: `Campaign memory initialized for ${campaign.name}.`,
        createdAt: campaign.createdAt,
      },
    ],
    warnings: [],
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

export function addCampaignMemoryEntry(
  memory: MarketingCampaignMemory,
  entry: MarketingCampaignMemoryEntry,
): MarketingCampaignMemory {
  return createUpdatedMemory(memory, {
    history: [...memory.history, entry],
  });
}

export function addCampaignGeneratedVariant(
  memory: MarketingCampaignMemory,
  variant: MarketingCampaignGeneratedVariant,
): MarketingCampaignMemory {
  return createUpdatedMemory(memory, {
    generatedVariants: [...memory.generatedVariants, variant],
  });
}

export function addCampaignMemoryWarning(
  memory: MarketingCampaignMemory,
  warning: MarketingCampaignMemoryWarning,
): MarketingCampaignMemory {
  return createUpdatedMemory(memory, {
    warnings: [...memory.warnings, warning],
  });
}

export function addCampaignPublishedTopic(
  memory: MarketingCampaignMemory,
  topic: string,
): MarketingCampaignMemory {
  if (!topic.trim()) {
    return memory;
  }

  const normalizedTopic = topic.trim();

  if (memory.publishedTopics.includes(normalizedTopic)) {
    return memory;
  }

  return createUpdatedMemory(memory, {
    publishedTopics: [...memory.publishedTopics, normalizedTopic],
  });
}

export function addCampaignUsedFormat(
  memory: MarketingCampaignMemory,
  format: MarketingCampaignFormat,
): MarketingCampaignMemory {
  if (memory.usedFormats.includes(format)) {
    return memory;
  }

  return createUpdatedMemory(memory, {
    usedFormats: [...memory.usedFormats, format],
  });
}

export function isMarketingCampaignMemory(
  value: unknown,
): value is MarketingCampaignMemory {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.campaignId === "string" &&
    typeof value.objective === "string" &&
    typeof value.audience === "string" &&
    typeof value.tone === "string" &&
    typeof value.cta === "string" &&
    isStringArray(value.hashtags) &&
    Array.isArray(value.platforms) &&
    value.platforms.every(
      (platform) =>
        typeof platform === "string" &&
        normalizeCampaignPlatform(platform) !== null,
    ) &&
    Array.isArray(value.usedFormats) &&
    value.usedFormats.every(
      (format) =>
        typeof format === "string" &&
        normalizeCampaignFormat(format) !== null,
    ) &&
    isStringArray(value.publishedTopics) &&
    Array.isArray(value.generatedVariants) &&
    value.generatedVariants.every(isMarketingCampaignGeneratedVariant) &&
    Array.isArray(value.history) &&
    value.history.every(isMarketingCampaignMemoryEntry) &&
    Array.isArray(value.warnings) &&
    value.warnings.every(isMarketingCampaignMemoryWarning) &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

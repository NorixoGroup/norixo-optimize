export type MarketingCommunityPlatform =
  | "facebook"
  | "reddit"
  | "forum"
  | "linkedin"
  | "x"
  | "instagram"
  | "line"
  | "kakaotalk"
  | "naver_cafe"
  | "wechat"
  | "weibo"
  | "xiaohongshu"
  | "douyin"
  | "zalo"
  | "telegram"
  | "whatsapp"
  | "other";

export type MarketingCommunityType =
  | "short_term_rental"
  | "airbnb_hosts"
  | "booking_hosts"
  | "property_management"
  | "concierge"
  | "expats"
  | "digital_nomads"
  | "real_estate"
  | "hospitality"
  | "software_saas"
  | "local_business"
  | "other";

export type MarketingCommunityRelevance =
  | "low"
  | "medium"
  | "high"
  | "very_high";

export type MarketingCommunityActivity =
  | "unknown"
  | "low"
  | "medium"
  | "high";

export type CreateMarketingCommunityInput = {
  id?: string;
  country?: string;
  name?: string;
  platform?: MarketingCommunityPlatform | string;
  language?: string;
  type?: MarketingCommunityType | string;
  approximateSize?: string;
  estimatedActivity?: MarketingCommunityActivity | string;
  audience?: string;
  relevance?: MarketingCommunityRelevance | string;
  recommendationReason?: string;
  url?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MarketingCommunity = {
  id: string;
  country: string;
  name: string;
  platform: MarketingCommunityPlatform;
  language: string;
  type: MarketingCommunityType;
  approximateSize?: string;
  estimatedActivity: MarketingCommunityActivity;
  audience: string;
  relevance: MarketingCommunityRelevance;
  recommendationReason: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const COMMUNITY_PLATFORMS: MarketingCommunityPlatform[] = [
  "facebook",
  "reddit",
  "forum",
  "linkedin",
  "x",
  "instagram",
  "line",
  "kakaotalk",
  "naver_cafe",
  "wechat",
  "weibo",
  "xiaohongshu",
  "douyin",
  "zalo",
  "telegram",
  "whatsapp",
  "other",
];

const COMMUNITY_TYPES: MarketingCommunityType[] = [
  "short_term_rental",
  "airbnb_hosts",
  "booking_hosts",
  "property_management",
  "concierge",
  "expats",
  "digital_nomads",
  "real_estate",
  "hospitality",
  "software_saas",
  "local_business",
  "other",
];

const COMMUNITY_RELEVANCE: MarketingCommunityRelevance[] = [
  "low",
  "medium",
  "high",
  "very_high",
];

const COMMUNITY_ACTIVITY: MarketingCommunityActivity[] = [
  "unknown",
  "low",
  "medium",
  "high",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeDateString(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeCommunityPlatform(
  value: string,
): MarketingCommunityPlatform | null {
  const normalized = normalizeToken(value);

  return COMMUNITY_PLATFORMS.includes(normalized as MarketingCommunityPlatform)
    ? (normalized as MarketingCommunityPlatform)
    : null;
}

export function normalizeCommunityType(
  value: string,
): MarketingCommunityType | null {
  const normalized = normalizeToken(value);

  return COMMUNITY_TYPES.includes(normalized as MarketingCommunityType)
    ? (normalized as MarketingCommunityType)
    : null;
}

export function normalizeCommunityRelevance(
  value: string,
): MarketingCommunityRelevance | null {
  const normalized = normalizeToken(value);

  return COMMUNITY_RELEVANCE.includes(normalized as MarketingCommunityRelevance)
    ? (normalized as MarketingCommunityRelevance)
    : null;
}

export function normalizeCommunityActivity(
  value: string,
): MarketingCommunityActivity | null {
  const normalized = normalizeToken(value);

  return COMMUNITY_ACTIVITY.includes(normalized as MarketingCommunityActivity)
    ? (normalized as MarketingCommunityActivity)
    : null;
}

export function isMarketingCommunity(value: unknown): value is MarketingCommunity {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.country === "string" &&
    typeof value.name === "string" &&
    typeof value.platform === "string" &&
    normalizeCommunityPlatform(value.platform) !== null &&
    typeof value.language === "string" &&
    typeof value.type === "string" &&
    normalizeCommunityType(value.type) !== null &&
    (value.approximateSize === undefined || typeof value.approximateSize === "string") &&
    typeof value.estimatedActivity === "string" &&
    normalizeCommunityActivity(value.estimatedActivity) !== null &&
    typeof value.audience === "string" &&
    typeof value.relevance === "string" &&
    normalizeCommunityRelevance(value.relevance) !== null &&
    typeof value.recommendationReason === "string" &&
    (value.url === undefined || typeof value.url === "string") &&
    (value.notes === undefined || typeof value.notes === "string") &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function createMarketingCommunity(
  input: CreateMarketingCommunityInput = {},
): MarketingCommunity {
  const createdAt = normalizeDateString(input.createdAt ?? "") ?? new Date().toISOString();
  const updatedAt = normalizeDateString(input.updatedAt ?? createdAt) ?? createdAt;
  const platform =
    input.platform && normalizeCommunityPlatform(input.platform)
      ? normalizeCommunityPlatform(input.platform)
      : "other";
  const type =
    input.type && normalizeCommunityType(input.type)
      ? normalizeCommunityType(input.type)
      : "other";
  const estimatedActivity =
    input.estimatedActivity && normalizeCommunityActivity(input.estimatedActivity)
      ? normalizeCommunityActivity(input.estimatedActivity)
      : "unknown";
  const relevance =
    input.relevance && normalizeCommunityRelevance(input.relevance)
      ? normalizeCommunityRelevance(input.relevance)
      : "medium";

  return {
    id: input.id?.trim() || `community-${createdAt}`,
    country: input.country?.trim() || "Unknown",
    name: input.name?.trim() || "Unnamed community",
    platform: platform ?? "other",
    language: input.language?.trim() || "unknown",
    type: type ?? "other",
    approximateSize: normalizeOptionalString(input.approximateSize),
    estimatedActivity: estimatedActivity ?? "unknown",
    audience: input.audience?.trim() || "Short-term rental professionals",
    relevance: relevance ?? "medium",
    recommendationReason:
      input.recommendationReason?.trim() ||
      "Community relevance should be reviewed before outreach.",
    url: normalizeOptionalString(input.url),
    notes: normalizeOptionalString(input.notes),
    createdAt,
    updatedAt,
  };
}

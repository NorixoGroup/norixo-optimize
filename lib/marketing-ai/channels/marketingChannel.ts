export type MarketingChannelType =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "reddit"
  | "x"
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
  | "forum"
  | "community"
  | "other";

export type MarketingChannelStatus = "active" | "inactive" | "planned";

export type MarketingChannelPriority = "low" | "medium" | "high" | "primary";

export type CreateMarketingChannelInput = {
  id?: string;
  type?: MarketingChannelType | string;
  label?: string;
  status?: MarketingChannelStatus | string;
  priority?: MarketingChannelPriority | string;
  defaultLanguage?: string;
  humanApprovalRequired?: boolean;
  automaticPublishingAllowed?: boolean;
  manualPublishingSupported?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MarketingChannel = {
  id: string;
  type: MarketingChannelType;
  label: string;
  status: MarketingChannelStatus;
  priority: MarketingChannelPriority;
  defaultLanguage: string;
  humanApprovalRequired: true;
  automaticPublishingAllowed: false;
  manualPublishingSupported: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const MARKETING_CHANNEL_TYPES: MarketingChannelType[] = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "reddit",
  "x",
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
  "forum",
  "community",
  "other",
];

const MARKETING_CHANNEL_STATUSES: MarketingChannelStatus[] = [
  "active",
  "inactive",
  "planned",
];

const MARKETING_CHANNEL_PRIORITIES: MarketingChannelPriority[] = [
  "low",
  "medium",
  "high",
  "primary",
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

export function normalizeMarketingChannelType(
  value: string,
): MarketingChannelType | null {
  const normalized = normalizeToken(value);

  return MARKETING_CHANNEL_TYPES.includes(normalized as MarketingChannelType)
    ? (normalized as MarketingChannelType)
    : null;
}

export function normalizeMarketingChannelStatus(
  value: string,
): MarketingChannelStatus | null {
  const normalized = normalizeToken(value);

  return MARKETING_CHANNEL_STATUSES.includes(normalized as MarketingChannelStatus)
    ? (normalized as MarketingChannelStatus)
    : null;
}

export function normalizeMarketingChannelPriority(
  value: string,
): MarketingChannelPriority | null {
  const normalized = normalizeToken(value);

  return MARKETING_CHANNEL_PRIORITIES.includes(
    normalized as MarketingChannelPriority,
  )
    ? (normalized as MarketingChannelPriority)
    : null;
}

export function isMarketingChannel(value: unknown): value is MarketingChannel {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    normalizeMarketingChannelType(value.type) !== null &&
    typeof value.label === "string" &&
    typeof value.status === "string" &&
    normalizeMarketingChannelStatus(value.status) !== null &&
    typeof value.priority === "string" &&
    normalizeMarketingChannelPriority(value.priority) !== null &&
    typeof value.defaultLanguage === "string" &&
    value.humanApprovalRequired === true &&
    value.automaticPublishingAllowed === false &&
    typeof value.manualPublishingSupported === "boolean" &&
    (value.notes === undefined || typeof value.notes === "string") &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function createMarketingChannel(
  input: CreateMarketingChannelInput = {},
): MarketingChannel {
  const createdAt = normalizeDateString(input.createdAt ?? "") ?? new Date().toISOString();
  const updatedAt = normalizeDateString(input.updatedAt ?? createdAt) ?? createdAt;
  const type =
    input.type && normalizeMarketingChannelType(input.type)
      ? normalizeMarketingChannelType(input.type)
      : "other";
  const status =
    input.status && normalizeMarketingChannelStatus(input.status)
      ? normalizeMarketingChannelStatus(input.status)
      : "planned";
  const priority =
    input.priority && normalizeMarketingChannelPriority(input.priority)
      ? normalizeMarketingChannelPriority(input.priority)
      : "medium";

  return {
    id: input.id?.trim() || `marketing-channel-${createdAt}`,
    type: type ?? "other",
    label: input.label?.trim() || type || "other",
    status: status ?? "planned",
    priority: priority ?? "medium",
    defaultLanguage: input.defaultLanguage?.trim() || "fr",
    humanApprovalRequired: true,
    automaticPublishingAllowed: false,
    manualPublishingSupported: input.manualPublishingSupported ?? true,
    notes: normalizeOptionalString(input.notes),
    createdAt,
    updatedAt,
  };
}

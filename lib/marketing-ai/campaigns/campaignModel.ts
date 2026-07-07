export type MarketingCampaignPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok";

export type MarketingCampaignFormat =
  | "post"
  | "carousel"
  | "reel"
  | "story"
  | "short_video";

export type MarketingCampaignObjective =
  | "awareness"
  | "conversion"
  | "education"
  | "launch"
  | "engagement";

export type MarketingCampaignStatus =
  | "draft"
  | "planned"
  | "generating"
  | "ready"
  | "published"
  | "archived";

export type CreateDefaultMarketingCampaignInput = {
  id?: string;
  name?: string;
  objective?: MarketingCampaignObjective | string;
  audience?: string;
  tone?: string;
  cta?: string;
  websiteUrl?: string;
  language?: string;
  platforms?: Array<MarketingCampaignPlatform | string>;
  formats?: Array<MarketingCampaignFormat | string>;
  durationDays?: number;
  startDate?: string;
  hashtags?: string[];
  status?: MarketingCampaignStatus | string;
  createdAt?: string;
  updatedAt?: string;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  objective: MarketingCampaignObjective;
  audience: string;
  tone: string;
  cta: string;
  websiteUrl: string;
  language: string;
  platforms: MarketingCampaignPlatform[];
  formats: MarketingCampaignFormat[];
  durationDays: number;
  startDate: string;
  endDate: string;
  hashtags: string[];
  status: MarketingCampaignStatus;
  createdAt: string;
  updatedAt: string;
};

const CAMPAIGN_PLATFORMS: MarketingCampaignPlatform[] = [
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
];

const CAMPAIGN_FORMATS: MarketingCampaignFormat[] = [
  "post",
  "carousel",
  "reel",
  "story",
  "short_video",
];

const CAMPAIGN_OBJECTIVES: MarketingCampaignObjective[] = [
  "awareness",
  "conversion",
  "education",
  "launch",
  "engagement",
];

const CAMPAIGN_STATUSES: MarketingCampaignStatus[] = [
  "draft",
  "planned",
  "generating",
  "ready",
  "published",
  "archived",
];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

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

function addDaysToIsoDate(date: string, durationDays: number) {
  const parsed = new Date(date);
  parsed.setUTCDate(parsed.getUTCDate() + durationDays);
  return parsed.toISOString();
}

export function normalizeCampaignPlatform(
  value: string,
): MarketingCampaignPlatform | null {
  const normalized = value.trim().toLowerCase();

  return CAMPAIGN_PLATFORMS.includes(normalized as MarketingCampaignPlatform)
    ? (normalized as MarketingCampaignPlatform)
    : null;
}

export function normalizeCampaignFormat(
  value: string,
): MarketingCampaignFormat | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return CAMPAIGN_FORMATS.includes(normalized as MarketingCampaignFormat)
    ? (normalized as MarketingCampaignFormat)
    : null;
}

export function normalizeCampaignObjective(
  value: string,
): MarketingCampaignObjective | null {
  const normalized = value.trim().toLowerCase();

  return CAMPAIGN_OBJECTIVES.includes(normalized as MarketingCampaignObjective)
    ? (normalized as MarketingCampaignObjective)
    : null;
}

export function normalizeCampaignStatus(
  value: string,
): MarketingCampaignStatus | null {
  const normalized = value.trim().toLowerCase();

  return CAMPAIGN_STATUSES.includes(normalized as MarketingCampaignStatus)
    ? (normalized as MarketingCampaignStatus)
    : null;
}

export function isMarketingCampaign(
  value: unknown,
): value is MarketingCampaign {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.objective === "string" &&
    normalizeCampaignObjective(value.objective) !== null &&
    typeof value.audience === "string" &&
    typeof value.tone === "string" &&
    typeof value.cta === "string" &&
    typeof value.websiteUrl === "string" &&
    typeof value.language === "string" &&
    Array.isArray(value.platforms) &&
    value.platforms.every(
      (platform) =>
        typeof platform === "string" &&
        normalizeCampaignPlatform(platform) !== null,
    ) &&
    Array.isArray(value.formats) &&
    value.formats.every(
      (format) =>
        typeof format === "string" &&
        normalizeCampaignFormat(format) !== null,
    ) &&
    typeof value.durationDays === "number" &&
    Number.isFinite(value.durationDays) &&
    typeof value.startDate === "string" &&
    normalizeDateString(value.startDate) !== null &&
    typeof value.endDate === "string" &&
    normalizeDateString(value.endDate) !== null &&
    isStringArray(value.hashtags) &&
    typeof value.status === "string" &&
    normalizeCampaignStatus(value.status) !== null &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function createDefaultMarketingCampaign(
  input: CreateDefaultMarketingCampaignInput = {},
): MarketingCampaign {
  const createdAt = normalizeDateString(input.createdAt ?? "") ?? new Date().toISOString();
  const updatedAt = normalizeDateString(input.updatedAt ?? createdAt) ?? createdAt;
  const startDate = normalizeDateString(input.startDate ?? createdAt) ?? createdAt;
  const durationDays =
    typeof input.durationDays === "number" && Number.isFinite(input.durationDays)
      ? Math.max(1, Math.trunc(input.durationDays))
      : 7;
  const objective =
    input.objective && normalizeCampaignObjective(input.objective)
      ? normalizeCampaignObjective(input.objective)
      : "awareness";
  const status =
    input.status && normalizeCampaignStatus(input.status)
      ? normalizeCampaignStatus(input.status)
      : "draft";
  const platforms = (input.platforms ?? ["instagram", "facebook"])
    .map((platform) => normalizeCampaignPlatform(platform))
    .filter((platform): platform is MarketingCampaignPlatform => platform !== null);
  const formats = (input.formats ?? ["post", "carousel"])
    .map((format) => normalizeCampaignFormat(format))
    .filter((format): format is MarketingCampaignFormat => format !== null);

  return {
    id: input.id?.trim() || `campaign-${createdAt}`,
    name: input.name?.trim() || "Campagne Norixo",
    objective: objective ?? "awareness",
    audience: input.audience?.trim() || "Conciergeries et hôtes professionnels",
    tone: input.tone?.trim() || "clair, pédagogique et professionnel",
    cta: input.cta?.trim() || "Découvrir Norixo.io",
    websiteUrl: input.websiteUrl?.trim() || "https://norixo.io",
    language: input.language?.trim() || "fr",
    platforms: platforms.length ? platforms : ["instagram", "facebook"],
    formats: formats.length ? formats : ["post", "carousel"],
    durationDays,
    startDate,
    endDate: addDaysToIsoDate(startDate, durationDays),
    hashtags: isStringArray(input.hashtags) ? input.hashtags : [],
    status: status ?? "draft",
    createdAt,
    updatedAt,
  };
}

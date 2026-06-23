import type { MarketingCampaignFormat } from "../campaigns/campaignModel";

export type PublicationPackPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "reddit"
  | "x"
  | "forum"
  | "community"
  | "other";

export type PublicationPackStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "published";

export type PublicationPackAssetType =
  | "image"
  | "video"
  | "document"
  | "link"
  | "other";

export type PublicationPackAssetRef = {
  type: PublicationPackAssetType;
  label: string;
  url?: string;
  path?: string;
  notes?: string;
};

export type CreatePublicationPackInput = {
  id?: string;
  campaignId?: string;
  platform?: PublicationPackPlatform | string;
  format?: MarketingCampaignFormat | string;
  language?: string;
  status?: PublicationPackStatus | string;
  title?: string;
  hook?: string;
  caption?: string;
  cta?: string;
  hashtags?: string[];
  visualBrief?: string;
  imagePrompt?: string;
  videoPrompt?: string;
  assetReferences?: PublicationPackAssetRef[];
  approvalRequired?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  notes?: string;
  sourceStage?: string;
  communityTarget?: string;
  localizedVariantOf?: string;
  qualitySummary?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicationPack = {
  id: string;
  campaignId: string;
  platform: PublicationPackPlatform;
  format: string;
  language: string;
  status: PublicationPackStatus;
  title: string;
  hook?: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visualBrief?: string;
  imagePrompt?: string;
  videoPrompt?: string;
  assetReferences: PublicationPackAssetRef[];
  approvalRequired: true;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  notes?: string;
  sourceStage?: string;
  communityTarget?: string;
  localizedVariantOf?: string;
  qualitySummary?: string;
  createdAt: string;
  updatedAt: string;
};

const PUBLICATION_PACK_PLATFORMS: PublicationPackPlatform[] = [
  "instagram",
  "facebook",
  "linkedin",
  "reddit",
  "x",
  "forum",
  "community",
  "other",
];

const PUBLICATION_PACK_STATUSES: PublicationPackStatus[] = [
  "draft",
  "ready_for_review",
  "approved",
  "rejected",
  "published",
];

const PUBLICATION_PACK_ASSET_TYPES: PublicationPackAssetType[] = [
  "image",
  "video",
  "document",
  "link",
  "other",
];

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

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isPublicationPackAssetType(
  value: unknown,
): value is PublicationPackAssetType {
  return (
    typeof value === "string" &&
    PUBLICATION_PACK_ASSET_TYPES.includes(value as PublicationPackAssetType)
  );
}

function isPublicationPackAssetRef(value: unknown): value is PublicationPackAssetRef {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isPublicationPackAssetType(value.type) &&
    typeof value.label === "string" &&
    (value.url === undefined || typeof value.url === "string") &&
    (value.path === undefined || typeof value.path === "string") &&
    (value.notes === undefined || typeof value.notes === "string")
  );
}

export function normalizePublicationPackPlatform(
  value: string,
): PublicationPackPlatform | null {
  const normalized = value.trim().toLowerCase();

  return PUBLICATION_PACK_PLATFORMS.includes(normalized as PublicationPackPlatform)
    ? (normalized as PublicationPackPlatform)
    : null;
}

export function normalizePublicationPackStatus(
  value: string,
): PublicationPackStatus | null {
  const normalized = value.trim().toLowerCase();

  return PUBLICATION_PACK_STATUSES.includes(normalized as PublicationPackStatus)
    ? (normalized as PublicationPackStatus)
    : null;
}

export function isPublicationPack(value: unknown): value is PublicationPack {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.campaignId === "string" &&
    typeof value.platform === "string" &&
    normalizePublicationPackPlatform(value.platform) !== null &&
    typeof value.format === "string" &&
    typeof value.language === "string" &&
    typeof value.status === "string" &&
    normalizePublicationPackStatus(value.status) !== null &&
    typeof value.title === "string" &&
    (value.hook === undefined || typeof value.hook === "string") &&
    typeof value.caption === "string" &&
    typeof value.cta === "string" &&
    isStringArray(value.hashtags) &&
    (value.visualBrief === undefined || typeof value.visualBrief === "string") &&
    (value.imagePrompt === undefined || typeof value.imagePrompt === "string") &&
    (value.videoPrompt === undefined || typeof value.videoPrompt === "string") &&
    Array.isArray(value.assetReferences) &&
    value.assetReferences.every(isPublicationPackAssetRef) &&
    value.approvalRequired === true &&
    (value.approvedBy === undefined || typeof value.approvedBy === "string") &&
    (value.approvedAt === undefined ||
      (typeof value.approvedAt === "string" &&
        normalizeDateString(value.approvedAt) !== null)) &&
    (value.rejectedReason === undefined || typeof value.rejectedReason === "string") &&
    (value.notes === undefined || typeof value.notes === "string") &&
    (value.sourceStage === undefined || typeof value.sourceStage === "string") &&
    (value.communityTarget === undefined || typeof value.communityTarget === "string") &&
    (value.localizedVariantOf === undefined ||
      typeof value.localizedVariantOf === "string") &&
    (value.qualitySummary === undefined || typeof value.qualitySummary === "string") &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function createPublicationPack(
  input: CreatePublicationPackInput = {},
): PublicationPack {
  const createdAt = normalizeDateString(input.createdAt ?? "") ?? new Date().toISOString();
  const updatedAt = normalizeDateString(input.updatedAt ?? createdAt) ?? createdAt;
  const platform =
    input.platform && normalizePublicationPackPlatform(input.platform)
      ? normalizePublicationPackPlatform(input.platform)
      : "instagram";
  const status =
    input.status && normalizePublicationPackStatus(input.status)
      ? normalizePublicationPackStatus(input.status)
      : "draft";

  return {
    id: input.id?.trim() || `publication-pack-${createdAt}`,
    campaignId: input.campaignId?.trim() || "campaign-unknown",
    platform: platform ?? "instagram",
    format: input.format?.trim() || "post",
    language: input.language?.trim() || "fr",
    status: status ?? "draft",
    title: input.title?.trim() || "Publication Norixo",
    hook: normalizeOptionalString(input.hook),
    caption: input.caption?.trim() || "",
    cta: input.cta?.trim() || "Découvrir Norixo.io",
    hashtags: isStringArray(input.hashtags) ? input.hashtags : [],
    visualBrief: normalizeOptionalString(input.visualBrief),
    imagePrompt: normalizeOptionalString(input.imagePrompt),
    videoPrompt: normalizeOptionalString(input.videoPrompt),
    assetReferences: Array.isArray(input.assetReferences)
      ? input.assetReferences.filter(isPublicationPackAssetRef)
      : [],
    approvalRequired: true,
    approvedBy: normalizeOptionalString(input.approvedBy),
    approvedAt:
      input.approvedAt && normalizeDateString(input.approvedAt)
        ? normalizeDateString(input.approvedAt) ?? undefined
        : undefined,
    rejectedReason: normalizeOptionalString(input.rejectedReason),
    notes: normalizeOptionalString(input.notes),
    sourceStage: normalizeOptionalString(input.sourceStage),
    communityTarget: normalizeOptionalString(input.communityTarget),
    localizedVariantOf: normalizeOptionalString(input.localizedVariantOf),
    qualitySummary: normalizeOptionalString(input.qualitySummary),
    createdAt,
    updatedAt,
  };
}

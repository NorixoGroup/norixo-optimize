export type MarketingLocalizationTone =
  | "neutral"
  | "professional"
  | "friendly"
  | "formal"
  | "conversational"
  | "educational";

export type MarketingLocalizationLength =
  | "short"
  | "medium"
  | "long";

export type MarketingLocalizationEmojiStyle =
  | "none"
  | "light"
  | "moderate";

export type CreateMarketingLocalizationInput = {
  id?: string;
  sourcePackId?: string;
  targetCountry?: string;
  targetLanguage?: string;
  targetPlatform?: string;
  targetCommunityType?: string;
  tone?: MarketingLocalizationTone | string;
  length?: MarketingLocalizationLength | string;
  emojiStyle?: MarketingLocalizationEmojiStyle | string;
  adaptedTitle?: string;
  adaptedCaption?: string;
  adaptedCta?: string;
  adaptedHashtags?: string[];
  vocabularyNotes?: string[];
  culturalNotes?: string[];
  warnings?: string[];
  approvalRequired?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type MarketingLocalization = {
  id: string;
  sourcePackId: string;
  targetCountry: string;
  targetLanguage: string;
  targetPlatform: string;
  targetCommunityType?: string;
  tone: MarketingLocalizationTone;
  length: MarketingLocalizationLength;
  emojiStyle: MarketingLocalizationEmojiStyle;
  adaptedTitle: string;
  adaptedCaption: string;
  adaptedCta: string;
  adaptedHashtags: string[];
  vocabularyNotes: string[];
  culturalNotes: string[];
  warnings: string[];
  approvalRequired: true;
  createdAt: string;
  updatedAt: string;
};

const LOCALIZATION_TONES: MarketingLocalizationTone[] = [
  "neutral",
  "professional",
  "friendly",
  "formal",
  "conversational",
  "educational",
];

const LOCALIZATION_LENGTHS: MarketingLocalizationLength[] = [
  "short",
  "medium",
  "long",
];

const LOCALIZATION_EMOJI_STYLES: MarketingLocalizationEmojiStyle[] = [
  "none",
  "light",
  "moderate",
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

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeMarketingLocalizationTone(
  value: string,
): MarketingLocalizationTone | null {
  const normalized = normalizeToken(value);

  return LOCALIZATION_TONES.includes(normalized as MarketingLocalizationTone)
    ? (normalized as MarketingLocalizationTone)
    : null;
}

export function normalizeMarketingLocalizationLength(
  value: string,
): MarketingLocalizationLength | null {
  const normalized = normalizeToken(value);

  return LOCALIZATION_LENGTHS.includes(normalized as MarketingLocalizationLength)
    ? (normalized as MarketingLocalizationLength)
    : null;
}

export function normalizeMarketingLocalizationEmojiStyle(
  value: string,
): MarketingLocalizationEmojiStyle | null {
  const normalized = normalizeToken(value);

  return LOCALIZATION_EMOJI_STYLES.includes(
    normalized as MarketingLocalizationEmojiStyle,
  )
    ? (normalized as MarketingLocalizationEmojiStyle)
    : null;
}

export function isMarketingLocalization(
  value: unknown,
): value is MarketingLocalization {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.sourcePackId === "string" &&
    typeof value.targetCountry === "string" &&
    typeof value.targetLanguage === "string" &&
    typeof value.targetPlatform === "string" &&
    (value.targetCommunityType === undefined ||
      typeof value.targetCommunityType === "string") &&
    typeof value.tone === "string" &&
    normalizeMarketingLocalizationTone(value.tone) !== null &&
    typeof value.length === "string" &&
    normalizeMarketingLocalizationLength(value.length) !== null &&
    typeof value.emojiStyle === "string" &&
    normalizeMarketingLocalizationEmojiStyle(value.emojiStyle) !== null &&
    typeof value.adaptedTitle === "string" &&
    typeof value.adaptedCaption === "string" &&
    typeof value.adaptedCta === "string" &&
    isStringArray(value.adaptedHashtags) &&
    isStringArray(value.vocabularyNotes) &&
    isStringArray(value.culturalNotes) &&
    isStringArray(value.warnings) &&
    value.approvalRequired === true &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function createMarketingLocalization(
  input: CreateMarketingLocalizationInput = {},
): MarketingLocalization {
  const createdAt = normalizeDateString(input.createdAt ?? "") ?? new Date().toISOString();
  const updatedAt = normalizeDateString(input.updatedAt ?? createdAt) ?? createdAt;
  const tone =
    input.tone && normalizeMarketingLocalizationTone(input.tone)
      ? normalizeMarketingLocalizationTone(input.tone)
      : "professional";
  const length =
    input.length && normalizeMarketingLocalizationLength(input.length)
      ? normalizeMarketingLocalizationLength(input.length)
      : "medium";
  const emojiStyle =
    input.emojiStyle && normalizeMarketingLocalizationEmojiStyle(input.emojiStyle)
      ? normalizeMarketingLocalizationEmojiStyle(input.emojiStyle)
      : "light";

  return {
    id: input.id?.trim() || `marketing-localization-${createdAt}`,
    sourcePackId: input.sourcePackId?.trim() || "unknown-pack",
    targetCountry: input.targetCountry?.trim() || "Unknown",
    targetLanguage: input.targetLanguage?.trim() || "fr",
    targetPlatform: input.targetPlatform?.trim() || "facebook",
    targetCommunityType: normalizeOptionalString(input.targetCommunityType),
    tone: tone ?? "professional",
    length: length ?? "medium",
    emojiStyle: emojiStyle ?? "light",
    adaptedTitle: input.adaptedTitle?.trim() || "",
    adaptedCaption: input.adaptedCaption?.trim() || "",
    adaptedCta: input.adaptedCta?.trim() || "",
    adaptedHashtags: Array.isArray(input.adaptedHashtags)
      ? input.adaptedHashtags.filter((tag) => typeof tag === "string")
      : [],
    vocabularyNotes: Array.isArray(input.vocabularyNotes)
      ? input.vocabularyNotes.filter((note) => typeof note === "string")
      : [],
    culturalNotes: Array.isArray(input.culturalNotes)
      ? input.culturalNotes.filter((note) => typeof note === "string")
      : [],
    warnings: Array.isArray(input.warnings)
      ? input.warnings.filter((warning) => typeof warning === "string")
      : [],
    approvalRequired: true,
    createdAt,
    updatedAt,
  };
}

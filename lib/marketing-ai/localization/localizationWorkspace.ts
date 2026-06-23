import type { MarketingLocalization } from "./localizationModel";

export type LocalizationWorkspaceStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "rejected";

export type LocalizationWorkspaceHistoryEntry = {
  type: "created" | "updated" | "ready_for_review" | "approved" | "rejected" | "note_added";
  message: string;
  createdAt: string;
};

export type CreateLocalizationWorkspaceInput = {
  id?: string;
  sourcePackId?: string;
  localizations?: MarketingLocalization[];
  status?: LocalizationWorkspaceStatus;
  notes?: string[];
  history?: LocalizationWorkspaceHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
};

export type LocalizationWorkspace = {
  id: string;
  sourcePackId: string;
  localizations: MarketingLocalization[];
  status: LocalizationWorkspaceStatus;
  notes: string[];
  history: LocalizationWorkspaceHistoryEntry[];
  approvalRequired: true;
  createdAt: string;
  updatedAt: string;
};

const LOCALIZATION_WORKSPACE_STATUSES: LocalizationWorkspaceStatus[] = [
  "draft",
  "ready_for_review",
  "approved",
  "rejected",
];

const LOCALIZATION_WORKSPACE_HISTORY_TYPES: LocalizationWorkspaceHistoryEntry["type"][] = [
  "created",
  "updated",
  "ready_for_review",
  "approved",
  "rejected",
  "note_added",
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

function resolveNow() {
  return new Date().toISOString();
}

export function normalizeLocalizationWorkspaceStatus(
  value: string,
): LocalizationWorkspaceStatus | null {
  const normalized = value.trim().toLowerCase();

  return LOCALIZATION_WORKSPACE_STATUSES.includes(
    normalized as LocalizationWorkspaceStatus,
  )
    ? (normalized as LocalizationWorkspaceStatus)
    : null;
}

function isLocalizationWorkspaceHistoryEntry(
  value: unknown,
): value is LocalizationWorkspaceHistoryEntry {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    LOCALIZATION_WORKSPACE_HISTORY_TYPES.includes(
      value.type as LocalizationWorkspaceHistoryEntry["type"],
    ) &&
    typeof value.message === "string" &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null
  );
}

function isMarketingLocalizationLike(
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
    typeof value.tone === "string" &&
    typeof value.length === "string" &&
    typeof value.emojiStyle === "string" &&
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

export function isLocalizationWorkspace(
  value: unknown,
): value is LocalizationWorkspace {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.sourcePackId === "string" &&
    Array.isArray(value.localizations) &&
    value.localizations.every(isMarketingLocalizationLike) &&
    typeof value.status === "string" &&
    normalizeLocalizationWorkspaceStatus(value.status) !== null &&
    isStringArray(value.notes) &&
    Array.isArray(value.history) &&
    value.history.every(isLocalizationWorkspaceHistoryEntry) &&
    value.approvalRequired === true &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function createLocalizationWorkspace(
  input: CreateLocalizationWorkspaceInput = {},
): LocalizationWorkspace {
  const now = resolveNow();
  const createdAt = normalizeDateString(input.createdAt ?? "") ?? now;
  const updatedAt = normalizeDateString(input.updatedAt ?? createdAt) ?? createdAt;
  const status =
    input.status && normalizeLocalizationWorkspaceStatus(input.status)
      ? normalizeLocalizationWorkspaceStatus(input.status) ?? "draft"
      : "draft";
  const localizations = Array.isArray(input.localizations)
    ? input.localizations.filter(isMarketingLocalizationLike)
    : [];
  const history: LocalizationWorkspaceHistoryEntry[] = Array.isArray(input.history)
    ? input.history.filter(isLocalizationWorkspaceHistoryEntry)
    : [
        {
          type: "created",
          message: "Localization workspace created.",
          createdAt,
        },
      ];

  return {
    id: input.id?.trim() || `localization-workspace-${createdAt}`,
    sourcePackId:
      input.sourcePackId?.trim() ||
      localizations[0]?.sourcePackId ||
      "unknown-pack",
    localizations,
    status,
    notes: isStringArray(input.notes) ? input.notes : [],
    history,
    approvalRequired: true,
    createdAt,
    updatedAt,
  };
}

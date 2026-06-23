import type { MarketingCommunity } from "./communityModel";

export type CommunityWorkspaceStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "rejected";

export type CommunityWorkspaceHistoryEntry = {
  type: "created" | "updated" | "ready_for_review" | "approved" | "rejected" | "note_added";
  message: string;
  createdAt: string;
};

export type CreateCommunityWorkspaceInput = {
  id?: string;
  country?: string;
  communities?: MarketingCommunity[];
  status?: CommunityWorkspaceStatus;
  notes?: string[];
  history?: CommunityWorkspaceHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
};

export type CommunityWorkspace = {
  id: string;
  country: string;
  communities: MarketingCommunity[];
  status: CommunityWorkspaceStatus;
  notes: string[];
  history: CommunityWorkspaceHistoryEntry[];
  approvalRequired: true;
  createdAt: string;
  updatedAt: string;
};

const COMMUNITY_WORKSPACE_STATUSES: CommunityWorkspaceStatus[] = [
  "draft",
  "ready_for_review",
  "approved",
  "rejected",
];

const COMMUNITY_WORKSPACE_HISTORY_TYPES: CommunityWorkspaceHistoryEntry["type"][] = [
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function normalizeCommunityWorkspaceStatus(
  value: string,
): CommunityWorkspaceStatus | null {
  const normalized = value.trim().toLowerCase();

  return COMMUNITY_WORKSPACE_STATUSES.includes(
    normalized as CommunityWorkspaceStatus,
  )
    ? (normalized as CommunityWorkspaceStatus)
    : null;
}

function isCommunityWorkspaceHistoryEntry(
  value: unknown,
): value is CommunityWorkspaceHistoryEntry {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    COMMUNITY_WORKSPACE_HISTORY_TYPES.includes(
      value.type as CommunityWorkspaceHistoryEntry["type"],
    ) &&
    typeof value.message === "string" &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null
  );
}

function isMarketingCommunityLike(value: unknown): value is MarketingCommunity {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.country === "string" &&
    typeof value.name === "string" &&
    typeof value.platform === "string" &&
    typeof value.language === "string" &&
    typeof value.type === "string" &&
    typeof value.estimatedActivity === "string" &&
    typeof value.audience === "string" &&
    typeof value.relevance === "string" &&
    typeof value.recommendationReason === "string" &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function isCommunityWorkspace(
  value: unknown,
): value is CommunityWorkspace {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.country === "string" &&
    Array.isArray(value.communities) &&
    value.communities.every(isMarketingCommunityLike) &&
    typeof value.status === "string" &&
    normalizeCommunityWorkspaceStatus(value.status) !== null &&
    isStringArray(value.notes) &&
    Array.isArray(value.history) &&
    value.history.every(isCommunityWorkspaceHistoryEntry) &&
    value.approvalRequired === true &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function createCommunityWorkspace(
  input: CreateCommunityWorkspaceInput = {},
): CommunityWorkspace {
  const now = resolveNow();
  const createdAt = normalizeDateString(input.createdAt ?? "") ?? now;
  const updatedAt = normalizeDateString(input.updatedAt ?? createdAt) ?? createdAt;
  const status =
    input.status && normalizeCommunityWorkspaceStatus(input.status)
      ? normalizeCommunityWorkspaceStatus(input.status) ?? "draft"
      : "draft";
  const communities = Array.isArray(input.communities)
    ? input.communities.filter(isMarketingCommunityLike)
    : [];
  const history: CommunityWorkspaceHistoryEntry[] = Array.isArray(input.history)
    ? input.history.filter(isCommunityWorkspaceHistoryEntry)
    : [
        {
          type: "created",
          message: "Community workspace created.",
          createdAt,
        },
      ];

  return {
    id: input.id?.trim() || `community-workspace-${createdAt}`,
    country: input.country?.trim() || communities[0]?.country || "Unknown",
    communities,
    status,
    notes: isStringArray(input.notes) ? input.notes : [],
    history,
    approvalRequired: true,
    createdAt,
    updatedAt,
  };
}

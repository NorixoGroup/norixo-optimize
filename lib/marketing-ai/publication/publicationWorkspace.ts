import type { PublisherOutput } from "../contracts/agentContracts";
import type { PublicationPack } from "./publicationPack";

export type PublicationWorkspaceStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "rejected";

export type PublicationWorkspaceHistoryEntry = {
  type: "created" | "updated" | "ready_for_review" | "approved" | "rejected" | "note_added";
  message: string;
  createdAt: string;
};

export type CreatePublicationWorkspaceInput = {
  id?: string;
  campaignId?: string;
  pack: PublicationPack;
  publisherOutput?: PublisherOutput;
  status?: PublicationWorkspaceStatus;
  notes?: string[];
  history?: PublicationWorkspaceHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
};

export type PublicationWorkspace = {
  id: string;
  campaignId: string;
  pack: PublicationPack;
  publisherOutput?: PublisherOutput;
  status: PublicationWorkspaceStatus;
  notes: string[];
  history: PublicationWorkspaceHistoryEntry[];
  approvalRequired: true;
  createdAt: string;
  updatedAt: string;
};

const PUBLICATION_WORKSPACE_STATUSES: PublicationWorkspaceStatus[] = [
  "draft",
  "ready_for_review",
  "approved",
  "rejected",
];

const PUBLICATION_WORKSPACE_HISTORY_TYPES: PublicationWorkspaceHistoryEntry["type"][] = [
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

export function normalizePublicationWorkspaceStatus(
  value: string,
): PublicationWorkspaceStatus | null {
  const normalized = value.trim().toLowerCase();

  return PUBLICATION_WORKSPACE_STATUSES.includes(
    normalized as PublicationWorkspaceStatus,
  )
    ? (normalized as PublicationWorkspaceStatus)
    : null;
}

function isPublicationWorkspaceHistoryEntry(
  value: unknown,
): value is PublicationWorkspaceHistoryEntry {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    PUBLICATION_WORKSPACE_HISTORY_TYPES.includes(
      value.type as PublicationWorkspaceHistoryEntry["type"],
    ) &&
    typeof value.message === "string" &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null
  );
}

function isPublisherOutput(value: unknown): value is PublisherOutput {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.finalTitle === "string" &&
    typeof value.finalCaption === "string" &&
    typeof value.finalCta === "string" &&
    isStringArray(value.finalHashtags) &&
    isStringArray(value.platformNotes) &&
    isStringArray(value.manualPublishChecklist) &&
    isStringArray(value.warnings) &&
    value.approvalRequired === true
  );
}

export function isPublicationWorkspace(
  value: unknown,
): value is PublicationWorkspace {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.campaignId === "string" &&
    isPlainObject(value.pack) &&
    (value.publisherOutput === undefined || isPublisherOutput(value.publisherOutput)) &&
    typeof value.status === "string" &&
    normalizePublicationWorkspaceStatus(value.status) !== null &&
    Array.isArray(value.notes) &&
    value.notes.every((note) => typeof note === "string") &&
    Array.isArray(value.history) &&
    value.history.every(isPublicationWorkspaceHistoryEntry) &&
    value.approvalRequired === true &&
    typeof value.createdAt === "string" &&
    normalizeDateString(value.createdAt) !== null &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}

export function createPublicationWorkspace(
  input: CreatePublicationWorkspaceInput,
): PublicationWorkspace {
  const now = resolveNow();
  const createdAt = normalizeDateString(input.createdAt ?? "") ?? now;
  const updatedAt = normalizeDateString(input.updatedAt ?? createdAt) ?? createdAt;
  const status =
    input.status && normalizePublicationWorkspaceStatus(input.status)
      ? normalizePublicationWorkspaceStatus(input.status) ?? "draft"
      : "draft";
  const history: PublicationWorkspaceHistoryEntry[] = Array.isArray(input.history)
    ? input.history.filter(isPublicationWorkspaceHistoryEntry)
    : [
        {
          type: "created",
          message: "Publication workspace created.",
          createdAt,
        },
      ];

  return {
    id: input.id?.trim() || `publication-workspace-${createdAt}`,
    campaignId: input.campaignId?.trim() || input.pack.campaignId,
    pack: input.pack,
    publisherOutput: input.publisherOutput,
    status,
    notes: Array.isArray(input.notes)
      ? input.notes.filter((note) => typeof note === "string")
      : [],
    history,
    approvalRequired: true,
    createdAt,
    updatedAt,
  };
}

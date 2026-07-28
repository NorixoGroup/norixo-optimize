import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "./errors";
import { normalizeRepositoryPage, type RepositoryPage, type RepositoryPageRequest } from "./pagination";
import type { BacklinkRepositoryClient } from "./repositoryClient";
import type { BacklinkInsert, BacklinkRow, BacklinkUpdate, WorkspaceId } from "./types";

export type BacklinkNoteRow = BacklinkRow<"backlink_notes">;
type BacklinkNoteInsert = BacklinkInsert<"backlink_notes">;
type BacklinkNoteUpdate = BacklinkUpdate<"backlink_notes">;

type BacklinkNoteSystemColumns =
  | "id"
  | "workspace_id"
  | "author_id"
  | "created_at"
  | "edited_at";

export type CreateBacklinkNoteInput = Omit<BacklinkNoteInsert, BacklinkNoteSystemColumns> & {
  authorId: string;
};

export type UpdateBacklinkNoteInput = Omit<BacklinkNoteUpdate, BacklinkNoteSystemColumns>;

export interface ListBacklinkNotesInput {
  workspaceId: WorkspaceId;
  pagination?: RepositoryPageRequest;
}

function assertNonEmptyUpdate(operation: string, input: UpdateBacklinkNoteInput): void {
  if (Object.keys(input).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one field must be provided for update.",
    });
  }
}

function throwNotFound(operation: string, noteId: string): never {
  throw new BacklinkRepositoryError({
    code: "NOT_FOUND",
    operation,
    message: "The requested record was not found.",
    details: { entity: "backlink_note", resourceId: noteId },
  });
}

export async function getBacklinkNoteById(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  noteId: string,
): Promise<BacklinkNoteRow> {
  const operation = "getBacklinkNoteById";
  const { data, error } = await client
    .from("backlink_notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", noteId)
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, noteId);
  }

  return data;
}

export async function listBacklinkNotes(
  client: BacklinkRepositoryClient,
  input: ListBacklinkNotesInput,
): Promise<RepositoryPage<BacklinkNoteRow>> {
  const operation = "listBacklinkNotes";
  const page = normalizeRepositoryPage(input.pagination);
  const { data, count, error } = await client
    .from("backlink_notes")
    .select("*", { count: "exact" })
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page.from, page.to);

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  const total = count ?? 0;
  return {
    items: data ?? [],
    page: page.page,
    pageSize: page.pageSize,
    total,
    hasNextPage: page.to + 1 < total,
  };
}

export async function createBacklinkNote(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  input: CreateBacklinkNoteInput,
): Promise<BacklinkNoteRow> {
  const operation = "createBacklinkNote";
  const { authorId, ...note } = input;
  const payload: BacklinkNoteInsert = {
    ...note,
    workspace_id: workspaceId,
    author_id: authorId,
  };
  const { data, error } = await client
    .from("backlink_notes")
    .insert(payload)
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return data;
}

export async function updateBacklinkNote(
  client: BacklinkRepositoryClient,
  workspaceId: WorkspaceId,
  noteId: string,
  input: UpdateBacklinkNoteInput,
): Promise<BacklinkNoteRow> {
  const operation = "updateBacklinkNote";
  assertNonEmptyUpdate(operation, input);

  const { data, error } = await client
    .from("backlink_notes")
    .update({ ...input, edited_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", noteId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    return throwNotFound(operation, noteId);
  }

  return data;
}

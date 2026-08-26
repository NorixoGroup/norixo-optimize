import {
  BacklinkRepositoryError,
  normalizeBacklinkRepositoryError,
} from "@/lib/backlinks/repositories/errors";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import type { Database } from "@/types/database.types";

import type {
  AutomationWorkspaceControl,
  GetOrCreateAutomationWorkspaceControlInput,
  UpdateAutomationWorkspaceControlInput,
} from "../workspace-control-types";

type AutomationWorkspaceControlRow =
  Database["public"]["Tables"]["automation_workspace_controls"]["Row"];

function mapAutomationWorkspaceControl(
  row: AutomationWorkspaceControlRow,
): AutomationWorkspaceControl {
  return {
    workspaceId: row.workspace_id,
    backlinksEnabled: row.backlinks_enabled,
    backlinkOutreachScheduleApplyEnabled: row.backlink_outreach_schedule_apply_enabled,
    dryRunOnly: row.dry_run_only,
    lastScheduleApplyAttemptAt: row.last_schedule_apply_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAutomationWorkspaceControl(
  client: BacklinkRepositoryClient,
  workspaceId: string,
): Promise<AutomationWorkspaceControl | null> {
  const operation = "getAutomationWorkspaceControl";
  const { data, error } = await client
    .from("automation_workspace_controls")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  if (!Array.isArray(data) || data.length > 1) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation,
      message: "The database returned an invalid automation workspace control result.",
    });
  }

  return data[0] == null ? null : mapAutomationWorkspaceControl(data[0]);
}

export async function createAutomationWorkspaceControl(
  client: BacklinkRepositoryClient,
  input: GetOrCreateAutomationWorkspaceControlInput,
): Promise<AutomationWorkspaceControl> {
  const operation = "createAutomationWorkspaceControl";
  const { data, error } = await client
    .from("automation_workspace_controls")
    .insert({ workspace_id: input.workspaceId, backlinks_enabled: false })
    .select("*")
    .single();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return mapAutomationWorkspaceControl(data);
}

export async function listAutomationWorkspaceControlsForBacklinkOutreachScheduleApply(
  client: BacklinkRepositoryClient,
  limit: number,
): Promise<AutomationWorkspaceControl[]> {
  const operation = "listAutomationWorkspaceControlsForBacklinkOutreachScheduleApply";
  const { data, error } = await client
    .from("automation_workspace_controls")
    .select(
      "workspace_id, backlinks_enabled, backlink_outreach_schedule_apply_enabled, dry_run_only, disabled_reason, last_schedule_apply_attempt_at, created_at, updated_at",
    )
    .eq("backlinks_enabled", true)
    .eq("dry_run_only", true)
    .eq("backlink_outreach_schedule_apply_enabled", true)
    .is("disabled_reason", null)
    .order("last_schedule_apply_attempt_at", { ascending: true, nullsFirst: true })
    .order("workspace_id", { ascending: true })
    .limit(limit);

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return (
    data?.map((row) => ({
      workspaceId: row.workspace_id,
      backlinksEnabled: row.backlinks_enabled,
      backlinkOutreachScheduleApplyEnabled: row.backlink_outreach_schedule_apply_enabled,
      dryRunOnly: row.dry_run_only,
      lastScheduleApplyAttemptAt: row.last_schedule_apply_attempt_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) ?? []
  );
}

export async function listAutomationWorkspaceControlsForBacklinkReverification(
  client: BacklinkRepositoryClient,
  limit: number,
): Promise<AutomationWorkspaceControl[]> {
  const operation = "listAutomationWorkspaceControlsForBacklinkReverification";
  const { data, error } = await client
    .from("automation_workspace_controls")
    .select(
      "workspace_id, backlinks_enabled, backlink_outreach_schedule_apply_enabled, dry_run_only, disabled_reason, last_schedule_apply_attempt_at, created_at, updated_at",
    )
    .eq("backlinks_enabled", true)
    .is("disabled_reason", null)
    .order("workspace_id", { ascending: true })
    .limit(limit);

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }

  return (
    data?.map((row) => ({
      workspaceId: row.workspace_id,
      backlinksEnabled: row.backlinks_enabled,
      backlinkOutreachScheduleApplyEnabled: row.backlink_outreach_schedule_apply_enabled,
      dryRunOnly: row.dry_run_only,
      lastScheduleApplyAttemptAt: row.last_schedule_apply_attempt_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) ?? []
  );
}

export async function createOrGetAutomationWorkspaceControl(
  client: BacklinkRepositoryClient,
  input: GetOrCreateAutomationWorkspaceControlInput,
): Promise<{
  kind: "created" | "existing";
  control: AutomationWorkspaceControl;
}> {
  try {
    return {
      kind: "created",
      control: await createAutomationWorkspaceControl(client, input),
    };
  } catch (error) {
    if (!(error instanceof BacklinkRepositoryError) || error.code !== "CONFLICT") {
      throw error;
    }

    const control = await getAutomationWorkspaceControl(client, input.workspaceId);
    if (control != null) {
      return { kind: "existing", control };
    }

    throw new BacklinkRepositoryError({
      code: "CONFLICT",
      operation: "createOrGetAutomationWorkspaceControl",
      message: "The operation conflicts with existing data.",
    });
  }
}

export async function updateAutomationWorkspaceControl(
  client: BacklinkRepositoryClient,
  input: UpdateAutomationWorkspaceControlInput,
): Promise<AutomationWorkspaceControl> {
  const operation = "updateAutomationWorkspaceControl";
  const patch: {
    backlinks_enabled?: boolean;
    backlink_outreach_schedule_apply_enabled?: boolean;
    dry_run_only?: boolean;
  } = {};
  if (typeof input.backlinksEnabled === "boolean") {
    patch.backlinks_enabled = input.backlinksEnabled;
  }
  if (typeof input.backlinkOutreachScheduleApplyEnabled === "boolean") {
    patch.backlink_outreach_schedule_apply_enabled =
      input.backlinkOutreachScheduleApplyEnabled;
  }
  if (typeof input.dryRunOnly === "boolean") {
    patch.dry_run_only = input.dryRunOnly;
  }
  if (Object.keys(patch).length === 0) {
    throw new BacklinkRepositoryError({
      code: "VALIDATION",
      operation,
      message: "At least one automation workspace control flag must be provided.",
    });
  }
  const { data, error } = await client
    .from("automation_workspace_controls")
    .update(patch)
    .eq("workspace_id", input.workspaceId)
    .select("*");

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new BacklinkRepositoryError({
      code: "NOT_FOUND",
      operation,
      message: "The requested record was not found.",
    });
  }
  if (data.length > 1) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation,
      message: "The database returned an invalid automation workspace control result.",
    });
  }

  return mapAutomationWorkspaceControl(data[0]);
}

export async function markAutomationWorkspaceControlBacklinkOutreachScheduleApplyAttempt(
  client: BacklinkRepositoryClient,
  input: {
    workspaceId: string;
    attemptedAt: string;
  },
): Promise<AutomationWorkspaceControl> {
  const operation = "markAutomationWorkspaceControlBacklinkOutreachScheduleApplyAttempt";
  const { data, error } = await client
    .from("automation_workspace_controls")
    .update({ last_schedule_apply_attempt_at: input.attemptedAt })
    .eq("workspace_id", input.workspaceId)
    .select("*")
    .maybeSingle();

  if (error != null) {
    throw normalizeBacklinkRepositoryError(operation, error);
  }
  if (data == null) {
    throw new BacklinkRepositoryError({
      code: "NOT_FOUND",
      operation,
      message: "The requested record was not found.",
    });
  }

  return mapAutomationWorkspaceControl(data);
}

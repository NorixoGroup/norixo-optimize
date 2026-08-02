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
  if (row.dry_run_only !== true) {
    throw new BacklinkRepositoryError({
      code: "DATABASE",
      operation: "mapAutomationWorkspaceControl",
      message: "The database returned an invalid automation workspace control.",
    });
  }

  return {
    workspaceId: row.workspace_id,
    backlinksEnabled: row.backlinks_enabled,
    dryRunOnly: true,
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
  const { data, error } = await client
    .from("automation_workspace_controls")
    .update({ backlinks_enabled: input.backlinksEnabled })
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

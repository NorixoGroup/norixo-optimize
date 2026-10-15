import { normalizeBacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";

import type { AutomationTask } from "../types";
import { mapAutomationTask } from "./automationTasksRepository";

/** Read-only: every task of one run, scoped to its workspace. Run resume uses it to check state before and after work. */
export async function listAutomationTasksForRun(
  client: BacklinkRepositoryClient,
  input: { workspaceId: string; runId: string },
): Promise<AutomationTask[]> {
  const operation = "listAutomationTasksForRun";
  const { data, error } = await client
    .from("automation_tasks")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("run_id", input.runId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(50);
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return (data ?? []).map(mapAutomationTask);
}

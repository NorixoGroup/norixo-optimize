import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import { normalizeBacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";

export type BacklinkPromotionAutoApplyTaskRecord = {
  id: string;
  runId: string;
  status: string;
  taskKind: string;
  output: unknown;
};

/**
 * Read-only listing, used only to select candidates. Eligibility itself is
 * never decided here — the auto-apply RPC re-derives it authoritatively.
 */
export async function listCompletedBacklinkPromotionPreviewTasks(
  client: BacklinkRepositoryClient,
  workspaceId: string,
  limit: number,
): Promise<BacklinkPromotionAutoApplyTaskRecord[]> {
  const operation = "listCompletedBacklinkPromotionPreviewTasks";
  const { data, error } = await client
    .from("automation_tasks")
    .select("id,run_id,status,task_kind,output")
    .eq("workspace_id", workspaceId)
    .eq("system", "backlinks")
    .eq("task_kind", "backlinks.promotion.preview")
    .eq("status", "completed")
    .order("completed_at", { ascending: true })
    .limit(limit);
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return (data ?? []).map((row) => ({
    id: row.id,
    runId: row.run_id,
    status: row.status,
    taskKind: row.task_kind,
    output: row.output,
  }));
}

import { normalizeBacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";

/** Workspaces whose existing automation control allows backlinks automation. Read-only. */
export async function listBacklinksEnabledWorkspaceIds(
  client: BacklinkRepositoryClient,
  limit: number,
): Promise<string[]> {
  const operation = "listBacklinksEnabledWorkspaceIds";
  const { data, error } = await client
    .from("automation_workspace_controls")
    .select("workspace_id")
    .eq("backlinks_enabled", true)
    .is("disabled_reason", null)
    .order("workspace_id", { ascending: true })
    .limit(limit);
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return (data ?? []).map((row) => row.workspace_id);
}

function extractQueries(input: unknown): string[] {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return [];
  const searches = (input as { searches?: unknown }).searches;
  if (!Array.isArray(searches)) return [];
  const queries: string[] = [];
  for (const search of searches) {
    if (typeof search !== "object" || search === null) continue;
    const query = (search as { query?: unknown }).query;
    if (typeof query === "string" && query.trim().length > 0) queries.push(query.trim());
  }
  return queries;
}

/**
 * Queries already planned in earlier discovery preview tasks (manual or scheduled), newest first.
 * A planned query counts as used even if its run later failed. Read-only.
 */
export async function listRecentBacklinkDiscoveryQueries(
  client: BacklinkRepositoryClient,
  input: { workspaceId: string; since: string; limit: number },
): Promise<string[]> {
  const operation = "listRecentBacklinkDiscoveryQueries";
  const { data, error } = await client
    .from("automation_tasks")
    .select("input")
    .eq("workspace_id", input.workspaceId)
    .eq("task_kind", "backlinks.discovery.preview")
    .gte("created_at", input.since)
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (error != null) throw normalizeBacklinkRepositoryError(operation, error);
  return (data ?? []).flatMap((row) => extractQueries(row.input));
}

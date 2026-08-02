import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

async function main(): Promise<void> {
  const migration = await readFile("supabase/migrations/20260803010000_create_automation_runs.sql", "utf8");
  for (const fragment of ["unique (workspace_id, system, run_kind, idempotency_key)", "alter table public.automation_runs enable row level security", "backlinks_enabled boolean not null default false", "dry_run_only boolean not null default true", "status = 'completed'", "status = 'failed'", "status = 'cancelled'", "where workspace_id = p_workspace_id and id = p_run_id and status = 'queued'", "where workspace_id = p_workspace_id and id = p_run_id and status = 'running'", "status in ('queued', 'running')"]) assert(migration.includes(fragment), `Missing SQL invariant: ${fragment}`);
  console.log("PASS — Automation runs SQL smoke");
}
void main();

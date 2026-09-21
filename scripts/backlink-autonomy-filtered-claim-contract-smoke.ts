import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const migration = await readFile("supabase/migrations/20260922000000_add_claim_next_backlink_autonomy_task.sql", "utf8");
  const repository = await readFile("lib/automation/repositories/automationTasksRepository.ts", "utf8");
  const generic = await readFile("supabase/migrations/20260803030000_add_automation_task_dependencies.sql", "utf8");
  for (const kind of ["backlinks.contact_resolution", "backlinks.contact_validation", "backlinks.campaign_prepare", "backlinks.draft_prepare", "backlinks.outreach_decision"]) assert(migration.includes(`'${kind}'`), `Missing allowed kind ${kind}`);
  for (const fragment of ["claim_next_backlink_autonomy_task", "t.status = 'queued'", "t.available_at <= p_claimed_at", "t.attempt_count < t.max_attempts", "dependency.status = 'completed'", "order by t.priority, t.available_at, t.scheduled_at, t.created_at", "for update of t skip locked", "attempt_count = attempt_count + 1", "lease_expires_at = p_claimed_at + make_interval", "c.backlink_autonomy_enabled", "c.disabled_reason is null"]) assert(migration.includes(fragment), `Missing filtered claim invariant ${fragment}`);
  assert(repository.includes('"claim_next_backlink_autonomy_task"'), "Repository must call dedicated filtered RPC");
  assert(repository.includes("claimNextBacklinkAutonomyTask"), "Dedicated repository adapter missing");
  assert(generic.includes("create or replace function public.claim_next_automation_task("), "Generic claim RPC must remain present");
  assert(!migration.includes("p_task_kinds"), "Filtered RPC must not accept arbitrary task kinds");
  console.log("PASS — Backlink autonomy filtered claim contract smoke");
}
void main();

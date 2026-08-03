import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const [tasksMigration, dependencyMigration] = await Promise.all([
    readFile("supabase/migrations/20260803020000_create_automation_tasks.sql", "utf8"),
    readFile(
      "supabase/migrations/20260803030000_add_automation_task_dependencies.sql",
      "utf8",
    ),
  ]);

  for (const requirement of [
    "add column depends_on_task_id uuid null",
    "references public.automation_tasks(id) on delete restrict",
    "validate_automation_task_dependency",
    "AUTOMATION_TASK_DEPENDENCY_SCOPE_MISMATCH",
    "AUTOMATION_TASK_SELF_DEPENDENCY",
    "AUTOMATION_TASK_DEPENDENCY_CYCLE",
    "before insert or update of depends_on_task_id, workspace_id, run_id",
    "automation_tasks_dependency_claim_idx",
    "workspace_id,",
    "run_id,",
    "depends_on_task_id,",
    "automation_tasks_depends_on_task_id_idx",
    "create or replace function public.claim_next_automation_task",
    "t.depends_on_task_id is null",
    "dependency.id = t.depends_on_task_id",
    "dependency.workspace_id = t.workspace_id",
    "dependency.run_id = t.run_id",
    "dependency.status = 'completed'",
    "for update of t skip locked",
    "order by t.priority, t.available_at, t.scheduled_at, t.created_at",
    "attempt_count = attempt_count + 1",
    "lease_expires_at = p_claimed_at + make_interval(secs => p_lease_duration_seconds)",
    "security definer",
    "set search_path = public",
    "to service_role",
  ]) {
    assert(dependencyMigration.includes(requirement), `Missing dependency requirement: ${requirement}`);
  }

  assert(
    !dependencyMigration.includes("dependency.status in"),
    "a dependency must be claimable only when completed",
  );
  for (const retainedRequirement of [
    "enable row level security",
    "automation_tasks_select_members",
    "automation_tasks_insert_admins",
    "c.backlinks_enabled and c.dry_run_only",
    "attempt_count=attempt_count+1",
    "lease_expires_at=p_claimed_at+make_interval",
    "heartbeat_automation_task",
    "complete_automation_task",
    "fail_automation_task",
    "reclaim_expired_automation_tasks",
    "cancel_automation_task",
  ]) {
    assert(tasksMigration.includes(retainedRequirement), `Missing retained task behavior: ${retainedRequirement}`);
  }

  console.log("PASS — Automation task dependencies SQL smoke");
}

void main();

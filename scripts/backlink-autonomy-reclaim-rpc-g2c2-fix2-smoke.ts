import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = "supabase/migrations/20260923000000_add_reclaim_expired_backlink_autonomy_tasks.sql";
const autonomyKinds = [
  "backlinks.contact_resolution",
  "backlinks.contact_validation",
  "backlinks.campaign_prepare",
  "backlinks.draft_prepare",
  "backlinks.outreach_decision",
];

async function main() {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create or replace function public\.reclaim_expired_backlink_autonomy_tasks\(/);
  for (const parameter of ["p_workspace_id uuid", "p_run_id uuid", "p_reclaimed_at timestamptz", "p_limit integer"]) {
    assert(sql.includes(parameter), `Missing required parameter ${parameter}`);
  }
  for (const predicate of [
    "workspace_id = p_workspace_id",
    "run_id = p_run_id",
    "status = 'running'",
    "lease_expires_at <= p_reclaimed_at",
    "for update skip locked",
    "attempt_count < max_attempts then 'queued' else 'dead_letter'",
    "available_at = case when attempt_count < max_attempts then p_reclaimed_at else available_at end",
    "error_code = 'AUTOMATION_TASK_LEASE_EXPIRED'",
    "grant execute on function public.reclaim_expired_backlink_autonomy_tasks",
    "to service_role",
  ]) assert(sql.includes(predicate), `Missing reclaim invariant ${predicate}`);
  assert.match(sql, /if p_limit is null or p_limit not between 1 and 100 then/, "NULL, zero, negative, and over-100 limits must fail closed");
  assert.match(sql, /limit p_limit/, "Valid limits must remain bounded by p_limit");
  assert.doesNotMatch(sql, /limit\s+null|coalesce\s*\(\s*p_limit/i, "No NULL/unbounded limit fallback is allowed");
  for (const kind of autonomyKinds) assert(sql.includes(`'${kind}'`), `Missing autonomy kind ${kind}`);
  assert.equal((sql.match(/'backlinks\.[^']+'/g) ?? []).length, autonomyKinds.length, "Exactly five autonomy kinds must be hardcoded");
  assert.doesNotMatch(sql, /p_task_kinds|task_kind\s*=\s*any/i, "Caller must not widen the task-kind filter");
  assert.match(sql, /task_kind in \([\s\S]*'backlinks\.outreach_decision'[\s\S]*\)/, "Same-run non-autonomy kinds are excluded by mandatory SQL filter");
  assert.doesNotMatch(sql, /attempt_count\s*=\s*0/, "Reclaim must not reset attempts");
  assert.doesNotMatch(sql, /insert into|update public\.backlink_|resend|linkedin/i, "RPC must only transition automation task lifecycle");
  console.log("PASS — Backlink autonomy filtered reclaim RPC G2C.2-FIX2 smoke");
}

void main();

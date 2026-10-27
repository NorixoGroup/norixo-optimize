import { readFile, readdir } from "node:fs/promises";

import {
  canRunBacklinkOutreachLiveAutoSend,
} from "../lib/automation/backlink-outreach-live-auto-send-service";
import { canRunBacklinkOutreachLiveFollowUp } from "../lib/automation/backlink-outreach-live-follow-up-service";
import {
  runBacklinkOutreachScheduleApplyOrchestration,
  type BacklinkOutreachScheduleApplyOrchestrationDependencies,
} from "../lib/automation/backlink-outreach-schedule-apply-orchestrator";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const MIGRATION = "supabase/migrations/20261027120000_decouple_automation_preview_claims_from_dry_run_only.sql";
const ROLLBACK = "scripts/backlink-dry-run-decoupling-rollback.sql";

function stripSqlComments(sql: string): string {
  return sql.replace(/--.*$/gm, "");
}

async function sendGatesStayClosed(): Promise<void> {
  // Truth table: an external send needs ALL of backlinks, capability, dry_run_only=false and no kill switch.
  for (const backlinksEnabled of [true, false]) {
    for (const backlinkOutreachScheduleApplyEnabled of [true, false]) {
      for (const dryRunOnly of [true, false]) {
        for (const disabledReason of [null, "paused"]) {
          const control = { backlinksEnabled, backlinkOutreachScheduleApplyEnabled, dryRunOnly, disabledReason };
          const expected = backlinksEnabled && backlinkOutreachScheduleApplyEnabled && !dryRunOnly && disabledReason === null;
          assert(canRunBacklinkOutreachLiveAutoSend(control) === expected, `live auto send gate: ${JSON.stringify(control)}`);
          assert(canRunBacklinkOutreachLiveFollowUp(control) === expected, `live follow-up gate: ${JSON.stringify(control)}`);
        }
      }
    }
  }
  assert(!canRunBacklinkOutreachLiveAutoSend(null) && !canRunBacklinkOutreachLiveFollowUp(null), "missing control must never send");

  // The sources and SQL gates that actually send are untouched and still demand dry_run_only = false.
  const initialSendSql = await readFile("supabase/migrations/20261001150000_enforce_backlink_initial_email_send_gates.sql", "utf8");
  assert(/control\.dry_run_only is not false/.test(initialSendSql) && initialSendSql.includes("BACKLINK_SEND_DRY_RUN"), "initial send SQL gate");
  const followUpSql = await readFile("supabase/migrations/20260917203000_fix_backlink_outreach_follow_up_send_rpc_ambiguity.sql", "utf8");
  assert(/workspace_control\.dry_run_only is not false/.test(followUpSql) && followUpSql.includes("FOLLOW_UP_SEND_DRY_RUN"), "follow-up send SQL gate");
  const manualSend = await readFile("lib/backlinks/services/outreachEmailSendService.ts", "utf8");
  assert(manualSend.includes("dryRunOnly === true"), "manual send service must still refuse dry-run workspaces");
  const approvedSend = await readFile("lib/backlinks/services/outreachApprovedAutoSendService.ts", "utf8");
  assert(approvedSend.includes("dryRunOnly !== false"), "approved auto-send must still require dry_run_only=false");
  const sendOne = await readFile("app/api/internal/automation/backlinks/outreach/send-one/route.ts", "utf8");
  assert(sendOne.includes("control.dry_run_only === false"), "send-one route must still require dry_run_only=false");
}

async function schedulingIsDecoupled(): Promise<void> {
  const applied: string[] = [];
  const control = (id: string, over: Partial<{ backlinksEnabled: boolean; backlinkOutreachScheduleApplyEnabled: boolean; dryRunOnly: boolean; disabledReason: string | null }>) => ({
    workspaceId: `00000000-0000-4000-8000-00000000000${id}`,
    backlinksEnabled: true,
    backlinkOutreachScheduleApplyEnabled: true,
    dryRunOnly: false,
    disabledReason: null as string | null,
    lastScheduleApplyAttemptAt: null as string | null,
    ...over,
  });
  const dependencies: BacklinkOutreachScheduleApplyOrchestrationDependencies = {
    now: () => "2026-10-27T06:00:00.000Z",
    listEligibleWorkspaces: async () => [
      control("1", { dryRunOnly: false }), // live-send workspace: now eligible
      control("2", { dryRunOnly: true }), // legacy dry-run workspace: still eligible
      control("3", { backlinkOutreachScheduleApplyEnabled: false }), // capability off: not eligible
      control("4", { backlinksEnabled: false }), // backlinks off: not eligible
      control("5", { disabledReason: "paused" }), // kill switch: not eligible
    ],
    applyWorkspace: async (input) => {
      applied.push(input.workspaceId.slice(-1));
      return {
        workspaceId: input.workspaceId,
        runDisposition: "created",
        result: { scanned: 0, scheduled: 0, existing: 0, notApplicable: 0, conflicts: 0, failed: 0, items: [] },
      } as never;
    },
  };
  const summary = await runBacklinkOutreachScheduleApplyOrchestration(dependencies, { workspaceLimit: 25 });
  assert(summary.workspacesScanned === 2, "exactly the two enabled, non-disabled workspaces are scanned");
  assert(applied.slice().sort().join(",") === "1,2", "dry_run_only=false workspace is scheduled; disabled / off workspaces are not");
}

async function typeScriptFiltersAreRemoved(): Promise<void> {
  const mustNotFilter: ReadonlyArray<readonly [string, RegExp]> = [
    ["lib/automation/run-service.ts", /dryRunOnly\)/],
    ["lib/automation/repositories/automationWorkspaceControlsRepository.ts", /eq\("dry_run_only", true\)/],
    ["app/api/internal/automation/backlinks/outreach/schedule/status/route.ts", /eq\("dry_run_only", true\)/],
    ["app/api/internal/automation/backlinks/outreach/tick/route.ts", /eq\("dry_run_only", true\)/],
    ["lib/automation/backlink-outreach-schedule-apply-runner.ts", /dry_run_only !== true/],
    ["lib/automation/backlink-outreach-schedule-apply-orchestrator.ts", /dryRunOnly === true/],
    ["lib/automation/backlink-outreach-maintenance-orchestrator.ts", /dryRunOnly === true/],
  ];
  for (const [file, pattern] of mustNotFilter) {
    const source = await readFile(file, "utf8");
    assert(!pattern.test(source), `${file} must not gate preview / scheduling work on dry_run_only`);
  }
  const runService = await readFile("lib/automation/run-service.ts", "utf8");
  assert(runService.includes('input.mode !== "dry_run"') && runService.includes("automation_disabled"), "run-service keeps mode and backlinks_enabled checks");
}

async function migrationContract(): Promise<void> {
  const raw = await readFile(MIGRATION, "utf8");
  const sql = stripSqlComments(raw);
  const names = await readdir("supabase/migrations");
  const latestOther = names.filter((n) => !n.startsWith("20261027120000_") && /^\d{14}_/.test(n)).sort().pop() ?? "";
  assert("20261027120000" > latestOther.slice(0, 14) || latestOther.startsWith("20261027") === false, "migration must be the newest version");

  assert((sql.match(/create or replace function/gi) ?? []).length === 2, "exactly two functions are replaced");
  assert(/public\.claim_next_automation_task\(/.test(sql) && /public\.claim_backlink_discovery_task_by_id\(/.test(sql), "the two claim functions");
  assert(!/\b(grant|revoke)\b/i.test(sql.replace(/comment on column[^;]*;/gi, "")), "owner / ACL must be preserved: no GRANT / REVOKE");
  const codeOnly = sql.replace(/comment on column[^;]*;/gi, "");
  assert(!/backlink_outreach|reserve_backlink_brave|backlink_brave|follow_up|send_gate|emails?\b/i.test(codeOnly), "no send, outreach or Brave budget object is touched");
  assert(/security definer/i.test(sql) && /set search_path = public/.test(sql), "SECURITY DEFINER and fixed search_path preserved");

  const [genericPart, byIdPart] = sql.split(/create or replace function public\.claim_backlink_discovery_task_by_id/i);
  assert(byIdPart !== undefined, "claim by id definition present");
  // claim by id: no dry_run_only, every other guard kept.
  assert(!/c\.dry_run_only/.test(byIdPart.split("comment on column")[0]!), "claim by id no longer requires dry_run_only");
  for (const guard of ["r.mode = 'dry_run'", "c.backlinks_enabled", "c.disabled_reason is null", "r.status = 'running'", "t.task_kind = 'backlinks.discovery.preview'", "t.attempt_count < t.max_attempts", "dependency.status = 'completed'"]) {
    assert(byIdPart.includes(guard), `claim by id keeps guard: ${guard}`);
  }
  // generic claim: dry_run_only still required unless preview kind of a dry_run run with no kill switch.
  assert(/c\.dry_run_only\s+or\s*\(/.test(genericPart), "generic claim keeps dry_run_only as the default requirement");
  const kinds = [...genericPart.matchAll(/'(backlinks\.[a-z_.]+)'/g)].map((m) => m[1]!);
  assert(
    JSON.stringify(kinds.slice().sort()) === JSON.stringify(["backlinks.campaign.preview", "backlinks.discovery.preview", "backlinks.promotion.preview", "backlinks.qualification.preview"]),
    `exemption list must be exactly the four preview kinds, got ${kinds.join(",")}`,
  );
  assert(genericPart.includes("r.mode = 'dry_run'") && genericPart.includes("c.backlinks_enabled"), "generic exemption requires a dry_run run and backlinks enabled");
  // The kill switch is a top-level condition (before the dry_run_only / exemption block), not part of the exemption.
  const whereClause = genericPart.slice(genericPart.indexOf("where t.workspace_id"));
  const killSwitchAt = whereClause.indexOf("and c.disabled_reason is null");
  const dryRunAt = whereClause.indexOf("c.dry_run_only");
  assert(killSwitchAt !== -1 && dryRunAt !== -1 && killSwitchAt < dryRunAt, "generic claim honors disabled_reason as a main condition, before the dry_run_only block");
  assert((whereClause.match(/c\.disabled_reason is null/g) ?? []).length === 1, "disabled_reason is checked once, at the top level");
  assert(/for update of t skip locked/.test(genericPart) && /for update of t skip locked/.test(byIdPart), "row locking preserved");

  // Rollback is documented, outside migrations/, and restores the original conditions.
  const rollback = stripSqlComments(await readFile(ROLLBACK, "utf8"));
  assert(!ROLLBACK.startsWith("supabase/migrations/"), "rollback must never be auto-applied");
  assert((rollback.match(/and c\.dry_run_only\b/g) ?? []).length === 2, "rollback restores dry_run_only in both functions");
  assert((rollback.match(/create or replace function/gi) ?? []).length === 2, "rollback replaces the same two functions");
}

async function main(): Promise<void> {
  await sendGatesStayClosed();
  await schedulingIsDecoupled();
  await typeScriptFiltersAreRemoved();
  await migrationContract();
  console.log("PASS — Backlink dry_run_only decoupling smoke");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

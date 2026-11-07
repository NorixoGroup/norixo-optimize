import assert from "node:assert/strict";
import { BACKLINK_AUTONOMY_IGMS_PILOT_WORKSPACE_ID, runBacklinkAutonomyIgmsPilot, type BacklinkAutonomyIgmsPilotPromotion } from "../lib/automation/backlink-autonomy-igms-pilot";

const IGMS_APPLICATION = "11111111-1111-4111-8111-111111111111";
const OTHER_APPLICATION = "22222222-2222-4222-8222-222222222222";
const now = "2026-11-07T10:00:00.000Z";

function promotion(overrides: Partial<BacklinkAutonomyIgmsPilotPromotion> = {}): BacklinkAutonomyIgmsPilotPromotion {
  return {
    applicationId: IGMS_APPLICATION, workspaceId: BACKLINK_AUTONOMY_IGMS_PILOT_WORKSPACE_ID, runId: "promotion-run", promotionTaskId: "promotion-task",
    promotionTaskKind: "backlinks.promotion.preview", promotionTaskStatus: "completed", domainId: "domain-igms", opportunityId: "opportunity-igms", actorUserId: "actor", applied: true,
    domain: { id: "domain-igms", workspaceId: BACKLINK_AUTONOMY_IGMS_PILOT_WORKSPACE_ID, hostname: "www.igms.com", archivedAt: null },
    opportunity: { id: "opportunity-igms", workspaceId: BACKLINK_AUTONOMY_IGMS_PILOT_WORKSPACE_ID, domainId: "domain-igms", archivedAt: null }, ...overrides,
  };
}

function fixture(value: BacklinkAutonomyIgmsPilotPromotion | null = promotion()) {
  let creates = 0, tasks = 0, workers = 0, paidReservations = 0, emails = 0, dryRunOnly = true;
  let consumed: { id: string } | null = null;
  const deps: any = {
    getWorkspaceControl: async () => ({ workspaceId: BACKLINK_AUTONOMY_IGMS_PILOT_WORKSPACE_ID, backlinksEnabled: true, backlinkAutonomyEnabled: true, backlinkOutreachScheduleApplyEnabled: false, dryRunOnly, disabledReason: null }),
    loadPromotion: async (id: string) => id === value?.applicationId ? value : null,
    getDomain: async () => value!.domain,
    getOpportunity: async () => value!.opportunity,
    createOrGetRun: async () => {
      creates += 1;
      if (consumed != null) return { kind: "existing", run: { id: consumed.id } };
      consumed = { id: "pilot-run" };
      return { kind: "created", run: { id: consumed.id } };
    },
    createOrGetTask: async () => { tasks += 1; return { kind: "created", task: { id: "pilot-task" } }; },
    runWorker: async () => { workers += 1; return { kind: "empty" }; },
  };
  return { deps, counts: () => ({ creates, tasks, workers, paidReservations, emails }), disableDryRun: () => { dryRunOnly = false; } };
}
const input = (promotionApplicationId: string | null) => ({ config: { enabled: true, promotionApplicationId }, at: now, workerId: "test" });

async function main() {
// Missing / malformed / unknown selectors never create a run or task.
for (const selector of [null, "not-a-uuid", OTHER_APPLICATION]) {
  const f = fixture(); const result = await runBacklinkAutonomyIgmsPilot(f.deps, input(selector));
  assert.ok(result.disposition === "rejected"); assert.deepEqual(f.counts(), { creates: 0, tasks: 0, workers: 0, paidReservations: 0, emails: 0 });
}
// Exact iGMS promotion seeds one dry-run and only that new run is worked.
{ const f = fixture(); const result = await runBacklinkAutonomyIgmsPilot(f.deps, input(IGMS_APPLICATION)); assert.equal(result.disposition, "completed"); assert.deepEqual(f.counts(), { creates: 1, tasks: 1, workers: 1, paidReservations: 0, emails: 0 }); }
// The pilot is closed unless the selected workspace is explicitly dry-run only.
{ const f = fixture(); f.disableDryRun(); const result = await runBacklinkAutonomyIgmsPilot(f.deps, input(IGMS_APPLICATION)); assert.equal(result.reason, "PILOT_DRY_RUN_REQUIRED"); assert.equal(f.counts().creates, 0); }
// VRConnection/VacationRentalFormula/fixture-shaped candidates and a foreign workspace fail before writes.
for (const altered of [promotion({ domain: { ...promotion().domain, hostname: "www.vrconnection.com" } }), promotion({ domain: { ...promotion().domain, hostname: "vacationrentalformula.com" } }), promotion({ domain: { ...promotion().domain, hostname: "fixture.example" } }), promotion({ workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })]) {
  const f = fixture(altered); const result = await runBacklinkAutonomyIgmsPilot(f.deps, input(IGMS_APPLICATION)); assert.equal(result.disposition, "rejected"); assert.equal(f.counts().creates, 0);
}
// Two concurrent invocations use the same persistent key: one winner only; loser never seeds or claims.
{ const f = fixture(); const results = await Promise.all([runBacklinkAutonomyIgmsPilot(f.deps, input(IGMS_APPLICATION)), runBacklinkAutonomyIgmsPilot(f.deps, input(IGMS_APPLICATION))]); assert.equal(results.filter((r) => r.disposition === "completed").length, 1); assert.equal(results.filter((r) => r.disposition === "already_consumed").length, 1); assert.deepEqual(f.counts(), { creates: 2, tasks: 1, workers: 1, paidReservations: 0, emails: 0 }); }
// A second invocation (including if old run has pending/retry tasks) cannot reclaim or call a worker.
{ const f = fixture(); await runBacklinkAutonomyIgmsPilot(f.deps, input(IGMS_APPLICATION)); const again = await runBacklinkAutonomyIgmsPilot(f.deps, input(IGMS_APPLICATION)); assert.equal(again.disposition, "already_consumed"); assert.deepEqual(f.counts(), { creates: 2, tasks: 1, workers: 1, paidReservations: 0, emails: 0 }); }
console.log("backlink-autonomy-igms-pilot-smoke: ok");
}

void main();

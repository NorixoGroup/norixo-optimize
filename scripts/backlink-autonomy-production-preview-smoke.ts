import assert from "node:assert/strict";
import { createBacklinkAutonomyProductionPreviewRunner } from "@/lib/automation/backlink-autonomy-production-preview";

const ids = { w: "00000000-0000-4000-8000-000000000001", r: "00000000-0000-4000-8000-000000000002", t: "00000000-0000-4000-8000-000000000003", d: "00000000-0000-4000-8000-000000000004", o: "00000000-0000-4000-8000-000000000005", a: "00000000-0000-4000-8000-000000000006" };
async function main() {
  const writes = { tasks: 0, runs: 0, claims: 0, complete: 0, fail: 0, contacts: 0, campaigns: 0, outreach: 0, drafts: 0, ready: 0, sender: 0, forms: 0 };
  let workspaceReads = 0, promotionReads = 0;
  const preview = createBacklinkAutonomyProductionPreviewRunner({
    runtimeConfig: () => ({ autonomyEnabled: true }),
    listWorkspaceControls: async () => { workspaceReads++; return [{ workspaceId: ids.w, backlinksEnabled: true, backlinkAutonomyEnabled: true, backlinkOutreachScheduleApplyEnabled: false, dryRunOnly: false, disabledReason: null }]; },
    listAppliedPromotions: async () => { promotionReads++; return [{ applicationId: "application", workspaceId: ids.w, runId: ids.r, promotionTaskId: ids.t, promotionTaskKind: "backlinks.promotion.preview", promotionTaskStatus: "completed", domainId: ids.d, opportunityId: ids.o, actorUserId: ids.a, applied: true }]; },
    getDomain: async () => ({ id: ids.d, workspaceId: ids.w, archivedAt: null }), getOpportunity: async () => ({ id: ids.o, workspaceId: ids.w, domainId: ids.d, archivedAt: null }),
  });
  const result = await preview({ now: "2026-09-22T00:00:00.000Z" }); assert.equal(result.outcome, "preview"); assert.equal(result.proposed.length, 1); assert.deepEqual(writes, { tasks: 0, runs: 0, claims: 0, complete: 0, fail: 0, contacts: 0, campaigns: 0, outreach: 0, drafts: 0, ready: 0, sender: 0, forms: 0 });
  const off = createBacklinkAutonomyProductionPreviewRunner({ ...({} as any), runtimeConfig: () => ({ autonomyEnabled: false }), listWorkspaceControls: async () => { throw new Error("must not read"); } }); assert.equal((await off()).outcome, "disabled"); assert.equal(workspaceReads, 1); assert.equal(promotionReads, 1);

  let workspaceOffPromotionReads = 0;
  const workspaceOff = createBacklinkAutonomyProductionPreviewRunner({
    runtimeConfig: () => ({ autonomyEnabled: true }),
    listWorkspaceControls: async () => [],
    listAppliedPromotions: async () => {
      workspaceOffPromotionReads++;
      return [];
    },
    getDomain: async () => {
      throw new Error("must not read domain");
    },
    getOpportunity: async () => {
      throw new Error("must not read opportunity");
    },
  });

  const workspaceOffResult = await workspaceOff({
    now: "2026-09-22T00:00:00.000Z",
  });

  assert.equal(workspaceOffResult.outcome, "preview");
  assert.equal(workspaceOffResult.workspacesScanned, 0);
  assert.equal(workspaceOffResult.proposed.length, 0);
  assert.equal(workspaceOffPromotionReads, 0);
  for (const invalid of [{ ...({ applicationId: "x", workspaceId: ids.w, runId: ids.r, promotionTaskId: ids.t, promotionTaskKind: "backlinks.promotion.preview", promotionTaskStatus: "completed", domainId: ids.d, opportunityId: ids.o, actorUserId: ids.a, applied: true }), applied: false }, { applicationId: "x", workspaceId: ids.w, runId: ids.r, promotionTaskId: ids.t, promotionTaskKind: "backlinks.promotion.preview", promotionTaskStatus: "completed", domainId: "wrong", opportunityId: ids.o, actorUserId: ids.a, applied: true }]) {
    const runner = createBacklinkAutonomyProductionPreviewRunner({ runtimeConfig: () => ({ autonomyEnabled: true }), listWorkspaceControls: async () => [{ workspaceId: ids.w, backlinksEnabled: true, backlinkAutonomyEnabled: true, backlinkOutreachScheduleApplyEnabled: false, dryRunOnly: false, disabledReason: null }], listAppliedPromotions: async () => [invalid as any], getDomain: async () => ({ id: ids.d, workspaceId: ids.w, archivedAt: null }), getOpportunity: async () => ({ id: ids.o, workspaceId: ids.w, domainId: ids.d, archivedAt: null }) }); assert.equal((await runner()).proposed.length, 0);
  }
  console.log("PASS — Backlink autonomy production preview smoke");
}
void main();

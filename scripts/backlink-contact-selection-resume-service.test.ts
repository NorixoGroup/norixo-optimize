import assert from "node:assert/strict";
import test from "node:test";

import {
  extractContactResolutionTaskScope,
  resumeBacklinkContactSelectionDecision,
  runBacklinkContactSelectionResumeTick,
  type ContactResolutionTaskRecord,
  type ContactSelectedDecisionForResume,
} from "@/lib/automation/backlink-contact-selection-resume-service";
import type { BacklinkPromotionResolutionControl } from "@/lib/automation/backlink-promotion-resolution-entry";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_RUN_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_TASK_ID = "33333333-3333-4333-8333-333333333333";
const CONTACT_ID = "44444444-4444-4444-8444-444444444444";
const PROMOTION_APP_ID = "55555555-5555-4555-8555-555555555555";
const DOMAIN_ID = "66666666-6666-4666-8666-666666666666";
const OPPORTUNITY_ID = "77777777-7777-4777-8777-777777777777";
const DECIDED_BY = "88888888-8888-4888-8888-888888888888";
const DECISION_ID = "99999999-9999-4999-8999-999999999999";

const ENABLED_CONTROL: BacklinkPromotionResolutionControl = { backlinksEnabled: true, disabledReason: null, backlinkAutonomyEnabled: true };

function decision(overrides: Partial<ContactSelectedDecisionForResume> = {}): ContactSelectedDecisionForResume {
  return {
    id: DECISION_ID,
    workspaceId: WORKSPACE_ID,
    promotionApplicationId: PROMOTION_APP_ID,
    sourceAutonomyRunId: SOURCE_RUN_ID,
    sourceResolutionTaskId: SOURCE_TASK_ID,
    selectedContactId: CONTACT_ID,
    decisionStatus: "contact_selected",
    decidedBy: DECIDED_BY,
    ...overrides,
  };
}

function validResolutionTask(): ContactResolutionTaskRecord {
  return { taskKind: "backlinks.contact_resolution", status: "completed", input: { domainId: DOMAIN_ID, opportunityId: OPPORTUNITY_ID } };
}

function neverCalled(name: string) {
  return async () => { throw new Error(`must not be called: ${name}`); };
}

/**
 * Emulates the real repositories' race-safe create-or-get semantics (an
 * optimistic unique-constraint conflict falls back to a re-read) with a
 * deliberate double await, so two concurrently started calls genuinely
 * interleave instead of resolving synchronously in call order.
 */
function makeRaceSafeStore<V extends { id: string }>(makeValue: (seq: number) => V) {
  const byKey = new Map<string, V>();
  let seq = 0;
  return {
    byKey,
    async createOrGet(key: string): Promise<{ kind: "created" | "existing"; value: V }> {
      await Promise.resolve();
      let value = byKey.get(key);
      if (value != null) return { kind: "existing", value };
      await Promise.resolve();
      value = byKey.get(key);
      if (value != null) return { kind: "existing", value };
      value = makeValue(++seq);
      byKey.set(key, value);
      return { kind: "created", value };
    },
  };
}

function makeRunStore() {
  const store = makeRaceSafeStore((seq) => ({ id: `run-${seq}`, input: undefined as unknown }));
  return {
    all: store.byKey,
    createOrGetRun: async (input: { idempotencyKey: string; input: unknown }) => {
      const result = await store.createOrGet(input.idempotencyKey);
      if (result.kind === "created") store.byKey.set(input.idempotencyKey, { ...result.value, input: input.input });
      return { kind: result.kind, run: result.value };
    },
  };
}

function makeTaskStore() {
  const store = makeRaceSafeStore((seq) => ({ id: `task-${seq}` }));
  return {
    all: store.byKey,
    createOrGetTask: async (input: { taskKey: string }) => {
      const result = await store.createOrGet(input.taskKey);
      return { kind: result.kind, task: result.value };
    },
  };
}

test("extractContactResolutionTaskScope: rejects non-UUID, missing, or malformed fields", () => {
  assert.equal(extractContactResolutionTaskScope(null), null);
  assert.equal(extractContactResolutionTaskScope({}), null);
  assert.equal(extractContactResolutionTaskScope({ domainId: "not-a-uuid", opportunityId: OPPORTUNITY_ID }), null);
  assert.deepEqual(extractContactResolutionTaskScope({ domainId: DOMAIN_ID, opportunityId: OPPORTUNITY_ID }), { domainId: DOMAIN_ID, opportunityId: OPPORTUNITY_ID });
});

test("contact_selected decision with a valid completed source task creates a sibling run and a contact_validation task", async () => {
  const runs = makeRunStore();
  const tasks = makeTaskStore();
  const result = await resumeBacklinkContactSelectionDecision(
    { getResolutionTask: async () => validResolutionTask(), createOrGetRun: runs.createOrGetRun, createOrGetTask: tasks.createOrGetTask },
    { decision: decision(), control: ENABLED_CONTROL, scheduledAt: "2026-11-12T00:00:00.000Z" },
  );
  assert.equal(result.outcome, "run_created");
  assert.equal(result.runId, "run-1");
  assert.equal(result.taskId, "task-1");
  const runRow = runs.all.get(`backlinks-autonomy:contact-selection-resume:${DECISION_ID}`);
  const runInput = runRow?.input as Record<string, unknown>;
  assert.equal(runInput.sourceAutonomyRunId, SOURCE_RUN_ID);
  assert.equal(runInput.sourceResolutionTaskId, SOURCE_TASK_ID);
  assert.equal(runInput.contactSelectionDecisionId, DECISION_ID);
  assert.equal(runInput.promotionApplicationId, PROMOTION_APP_ID);
  assert.equal(runInput.domainId, DOMAIN_ID);
  assert.equal(runInput.opportunityId, OPPORTUNITY_ID);
});

test("repeating the same decision is idempotent: the second call reuses the same sibling run and task", async () => {
  const runs = makeRunStore();
  const tasks = makeTaskStore();
  const deps = { getResolutionTask: async () => validResolutionTask(), createOrGetRun: runs.createOrGetRun, createOrGetTask: tasks.createOrGetTask };
  const first = await resumeBacklinkContactSelectionDecision(deps, { decision: decision(), control: ENABLED_CONTROL, scheduledAt: "2026-11-12T00:00:00.000Z" });
  const second = await resumeBacklinkContactSelectionDecision(deps, { decision: decision(), control: ENABLED_CONTROL, scheduledAt: "2026-11-12T01:00:00.000Z" });
  assert.equal(first.outcome, "run_created");
  assert.equal(second.outcome, "run_existing");
  assert.equal(second.runId, first.runId);
  assert.equal(second.taskId, first.taskId);
  assert.equal(runs.all.size, 1);
  assert.equal(tasks.all.size, 1);
});

test("concurrent resume attempts for the same decision converge to exactly one sibling run and task", async () => {
  const runs = makeRunStore();
  const tasks = makeTaskStore();
  const deps = { getResolutionTask: async () => validResolutionTask(), createOrGetRun: runs.createOrGetRun, createOrGetTask: tasks.createOrGetTask };
  const input = { decision: decision(), control: ENABLED_CONTROL, scheduledAt: "2026-11-12T00:00:00.000Z" };
  const [a, b] = await Promise.all([
    resumeBacklinkContactSelectionDecision(deps, input),
    resumeBacklinkContactSelectionDecision(deps, input),
  ]);
  assert.equal(a.runId, b.runId);
  assert.equal(a.taskId, b.taskId);
  assert.equal([a.outcome, b.outcome].includes("run_created"), true);
  assert.equal(runs.all.size, 1);
  assert.equal(tasks.all.size, 1);
});

test("a promotion_rejected decision is never resumed and never reads or writes anything else", async () => {
  const result = await resumeBacklinkContactSelectionDecision(
    { getResolutionTask: neverCalled("getResolutionTask"), createOrGetRun: neverCalled("createOrGetRun"), createOrGetTask: neverCalled("createOrGetTask") },
    { decision: decision({ decisionStatus: "promotion_rejected", selectedContactId: null }), control: ENABLED_CONTROL, scheduledAt: "2026-11-12T00:00:00.000Z" },
  );
  assert.equal(result.outcome, "blocked");
  assert.equal(result.reason, "DECISION_NOT_CONTACT_SELECTED");
  assert.equal(result.runId, null);
});

test("a decision without a selected contact is never resumed, even if marked contact_selected", async () => {
  const result = await resumeBacklinkContactSelectionDecision(
    { getResolutionTask: neverCalled("getResolutionTask"), createOrGetRun: neverCalled("createOrGetRun"), createOrGetTask: neverCalled("createOrGetTask") },
    { decision: decision({ selectedContactId: null }), control: ENABLED_CONTROL, scheduledAt: "2026-11-12T00:00:00.000Z" },
  );
  assert.equal(result.outcome, "blocked");
  assert.equal(result.reason, "DECISION_NOT_CONTACT_SELECTED");
});

test("an invalid source task (wrong kind, not completed, or malformed input) blocks resume without creating a run or task", async () => {
  const cases: Array<ContactResolutionTaskRecord | null> = [
    null,
    { taskKind: "backlinks.contact_validation", status: "completed", input: { domainId: DOMAIN_ID, opportunityId: OPPORTUNITY_ID } },
    { taskKind: "backlinks.contact_resolution", status: "running", input: { domainId: DOMAIN_ID, opportunityId: OPPORTUNITY_ID } },
    { taskKind: "backlinks.contact_resolution", status: "completed", input: { domainId: "not-a-uuid", opportunityId: OPPORTUNITY_ID } },
  ];
  for (const task of cases) {
    const result = await resumeBacklinkContactSelectionDecision(
      { getResolutionTask: async () => task, createOrGetRun: neverCalled("createOrGetRun"), createOrGetTask: neverCalled("createOrGetTask") },
      { decision: decision(), control: ENABLED_CONTROL, scheduledAt: "2026-11-12T00:00:00.000Z" },
    );
    assert.equal(result.outcome, "blocked");
    assert.equal(result.reason, "SOURCE_TASK_INVALID");
  }
});

test("workspace control gates (backlinksEnabled, disabledReason, backlinkAutonomyEnabled) block resume before any read", async () => {
  const cases: Array<[BacklinkPromotionResolutionControl, string]> = [
    [{ backlinksEnabled: false, disabledReason: null, backlinkAutonomyEnabled: true }, "BACKLINKS_DISABLED"],
    [{ backlinksEnabled: true, disabledReason: "incident", backlinkAutonomyEnabled: true }, "AUTOMATION_DISABLED_REASON"],
    [{ backlinksEnabled: true, disabledReason: null, backlinkAutonomyEnabled: false }, "BACKLINK_AUTONOMY_DISABLED"],
  ];
  for (const [control, reason] of cases) {
    const result = await resumeBacklinkContactSelectionDecision(
      { getResolutionTask: neverCalled("getResolutionTask"), createOrGetRun: neverCalled("createOrGetRun"), createOrGetTask: neverCalled("createOrGetTask") },
      { decision: decision(), control, scheduledAt: "2026-11-12T00:00:00.000Z" },
    );
    assert.equal(result.outcome, "disabled");
    assert.equal(result.reason, reason);
  }
});

test("runBacklinkContactSelectionResumeTick resumes eligible decisions across multiple workspaces and skips ineligible ones", async () => {
  const runs = makeRunStore();
  const tasks = makeTaskStore();
  const workspaceB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const decisionB = decision({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", workspaceId: workspaceB });
  const rejectedInWorkspaceA = decision({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", decisionStatus: "promotion_rejected", selectedContactId: null });
  const result = await runBacklinkContactSelectionResumeTick(
    {
      listWorkspaceControls: async () => [
        { workspaceId: WORKSPACE_ID, ...ENABLED_CONTROL },
        { workspaceId: workspaceB, ...ENABLED_CONTROL },
      ],
      listDecisions: async (workspaceId: string) => (workspaceId === WORKSPACE_ID ? [decision(), rejectedInWorkspaceA] : [decisionB]),
      getResolutionTask: async () => validResolutionTask(),
      createOrGetRun: runs.createOrGetRun,
      createOrGetTask: tasks.createOrGetTask,
    },
    { workspaceLimit: 5, decisionLimitPerWorkspace: 5, scheduledAt: "2026-11-12T00:00:00.000Z" },
  );
  assert.equal(result.decisionsScanned, 3);
  assert.equal(result.resumedRuns.length, 2);
  assert.deepEqual(new Set(result.resumedRuns.map((r) => r.workspaceId)), new Set([WORKSPACE_ID, workspaceB]));
  assert.equal(result.results.find((r) => r.decisionId === rejectedInWorkspaceA.id)?.outcome, "blocked");
});

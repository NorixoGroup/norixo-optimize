import assert from "node:assert/strict";
import test from "node:test";

import {
  runBacklinkPromotionAutoApplyForWorkspace,
  runBacklinkPromotionAutoApplyTick,
  type BacklinkPromotionAutoApplyDependencies,
} from "@/lib/automation/backlink-promotion-auto-apply-service";
import { BacklinkPromotionAutoApplyRepositoryError } from "@/lib/automation/backlink-promotion-auto-apply-types";
import type { BacklinkPromotionAutoApplyTaskRecord } from "@/lib/automation/repositories/backlinkPromotionAutoApplyCandidatesRepository";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";

function proposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    proposalKey: "p-eligible",
    promotionDecision: "propose",
    priority: "Tier A",
    qualificationConfidence: "medium",
    suggestedAssetKey: "calculator-one",
    ...overrides,
  };
}

function task(proposals: ReadonlyArray<Record<string, unknown>>, overrides: Partial<BacklinkPromotionAutoApplyTaskRecord> = {}): BacklinkPromotionAutoApplyTaskRecord {
  return {
    id: TASK_ID,
    runId: RUN_ID,
    status: "completed",
    taskKind: "backlinks.promotion.preview",
    output: { policyVersion: "backlink-promotion-v1", proposals },
    ...overrides,
  };
}

function neverApply(): Promise<{ applicationId: string }> {
  throw new Error("applyProposal must not be called");
}

test("an eligible-looking Tier A/medium proposal is attempted by reference only, never with content", async () => {
  const calls: unknown[] = [];
  const deps: BacklinkPromotionAutoApplyDependencies = {
    listCompletedPromotionPreviewTasks: async () => [task([proposal()])],
    applyProposal: async (input) => { calls.push(input); return { applicationId: "app-1" }; },
  };
  const result = await runBacklinkPromotionAutoApplyForWorkspace(deps, { workspaceId: WORKSPACE_ID, taskLimit: 10 });
  assert.equal(result.outcome, "applied");
  assert.equal(result.applicationId, "app-1");
  assert.deepEqual(calls, [{ workspaceId: WORKSPACE_ID, runId: RUN_ID, promotionTaskId: TASK_ID, proposalKey: "p-eligible" }]);
});

test("Tier B, low confidence, and missing suggestedAssetKey proposals are never attempted", async () => {
  const deps: BacklinkPromotionAutoApplyDependencies = {
    listCompletedPromotionPreviewTasks: async () => [task([
      proposal({ proposalKey: "p-tierb", priority: "Tier B" }),
      proposal({ proposalKey: "p-low", qualificationConfidence: "low" }),
      proposal({ proposalKey: "p-noasset", suggestedAssetKey: null }),
      proposal({ proposalKey: "p-skip", promotionDecision: "skip" }),
    ])],
    applyProposal: neverApply,
  };
  const result = await runBacklinkPromotionAutoApplyForWorkspace(deps, { workspaceId: WORKSPACE_ID, taskLimit: 10 });
  assert.equal(result.outcome, "no_eligible_candidate");
});

test("a candidate rejected authoritatively as ineligible does not stop the workspace: the next candidate is tried", async () => {
  const attempted: string[] = [];
  const deps: BacklinkPromotionAutoApplyDependencies = {
    listCompletedPromotionPreviewTasks: async () => [task([
      proposal({ proposalKey: "p-first" }),
      proposal({ proposalKey: "p-second" }),
    ])],
    applyProposal: async (input) => {
      attempted.push(input.proposalKey);
      if (input.proposalKey === "p-first") throw new BacklinkPromotionAutoApplyRepositoryError("PROMOTION_AUTO_APPLY_PROPOSAL_NOT_ELIGIBLE");
      return { applicationId: "app-2" };
    },
  };
  const result = await runBacklinkPromotionAutoApplyForWorkspace(deps, { workspaceId: WORKSPACE_ID, taskLimit: 10 });
  assert.equal(result.outcome, "applied");
  assert.equal(result.applicationId, "app-2");
  assert.deepEqual(attempted, ["p-first", "p-second"]);
});

test("the per-workspace-per-day cap stops the workspace immediately, without trying further candidates", async () => {
  const attempted: string[] = [];
  const deps: BacklinkPromotionAutoApplyDependencies = {
    listCompletedPromotionPreviewTasks: async () => [task([
      proposal({ proposalKey: "p-first" }),
      proposal({ proposalKey: "p-second" }),
    ])],
    applyProposal: async (input) => {
      attempted.push(input.proposalKey);
      throw new BacklinkPromotionAutoApplyRepositoryError("PROMOTION_AUTO_APPLY_WORKSPACE_LIMIT_REACHED");
    },
  };
  const result = await runBacklinkPromotionAutoApplyForWorkspace(deps, { workspaceId: WORKSPACE_ID, taskLimit: 10 });
  assert.equal(result.outcome, "rejected");
  assert.equal(result.reason, "PROMOTION_AUTO_APPLY_WORKSPACE_LIMIT_REACHED");
  assert.deepEqual(attempted, ["p-first"]);
});

test("a revoked/missing authorization is reported as disabled and stops the workspace immediately", async () => {
  const attempted: string[] = [];
  const deps: BacklinkPromotionAutoApplyDependencies = {
    listCompletedPromotionPreviewTasks: async () => [task([
      proposal({ proposalKey: "p-first" }),
      proposal({ proposalKey: "p-second" }),
    ])],
    applyProposal: async (input) => {
      attempted.push(input.proposalKey);
      throw new BacklinkPromotionAutoApplyRepositoryError("PROMOTION_AUTO_APPLY_NOT_AUTHORIZED");
    },
  };
  const result = await runBacklinkPromotionAutoApplyForWorkspace(deps, { workspaceId: WORKSPACE_ID, taskLimit: 10 });
  assert.equal(result.outcome, "disabled");
  assert.deepEqual(attempted, ["p-first"]);
});

test("a stale authorizing admin (rights withdrawn since the grant) is reported as disabled and stops the workspace immediately", async () => {
  const attempted: string[] = [];
  const deps: BacklinkPromotionAutoApplyDependencies = {
    listCompletedPromotionPreviewTasks: async () => [task([
      proposal({ proposalKey: "p-first" }),
      proposal({ proposalKey: "p-second" }),
    ])],
    applyProposal: async (input) => {
      attempted.push(input.proposalKey);
      throw new BacklinkPromotionAutoApplyRepositoryError("PROMOTION_AUTO_APPLY_AUTHORIZATION_STALE");
    },
  };
  const result = await runBacklinkPromotionAutoApplyForWorkspace(deps, { workspaceId: WORKSPACE_ID, taskLimit: 10 });
  assert.equal(result.outcome, "disabled");
  assert.equal(result.reason, "PROMOTION_AUTO_APPLY_AUTHORIZATION_STALE");
  assert.deepEqual(attempted, ["p-first"]);
});

test("runBacklinkPromotionAutoApplyTick iterates every listed workspace and aggregates outcomes", async () => {
  const workspaceB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const attempted: Array<{ workspaceId: string; proposalKey: string }> = [];
  const result = await runBacklinkPromotionAutoApplyTick(
    {
      listWorkspaces: async () => [{ workspaceId: WORKSPACE_ID }, { workspaceId: workspaceB }],
      listCompletedPromotionPreviewTasks: async (workspaceId) => [task([proposal({ proposalKey: `p-${workspaceId}` })])],
      applyProposal: async (input) => {
        attempted.push({ workspaceId: input.workspaceId, proposalKey: input.proposalKey });
        return { applicationId: `app-${input.workspaceId}` };
      },
    },
    { workspaceLimit: 5, taskLimitPerWorkspace: 5 },
  );
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((r) => r.outcome), ["applied", "applied"]);
  assert.deepEqual(new Set(attempted.map((a) => a.workspaceId)), new Set([WORKSPACE_ID, workspaceB]));
});

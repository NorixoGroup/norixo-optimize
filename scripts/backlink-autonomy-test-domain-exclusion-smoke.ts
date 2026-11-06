import assert from "node:assert/strict";
import { isBacklinkTestOrFixtureHostname } from "@/lib/automation/backlink-test-domain-policy";
import { enterPromotedOpportunityContactResolution } from "@/lib/automation/backlink-promotion-resolution-entry";
import { runBacklinkAutonomyScheduler } from "@/lib/automation/backlink-autonomy-scheduler";

const control = { backlinksEnabled: true, disabledReason: null, backlinkAutonomyEnabled: true };
const ids = {
  workspace: "00000000-0000-4000-8000-000000000001",
  run: "00000000-0000-4000-8000-000000000002",
  promotion: "00000000-0000-4000-8000-000000000003",
  domain: "00000000-0000-4000-8000-000000000004",
  opportunity: "00000000-0000-4000-8000-000000000005",
  actor: "00000000-0000-4000-8000-000000000006",
};

function promotion(applicationId: string, domainId: string = ids.domain, opportunityId: string = ids.opportunity) {
  return {
    applicationId,
    workspaceId: ids.workspace,
    runId: ids.run,
    promotionTaskId: ids.promotion,
    promotionTaskKind: "backlinks.promotion.preview" as const,
    promotionTaskStatus: "completed" as const,
    domainId,
    opportunityId,
    actorUserId: ids.actor,
    applied: true as const,
  };
}

async function main() {
  // 1. The shared policy predicate itself: reserved suffixes + explicit fixture allowlist.
  assert.equal(isBacklinkTestOrFixtureHostname("host-resources.example"), true, "OP-000002 fixture hostname must be flagged");
  assert.equal(isBacklinkTestOrFixtureHostname("HOST-RESOURCES.EXAMPLE"), true, "case must not bypass the policy");
  assert.equal(isBacklinkTestOrFixtureHostname("foo.test"), true);
  assert.equal(isBacklinkTestOrFixtureHostname("foo.invalid"), true);
  assert.equal(isBacklinkTestOrFixtureHostname("foo.localhost"), true);
  assert.equal(isBacklinkTestOrFixtureHostname("www.vacationrentalformula.com"), false, "OP-000003 must remain eligible");
  assert.equal(isBacklinkTestOrFixtureHostname("example.com"), false, "a hostname merely containing 'example' must not be excluded");
  assert.equal(isBacklinkTestOrFixtureHostname("notanexample.com"), false, "substring match must not trigger a false positive");

  // 2. Resolution entry point: OP-000002-shaped domain is blocked, legitimate domain proceeds.
  const fixtureEntry = await enterPromotedOpportunityContactResolution(
    {
      getDomain: async () => ({ id: ids.domain, workspaceId: ids.workspace, hostname: "host-resources.example", archivedAt: null }),
      getOpportunity: async () => ({ id: ids.opportunity, workspaceId: ids.workspace, domainId: ids.domain, archivedAt: null }),
      createOrGetTask: async () => { throw new Error("must not persist a task for a fixture"); },
    },
    { promotion: promotion("op-000002"), autonomyRunId: "preview:op-000002", control, mode: "apply", scheduledAt: "2026-11-06T00:00:00.000Z" },
  );
  assert.equal(fixtureEntry.outcome, "blocked");
  assert.deepEqual(fixtureEntry.reasons, ["PROMOTION_DOMAIN_TEST_FIXTURE_EXCLUDED"]);

  let legitimateTaskCreated = 0;
  const legitimateEntry = await enterPromotedOpportunityContactResolution(
    {
      getDomain: async () => ({ id: ids.domain, workspaceId: ids.workspace, hostname: "www.vacationrentalformula.com", archivedAt: null }),
      getOpportunity: async () => ({ id: ids.opportunity, workspaceId: ids.workspace, domainId: ids.domain, archivedAt: null }),
      createOrGetTask: async (input) => { legitimateTaskCreated += 1; return { kind: "created", task: { id: "task-1" } }; },
    },
    { promotion: promotion("op-000003"), autonomyRunId: "preview:op-000003", control, mode: "apply", scheduledAt: "2026-11-06T00:00:00.000Z" },
  );
  assert.equal(legitimateEntry.outcome, "task_created");
  assert.equal(legitimateTaskCreated, 1, "a legitimate opportunity must still be allowed through to task creation");

  // 3. Scheduler level: the same fixture must be skipped before resolution entry is even reached,
  //    and a legitimate promotion in the same batch must still be processed.
  const hostnameByDomain: Record<string, string> = {
    "domain-op-000002": "host-resources.example",
    "domain-op-000003": "www.vacationrentalformula.com",
  };
  let schedulerTasksCreated = 0;
  const schedulerResult = await runBacklinkAutonomyScheduler(
    {
      runtimeConfig: () => ({ autonomyEnabled: true }),
      listWorkspaceControls: async () => [{ workspaceId: ids.workspace, backlinksEnabled: true, backlinkAutonomyEnabled: true, backlinkOutreachScheduleApplyEnabled: false, dryRunOnly: true, disabledReason: null }],
      listAppliedPromotions: async () => [
        promotion("op-000002", "domain-op-000002", "opportunity-op-000002"),
        promotion("op-000003", "domain-op-000003", "opportunity-op-000003"),
      ],
      getDomain: async (_workspaceId, domainId) => ({ id: domainId, workspaceId: ids.workspace, hostname: hostnameByDomain[domainId] ?? "unknown.invalid", archivedAt: null }),
      getOpportunity: async (_workspaceId, opportunityId) => ({ id: opportunityId, workspaceId: ids.workspace, domainId: opportunityId.replace("opportunity-", "domain-"), archivedAt: null }),
      createOrGetTask: async () => { schedulerTasksCreated += 1; return { kind: "created", task: { id: "task-scheduler" } }; },
      createOrGetRun: async () => ({ kind: "created", run: { id: "autonomy-run-1" } as any }),
    },
    { mode: "apply", scheduledAt: "2026-11-06T00:00:00.000Z" },
  );
  assert.equal(schedulerTasksCreated, 1, "exactly one task (for the legitimate promotion) must be created by the scheduler");
  assert.equal(schedulerResult.skipped.some((entry) => entry.startsWith("PROMOTION_DOMAIN_TEST_FIXTURE_EXCLUDED:op-000002")), true, "the scheduler must record why OP-000002 was skipped, before reaching resolution entry");
  assert.equal(schedulerResult.created, 1);

  console.log("PASS — Backlink autonomy test-domain exclusion smoke");
}

main().catch((error) => {
  console.error("FAIL — Backlink autonomy test-domain exclusion smoke");
  console.error(error);
  process.exitCode = 1;
});

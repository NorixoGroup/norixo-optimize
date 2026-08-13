import { runBacklinkOutreachScheduleApplyOrchestration, type BacklinkOutreachScheduleApplyOrchestrationDependencies } from "../lib/automation/backlink-outreach-schedule-apply-orchestrator";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const events: string[] = [];
  const seenKeys: string[] = [];
  let nowCalls = 0;

  const dependencies: BacklinkOutreachScheduleApplyOrchestrationDependencies = {
    now: () => {
      nowCalls += 1;
      return "2026-08-13T08:15:00.000Z";
    },
    listEligibleWorkspaces: async (limit) => {
      events.push(`list:${limit}`);
      return [
        {
          workspaceId: "00000000-0000-4000-8000-000000000003",
          backlinksEnabled: true,
          backlinkOutreachScheduleApplyEnabled: true,
          dryRunOnly: true,
          disabledReason: null,
          lastScheduleApplyAttemptAt: "2026-08-13T08:20:00.000Z",
        },
        {
          workspaceId: "00000000-0000-4000-8000-000000000001",
          backlinksEnabled: true,
          backlinkOutreachScheduleApplyEnabled: true,
          dryRunOnly: true,
          disabledReason: null,
          lastScheduleApplyAttemptAt: null,
        },
        {
          workspaceId: "00000000-0000-4000-8000-000000000002",
          backlinksEnabled: true,
          backlinkOutreachScheduleApplyEnabled: false,
          dryRunOnly: true,
          disabledReason: null,
          lastScheduleApplyAttemptAt: "2026-08-13T08:19:00.000Z",
        },
      ];
    },
    applyWorkspace: async (input) => {
      events.push(`apply:${input.workspaceId}`);
      seenKeys.push(`${input.workspaceId}:${input.outreachLimit}:${input.scheduledAt}`);
      return {
        workspaceId: input.workspaceId,
        runDisposition: input.workspaceId.endsWith("1") ? "existing" : "created",
        result: {
          scanned: 2,
          scheduled: input.workspaceId.endsWith("1") ? 0 : 1,
          existing: input.workspaceId.endsWith("1") ? 1 : 0,
          notApplicable: 0,
          conflicts: 0,
          failed: 0,
          items: [],
        },
      };
    },
  };

  const first = await runBacklinkOutreachScheduleApplyOrchestration(dependencies, {
    workspaceLimit: 25,
    outreachLimitPerWorkspace: 17,
  });

  assert(first.workspacesScanned === 2, "Only enabled workspaces should be processed.");
  assert(first.workspacesSucceeded === 2, "Both eligible workspaces should succeed.");
  assert(first.workspacesFailed === 0, "No workspace should fail nominally.");
  assert(first.runsCreated === 1, "Created runs must be counted.");
  assert(first.runsExisting === 1, "Existing runs must be counted.");
  assert(first.scheduled === 1, "Scheduled counts must aggregate.");
  assert(first.existing === 1, "Existing counts must aggregate.");
  assert(first.notApplicable === 0, "Not applicable counts must aggregate.");
  assert(first.conflicts === 0, "Conflict counts must aggregate.");
  assert(first.failed === 0, "Failed counts must aggregate.");
  assert(first.workspaces.map((item) => item.workspaceId).join(",") === "00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000003", "Workspace order must be fairness-aware.");
  assert(events.join(",") === "list:25,apply:00000000-0000-4000-8000-000000000001,apply:00000000-0000-4000-8000-000000000003", "Eligible workspaces must be filtered and ordered.");
  assert(seenKeys[0] === "00000000-0000-4000-8000-000000000001:17:2026-08-13T08:15:00.000Z", "Apply limit and server time must be forwarded.");
  assert(nowCalls === 1, "The orchestration must read the server clock once.");
  assert(first.issues.length === 0, "Nominal orchestration should not produce issues.");

  events.length = 0;
  seenKeys.length = 0;
  nowCalls = 0;

  const failing = await runBacklinkOutreachScheduleApplyOrchestration(
    {
      ...dependencies,
      applyWorkspace: async (input) => {
        if (input.workspaceId.endsWith("1")) {
          throw new Error("workspace failed");
        }
        return dependencies.applyWorkspace(input);
      },
    },
    { workspaceLimit: 100, outreachLimitPerWorkspace: 200 },
  );

  assert(failing.workspacesFailed === 1, "Failures must be isolated per workspace.");
  assert(failing.workspacesSucceeded === 1, "The surviving workspace must still succeed.");
  assert(failing.issues.length === 1, "Safe issues must be reported.");
  assert(failing.issues[0]?.workspaceId === "00000000-0000-4000-8000-000000000001", "Failure must be tracked for the failing workspace.");
  assert(failing.issues[0]?.status === "failed", "Failure must be marked as failed.");

  console.log("PASS — Automation backlinks outreach schedule apply-all orchestrator smoke");
}

void main();

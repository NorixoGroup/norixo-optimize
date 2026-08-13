import {
  runBacklinkOutreachMaintenanceOrchestration,
  type BacklinkOutreachMaintenanceOrchestrationDependencies,
} from "../lib/automation/backlink-outreach-maintenance-orchestrator";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const events: string[] = [];
  const seenKeys: string[] = [];
  let nowCalls = 0;

  const dependencies: BacklinkOutreachMaintenanceOrchestrationDependencies = {
    now: () => {
      nowCalls += 1;
      return nowCalls === 1
        ? "2026-08-13T08:15:00.000Z"
        : "2026-08-13T09:15:00.000Z";
    },
    listEligibleWorkspaces: async (limit) => {
      events.push(`list:${limit}`);
      return [
        {
          workspaceId: "00000000-0000-4000-8000-000000000003",
          backlinksEnabled: true,
          dryRunOnly: true,
          disabledReason: null,
        },
        {
          workspaceId: "00000000-0000-4000-8000-000000000001",
          backlinksEnabled: true,
          dryRunOnly: true,
          disabledReason: null,
        },
        {
          workspaceId: "00000000-0000-4000-8000-000000000002",
          backlinksEnabled: true,
          dryRunOnly: false,
          disabledReason: null,
        },
      ];
    },
    previewScheduleReconciliation: async (input) => {
      events.push(`schedule:${input.workspaceId}`);
      seenKeys.push(input.idempotencyKey);
      assert(input.scheduledAt === "2026-08-13T08:15:00.000Z", "Schedule must use one shared server now.");
      assert(input.limit === 100, "Schedule must use the default operation limit.");
      return {
        disposition: input.workspaceId.endsWith("1") ? "existing" : "created",
        result: {
          scanned: 2,
          wouldScheduleFollowUp: 1,
          wouldScheduleFinalResponse: 0,
          existing: 1,
          notApplicable: 0,
          conflicts: 0,
          items: [],
        },
      };
    },
    previewSignalDetection: async (input) => {
      events.push(`signal:${input.workspaceId}`);
      seenKeys.push(input.idempotencyKey);
      assert(input.limit === 100, "Signal detection must use the default operation limit.");
      return {
        disposition: input.workspaceId.endsWith("1") ? "created" : "existing",
        result: {
          dueDetected: 2,
          dueTaskCreated: 1,
          dueTaskExisting: 1,
          expiredDetected: 1,
          expiredTaskCreated: 1,
          expiredTaskExisting: 0,
          failed: 0,
        },
      };
    },
  };

  const first = await runBacklinkOutreachMaintenanceOrchestration(dependencies, { workspaceLimit: 25 });
  assert(first.workspacesScanned === 2, "Only eligible workspaces should be processed.");
  assert(first.workspacesSucceeded === 2, "Both workspaces should succeed.");
  assert(first.workspacesFailed === 0, "No workspace should fail nominally.");
  assert(first.reconciliationRunsCreated === 1, "Created reconciliation runs must be counted.");
  assert(first.reconciliationRunsExisting === 1, "Existing reconciliation runs must be counted.");
  assert(first.signalRunsCreated === 1, "Created signal runs must be counted.");
  assert(first.signalRunsExisting === 1, "Existing signal runs must be counted.");
  assert(first.dueDetected === 4, "Due detections must aggregate across workspaces.");
  assert(first.expiredDetected === 2, "Expired detections must aggregate across workspaces.");
  assert(first.signalTasksCreated === 4, "Signal tasks created must aggregate.");
  assert(first.signalTasksExisting === 2, "Signal tasks existing must aggregate.");
  assert(events.join(",") === "list:25,schedule:00000000-0000-4000-8000-000000000001,signal:00000000-0000-4000-8000-000000000001,schedule:00000000-0000-4000-8000-000000000003,signal:00000000-0000-4000-8000-000000000003", "Workspace order must be deterministic and filtered.");
  assert(seenKeys[0] === "backlinks:outreach:maintenance:schedule_reconciliation:00000000-0000-4000-8000-000000000001:2026-08-13T08", "Schedule idempotency must use the time bucket.");
  assert(seenKeys[1] === "backlinks:outreach:maintenance:signal_detection:00000000-0000-4000-8000-000000000001:2026-08-13T08", "Signal idempotency must use the time bucket.");
  assert(nowCalls === 1, "The orchestration must read the server clock once.");
  assert(first.issues.length === 0, "Nominal orchestration should not produce issues.");

  events.length = 0;
  seenKeys.length = 0;
  nowCalls = 0;

  const failing = await runBacklinkOutreachMaintenanceOrchestration(
    {
      ...dependencies,
      previewScheduleReconciliation: async (input) => {
        if (input.workspaceId.endsWith("1")) {
          throw new Error("schedule failed");
        }
        return dependencies.previewScheduleReconciliation(input);
      },
      previewSignalDetection: async (input) => {
        if (input.workspaceId.endsWith("3")) {
          throw new Error("signal failed");
        }
        return dependencies.previewSignalDetection(input);
      },
    },
    { workspaceLimit: 100 },
  );

  assert(failing.workspacesFailed === 2, "Failures must be isolated per workspace.");
  assert(failing.workspacesSucceeded === 0, "Partially failed workspaces are counted as failed.");
  assert(failing.issues.length === 2, "Safe issues must be reported.");
  assert(
    failing.issues.every(
      (issue) =>
        issue.status === "failed" &&
        ["schedule_reconciliation", "signal_detection"].includes(issue.operation),
    ),
    "Issues must remain safe and operation-scoped.",
  );
  assert(
    failing.issues[0]?.workspaceId !== failing.issues[1]?.workspaceId,
    "Failures must be tracked independently per workspace.",
  );

  console.log("PASS — Automation backlinks outreach maintenance orchestrator smoke");
}

void main();

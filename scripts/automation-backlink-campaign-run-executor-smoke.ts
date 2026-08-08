import { executeBacklinkCampaignPreviewRun } from "../lib/automation/backlink-campaign-run-executor";
import type { ExecuteBacklinkCampaignPreviewRunDependencies, ExecuteBacklinkCampaignPreviewRunInput } from "../lib/automation/backlink-campaign-run-executor-types";
import type { AutomationRun } from "../lib/automation/types";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  let startCalled = 0;
  let workerCalled = 0;
  let completeCalled = 0;
  let failCalled = 0;

  function buildAutomationRun(params: { workspaceId: string; runId: string; runKind?: string; status?: "queued" | "running" | "completed" | "failed" | "cancelled"; startedAt?: string | null; scheduledAt?: string; }): AutomationRun {
    const now = "2026-08-06T00:00:00.000Z";
    return {
      id: params.runId,
      workspaceId: params.workspaceId,
      system: "backlinks",
      runKind: params.runKind ?? "backlinks.campaign.preview",
      idempotencyKey: "smoke-idempotency-key",
      status: params.status ?? "running",
      mode: "dry_run",
      triggerSource: "internal",
      requestedBy: null,
      scheduledAt: params.scheduledAt ?? now,
      startedAt: params.startedAt ?? now,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      heartbeatAt: null,
      leaseExpiresAt: null,
      workerId: null,
      attemptCount: 0,
      maxAttempts: 3,
      input: {},
      summary: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  const deps: ExecuteBacklinkCampaignPreviewRunDependencies = {
    startRun: async (input) => { startCalled += 1; return { kind: "transitioned", run: buildAutomationRun({ workspaceId: input.workspaceId, runId: input.runId, startedAt: input.startedAt }) } },
    executeWorkerOnce: async (input) => { workerCalled += 1; return { kind: "empty" } },
    completeRun: async (input) => { completeCalled += 1; return { kind: "transitioned", run: buildAutomationRun({ workspaceId: input.workspaceId, runId: input.runId, startedAt: null }) } },
    failRun: async (input) => { failCalled += 1; return { kind: "transitioned", run: buildAutomationRun({ workspaceId: input.workspaceId, runId: input.runId, startedAt: null, status: "failed" }) } },
  };

  const input: ExecuteBacklinkCampaignPreviewRunInput = {
    workspaceId: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000002",
    workerId: "worker-smoke",
    startedAt: "2026-08-06T00:00:00.000Z",
    attemptedAt: "2026-08-06T00:00:00.000Z",
    completedAt: "2026-08-06T00:00:00.000Z",
    failedAt: "2026-08-06T00:00:00.000Z",
    leaseDurationSeconds: 60,
    maxWorkerInvocations: 1,
  };

  const result = await executeBacklinkCampaignPreviewRun(deps, input);
  assert(result.kind === "pending_retry", "expected pending_retry when worker returns empty");
  console.log("PASS — Automation backlink campaign run executor smoke");
}

void main();

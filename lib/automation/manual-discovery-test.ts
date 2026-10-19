import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";

import type { AutomationTask, FailAutomationRunInput } from "./types";
import type { ExecuteClaimedDiscoveryTaskInput, ExecuteClaimedDiscoveryTaskResult } from "./worker-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ManualDiscoveryTestInput = {
  workspaceId: string;
  requestedBy: string;
  testId: string;
  query: string;
  workerId: string;
  now: string;
  leaseDurationSeconds: number;
};

export type ManualDiscoveryTestResult = Exclude<ExecuteClaimedDiscoveryTaskResult, { kind: "rejected" }>;

export class ManualDiscoveryTestError extends Error {
  constructor(readonly code: "CONFLICT" | "INVALID_INPUT" | "WORKSPACE_NOT_ELIGIBLE" | "PERSISTENCE") {
    super(code === "CONFLICT" ? "Manual Discovery test already exists." : "Manual Discovery test could not be started.");
    this.name = "ManualDiscoveryTestError";
  }
}

function isWorkspaceIneligible(error: BacklinkRepositoryError): boolean {
  return typeof error.cause === "object" && error.cause !== null && "message" in error.cause && typeof error.cause.message === "string" && (error.cause.message.includes("MANUAL_DISCOVERY_TEST_WORKSPACE_NOT_ELIGIBLE") || error.cause.message.includes("MANUAL_DISCOVERY_TEST_REQUESTER_NOT_AUTHORIZED"));
}

export type ManualDiscoveryTestDependencies = {
  createAndClaim: (input: Omit<ManualDiscoveryTestInput, "now"> & { claimedAt: string }) => Promise<AutomationTask | null>;
  executeClaimed: (input: ExecuteClaimedDiscoveryTaskInput) => Promise<ExecuteClaimedDiscoveryTaskResult>;
  failRun: (input: FailAutomationRunInput) => Promise<{ kind: "transitioned" | "rejected" }>;
};

function validate(input: ManualDiscoveryTestInput): void {
  if (!UUID.test(input.workspaceId) || !UUID.test(input.requestedBy) || !UUID.test(input.testId) || !input.workerId.trim() || !Number.isFinite(Date.parse(input.now)) || !Number.isInteger(input.leaseDurationSeconds) || input.leaseDurationSeconds < 30 || input.leaseDurationSeconds > 3600 || input.query.trim().length === 0 || input.query.trim().length > 500) {
    throw new ManualDiscoveryTestError("INVALID_INPUT");
  }
}

export async function runManualDiscoveryTest(dependencies: ManualDiscoveryTestDependencies, input: ManualDiscoveryTestInput): Promise<ManualDiscoveryTestResult> {
  validate(input);
  let task: AutomationTask | null;
  try {
    task = await dependencies.createAndClaim({ ...input, query: input.query.trim(), claimedAt: input.now });
  } catch (error) {
    if (error instanceof BacklinkRepositoryError && error.code === "CONFLICT") throw new ManualDiscoveryTestError("CONFLICT");
    if (error instanceof BacklinkRepositoryError && isWorkspaceIneligible(error)) throw new ManualDiscoveryTestError("WORKSPACE_NOT_ELIGIBLE");
    throw new ManualDiscoveryTestError("PERSISTENCE");
  }
  if (task === null || task.status !== "running" || task.taskKind !== "backlinks.discovery.preview" || task.attemptCount !== 1 || task.maxAttempts !== 1 || task.workerId !== input.workerId) {
    throw new ManualDiscoveryTestError("PERSISTENCE");
  }
  const result = await dependencies.executeClaimed({ workspaceId: input.workspaceId, runId: task.runId, workerId: input.workerId, claimedAt: input.now, attemptedAt: input.now, leaseDurationSeconds: input.leaseDurationSeconds, task });
  if (result.kind === "rejected") throw new ManualDiscoveryTestError("PERSISTENCE");
  if (result.kind === "dead_letter") {
    const failed = await dependencies.failRun({ workspaceId: input.workspaceId, runId: task.runId, failedAt: input.now, errorCode: "AUTOMATION_RUN_TASKS_DEAD_LETTERED", errorMessage: "One or more automation tasks reached dead-letter status" });
    if (failed.kind === "rejected") throw new ManualDiscoveryTestError("PERSISTENCE");
  }
  return result;
}

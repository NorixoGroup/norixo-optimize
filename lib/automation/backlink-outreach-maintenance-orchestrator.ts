import type { BacklinkOutreachScheduleReconciliationPreviewResult } from "@/lib/backlinks/services/outreachScheduleReconciliationService";
import type { BacklinkOutreachSignalDetectionRunResult } from "./backlink-outreach-maintenance-runner";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BacklinkOutreachMaintenanceWorkspaceControl = {
  workspaceId: string;
  backlinksEnabled: boolean;
  dryRunOnly: boolean;
  disabledReason: string | null;
};

export type BacklinkOutreachMaintenanceOrchestrationInput = {
  workspaceLimit?: number;
};

export type BacklinkOutreachMaintenanceOrchestrationIssue = {
  workspaceId: string;
  operation: "schedule_reconciliation" | "signal_detection";
  status: "failed";
  errorCode: string;
};

export type BacklinkOutreachMaintenanceOrchestrationSummary = {
  workspacesScanned: number;
  workspacesSucceeded: number;
  workspacesFailed: number;
  reconciliationRunsCreated: number;
  reconciliationRunsExisting: number;
  signalRunsCreated: number;
  signalRunsExisting: number;
  dueDetected: number;
  expiredDetected: number;
  signalTasksCreated: number;
  signalTasksExisting: number;
};

export type BacklinkOutreachMaintenanceOrchestrationResult =
  BacklinkOutreachMaintenanceOrchestrationSummary & {
    issues: BacklinkOutreachMaintenanceOrchestrationIssue[];
  };

export type BacklinkOutreachMaintenanceOrchestrationDependencies = {
  listEligibleWorkspaces: (
    limit: number,
  ) => Promise<BacklinkOutreachMaintenanceWorkspaceControl[]>;
  previewScheduleReconciliation: (input: {
    workspaceId: string;
    idempotencyKey: string;
    scheduledAt: string;
    limit: number;
  }) => Promise<{
    disposition: "created" | "existing";
    result: BacklinkOutreachScheduleReconciliationPreviewResult;
  }>;
  previewSignalDetection: (input: {
    workspaceId: string;
    idempotencyKey: string;
    limit: number;
  }) => Promise<{
    disposition: "created" | "existing";
    result: BacklinkOutreachSignalDetectionRunResult;
  }>;
  now?: () => string;
};

const DEFAULT_WORKSPACE_LIMIT = 25;
const MAX_WORKSPACE_LIMIT = 100;
const DEFAULT_OPERATION_LIMIT = 100;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertUuid(value: string, label: string): void {
  assert(UUID_PATTERN.test(value), `${label} must be a valid UUID`);
}

function normalizeWorkspaceLimit(limit: number | undefined): number {
  if (limit == null) {
    return DEFAULT_WORKSPACE_LIMIT;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    return DEFAULT_WORKSPACE_LIMIT;
  }
  return Math.min(limit, MAX_WORKSPACE_LIMIT);
}

function normalizeNow(now?: () => string): string {
  const value = now?.() ?? new Date().toISOString();
  assert(Number.isFinite(Date.parse(value)), "now must be a valid date");
  return new Date(value).toISOString();
}

function hourBucket(iso: string): string {
  return iso.slice(0, 13);
}

function buildIdempotencyKey(
  operation: "schedule_reconciliation" | "signal_detection",
  workspaceId: string,
  bucket: string,
): string {
  return `backlinks:outreach:maintenance:${operation}:${workspaceId}:${bucket}`;
}

function normalizeWorkspaces(
  workspaces: BacklinkOutreachMaintenanceWorkspaceControl[],
  limit: number,
): BacklinkOutreachMaintenanceWorkspaceControl[] {
  return workspaces
    .filter(
      (workspace) =>
        workspace.backlinksEnabled === true &&
        workspace.dryRunOnly === true &&
        workspace.disabledReason == null,
    )
    .sort((left, right) => left.workspaceId.localeCompare(right.workspaceId))
    .slice(0, limit);
}

export async function runBacklinkOutreachMaintenanceOrchestration(
  dependencies: BacklinkOutreachMaintenanceOrchestrationDependencies,
  input: BacklinkOutreachMaintenanceOrchestrationInput,
): Promise<BacklinkOutreachMaintenanceOrchestrationResult> {
  const workspaceLimit = normalizeWorkspaceLimit(input.workspaceLimit);
  const serverNow = normalizeNow(dependencies.now);
  const bucket = hourBucket(serverNow);
  const eligibleWorkspaces = normalizeWorkspaces(
    await dependencies.listEligibleWorkspaces(workspaceLimit),
    workspaceLimit,
  );

  const summary: BacklinkOutreachMaintenanceOrchestrationSummary = {
    workspacesScanned: eligibleWorkspaces.length,
    workspacesSucceeded: 0,
    workspacesFailed: 0,
    reconciliationRunsCreated: 0,
    reconciliationRunsExisting: 0,
    signalRunsCreated: 0,
    signalRunsExisting: 0,
    dueDetected: 0,
    expiredDetected: 0,
    signalTasksCreated: 0,
    signalTasksExisting: 0,
  };
  const issues: BacklinkOutreachMaintenanceOrchestrationIssue[] = [];

  for (const workspace of eligibleWorkspaces) {
    assertUuid(workspace.workspaceId, "workspaceId");

    let workspaceFailed = false;

    try {
      const schedule = await dependencies.previewScheduleReconciliation({
        workspaceId: workspace.workspaceId,
        idempotencyKey: buildIdempotencyKey(
          "schedule_reconciliation",
          workspace.workspaceId,
          bucket,
        ),
        scheduledAt: serverNow,
        limit: DEFAULT_OPERATION_LIMIT,
      });
      if (schedule.disposition === "created") {
        summary.reconciliationRunsCreated += 1;
      } else {
        summary.reconciliationRunsExisting += 1;
      }
    } catch (error) {
      workspaceFailed = true;
      issues.push({
        workspaceId: workspace.workspaceId,
        operation: "schedule_reconciliation",
        status: "failed",
        errorCode:
          error instanceof Error && error.message.trim().length > 0
            ? error.message.slice(0, 100)
            : "BACKLINK_OUTREACH_MAINTENANCE_FAILED",
      });
    }

    try {
      const signals = await dependencies.previewSignalDetection({
        workspaceId: workspace.workspaceId,
        idempotencyKey: buildIdempotencyKey(
          "signal_detection",
          workspace.workspaceId,
          bucket,
        ),
        limit: DEFAULT_OPERATION_LIMIT,
      });
      if (signals.disposition === "created") {
        summary.signalRunsCreated += 1;
      } else {
        summary.signalRunsExisting += 1;
      }
      summary.dueDetected += signals.result.dueDetected;
      summary.expiredDetected += signals.result.expiredDetected;
      summary.signalTasksCreated +=
        signals.result.dueTaskCreated + signals.result.expiredTaskCreated;
      summary.signalTasksExisting +=
        signals.result.dueTaskExisting + signals.result.expiredTaskExisting;
    } catch (error) {
      workspaceFailed = true;
      issues.push({
        workspaceId: workspace.workspaceId,
        operation: "signal_detection",
        status: "failed",
        errorCode:
          error instanceof Error && error.message.trim().length > 0
            ? error.message.slice(0, 100)
            : "BACKLINK_OUTREACH_MAINTENANCE_FAILED",
      });
    }

    if (workspaceFailed) {
      summary.workspacesFailed += 1;
    } else {
      summary.workspacesSucceeded += 1;
    }
  }

  return {
    ...summary,
    issues,
  };
}

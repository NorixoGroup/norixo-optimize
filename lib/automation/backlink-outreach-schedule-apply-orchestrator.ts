import type { BacklinkOutreachScheduleApplySummary } from "@/lib/backlinks/services/outreachScheduleApplyService";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BacklinkOutreachScheduleApplyOrchestrationWorkspaceControl = {
  workspaceId: string;
  backlinksEnabled: boolean;
  backlinkOutreachScheduleApplyEnabled: boolean;
  dryRunOnly: boolean;
  disabledReason: string | null;
};

export type BacklinkOutreachScheduleApplyOrchestrationInput = {
  workspaceLimit?: number;
  outreachLimitPerWorkspace?: number;
  now?: () => string;
};

export type BacklinkOutreachScheduleApplyOrchestrationIssue = {
  workspaceId: string;
  status: "failed";
  errorCode: string;
};

export type BacklinkOutreachScheduleApplyOrchestrationWorkspaceResult = {
  workspaceId: string;
  runDisposition: "created" | "existing";
  result: BacklinkOutreachScheduleApplySummary;
};

export type BacklinkOutreachScheduleApplyOrchestrationSummary = {
  workspacesScanned: number;
  workspacesSucceeded: number;
  workspacesFailed: number;
  runsCreated: number;
  runsExisting: number;
  scheduled: number;
  existing: number;
  notApplicable: number;
  conflicts: number;
  failed: number;
  workspaces: BacklinkOutreachScheduleApplyOrchestrationWorkspaceResult[];
  issues: BacklinkOutreachScheduleApplyOrchestrationIssue[];
};

export type BacklinkOutreachScheduleApplyOrchestrationDependencies = {
  listEligibleWorkspaces: (
    limit: number,
  ) => Promise<BacklinkOutreachScheduleApplyOrchestrationWorkspaceControl[]>;
  applyWorkspace: (input: {
    workspaceId: string;
    outreachLimit: number;
    scheduledAt: string;
  }) => Promise<BacklinkOutreachScheduleApplyOrchestrationWorkspaceResult>;
  now?: () => string;
};

const DEFAULT_WORKSPACE_LIMIT = 25;
const MAX_WORKSPACE_LIMIT = 100;
const DEFAULT_OUTREACH_LIMIT = 100;
const MAX_OUTREACH_LIMIT = 200;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertUuid(value: string, label: string): void {
  assert(UUID_PATTERN.test(value), `${label} must be a valid UUID`);
}

function normalizeLimit(limit: number | undefined, fallback: number, max: number): number {
  if (limit == null) return fallback;
  if (!Number.isInteger(limit) || limit < 1) return fallback;
  return Math.min(limit, max);
}

function normalizeNow(now?: () => string): string {
  const value = now?.() ?? new Date().toISOString();
  assert(Number.isFinite(Date.parse(value)), "now must be a valid date");
  return new Date(value).toISOString();
}

function normalizeEligibleWorkspaces(
  workspaces: BacklinkOutreachScheduleApplyOrchestrationWorkspaceControl[],
  limit: number,
): BacklinkOutreachScheduleApplyOrchestrationWorkspaceControl[] {
  return workspaces
    .filter(
      (workspace) =>
        workspace.backlinksEnabled === true &&
        workspace.backlinkOutreachScheduleApplyEnabled === true &&
        workspace.dryRunOnly === true &&
        workspace.disabledReason == null,
    )
    .sort((left, right) => left.workspaceId.localeCompare(right.workspaceId))
    .slice(0, limit);
}

export async function runBacklinkOutreachScheduleApplyOrchestration(
  dependencies: BacklinkOutreachScheduleApplyOrchestrationDependencies,
  input: BacklinkOutreachScheduleApplyOrchestrationInput,
): Promise<BacklinkOutreachScheduleApplyOrchestrationSummary> {
  const workspaceLimit = normalizeLimit(input.workspaceLimit, DEFAULT_WORKSPACE_LIMIT, MAX_WORKSPACE_LIMIT);
  const outreachLimit = normalizeLimit(input.outreachLimitPerWorkspace, DEFAULT_OUTREACH_LIMIT, MAX_OUTREACH_LIMIT);
  const serverNow = normalizeNow(dependencies.now);

  const eligibleWorkspaces = normalizeEligibleWorkspaces(
    await dependencies.listEligibleWorkspaces(workspaceLimit),
    workspaceLimit,
  );

  const summary: BacklinkOutreachScheduleApplyOrchestrationSummary = {
    workspacesScanned: eligibleWorkspaces.length,
    workspacesSucceeded: 0,
    workspacesFailed: 0,
    runsCreated: 0,
    runsExisting: 0,
    scheduled: 0,
    existing: 0,
    notApplicable: 0,
    conflicts: 0,
    failed: 0,
    workspaces: [],
    issues: [],
  };

  for (const workspace of eligibleWorkspaces) {
    assertUuid(workspace.workspaceId, "workspaceId");
    try {
      const result = await dependencies.applyWorkspace({
        workspaceId: workspace.workspaceId,
        outreachLimit,
        scheduledAt: serverNow,
      });
      summary.workspaces.push(result);
      if (result.runDisposition === "created") {
        summary.runsCreated += 1;
      } else {
        summary.runsExisting += 1;
      }
      summary.workspacesSucceeded += 1;
      summary.scheduled += result.result.scheduled;
      summary.existing += result.result.existing;
      summary.notApplicable += result.result.notApplicable;
      summary.conflicts += result.result.conflicts;
      summary.failed += result.result.failed;
    } catch (error) {
      summary.workspacesFailed += 1;
      summary.issues.push({
        workspaceId: workspace.workspaceId,
        status: "failed",
        errorCode:
          error instanceof Error && error.message.trim().length > 0
            ? error.message.slice(0, 100)
            : "BACKLINK_OUTREACH_SCHEDULE_APPLY_ORCHESTRATION_FAILED",
      });
    }
  }

  return summary;
}

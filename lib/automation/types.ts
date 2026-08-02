import type { Json } from "@/types/database.types";

export type AutomationSystem = "backlinks";
export type AutomationRunKind = string;
export type AutomationRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type AutomationRunMode = "dry_run";
export type AutomationTriggerSource = "manual" | "scheduled" | "internal";

export type AutomationRun = {
  id: string;
  workspaceId: string;
  system: AutomationSystem;
  runKind: AutomationRunKind;
  idempotencyKey: string;
  status: AutomationRunStatus;
  mode: AutomationRunMode;
  triggerSource: AutomationTriggerSource;
  requestedBy: string | null;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  heartbeatAt: string | null;
  leaseExpiresAt: string | null;
  workerId: string | null;
  attemptCount: number;
  maxAttempts: number;
  input: Json;
  summary: Json | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationWorkspaceControl = {
  workspaceId: string;
  backlinksEnabled: boolean;
  dryRunOnly: boolean;
  disabledReason: string | null;
};

export type CreateAutomationRunInput = {
  workspaceId: string;
  system: AutomationSystem;
  runKind: string;
  idempotencyKey: string;
  mode: AutomationRunMode;
  triggerSource: AutomationTriggerSource;
  requestedBy: string | null;
  scheduledAt: string;
  input: Json;
};

export type CreateAutomationRunResult =
  | { kind: "created"; run: AutomationRun }
  | { kind: "existing"; run: AutomationRun }
  | { kind: "rejected"; reason: "automation_disabled" | "dry_run_required" };

export type StartAutomationRunInput = { workspaceId: string; runId: string; startedAt: string };
export type CompleteAutomationRunInput = { workspaceId: string; runId: string; completedAt: string; summary: Json | null };
export type FailAutomationRunInput = { workspaceId: string; runId: string; failedAt: string; errorCode: string; errorMessage: string };
export type CancelAutomationRunInput = { workspaceId: string; runId: string; cancelledAt: string; reason: string | null };

export type StartAutomationRunResult = { kind: "transitioned"; run: AutomationRun } | { kind: "rejected"; reason: "not_updated" };
export type CompleteAutomationRunResult = { kind: "transitioned"; run: AutomationRun } | { kind: "rejected"; reason: "not_updated" };
export type FailAutomationRunResult = { kind: "transitioned"; run: AutomationRun } | { kind: "rejected"; reason: "not_updated" };
export type CancelAutomationRunResult = { kind: "transitioned"; run: AutomationRun } | { kind: "rejected"; reason: "not_updated" };

export type CreateAutomationRunDependencies = {
  getWorkspaceControl: (workspaceId: string) => Promise<AutomationWorkspaceControl | null>;
  createOrGetRun: (input: CreateAutomationRunInput) => Promise<Extract<CreateAutomationRunResult, { kind: "created" | "existing" }>>;
};

export type AutomationRunTransitionDependencies = {
  startRun: (input: StartAutomationRunInput) => Promise<AutomationRun | null>;
  completeRun: (input: CompleteAutomationRunInput) => Promise<AutomationRun | null>;
  failRun: (input: FailAutomationRunInput) => Promise<AutomationRun | null>;
  cancelRun: (input: CancelAutomationRunInput) => Promise<AutomationRun | null>;
};

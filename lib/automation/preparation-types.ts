import type { Json } from "@/types/database.types";
import type { AutomationRun, AutomationTask, AutomationTriggerSource, CreateAutomationRunInput, CreateAutomationRunResult, CreateAutomationTaskInput, CreateAutomationTaskResult } from "./types";
export type PrepareBacklinksAutomationRunInput={workspaceId:string;requestedBy:string|null;idempotencyKey:string;triggerSource:AutomationTriggerSource;scheduledAt:string;discoveryInput:Record<string,Json>;qualificationInput:Record<string,Json>;promotionInput:Record<string,Json>};
export type PrepareBacklinksAutomationRunDependencies={createRun:(input:CreateAutomationRunInput)=>Promise<CreateAutomationRunResult>;createTask:(input:CreateAutomationTaskInput)=>Promise<CreateAutomationTaskResult>};
export type PreparedBacklinksAutomationTask = {
  disposition: "created" | "existing";
  task: AutomationTask;
};

export type PrepareBacklinksAutomationRunResult =
  | {
      kind: "prepared";
      run: AutomationRun;
      runDisposition: "created" | "existing";
      tasks: readonly PreparedBacklinksAutomationTask[];
    }
  | { kind: "rejected"; reason: "automation_disabled" | "dry_run_required" };

import type { Json } from "@/types/database.types";
import type { AutomationRun, AutomationTask, AutomationTriggerSource, CreateAutomationRunInput, CreateAutomationRunResult, CreateAutomationTaskInput, CreateAutomationTaskResult } from "./types";
import type { BacklinkCampaignEngineTaskInputV1 } from "./backlink-campaign-engine-task-types";

export type PrepareBacklinkCampaignPreviewRunInput = {
  workspaceId: string;
  requestedBy: string | null;
  idempotencyKey: string;
  triggerSource: AutomationTriggerSource;
  scheduledAt: string;
  campaignTaskInput: BacklinkCampaignEngineTaskInputV1;
};

export type PrepareBacklinkCampaignPreviewRunDependencies = {
  createRun(input: CreateAutomationRunInput): Promise<CreateAutomationRunResult>;
  createTask(input: CreateAutomationTaskInput): Promise<CreateAutomationTaskResult>;
};

export type PrepareBacklinkCampaignPreviewRunResult =
  | {
      kind: "prepared";
      run: AutomationRun;
      runDisposition: "created" | "existing";
      task: AutomationTask;
      taskDisposition: "created" | "existing";
    }
  | {
      kind: "rejected";
      reason: "automation_disabled" | "dry_run_required";
    };

export class BacklinkCampaignRunPreparationError extends Error {
  readonly code = "BACKLINK_CAMPAIGN_RUN_PREPARATION_INVARIANT" as const;

  constructor() {
    super("Backlink campaign run preparation invariant failed");
    this.name = "BacklinkCampaignRunPreparationError";
  }
}

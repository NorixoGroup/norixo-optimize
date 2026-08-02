import type { Json } from "@/types/database.types";

export type BuildBacklinksDryRunPlanInput = {
  workspaceId: string;
  runId: string;
  scheduledAt: string;
  discoveryInput: Record<string, Json>;
  qualificationInput: Record<string, Json>;
};

export type BacklinksDryRunPlannedTask = {
  workspaceId: string;
  runId: string;
  system: "backlinks";
  taskKind: "backlinks.discovery.preview" | "backlinks.qualification.preview";
  taskKey: "discovery-preview" | "qualification-preview";
  priority: number;
  scheduledAt: string;
  availableAt: string;
  input: Record<string, Json>;
};

export type BacklinksDryRunPlan = {
  tasks: readonly [BacklinksDryRunPlannedTask, BacklinksDryRunPlannedTask];
};

import type { Json } from "@/types/database.types";

export type BuildBacklinksDryRunPlanInput = {
  workspaceId: string;
  runId: string;
  scheduledAt: string;
  discoveryInput: Record<string, Json>;
  qualificationInput: Record<string, Json>;
  promotionInput: Record<string, Json>;
};

export type BacklinksDryRunPlannedTaskKind =
  | "backlinks.discovery.preview"
  | "backlinks.qualification.preview"
  | "backlinks.promotion.preview";

export type BacklinksDryRunPlannedTaskKey =
  | "discovery-preview"
  | "qualification-preview"
  | "promotion-preview";

export type BacklinksDryRunPlannedTask = {
  workspaceId: string;
  runId: string;
  system: "backlinks";
  taskKind: BacklinksDryRunPlannedTaskKind;
  taskKey: BacklinksDryRunPlannedTaskKey;
  priority: number;
  scheduledAt: string;
  availableAt: string;
  input: Record<string, Json>;
  dependsOnTaskKey: BacklinksDryRunPlannedTaskKey | null;
};

export type BacklinksDryRunPlan = {
  tasks: readonly BacklinksDryRunPlannedTask[];
};

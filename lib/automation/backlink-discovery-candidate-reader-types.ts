import type { BacklinkDiscoveryPreviewCandidate } from "./backlink-discovery-handler-types";
import type { AutomationRun, AutomationTask } from "./types";

export type ReadBacklinkDiscoveryCandidateInput = {
  workspaceId: string;
  runId: string;
  taskId: string;
  candidateKey: string;
};

export type ReadBacklinkDiscoveryCandidateDependencies = {
  getRunById: (input: {
    workspaceId: string;
    runId: string;
  }) => Promise<AutomationRun | null>;
  getTaskByIdInRun: (input: {
    workspaceId: string;
    runId: string;
    taskId: string;
  }) => Promise<AutomationTask | null>;
};

export type ReadBacklinkDiscoveryCandidateResult = {
  run: AutomationRun;
  task: AutomationTask;
  candidate: BacklinkDiscoveryPreviewCandidate;
};

export type BacklinkDiscoveryCandidateReaderErrorCode =
  | "RUN_NOT_FOUND"
  | "TASK_NOT_FOUND"
  | "TASK_NOT_COMPLETED"
  | "TASK_KIND_INVALID"
  | "OUTPUT_INVALID"
  | "CANDIDATE_NOT_FOUND";

export class BacklinkDiscoveryCandidateReaderError extends Error {
  readonly code: BacklinkDiscoveryCandidateReaderErrorCode;

  constructor(code: BacklinkDiscoveryCandidateReaderErrorCode) {
    super("The discovery candidate could not be read.");
    this.name = "BacklinkDiscoveryCandidateReaderError";
    this.code = code;
  }
}

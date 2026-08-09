import type {
  ApplyQualificationDisposition,
  ApplyQualificationReasonCode,
} from "./backlink-qualification-application-types";
import type { BacklinkQualificationDecision } from "./backlink-qualification-types";

export const BACKLINK_QUALIFICATION_BATCH_MAX_ITEMS = 50;

export type ApplyQualificationBatchInput = {
  workspaceId: string;
  actorUserId: string;
  runId: string;
  taskId: string;
  opportunityIds: readonly string[];
};

export type ApplyQualificationBatchItemResult = {
  opportunityId: string;
  candidateKey: string | null;
  decision: BacklinkQualificationDecision | null;
  previousQualificationStatus: string | null;
  qualificationStatus: string | null;
  disposition: ApplyQualificationDisposition | "failed";
  reasonCode?: ApplyQualificationReasonCode;
  error?: { code: string; message: string };
};

export type ApplyQualificationBatchResult = {
  runId: string;
  taskId: string;
  total: number;
  updated: number;
  existing: number;
  notApplicable: number;
  failed: number;
  items: readonly ApplyQualificationBatchItemResult[];
};

export class BacklinkQualificationBatchApplyServiceError extends Error {
  constructor(
    readonly code:
      | "QUALIFICATION_BATCH_INPUT_INVALID"
      | "QUALIFICATION_BATCH_TOO_MANY_OPPORTUNITIES"
      | "QUALIFICATION_BATCH_DUPLICATE_OPPORTUNITY_ID",
  ) {
    super("Qualification batch input is invalid.");
    this.name = "BacklinkQualificationBatchApplyServiceError";
  }
}

export type ApplyQualificationBatchDependencies = {
  readQualificationTask: (input: {
    workspaceId: string;
    runId: string;
    taskId: string;
  }) => Promise<{
    input: import("./backlink-qualification-types").BacklinkQualificationPreviewInputV1;
    output: unknown;
    discoveryTaskId?: string | null;
  }>;
  listDiscoveryIntakeApplications: (input: {
    workspaceId: string;
    discoveryTaskId: string;
  }) => Promise<readonly { candidateKey: string; opportunityId: string }[]>;
  getOpportunityById: (
    workspaceId: string,
    opportunityId: string,
  ) => Promise<{ id: string; target_page_url: string; qualification_status: string | null }>;
  updateOpportunityQualificationStatus: (
    workspaceId: string,
    opportunityId: string,
    qualificationStatus: string,
  ) => Promise<{ id: string; target_page_url: string; qualification_status: string | null }>;
};

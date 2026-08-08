import type { BacklinkQualificationDecision } from "./backlink-qualification-types";

export type ApplyQualificationInput = {
  workspaceId: string;
  actorUserId: string;
  runId: string;
  taskId: string;
  opportunityId: string;
};

export type ApplyQualificationDisposition = "updated" | "existing" | "not_applicable";

export type ApplyQualificationResult = {
  opportunityId: string;
  runId: string;
  taskId: string;
  decision: BacklinkQualificationDecision;
  previousQualificationStatus: string | null;
  qualificationStatus: string | null;
  disposition: ApplyQualificationDisposition;
};

export type BacklinkQualificationApplyServiceErrorCode =
  | "QUALIFICATION_APPLY_INPUT_INVALID"
  | "QUALIFICATION_PREVIEW_TASK_NOT_FOUND"
  | "QUALIFICATION_PREVIEW_TASK_NOT_COMPLETED"
  | "QUALIFICATION_PREVIEW_SCOPE_MISMATCH"
  | "QUALIFICATION_PREVIEW_OUTPUT_INVALID"
  | "QUALIFICATION_PREVIEW_OPPORTUNITY_MISMATCH"
  | "QUALIFICATION_DECISION_NOT_APPLICABLE"
  | "QUALIFICATION_PREVIEW_TASK_KIND_INVALID"
  | "QUALIFICATION_OPPORTUNITY_NOT_FOUND";

export class BacklinkQualificationApplyServiceError extends Error {
  readonly code: BacklinkQualificationApplyServiceErrorCode;

  constructor(code: BacklinkQualificationApplyServiceErrorCode, message: string) {
    super(message);
    this.name = "BacklinkQualificationApplyServiceError";
    this.code = code;
  }
}

export type ApplyServiceDependencies<InputTask, OpportunityRow> = {
  readQualificationTask: (input: {
    workspaceId: string;
    runId: string;
    taskId: string;
  }) => Promise<{ input: InputTask; output: unknown }>;
  getOpportunityById: (workspaceId: string, opportunityId: string) => Promise<OpportunityRow>;
  updateOpportunityQualificationStatus: (
    workspaceId: string,
    opportunityId: string,
    qualificationStatus: string,
  ) => Promise<OpportunityRow>;
};

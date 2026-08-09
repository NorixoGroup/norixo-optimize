import type { BacklinkQualificationDecision } from "./backlink-qualification-types";

export type ApplyQualificationInput = {
  workspaceId: string;
  actorUserId: string;
  runId: string;
  taskId: string;
  opportunityId: string;
};

export type ApplyQualificationDisposition = "updated" | "existing" | "not_applicable";

export type ApplyQualificationReasonCode =
  | "REJECTED_DECISION"
  | "OPPORTUNITY_STATUS_PROTECTED";

export type ApplyQualificationResult = {
  opportunityId: string;
  runId: string;
  taskId: string;
  decision: BacklinkQualificationDecision;
  previousQualificationStatus: string | null;
  qualificationStatus: string | null;
  disposition: ApplyQualificationDisposition;
  reasonCode?: ApplyQualificationReasonCode;
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
  | "QUALIFICATION_OPPORTUNITY_NOT_FOUND"
  | "QUALIFICATION_INTAKE_MAPPING_MISMATCH";

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
  }) => Promise<{ input: InputTask; output: unknown; discoveryTaskId?: string | null }>;
  listDiscoveryIntakeApplicationsForCandidate?: (input: {
    workspaceId: string;
    discoveryTaskId: string;
    candidateKey: string;
  }) => Promise<readonly { opportunityId: string }[]>;
  getOpportunityById: (workspaceId: string, opportunityId: string) => Promise<OpportunityRow>;
  updateOpportunityQualificationStatus: (
    workspaceId: string,
    opportunityId: string,
    qualificationStatus: string,
  ) => Promise<OpportunityRow>;
};

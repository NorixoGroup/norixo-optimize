import type {
  BacklinkPromotionPreviewOutputV1,
  BacklinkPromotionProposal,
} from "./backlink-promotion-types";
import type { AutomationTask } from "./types";

export type ReadBacklinkPromotionProposalInput = {
  workspaceId: string;
  runId: string;
  promotionTaskId: string;
  proposalKey: string;
};

export type ReadBacklinkPromotionProposalDependencies = {
  getTaskByIdInRun: (input: {
    workspaceId: string;
    runId: string;
    taskId: string;
  }) => Promise<AutomationTask | null>;
};

export type ReadBacklinkPromotionProposalResult = {
  promotionTask: AutomationTask;
  promotionPreview: BacklinkPromotionPreviewOutputV1;
  proposal: BacklinkPromotionProposal;
};

export type BacklinkPromotionProposalReaderErrorCode =
  | "INVALID_PROMOTION_PROPOSAL_READ_INPUT"
  | "PROMOTION_TASK_NOT_FOUND"
  | "PROMOTION_TASK_SCOPE_MISMATCH"
  | "PROMOTION_TASK_KIND_INVALID"
  | "PROMOTION_TASK_NOT_COMPLETED"
  | "PROMOTION_OUTPUT_INVALID"
  | "PROMOTION_PROPOSAL_NOT_FOUND"
  | "PROMOTION_PROPOSAL_MULTIPLE_MATCHES"
  | "PROMOTION_PROPOSAL_INVALID";

export class BacklinkPromotionProposalReaderError extends Error {
  readonly code: BacklinkPromotionProposalReaderErrorCode;

  constructor(code: BacklinkPromotionProposalReaderErrorCode) {
    super("The promotion proposal could not be read.");
    this.name = "BacklinkPromotionProposalReaderError";
    this.code = code;
  }
}

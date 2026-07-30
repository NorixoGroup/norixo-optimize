export type {
  VerificationEvidence,
  VerificationIssue,
  VerificationIssueSeverity,
  VerificationPolicy,
  VerificationRequest,
  VerificationResult,
  VerificationStatus,
} from "./types";

export {
  isAnchorAcceptable,
  isRedirectAcceptable,
  isRelAcceptable,
  isTargetAcceptable,
  isVerificationSuccessful,
} from "./rules";

export { evaluateVerification } from "./evaluator";

export { buildVerificationEvidence } from "./evidence-builder";
export { runVerification } from "./engine";

export type { VerificationEvidenceRequest } from "./evidence-builder";

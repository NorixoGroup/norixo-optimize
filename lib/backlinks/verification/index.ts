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
export { buildBacklinkVerificationAttempt } from "./attempt-mapper";
export { persistBacklinkVerificationResult } from "./persistence";
export { recordBacklinkVerificationAttempt } from "./attempt-service";
export { executeBacklinkVerificationRun } from "./run-service";
export { createOrGetBacklinkVerificationJob } from "./job-service";
export { executeClaimedBacklinkVerificationJob } from "./claimed-job-orchestrator";
export { executeBacklinkVerificationWorker } from "./worker";
export {
  claimNextVerificationJob,
  completeVerificationJob,
  extendVerificationJobLease,
  failVerificationJob,
} from "./job-claim-service";
export { runVerification } from "./engine";
export { executeBacklinkVerification } from "./runtime";

export type { VerificationEvidenceRequest } from "./evidence-builder";
export type {
  BacklinkVerificationAttempt,
  BuildBacklinkVerificationAttemptInput,
  CreateBacklinkVerificationAttemptInput,
  RecordBacklinkVerificationAttemptDependencies,
  RecordBacklinkVerificationAttemptInput,
} from "./attempt-types";
export type {
  PersistBacklinkVerificationDependencies,
  PersistBacklinkVerificationResult,
  PersistBacklinkVerificationResultInput,
} from "./persistence-types";
export type {
  BacklinkVerificationHttpResponse,
  BacklinkVerificationRuntimeDependencies,
  BacklinkVerificationRuntimeResult,
  ExecuteBacklinkVerificationInput,
} from "./runtime-types";
export type {
  BacklinkVerificationRunResult,
  ExecuteBacklinkVerificationRunDependencies,
  ExecuteBacklinkVerificationRunInput,
} from "./run-types";
export type {
  BacklinkVerificationJob,
  BacklinkVerificationJobStatus,
  BacklinkVerificationJobTriggerSource,
  CreateBacklinkVerificationJobInput,
  CreateOrGetBacklinkVerificationJobDependencies,
  CreateOrGetBacklinkVerificationJobResult,
  HttpVerificationOptions,
} from "./job-types";
export type {
  ClaimNextBacklinkVerificationJobInput,
  ClaimNextBacklinkVerificationJobResult,
  CompleteBacklinkVerificationJobInput,
  CompleteBacklinkVerificationJobResult,
  FailBacklinkVerificationJobInput,
  FailBacklinkVerificationJobResult,
  HeartbeatBacklinkVerificationJobInput,
  HeartbeatBacklinkVerificationJobResult,
} from "./job-claim-types";
export type {
  ClaimNextVerificationJobDependencies,
  CompleteVerificationJobDependencies,
  ExtendVerificationJobLeaseDependencies,
  FailVerificationJobDependencies,
} from "./job-claim-service";
export type {
  ExecuteClaimedBacklinkVerificationJobDependencies,
  ExecuteClaimedBacklinkVerificationJobInput,
  ExecuteClaimedBacklinkVerificationJobResult,
} from "./claimed-job-orchestrator-types";
export type {
  ExecuteBacklinkVerificationWorkerDependencies,
  ExecuteBacklinkVerificationWorkerInput,
  ExecuteBacklinkVerificationWorkerResult,
} from "./worker-types";

import type { HttpFetchRequest } from "../http";
import type { BacklinkLinkRow } from "../repositories/linksRepository";
import type { WorkspaceId } from "../repositories/types";

import type {
  BacklinkVerificationAttempt,
  RecordBacklinkVerificationAttemptDependencies,
} from "./attempt-types";
import type {
  PersistBacklinkVerificationDependencies,
  PersistBacklinkVerificationResult,
} from "./persistence-types";
import type {
  BacklinkVerificationRuntimeResult,
  ExecuteBacklinkVerificationInput,
} from "./runtime-types";
import type { VerificationPolicy } from "./types";
import type { BacklinkVerificationJobTriggerSource } from "./job-types";

export interface ExecuteBacklinkVerificationRunInput {
  workspaceId: WorkspaceId;
  linkId: string;
  triggerSource: BacklinkVerificationJobTriggerSource;
  attemptedAt: string;
  policy: VerificationPolicy;
  http: Omit<HttpFetchRequest, "url">;
}

export interface ExecuteBacklinkVerificationRunDependencies {
  getLink: (workspaceId: WorkspaceId, linkId: string) => Promise<BacklinkLinkRow>;
  executeRuntime: (
    input: ExecuteBacklinkVerificationInput,
  ) => Promise<BacklinkVerificationRuntimeResult>;
  recordAttempt: (
    input: {
      workspaceId: WorkspaceId;
      linkId: string;
      sourceUrl: string;
      targetUrl: string;
      attemptedAt: string;
      runtimeResult: BacklinkVerificationRuntimeResult;
    },
    dependencies: RecordBacklinkVerificationAttemptDependencies,
  ) => Promise<BacklinkVerificationAttempt>;
  recordAttemptDependencies: RecordBacklinkVerificationAttemptDependencies;
  persistCurrentState: (
    input: {
      workspaceId: WorkspaceId;
      linkId: string;
      triggerSource: BacklinkVerificationJobTriggerSource;
      runtimeResult: BacklinkVerificationRuntimeResult;
    },
    dependencies: PersistBacklinkVerificationDependencies,
  ) => Promise<PersistBacklinkVerificationResult>;
  persistenceDependencies: PersistBacklinkVerificationDependencies;
}

export interface BacklinkVerificationRunResult {
  link: BacklinkLinkRow;
  runtimeResult: BacklinkVerificationRuntimeResult;
  attempt: BacklinkVerificationAttempt;
  persistenceResult: PersistBacklinkVerificationResult;
}

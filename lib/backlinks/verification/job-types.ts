import type { HttpFetchRequest } from "../http";
import type { WorkspaceId } from "../repositories/types";

import type { VerificationPolicy } from "./types";

export type BacklinkVerificationJobStatus = "queued" | "running" | "completed" | "failed";
export type BacklinkVerificationJobTriggerSource = "manual" | "scheduler" | "retry" | "system";
export type HttpVerificationOptions = Omit<HttpFetchRequest, "url">;

export interface BacklinkVerificationJob {
  id: string;
  workspaceId: WorkspaceId;
  linkId: string;
  jobKey: string;
  triggerSource: BacklinkVerificationJobTriggerSource;
  status: BacklinkVerificationJobStatus;
  policy: VerificationPolicy;
  http: HttpVerificationOptions;
  attemptCount: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  workerId: string | null;
  claimedAt: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
}

export interface CreateBacklinkVerificationJobInput {
  workspaceId: WorkspaceId;
  linkId: string;
  jobKey: string;
  triggerSource: BacklinkVerificationJobTriggerSource;
  policy: VerificationPolicy;
  http: HttpVerificationOptions;
  queuedAt: string;
}

export type CreateOrGetBacklinkVerificationJobResult =
  | { kind: "created"; job: BacklinkVerificationJob }
  | { kind: "existing"; job: BacklinkVerificationJob };

export interface CreateOrGetBacklinkVerificationJobDependencies {
  createJob: (input: CreateBacklinkVerificationJobInput) => Promise<BacklinkVerificationJob>;
  getJobByKey: (workspaceId: WorkspaceId, jobKey: string) => Promise<BacklinkVerificationJob | null>;
}

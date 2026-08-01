import type { Json } from "@/types/database.types";

import type { BacklinkVerificationJob } from "./job-types";

export interface ClaimNextBacklinkVerificationJobInput {
  workspaceId: string;
  workerId: string;
  claimedAt: string;
  leaseDurationSeconds: number;
}

export type ClaimNextBacklinkVerificationJobResult =
  | { kind: "claimed"; job: BacklinkVerificationJob }
  | { kind: "empty" };

export interface HeartbeatBacklinkVerificationJobInput {
  jobId: string;
  workerId: string;
  heartbeatAt: string;
  leaseDurationSeconds: number;
}

export type HeartbeatBacklinkVerificationJobResult =
  | { kind: "extended"; job: BacklinkVerificationJob }
  | { kind: "rejected"; reason: "not_updated" };

export interface CompleteBacklinkVerificationJobInput {
  jobId: string;
  workerId: string;
  completedAt: string;
  resultSummary: Json | null;
}

export type CompleteBacklinkVerificationJobResult =
  | { kind: "completed"; job: BacklinkVerificationJob }
  | { kind: "rejected"; reason: "not_updated" };

export interface FailBacklinkVerificationJobInput {
  jobId: string;
  workerId: string;
  failedAt: string;
  errorCode: string;
  errorMessage: string;
}

export type FailBacklinkVerificationJobResult =
  | { kind: "failed"; job: BacklinkVerificationJob }
  | { kind: "rejected"; reason: "not_updated" };

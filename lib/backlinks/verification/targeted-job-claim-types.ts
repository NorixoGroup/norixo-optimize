import type { BacklinkVerificationJob } from "./job-types";

export type ClaimBacklinkVerificationJobByIdInput = {
  workspaceId: string;
  jobId: string;
  workerId: string;
  claimedAt: string;
  leaseDurationSeconds: number;
};

export type ClaimBacklinkVerificationJobByIdDependencies = {
  claimJobById: (
    input: ClaimBacklinkVerificationJobByIdInput,
  ) => Promise<BacklinkVerificationJob | null>;
};

export type ClaimBacklinkVerificationJobByIdResult =
  | {
      kind: "claimed";
      job: BacklinkVerificationJob;
    }
  | {
      kind: "rejected";
      reason: "not_updated";
    };

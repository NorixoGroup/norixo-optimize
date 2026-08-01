import type { Json } from "@/types/database.types";

import type { WorkspaceId } from "../repositories/types";

import type { BacklinkVerificationRuntimeResult } from "./runtime-types";
import type { VerificationStatus } from "./types";

interface BacklinkVerificationAttemptBase {
  workspaceId: WorkspaceId;
  linkId: string;
  sourceUrl: string;
  targetUrl: string;
  attemptedAt: string;
}

interface BacklinkVerificationAttemptHttpMetadata {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  redirectCount: number;
}

export type CreateBacklinkVerificationAttemptInput =
  | (BacklinkVerificationAttemptBase &
      BacklinkVerificationAttemptHttpMetadata & {
        runtimeKind: "verified";
        runtimeReason: null;
        verificationStatus: VerificationStatus;
        fetchErrorCode: null;
        fetchErrorMessage: null;
        verificationResult: Json;
      })
  | (BacklinkVerificationAttemptBase &
      BacklinkVerificationAttemptHttpMetadata & {
        runtimeKind: "http_unusable";
        runtimeReason: "http_client_error" | "http_server_error" | "unsupported_content_type" | "empty_document";
        verificationStatus: null;
        fetchErrorCode: null;
        fetchErrorMessage: null;
        verificationResult: null;
      })
  | (BacklinkVerificationAttemptBase & {
      runtimeKind: "fetch_error";
      runtimeReason: null;
      verificationStatus: null;
      requestedUrl: null;
      finalUrl: null;
      httpStatus: null;
      contentType: null;
      redirectCount: null;
      fetchErrorCode: string;
      fetchErrorMessage: string;
      verificationResult: null;
    });

export type BacklinkVerificationAttempt = CreateBacklinkVerificationAttemptInput & {
  id: string;
  createdAt: string;
};

export interface BuildBacklinkVerificationAttemptInput {
  workspaceId: WorkspaceId;
  linkId: string;
  sourceUrl: string;
  targetUrl: string;
  attemptedAt: string;
  runtimeResult: BacklinkVerificationRuntimeResult;
}

export type RecordBacklinkVerificationAttemptInput = BuildBacklinkVerificationAttemptInput;

export interface RecordBacklinkVerificationAttemptDependencies {
  createAttempt: (
    input: CreateBacklinkVerificationAttemptInput,
  ) => Promise<BacklinkVerificationAttempt>;
}

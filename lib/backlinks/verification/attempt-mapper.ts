import type { Json } from "@/types/database.types";

import type {
  BuildBacklinkVerificationAttemptInput,
  CreateBacklinkVerificationAttemptInput,
} from "./attempt-types";
import type { VerificationEvidence, VerificationResult } from "./types";

function toVerificationEvidenceJson(evidence: VerificationEvidence): Json {
  const result: { [key: string]: Json | undefined } = {
    checkedAt: evidence.checkedAt,
  };

  if (evidence.sourceUrl != null) result.sourceUrl = evidence.sourceUrl;
  if (evidence.targetUrl != null) result.targetUrl = evidence.targetUrl;
  if (evidence.matchedHref != null) result.matchedHref = evidence.matchedHref;
  if (evidence.matchedAnchor != null) result.matchedAnchor = evidence.matchedAnchor;
  if (evidence.matchedRel != null) result.matchedRel = evidence.matchedRel;
  if (evidence.httpStatus != null) result.httpStatus = evidence.httpStatus;
  if (evidence.redirectCount != null) result.redirectCount = evidence.redirectCount;
  if (evidence.htmlHash != null) result.htmlHash = evidence.htmlHash;

  return result;
}

function toVerificationResultJson(verification: VerificationResult): Json {
  return {
    status: verification.status,
    verifiedAt: verification.verifiedAt,
    evidence: toVerificationEvidenceJson(verification.evidence),
    issues: verification.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      severity: issue.severity,
    })),
  };
}

function normalizeFetchErrorValue(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return (normalized.length > 0 ? normalized : fallback).slice(0, 500);
}

export function buildBacklinkVerificationAttempt(
  input: BuildBacklinkVerificationAttemptInput,
): CreateBacklinkVerificationAttemptInput {
  const { runtimeResult } = input;
  const base = {
    workspaceId: input.workspaceId,
    linkId: input.linkId,
    sourceUrl: input.sourceUrl,
    targetUrl: input.targetUrl,
  };

  if (runtimeResult.kind === "fetch_error") {
    return {
      ...base,
      attemptedAt: input.attemptedAt,
      runtimeKind: "fetch_error",
      runtimeReason: null,
      verificationStatus: null,
      requestedUrl: null,
      finalUrl: null,
      httpStatus: null,
      contentType: null,
      redirectCount: null,
      fetchErrorCode: normalizeFetchErrorValue(runtimeResult.error.code, "FETCH_ERROR"),
      fetchErrorMessage: normalizeFetchErrorValue(
        runtimeResult.error.message,
        "HTTP fetch failed.",
      ),
      verificationResult: null,
    };
  }

  const response = {
    requestedUrl: runtimeResult.response.requestedUrl,
    finalUrl: runtimeResult.response.finalUrl,
    httpStatus: runtimeResult.response.status,
    contentType: runtimeResult.response.contentType,
    redirectCount: runtimeResult.response.redirectCount,
  };

  if (runtimeResult.kind === "http_unusable") {
    return {
      ...base,
      ...response,
      attemptedAt: runtimeResult.response.fetchedAt,
      runtimeKind: "http_unusable",
      runtimeReason: runtimeResult.reason,
      verificationStatus: null,
      fetchErrorCode: null,
      fetchErrorMessage: null,
      verificationResult: null,
    };
  }

  return {
    ...base,
    ...response,
    attemptedAt: runtimeResult.verification.verifiedAt,
    runtimeKind: "verified",
    runtimeReason: null,
    verificationStatus: runtimeResult.verification.status,
    fetchErrorCode: null,
    fetchErrorMessage: null,
    verificationResult: toVerificationResultJson(runtimeResult.verification),
  };
}

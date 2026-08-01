import assert from "node:assert/strict";

import {
  buildBacklinkVerificationAttempt,
  recordBacklinkVerificationAttempt,
  type BacklinkVerificationAttempt,
  type BacklinkVerificationHttpResponse,
  type BacklinkVerificationRuntimeResult,
  type CreateBacklinkVerificationAttemptInput,
  type RecordBacklinkVerificationAttemptInput,
} from "../lib/backlinks/verification";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const linkId = "00000000-0000-4000-8000-000000000002";
const sourceUrl = "https://publisher.example/resources";
const targetUrl = "https://norixo.example/revpar";

function response(overrides: Partial<BacklinkVerificationHttpResponse> = {}): BacklinkVerificationHttpResponse {
  return {
    requestedUrl: sourceUrl,
    finalUrl: "https://publisher.example/final-resources",
    status: 200,
    contentType: "text/html; charset=utf-8",
    redirectCount: 1,
    fetchedAt: "2026-07-31T10:00:00.000Z",
    ...overrides,
  };
}

function verified(status: "FOUND" | "NOT_FOUND" | "UNKNOWN"): BacklinkVerificationRuntimeResult {
  return {
    kind: "verified",
    response: response(),
    verification: {
      status,
      verifiedAt: "2026-07-31T10:01:00.000Z",
      evidence: {
        checkedAt: "2026-07-31T10:01:00.000Z",
        sourceUrl,
        targetUrl,
        matchedHref: targetUrl,
        httpStatus: 200,
        redirectCount: 1,
      },
      issues: [],
    },
  };
}

function recordInput(runtimeResult: BacklinkVerificationRuntimeResult): RecordBacklinkVerificationAttemptInput {
  return {
    workspaceId,
    linkId,
    sourceUrl,
    targetUrl,
    attemptedAt: "2026-07-31T09:59:00.000Z",
    runtimeResult,
  };
}

async function main(): Promise<void> {
  const foundInput = recordInput(verified("FOUND"));
  const foundSnapshot = JSON.stringify(foundInput);
  const foundMapped = buildBacklinkVerificationAttempt(foundInput);
  assert.equal(foundMapped.runtimeKind, "verified");
  assert.equal(foundMapped.verificationStatus, "FOUND");
  assert.equal(foundMapped.httpStatus, 200);
  assert.equal(foundMapped.finalUrl, "https://publisher.example/final-resources");
  assert.equal(JSON.stringify(foundInput), foundSnapshot);
  assert.deepEqual(buildBacklinkVerificationAttempt(foundInput), foundMapped);

  const attempts: CreateBacklinkVerificationAttemptInput[] = [];
  const createAttempt = async (
    input: CreateBacklinkVerificationAttemptInput,
  ): Promise<BacklinkVerificationAttempt> => {
    attempts.push(input);
    return { ...input, id: `attempt-${attempts.length}`, createdAt: "2026-07-31T10:02:00.000Z" };
  };

  const createdFound = await recordBacklinkVerificationAttempt(foundInput, { createAttempt });
  assert.equal(createdFound.runtimeKind, "verified");
  assert.equal(attempts.length, 1);

  const notFound = await recordBacklinkVerificationAttempt(recordInput(verified("NOT_FOUND")), {
    createAttempt,
  });
  assert.equal(notFound.runtimeKind, "verified");
  assert.equal(notFound.verificationStatus, "NOT_FOUND");
  assert.notEqual(notFound.httpStatus, 404);

  const http404 = await recordBacklinkVerificationAttempt(
    recordInput({
      kind: "http_unusable",
      reason: "http_client_error",
      response: response({ status: 404 }),
    }),
    { createAttempt },
  );
  assert.equal(http404.runtimeKind, "http_unusable");
  assert.equal(http404.runtimeReason, "http_client_error");
  assert.equal(http404.httpStatus, 404);
  assert.equal(http404.verificationStatus, null);

  const http500 = await recordBacklinkVerificationAttempt(
    recordInput({
      kind: "http_unusable",
      reason: "http_server_error",
      response: response({ status: 500 }),
    }),
    { createAttempt },
  );
  assert.equal(http500.httpStatus, 500);
  assert.equal(http500.verificationStatus, null);

  const timeout = await recordBacklinkVerificationAttempt(
    recordInput({
      kind: "fetch_error",
      error: { code: "AbortError", message: "  Request timed out\n" },
    }),
    { createAttempt },
  );
  assert.equal(timeout.runtimeKind, "fetch_error");
  assert.equal(timeout.fetchErrorCode, "AbortError");
  assert.equal(timeout.fetchErrorMessage, "Request timed out");
  assert.equal(timeout.verificationStatus, null);
  assert.equal(timeout.requestedUrl, null);

  const nonHtml = await recordBacklinkVerificationAttempt(
    recordInput({
      kind: "http_unusable",
      reason: "unsupported_content_type",
      response: response({ contentType: "application/pdf" }),
    }),
    { createAttempt },
  );
  assert.equal(nonHtml.runtimeReason, "unsupported_content_type");
  assert.equal(nonHtml.contentType, "application/pdf");

  const unknown = await recordBacklinkVerificationAttempt(recordInput(verified("UNKNOWN")), {
    createAttempt,
  });
  assert.equal(unknown.runtimeKind, "verified");
  assert.equal(unknown.verificationStatus, "UNKNOWN");
  assert.equal(attempts.length, 7);

  console.log("PASS — Backlink verification attempt smoke");
}

void main();

import {
  buildManualBacklinkVerificationJobInput,
  type BuildManualBacklinkVerificationJobInput,
} from "../lib/backlinks/verification";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(operation: () => void, expectedMessage: string): Error {
  try {
    operation();
  } catch (error) {
    assert(error instanceof Error, "Expected an Error instance.");
    assert(error.message.includes(expectedMessage), `Expected error message to include ${expectedMessage}.`);
    return error;
  }
  throw new Error("Expected operation to throw.");
}

const validInput: BuildManualBacklinkVerificationJobInput = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  linkId: "00000000-0000-4000-8000-000000000002",
  queuedAt: "2026-08-01T23:45:00.000Z",
  policy: {
    strictAnchor: false,
    strictRel: false,
    followRedirects: true,
    maxRedirects: 3,
    acceptCanonical: false,
  },
  http: {
    timeoutMs: 5_000,
    maxRedirects: 3,
    maxResponseBytes: 64_000,
    userAgent: "Norixo-Backlink-Smoke/1.0",
  },
};

function requestToken(queuedAt: string): string {
  return Math.trunc(Date.parse(queuedAt)).toString(36);
}

function main(): void {
  const originalInput = { ...validInput };
  const originalPolicy = { ...validInput.policy };
  const originalHttp = { ...validInput.http };
  const policyReference = validInput.policy;
  const httpReference = validInput.http;

  const nominal = buildManualBacklinkVerificationJobInput(validInput);
  assert(nominal.workspaceId === validInput.workspaceId, "workspaceId must be preserved.");
  assert(nominal.linkId === validInput.linkId, "linkId must be preserved.");
  assert(nominal.queuedAt === validInput.queuedAt, "queuedAt must be preserved.");
  assert(nominal.triggerSource === "manual", "triggerSource must be manual.");
  assert(nominal.jobKey === `manual:00000000-0000-4000-8000-000000000002:${requestToken(validInput.queuedAt)}`, "Nominal jobKey must include the request token.");
  assert(nominal.policy === policyReference, "policy reference must be preserved.");
  assert(nominal.http === httpReference, "http reference must be preserved.");
  assert(JSON.stringify(Object.keys(nominal).sort()) === JSON.stringify(["http", "jobKey", "linkId", "policy", "queuedAt", "triggerSource", "workspaceId"]), "Result must contain exactly the expected keys.");

  const positiveOffset = buildManualBacklinkVerificationJobInput({
    ...validInput,
    queuedAt: "2026-08-02T00:30:00+02:00",
  });
  assert(positiveOffset.jobKey === `manual:00000000-0000-4000-8000-000000000002:${requestToken("2026-08-02T00:30:00+02:00")}`, "Positive offset must preserve the request token.");
  const negativeOffset = buildManualBacklinkVerificationJobInput({
    ...validInput,
    queuedAt: "2026-07-31T23:30:00-03:00",
  });
  assert(negativeOffset.jobKey === `manual:00000000-0000-4000-8000-000000000002:${requestToken("2026-07-31T23:30:00-03:00")}`, "Negative offset must preserve the request token.");

  const repeated = buildManualBacklinkVerificationJobInput(validInput);
  assert(repeated.jobKey === nominal.jobKey, "Same input must derive the same jobKey.");
  assert(repeated.workspaceId === nominal.workspaceId && repeated.linkId === nominal.linkId && repeated.queuedAt === nominal.queuedAt && repeated.triggerSource === nominal.triggerSource, "Repeated result must preserve the same values.");
  assert(repeated.policy === policyReference && repeated.http === httpReference, "Repeated result must preserve nested references.");

  const nextDay = buildManualBacklinkVerificationJobInput({
    ...validInput,
    queuedAt: "2026-08-02T00:00:00.000Z",
  });
  assert(nextDay.jobKey === `manual:00000000-0000-4000-8000-000000000002:${requestToken("2026-08-02T00:00:00.000Z")}`, "A new request token must derive a new jobKey.");

  assertThrows(
    () => buildManualBacklinkVerificationJobInput({ ...validInput, workspaceId: "" }),
    "workspaceId must not be empty",
  );
  assertThrows(
    () => buildManualBacklinkVerificationJobInput({ ...validInput, workspaceId: "   " }),
    "workspaceId must not be empty",
  );
  assertThrows(
    () => buildManualBacklinkVerificationJobInput({ ...validInput, linkId: "" }),
    "linkId must not be empty",
  );
  assertThrows(
    () => buildManualBacklinkVerificationJobInput({ ...validInput, linkId: "   " }),
    "linkId must not be empty",
  );
  assertThrows(
    () => buildManualBacklinkVerificationJobInput({ ...validInput, queuedAt: "" }),
    "queuedAt must be a valid date",
  );
  assertThrows(
    () => buildManualBacklinkVerificationJobInput({ ...validInput, queuedAt: "not-a-date" }),
    "queuedAt must be a valid date",
  );

  const maximumLengthLinkId = "a".repeat(255 - "manual:".length - 1 - requestToken(validInput.queuedAt).length);
  const maximumLengthResult = buildManualBacklinkVerificationJobInput({
    ...validInput,
    linkId: maximumLengthLinkId,
  });
  assert(maximumLengthResult.jobKey.length === 255, "A 255-character jobKey must be accepted.");
  assertThrows(
    () =>
      buildManualBacklinkVerificationJobInput({
        ...validInput,
        linkId: "a".repeat(maximumLengthLinkId.length + 1),
      }),
    "manual jobKey must not exceed 255 characters",
  );

  assert(validInput.workspaceId === originalInput.workspaceId && validInput.linkId === originalInput.linkId && validInput.queuedAt === originalInput.queuedAt && validInput.policy === policyReference && validInput.http === httpReference, "Factory must not mutate the input.");
  assert(validInput.policy.strictAnchor === originalPolicy.strictAnchor && validInput.policy.strictRel === originalPolicy.strictRel && validInput.policy.followRedirects === originalPolicy.followRedirects && validInput.policy.maxRedirects === originalPolicy.maxRedirects && validInput.policy.acceptCanonical === originalPolicy.acceptCanonical, "Factory must not mutate policy.");
  assert(validInput.http.timeoutMs === originalHttp.timeoutMs && validInput.http.maxRedirects === originalHttp.maxRedirects && validInput.http.maxResponseBytes === originalHttp.maxResponseBytes && validInput.http.userAgent === originalHttp.userAgent, "Factory must not mutate http options.");
  assert(!("status" in nominal) && !("attemptCount" in nominal) && !("maxAttempts" in nominal) && !("workerId" in nominal) && !("claimedAt" in nominal) && !("completedAt" in nominal) && !("failedAt" in nominal), "Factory result must not contain implicit job state.");

  console.log("PASS — Backlink verification manual job factory smoke");
}

main();

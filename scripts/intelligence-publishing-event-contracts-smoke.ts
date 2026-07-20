import assert from "node:assert/strict";

import {
  buildPublicationEventIdempotencyKey,
  isCriticalEvent,
  isPolicyEvent,
  isRepublishEvent,
  isReviewEvent,
  isSuppressionEvent,
  parsePublicationEventEnvelope,
  validatePublicationEventEnvelope,
} from "../lib/intelligencePublishing/eventContracts";

function buildEvent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return Object.freeze({
    eventId: "evt_001",
    eventType: "benchmark_created",
    occurredAt: "2026-07-20T10:00:00.000Z",
    sourceSystem: "intelligence_v2",
    subjectType: "benchmark",
    subjectId: "benchmark:pricing:paris",
    subjectFingerprint: "artifact:sha256:abc123",
    policyVersions: Object.freeze({
      benchmarkArtifactContractVersion: "v1",
      publicMarketOverviewContractVersion: "pmo_v1",
    }),
    priority: "P1",
    visibility: "internal",
    metadata: Object.freeze({
      benchmarkType: "pricing_distribution",
    }),
    ...overrides,
  });
}

function expectValid(input: unknown) {
  const result = validatePublicationEventEnvelope(input);
  if (!result.ok) {
    throw new Error(
      `Expected a valid publication event: ${result.issues
        .map((issue) => `${issue.path}:${issue.message}`)
        .join(", ")}`,
    );
  }

  return result.event;
}

function expectInvalid(input: unknown) {
  const result = validatePublicationEventEnvelope(input);
  assert.equal(result.ok, false, "event should be invalid");
  return result;
}

const validEvent = expectValid(buildEvent());
assert.equal(validEvent.eventType, "benchmark_created");
assert.equal(validEvent.metadata.benchmarkType, "pricing_distribution");

const parsedEvent = parsePublicationEventEnvelope(buildEvent());
assert.equal(parsedEvent.subjectType, "benchmark");

const missingSubject = expectInvalid(
  buildEvent({
    subjectId: "",
  }),
);
if (missingSubject.ok) {
  throw new Error("missing subject validation should fail");
}
assert.ok(
  missingSubject.issues.some((issue) => issue.path === "subjectId"),
  "subjectId should be reported as invalid",
);

const invalidEnum = expectInvalid(
  buildEvent({
    priority: "P9",
  }),
);
if (invalidEnum.ok) {
  throw new Error("enum validation should fail");
}
assert.ok(
  invalidEnum.issues.some((issue) => issue.path === "priority"),
  "priority should be reported as invalid",
);

const invalidMetadata = expectInvalid(
  buildEvent({
    metadata: Object.freeze({}),
  }),
);
if (invalidMetadata.ok) {
  throw new Error("metadata validation should fail");
}
assert.ok(
  invalidMetadata.issues.some((issue) => issue.path === "metadata.benchmarkType"),
  "benchmarkType should be required",
);

const keyA = buildPublicationEventIdempotencyKey(validEvent);
const keyB = buildPublicationEventIdempotencyKey(validEvent);
assert.equal(keyA, keyB, "idempotency key should be stable");

const fingerprintChangedKey = buildPublicationEventIdempotencyKey({
  ...validEvent,
  subjectFingerprint: "artifact:sha256:def456",
});
assert.notEqual(
  keyA,
  fingerprintChangedKey,
  "fingerprint change should produce a new key",
);

const requestChangedKey = buildPublicationEventIdempotencyKey({
  ...validEvent,
  requestId: "req_002",
});
assert.notEqual(
  keyA,
  requestChangedKey,
  "requestId change should produce a new key",
);

const suppressionEvent = expectValid(
  buildEvent({
    eventId: "evt_002",
    eventType: "public_overview_suppressed",
    subjectType: "public_overview",
    subjectId: "overview:marrakech",
    metadata: Object.freeze({
      suppressionReason: "confidence_below_floor",
    }),
    priority: "P0",
    visibility: "public",
  }),
);
assert.equal(isCriticalEvent(suppressionEvent), true);
assert.equal(isSuppressionEvent(suppressionEvent), true);
assert.equal(isRepublishEvent(suppressionEvent), false);

const policyEvent = expectValid(
  buildEvent({
    eventId: "evt_003",
    eventType: "policy_version_changed",
    subjectType: "policy",
    subjectId: "policy:public_market_overview_governance",
    metadata: Object.freeze({
      policyName: "public_market_overview_governance",
      previousVersion: "pmo_v1",
      nextVersion: "pmo_v2",
    }),
  }),
);
assert.equal(isPolicyEvent(policyEvent), true);
assert.equal(isReviewEvent(policyEvent), true);
assert.equal(isRepublishEvent(policyEvent), true);

const reviewEvent = expectValid(
  buildEvent({
    eventId: "evt_004",
    eventType: "confidence_changed",
    subjectType: "asset_version",
    subjectId: "asset_version:report:paris:v3",
    metadata: Object.freeze({
      previousConfidence: "high",
      nextConfidence: "moderate",
    }),
  }),
);
assert.equal(isReviewEvent(reviewEvent), true);

console.log("PASS — Intelligence Publishing event contracts smoke");

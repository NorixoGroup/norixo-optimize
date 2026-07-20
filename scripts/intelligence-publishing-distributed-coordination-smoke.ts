import assert from "node:assert/strict";

import {
  DistributedCoordinationError,
  buildLockResourceKey,
  completeIdempotencyRecord,
  decideIdempotencyStart,
  decideLockAcquisition,
  decideLockRelease,
  decideLockRenewal,
  expireIdempotencyRecord,
  failIdempotencyRecordPermanent,
  failIdempotencyRecordRetryable,
  markIdempotencyInProgress,
  parseDistributedLock,
  parseIdempotencyRecord,
  parseLockResource,
  supersedeIdempotencyRecord,
  validateIdempotencyStartDecision,
  validateDistributedLock,
  validateFencingValidationDecision,
  validateLockAcquisitionDecision,
  validateLockReleaseDecision,
  validateFencingToken,
  validateIdempotencyRecord,
  validateLockResource,
  validateLockRenewalDecision,
} from "../lib/intelligencePublishing/distributedCoordination";

const resource = parseLockResource({
  resourceType: "job",
  resourceId: "job_001",
  scope: "web",
  partitionKey: "fr",
});

const resourceKey = buildLockResourceKey(resource);

function expectCoordinationError(
  fn: () => unknown,
): DistributedCoordinationError {
  try {
    fn();
  } catch (error) {
    return error as DistributedCoordinationError;
  }

  throw new Error("Expected a DistributedCoordinationError.");
}

{
  const keyA = buildLockResourceKey({
    resourceType: "job",
    resourceId: "job_001",
    partitionKey: "fr",
    scope: "web",
  });
  const keyB = buildLockResourceKey({
    resourceType: "job",
    resourceId: "job_001",
    scope: "web",
    partitionKey: "fr",
  });
  assert.equal(keyA, keyB);
}

const acquisition1 = decideLockAcquisition({
  existingLock: null,
  requestedResource: resource,
  requestedOwnerId: "worker-a",
  requestedOwnerEpoch: 1,
  now: "2026-07-20T12:00:00.000Z",
  ttlMs: 60_000,
  metadata: {
    purpose: "job_execution",
  },
});

{
  assert.equal(acquisition1.outcome, "acquired");
  assert.equal(acquisition1.fencingToken, 1);
  assert.equal(acquisition1.nextLock?.lockKey, resourceKey);
}

const sameOwnerNoop = decideLockAcquisition({
  existingLock: acquisition1.nextLock,
  requestedResource: resource,
  requestedOwnerId: "worker-a",
  requestedOwnerEpoch: 1,
  now: "2026-07-20T12:00:10.000Z",
  ttlMs: 10_000,
});

{
  assert.equal(sameOwnerNoop.outcome, "idempotent_owner_noop");
  assert.equal(sameOwnerNoop.isIdempotentNoop, true);
}

const sameOwnerRenewed = decideLockAcquisition({
  existingLock: acquisition1.nextLock,
  requestedResource: resource,
  requestedOwnerId: "worker-a",
  requestedOwnerEpoch: 1,
  now: "2026-07-20T12:00:10.000Z",
  ttlMs: 120_000,
});

{
  assert.equal(sameOwnerRenewed.outcome, "renewed");
  assert.equal(sameOwnerRenewed.nextLock?.fencingToken, 1);
}

{
  const rejected = decideLockAcquisition({
    existingLock: acquisition1.nextLock,
    requestedResource: resource,
    requestedOwnerId: "worker-b",
    requestedOwnerEpoch: 1,
    now: "2026-07-20T12:00:15.000Z",
    ttlMs: 60_000,
  });
  assert.equal(rejected.outcome, "rejected_active_owner");
}

const takeover = decideLockAcquisition({
  existingLock: acquisition1.nextLock,
  requestedResource: resource,
  requestedOwnerId: "worker-b",
  requestedOwnerEpoch: 2,
  now: "2026-07-20T12:02:00.000Z",
  ttlMs: 60_000,
});

{
  assert.equal(takeover.outcome, "takeover_expired_lock");
  assert.equal(takeover.fencingToken, 2);
  assert.equal(takeover.isTakeover, true);
}

{
  const rejected = decideLockAcquisition({
    existingLock: takeover.nextLock,
    requestedResource: resource,
    requestedOwnerId: "worker-a",
    requestedOwnerEpoch: 1,
    now: "2026-07-20T12:02:05.000Z",
    ttlMs: 60_000,
  });
  assert.equal(rejected.outcome, "rejected_stale_owner_epoch");
}

{
  const renewal = decideLockRenewal({
    currentLock: takeover.nextLock,
    requestedOwnerId: "worker-b",
    requestedOwnerEpoch: 2,
    presentedFencingToken: 2,
    now: "2026-07-20T12:02:10.000Z",
    ttlMs: 10_000,
  });
  assert.equal(renewal.outcome, "idempotent_noop");
}

{
  const renewal = decideLockRenewal({
    currentLock: takeover.nextLock,
    requestedOwnerId: "worker-b",
    requestedOwnerEpoch: 2,
    presentedFencingToken: 2,
    now: "2026-07-20T12:02:10.000Z",
    ttlMs: 120_000,
  });
  assert.equal(renewal.outcome, "renewed");
}

{
  const renewal = decideLockRenewal({
    currentLock: takeover.nextLock,
    requestedOwnerId: "worker-a",
    requestedOwnerEpoch: 1,
    presentedFencingToken: 1,
    now: "2026-07-20T12:02:10.000Z",
    ttlMs: 120_000,
  });
  assert.equal(renewal.outcome, "rejected_not_owner");
}

{
  const release = decideLockRelease({
    currentLock: takeover.nextLock,
    presentedOwnerId: "worker-a",
    presentedOwnerEpoch: 1,
    presentedFencingToken: 1,
    now: "2026-07-20T12:02:10.000Z",
  });
  assert.equal(release.outcome, "rejected_not_owner");
}

const release = decideLockRelease({
  currentLock: takeover.nextLock,
  presentedOwnerId: "worker-b",
  presentedOwnerEpoch: 2,
  presentedFencingToken: 2,
  now: "2026-07-20T12:02:20.000Z",
});

{
  assert.equal(release.outcome, "released");
  assert.equal(release.nextLock?.status, "released");
}

{
  const doubleRelease = decideLockRelease({
    currentLock: release.nextLock,
    presentedOwnerId: "worker-b",
    presentedOwnerEpoch: 2,
    presentedFencingToken: 2,
    now: "2026-07-20T12:02:30.000Z",
  });
  assert.equal(doubleRelease.outcome, "idempotent_noop");
}

{
  const reacquire = decideLockAcquisition({
    existingLock: release.nextLock,
    requestedResource: resource,
    requestedOwnerId: "worker-c",
    requestedOwnerEpoch: 3,
    now: "2026-07-20T12:03:00.000Z",
    ttlMs: 60_000,
  });
  assert.equal(reacquire.outcome, "acquired");
  assert.equal(reacquire.fencingToken, 3);
}

{
  const validation = validateFencingToken({
    currentLock: takeover.nextLock,
    presentedOwnerId: "worker-b",
    presentedOwnerEpoch: 2,
    presentedFencingToken: 2,
    now: "2026-07-20T12:02:15.000Z",
  });
  assert.equal(validation.outcome, "valid");
}

{
  const validation = validateFencingToken({
    currentLock: takeover.nextLock,
    presentedOwnerId: "worker-b",
    presentedOwnerEpoch: 2,
    presentedFencingToken: 1,
    now: "2026-07-20T12:02:15.000Z",
  });
  assert.equal(validation.outcome, "stale_fencing_token");
}

{
  const before = JSON.stringify(acquisition1.nextLock);
  decideLockAcquisition({
    existingLock: acquisition1.nextLock,
    requestedResource: resource,
    requestedOwnerId: "worker-b",
    requestedOwnerEpoch: 1,
    now: "2026-07-20T12:00:15.000Z",
    ttlMs: 60_000,
  });
  assert.equal(JSON.stringify(acquisition1.nextLock), before);
}

const startNew = decideIdempotencyStart({
  existingRecord: null,
  idempotencyKey: "idem_001",
  operationType: "publish_asset",
  subjectType: "asset_version",
  subjectId: "asset_version_001",
  requestFingerprint: "fp_request_v1",
  ownerId: "worker-b",
  ownerEpoch: 2,
  fencingToken: 2,
  now: "2026-07-20T12:05:00.000Z",
  expiresAt: "2026-07-20T12:10:00.000Z",
  metadata: {
    channel: "web",
  },
});

{
  assert.equal(startNew.outcome, "start_new");
  assert.equal(startNew.nextRecord?.status, "pending");
}

const pendingRecord = startNew.nextRecord!;

{
  const resumed = decideIdempotencyStart({
    existingRecord: pendingRecord,
    idempotencyKey: "idem_001",
    operationType: "publish_asset",
    subjectType: "asset_version",
    subjectId: "asset_version_001",
    requestFingerprint: "fp_request_v1",
    ownerId: "worker-b",
    ownerEpoch: 2,
    fencingToken: 2,
    now: "2026-07-20T12:05:10.000Z",
    expiresAt: "2026-07-20T12:10:00.000Z",
  });
  assert.equal(resumed.outcome, "resume_same_owner");
}

{
  const conflict = decideIdempotencyStart({
    existingRecord: pendingRecord,
    idempotencyKey: "idem_001",
    operationType: "publish_asset",
    subjectType: "asset_version",
    subjectId: "asset_version_001",
    requestFingerprint: "fp_request_v2",
    ownerId: "worker-b",
    ownerEpoch: 2,
    fencingToken: 2,
    now: "2026-07-20T12:05:10.000Z",
    expiresAt: "2026-07-20T12:10:00.000Z",
  });
  assert.equal(conflict.outcome, "reject_fingerprint_conflict");
}

{
  const otherOwner = decideIdempotencyStart({
    existingRecord: markIdempotencyInProgress({
      record: pendingRecord,
      ownerId: "worker-b",
      ownerEpoch: 2,
      fencingToken: 2,
      now: "2026-07-20T12:05:20.000Z",
    }),
    idempotencyKey: "idem_001",
    operationType: "publish_asset",
    subjectType: "asset_version",
    subjectId: "asset_version_001",
    requestFingerprint: "fp_request_v1",
    ownerId: "worker-c",
    ownerEpoch: 3,
    fencingToken: 3,
    now: "2026-07-20T12:05:30.000Z",
    expiresAt: "2026-07-20T12:10:00.000Z",
  });
  assert.equal(otherOwner.outcome, "reject_active_other_owner");
}

const completed = completeIdempotencyRecord({
  record: markIdempotencyInProgress({
    record: pendingRecord,
    ownerId: "worker-b",
    ownerEpoch: 2,
    fencingToken: 2,
    now: "2026-07-20T12:05:20.000Z",
  }),
  ownerId: "worker-b",
  ownerEpoch: 2,
  fencingToken: 2,
  now: "2026-07-20T12:05:40.000Z",
  resultFingerprint: "result_v1",
});

{
  const completedDecision = decideIdempotencyStart({
    existingRecord: completed,
    idempotencyKey: "idem_001",
    operationType: "publish_asset",
    subjectType: "asset_version",
    subjectId: "asset_version_001",
    requestFingerprint: "fp_request_v1",
    ownerId: "worker-z",
    ownerEpoch: 9,
    fencingToken: 9,
    now: "2026-07-20T12:06:00.000Z",
    expiresAt: "2026-07-20T12:10:00.000Z",
  });
  assert.equal(completedDecision.outcome, "return_completed_result");
  assert.equal(completedDecision.resultFingerprint, "result_v1");
}

{
  const completedNoop = completeIdempotencyRecord({
    record: completed,
    ownerId: "worker-b",
    ownerEpoch: 2,
    fencingToken: 2,
    now: "2026-07-20T12:06:10.000Z",
    resultFingerprint: "result_v1",
  });
  assert.equal(completedNoop, completed);
}

{
  const error = expectCoordinationError(() =>
    completeIdempotencyRecord({
      record: completed,
      ownerId: "worker-b",
      ownerEpoch: 2,
      fencingToken: 2,
      now: "2026-07-20T12:06:10.000Z",
      resultFingerprint: "result_v2",
    }),
  );
  assert.equal(error.code, "result_conflict");
}

const retryable = failIdempotencyRecordRetryable({
  record: markIdempotencyInProgress({
    record: startNew.nextRecord!,
    ownerId: "worker-b",
    ownerEpoch: 2,
    fencingToken: 2,
    now: "2026-07-20T12:05:20.000Z",
  }),
  ownerId: "worker-b",
  ownerEpoch: 2,
  fencingToken: 2,
  now: "2026-07-20T12:05:50.000Z",
  failureCode: "temporary_publish_error",
});

{
  assert.equal(retryable.status, "failed_retryable");
}

{
  const retryDecision = decideIdempotencyStart({
    existingRecord: retryable,
    idempotencyKey: "idem_001",
    operationType: "publish_asset",
    subjectType: "asset_version",
    subjectId: "asset_version_001",
    requestFingerprint: "fp_request_v1",
    ownerId: "worker-c",
    ownerEpoch: 3,
    fencingToken: 3,
    now: "2026-07-20T12:06:00.000Z",
    expiresAt: "2026-07-20T12:11:00.000Z",
  });
  assert.equal(retryDecision.outcome, "retry_failed_operation");
}

const permanentFailure = failIdempotencyRecordPermanent({
  record: startNew.nextRecord!,
  ownerId: "worker-b",
  ownerEpoch: 2,
  fencingToken: 2,
  now: "2026-07-20T12:05:55.000Z",
  failureCode: "invalid_destination",
});

{
  const rejected = decideIdempotencyStart({
    existingRecord: permanentFailure,
    idempotencyKey: "idem_001",
    operationType: "publish_asset",
    subjectType: "asset_version",
    subjectId: "asset_version_001",
    requestFingerprint: "fp_request_v1",
    ownerId: "worker-d",
    ownerEpoch: 4,
    fencingToken: 4,
    now: "2026-07-20T12:06:00.000Z",
    expiresAt: "2026-07-20T12:11:00.000Z",
  });
  assert.equal(rejected.outcome, "reject_permanent_failure");
}

const expired = expireIdempotencyRecord({
  record: startNew.nextRecord!,
  ownerId: "worker-b",
  ownerEpoch: 2,
  fencingToken: 2,
  now: "2026-07-20T12:10:01.000Z",
});

{
  assert.equal(expired.status, "expired");
  const restart = decideIdempotencyStart({
    existingRecord: expired,
    idempotencyKey: "idem_001",
    operationType: "publish_asset",
    subjectType: "asset_version",
    subjectId: "asset_version_001",
    requestFingerprint: "fp_request_v1",
    ownerId: "worker-e",
    ownerEpoch: 5,
    fencingToken: 5,
    now: "2026-07-20T12:10:10.000Z",
    expiresAt: "2026-07-20T12:15:00.000Z",
  });
  assert.equal(restart.outcome, "restart_expired");
}

{
  const stale = decideIdempotencyStart({
    existingRecord: retryable,
    idempotencyKey: "idem_001",
    operationType: "publish_asset",
    subjectType: "asset_version",
    subjectId: "asset_version_001",
    requestFingerprint: "fp_request_v1",
    ownerId: "worker-a",
    ownerEpoch: 1,
    fencingToken: 1,
    now: "2026-07-20T12:06:00.000Z",
    expiresAt: "2026-07-20T12:11:00.000Z",
  });
  assert.equal(stale.outcome, "reject_stale_fencing_token");
}

{
  const sameRetryable = failIdempotencyRecordRetryable({
    record: retryable,
    ownerId: "worker-b",
    ownerEpoch: 2,
    fencingToken: 2,
    now: "2026-07-20T12:06:10.000Z",
    failureCode: "temporary_publish_error",
  });
  assert.equal(sameRetryable, retryable);
}

{
  const superseded = supersedeIdempotencyRecord({
    record: startNew.nextRecord!,
    ownerId: "worker-b",
    ownerEpoch: 2,
    fencingToken: 2,
    now: "2026-07-20T12:06:20.000Z",
  });
  assert.equal(superseded.status, "superseded");
}

{
  const validResource = validateLockResource(resource);
  assert.equal(validResource.ok, true);

  const validLock = validateDistributedLock(acquisition1.nextLock);
  assert.equal(validLock.ok, true);

  const validRecord = validateIdempotencyRecord(startNew.nextRecord);
  assert.equal(validRecord.ok, true);

  const invalidLock = validateDistributedLock({
    ...acquisition1.nextLock,
    fencingToken: 0,
  });
  assert.equal(invalidLock.ok, false);

  const invalidRecord = validateIdempotencyRecord({
    ...completed,
    completedAt: null,
  });
  assert.equal(invalidRecord.ok, false);

  assert.equal(validateLockAcquisitionDecision(acquisition1).ok, true);
  assert.equal(validateLockRenewalDecision(sameOwnerRenewed).ok, true);
  assert.equal(validateLockReleaseDecision(release).ok, true);
  assert.equal(
    validateFencingValidationDecision(
      validateFencingToken({
        currentLock: takeover.nextLock,
        presentedOwnerId: "worker-b",
        presentedOwnerEpoch: 2,
        presentedFencingToken: 2,
        now: "2026-07-20T12:02:15.000Z",
      }),
    ).ok,
    true,
  );
  assert.equal(validateIdempotencyStartDecision(startNew).ok, true);
}

{
  const before = JSON.stringify(startNew.nextRecord);
  decideIdempotencyStart({
    existingRecord: startNew.nextRecord,
    idempotencyKey: "idem_001",
    operationType: "publish_asset",
    subjectType: "asset_version",
    subjectId: "asset_version_001",
    requestFingerprint: "fp_request_v1",
    ownerId: "worker-b",
    ownerEpoch: 2,
    fencingToken: 2,
    now: "2026-07-20T12:05:10.000Z",
    expiresAt: "2026-07-20T12:10:00.000Z",
  });
  assert.equal(JSON.stringify(startNew.nextRecord), before);
}

{
  const left = decideLockAcquisition({
    existingLock: null,
    requestedResource: resource,
    requestedOwnerId: "worker-x",
    requestedOwnerEpoch: 1,
    now: "2026-07-20T13:00:00.000Z",
    ttlMs: 60_000,
  });
  const right = decideLockAcquisition({
    existingLock: null,
    requestedResource: resource,
    requestedOwnerId: "worker-x",
    requestedOwnerEpoch: 1,
    now: "2026-07-20T13:00:00.000Z",
    ttlMs: 60_000,
  });
  assert.deepEqual(left, right);
}

{
  const left = decideIdempotencyStart({
    existingRecord: null,
    idempotencyKey: "idem_deterministic",
    operationType: "publish_asset",
    subjectType: "asset",
    subjectId: "asset_001",
    requestFingerprint: "fp_det",
    ownerId: "worker-det",
    ownerEpoch: 1,
    fencingToken: 1,
    now: "2026-07-20T13:10:00.000Z",
    expiresAt: "2026-07-20T13:20:00.000Z",
  });
  const right = decideIdempotencyStart({
    existingRecord: null,
    idempotencyKey: "idem_deterministic",
    operationType: "publish_asset",
    subjectType: "asset",
    subjectId: "asset_001",
    requestFingerprint: "fp_det",
    ownerId: "worker-det",
    ownerEpoch: 1,
    fencingToken: 1,
    now: "2026-07-20T13:10:00.000Z",
    expiresAt: "2026-07-20T13:20:00.000Z",
  });
  assert.deepEqual(left, right);
}

{
  const parsedLock = parseDistributedLock(acquisition1.nextLock);
  assert.equal(parsedLock.fencingToken, 1);

  const parsedRecord = parseIdempotencyRecord(startNew.nextRecord);
  assert.equal(parsedRecord.status, "pending");
}

console.log("PASS — Intelligence Publishing distributed coordination smoke");

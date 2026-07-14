import assert from "node:assert/strict";

import {
  executeReconcileAuditEntitlements,
  formatReconcileAuditEntitlementsReport,
  parseReconcileAuditEntitlementsArgs,
  type AuditEntitlementReservationRecord,
  type AuditReservationLinkedAuditRecord,
} from "../lib/billing/reconcileAuditEntitlements";

function buildReservation(
  overrides: Partial<AuditEntitlementReservationRecord> = {},
): AuditEntitlementReservationRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    operationKey: "operation-key-1234567890",
    workspaceId: "workspace-1",
    source: "credit",
    status: "reserved",
    createdAt: "2026-07-14T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z",
    targetKind: "source_url",
    freePlanGate: false,
    ...overrides,
  };
}

function buildAudit(
  overrides: Partial<AuditReservationLinkedAuditRecord> = {},
): AuditReservationLinkedAuditRecord {
  return {
    id: "audit-1",
    workspaceId: "workspace-1",
    listingId: "listing-1",
    createdBy: "user-1",
    entitlementReservationId: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-07-14T00:30:00.000Z",
    ...overrides,
  };
}

async function main() {
  {
    const options = parseReconcileAuditEntitlementsArgs([]);
    assert.equal(options.dryRun, true);
    assert.equal(options.olderThanHours, 6);
    assert.equal(options.limit, 100);
  }

  {
    const options = parseReconcileAuditEntitlementsArgs([
      "--apply",
      "--older-than-hours=6",
      "--limit=12",
      "--reservation-id=11111111-1111-4111-8111-111111111111",
    ]);
    assert.equal(options.dryRun, false);
    assert.equal(options.olderThanHours, 6);
    assert.equal(options.limit, 12);
    assert.equal(options.reservationId, "11111111-1111-4111-8111-111111111111");
  }

  assert.throws(
    () => parseReconcileAuditEntitlementsArgs(["--older-than-hours=0"]),
    /at least 1/i,
  );
  assert.throws(
    () => parseReconcileAuditEntitlementsArgs(["--dry-run", "--apply"]),
    /cannot be used together/i,
  );
  assert.throws(
    () => parseReconcileAuditEntitlementsArgs(["--limit=0"]),
    /positive integer/i,
  );
  assert.throws(
    () => parseReconcileAuditEntitlementsArgs(["--wat"]),
    /Unknown argument/i,
  );

  {
    const recentResult = await executeReconcileAuditEntitlements(
      {
        dryRun: true,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T04:00:00.000Z"),
        listReservations: async () => [
          buildReservation({
            id: "22222222-2222-4222-8222-222222222222",
            createdAt: "2026-07-14T01:00:00.000Z",
          }),
        ],
        findAuditsByReservationId: async () => [],
      },
    );

    assert.equal(recentResult.rows[0]?.decision, "ignore");
    assert.equal(recentResult.rows[0]?.reasonCode, "recent_reservation");
  }

  {
    const finalizeCalls: unknown[] = [];
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: false,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [buildReservation()],
        findAuditsByReservationId: async () => [buildAudit()],
        finalize: async (params) => {
          finalizeCalls.push(params);
          return {
            status: "finalized",
            reservationId: "reservation-1",
            operationKey: params.operationKey,
            source: "credit",
            reasonCode: null,
          };
        },
        release: async () => {
          throw new Error("release should not be called");
        },
      },
    );

    assert.equal(result.rows[0]?.decision, "finalize");
    assert.equal(result.rows[0]?.outcome, "applied");
    assert.equal(finalizeCalls.length, 1);
  }

  {
    const releaseCalls: unknown[] = [];
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: false,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [
          buildReservation({
            id: "33333333-3333-4333-8333-333333333333",
          }),
        ],
        findAuditsByReservationId: async () => [],
        finalize: async () => {
          throw new Error("finalize should not be called");
        },
        release: async (params) => {
          releaseCalls.push(params);
          return {
            status: "released",
            reservationId: "reservation-3",
            operationKey: params.operationKey,
            source: "credit",
            reasonCode: null,
          };
        },
      },
    );

    assert.equal(result.rows[0]?.decision, "release");
    assert.equal(result.rows[0]?.outcome, "applied");
    assert.equal(releaseCalls.length, 1);
  }

  {
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: true,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [
          buildReservation({
            id: "44444444-4444-4444-8444-444444444444",
          }),
        ],
        findAuditsByReservationId: async () => [
          buildAudit({
            workspaceId: "workspace-other",
            entitlementReservationId: "44444444-4444-4444-8444-444444444444",
          }),
        ],
      },
    );

    assert.equal(result.rows[0]?.decision, "manual_review");
    assert.equal(result.rows[0]?.reasonCode, "audit_workspace_mismatch");
  }

  {
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: true,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [
          buildReservation({
            id: "55555555-5555-4555-8555-555555555555",
          }),
        ],
        findAuditsByReservationId: async () => [
          buildAudit({
            id: "audit-5a",
            entitlementReservationId: "55555555-5555-4555-8555-555555555555",
          }),
          buildAudit({
            id: "audit-5b",
            entitlementReservationId: "55555555-5555-4555-8555-555555555555",
          }),
        ],
      },
    );

    assert.equal(result.rows[0]?.decision, "manual_review");
    assert.equal(result.rows[0]?.reasonCode, "multiple_linked_audits");
  }

  {
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: true,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [
          buildReservation({
            id: "66666666-6666-4666-8666-666666666666",
            status: "consumed",
          }),
          buildReservation({
            id: "77777777-7777-4777-8777-777777777777",
            status: "released",
          }),
        ],
        findAuditsByReservationId: async () => [],
      },
    );

    assert.equal(result.rows[0]?.decision, "ignore");
    assert.equal(result.rows[1]?.decision, "ignore");
  }

  {
    let mutationCalls = 0;
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: true,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [buildReservation()],
        findAuditsByReservationId: async () => [buildAudit()],
        finalize: async () => {
          mutationCalls += 1;
          return {
            status: "finalized",
            reservationId: "reservation-1",
            operationKey: "operation",
            source: "credit",
            reasonCode: null,
          };
        },
      },
    );

    assert.equal(result.rows[0]?.outcome, "none");
    assert.equal(mutationCalls, 0);
  }

  {
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: false,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [buildReservation()],
        findAuditsByReservationId: async () => [buildAudit()],
        finalize: async () => ({
          status: "already_finalized",
          reservationId: "reservation-1",
          operationKey: "operation",
          source: "credit",
          reasonCode: null,
        }),
      },
    );

    assert.equal(result.rows[0]?.outcome, "applied");
    assert.equal(result.rows[0]?.actionStatus, "already_finalized");
  }

  {
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: false,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [
          buildReservation({
            id: "88888888-8888-4888-8888-888888888888",
          }),
        ],
        findAuditsByReservationId: async () => [],
        release: async () => ({
          status: "already_released",
          reservationId: "reservation-8",
          operationKey: "operation",
          source: "credit",
          reasonCode: null,
        }),
      },
    );

    assert.equal(result.rows[0]?.outcome, "applied");
    assert.equal(result.rows[0]?.actionStatus, "already_released");
  }

  {
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: false,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [buildReservation()],
        findAuditsByReservationId: async () => [buildAudit()],
        finalize: async () => ({
          status: "failed",
          reservationId: "reservation-1",
          operationKey: "operation",
          source: "credit",
          reasonCode: "rpc_error",
        }),
      },
    );

    assert.equal(result.rows[0]?.outcome, "failed");
    assert.equal(result.exitCode, 1);
  }

  {
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: false,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [
          buildReservation({
            id: "99999999-9999-4999-8999-999999999999",
          }),
        ],
        findAuditsByReservationId: async () => [],
        release: async () => ({
          status: "failed",
          reservationId: "reservation-9",
          operationKey: "operation",
          source: "credit",
          reasonCode: "rpc_error",
        }),
      },
    );

    assert.equal(result.rows[0]?.outcome, "failed");
    assert.equal(result.exitCode, 1);
  }

  {
    const result = await executeReconcileAuditEntitlements(
      {
        dryRun: true,
        olderThanHours: 6,
        limit: 10,
        reservationId: null,
      },
      {
        now: new Date("2026-07-14T12:00:00.000Z"),
        listReservations: async () => [
          buildReservation({
            operationKey: "secret-operation-key-with-long-tail",
          }),
        ],
        findAuditsByReservationId: async () => [],
      },
    );

    const report = formatReconcileAuditEntitlementsReport(result);
    assert.doesNotMatch(report, /https?:\/\//i);
    assert.doesNotMatch(report, /secret-operation-key-with-long-tail/);
    assert.match(report, /Scanned: 1/);
  }

  console.log("PASS — Reconcile audit entitlements smoke");
}

main();

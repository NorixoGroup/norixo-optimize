import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  finalizeAuditEntitlement,
  releaseAuditEntitlement,
  reserveAuditEntitlement,
} from "../lib/billing/auditEntitlement";

type RpcCall = {
  fn: string;
  args: Record<string, unknown>;
};

function buildAdminStub(rows: Record<string, unknown>) {
  const calls: RpcCall[] = [];

  return {
    calls,
    admin: {
      async rpc(fn: string, args?: Record<string, unknown>) {
        calls.push({ fn, args: args ?? {} });

        if (fn in rows) {
          const value = rows[fn];
          if (value instanceof Error) {
            throw value;
          }
          return { data: value, error: null };
        }

        return { data: null, error: { code: "PGRST999", message: "missing stub" } };
      },
    },
  };
}

async function main() {
  {
    const { admin, calls } = buildAdminStub({
      reserve_audit_entitlement: [
        {
          reservation_id: "reservation-1",
          operation_key: "operation-1",
          status: "reserved",
          source: "credit",
          reason_code: null,
        },
      ],
    });

    const result = await reserveAuditEntitlement(
      {
        workspaceId: "workspace-1",
        userId: "user-1",
        operationKey: "operation-1",
        targetKind: "source_url",
        targetRef: "https://airbnb.com/rooms/1",
        billingAdminBypass: false,
        enforceFreePlanLimit: true,
      },
      { admin },
    );

    assert.equal(result.status, "reserved");
    assert.equal(result.reservationId, "reservation-1");
    assert.equal(result.source, "credit");
    assert.equal(calls[0]?.fn, "reserve_audit_entitlement");
    assert.equal(calls[0]?.args.p_enforce_free_plan_limit, true);
  }

  {
    const { admin } = buildAdminStub({
      reserve_audit_entitlement: [
        {
          reservation_id: null,
          operation_key: "operation-2",
          status: "insufficient_entitlement",
          source: "credit",
          reason_code: "insufficient_credits",
        },
      ],
    });

    const result = await reserveAuditEntitlement(
      {
        workspaceId: "workspace-1",
        userId: "user-1",
        operationKey: "operation-2",
        targetKind: "listing_id",
        targetRef: "listing-1",
        billingAdminBypass: false,
        enforceFreePlanLimit: false,
      },
      { admin },
    );

    assert.equal(result.status, "insufficient_entitlement");
    assert.equal(result.reasonCode, "insufficient_credits");
  }

  {
    const { admin } = buildAdminStub({
      reserve_audit_entitlement: [
        {
          reservation_id: "reservation-2",
          operation_key: "operation-3",
          status: "conflict",
          source: "admin",
          reason_code: "active_target_reservation",
        },
      ],
    });

    const result = await reserveAuditEntitlement(
      {
        workspaceId: "workspace-1",
        userId: "user-1",
        operationKey: "operation-3",
        targetKind: "listing_id",
        targetRef: "listing-1",
        billingAdminBypass: true,
        enforceFreePlanLimit: false,
      },
      { admin },
    );

    assert.equal(result.status, "conflict");
    assert.equal(result.source, "admin");
  }

  {
    const { admin } = buildAdminStub({
      finalize_audit_entitlement: [
        {
          reservation_id: "reservation-1",
          operation_key: "operation-1",
          status: "finalized",
          source: "credit",
          reason_code: null,
        },
      ],
    });

    const result = await finalizeAuditEntitlement(
      {
        workspaceId: "workspace-1",
        operationKey: "operation-1",
        auditId: "audit-1",
        listingId: "listing-1",
        userId: "user-1",
        usageSource: "api_audits_create",
      },
      { admin },
    );

    assert.equal(result.status, "finalized");
  }

  {
    const { admin } = buildAdminStub({
      release_audit_entitlement: [
        {
          reservation_id: "reservation-1",
          operation_key: "operation-1",
          status: "released",
          source: "credit",
          reason_code: null,
        },
      ],
    });

    const result = await releaseAuditEntitlement(
      {
        workspaceId: "workspace-1",
        operationKey: "operation-1",
        failureCode: "route_error",
      },
      { admin },
    );

    assert.equal(result.status, "released");
  }

  {
    const result = await reserveAuditEntitlement(
      {
        workspaceId: "workspace-1",
        userId: "user-1",
        operationKey: "operation-rpc-error",
        targetKind: "source_url",
        targetRef: "https://airbnb.com/rooms/2",
        billingAdminBypass: false,
        enforceFreePlanLimit: false,
      },
      {
        admin: {
          async rpc() {
            return {
              data: null,
              error: { code: "PGRST205", message: "relation missing" },
            };
          },
        },
      },
    );

    assert.equal(result.status, "failed");
    assert.equal(result.reasonCode, "rpc_error");
  }

  {
    const migration = readFileSync(
      "supabase/migrations/20260714110000_create_audit_entitlement_reservations.sql",
      "utf8",
    );

    assert.match(
      migration,
      /create table if not exists public\.audit_entitlement_reservations/i,
    );
    assert.match(
      migration,
      /create unique index if not exists audit_entitlement_reservations_active_target_unique/i,
    );
    assert.match(migration, /for update/gi);
    assert.match(
      migration,
      /create or replace function public\.reserve_audit_entitlement/i,
    );
    assert.match(
      migration,
      /create or replace function public\.finalize_audit_entitlement/i,
    );
    assert.match(
      migration,
      /create or replace function public\.release_audit_entitlement/i,
    );
    assert.match(migration, /on conflict do nothing/i);
  }

  console.log("PASS — Audit entitlement reservation smoke");
}

main();

import assert from "node:assert/strict";

import {
  evaluateAuditRestorePaymentProof,
  type
    AuditRestoreResultStatus,
} from "../app/api/audits/restore/route";

type ProofInput = Parameters<typeof evaluateAuditRestorePaymentProof>[0];

function buildBaseInput(overrides: Partial<ProofInput> = {}): ProofInput {
  return {
    checkoutSessionId: "cs_test_123",
    currentWorkspaceId: "workspace-1",
    currentUserId: "user-1",
    checkoutIntent: {
      id: "intent-1",
      workspace_id: "workspace-1",
      user_id: "user-1",
      plan_code: "audit_test",
      status: "completed",
      stripe_checkout_session_id: "cs_test_123",
      completed_at: "2026-07-14T10:00:00.000Z",
    },
    billingPayment: {
      id: "payment-1",
      workspace_id: "workspace-1",
      status: "succeeded",
      stripe_checkout_session_id: "cs_test_123",
    },
    existingAuditId: null,
    ...overrides,
  };
}

function expectStatus(
  input: ProofInput,
  expected: AuditRestoreResultStatus,
  expectedOk: boolean
) {
  const result = evaluateAuditRestorePaymentProof(input);
  assert.equal(result.status, expected);
  assert.equal(result.ok, expectedOk);
  return result;
}

function main() {
  {
    const result = expectStatus(buildBaseInput(), "restored", true);
    assert.equal(result.auditId, undefined);
  }

  {
    const result = expectStatus(
      buildBaseInput({ existingAuditId: "audit-1" }),
      "already_restored",
      true
    );
    assert.equal(result.auditId, "audit-1");
  }

  expectStatus(
    buildBaseInput({
      checkoutIntent: {
        ...buildBaseInput().checkoutIntent!,
        status: "pending",
        completed_at: null,
      },
    }),
    "payment_not_confirmed",
    false
  );

  expectStatus(
    buildBaseInput({
      billingPayment: null,
    }),
    "payment_not_confirmed",
    false
  );

  expectStatus(
    buildBaseInput({
      checkoutSessionId: "",
    }),
    "invalid_request",
    false
  );

  expectStatus(
    buildBaseInput({
      checkoutIntent: {
        ...buildBaseInput().checkoutIntent!,
        user_id: "user-2",
      },
    }),
    "payment_not_found",
    false
  );

  expectStatus(
    buildBaseInput({
      checkoutIntent: {
        ...buildBaseInput().checkoutIntent!,
        workspace_id: "workspace-2",
      },
    }),
    "payment_not_found",
    false
  );

  expectStatus(
    buildBaseInput({
      checkoutIntent: {
        ...buildBaseInput().checkoutIntent!,
        plan_code: "pro",
      },
    }),
    "payment_not_found",
    false
  );

  expectStatus(
    buildBaseInput({
      checkoutIntent: null,
    }),
    "payment_not_found",
    false
  );

  expectStatus(
    buildBaseInput({
      billingPayment: {
        ...buildBaseInput().billingPayment!,
        status: "failed",
      },
    }),
    "payment_not_confirmed",
    false
  );

  console.log("PASS — Audit restore payment proof smoke");
}

main();

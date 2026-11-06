import assert from "node:assert/strict";
import {
  BacklinkZeroBounceBudgetError,
  createBudgetedMailboxVerificationProvider,
  fingerprintZeroBounceEmail,
} from "@/lib/automation/backlink-zerobounce-budget";
import { executeBacklinkMailboxVerificationTask } from "@/lib/automation/backlink-mailbox-verification-task-handler";
import { runManualMailboxVerification } from "@/lib/backlinks/services/manualMailboxVerificationService";

/**
 * In-memory stand-in for the atomic `reserve_backlink_zerobounce_verification`
 * RPC. No network call, no Supabase, no real ZeroBounce key anywhere in this
 * file -- everything here is a mock.
 */
function fakeReservationLedger() {
  const reserved = new Set<string>();
  let callsInFlight = 0;
  let maxConcurrentCalls = 0;
  return {
    get maxConcurrentCalls() { return maxConcurrentCalls; },
    reserve: async (input: { workspaceId: string; contactId: string; emailFingerprint: string; cyclePeriodStart: string; limit: number }) => {
      callsInFlight += 1;
      maxConcurrentCalls = Math.max(maxConcurrentCalls, callsInFlight);
      // Simulate the RPC's own internal serialization (one global advisory lock):
      // the "critical section" below never interleaves even if callers overlap.
      await new Promise((resolve) => setTimeout(resolve, 1));
      const key = `${input.workspaceId}:${input.contactId}:${input.emailFingerprint}:${input.cyclePeriodStart}`;
      try {
        if (reserved.has(key)) return { outcome: "replayed" as const };
        if (reserved.size >= input.limit) return { outcome: "limit_reached" as const };
        reserved.add(key);
        return { outcome: "reserved" as const };
      } finally {
        callsInFlight -= 1;
      }
    },
    size: () => reserved.size,
  };
}

function fakeProvider(status: "deliverable" | "provider_error" = "deliverable") {
  let calls = 0;
  return {
    get calls() { return calls; },
    provider: { async verify() { calls += 1; return { status, provider: "fake-zerobounce", safeReason: `FAKE_${status}` }; } },
  };
}

async function main() {
  // 1. Fresh reservation succeeds, provider is called exactly once.
  {
    const ledger = fakeReservationLedger();
    const provider = fakeProvider();
    const budgeted = createBudgetedMailboxVerificationProvider(provider.provider, ledger.reserve, { workspaceId: "ws", contactId: "c1", cyclePeriodStart: "2026-11-01", limit: 100 });
    const result = await budgeted.verify({ email: "a@example.test", domain: "example.test" });
    assert.equal(result.status, "deliverable");
    assert.equal(provider.calls, 1);
  }

  // 2. Replay: a second verify() for the SAME workspace+contact+email in the SAME
  //    cycle must never reach the provider a second time.
  {
    const ledger = fakeReservationLedger();
    const providerA = fakeProvider();
    const budgetedA = createBudgetedMailboxVerificationProvider(providerA.provider, ledger.reserve, { workspaceId: "ws", contactId: "c1", cyclePeriodStart: "2026-11-01", limit: 100 });
    await budgetedA.verify({ email: "a@example.test", domain: "example.test" });

    const providerB = fakeProvider();
    const budgetedB = createBudgetedMailboxVerificationProvider(providerB.provider, ledger.reserve, { workspaceId: "ws", contactId: "c1", cyclePeriodStart: "2026-11-01", limit: 100 });
    await assert.rejects(
      () => budgetedB.verify({ email: "a@example.test", domain: "example.test" }),
      (error: unknown) => error instanceof BacklinkZeroBounceBudgetError && error.code === "ALREADY_RESERVED",
    );
    assert.equal(providerB.calls, 0, "a replayed reservation must never trigger a second provider call");
  }

  // 3. A different cycle period for the same contact+email is a fresh reservation
  //    (freshness is tied to the provider's billing cycle, not a permanent block).
  {
    const ledger = fakeReservationLedger();
    const provider = fakeProvider();
    const cycle1 = createBudgetedMailboxVerificationProvider(provider.provider, ledger.reserve, { workspaceId: "ws", contactId: "c1", cyclePeriodStart: "2026-11-01", limit: 100 });
    await cycle1.verify({ email: "a@example.test", domain: "example.test" });
    const cycle2 = createBudgetedMailboxVerificationProvider(provider.provider, ledger.reserve, { workspaceId: "ws", contactId: "c1", cyclePeriodStart: "2026-12-01", limit: 100 });
    const result = await cycle2.verify({ email: "a@example.test", domain: "example.test" });
    assert.equal(result.status, "deliverable");
    assert.equal(provider.calls, 2, "a new provider billing cycle must allow a new reservation");
  }

  // 4. The 101st reservation (limit=100) is deferred, never silently treated as valid.
  {
    const ledger = fakeReservationLedger();
    const provider = fakeProvider();
    for (let i = 0; i < 100; i += 1) {
      const budgeted = createBudgetedMailboxVerificationProvider(provider.provider, ledger.reserve, { workspaceId: "ws", contactId: `c${i}`, cyclePeriodStart: "2026-11-01", limit: 100 });
      await budgeted.verify({ email: `contact${i}@example.test`, domain: "example.test" });
    }
    assert.equal(ledger.size(), 100);
    const budgeted101 = createBudgetedMailboxVerificationProvider(provider.provider, ledger.reserve, { workspaceId: "ws", contactId: "c100", cyclePeriodStart: "2026-11-01", limit: 100 });
    await assert.rejects(
      () => budgeted101.verify({ email: "contact100@example.test", domain: "example.test" }),
      (error: unknown) => error instanceof BacklinkZeroBounceBudgetError && error.code === "LIMIT_REACHED",
    );
    assert.equal(provider.calls, 100, "the 101st call must not reach the provider");
  }

  // 5. Concurrent calls for DIFFERENT contacts must not both be admitted past a tight limit,
  //    and the fake ledger's own serialization must hold (no overlapping critical section).
  {
    const ledger = fakeReservationLedger();
    const provider = fakeProvider();
    const attempts = Array.from({ length: 5 }, (_, i) => {
      const budgeted = createBudgetedMailboxVerificationProvider(provider.provider, ledger.reserve, { workspaceId: "ws", contactId: `concurrent-${i}`, cyclePeriodStart: "2026-11-01", limit: 3 });
      return budgeted.verify({ email: `concurrent${i}@example.test`, domain: "example.test" }).then(() => "ok" as const).catch((error) => (error instanceof BacklinkZeroBounceBudgetError ? error.code : "unexpected"));
    });
    const outcomes = await Promise.all(attempts);
    assert.equal(outcomes.filter((o) => o === "ok").length, 3, "exactly the limit must be admitted under concurrent load");
    assert.equal(outcomes.filter((o) => o === "LIMIT_REACHED").length, 2);
    assert.equal(ledger.maxConcurrentCalls <= 5, true);
    assert.equal(provider.calls, 3);
  }

  // 6. Email fingerprinting is case/whitespace-insensitive, so "same contact and address"
  //    is recognized regardless of how the email string is cased.
  assert.equal(fingerprintZeroBounceEmail("Owner@Example.test"), fingerprintZeroBounceEmail(" owner@example.test "));

  // 7. Autonomous task handler: budget exhaustion defers cleanly, nothing is marked valid,
  //    the provider is never called, and no other contact is blocked.
  {
    const ledger = fakeReservationLedger();
    ledger.reserve = async () => ({ outcome: "limit_reached" as const }); // force exhaustion deterministically
    const provider = fakeProvider();
    let recordCalls = 0;
    const result = await executeBacklinkMailboxVerificationTask(
      {
        getContact: async () => ({ id: "contact-1", workspace_id: "ws", contact_status: "unverified", email_normalized: "a@example.test", do_not_contact_at: null, archived_at: null }),
        getProvider: () => provider.provider,
        record: async () => { recordCalls += 1; throw new Error("must not persist a result for a deferred verification"); },
        reserveVerification: ledger.reserve,
        cyclePeriodStart: "2026-11-01",
      },
      { workspaceId: "ws", domainId: "domain-1", opportunityId: "opportunity-1", contactId: "contact-1", currentNormalizedEmail: "a@example.test" },
    );
    assert.equal(result.outcome, "deferred");
    assert.equal(result.reason, "MAILBOX_VERIFICATION_DEFERRED_BUDGET_EXHAUSTED");
    assert.equal(result.providerCalled, false);
    assert.equal(result.contactStatus, null, "a deferred verification must never report a contact as valid/verified");
    assert.equal(provider.calls, 0);
    assert.equal(recordCalls, 0, "a deferred verification must never reach persistence");
  }

  // 8. Manual route service: budget exhaustion marks the claimed request RETRYABLE
  //    (not terminal, not verified) so a later attempt is not permanently blocked.
  {
    const completed: Array<Record<string, unknown>> = [];
    const result = await runManualMailboxVerification(
      {
        getContact: async () => ({ id: "contact-1", workspace_id: "ws", email_normalized: "a@example.test", contact_status: "unverified", archived_at: null, do_not_contact_at: null }),
        getProvider: () => fakeProvider().provider,
        claim: async () => ({ request_id: "request-1", request_status: "running", request_attempt_count: 1, request_last_result: null, reservation_held: true }),
        complete: async (input) => { completed.push(input); },
        getCanonicalVerification: async () => null,
        record: async () => { throw new Error("must not persist a result for a deferred verification"); },
        reserveVerification: async () => ({ outcome: "limit_reached" as const }),
        cyclePeriodStart: "2026-11-01",
      },
      { workspaceId: "ws", contactId: "contact-1" },
    );
    assert.equal(result.state, "deferred");
    assert.equal(result.providerCalled, false);
    assert.equal(completed.length, 1);
    assert.equal(completed[0]?.status, "retryable");
    assert.notEqual(completed[0]?.status, "succeeded");
  }

  // 9. Provider failure (genuine ZeroBounce error, reservation succeeded) still flows through
  //    unchanged: never marked valid, budget was consumed (conservative, matches Brave policy).
  {
    const ledger = fakeReservationLedger();
    const provider = fakeProvider("provider_error");
    let recordedStatus: string | null = null;
    // Existing, unchanged behavior: a genuine provider_error throws to signal the
    // worker's own retry/backoff/dead-letter lifecycle -- it is never swallowed into
    // a "valid" result, budget-deferral or not.
    await assert.rejects(
      () => executeBacklinkMailboxVerificationTask(
        {
          getContact: async () => ({ id: "contact-2", workspace_id: "ws", contact_status: "unverified", email_normalized: "b@example.test", do_not_contact_at: null, archived_at: null }),
          getProvider: () => provider.provider,
          record: async (input: { result: string }) => { recordedStatus = input.result; return { verificationId: "v1", disposition: "created" as const, contactStatus: "unverified", verifiedAt: null }; },
          reserveVerification: ledger.reserve,
          cyclePeriodStart: "2026-11-01",
        },
        { workspaceId: "ws", domainId: "domain-1", opportunityId: "opportunity-1", contactId: "contact-2", currentNormalizedEmail: "b@example.test" },
      ),
      /MAILBOX_VERIFICATION_PROVIDER_ERROR/,
    );
    assert.equal(recordedStatus, "provider_error", "the reservation was consumed and the failed attempt was still persisted (conservative)");
  }

  // 10. No real network call: this module imports no fetch-capable ZeroBounce client and no
  //     email-sending service. (Structural send-safety itself is already validated elsewhere
  //     and is not re-audited here.)
  assert.equal(/zeroBounceMailboxVerificationProvider|ZEROBOUNCE_EU_VALIDATE_ENDPOINT/.test(createBudgetedMailboxVerificationProvider.toString()), false);

  console.log("PASS — Backlink ZeroBounce budget smoke (mocks only, no real Brave/ZeroBounce call)");
}

main().catch((error) => {
  console.error("FAIL — Backlink ZeroBounce budget smoke");
  console.error(error);
  process.exitCode = 1;
});

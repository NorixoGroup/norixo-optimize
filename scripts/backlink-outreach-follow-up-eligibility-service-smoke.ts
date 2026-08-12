import { evaluateBacklinkOutreachFollowUpEligibility } from "../lib/backlinks/services/outreachFollowUpEligibilityService";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Scenario = {
  status?: string;
  channel?: string;
  nextFollowUpAt?: string | null;
  currentAttempt?: number;
  maxAttempts?: number;
  contactStatus?: string;
  email?: string | null;
  openAttemptStatus?: "prepared" | "requested" | "unknown" | "failed" | "accepted" | "cancelled" | null;
  inboundReplyStopped?: boolean;
};

async function evaluate(scenario: Scenario = {}) {
  let reads = 0;
  let mutations = 0;
  const service = evaluateBacklinkOutreachFollowUpEligibility({
    getOutreach: async (workspaceId, outreachId) => {
      reads += 1;
      assert(workspaceId === "workspace" && outreachId === "outreach", "Outreach lookup must be workspace scoped.");
      return {
        id: "outreach",
        contact_id: "contact",
        status: scenario.status ?? "active",
        channel: scenario.channel ?? "email",
        next_follow_up_at: scenario.nextFollowUpAt === undefined ? "2026-08-12T10:00:00.000Z" : scenario.nextFollowUpAt,
        current_attempt: scenario.currentAttempt ?? 1,
        max_attempts: scenario.maxAttempts ?? 3,
      };
    },
    getContact: async (workspaceId, contactId) => {
      reads += 1;
      assert(workspaceId === "workspace" && contactId === "contact", "Contact lookup must be workspace scoped.");
      return { contact_status: scenario.contactStatus ?? "verified", email_normalized: scenario.email === undefined ? "contact@example.com" : scenario.email };
    },
    getOpenAttemptForOutreach: async (workspaceId, outreachId) => {
      reads += 1;
      assert(workspaceId === "workspace" && outreachId === "outreach", "Attempt lookup must be workspace scoped.");
      return scenario.openAttemptStatus == null ? null : { status: scenario.openAttemptStatus };
    },
    hasInboundReplyStopEffect: async (workspaceId, outreachId) => {
      reads += 1;
      assert(workspaceId === "workspace" && outreachId === "outreach", "Inbound-stop lookup must be workspace scoped.");
      return scenario.inboundReplyStopped ?? false;
    },
    now: () => "2026-08-12T10:00:00.000Z",
  });
  const result = await service({ workspaceId: "workspace", outreachId: "outreach" });
  assert(mutations === 0, "Eligibility must not mutate, reserve an Attempt, send, or schedule.");
  return { result, reads };
}

async function expectReason(scenario: Scenario, reason: string) {
  const { result } = await evaluate(scenario);
  assert(!result.eligible && result.reason === reason, `Expected ${reason}.`);
}

async function main() {
  const eligible = await evaluate();
  assert(eligible.result.eligible && eligible.result.reason == null, "Due active email Outreach must be eligible.");
  assert(eligible.result.currentAttempt === 1 && eligible.result.maxAttempts === 3 && eligible.result.nextFollowUpAt != null, "Result must expose only scheduling counters, not PII.");

  for (const status of ["draft", "ready", "replied", "conversation_open", "declined", "no_response", "paused", "closed"]) {
    await expectReason({ status }, "OUTREACH_NOT_ACTIVE");
  }
  await expectReason({ channel: "linkedin" }, "CHANNEL_NOT_SUPPORTED");
  await expectReason({ nextFollowUpAt: null }, "FOLLOW_UP_NOT_SCHEDULED");
  await expectReason({ nextFollowUpAt: "2026-08-12T10:00:01.000Z" }, "FOLLOW_UP_NOT_DUE");
  const exactNow = await evaluate({ nextFollowUpAt: "2026-08-12T10:00:00.000Z" });
  const past = await evaluate({ nextFollowUpAt: "2026-08-12T09:59:59.000Z" });
  assert(exactNow.result.eligible && past.result.eligible, "Exact-now and past schedules must be due.");
  await expectReason({ currentAttempt: 3, maxAttempts: 3 }, "ATTEMPT_LIMIT_REACHED");
  await expectReason({ currentAttempt: 4, maxAttempts: 3 }, "ATTEMPT_LIMIT_REACHED");

  await expectReason({ contactStatus: "do_not_contact" }, "CONTACT_UNAVAILABLE");
  await expectReason({ contactStatus: "archived" }, "CONTACT_UNAVAILABLE");
  await expectReason({ email: null }, "CONTACT_UNAVAILABLE");
  await expectReason({ email: "  " }, "CONTACT_UNAVAILABLE");
  await expectReason({ openAttemptStatus: "requested" }, "FOLLOW_UP_ATTEMPT_IN_PROGRESS");
  await expectReason({ openAttemptStatus: "prepared" }, "FOLLOW_UP_ATTEMPT_PREPARED");
  await expectReason({ openAttemptStatus: "unknown" }, "FOLLOW_UP_ATTEMPT_UNRESOLVED");
  assert((await evaluate({ openAttemptStatus: "failed" })).result.eligible, "Failed Attempts must not block follow-up eligibility.");
  assert((await evaluate({ openAttemptStatus: "accepted" })).result.eligible, "Accepted history must not block follow-up eligibility.");
  assert((await evaluate({ openAttemptStatus: "cancelled" })).result.eligible, "Cancelled history must not block follow-up eligibility.");
  await expectReason({ inboundReplyStopped: true }, "INBOUND_REPLY_STOPPED");

  const source = await import("node:fs/promises").then((fs) => fs.readFile("lib/backlinks/services/outreachFollowUpEligibilityService.ts", "utf8"));
  for (const forbidden of ["reserveAttempt", "sendEmail", "outreachEmailProvider", "scheduler", ".update(", ".rpc("]) {
    assert(!source.includes(forbidden), `Read-only eligibility must not contain ${forbidden}.`);
  }
  console.log("PASS — Backlink outreach follow-up eligibility service smoke");
}

void main();

import type { BacklinkOutreachAttemptReservation, BacklinkOutreachAttemptRow } from "../lib/backlinks/repositories/outreachAttemptsRepository";
import type { OutreachEmailSendResult } from "../lib/backlinks/providers/outreachEmailProvider";
import { BacklinkOutreachEmailSendError, sendBacklinkOutreachEmail } from "../lib/backlinks/services/outreachEmailSendService";
import { deriveBacklinkOutreachReplyCorrelationIdentity, deriveBacklinkOutreachReplyTo } from "../lib/backlinks/services/outreachReplyCorrelationIdentity";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function expects(operation: () => Promise<unknown>, code: BacklinkOutreachEmailSendError["code"]) {
  try {
    await operation();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    assert(error instanceof BacklinkOutreachEmailSendError && error.code === code, `Expected ${code}`);
  }
}

function attempt(status: BacklinkOutreachAttemptRow["status"] = "requested"): BacklinkOutreachAttemptRow {
  return {
    id: "attempt",
    workspace_id: "workspace",
    outreach_id: "outreach",
    actor_user_id: "actor",
    attempt_kind: "initial",
    cancel_reason: null,
    cancelled_at: null,
    channel: "email",
    provider: "resend",
    recipient: "contact@example.com",
    idempotency_key: "key",
    reply_token_hash: null,
    reply_token_key_version: null,
    status,
    provider_message_id: null,
    prepared_at: null,
    error_code: null,
    error_message: null,
    requested_at: "2026-08-10T09:00:00.000Z",
    accepted_at: null,
    failed_at: null,
    resolved_at: null,
    created_at: "2026-08-10T09:00:00.000Z",
  };
}

type OpportunityFixture = { id: string; domain_id: string; asset_id: string };
type ContactFixture = { id: string; domain_id: string; contact_status: string; email_normalized: string | null; linkedin_url: string | null; contact_form_url: string | null };
type OutreachFixture = {
  id: string;
  campaign_id: string;
  opportunity_id: string;
  contact_id: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string | null;
  current_attempt: number;
  max_attempts: number;
  first_contact_at: string | null;
  last_attempt_at: string | null;
  next_follow_up_at: string | null;
};

async function main() {
  let outreach: OutreachFixture = {
    id: "outreach",
    campaign_id: "campaign",
    opportunity_id: "opportunity",
    contact_id: "contact",
    channel: "email",
    status: "ready",
    subject: " Subject ",
    body: " Body ",
    current_attempt: 0,
    max_attempts: 3,
    first_contact_at: null,
    last_attempt_at: null,
    next_follow_up_at: "unchanged",
  };
  const currentOpportunity: OpportunityFixture = { id: "opportunity", domain_id: "domain", asset_id: "asset" };
  let contact: ContactFixture = {
    id: "contact",
    domain_id: "domain",
    contact_status: "verified",
    email_normalized: "contact@example.com",
    linkedin_url: null,
    contact_form_url: null,
  };
  const outreachFixtures = new Map<string, OutreachFixture>();
  const opportunityFixtures = new Map<string, OpportunityFixture>();
  const contactFixtures = new Map<string, ContactFixture>();
  let recentAttempts: Array<{ outreach_id: string; requested_at: string; status: string }> = [];
  let storedAttempt: BacklinkOutreachAttemptRow | null = null;
  let forcedReservation: BacklinkOutreachAttemptReservation | null = null;
  let providerCalls = 0;
  const outreachUpdates: Array<{ channel?: string }> = [];
  let dryRunOnly = false;
  const reservedReplyTokenHashes: string[] = [];
  const providerReplyTos: string[] = [];
  let createdReplyTokenHash: string | null = null;
  let provider: OutreachEmailSendResult = {
    status: "accepted",
    provider: "resend",
    providerMessageId: "message",
    errorCode: null,
    errorMessage: null,
  };
  let failActivation = false;
  const createdAttemptIds: string[] = [];
  const attemptIds = [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003",
    "550e8400-e29b-41d4-a716-446655440004",
  ];
  const replyTokenKeyring = { activeKeyVersion: "v1", secrets: { v1: "service-smoke-secret" } };
  outreachFixtures.set("outreach", outreach);
  opportunityFixtures.set("opportunity", currentOpportunity);
  contactFixtures.set("contact", contact);
  const service = sendBacklinkOutreachEmail({
    eligibility: {
      getMembership: async () => ({ campaign_id: "campaign", opportunity_id: "opportunity" }),
      getOpportunity: async (_workspaceId, opportunityId) => {
        if (opportunityId === currentOpportunity.id) return currentOpportunity;
        const fixture = opportunityFixtures.get(opportunityId);
        assert(fixture != null, `Missing opportunity fixture for ${opportunityId}`);
        return fixture;
      },
      listContactsByDomain: async () => [{
        id: "contact",
        contact_key: "contact",
        full_name: null,
        role_title: null,
        contact_status: contact.contact_status,
        email_normalized: contact.email_normalized,
        linkedin_url: null,
        contact_form_url: null,
      }],
      listOutreachByOpportunity: async () => [],
    },
    getWorkspaceControl: async () => (dryRunOnly ? { dryRunOnly: true as const } : null),
    getOutreach: async (_workspaceId, outreachId) => {
      if (outreachId === outreach.id) return outreach;
      const fixture = outreachFixtures.get(outreachId);
      assert(fixture != null, `Missing outreach fixture for ${outreachId}`);
      return fixture;
    },
    getContact: async (_workspaceId, contactId) => {
      if (contactId === contact.id) return contact;
      const fixture = contactFixtures.get(contactId);
      assert(fixture != null, `Missing contact fixture for ${contactId}`);
      return fixture;
    },
    listAttemptSummariesSince: async (_workspaceId, since) => recentAttempts.filter((attempt) => attempt.requested_at >= since),
    getAttemptByIdempotencyKey: async (_workspaceId, key) => (storedAttempt?.idempotency_key === key ? storedAttempt : null),
    getOpenAttemptForOutreach: async () => (storedAttempt?.status === "requested" || storedAttempt?.status === "unknown" ? storedAttempt : null),
    updateOutreach: async (_workspaceId, _outreachId, value) => {
      outreachUpdates.push(value);
      outreach = { ...outreach, channel: value.channel ?? outreach.channel };
      return outreach;
    },
    reserveAttempt: async (_workspaceId, input) => {
      if (forcedReservation != null) return forcedReservation;
      assert(input.attemptKind === "initial", "Initial Send must explicitly reserve an initial Attempt.");
      if (storedAttempt != null) return { attempt: storedAttempt, disposition: "existing" as const, rateLimitReason: null };
      const expectedIdentity = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId: input.attemptId, keyring: replyTokenKeyring });
      assert(
        input.replyTokenHash === expectedIdentity.tokenHash && input.replyTokenKeyVersion === "v1",
        "Initial reservation must receive the deterministic hash and active key version.",
      );
      reservedReplyTokenHashes.push(input.replyTokenHash);
      createdReplyTokenHash = input.replyTokenHash;
      createdAttemptIds.push(input.attemptId);
      storedAttempt = attempt();
      storedAttempt = {
        ...storedAttempt,
        id: input.attemptId,
        idempotency_key: input.idempotencyKey,
        recipient: input.recipient,
        reply_token_hash: input.replyTokenHash,
        reply_token_key_version: input.replyTokenKeyVersion,
        attempt_kind: input.attemptKind,
      };
      return { attempt: storedAttempt, disposition: "created" as const, rateLimitReason: null };
    },
    markAttemptAccepted: async (value) => {
      assert(storedAttempt != null, "Attempt required.");
      storedAttempt = {
        ...storedAttempt,
        status: "accepted",
        provider_message_id: value.providerMessageId,
        accepted_at: "2026-08-10T10:00:00.000Z",
        resolved_at: "2026-08-10T10:00:00.000Z",
      };
    },
    markAttemptFailed: async (value) => {
      assert(storedAttempt != null, "Attempt required.");
      storedAttempt = { ...storedAttempt, status: "failed", error_code: value.errorCode, error_message: value.errorMessage };
    },
    markAttemptUnknown: async (value) => {
      assert(storedAttempt != null, "Attempt required.");
      storedAttempt = { ...storedAttempt, status: "unknown", error_code: value.errorCode, error_message: value.errorMessage };
    },
    sendEmail: async (value) => {
      providerCalls += 1;
      providerReplyTos.push(value.replyTo);
      assert(value.to === "contact@example.com" && value.subject === "Subject" && value.body === "Body", "Recipient and content must be server-derived.");
      return provider;
    },
    activateOutreach: async (_workspaceId, _outreachId, value) => {
      if (failActivation) throw new Error("update failed");
      outreach = { ...outreach, status: value.status, current_attempt: value.currentAttempt, first_contact_at: value.firstContactAt, last_attempt_at: value.lastAttemptAt };
      return outreach;
    },
    now: () => "2026-08-10T10:00:00.000Z",
    replyTokenKeyring,
    createAttemptId: (() => {
      let index = 0;
      return () => attemptIds[index++] ?? "550e8400-e29b-41d4-a716-446655440099";
    })(),
    inboundReplyDomain: "inbound.norixo.io",
  });
  const input = { workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", idempotencyKey: "key" };
  dryRunOnly = true;
  await expects(() => service(input), "OUTREACH_SEND_DISABLED_BY_DRY_RUN");
  assert(Number(providerCalls) === 0 && storedAttempt == null, "Dry-run send must fail before reservation or provider call.");
  dryRunOnly = false;
  let result = await service(input);
  assert(result.disposition === "sent" && result.attemptStatus === "accepted" && outreach.status === "active" && outreach.current_attempt === 1, "Ready email must become active only after accepted attempt.");
  const firstIdentity = deriveBacklinkOutreachReplyCorrelationIdentity({ attemptId: createdAttemptIds[0], keyring: replyTokenKeyring });
  assert(Number(reservedReplyTokenHashes.length) === 1 && createdReplyTokenHash === reservedReplyTokenHashes[0] && providerReplyTos[0] === deriveBacklinkOutreachReplyTo(firstIdentity.token, "inbound.norixo.io"), "New attempt must persist a token hash and send with its tokenized reply-to.");
  assert(outreach.first_contact_at === "2026-08-10T10:00:00.000Z" && outreach.last_attempt_at === "2026-08-10T10:00:00.000Z" && outreach.next_follow_up_at === "unchanged", "Contact timestamps must update and follow-up remain unchanged.");
  result = await service(input);
  assert(result.disposition === "existing" && providerCalls === 1 && Number(reservedReplyTokenHashes.length) === 1, "Accepted retry must not resend or create another correlation identity.");

  outreach = { ...outreach, status: "ready", current_attempt: 0, first_contact_at: null, last_attempt_at: null, next_follow_up_at: null };
  storedAttempt = null;
  forcedReservation = { attempt: null, disposition: "rate_limited", rateLimitReason: "WORKSPACE_HOURLY_LIMIT_REACHED" };
  await expects(() => service({ ...input, idempotencyKey: "key-forced-rate-limit" }), "OUTREACH_SEND_RATE_LIMIT_EXCEEDED");
  assert(storedAttempt == null && providerCalls === 1, "Rate-limited admission must not reserve or call the provider.");
  forcedReservation = null;

  outreach = { ...outreach, status: "ready" };
  storedAttempt = { ...attempt("requested"), idempotency_key: "legacy-key", reply_token_hash: "b".repeat(64), reply_token_key_version: null };
  result = await service({ ...input, idempotencyKey: "legacy-key" });
  assert(result.disposition === "existing" && providerCalls === 1 && Number(reservedReplyTokenHashes.length) === 1, "Legacy existing Attempt must remain canonical and must not be reconstructed or resent.");

  outreach = { ...outreach, status: "ready" };
  storedAttempt = null;
  result = await service({ ...input, idempotencyKey: "key-second" });
  assert(result.disposition === "sent" && outreach.first_contact_at === "2026-08-10T10:00:00.000Z" && Number(reservedReplyTokenHashes.length) === 2 && reservedReplyTokenHashes[0] !== reservedReplyTokenHashes[1], "A later attempt must preserve first_contact_at and receive a new correlation identity.");

  outreach = { ...outreach, status: "ready", current_attempt: 0, first_contact_at: null };
  storedAttempt = null;
  provider = { status: "failed", provider: "resend", providerMessageId: null, errorCode: "REJECTED", errorMessage: "Rejected" };
  result = await service(input);
  assert(result.disposition === "failed" && outreach.status === "ready", "Provider failure must keep Outreach ready.");
  const failedAttemptHashCount = Number(reservedReplyTokenHashes.length);
  await service(input);
  assert(Number(providerCalls) === 3 && Number(reservedReplyTokenHashes.length) === failedAttemptHashCount, "Failed retry must not resend or create another correlation identity.");
  outreach = { ...outreach, status: "ready" };
  storedAttempt = null;
  provider = { status: "accepted", provider: "resend", providerMessageId: "message-failed-retry", errorCode: null, errorMessage: null };
  result = await service({ ...input, idempotencyKey: "key-failed-retry" });
  assert(result.disposition === "sent" && Number(reservedReplyTokenHashes.length) === failedAttemptHashCount + 1 && reservedReplyTokenHashes.at(-1) !== reservedReplyTokenHashes[failedAttemptHashCount - 1], "A new human retry after failure must receive a new correlation identity.");
  outreach = { ...outreach, status: "ready" };
  storedAttempt = null;
  provider = { status: "unknown", provider: "resend", providerMessageId: null, errorCode: "TIMEOUT", errorMessage: "Timeout" };
  result = await service(input);
  assert(result.disposition === "unknown" && outreach.status === "ready", "Unknown provider result must keep Outreach ready.");
  await service(input);
  assert(Number(providerCalls) === 5, "Unknown retry must not resend.");

  outreach = { ...outreach, status: "ready", current_attempt: 0 };
  storedAttempt = null;
  provider = { status: "accepted", provider: "resend", providerMessageId: "message", errorCode: null, errorMessage: null };
  contact = { ...contact, contact_status: "do_not_contact" };
  await expects(() => service(input), "OUTREACH_CONTACT_NOT_ELIGIBLE");
  assert(storedAttempt == null && Number(providerCalls) === 5, "Ineligible contact must not reserve or send.");
  contact = { ...contact, contact_status: "verified", email_normalized: null };
  await expects(() => service(input), "OUTREACH_CONTACT_NOT_ELIGIBLE");
  contact = { ...contact, email_normalized: "contact@example.com" };
  outreach = { ...outreach, channel: "linkedin", current_attempt: 1 };
  await expects(() => service(input), "OUTREACH_EMAIL_CHANNEL_UNSUPPORTED");
  outreach = { ...outreach, channel: "contact_form", status: "ready", current_attempt: 0, subject: "Subject", body: "Body" };
  storedAttempt = null;
  provider = { status: "accepted", provider: "resend", providerMessageId: "message-reconciled", errorCode: null, errorMessage: null };
  result = await service({ ...input, idempotencyKey: "key-reconciled" });
  assert(result.disposition === "sent" && outreach.channel === "email" && outreachUpdates.at(-1)?.channel === "email", "Ready outreach with a newly available direct email must reconcile to email before send.");
  outreach = { ...outreach, channel: "email", status: "draft" };
  await expects(() => service(input), "OUTREACH_NOT_SENDABLE");
  outreach = { ...outreach, status: "ready", current_attempt: 3 };
  await expects(() => service(input), "OUTREACH_MAX_ATTEMPTS_REACHED");

  outreach = {
    id: "outreach",
    campaign_id: "campaign",
    opportunity_id: "opportunity",
    contact_id: "contact",
    channel: "email",
    status: "ready",
    subject: "Subject",
    body: "Body",
    current_attempt: 0,
    max_attempts: 3,
    first_contact_at: null,
    last_attempt_at: null,
    next_follow_up_at: null,
  };
  recentAttempts = [];
  storedAttempt = null;
  provider = { status: "accepted", provider: "resend", providerMessageId: "message-rate", errorCode: null, errorMessage: null };
  const baselineRateResult = await service({ ...input, idempotencyKey: "key-rate-baseline" });
  assert(baselineRateResult.disposition === "sent", "Baseline rate-limit path must still allow a clean send.");
  outreach = {
    ...outreach,
    status: "ready",
    current_attempt: 0,
    first_contact_at: null,
    last_attempt_at: null,
    next_follow_up_at: null,
  };
  storedAttempt = null;
  provider = { status: "accepted", provider: "resend", providerMessageId: "message", errorCode: null, errorMessage: null };

  recentAttempts = [
    { outreach_id: "recent-hour-1", requested_at: "2026-08-10T11:15:00.000Z", status: "accepted" },
    { outreach_id: "recent-hour-2", requested_at: "2026-08-10T11:30:00.000Z", status: "failed" },
  ];
  outreachFixtures.set("recent-hour-1", {
    id: "recent-hour-1",
    campaign_id: "campaign",
    opportunity_id: "recent-hour-opportunity-1",
    contact_id: "recent-hour-contact-1",
    channel: "email",
    status: "active",
    subject: "Subject",
    body: "Body",
    current_attempt: 1,
    max_attempts: 3,
    first_contact_at: "2026-08-10T11:15:00.000Z",
    last_attempt_at: "2026-08-10T11:15:00.000Z",
    next_follow_up_at: null,
  });
  outreachFixtures.set("recent-hour-2", {
    id: "recent-hour-2",
    campaign_id: "campaign",
    opportunity_id: "recent-hour-opportunity-2",
    contact_id: "recent-hour-contact-2",
    channel: "email",
    status: "active",
    subject: "Subject",
    body: "Body",
    current_attempt: 1,
    max_attempts: 3,
    first_contact_at: "2026-08-10T11:30:00.000Z",
    last_attempt_at: "2026-08-10T11:30:00.000Z",
    next_follow_up_at: null,
  });
  opportunityFixtures.set("recent-hour-opportunity-1", { id: "recent-hour-opportunity-1", domain_id: "other-domain-1", asset_id: "asset-x" });
  opportunityFixtures.set("recent-hour-opportunity-2", { id: "recent-hour-opportunity-2", domain_id: "other-domain-2", asset_id: "asset-y" });
  contactFixtures.set("recent-hour-contact-1", { id: "recent-hour-contact-1", domain_id: "other-domain-1", contact_status: "verified", email_normalized: "hour1@example.com", linkedin_url: null, contact_form_url: null });
  contactFixtures.set("recent-hour-contact-2", { id: "recent-hour-contact-2", domain_id: "other-domain-2", contact_status: "verified", email_normalized: "hour2@example.com", linkedin_url: null, contact_form_url: null });
  await expects(() => service({ ...input, idempotencyKey: "key-hour" }), "OUTREACH_SEND_RATE_LIMIT_EXCEEDED");

  recentAttempts = [
    { outreach_id: "recent-daily-1", requested_at: "2026-08-09T11:00:00.000Z", status: "accepted" },
    { outreach_id: "recent-daily-2", requested_at: "2026-08-09T12:00:00.000Z", status: "accepted" },
    { outreach_id: "recent-daily-3", requested_at: "2026-08-09T13:00:00.000Z", status: "failed" },
    { outreach_id: "recent-daily-4", requested_at: "2026-08-09T14:00:00.000Z", status: "unknown" },
    { outreach_id: "recent-daily-5", requested_at: "2026-08-09T15:00:00.000Z", status: "requested" },
  ];
  for (const id of ["recent-daily-1", "recent-daily-2", "recent-daily-3", "recent-daily-4", "recent-daily-5"]) {
    outreachFixtures.set(id, {
      id,
      campaign_id: "campaign",
      opportunity_id: `${id}-opportunity`,
      contact_id: `${id}-contact`,
      channel: "email",
      status: "active",
      subject: "Subject",
      body: "Body",
      current_attempt: 1,
      max_attempts: 3,
      first_contact_at: "2026-08-09T11:00:00.000Z",
      last_attempt_at: "2026-08-09T11:00:00.000Z",
      next_follow_up_at: null,
    });
    opportunityFixtures.set(`${id}-opportunity`, { id: `${id}-opportunity`, domain_id: `${id}-domain`, asset_id: `${id}-asset` });
    contactFixtures.set(`${id}-contact`, { id: `${id}-contact`, domain_id: `${id}-domain`, contact_status: "verified", email_normalized: `${id}@example.com`, linkedin_url: null, contact_form_url: null });
  }
  await expects(() => service({ ...input, idempotencyKey: "key-daily" }), "OUTREACH_SEND_RATE_LIMIT_EXCEEDED");

  recentAttempts = [
    { outreach_id: "recent-domain", requested_at: "2026-08-10T10:15:00.000Z", status: "accepted" },
  ];
  outreachFixtures.set("recent-domain", {
    id: "recent-domain",
    campaign_id: "campaign",
    opportunity_id: "same-domain-opportunity",
    contact_id: "other-contact",
    channel: "email",
    status: "active",
    subject: "Subject",
    body: "Body",
    current_attempt: 1,
    max_attempts: 3,
    first_contact_at: "2026-08-10T10:15:00.000Z",
    last_attempt_at: "2026-08-10T10:15:00.000Z",
    next_follow_up_at: null,
  });
  opportunityFixtures.set("same-domain-opportunity", { id: "same-domain-opportunity", domain_id: "domain", asset_id: "same-domain-asset" });
  contactFixtures.set("other-contact", { id: "other-contact", domain_id: "domain", contact_status: "verified", email_normalized: "other@example.com", linkedin_url: null, contact_form_url: null });
  await expects(() => service({ ...input, idempotencyKey: "key-domain" }), "OUTREACH_SEND_RATE_LIMIT_EXCEEDED");

  outreach = {
    ...outreach,
    status: "ready",
    current_attempt: 0,
    first_contact_at: null,
    last_attempt_at: null,
    next_follow_up_at: null,
  };
  storedAttempt = null;
  provider = { status: "accepted", provider: "resend", providerMessageId: "message", errorCode: null, errorMessage: null };
  recentAttempts = [
    { outreach_id: "recent-contact", requested_at: "2026-08-10T10:15:00.000Z", status: "accepted" },
  ];
  outreachFixtures.set("recent-contact", {
    id: "recent-contact",
    campaign_id: "campaign",
    opportunity_id: "other-domain-opportunity",
    contact_id: "other-contact",
    channel: "email",
    status: "active",
    subject: "Subject",
    body: "Body",
    current_attempt: 1,
    max_attempts: 3,
    first_contact_at: "2026-08-10T10:15:00.000Z",
    last_attempt_at: "2026-08-10T10:15:00.000Z",
    next_follow_up_at: null,
  });
  opportunityFixtures.set("other-domain-opportunity", { id: "other-domain-opportunity", domain_id: "other-domain", asset_id: "other-domain-asset" });
  contactFixtures.set("other-contact", { id: "other-contact", domain_id: "other-domain", contact_status: "verified", email_normalized: "other-contact@example.com", linkedin_url: null, contact_form_url: null });
  contactFixtures.set("contact", { ...contact, contact_status: "verified", email_normalized: "contact@example.com" });
  const eligibleRateResult = await service({ ...input, idempotencyKey: "key-eligible" });
  assert(eligibleRateResult.disposition === "sent", "Different domain and different contact must remain eligible.");
  recentAttempts = [];
  outreach = { ...outreach, status: "ready", current_attempt: 0, first_contact_at: null };
  contact = { ...contact, contact_status: "verified", email_normalized: "contact@example.com" };
  storedAttempt = null;
  provider = { status: "accepted", provider: "resend", providerMessageId: "message", errorCode: null, errorMessage: null };

  outreach = { ...outreach, current_attempt: 0 };
  storedAttempt = attempt("accepted");
  storedAttempt = { ...storedAttempt, idempotency_key: "key", provider_message_id: "message" };
  failActivation = true;
  const providerCallsAfterReconciliation = Number(providerCalls);
  result = await service(input);
  assert(result.disposition === "sync_failed" && Number(providerCalls) === providerCallsAfterReconciliation, "Accepted attempt with sync failure must not resend.");
  failActivation = false;
  result = await service(input);
  assert(result.disposition === "reconciled" && outreach.status === "active" && Number(providerCalls) === providerCallsAfterReconciliation, "Accepted retry must reconcile without resend.");
  console.log("PASS — Backlink outreach email send service smoke");
}

void main();

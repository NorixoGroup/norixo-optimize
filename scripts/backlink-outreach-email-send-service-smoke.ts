import type { BacklinkOutreachAttemptRow } from "../lib/backlinks/repositories/outreachAttemptsRepository";
import type { OutreachEmailSendResult } from "../lib/backlinks/providers/outreachEmailProvider";
import { BacklinkOutreachEmailSendError, sendBacklinkOutreachEmail } from "../lib/backlinks/services/outreachEmailSendService";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function expects(operation: () => Promise<unknown>, code: BacklinkOutreachEmailSendError["code"]) { try { await operation(); throw new Error(`Expected ${code}`); } catch (error) { assert(error instanceof BacklinkOutreachEmailSendError && error.code === code, `Expected ${code}`); } }

function attempt(status: BacklinkOutreachAttemptRow["status"] = "requested"): BacklinkOutreachAttemptRow { return { id: "attempt", workspace_id: "workspace", outreach_id: "outreach", actor_user_id: "actor", channel: "email", provider: "resend", recipient: "contact@example.com", idempotency_key: "key", reply_token_hash: null, status, provider_message_id: null, error_code: null, error_message: null, requested_at: "2026-08-10T09:00:00.000Z", accepted_at: null, failed_at: null, resolved_at: null, created_at: "2026-08-10T09:00:00.000Z" }; }

async function main() {
  let outreach: { id: string; campaign_id: string; opportunity_id: string; contact_id: string; channel: string; status: string; subject: string | null; body: string | null; current_attempt: number; max_attempts: number; first_contact_at: string | null; last_attempt_at: string | null; next_follow_up_at: string | null } = { id: "outreach", campaign_id: "campaign", opportunity_id: "opportunity", contact_id: "contact", channel: "email", status: "ready", subject: " Subject ", body: " Body ", current_attempt: 0, max_attempts: 3, first_contact_at: null, last_attempt_at: null, next_follow_up_at: "unchanged" };
  let contact: { id: string; domain_id: string; contact_status: string; email_normalized: string | null } = { id: "contact", domain_id: "domain", contact_status: "verified", email_normalized: "contact@example.com" };
  let storedAttempt: BacklinkOutreachAttemptRow | null = null;
  let providerCalls = 0;
  const reservedReplyTokenHashes: string[] = [];
  const providerReplyTos: string[] = [];
  let createdReplyTokenHash: string | null = null;
  let provider: OutreachEmailSendResult = { status: "accepted", provider: "resend", providerMessageId: "message", errorCode: null, errorMessage: null };
  let failActivation = false;
  const service = sendBacklinkOutreachEmail({
    eligibility: { getMembership: async () => ({ campaign_id: "campaign", opportunity_id: "opportunity" }), getOpportunity: async () => ({ id: "opportunity", domain_id: "domain", asset_id: "asset" }), listContactsByDomain: async () => [{ id: "contact", contact_key: "contact", full_name: null, role_title: null, contact_status: contact.contact_status, email_normalized: contact.email_normalized, linkedin_url: null, contact_form_url: null }], listOutreachByOpportunity: async () => [] },
    getOutreach: async () => outreach,
    getContact: async () => contact,
    getAttemptByIdempotencyKey: async (_workspaceId, key) => storedAttempt?.idempotency_key === key ? storedAttempt : null,
    getOpenAttemptForOutreach: async () => storedAttempt?.status === "requested" || storedAttempt?.status === "unknown" ? storedAttempt : null,
    reserveAttempt: async (_workspaceId, input) => { if (storedAttempt != null) return { attempt: storedAttempt, disposition: "existing" as const }; reservedReplyTokenHashes.push(input.replyTokenHash); createdReplyTokenHash = input.replyTokenHash; storedAttempt = attempt(); storedAttempt = { ...storedAttempt, idempotency_key: input.idempotencyKey, recipient: input.recipient, reply_token_hash: input.replyTokenHash }; return { attempt: storedAttempt, disposition: "created" as const }; },
    markAttemptAccepted: async (value) => { assert(storedAttempt != null, "Attempt required."); storedAttempt = { ...storedAttempt, status: "accepted", provider_message_id: value.providerMessageId, accepted_at: "2026-08-10T10:00:00.000Z", resolved_at: "2026-08-10T10:00:00.000Z" }; },
    markAttemptFailed: async (value) => { assert(storedAttempt != null, "Attempt required."); storedAttempt = { ...storedAttempt, status: "failed", error_code: value.errorCode, error_message: value.errorMessage }; },
    markAttemptUnknown: async (value) => { assert(storedAttempt != null, "Attempt required."); storedAttempt = { ...storedAttempt, status: "unknown", error_code: value.errorCode, error_message: value.errorMessage }; },
    sendEmail: async (value) => { providerCalls += 1; providerReplyTos.push(value.replyTo); assert(value.to === "contact@example.com" && value.subject === "Subject" && value.body === "Body", "Recipient and content must be server-derived."); return provider; },
    activateOutreach: async (_workspaceId, _outreachId, value) => { if (failActivation) throw new Error("update failed"); outreach = { ...outreach, status: value.status, current_attempt: value.currentAttempt, first_contact_at: value.firstContactAt, last_attempt_at: value.lastAttemptAt }; return outreach; },
    now: () => "2026-08-10T10:00:00.000Z",
    inboundReplyDomain: "inbound.norixo.io",
    createReplyToken: (() => { let index = 0; return () => [`550e8400-e29b-41d4-a716-446655440000`, `550e8400-e29b-41d4-a716-446655440001`, `550e8400-e29b-41d4-a716-446655440002`][index++] ?? "550e8400-e29b-41d4-a716-446655440003"; })(),
  });
  const input = { workspaceId: "workspace", actorUserId: "actor", outreachId: "outreach", idempotencyKey: "key" };
  let result = await service(input);
  assert(result.disposition === "sent" && result.attemptStatus === "accepted" && outreach.status === "active" && outreach.current_attempt === 1, "Ready email must become active only after accepted attempt.");
  assert(Number(reservedReplyTokenHashes.length) === 1 && createdReplyTokenHash === reservedReplyTokenHashes[0] && providerReplyTos[0] === "reply+550e8400-e29b-41d4-a716-446655440000@inbound.norixo.io", "New attempt must persist a token hash and send with its tokenized reply-to.");
  assert(outreach.first_contact_at === "2026-08-10T10:00:00.000Z" && outreach.last_attempt_at === "2026-08-10T10:00:00.000Z" && outreach.next_follow_up_at === "unchanged", "Contact timestamps must update and follow-up remain unchanged.");
  result = await service(input);
  assert(result.disposition === "existing" && providerCalls === 1 && Number(reservedReplyTokenHashes.length) === 1, "Accepted retry must not resend or create another correlation identity.");

  outreach = { ...outreach, status: "ready" }; storedAttempt = null;
  result = await service({ ...input, idempotencyKey: "key-second" });
  assert(result.disposition === "sent" && outreach.first_contact_at === "2026-08-10T10:00:00.000Z" && Number(reservedReplyTokenHashes.length) === 2 && reservedReplyTokenHashes[0] !== reservedReplyTokenHashes[1], "A later attempt must preserve first_contact_at and receive a new correlation identity.");

  outreach = { ...outreach, status: "ready", current_attempt: 0, first_contact_at: null }; storedAttempt = null; provider = { status: "failed", provider: "resend", providerMessageId: null, errorCode: "REJECTED", errorMessage: "Rejected" };
  result = await service(input); assert(result.disposition === "failed" && outreach.status === "ready", "Provider failure must keep Outreach ready.");
  const failedAttemptHashCount = Number(reservedReplyTokenHashes.length);
  await service(input); assert(Number(providerCalls) === 3 && Number(reservedReplyTokenHashes.length) === failedAttemptHashCount, "Failed retry must not resend or create another correlation identity.");
  outreach = { ...outreach, status: "ready" }; storedAttempt = null; provider = { status: "accepted", provider: "resend", providerMessageId: "message-failed-retry", errorCode: null, errorMessage: null };
  result = await service({ ...input, idempotencyKey: "key-failed-retry" });
  assert(result.disposition === "sent" && Number(reservedReplyTokenHashes.length) === failedAttemptHashCount + 1 && reservedReplyTokenHashes.at(-1) !== reservedReplyTokenHashes[failedAttemptHashCount - 1], "A new human retry after failure must receive a new correlation identity.");
  outreach = { ...outreach, status: "ready" }; storedAttempt = null; provider = { status: "unknown", provider: "resend", providerMessageId: null, errorCode: "TIMEOUT", errorMessage: "Timeout" };
  result = await service(input); assert(result.disposition === "unknown" && outreach.status === "ready", "Unknown provider result must keep Outreach ready.");
  await service(input); assert(Number(providerCalls) === 5, "Unknown retry must not resend.");

  outreach = { ...outreach, status: "ready", current_attempt: 0 }; storedAttempt = null; provider = { status: "accepted", provider: "resend", providerMessageId: "message", errorCode: null, errorMessage: null }; contact = { ...contact, contact_status: "do_not_contact" };
  await expects(() => service(input), "OUTREACH_CONTACT_NOT_ELIGIBLE"); assert(storedAttempt == null && Number(providerCalls) === 5, "Ineligible contact must not reserve or send.");
  contact = { ...contact, contact_status: "verified", email_normalized: null }; await expects(() => service(input), "OUTREACH_CONTACT_NOT_ELIGIBLE");
  contact = { ...contact, email_normalized: "contact@example.com" }; outreach = { ...outreach, channel: "linkedin" }; await expects(() => service(input), "OUTREACH_EMAIL_CHANNEL_UNSUPPORTED");
  outreach = { ...outreach, channel: "email", status: "draft" }; await expects(() => service(input), "OUTREACH_NOT_SENDABLE");
  outreach = { ...outreach, status: "ready", current_attempt: 3 }; await expects(() => service(input), "OUTREACH_MAX_ATTEMPTS_REACHED");

  outreach = { ...outreach, current_attempt: 0 }; storedAttempt = attempt("accepted"); storedAttempt = { ...storedAttempt, idempotency_key: "key", provider_message_id: "message" }; failActivation = true;
  result = await service(input); assert(result.disposition === "sync_failed" && Number(providerCalls) === 5, "Accepted attempt with sync failure must not resend.");
  failActivation = false; result = await service(input); assert(result.disposition === "reconciled" && outreach.status === "active" && Number(providerCalls) === 5, "Accepted retry must reconcile without resend.");
  console.log("PASS — Backlink outreach email send service smoke");
}
void main();

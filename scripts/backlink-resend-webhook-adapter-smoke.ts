import {
  ResendWebhookAdapterError,
  verifyAndNormalizeResendOutreachWebhook,
} from "../lib/backlinks/providers/resendWebhookAdapter";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const headers = { svixId: "svix-event", svixTimestamp: "1710000000", svixSignature: "v1,signature" };
const input = { payload: '{"raw":true}', headers, webhookSecret: "whsec_test" };

function verified(type: string, emailId = "resend-email", occurredAt = "2026-08-11T10:00:00.000Z", bounceType?: unknown) {
  return { type, created_at: occurredAt, data: { email_id: emailId, to: ["contact@example.com"], subject: "Not persisted", ...(type === "email.bounced" ? { bounce: { type: bounceType, subType: "Not propagated", message: "Not propagated", diagnosticCode: ["Not propagated"] } } : {}) } };
}

function expectError(operation: () => unknown, code: ResendWebhookAdapterError["code"]): void {
  try {
    operation();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    assert(error instanceof ResendWebhookAdapterError && error.code === code, `Expected ${code}.`);
  }
}

function main() {
  let verifyInput: unknown = null;
  const verify = (value: { payload: string; headers: { id: string; timestamp: string; signature: string }; webhookSecret: string }) => {
    verifyInput = value;
    return verified("email.delivered");
  };
  let result = verifyAndNormalizeResendOutreachWebhook({ ...input, verify });
  assert(JSON.stringify(verifyInput) === JSON.stringify({ payload: input.payload, headers: { id: headers.svixId, timestamp: headers.svixTimestamp, signature: headers.svixSignature }, webhookSecret: input.webhookSecret }), "Raw body, Svix headers, and webhook secret must be forwarded unchanged.");
  assert(result.disposition === "normalized" && result.provider === "resend" && result.providerEventId === headers.svixId && result.providerMessageId === "resend-email" && result.occurredAt === "2026-08-11T10:00:00.000Z", "Delivered event must normalize from authenticated data.");

  for (const type of ["email.delivery_delayed", "email.complained"]) {
    result = verifyAndNormalizeResendOutreachWebhook({ ...input, verify: () => verified(type) });
    assert(result.disposition === "normalized" && result.eventType === type && !("bounceType" in result), `${type} must normalize without bounce classification.`);
  }
  for (const [providerType, bounceType] of [["Permanent", "permanent"], ["Transient", "transient"], ["Temporary", "transient"], ["Undetermined", "undetermined"], ["FutureClassification", "unknown"]] as const) {
    result = verifyAndNormalizeResendOutreachWebhook({ ...input, verify: () => verified("email.bounced", "resend-email", "2026-08-11T10:00:00.000Z", providerType) });
    assert(result.disposition === "normalized" && result.eventType === "email.bounced" && result.bounceType === bounceType, `${providerType} must map to ${bounceType}.`);
    assert(!("subType" in result) && !("message" in result) && !("diagnosticCode" in result), "Bounce diagnostics must not be propagated.");
  }
  result = verifyAndNormalizeResendOutreachWebhook({ ...input, verify: () => verified("email.bounced") });
  assert(result.disposition === "normalized" && result.eventType === "email.bounced" && result.bounceType === "unknown", "Malformed bounce details must classify as unknown.");
  for (const type of ["email.sent", "email.opened", "email.clicked", "email.received"]) {
    result = verifyAndNormalizeResendOutreachWebhook({ ...input, verify: () => verified(type) });
    assert(result.disposition === "ignored" && result.eventType === type, `${type} must be ignored.`);
  }

  expectError(() => verifyAndNormalizeResendOutreachWebhook({ ...input, headers: { ...headers, svixId: "" }, verify }), "RESEND_WEBHOOK_HEADERS_MISSING");
  expectError(() => verifyAndNormalizeResendOutreachWebhook({ ...input, webhookSecret: "", verify }), "RESEND_WEBHOOK_SECRET_MISSING");
  expectError(() => verifyAndNormalizeResendOutreachWebhook({ ...input, verify: () => { throw new Error("invalid"); } }), "RESEND_WEBHOOK_SIGNATURE_INVALID");
  expectError(() => verifyAndNormalizeResendOutreachWebhook({ ...input, verify: () => verified("email.delivered", "", "invalid") }), "RESEND_WEBHOOK_EVENT_INVALID");
  console.log("PASS — Resend webhook adapter smoke");
}

main();

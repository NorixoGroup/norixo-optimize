import {
  createOutreachEmailProvider,
  type OutreachEmailProviderDependencies,
} from "../lib/backlinks/providers/outreachEmailProvider";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const input = {
  to: "contact@example.com",
  subject: "Subject",
  body: "Plain text body",
  idempotencyKey: "attempt:001",
};

function dependencies(
  send: OutreachEmailProviderDependencies["send"],
): OutreachEmailProviderDependencies {
  return {
    apiKey: "resend-key",
    from: "Norixo Outreach <outreach@example.com>",
    replyTo: "replies@example.com",
    send,
  };
}

async function main() {
  let calls = 0;
  let payload: unknown = null;
  let options: unknown = null;
  const accepted = createOutreachEmailProvider(
    dependencies(async (nextPayload, nextOptions) => {
      calls += 1;
      payload = nextPayload;
      options = nextOptions;
      return { data: { id: "resend-message" }, error: null };
    }),
  );
  let result = await accepted(input);
  assert(result.status === "accepted" && result.providerMessageId === "resend-message", "Accepted provider message id must propagate.");
  assert(JSON.stringify(payload) === JSON.stringify({ from: "Norixo Outreach <outreach@example.com>", replyTo: "replies@example.com", to: input.to, subject: input.subject, text: input.body }), "Explicit sender identity and plain-text message must be sent.");
  assert(JSON.stringify(options) === JSON.stringify({ idempotencyKey: input.idempotencyKey }), "Resend idempotency key must be forwarded.");

  const noApiKey = createOutreachEmailProvider({ ...dependencies(async () => { calls += 1; return { data: { id: "unexpected" }, error: null }; }), apiKey: undefined });
  result = await noApiKey(input);
  assert(result.status === "failed" && result.errorCode === "OUTREACH_EMAIL_CONFIGURATION_MISSING" && calls === 1, "Missing API key must fail before the provider.");
  const noFrom = createOutreachEmailProvider({ ...dependencies(async () => { calls += 1; return { data: { id: "unexpected" }, error: null }; }), from: undefined });
  result = await noFrom(input);
  assert(result.errorCode === "OUTREACH_EMAIL_CONFIGURATION_MISSING" && calls === 1, "Missing from identity must fail before the provider.");
  const noReplyTo = createOutreachEmailProvider({ ...dependencies(async () => { calls += 1; return { data: { id: "unexpected" }, error: null }; }), replyTo: undefined });
  result = await noReplyTo(input);
  assert(result.errorCode === "OUTREACH_EMAIL_CONFIGURATION_MISSING" && calls === 1, "Missing reply-to identity must fail before the provider.");

  const rejected = createOutreachEmailProvider(dependencies(async () => ({ data: null, error: { name: "validation_error", statusCode: 422, message: "recipient" } })));
  result = await rejected(input);
  assert(result.status === "failed" && result.errorCode === "OUTREACH_EMAIL_PROVIDER_REJECTED", "Provider 4xx must be failed.");
  const rateLimited = createOutreachEmailProvider(dependencies(async () => ({ data: null, error: { name: "rate_limit_exceeded", statusCode: 429, message: "rate" } })));
  result = await rateLimited(input);
  assert(result.status === "failed" && result.errorCode === "OUTREACH_EMAIL_RATE_LIMITED", "Rate limit must be classified as failed.");
  const unavailable = createOutreachEmailProvider(dependencies(async () => ({ data: null, error: { name: "internal_server_error", statusCode: 500, message: "server" } })));
  result = await unavailable(input);
  assert(result.status === "unknown" && result.errorCode === "OUTREACH_EMAIL_PROVIDER_AMBIGUOUS", "Provider 5xx must be classified as unknown.");
  const timeout = createOutreachEmailProvider(dependencies(async () => { throw new Error("timeout"); }));
  result = await timeout(input);
  assert(result.status === "unknown" && result.errorCode === "OUTREACH_EMAIL_PROVIDER_UNREACHABLE", "Timeout must be unknown.");
  const missingMessageId = createOutreachEmailProvider(dependencies(async () => ({ data: null, error: null })));
  result = await missingMessageId(input);
  assert(result.status === "unknown" && result.errorCode === "OUTREACH_EMAIL_PROVIDER_MESSAGE_ID_MISSING", "Missing message id must remain ambiguous.");
  assert(calls === 1, "Only the accepted fixture should have been called before configuration rejections.");
  console.log("PASS — Backlink outreach email provider smoke");
}

void main();

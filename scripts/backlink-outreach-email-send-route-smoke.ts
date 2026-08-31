import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function count(source: string, value: string) { return source.split(value).length - 1; }
function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert(from >= 0 && to >= 0, `Could not isolate ${start}`);
  return source.slice(from, to);
}
function mustReject(name: string, mutate: (input: { route: string; repository: string }) => { route: string; repository: string }, source: { route: string; repository: string }) {
  try { validate(mutate(source)); } catch { return; }
  throw new Error(`Mutation was not rejected: ${name}`);
}

function validate({ route, repository }: { route: string; repository: string }) {
  for (const value of ["export async function POST", "getRequestUserAndWorkspace(request)", "sendApprovedBacklinkOutreachEmail", "reserveBacklinkOutreachApprovedInitialAttempt(adminClient", '"Outreach email send unavailable."', "status: 409"]) assert(route.includes(value), `Missing route ${value}`);
  for (const value of ["reserve_backlink_outreach_initial_attempt_for_approved_auto_send", "p_workspace_id", "p_campaign_id", "p_outreach_id", "p_attempt_id", "p_actor_user_id", "p_idempotency_key", "p_reply_token_hash", "p_reply_token_key_version", "p_requested_at", "[backlinks-approved-initial-reservation-error]"]) assert(repository.includes(value), `Missing repository ${value}`);

  const innerLog = between(repository, 'console.error("[backlinks-approved-initial-reservation-error]"', "throw normalizeBacklinkRepositoryError");
  for (const value of ["workspaceId", "campaignId", "outreachId", "errorCode", "errorMessage", "errorDetails", "errorHint"]) assert(innerLog.includes(value), `Missing inner ${value}`);
  for (const forbidden of ["recipient", "subject", "body", "target", "replyToken", "reply_token", "idempotency", "provider", "headers", "cookies", "cause", "JSON.stringify", "error: error", "diagnostic:"]) assert(!innerLog.includes(forbidden), `Forbidden inner ${forbidden}`);

  const catchBody = between(route, "  } catch (error) {", "  }\n}");
  const genericReturn = 'return NextResponse.json({ error: "Outreach email send unavailable." }, { status: 409 });';
  const genericIndex = catchBody.indexOf(genericReturn);
  const outerPrefix = 'console.error("[backlinks-explicit-send-error]"';
  const outerIndex = catchBody.indexOf(outerPrefix);
  const handledIndex = catchBody.lastIndexOf("OUTREACH_SEND_ATTEMPT_UNRESOLVED");
  assert(count(route, outerPrefix) === 1, "Outer log must occur exactly once.");
  assert(outerIndex > handledIndex && outerIndex < genericIndex, "Outer log must be only in the generic 409 branch.");
  const outerLog = catchBody.slice(outerIndex, genericIndex);
  for (const value of ["workspaceId", "outreachId", "errorName", "errorMessage", "errorCode", "safeError"]) assert(outerLog.includes(value), `Missing outer ${value}`);
  for (const forbidden of ["recipient", "subject", "body", "target", "replyToken", "reply_token", "idempotency", "provider", "headers", "cookies", "cause", "JSON.stringify", "error: error", "diagnostic:"]) assert(!outerLog.includes(forbidden), `Forbidden outer ${forbidden}`);

  const extractor = between(route, "function extractSafeError(error: unknown)", "function parse(");
  for (const value of ["try", "catch", "Object.getOwnPropertyDescriptor", "errorName", "errorMessage", "errorCode"]) assert(extractor.includes(value), `Missing extractor ${value}`);
  for (const forbidden of ["JSON.stringify", ".cause", "console.", "details", "hint", "recipient", "subject", "body", "token"]) assert(!extractor.includes(forbidden), `Forbidden extractor ${forbidden}`);
  for (const forbidden of ["sendBacklinkOutreachEmail({", "sendEmail({", "body.subject", "body.recipient", "body.provider", "body.channel", "body.status", "body.workspaceId", "body.actorUserId", "stack", "sql"]) assert(!route.includes(forbidden), `Forbidden route ${forbidden}`);
}

async function main() {
  const source = {
    route: await readFile("app/api/backlinks/outreach/[id]/send/route.ts", "utf8"),
    repository: await readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8"),
  };
  validate(source);
  mustReject("inner prefix", ({ route, repository }) => ({ route, repository: repository.replace("[backlinks-approved-initial-reservation-error]", "[removed]") }), source);
  mustReject("outer prefix", ({ route, repository }) => ({ route: route.replace("[backlinks-explicit-send-error]", "[removed]"), repository }), source);
  mustReject("HTTP 409", ({ route, repository }) => ({ route: route.replace('return NextResponse.json({ error: "Outreach email send unavailable." }, { status: 409 });', 'return NextResponse.json({ error: "Outreach email send unavailable." }, { status: 500 });'), repository }), source);
  mustReject("browser message", ({ route, repository }) => ({ route: route.replace('return NextResponse.json({ error: "Outreach email send unavailable." }, { status: 409 });', 'return NextResponse.json({ error: "changed" }, { status: 409 });'), repository }), source);
  mustReject("recipient inner", ({ route, repository }) => ({ route, repository: repository.replace('errorCode: diagnosticString("code"),', 'recipient: "unsafe",\n      errorCode: diagnosticString("code"),') }), source);
  mustReject("subject outer", ({ route, repository }) => ({ route: route.replace("errorName: safeError.errorName,", 'subject: "unsafe",\n      errorName: safeError.errorName,'), repository }), source);
  mustReject("RPC name", ({ route, repository }) => ({ route, repository: repository.replaceAll("reserve_backlink_outreach_initial_attempt_for_approved_auto_send", "changed") }), source);
  mustReject("RPC arg", ({ route, repository }) => ({ route, repository: repository.replaceAll("p_outreach_id", "p_changed_outreach_id") }), source);
  mustReject("send service", ({ route, repository }) => ({ route: route.replaceAll("sendApprovedBacklinkOutreachEmail", "changedSend"), repository }), source);
  mustReject("provider call", ({ route, repository }) => ({ route: route.replace(outerPrefix, `${outerPrefix}\n    sendEmail({});`), repository }), source);
  mustReject("reply token", ({ route, repository }) => ({ route, repository: repository.replace('errorCode: diagnosticString("code"),', 'reply_token_hash: "unsafe",\n      errorCode: diagnosticString("code"),') }), source);
  mustReject("full error", ({ route, repository }) => ({ route: route.replace("errorName: safeError.errorName,", "error: error,\n      errorName: safeError.errorName,"), repository }), source);
  mustReject("outer before handled", ({ route, repository }) => ({ route: route.replace(outerPrefix, `${outerPrefix}\n    `).replace("const safeError = extractSafeError(error);", `${outerPrefix};\n    const safeError = extractSafeError(error);`), repository }), source);
  mustReject("outer duplicated", ({ route, repository }) => ({ route: route.replace("if (error instanceof BacklinkOutreachEmailSendError", `${outerPrefix};\n    if (error instanceof BacklinkOutreachEmailSendError`), repository }), source);
  mustReject("JSON stringify", ({ route, repository }) => ({ route: route.replace("let errorName", "JSON.stringify(error);\n  let errorName"), repository }), source);
  mustReject("cause traversal", ({ route, repository }) => ({ route: route.replace("let errorName", "error.cause;\n  let errorName"), repository }), source);
  console.log("PASS — Backlink outreach email send route smoke");
}

const outerPrefix = 'console.error("[backlinks-explicit-send-error]"';
void main();

import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function count(source: string, value: string) {
  return source.split(value).length - 1;
}

function uniqueIndex(source: string, value: string) {
  assert(count(source, value) === 1, `Expected one ${value}`);
  return source.indexOf(value);
}

const catchAnchor = "} catch (error) {";
const outerLogPrefix = "[backlinks-ready-approval-error]";
const rpcLogPrefix = "[backlinks-first-approval-rpc-error]";
const response = 'return NextResponse.json({ error: "Ready approval unavailable." }, { status: 409 });';
const genericThrow = 'throw new Error("Atomic first approval unavailable.");';
const rpcName = "approve_backlink_outreach_initial_send";
const rpcArguments = ["p_workspace_id", "p_outreach_id", "p_approved_by"];
const expectedOuterLogKeys = ["outreachId", "workspaceId", "userId", "errorName", "errorMessage", "errorCode", "errorDetails", "errorHint"];
const expectedRpcLogKeys = ["workspaceId", "outreachId", "errorCode", "errorMessage", "errorDetails", "errorHint"];
const forbiddenLogTokens = ["authorization", "cookie", "cookies", "headers", "supabase_service_role_key", "service_role", "recipient", "email", "subject", "body", "request", "adminclient", "stack"];

function extractLogFragment(source: string, prefixIndex: number, indent: string) {
  const start = source.lastIndexOf("console.error(", prefixIndex);
  const endMarker = `\n${indent}});`;
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start, "Diagnostic log fragment missing.");
  return { start, end: end + endMarker.length, fragment: source.slice(start, end + endMarker.length) };
}

function assertLogKeys(fragment: string, indent: string, expected: readonly string[]) {
  const logKeys = [...fragment.matchAll(new RegExp(`^${indent}([A-Za-z]+)(?::|,)`, "gm"))].map((match) => match[1]);
  assert(JSON.stringify(logKeys) === JSON.stringify(expected), "Diagnostic log keys changed.");
  for (const forbidden of forbiddenLogTokens) assert(!fragment.toLocaleLowerCase().includes(forbidden), `Sensitive log token ${forbidden}`);
}

function validate(source: string) {
  const catchStart = uniqueIndex(source, catchAnchor);
  const outerPrefixIndex = uniqueIndex(source, outerLogPrefix);
  const responseStart = uniqueIndex(source, response);
  const outerLog = extractLogFragment(source, outerPrefixIndex, "    ");
  assert(outerLog.start > catchStart && outerLog.end < responseStart && responseStart > catchStart, "Outer diagnostic log and generic response must be inside the catch in order.");
  assertLogKeys(outerLog.fragment, "      ", expectedOuterLogKeys);
  const responseFragment = source.slice(responseStart, responseStart + response.length);
  for (const forbidden of ["errorMessage", "errorDetails", "errorHint", "errorCode"]) assert(!responseFragment.includes(forbidden), `Internal error leaked through response: ${forbidden}`);

  const rpcStart = source.indexOf("adminClient.rpc(");
  const rpcEnd = source.indexOf("\n        });", rpcStart);
  const rpcPrefixIndex = uniqueIndex(source, rpcLogPrefix);
  const rpcErrorConditionStart = uniqueIndex(source, "if (error != null) {");
  const rpcLog = extractLogFragment(source, rpcPrefixIndex, "          ");
  const validationStart = source.indexOf("if (error != null ||", rpcLog.end);
  const throwIndex = uniqueIndex(source, genericThrow);
  assert(rpcStart >= 0 && rpcEnd > rpcStart && rpcErrorConditionStart > rpcEnd && rpcLog.start > rpcErrorConditionStart && rpcLog.end < validationStart && validationStart < throwIndex, "RPC diagnostic must be conditional on a Supabase error and precede unchanged validation.");
  assertLogKeys(rpcLog.fragment, "            ", expectedRpcLogKeys);

  uniqueIndex(source, `"${rpcName}"`);
  const rpcFragment = source.slice(rpcStart, rpcEnd);
  for (const argument of rpcArguments) assert(count(rpcFragment, argument) === 1, `RPC argument ${argument} changed.`);
  for (const forbidden of ["sendBacklinkOutreachEmail", "sendApprovedBacklinkOutreachEmail", "reserveBacklinkOutreachAttempt", "reserveBacklinkOutreachApprovedInitialAttempt", "Resend"]) assert(!source.includes(forbidden), `Forbidden send or reservation path: ${forbidden}`);
}

function assertRejected(name: string, source: string) {
  try {
    validate(source);
  } catch {
    return;
  }
  throw new Error(`Synthetic regression was accepted: ${name}`);
}

async function main() {
  const source = await readFile("app/api/backlinks/outreach/[id]/ready/route.ts", "utf8");
  validate(source);
  assertRejected("outer prefix removed", source.replace(outerLogPrefix, "[removed]"));
  assertRejected("status changed", source.replace("{ status: 409 }", "{ status: 500 }"));
  assertRejected("client error leak", source.replace(response, "return NextResponse.json({ error: errorMessage }, { status: 409 });"));
  assertRejected("outer subject logged", source.replace("      outreachId: id,", "      subject: \"unsafe\",\n      outreachId: id,"));
  assertRejected("RPC name changed", source.replace(rpcName, "approve_backlink_outreach_initial_send_changed"));
  assertRejected("outreach RPC argument removed", source.replace("p_outreach_id: outreachId", "outreach_id: outreachId"));
  assertRejected("send path added", `${source}\nsendApprovedBacklinkOutreachEmail`);
  assertRejected("RPC prefix removed", source.replace(rpcLogPrefix, "[removed]"));
  assertRejected("RPC subject logged", source.replace("            workspaceId,", "            subject: \"unsafe\",\n            workspaceId,"));
  assertRejected("RPC condition weakened", source.replace("if (error != null) {", "if (true) {"));
  assertRejected("second client error leak", source.replace(response, "return NextResponse.json({ error: errorMessage }, { status: 409 });"));
  assertRejected("generic throw removed", source.replace(genericThrow, 'throw new Error("Removed");'));
  assertRejected("approved-by RPC argument removed", source.replace("p_approved_by: actorUserId", "approved_by: actorUserId"));
  console.log("PASS — Backlink outreach ready route smoke");
}

void main();

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
const logPrefix = "[backlinks-ready-approval-error]";
const response = 'return NextResponse.json({ error: "Ready approval unavailable." }, { status: 409 });';
const rpcName = "approve_backlink_outreach_initial_send";
const rpcArguments = ["p_workspace_id", "p_outreach_id", "p_approved_by"];
const expectedLogKeys = ["outreachId", "workspaceId", "userId", "errorName", "errorMessage", "errorCode", "errorDetails", "errorHint"];

function validate(source: string) {
  const catchStart = uniqueIndex(source, catchAnchor);
  const prefixIndex = uniqueIndex(source, logPrefix);
  const responseStart = uniqueIndex(source, response);
  const logStart = source.lastIndexOf("console.error(", prefixIndex);
  const logEnd = source.indexOf("\n    });", logStart);
  const responseEnd = responseStart + response.length;
  assert(logStart > catchStart && logEnd > logStart && logEnd < responseStart, "Diagnostic log must be inside the catch before the 409 response.");
  assert(responseStart > catchStart, "Generic response must be inside the named catch.");

  const logFragment = source.slice(logStart, logEnd + "\n    });".length);
  const responseFragment = source.slice(responseStart, responseEnd);
  const logKeys = [...logFragment.matchAll(/^      ([A-Za-z]+):/gm)].map((match) => match[1]);
  assert(JSON.stringify(logKeys) === JSON.stringify(expectedLogKeys), "Diagnostic log keys changed.");
  for (const forbidden of ["authorization", "cookie", "cookies", "headers", "supabase_service_role_key", "service_role", "recipient", "email", "subject", "body", "request", "adminclient"]) {
    assert(!logFragment.toLocaleLowerCase().includes(forbidden), `Sensitive log token ${forbidden}`);
  }
  for (const forbidden of ["errorMessage", "errorDetails", "errorHint", "errorCode"]) {
    assert(!responseFragment.includes(forbidden), `Internal error leaked through response: ${forbidden}`);
  }

  uniqueIndex(source, `"${rpcName}"`);
  const rpcStart = source.indexOf("adminClient.rpc(");
  const rpcEnd = source.indexOf("\n        });", rpcStart);
  assert(rpcStart >= 0 && rpcEnd > rpcStart, "RPC call fragment missing.");
  const rpcFragment = source.slice(rpcStart, rpcEnd);
  for (const argument of rpcArguments) assert(count(rpcFragment, argument) === 1, `RPC argument ${argument} changed.`);
  for (const forbidden of ["sendBacklinkOutreachEmail", "sendApprovedBacklinkOutreachEmail", "reserveBacklinkOutreachAttempt", "reserveBacklinkOutreachApprovedInitialAttempt", "Resend"]) {
    assert(!source.includes(forbidden), `Forbidden send or reservation path: ${forbidden}`);
  }
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
  assertRejected("prefix removed", source.replace(logPrefix, "[removed]"));
  assertRejected("status changed", source.replace("{ status: 409 }", "{ status: 500 }"));
  assertRejected("client error leak", source.replace(response, "return NextResponse.json({ error: errorMessage }, { status: 409 });"));
  assertRejected("subject logged", source.replace("      outreachId: id,", "      subject: \"unsafe\",\n      outreachId: id,"));
  assertRejected("RPC name changed", source.replace(rpcName, "approve_backlink_outreach_initial_send_changed"));
  assertRejected("outreach RPC argument removed", source.replace("p_outreach_id: outreachId", "outreach_id: outreachId"));
  assertRejected("send path added", `${source}\nsendApprovedBacklinkOutreachEmail`);
  console.log("PASS — Backlink outreach ready route smoke");
}

void main();

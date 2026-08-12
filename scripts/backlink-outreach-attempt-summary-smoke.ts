import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const [repository, service, route] = await Promise.all([
    readFile("lib/backlinks/repositories/outreachAttemptsRepository.ts", "utf8"),
    readFile("lib/backlinks/services/outreachService.ts", "utf8"),
    readFile("app/api/backlinks/outreach/route.ts", "utf8"),
  ]);
  const start = repository.indexOf("export async function listBacklinkOutreachAttemptSummariesForOutreachIds");
  const summary = repository.slice(start, repository.indexOf("export async function getOpenBacklinkOutreachAttemptForOutreach", start));
  for (const value of [".eq(\"workspace_id\", workspaceId)", ".in(\"outreach_id\", outreachIds)", ".order(\"created_at\", { ascending: false })", "latestStatus", "hasOpenAttempt", 'attempt.status === "prepared"', 'attempt.status === "requested"', 'attempt.status === "unknown"']) assert(summary.includes(value), `Missing summary invariant: ${value}`);
  for (const forbidden of ["idempotency_key", "actor_user_id", "provider_message_id", "recipient", "error_code", "error_message", "channel"]) assert(!summary.includes(forbidden), `Sensitive Attempt field exposed: ${forbidden}`);
  for (const value of ["listBacklinkOutreachAttemptSummariesForOutreachIds", "attemptSummary: summaries.get(outreach.id) ?? { latestStatus: null, hasOpenAttempt: false }"]) assert(service.includes(value), `Missing list enrichment: ${value}`);
  assert(route.includes("listOutreach(context.client, context.workspace.id)"), "GET Outreach must remain read-only through listOutreach.");
  console.log("PASS — Backlink outreach attempt summary smoke");
}

void main();

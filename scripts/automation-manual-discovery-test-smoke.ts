import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";

import { BacklinkRepositoryError } from "../lib/backlinks/repositories/errors";
import { ManualDiscoveryTestError, runManualDiscoveryTest } from "../lib/automation/manual-discovery-test";
import { createManualDiscoveryTestHandler } from "../app/api/internal/automation/backlinks/discovery/tests/route";

const workspaceId = "00000000-0000-4000-8000-000000000101";
const userId = "00000000-0000-4000-8000-000000000102";
const testId = "00000000-0000-4000-8000-000000000103";
const runId = "00000000-0000-4000-8000-000000000104";
const taskId = "00000000-0000-4000-8000-000000000105";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const request = (body: unknown) => new NextRequest("http://local.test", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const task = { id: taskId, workspaceId, runId, taskKind: "backlinks.discovery.preview", status: "running", attemptCount: 1, maxAttempts: 1, workerId: "worker", leaseExpiresAt: "2026-10-17T12:02:00.000Z" } as never;

async function main() {
  let routeCalls = 0;
  const handler = createManualDiscoveryTestHandler({
    getContext: async () => ({ status: "ok" as const, user: { id: userId, email: "admin@example.test" }, workspace: { id: workspaceId } }),
    isAdmin: () => true,
    run: async (input) => { routeCalls += 1; assert(input.workspaceId === workspaceId && input.requestedBy === userId && input.testId === testId && input.query === "one query", "route must use only server workspace and one explicit query"); return { kind: "completed" as const, task, output: {} }; },
    now: () => new Date("2026-10-17T12:00:00.000Z"),
  });
  assert((await handler(request({ testId, query: "one query" }))).status === 200 && routeCalls === 1, "valid admin request must execute once");
  assert((await handler(request({ testId, query: "one query", workspaceId }))).status === 400, "client workspaceId must be rejected");
  assert((await createManualDiscoveryTestHandler({ ...{ getContext: async () => ({ status: "unauthenticated" as const }), isAdmin: () => true, run: async () => ({ kind: "completed" as const, task, output: {} }), now: () => new Date() } })(request({ testId, query: "one query" }))).status === 401, "unauthenticated request must be rejected");
  assert((await createManualDiscoveryTestHandler({ ...{ getContext: async () => ({ status: "ok" as const, user: { id: userId, email: "no@example.test" }, workspace: { id: workspaceId } }), isAdmin: () => false, run: async () => ({ kind: "completed" as const, task, output: {} }), now: () => new Date() } })(request({ testId, query: "one query" }))).status === 403, "non-admin request must be rejected");
  assert((await createManualDiscoveryTestHandler({ ...{ getContext: async () => ({ status: "ok" as const, user: { id: userId, email: "admin@example.test" }, workspace: { id: workspaceId } }), isAdmin: () => true, run: async () => { throw new ManualDiscoveryTestError("WORKSPACE_NOT_ELIGIBLE"); }, now: () => new Date() } })(request({ testId, query: "one query" }))).status === 409, "ineligible workspace must be rejected safely");

  let claims = 0, executions = 0, failures = 0;
  const result = await runManualDiscoveryTest({
    createAndClaim: async (input) => { claims += 1; assert(input.query === "one query" && input.testId === testId, "atomic claim input"); return task; },
    executeClaimed: async () => { executions += 1; return { kind: "completed", task, output: {} }; },
    failRun: async () => { failures += 1; return { kind: "transitioned", run: {} as never }; },
  }, { workspaceId, requestedBy: userId, testId, query: " one query ", workerId: "worker", now: "2026-10-17T12:00:00.000Z", leaseDurationSeconds: 120 });
  assert(result.kind === "completed" && claims === 1 && executions === 1 && failures === 0, "one atomic claim and one execution only");
  let conflict = false;
  try { await runManualDiscoveryTest({ createAndClaim: async () => { throw new BacklinkRepositoryError({ code: "CONFLICT", operation: "test", message: "safe" }); }, executeClaimed: async () => ({ kind: "completed", task, output: {} }), failRun: async () => ({ kind: "transitioned", run: {} as never }) }, { workspaceId, requestedBy: userId, testId, query: "one query", workerId: "worker", now: "2026-10-17T12:00:00.000Z", leaseDurationSeconds: 120 }); } catch (error) { conflict = error instanceof ManualDiscoveryTestError && error.code === "CONFLICT"; }
  assert(conflict, "duplicate testId must not execute a second time");

  const migration = await readFile("supabase/migrations/20261017120000_add_manual_discovery_test_claim.sql", "utf8");
  for (const token of ["test_id uuid primary key", "set search_path = pg_catalog, public", "workspace.owner_user_id = p_requested_by", "member.user_id = p_requested_by", "from public, anon, authenticated, service_role", "status,", "'running'", "'dry_run'", "'backlinks.discovery.preview'", "1,\n    1", "revoke all on function public.create_and_claim_manual_backlink_discovery_test", "to service_role"]) assert(migration.includes(token), `missing SQL guard: ${token}`);
  assert(!migration.includes("'queued'"), "manual test task must never be queued");
  const service = await readFile("lib/automation/manual-discovery-test.ts", "utf8");
  assert(!/scheduler|query-generator|openai/i.test(service), "manual test service must not call scheduler or OpenAI");
  console.log("PASS — Manual Discovery test smoke");
}
void main();

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { createBacklinkAutonomyTerminalRunResumeDependencies } from "@/lib/automation/repositories/backlinkAutonomyTerminalRunResumeRepository";
import { isBacklinkCampaignApplyAuthorized } from "@/lib/automation/repositories/backlinkCampaignApplyAuthorizationCheckRepository";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const CONTACT_ID = "44444444-4444-4444-8444-444444444444";
const OPERATOR_ID = "88888888-8888-4888-8888-888888888888";

type FakeResult = { data: unknown; error: unknown };
type TableCall = { table: string; op: "select" | "insert"; eqs: Record<string, unknown>; payload?: unknown; terminal: "single" | "maybeSingle" | "list" };

/**
 * A minimal, chainable double for the Supabase query-builder shapes the
 * wired repositories actually use (`.from().select().eq()...maybeSingle()`,
 * `.from().insert().select().single()`, `.from()...limit()` awaited
 * directly, and `.rpc()`). It never touches a network or a real client.
 */
function makeFakeSessionClient(handler: (call: TableCall) => FakeResult, rpcHandler: (name: string) => FakeResult = () => ({ data: null, error: null })) {
  const calls: TableCall[] = [];
  function from(table: string) {
    let op: "select" | "insert" = "select";
    let payload: unknown;
    const eqs: Record<string, unknown> = {};
    const record = (terminal: TableCall["terminal"]): TableCall => ({ table, op, eqs, payload, terminal });
    const chain = {
      select: () => chain,
      insert: (value: unknown) => { op = "insert"; payload = value; return chain; },
      eq: (key: string, value: unknown) => { eqs[key] = value; return chain; },
      order: () => chain,
      limit: () => { const call = record("list"); calls.push(call); return Promise.resolve(handler(call)); },
      maybeSingle: async () => { const call = record("maybeSingle"); calls.push(call); return handler(call); },
      single: async () => { const call = record("single"); calls.push(call); return handler(call); },
    };
    return chain;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { from, rpc: async (name: string) => rpcHandler(name) } as any, calls };
}

test("signatures: getRun queries automation_runs by workspace_id + id and returns the mapped row", async () => {
  const run = { id: RUN_ID, workspace_id: WORKSPACE_ID, system: "backlinks", run_kind: "backlinks.autonomy", idempotency_key: "k", status: "completed", mode: "dry_run", trigger_source: "internal", requested_by: null, scheduled_at: "2026-11-20T00:00:00.000Z", started_at: null, completed_at: "2026-11-20T00:05:00.000Z", failed_at: null, cancelled_at: null, heartbeat_at: null, lease_expires_at: null, worker_id: null, attempt_count: 1, max_attempts: 1, input: {}, summary: null, error_code: null, error_message: null, created_at: "2026-11-20T00:00:00.000Z", updated_at: "2026-11-20T00:05:00.000Z" };
  const { client, calls } = makeFakeSessionClient((call) => (call.table === "automation_runs" && call.terminal === "maybeSingle" ? { data: run, error: null } : { data: null, error: null }));
  const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
  const result = await deps.getRun({ workspaceId: WORKSPACE_ID, runId: RUN_ID });
  assert.equal(result?.id, RUN_ID);
  assert.equal(calls[0]!.table, "automation_runs");
  assert.deepEqual(calls[0]!.eqs, { workspace_id: WORKSPACE_ID, id: RUN_ID });
});

test("signatures: listTasks queries automation_tasks by workspace_id + run_id", async () => {
  const { client, calls } = makeFakeSessionClient(() => ({ data: [], error: null }));
  const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
  const result = await deps.listTasks({ workspaceId: WORKSPACE_ID, runId: RUN_ID });
  assert.deepEqual(result, []);
  assert.equal(calls[0]!.table, "automation_tasks");
  assert.deepEqual(calls[0]!.eqs, { workspace_id: WORKSPACE_ID, run_id: RUN_ID });
});

test("signatures: getContact queries backlink_contacts by workspace_id + id, and maps a missing row to null rather than throwing", async () => {
  const { client } = makeFakeSessionClient((call) => (call.table === "backlink_contacts" ? { data: null, error: null } : { data: null, error: null }));
  const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
  const result = await deps.getContact({ workspaceId: WORKSPACE_ID, contactId: CONTACT_ID });
  assert.equal(result, null);
});

test("signatures: getContact maps a found row to {id, workspaceId, contactStatus} only — no email/name/linkedin field is ever read", async () => {
  const row = { id: CONTACT_ID, workspace_id: WORKSPACE_ID, contact_status: "unverified", full_name: "should never leak", email_normalized: "should@never.leak" };
  const { client } = makeFakeSessionClient((call) => (call.table === "backlink_contacts" ? { data: row, error: null } : { data: null, error: null }));
  const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
  const result = await deps.getContact({ workspaceId: WORKSPACE_ID, contactId: CONTACT_ID });
  assert.deepEqual(result, { id: CONTACT_ID, workspaceId: WORKSPACE_ID, contactStatus: "unverified" });
});

test("idempotent writes: createOrGetRun falls back to the existing row on a unique-constraint conflict, never throwing or duplicating", async () => {
  const existing = { id: "run-existing", workspace_id: WORKSPACE_ID, system: "backlinks", run_kind: "backlinks.autonomy", idempotency_key: "k", status: "queued", mode: "dry_run", trigger_source: "manual", requested_by: OPERATOR_ID, scheduled_at: "2026-11-23T08:00:00.000Z", started_at: null, completed_at: null, failed_at: null, cancelled_at: null, heartbeat_at: null, lease_expires_at: null, worker_id: null, attempt_count: 0, max_attempts: 1, input: {}, summary: null, error_code: null, error_message: null, created_at: "2026-11-23T08:00:00.000Z", updated_at: "2026-11-23T08:00:00.000Z" };
  const { client, calls } = makeFakeSessionClient((call) => {
    if (call.table === "automation_runs" && call.terminal === "single") return { data: null, error: { code: "23505", message: "duplicate key" } };
    if (call.table === "automation_runs" && call.terminal === "maybeSingle") return { data: existing, error: null };
    return { data: null, error: null };
  });
  const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
  const result = await deps.createOrGetRun({ workspaceId: WORKSPACE_ID, system: "backlinks", runKind: "backlinks.autonomy", idempotencyKey: "k", mode: "dry_run", triggerSource: "manual", requestedBy: OPERATOR_ID, scheduledAt: "2026-11-23T08:00:00.000Z", input: {} });
  assert.equal(result.kind, "existing");
  assert.equal(result.run.id, "run-existing");
  assert.equal(calls.filter((call) => call.terminal === "single").length, 1, "exactly one insert attempt, never retried blindly");
});

test("access control: a non-private-admin is refused even when the workspace role would otherwise qualify", async () => {
  const { client } = makeFakeSessionClient(
    (call) => (call.table === "workspace_members" ? { data: { role: "owner" }, error: null } : { data: null, error: null }),
    () => ({ data: false, error: null }),
  );
  const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
  const result = await deps.isAuthorizedOperator({ workspaceId: WORKSPACE_ID, requestedBy: OPERATOR_ID });
  assert.equal(result, false);
});

test("access control: a private admin who is only a plain workspace member is refused — both halves are mandatory", async () => {
  const { client } = makeFakeSessionClient(
    (call) => (call.table === "workspace_members" ? { data: { role: "member" }, error: null } : { data: null, error: null }),
    () => ({ data: true, error: null }),
  );
  const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
  const result = await deps.isAuthorizedOperator({ workspaceId: WORKSPACE_ID, requestedBy: OPERATOR_ID });
  assert.equal(result, false);
});

test("access control: a private admin and workspace owner/admin together are authorized", async () => {
  for (const role of ["owner", "admin"]) {
    const { client } = makeFakeSessionClient(
      (call) => (call.table === "workspace_members" ? { data: { role }, error: null } : { data: null, error: null }),
      () => ({ data: true, error: null }),
    );
    const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
    assert.equal(await deps.isAuthorizedOperator({ workspaceId: WORKSPACE_ID, requestedBy: OPERATOR_ID }), true, `role ${role} must authorize`);
  }
});

test("fail-closed: a failing is_norixo_private_admin RPC call refuses access instead of throwing or defaulting to true", async () => {
  const { client } = makeFakeSessionClient(
    () => ({ data: null, error: null }),
    () => ({ data: null, error: { message: "rpc unavailable" } }),
  );
  const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
  const result = await deps.isAuthorizedOperator({ workspaceId: WORKSPACE_ID, requestedBy: OPERATOR_ID });
  assert.equal(result, false);
});

test("fail-closed: a failing workspace_members lookup refuses access instead of throwing", async () => {
  const { client } = makeFakeSessionClient(
    (call) => (call.table === "workspace_members" ? { data: null, error: { message: "db error" } } : { data: null, error: null }),
    () => ({ data: true, error: null }),
  );
  const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
  const result = await deps.isAuthorizedOperator({ workspaceId: WORKSPACE_ID, requestedBy: OPERATOR_ID });
  assert.equal(result, false);
});

test("fail-closed: the privileged campaign-apply RPC check never throws on its own failure (exercised directly, as getControl relies on this exact contract)", async () => {
  const { client } = makeFakeSessionClient(() => ({ data: null, error: { message: "service_role rpc failure" } }));
  const result = await isBacklinkCampaignApplyAuthorized(client, WORKSPACE_ID);
  assert.equal(result, false);
});

test("fail-closed without any privileged client: getControl never needs SUPABASE_SERVICE_ROLE_KEY when the campaign-apply feature flag is off (the default)", async () => {
  delete process.env.BACKLINK_CAMPAIGN_APPLY_AUTHORIZATION_ENABLED;
  const { client } = makeFakeSessionClient((call) => (call.table === "automation_workspace_controls" ? { data: { workspace_id: WORKSPACE_ID, backlinks_enabled: true, backlink_autonomy_enabled: true, backlink_outreach_schedule_apply_enabled: false, dry_run_only: true, disabled_reason: null }, error: null } : { data: null, error: null }));
  const deps = createBacklinkAutonomyTerminalRunResumeDependencies(client, WORKSPACE_ID);
  const control = await deps.getControl();
  assert.equal(control.campaignApplyAuthorized, false);
});

test("privilege separation (static): createSupabaseAdminClient is referenced exactly once in the repository's actual code, and only inside the campaign-apply-authorization check — never near the run/task write paths", async () => {
  const raw = await readFile("lib/automation/repositories/backlinkAutonomyTerminalRunResumeRepository.ts", "utf8");
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const occurrences = source.split("createSupabaseAdminClient").length - 1;
  assert.equal(occurrences, 2, "exactly the destructure and the call, both inside checkCampaignApplyAuthorizedViaServiceRole");
  const fnStart = source.indexOf("async function checkCampaignApplyAuthorizedViaServiceRole");
  const fnEnd = source.indexOf("\n}\n", fnStart);
  assert.ok(fnStart !== -1 && fnEnd !== -1, "checkCampaignApplyAuthorizedViaServiceRole must exist as its own function");
  let searchFrom = 0;
  for (let i = 0; i < occurrences; i += 1) {
    const index = source.indexOf("createSupabaseAdminClient", searchFrom);
    assert.ok(index > fnStart && index < fnEnd, "every reference to the privileged client must be contained inside checkCampaignApplyAuthorizedViaServiceRole");
    searchFrom = index + 1;
  }
  const writePathsSection = source.slice(source.indexOf("createOrGetRun: (input)"), source.indexOf("createOrGetTask: (input)") + 80);
  assert.ok(!writePathsSection.includes("createSupabaseAdminClient") && !writePathsSection.includes("Admin"), "createOrGetRun/createOrGetTask wiring never touches the privileged client");
});

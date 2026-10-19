import { readFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
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
const execFile = promisify(execFileCallback);
const request = (body: unknown) => new NextRequest("http://local.test", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const task = { id: taskId, workspaceId, runId, taskKind: "backlinks.discovery.preview", status: "running", attemptCount: 1, maxAttempts: 1, workerId: "worker", leaseExpiresAt: "2026-10-17T12:02:00.000Z" } as never;

const rpcSignature = "public.create_and_claim_manual_backlink_discovery_test(uuid,uuid,text,text,timestamptz,integer,uuid)";
const dynamicAclAssertion = (runner: string) => `
with rpc as (
  select p.oid, p.proowner, p.prosecdef, p.proacl
  from pg_proc p
  where p.oid = '${rpcSignature}'::regprocedure
), memberships as (
  select membership.admin_option, membership.inherit_option, membership.set_option,
    pg_get_userbyid(membership.member) as member_name,
    pg_get_userbyid(membership.grantor) as grantor_name
  from pg_auth_members membership
  where membership.roleid = 'norixo_manual_discovery_owner'::regrole
), checks as (
  select
    rpc.prosecdef
      and pg_get_userbyid(rpc.proowner) = 'norixo_manual_discovery_owner'
      and has_function_privilege('service_role', rpc.oid, 'EXECUTE')
      and not has_function_privilege('anon', rpc.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', rpc.oid, 'EXECUTE')
      and not has_function_privilege('public', rpc.oid, 'EXECUTE')
      and not exists (
        select 1
        from aclexplode(coalesce(rpc.proacl, acldefault('f', rpc.proowner))) acl
        where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
      )
      and (select count(*) from pg_policy policy where policy.polname like 'manual_discovery_owner_%') = 9
      and (select count(*) from memberships) = 1
      and exists (
        select 1
        from memberships
        where member_name = '${runner}'
          and grantor_name <> '${runner}'
          and admin_option
          and not inherit_option
          and not set_option
      ) as valid
  from rpc
)
select 1 / case when coalesce((select valid from checks), false) then 1 else 0 end;`;

async function runDynamicAclCheck() {
  const enabled = process.env.MANUAL_DISCOVERY_ACL_DYNAMIC === "1";
  if (!enabled) {
    console.log("SKIP — Dynamic PostgreSQL ACL validation (set MANUAL_DISCOVERY_ACL_DYNAMIC=1 with a local harness database)");
    return false;
  }

  const host = process.env.MANUAL_DISCOVERY_ACL_PGHOST;
  const port = process.env.MANUAL_DISCOVERY_ACL_PGPORT;
  const user = process.env.MANUAL_DISCOVERY_ACL_PGUSER;
  const database = process.env.MANUAL_DISCOVERY_ACL_PGDATABASE;
  const runner = process.env.MANUAL_DISCOVERY_ACL_RUNNER;
  assert(host === "127.0.0.1" || host === "localhost" || host === "::1", "dynamic ACL validation requires a loopback PostgreSQL host");
  assert(/^[1-9][0-9]{0,4}$/.test(port ?? ""), "dynamic ACL validation requires an explicit PostgreSQL port");
  assert(user && /^[a-z_][a-z0-9_]*$/i.test(user), "dynamic ACL validation requires an explicit PostgreSQL user");
  assert(database && /^norixo_[a-z0-9_]+$/i.test(database), "dynamic ACL validation requires a dedicated norixo_ test database");
  assert(runner && /^[a-z_][a-z0-9_]*$/i.test(runner), "dynamic ACL validation requires the non-superuser migration runner");
  const connection = { host: host!, port: port!, user: user!, database: database! };
  const psqlPath = process.env.MANUAL_DISCOVERY_ACL_PSQL || "psql";

  const psql = async (sql: string) => execFile(psqlPath, ["-X", "-v", "ON_ERROR_STOP=1", "-h", connection.host, "-p", connection.port, "-U", connection.user, "-d", connection.database, "-c", sql]);
  const assertion = dynamicAclAssertion(runner);
  await psql(assertion);

  let negativeFailed = false;
  try {
    await psql(`grant execute on function ${rpcSignature} to public;`);
    await psql(assertion);
  } catch {
    negativeFailed = true;
  } finally {
    await psql(`revoke execute on function ${rpcSignature} from public;`);
  }
  assert(negativeFailed, "dynamic ACL validation must fail when PUBLIC has EXECUTE");
  await psql(assertion);
  console.log("PASS — Dynamic PostgreSQL ACL validation (positive and PUBLIC-negative scenarios)");
  return true;
}

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
  for (const token of ["test_id uuid primary key", "set search_path = pg_catalog, public", "workspace.owner_user_id = p_requested_by", "member.user_id = p_requested_by", "from public, anon, authenticated, service_role", "status,", "'running'", "'dry_run'", "'backlinks.discovery.preview'", "1,\n    1", "with admin false, inherit false, set true", "granted by current_user", "set role norixo_manual_discovery_owner", "reset role", "revoke all on function public.create_and_claim_manual_backlink_discovery_test", "to service_role"]) assert(migration.includes(token), `missing SQL guard: ${token}`);
  const ownershipTransfer = migration.indexOf("alter function public.create_and_claim_manual_backlink_discovery_test");
  const ownerAclRevoke = migration.indexOf("revoke all on function public.create_and_claim_manual_backlink_discovery_test", ownershipTransfer);
  const ownerReset = migration.indexOf("reset role", ownershipTransfer);
  const membershipRevoke = migration.indexOf("revoke norixo_manual_discovery_owner from current_user granted by current_user", ownershipTransfer);
  assert(ownershipTransfer >= 0 && ownershipTransfer < ownerAclRevoke && ownerAclRevoke < ownerReset && ownerReset < membershipRevoke, "function ACL must be revoked by the temporary owner before its membership is removed");
  assert(!migration.includes("'queued'"), "manual test task must never be queued");
  const service = await readFile("lib/automation/manual-discovery-test.ts", "utf8");
  assert(!/scheduler|query-generator|openai/i.test(service), "manual test service must not call scheduler or OpenAI");
  if (await runDynamicAclCheck()) console.log("PASS — Manual Discovery test smoke");
  else console.log("SKIP — Manual Discovery smoke dynamic ACL validation was not executed");
}
void main();

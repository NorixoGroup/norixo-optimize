import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const route = await readFile(
    "app/api/internal/cron/backlinks/reverification/route.ts",
    "utf8",
  );
  const vercel = JSON.parse(await readFile("vercel.json", "utf8")) as {
    crons?: Array<{ path?: string; schedule?: string }>;
  };
  const automation = await readFile(
    "lib/backlinks/verification/reverification-automation.ts",
    "utf8",
  );
  const runtime = await readFile(
    "lib/backlinks/verification/runtime.ts",
    "utf8",
  );
  const composition = await readFile(
    "lib/backlinks/verification/production-composition.ts",
    "utf8",
  );
  const outreachCron = await readFile(
    "app/api/internal/cron/backlinks/outreach/schedule/route.ts",
    "utf8",
  );

  for (const required of [
    "export async function GET(request: NextRequest)",
    "const CRON_SECRET = process.env.CRON_SECRET ?? \"\"",
    "CRON_SECRET.length === 0 || authorization !== `Bearer ${CRON_SECRET}`",
    "return unauthorizedResponse()",
    "runBacklinkReverificationAutomation",
    "readBacklinkReverificationRuntimeConfig",
    "const CRON_WORKSPACE_LIMIT = 1",
    "const CRON_CANDIDATE_LIMIT_PER_WORKSPACE = 5",
    "const CRON_SCHEDULER_MAX_ITERATIONS = 1",
    "workspaceLimit: CRON_WORKSPACE_LIMIT",
    "candidateLimitPerWorkspace: CRON_CANDIDATE_LIMIT_PER_WORKSPACE",
    "schedulerMaxIterations: CRON_SCHEDULER_MAX_ITERATIONS",
    "disposition: \"disabled\"",
    "listAutomationWorkspaceControlsForBacklinkReverification",
    "listBacklinkReverificationCandidates",
    "getBacklinkVerificationJobByKey",
    "createBacklinkVerificationJob",
    "runSchedulerTick",
  ]) {
    assert(route.includes(required), `Missing cron route invariant: ${required}`);
  }

  for (const forbidden of [
    "fetch(",
    "POST(",
    "request.json",
    "workspaceLimit:",
    "candidateLimitPerWorkspace:",
    "schedulerMaxIterations:",
    "sendTransactionalEmail",
    "outreachEmailProvider",
    "RESEND_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "BACKLINK_REVERIFICATION_ENABLED =",
    "process.env.BACKLINK_REVERIFICATION_ENABLED =",
  ]) {
    if (forbidden.endsWith(":")) continue;
    assert(!route.includes(forbidden), `Forbidden cron route behavior: ${forbidden}`);
  }
  assert(!route.includes("fetch("), "Cron wrapper must not self-call over HTTP.");
  assert(!route.includes("request.nextUrl") && !route.includes("searchParams"), "Caller must not raise cron limits through query params.");
  assert(!route.includes("sendTransactionalEmail") && !route.includes("outreach"), "Cron wrapper must not perform outreach/email work.");
  assert(route.includes("workspaceLimit: CRON_WORKSPACE_LIMIT"), "Cron wrapper must pass fixed workspace limit.");
  assert(route.includes("candidateLimitPerWorkspace: CRON_CANDIDATE_LIMIT_PER_WORKSPACE"), "Cron wrapper must pass fixed candidate limit.");
  assert(route.includes("schedulerMaxIterations: CRON_SCHEDULER_MAX_ITERATIONS"), "Cron wrapper must pass fixed scheduler iteration limit.");

  assert(automation.includes("if (!input.config.enabled)"), "Kill switch must remain in automation service.");
  assert(automation.includes("disposition: \"disabled\""), "Disabled disposition must remain preserved.");
  assert(automation.includes("BACKLINK_REVERIFICATION_DISABLED"), "Disabled reason must remain preserved in automation service.");
  assert(runtime.includes("UnsafeHttpTargetError"), "SSRF-safe runtime path must remain wired.");
  assert(runtime.includes("code: \"unsafe_target\""), "Unsafe target must remain non-loss fetch error.");
  assert(composition.includes("reclaimExpiredBacklinkVerificationJobs"), "Stale reclaim must remain in production composition.");
  assert(composition.includes("extendLease"), "Heartbeat lease extension must remain in production composition.");

  const reverificationCron = vercel.crons?.find(
    (cron) => cron.path === "/api/internal/cron/backlinks/reverification",
  );
  assert(reverificationCron != null, "vercel.json must include reverification cron.");
  assert.equal(reverificationCron.schedule, "0 5 * * *");
  const outreach = vercel.crons?.find(
    (cron) => cron.path === "/api/internal/cron/backlinks/outreach/schedule",
  );
  assert(outreach != null, "Existing outreach cron must remain present.");
  assert.equal(outreach.schedule, "0 6 * * *");
  assert(outreachCron.includes("export async function GET(request: NextRequest)"), "Outreach cron precedent must remain a GET route.");

  console.log("PASS — Backlink reverification cron route smoke");
}

void main();

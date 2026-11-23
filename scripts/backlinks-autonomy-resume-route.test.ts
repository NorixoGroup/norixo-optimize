import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { NextRequest } from "next/server";

import { createBacklinkAutonomyResumeHandler } from "@/app/api/internal/automation/backlinks/autonomy-resume/route";
import type { BacklinkAutonomyTerminalRunResumeResult } from "@/lib/automation/backlink-autonomy-terminal-run-resume";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_RUN_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "88888888-8888-4888-8888-888888888888";
const NOW = "2026-11-23T08:00:00.000Z";

type ResumeCall = { sessionClient: unknown; workspaceId: string; sourceRunId: string; requestedBy: string; scheduledAt: string };

function request(body: unknown) {
  return new NextRequest("http://localhost/api/internal/automation/backlinks/autonomy-resume", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function build(options: {
  context?: unknown;
  resume?: (input: ResumeCall) => Promise<BacklinkAutonomyTerminalRunResumeResult>;
  calls?: ResumeCall[];
} = {}) {
  const calls = options.calls ?? [];
  const okContext = { status: "ok" as const, user: { id: USER_ID }, workspace: { id: WORKSPACE_ID }, client: { marker: "session-client" } };
  const resumed: BacklinkAutonomyTerminalRunResumeResult = { outcome: "resumed", reasonCodes: [], sourceRunId: SOURCE_RUN_ID, sourceTaskId: "task-source", runId: "run-sibling", taskId: "task-sibling" };
  return createBacklinkAutonomyResumeHandler({
    getContext: async () => (options.context ?? okContext) as never,
    resume: async (input) => { calls.push(input); return options.resume ? options.resume(input) : resumed; },
    now: () => new Date(NOW),
  });
}

test("unauthenticated request is rejected before resume is ever attempted", async () => {
  const calls: ResumeCall[] = [];
  const handler = build({ context: { status: "unauthenticated" }, calls });
  const response = await handler(request({ sourceRunId: SOURCE_RUN_ID, stage: "contact_validation" }));
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("a caller outside the requested workspace is rejected before resume is ever attempted", async () => {
  const calls: ResumeCall[] = [];
  const handler = build({ context: { status: "workspace_forbidden" }, calls });
  const response = await handler(request({ sourceRunId: SOURCE_RUN_ID, stage: "contact_validation" }));
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test("an unauthorized operator is rejected: the route surfaces the mechanism's own fail-closed result as 409, never a silent 200", async () => {
  const calls: ResumeCall[] = [];
  const handler = build({
    resume: async () => ({ outcome: "not_eligible", reasonCodes: ["OPERATOR_NOT_AUTHORIZED"], sourceRunId: SOURCE_RUN_ID, sourceTaskId: null, runId: null, taskId: null }),
    calls,
  });
  const response = await handler(request({ sourceRunId: SOURCE_RUN_ID, stage: "contact_validation" }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.deepEqual(body.reasonCodes, ["OPERATOR_NOT_AUTHORIZED"]);
  assert.equal(calls.length, 1);
});

test("unexpected, missing, or malformed bodies are rejected with 400 and never reach resume — including an attempt to inject workspaceId", async () => {
  const calls: ResumeCall[] = [];
  const handler = build({ calls });
  const invalidBodies = [
    undefined,
    null,
    [],
    {},
    { sourceRunId: SOURCE_RUN_ID },
    { stage: "contact_validation" },
    { sourceRunId: "not-a-uuid", stage: "contact_validation" },
    { sourceRunId: SOURCE_RUN_ID, stage: "campaign_prepare" },
    { sourceRunId: SOURCE_RUN_ID, stage: "contact_validation", workspaceId: "99999999-9999-4999-8999-999999999999" },
    { sourceRunId: SOURCE_RUN_ID, stage: "contact_validation", requestedBy: "attacker" },
    { sourceRunId: SOURCE_RUN_ID, stage: "contact_validation", extra: true },
  ];
  for (const body of invalidBodies) {
    const response = await handler(request(body));
    assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
  assert.equal(calls.length, 0, "no invalid body may ever reach the resume mechanism");
});

test("happy path: workspaceId and requestedBy come exclusively from the authenticated context, never from the body", async () => {
  const calls: ResumeCall[] = [];
  const handler = build({ calls });
  const response = await handler(request({ sourceRunId: SOURCE_RUN_ID, stage: "contact_validation" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.outcome, "resumed");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.workspaceId, WORKSPACE_ID);
  assert.equal(calls[0]!.requestedBy, USER_ID);
  assert.equal(calls[0]!.sourceRunId, SOURCE_RUN_ID);
  assert.equal(calls[0]!.scheduledAt, NOW);
});

test("a not_eligible outcome is reported as 409 with its reasonCodes, never as a 200", async () => {
  const handler = build({
    resume: async () => ({ outcome: "not_eligible", reasonCodes: ["CAMPAIGN_APPLY_AUTHORIZATION_REQUIRED"], sourceRunId: SOURCE_RUN_ID, sourceTaskId: "task-source", runId: "run-sibling", taskId: null }),
  });
  const response = await handler(request({ sourceRunId: SOURCE_RUN_ID, stage: "contact_validation" }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.deepEqual(body.reasonCodes, ["CAMPAIGN_APPLY_AUTHORIZATION_REQUIRED"]);
  assert.equal(body.runId, "run-sibling", "the sibling run id is still surfaced for traceability even when no task was created");
});

test("an unexpected exception from the resume mechanism is reported generically, never leaking the underlying error", async () => {
  const handler = build({ resume: async () => { throw new Error("supabase connection string leaked here"); } });
  const response = await handler(request({ sourceRunId: SOURCE_RUN_ID, stage: "contact_validation" }));
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.ok(!JSON.stringify(body).includes("leaked"));
});

test("repeating the exact same request twice both reach the mechanism with identical arguments (the route itself adds no extra locking — idempotency is the mechanism's own responsibility)", async () => {
  const calls: ResumeCall[] = [];
  const handler = build({ calls });
  const body = { sourceRunId: SOURCE_RUN_ID, stage: "contact_validation" as const };
  const first = await handler(request(body));
  const second = await handler(request(body));
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
});

test("the sibling run id and source run id are always returned for audit traceability, on both success and not_eligible", async () => {
  const resumed = await build()(request({ sourceRunId: SOURCE_RUN_ID, stage: "contact_validation" }));
  const resumedBody = await resumed.json();
  assert.equal(resumedBody.sourceRunId, SOURCE_RUN_ID);
  assert.equal(resumedBody.runId, "run-sibling");

  const blocked = await build({ resume: async () => ({ outcome: "not_eligible", reasonCodes: ["X"], sourceRunId: SOURCE_RUN_ID, sourceTaskId: null, runId: "run-sibling", taskId: null }) })(
    request({ sourceRunId: SOURCE_RUN_ID, stage: "contact_validation" }),
  );
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.sourceRunId, SOURCE_RUN_ID);
  assert.equal(blockedBody.runId, "run-sibling");
});

test("static: the route is not referenced by any cron, scheduler, or production composition tick", async () => {
  const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const [composition, route] = (await Promise.all([
    readFile("lib/automation/backlink-autonomy-production-composition.ts", "utf8"),
    readFile("app/api/internal/automation/backlinks/autonomy-resume/route.ts", "utf8"),
  ])).map(strip);
  assert.ok(!composition.includes("autonomy-resume"), "the production tick composition must never reference this route");
  assert.ok(!route.includes("runBacklinkAutonomyProductionTick"), "the route must never invoke the production tick");
  assert.ok(!/Scheduler|cron/i.test(route), "the route's actual code contains no scheduler/cron wiring of its own");
});

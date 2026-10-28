// Local end-to-end test of the live auto-send cron (see e2e-backlinks-live-auto-send-cron-local.sh).
// Real route + services + repositories + SQL on a throwaway PostgreSQL. The Supabase REST layer is a
// PostgREST-compatible shim executing SQL through psql; the email provider is simulated at the network
// boundary (the real Resend SDK talks to a fake api.resend.com). Any other outbound request is blocked.
import { execFile, spawn } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const CFG = {
  bin: process.env.E2E_PG_BIN!,
  socket: process.env.E2E_PG_SOCKET!,
  port: process.env.E2E_PG_PORT!,
  owner: process.env.E2E_PG_OWNER!,
  template: process.env.E2E_PG_TEMPLATE!,
  prefix: process.env.E2E_DB_PREFIX!,
};
for (const [k, v] of Object.entries(CFG)) if (!v) throw new Error(`missing ${k}`);
// Refuse to run against anything that is not the disposable database / role created by the .sh wrapper.
if (
  !CFG.socket.startsWith("/") ||
  !/^e2e_cron_\d+_\d+$/.test(CFG.prefix) ||
  !CFG.template.startsWith(`${CFG.prefix}_`) ||
  !/^e2e_cron_owner_\d+_\d+$/.test(CFG.owner)
) {
  throw new Error("refusing to run: not the disposable E2E naming scheme / unix socket");
}

// ---- fake, non-secret environment (never written to disk) -------------------------------------------------
const CRON_SECRET = "e2e-cron-secret-not-a-real-secret";
const SUPA_ORIGIN = "http://postgrest.invalid";
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPA_ORIGIN,
  SUPABASE_SERVICE_ROLE_KEY: "e2e-fake-service-role-key",
  CRON_SECRET,
  RESEND_API_KEY: "re_e2e_fake_key",
  OUTREACH_EMAIL_FROM: "Norixo <outreach@mail.e2e.invalid>",
  OUTREACH_INBOUND_REPLY_DOMAIN: "replies.e2e.invalid",
  OUTREACH_REPLY_TOKEN_ACTIVE_KEY_VERSION: "v1",
  OUTREACH_REPLY_TOKEN_SECRET_V1: "e2e-reply-token-secret-with-more-than-32-chars",
  NEXT_PUBLIC_SITE_URL: "https://site.e2e.invalid",
});
delete process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED;

// ---- psql helpers ------------------------------------------------------------------------------------------
let currentDb = "";
type PsqlResult = { code: number; stdout: string; stderr: string };
function psqlRaw(db: string, user: string | null, sql: string): Promise<PsqlResult> {
  return new Promise((resolve) => {
    const args = ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-h", CFG.socket, "-p", CFG.port];
    if (user) args.push("-U", user);
    args.push("-d", db, "-c", sql);
    const child = spawn(`${CFG.bin}/psql`, args, { env: { ...process.env, LC_ALL: "C" } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
async function sql(statement: string): Promise<string> {
  const r = await psqlRaw(currentDb, CFG.owner, statement);
  if (r.code !== 0) throw new Error(`SQL failed: ${r.stderr.trim().slice(0, 300)}`);
  return r.stdout.trim();
}
async function sqlJson<T = unknown>(statement: string): Promise<T> {
  return JSON.parse(await sql(statement)) as T;
}
function exec(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) =>
    execFile(cmd, args, { env: { ...process.env, LC_ALL: "C" } }, (e, _o, se) => (e ? reject(new Error(String(se) || String(e))) : resolve())),
  );
}
let dbCounter = 0;
async function newScenarioDb(): Promise<void> {
  if (currentDb) await dropScenarioDb();
  currentDb = `${CFG.prefix}_s${++dbCounter}`;
  if (!currentDb.startsWith(`${CFG.prefix}_s`)) throw new Error("unexpected scenario database name");
  await exec(`${CFG.bin}/createdb`, ["-h", CFG.socket, "-p", CFG.port, "-T", CFG.template, "-O", CFG.owner, currentDb]);
}
async function dropScenarioDb(): Promise<void> {
  if (!currentDb) return;
  if (!currentDb.startsWith(`${CFG.prefix}_s`)) throw new Error("refusing to drop a database outside the E2E prefix");
  await exec(`${CFG.bin}/dropdb`, ["-h", CFG.socket, "-p", CFG.port, "--if-exists", "--force", currentDb]);
  currentDb = "";
}

// ---- PostgREST-compatible shim ------------------------------------------------------------------------------
const qi = (id: string) => `"${id.replace(/"/g, '""')}"`;
const lit = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);
const restLog: { method: string; path: string }[] = [];
const rpcLog: string[] = [];
const blockedNetwork: string[] = [];

function restError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ code, message, details: null, hint: null }), { status, headers: { "content-type": "application/json" } });
}
function parseSqlError(stderr: string): { code: string; message: string } {
  const m = /ERROR:\s+([0-9A-Z]{5}):\s+([^\n]*)/.exec(stderr);
  return { code: m?.[1] ?? "P0001", message: m?.[2] ?? stderr.trim().slice(0, 200) };
}
function filtersFrom(params: URLSearchParams): string {
  const reserved = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);
  const parts: string[] = [];
  for (const [col, raw] of params.entries()) {
    if (reserved.has(col)) continue;
    if (col === "or" || col === "and" || col === "not") throw new Error(`unsupported logical filter ${col}`);
    const dot = raw.indexOf(".");
    const op = raw.slice(0, dot);
    const val = raw.slice(dot + 1);
    const c = qi(col);
    switch (op) {
      case "eq": parts.push(`${c} = ${lit(val)}`); break;
      case "neq": parts.push(`${c} <> ${lit(val)}`); break;
      case "gt": parts.push(`${c} > ${lit(val)}`); break;
      case "gte": parts.push(`${c} >= ${lit(val)}`); break;
      case "lt": parts.push(`${c} < ${lit(val)}`); break;
      case "lte": parts.push(`${c} <= ${lit(val)}`); break;
      case "is": parts.push(val === "null" ? `${c} is null` : `${c} is ${val}`); break;
      case "in": parts.push(`${c} in (${val.replace(/^\(|\)$/g, "").split(",").map((x) => lit(x.replace(/^"|"$/g, ""))).join(", ")})`); break;
      case "like": parts.push(`${c} like ${lit(val)}`); break;
      case "ilike": parts.push(`${c} ilike ${lit(val)}`); break;
      default: throw new Error(`unsupported filter operator ${op}`);
    }
  }
  return parts.length ? ` where ${parts.join(" and ")}` : "";
}
function orderFrom(params: URLSearchParams): string {
  const o = params.get("order");
  if (!o) return "";
  return " order by " + o.split(",").map((p) => {
    const [col, ...mods] = p.split(".");
    const dir = mods.includes("desc") ? "desc" : "asc";
    const nulls = mods.includes("nullsfirst") ? " nulls first" : mods.includes("nullslast") ? " nulls last" : "";
    return `${qi(col!)} ${dir}${nulls}`;
  }).join(", ");
}
function selectCols(params: URLSearchParams): string {
  const s = params.get("select") ?? "*";
  if (s.includes("(")) throw new Error(`unsupported embedded select: ${s}`);
  return s === "*" ? "*" : s.split(",").map((c) => qi(c.trim())).join(", ");
}
function shapeRows(req: Request, rows: unknown[]): Response {
  const wantsObject = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object+json");
  if (wantsObject) {
    if (rows.length !== 1) {
      return new Response(JSON.stringify({ code: "PGRST116", details: `The result contains ${rows.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" }), { status: 406, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify(rows[0]), { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json", "content-range": `0-${Math.max(rows.length - 1, 0)}/*` } });
}
async function handleRest(req: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/rest\/v1\//, "");
  restLog.push({ method: req.method, path });
  try {
    if (path.startsWith("rpc/")) return await handleRpc(req, path.slice(4));
    const table = `public.${qi(path)}`;
    const prefer = req.headers.get("prefer") ?? "";
    const wantsRows = prefer.includes("return=representation");
    if (req.method === "GET") {
      const q = `select coalesce(json_agg(t), '[]'::json) from (select ${selectCols(url.searchParams)} from ${table}${filtersFrom(url.searchParams)}${orderFrom(url.searchParams)}${url.searchParams.get("limit") ? ` limit ${Number(url.searchParams.get("limit"))}` : ""}) t`;
      const r = await psqlRaw(currentDb, CFG.owner, q);
      if (r.code !== 0) { const e = parseSqlError(r.stderr); return restError(400, e.code, e.message); }
      return shapeRows(req, JSON.parse(r.stdout.trim()));
    }
    if (req.method === "PATCH") {
      const body = JSON.parse(await req.text()) as Record<string, unknown>;
      const json = lit(JSON.stringify(body));
      const sets = Object.keys(body).map((k) => `${qi(k)} = (json_populate_record(null::${table}, ${json}::json)).${qi(k)}`).join(", ");
      const q = `with u as (update ${table} set ${sets}${filtersFrom(url.searchParams)} returning ${selectCols(url.searchParams)}) select coalesce(json_agg(u), '[]'::json) from u`;
      const r = await psqlRaw(currentDb, CFG.owner, q);
      if (r.code !== 0) { const e = parseSqlError(r.stderr); return restError(e.code === "23505" ? 409 : 400, e.code, e.message); }
      const rows = JSON.parse(r.stdout.trim()) as unknown[];
      return wantsRows ? shapeRows(req, rows) : new Response(null, { status: 204 });
    }
    if (req.method === "POST") {
      const body = JSON.parse(await req.text());
      const json = lit(JSON.stringify(Array.isArray(body) ? body : [body]));
      const q = `with i as (insert into ${table} select * from json_populate_recordset(null::${table}, ${json}::json) returning *) select coalesce(json_agg(i), '[]'::json) from i`;
      const r = await psqlRaw(currentDb, CFG.owner, q);
      if (r.code !== 0) { const e = parseSqlError(r.stderr); return restError(e.code === "23505" ? 409 : 400, e.code, e.message); }
      const rows = JSON.parse(r.stdout.trim()) as unknown[];
      return wantsRows ? shapeRows(req, rows) : new Response(null, { status: 201 });
    }
    throw new Error(`unsupported method ${req.method}`);
  } catch (e) {
    return restError(500, "E2E_SHIM", e instanceof Error ? e.message : String(e));
  }
}
async function handleRpc(req: Request, fn: string): Promise<Response> {
  rpcLog.push(fn);
  const args = req.method === "POST" ? (JSON.parse((await req.text()) || "{}") as Record<string, unknown>) : {};
  const meta = await sqlJson<{ set: boolean } | null>(`select coalesce((select json_build_object('set', p.proretset) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = ${lit(fn)} limit 1), 'null'::json)`);
  if (!meta) return restError(404, "PGRST202", `function ${fn} not found`);
  const named = Object.entries(args).map(([k, v]) => {
    const value = v === null || v === undefined ? "null" : typeof v === "object" ? `${lit(JSON.stringify(v))}::jsonb` : typeof v === "string" ? lit(v) : String(v);
    return `${qi(k)} => ${value}`;
  }).join(", ");
  const call = `public.${qi(fn)}(${named})`;
  const q = meta.set ? `select coalesce(json_agg(t), '[]'::json) from ${call} t` : `select coalesce(to_json(${call}), 'null'::json)`;
  const r = await psqlRaw(currentDb, CFG.owner, q);
  if (r.code !== 0) { const e = parseSqlError(r.stderr); return restError(e.code === "23505" ? 409 : 400, e.code, e.message); }
  return new Response(r.stdout.trim() || "null", { status: 200, headers: { "content-type": "application/json" } });
}

// ---- simulated email provider (fake api.resend.com) ----------------------------------------------------------
type ProviderMode = "accept" | "reject" | "server_error" | "unreachable";
let providerMode: ProviderMode = "accept";
type SimulatedEmail = { to: string[]; subject: string; text: string; headers: Record<string, string>; idempotencyKey: string | null; id: string | null; outcome: string };
const emails: SimulatedEmail[] = [];
let emailSeq = 0;
async function handleResend(req: Request, url: URL): Promise<Response> {
  if (!(req.method === "POST" && url.pathname === "/emails")) {
    blockedNetwork.push(`${req.method} ${url.origin}${url.pathname}`);
    throw new TypeError("EXTERNAL_NETWORK_BLOCKED");
  }
  const body = JSON.parse(await req.text()) as { to: string | string[]; subject: string; text?: string; headers?: Record<string, string> };
  const rec: SimulatedEmail = {
    to: Array.isArray(body.to) ? body.to : [body.to], subject: body.subject, text: body.text ?? "", headers: body.headers ?? {},
    idempotencyKey: req.headers.get("idempotency-key"), id: null, outcome: providerMode,
  };
  emails.push(rec);
  if (providerMode === "unreachable") throw new TypeError("fetch failed (simulated network failure)");
  if (providerMode === "reject") return new Response(JSON.stringify({ name: "validation_error", message: "simulated rejection", statusCode: 422 }), { status: 422, headers: { "content-type": "application/json" } });
  if (providerMode === "server_error") return new Response(JSON.stringify({ name: "application_error", message: "simulated outage", statusCode: 500 }), { status: 500, headers: { "content-type": "application/json" } });
  rec.id = `sim-msg-${++emailSeq}`;
  return new Response(JSON.stringify({ id: rec.id }), { status: 200, headers: { "content-type": "application/json" } });
}
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input as RequestInfo, init);
  const url = new URL(req.url);
  if (url.origin === SUPA_ORIGIN) return handleRest(req, url);
  if (url.origin === "https://api.resend.com") return handleResend(req, url);
  blockedNetwork.push(`${req.method} ${url.origin}${url.pathname}`);
  throw new TypeError("EXTERNAL_NETWORK_BLOCKED");
}) as typeof fetch;

// ---- fixtures ---------------------------------------------------------------------------------------------------
type Fx = { ws: string; camp: string; outreach: string; contact: string; opp: string; actor: string };
async function mk(label: string, email: string, opts: { live?: boolean; dry?: boolean; elig?: string | null; origin?: string; mbx?: string | null; mbxAge?: string } = {}): Promise<Fx> {
  const named = [
    `p_live => ${opts.live ?? true}`, `p_dry => ${opts.dry ?? false}`,
    `p_elig_status => ${opts.elig === undefined ? "'approved'" : opts.elig === null ? "null" : lit(opts.elig)}`,
    `p_origin => ${lit(opts.origin ?? "real")}`,
    `p_mbx_result => ${opts.mbx === undefined ? "'deliverable'" : opts.mbx === null ? "null" : lit(opts.mbx)}`,
    `p_mbx_age => ${lit(opts.mbxAge ?? "1 day")}::interval`,
  ].join(", ");
  return sqlJson<Fx>(`select row_to_json(tt.mk(${lit(label)}, ${lit(email)}, ${named}))`);
}
const attempts = async () => Number(await sql("select count(*) from backlink_outreach_attempts"));
const attemptRows = async () => sqlJson<{ status: string; provider_message_id: string | null; recipient: string }[]>("select coalesce(json_agg(a order by requested_at), '[]'::json) from (select status, provider_message_id, recipient, requested_at from backlink_outreach_attempts) a");

// ---- cron invocation ---------------------------------------------------------------------------------------------
type RouteModule = { GET: (req: NextRequest) => Promise<Response> };
let route: RouteModule;
async function callCron(headers: Record<string, string> | null = { authorization: `Bearer ${CRON_SECRET}` }): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await route.GET(new NextRequest("http://localhost/api/internal/cron/backlinks/outreach/send-one", headers ? { headers } : {}));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}
const results: { name: string; ok: boolean; detail: string }[] = [];
const scenarioEmailCounts: { name: string; emails: number }[] = [];
function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} :: ${name} :: ${detail}`);
}
function beginScenario() { emails.length = 0; restLog.length = 0; rpcLog.length = 0; providerMode = "accept"; process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED = "true"; }
function endScenario(name: string) { scenarioEmailCounts.push({ name, emails: emails.length }); }
const allRpc = new Set<string>();
const enable = (v: string | undefined) => { if (v === undefined) delete process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED; else process.env.BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED = v; };

type Expect = { considered: "zero" | "some"; v3: boolean };
const NOT_LISTED: Expect = { considered: "zero", v3: false }; // the workspace is never selected by the cron
const SKIPPED_BEFORE_SQL: Expect = { considered: "some", v3: false }; // listed, then dropped by the TypeScript pre-filter
const REFUSED_BY_SQL: Expect = { considered: "some", v3: true }; // reached the V3 reservation, refused inside the transaction
async function refusalScenario(name: string, setup: () => Promise<void>, why: string, expect: Expect) {
  await newScenarioDb(); beginScenario();
  await setup();
  const r = await callCron();
  const n = await attempts();
  const considered = Number(r.body.candidatesConsidered ?? 0);
  const reachedV3 = rpcLog.includes("reserve_backlink_approved_initial_attempt_v3");
  const where = (expect.considered === "zero" ? considered === 0 : considered > 0) && reachedV3 === expect.v3;
  check(name, r.status === 200 && emails.length === 0 && n === 0 && where, `${why}; http=${r.status} disposition=${String(r.body.disposition)} candidatesConsidered=${considered} reachedV3=${reachedV3} (expected ${expect.considered}/${expect.v3}) emails=${emails.length} attempts=${n}`);
  rpcLog.forEach((x) => allRpc.add(x)); endScenario(name);
}

async function main() {
  // Prove the outbound block works before anything runs: real hosts must be unreachable from this process.
  for (const probe of ["https://api.resend.com/domains", "https://example.com/", "https://api.search.brave.com/"]) {
    let blocked = false;
    try { await fetch(probe); } catch { blocked = true; }
    check(`NETWORK probe — ${probe} is blocked`, blocked, blocked ? "blocked" : "REACHED");
  }
  if (blockedNetwork.length !== 3) throw new Error("network block self-test failed");
  blockedNetwork.length = 0;
  route = (await import("../app/api/internal/cron/backlinks/outreach/send-one/route")) as unknown as RouteModule;

  // S1 — authorization
  await newScenarioDb(); beginScenario();
  await mk("s1", "s1@real.test");
  for (const [label, hdr] of [["no Authorization header", null], ["wrong secret", { authorization: "Bearer not-the-secret" }], ["empty bearer", { authorization: "Bearer " }], ["basic scheme", { authorization: `Basic ${CRON_SECRET}` }]] as const) {
    const r = await callCron(hdr as Record<string, string> | null);
    check(`S1 401 — ${label}`, r.status === 401, `http=${r.status}`);
  }
  const savedSecret = process.env.CRON_SECRET; delete process.env.CRON_SECRET;
  const r0 = await callCron({ authorization: "Bearer undefined" });
  check("S1 401 — CRON_SECRET not configured on the server", r0.status === 401, `http=${r0.status}`);
  process.env.CRON_SECRET = savedSecret;
  check("S1 no email, no attempt, no database read on unauthorized calls", emails.length === 0 && (await attempts()) === 0 && restLog.length === 0, `emails=${emails.length} restRequests=${restLog.length}`);
  endScenario("S1 authorization");

  // S2 — activation flag
  await newScenarioDb(); beginScenario();
  await mk("s2", "s2@real.test");
  for (const v of [undefined, "false", "TRUE", "1", "yes", " true"]) {
    enable(v);
    const r = await callCron();
    check(`S2 409 — BACKLINK_LIVE_AUTO_SEND_CRON_ENABLED=${v === undefined ? "<absent>" : JSON.stringify(v)}`, r.status === 409, `http=${r.status}`);
  }
  check("S2 disabled cron: no email, no attempt, no database read", emails.length === 0 && (await attempts()) === 0 && restLog.length === 0, `emails=${emails.length} restRequests=${restLog.length}`);
  endScenario("S2 cron disabled");

  // S3 — workspace / campaign controls
  await refusalScenario("S3a workspace dry_run_only=true", async () => { await mk("s3a", "s3a@real.test", { dry: true }); }, "dry-run workspace is never scanned", NOT_LISTED);
  await refusalScenario("S3b backlink_outreach_schedule_apply_enabled=false", async () => { const f = await mk("s3b", "s3b@real.test"); await sql(`update automation_workspace_controls set backlink_outreach_schedule_apply_enabled=false where workspace_id='${f.ws}'`); }, "capability off", NOT_LISTED);
  await refusalScenario("S3c backlinks_enabled=false", async () => { const f = await mk("s3c", "s3c@real.test"); await sql(`update automation_workspace_controls set backlinks_enabled=false where workspace_id='${f.ws}'`); }, "backlinks disabled", NOT_LISTED);
  await refusalScenario("S3d disabled_reason set (operator kill switch)", async () => { const f = await mk("s3d", "s3d@real.test"); await sql(`update automation_workspace_controls set disabled_reason='maintenance' where workspace_id='${f.ws}'`); }, "kill switch", NOT_LISTED);
  await refusalScenario("S3e campaign live_initial_send_enabled=false", async () => { await mk("s3e", "s3e@real.test", { live: false }); }, "campaign not live", REFUSED_BY_SQL);

  // S4 — human approval
  await refusalScenario("S4a ready outreach WITHOUT human approval fields", async () => {
    const f = await mk("s4a", "s4a@real.test");
    await sql(`update backlink_outreach set auto_send_approved_at=null, auto_send_approved_by=null, auto_send_approval_fingerprint=null where id='${f.outreach}'`);
  }, "no approval recorded", SKIPPED_BEFORE_SQL);
  await refusalScenario("S4b approval stale (body edited after approval)", async () => {
    const f = await mk("s4b", "s4b@real.test");
    await sql(`update backlink_outreach set body='edited after approval' where id='${f.outreach}'`);
  }, "fingerprint mismatch", REFUSED_BY_SQL);
  await refusalScenario("S4c outreach still draft (never approved)", async () => {
    const f = await mk("s4c", "s4c@real.test");
    await sql(`update backlink_outreach set status='draft', auto_send_approved_at=null, auto_send_approved_by=null, auto_send_approval_fingerprint=null where id='${f.outreach}'`);
  }, "draft is not a candidate", NOT_LISTED);

  // S5 — production eligibility
  for (const [label, o] of [["no eligibility row", { elig: null }], ["origin test", { origin: "test" }], ["origin demo", { origin: "demo" }], ["origin legacy_unknown", { origin: "legacy_unknown" }], ["status pending", { elig: "pending" }], ["status rejected", { elig: "rejected" }], ["status revoked", { elig: "revoked" }]] as const) {
    await refusalScenario(`S5 eligibility — ${label}`, async () => { await mk("s5", "s5@real.test", o as never); }, label, REFUSED_BY_SQL);
  }
  await refusalScenario("S5 eligibility — email changed after release (fingerprint mismatch)", async () => { const f = await mk("s5e", "s5e-old@real.test"); await sql(`update backlink_contacts set email_normalized='s5e-new@real.test' where id='${f.contact}'`); }, "email changed", REFUSED_BY_SQL);

  // S6 — mailbox verification
  for (const [label, o] of [["no verification", { mbx: null }], ["latest undeliverable", { mbx: "undeliverable" }], ["latest risky", { mbx: "risky" }], ["latest unknown", { mbx: "unknown" }], ["latest provider_error", { mbx: "provider_error" }], ["deliverable but 31 days old", { mbxAge: "31 days" }]] as const) {
    await refusalScenario(`S6 mailbox — ${label}`, async () => { await mk("s6", "s6@real.test", o as never); }, label, REFUSED_BY_SQL);
  }
  await refusalScenario("S6 mailbox — older deliverable superseded by a newer undeliverable", async () => {
    const f = await mk("s6x", "s6x@real.test", { mbxAge: "5 days" });
    await sql(`select tt.mbx(row('${f.ws}','${f.camp}','${f.outreach}','${f.contact}','${f.opp}','${f.actor}')::tt.fx, 's6x@real.test', 'undeliverable', interval '1 hour', 'newer')`);
  }, "latest verification wins", REFUSED_BY_SQL);

  // S7 — suppression and previous attempts
  await refusalScenario("S7a recipient suppressed (unsubscribe)", async () => { const f = await mk("s7a", "s7a@real.test"); await sql(`insert into backlink_email_suppressions(workspace_id,email_normalized,reason,source) values ('${f.ws}','s7a@real.test','unsubscribed','admin_unsubscribe')`); }, "suppressed", REFUSED_BY_SQL);
  for (const st of ["accepted", "failed", "requested", "unknown"]) {
    await newScenarioDb(); beginScenario();
    const f = await mk("s7", `s7-${st}@real.test`);
    await sql(`insert into backlink_outreach_attempts(workspace_id,outreach_id,actor_user_id,channel,provider,recipient,idempotency_key,attempt_kind,status,requested_at,accepted_at,failed_at,resolved_at,provider_message_id,error_code,error_message) values ('${f.ws}','${f.outreach}','${f.actor}','email','resend','s7-${st}@real.test','prior-${st}','initial','${st}',now()-interval '1 day',${st === "accepted" ? "now()-interval '1 day'" : "null"},${st === "failed" ? "now()-interval '1 day'" : "null"},${["accepted", "failed"].includes(st) ? "now()-interval '1 day'" : "null"},${st === "accepted" ? "'pm-prior-'||gen_random_uuid()" : "null"},${["failed", "unknown"].includes(st) ? "'E'" : "null"},${["failed", "unknown"].includes(st) ? "'prior'" : "null"})`);
    const before = await attempts();
    const r = await callCron();
    const after = await attempts();
    check(`S7 prior attempt (${st}) for the recipient`, emails.length === 0 && after === before, `http=${r.status} emails=${emails.length} attempts ${before}->${after}`);
    rpcLog.forEach((x) => allRpc.add(x)); endScenario(`S7 prior ${st}`);
  }

  // S8 — fully admissible prospect: exactly one simulated email
  await newScenarioDb(); beginScenario();
  const ok = await mk("s8", "prospect8@real.test");
  const r8 = await callCron();
  const rows8 = await attemptRows();
  check("S8 admissible prospect => exactly one simulated email", r8.status === 200 && r8.body.disposition === "sent" && emails.length === 1, `http=${r8.status} disposition=${String(r8.body.disposition)} emails=${emails.length}`);
  const em = emails[0];
  check("S8 email addressed to the approved recipient only, idempotency key sent to the provider", !!em && em.to.length === 1 && em.to[0] === "prospect8@real.test" && !!em.idempotencyKey, `to=${em?.to.join(",")} idempotencyKey=${em?.idempotencyKey ? "present" : "missing"}`);
  check("S8 compliance: List-Unsubscribe headers and unsubscribe footer present", !!em && "List-Unsubscribe" in em.headers && /unsubscribe/i.test(em.text), `headers=${Object.keys(em?.headers ?? {}).join(",")}`);
  check("S8 one attempt accepted with the simulated provider message id", rows8.length === 1 && rows8[0]!.status === "accepted" && rows8[0]!.provider_message_id === em?.id, JSON.stringify(rows8));
  const ostat = await sql(`select status || '/' || current_attempt from backlink_outreach where id='${ok.outreach}'`);
  check("S8 outreach activated after acceptance", ostat.startsWith("active/1"), `outreach=${ostat}`);
  const r8b = await callCron();
  check("S8 a second cron run sends nothing more (recipient already attempted)", emails.length === 1 && (await attempts()) === 1, `http=${r8b.status} disposition=${String(r8b.body.disposition)} emails=${emails.length}`);
  rpcLog.forEach((x) => allRpc.add(x)); endScenario("S8 admissible prospect");

  // S9 — concurrency
  await newScenarioDb(); beginScenario();
  await mk("s9", "prospect9@real.test");
  const par = await Promise.all([callCron(), callCron(), callCron(), callCron()]);
  const sent = par.filter((x) => x.body.disposition === "sent").length;
  check("S9 4 simultaneous cron invocations, one admissible prospect => exactly one simulated email", emails.length === 1 && (await attempts()) === 1 && sent === 1, `emails=${emails.length} attempts=${await attempts()} dispositions=${par.map((x) => String(x.body.disposition)).join("/")}`);
  rpcLog.forEach((x) => allRpc.add(x)); endScenario("S9 concurrency single candidate");

  await newScenarioDb(); beginScenario();
  const a = await mk("s9b", "twin@real.test");
  await sql(`select tt.second(row('${a.ws}','${a.camp}','${a.outreach}','${a.contact}','${a.opp}','${a.actor}')::tt.fx, 'twin@real.test', true)`);
  const par2 = await Promise.all([callCron(), callCron(), callCron(), callCron()]);
  check("S9b two outreach rows sharing ONE recipient address, 4 simultaneous runs => exactly one simulated email", emails.length === 1 && (await attempts()) === 1, `emails=${emails.length} attempts=${await attempts()} dispositions=${par2.map((x) => String(x.body.disposition)).join("/")}`);
  rpcLog.forEach((x) => allRpc.add(x)); endScenario("S9b concurrency shared recipient");

  // S10 — provider failures
  for (const [mode, label] of [["reject", "provider rejects (HTTP 422)"], ["server_error", "provider outage (HTTP 500)"], ["unreachable", "provider unreachable (network error)"]] as const) {
    await newScenarioDb(); beginScenario();
    await mk("s10", "prospect10@real.test");
    providerMode = mode;
    const f1 = await callCron();
    const rowsF = await attemptRows();
    const callsAfterFirst = emails.length;
    providerMode = "accept";
    const f2 = await callCron();
    check(`S10 ${label}: single provider call, attempt recorded, no resend on the next run`, callsAfterFirst === 1 && emails.length === 1 && rowsF.length === 1 && (await attempts()) === 1, `first: http=${f1.status} disposition=${String(f1.body.disposition)} attempt=${rowsF[0]?.status}; second: disposition=${String(f2.body.disposition)}; provider calls=${emails.length}`);
    rpcLog.forEach((x) => allRpc.add(x)); endScenario(`S10 ${mode}`);
  }

  // S11 — every send goes through the V3 reservation
  const reserveRpcs = [...allRpc].filter((x) => x.startsWith("reserve_"));
  check("S11 runtime: the only reservation RPC ever called by the cron is reserve_backlink_approved_initial_attempt_v3", reserveRpcs.length > 0 && reserveRpcs.every((x) => x === "reserve_backlink_approved_initial_attempt_v3"), `rpc seen=${[...allRpc].join(",")}`);
  const root = process.cwd();
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".git", ".next", "types"].includes(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(name) || p.includes("/scripts/")) continue;
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/["'](reserve_backlink_[a-z0-9_]+)["']/g)) hits.push(`${p.replace(root + "/", "")}:${m[1]}`);
    }
  };
  walk(join(root, "app")); walk(join(root, "lib"));
  const initialSend = hits.filter((h) => /initial|approved/.test(h) && !/follow_up/.test(h));
  const outside = initialSend.filter((h) => !h.startsWith("lib/backlinks/repositories/outreachAttemptsRepository.ts"));
  const v3Calls = initialSend.filter((h) => h.endsWith("approved_initial_attempt_v3"));
  check("S11 static: initial-send reservation RPCs referenced in app/ and lib/ only inside the repository wrapper, and the wrapper calls V3", outside.length === 0 && v3Calls.length >= 1, `references=${initialSend.join(" | ")}`);
  check("S11 no non-V3 initial-send reservation executed by any wrapper caller (v1 wrapper has no caller)", !readFileSync(join(root, "lib/backlinks/repositories/outreachAttemptsRepository.ts"), "utf8").match(/rpc\(\s*"reserve_backlink_approved_initial_attempt_v2"/), "wrapper does not call V2");

  check("NETWORK no outbound request other than the simulated Supabase REST and the fake Resend endpoint", blockedNetwork.length === 0, `blocked=${blockedNetwork.length} ${blockedNetwork.slice(0, 3).join(" | ")}`);

  await dropScenarioDb();
  const failed = results.filter((x) => !x.ok);
  const totalEmails = scenarioEmailCounts.reduce((s, x) => s + x.emails, 0);
  console.log("\n=== simulated emails per scenario (provider calls) ===");
  for (const s of scenarioEmailCounts) console.log(`${String(s.emails).padStart(2)}  ${s.name}`);
  console.log(`TOTAL simulated provider calls: ${totalEmails}`);
  console.log(`CHECKS pass=${results.length - failed.length} fail=${failed.length}`);
  if (failed.length) { console.log("FAILED:", failed.map((x) => x.name).join(" ; ")); process.exit(1); }
  console.log("ALL E2E CHECKS PASSED");
}
main().catch(async (e) => { console.error("E2E ABORTED:", e); try { await dropScenarioDb(); } catch {} process.exit(2); });

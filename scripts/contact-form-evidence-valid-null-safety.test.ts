import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { isValidContactFormVerificationEvidence } from "../lib/backlinks/repositories/contactFormAutomationRepository";

/**
 * Regression test for migration 20261016090000.
 *
 * backlink_contact_form_verification_evidence_valid(jsonb) used to return NULL (not false) when a required
 * key was missing or JSON null. Its callers (`IF NOT valid(...)` and a CHECK constraint) treat NULL as
 * "no error", so incomplete evidence was accepted as verified.
 *
 * Part 1 is static and always runs. Part 2 executes the function from the migration file in a throwaway
 * PostgreSQL 17 cluster (private unix socket, no TCP, removed afterwards). It is skipped, with a message,
 * when no PostgreSQL 17 binaries are found; set REQUIRE_POSTGRES=1 to fail instead of skipping, and
 * PG_BIN to point at the binary directory.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");
const FIX_FILE = "20261016090000_fix_contact_form_evidence_validation_null_safety.sql";
const PENDING_BEFORE_FIX = [
  "20261009120000_add_backlink_contact_form_verification_preflights.sql",
  "20261009130000_add_atomic_contact_form_preflight_completion.sql",
  "20261009140000_add_abandoned_preflight_reconciliation.sql",
  "20261009150000_add_contact_form_verification_evidence_ttl.sql",
  "20261009160000_make_contact_form_preflight_reconciliation_clock_authoritative.sql",
  "20261009170000_make_contact_form_preflight_claims_exclusive.sql",
  "20261012120000_add_backlink_brave_request_budget.sql",
  "20261015120000_add_automation_task_dead_letter.sql",
  "20261015130000_add_claim_backlink_discovery_task_by_id.sql",
];
const FN = "public.backlink_contact_form_verification_evidence_valid";
const KEYS = [
  "actual_form_observed",
  "form_count",
  "message_field_present",
  "submit_control_present",
  "contact_intent",
  "newsletter_only",
  "login_only",
  "support_only",
  "sales_demo_only",
] as const;

const migration = readFileSync(join(MIGRATIONS_DIR, FIX_FILE), "utf8");
const code = migration.replace(/--.*$/gm, "");

test("static: the corrective migration is ordered after the nine pending migrations", () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort();
  assert.equal(files.at(-1), FIX_FILE, "the corrective migration must be the newest migration");
  for (const previous of PENDING_BEFORE_FIX) {
    assert.ok(existsSync(join(MIGRATIONS_DIR, previous)), `missing pending migration ${previous}`);
    assert.ok(previous < FIX_FILE, `${FIX_FILE} must sort after ${previous}`);
  }
});

test("static: the corrective migration only replaces the evidence function body", () => {
  assert.doesNotMatch(code, /^\s*begin;/i);
  assert.doesNotMatch(code, /commit;\s*$/i);
  const statements = code.split(";").map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(statements.map((s) => s.split(/\s+/).slice(0, 2).join(" ").toLowerCase()), ["create or"]);
  assert.equal(code.match(/create or replace function/gi)?.length, 1);
  assert.ok(code.includes(`create or replace function ${FN}(p_safe_evidence jsonb)`));
  assert.doesNotMatch(code, /\b(drop|alter|grant|revoke|insert|update|delete|truncate|create\s+(table|index|trigger|policy|extension|role))\b/i, "no object other than the function may change");
  assert.match(code, /returns boolean/i);
  assert.match(code, /\blanguage sql\b/i);
  assert.match(code, /\bimmutable\b/i);
  assert.match(code, /\bsecurity invoker\b/i);
  assert.doesNotMatch(code, /security definer/i);
  assert.match(code, /set search_path = public\b/i);
  assert.match(code, /select\s+coalesce\(\s*case[\s\S]*\bend\s*,\s*false\s*\)/i, "the whole verdict must be wrapped in coalesce(case ... end, false)");
});

type Case = { label: string; value: unknown; expected: boolean; appFormat: boolean };

function buildCases(): Case[] {
  const appFormat = Object.fromEntries([
    ["actual_form_observed", true], ["form_count", 1], ["message_field_present", true], ["submit_control_present", true],
    ["contact_intent", true], ["newsletter_only", false], ["login_only", false], ["support_only", false], ["sales_demo_only", false],
  ]) as Record<string, unknown>;
  const textFormat = Object.fromEntries(Object.entries(appFormat).map(([k, v]) => [k, String(v)]));
  const cases: Case[] = [
    { label: "valid, application format (JSON booleans and number)", value: appFormat, expected: true, appFormat: true },
    { label: "valid, text format", value: textFormat, expected: true, appFormat: false },
    { label: "valid with an extra key", value: { ...appFormat, extra: "x" }, expected: true, appFormat: true },
    { label: "valid with an 18-digit form_count", value: { ...textFormat, form_count: "9".repeat(18) }, expected: true, appFormat: false },
  ];
  for (const key of KEYS) {
    const missing = { ...appFormat };
    delete missing[key];
    cases.push({ label: `missing ${key}`, value: missing, expected: false, appFormat: true });
    cases.push({ label: `JSON null ${key}`, value: { ...appFormat, [key]: null }, expected: false, appFormat: true });
    if (key !== "form_count") cases.push({ label: `empty string ${key}`, value: { ...textFormat, [key]: "" }, expected: false, appFormat: false });
  }
  for (const key of ["actual_form_observed", "message_field_present", "submit_control_present", "contact_intent"]) {
    cases.push({ label: `${key} = false`, value: { ...appFormat, [key]: false }, expected: false, appFormat: true });
  }
  for (const key of ["newsletter_only", "login_only", "support_only", "sales_demo_only"]) {
    cases.push({ label: `${key} = true`, value: { ...appFormat, [key]: true }, expected: false, appFormat: true });
  }
  cases.push(
    { label: "form_count 0", value: { ...appFormat, form_count: 0 }, expected: false, appFormat: true },
    { label: "form_count -1", value: { ...appFormat, form_count: -1 }, expected: false, appFormat: true },
    { label: "form_count 1.5", value: { ...appFormat, form_count: 1.5 }, expected: false, appFormat: true },
    { label: "form_count text abc", value: { ...textFormat, form_count: "abc" }, expected: false, appFormat: false },
    { label: "form_count 30 digits must be false, not an overflow error", value: { ...textFormat, form_count: "9".repeat(30) }, expected: false, appFormat: false },
    { label: "oversized object", value: { ...appFormat, pad: "x".repeat(9000) }, expected: false, appFormat: false },
    { label: "empty object", value: {}, expected: false, appFormat: true },
    { label: "JSON array", value: [], expected: false, appFormat: true },
    { label: "JSON string", value: "x", expected: false, appFormat: true },
    { label: "JSON number", value: 1, expected: false, appFormat: true },
    { label: "JSON null literal", value: null, expected: false, appFormat: true },
  );
  return cases;
}

test("static: the TypeScript mirror agrees with the expected verdicts on application-format evidence", () => {
  for (const c of buildCases().filter((candidate) => candidate.appFormat)) {
    assert.equal(isValidContactFormVerificationEvidence(c.value as never), c.expected, c.label);
  }
});

function findPgBin(): string | null {
  const candidates = [process.env.PG_BIN, "/usr/local/opt/postgresql@17/bin", "/opt/homebrew/opt/postgresql@17/bin"].filter((v): v is string => Boolean(v));
  for (const dir of candidates) {
    if (["initdb", "pg_ctl", "psql", "postgres"].every((bin) => existsSync(join(dir, bin)))) {
      const version = spawnSync(join(dir, "postgres"), ["--version"], { encoding: "utf8" }).stdout;
      if (/PostgreSQL\) 17\./.test(version)) return dir;
    }
  }
  return null;
}

test("postgres: evidence_valid is a non-NULL boolean and incomplete evidence cannot reach verified", (t) => {
  const pgBin = findPgBin();
  if (pgBin === null) {
    assert.ok(process.env.REQUIRE_POSTGRES !== "1", "PostgreSQL 17 binaries are required (REQUIRE_POSTGRES=1)");
    t.skip("PostgreSQL 17 binaries not found; set PG_BIN to run the database part");
    return;
  }

  const root = mkdtempSync("/tmp/nx-evid-");
  const data = join(root, "data");
  const sock = join(root, "s");
  const port = String(56000 + Math.floor(Math.random() * 3000));
  const env = { PATH: process.env.PATH ?? "", LC_ALL: "C", LANG: "C" } as unknown as NodeJS.ProcessEnv;
  const run = (bin: string, args: string[], input?: string) =>
    spawnSync(join(pgBin, bin), args, { encoding: "utf8", env, input });
  const psql = (args: string[], input?: string) =>
    run("psql", ["-X", "-q", "-At", "-h", sock, "-p", port, "-U", "postgres", "-d", "postgres", ...args], input);
  let started = false;
  try {
    mkdirSync(sock, { mode: 0o700 });
    assert.equal(run("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8"]).status, 0, "initdb failed");
    const start = run("pg_ctl", ["-D", data, "-l", join(root, "log"), "-w", "-o", `-h '' -k ${sock} -p ${port} -c fsync=off`, "start"]);
    assert.equal(start.status, 0, `pg_ctl start failed: ${start.stderr}`);
    started = true;
    assert.equal(psql(["-c", "select current_setting('listen_addresses') = ''"]).stdout.trim(), "t", "cluster must not listen on TCP");

    const body = migration.replace(/^\s*begin;/i, "").replace(/commit;\s*$/i, "");
    assert.equal(psql(["-v", "ON_ERROR_STOP=1", "-c", "create schema if not exists public"]).status, 0);
    const load = psql(["-v", "ON_ERROR_STOP=1"], body);
    assert.equal(load.status, 0, `loading the migration function failed: ${load.stderr}`);

    // 1. Verdict matrix: every case returns exactly the expected, non-NULL boolean.
    const cases = buildCases();
    const lines = cases.map((c, i) => {
      const literal = c.value === undefined ? "null::jsonb" : `$j$${JSON.stringify(c.value)}$j$::jsonb`;
      return `select ${i} || '|' || coalesce(${FN}(${literal})::text, 'NULL');`;
    });
    lines.push(`select 'sqlnull|' || coalesce(${FN}(null::jsonb)::text, 'NULL');`);
    const verdicts = psql(["-v", "ON_ERROR_STOP=1"], lines.join("\n"));
    assert.equal(verdicts.status, 0, `matrix failed (an error instead of a boolean?): ${verdicts.stderr}`);
    const got = new Map(verdicts.stdout.trim().split("\n").map((line) => line.split("|") as [string, string]));
    cases.forEach((c, i) => assert.equal(got.get(String(i)), String(c.expected), c.label));
    assert.equal(got.get("sqlnull"), "false", "SQL NULL evidence");

    // 2. The two guard patterns used by the callers: a CHECK constraint and `IF NOT valid(...)`.
    const setup = `
      create table probe (state text not null, verified_at timestamptz, safe_evidence jsonb not null default '{}',
        constraint probe_verified_evidence_check check (state <> 'verified' or (verified_at is not null and ${FN}(safe_evidence))));
      create function complete_probe(p_evidence jsonb) returns text language plpgsql as $f$
      begin
        if not ${FN}(p_evidence) then raise exception 'EVIDENCE_INVALID'; end if;
        insert into probe(state, verified_at, safe_evidence) values ('verified', now(), p_evidence);
        return 'verified';
      end $f$;`;
    assert.equal(psql(["-v", "ON_ERROR_STOP=1"], setup).status, 0, "probe setup failed");
    const complete = cases[0]!.value;
    const incomplete: unknown[] = [{}, { form_count: 1 }, { ...(complete as object), contact_intent: null }, (() => { const o = { ...(complete as Record<string, unknown>) }; delete o.sales_demo_only; return o; })()];
    for (const evidence of incomplete) {
      const literal = `$j$${JSON.stringify(evidence)}$j$::jsonb`;
      const viaCheck = psql(["-c", `insert into probe(state, verified_at, safe_evidence) values ('verified', now(), ${literal})`]);
      assert.notEqual(viaCheck.status, 0, `CHECK must refuse ${JSON.stringify(evidence)}`);
      assert.match(viaCheck.stderr, /violates check constraint "probe_verified_evidence_check"/);
      const viaGuard = psql(["-c", `select complete_probe(${literal})`]);
      assert.notEqual(viaGuard.status, 0, `guard must refuse ${JSON.stringify(evidence)}`);
      assert.match(viaGuard.stderr, /EVIDENCE_INVALID/);
    }
    assert.equal(psql(["-c", "select count(*) from probe"]).stdout.trim(), "0", "no incomplete evidence may be stored as verified");
    assert.equal(psql(["-c", `select complete_probe($j$${JSON.stringify(complete)}$j$::jsonb)`]).stdout.trim(), "verified", "complete evidence must still verify");
    assert.equal(psql(["-c", "select count(*) from probe"]).stdout.trim(), "1");
  } finally {
    if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    rmSync(root, { recursive: true, force: true });
  }
});

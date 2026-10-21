import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

/**
 * S5.3-C5 tests of the offline pilot-sheet CLI. Everything is fictional-free: the CLI reads only data/cities.ts and the
 * V3 code, creates nothing and names no source.
 *
 *   npx tsx scripts/seo-v3-pilot-sheets.test.ts
 */

const AS_OF = "2026-10-22T00:00:00Z";
const run = (...args: string[]) => spawnSync("npx", ["--no-install", "tsx", "scripts/seo-v3-pilot-sheets.ts", ...args], { encoding: "utf8", cwd: process.cwd() });
const gitState = () => spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).stdout;

type Sheet = {
  scope: { citySlug: string; countryCode: string; level: string }; kind: string; platform: string; origin: string; requirementId: string; status: string;
  acceptedSourceTypes: string[]; candidateSources: unknown[]; humanSteps: string[]; sheetId: string;
  validity: { maxAgeDays: number; thresholdBasis: string }; recordTemplate: { value: Record<string, unknown>; [k: string]: unknown };
};
const parsed = () => {
  const result = run("--as-of", AS_OF);
  assert.equal(result.status, 0, result.stderr);
  return { text: result.stdout, json: JSON.parse(result.stdout) as { plan: { sheets: Sheet[]; meta: Record<string, unknown>; createsFacts: boolean; createsDecisions: boolean; publicationAuthorised: boolean; rejectedOrders: unknown[] }; entries: Record<string, unknown>[]; [k: string]: unknown } };
};

test("C5 three cities: exactly three voluntary long_stay_rule sheets for paris, barcelona and amsterdam", () => {
  const { json } = parsed();
  const sheets = json.plan.sheets;
  assert.equal(sheets.length, 3);
  assert.deepEqual(sheets.map((s) => s.scope.citySlug).sort(), ["amsterdam", "barcelona", "paris"]);
  assert.deepEqual(sheets.map((s) => s.scope.countryCode).sort(), ["ES", "FR", "NL"]);
  for (const sheet of sheets) {
    assert.equal(sheet.scope.level, "city");
    assert.equal(sheet.kind, "fact");
    assert.equal(sheet.platform, "airbnb");
    assert.equal(sheet.origin, "voluntary");
    assert.equal(sheet.requirementId, "long_stay_rule");
    assert.equal(sheet.status, "ready_to_collect");
    assert.deepEqual(sheet.acceptedSourceTypes, ["official_authority"]);
  }
  assert.equal(new Set(sheets.map((s) => s.sheetId)).size, 3);
  assert.equal(json.plan.rejectedOrders.length, 0);
});

test("C5 rule types: the sheets admit minimum_stay and night_cap only, and fill in nothing", () => {
  for (const sheet of parsed().json.plan.sheets) {
    assert.deepEqual(sheet.recordTemplate.value.acceptedRuleTypes, ["minimum_stay", "night_cap"]);
    for (const field of ["ruleType", "rule", "effectiveFrom", "effectiveUntil", "officialReference"]) assert.equal(sheet.recordTemplate.value[field], null, field);
    assert.equal(sheet.validity.maxAgeDays, 180);
    assert.equal(sheet.validity.thresholdBasis, "provisional_pending_human_decision", "the 180 days are not validated");
    assert.ok(sheet.humanSteps.includes("confirm_provisional_thresholds"));
    assert.ok(sheet.humanSteps.includes("human_validation"));
  }
});

test("C5 no source, no fact, no decision, no publication", () => {
  const { json, text } = parsed();
  for (const sheet of json.plan.sheets) assert.deepEqual(sheet.candidateSources, [], "no approved source exists");
  assert.equal(json.plan.meta.sourceRegistryHash, null);
  assert.ok((json.plan.meta.warnings as string[]).includes("source_registry_absent"));
  assert.ok((json.plan.meta.warnings as string[]).includes("import_baseline_absent"));
  assert.equal(json.plan.createsFacts, false);
  assert.equal(json.plan.createsDecisions, false);
  assert.equal(json.plan.publicationAuthorised, false);
  assert.equal(json.createsFacts, false);
  assert.equal(json.createsDecisions, false);
  assert.equal(json.approvesSources, false);
  assert.equal(json.network, false);
  for (const entry of json.entries) {
    assert.equal(entry.publicationAuthorised, false);
    assert.equal(entry.indexingAuthorised, false);
    assert.equal(entry.coverageClass, "needs_human_decision");
  }
  assert.ok(!/https?:\/\//.test(text), "the output contains no URL");
});

test("C5 byte-for-byte reproducibility, and the date drives the output", () => {
  const first = run("--as-of", AS_OF).stdout;
  assert.equal(run("--as-of", AS_OF).stdout, first);
  assert.equal(first.endsWith("\n"), true);
  assert.notEqual(run("--as-of", "2026-10-23T00:00:00Z").stdout, first);
});

test("C5 invalid arguments are refused with exit 1, nothing on stdout", () => {
  const bad: string[][] = [
    [], ["--as-of"], ["--as-of", "yesterday"], ["--as-of", "2026-13-40T00:00:00Z"], ["--as-of", "--x"], ["--as-of", AS_OF, "--extra"],
    ["--as-of", AS_OF, AS_OF], ["paris"], ["--city", "paris", "--as-of", AS_OF], [AS_OF],
  ];
  for (const args of bad) {
    const result = run(...args);
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.equal(result.stdout, "", JSON.stringify(args));
  }
});

test("C5 no side effects: the repository state is unchanged and no store directory is created", () => {
  const before = gitState();
  const existed = existsSync("data/seo-v3");
  assert.equal(run("--as-of", AS_OF).status, 0);
  assert.equal(run("--as-of", "bad").status, 1);
  assert.equal(gitState(), before);
  assert.equal(existsSync("data/seo-v3"), existed);
  assert.equal(existed, false, "no store exists yet");
});

test("C5 the source of the CLI has no network, no file write and no process spawning", () => {
  const source = readFileSync("scripts/seo-v3-pilot-sheets.ts", "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of ["fetch(", "node:http", "node:https", "node:net", "node:child_process", "writeFile", "appendFile", "mkdir", "createWriteStream", "XMLHttpRequest", "WebSocket"]) {
    assert.ok(!code.includes(forbidden), forbidden);
  }
  assert.ok(!/from "node:fs"/.test(code), "the CLI imports no file system module");
});

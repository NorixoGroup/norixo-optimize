import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { cities } from "../data/cities";
import { buildCollectionPlan } from "../lib/seo/v3/collectionSheet";
import { classifyCoverage } from "../lib/seo/v3/coverageClassifier";
import { parseIsoDateTime } from "../lib/seo/v3/dates";
import { sha256Hex, stableStringify } from "../lib/seo/v3/editorialCatalog";
import { SHA256_HEX, type ArtifactProvider } from "../lib/seo/v3/evidenceCheck";
import { createFactRegistry } from "../lib/seo/v3/factRegistry";
import { FACT_FILE_SCHEMA, importFactStore } from "../lib/seo/v3/factStore";
import { factMatchesRequirement } from "../lib/seo/v3/factUse";
import { SOURCE_REGISTRY_SCHEMA, parseSourceRegistry } from "../lib/seo/v3/sourceRegistry";
import { TOPIC_REQUIREMENTS, TOPIC_REQUIREMENTS_VERSION } from "../lib/seo/v3/topicRequirements";
import { LOCAL_SEO_TOPIC_SLUGS, type LocalSeoTopicSlug } from "../lib/seo/v3/topics";

/**
 * Offline preparation of a data dossier for ONE city and ONE topic (S5.4-H). It writes only into a NEW (or empty) directory
 * given to `init`, and `check` writes nothing. No network, no clock, no model.
 *
 *   npx tsx scripts/seo-v3-prepare-data.ts init  --city paris --topic pricing-guide --as-of <ISO> --out <new dir>
 *   npx tsx scripts/seo-v3-prepare-data.ts check --dir <dir> --as-of <ISO> [--evidence-dir <dir>]
 *
 * `init` prepares: a DRAFT sources.json (suspended, nothing verified), one DRAFT fact file per requirement of the topic taken
 * from the real collection sheets (required and optional kept apart), a worksheet of the human decisions still to make (NOT a
 * decision log), and prep.json (what was asked, under which requirements version). Every file carries a `_DRAFT` marker that
 * the engine refuses; a person removes it by hand, which is an explicit act.
 *
 * `check` is the pre-validation: it refuses an incomplete dossier (exit 2) and, for a complete one, only says it is ready for
 * HUMAN decisions. It never creates a source approval, a validated fact or a decision, and it writes no file. Internally it
 * runs the pure in-memory importer as a dry run; nothing is imported anywhere.
 *
 * Exit code: 0 ready for human decisions, 2 incomplete or inconsistent, 1 bad usage.
 */

const PREP_SCHEMA = "seo-v3-prep/1";
const REPORT_SCHEMA = "seo-v3-prevalidation/1";
const WORKSHEET_SCHEMA = "seo-v3-decision-worksheet/1";
const DRAFT_NOTE = "DRAFT — NOT VALIDATED. Remove this key by hand only when the file is really complete; the engine refuses the file while it is here.";

function usage(): never {
  console.error("usage: seo-v3-prepare-data.ts init --city <slug> --topic <slug> --as-of <ISO> --out <dir>\n       seo-v3-prepare-data.ts check --dir <dir> --as-of <ISO> [--evidence-dir <dir>]");
  process.exit(1);
}

/** Exactly the allowed `--flag value` pairs: nothing else, no repeats, no value that looks like a flag. */
function parseFlags(args: readonly string[], allowed: readonly string[], required: readonly string[]): Record<string, string> {
  if (args.length % 2 !== 0) usage();
  const found: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]!;
    const value = args[i + 1]!;
    if (!allowed.includes(flag) || flag in found || value.startsWith("--") || value === "") usage();
    found[flag] = value;
  }
  for (const flag of required) if (!(flag in found)) usage();
  return found;
}

const [command, ...rest] = process.argv.slice(2);

/** The orders the engine issues today for one city and one topic: the required facts, and every optional requirement asked for explicitly. */
function currentOrders(citySlug: string, countryName: string, topic: LocalSeoTopicSlug, asOf: string) {
  const spec = TOPIC_REQUIREMENTS[topic];
  const report = classifyCoverage({
    cities: [{ slug: citySlug, country: countryName }], topics: [topic], registry: createFactRegistry(), asOf, thresholdProfile: "draft-provisional", propertyType: null,
    voluntaryCollection: spec.optional.map((r) => ({ citySlug, topic, requirementId: r.requirementId })),
  });
  return { spec, report, plan: buildCollectionPlan({ orders: report.workOrders, asOf }) };
}

function initCommand(): void {
  const flags = parseFlags(rest, ["--city", "--topic", "--as-of", "--out"], ["--city", "--topic", "--as-of", "--out"]);
  const city = cities.find((c) => c.slug === flags["--city"]);
  const topic = LOCAL_SEO_TOPIC_SLUGS.find((t) => t === flags["--topic"]);
  if (city === undefined || topic === undefined || parseIsoDateTime(flags["--as-of"]) === null) usage();
  const out = resolve(flags["--out"]!);
  if (existsSync(out) && (!statSync(out).isDirectory() || readdirSync(out).length > 0)) {
    console.error("the output directory must not exist or must be empty: nothing is overwritten");
    process.exit(1);
  }
  const asOf = flags["--as-of"]!;
  const { spec, plan } = currentOrders(city.slug, city.country, topic as LocalSeoTopicSlug, asOf);
  const factRequirements = [...spec.required, ...spec.optional];
  if (plan.rejectedOrders.length > 0) {
    console.error("the engine rejected an order: nothing was written");
    process.exit(2);
  }
  mkdirSync(join(out, "facts"), { recursive: true });
  const expected = plan.sheets.map((sheet) => {
    const file = `facts/${sheet.suggestedFactId.replace(/[^A-Za-z0-9._-]/g, "_")}.json`;
    writeFileSync(join(out, file), `${JSON.stringify({ _DRAFT: DRAFT_NOTE, schemaVersion: FACT_FILE_SCHEMA, facts: [sheet.recordTemplate] }, null, 1)}\n`);
    return {
      requirementId: sheet.requirementId, required: spec.required.some((r) => r.requirementId === sheet.requirementId), workOrderId: sheet.workOrderId, requirementHash: sheet.requirementHash,
      suggestedFactId: sheet.suggestedFactId, acceptedSourceTypes: sheet.acceptedSourceTypes, file, humanSteps: sheet.humanSteps,
    };
  });
  const types = [...new Set(plan.sheets.flatMap((s) => [...s.acceptedSourceTypes]))].sort();
  const todo = "TODO";
  const sources = types.map((sourceType) => ({
    sourceId: `${todo}-${sourceType}`, publisher: todo, sourceType, status: "suspended", terms: { status: "unverified", summary: null, reference: null },
    rights: { publicTextUse: "unverified", derivativeFigures: "unverified" }, requiredRestrictions: [], allowedHosts: [], reviewedBy: todo, reviewedAt: todo, reviewValidUntil: todo, note: "DRAFT: nothing verified",
  }));
  writeFileSync(join(out, "sources.json"), `${JSON.stringify({ _DRAFT: DRAFT_NOTE, schemaVersion: SOURCE_REGISTRY_SCHEMA, sources }, null, 1)}\n`);
  writeFileSync(join(out, "prep.json"), `${JSON.stringify({
    schemaVersion: PREP_SCHEMA, city: city.slug, countryName: city.country, topic, asOf, requirementsVersion: TOPIC_REQUIREMENTS_VERSION, expected,
    notes: "Preparation only. Nothing here is a fact, a source approval or a decision.",
  }, null, 1)}\n`);
  writeFileSync(join(out, "decisions-worksheet.json"), `${JSON.stringify({
    _NOT_A_DECISION: "This worksheet is NOT a decision log and is never read by the importer. Decisions are appended by a person to decisions/*.jsonl, bound to the content hash of the final record.",
    schemaVersion: WORKSHEET_SCHEMA,
    facts: expected.map((e) => ({ requirementId: e.requirementId, factId: e.suggestedFactId, steps: ["submit", "validate (three checks + every citation read)", "approve_public_use (scope limited to the topic)"], actor: "TODO role:xxx", at: "TODO" })),
  }, null, 1)}\n`);
  writeFileSync(join(out, "README_NON_VALIDE.md"), `# ${city.slug} / ${topic} — preparation dossier (NOT VALIDATED)\n\nAsked for ${factRequirements.length} requirements; ${expected.length} sheets prepared. Complete the files by hand, then run \`check\`. Nothing here is approved.\n`);
  process.stdout.write(`${stableStringify({ created: ["README_NON_VALIDE.md", "decisions-worksheet.json", ...expected.map((e) => e.file), "prep.json", "sources.json"].sort(), city: city.slug, topic, requirementsVersion: TOPIC_REQUIREMENTS_VERSION })}\n`);
}

type Parsed = { value: Record<string, unknown> | null; marker: boolean; text: string };
function readJson(path: string): Parsed | null {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  try {
    const raw = JSON.parse(text) as unknown;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { value: null, marker: false, text };
    const { _DRAFT, ...rest } = raw as Record<string, unknown>;
    return { value: rest, marker: _DRAFT !== undefined, text: JSON.stringify(rest) };
  } catch {
    return { value: null, marker: false, text };
  }
}

function checkCommand(): void {
  const flags = parseFlags(rest, ["--dir", "--as-of", "--evidence-dir"], ["--dir", "--as-of"]);
  const asOf = flags["--as-of"]!;
  if (parseIsoDateTime(asOf) === null) usage();
  const dir = resolve(flags["--dir"]!);
  const evidenceDir = flags["--evidence-dir"] === undefined ? null : resolve(flags["--evidence-dir"]);
  const issues: string[] = [];
  const info: string[] = [];

  const prepRaw = readJson(join(dir, "prep.json"));
  const prep = prepRaw?.value as { schemaVersion?: string; city?: string; topic?: string; requirementsVersion?: string; expected?: { requirementId: string; required: boolean; requirementHash: string; workOrderId: string; file: string }[] } | null | undefined;
  if (prep === null || prep === undefined || prep.schemaVersion !== PREP_SCHEMA || !Array.isArray(prep.expected) || !LOCAL_SEO_TOPIC_SLUGS.includes(prep.topic as LocalSeoTopicSlug)) {
    issues.push("prep_missing_or_invalid");
    return finish(null);
  }
  const topic = prep.topic as LocalSeoTopicSlug;
  const spec = TOPIC_REQUIREMENTS[topic];
  const definitions = [...spec.required, ...spec.optional];
  const prepCity = cities.find((c) => c.slug === prep.city);
  const current = prepCity === undefined ? null : currentOrders(prepCity.slug, prepCity.country, topic, asOf).plan.sheets;
  if (current === null) issues.push("prep_city_unknown");
  // a global version change alone does not matter: what matters is whether each requirement and each order id is still the engine's
  if (prep.requirementsVersion !== TOPIC_REQUIREMENTS_VERSION) info.push(`prep_requirements_version_differs:${prep.requirementsVersion}->${TOPIC_REQUIREMENTS_VERSION}`);
  for (const e of prep.expected) {
    const definition = definitions.find((d) => d.requirementId === e.requirementId);
    if (definition === undefined) {
      issues.push(`requirement_no_longer_in_topic:${e.requirementId}`);
      continue;
    }
    if (sha256Hex(stableStringify(definition)) !== e.requirementHash) {
      issues.push(`requirement_definition_changed:${e.requirementId}`);
      continue;
    }
    const sheet = current?.find((x) => x.requirementId === e.requirementId);
    if (sheet !== undefined && sheet.workOrderId !== e.workOrderId) issues.push(`order_id_scheme_legacy:${e.requirementId}`);
  }

  // sources
  const sourcesRaw = readJson(join(dir, "sources.json"));
  if (sourcesRaw === null) issues.push("sources_file_missing");
  else if (sourcesRaw.value === null) issues.push("sources_file_not_json");
  if (sourcesRaw?.marker === true) issues.push("sources_draft_marker_present");
  const registry = parseSourceRegistry(sourcesRaw?.value === null || sourcesRaw === null ? null : sourcesRaw.text);
  for (const problem of registry.issues) issues.push(`sources:${problem}`);
  for (const [id, entry] of registry.entries) {
    if (entry.status !== "approved") issues.push(`source_not_approved:${id}`);
    if (entry.terms.status !== "verified_permissive") issues.push(`terms_not_verified:${id}`);
    if (entry.rights.publicTextUse === "unverified") issues.push(`text_rights_unverified:${id}`);
    if (entry.rights.derivativeFigures === "unverified") issues.push(`figure_rights_unverified:${id}`);
  }

  // facts
  const factDir = join(dir, "facts");
  const names = existsSync(factDir) ? readdirSync(factDir).filter((n) => n.endsWith(".json") && statSync(join(factDir, n)).isFile()).sort() : [];
  if (names.length === 0) issues.push("no_fact_file");
  const factFiles: { name: string; text: string }[] = [];
  for (const name of names) {
    const parsed = readJson(join(factDir, name));
    if (parsed === null || parsed.value === null) {
      issues.push(`fact_file_not_json:${name}`);
      continue;
    }
    if (parsed.marker) issues.push(`fact_draft_marker_present:${name}`);
    const records = Array.isArray((parsed.value as { facts?: unknown }).facts) ? ((parsed.value as { facts: Record<string, unknown>[] }).facts) : [];
    for (const record of records) {
      const orderId = record?.workOrderId;
      if (typeof orderId === "string" && !prep.expected.some((e) => e.workOrderId === orderId)) issues.push(`fact_work_order_not_current:${name}`);
    }
    factFiles.push({ name: `facts/${name}`, text: parsed.text });
  }
  const artifacts: ArtifactProvider = (sha) => {
    if (evidenceDir === null || !SHA256_HEX.test(sha)) return null;
    const file = join(evidenceDir, sha);
    return existsSync(file) ? new Uint8Array(readFileSync(file)) : null;
  };
  const { registry: imported, report } = importFactStore({
    factFiles, decisionLogs: [], sourceRegistryText: sourcesRaw?.value === null || sourcesRaw === undefined || sourcesRaw === null ? null : sourcesRaw.text, artifacts, asOf, requireArtifacts: true, strict: true, firstImport: true,
  });
  for (const fact of report.refused) for (const issue of fact.issues) issues.push(`fact_refused:${fact.factId ?? fact.file}:${issue.code}`);
  for (const issue of report.fileIssues) issues.push(`fact_file_issue:${issue.file}:${issue.code}`);
  for (const fact of report.accepted) if (fact.evidence === "unverified") issues.push(`evidence_unverified:${fact.factId}`);

  // expected requirements, required kept apart from optional
  const accepted = imported.list();
  for (const e of prep.expected) {
    const definition = definitions.find((d) => d.requirementId === e.requirementId);
    const present = definition !== undefined && accepted.some((fact) => factMatchesRequirement(fact, definition));
    if (!present) (e.required ? issues : info).push(`${e.required ? "required_fact_not_ready" : "optional_fact_not_ready"}:${e.requirementId}`);
  }
  return finish(prep);

  function finish(p: typeof prep | null): void {
    const blocking = [...new Set(issues)].sort();
    const ready = blocking.length === 0;
    const humanDecisionsStillRequired = ready
      ? (p?.expected ?? []).filter((e) => accepted(e)).map((e) => ({ requirementId: e.requirementId, required: e.required, steps: ["submit", "validate", "approve_public_use"] }))
      : [];
    function accepted(e: { requirementId: string }): boolean {
      return !info.includes(`optional_fact_not_ready:${e.requirementId}`);
    }
    process.stdout.write(`${stableStringify({
      schemaVersion: REPORT_SCHEMA, asOf, dir: "(as given)", city: p?.city ?? null, topic: p?.topic ?? null, requirementsVersion: TOPIC_REQUIREMENTS_VERSION,
      readyForHumanDecisions: ready, blockingIssues: blocking, notes: [...new Set(info)].sort(), humanDecisionsStillRequired,
      createsFacts: false, createsDecisions: false, approvesSources: false, imports: false, publicationAuthorised: false, indexingAuthorised: false,
      meaning: "ready means the dossier is complete and consistent for a person to decide; the facts stay drafts until human decisions are appended and imported with a baseline",
    })}\n`);
    process.exitCode = ready ? 0 : 2;
  }
}

if (command === "init") initCommand();
else if (command === "check") checkCommand();
else usage();

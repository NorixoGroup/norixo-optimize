/**
 * SEO generator V3 — local fact store (S5.3-A). Pure: text in, registry and report out. No file system, no network,
 * no clock (`asOf` is an input).
 *
 * Two kinds of record, kept apart on purpose:
 *   - FactRecord   : the CONTENT of a fact and its evidence. It never states a validation or a public-use approval:
 *                    a record carrying `validation` or `usage` is refused, so a file cannot grant itself anything.
 *   - DecisionRecord: one explicit, append-only human decision (submit, validate, reject, revoke, approve or withdraw
 *                    public use), bound to the SHA-256 of the exact record it concerns. A validation must state that
 *                    geographic, temporal and semantic applicability were checked, and which citations were read.
 *
 * The importer derives each fact's `validation` and `usage` from its decision chain, then hands the resulting
 * LocalFact to the S2 registry, which stays the only judge of admissibility. The importer NEVER creates a decision:
 * with no decision a fact is a draft, a draft never satisfies a requirement, so it never unlocks a page.
 *
 * A fact record is immutable. A correction is a new record with `version + 1` and `supersedes`; an edit in place is
 * detected (decisions no longer match, or `previousHashes` differs) and blocked, never merged silently.
 */
import { sha256Hex, stableStringify } from "./editorialCatalog";
import { parseIsoDateTime } from "./dates";
import { checkCitation, citationShapeIssues, SHA256_HEX, type ArtifactProvider, type Citation } from "./evidenceCheck";
import { createFactRegistry, type FactRegistry } from "./factRegistry";
import { checkSourceForFact, isHumanActor, parseSourceRegistry } from "./sourceRegistry";

export const FACT_FILE_SCHEMA = "seo-v3-fact-file/1";
export const FACT_RECORD_SCHEMA = "seo-v3-fact-record/1";
export const DECISION_SCHEMA = "seo-v3-decision/1";
export const IMPORT_REPORT_SCHEMA = "seo-v3-import-report/1";
export const IMPORTER_VERSION = "seo-v3-fact-store/1";

const RECORD_KEYS = [
  "schemaVersion", "factId", "kind", "scope", "platform", "propertyType", "unit", "source", "collectedAt", "observedPeriod",
  "validUntil", "confidence", "relevantTopics", "version", "supersedes", "value", "displayConstraints", "citations", "workOrderId",
] as const;
const SELF_ATTESTED_KEYS = ["validation", "usage"];
/** Sources that must be backed by at least one verified quote. Datasets and editorial notes may rely on a hash or a record alone. */
/** Words that can follow a written limit, per declared unit (English, French, Spanish, Italian, Portuguese, Dutch, German). */
const LIMIT_DAY_WORDS = "days?|jours?|d[ií]as?|giorn[oi]|dag(?:en)?|tage?n?";
const LIMIT_NIGHT_WORDS = "nights?|nuits?|noches?|nott[ei]|noites?|nacht(?:en)?|n[äa]chte";
const QUOTE_REQUIRED_SOURCE_TYPES = ["official_authority", "official_tourism_body", "published_research", "public_web_page"];

// --- records ----------------------------------------------------------------------------------------------

/** Content of a fact and its evidence. No validation, no usage approval: those only come from decisions. */
export type FactRecord = Readonly<Record<(typeof RECORD_KEYS)[number], unknown>> &
  Readonly<{ schemaVersion: typeof FACT_RECORD_SCHEMA; factId: string; citations: readonly Citation[] }>;

export type DecisionAction = "submit" | "validate" | "reject" | "revoke" | "approve_public_use" | "withdraw_public_use";

export type ValidationChecks = Readonly<{ geographic: true; temporal: true; semantic: true }>;

export type DecisionRecord = Readonly<{
  schemaVersion: typeof DECISION_SCHEMA;
  /** SHA-256 of the canonical decision without this field. */
  decisionId: string;
  factId: string;
  /** SHA-256 of the exact fact record this decision is about. */
  factContentHash: string;
  action: DecisionAction;
  /** A human role id (`role:owner`). Automated actors are refused. */
  actor: string;
  at: string;
  /** Required for reject and revoke (the reason); free for the others. */
  note: string | null;
  /** validate only: all three applicability checks were made by the actor. */
  checks: ValidationChecks | null;
  /** validate only: SHA-256 of every citation artifact the actor read (must be exactly the record's citations). */
  reviewedCitationSha256s: readonly string[] | null;
  /** approve_public_use only. */
  publicUseScope: "any_topic" | readonly string[] | null;
  /** The decision this one follows; null for the first decision of a fact. */
  previousDecisionId: string | null;
}>;

export type DecisionInput = Readonly<{
  factId: string;
  factContentHash: string;
  action: DecisionAction;
  actor: string;
  at: string;
  note?: string | null;
  checks?: ValidationChecks | null;
  reviewedCitationSha256s?: readonly string[] | null;
  publicUseScope?: "any_topic" | readonly string[] | null;
  previousDecisionId?: string | null;
}>;

const DECISION_KEYS = ["schemaVersion", "decisionId", "factId", "factContentHash", "action", "actor", "at", "note", "checks", "reviewedCitationSha256s", "publicUseScope", "previousDecisionId"];
const ACTIONS: readonly string[] = ["submit", "validate", "reject", "revoke", "approve_public_use", "withdraw_public_use"];
const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Problems of a decision (empty = well formed). Pure and static: nothing of the input is echoed. */
export function decisionProblems(raw: unknown): readonly string[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return ["decision_not_an_object"];
  const d = raw as Record<string, unknown>;
  const p: string[] = [];
  for (const key of Object.keys(d)) if (!DECISION_KEYS.includes(key)) p.push("decision_unknown_key");
  for (const key of DECISION_KEYS) if (!(key in d)) p.push("decision_missing_key");
  if (d.schemaVersion !== DECISION_SCHEMA) p.push("decision_schema_unsupported");
  if (typeof d.decisionId !== "string" || !SHA256_HEX.test(d.decisionId)) p.push("decision_id_invalid");
  if (!isText(d.factId)) p.push("decision_fact_id_invalid");
  if (typeof d.factContentHash !== "string" || !SHA256_HEX.test(d.factContentHash)) p.push("decision_fact_hash_invalid");
  if (!ACTIONS.includes(d.action as string)) p.push("decision_action_invalid");
  if (!isHumanActor(d.actor)) p.push("decision_actor_not_human");
  if (parseIsoDateTime(d.at) === null) p.push("decision_time_invalid");
  if (d.note !== null && !isText(d.note)) p.push("decision_note_invalid");
  if (d.previousDecisionId !== null && (typeof d.previousDecisionId !== "string" || !SHA256_HEX.test(d.previousDecisionId))) p.push("decision_previous_invalid");
  const action = d.action;
  const checks = d.checks as Record<string, unknown> | null;
  if (action === "validate") {
    if (typeof checks !== "object" || checks === null || Object.keys(checks).sort().join() !== "geographic,semantic,temporal" || checks.geographic !== true || checks.temporal !== true || checks.semantic !== true) {
      p.push("validation_checks_incomplete");
    }
    const reviewed = d.reviewedCitationSha256s;
    if (!Array.isArray(reviewed) || reviewed.some((s) => typeof s !== "string" || !SHA256_HEX.test(s))) p.push("validation_reviewed_citations_invalid");
  } else {
    if (d.checks !== null) p.push("checks_only_for_validation");
    if (d.reviewedCitationSha256s !== null) p.push("reviewed_citations_only_for_validation");
  }
  if (action === "reject" || action === "revoke") if (!isText(d.note)) p.push("decision_reason_required");
  if (action === "approve_public_use") {
    const scope = d.publicUseScope;
    if (!(scope === "any_topic" || (Array.isArray(scope) && scope.length > 0 && scope.every(isText)))) p.push("approval_scope_invalid");
  } else if (d.publicUseScope !== null) p.push("scope_only_for_approval");
  return [...new Set(p)].sort();
}

export function decisionIdOf(decision: Omit<DecisionRecord, "decisionId"> | DecisionRecord): string {
  const { decisionId: _ignored, ...rest } = decision as DecisionRecord;
  return sha256Hex(stableStringify(rest));
}

/**
 * Builds a decision for a person to append to the log. Pure and explicit: it is never called by the importer.
 * Throws on anything that would not survive import.
 */
export function createDecision(input: DecisionInput): DecisionRecord {
  const base = {
    schemaVersion: DECISION_SCHEMA,
    factId: input.factId,
    factContentHash: input.factContentHash,
    action: input.action,
    actor: input.actor,
    at: input.at,
    note: input.note ?? null,
    checks: input.checks ?? null,
    reviewedCitationSha256s: input.reviewedCitationSha256s === undefined || input.reviewedCitationSha256s === null ? null : [...new Set(input.reviewedCitationSha256s)].sort(),
    publicUseScope: input.publicUseScope === undefined ? null : input.publicUseScope === null || input.publicUseScope === "any_topic" ? input.publicUseScope : [...new Set(input.publicUseScope)].sort(),
    previousDecisionId: input.previousDecisionId ?? null,
  } as const;
  const draft = { ...base, decisionId: "0".repeat(64) };
  const problems = decisionProblems(draft);
  if (problems.length > 0) throw new Error(`decision_invalid:${problems.join(",")}`);
  return Object.freeze({ ...base, decisionId: decisionIdOf(base as unknown as Omit<DecisionRecord, "decisionId">) }) as DecisionRecord;
}

/** SHA-256 of the canonical record: any edit gives a new hash, which orphans the decisions bound to the old one. */
export function factContentHash(record: unknown): string {
  return sha256Hex(stableStringify(record));
}

// --- chain evaluation -----------------------------------------------------------------------------------------

type ChainState = "draft" | "pending_review" | "human_validated" | "rejected" | "revoked";

type ChainResult = Readonly<{
  /** Last decision of the chain, or null when there is none. */
  head: string | null;
  issues: readonly string[];
  state: ChainState;
  validation: Record<string, unknown>;
  use: Record<string, unknown>;
}>;

function evaluateChain(hash: string, citationShas: readonly string[], decisions: readonly DecisionRecord[], collectedAtMs: number | null, asOfMs: number): ChainResult {
  const issues = new Set<string>();
  for (const d of decisions) if (d.factContentHash !== hash) issues.add("decision_hash_mismatch");
  const byId = new Map(decisions.map((d) => [d.decisionId, d]));
  const children = new Map<string | null, DecisionRecord[]>();
  for (const d of decisions) {
    if (d.previousDecisionId !== null && !byId.has(d.previousDecisionId)) issues.add("decision_chain_broken");
    children.set(d.previousDecisionId, [...(children.get(d.previousDecisionId) ?? []), d]);
  }
  for (const list of children.values()) if (list.length > 1) issues.add("decision_fork");
  const ordered: DecisionRecord[] = [];
  if (issues.size === 0 && decisions.length > 0) {
    let current = children.get(null)?.[0];
    while (current !== undefined && ordered.length <= decisions.length) {
      ordered.push(current);
      current = children.get(current.decisionId)?.[0];
    }
    if (ordered.length !== decisions.length) issues.add("decision_chain_broken");
  }
  let state: ChainState = "draft";
  let validation: Record<string, unknown> = { status: "draft" };
  let scope: "any_topic" | readonly string[] | null = null;
  let approval: { by: string; at: string } | null = null;
  let validatedAtMs = Number.NEGATIVE_INFINITY;
  let previousAt = Number.NEGATIVE_INFINITY;
  if (issues.size === 0) {
    for (const d of ordered) {
      const at = parseIsoDateTime(d.at)!;
      if (at > asOfMs) issues.add("decision_in_future");
      if (collectedAtMs !== null && at < collectedAtMs) issues.add("decision_before_collection");
      if (at < previousAt) issues.add("decision_time_regression");
      previousAt = at;
      if (d.action === "submit" && state === "draft") {
        state = "pending_review";
        validation = { status: "pending_review", submittedAt: d.at };
      } else if (d.action === "validate" && state === "pending_review") {
        const reviewed = [...new Set(d.reviewedCitationSha256s ?? [])].sort();
        if (stableStringify(reviewed) !== stableStringify([...new Set(citationShas)].sort())) issues.add("decision_citations_not_reviewed");
        state = "human_validated";
        validatedAtMs = at;
        validation = { status: "human_validated", validatedBy: d.actor, validatedAt: d.at, note: d.note };
      } else if (d.action === "reject" && state === "pending_review") {
        state = "rejected";
        validation = { status: "rejected", rejectedAt: d.at, reason: d.note };
      } else if (d.action === "revoke" && state === "human_validated") {
        state = "revoked";
        scope = null;
        approval = null;
        validation = { status: "revoked", revokedAt: d.at, reason: d.note };
      } else if (d.action === "approve_public_use" && state === "human_validated" && scope === null) {
        if (at < validatedAtMs) issues.add("decision_time_regression");
        scope = d.publicUseScope;
        approval = { by: d.actor, at: d.at };
      } else if (d.action === "withdraw_public_use" && state === "human_validated") {
        scope = null;
        approval = null;
      } else {
        issues.add("decision_transition_invalid");
        break;
      }
    }
  }
  const use: Record<string, unknown> =
    state === "rejected" || state === "revoked"
      ? { publicUse: "forbidden" }
      : scope !== null && approval !== null
        ? { publicUse: "approved", approval: { approvedBy: approval.by, approvedAt: approval.at, scope } }
        : { publicUse: "requires_human_approval" };
  return { head: ordered.length === 0 ? null : ordered[ordered.length - 1]!.decisionId, issues: [...issues].sort(), state, validation, use };
}

// --- import -------------------------------------------------------------------------------------------------------

export type ImportInput = Readonly<{
  factFiles: readonly Readonly<{ name: string; text: string }>[];
  decisionLogs: readonly Readonly<{ name: string; text: string }>[];
  /** Text of the source registry file, or null when there is none (then every source is unregistered). */
  sourceRegistryText: string | null;
  artifacts: ArtifactProvider;
  /** Reference instant of the import; the importer never reads the clock. */
  asOf: string;
  /** Default true: a quote that cannot be checked against its artifact refuses the fact. */
  requireArtifacts?: boolean;
  /** factId → content hash of a previous accepted import: a different hash is an edit in place and is blocked. */
  previousHashes?: Readonly<Record<string, string>>;
  /** factId → last decision id of a previous accepted import: a chain that no longer contains it was rewritten. */
  previousChainHeads?: Readonly<Record<string, string | null>>;
  /**
   * Role ids allowed to decide. The log carries no signature, so this list (kept in a human-reviewed file) is the
   * only barrier against a decision written under an invented role. When given, any other actor blocks the fact.
   */
  allowedActors?: readonly string[];
  /** decisionId + factId of every decision of a previous accepted import: a missing one was deleted or rewritten. */
  previousDecisions?: readonly Readonly<{ decisionId: string; factId: string }>[];
  /**
   * Hardened mode. Every decision must come from an actor of `allowedActors` (which is then required), and an import
   * needs a baseline (the previous report) unless `firstImport` says this is the very first one. Without a baseline
   * nothing is imported. None of this authenticates a person or makes the log tamper-proof: it raises the cost of
   * silent changes and makes them visible.
   */
  strict?: boolean;
  firstImport?: boolean;
  currentTopicSlugs?: readonly string[];
}>;

export type ReportIssue = Readonly<{ code: string; detail: string | null }>;

export type AcceptedFact = Readonly<{
  factId: string;
  version: number;
  contentHash: string;
  /** Last decision of the fact's chain, to detect a rewritten history on the next import. */
  chainHead: string | null;
  state: ChainState;
  publicUse: "approved" | "requires_human_approval" | "forbidden";
  evidence: "verified" | "unverified" | "not_required";
}>;

export type RefusedFact = Readonly<{ factId: string | null; file: string; index: number; contentHash: string | null; issues: readonly ReportIssue[] }>;
export type FileIssue = Readonly<{ code: string; file: string; line: number | null; detail: string | null }>;

export type ImportReport = Readonly<{
  schemaVersion: typeof IMPORT_REPORT_SCHEMA;
  importerVersion: string;
  asOf: string;
  sourceRegistryHash: string;
  strict: boolean;
  /** "provided", or why it is absent. In strict mode an absent baseline (not declared as the first import) refuses everything. */
  baselineStatus: "provided" | "absent_first_import" | "absent_not_required" | "absent_refused";
  /** Every decision that took part in this import, sorted: the next import must still contain all of them. */
  decisions: readonly Readonly<{ decisionId: string; factId: string }>[];
  /** SHA-256 of the sorted decision ids: one value that changes when any decision is added, removed or rewritten. */
  decisionLogHash: string;
  /** True when a previous report was supplied, so edits in place, rewritten histories and deletions can be detected. */
  baselineProvided: boolean;
  storeHash: string;
  registrySnapshotId: string;
  accepted: readonly AcceptedFact[];
  refused: readonly RefusedFact[];
  fileIssues: readonly FileIssue[];
  decisionIssues: readonly FileIssue[];
  counts: Readonly<{ accepted: number; refused: number; decisions: number }>;
  /** The importer never creates a decision. Literal, so any other value is a type error. */
  decisionsCreated: 0;
  publicationAuthorised: false;
  indexingAuthorised: false;
  reportHash: string;
}>;

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const FACT_ID_PATTERN = /^fact:[A-Za-z0-9][A-Za-z0-9:_.-]{7,199}$/;

function emptyRegistry(input: ImportInput): FactRegistry {
  return createFactRegistry(input.currentTopicSlugs === undefined ? {} : { currentTopicSlugs: input.currentTopicSlugs });
}

export function registrySnapshotIdOf(registry: FactRegistry): string {
  return sha256Hex(stableStringify([...registry.list()].sort((x, y) => compare(x.factId, y.factId))));
}

/** Deterministic import of fact records and decisions into a fresh S2 registry. */
export function importFactStore(input: ImportInput): Readonly<{ registry: FactRegistry; report: ImportReport }> {
  const registry = emptyRegistry(input);
  const sources = parseSourceRegistry(input.sourceRegistryText);
  const requireArtifacts = input.requireArtifacts !== false;
  const fileIssues: FileIssue[] = sources.issues.map((detail) => ({ code: "source_registry_issue", file: "sources", line: null, detail }));
  const asOfMs = parseIsoDateTime(input.asOf);
  const refused: RefusedFact[] = [];
  const accepted: AcceptedFact[] = [];
  const decisionIssues: FileIssue[] = [];

  const decisionsById = new Map<string, DecisionRecord>();
  const baselineGiven = input.previousHashes !== undefined || input.previousChainHeads !== undefined;
  const strict = input.strict === true;
  const baselineStatus: ImportReport["baselineStatus"] = baselineGiven ? "provided" : !strict ? "absent_not_required" : input.firstImport === true ? "absent_first_import" : "absent_refused";

  const finish = (storeParts: unknown, decisionCount: number): Readonly<{ registry: FactRegistry; report: ImportReport }> => {
    const body = {
      schemaVersion: IMPORT_REPORT_SCHEMA,
      importerVersion: IMPORTER_VERSION,
      asOf: input.asOf,
      sourceRegistryHash: sources.registryHash,
      strict: input.strict === true,
      baselineStatus,
      decisions: [...decisionsById.values()].map((d) => ({ decisionId: d.decisionId, factId: d.factId })).sort((a, b) => compare(a.decisionId, b.decisionId)),
      decisionLogHash: sha256Hex(stableStringify([...decisionsById.keys()].sort())),
      baselineProvided: input.previousHashes !== undefined || input.previousChainHeads !== undefined,
      storeHash: sha256Hex(stableStringify(storeParts)),
      registrySnapshotId: registrySnapshotIdOf(registry),
      accepted: [...accepted].sort((a, b) => compare(a.factId, b.factId)),
      refused: [...refused].sort((a, b) => compare(a.factId ?? "", b.factId ?? "") || compare(a.file, b.file) || a.index - b.index),
      fileIssues: [...fileIssues].sort((a, b) => compare(a.file, b.file) || (a.line ?? 0) - (b.line ?? 0) || compare(a.code, b.code) || compare(a.detail ?? "", b.detail ?? "")),
      decisionIssues: [...decisionIssues].sort((a, b) => compare(a.file, b.file) || (a.line ?? 0) - (b.line ?? 0) || compare(a.code, b.code) || compare(a.detail ?? "", b.detail ?? "")),
      counts: { accepted: accepted.length, refused: refused.length, decisions: decisionCount },
      decisionsCreated: 0 as const,
      publicationAuthorised: false as const,
      indexingAuthorised: false as const,
    };
    const report = { ...body, reportHash: sha256Hex(stableStringify(body)) } as ImportReport;
    return Object.freeze({ registry, report: Object.freeze(report) });
  };

  if (asOfMs === null) {
    fileIssues.push({ code: "as_of_invalid", file: "input", line: null, detail: null });
    return finish({}, 0);
  }
  if (baselineStatus === "absent_refused") {
    // strict mode without a baseline: nothing is imported, so nothing can be trusted by accident
    fileIssues.push({ code: "baseline_required", file: "input", line: null, detail: "pass the previous import report, or declare the first import" });
    return finish({}, 0);
  }

  // --- decisions -------------------------------------------------------------------------------------------------
  const invalidDecisionFacts = new Set<string>();
  // a log line that cannot be attributed to a fact (not JSON, no usable factId) or that names no known fact may be a
  // lost revocation: fail closed for every fact that has any decision
  let logDefective = false;
  for (const log of [...input.decisionLogs].sort((a, b) => compare(a.name, b.name))) {
    log.text.split("\n").forEach((line, index) => {
      if (line.trim() === "") return;
      const where = { file: log.name, line: index + 1 };
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        decisionIssues.push({ code: "decision_line_not_json", ...where, detail: null });
        logDefective = true;
        return;
      }
      const problems = [...decisionProblems(parsed)];
      const actor = (parsed as { actor?: unknown } | null)?.actor;
      if (problems.length === 0 && (input.allowedActors !== undefined || strict)) {
        if (input.allowedActors === undefined) problems.push("decision_actor_allowlist_missing");
        else if (!input.allowedActors.includes(actor as string)) problems.push("decision_actor_not_allowed");
      }
      const factId = typeof (parsed as { factId?: unknown } | null)?.factId === "string" ? (parsed as { factId: string }).factId : null;
      if (problems.length === 0 && decisionIdOf(parsed as DecisionRecord) !== (parsed as DecisionRecord).decisionId) problems.push("decision_id_mismatch");
      if (problems.length > 0) {
        for (const code of problems) decisionIssues.push({ code, ...where, detail: factId });
        if (factId !== null && FACT_ID_PATTERN.test(factId)) invalidDecisionFacts.add(factId);
        else logDefective = true;
        return;
      }
      const decision = parsed as DecisionRecord;
      // the same decision appended twice is harmless: identical content has an identical id
      if (!decisionsById.has(decision.decisionId)) decisionsById.set(decision.decisionId, decision);
    });
  }
  // a decision of the previous import that is gone was deleted or rewritten: its fact cannot be trusted
  const rewrittenFacts = new Set<string>();
  for (const previous of input.previousDecisions ?? []) {
    if (!decisionsById.has(previous.decisionId)) {
      decisionIssues.push({ code: "decision_removed_since_previous", file: "decisions", line: null, detail: previous.decisionId });
      rewrittenFacts.add(previous.factId);
    }
  }
  const decisionsByFact = new Map<string, DecisionRecord[]>();
  for (const d of [...decisionsById.values()].sort((a, b) => compare(a.decisionId, b.decisionId))) {
    decisionsByFact.set(d.factId, [...(decisionsByFact.get(d.factId) ?? []), d]);
  }

  // --- records ---------------------------------------------------------------------------------------------------
  type Candidate = { file: string; index: number; raw: unknown; factId: string | null };
  const candidates: Candidate[] = [];
  for (const file of [...input.factFiles].sort((a, b) => compare(a.name, b.name))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.text);
    } catch {
      fileIssues.push({ code: "fact_file_not_json", file: file.name, line: null, detail: null });
      continue;
    }
    const f = parsed as { schemaVersion?: unknown; facts?: unknown } | null;
    if (typeof f !== "object" || f === null || f.schemaVersion !== FACT_FILE_SCHEMA || !Array.isArray(f.facts) || Object.keys(f).length !== 2) {
      fileIssues.push({ code: "fact_file_schema_invalid", file: file.name, line: null, detail: null });
      continue;
    }
    f.facts.forEach((raw, index) => {
      const id = typeof (raw as { factId?: unknown } | null)?.factId === "string" ? (raw as { factId: string }).factId : null;
      candidates.push({ file: file.name, index, raw, factId: id });
    });
  }
  // a decision naming no known fact may be a misspelt revocation: fail closed for every fact that has decisions
  const candidateIds = new Set(candidates.flatMap((c) => (c.factId === null ? [] : [c.factId])));
  for (const factId of decisionsByFact.keys()) if (!candidateIds.has(factId)) logDefective = true;
  const idCount = new Map<string, number>();
  for (const c of candidates) if (c.factId !== null) idCount.set(c.factId, (idCount.get(c.factId) ?? 0) + 1);

  type Ready = { c: Candidate; hash: string; head: string | null; evidence: AcceptedFact["evidence"]; derived: Record<string, unknown>; state: ChainState; use: Record<string, unknown> };
  const ready: Ready[] = [];
  for (const c of candidates) {
    const issues: ReportIssue[] = [];
    const add = (code: string, detail: string | null = null) => issues.push({ code, detail });
    let hash: string | null = null;
    try {
      const raw = c.raw as Record<string, unknown> | null;
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        add("record_not_an_object");
      } else {
        hash = factContentHash(raw);
        for (const key of Object.keys(raw)) {
          if (SELF_ATTESTED_KEYS.includes(key)) add("forbidden_self_attested_status", key);
          else if (!(RECORD_KEYS as readonly string[]).includes(key)) add("record_unknown_key", key);
        }
        for (const key of RECORD_KEYS) if (!(key in raw)) add("record_missing_key", key);
        if (raw.schemaVersion !== FACT_RECORD_SCHEMA) add("record_schema_unsupported");
        if (c.factId !== null && (idCount.get(c.factId) ?? 0) > 1) add("duplicate_fact_id", c.factId);
        if (c.factId === null || !FACT_ID_PATTERN.test(c.factId)) add("fact_id_missing");
        const src = raw.source as { evidence?: unknown } | null;
        if (typeof src !== "object" || src === null || Array.isArray(src) || !Array.isArray(src.evidence)) add("source_malformed");
        if (issues.length === 0) {
          const factId = c.factId!;
          if (input.previousHashes !== undefined && Object.hasOwn(input.previousHashes, factId) && input.previousHashes[factId] !== hash) add("fact_content_changed_in_place", factId);
          if (invalidDecisionFacts.has(factId)) add("decision_invalid", factId);
          if (rewrittenFacts.has(factId)) add("decision_history_rewritten", factId);
          if (logDefective && (decisionsByFact.get(factId)?.length ?? 0) > 0) add("decision_log_defective", factId);
          if (input.previousChainHeads !== undefined && Object.hasOwn(input.previousChainHeads, factId)) {
            const head = input.previousChainHeads[factId];
            if (head !== null && head !== undefined && !(decisionsByFact.get(factId) ?? []).some((d) => d.decisionId === head)) add("decision_history_rewritten", factId);
          }
          // sources
          for (const code of checkSourceForFact(sources, raw as unknown as Parameters<typeof checkSourceForFact>[1], input.asOf)) add(code);
          // citations
          const citations = raw.citations;
          let evidence: AcceptedFact["evidence"] = "not_required";
          const shas: string[] = [];
          if (!Array.isArray(citations)) add("citations_not_a_list");
          else {
            const sourceType = (raw.source as { sourceType?: unknown }).sourceType;
            if (citations.length === 0 && QUOTE_REQUIRED_SOURCE_TYPES.includes(sourceType as string)) add("citation_required");
            const anchors = new Set(((raw.source as { evidence?: unknown[] }).evidence ?? []).flatMap((a) => (a as { kind?: unknown; value?: unknown }).kind === "content_hash" ? [String((a as { value: unknown }).value)] : []));
            let unverified = false;
            for (const citation of citations) {
              const shape = citationShapeIssues(citation);
              if (shape.length > 0) {
                for (const code of shape) add(code);
                continue;
              }
              const cit = citation as Citation;
              shas.push(cit.artifactSha256);
              if (!anchors.has(cit.artifactSha256)) add("citation_hash_not_anchored", cit.artifactSha256);
              const checked = checkCitation(cit, input.artifacts);
              if (checked.status === "artifact_unavailable") {
                if (requireArtifacts) add("citation_artifact_unavailable", cit.artifactSha256);
                else unverified = true;
              } else if (checked.status !== "verified") add(`citation_${checked.status}`, cit.artifactSha256);
            }
            if (citations.length > 0) evidence = unverified ? "unverified" : "verified";
            // S5.4-L/M: a structured regulatory limit needs a cited quote that writes that very number WITH a unit of the declared kind
            // (an article number, a year or a day of the month is not a proof). This is a necessary condition only: the engine does not
            // read the meaning, so the condition, the period and the rule itself stay for the human validation of the fact.
            const limit = (raw.kind === "regulatory" ? (raw.value as { limit?: { value?: unknown; unit?: unknown } | null } | undefined)?.limit : undefined) ?? null;
            if (limit !== null && typeof limit === "object") {
              const digits = String(limit.value).replace(/[^0-9]/g, "");
              const units = limit.unit === "nights" ? LIMIT_NIGHT_WORDS : LIMIT_DAY_WORDS;
              const pattern = new RegExp(`(?<![0-9])${digits}(?![0-9])[)\\s\u00a0]{0,3}(?:${units})(?![\\p{L}])`, "iu");
              const proved = citations.some((c) => typeof (c as { quote?: unknown }).quote === "string" && pattern.test((c as { quote: string }).quote.normalize("NFC")));
              if (!proved) add("limit_not_in_citation");
            }
          }
          // decisions
          const chain = evaluateChain(hash, shas, decisionsByFact.get(factId) ?? [], parseIsoDateTime(raw.collectedAt), asOfMs);
          for (const code of chain.issues) add(code, factId);
          // a quote nobody could check must not carry a human validation or an approval
          if (evidence === "unverified" && (chain.state === "human_validated" || chain.state === "revoked")) add("evidence_unverified_blocks_validation", factId);
          if (issues.length === 0) {
            const { schemaVersion: _s, citations: _c, workOrderId: _w, displayConstraints, ...base } = raw;
            ready.push({
              c, hash, evidence, head: chain.head,
              derived: { ...base, validation: chain.validation, usage: { use: chain.use, displayConstraints } },
              state: chain.state, use: chain.use,
            });
          }
        }
      }
    } catch {
      add("record_unreadable");
    }
    if (issues.length > 0) refused.push({ factId: c.factId, file: c.file, index: c.index, contentHash: hash, issues: issues.sort((a, b) => compare(a.code, b.code) || compare(a.detail ?? "", b.detail ?? "")) });
  }

  // predecessors first: version ascending, then id; the S2 registry decides everything else
  ready.sort((a, b) => ((a.derived.version as number) ?? 0) - ((b.derived.version as number) ?? 0) || compare(a.c.factId!, b.c.factId!));
  for (const item of ready) {
    const outcome = registry.register(item.derived as never);
    if (outcome.ok) {
      accepted.push({
        factId: item.c.factId!, version: item.derived.version as number, contentHash: item.hash, chainHead: item.head, state: item.state,
        publicUse: item.use.publicUse as AcceptedFact["publicUse"], evidence: item.evidence,
      });
    } else {
      refused.push({
        factId: item.c.factId, file: item.c.file, index: item.c.index, contentHash: item.hash,
        issues: outcome.issues.map((i) => ({ code: `registry_${i.code}`, detail: `${i.path}: ${i.message}` })).sort((a, b) => compare(a.code, b.code) || compare(a.detail ?? "", b.detail ?? "")),
      });
    }
  }

  if (input.previousHashes !== undefined) {
    const present = new Set(candidates.flatMap((c) => (c.factId === null ? [] : [c.factId])));
    for (const factId of Object.keys(input.previousHashes)) {
      if (!present.has(factId)) fileIssues.push({ code: "fact_missing_since_previous", file: "facts", line: null, detail: factId });
    }
  }
  const known = new Set(candidates.flatMap((c) => (c.factId === null ? [] : [c.factId])));
  for (const [factId, list] of decisionsByFact) {
    if (!known.has(factId)) for (const d of list) decisionIssues.push({ code: "decision_unknown_fact", file: "decisions", line: null, detail: d.decisionId });
  }
  const storeParts = {
    facts: candidates.map((c) => c.raw).sort((a, b) => compare(stableStringify(a), stableStringify(b))),
    decisions: [...decisionsById.keys()].sort(),
    sources: sources.registryHash,
    requireArtifacts,
  };
  return finish(storeParts, decisionsById.size);
}

/**
 * Recomputes a report's own hash. A report edited by hand fails here, which makes it unfit as a baseline. This detects
 * accidental or careless edits only: anyone able to rewrite the report can also recompute the hash, so the hash must be
 * recorded somewhere else (for instance in a commit message) to mean anything.
 */
export function verifyImportReport(report: unknown): report is ImportReport {
  if (typeof report !== "object" || report === null || Array.isArray(report)) return false;
  const { reportHash, ...body } = report as Record<string, unknown>;
  return typeof reportHash === "string" && (body as { schemaVersion?: unknown }).schemaVersion === IMPORT_REPORT_SCHEMA && sha256Hex(stableStringify(body)) === reportHash;
}

/**
 * SEO generator V3 — closed catalogue of approved editorial blocks (S4). Pure; no clock, network or model.
 *
 * Methodological advice, editorial transitions and non-numeric hypotheses are NOT generated. They are
 * written and reviewed by a person, stored here as fixed blocks, and used verbatim. A block is usable
 * only if ALL of the following hold, checked when the catalogue is created:
 *  - stable identifier, declared language (English is the only supported one), compatible claim kind,
 *    explicit topics of use;
 *  - an explicit approval record whose `textHash` is the SHA-256 of the text, so a text edited after
 *    its approval is refused;
 *  - the text is a fixed sentence: no placeholder, no number of any kind, no comparison, trend,
 *    superlative or quantifier, English by the S3 language screen, and accepted by the S3 validator
 *    as a claim of its declared kind.
 * There is deliberately no substitution mechanism (no city name, figure, metric or recommendation can
 * be inserted into a block): a variation is a new block that goes through a new approval.
 *
 * The production catalogue below is EMPTY on purpose: approving editorial copy is a human decision that
 * has not been taken. Until it is, pages carry only rendered facts.
 *
 * Problems are reported as stable codes with the block id only when the id itself is well formed; the
 * text and every other caller-supplied value are never echoed.
 */
import { createHash } from "node:crypto";

import { analyzeClaimText, fold, hasUnsupportedScript, screenLanguage, type RiskClass } from "./claimText";
import { validateClaim } from "./claimValidation";
import { parseIsoDateTime } from "./dates";
import { createFactRegistry } from "./factRegistry";
import { snapshotUntrustedFact } from "./factValidation";
import { LOCAL_SEO_TOPIC_SLUGS, type LocalSeoTopicSlug } from "./topics";

export const SUPPORTED_ASSEMBLY_LANGUAGES = ["en"] as const;
/** The only language the S3 renderer and screens support. Localised rendering is a later, separate decision. */
export type AssemblyLanguage = (typeof SUPPORTED_ASSEMBLY_LANGUAGES)[number];

export type BlockKind = "methodological_advice" | "editorial_non_factual" | "explicit_hypothesis";
const BLOCK_KINDS: readonly BlockKind[] = ["methodological_advice", "editorial_non_factual", "explicit_hypothesis"];

export type BlockProblemCode =
  | "malformed_block"
  | "block_id_invalid"
  | "duplicate_block_id"
  | "language_not_supported"
  | "block_kind_invalid"
  | "topics_invalid"
  | "not_approved"
  | "approval_incomplete"
  | "approval_date_invalid"
  | "text_hash_mismatch"
  | "text_invalid"
  | "text_has_placeholder"
  | "text_has_number"
  | "text_language_not_verified"
  | "text_wording_refused"
  | "text_refused_by_validator"
  | "hypothesis_marker_invalid"
  | "marker_not_allowed";

export type EditorialBlock = Readonly<{
  blockId: string;
  language: AssemblyLanguage;
  kind: BlockKind;
  text: string;
  topics: readonly LocalSeoTopicSlug[];
  hypothesisMarker: string | null;
  approvedBy: string;
  approvedAt: string;
  textHash: string;
}>;

export type ExcludedBlock = Readonly<{ blockId: string | null; reasons: readonly BlockProblemCode[] }>;

export type EditorialCatalog = Readonly<{
  /** Hash of the usable blocks (ids and text hashes): identifies the exact catalogue a page was built with. */
  catalogId: string;
  blocks: readonly EditorialBlock[];
  /** Blocks supplied but not usable, with the reasons. Their text is never kept. */
  excluded: readonly ExcludedBlock[];
  /** Usable blocks for a topic and language, approved at or before `asOf`, ordered by id. */
  blocksFor: (topic: LocalSeoTopicSlug, language: AssemblyLanguage, asOf: string) => readonly EditorialBlock[];
}>;

const BLOCK_ID = /^block:[a-z0-9][a-z0-9._:-]{2,80}$/;
const LONG_DIGIT_RUN = /\d{9,}/;
const MAX_BLOCK_TEXT = 400;
const MAX_BLOCKS = 500;
const HASH = /^[0-9a-f]{64}$/;
const KEYS = ["blockId", "language", "kind", "text", "topics", "hypothesisMarker", "approval"];
const APPROVAL_KEYS = ["status", "approvedBy", "approvedAt", "textHash"];

/** Wordings that no fixed block may contain, whatever its kind: they state or imply checkable facts. */
const REFUSED_CLASSES: readonly RiskClass[] = [
  "comparison", "implicit_comparison", "trend_claim", "evolution_word", "market_superlative", "superlative_word",
  "quantifier", "pricing_advice", "average", "benchmark", "demand", "regulatory", "preference", "implicit_fact",
  "platform_authority", "vague_attribution", "generalization", "occupancy",
];

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Deterministic JSON: object keys sorted, no whitespace. For fingerprints only. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const NEUTRAL_REGISTRY_CONTEXT = {
  target: { level: "country", countryCode: "ZZ" },
  platform: null,
  propertyType: null,
  asOf: "2000-01-01T00:00:00Z",
  use: "public",
} as const;

function checkText(block: { text: string; kind: BlockKind; topics: readonly LocalSeoTopicSlug[]; hypothesisMarker: string | null }): BlockProblemCode[] {
  const problems: BlockProblemCode[] = [];
  const { text } = block;
  // raw text, before any normalisation: control, format (zero-width, bidi), line/paragraph separators and any
  // space other than the plain one cannot hide inside an approved sentence
  if (text.trim().length === 0 || text.length > MAX_BLOCK_TEXT || /[\p{Cc}\p{Cf}\u2028\u2029]|(?! )\p{Z}/u.test(text)) return ["text_invalid"];
  // every Unicode number: digits of any script, Roman numerals, circled and dingbat digits, fractions, superscripts
  if (/\p{N}/u.test(text)) return ["text_has_number"];
  if (/[{}<>$\\]|https?:|www\./i.test(text) || /\[[^\]]*\]/.test(text)) problems.push("text_has_placeholder");
  if (hasUnsupportedScript(text) || screenLanguage(text) !== "en") problems.push("text_language_not_verified");
  const analysis = analyzeClaimText(text);
  if (analysis.tokens.length > 0 || /\d/.test(fold(text))) problems.push("text_has_number");
  if ([...analysis.hits].some((name) => REFUSED_CLASSES.includes(name))) problems.push("text_wording_refused");
  if (block.kind !== "explicit_hypothesis" && block.hypothesisMarker !== null) problems.push("marker_not_allowed");
  if (problems.length > 0) return problems;
  // the S3 validator has the last word: the block must be accepted as a claim of its declared kind
  const claim =
    block.kind === "explicit_hypothesis"
      ? { claimId: "claim:catalog-check", sectionId: "catalog", kind: block.kind, text, hypothesisMarker: block.hypothesisMarker, basisFactIds: [], figures: [] }
      : { claimId: "claim:catalog-check", sectionId: "catalog", kind: block.kind, text };
  const verdict = validateClaim(claim, { ...NEUTRAL_REGISTRY_CONTEXT, topic: block.topics[0]! }, createFactRegistry());
  if (verdict.verdict !== "accepted") problems.push(block.kind === "explicit_hypothesis" && verdict.findings.some((f) => f.code.startsWith("hypothesis_marker")) ? "hypothesis_marker_invalid" : "text_refused_by_validator");
  return problems;
}

function inspect(raw: unknown): { block: EditorialBlock | null; blockId: string | null; reasons: BlockProblemCode[] } {
  const snapshot = snapshotUntrustedFact(raw);
  if (!snapshot.ok) return { block: null, blockId: null, reasons: ["malformed_block"] };
  const rec = snapshot.value;
  const blockId = typeof rec.blockId === "string" && BLOCK_ID.test(rec.blockId) && !LONG_DIGIT_RUN.test(rec.blockId) && !/[0-9a-f]{32}/.test(rec.blockId) ? rec.blockId : null;
  if (Object.keys(rec).some((key) => !KEYS.includes(key))) return { block: null, blockId, reasons: ["malformed_block"] };
  const reasons: BlockProblemCode[] = [];
  if (blockId === null) reasons.push("block_id_invalid");
  if (rec.language !== "en") reasons.push("language_not_supported");
  const kind = BLOCK_KINDS.find((candidate) => candidate === rec.kind);
  if (kind === undefined) reasons.push("block_kind_invalid");
  const topics = Array.isArray(rec.topics) && rec.topics.length > 0 && rec.topics.length <= 25 && rec.topics.every((t) => (LOCAL_SEO_TOPIC_SLUGS as readonly unknown[]).includes(t)) && new Set(rec.topics).size === rec.topics.length
    ? ([...rec.topics] as LocalSeoTopicSlug[]).sort()
    : null;
  if (topics === null) reasons.push("topics_invalid");
  if (typeof rec.text !== "string") reasons.push("text_invalid");
  const marker = rec.hypothesisMarker === undefined || rec.hypothesisMarker === null ? null : typeof rec.hypothesisMarker === "string" && rec.hypothesisMarker.length <= 60 ? rec.hypothesisMarker : undefined;
  if (marker === undefined) reasons.push("hypothesis_marker_invalid");
  if (kind === "explicit_hypothesis" && marker === null) reasons.push("hypothesis_marker_invalid");

  const approval = rec.approval as Record<string, unknown> | null | undefined;
  let approvedBy = "";
  let approvedAt = "";
  let textHash = "";
  if (typeof approval !== "object" || approval === null || Array.isArray(approval) || Object.keys(approval).some((key) => !APPROVAL_KEYS.includes(key))) {
    reasons.push("not_approved");
  } else if (approval.status !== "approved") {
    reasons.push("not_approved");
  } else {
    if (typeof approval.approvedBy !== "string" || approval.approvedBy.trim() === "" || approval.approvedBy.length > 100) reasons.push("approval_incomplete");
    else approvedBy = approval.approvedBy;
    if (typeof approval.approvedAt !== "string" || parseIsoDateTime(approval.approvedAt) === null) reasons.push("approval_date_invalid");
    else approvedAt = approval.approvedAt;
    if (typeof approval.textHash !== "string" || !HASH.test(approval.textHash)) reasons.push("approval_incomplete");
    else textHash = approval.textHash;
  }
  if (typeof rec.text === "string" && textHash !== "" && sha256Hex(rec.text) !== textHash) reasons.push("text_hash_mismatch");
  if (reasons.length === 0 && kind !== undefined && topics !== null && typeof rec.text === "string" && marker !== undefined) {
    reasons.push(...checkText({ text: rec.text, kind, topics, hypothesisMarker: marker }));
  }
  if (reasons.length > 0 || kind === undefined || topics === null || typeof rec.text !== "string" || blockId === null || marker === undefined) {
    return { block: null, blockId, reasons };
  }
  const block: EditorialBlock = Object.freeze({
    blockId, language: "en", kind, text: rec.text, topics: Object.freeze(topics), hypothesisMarker: marker, approvedBy, approvedAt, textHash,
  });
  return { block, blockId, reasons: [] };
}

/**
 * Catalogues built by `createEditorialCatalog`, by object identity. A WeakSet is private to this module: no code
 * outside it can add an object, and a Proxy or a copy of a genuine catalogue is a different object. This proves
 * that a catalogue was built by the checking function; it does NOT prove who approved the texts.
 */
const GENUINE_CATALOGS = new WeakSet<object>();

/** True only for a catalogue returned by `createEditorialCatalog`. Reads no property of its argument. */
export function isEditorialCatalog(value: unknown): value is EditorialCatalog {
  return typeof value === "object" && value !== null && GENUINE_CATALOGS.has(value);
}

/** Builds a catalogue from untrusted block records. Never throws; unusable blocks are listed in `excluded`. */
export function createEditorialCatalog(inputs: readonly unknown[]): EditorialCatalog {
  const excluded: ExcludedBlock[] = [];
  const blocks: EditorialBlock[] = [];
  const list = Array.isArray(inputs) ? inputs.slice(0, MAX_BLOCKS) : [];
  if (!Array.isArray(inputs) || inputs.length > MAX_BLOCKS) excluded.push({ blockId: null, reasons: ["malformed_block"] });
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const raw of list) {
    const { block, blockId, reasons } = inspect(raw);
    if (blockId !== null) {
      if (seen.has(blockId)) duplicates.add(blockId);
      seen.add(blockId);
    }
    if (block === null) excluded.push({ blockId, reasons: Object.freeze([...new Set(reasons)].sort()) });
    else blocks.push(block);
  }
  // an identifier used twice is ambiguous: none of its blocks is usable
  const usable = blocks.filter((block) => !duplicates.has(block.blockId)).sort((a, b) => (a.blockId < b.blockId ? -1 : 1));
  for (const id of [...duplicates].sort()) excluded.push({ blockId: id, reasons: ["duplicate_block_id"] });
  const catalogId = sha256Hex(stableStringify(usable.map((block) => [block.blockId, block.textHash, block.kind, block.topics])));
  const catalog: EditorialCatalog = Object.freeze({
    catalogId,
    blocks: Object.freeze(usable),
    excluded: Object.freeze(excluded),
    blocksFor: (topic, language, asOf) => {
      const now = parseIsoDateTime(asOf);
      if (now === null || language !== "en") return [];
      return usable.filter((block) => block.topics.includes(topic) && (parseIsoDateTime(block.approvedAt) ?? Infinity) <= now);
    },
  });
  GENUINE_CATALOGS.add(catalog);
  return catalog;
}

/** The production catalogue. Empty until a person approves editorial copy. */
export const APPROVED_EDITORIAL_CATALOG: EditorialCatalog = createEditorialCatalog([]);

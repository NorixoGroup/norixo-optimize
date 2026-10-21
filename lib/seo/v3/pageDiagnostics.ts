/**
 * SEO generator V3 — completeness and editorial differentiation of an assembled page (S4). Pure.
 *
 * These are DIAGNOSTICS. They measure; they decide nothing. There is no threshold here on purpose: what
 * amount of local, verifiable content justifies a page is an editorial decision for a person, and it is
 * independent from technical eligibility and from any indexing decision. Numbers are counts and shares of
 * what the page actually contains; a high share of generic text is reported, not penalised.
 */
import { fold } from "./claimText";
import type { FactRegistry } from "./factRegistry";
import type { GeneratedPage } from "./generatedPage";
import type { FactualSelection, UncoveredRequirement as FactUncovered } from "./factualSelection";

export type Completeness = Readonly<{
  requiredCovered: readonly string[];
  requiredUncovered: readonly FactUncovered[];
  optionalCovered: readonly string[];
  /** Optional sections left out for lack of a usable fact: omitted, never replaced by generic text. */
  optionalOmitted: readonly FactUncovered[];
  /** Every required requirement is covered by a rendered claim. Structural; not a quality judgement. */
  allRequiredCovered: boolean;
}>;

export function evaluateCompleteness(selection: FactualSelection): Completeness {
  const requiredCovered = selection.selected.filter((s) => s.required).map((s) => s.requirementId).sort();
  const optionalCovered = selection.selected.filter((s) => !s.required).map((s) => s.requirementId).sort();
  const sort = (items: readonly FactUncovered[]) => [...items].sort((a, b) => (a.requirementId < b.requirementId ? -1 : 1));
  const requiredUncovered = sort(selection.uncovered.filter((u) => u.required));
  return Object.freeze({
    requiredCovered: Object.freeze(requiredCovered),
    requiredUncovered: Object.freeze(requiredUncovered),
    optionalCovered: Object.freeze(optionalCovered),
    optionalOmitted: Object.freeze(sort(selection.uncovered.filter((u) => !u.required))),
    allRequiredCovered: requiredUncovered.length === 0,
  });
}

export const DIAGNOSTIC_NOTE =
  "Diagnostic only: no threshold, no eligibility, no indexing decision. A person decides whether this page deserves to exist.";

export type EditorialDiagnostic = Readonly<{
  /** Distinct facts specific to the city or district of the page. */
  cityFactCount: number;
  /** Distinct facts that only describe the whole country. */
  countryFactCount: number;
  factualClaimCount: number;
  /** Sections carrying at least one rendered fact. */
  supportedSectionCount: number;
  /** Claims that come from the fixed catalogue (advice, transitions, hypotheses): generic by construction. */
  genericBlockCount: number;
  genericBlockIds: readonly string[];
  /** Characters of rendered facts over characters of all claims, 0..1 (4 decimals); null for an empty page. A description of the text, not evidence of quality or originality. */
  localVerifiableShare: number | null;
  /** Requirements without a section, with the cause. */
  missingSections: readonly FactUncovered[];
  note: typeof DIAGNOSTIC_NOTE;
}>;

export function diagnosePage(page: GeneratedPage, registry: FactRegistry, completeness: Completeness): EditorialDiagnostic {
  const claims = page.sections.flatMap((section) => section.claims);
  const factual = claims.filter((claim) => claim.kind === "factual");
  const generic = claims.filter((claim) => claim.kind !== "factual");
  const chars = (list: readonly { text: string }[]) => list.reduce((sum, claim) => sum + claim.text.length, 0);
  const facts = page.usedFactIds.map((id) => registry.get(id)).filter((fact): fact is NonNullable<typeof fact> => fact !== undefined);
  const total = chars(claims);
  return Object.freeze({
    cityFactCount: facts.filter((fact) => fact.scope.level !== "country").length,
    countryFactCount: facts.filter((fact) => fact.scope.level === "country").length,
    factualClaimCount: factual.length,
    supportedSectionCount: page.sections.filter((section) => section.claims.some((claim) => claim.kind === "factual")).length,
    genericBlockCount: generic.length,
    genericBlockIds: Object.freeze(generic.map((claim) => `block:${claim.claimId.replace(/^claim:blk:/, "")}`).sort()),
    localVerifiableShare: total === 0 ? null : Math.round((chars(factual) / total) * 10000) / 10000,
    missingSections: Object.freeze([...completeness.requiredUncovered, ...completeness.optionalOmitted]),
    note: DIAGNOSTIC_NOTE,
  });
}

// --- Repetition between pages ---------------------------------------------------------------------

export const REPETITION_NOTE =
  "Descriptive only. Template similarity compares sentence structure with city names, country codes and numbers masked; local text share is the share of rendered-fact characters, not evidence of quality or originality; none of this is a publication or indexing decision.";

export type RepetitionPair = Readonly<{
  a: string;
  b: string;
  /** Jaccard similarity of 4-word shingles of the raw claim text, 0..1 (4 decimals). Includes city names and figures. */
  rawTextSimilarity: number;
  /** The same measure after masking geography and numbers: pages that differ only by city and figures score 1. */
  templateSimilarity: number;
  /** Both pages have exactly the same structure once geography and numbers are masked. A fact, not a threshold. */
  templateIdentical: boolean;
  /** Characters of rendered facts over characters of all claims (0..1, 4 decimals), per page; null for an empty page. */
  localTextShare: Readonly<{ a: number | null; b: number | null }>;
  /** Block ids used by both pages. */
  sharedBlockIds: readonly string[];
  /** Identical claim texts on both pages (facts and blocks), compared without case. */
  identicalClaimCount: number;
}>;

export type RepetitionReport = Readonly<{
  pairs: readonly RepetitionPair[];
  /** Highest template similarity of each page against any other. */
  maxTemplateSimilarityByPage: Readonly<Record<string, number>>;
  /** Page keys given more than once: nothing is compared in that case (the report would depend on input order). */
  duplicateKeys: readonly string[];
  note: typeof REPETITION_NOTE;
}>;

const words = (text: string): string[] => fold(text).match(/[a-z0-9]+/g) ?? [];

/**
 * Word sequence of a page with geography and numbers masked: the page's structure. Masked: the page's own city slug
 * wherever it is written in full, the place phrase of a rendered fact ("In <place>, <CC> ("), two-letter upper-case
 * country codes, and every word containing a digit. Words that merely resemble a slug (a publisher's name) stay.
 */
function templateWords(page: GeneratedPage): string[] {
  const slug = typeof page.citySlug === "string" && page.citySlug.length > 0 ? page.citySlug.toLowerCase() : null;
  return page.sections
    .flatMap((section) => section.claims)
    .flatMap((claim) => {
      let text = claim.text.replace(/\bIn [^(]{1,200}?, [A-Z]{2} \(/g, "In @ (").replace(/\b[A-Z]{2}\b/g, " @ ");
      if (slug !== null) text = text.split(new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")).join(" @ ");
      return words(text).map((word) => (/\d/.test(word) ? "#" : word));
    });
}

function shingleSet(sequence: readonly string[]): Set<string> {
  const found = new Set<string>();
  // a page shorter than one shingle is compared as a whole, instead of being invisible
  if (sequence.length > 0 && sequence.length < 4) found.add(sequence.join(" "));
  for (let i = 0; i + 4 <= sequence.length; i += 1) found.add(sequence.slice(i, i + 4).join(" "));
  return found;
}

function jaccard(x: Set<string>, y: Set<string>): number {
  if (x.size === 0 && y.size === 0) return 1; // two empty pages are identical, not "different"
  const inter = [...x].filter((item) => y.has(item)).length;
  return Math.round((inter / (x.size + y.size - inter)) * 10000) / 10000;
}

function rawWords(page: GeneratedPage): string[] {
  return page.sections.flatMap((section) => section.claims).flatMap((claim) => words(claim.text));
}

function localShare(page: GeneratedPage): number | null {
  const claims = page.sections.flatMap((section) => section.claims);
  const total = claims.reduce((sum, claim) => sum + claim.text.length, 0);
  const local = claims.filter((claim) => claim.kind === "factual").reduce((sum, claim) => sum + claim.text.length, 0);
  return total === 0 ? null : Math.round((local / total) * 10000) / 10000;
}

const blockClaimIds = (page: GeneratedPage): Set<string> =>
  new Set(page.sections.flatMap((section) => section.claims).filter((claim) => claim.claimId.startsWith("claim:blk:")).map((claim) => claim.claimId));

const byKey = (x: { key: string }, y: { key: string }): number => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0);

/** Pairwise repetition of the given pages (keys are caller labels such as a city slug). Symmetric, order-independent, deterministic. */
export function comparePages(items: readonly { key: string; page: GeneratedPage }[]): RepetitionReport {
  const keys = items.map((item) => item.key);
  const duplicateKeys = [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))].sort();
  if (duplicateKeys.length > 0) {
    return Object.freeze({ pairs: Object.freeze([]), maxTemplateSimilarityByPage: Object.freeze({}), duplicateKeys: Object.freeze(duplicateKeys), note: REPETITION_NOTE });
  }
  const prepared = [...items].sort(byKey).map((item) => ({
    key: item.key,
    raw: shingleSet(rawWords(item.page)),
    template: shingleSet(templateWords(item.page)),
    blocks: blockClaimIds(item.page),
    texts: new Set(item.page.sections.flatMap((section) => section.claims).map((claim) => fold(claim.text).trim())),
    share: localShare(item.page),
  }));
  const pairs: RepetitionPair[] = [];
  const max: Record<string, number> = Object.fromEntries(prepared.map((p) => [p.key, 0]));
  for (let i = 0; i < prepared.length; i += 1) {
    for (let j = i + 1; j < prepared.length; j += 1) {
      const a = prepared[i]!;
      const b = prepared[j]!;
      const template = jaccard(a.template, b.template);
      pairs.push({
        a: a.key,
        b: b.key,
        rawTextSimilarity: jaccard(a.raw, b.raw),
        templateSimilarity: template,
        templateIdentical: template === 1,
        localTextShare: { a: a.share, b: b.share },
        sharedBlockIds: Object.freeze([...a.blocks].filter((id) => b.blocks.has(id)).map((id) => `block:${id.replace(/^claim:blk:/, "")}`).sort()),
        identicalClaimCount: [...a.texts].filter((text) => b.texts.has(text)).length,
      });
      max[a.key] = Math.max(max[a.key]!, template);
      max[b.key] = Math.max(max[b.key]!, template);
    }
  }
  return Object.freeze({ pairs: Object.freeze(pairs), maxTemplateSimilarityByPage: Object.freeze(max), duplicateKeys: Object.freeze([]), note: REPETITION_NOTE });
}

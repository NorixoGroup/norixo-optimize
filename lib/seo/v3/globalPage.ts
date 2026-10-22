/**
 * SEO generator V3 — global (non-geolocated) method page (S5.4-P). Pure; no clock, network, model or data file.
 *
 * A global page is methodology: no city, no country, no local fact, no statistic. It is described as DATA
 * (a spec), checked, and returned as a draft that still needs a person. Rules, all checked here:
 *  - scope is "global"; the page has no city and no default city; place names are refused when the caller lists them;
 *  - prose has no digit, currency or percent sign, and avoids the factual wordings S3 screens (averages, trends,
 *    superlatives, platform authority, guarantees, …). Factual claims about the world are therefore not possible in a
 *    global page yet; a sourced external claim would need its own contract and is NOT added here;
 *  - numbers appear only in a hypothetical illustration: its assumptions are declared, every result is computed by
 *    this module from the structure, and the disclaimer is added by the renderer (an author cannot omit or alter it).
 *    An illustration is flagged `usableAsEvidence: false` and carries no fact id;
 *  - the draft is never publishable: a human editorial validation is always required.
 * Language: English (the only language the S3 screens support).
 */
import { analyzeClaimText, fold, hasUnsupportedScript, screenLanguage, type RiskClass } from "./claimText";
import { sha256Hex, stableStringify } from "./editorialCatalog";
import { LOCAL_SEO_TOPIC_SLUGS, type LocalSeoTopicSlug } from "./topics";

export const GLOBAL_PAGE_VERSION = "seo-v3-global-page/1";

export const ILLUSTRATION_DISCLAIMER = "Hypothetical example: every number below is invented for this illustration. It is not market data and not a result.";

export type GlobalSectionRole = "introduction" | "method" | "example" | "common_mistakes" | "checklist" | "faq" | "call_to_action";
export type GlobalOp = "add" | "sub" | "mul" | "div";
export type GlobalAssumption = Readonly<{ key: string; label: string; value: number; unit: string }>;
export type GlobalCalcStep = Readonly<{ key: string; label: string; op: GlobalOp; a: string; b: string; unit: string; display: "number" | "percent" }>;
export type GlobalBlock =
  | Readonly<{ kind: "prose"; id: string; text: string }>
  | Readonly<{ kind: "steps"; id: string; items: readonly string[] }>
  | Readonly<{ kind: "checklist"; id: string; items: readonly string[] }>
  | Readonly<{ kind: "faq"; id: string; question: string; answer: string }>
  | Readonly<{ kind: "illustration"; id: string; title: string; assumptions: readonly GlobalAssumption[]; steps: readonly GlobalCalcStep[]; reading: string }>;
export type GlobalSection = Readonly<{ sectionId: string; role: GlobalSectionRole; heading: string; blocks: readonly GlobalBlock[] }>;
export type GlobalPageSpec = Readonly<{
  scope: "global";
  topic: LocalSeoTopicSlug;
  language: "en";
  h1: string;
  searchIntent: string;
  sections: readonly GlobalSection[];
  callToAction: Readonly<{ text: string }>;
}>;

export type GlobalPageReason =
  | "malformed_spec" | "scope_not_global" | "unknown_topic" | "language_not_supported" | "duplicate_id" | "unexpected_field"
  | "digit_in_prose" | "factual_wording" | "place_name_in_global_page" | "text_too_long" | "text_empty" | "language_not_verified"
  | "illustration_invalid" | "illustration_unresolved_reference" | "illustration_arithmetic" | "illustration_wording"
  | "missing_role" | "too_few_faq" | "call_to_action_invalid" | "section_empty";

export type RenderedItem =
  | Readonly<{ kind: "paragraph" | "numbered" | "checkbox" | "question" | "answer"; text: string }>
  | Readonly<{ kind: "illustration"; title: string; disclaimer: string; lines: readonly string[]; reading: string; usableAsEvidence: false }>;
export type RenderedSection = Readonly<{ sectionId: string; role: GlobalSectionRole; heading: string; items: readonly RenderedItem[] }>;

export type GlobalPage = Readonly<{
  version: typeof GLOBAL_PAGE_VERSION;
  status: "pending_human_editorial_validation" | "refused";
  reasons: readonly GlobalPageReason[];
  scope: "global";
  citySlug: null;
  topic: LocalSeoTopicSlug | null;
  h1: string | null;
  searchIntent: string | null;
  sections: readonly RenderedSection[];
  callToAction: string | null;
  metrics: Readonly<{ words: number; sections: number; faqEntries: number; checklistItems: number; illustrations: number }> | null;
  contentHash: string | null;
  humanEditorialValidationRequired: true;
  publishable: false;
  publicationAuthorised: false;
  indexingAuthorised: false;
}>;

export type GlobalPageOptions = Readonly<{ placeNames?: readonly string[] }>;

/** Provisional structure of a useful method page (a person decides). */
export const GLOBAL_REQUIRED_ROLES: readonly GlobalSectionRole[] = ["introduction", "method", "common_mistakes", "checklist", "faq"];
export const GLOBAL_MIN_FAQ_ENTRIES = 3;
const MAX_TEXT = 1200;
const MAX_ID = 80;

/**
 * S3 risk classes that mark a statement about the world (statistics, markets, platforms, rules, guarantees). A method page
 * may not state any. Advice wordings ("every", "should", "because") are NOT refused: S3 screens them for FACTUAL text, but
 * a method is made of advice. The cost is a documented gap: a factual claim hidden in advice wording is not detected.
 */
const FORBIDDEN_CLASSES: readonly RiskClass[] = [
  "average", "trend_claim", "comparison", "market_superlative", "regulatory", "demand", "platform_authority", "vague_attribution",
  "guarantee", "certainty", "observation", "implicit_fact", "benchmark", "future_effect", "implicit_comparison",
];

const deepFreeze = <T,>(value: T): T => {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const hasOnly = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).every((key) => keys.includes(key));
const DIGIT_OR_SIGN = /[\p{Nd}%€$£¥]/u;
const KEY = /^[a-z][a-z0-9_]{0,30}$/;

const refused = (reasons: Iterable<GlobalPageReason>): GlobalPage =>
  deepFreeze({
    version: GLOBAL_PAGE_VERSION, status: "refused", reasons: [...new Set(reasons)].sort(), scope: "global", citySlug: null, topic: null, h1: null, searchIntent: null, sections: [],
    callToAction: null, metrics: null, contentHash: null, humanEditorialValidationRequired: true, publishable: false, publicationAuthorised: false, indexingAuthorised: false,
  } as GlobalPage);

/** Whole-word match of a place name, punctuation ignored ("Paris," matches). */
const words = (text: string): string => ` ${fold(text).replace(/[^a-z0-9]+/g, " ").trim()} `;
const mentionsPlace = (text: string, places: readonly string[]): boolean => places.some((place) => words(place).trim() !== "" && words(text).includes(words(place)));

/** Prose checks shared by every authored sentence. */
function proseProblems(text: unknown, places: readonly string[]): GlobalPageReason[] {
  if (typeof text !== "string" || text.trim() === "") return ["text_empty"];
  const out: GlobalPageReason[] = [];
  if (text.length > MAX_TEXT) out.push("text_too_long");
  if (DIGIT_OR_SIGN.test(text)) out.push("digit_in_prose");
  // English is declared; the heuristic can only recognise French, so "undetermined" passes (documented gap)
  if (hasUnsupportedScript(text) || screenLanguage(text) === "fr") out.push("language_not_verified");
  const analysis = analyzeClaimText(text);
  if (analysis.tokens.some((token) => !token.structural) || FORBIDDEN_CLASSES.some((cls) => analysis.hits.has(cls))) out.push("factual_wording");
  if (mentionsPlace(text, places)) out.push("place_name_in_global_page");
  return out;
}

/** Labels and units are too short for the language screen: letters only, no digit, no place name. */
const shortLabel = (text: unknown, places: readonly string[]): boolean =>
  typeof text === "string" && /^[A-Za-z][A-Za-z -]{0,59}$/.test(text) && !mentionsPlace(text, places);
const shortUnit = (text: unknown): boolean => typeof text === "string" && /^[A-Za-z ]{0,20}$/.test(text);

type Evaluated = Readonly<{ value: number; unit: string }>;

function renderNumber(value: number, display: "number" | "percent"): string {
  const shown = display === "percent" ? value * 100 : value;
  const rounded = Math.round(shown * 100) / 100;
  return display === "percent" ? `${rounded}%` : String(rounded);
}

/** Evaluates an illustration from its structure; every result is computed here, never typed by an author. */
function evaluateIllustration(block: Extract<GlobalBlock, { kind: "illustration" }>, places: readonly string[], reasons: Set<GlobalPageReason>): readonly string[] | null {
  const values = new Map<string, Evaluated>();
  const lines: string[] = [];
  for (const assumption of block.assumptions) {
    if (!KEY.test(assumption.key) || values.has(assumption.key) || typeof assumption.value !== "number" || !Number.isFinite(assumption.value) || Math.abs(assumption.value) > 1e9) {
      reasons.add("illustration_invalid");
      return null;
    }
    if (!shortLabel(assumption.label, places) || !shortUnit(assumption.unit)) reasons.add("illustration_wording");
    values.set(assumption.key, { value: assumption.value, unit: assumption.unit });
    lines.push(`Assumption: ${assumption.label} = ${renderNumber(assumption.value, "number")}${assumption.unit === "" ? "" : ` ${assumption.unit}`}`);
  }
  for (const step of block.steps) {
    const a = values.get(step.a);
    const b = values.get(step.b);
    if (!KEY.test(step.key) || values.has(step.key) || !["add", "sub", "mul", "div"].includes(step.op) || !["number", "percent"].includes(step.display)) {
      reasons.add("illustration_invalid");
      return null;
    }
    if (a === undefined || b === undefined) {
      reasons.add("illustration_unresolved_reference");
      return null;
    }
    if (!shortLabel(step.label, places) || !shortUnit(step.unit)) reasons.add("illustration_wording");
    const result = step.op === "add" ? a.value + b.value : step.op === "sub" ? a.value - b.value : step.op === "mul" ? a.value * b.value : b.value === 0 ? Number.NaN : a.value / b.value;
    if (!Number.isFinite(result) || Math.abs(result) > 1e12) {
      reasons.add("illustration_arithmetic");
      return null;
    }
    values.set(step.key, { value: result, unit: step.unit });
    const symbol = step.op === "add" ? "+" : step.op === "sub" ? "-" : step.op === "mul" ? "x" : "/";
    lines.push(`Calculation: ${step.label} = ${step.a} ${symbol} ${step.b} = ${renderNumber(result, step.display)}${step.unit === "" || step.display === "percent" ? "" : ` ${step.unit}`}`);
  }
  return lines;
}

export function assembleGlobalPage(input: unknown, options: GlobalPageOptions = {}): GlobalPage {
  try {
    if (!isObject(input)) return refused(["malformed_spec"]);
    if (!hasOnly(input, ["scope", "topic", "language", "h1", "searchIntent", "sections", "callToAction"])) return refused(["unexpected_field"]);
    if (input.scope !== "global") return refused(["scope_not_global"]);
    if (typeof input.topic !== "string" || !(LOCAL_SEO_TOPIC_SLUGS as readonly string[]).includes(input.topic)) return refused(["unknown_topic"]);
    if (input.language !== "en") return refused(["language_not_supported"]);
    if (!Array.isArray(input.sections) || !isObject(input.callToAction)) return refused(["malformed_spec"]);
    const places = (options.placeNames ?? []).filter((name) => typeof name === "string" && name.trim() !== "");
    const reasons = new Set<GlobalPageReason>();
    const check = (text: unknown) => proseProblems(text, places).forEach((r) => reasons.add(r));

    check(input.h1);
    check(input.searchIntent);
    const callToAction = input.callToAction;
    if (!hasOnly(callToAction, ["text"])) reasons.add("call_to_action_invalid");
    else {
      check(callToAction.text);
      if (typeof callToAction.text === "string" && (callToAction.text.length > 200 || /[!]/.test(callToAction.text))) reasons.add("call_to_action_invalid");
    }

    const ids = new Set<string>();
    const unique = (id: unknown): void => {
      if (typeof id !== "string" || id === "" || id.length > MAX_ID || ids.has(id)) reasons.add("duplicate_id");
      else ids.add(id);
    };
    const roles = new Set<GlobalSectionRole>();
    const rendered: RenderedSection[] = [];
    let words = 0;
    let faqEntries = 0;
    let checklistItems = 0;
    let illustrations = 0;
    const count = (text: string) => { words += text.split(/\s+/).filter(Boolean).length; };

    for (const section of input.sections as unknown[]) {
      if (!isObject(section) || !hasOnly(section, ["sectionId", "role", "heading", "blocks"]) || !Array.isArray(section.blocks)) { reasons.add("malformed_spec"); continue; }
      unique(section.sectionId);
      const role = section.role as GlobalSectionRole;
      if (!["introduction", "method", "example", "common_mistakes", "checklist", "faq", "call_to_action"].includes(role)) { reasons.add("malformed_spec"); continue; }
      roles.add(role);
      check(section.heading);
      if (section.blocks.length === 0) reasons.add("section_empty");
      const items: RenderedItem[] = [];
      for (const block of section.blocks as unknown[]) {
        if (!isObject(block)) { reasons.add("malformed_spec"); continue; }
        unique(block.id);
        if (block.kind === "prose" && hasOnly(block, ["kind", "id", "text"])) {
          check(block.text);
          if (typeof block.text === "string") { items.push({ kind: "paragraph", text: block.text }); count(block.text); }
        } else if ((block.kind === "steps" || block.kind === "checklist") && hasOnly(block, ["kind", "id", "items"]) && Array.isArray(block.items) && block.items.length > 0) {
          for (const item of block.items as unknown[]) {
            check(item);
            if (typeof item === "string") { items.push({ kind: block.kind === "steps" ? "numbered" : "checkbox", text: item }); count(item); if (block.kind === "checklist") checklistItems += 1; }
          }
        } else if (block.kind === "faq" && hasOnly(block, ["kind", "id", "question", "answer"])) {
          check(block.question);
          check(block.answer);
          if (typeof block.question === "string" && typeof block.answer === "string") { items.push({ kind: "question", text: block.question }, { kind: "answer", text: block.answer }); count(block.question); count(block.answer); faqEntries += 1; }
        } else if (block.kind === "illustration" && hasOnly(block, ["kind", "id", "title", "assumptions", "steps", "reading"]) && Array.isArray(block.assumptions) && Array.isArray(block.steps) && block.steps.length > 0) {
          check(block.title);
          check(block.reading);
          const shape = block.assumptions.every((a) => isObject(a) && hasOnly(a, ["key", "label", "value", "unit"])) && block.steps.every((s) => isObject(s) && hasOnly(s, ["key", "label", "op", "a", "b", "unit", "display"]));
          if (!shape) { reasons.add("illustration_invalid"); continue; }
          const lines = evaluateIllustration(block as unknown as Extract<GlobalBlock, { kind: "illustration" }>, places, reasons);
          if (lines !== null) {
            illustrations += 1;
            items.push({ kind: "illustration", title: String(block.title), disclaimer: ILLUSTRATION_DISCLAIMER, lines, reading: String(block.reading), usableAsEvidence: false });
            count(String(block.title)); count(String(block.reading)); lines.forEach(count);
          }
        } else reasons.add("malformed_spec");
      }
      rendered.push({ sectionId: String(section.sectionId), role, heading: String(section.heading), items });
      count(String(section.heading));
    }
    for (const role of GLOBAL_REQUIRED_ROLES) if (!roles.has(role)) reasons.add("missing_role");
    if (faqEntries < GLOBAL_MIN_FAQ_ENTRIES) reasons.add("too_few_faq");
    if (reasons.size > 0) return refused(reasons);

    const metrics = { words, sections: rendered.length, faqEntries, checklistItems, illustrations };
    const body = { h1: input.h1, topic: input.topic, sections: rendered, callToAction: callToAction.text };
    return deepFreeze({
      version: GLOBAL_PAGE_VERSION, status: "pending_human_editorial_validation", reasons: [], scope: "global", citySlug: null, topic: input.topic as LocalSeoTopicSlug,
      h1: input.h1 as string, searchIntent: input.searchIntent as string, sections: rendered, callToAction: callToAction.text as string, metrics, contentHash: sha256Hex(stableStringify(body)),
      humanEditorialValidationRequired: true, publishable: false, publicationAuthorised: false, indexingAuthorised: false,
    } as GlobalPage);
  } catch {
    return refused(["malformed_spec"]);
  }
}

/** Plain text of the page, in order (for review and similarity). */
export function renderGlobalPageText(page: GlobalPage): string {
  if (page.status === "refused") return "";
  const out: string[] = [`# ${page.h1}`, ""];
  for (const section of page.sections) {
    out.push(`## ${section.heading}`);
    let n = 0;
    for (const item of section.items) {
      if (item.kind === "paragraph") out.push("", item.text);
      else if (item.kind === "numbered") out.push(`${++n}. ${item.text}`);
      else if (item.kind === "checkbox") out.push(`- [ ] ${item.text}`);
      else if (item.kind === "question") out.push("", `**${item.text}**`);
      else if (item.kind === "answer") out.push(item.text);
      else if (item.kind === "illustration") out.push("", `**${item.title}**`, `_${item.disclaimer}_`, ...item.lines.map((line) => `- ${line}`), "", item.reading);
    }
    out.push("");
  }
  out.push("---", page.callToAction ?? "");
  return out.join("\n");
}

// --- similarity ------------------------------------------------------------------------------------------------

export const PROVISIONAL_SIMILARITY_THRESHOLD = Object.freeze({ shingleWords: 6, maxJaccard: 0.5, basis: "provisional_pending_human_decision" as const });

const shingles = (text: string): Set<string> => {
  const words = fold(text).split(/[^a-z]+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + PROVISIONAL_SIMILARITY_THRESHOLD.shingleWords <= words.length; i += 1) out.add(words.slice(i, i + PROVISIONAL_SIMILARITY_THRESHOLD.shingleWords).join(" "));
  return out;
};

/** Jaccard similarity of 6-word shingles of two texts, 0..1. Template copies score high. */
export function textSimilarity(a: string, b: string): number {
  const x = shingles(a);
  const y = shingles(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const item of x) if (y.has(item)) shared += 1;
  return Math.round((shared / (x.size + y.size - shared)) * 10000) / 10000;
}

export const tooSimilar = (a: string, b: string): boolean => textSimilarity(a, b) > PROVISIONAL_SIMILARITY_THRESHOLD.maxJaccard;

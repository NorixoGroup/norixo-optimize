/**
 * SEO generator V3 — source registry (S5.3-A). Pure.
 *
 * A fact may only cite a source that a person has reviewed and registered. The registry states what the source is,
 * what its terms allow and until when that review holds. Fail closed: a source that is missing, excluded,
 * suspended, past its review date, of another type, on another host, or with unverified rights is refused.
 *
 * This module judges SOURCES. Whether a fact is valid is still decided by the S2 registry.
 */
import { sha256Hex, stableStringify } from "./editorialCatalog";
import type { FactSource, FactSourceType, PublicationRestrictionCode, TermsOfUseStatus } from "./factSource";
import { parseIsoDateTime } from "./dates";

export const SOURCE_REGISTRY_SCHEMA = "seo-v3-source-registry/1";

/** Roles that are people. An actor is a role id, never a personal name, and never an automated process. */
const ACTOR_PATTERN = /^role:[a-z][a-z0-9-]{1,30}$/;
const AUTOMATED_ACTORS = ["system", "importer", "script", "auto", "automation", "bot", "claude", "ai", "model", "agent", "cron", "ci"];

export function isHumanActor(actor: unknown): actor is string {
  if (typeof actor !== "string" || !ACTOR_PATTERN.test(actor)) return false;
  const name = actor.slice("role:".length);
  return !AUTOMATED_ACTORS.some((word) => name === word || name.startsWith(`${word}-`) || name.endsWith(`-${word}`));
}

export type SourceStatus = "approved" | "suspended" | "excluded";
export type RightLevel = "permitted" | "permitted_with_attribution" | "not_permitted" | "unverified";
export type FigureRight = "permitted" | "not_permitted" | "unverified";

export type SourceRegistryEntry = Readonly<{
  sourceId: string;
  publisher: string;
  sourceType: FactSourceType;
  status: SourceStatus;
  terms: Readonly<{ status: TermsOfUseStatus; summary: string | null; reference: string | null }>;
  rights: Readonly<{ publicTextUse: RightLevel; derivativeFigures: FigureRight }>;
  /** Restrictions every fact citing this source must repeat. */
  requiredRestrictions: readonly PublicationRestrictionCode[];
  /** Exact host names (no wildcard) that a URL locator may use; empty when the source has no URL. */
  allowedHosts: readonly string[];
  reviewedBy: string;
  reviewedAt: string;
  /** The rights review stops holding after this instant. */
  reviewValidUntil: string;
  note: string | null;
}>;

export type SourceIssueCode =
  | "source_not_registered"
  | "source_excluded"
  | "source_suspended"
  | "source_review_expired"
  | "source_review_in_future"
  | "source_type_mismatch"
  | "source_publisher_mismatch"
  | "source_rights_insufficient"
  | "source_figure_rights_insufficient"
  | "source_terms_mismatch"
  | "source_host_not_allowed"
  | "source_restrictions_missing";

export type SourceRegistry = Readonly<{
  entries: ReadonlyMap<string, SourceRegistryEntry>;
  /** Problems found while reading the registry; an entry with a problem is not usable. */
  issues: readonly string[];
  registryHash: string;
}>;

const SOURCE_TYPES: readonly string[] = ["official_authority", "official_tourism_body", "licensed_dataset", "published_research", "public_web_page", "editorial_note", "user_audit_aggregate"];
const RESTRICTIONS: readonly string[] = ["attribution_required", "no_public_use", "no_derivative_figures", "aggregate_only", "requires_licence_check"];
const ENTRY_KEYS = ["sourceId", "publisher", "sourceType", "status", "terms", "rights", "requiredRestrictions", "allowedHosts", "reviewedBy", "reviewedAt", "reviewValidUntil", "note"];
const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

function entryProblems(raw: unknown): { entry: SourceRegistryEntry | null; problems: string[]; id: string } {
  const problems: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { entry: null, problems: ["entry_not_an_object"], id: "<invalid>" };
  const e = raw as Record<string, unknown>;
  const id = typeof e.sourceId === "string" ? e.sourceId : "<invalid>";
  for (const key of Object.keys(e)) if (!ENTRY_KEYS.includes(key)) problems.push(`unknown_key:${key}`);
  for (const key of ENTRY_KEYS) if (!(key in e)) problems.push(`missing_key:${key}`);
  if (!isText(e.sourceId)) problems.push("sourceId_invalid");
  if (!isText(e.publisher)) problems.push("publisher_invalid");
  if (!SOURCE_TYPES.includes(e.sourceType as string)) problems.push("sourceType_invalid");
  if (!["approved", "suspended", "excluded"].includes(e.status as string)) problems.push("status_invalid");
  const terms = e.terms as Record<string, unknown> | null;
  if (typeof terms !== "object" || terms === null || !["verified_permissive", "verified_restrictive", "unverified"].includes(terms.status as string)) problems.push("terms_invalid");
  const rights = e.rights as Record<string, unknown> | null;
  if (
    typeof rights !== "object" || rights === null ||
    !["permitted", "permitted_with_attribution", "not_permitted", "unverified"].includes(rights.publicTextUse as string) ||
    !["permitted", "not_permitted", "unverified"].includes(rights.derivativeFigures as string)
  ) problems.push("rights_invalid");
  if (!Array.isArray(e.requiredRestrictions) || e.requiredRestrictions.some((r) => !RESTRICTIONS.includes(r as string))) problems.push("requiredRestrictions_invalid");
  if (!Array.isArray(e.allowedHosts) || e.allowedHosts.some((h) => typeof h !== "string" || h !== h.toLowerCase() || !/^[a-z0-9.-]+$/.test(h))) problems.push("allowedHosts_invalid");
  if (!isHumanActor(e.reviewedBy)) problems.push("reviewedBy_not_a_human_role");
  const reviewedAt = parseIsoDateTime(e.reviewedAt);
  const validUntil = parseIsoDateTime(e.reviewValidUntil);
  if (reviewedAt === null) problems.push("reviewedAt_invalid");
  if (validUntil === null) problems.push("reviewValidUntil_invalid");
  if (reviewedAt !== null && validUntil !== null && validUntil <= reviewedAt) problems.push("review_period_empty");
  if (e.note !== null && !isText(e.note)) problems.push("note_invalid");
  // an approved source must have verified permissive terms: approval without that proof is a contradiction
  if (e.status === "approved" && terms?.status !== "verified_permissive") problems.push("approved_requires_verified_permissive_terms");
  if (e.status === "approved" && (rights?.publicTextUse === "not_permitted" || rights?.publicTextUse === "unverified")) problems.push("approved_requires_text_rights");
  return { entry: problems.length === 0 ? (raw as SourceRegistryEntry) : null, problems, id };
}

/** Reads the registry file. A malformed entry is reported and left out (so its facts are refused), never fixed. */
export function parseSourceRegistry(text: string | null): SourceRegistry {
  const entries = new Map<string, SourceRegistryEntry>();
  const issues: string[] = [];
  if (text === null) return Object.freeze({ entries, issues: Object.freeze([]), registryHash: sha256Hex("") });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return Object.freeze({ entries, issues: Object.freeze(["registry_not_valid_json"]), registryHash: sha256Hex(text) });
  }
  const file = parsed as Record<string, unknown> | null;
  if (typeof file !== "object" || file === null || file.schemaVersion !== SOURCE_REGISTRY_SCHEMA || !Array.isArray(file.sources) || Object.keys(file).length !== 2) {
    return Object.freeze({ entries, issues: Object.freeze(["registry_schema_invalid"]), registryHash: sha256Hex(text) });
  }
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const raw of file.sources) {
    const { entry, problems, id } = entryProblems(raw);
    if (seen.has(id)) duplicated.add(id);
    seen.add(id);
    for (const problem of problems) issues.push(`${id}:${problem}`);
    if (entry !== null) entries.set(id, entry);
  }
  // two entries with one id are ambiguous: neither is usable
  for (const id of duplicated) {
    entries.delete(id);
    issues.push(`${id}:duplicate_source_id`);
  }
  return Object.freeze({ entries, issues: Object.freeze([...issues].sort()), registryHash: sha256Hex(stableStringify(file.sources)) });
}

/** Issues that stop this source from backing this fact at `asOf`. Empty = the source may be cited. */
export function checkSourceForFact(
  registry: SourceRegistry,
  fact: Readonly<{ kind: string; source: FactSource }>,
  asOf: string,
): readonly SourceIssueCode[] {
  const source = fact.source;
  const entry = registry.entries.get(source.sourceId);
  if (entry === undefined) return ["source_not_registered"];
  const found: SourceIssueCode[] = [];
  if (entry.status === "excluded") found.push("source_excluded");
  if (entry.status === "suspended") found.push("source_suspended");
  const at = parseIsoDateTime(asOf);
  const until = parseIsoDateTime(entry.reviewValidUntil);
  const reviewed = parseIsoDateTime(entry.reviewedAt);
  if (at === null || until === null || at >= until) found.push("source_review_expired");
  if (at !== null && reviewed !== null && reviewed > at) found.push("source_review_in_future");
  if (entry.sourceType !== source.sourceType) found.push("source_type_mismatch");
  if (entry.publisher !== source.publisher) found.push("source_publisher_mismatch");
  if (entry.rights.publicTextUse === "not_permitted" || entry.rights.publicTextUse === "unverified") found.push("source_rights_insufficient");
  if (fact.kind === "quantitative" && entry.rights.derivativeFigures !== "permitted") found.push("source_figure_rights_insufficient");
  if (entry.terms.status !== source.termsOfUse.status) found.push("source_terms_mismatch");
  if (source.locator.kind === "url") {
    let host = "";
    try {
      const url = new URL(source.locator.url);
      host = url.protocol === "https:" ? url.hostname.toLowerCase() : "";
    } catch {
      host = "";
    }
    if (host === "" || !entry.allowedHosts.includes(host)) found.push("source_host_not_allowed");
  }
  const required = new Set<PublicationRestrictionCode>(entry.requiredRestrictions);
  if (entry.rights.publicTextUse === "permitted_with_attribution") required.add("attribution_required");
  if ([...required].some((code) => !source.publicationRestrictions.includes(code))) found.push("source_restrictions_missing");
  return [...new Set(found)].sort();
}

/**
 * SEO generator V3 — runtime validation of a fact (pure, deterministic, no clock access).
 *
 * A value that type-checks is NOT thereby a verified fact: objects can come from JSON, from a
 * cast, or from hostile in-process code. Validation therefore happens in two steps:
 *
 *  1. `snapshotUntrustedFact` copies the input into a plain, inert value. It never runs user code:
 *     it refuses Proxies, accessors (getters/setters), non-plain objects (Date, Map, typed arrays,
 *     class instances), symbol keys, non-enumerable properties, cycles and oversized structures,
 *     and reads data properties through their descriptors only. The snapshot cannot change
 *     between checking and storing.
 *  2. `validateFactSnapshot` checks the snapshot: strict key whitelists at every level (an unknown
 *     key is refused, never stored), calendar reality and chronology, provenance, units and
 *     values, scope, validation and approval records, and privacy of audit-derived facts.
 *
 * Inputs are bounded (values, keys, array length, string volume, number of issues returned) so that
 * excessive input is refused quickly, and diagnostics never echo raw key names or values.
 *
 * Everything returns issues instead of throwing. Internal programming errors are NOT swallowed:
 * nothing here catches exceptions, because the snapshot step is written not to throw on hostile input.
 * An empty issue list means "structurally acceptable", not "publishable": publication is decided in
 * factUse.ts.
 */
import { types } from "node:util";

import { validateSharedIntelligencePrivacy } from "../../intelligenceV2/privacyValidator";

import { DAY_MS, isValidIanaTimeZone, parseIsoDate, parseIsoDateTime } from "./dates";
import { LOCAL_SEO_TOPIC_SLUGS } from "./topics";

export type FactIssueCode =
  | "not_an_object"
  | "invalid_structure"
  | "unknown_key"
  | "too_many_issues"
  | "arbitration_invalid"
  | "invalid_fact_id"
  | "invalid_version"
  | "invalid_supersedes"
  | "invalid_scope"
  | "invalid_platform"
  | "invalid_property_type"
  | "invalid_unit"
  | "invalid_enum"
  | "unknown_topic"
  | "duplicate_topic"
  | "empty_relevant_topics"
  | "invalid_date"
  | "invalid_period"
  | "chronology"
  | "source_invalid"
  | "source_incoherent"
  | "evidence_missing"
  | "evidence_invalid"
  | "invalid_value"
  | "invalid_confidence"
  | "invalid_validation"
  | "invalid_usage"
  | "approval_inconsistent"
  | "privacy_violation"
  | "figure_in_qualitative_text"
  | "display_constraint_missing";

export type FactIssue = Readonly<{ code: FactIssueCode; path: string; message: string }>;

const KIND_VALUES = ["quantitative", "qualitative", "regulatory", "geographic"] as const;
const SOURCE_TYPES = [
  "official_authority",
  "official_tourism_body",
  "licensed_dataset",
  "published_research",
  "public_web_page",
  "editorial_note",
  "user_audit_aggregate",
] as const;
const COLLECTION_KINDS = [
  "manual_reading",
  "api_export",
  "dataset_download",
  "internal_aggregation",
  "editorial_judgement",
] as const;
const TERMS_STATUS = ["verified_permissive", "verified_restrictive", "unverified"] as const;
const RESTRICTIONS = [
  "attribution_required",
  "no_public_use",
  "no_derivative_figures",
  "aggregate_only",
  "requires_licence_check",
] as const;
const PLATFORMS = ["airbnb", "booking", "expedia", "agoda", "vrbo"] as const;
const PROPERTY_TYPES = ["studio", "apartment", "villa", "riad", "room", "hotel"] as const;
const CONFIDENCE_LEVELS = ["very_low", "low", "moderate", "high", "very_high"] as const;
const QUALITATIVE_CATEGORIES = [
  "guest_expectation",
  "architecture_or_layout",
  "visual_character",
  "access_and_arrival",
  "neighbourhood_context",
  "demand_driver",
] as const;
const RULE_TYPES = ["registration_required", "night_cap", "minimum_stay", "tax", "permit", "other"] as const;
const GEOGRAPHIC_ATTRIBUTES = ["country", "region", "timezone", "primary_language", "neighbourhood_name"] as const;
const DISPLAY_CONSTRAINTS = [
  "show_sample_size",
  "show_observation_period",
  "show_confidence",
  "attribute_source",
  "label_as_unavailability_not_occupancy",
  "no_benchmark_language",
  "label_as_editorial_note",
] as const;
const VALIDATION_STATUSES = ["draft", "pending_review", "human_validated", "rejected", "revoked"] as const;
const PUBLIC_USES = ["forbidden", "requires_human_approval", "approved"] as const;
/**
 * Closed matrix: which collection methods are plausible for which source type. Any other pairing is
 * ambiguous and refused. `internal_aggregation` belongs to audit-derived data only.
 */
const ALLOWED_METHODS: Readonly<Record<(typeof SOURCE_TYPES)[number], readonly string[]>> = {
  official_authority: ["manual_reading", "api_export", "dataset_download"],
  official_tourism_body: ["manual_reading", "api_export", "dataset_download"],
  licensed_dataset: ["dataset_download", "api_export"],
  published_research: ["manual_reading", "dataset_download"],
  public_web_page: ["manual_reading", "api_export"],
  editorial_note: ["editorial_judgement"],
  user_audit_aggregate: ["internal_aggregation"],
};
/** Source types that may legitimately point to an internal copy (an archived file, an editorial note). */
const INTERNAL_LOCATOR_TYPES = new Set<string>([
  "user_audit_aggregate",
  "editorial_note",
  "licensed_dataset",
  "published_research",
  "official_authority",
  "official_tourism_body",
]);
/** External sources with an internal locator must be anchored by something that can be re-checked. */
const EXTERNAL_TYPES = new Set<string>(["licensed_dataset", "published_research", "official_authority", "official_tourism_body"]);
/** Metrics an audit-derived fact may use: both have a sample size that can be checked. */
const AUDIT_METRICS = ["nightly_price_distribution", "calendar_unavailability_rate"] as const;

/** Evidence kinds an audit-derived fact may carry: none of them can hold free text or a URL. */
const AUDIT_EVIDENCE_KINDS = ["content_hash", "archive_reference", "internal_record"] as const;

const FACT_ID_PATTERN = /^fact:[A-Za-z0-9][A-Za-z0-9:_.-]{7,199}$/;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const URL_PATTERN = /(?:https?:\/\/|\bwww\.)/i;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const HEX32_PATTERN = /(?<![0-9a-fA-F])[0-9a-fA-F]{32}(?![0-9a-fA-F])/;
/** Listing-style numeric identifiers (a run of 9 or more digits). Short numbers such as sample sizes are fine. */
const LONG_DIGITS_PATTERN = /\d{9,}/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CITY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIGURE_PATTERN = /[€$£%]|\d/;
const MAX_EXCERPT_LENGTH = 500;
const MAX_STATEMENT_LENGTH = 500;

// --- Snapshot limits: excess input is refused before it is walked ---
const MAX_DEPTH = 8;
/** Every value visited (objects, arrays, strings, numbers, …) counts. */
const MAX_NODES = 2000;
const MAX_ARRAY_LENGTH = 50;
const MAX_KEYS_PER_OBJECT = 60;
const MAX_KEY_LENGTH = 60;
const MAX_STRING_LENGTH = 2000;
const MAX_TOTAL_STRING_CHARS = 100_000;
/** At most this many issues are returned; one extra `too_many_issues` marks the cut. */
const MAX_ISSUES = 40;

/** Field names that may appear in diagnostics. Anything else is reported as `<key>`. */
const KNOWN_KEYS: ReadonlySet<string> = new Set([
  "factId", "kind", "scope", "platform", "propertyType", "unit", "source", "collectedAt", "observedPeriod",
  "validUntil", "confidence", "validation", "usage", "relevantTopics", "version", "supersedes", "value",
  "level", "countryCode", "citySlug", "districtName", "sourceId", "sourceType", "publisher", "title", "locator",
  "publishedAt", "consultedAt", "collectionMethod", "termsOfUse", "publicationRestrictions", "evidence", "url",
  "citation", "reference", "description", "status", "summary", "algorithm", "excerpt", "start", "end", "rationale",
  "submittedAt", "validatedBy", "validatedAt", "note", "rejectedAt", "revokedAt", "reason", "use",
  "displayConstraints", "publicUse", "approval", "approvedBy", "approvedAt", "metric", "currency", "median",
  "p10", "p25", "p75", "p90", "sampleSize", "ratio", "semantics", "observedNights", "name", "category",
  "statement", "language", "basis", "ruleType", "rule", "effectiveFrom", "effectiveUntil", "officialReference",
  "attribute",
]);

/** Replaces every segment of a path that is not a known field name by `<key>`. */
function safePath(path: string): string {
  return path
    .split(".")
    .map((segment) => {
      const bare = segment.replace(/\[\d+\]/g, "");
      return bare === "$" || bare === "" || bare === "<unknown>" || bare === "<key>" || KNOWN_KEYS.has(bare) ? segment : "<key>";
    })
    .join(".");
}

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}
function positiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

// ---------------------------------------------------------------------------------------------
// Step 1 — inert snapshot
// ---------------------------------------------------------------------------------------------

export type SnapshotResult =
  | Readonly<{ ok: true; value: Rec }>
  | Readonly<{ ok: false; issues: readonly FactIssue[] }>;

const SKIP = Symbol("skip");

/**
 * Copies an untrusted value into plain data. `undefined` object properties are treated as absent;
 * anything that could run code or change later is refused with `invalid_structure`.
 */
export function snapshotUntrustedFact(input: unknown): SnapshotResult {
  const issues: FactIssue[] = [];
  const fail = (path: string, message: string) => {
    if (issues.length < MAX_ISSUES) issues.push({ code: "invalid_structure", path: safePath(path), message });
    else if (issues.length === MAX_ISSUES) issues.push({ code: "too_many_issues", path: "$", message: "Further issues were omitted." });
  };
  const ancestors = new Set<object>();
  let nodes = 0;
  let totalChars = 0;

  function copy(value: unknown, path: string, depth: number): unknown {
    if (value === null) return null;
    nodes += 1;
    if (nodes > MAX_NODES) {
      if (nodes === MAX_NODES + 1) fail(path, "Structure is too large.");
      return null;
    }
    switch (typeof value) {
      case "string":
        totalChars += value.length;
        if (value.length > MAX_STRING_LENGTH) {
          fail(path, "String is too long.");
          return null;
        }
        if (totalChars > MAX_TOTAL_STRING_CHARS) {
          if (totalChars - value.length <= MAX_TOTAL_STRING_CHARS) fail(path, "Too much text overall.");
          return null;
        }
        return value;
      case "number":
      case "boolean":
        return value;
      case "undefined":
        return SKIP;
      case "object":
        break;
      default:
        fail(path, `Unsupported value type: ${typeof value}.`);
        return null;
    }

    const object = value as object;
    if (types.isProxy(object)) {
      fail(path, "Proxies are not accepted.");
      return null;
    }
    if (depth > MAX_DEPTH) {
      fail(path, "Structure is nested too deeply.");
      return null;
    }
    if (ancestors.has(object)) {
      fail(path, "Cyclic structure.");
      return null;
    }

    const proto = Object.getPrototypeOf(object);
    ancestors.add(object);
    try {
      if (Array.isArray(object)) {
        if (proto !== Array.prototype) {
          fail(path, "Non-plain array.");
          return null;
        }
        // The length is checked BEFORE anything is walked, so a huge sparse array costs nothing.
        if (object.length > MAX_ARRAY_LENGTH) {
          fail(path, "Array is too long.");
          return null;
        }
        const out: unknown[] = [];
        const keys = Reflect.ownKeys(object).filter((key) => key !== "length");
        keys.forEach((key, position) => {
          if (typeof key === "symbol" || key !== String(position)) fail(path, "Array with extra or missing indices.");
        });
        for (let index = 0; index < object.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(object, index);
          if (descriptor === undefined || !("value" in descriptor)) {
            fail(`${path}[${index}]`, "Sparse array or accessor element.");
            continue;
          }
          const item = copy(descriptor.value, `${path}[${index}]`, depth + 1);
          if (item === SKIP) fail(`${path}[${index}]`, "undefined array element.");
          else out.push(item);
        }
        return out;
      }

      if (proto !== Object.prototype && proto !== null) {
        fail(path, "Non-plain object (class instance, Date, Map, typed array, …).");
        return null;
      }
      const keys = Reflect.ownKeys(object);
      if (keys.length > MAX_KEYS_PER_OBJECT) {
        fail(path, "Too many keys.");
        return null;
      }
      const out: Rec = {};
      for (const key of keys) {
        if (typeof key === "symbol") {
          fail(path, "Symbol keys are not accepted.");
          continue;
        }
        if (key.length > MAX_KEY_LENGTH) {
          fail(`${path}.<key>`, "Key is too long.");
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        const childPath = path === "$" ? key : `${path}.${key}`;
        if (descriptor === undefined || !("value" in descriptor)) {
          fail(childPath, "Accessor properties (getters/setters) are not accepted.");
          continue;
        }
        if (!descriptor.enumerable) {
          fail(childPath, "Non-enumerable properties are not accepted.");
          continue;
        }
        const item = copy(descriptor.value, childPath, depth + 1);
        if (item !== SKIP) Object.defineProperty(out, key, { value: item, enumerable: true, writable: true, configurable: true });
      }
      return out;
    } finally {
      ancestors.delete(object);
    }
  }

  if (!isRec(input) || (input !== null && Array.isArray(input))) {
    return { ok: false, issues: [{ code: "not_an_object", path: "$", message: "A fact must be an object." }] };
  }
  const value = copy(input, "$", 0);
  if (issues.length > 0 || !isRec(value)) return { ok: false, issues };
  return { ok: true, value };
}

// ---------------------------------------------------------------------------------------------
// Step 2 — validation of the snapshot
// ---------------------------------------------------------------------------------------------

/** Validates one raw input: snapshot first, then the snapshot. Never throws on hostile input. */
export function validateLocalFact(input: unknown): FactIssue[] {
  const snapshot = snapshotUntrustedFact(input);
  return snapshot.ok ? validateFactSnapshot(snapshot.value) : [...snapshot.issues];
}

type Adder = (code: FactIssueCode, path: string, message: string) => void;

function checkKeys(object: Rec, path: string, allowed: readonly string[], add: Adder): void {
  for (const key of Object.keys(object)) {
    // The raw key is never echoed: it may itself be sensitive text.
    if (!allowed.includes(key)) add("unknown_key", path === "$" ? "<unknown>" : `${path}.<unknown>`, "Unknown key.");
  }
}

function collectStrings(value: unknown, path: string, out: { path: string; value: string }[]): void {
  if (typeof value === "string") out.push({ path, value });
  else if (Array.isArray(value)) value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out));
  else if (isRec(value)) for (const [key, item] of Object.entries(value)) collectStrings(item, path === "$" ? key : `${path}.${key}`, out);
}

const LIMIT_DIRECTIONS = ["maximum", "minimum"] as const;
const LIMIT_UNITS = ["days", "nights"] as const;
const LIMIT_PERS = ["calendar_year", "stay"] as const;
const LIMIT_CONDITIONS = ["main_residence", "all_listings"] as const;
const MAX_LIMIT_VALUE = 3660;

/** S5.4-L: a structured limit is coherent with its rule type, is a bounded whole number and uses closed vocabularies. */
function checkRuleLimit(limit: unknown, ruleType: unknown, add: Adder): void {
  if (!isRec(limit)) {
    add("invalid_structure", "value.limit", "limit must be an object.");
    return;
  }
  checkKeys(limit, "value.limit", ["direction", "value", "unit", "per", "condition"], add);
  if (!oneOf(LIMIT_DIRECTIONS, limit.direction)) add("invalid_enum", "value.limit.direction", "direction must be maximum or minimum.");
  if (!oneOf(LIMIT_UNITS, limit.unit)) add("invalid_enum", "value.limit.unit", "unit must be days or nights.");
  if (!oneOf(LIMIT_PERS, limit.per)) add("invalid_enum", "value.limit.per", "per must be calendar_year or stay.");
  if (!oneOf(LIMIT_CONDITIONS, limit.condition)) add("invalid_enum", "value.limit.condition", "condition must be main_residence or all_listings.");
  if (typeof limit.value !== "number" || !Number.isInteger(limit.value) || limit.value < 1 || limit.value > MAX_LIMIT_VALUE) {
    add("invalid_value", "value.limit.value", "value must be a whole number from 1 to 3660.");
  }
  if (ruleType === "night_cap") {
    if (limit.direction !== "maximum") add("source_incoherent", "value.limit.direction", "A night cap carries a maximum.");
  } else if (ruleType === "minimum_stay") {
    if (limit.direction !== "minimum") add("source_incoherent", "value.limit.direction", "A minimum stay carries a minimum.");
    if (limit.per !== "stay") add("source_incoherent", "value.limit.per", "A minimum stay is counted per stay.");
  } else {
    add("source_incoherent", "value.limit", "Only night_cap and minimum_stay rules may carry a limit.");
  }
}

/** Validates a snapshot produced by `snapshotUntrustedFact`. Returns every issue, in a stable order. */
export function validateFactSnapshot(fact: Rec): FactIssue[] {
  const issues: FactIssue[] = [];
  const add: Adder = (code, path, message) => {
    if (issues.length < MAX_ISSUES) issues.push({ code, path: safePath(path), message });
    else if (issues.length === MAX_ISSUES) issues.push({ code: "too_many_issues", path: "$", message: "Further issues were omitted." });
  };

  checkKeys(
    fact,
    "$",
    [
      "factId", "kind", "scope", "platform", "propertyType", "unit", "source", "collectedAt", "observedPeriod",
      "validUntil", "confidence", "validation", "usage", "relevantTopics", "version", "supersedes", "value",
    ],
    add,
  );

  // --- identity and version ---
  if (typeof fact.factId !== "string" || !FACT_ID_PATTERN.test(fact.factId)) {
    add("invalid_fact_id", "factId", "factId must look like fact:<8 to 200 safe characters>.");
  } else if (UUID_PATTERN.test(fact.factId) || HEX32_PATTERN.test(fact.factId)) {
    add("privacy_violation", "factId", "factId must not embed a UUID (user, workspace or audit id), with or without dashes.");
  }
  if (!oneOf(KIND_VALUES, fact.kind)) add("invalid_enum", "kind", "Unknown fact kind.");
  if (!positiveInteger(fact.version)) add("invalid_version", "version", "version must be an integer >= 1.");
  if (fact.supersedes !== null && !(typeof fact.supersedes === "string" && FACT_ID_PATTERN.test(fact.supersedes))) {
    add("invalid_supersedes", "supersedes", "supersedes must be null or a fact id.");
  } else if (positiveInteger(fact.version)) {
    if (fact.version === 1 && fact.supersedes !== null) {
      add("invalid_supersedes", "supersedes", "Version 1 cannot replace another fact.");
    }
    if (fact.version > 1 && fact.supersedes === null) {
      add("invalid_supersedes", "supersedes", "A version above 1 must name the fact it replaces.");
    }
    if (fact.supersedes === fact.factId) {
      add("invalid_supersedes", "supersedes", "A fact cannot replace itself.");
    }
  }

  // --- scope, platform, property type, unit ---
  const scope = fact.scope;
  if (!isRec(scope)) {
    add("invalid_scope", "scope", "scope is required.");
  } else {
    const scopeKeys =
      scope.level === "country"
        ? ["level", "countryCode"]
        : scope.level === "city"
          ? ["level", "countryCode", "citySlug"]
          : ["level", "countryCode", "citySlug", "districtName"];
    checkKeys(scope, "scope", scopeKeys, add);
    if (typeof scope.countryCode !== "string" || !/^[A-Z]{2}$/.test(scope.countryCode)) {
      add("invalid_scope", "scope.countryCode", "countryCode must be two upper-case letters.");
    }
    if (scope.level === "city" || scope.level === "district") {
      if (typeof scope.citySlug !== "string" || !CITY_SLUG_PATTERN.test(scope.citySlug)) {
        add("invalid_scope", "scope.citySlug", "citySlug must be a lower-case slug.");
      }
      if (scope.level === "district" && !text(scope.districtName)) {
        add("invalid_scope", "scope.districtName", "districtName is required for a district scope.");
      }
    } else if (scope.level !== "country") {
      add("invalid_scope", "scope.level", "scope.level must be country, city or district.");
    }
  }
  if (fact.platform !== null && !oneOf(PLATFORMS, fact.platform)) {
    add("invalid_platform", "platform", "platform must be null or a known platform.");
  }
  if (fact.propertyType !== null && !oneOf(PROPERTY_TYPES, fact.propertyType)) {
    add("invalid_property_type", "propertyType", "propertyType must be null or a known type.");
  }
  if (fact.unit !== null && !text(fact.unit)) {
    add("invalid_unit", "unit", "unit must be null or a non-empty string.");
  }

  // --- topics ---
  if (!Array.isArray(fact.relevantTopics) || fact.relevantTopics.length === 0) {
    add("empty_relevant_topics", "relevantTopics", "At least one relevant topic is required.");
  } else {
    const seen = new Set<string>();
    fact.relevantTopics.forEach((topic: unknown, index: number) => {
      if (!oneOf(LOCAL_SEO_TOPIC_SLUGS, topic)) {
        add("unknown_topic", `relevantTopics[${index}]`, "Unknown topic slug.");
      } else if (seen.has(topic)) {
        add("duplicate_topic", `relevantTopics[${index}]`, "Duplicate topic.");
      } else {
        seen.add(topic);
      }
    });
  }

  // --- dates and chronology ---
  const collectedAt = parseIsoDateTime(fact.collectedAt);
  const validUntil = parseIsoDateTime(fact.validUntil);
  if (collectedAt === null) add("invalid_date", "collectedAt", "collectedAt is not a real date-time with a time zone.");
  if (validUntil === null) add("invalid_date", "validUntil", "validUntil is not a real date-time with a time zone.");
  if (collectedAt !== null && validUntil !== null && validUntil <= collectedAt) {
    add("chronology", "validUntil", "validUntil must be after collectedAt.");
  }

  const period = fact.observedPeriod;
  if (period !== null) {
    if (!isRec(period)) {
      add("invalid_period", "observedPeriod", "observedPeriod must be null or { start, end }.");
    } else {
      checkKeys(period, "observedPeriod", ["start", "end"], add);
      const start = parseIsoDate(period.start);
      const end = parseIsoDate(period.end);
      if (start === null) add("invalid_date", "observedPeriod.start", "start is not a real calendar date.");
      if (end === null) add("invalid_date", "observedPeriod.end", "end is not a real calendar date.");
      if (start !== null && end !== null) {
        if (start > end) add("invalid_period", "observedPeriod", "start must not be after end.");
        if (collectedAt !== null && end + DAY_MS > collectedAt) {
          add("chronology", "observedPeriod.end", "The observed period must have ended before collection.");
        }
      }
    }
  }

  // --- source and provenance ---
  const source = fact.source;
  let sourceType: string | null = null;
  if (!isRec(source)) {
    add("source_invalid", "source", "source is required.");
  } else {
    checkKeys(
      source,
      "source",
      ["sourceId", "sourceType", "publisher", "title", "locator", "publishedAt", "consultedAt", "collectionMethod", "termsOfUse", "publicationRestrictions", "evidence"],
      add,
    );
    if (!text(source.sourceId)) add("source_invalid", "source.sourceId", "sourceId is required.");
    if (!oneOf(SOURCE_TYPES, source.sourceType)) {
      add("source_invalid", "source.sourceType", "Unknown source type.");
    } else {
      sourceType = source.sourceType;
    }
    if (!text(source.publisher)) add("source_invalid", "source.publisher", "publisher is required.");
    if (source.title !== null && !text(source.title)) {
      add("source_invalid", "source.title", "title must be null or non-empty.");
    }

    const locator = source.locator;
    if (!isRec(locator)) {
      add("source_invalid", "source.locator", "locator is required.");
    } else if (locator.kind === "url") {
      checkKeys(locator, "source.locator", ["kind", "url"], add);
      let parsed: URL | null = null;
      try {
        parsed = typeof locator.url === "string" ? new URL(locator.url) : null;
      } catch {
        parsed = null;
      }
      if (parsed === null || parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") {
        add("source_invalid", "source.locator.url", "url must be a valid https URL without credentials.");
      }
    } else if (locator.kind === "document_citation") {
      checkKeys(locator, "source.locator", ["kind", "citation"], add);
      if (!text(locator.citation)) add("source_invalid", "source.locator.citation", "citation is required.");
    } else if (locator.kind === "internal_reference") {
      checkKeys(locator, "source.locator", ["kind", "reference"], add);
      if (!text(locator.reference)) add("source_invalid", "source.locator.reference", "reference is required.");
    } else {
      add("source_invalid", "source.locator.kind", "Unknown locator kind.");
    }

    const consultedAt = parseIsoDateTime(source.consultedAt);
    if (consultedAt === null) {
      add("invalid_date", "source.consultedAt", "consultedAt is not a real date-time with a time zone.");
    } else if (collectedAt !== null && consultedAt > collectedAt) {
      add("chronology", "source.consultedAt", "The source must have been consulted before the fact was collected.");
    }
    if (source.publishedAt !== null) {
      const published = parseIsoDate(source.publishedAt);
      if (published === null) {
        add("invalid_date", "source.publishedAt", "publishedAt is not a real calendar date.");
      } else if (consultedAt !== null && published > consultedAt) {
        add("chronology", "source.publishedAt", "A source cannot be published after it was consulted.");
      }
    }

    const method = source.collectionMethod;
    if (isRec(method)) checkKeys(method, "source.collectionMethod", ["kind", "description"], add);
    if (!isRec(method) || !oneOf(COLLECTION_KINDS, method.kind) || !text(method.description)) {
      add("source_invalid", "source.collectionMethod", "A collection method with a description is required.");
    }
    const terms = source.termsOfUse;
    if (isRec(terms)) checkKeys(terms, "source.termsOfUse", ["status", "summary", "reference"], add);
    if (!isRec(terms) || !oneOf(TERMS_STATUS, terms.status)) {
      add("source_invalid", "source.termsOfUse", "termsOfUse.status is required.");
    } else {
      if (terms.summary !== null && !text(terms.summary)) add("source_invalid", "source.termsOfUse.summary", "summary must be null or non-empty.");
      if (terms.reference !== null && !text(terms.reference)) add("source_invalid", "source.termsOfUse.reference", "reference must be null or non-empty.");
      if (terms.status !== "unverified" && !text(terms.reference)) {
        add("source_invalid", "source.termsOfUse.reference", "A verified status must name what was verified (reference).");
      }
    }
    if (
      !Array.isArray(source.publicationRestrictions) ||
      !source.publicationRestrictions.every((code: unknown) => oneOf(RESTRICTIONS, code))
    ) {
      add("source_invalid", "source.publicationRestrictions", "publicationRestrictions must list known codes.");
    }

    // Evidence: a locator alone proves nothing.
    if (!Array.isArray(source.evidence) || source.evidence.length === 0) {
      add("evidence_missing", "source.evidence", "At least one evidence anchor is required.");
    } else {
      source.evidence.forEach((anchor: unknown, index: number) => {
        const path = `source.evidence[${index}]`;
        if (!isRec(anchor)) {
          add("evidence_invalid", path, "Evidence anchor must be an object.");
          return;
        }
        if (anchor.kind === "content_hash") {
          checkKeys(anchor, path, ["kind", "algorithm", "value"], add);
          if (anchor.algorithm !== "sha256" || typeof anchor.value !== "string" || !SHA256_PATTERN.test(anchor.value)) {
            add("evidence_invalid", path, "content_hash must be a lower-case sha256 hex digest.");
          }
        } else if (anchor.kind === "archive_reference" || anchor.kind === "internal_record") {
          checkKeys(anchor, path, ["kind", "reference"], add);
          if (!text(anchor.reference)) add("evidence_invalid", path, "reference is required.");
        } else if (anchor.kind === "verbatim_excerpt") {
          checkKeys(anchor, path, ["kind", "excerpt"], add);
          if (!text(anchor.excerpt) || (anchor.excerpt as string).length > MAX_EXCERPT_LENGTH) {
            add("evidence_invalid", path, `excerpt must be non-empty and at most ${MAX_EXCERPT_LENGTH} characters.`);
          }
        } else {
          add("evidence_invalid", path, "Unknown evidence anchor kind.");
        }
      });
    }

    // Coherence between source type, method, locator and fact kind (closed matrix: ambiguity is refused).
    if (sourceType !== null && isRec(method) && oneOf(COLLECTION_KINDS, method.kind)) {
      if (!ALLOWED_METHODS[sourceType as (typeof SOURCE_TYPES)[number]].includes(method.kind)) {
        add("source_incoherent", "source.collectionMethod", "This collection method is not accepted for this source type (internal_aggregation is reserved to audit-derived data).");
      }
    }
    if (sourceType !== null && isRec(locator) && locator.kind === "internal_reference") {
      if (!INTERNAL_LOCATOR_TYPES.has(sourceType)) {
        add("source_incoherent", "source.locator", "This source type cannot be located by an internal reference.");
      } else if (
        EXTERNAL_TYPES.has(sourceType) &&
        !(Array.isArray(source.evidence) && source.evidence.some((anchor: unknown) => isRec(anchor) && (anchor.kind === "content_hash" || anchor.kind === "archive_reference")))
      ) {
        add("source_incoherent", "source.evidence", "An external source located internally needs a hash or an archive reference as evidence.");
      }
    }
    if (sourceType === "user_audit_aggregate") {
      if (!isRec(locator) || locator.kind !== "internal_reference") {
        add("source_incoherent", "source.locator", "Audit aggregates must use an internal reference.");
      }
      if (fact.kind !== "quantitative") {
        add("source_incoherent", "kind", "An audit-derived fact can only be a quantitative aggregate.");
      } else if (isRec(fact.value) && !oneOf(AUDIT_METRICS, fact.value.metric)) {
        add("source_incoherent", "value.metric", "An audit-derived fact must use a metric with a checkable sample size (not an official statistic).");
      }
      if (Array.isArray(source.evidence)) {
        source.evidence.forEach((anchor: unknown, index: number) => {
          if (isRec(anchor) && !oneOf(AUDIT_EVIDENCE_KINDS, anchor.kind)) {
            add("source_incoherent", `source.evidence[${index}]`, "Audit-derived facts may only carry hash, archive or internal-record evidence.");
          }
        });
      }
    }
    if (sourceType === "editorial_note" && fact.kind !== "qualitative") {
      add("source_incoherent", "kind", "An editorial note can only support a qualitative fact.");
    }
    if (fact.kind === "regulatory" && sourceType !== null && sourceType !== "official_authority") {
      add("source_incoherent", "source.sourceType", "A regulatory fact requires an official authority source.");
    }
  }

  // --- confidence ---
  const confidence = fact.confidence;
  if (isRec(confidence)) checkKeys(confidence, "confidence", ["level", "rationale"], add);
  if (!isRec(confidence) || !oneOf(CONFIDENCE_LEVELS, confidence.level) || !text(confidence.rationale)) {
    add("invalid_confidence", "confidence", "A confidence level with a rationale is required.");
  }

  // --- value ---
  validateValue(fact, sourceType, add);

  // --- validation record ---
  const validation = fact.validation;
  let validatedAt: number | null = null;
  let humanValidated = false;
  if (!isRec(validation) || !oneOf(VALIDATION_STATUSES, validation.status)) {
    add("invalid_validation", "validation", "A validation status is required.");
  } else {
    const validationKeys: Record<string, readonly string[]> = {
      draft: ["status"],
      pending_review: ["status", "submittedAt"],
      human_validated: ["status", "validatedBy", "validatedAt", "note"],
      rejected: ["status", "rejectedAt", "reason"],
      revoked: ["status", "revokedAt", "reason"],
    };
    checkKeys(validation, "validation", validationKeys[validation.status as string]!, add);
    const dated = (field: string): number | null => {
      const parsed = parseIsoDateTime(validation[field]);
      if (parsed === null) {
        add("invalid_date", `validation.${field}`, `${field} is not a real date-time.`);
      } else if (collectedAt !== null && parsed < collectedAt) {
        add("chronology", `validation.${field}`, `${field} cannot precede collection.`);
      } else if (validUntil !== null && parsed >= validUntil) {
        add("chronology", `validation.${field}`, `${field} cannot be at or after validUntil.`);
      }
      return parsed;
    };
    if (validation.status === "pending_review") dated("submittedAt");
    if (validation.status === "human_validated") {
      humanValidated = true;
      validatedAt = dated("validatedAt");
      if (!text(validation.validatedBy)) {
        add("invalid_validation", "validation.validatedBy", "A human validation must name its reviewer.");
      }
      if (validation.note !== null && !text(validation.note)) {
        add("invalid_validation", "validation.note", "note must be null or non-empty.");
      }
    }
    if (validation.status === "rejected") {
      dated("rejectedAt");
      if (!text(validation.reason)) add("invalid_validation", "validation.reason", "A reason is required.");
    }
    if (validation.status === "revoked") {
      dated("revokedAt");
      if (!text(validation.reason)) add("invalid_validation", "validation.reason", "A reason is required.");
    }
  }

  // --- usage restrictions and approval ---
  const usage = fact.usage;
  if (isRec(usage)) checkKeys(usage, "usage", ["use", "displayConstraints"], add);
  if (!isRec(usage) || !isRec(usage.use) || !oneOf(PUBLIC_USES, usage.use.publicUse)) {
    add("invalid_usage", "usage", "usage.use.publicUse is required.");
  } else {
    const constraints = usage.displayConstraints;
    if (!Array.isArray(constraints) || !constraints.every((value: unknown) => oneOf(DISPLAY_CONSTRAINTS, value))) {
      add("invalid_usage", "usage.displayConstraints", "displayConstraints must list known constraints.");
    }
    const use = usage.use;
    checkKeys(use, "usage.use", use.publicUse === "approved" ? ["publicUse", "approval"] : ["publicUse"], add);
    if (use.publicUse === "approved") {
      const approval = use.approval;
      if (isRec(approval)) checkKeys(approval, "usage.use.approval", ["approvedBy", "approvedAt", "scope"], add);
      if (!isRec(approval) || !text(approval.approvedBy)) {
        add("approval_inconsistent", "usage.use.approval", "An approval must name who approved it.");
      } else {
        const approvedAt = parseIsoDateTime(approval.approvedAt);
        if (approvedAt === null) {
          add("invalid_date", "usage.use.approval.approvedAt", "approvedAt is not a real date-time.");
        } else {
          if (validatedAt !== null && approvedAt < validatedAt) {
            add("approval_inconsistent", "usage.use.approval.approvedAt", "Approval cannot precede human validation.");
          }
          if (validUntil !== null && approvedAt >= validUntil) {
            add("chronology", "usage.use.approval.approvedAt", "approvedAt cannot be at or after validUntil.");
          }
        }
        const scopeValue = approval.scope;
        if (scopeValue === "any_topic") {
          // allowed here; stricter rules for audit data are applied in factUse.ts
        } else if (Array.isArray(scopeValue) && scopeValue.length > 0) {
          scopeValue.forEach((topic: unknown, index: number) => {
            if (!oneOf(LOCAL_SEO_TOPIC_SLUGS, topic)) {
              add("unknown_topic", `usage.use.approval.scope[${index}]`, "Unknown topic slug.");
            } else if (Array.isArray(fact.relevantTopics) && !fact.relevantTopics.includes(topic)) {
              add("approval_inconsistent", `usage.use.approval.scope[${index}]`, "Approved topic is not a relevant topic.");
            }
          });
        } else {
          add("approval_inconsistent", "usage.use.approval.scope", "scope must be any_topic or a non-empty topic list.");
        }
      }
      if (!humanValidated) {
        add("approval_inconsistent", "usage.use", "Public use cannot be approved for a fact that is not human-validated.");
      }
      if (
        isRec(source) &&
        Array.isArray(source.publicationRestrictions) &&
        source.publicationRestrictions.includes("no_public_use")
      ) {
        add("approval_inconsistent", "usage.use", "Approval contradicts the source's no_public_use restriction.");
      }
    }
  }

  // --- required display constraints (rules that must travel with the fact) ---
  if (isRec(usage) && Array.isArray(usage.displayConstraints) && isRec(fact.value)) {
    const has = (name: string) => (usage.displayConstraints as unknown[]).includes(name);
    const metric = fact.value.metric;
    if (metric === "calendar_unavailability_rate" && !has("label_as_unavailability_not_occupancy")) {
      add("display_constraint_missing", "usage.displayConstraints", "Unavailability must be labelled as unavailability, not occupancy.");
    }
    if (metric === "calendar_unavailability_rate" || metric === "nightly_price_distribution") {
      for (const required of ["show_sample_size", "show_observation_period", "show_confidence"]) {
        if (!has(required)) {
          add("display_constraint_missing", "usage.displayConstraints", `Measured figures must carry ${required}.`);
        }
      }
    }
    if (sourceType === "editorial_note" && !has("label_as_editorial_note")) {
      add("display_constraint_missing", "usage.displayConstraints", "Editorial notes must be labelled as editorial notes.");
    }
  }

  // --- privacy of audit-derived facts ---
  if (sourceType === "user_audit_aggregate") {
    // 1. the Intelligence V2 key/URL validator, on the data part of the fact
    const privacy = validateSharedIntelligencePrivacy({
      value: fact.value,
      scope: fact.scope,
      platform: fact.platform,
      propertyType: fact.propertyType,
      unit: fact.unit,
    });
    for (const violation of privacy.violations) {
      add("privacy_violation", violation.path, `Privacy validator: ${violation.code}.`);
    }
    // 2. every string anywhere in the fact: no UUID, URL or e-mail address (the whitelist above
    //    already forbids identifier-like keys)
    const strings: { path: string; value: string }[] = [];
    collectStrings(fact, "$", strings);
    for (const entry of strings) {
      // A content hash is hex by nature; it is not an identifier.
      if (/^source\.evidence\[\d+\]\.value$/.test(entry.path)) continue;
      if (UUID_PATTERN.test(entry.value) || HEX32_PATTERN.test(entry.value)) {
        add("privacy_violation", entry.path, "An audit-derived fact must not contain a UUID-like identifier (with or without dashes).");
      }
      if (URL_PATTERN.test(entry.value)) add("privacy_violation", entry.path, "An audit-derived fact must not contain a URL.");
      if (EMAIL_PATTERN.test(entry.value)) add("privacy_violation", entry.path, "An audit-derived fact must not contain an e-mail address.");
      if (entry.path !== "factId" && LONG_DIGITS_PATTERN.test(entry.value)) {
        add("privacy_violation", entry.path, "An audit-derived fact must not contain a listing-style numeric identifier (9 digits or more).");
      }
    }
  }

  return issues;
}

function validateValue(fact: Rec, sourceType: string | null, add: Adder): void {
  const value = fact.value;
  if (!isRec(value)) {
    add("invalid_value", "value", "value is required.");
    return;
  }

  if (fact.kind === "quantitative") {
    if (!isRec(fact.observedPeriod)) {
      add("invalid_period", "observedPeriod", "A measured figure must state the period it describes.");
    }
    if (value.metric === "nightly_price_distribution") {
      checkKeys(value, "value", ["metric", "currency", "median", "p10", "p25", "p75", "p90", "sampleSize"], add);
      if (typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) {
        add("invalid_value", "value.currency", "currency must be an ISO 4217 code.");
      }
      if (fact.unit !== null && fact.unit !== value.currency) {
        add("invalid_unit", "unit", "For a price distribution the unit must be null or the currency.");
      }
      let previous = 0;
      for (const key of ["p10", "p25", "median", "p75", "p90"]) {
        const current = value[key];
        if (current === undefined) {
          if (key === "median") add("invalid_value", "value.median", "median must be a positive number.");
          continue;
        }
        if (!positiveFinite(current)) {
          add("invalid_value", `value.${key}`, `${key} must be a positive number.`);
        } else {
          if (current < previous) add("invalid_value", `value.${key}`, "Percentiles must not decrease.");
          previous = current;
        }
      }
      if (!positiveInteger(value.sampleSize)) add("invalid_value", "value.sampleSize", "sampleSize must be an integer >= 1.");
    } else if (value.metric === "calendar_unavailability_rate") {
      checkKeys(value, "value", ["metric", "ratio", "semantics", "observedNights", "sampleSize"], add);
      if (typeof value.ratio !== "number" || !Number.isFinite(value.ratio) || value.ratio < 0 || value.ratio > 1) {
        add("invalid_value", "value.ratio", "ratio must be between 0 and 1.");
      }
      if (value.semantics !== "calendar_unavailability_not_occupancy") {
        add("invalid_value", "value.semantics", "Unavailability must carry its semantics marker.");
      }
      if (!positiveInteger(value.observedNights)) add("invalid_value", "value.observedNights", "observedNights must be an integer >= 1.");
      if (!positiveInteger(value.sampleSize)) add("invalid_value", "value.sampleSize", "sampleSize must be an integer >= 1.");
      if (fact.unit !== null) add("invalid_unit", "unit", "A ratio carries no unit.");
    } else if (value.metric === "official_statistic") {
      checkKeys(value, "value", ["metric", "name", "value"], add);
      if (!text(value.name)) add("invalid_value", "value.name", "name is required.");
      if (typeof value.value !== "number" || !Number.isFinite(value.value)) {
        add("invalid_value", "value.value", "value must be a finite number.");
      }
      if (!text(fact.unit)) add("invalid_unit", "unit", "A bare number without a unit is meaningless.");
    } else {
      add("invalid_value", "value.metric", "Unknown quantitative metric (there is no occupancy metric).");
    }
  } else if (fact.kind === "qualitative") {
    checkKeys(value, "value", ["category", "statement", "language", "basis"], add);
    if (!oneOf(QUALITATIVE_CATEGORIES, value.category)) add("invalid_enum", "value.category", "Unknown category.");
    if (!text(value.statement) || (value.statement as string).length > MAX_STATEMENT_LENGTH) {
      add("invalid_value", "value.statement", `statement must be non-empty and at most ${MAX_STATEMENT_LENGTH} characters.`);
    } else if (FIGURE_PATTERN.test(value.statement as string)) {
      add("figure_in_qualitative_text", "value.statement", "A qualitative statement must not contain figures; use a quantitative fact.");
    }
    if (typeof value.language !== "string" || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(value.language)) {
      add("invalid_value", "value.language", "language must look like en or en-GB.");
    }
    if (value.basis !== "cited_source" && value.basis !== "editorial_observation") {
      add("invalid_enum", "value.basis", "basis must be cited_source or editorial_observation.");
    } else if (value.basis === "editorial_observation" && sourceType !== null && sourceType !== "editorial_note") {
      add("source_incoherent", "value.basis", "An editorial observation requires an editorial_note source.");
    } else if (value.basis === "cited_source" && sourceType === "editorial_note") {
      add("source_incoherent", "value.basis", "A cited source cannot be an editorial note.");
    }
  } else if (fact.kind === "regulatory") {
    checkKeys(value, "value", ["ruleType", "rule", "effectiveFrom", "effectiveUntil", "officialReference", "limit"], add);
    if (!oneOf(RULE_TYPES, value.ruleType)) add("invalid_enum", "value.ruleType", "Unknown rule type.");
    if (!text(value.rule)) add("invalid_value", "value.rule", "rule is required.");
    if (!text(value.officialReference)) add("invalid_value", "value.officialReference", "officialReference is required.");
    const from = value.effectiveFrom === null ? null : parseIsoDate(value.effectiveFrom);
    const until = value.effectiveUntil === null ? null : parseIsoDate(value.effectiveUntil);
    if (value.effectiveFrom !== null && from === null) add("invalid_date", "value.effectiveFrom", "Not a real calendar date.");
    if (value.effectiveUntil !== null && until === null) add("invalid_date", "value.effectiveUntil", "Not a real calendar date.");
    if (from !== null && until !== null && from > until) {
      add("invalid_period", "value", "effectiveFrom must not be after effectiveUntil.");
    }
    if (value.limit !== undefined && value.limit !== null) checkRuleLimit(value.limit, value.ruleType, add);
  } else if (fact.kind === "geographic") {
    checkKeys(value, "value", ["attribute", "value"], add);
    if (!oneOf(GEOGRAPHIC_ATTRIBUTES, value.attribute)) add("invalid_enum", "value.attribute", "Unknown attribute.");
    if (!text(value.value)) add("invalid_value", "value.value", "value is required.");
    else if (value.attribute === "timezone" && !isValidIanaTimeZone(value.value)) {
      add("invalid_value", "value.value", "A timezone fact must hold a valid IANA zone name such as Europe/Paris.");
    }
  }
}

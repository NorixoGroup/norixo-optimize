/**
 * SEO generator V3 — deterministic English rendering of a factual claim (S3.2). Pure; no registry, clock or network.
 *
 * WHY: a validator that reads free prose can only look for listed words; it cannot know that a sentence
 * says what the fact says. A factual claim is therefore NOT free text. Its text is the exact sentence this
 * module builds from the fields of the cited facts, and the validator accepts a factual text only when it
 * is identical to that rendering. Metric, value, unit, geographic scope, period, platform, property type,
 * confidence, sample size and attribution all come from the fact, so a median cannot be presented as a
 * maximum, a city cannot change, a period cannot be inverted or widened, and no conclusion can be appended
 * to a rendered sentence: an added conclusion is a different claim and is validated as one.
 *
 * Scope of S3.2: English only. A refusal to render ("unsupported_fact") is never a permission; it means
 * the fact cannot yet be stated automatically (another language, a non-supported currency or metric,
 * a text that is not a single clean line, a period that is missing).
 *
 * The renderer does not decide whether a fact may be used: S2 and the validator do that.
 */
import type { DisplayConstraint, FactId, FactPlatform, FactPropertyType, GeographicScope, LocalFact } from "./localFact";

export type PriceStatistic = "median" | "p10" | "p25" | "p75" | "p90";

/** The price statistics, in the order they are looked up. */
export const PRICE_STATISTICS: readonly PriceStatistic[] = ["median", "p10", "p25", "p75", "p90"];

const STATISTIC_LABEL: Readonly<Record<PriceStatistic, string>> = {
  median: "median",
  p10: "lower-decile",
  p25: "lower-quartile",
  p75: "upper-quartile",
  p90: "upper-decile",
};
const CURRENCY_SYMBOL: Readonly<Record<string, string>> = { EUR: "€", USD: "$", GBP: "£" };
const PLATFORM_LABEL: Readonly<Record<NonNullable<FactPlatform>, string>> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  expedia: "Expedia",
  agoda: "Agoda",
  vrbo: "Vrbo",
};
const ATTRIBUTE_LABEL: Readonly<Record<string, string>> = {
  country: "country",
  region: "region",
  timezone: "time zone",
  primary_language: "primary language",
  neighbourhood_name: "neighbourhood name",
};
const MAX_FIELD = 300;

export type RenderedFigure = Readonly<{ literal: string; factId: FactId; valuePath: string }>;

/** Everything a factual claim needs besides its id and section: text, figures, citations, inherited obligations. */
export type RenderedFactual = Readonly<{
  text: string;
  figures: readonly RenderedFigure[];
  supportingFactIds: readonly FactId[];
  inheritedDisplayConstraints: readonly DisplayConstraint[];
}>;

export type RenderSelection = Readonly<{
  fact: LocalFact;
  /** Which price statistic to state. Required for a price distribution, forbidden for any other fact. */
  statistic?: PriceStatistic;
}>;

/** "unsupported_fact": this fact cannot be rendered. "invalid_selection": the selection does not describe a rendering. */
export type RenderResult =
  | Readonly<{ ok: true; value: RenderedFactual }>
  | Readonly<{ ok: false; reason: "unsupported_fact" | "invalid_selection" }>;

/** Registry text that is inserted in a sentence must be a single bounded line. */
function line(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_FIELD && !/[\n\r]/.test(value);
}

function place(scope: GeographicScope): string | null {
  if (!line(scope.countryCode)) return null;
  if (scope.level === "country") return scope.countryCode;
  if (!line(scope.citySlug)) return null;
  if (scope.level === "city") return `${scope.citySlug}, ${scope.countryCode}`;
  return line(scope.districtName) ? `${scope.districtName}, ${scope.citySlug}, ${scope.countryCode}` : null;
}

function platformLabel(platform: FactPlatform): string | null {
  return platform === null ? "not specified" : Object.hasOwn(PLATFORM_LABEL, platform) ? PLATFORM_LABEL[platform] : null;
}

function propertyLabel(propertyType: FactPropertyType): string | null {
  return propertyType === null ? "not specified" : /^[a-z]+$/.test(propertyType) ? propertyType : null;
}

function money(value: number): string | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const fixed = value.toFixed(2);
  return Number(fixed) === value ? fixed : String(value);
}

function count(value: number): string | null {
  return Number.isInteger(value) && value > 0 ? String(value) : null;
}

function periodOf(fact: LocalFact): { start: string; end: string } | null {
  return fact.observedPeriod === null ? null : { start: fact.observedPeriod.start, end: fact.observedPeriod.end };
}

function attribution(fact: LocalFact): string {
  return fact.usage.displayConstraints.includes("attribute_source") ? ` (source: ${fact.source.publisher})` : "";
}

type Rendered = { text: string; figures: RenderedFigure[] } | null;

function renderQuantitative(fact: Extract<LocalFact, { kind: "quantitative" }>, statistic: PriceStatistic | undefined): Rendered | "invalid" {
  const where = place(fact.scope);
  const platform = platformLabel(fact.platform);
  const property = propertyLabel(fact.propertyType);
  const period = periodOf(fact);
  const level = fact.confidence.level.replace(/_/g, " ");
  if (where === null || platform === null || property === null || period === null || !line(fact.source.publisher) || !/^[a-z ]+$/.test(level)) return null;
  const header = `In ${where} (platform: ${platform}, property type: ${property})`;
  const value = fact.value;
  if (value.metric === "nightly_price_distribution") {
    if (statistic === undefined || !PRICE_STATISTICS.includes(statistic)) return "invalid";
    const amount = value[statistic];
    const symbol = CURRENCY_SYMBOL[value.currency];
    if (typeof amount !== "number") return "invalid";
    const amountText = money(amount);
    const sample = count(value.sampleSize);
    if (symbol === undefined || amountText === null || sample === null) return null;
    return {
      text: `${header}, the ${STATISTIC_LABEL[statistic]} nightly price is ${symbol}${amountText} (confidence: ${level}, ${sample} listings observed from ${period.start} to ${period.end}, source: ${fact.source.publisher}).`,
      figures: [
        { literal: amountText, factId: fact.factId, valuePath: statistic },
        { literal: sample, factId: fact.factId, valuePath: "sampleSize" },
      ],
    };
  }
  if (statistic !== undefined) return "invalid";
  if (value.metric === "calendar_unavailability_rate") {
    const percent = Number((value.ratio * 100).toFixed(2));
    const nights = count(value.observedNights);
    const sample = count(value.sampleSize);
    if (!(value.ratio >= 0 && value.ratio <= 1) || nights === null || sample === null) return null;
    return {
      text: `${header}, ${percent}% of the observed calendar nights were unavailable (confidence: ${level}, ${nights} nights observed across ${sample} listings from ${period.start} to ${period.end}, source: ${fact.source.publisher}).`,
      figures: [
        { literal: `${percent}%`, factId: fact.factId, valuePath: "ratio" },
        { literal: nights, factId: fact.factId, valuePath: "observedNights" },
        { literal: sample, factId: fact.factId, valuePath: "sampleSize" },
      ],
    };
  }
  return null; // official statistics carry a free-form name and an unknown unit: not renderable yet
}

function renderOne(selection: RenderSelection): Rendered | "invalid" {
  const { fact, statistic } = selection;
  if (fact.kind === "quantitative") return renderQuantitative(fact, statistic);
  if (statistic !== undefined) return "invalid";
  const attributed = attribution(fact);
  if (attributed !== "" && !line(fact.source.publisher)) return null;
  switch (fact.kind) {
    case "qualitative": {
      if (fact.value.language !== "en" || !line(fact.value.statement)) return null;
      const labelled = fact.usage.displayConstraints.includes("label_as_editorial_note") || fact.value.basis === "editorial_observation";
      return { text: `${labelled ? "Editorial note: " : ""}${fact.value.statement}${attributed}`, figures: [] };
    }
    case "regulatory": {
      const { rule, effectiveFrom, effectiveUntil } = fact.value;
      if (!line(rule)) return null;
      const period = effectiveFrom === null ? "" : ` (in force from ${effectiveFrom}${effectiveUntil === null ? "" : ` until ${effectiveUntil}`})`;
      return { text: `${rule}${period}${attributed}`, figures: [] };
    }
    case "geographic": {
      const where = place(fact.scope);
      const label = ATTRIBUTE_LABEL[fact.value.attribute];
      if (where === null || label === undefined || !line(fact.value.value)) return null;
      return { text: `The ${label} of ${where} is ${fact.value.value}.${attributed}`, figures: [] };
    }
  }
}

/** Renders one sentence per selection, in order, joined by a single space. */
export function renderFactualClaim(selections: readonly RenderSelection[]): RenderResult {
  if (selections.length === 0) return { ok: false, reason: "invalid_selection" };
  const texts: string[] = [];
  const figures: RenderedFigure[] = [];
  const ids: FactId[] = [];
  const constraints = new Set<DisplayConstraint>();
  let unsupported = false;
  for (const selection of selections) {
    if (ids.includes(selection.fact.factId)) return { ok: false, reason: "invalid_selection" };
    const rendered = renderOne(selection);
    if (rendered === "invalid") return { ok: false, reason: "invalid_selection" };
    if (rendered === null) {
      unsupported = true;
      continue;
    }
    texts.push(rendered.text);
    figures.push(...rendered.figures);
    ids.push(selection.fact.factId);
    selection.fact.usage.displayConstraints.forEach((constraint) => constraints.add(constraint));
  }
  if (unsupported) return { ok: false, reason: "unsupported_fact" };
  return {
    ok: true,
    value: { text: texts.join(" "), figures, supportingFactIds: ids, inheritedDisplayConstraints: [...constraints].sort() },
  };
}

/** The text comparison used by the validator: Unicode-compatible, whitespace-collapsed, otherwise exact (case and punctuation count). */
export function normalizeForComparison(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/**
 * Derives the selections a claim's `figures` describe, for the cited facts in citation order: a price fact is
 * stated through exactly one statistic and its sample size, an unavailability fact through its ratio, its
 * observed nights and its sample size, any other fact through no figure at all.
 */
export function selectionsFromFigures(
  facts: readonly LocalFact[],
  figures: readonly { literal: string; factId: string; valuePath: string }[],
): { ok: true; selections: readonly RenderSelection[] } | { ok: false; reason: "unsupported_fact" | "invalid_selection" } {
  const selections: RenderSelection[] = [];
  for (const fact of facts) {
    const own = figures.filter((figure) => figure.factId === fact.factId).map((figure) => figure.valuePath);
    const unique = new Set(own);
    if (unique.size !== own.length) return { ok: false, reason: "invalid_selection" };
    if (fact.kind !== "quantitative") {
      if (own.length > 0) return { ok: false, reason: "invalid_selection" };
      selections.push({ fact });
      continue;
    }
    if (fact.value.metric === "nightly_price_distribution") {
      const statistics = own.filter((path): path is PriceStatistic => (PRICE_STATISTICS as readonly string[]).includes(path));
      if (statistics.length !== 1 || !unique.has("sampleSize") || own.length !== 2) return { ok: false, reason: "invalid_selection" };
      selections.push({ fact, statistic: statistics[0]! });
    } else if (fact.value.metric === "calendar_unavailability_rate") {
      if (own.length !== 3 || !["ratio", "observedNights", "sampleSize"].every((path) => unique.has(path))) return { ok: false, reason: "invalid_selection" };
      selections.push({ fact });
    } else {
      return { ok: false, reason: "unsupported_fact" };
    }
  }
  return { ok: true, selections };
}

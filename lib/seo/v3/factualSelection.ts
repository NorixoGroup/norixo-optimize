/**
 * SEO generator V3 — which facts a page may state, and as which factual claims (S4). Pure and deterministic.
 *
 * Fact usability is decided by S2 (`evaluateTopicFacts`, public use, exact context), never here. This module
 * only turns the fact that S2 retained for each requirement into ONE factual claim built by the S3 renderer:
 * the text, the figures and the inherited display constraints are exactly what `renderFactualClaim` returned.
 * Nothing is added to the rendered sentence and nothing is substituted in it.
 *
 * Policy of S4 (a product choice, kept minimal): a price distribution is stated through its median and, when the validated fact
 * itself carries them, its lower and upper quartiles (p25, p75), each as its own factual claim cited to the same fact (S3 allows
 * exactly one statistic per claim). Nothing is computed: a quartile that is absent, not a finite non-negative number or out of
 * order with the median is simply not stated. An unavailability rate is stated through its ratio; qualitative, regulatory and
 * geographic facts through their statement.
 */
import { renderFactualClaim, type PriceStatistic, type RenderedFactual } from "./claimRender";
import type { ClaimContext } from "./claimValidation";
import type { FactRegistry } from "./factRegistry";
import type { LocalFact } from "./localFact";
import { evaluateTopicFacts, type RequirementReport, type TopicFactsReport } from "./topicFactEvaluation";

export type UncoveredCause = "no_usable_fact" | "contradiction" | "not_renderable" | "human_decision_pending";

export type UncoveredRequirement = Readonly<{ requirementId: string; required: boolean; cause: UncoveredCause }>;

export type SelectedFactual = Readonly<{
  requirementId: string;
  required: boolean;
  fact: LocalFact;
  /** Section title, from a closed table keyed by what the fact is. */
  heading: string;
  rendered: RenderedFactual;
  statistic: PriceStatistic | null;
  /** Quartile claims of the same price fact (p25, p75), in that order; empty for any other fact or when the fact lacks them. */
  extraClaims: readonly ExtraPriceClaim[];
  /** The claim exactly as the page will carry it. */
  claim: Readonly<{
    claimId: string;
    sectionId: string;
    kind: "factual";
    text: string;
    supportingFactIds: readonly string[];
    figures: readonly { literal: string; factId: string; valuePath: string }[];
    inheritedDisplayConstraints: readonly string[];
  }>;
}>;

export type FactualSelection = Readonly<{
  report: TopicFactsReport;
  selected: readonly SelectedFactual[];
  uncovered: readonly UncoveredRequirement[];
}>;

export type FactualClaimView = SelectedFactual["claim"];

/** A further statistic of the same price fact, stated as its own claim in the same section. */
export type ExtraPriceClaim = Readonly<{ statistic: PriceStatistic; rendered: RenderedFactual; claim: FactualClaimView }>;

/** Closed table of section titles. Exhaustive over the kinds of fact: a new kind breaks compilation here. */
function headingFor(fact: LocalFact): string {
  switch (fact.kind) {
    case "quantitative":
      return fact.value.metric === "nightly_price_distribution"
        ? "Observed nightly prices"
        : fact.value.metric === "calendar_unavailability_rate"
          ? "Calendar unavailability"
          : "Official statistics";
    case "qualitative":
      return {
        guest_expectation: "What guests expect",
        architecture_or_layout: "Architecture and layout",
        visual_character: "Visual character",
        access_and_arrival: "Access and arrival",
        neighbourhood_context: "Neighbourhood context",
        demand_driver: "Local demand",
      }[fact.value.category];
    case "regulatory":
      return "Local rules";
    case "geographic":
      return "Place details";
  }
}

function safeId(requirementId: string): string {
  return requirementId.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 60);
}

function causeOf(report: RequirementReport): UncoveredCause {
  if (report.conflictingFactIds.length > 0) return "contradiction";
  if (report.status === "needs_human_decision") return "human_decision_pending";
  return "no_usable_fact";
}

export function selectFactualClaims(registry: FactRegistry, context: ClaimContext): FactualSelection {
  const report = evaluateTopicFacts(registry, {
    target: context.target, platform: context.platform, propertyType: context.propertyType, topic: context.topic, asOf: context.asOf, use: "public",
  });
  const selected: SelectedFactual[] = [];
  const uncovered: UncoveredRequirement[] = [];
  const used = new Set<string>();
  for (const requirement of report.requirements) {
    // only a requirement that S2 reports as fully met yields a section; a pending human decision is reported, not rendered
    const fact = requirement.chosenFactId === null || requirement.status !== "met" ? undefined : registry.get(requirement.chosenFactId);
    if (fact === undefined) {
      uncovered.push({ requirementId: requirement.requirementId, required: requirement.required, cause: causeOf(requirement) });
      continue;
    }
    if (used.has(fact.factId)) continue; // one fact answers one section
    const statistic: PriceStatistic | null = fact.kind === "quantitative" && fact.value.metric === "nightly_price_distribution" ? "median" : null;
    const outcome = renderFactualClaim([{ fact, ...(statistic === null ? {} : { statistic }) }]);
    if (!outcome.ok) {
      uncovered.push({ requirementId: requirement.requirementId, required: requirement.required, cause: "not_renderable" });
      continue;
    }
    used.add(fact.factId);
    const rendered = outcome.value;
    const claimOf = (suffix: string, from: RenderedFactual): FactualClaimView =>
      Object.freeze({
        claimId: `claim:fact:${safeId(requirement.requirementId)}${suffix}`,
        sectionId: `sec:${safeId(requirement.requirementId)}`,
        kind: "factual" as const,
        text: from.text,
        supportingFactIds: Object.freeze([...from.supportingFactIds]),
        figures: Object.freeze(from.figures.map((figure) => ({ literal: figure.literal, factId: figure.factId, valuePath: figure.valuePath }))),
        inheritedDisplayConstraints: Object.freeze([...from.inheritedDisplayConstraints]),
      });
    const extraClaims: ExtraPriceClaim[] = [];
    if (fact.kind === "quantitative" && fact.value.metric === "nightly_price_distribution") {
      const { median, p25, p75 } = fact.value;
      const usable = (statistic: "p25" | "p75"): boolean => {
        const value = statistic === "p25" ? p25 : p75;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return false;
        return statistic === "p25" ? value <= median : value >= median;
      };
      for (const quartile of ["p25", "p75"] as const) {
        if (!usable(quartile)) continue;
        const again = renderFactualClaim([{ fact, statistic: quartile }]);
        if (again.ok) extraClaims.push(Object.freeze({ statistic: quartile, rendered: again.value, claim: claimOf(`:${quartile}`, again.value) }));
      }
    }
    selected.push({
      requirementId: requirement.requirementId,
      required: requirement.required,
      fact,
      heading: headingFor(fact),
      rendered,
      statistic,
      extraClaims: Object.freeze(extraClaims),
      claim: claimOf("", rendered),
    });
  }
  return Object.freeze({ report, selected: Object.freeze(selected), uncovered: Object.freeze(uncovered) });
}

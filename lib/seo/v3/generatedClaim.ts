/**
 * SEO generator V3 — claims of a generated page (contract only).
 *
 * Every sentence a page makes is classified. Only a factual claim, or a hypothesis that is labelled
 * as one, may cite figures, and each figure must name the fact it comes from. Methodological advice
 * and non-factual editorial text cannot carry figures at all (enforced by `figures?: never`).
 *
 * A future claim validator (S3) reads this structure; it does not parse prose to guess intent.
 */
import type { DisplayConstraint, FactId } from "./localFact";

export type ClaimId = `claim:${string}`;

export type ClaimKind =
  | "factual"
  | "methodological_advice"
  | "explicit_hypothesis"
  | "editorial_non_factual";

/** A number, currency amount or percentage as it appears in the rendered text. */
export type ClaimFigure = Readonly<{
  /** Exactly as written in the text, e.g. "309.20". */
  literal: string;
  factId: FactId;
  /** Path inside the fact value the figure was taken from, e.g. "median". */
  valuePath: string;
}>;

type ClaimBase = Readonly<{
  claimId: ClaimId;
  text: string;
  sectionId: string;
}>;

export type FactualClaim = ClaimBase &
  Readonly<{
    kind: "factual";
    /** Non-empty: a factual claim without a supporting fact is not allowed. */
    supportingFactIds: readonly [FactId, ...FactId[]];
    figures: readonly ClaimFigure[];
    /** Obligations inherited from the supporting facts, to be honoured by the renderer. */
    inheritedDisplayConstraints: readonly DisplayConstraint[];
  }>;

export type ExplicitHypothesisClaim = ClaimBase &
  Readonly<{
    kind: "explicit_hypothesis";
    /** The text itself must present this as a hypothesis; the validator checks the marker. */
    hypothesisMarker: string;
    basisFactIds: readonly FactId[];
    figures: readonly ClaimFigure[];
  }>;

export type MethodologicalAdviceClaim = ClaimBase &
  Readonly<{
    kind: "methodological_advice";
    figures?: never;
    supportingFactIds?: never;
  }>;

export type EditorialNonFactualClaim = ClaimBase &
  Readonly<{
    kind: "editorial_non_factual";
    figures?: never;
    supportingFactIds?: never;
  }>;

export type GeneratedClaim =
  | FactualClaim
  | ExplicitHypothesisClaim
  | MethodologicalAdviceClaim
  | EditorialNonFactualClaim;

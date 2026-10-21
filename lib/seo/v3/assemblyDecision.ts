/**
 * SEO generator V3 — final decision of the assembler (S4). Pure.
 *
 * "ready_for_editorial_review" means ONE thing: nothing blocked the page, so a person may now review it.
 * It is never an authorisation to publish and never an indexing decision; the result type makes that
 * explicit (`publicationAuthorised: false`, `indexingAuthorised: false`).
 *
 * One blocking refusal is enough to forbid the ready status. Precedence of non-ready statuses, strictest
 * first: rejected, needs_human_decision, needs_data.
 */
import type { ValidationVerdict } from "./claimValidation";
import type { TopicFactsOverall } from "./topicFactEvaluation";

export type AssemblyStatus = "ready_for_editorial_review" | "needs_data" | "needs_human_decision" | "rejected" | "invalid_request";

export type AssemblyReason =
  | "invalid_request"
  | "language_not_supported"
  | "topic_facts_blocked"
  | "topic_needs_human_decision"
  | "required_requirement_uncovered"
  | "no_factual_claim"
  | "fact_not_renderable"
  | "page_validation_rejected"
  | "page_validation_needs_data"
  | "page_validation_needs_human_decision"
  | "rendering_integrity_failure"
  | "page_validation_missing"
  | "all_checks_passed";

export type DecisionInput = Readonly<{
  topicOverall: TopicFactsOverall;
  requiredUncovered: number;
  notRenderable: number;
  factualClaimCount: number;
  /** Verdict of the S3 page validation; null when no page could be built. */
  pageVerdict: ValidationVerdict | null;
  integrityOk: boolean;
}>;

export type Decision = Readonly<{ status: Exclude<AssemblyStatus, "invalid_request">; reasons: readonly AssemblyReason[] }>;

const RANK = { needs_data: 1, needs_human_decision: 2, rejected: 3 } as const;

export function decideAssembly(input: DecisionInput): Decision {
  const found: [keyof typeof RANK, AssemblyReason][] = [];
  if (input.topicOverall === "blocked") found.push(["needs_data", "topic_facts_blocked"]);
  if (input.topicOverall === "needs_human_decision") found.push(["needs_human_decision", "topic_needs_human_decision"]);
  if (input.topicOverall === "invalid_request") found.push(["rejected", "invalid_request"]);
  if (input.requiredUncovered > 0) found.push(["needs_data", "required_requirement_uncovered"]);
  if (input.notRenderable > 0) found.push(["needs_human_decision", "fact_not_renderable"]);
  if (input.factualClaimCount === 0) found.push(["needs_data", "no_factual_claim"]);
  // no verdict is never "nothing found": a page that was not validated cannot be ready
  if (input.pageVerdict === null) found.push(["rejected", "page_validation_missing"]);
  if (input.pageVerdict === "rejected") found.push(["rejected", "page_validation_rejected"]);
  if (input.pageVerdict === "needs_data") found.push(["needs_data", "page_validation_needs_data"]);
  if (input.pageVerdict === "needs_human_decision") found.push(["needs_human_decision", "page_validation_needs_human_decision"]);
  if (!input.integrityOk) found.push(["rejected", "rendering_integrity_failure"]);
  if (found.length === 0) return Object.freeze({ status: "ready_for_editorial_review", reasons: Object.freeze(["all_checks_passed"] as const) });
  const status = found.reduce<keyof typeof RANK>((worst, [level]) => (RANK[level] > RANK[worst] ? level : worst), "needs_data");
  return Object.freeze({ status, reasons: Object.freeze([...new Set(found.map(([, reason]) => reason))].sort()) });
}

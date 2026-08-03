import {
  inferBacklinkQualificationOpportunityType,
  inferBacklinkQualificationPageType,
} from "./backlink-qualification-signals";
import type {
  BacklinkQualificationFlag,
  BacklinkQualificationReason,
  BacklinkQualificationReasonCode,
  BacklinkQualificationResult,
} from "./backlink-qualification-types";
import {
  BacklinkQualificationEngineInvariantError,
  type EvaluateBacklinkQualificationCandidateInput,
} from "./backlink-qualification-engine-types";
import type {
  BacklinkQualificationSignal,
  BacklinkQualificationSignalCode,
} from "./backlink-qualification-signals-types";

const MAX_EVIDENCE_LENGTH = 200;
const editorialWeights: Readonly<
  Partial<Record<BacklinkQualificationSignalCode, number>>
> = {
  RESOURCE_PAGE_SIGNAL: 20,
  TOOLS_LIST_SIGNAL: 25,
  GUIDE_SIGNAL: 15,
  GUEST_POST_SIGNAL: 22,
  COMPARISON_SIGNAL: 20,
  DIRECTORY_SIGNAL: 18,
  PARTNERSHIP_SIGNAL: 14,
};
const blockingSignalCodes = new Set<BacklinkQualificationSignalCode>([
  "SELF_DOMAIN",
  "BLOCKED_HOSTNAME",
  "PLATFORM_OWNER_DOMAIN",
  "SOCIAL_NETWORK",
  "SEARCH_ENGINE",
  "VIDEO_PLATFORM",
  "LOGIN_PAGE",
  "LEGAL_PAGE",
  "UNSAFE_TOPIC",
]);

function boundedEvidence(evidence: string): string {
  return evidence.trim().slice(0, MAX_EVIDENCE_LENGTH);
}

function rankContribution(rank: number): number {
  if (rank === 1) return 5;
  if (rank <= 3) return 4;
  if (rank <= 5) return 3;
  if (rank <= 10) return 1;
  return 0;
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

function signalReasonCode(
  code: BacklinkQualificationSignalCode,
): BacklinkQualificationReasonCode | null {
  const reasonCodes: Partial<
    Record<BacklinkQualificationSignalCode, BacklinkQualificationReasonCode>
  > = {
    SELF_DOMAIN: "SELF_DOMAIN",
    BLOCKED_HOSTNAME: "SELF_DOMAIN",
    PLATFORM_OWNER_DOMAIN: "PLATFORM_OWNER_DOMAIN",
    DIRECT_COMPETITOR: "DIRECT_COMPETITOR",
    SOCIAL_NETWORK: "SOCIAL_NETWORK",
    SEARCH_ENGINE: "SEARCH_ENGINE",
    VIDEO_PLATFORM: "VIDEO_PLATFORM",
    UNSAFE_TOPIC: "UNSAFE_TOPIC",
    TOPICAL_RELEVANCE_STRONG: "TOPICAL_RELEVANCE_STRONG",
    TOPICAL_RELEVANCE_PARTIAL: "TOPICAL_RELEVANCE_PARTIAL",
    RESOURCE_PAGE_SIGNAL: "RESOURCE_PAGE_SIGNAL",
    TOOLS_LIST_SIGNAL: "TOOLS_LIST_SIGNAL",
    GUIDE_SIGNAL: "GUIDE_SIGNAL",
    GUEST_POST_SIGNAL: "GUEST_POST_SIGNAL",
    LOGIN_PAGE: "LOGIN_PAGE",
    LEGAL_PAGE: "LEGAL_PAGE",
    SUPPORT_PAGE_SIGNAL: "SUPPORT_ONLY_PAGE",
    LANGUAGE_MATCH: "LANGUAGE_MATCH",
    COUNTRY_MATCH: "COUNTRY_MATCH",
    HIGH_SERP_POSITION: "HIGH_SERP_POSITION",
    INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
  };
  return reasonCodes[code] ?? null;
}

function signalImpact(
  signal: BacklinkQualificationSignal,
  editorialContribution: number,
  rankImpact: number,
): number | null {
  if (blockingSignalCodes.has(signal.code)) return -100;
  if (signal.code === "DIRECT_COMPETITOR") return -20;
  if (signal.code === "SUPPORT_PAGE_SIGNAL") return -15;
  if (signal.code === "INSUFFICIENT_EVIDENCE") return -25;
  if (signal.code === "TOPICAL_RELEVANCE_STRONG") return 35;
  if (signal.code === "TOPICAL_RELEVANCE_PARTIAL") return 18;
  if (editorialWeights[signal.code] !== undefined) return editorialContribution;
  if (signal.code === "TITLE_PRESENT") return 7;
  if (signal.code === "SNIPPET_PRESENT") return 8;
  if (signal.code === "LANGUAGE_MATCH" || signal.code === "COUNTRY_MATCH") return 5;
  if (signal.code === "HIGH_SERP_POSITION") return rankImpact;
  return null;
}

function signalGroup(signal: BacklinkQualificationSignal): number {
  if (blockingSignalCodes.has(signal.code)) return 0;
  if (
    signal.code === "DIRECT_COMPETITOR" ||
    signal.code === "SUPPORT_PAGE_SIGNAL" ||
    signal.code === "INSUFFICIENT_EVIDENCE"
  ) {
    return 1;
  }
  if (signal.category === "topical") return 2;
  if (signal.category === "editorial") return 3;
  if (signal.category === "context") return 4;
  return 5;
}

function assertInvariants(input: EvaluateBacklinkQualificationCandidateInput): void {
  if (input.signals.candidateKey !== input.candidate.candidateKey) {
    throw new BacklinkQualificationEngineInvariantError(
      "CANDIDATE_KEY_MISMATCH",
      "Qualification signals candidateKey must match the candidate",
    );
  }
  const codes = input.signals.signals.map((signal) => signal.code);
  if (new Set(codes).size !== codes.length) {
    throw new BacklinkQualificationEngineInvariantError(
      "DUPLICATE_SIGNAL_CODE",
      "Qualification signals must not contain duplicate codes",
    );
  }
  if (
    input.signals.proposedOpportunityType !==
      inferBacklinkQualificationOpportunityType(input.signals.signals) ||
    input.signals.proposedPageType !==
      inferBacklinkQualificationPageType(input.signals.signals)
  ) {
    throw new BacklinkQualificationEngineInvariantError(
      "INCONSISTENT_PROPOSED_TYPES",
      "Qualification signal proposed types are inconsistent",
    );
  }
}

export function evaluateBacklinkQualificationCandidate(
  input: EvaluateBacklinkQualificationCandidateInput,
): BacklinkQualificationResult {
  assertInvariants(input);

  const rankImpact = rankContribution(input.candidate.rank);
  let editorialRemaining = 25;
  let score = rankImpact;
  const impacts = new Map<BacklinkQualificationSignalCode, number>();

  for (const signal of input.signals.signals) {
    const configuredEditorialWeight = editorialWeights[signal.code];
    const editorialContribution =
      configuredEditorialWeight === undefined
        ? 0
        : Math.min(configuredEditorialWeight, editorialRemaining);
    if (configuredEditorialWeight !== undefined) {
      editorialRemaining -= editorialContribution;
    }
    const impact = signalImpact(signal, editorialContribution, rankImpact);
    if (
      impact !== null &&
      !blockingSignalCodes.has(signal.code) &&
      signal.code !== "HIGH_SERP_POSITION"
    ) {
      score += impact;
    }
    if (impact !== null) impacts.set(signal.code, impact);
  }

  const hasBlocking = input.signals.signals.some((signal) =>
    blockingSignalCodes.has(signal.code),
  );
  if (hasBlocking) score = 0;
  const qualificationScore = clampScore(score);
  if (!Number.isInteger(qualificationScore) || qualificationScore < 0 || qualificationScore > 100) {
    throw new BacklinkQualificationEngineInvariantError(
      "INCONSISTENT_SCORE",
      "Qualification score must be an integer between 0 and 100",
    );
  }

  const codes = new Set(input.signals.signals.map((signal) => signal.code));
  const hasDirectCompetitor = codes.has("DIRECT_COMPETITOR");
  const hasSupportPage = codes.has("SUPPORT_PAGE_SIGNAL");
  const hasInsufficientEvidence = codes.has("INSUFFICIENT_EVIDENCE");
  const hasEditorial = input.signals.editorialSignalCodes.length > 0;
  const isQualified =
    qualificationScore >= 70 &&
    !hasBlocking &&
    !hasDirectCompetitor &&
    !hasSupportPage &&
    !hasInsufficientEvidence &&
    input.signals.topicalSignal !== "none" &&
    hasEditorial;
  const decision = hasBlocking || qualificationScore <= 39
    ? "rejected"
    : isQualified
      ? "qualified"
      : "review";
  const confidence =
    input.signals.topicalSignal === "strong" &&
    hasEditorial &&
    codes.has("TITLE_PRESENT") &&
    codes.has("SNIPPET_PRESENT") &&
    !hasBlocking &&
    !hasDirectCompetitor &&
    !hasSupportPage &&
    !hasInsufficientEvidence
      ? "medium"
      : "low";

  const reasons: BacklinkQualificationReason[] = [];
  const reasonCodes = new Set<BacklinkQualificationReasonCode>();
  const orderedSignals = input.signals.signals
    .map((signal, index) => ({ signal, index }))
    .sort((left, right) => signalGroup(left.signal) - signalGroup(right.signal) || left.index - right.index);
  for (const { signal } of orderedSignals) {
    const code = signalReasonCode(signal.code);
    const impact = impacts.get(signal.code);
    if (code === null || impact === undefined || reasonCodes.has(code)) continue;
    reasonCodes.add(code);
    reasons.push({ code, impact, evidence: boundedEvidence(signal.evidence) });
  }
  if (reasons.length === 0) {
    reasons.push({
      code: "INSUFFICIENT_EVIDENCE",
      impact: -25,
      evidence: "Candidate has no qualifying signal evidence",
    });
  }

  const flags: BacklinkQualificationFlag[] = [];
  if (hasBlocking) flags.push("blocking");
  if (hasDirectCompetitor || hasSupportPage || decision === "review") {
    flags.push("requires_review");
  }
  if (hasInsufficientEvidence) flags.push("insufficient_evidence");

  return {
    candidateKey: input.candidate.candidateKey,
    decision,
    qualificationScore,
    confidence,
    reasons,
    flags,
    proposedOpportunityType: input.signals.proposedOpportunityType,
    proposedPageType: input.signals.proposedPageType,
  };
}

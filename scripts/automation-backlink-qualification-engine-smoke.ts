import {
  DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
  BacklinkQualificationEngineInvariantError,
  evaluateBacklinkQualificationCandidate,
  inferBacklinkQualificationOpportunityType,
  inferBacklinkQualificationPageType,
  type BacklinkQualificationCandidateInput,
  type BacklinkQualificationQueryInput,
  type BacklinkQualificationSignal,
  type BacklinkQualificationSignalCode,
  type BacklinkQualificationSignalsResult,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(
  action: () => void,
  expectedCode: string,
  message: string,
): void {
  try {
    action();
  } catch (error) {
    assert(error instanceof BacklinkQualificationEngineInvariantError, message);
    assert(error.code === expectedCode, message);
    return;
  }
  throw new Error(message);
}

const query: BacklinkQualificationQueryInput = {
  query: "vacation rental resources",
  countryCode: "US",
  languageCode: "en",
};

function candidate(
  overrides: Partial<BacklinkQualificationCandidateInput> = {},
): BacklinkQualificationCandidateInput {
  return {
    candidateKey: "candidate-1",
    hostname: "example.com",
    sourceUrl: "https://example.com/resources",
    pageTitle: "Resource page",
    snippet: "Useful resource",
    queryIndex: 0,
    rank: 1,
    countryCode: "US",
    languageCode: "en",
    suggestedAssetKey: null,
    evidenceSummary: "Discovery evidence",
    discoveryScore: 0.01,
    ...overrides,
  };
}

function categoryFor(
  code: BacklinkQualificationSignalCode,
): BacklinkQualificationSignal["category"] {
  if (
    code === "SELF_DOMAIN" ||
    code === "BLOCKED_HOSTNAME" ||
    code === "PLATFORM_OWNER_DOMAIN" ||
    code === "SOCIAL_NETWORK" ||
    code === "SEARCH_ENGINE" ||
    code === "VIDEO_PLATFORM" ||
    code === "LOGIN_PAGE" ||
    code === "LEGAL_PAGE"
  ) {
    return "blocking";
  }
  if (
    code === "DIRECT_COMPETITOR" ||
    code === "SUPPORT_PAGE_SIGNAL" ||
    code === "UNSAFE_TOPIC"
  ) {
    return "risk";
  }
  if (code.startsWith("TOPICAL_")) return "topical";
  if (
    code.endsWith("_PAGE_SIGNAL") ||
    code === "TOOLS_LIST_SIGNAL" ||
    code === "GUIDE_SIGNAL" ||
    code === "GUEST_POST_SIGNAL" ||
    code === "COMPARISON_SIGNAL" ||
    code === "DIRECTORY_SIGNAL" ||
    code === "PARTNERSHIP_SIGNAL"
  ) {
    return "editorial";
  }
  if (code === "LANGUAGE_MATCH" || code === "COUNTRY_MATCH") return "context";
  return "quality";
}

function signals(
  codes: readonly BacklinkQualificationSignalCode[],
  candidateKey = "candidate-1",
): BacklinkQualificationSignalsResult {
  const items = codes.map((code) => ({
    code,
    category: categoryFor(code),
    evidence: `Evidence for ${code}`,
  }));
  return {
    candidateKey,
    signals: items,
    blockingSignalCodes: items
      .filter((signal) => signal.category === "blocking")
      .map((signal) => signal.code),
    riskSignalCodes: items
      .filter((signal) => signal.category === "risk")
      .map((signal) => signal.code),
    topicalSignal: codes.includes("TOPICAL_RELEVANCE_STRONG")
      ? "strong"
      : codes.includes("TOPICAL_RELEVANCE_PARTIAL")
        ? "partial"
        : "none",
    editorialSignalCodes: items
      .filter((signal) => signal.category === "editorial")
      .map((signal) => signal.code),
    proposedOpportunityType: inferBacklinkQualificationOpportunityType(items),
    proposedPageType: inferBacklinkQualificationPageType(items),
  };
}

function evaluate(
  codes: readonly BacklinkQualificationSignalCode[],
  candidateInput = candidate(),
): ReturnType<typeof evaluateBacklinkQualificationCandidate> {
  return evaluateBacklinkQualificationCandidate({
    candidate: candidateInput,
    query,
    signals: signals(codes, candidateInput.candidateKey),
    policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
  });
}

const completeCodes: readonly BacklinkQualificationSignalCode[] = [
  "TOPICAL_RELEVANCE_STRONG",
  "TOOLS_LIST_SIGNAL",
  "TITLE_PRESENT",
  "SNIPPET_PRESENT",
  "LANGUAGE_MATCH",
  "COUNTRY_MATCH",
  "HIGH_SERP_POSITION",
];
const nominal = evaluate(completeCodes);
assert(nominal.qualificationScore === 90, "nominal score must be 90");
assert(nominal.decision === "qualified", "nominal candidate must qualify");
assert(nominal.confidence === "medium", "complete evidence must be medium confidence");
assert(
  nominal.proposedOpportunityType === "Tools List" && nominal.proposedPageType === "tools_list",
  "proposed types must be reused from signals",
);

const editorialCap = evaluate([
  "TOPICAL_RELEVANCE_STRONG",
  "RESOURCE_PAGE_SIGNAL",
  "TOOLS_LIST_SIGNAL",
  "GUEST_POST_SIGNAL",
]);
assert(editorialCap.qualificationScore === 65, "editorial contribution must cap at 25");
assert(
  editorialCap.reasons.some((reason) => reason.code === "RESOURCE_PAGE_SIGNAL" && reason.impact === 20) &&
    editorialCap.reasons.some((reason) => reason.code === "TOOLS_LIST_SIGNAL" && reason.impact === 5),
  "editorial reasons must report their actual capped contributions",
);

const ranks = [
  { rank: 1, score: 5 },
  { rank: 2, score: 4 },
  { rank: 4, score: 3 },
  { rank: 6, score: 1 },
  { rank: 11, score: 0 },
] as const;
for (const expected of ranks) {
  assert(
    evaluate([], candidate({ rank: expected.rank })).qualificationScore === expected.score,
    `rank ${expected.rank} contribution must be ${expected.score}`,
  );
}

const blockingCodes: readonly BacklinkQualificationSignalCode[] = [
  "SELF_DOMAIN",
  "PLATFORM_OWNER_DOMAIN",
  "SOCIAL_NETWORK",
  "SEARCH_ENGINE",
  "VIDEO_PLATFORM",
  "LOGIN_PAGE",
  "LEGAL_PAGE",
  "UNSAFE_TOPIC",
];
for (const blockingCode of blockingCodes) {
  const result = evaluate(["TOPICAL_RELEVANCE_STRONG", "TOOLS_LIST_SIGNAL", blockingCode]);
  assert(result.qualificationScore === 0, `${blockingCode} must force a zero score`);
  assert(result.decision === "rejected", `${blockingCode} must reject`);
  assert(result.flags[0] === "blocking", `${blockingCode} must set the blocking flag`);
}

const competitor = evaluate([...completeCodes, "DIRECT_COMPETITOR"]);
assert(competitor.qualificationScore === 70, "competitor penalty must be -20");
assert(competitor.decision === "review", "competitor must never qualify");
assert(competitor.flags.includes("requires_review"), "competitor must require review");
assert(
  competitor.reasons.some((reason) => reason.code === "DIRECT_COMPETITOR" && reason.impact === -20),
  "competitor reason must expose the exact penalty",
);
const support = evaluate([...completeCodes, "SUPPORT_PAGE_SIGNAL"]);
assert(support.qualificationScore === 75, "support penalty must be -15");
assert(support.decision === "review", "support page must never qualify");
assert(
  support.reasons.some((reason) => reason.code === "SUPPORT_ONLY_PAGE" && reason.impact === -15),
  "support reason must use the public support code",
);
const insufficient = evaluate([...completeCodes, "INSUFFICIENT_EVIDENCE"]);
assert(insufficient.qualificationScore === 65, "insufficient evidence penalty must be -25");
assert(insufficient.decision === "review", "insufficient evidence must never qualify");
assert(
  JSON.stringify(insufficient.flags) ===
    JSON.stringify(["requires_review", "insufficient_evidence"]),
  "insufficient evidence flags must have stable order",
);

assert(
  evaluate(["TOPICAL_RELEVANCE_STRONG"], candidate({ rank: 2 })).qualificationScore === 39,
  "score 39 must be reachable",
);
assert(
  evaluate(["TOPICAL_RELEVANCE_STRONG"], candidate({ rank: 2 })).decision === "rejected",
  "score 39 must reject",
);
const score40 = evaluate(["TOPICAL_RELEVANCE_STRONG", "LANGUAGE_MATCH"], candidate({ rank: 11 }));
assert(score40.qualificationScore === 40 && score40.decision === "review", "score 40 must review");
const score69 = evaluate(
  [
    "TOPICAL_RELEVANCE_PARTIAL",
    "TOOLS_LIST_SIGNAL",
    "TITLE_PRESENT",
    "SNIPPET_PRESENT",
    "LANGUAGE_MATCH",
    "COUNTRY_MATCH",
  ],
  candidate({ rank: 6 }),
);
assert(score69.qualificationScore === 69 && score69.decision === "review", "score 69 must review");
const score70 = evaluate(
  ["TOPICAL_RELEVANCE_STRONG", "RESOURCE_PAGE_SIGNAL", "TITLE_PRESENT", "SNIPPET_PRESENT"],
  candidate({ rank: 11 }),
);
assert(score70.qualificationScore === 70 && score70.decision === "qualified", "score 70 must qualify when complete");
assert(
  evaluate(
    ["TOPICAL_RELEVANCE_STRONG", "TITLE_PRESENT", "SNIPPET_PRESENT", "LANGUAGE_MATCH", "COUNTRY_MATCH"],
    candidate({ rank: 1 }),
  ).decision === "review",
  "a candidate without editorial evidence must review",
);
assert(
  evaluate(
    ["RESOURCE_PAGE_SIGNAL", "TITLE_PRESENT", "SNIPPET_PRESENT", "LANGUAGE_MATCH", "COUNTRY_MATCH"],
    candidate({ rank: 1 }),
  ).decision === "review",
  "a candidate without topical evidence must review",
);

const fallback = evaluate([], candidate({ rank: 11, discoveryScore: 0.99 }));
assert(fallback.qualificationScore === 0, "discoveryScore must not affect the qualification score");
assert(fallback.decision === "rejected", "empty evidence must reject");
assert(
  fallback.reasons.length === 1 && fallback.reasons[0].code === "INSUFFICIENT_EVIDENCE",
  "empty evidence must use the deterministic fallback reason",
);
assert(fallback.confidence === "low", "incomplete evidence must have low confidence");

assert(
  nominal.reasons.every((reason) => reason.evidence.length <= 200),
  "reason evidence must be bounded",
);
assert(
  new Set(nominal.reasons.map((reason) => reason.code)).size === nominal.reasons.length,
  "reasons must not duplicate public codes",
);
assert(
  JSON.stringify(nominal.reasons.map((reason) => reason.code)) ===
    JSON.stringify([
      "TOPICAL_RELEVANCE_STRONG",
      "TOOLS_LIST_SIGNAL",
      "LANGUAGE_MATCH",
      "COUNTRY_MATCH",
      "HIGH_SERP_POSITION",
    ]),
  "reason order must group topical, editorial, context, then quality",
);

const validCandidate = candidate();
assertThrows(
  () =>
    evaluateBacklinkQualificationCandidate({
      candidate: validCandidate,
      query,
      signals: signals(["TOPICAL_RELEVANCE_STRONG"], "other-candidate"),
      policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
    }),
  "CANDIDATE_KEY_MISMATCH",
  "candidate key mismatch must be rejected",
);
assertThrows(
  () =>
    evaluateBacklinkQualificationCandidate({
      candidate: validCandidate,
      query,
      signals: signals(["TOPICAL_RELEVANCE_STRONG", "TOPICAL_RELEVANCE_STRONG"]),
      policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
    }),
  "DUPLICATE_SIGNAL_CODE",
  "duplicate signal codes must be rejected",
);

const immutableCandidate = candidate();
const immutableSignals = signals(completeCodes);
const candidateSnapshot = JSON.stringify(immutableCandidate);
const querySnapshot = JSON.stringify(query);
const signalsSnapshot = JSON.stringify(immutableSignals);
const policySnapshot = JSON.stringify(DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1);
const first = evaluateBacklinkQualificationCandidate({
  candidate: immutableCandidate,
  query,
  signals: immutableSignals,
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
const second = evaluateBacklinkQualificationCandidate({
  candidate: immutableCandidate,
  query,
  signals: immutableSignals,
  policy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
});
assert(JSON.stringify(first) === JSON.stringify(second), "engine must be deterministic");
assert(first !== second && first.reasons !== second.reasons, "results must be independent");
assert(JSON.stringify(immutableCandidate) === candidateSnapshot, "candidate must not mutate");
assert(JSON.stringify(query) === querySnapshot, "query must not mutate");
assert(JSON.stringify(immutableSignals) === signalsSnapshot, "signals must not mutate");
assert(
  JSON.stringify(DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1) === policySnapshot,
  "policy must not mutate",
);

console.log("PASS — Automation backlink qualification engine smoke");

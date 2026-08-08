import type { Json } from "@/types/database.types";

import {
  BACKLINK_PROMOTION_INPUT_VERSION,
  BACKLINK_PROMOTION_POLICY_VERSION,
  BacklinkPromotionValidationError,
  validateBacklinkPromotionPreviewInput,
  validateBacklinkPromotionPreviewOutput,
  type BacklinkDiscoveryPreviewCandidate,
  type BacklinkPromotionPreviewInputV1,
  type BacklinkPromotionPreviewOutputV1,
  type BacklinkQualificationResult,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertError(
  callback: () => unknown,
  code: BacklinkPromotionValidationError["code"],
): void {
  try {
    callback();
  } catch (error) {
    assert(
      error instanceof BacklinkPromotionValidationError && error.code === code,
      `Expected ${code}`,
    );
    assert(
      !error.message.includes("https://private.example") &&
        !error.message.includes("promotion-secret") &&
        !error.message.includes("Error:"),
      "Validation errors must remain safe",
    );
    return;
  }
  throw new Error(`Expected ${code}`);
}

function candidate(overrides: Partial<BacklinkDiscoveryPreviewCandidate> = {}): BacklinkDiscoveryPreviewCandidate {
  return {
    candidateKey: "candidate-one",
    hostname: "example.com",
    sourceUrl: "https://example.com/host-resources",
    pageTitle: "Host resources",
    snippet: "Useful host resources",
    queryIndex: 0,
    rank: 1,
    countryCode: "US",
    languageCode: "en",
    proposedOpportunityType: null,
    proposedPageType: null,
    suggestedAssetKey: "asset-host-guide",
    evidenceSummary: "Relevant resource page for hosts",
    discoveryScore: 87,
    ...overrides,
  };
}

function qualification(overrides: Partial<BacklinkQualificationResult> = {}): BacklinkQualificationResult {
  return {
    candidateKey: "candidate-one",
    decision: "qualified",
    qualificationScore: 82,
    confidence: "medium",
    reasons: [
      {
        code: "TOPICAL_RELEVANCE_STRONG",
        impact: 30,
        evidence: "The page targets host resources",
      },
    ],
    flags: [],
    proposedOpportunityType: "Resource Page",
    proposedPageType: "resource_page",
    ...overrides,
  };
}

const input: BacklinkPromotionPreviewInputV1 = {
  version: BACKLINK_PROMOTION_INPUT_VERSION,
  source: "automation_qualification",
  policyVersion: BACKLINK_PROMOTION_POLICY_VERSION,
  candidates: [
    candidate(),
    candidate({
      candidateKey: "candidate-two",
      hostname: "blog.example",
      sourceUrl: "https://blog.example/guides",
      queryIndex: 1,
      rank: 2,
    }),
  ],
  qualificationResults: [
    qualification(),
    qualification({
      candidateKey: "candidate-two",
      decision: "review",
      qualificationScore: 57,
      confidence: "low",
      proposedOpportunityType: null,
      proposedPageType: "guide",
    }),
  ],
  includeDecisions: ["qualified"],
  maxProposals: 2,
};

const output: BacklinkPromotionPreviewOutputV1 = {
  version: BACKLINK_PROMOTION_INPUT_VERSION,
  kind: "backlinks.promotion.preview",
  dryRun: true,
  policyVersion: BACKLINK_PROMOTION_POLICY_VERSION,
  summary: {
    qualificationResults: 2,
    eligible: 1,
    proposed: 1,
    skipped: 1,
    duplicates: 0,
  },
  proposals: [
    {
      proposalKey: "promotion:candidate-one",
      candidateKey: "candidate-one",
      hostname: "example.com",
      targetPageUrl: "https://example.com/host-resources",
      targetPageTitle: "Host resources",
      opportunityType: "Resource Page",
      pageType: "Resource Page",
      priority: "Tier A",
      qualificationScore: 82,
      qualificationConfidence: "medium",
      evidenceSummary: "Relevant resource page for hosts",
      suggestedAssetKey: "asset-host-guide",
      promotionDecision: "propose",
    },
  ],
  skippedItems: [
    {
      candidateKey: "candidate-two",
      promotionDecision: "skip",
      skipCode: "QUALIFICATION_REVIEW_REQUIRED",
      evidence: "Qualification requires review",
    },
  ],
};

function main(): void {
  const inputBefore = JSON.stringify(input);
  assert(validateBacklinkPromotionPreviewInput(input) === input, "Input must retain its reference");
  assert(JSON.stringify(input) === inputBefore, "Input must remain immutable");

  for (const invalidRoot of [
    null,
    [],
    { ...input, extra: true },
    { ...input, version: 2 },
    { ...input, source: "manual_dashboard" },
    { ...input, policyVersion: "other" },
    { ...input, maxProposals: 0 },
    { ...input, maxProposals: 51 },
  ]) {
    assertError(() => validateBacklinkPromotionPreviewInput(invalidRoot), "INVALID_PROMOTION_INPUT");
  }
  for (const includeDecisions of [[], ["review"], ["rejected"], ["qualified", "qualified"]]) {
    assertError(
      () => validateBacklinkPromotionPreviewInput({ ...input, includeDecisions }),
      "INVALID_PROMOTION_INPUT",
    );
  }

  const invalidCandidates = [
    candidate({ candidateKey: "" }),
    candidate({ hostname: "EXAMPLE.COM" }),
    candidate({ sourceUrl: "https://other.example/page" }),
    candidate({ sourceUrl: "https://example.com/page#fragment" }),
    candidate({ sourceUrl: "ftp://example.com/page" }),
    candidate({ queryIndex: -1 }),
    candidate({ rank: 0 }),
    candidate({ countryCode: "usa" }),
    candidate({ languageCode: "EN" }),
    candidate({ pageTitle: " " }),
    candidate({ snippet: " " }),
    candidate({ evidenceSummary: " " }),
    candidate({ suggestedAssetKey: " " }),
    candidate({ discoveryScore: 101 }),
  ];
  for (const invalidCandidate of invalidCandidates) {
    assertError(
      () => validateBacklinkPromotionPreviewInput({ ...input, candidates: [invalidCandidate] }),
      "INVALID_PROMOTION_INPUT",
    );
  }
  assertError(
    () => validateBacklinkPromotionPreviewInput({ ...input, candidates: [{ ...candidate(), extra: true }] }),
    "INVALID_PROMOTION_INPUT",
  );

  assertError(
    () =>
      validateBacklinkPromotionPreviewInput({
        ...input,
        candidates: [candidate(), candidate({ sourceUrl: "https://example.com/other" })],
      }),
    "DUPLICATE_PROMOTION_CANDIDATE",
  );
  assertError(
    () =>
      validateBacklinkPromotionPreviewInput({
        ...input,
        candidates: [candidate(), candidate({ candidateKey: "candidate-two", sourceUrl: "https://EXAMPLE.com/host-resources" })],
      }),
    "DUPLICATE_PROMOTION_CANDIDATE",
  );

  const invalidResults = [
    { ...qualification(), decision: "other" },
    qualification({ qualificationScore: 101 }),
    { ...qualification(), confidence: "high" },
    { ...qualification(), reasons: [{ code: "UNKNOWN", impact: 0, evidence: "safe" }] },
    qualification({ reasons: [{ code: "GUIDE_SIGNAL", impact: 101, evidence: "safe" }] }),
    qualification({ reasons: [{ code: "GUIDE_SIGNAL", impact: 1, evidence: " " }] }),
    { ...qualification(), flags: ["unknown"] },
    qualification({ flags: ["blocking", "blocking"] }),
    { ...qualification(), proposedOpportunityType: "Unknown" },
    { ...qualification(), proposedPageType: "other" },
  ];
  for (const invalidResult of invalidResults) {
    assertError(
      () => validateBacklinkPromotionPreviewInput({ ...input, qualificationResults: [invalidResult] }),
      "INVALID_PROMOTION_INPUT",
    );
  }
  assertError(
    () => validateBacklinkPromotionPreviewInput({ ...input, qualificationResults: [{ ...qualification(), extra: true }] }),
    "INVALID_PROMOTION_INPUT",
  );
  assertError(
    () => validateBacklinkPromotionPreviewInput({ ...input, qualificationResults: [qualification(), qualification()] }),
    "DUPLICATE_PROMOTION_QUALIFICATION_RESULT",
  );
  assertError(
    () => validateBacklinkPromotionPreviewInput({ ...input, qualificationResults: [qualification({ candidateKey: "orphan" })] }),
    "PROMOTION_CANDIDATE_RESULT_MISMATCH",
  );

  const largeCandidates = Array.from({ length: 50 }, (_, index) =>
    candidate({
      candidateKey: `candidate-${index}`,
      sourceUrl: `https://example.com/${index}`,
      pageTitle: "t".repeat(300),
      snippet: "s".repeat(500),
      evidenceSummary: "e".repeat(500),
    }),
  );
  assertError(
    () => validateBacklinkPromotionPreviewInput({ ...input, candidates: largeCandidates, qualificationResults: [] }),
    "PROMOTION_INPUT_TOO_LARGE",
  );

  const outputBefore = JSON.stringify(output);
  const promotionOutput = validateBacklinkPromotionPreviewOutput(output);
  const persistedJson: Json = promotionOutput;
  assert(persistedJson === promotionOutput, "Output must be JSON-compatible without adaptation");
  assert(promotionOutput === output, "Output must retain its reference");
  assert(JSON.stringify(output) === outputBefore, "Output must remain immutable");

  for (const invalidOutput of [
    { ...output, extra: true },
    { ...output, summary: { ...output.summary, proposed: 0 } },
    { ...output, proposals: [output.proposals[0], output.proposals[0]], summary: { ...output.summary, qualificationResults: 3, eligible: 2, proposed: 2 } },
    { ...output, proposals: [{ ...output.proposals[0], candidateKey: "candidate-two" }, { ...output.proposals[0], proposalKey: "promotion:two", candidateKey: "candidate-two" }], summary: { ...output.summary, qualificationResults: 3, eligible: 2, proposed: 2 } },
    { ...output, proposals: [{ ...output.proposals[0], priority: "urgent" }] },
    { ...output, proposals: [{ ...output.proposals[0], targetPageTitle: "t".repeat(301) }] },
    { ...output, skippedItems: [{ ...output.skippedItems[0], skipCode: "unknown" }] },
  ]) {
    assertError(() => validateBacklinkPromotionPreviewOutput(invalidOutput), "INVALID_PROMOTION_OUTPUT");
  }

  const largeOutput: BacklinkPromotionPreviewOutputV1 = {
    ...output,
    summary: { qualificationResults: 100, eligible: 50, proposed: 50, skipped: 50, duplicates: 0 },
    proposals: Array.from({ length: 50 }, (_, index) => ({
      ...output.proposals[0],
      proposalKey: `promotion-${index}`,
      candidateKey: `candidate-proposal-${index}`,
      evidenceSummary: "e".repeat(500),
    })),
    skippedItems: Array.from({ length: 50 }, (_, index) => ({
      ...output.skippedItems[0],
      candidateKey: `candidate-skipped-${index}`,
      evidence: "s".repeat(300),
    })),
  };
  assertError(() => validateBacklinkPromotionPreviewOutput(largeOutput), "INVALID_PROMOTION_OUTPUT");

  console.log("PASS — Automation backlink promotion validation smoke");
}

main();

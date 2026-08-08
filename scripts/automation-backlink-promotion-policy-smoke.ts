import {
  BACKLINK_PROMOTION_POLICY_VERSION,
  BacklinkPromotionMappingError,
  BacklinkPromotionPolicyError,
  DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
  buildBacklinkPromotionEvidenceSummary,
  buildBacklinkPromotionProposalKey,
  evaluateBacklinkPromotionEligibility,
  mapQualificationOpportunityTypeToPromotion,
  mapQualificationPageTypeToPromotion,
  mapQualificationScoreToPromotionPriority,
  validateBacklinkPromotionPolicy,
  type BacklinkDiscoveryPreviewCandidate,
  type BacklinkPromotionPolicy,
  type BacklinkQualificationResult,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertPolicyError(input: unknown, code: BacklinkPromotionPolicyError["code"]): void {
  try {
    validateBacklinkPromotionPolicy(input);
  } catch (error) {
    assert(error instanceof BacklinkPromotionPolicyError && error.code === code, `Expected ${code}`);
    assert(!error.message.includes("promotion-secret"), "Policy error must remain safe");
    return;
  }
  throw new Error(`Expected ${code}`);
}

function candidate(overrides: Partial<BacklinkDiscoveryPreviewCandidate> = {}): BacklinkDiscoveryPreviewCandidate {
  return {
    candidateKey: "candidate-one",
    hostname: "example.com",
    sourceUrl: "https://example.com/resources",
    pageTitle: "Host resources",
    snippet: "Useful resources",
    queryIndex: 0,
    rank: 1,
    countryCode: "US",
    languageCode: "en",
    proposedOpportunityType: null,
    proposedPageType: null,
    suggestedAssetKey: "asset-host-guide",
    evidenceSummary: "Relevant host resource page",
    discoveryScore: 100,
    ...overrides,
  };
}

function qualification(overrides: Partial<BacklinkQualificationResult> = {}): BacklinkQualificationResult {
  return {
    candidateKey: "candidate-one",
    decision: "qualified",
    qualificationScore: 85,
    confidence: "medium",
    reasons: [
      { code: "TOPICAL_RELEVANCE_STRONG", impact: 35, evidence: "Hosts are the intended audience" },
      { code: "RESOURCE_PAGE_SIGNAL", impact: 20, evidence: "Resources are editorially relevant" },
      { code: "GUIDE_SIGNAL", impact: 15, evidence: "Ignored third reason" },
    ],
    flags: [],
    proposedOpportunityType: "Resource Page",
    proposedPageType: "resource_page",
    ...overrides,
  };
}

function main(): void {
  const policyBefore = JSON.stringify(DEFAULT_BACKLINK_PROMOTION_POLICY_V1);
  assert(
    validateBacklinkPromotionPolicy(DEFAULT_BACKLINK_PROMOTION_POLICY_V1) === DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
    "Default policy must retain its reference",
  );
  assert(JSON.stringify(DEFAULT_BACKLINK_PROMOTION_POLICY_V1) === policyBefore, "Default policy must remain immutable");
  assert(
    DEFAULT_BACKLINK_PROMOTION_POLICY_V1.version === BACKLINK_PROMOTION_POLICY_VERSION &&
      DEFAULT_BACKLINK_PROMOTION_POLICY_V1.minimumQualificationScore === 70 &&
      DEFAULT_BACKLINK_PROMOTION_POLICY_V1.tierAThreshold === 85 &&
      DEFAULT_BACKLINK_PROMOTION_POLICY_V1.tierBThreshold === 70,
    "Default policy values must be exact",
  );

  for (const invalid of [
    null,
    (() => { const { version: omittedVersion, ...rest } = DEFAULT_BACKLINK_PROMOTION_POLICY_V1; void omittedVersion; return rest; })(),
    { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, extra: true },
    { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, version: "other" },
    { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, includeDecisions: [] },
    { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, includeDecisions: ["review"] },
    { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, includeDecisions: ["qualified", "qualified"] },
    { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, minimumQualificationScore: 101 },
    { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, requirePageTitle: "true" },
  ]) {
    assertPolicyError(invalid, "INVALID_PROMOTION_POLICY");
  }
  for (const invalid of [
    { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, tierAThreshold: 70 },
    { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, tierBThreshold: 69 },
  ]) {
    assertPolicyError(invalid, "PROMOTION_POLICY_THRESHOLD_INVALID");
  }

  const opportunityMappings = [
    "Resource Page", "Guest Post", "Tools List", "Comparison", "Directory", "Partnership", "Editorial Mention", "Other",
  ] as const;
  for (const value of opportunityMappings) {
    assert(mapQualificationOpportunityTypeToPromotion(value) === value, "Opportunity mapping must be exact");
  }
  assert(mapQualificationOpportunityTypeToPromotion(null) === null, "Null opportunity must remain null");
  assert(mapQualificationPageTypeToPromotion("resource_page") === "Resource Page", "Resource page mapping");
  assert(mapQualificationPageTypeToPromotion("guide") === "Guide", "Guide mapping");
  assert(mapQualificationPageTypeToPromotion("tools_list") === "Best Tools List", "Tools mapping");
  assert(mapQualificationPageTypeToPromotion("directory") === "Directory", "Directory mapping");
  assert(mapQualificationPageTypeToPromotion("blog_post") === "Blog Article", "Blog mapping");
  assert(mapQualificationPageTypeToPromotion("support_page") === "Knowledge Base", "Support mapping");
  assert(mapQualificationPageTypeToPromotion("comparison") === null, "Comparison must remain unsupported");
  assert(mapQualificationPageTypeToPromotion("unknown") === null, "Unknown must remain unsupported");

  assert(mapQualificationScoreToPromotionPriority(85, DEFAULT_BACKLINK_PROMOTION_POLICY_V1) === "Tier A", "Tier A threshold");
  assert(mapQualificationScoreToPromotionPriority(84, DEFAULT_BACKLINK_PROMOTION_POLICY_V1) === "Tier B", "Just below Tier A");
  assert(mapQualificationScoreToPromotionPriority(70, DEFAULT_BACKLINK_PROMOTION_POLICY_V1) === "Tier B", "Tier B threshold");
  assert(mapQualificationScoreToPromotionPriority(69, DEFAULT_BACKLINK_PROMOTION_POLICY_V1) === "Tier C", "Just below Tier B");

  const candidateValue = candidate();
  const qualificationValue = qualification();
  const eligibility = evaluateBacklinkPromotionEligibility({
    candidate: candidateValue,
    qualificationResult: qualificationValue,
    policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
  });
  assert(eligibility.eligible && eligibility.opportunityType === "Resource Page" && eligibility.pageType === "Resource Page" && eligibility.priority === "Tier A", "Qualified candidate must be eligible");

  const skipped = [
    [qualification({ decision: "review" }), "QUALIFICATION_REVIEW_REQUIRED"],
    [qualification({ decision: "rejected" }), "QUALIFICATION_REJECTED"],
    [qualification({ qualificationScore: 69 }), "QUALIFICATION_NOT_INCLUDED"],
    [qualification(), "MISSING_PAGE_TITLE", candidate({ pageTitle: null })],
    [qualification({ proposedOpportunityType: null }), "UNSUPPORTED_OPPORTUNITY_TYPE"],
    [qualification({ proposedPageType: "comparison" }), "UNSUPPORTED_PAGE_TYPE"],
  ] as const;
  for (const [result, code, candidateOverride] of skipped) {
    const value = evaluateBacklinkPromotionEligibility({
      candidate: candidateOverride ?? candidateValue,
      qualificationResult: result,
      policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
    });
    assert(!value.eligible && value.skipCode === code && value.evidence.length <= 300, `Expected ${code}`);
  }
  const assetPolicy: BacklinkPromotionPolicy = { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, requireAssetSuggestion: true };
  const assetSkip = evaluateBacklinkPromotionEligibility({ candidate: candidate({ suggestedAssetKey: null }), qualificationResult: qualificationValue, policy: assetPolicy });
  assert(!assetSkip.eligible && assetSkip.skipCode === "MISSING_ASSET_SUGGESTION", "Missing asset skip");
  const evidenceSkip = evaluateBacklinkPromotionEligibility({ candidate: candidate({ evidenceSummary: "", pageTitle: null }), qualificationResult: qualification({ reasons: [] }), policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 });
  assert(!evidenceSkip.eligible && evidenceSkip.skipCode === "MISSING_PAGE_TITLE", "Rule order must prefer title before evidence");

  try {
    evaluateBacklinkPromotionEligibility({ candidate: candidateValue, qualificationResult: qualification({ candidateKey: "other" }), policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 });
  } catch (error) {
    assert(error instanceof BacklinkPromotionMappingError && error.code === "PROMOTION_CANDIDATE_KEY_MISMATCH", "Candidate mismatch must be invariant error");
  }

  assert(buildBacklinkPromotionProposalKey("candidate-one") === "promotion:candidate-one", "Proposal key must be exact");
  assert(buildBacklinkPromotionProposalKey("candidate-one") === buildBacklinkPromotionProposalKey("candidate-one"), "Proposal key must be deterministic");
  for (const key of ["", " ", "x".repeat(151)]) {
    try { buildBacklinkPromotionProposalKey(key); } catch (error) { assert(error instanceof BacklinkPromotionMappingError, "Invalid key must fail safely"); continue; }
    throw new Error("Invalid proposal key must fail");
  }

  const summary = buildBacklinkPromotionEvidenceSummary({ candidate: candidateValue, qualificationResult: qualificationValue });
  assert(summary.includes("85/100") && summary.includes("Resource Page") && summary.includes("TOPICAL_RELEVANCE_STRONG") && summary.includes("RESOURCE_PAGE_SIGNAL"), "Evidence summary must contain bounded signals");
  assert(!summary.includes(candidateValue.candidateKey) && !summary.includes(candidateValue.sourceUrl) && summary.length <= 500, "Evidence summary must remain safe");
  assert(buildBacklinkPromotionEvidenceSummary({ candidate: candidate({ evidenceSummary: "", pageTitle: null }), qualificationResult: qualification({ reasons: [] }) }) === "", "Insufficient evidence must be empty");
  assert(JSON.stringify(candidateValue) === JSON.stringify(candidate()) && JSON.stringify(qualificationValue) === JSON.stringify(qualification()), "Inputs must remain immutable");

  console.log("PASS — Automation backlink promotion policy smoke");
}

main();

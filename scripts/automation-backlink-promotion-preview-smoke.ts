import type { Json } from "@/types/database.types";

import {
  BacklinkPromotionPreviewError,
  DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
  executeBacklinkPromotionPreview,
  type BacklinkDiscoveryPreviewCandidate,
  type BacklinkPromotionPreviewInputV1,
  type BacklinkQualificationResult,
} from "../lib/automation";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function candidate(
  candidateKey: string,
  sourceUrl: string,
  overrides: Partial<BacklinkDiscoveryPreviewCandidate> = {},
): BacklinkDiscoveryPreviewCandidate {
  return {
    candidateKey,
    hostname: new URL(sourceUrl).hostname,
    sourceUrl,
    pageTitle: `Title ${candidateKey}`,
    snippet: "Relevant page",
    queryIndex: 0,
    rank: 1,
    countryCode: "US",
    languageCode: "en",
    proposedOpportunityType: null,
    proposedPageType: null,
    suggestedAssetKey: "asset-guide",
    evidenceSummary: "Relevant host resource evidence",
    discoveryScore: 90,
    ...overrides,
  };
}

function qualification(
  candidateKey: string,
  overrides: Partial<BacklinkQualificationResult> = {},
): BacklinkQualificationResult {
  return {
    candidateKey,
    decision: "qualified",
    qualificationScore: 85,
    confidence: "medium",
    reasons: [{ code: "TOPICAL_RELEVANCE_STRONG", impact: 35, evidence: "Host audience is relevant" }],
    flags: [],
    proposedOpportunityType: "Resource Page",
    proposedPageType: "resource_page",
    ...overrides,
  };
}

function input(
  candidates: BacklinkDiscoveryPreviewCandidate[],
  qualificationResults: BacklinkQualificationResult[],
  maxProposals = 50,
): BacklinkPromotionPreviewInputV1 {
  return {
    version: 1,
    source: "automation_qualification",
    policyVersion: "backlink-promotion-v1",
    candidates,
    qualificationResults,
    includeDecisions: ["qualified"],
    maxProposals,
  };
}

function main(): void {
  const first = candidate("candidate-a", "https://a.example/resources");
  const second = candidate("candidate-b", "https://b.example/tools");
  const third = candidate("candidate-c", "https://c.example/review");
  const fourth = candidate("candidate-d", "https://d.example/rejected");
  const fifth = candidate("candidate-e", "https://e.example/comparison");
  const nominalInput = input(
    [fifth, first, second, third, fourth],
    [
      qualification("candidate-a"),
      qualification("candidate-b", { qualificationScore: 75, proposedOpportunityType: "Tools List", proposedPageType: "tools_list" }),
      qualification("candidate-c", { decision: "review" }),
      qualification("candidate-d", { decision: "rejected" }),
      qualification("candidate-e", { proposedPageType: "comparison" }),
    ],
  );
  const snapshot = JSON.stringify(nominalInput);
  const output = executeBacklinkPromotionPreview({ input: nominalInput, policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 });
  const persistedJson: Json = output;
  assert(persistedJson === output, "Output must be JSON-compatible");
  assert(JSON.stringify(nominalInput) === snapshot, "Input must remain immutable");
  assert(output.summary.qualificationResults === 5 && output.summary.eligible === 2 && output.summary.proposed === 2 && output.summary.skipped === 3 && output.summary.duplicates === 0, "Nominal summary");
  assert(output.proposals.map((proposal) => proposal.candidateKey).join(",") === "candidate-a,candidate-b", "Qualification order must be retained");
  assert(output.proposals[0]?.priority === "Tier A" && output.proposals[1]?.priority === "Tier B", "Priorities must be exact");
  assert(output.skippedItems.map((item) => item.skipCode).join(",") === "QUALIFICATION_REVIEW_REQUIRED,QUALIFICATION_REJECTED,UNSUPPORTED_PAGE_TYPE", "Skip order must be retained");
  assert(output.proposals[0]?.proposalKey === "promotion:candidate-a" && output.proposals[0]?.targetPageTitle === "Title candidate-a", "Proposal fields must be exact");

  const zero = executeBacklinkPromotionPreview({ input: input([first], []), policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 });
  assert(zero.summary.qualificationResults === 0 && zero.summary.eligible === 0 && zero.proposals.length === 0 && zero.skippedItems.length === 0, "Zero results must remain empty");

  const limited = executeBacklinkPromotionPreview({
    input: input([first, second], [qualification("candidate-a"), qualification("candidate-b")], 1),
    policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
  });
  assert(limited.summary.eligible === 2 && limited.summary.proposed === 1 && limited.summary.skipped === 1 && limited.skippedItems[0]?.skipCode === "PROPOSAL_LIMIT_REACHED", "Proposal limit must retain eligible count");

  const assetPolicy = { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, requireAssetSuggestion: true };
  const asset = executeBacklinkPromotionPreview({ input: input([candidate("candidate-asset", "https://asset.example/page", { suggestedAssetKey: null })], [qualification("candidate-asset")]), policy: assetPolicy });
  assert(asset.skippedItems[0]?.skipCode === "MISSING_ASSET_SUGGESTION", "Asset policy skip");
  const evidence = output.proposals[0]?.evidenceSummary ?? "";
  assert(evidence.length <= 500 && !evidence.includes("https://") && !evidence.includes("candidate-a"), "Evidence must be bounded and safe");
  assert(output.summary.proposed + output.summary.skipped === output.summary.qualificationResults && output.summary.duplicates <= output.summary.skipped, "Summary invariants");

  try {
    executeBacklinkPromotionPreview({ input: nominalInput, policy: { ...DEFAULT_BACKLINK_PROMOTION_POLICY_V1, tierAThreshold: 70 } });
  } catch (error) {
    assert(error instanceof Error, "Invalid policy must propagate");
  }
  try {
    const invalidInput = { ...nominalInput, maxProposals: 0 };
    executeBacklinkPromotionPreview({ input: invalidInput, policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 });
  } catch (error) {
    assert(error instanceof Error, "Invalid input must propagate");
  }
  try {
    throw new BacklinkPromotionPreviewError();
  } catch (error) {
    assert(error instanceof BacklinkPromotionPreviewError, "Internal invariant error remains public");
  }

  const secondOutput = executeBacklinkPromotionPreview({ input: nominalInput, policy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1 });
  assert(JSON.stringify(output) === JSON.stringify(secondOutput) && output !== secondOutput && output.proposals !== secondOutput.proposals, "Outputs must be deterministic and independent");
  console.log("PASS — Automation backlink promotion preview smoke");
}

main();

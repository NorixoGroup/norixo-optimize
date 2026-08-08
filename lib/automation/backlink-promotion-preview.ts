import { normalizeBacklinkDiscoveryUrl } from "./backlink-discovery-normalization";
import {
  buildBacklinkPromotionEvidenceSummary,
  buildBacklinkPromotionProposalKey,
  evaluateBacklinkPromotionEligibility,
} from "./backlink-promotion-mapping";
import { validateBacklinkPromotionPolicy } from "./backlink-promotion-policy";
import { validateBacklinkPromotionPreviewInput, validateBacklinkPromotionPreviewOutput } from "./backlink-promotion-validation";
import type {
  BacklinkPromotionPreviewOutputV1,
  BacklinkPromotionProposal,
  BacklinkPromotionSkippedItem,
} from "./backlink-promotion-types";
import {
  BacklinkPromotionPreviewError,
  type ExecuteBacklinkPromotionPreviewInput,
} from "./backlink-promotion-preview-types";

function invariant(): never {
  throw new BacklinkPromotionPreviewError();
}

function canonicalSourceUrl(sourceUrl: string): string {
  try {
    return normalizeBacklinkDiscoveryUrl(sourceUrl).sourceUrl;
  } catch {
    return invariant();
  }
}

export function executeBacklinkPromotionPreview(
  input: ExecuteBacklinkPromotionPreviewInput,
): BacklinkPromotionPreviewOutputV1 {
  const policy = validateBacklinkPromotionPolicy(input.policy);
  const previewInput = validateBacklinkPromotionPreviewInput(input.input);
  const candidatesByKey = new Map(
    previewInput.candidates.map((candidate) => [candidate.candidateKey, candidate]),
  );
  const proposedUrls = new Set<string>();
  const proposalKeys = new Set<string>();
  const proposals: BacklinkPromotionProposal[] = [];
  const skippedItems: BacklinkPromotionSkippedItem[] = [];
  let eligible = 0;
  let duplicates = 0;

  for (const qualificationResult of previewInput.qualificationResults) {
    const candidate = candidatesByKey.get(qualificationResult.candidateKey);
    if (candidate === undefined) return invariant();

    const eligibility = evaluateBacklinkPromotionEligibility({
      candidate,
      qualificationResult,
      policy,
    });
    if (!eligibility.eligible) {
      skippedItems.push({
        candidateKey: candidate.candidateKey,
        promotionDecision: "skip",
        skipCode: eligibility.skipCode,
        evidence: eligibility.evidence,
      });
      continue;
    }

    eligible += 1;
    const proposalKey = buildBacklinkPromotionProposalKey(candidate.candidateKey);
    const sourceUrl = canonicalSourceUrl(candidate.sourceUrl);
    if (proposedUrls.has(sourceUrl)) {
      skippedItems.push({
        candidateKey: candidate.candidateKey,
        promotionDecision: "skip",
        skipCode: "DUPLICATE_URL",
        evidence: "A prior promotion proposal already uses this canonical URL.",
      });
      duplicates += 1;
      continue;
    }
    if (proposalKeys.has(proposalKey)) {
      skippedItems.push({
        candidateKey: candidate.candidateKey,
        promotionDecision: "skip",
        skipCode: "DUPLICATE_CANDIDATE",
        evidence: "A prior promotion proposal already uses this candidate.",
      });
      duplicates += 1;
      continue;
    }
    if (proposals.length >= previewInput.maxProposals) {
      skippedItems.push({
        candidateKey: candidate.candidateKey,
        promotionDecision: "skip",
        skipCode: "PROPOSAL_LIMIT_REACHED",
        evidence: "The promotion proposal limit has been reached.",
      });
      continue;
    }
    if (candidate.pageTitle === null) return invariant();

    proposals.push({
      proposalKey,
      candidateKey: candidate.candidateKey,
      hostname: candidate.hostname,
      targetPageUrl: candidate.sourceUrl,
      targetPageTitle: candidate.pageTitle,
      opportunityType: eligibility.opportunityType,
      pageType: eligibility.pageType,
      priority: eligibility.priority,
      qualificationScore: qualificationResult.qualificationScore,
      qualificationConfidence: qualificationResult.confidence,
      evidenceSummary: buildBacklinkPromotionEvidenceSummary({ candidate, qualificationResult }),
      suggestedAssetKey: candidate.suggestedAssetKey,
      promotionDecision: "propose",
    });
    proposedUrls.add(sourceUrl);
    proposalKeys.add(proposalKey);
  }

  const output: BacklinkPromotionPreviewOutputV1 = {
    version: 1,
    kind: "backlinks.promotion.preview",
    dryRun: true,
    policyVersion: previewInput.policyVersion,
    summary: {
      qualificationResults: previewInput.qualificationResults.length,
      eligible,
      proposed: proposals.length,
      skipped: skippedItems.length,
      duplicates,
    },
    proposals,
    skippedItems,
  };
  return validateBacklinkPromotionPreviewOutput(output);
}

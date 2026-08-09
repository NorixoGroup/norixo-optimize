export type AutomationPromotionPreviewView = {
  version: 1;
  kind: "backlinks.promotion.preview";
  dryRun: true;
  policyVersion: string;
  summary: {
    qualificationResults: number;
    eligible: number;
    proposed: number;
    skipped: number;
    duplicates: number;
  };
  proposals: {
    proposalKey: string;
    hostname: string;
    targetPageUrl: string;
    targetPageTitle: string;
    opportunityType: string;
    pageType: string;
    priority: string;
    qualificationScore: number;
    qualificationConfidence: "low" | "medium";
    evidenceSummary: string;
    suggestedAssetKey: string | null;
  }[];
  skippedItems: {
    candidateKey: string;
    promotionDecision: "skip";
    skipCode: string;
    evidence: string;
  }[];
};

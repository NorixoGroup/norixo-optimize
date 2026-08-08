export type QualificationFilter = "all" | "qualified" | "review" | "rejected";

export type AutomationQualificationPreviewView = {
  version: 1;
  kind: "backlinks.qualification.preview";
  dryRun: true;
  policyVersion: "backlink-qualification-v1";
  summary: { candidatesEvaluated: number; qualified: number; review: number; rejected: number };
  results: {
    candidateKey: string;
    decision: "qualified" | "review" | "rejected";
    qualificationScore: number;
    confidence: "low" | "medium";
    reasons: { code: string; impact: number; evidence: string }[];
    flags: ("blocking" | "requires_review" | "insufficient_evidence")[];
    proposedOpportunityType: "Resource Page" | "Guest Post" | "Tools List" | "Comparison" | "Directory" | "Partnership" | "Editorial Mention" | "Other" | null;
    proposedPageType: "resource_page" | "guide" | "tools_list" | "comparison" | "directory" | "blog_post" | "support_page" | "unknown";
  }[];
};

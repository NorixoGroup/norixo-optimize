export type VerificationStatus =
  | "FOUND"
  | "NOT_FOUND"
  | "ANCHOR_CHANGED"
  | "REL_CHANGED"
  | "TARGET_CHANGED"
  | "UNKNOWN";

export interface VerificationEvidence {
  checkedAt: string;
  sourceUrl?: string;
  targetUrl?: string;
  matchedHref?: string;
  matchedAnchor?: string;
  matchedRel?: string;
  httpStatus?: number;
  redirectCount?: number;
  htmlHash?: string;
}

export type VerificationIssueSeverity = "info" | "warning" | "error";

export interface VerificationIssue {
  code: string;
  message: string;
  severity: VerificationIssueSeverity;
}

export interface VerificationResult {
  status: VerificationStatus;
  issues: VerificationIssue[];
  evidence: VerificationEvidence;
  verifiedAt: string;
}

export interface VerificationPolicy {
  strictAnchor?: boolean;
  strictRel?: boolean;
  followRedirects?: boolean;
  maxRedirects?: number;
  acceptCanonical?: boolean;
}

export interface VerificationRequest {
  sourceUrl: string;
  targetUrl: string;
  checkedAt: string;
  policy: VerificationPolicy;
  evidence: Partial<VerificationEvidence>;
}

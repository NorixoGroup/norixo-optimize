import {
  isAnchorAcceptable,
  isRedirectAcceptable,
  isRelAcceptable,
  isTargetAcceptable,
  isVerificationSuccessful,
} from "./rules";
import type {
  VerificationEvidence,
  VerificationIssue,
  VerificationPolicy,
  VerificationResult,
} from "./types";

export function evaluateVerification(
  evidence: VerificationEvidence,
  policy: VerificationPolicy,
): VerificationResult {
  const verifiedAt = evidence.checkedAt;

  if (!evidence.sourceUrl || !evidence.targetUrl) {
    return {
      status: "UNKNOWN",
      issues: [{ code: "INSUFFICIENT_EVIDENCE", message: "Verification evidence is incomplete.", severity: "info" }],
      evidence,
      verifiedAt,
    };
  }

  if (!evidence.matchedHref) {
    return {
      status: "NOT_FOUND",
      issues: [{ code: "LINK_NOT_FOUND", message: "No matching link was observed.", severity: "warning" }],
      evidence,
      verifiedAt,
    };
  }

  const anchorAcceptable = isAnchorAcceptable(undefined, evidence.matchedAnchor, policy);
  const relAcceptable = isRelAcceptable(undefined, evidence.matchedRel, policy);
  const targetAcceptable = isTargetAcceptable(evidence.targetUrl, evidence.matchedHref, undefined, policy);
  const redirectAcceptable = isRedirectAcceptable(evidence.redirectCount, policy);
  const issues: VerificationIssue[] = [];

  if (!anchorAcceptable) issues.push({ code: "ANCHOR_MISMATCH", message: "Anchor does not match the verification policy.", severity: "warning" });
  if (!relAcceptable) issues.push({ code: "REL_MISMATCH", message: "Rel attributes do not match the verification policy.", severity: "warning" });
  if (!targetAcceptable) issues.push({ code: "TARGET_MISMATCH", message: "Target does not match the verification policy.", severity: "error" });
  if (!redirectAcceptable) issues.push({ code: "REDIRECT_LIMIT_EXCEEDED", message: "Redirects do not match the verification policy.", severity: "warning" });

  if (isVerificationSuccessful({ anchorAcceptable, relAcceptable, targetAcceptable, redirectAcceptable })) {
    return { status: "FOUND", issues, evidence, verifiedAt };
  }

  return {
    status: !targetAcceptable ? "TARGET_CHANGED" : "UNKNOWN",
    issues,
    evidence,
    verifiedAt,
  };
}

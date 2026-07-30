import { evaluateVerification } from "./evaluator";
import type {
  VerificationEvidence,
  VerificationRequest,
  VerificationResult,
} from "./types";

function normalizeOptionalString(value: string | undefined): string | undefined {
  return value?.trim();
}

export function runVerification(request: VerificationRequest): VerificationResult {
  const evidence: VerificationEvidence = {
    ...request.evidence,
    checkedAt: request.checkedAt.trim(),
    sourceUrl: request.sourceUrl.trim(),
    targetUrl: request.targetUrl.trim(),
    matchedHref: normalizeOptionalString(request.evidence.matchedHref),
    matchedAnchor: normalizeOptionalString(request.evidence.matchedAnchor),
    matchedRel: normalizeOptionalString(request.evidence.matchedRel),
    htmlHash: normalizeOptionalString(request.evidence.htmlHash),
  };

  return evaluateVerification(evidence, request.policy);
}

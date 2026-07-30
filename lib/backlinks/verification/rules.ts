import type { VerificationPolicy } from "./types";

export function isAnchorAcceptable(
  expectedAnchor: string | undefined,
  matchedAnchor: string | undefined,
  policy: VerificationPolicy,
): boolean {
  return !policy.strictAnchor || expectedAnchor == null || expectedAnchor === matchedAnchor;
}

export function isRelAcceptable(
  expectedRel: string | undefined,
  matchedRel: string | undefined,
  policy: VerificationPolicy,
): boolean {
  return !policy.strictRel || expectedRel == null || expectedRel === matchedRel;
}

export function isTargetAcceptable(
  expectedTarget: string | undefined,
  matchedTarget: string | undefined,
  canonicalTarget: string | undefined,
  policy: VerificationPolicy,
): boolean {
  if (expectedTarget == null || expectedTarget === matchedTarget) return true;
  return policy.acceptCanonical === true && canonicalTarget != null && canonicalTarget === matchedTarget;
}

export function isRedirectAcceptable(
  redirectCount: number | undefined,
  policy: VerificationPolicy,
): boolean {
  if (redirectCount == null) return true;
  if (policy.followRedirects !== true) return redirectCount === 0;
  return policy.maxRedirects == null || redirectCount <= policy.maxRedirects;
}

export function isVerificationSuccessful(params: {
  anchorAcceptable: boolean;
  relAcceptable: boolean;
  targetAcceptable: boolean;
  redirectAcceptable: boolean;
}): boolean {
  return (
    params.anchorAcceptable &&
    params.relAcceptable &&
    params.targetAcceptable &&
    params.redirectAcceptable
  );
}

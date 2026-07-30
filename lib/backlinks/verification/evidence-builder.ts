import type { HtmlLinkObservation } from "../html";

import type { VerificationEvidence } from "./types";

export interface VerificationEvidenceRequest {
  sourceUrl: string;
  targetUrl: string;
  checkedAt: string;
  links: HtmlLinkObservation[];
}

function normalizeUrl(value: string): string | undefined {
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

export function buildVerificationEvidence(request: VerificationEvidenceRequest): VerificationEvidence {
  const normalizedTargetUrl = normalizeUrl(request.targetUrl);
  const matchedLink = normalizedTargetUrl == null
    ? undefined
    : request.links.find((link) => link.resolvedUrl != null && normalizeUrl(link.resolvedUrl) === normalizedTargetUrl);

  return {
    sourceUrl: request.sourceUrl,
    targetUrl: request.targetUrl,
    checkedAt: request.checkedAt,
    ...(matchedLink == null
      ? {}
      : {
          matchedHref: matchedLink.resolvedUrl,
          matchedAnchor: matchedLink.text,
          matchedRel: [...matchedLink.rel].join(" "),
        }),
  };
}

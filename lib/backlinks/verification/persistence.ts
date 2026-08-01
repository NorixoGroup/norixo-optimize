import type { BacklinkLinkRow } from "../repositories/linksRepository";
import type { UpdateLinkVerificationInput } from "../services/linkService";

import type {
  PersistBacklinkVerificationDependencies,
  PersistBacklinkVerificationResult,
  PersistBacklinkVerificationResultInput,
} from "./persistence-types";
import type { VerificationResult } from "./types";

function isStaleVerification(existingLink: BacklinkLinkRow, verifiedAt: string): boolean {
  if (existingLink.last_verified_at == null) {
    return false;
  }

  const incomingTime = Date.parse(verifiedAt);
  const persistedTime = Date.parse(existingLink.last_verified_at);

  return Number.isFinite(incomingTime) && Number.isFinite(persistedTime) && incomingTime <= persistedTime;
}

function serializeVerificationEvidence(verification: VerificationResult): string {
  return JSON.stringify({
    status: verification.status,
    verifiedAt: verification.verifiedAt,
    evidence: verification.evidence,
    issues: verification.issues,
  });
}

function buildVerificationUpdate(
  existingLink: BacklinkLinkRow,
  verification: VerificationResult,
): UpdateLinkVerificationInput | undefined {
  const verifiedAt = verification.verifiedAt;
  const verificationMetadata = {
    last_verified_at: verifiedAt,
    verification_source: "verification_runtime",
    verification_evidence: serializeVerificationEvidence(verification),
  };

  switch (verification.status) {
    case "FOUND":
      return {
        ...verificationMetadata,
        status: "active",
        first_verified_at: existingLink.first_verified_at ?? verifiedAt,
        last_seen_at: verifiedAt,
        lost_at: null,
        lost_reason: null,
      };
    case "NOT_FOUND":
      return {
        ...verificationMetadata,
        status: "lost",
        lost_at: verifiedAt,
        lost_reason: "link_not_found",
      };
    case "ANCHOR_CHANGED":
    case "REL_CHANGED":
    case "TARGET_CHANGED":
      return {
        ...verificationMetadata,
        status: "changed",
        last_seen_at: verifiedAt,
        lost_at: null,
        lost_reason: null,
      };
    case "UNKNOWN":
      return undefined;
  }
}

export async function persistBacklinkVerificationResult(
  input: PersistBacklinkVerificationResultInput,
  dependencies: PersistBacklinkVerificationDependencies,
): Promise<PersistBacklinkVerificationResult> {
  if (input.runtimeResult.kind === "fetch_error") {
    return { kind: "skipped", reason: "fetch_error" };
  }

  if (input.runtimeResult.kind === "http_unusable") {
    return { kind: "skipped", reason: "http_unusable" };
  }

  const existingLink = await dependencies.getLink(input.workspaceId, input.linkId);
  const verification = input.runtimeResult.verification;

  if (isStaleVerification(existingLink, verification.verifiedAt)) {
    return { kind: "skipped", reason: "stale_result" };
  }

  const update = buildVerificationUpdate(existingLink, verification);

  if (update == null) {
    return { kind: "skipped", reason: "unresolved_verification" };
  }

  return {
    kind: "persisted",
    link: await dependencies.updateVerification(input.workspaceId, input.linkId, update),
  };
}

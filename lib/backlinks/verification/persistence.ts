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
  confirmedLost: boolean,
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
      if (!confirmedLost) {
        return {
          ...verificationMetadata,
          status: existingLink.status,
        };
      }
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

function isCompletedSchedulerVerificationStatus(job: {
  trigger_source: string;
  status: string;
  result_summary: unknown | null;
}): boolean {
  if (job.trigger_source !== "scheduler" || job.status !== "completed") {
    return false;
  }

  const summary = job.result_summary;
  if (
    typeof summary !== "object" ||
    summary == null ||
    Array.isArray(summary) ||
    !("verificationStatus" in summary)
  ) {
    return false;
  }

  const { verificationStatus } = summary as { verificationStatus?: unknown };
  return verificationStatus === "NOT_FOUND";
}

function hasConsecutiveScheduledNotFoundHistory(history: Array<{
  trigger_source: string;
  status: string;
  completed_at: string | null;
  result_summary: unknown | null;
  created_at: string;
}>): boolean {
  let streak = 0;

  for (const job of history) {
    if (!isCompletedSchedulerVerificationStatus(job)) {
      break;
    }

    streak += 1;
    if (streak >= 1) {
      return true;
    }
  }

  return false;
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

  let confirmedLost = true;
  if (
    input.triggerSource === "scheduler" &&
    verification.status === "NOT_FOUND" &&
    dependencies.listVerificationJobHistoryForLink != null
  ) {
    const history = await dependencies.listVerificationJobHistoryForLink(
      input.workspaceId,
      input.linkId,
      20,
    );
    confirmedLost = hasConsecutiveScheduledNotFoundHistory(history);
  }

  const update = buildVerificationUpdate(existingLink, verification, confirmedLost);

  if (update == null) {
    return { kind: "skipped", reason: "unresolved_verification" };
  }

  return {
    kind: "persisted",
    link: await dependencies.updateVerification(input.workspaceId, input.linkId, update),
  };
}

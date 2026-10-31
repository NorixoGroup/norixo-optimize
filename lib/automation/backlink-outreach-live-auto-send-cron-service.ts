import type { BacklinkOutreachLiveAutoSendCandidateRow } from "@/lib/backlinks/repositories/outreachRepository";
import {
  BacklinkOutreachEmailSendError,
  type BacklinkOutreachEmailSendResult,
} from "@/lib/backlinks/services/outreachEmailSendService";
import {
  canRunBacklinkOutreachLiveAutoSend,
  runBacklinkOutreachLiveAutoSend,
  type BacklinkOutreachLiveAutoSendWorkspaceControl,
} from "./backlink-outreach-live-auto-send-service";

const MAX_WORKSPACES_PER_RUN = 25;
const MAX_CANDIDATES_PER_WORKSPACE = 200;
export const MAX_LIVE_AUTO_SENDS_PER_CRON_RUN = 1 as const;

export type BacklinkOutreachLiveAutoSendCronWorkspaceControl =
  BacklinkOutreachLiveAutoSendWorkspaceControl & {
    workspaceId: string;
  };

export type BacklinkOutreachLiveAutoSendCronResult = {
  disposition: "sent" | "failed" | "unknown" | "no_candidate";
  workspacesScanned: number;
  candidatesConsidered: number;
};

export type BacklinkOutreachLiveAutoSendCronDependencies = {
  listWorkspaceControls: (
    limit: number,
  ) => Promise<BacklinkOutreachLiveAutoSendCronWorkspaceControl[]>;
  getCandidateById: (
    workspaceId: string,
    outreachId: string,
  ) => Promise<BacklinkOutreachLiveAutoSendCandidateRow | null>;
  listCandidates: (
    workspaceId: string,
    limit: number,
  ) => Promise<BacklinkOutreachLiveAutoSendCandidateRow[]>;
  sendBacklinkOutreachEmail: (input: {
    workspaceId: string;
    actorUserId: string;
    outreachId: string;
    idempotencyKey: string;
  }) => Promise<BacklinkOutreachEmailSendResult>;
  now?: () => string;
  createIdempotencyKey?: (input: {
    workspaceId: string;
    outreachId: string;
    selectedAt: string;
  }) => string;
};

function isExplicitHumanApproval(candidate: BacklinkOutreachLiveAutoSendCandidateRow): candidate is BacklinkOutreachLiveAutoSendCandidateRow & {
  auto_send_approved_at: string;
  auto_send_approved_by: string;
  auto_send_approval_fingerprint: string;
} {
  return candidate.auto_send_approved_at != null &&
    candidate.auto_send_approved_by != null &&
    candidate.auto_send_approval_fingerprint != null;
}

function isSkippableSendError(error: unknown): boolean {
  return error instanceof BacklinkOutreachEmailSendError && (
    error.code === "OUTREACH_NOT_SENDABLE" ||
    error.code === "OUTREACH_EMAIL_CHANNEL_UNSUPPORTED" ||
    error.code === "OUTREACH_EMAIL_CONTENT_INCOMPLETE" ||
    error.code === "OUTREACH_CONTACT_NOT_ELIGIBLE" ||
    error.code === "OUTREACH_MAX_ATTEMPTS_REACHED" ||
    error.code === "OUTREACH_SEND_RATE_LIMIT_EXCEEDED" ||
    error.code === "OUTREACH_ATTEMPT_IDEMPOTENCY_CONFLICT" ||
    error.code === "OUTREACH_SEND_ATTEMPT_IN_PROGRESS" ||
    error.code === "OUTREACH_SEND_ATTEMPT_UNRESOLVED" ||
    error.code === "OUTREACH_NOT_APPROVED" ||
    error.code === "OUTREACH_APPROVAL_STALE" ||
    error.code === "OUTREACH_CAMPAIGN_DISABLED" ||
    error.code === "OUTREACH_NOT_READY" ||
    error.code === "OUTREACH_INVALID_RECIPIENT" ||
    error.code === "OUTREACH_MISSING_APPROVED_CONTENT" ||
    error.code === "OUTREACH_INELIGIBLE"
  );
}

/**
 * Runs at most one provider send. Candidate selection is only a pre-filter:
 * PR 1's V3 reservation remains the authoritative transaction before a provider
 * can be called, including recipient-level concurrency and idempotence checks.
 */
export async function runBacklinkOutreachLiveAutoSendCron(
  dependencies: BacklinkOutreachLiveAutoSendCronDependencies,
): Promise<BacklinkOutreachLiveAutoSendCronResult> {
  const controls = await dependencies.listWorkspaceControls(MAX_WORKSPACES_PER_RUN);
  let candidatesConsidered = 0;
  let workspacesScanned = 0;

  for (const control of controls) {
    workspacesScanned += 1;
    if (!canRunBacklinkOutreachLiveAutoSend(control)) {
      continue;
    }

    const candidates = await dependencies.listCandidates(
      control.workspaceId,
      MAX_CANDIDATES_PER_WORKSPACE,
    );
    for (const candidate of candidates) {
      candidatesConsidered += 1;
      if (!isExplicitHumanApproval(candidate)) {
        continue;
      }

      try {
        const result = await runBacklinkOutreachLiveAutoSend(
          {
            getCandidateById: dependencies.getCandidateById,
            sendBacklinkOutreachEmail: dependencies.sendBacklinkOutreachEmail,
            now: dependencies.now,
            createIdempotencyKey: dependencies.createIdempotencyKey,
          },
          {
            workspaceId: control.workspaceId,
            actorUserId: candidate.auto_send_approved_by,
            workspaceControl: control,
            outreachId: candidate.id,
          },
        );
        if (result.disposition === "sent" || result.disposition === "failed" || result.disposition === "unknown") {
          return { disposition: result.disposition, workspacesScanned, candidatesConsidered };
        }
      } catch (error) {
        if (!isSkippableSendError(error)) {
          throw error;
        }
      }
    }
  }

  return { disposition: "no_candidate", workspacesScanned, candidatesConsidered };
}

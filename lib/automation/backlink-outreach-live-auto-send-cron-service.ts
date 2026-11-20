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
  disposition: "completed";
  workspacesScanned: number;
  workspacesEligible: number;
  candidatesConsidered: number;
  sent: number;
  failed: number;
  unknown: number;
  noCandidate: number;
  paused: number;
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
  pauseWorkspaceLiveAutoSend: (input: {
    workspaceId: string;
    pausedAt: string;
    reason: "failed" | "unknown";
  }) => Promise<void>;
  reserveWorkspaceCycle: (input: {
    workspaceId: string;
    cycleId: string;
    outreachId: string;
    reservedAt: string;
  }) => Promise<{ kind: "acquired" } | { kind: "already_reserved" }>;
  releaseWorkspaceCycleReservation: (input: {
    workspaceId: string;
    cycleId: string;
    outreachId: string;
  }) => Promise<void>;
  cycleId: string;
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
  let workspacesEligible = 0;
  let sent = 0;
  let failed = 0;
  let unknown = 0;
  let noCandidate = 0;
  let paused = 0;

  for (const control of controls) {
    workspacesScanned += 1;
    if (!canRunBacklinkOutreachLiveAutoSend(control)) {
      continue;
    }
    workspacesEligible += 1;
    let workspaceReachedTerminalDisposition = false;

    const candidates = await dependencies.listCandidates(
      control.workspaceId,
      MAX_CANDIDATES_PER_WORKSPACE,
    );
    for (const candidate of candidates) {
      candidatesConsidered += 1;
      if (!isExplicitHumanApproval(candidate)) {
        continue;
      }

      const reservation = await dependencies.reserveWorkspaceCycle({
        workspaceId: control.workspaceId,
        cycleId: dependencies.cycleId,
        outreachId: candidate.id,
        reservedAt: dependencies.now?.() ?? new Date().toISOString(),
      });
      if (reservation.kind === "already_reserved") {
        workspaceReachedTerminalDisposition = true;
        break;
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
        if (result.disposition === "sent") {
          sent += 1;
          workspaceReachedTerminalDisposition = true;
          break;
        }
        if (result.disposition === "failed" || result.disposition === "unknown") {
          if (result.disposition === "failed") failed += 1;
          else unknown += 1;
          await dependencies.pauseWorkspaceLiveAutoSend({
            workspaceId: control.workspaceId,
            pausedAt: dependencies.now?.() ?? new Date().toISOString(),
            reason: result.disposition,
          });
          paused += 1;
          workspaceReachedTerminalDisposition = true;
          break;
        }
        // No provider call can have occurred when the targeted service returns no_candidate.
        await dependencies.releaseWorkspaceCycleReservation({
          workspaceId: control.workspaceId,
          cycleId: dependencies.cycleId,
          outreachId: candidate.id,
        });
      } catch (error) {
        if (!isSkippableSendError(error)) {
          throw error;
        }
      }
    }
    if (!workspaceReachedTerminalDisposition) noCandidate += 1;
  }

  return { disposition: "completed", workspacesScanned, workspacesEligible, candidatesConsidered, sent, failed, unknown, noCandidate, paused };
}

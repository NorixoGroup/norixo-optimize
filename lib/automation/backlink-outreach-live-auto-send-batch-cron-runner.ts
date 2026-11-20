import { randomUUID } from "node:crypto";

import { runBacklinkOutreachLiveAutoSendCron } from "./backlink-outreach-live-auto-send-cron-service";
import {
  getAutomationWorkspaceControl,
  listAutomationWorkspaceControlsForBacklinkLiveAutoSend,
  pauseAutomationWorkspaceControlBacklinkLiveAutoSend,
} from "./repositories/automationWorkspaceControlsRepository";
import {
  releaseBacklinkLiveAutoSendCycleReservation,
  tryReserveBacklinkLiveAutoSendCycle,
} from "./repositories/backlinkLiveAutoSendCycleReservationsRepository";
import {
  releaseBacklinkOutreachScheduleApplyLock,
  tryAcquireBacklinkOutreachScheduleApplyLock,
} from "./repositories/backlinkOutreachScheduleApplyLocksRepository";
import { createEnvironmentOutreachEmailProvider } from "@/lib/backlinks/providers/outreachEmailProvider";
import {
  activateBacklinkOutreachAfterEmailAccepted,
  getBacklinkOutreachById,
  getBacklinkOutreachLiveAutoSendCandidateById,
  listBacklinkOutreachLiveAutoSendCandidates,
} from "@/lib/backlinks/repositories/outreachRepository";
import {
  getBacklinkOutreachAttemptById,
  reserveBacklinkOutreachApprovedInitialAttempt,
  updateBacklinkOutreachAttemptState,
} from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";
import {
  markBacklinkOutreachAttemptAccepted,
  markBacklinkOutreachAttemptFailed,
  markBacklinkOutreachAttemptUnknown,
} from "@/lib/backlinks/services/outreachAttemptService";
import { getBacklinkOutreachReplyTokenKeyring } from "@/lib/backlinks/services/outreachReplyCorrelationIdentity";
import { sendApprovedBacklinkOutreachEmail } from "@/lib/backlinks/services/outreachApprovedAutoSendService";

const LOCK_KEY = "backlinks:outreach:live-auto-send:batch";
const LOCK_TTL_SECONDS = 600;

export type BacklinkOutreachLiveAutoSendBatchCronOutcome =
  | { disposition: "already_running" }
  | { disposition: "completed"; result: Awaited<ReturnType<typeof runBacklinkOutreachLiveAutoSendCron>> };

/**
 * Production composition for the batch only. The durable lock prevents two
 * simultaneous cron invocations from selecting different approved sends in a
 * workspace before the V3 reservation has a chance to reject either one.
 */
export async function runBacklinkOutreachLiveAutoSendBatchCron(
  client: BacklinkRepositoryClient,
  input: { startedAt: string },
): Promise<BacklinkOutreachLiveAutoSendBatchCronOutcome> {
  const holderId = `live-auto-send-batch:${input.startedAt}:${randomUUID()}`;
  const acquired = await tryAcquireBacklinkOutreachScheduleApplyLock(client, {
    lockKey: LOCK_KEY,
    holderId,
    acquiredAt: input.startedAt,
    leaseDurationSeconds: LOCK_TTL_SECONDS,
  });
  if (acquired.kind === "already_running") return { disposition: "already_running" };

  try {
    const sendBacklinkOutreachEmail = sendApprovedBacklinkOutreachEmail({
      getWorkspaceControl: async (workspaceId) => {
        const control = await getAutomationWorkspaceControl(client, workspaceId);
        return control == null ? null : { backlinksEnabled: control.backlinksEnabled, dryRunOnly: control.dryRunOnly };
      },
      getOutreach: (workspaceId, outreachId) => getBacklinkOutreachById(client, workspaceId, outreachId),
      reserveApprovedInitialAttempt: (reservation) => reserveBacklinkOutreachApprovedInitialAttempt(client, reservation),
      markAttemptAccepted: markBacklinkOutreachAttemptAccepted({
        getAttempt: (workspaceId, attemptId) => getBacklinkOutreachAttemptById(client, workspaceId, attemptId),
        updateAttempt: (workspaceId, attemptId, patch) => updateBacklinkOutreachAttemptState(client, workspaceId, attemptId, patch),
      }),
      markAttemptFailed: markBacklinkOutreachAttemptFailed({
        getAttempt: (workspaceId, attemptId) => getBacklinkOutreachAttemptById(client, workspaceId, attemptId),
        updateAttempt: (workspaceId, attemptId, patch) => updateBacklinkOutreachAttemptState(client, workspaceId, attemptId, patch),
      }),
      markAttemptUnknown: markBacklinkOutreachAttemptUnknown({
        getAttempt: (workspaceId, attemptId) => getBacklinkOutreachAttemptById(client, workspaceId, attemptId),
        updateAttempt: (workspaceId, attemptId, patch) => updateBacklinkOutreachAttemptState(client, workspaceId, attemptId, patch),
      }),
      sendEmail: createEnvironmentOutreachEmailProvider(),
      activateOutreach: (workspaceId, outreachId, activation) =>
        activateBacklinkOutreachAfterEmailAccepted(client, workspaceId, outreachId, activation),
      inboundReplyDomain: process.env.OUTREACH_INBOUND_REPLY_DOMAIN,
      replyTokenKeyring: getBacklinkOutreachReplyTokenKeyring(),
    });

    const result = await runBacklinkOutreachLiveAutoSendCron({
      listWorkspaceControls: async (limit) =>
        (await listAutomationWorkspaceControlsForBacklinkLiveAutoSend(client, limit)).map((control) => ({
          workspaceId: control.workspaceId,
          backlinksEnabled: control.backlinksEnabled,
          backlinkOutreachScheduleApplyEnabled: control.backlinkOutreachScheduleApplyEnabled,
          dryRunOnly: control.dryRunOnly,
          disabledReason: control.disabledReason,
          backlinkLiveAutoSendPausedAt: control.backlinkLiveAutoSendPausedAt,
        })),
      getCandidateById: (workspaceId, outreachId) =>
        getBacklinkOutreachLiveAutoSendCandidateById(client, workspaceId, outreachId),
      listCandidates: (workspaceId, limit) =>
        listBacklinkOutreachLiveAutoSendCandidates(client, workspaceId, limit),
      sendBacklinkOutreachEmail,
      pauseWorkspaceLiveAutoSend: (pause) =>
        pauseAutomationWorkspaceControlBacklinkLiveAutoSend(client, pause),
      reserveWorkspaceCycle: (reservation) => tryReserveBacklinkLiveAutoSendCycle(client, reservation),
      releaseWorkspaceCycleReservation: (reservation) => releaseBacklinkLiveAutoSendCycleReservation(client, reservation),
      // n8n schedules this batch daily; UTC date remains stable for retries of the same run.
      cycleId: input.startedAt.slice(0, 10),
      now: () => input.startedAt,
      createIdempotencyKey: ({ workspaceId, outreachId, selectedAt }) =>
        `automation:backlinks:live-auto-send:batch:${workspaceId}:${outreachId}:${selectedAt}:${randomUUID()}`,
    });
    return { disposition: "completed", result };
  } finally {
    await releaseBacklinkOutreachScheduleApplyLock(client, {
      lockKey: LOCK_KEY,
      holderId,
      releasedAt: new Date().toISOString(),
    }).catch(() => undefined);
  }
}

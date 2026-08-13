import type { BacklinkOutreachScheduleApplyOrchestrationWorkspaceControl } from "./backlink-outreach-schedule-apply-orchestrator";
import { runBacklinkOutreachScheduleApplyOrchestration } from "./backlink-outreach-schedule-apply-orchestrator";
import {
  listAutomationWorkspaceControlsForBacklinkOutreachScheduleApply,
  markAutomationWorkspaceControlBacklinkOutreachScheduleApplyAttempt,
} from "./repositories/automationWorkspaceControlsRepository";
import {
  releaseBacklinkOutreachScheduleApplyLock,
  tryAcquireBacklinkOutreachScheduleApplyLock,
} from "./repositories/backlinkOutreachScheduleApplyLocksRepository";
import { applyBacklinkOutreachScheduleReconciliationAutomation } from "@/lib/backlinks/services/outreachScheduleApplyService";
import {
  listBacklinkOutreachScheduleApplyCandidates,
  reconcileBacklinkOutreachFollowUpSchedule,
} from "@/lib/backlinks/repositories/outreachRepository";
import {
  getLatestBacklinkOutreachAttemptForOutreach,
  getOpenBacklinkOutreachAttemptForOutreach,
} from "@/lib/backlinks/repositories/outreachAttemptsRepository";
import { getBacklinkContactById } from "@/lib/backlinks/repositories/contactsRepository";
import { hasBacklinkOutreachInboundReplyStopEffect } from "@/lib/backlinks/repositories/outreachInboundEffectsRepository";
import type { BacklinkRepositoryClient } from "@/lib/backlinks/repositories/repositoryClient";

export const BACKLINKS_OUTREACH_SCHEDULE_APPLY_LOCK_KEY =
  "backlinks:outreach:schedule:apply-all";
export const BACKLINKS_OUTREACH_SCHEDULE_APPLY_WORKSPACE_LIMIT = 25;
export const BACKLINKS_OUTREACH_SCHEDULE_APPLY_OUTREACH_LIMIT = 100;
export const BACKLINKS_OUTREACH_SCHEDULE_APPLY_LOCK_TTL_SECONDS = 600;

export type BacklinkOutreachScheduleApplyRunMode = "manual_internal" | "cron";

export type BacklinkOutreachScheduleApplyRunOutcome =
  | {
      disposition: "already_running";
    }
  | {
      disposition: "completed";
      result: Awaited<
        ReturnType<typeof runBacklinkOutreachScheduleApplyOrchestration>
      >;
      lockReleasedAt: string;
    };

export async function runBacklinkOutreachScheduleApply(
  client: BacklinkRepositoryClient,
  input: {
    triggerKind: BacklinkOutreachScheduleApplyRunMode;
    startedAt: string;
    workspaceLimit: number;
    outreachLimitPerWorkspace: number;
  },
): Promise<BacklinkOutreachScheduleApplyRunOutcome> {
  const acquiredLock = await tryAcquireBacklinkOutreachScheduleApplyLock(client, {
    lockKey: BACKLINKS_OUTREACH_SCHEDULE_APPLY_LOCK_KEY,
    holderId: `apply-all:${input.startedAt}:${input.triggerKind}`,
    acquiredAt: input.startedAt,
    leaseDurationSeconds: BACKLINKS_OUTREACH_SCHEDULE_APPLY_LOCK_TTL_SECONDS,
  });

  if (acquiredLock.kind === "already_running") {
    return { disposition: "already_running" };
  }

  try {
    const result = await runBacklinkOutreachScheduleApplyOrchestration(
      {
        now: () => input.startedAt,
        listEligibleWorkspaces: async (limit) => {
          const controls = await listAutomationWorkspaceControlsForBacklinkOutreachScheduleApply(client, limit);
          return controls.map((row) => ({
            workspaceId: row.workspaceId,
            backlinksEnabled: row.backlinksEnabled,
            backlinkOutreachScheduleApplyEnabled: row.backlinkOutreachScheduleApplyEnabled,
            dryRunOnly: row.dryRunOnly,
            disabledReason: null,
            lastScheduleApplyAttemptAt: row.lastScheduleApplyAttemptAt,
          })) as BacklinkOutreachScheduleApplyOrchestrationWorkspaceControl[];
        },
        applyWorkspace: async ({ workspaceId, outreachLimit, scheduledAt }) => {
          const { data: control, error: controlError } = await client
            .from("automation_workspace_controls")
            .select("workspace_id, backlinks_enabled, backlink_outreach_schedule_apply_enabled, dry_run_only, disabled_reason, last_schedule_apply_attempt_at")
            .eq("workspace_id", workspaceId)
            .maybeSingle();
          if (controlError != null) {
            throw controlError;
          }
          if (
            control == null ||
            control.backlinks_enabled !== true ||
            control.backlink_outreach_schedule_apply_enabled !== true ||
            control.dry_run_only !== true ||
            control.disabled_reason != null
          ) {
            throw new Error("APPLY_NOT_ENABLED");
          }

          await markAutomationWorkspaceControlBacklinkOutreachScheduleApplyAttempt(client, {
            workspaceId,
            attemptedAt: scheduledAt,
          });

          const result = await applyBacklinkOutreachScheduleReconciliationAutomation(
            {
              now: () => scheduledAt,
              getWorkspaceControl: async () => ({
                workspaceId,
                backlinksEnabled: true,
                backlinkOutreachScheduleApplyEnabled: true,
                dryRunOnly: true,
                lastScheduleApplyAttemptAt: control.last_schedule_apply_attempt_at,
                disabledReason: null,
                createdAt: scheduledAt,
                updatedAt: scheduledAt,
              }),
              markWorkspaceAttempt: async (workspaceIdInput, attemptedAt) => {
                await markAutomationWorkspaceControlBacklinkOutreachScheduleApplyAttempt(client, {
                  workspaceId: workspaceIdInput,
                  attemptedAt,
                });
              },
              listCandidates: async (workspaceIdInput, limit) =>
                listBacklinkOutreachScheduleApplyCandidates(client, workspaceIdInput, limit),
              getLatestAttempt: async (workspaceIdInput, outreachId) => {
                const row = await getLatestBacklinkOutreachAttemptForOutreach(client, workspaceIdInput, outreachId);
                return row == null ? null : { status: row.status };
              },
              getOpenAttempt: async (workspaceIdInput, outreachId) => {
                const row = await getOpenBacklinkOutreachAttemptForOutreach(client, workspaceIdInput, outreachId);
                return row == null ? null : { status: row.status };
              },
              getContact: async (workspaceIdInput, contactId) => {
                const row = await getBacklinkContactById(client, workspaceIdInput, contactId);
                return row == null ? null : { contact_status: row.contact_status, email_normalized: row.email_normalized };
              },
              hasInboundReplyStopEffect: (workspaceIdInput, outreachId) =>
                hasBacklinkOutreachInboundReplyStopEffect(client, workspaceIdInput, outreachId),
              reconcileSchedule: (workspaceIdInput, outreachId, input) =>
                reconcileBacklinkOutreachFollowUpSchedule(client, workspaceIdInput, outreachId, input),
            },
            { workspaceId, limit: outreachLimit },
          );

          return {
            workspaceId,
            runDisposition: "created" as const,
            result,
          };
        },
      },
      {
        workspaceLimit: input.workspaceLimit,
        outreachLimitPerWorkspace: input.outreachLimitPerWorkspace,
      },
    );

    return {
      disposition: "completed",
      result,
      lockReleasedAt: input.startedAt,
    };
  } finally {
    await releaseBacklinkOutreachScheduleApplyLock(client, {
      lockKey: BACKLINKS_OUTREACH_SCHEDULE_APPLY_LOCK_KEY,
      holderId: `apply-all:${input.startedAt}:${input.triggerKind}`,
      releasedAt: new Date().toISOString(),
    }).catch(() => undefined);
  }
}

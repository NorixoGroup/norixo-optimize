import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  hasValidBacklinkDiscoveryQualificationResumeCronAuthorization,
  isBacklinkDiscoveryQualificationResumeCronEnabled,
} from "@/lib/automation/backlink-discovery-qualification-resume-cron-config";
import { runBacklinkDiscoveryQualificationResumeCron } from "@/lib/automation/backlink-discovery-qualification-resume-cron-service";
import { listBacklinkDiscoveryQualificationResumeCandidates } from "@/lib/automation/repositories/backlinkDiscoveryQualificationResumeCandidatesRepository";
import {
  cancelAutomationTask,
  claimBacklinkDiscoveryTaskById,
  claimNextAutomationTask,
  completeAutomationTask,
  deadLetterAutomationTask,
  failAutomationTask,
  getAutomationTaskByIdInRun,
  heartbeatAutomationTask,
  reclaimExpiredAutomationTasks,
} from "@/lib/automation/repositories/automationTasksRepository";
import { listAutomationTasksForRun } from "@/lib/automation/repositories/automationRunResumeRepository";
import {
  cancelAutomationRun,
  completeAutomationRun,
  failAutomationRun,
  getAutomationRunById,
  startAutomationRun,
} from "@/lib/automation/repositories/automationRunsRepository";
import {
  completeAutomationRun as completeAutomationRunTransition,
  failAutomationRun as failAutomationRunTransition,
} from "@/lib/automation/transition-service";
import { executeAutomationWorkerOnce, executeClaimedDiscoveryTask } from "@/lib/automation/worker";
import { createDryRunAutomationTaskHandlers } from "@/lib/automation/dry-run-handlers";
import { resumeBacklinksDryRun } from "@/lib/automation/run-resume";
import { resumeDiscovery } from "@/lib/automation/discovery-resume";
import { createBraveBacklinkDiscoveryProvider } from "@/lib/automation/brave-backlink-discovery-provider";
import { readBraveBacklinkDiscoveryRuntimeConfig } from "@/lib/automation/brave-backlink-discovery-config";
import { createBudgetedBacklinkDiscoveryProvider } from "@/lib/automation/brave-request-budget";
import { reserveBacklinkBraveRequest } from "@/lib/automation/repositories/braveRequestBudgetRepository";
import { createMockBacklinkDiscoveryProvider } from "@/lib/automation/mock-backlink-discovery-provider";
import { demoBacklinkDiscoveryFixtures } from "@/lib/automation/demo-backlink-discovery-fixtures";
import { isBacklinkDiscoveryDemoProviderEnabled } from "@/lib/automation/backlink-discovery-feature-flags";
import { DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1 } from "@/lib/automation/backlink-qualification-policy";
import { DEFAULT_BACKLINK_PROMOTION_POLICY_V1 } from "@/lib/automation/backlink-promotion-policy";
import type { BacklinkDiscoveryProviderRegistry } from "@/lib/automation/backlink-discovery-provider-types";
import type {
  AutomationRunTransitionDependencies,
  AutomationTaskDependencies,
  DeadLetterAutomationTaskDependencies,
} from "@/lib/automation/types";
import type { ExecuteAutomationTaskHandlerInput, ExecuteAutomationTaskHandlerResult } from "@/lib/automation/handler-types";

/**
 * Resumes only backlinks.discovery.preview / backlinks.qualification.preview /
 * backlinks.promotion.preview tasks that already exist in an already-running
 * "backlinks.daily_preview" dry-run, by delegating to the existing, already-tested
 * discovery-resume.ts / run-resume.ts logic. It never creates a run or a task, never touches
 * backlinks.outreach.follow_up_due or any other task kind, and never imports anything that can
 * send an email, a follow-up, or submit a contact form. The read-only candidate query
 * additionally never surfaces a workspace unless it already has backlinks_enabled,
 * dry_run_only and no disabled_reason — the same condition the database claim function
 * enforces independently.
 */

const LEASE_DURATION_SECONDS = 120;
const WORKER_ID = "norixo-backlink-discovery-qualification-resume-cron";

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function disabledResponse() {
  return NextResponse.json({
    disposition: "disabled",
    reason: "BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_DISABLED",
  });
}

function notSupported(operation: string): never {
  throw new Error(`${operation} is not supported by the discovery/qualification resume cron`);
}

export async function GET(request: NextRequest) {
  const environment = {
    CRON_SECRET: process.env.CRON_SECRET,
    BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_ENABLED:
      process.env.BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_ENABLED,
  };
  if (
    !hasValidBacklinkDiscoveryQualificationResumeCronAuthorization(
      request.headers.get("authorization"),
      environment,
    )
  ) {
    return unauthorizedResponse();
  }
  // Must precede any client/DB construction: global OFF performs no reads, claims, or writes.
  if (!isBacklinkDiscoveryQualificationResumeCronEnabled(environment)) {
    return disabledResponse();
  }

  try {
    const client = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const braveConfig = readBraveBacklinkDiscoveryRuntimeConfig();
    const discoveryProviders: BacklinkDiscoveryProviderRegistry = Object.freeze({
      ...(isBacklinkDiscoveryDemoProviderEnabled()
        ? { mock: createMockBacklinkDiscoveryProvider(demoBacklinkDiscoveryFixtures) }
        : {}),
      ...(braveConfig.enabled
        ? {
            brave_search: createBudgetedBacklinkDiscoveryProvider(
              createBraveBacklinkDiscoveryProvider({
                subscriptionToken: braveConfig.subscriptionToken,
                fetchImplementation: fetch,
              }),
              (reservation) => reserveBacklinkBraveRequest(client, reservation),
            ),
          }
        : {}),
    });
    const dryRunHandlers = createDryRunAutomationTaskHandlers({
      providers: discoveryProviders,
      getTaskByIdInRun: (input) => getAutomationTaskByIdInRun(client, input),
      qualificationPolicy: DEFAULT_BACKLINK_QUALIFICATION_POLICY_V1,
      promotionPolicy: DEFAULT_BACKLINK_PROMOTION_POLICY_V1,
    });
    // Defense in depth: even though the candidate query only ever selects these three kinds,
    // this is the one place that would refuse to execute anything else — including
    // backlinks.outreach.follow_up_due — if that invariant were ever broken upstream.
    const executeHandler = (
      handlerInput: ExecuteAutomationTaskHandlerInput,
    ): Promise<ExecuteAutomationTaskHandlerResult> => {
      if (
        handlerInput.taskKind !== "backlinks.discovery.preview" &&
        handlerInput.taskKind !== "backlinks.qualification.preview" &&
        handlerInput.taskKind !== "backlinks.promotion.preview"
      ) {
        throw new Error("BACKLINK_DISCOVERY_QUALIFICATION_RESUME_CRON_TASK_KIND_FORBIDDEN");
      }
      return dryRunHandlers.execute(handlerInput);
    };

    const taskDependencies: AutomationTaskDependencies & DeadLetterAutomationTaskDependencies = {
      createOrGetTask: () => notSupported("createOrGetTask"),
      claimNextTask: (input) => claimNextAutomationTask(client, input),
      heartbeatTask: (input) => heartbeatAutomationTask(client, input),
      completeTask: (input) => completeAutomationTask(client, input),
      failTask: (input) => failAutomationTask(client, input),
      deadLetterTask: (input) => deadLetterAutomationTask(client, input),
      reclaimExpiredTasks: (input) => reclaimExpiredAutomationTasks(client, input),
      cancelTask: (input) => cancelAutomationTask(client, input),
    };

    // transition-service.ts owns the one correct null -> {kind:"rejected"} adaptation
    // (fail-closed, never inferring success from a null row) that resumeDiscovery and
    // resumeBacklinksDryRun both require from completeRun/failRun; this wires it instead of
    // passing the raw repository functions (which return AutomationRun | null) directly.
    const runTransitionDependencies: AutomationRunTransitionDependencies = {
      startRun: (input) => startAutomationRun(client, input),
      completeRun: (input) => completeAutomationRun(client, input),
      failRun: (input) => failAutomationRun(client, input),
      cancelRun: (input) => cancelAutomationRun(client, input),
    };

    const result = await runBacklinkDiscoveryQualificationResumeCron({
      listCandidates: (input) => listBacklinkDiscoveryQualificationResumeCandidates(client, input),
      now: () => now,
      reclaimExpiredTasks: (input) =>
        reclaimExpiredAutomationTasks(client, { ...input, reclaimedAt: now, limit: 5 }),
      resumeDiscoveryTask: (input) =>
        resumeDiscovery(
          {
            getRun: (scope) => getAutomationRunById(client, scope),
            getTask: (scope) => getAutomationTaskByIdInRun(client, scope),
            claimBacklinkDiscoveryTaskById: (claimInput) => claimBacklinkDiscoveryTaskById(client, claimInput),
            executeClaimed: (claimedInput) =>
              executeClaimedDiscoveryTask({ ...taskDependencies, executeHandler }, claimedInput),
            failRun: (runInput) => failAutomationRunTransition(runTransitionDependencies, runInput),
          },
          { ...input, workerId: WORKER_ID, now, leaseDurationSeconds: LEASE_DURATION_SECONDS },
        ),
      resumeRun: (input) =>
        resumeBacklinksDryRun(
          {
            getRun: (scope) => getAutomationRunById(client, scope),
            listTasks: (scope) => listAutomationTasksForRun(client, scope),
            reclaimExpiredTasks: (reclaimInput) => reclaimExpiredAutomationTasks(client, reclaimInput),
            executeWorkerOnce: (workerInput) =>
              executeAutomationWorkerOnce({ ...taskDependencies, executeHandler }, workerInput),
            completeRun: (runInput) => completeAutomationRunTransition(runTransitionDependencies, runInput),
            failRun: (runInput) => failAutomationRunTransition(runTransitionDependencies, runInput),
          },
          { ...input, workerId: WORKER_ID, now, leaseDurationSeconds: LEASE_DURATION_SECONDS },
        ),
    });

    return NextResponse.json(result);
  } catch {
    console.error("[cron/backlinks/discovery-qualification-resume] request failed");
    return NextResponse.json(
      { error: "Unable to run the discovery/qualification resume cron" },
      { status: 500 },
    );
  }
}

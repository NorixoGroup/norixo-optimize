import { NextRequest, NextResponse } from "next/server";

import { createBacklinkVerificationProductionComposition } from "@/lib/backlinks/verification/production-composition";
import {
  readBacklinkReverificationRuntimeConfig,
  runBacklinkReverificationAutomation,
} from "@/lib/backlinks/verification";
import {
  createBacklinkVerificationJob,
  getBacklinkVerificationJobByKey,
} from "@/lib/backlinks/repositories/verificationJobsRepository";
import { listBacklinkReverificationCandidates } from "@/lib/backlinks/repositories/linksRepository";
import { listAutomationWorkspaceControlsForBacklinkReverification } from "@/lib/automation/repositories/automationWorkspaceControlsRepository";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const CRON_WORKSPACE_LIMIT = 1;
const CRON_CANDIDATE_LIMIT_PER_WORKSPACE = 5;
const CRON_SCHEDULER_MAX_ITERATIONS = 1;
const CRON_LEASE_DURATION_SECONDS = 120;

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (CRON_SECRET.length === 0 || authorization !== `Bearer ${CRON_SECRET}`) {
    return unauthorizedResponse();
  }

  const config = readBacklinkReverificationRuntimeConfig();
  let adminClient: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let composition: ReturnType<typeof createBacklinkVerificationProductionComposition> | null = null;

  const getAdminClient = () => {
    adminClient ??= createSupabaseAdminClient();
    return adminClient;
  };
  const getComposition = () => {
    composition ??= createBacklinkVerificationProductionComposition();
    return composition;
  };

  try {
    const result = await runBacklinkReverificationAutomation(
      {
        listEligibleWorkspaces: async (limit) =>
          (await listAutomationWorkspaceControlsForBacklinkReverification(getAdminClient(), limit)).map(
            (control) => ({
              workspaceId: control.workspaceId,
              backlinksEnabled: control.backlinksEnabled,
              disabledReason: null,
            }),
          ),
        listCandidates: (workspaceId, limit) =>
          listBacklinkReverificationCandidates(getAdminClient(), {
            workspaceId,
            limit,
          }),
        getJobByKey: (workspaceId, jobKey) =>
          getBacklinkVerificationJobByKey(getAdminClient(), workspaceId, jobKey),
        createJob: (input) => createBacklinkVerificationJob(getAdminClient(), input.workspaceId, input),
        runSchedulerTick: (input) => getComposition().runSchedulerTick(input),
        runTargetedJob: (input) => getComposition().runTargetedJob(input),
      },
      {
        workspaceLimit: CRON_WORKSPACE_LIMIT,
        candidateLimitPerWorkspace: CRON_CANDIDATE_LIMIT_PER_WORKSPACE,
        schedulerMaxIterations: CRON_SCHEDULER_MAX_ITERATIONS,
        workerId: "norixo-backlink-reverification-cron",
        leaseDurationSeconds: CRON_LEASE_DURATION_SECONDS,
        now: new Date().toISOString(),
        config,
      },
    );

    if (result.disposition === "disabled") {
      return NextResponse.json({
        disposition: "disabled",
        reason: result.reason,
      });
    }

    return NextResponse.json({
      disposition: "completed",
      producer: {
        workspacesScanned: result.producer.workspacesScanned,
        workspacesSucceeded: result.producer.workspacesSucceeded,
        workspacesFailed: result.producer.workspacesFailed,
        candidatesScanned: result.producer.candidatesScanned,
        jobsCreated: result.producer.jobsCreated,
        jobsExisting: result.producer.jobsExisting,
        jobsSkipped: result.producer.jobsSkipped,
        issues: result.producer.issues,
      },
      scheduler:
        result.scheduler == null
          ? null
          : {
              workspacesScanned: result.scheduler.workspacesScanned,
              workspacesSucceeded: result.scheduler.workspacesSucceeded,
              workspacesFailed: result.scheduler.workspacesFailed,
              empty: result.scheduler.empty,
              maxIterationsReached: result.scheduler.maxIterationsReached,
            },
    });
  } catch {
    console.error("[automation/backlinks/reverification/cron] request failed");
    return NextResponse.json(
      { error: "Unable to run backlink reverification cron" },
      { status: 500 },
    );
  }
}

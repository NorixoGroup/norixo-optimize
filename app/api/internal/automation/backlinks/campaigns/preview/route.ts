import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createAutomationProductionComposition } from "@/lib/automation/production-composition";
import { BacklinkCampaignEngineTaskValidationError } from "@/lib/automation/backlink-campaign-engine-task-types";
import { validateBacklinkCampaignEngineTaskInput } from "@/lib/automation/backlink-campaign-engine-task-validation";
import { BacklinkCampaignEngineInputBuilderError } from "@/lib/automation/backlink-campaign-engine-input-builder-types";
import { BacklinkCampaignRunExecutionError } from "@/lib/automation/backlink-campaign-run-executor-types";
import { BacklinkCampaignRunPreparationError } from "@/lib/automation/backlink-campaign-run-preparation-types";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTOMATION_WORKER_ID = "backlinks-campaign-preview-route";
const AUTOMATION_LEASE_DURATION_SECONDS = 300;
const AUTOMATION_MAX_WORKER_INVOCATIONS = 3;

type CampaignPreviewRequestBody = {
  campaignId: string;
  opportunityIds: string[];
  requestedLimits: {
    maxSelectedOpportunities: number;
    maxPerDomain: number;
  };
  idempotencyKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCampaignPreviewRequestBody(value: unknown): CampaignPreviewRequestBody | null {
  if (!isRecord(value)) {
    return null;
  }

  const expectedKeys = ["campaignId", "opportunityIds", "requestedLimits", "idempotencyKey"];
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || !keys.every((key) => expectedKeys.includes(key))) {
    return null;
  }

  const { campaignId, opportunityIds, requestedLimits, idempotencyKey } = value;
  if (typeof campaignId !== "string" || !UUID_PATTERN.test(campaignId)) {
    return null;
  }
  if (!Array.isArray(opportunityIds)) {
    return null;
  }
  if (opportunityIds.length > 100) {
    return null;
  }
  const seenOpportunityIds = new Set<string>();
  for (const opportunityId of opportunityIds) {
    if (typeof opportunityId !== "string" || !UUID_PATTERN.test(opportunityId) || seenOpportunityIds.has(opportunityId)) {
      return null;
    }
    seenOpportunityIds.add(opportunityId);
  }
  if (!isRecord(requestedLimits)) {
    return null;
  }
  const requestedLimitsKeys = Object.keys(requestedLimits);
  if (
    requestedLimitsKeys.length !== 2 ||
    !requestedLimitsKeys.every((key) => ["maxSelectedOpportunities", "maxPerDomain"].includes(key))
  ) {
    return null;
  }
  const { maxSelectedOpportunities, maxPerDomain } = requestedLimits;
  if (
    typeof maxSelectedOpportunities !== "number" ||
    !Number.isInteger(maxSelectedOpportunities) ||
    maxSelectedOpportunities < 1 ||
    maxSelectedOpportunities > 100 ||
    typeof maxPerDomain !== "number" ||
    !Number.isInteger(maxPerDomain) ||
    maxPerDomain < 1 ||
    maxPerDomain > 100 ||
    maxPerDomain > maxSelectedOpportunities
  ) {
    return null;
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0 || idempotencyKey !== idempotencyKey.trim() || idempotencyKey.length > 255) {
    return null;
  }

  return {
    campaignId,
    opportunityIds,
    requestedLimits: {
      maxSelectedOpportunities,
      maxPerDomain,
    },
    idempotencyKey,
  };
}

function invalidInputResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_CAMPAIGN_PREVIEW_REQUEST",
        message: "Campaign preview request is invalid",
      },
    },
    { status: 400 },
  );
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function mapKnownError(error: unknown) {
  if (error instanceof BacklinkCampaignEngineTaskValidationError) {
    return invalidInputResponse();
  }
  if (error instanceof BacklinkCampaignEngineInputBuilderError) {
    switch (error.code) {
      case "CAMPAIGN_ENGINE_CAMPAIGN_NOT_FOUND":
        return errorResponse(404, "CAMPAIGN_NOT_FOUND", "Campaign could not be found");
      case "CAMPAIGN_ENGINE_OPPORTUNITY_NOT_FOUND":
        return errorResponse(404, "CAMPAIGN_OPPORTUNITY_NOT_FOUND", "Campaign opportunity could not be found");
      case "CAMPAIGN_ENGINE_DOMAIN_NOT_FOUND":
        return errorResponse(404, "CAMPAIGN_DOMAIN_NOT_FOUND", "Campaign domain could not be found");
      case "CAMPAIGN_ENGINE_CAMPAIGN_SCOPE_MISMATCH":
      case "CAMPAIGN_ENGINE_OPPORTUNITY_SCOPE_MISMATCH":
      case "CAMPAIGN_ENGINE_DOMAIN_SCOPE_MISMATCH":
        return errorResponse(409, "CAMPAIGN_SCOPE_INVALID", "Campaign preview scope is invalid");
      default:
        return errorResponse(500, "CAMPAIGN_PREVIEW_FAILED", "Campaign preview could not be completed");
    }
  }
  if (error instanceof BacklinkCampaignRunPreparationError) {
    return errorResponse(500, "CAMPAIGN_PREVIEW_FAILED", "Campaign preview could not be completed");
  }
  if (error instanceof BacklinkCampaignRunExecutionError) {
    return errorResponse(500, "CAMPAIGN_PREVIEW_FAILED", "Campaign preview could not be completed");
  }
  return errorResponse(500, "CAMPAIGN_PREVIEW_FAILED", "Campaign preview could not be completed");
}

export async function POST(request: NextRequest) {
  const context = await getRequestUserAndWorkspace(request);
  if (context.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (context.status === "workspace_forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isAdminPrivateEmail(context.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const input = parseCampaignPreviewRequestBody(body);
  if (input === null) {
    return invalidInputResponse();
  }

  const now = new Date().toISOString();

  try {
    const composition = createAutomationProductionComposition();
    const campaignTaskInput = {
      version: 1 as const,
      campaignId: input.campaignId,
      source: "manual_dashboard" as const,
      opportunityIds: input.opportunityIds,
      requestedLimits: input.requestedLimits,
    };
    validateBacklinkCampaignEngineTaskInput(campaignTaskInput);

    const preparation = await composition.prepareBacklinkCampaignPreviewRun({
      workspaceId: context.workspace.id,
      requestedBy: context.user.id,
      idempotencyKey: input.idempotencyKey,
      triggerSource: "manual",
      scheduledAt: now,
      campaignTaskInput,
    });

    if (preparation.kind === "rejected") {
      if (preparation.reason === "automation_disabled") {
        return errorResponse(409, "AUTOMATION_DISABLED", "Automation is unavailable");
      }
      return errorResponse(409, "DRY_RUN_REQUIRED", "Dry run is required");
    }

    const execution = await composition.executeBacklinkCampaignPreviewRun({
      workspaceId: context.workspace.id,
      runId: preparation.run.id,
      workerId: AUTOMATION_WORKER_ID,
      startedAt: now,
      attemptedAt: now,
      completedAt: now,
      failedAt: now,
      leaseDurationSeconds: AUTOMATION_LEASE_DURATION_SECONDS,
      maxWorkerInvocations: AUTOMATION_MAX_WORKER_INVOCATIONS,
    });

    if (execution.kind === "completed") {
      // Ensure the execution task is present before exposing its id
      if (execution.task == null) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "CAMPAIGN_PREVIEW_TASK_MISSING",
              message: "La tâche du preview est introuvable.",
            },
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        result: {
          kind: "completed",
          runId: execution.run.id,
          taskId: execution.task.id,
          campaignId: input.campaignId,
          preparation: {
            runDisposition: preparation.runDisposition,
            taskDisposition: preparation.taskDisposition,
          },
          preview: execution.preview,
          workerInvocations: execution.workerInvocations,
        },
      });
    }
    if (execution.kind === "pending_retry") {
      return NextResponse.json(
        {
          ok: true,
          result: {
            kind: "pending_retry",
            runId: execution.run.id,
            taskId: execution.task?.id ?? null,
            campaignId: input.campaignId,
            preparation: {
              runDisposition: preparation.runDisposition,
              taskDisposition: preparation.taskDisposition,
            },
            preview: execution.preview,
            workerInvocations: execution.workerInvocations,
          },
        },
        { status: 202 },
      );
    }
    if (execution.kind === "failed") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: execution.lastIssue.code,
            message: execution.lastIssue.message,
            taskKind: execution.lastIssue.taskKind,
          },
          result: {
            kind: "failed",
            runId: execution.run.id,
            campaignId: input.campaignId,
            preparation: {
              runDisposition: preparation.runDisposition,
              taskDisposition: preparation.taskDisposition,
            },
            workerInvocations: execution.workerInvocations,
          },
        },
        { status: 500 },
      );
    }
    return errorResponse(500, "CAMPAIGN_PREVIEW_FAILED", "Campaign preview could not be completed");
  } catch (error) {
    console.error("[automation/backlinks/campaigns/preview] request failed");
    return mapKnownError(error);
  }
}

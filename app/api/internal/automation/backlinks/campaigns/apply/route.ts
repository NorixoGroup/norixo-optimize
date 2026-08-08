import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  applyBacklinkCampaignMembership,
  applyBacklinkCampaignPreviewMemberships,
  BacklinkCampaignMembershipApplicationError,
  BacklinkCampaignMembershipApplyServiceError,
  createBacklinkCampaignMembershipApplicationRepository,
} from "@/lib/automation";
import { getAutomationTaskByIdInRun } from "@/lib/automation/repositories/automationTasksRepository";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type ApplyCampaignMembershipsRequestBody = {
  runId: string;
  taskId: string;
  campaignId: string;
  confirm: true;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseApplyCampaignMembershipsRequestBody(
  value: unknown,
): ApplyCampaignMembershipsRequestBody | null {
  if (!isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value);
  const expectedKeys = ["runId", "taskId", "campaignId", "confirm"];
  if (keys.length !== expectedKeys.length || !keys.every((key) => expectedKeys.includes(key))) {
    return null;
  }

  const { runId, taskId, campaignId, confirm } = value;
  if (
    typeof runId !== "string" ||
    typeof taskId !== "string" ||
    typeof campaignId !== "string" ||
    !UUID_PATTERN.test(runId) ||
    !UUID_PATTERN.test(taskId) ||
    !UUID_PATTERN.test(campaignId) ||
    confirm !== true
  ) {
    return null;
  }

  return { runId, taskId, campaignId, confirm };
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function invalidInputResponse() {
  return errorResponse(
    400,
    "INVALID_INPUT",
    "La requête d’application de campagne est invalide.",
  );
}

function membershipFailureResponse(error: unknown) {
  if (error instanceof BacklinkCampaignMembershipApplyServiceError) {
    switch (error.code) {
      case "INVALID_CAMPAIGN_MEMBERSHIP_APPLY_INPUT":
        return invalidInputResponse();
      case "CAMPAIGN_PREVIEW_TASK_NOT_FOUND":
        return errorResponse(
          404,
          "CAMPAIGN_PREVIEW_TASK_NOT_FOUND",
          "Le Preview Campaign demandé est introuvable.",
        );
      case "CAMPAIGN_PREVIEW_TASK_NOT_COMPLETED":
        return errorResponse(
          409,
          "CAMPAIGN_PREVIEW_TASK_NOT_COMPLETED",
          "Le Preview Campaign n’est pas encore disponible.",
        );
      case "CAMPAIGN_PREVIEW_TASK_SCOPE_MISMATCH":
      case "CAMPAIGN_PREVIEW_CAMPAIGN_MISMATCH":
        return errorResponse(
          409,
          "CAMPAIGN_PREVIEW_SCOPE_INVALID",
          "Le Preview Campaign ne correspond pas à cette campagne.",
        );
      case "CAMPAIGN_PREVIEW_OUTPUT_MISSING":
      case "CAMPAIGN_PREVIEW_OUTPUT_INVALID":
      case "CAMPAIGN_PREVIEW_SELECTED_RESULT_INVALID":
        return errorResponse(
          409,
          "CAMPAIGN_PREVIEW_INVALID",
          "Le Preview Campaign ne peut pas être appliqué.",
        );
    }
  }

  if (error instanceof BacklinkCampaignMembershipApplicationError) {
    return errorResponse(
      409,
      "CAMPAIGN_MEMBERSHIP_APPLICATION_INVALID",
      "L’application des memberships Campaign est invalide.",
    );
  }

  if (error instanceof BacklinkRepositoryError) {
    switch (error.code) {
      case "NOT_FOUND":
        return errorResponse(404, "NOT_FOUND", "La ressource demandée est introuvable.");
      case "CONFLICT":
        return errorResponse(409, "CONFLICT", "L’opération est en conflit avec les données existantes.");
      case "VALIDATION":
        return errorResponse(400, "VALIDATION", "Les données fournies sont invalides.");
      case "FORBIDDEN":
        return errorResponse(403, "FORBIDDEN", "L’opération n’est pas autorisée.");
      default:
        return errorResponse(
          500,
          "CAMPAIGN_MEMBERSHIP_APPLICATION_FAILED",
          "L’application des memberships Campaign a échoué.",
        );
    }
  }

  return errorResponse(
    500,
    "CAMPAIGN_MEMBERSHIP_APPLICATION_FAILED",
    "L’application des memberships Campaign a échoué.",
  );
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
  const input = parseApplyCampaignMembershipsRequestBody(body);
  if (input === null) {
    return invalidInputResponse();
  }

  try {
    const membershipRepository =
      createBacklinkCampaignMembershipApplicationRepository(context.client);
    const result = await applyBacklinkCampaignPreviewMemberships(
      {
        getTaskByIdInRun: (taskInput) =>
          getAutomationTaskByIdInRun(context.client, taskInput),
        applyMembership: (membershipInput) =>
          applyBacklinkCampaignMembership(
            membershipRepository,
            membershipInput,
          ),
      },
      {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        runId: input.runId,
        taskId: input.taskId,
        campaignId: input.campaignId,
      },
    );

    return NextResponse.json(
      {
        ok: true,
        result: {
          campaignId: result.campaignId,
          runId: result.runId,
          taskId: result.taskId,
          summary: result.summary,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return membershipFailureResponse(error);
  }
}
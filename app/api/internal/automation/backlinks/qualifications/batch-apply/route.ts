import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  applyBacklinkQualificationBatchTransaction,
  type ApplyQualificationBatchInput,
} from "@/lib/automation";
import { BacklinkQualificationApplyServiceError } from "@/lib/automation/backlink-qualification-application-types";
import { BacklinkQualificationBatchApplyServiceError } from "@/lib/automation/backlink-qualification-batch-application-types";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type ApplyQualificationBatchRequestBody = {
  runId: string;
  taskId: string;
  opportunityIds: string[];
  confirm: true;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseApplyQualificationBatchRequestBody(value: unknown): ApplyQualificationBatchRequestBody | null {
  if (!isRecord(value)) return null;
  const expectedKeys = ["runId", "taskId", "opportunityIds", "confirm"];
  if (Object.keys(value).length !== expectedKeys.length || !expectedKeys.every((key) => key in value)) return null;
  const { runId, taskId, opportunityIds, confirm } = value;
  if (
    typeof runId !== "string" ||
    typeof taskId !== "string" ||
    !UUID_PATTERN.test(runId) ||
    !UUID_PATTERN.test(taskId) ||
    !Array.isArray(opportunityIds) ||
    opportunityIds.length === 0 ||
    opportunityIds.length > 50 ||
    opportunityIds.some((opportunityId) => typeof opportunityId !== "string" || !UUID_PATTERN.test(opportunityId)) ||
    new Set(opportunityIds).size !== opportunityIds.length ||
    confirm !== true
  ) return null;
  return { runId, taskId, opportunityIds, confirm };
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function invalidInputResponse() {
  return errorResponse(400, "INVALID_INPUT", "La requête d’application de qualification est invalide.");
}

function qualificationFailureResponse(error: unknown) {
  if (error instanceof BacklinkQualificationBatchApplyServiceError) return invalidInputResponse();
  if (error instanceof BacklinkQualificationApplyServiceError) {
    if (error.code === "QUALIFICATION_PREVIEW_TASK_NOT_FOUND") return errorResponse(404, error.code, "Le résultat Qualification demandé est introuvable.");
    if (error.code === "QUALIFICATION_PREVIEW_TASK_NOT_COMPLETED") return errorResponse(409, error.code, "Le résultat Qualification n’est pas encore disponible.");
    if (error.code === "QUALIFICATION_PREVIEW_OUTPUT_INVALID" || error.code === "QUALIFICATION_PREVIEW_TASK_KIND_INVALID") return errorResponse(409, "QUALIFICATION_PREVIEW_INVALID", "Le résultat Qualification ne peut pas être appliqué.");
    return errorResponse(409, "QUALIFICATION_PREVIEW_SCOPE_INVALID", "Le résultat Qualification ne correspond pas à cette opportunité.");
  }
  return errorResponse(500, "QUALIFICATION_APPLICATION_FAILED", "La qualification n’a pas pu être appliquée.");
}

export async function POST(request: NextRequest) {
  const context = await getRequestUserAndWorkspace(request);
  if (context.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context.status === "workspace_forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isAdminPrivateEmail(context.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const bodyInput = parseApplyQualificationBatchRequestBody(body);
  if (bodyInput === null) return invalidInputResponse();

  try {
    const input: ApplyQualificationBatchInput = {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      runId: bodyInput.runId,
      taskId: bodyInput.taskId,
      opportunityIds: bodyInput.opportunityIds,
    };
    const result = await applyBacklinkQualificationBatchTransaction(context.client, input);
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    return qualificationFailureResponse(error);
  }
}

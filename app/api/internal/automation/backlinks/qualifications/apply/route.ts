import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  applyBacklinkQualificationTransaction,
  ApplyQualificationInput,
  ApplyQualificationResult,
} from "@/lib/automation";
import { BacklinkQualificationApplyServiceError } from "@/lib/automation/backlink-qualification-application-types";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { getAutomationTaskByIdInRun } from "@/lib/automation/repositories/automationTasksRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type ApplyQualificationRequestBody = {
  runId: string;
  taskId: string;
  opportunityId: string;
  confirm: true;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseApplyQualificationRequestBody(value: unknown): ApplyQualificationRequestBody | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  const expectedKeys = ["runId", "taskId", "opportunityId", "confirm"];
  if (keys.length !== expectedKeys.length || !keys.every((k) => expectedKeys.includes(k))) return null;
  const { runId, taskId, opportunityId, confirm } = value as Record<string, unknown>;
  if (
    typeof runId !== "string" ||
    typeof taskId !== "string" ||
    typeof opportunityId !== "string" ||
    !UUID_PATTERN.test(runId) ||
    !UUID_PATTERN.test(taskId) ||
    !UUID_PATTERN.test(opportunityId) ||
    confirm !== true
  ) {
    return null;
  }
  return { runId, taskId, opportunityId, confirm };
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function invalidInputResponse() {
  return errorResponse(400, "INVALID_INPUT", "La requête d’application de qualification est invalide.");
}

function qualificationFailureResponse(error: unknown) {
  if (error instanceof BacklinkQualificationApplyServiceError) {
    switch (error.code) {
      case "QUALIFICATION_APPLY_INPUT_INVALID":
        return invalidInputResponse();
      case "QUALIFICATION_PREVIEW_TASK_NOT_FOUND":
        return errorResponse(404, error.code, "Le résultat Qualification demandé est introuvable.");
      case "QUALIFICATION_PREVIEW_TASK_NOT_COMPLETED":
        return errorResponse(409, error.code, "Le résultat Qualification n’est pas encore disponible.");
      case "QUALIFICATION_PREVIEW_SCOPE_MISMATCH":
      case "QUALIFICATION_PREVIEW_OPPORTUNITY_MISMATCH":
      case "QUALIFICATION_INTAKE_MAPPING_MISMATCH":
        return errorResponse(409, "QUALIFICATION_PREVIEW_SCOPE_INVALID", "Le résultat Qualification ne correspond pas à cette opportunité.");
      case "QUALIFICATION_PREVIEW_OUTPUT_INVALID":
        return errorResponse(409, "QUALIFICATION_PREVIEW_INVALID", "Le résultat Qualification ne peut pas être appliqué.");
      case "QUALIFICATION_OPPORTUNITY_NOT_FOUND":
        return errorResponse(404, error.code, "L’opportunité ciblée est introuvable.");
      case "QUALIFICATION_PREVIEW_TASK_KIND_INVALID":
        return errorResponse(409, error.code, "Le résultat Qualification ne peut pas être appliqué.");
    }
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
        return errorResponse(500, "QUALIFICATION_APPLICATION_FAILED", "La qualification n’a pas pu être appliquée.");
    }
  }

  console.error("[automation/backlinks/qualifications/apply] request failed");
  return errorResponse(500, "QUALIFICATION_APPLICATION_FAILED", "La qualification n’a pas pu être appliquée.");
}

export async function POST(request: NextRequest) {
  const context = await getRequestUserAndWorkspace(request);
  if (context.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context.status === "workspace_forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isAdminPrivateEmail(context.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const input = parseApplyQualificationRequestBody(body);
  if (input === null) return invalidInputResponse();

  try {
    const serviceInput: ApplyQualificationInput = {
      workspaceId: context.workspace.id,
      actorUserId: context.user.id,
      runId: input.runId,
      taskId: input.taskId,
      opportunityId: input.opportunityId,
    };

    const result: ApplyQualificationResult = await applyBacklinkQualificationTransaction(context.client, serviceInput);

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    return qualificationFailureResponse(error);
  }
}

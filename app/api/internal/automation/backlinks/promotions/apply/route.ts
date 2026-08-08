import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  applyBacklinkPromotionProposal,
  applyBacklinkPromotionProposalTransaction,
  BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH,
  BacklinkPromotionApplicationRepositoryError,
  BacklinkPromotionApplyServiceError,
  BacklinkPromotionProposalReaderError,
  readBacklinkPromotionProposal,
} from "@/lib/automation";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { getBacklinkAssetById } from "@/lib/backlinks/repositories/assetsRepository";
import { getAutomationTaskByIdInRun } from "@/lib/automation/repositories/automationTasksRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type ApplyPromotionRequestBody = {
  runId: string;
  promotionTaskId: string;
  proposalKey: string;
  assetId: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseApplyPromotionRequestBody(value: unknown): ApplyPromotionRequestBody | null {
  if (!isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value);
  const expectedKeys = ["runId", "promotionTaskId", "proposalKey", "assetId"];
  if (keys.length !== expectedKeys.length || !keys.every((key) => expectedKeys.includes(key))) {
    return null;
  }

  const { runId, promotionTaskId, proposalKey, assetId } = value;
  if (
    typeof runId !== "string" ||
    typeof promotionTaskId !== "string" ||
    typeof proposalKey !== "string" ||
    typeof assetId !== "string" ||
    !UUID_PATTERN.test(runId) ||
    !UUID_PATTERN.test(promotionTaskId) ||
    !UUID_PATTERN.test(assetId) ||
    proposalKey.length === 0 ||
    proposalKey !== proposalKey.trim() ||
    proposalKey.length > BACKLINK_PROMOTION_MAX_ASSET_KEY_LENGTH
  ) {
    return null;
  }

  return { runId, promotionTaskId, proposalKey, assetId };
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function invalidInputResponse() {
  return errorResponse(400, "INVALID_INPUT", "La requête de promotion est invalide.");
}

function errorCode(error: unknown): string | null {
  if (
    error instanceof BacklinkPromotionApplyServiceError ||
    error instanceof BacklinkPromotionProposalReaderError ||
    error instanceof BacklinkPromotionApplicationRepositoryError
  ) {
    return error.code;
  }
  return null;
}

function promotionFailureResponse(error: unknown) {
  const code = errorCode(error);
  switch (code) {
    case "INVALID_PROMOTION_APPLY_INPUT":
    case "INVALID_PROMOTION_PROPOSAL_READ_INPUT":
    case "PROMOTION_HOSTNAME_INVALID":
    case "PROMOTION_TARGET_URL_INVALID":
    case "PROMOTION_HOSTNAME_URL_MISMATCH":
    case "PROMOTION_PROPOSAL_INVALID":
      return invalidInputResponse();
    case "PROMOTION_TASK_NOT_FOUND":
      return errorResponse(404, code, "Le résultat Promotion demandé est introuvable.");
    case "PROMOTION_PROPOSAL_NOT_FOUND":
      return errorResponse(404, code, "Cette proposition n’existe pas dans le résultat Promotion.");
    case "PROMOTION_ASSET_NOT_FOUND":
      return errorResponse(404, code, "L’asset sélectionné est introuvable.");
    case "PROMOTION_TASK_NOT_COMPLETED":
      return errorResponse(409, code, "Le résultat Promotion n’est pas encore disponible.");
    case "PROMOTION_TASK_KIND_INVALID":
    case "PROMOTION_TASK_SCOPE_MISMATCH":
      return errorResponse(409, code, "Le résultat Promotion ne peut pas être appliqué.");
    case "PROMOTION_APPLICATION_MISMATCH":
      return errorResponse(409, code, "Cette promotion a déjà été appliquée avec une provenance différente.");
    case "PROMOTION_DOMAIN_ARCHIVED":
      return errorResponse(409, code, "Ce domaine est archivé et ne peut pas être réutilisé automatiquement.");
    case "PROMOTION_ASSET_NOT_ACTIVE":
      return errorResponse(409, code, "L’asset sélectionné n’est pas actif.");
    case "PROMOTION_ASSET_WORKSPACE_MISMATCH":
      return errorResponse(409, code, "L’asset sélectionné ne correspond pas au workspace actif.");
    default:
      console.error("[automation/backlinks/promotions/apply] request failed");
      return errorResponse(500, "PROMOTION_APPLICATION_FAILED", "La création de l’opportunité a échoué.");
  }
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
  const input = parseApplyPromotionRequestBody(body);
  if (input === null) {
    return invalidInputResponse();
  }

  try {
    const result = await applyBacklinkPromotionProposal(
      {
        readPromotionProposal: (readerInput) =>
          readBacklinkPromotionProposal(
            {
              getTaskByIdInRun: (taskInput) =>
                getAutomationTaskByIdInRun(context.client, taskInput),
            },
            readerInput,
          ),
        async getAssetById(assetInput) {
          try {
            const asset = await getBacklinkAssetById(
              context.client,
              assetInput.workspaceId,
              assetInput.assetId,
            );
            return {
              id: asset.id,
              workspaceId: asset.workspace_id,
              lifecycleStatus: asset.lifecycle_status,
            };
          } catch (error) {
            if (error instanceof BacklinkRepositoryError && error.code === "NOT_FOUND") {
              return null;
            }
            throw error;
          }
        },
        applyPromotionTransaction: (transactionInput) =>
          applyBacklinkPromotionProposalTransaction(context.client, transactionInput),
      },
      {
        workspaceId: context.workspace.id,
        actorUserId: context.user.id,
        runId: input.runId,
        promotionTaskId: input.promotionTaskId,
        proposalKey: input.proposalKey,
        assetId: input.assetId,
      },
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return promotionFailureResponse(error);
  }
}

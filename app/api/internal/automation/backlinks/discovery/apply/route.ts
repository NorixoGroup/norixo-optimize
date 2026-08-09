import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { readBacklinkDiscoveryCandidate } from "@/lib/automation/backlink-discovery-candidate-reader";
import { BacklinkDiscoveryCandidateReaderError } from "@/lib/automation/backlink-discovery-candidate-reader-types";
import { DiscoveryOpportunityIntakeError, intakeBacklinkDiscoveryOpportunity } from "@/lib/automation/backlink-discovery-opportunity-intake-service";
import { getAutomationRunById } from "@/lib/automation/repositories/automationRunsRepository";
import { getAutomationTaskByIdInRun } from "@/lib/automation/repositories/automationTasksRepository";
import { getBacklinkAssetById } from "@/lib/backlinks/repositories/assetsRepository";
import { resolveBacklinkDomainOpportunityTransaction } from "@/lib/backlinks/repositories/domainOpportunityResolutionRepository";
import { BacklinkRepositoryError } from "@/lib/backlinks/repositories/errors";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type Body = { runId: string; taskId: string; candidateKey: string; assetId: string };
function error(status: number, code: string, message: string) { return NextResponse.json({ ok: false, error: { code, message } }, { status }); }
function parse(value: unknown): Body | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = ["runId", "taskId", "candidateKey", "assetId"];
  if (Object.keys(record).length !== keys.length || !keys.every((key) => key in record)) return null;
  if (!keys.every((key) => typeof record[key] === "string" && (record[key] as string).length > 0 && (record[key] as string) === (record[key] as string).trim() && (record[key] as string).length <= 160)) return null;
  return { runId: record.runId as string, taskId: record.taskId as string, candidateKey: record.candidateKey as string, assetId: record.assetId as string };
}
function failure(cause: unknown) {
  if (cause instanceof BacklinkDiscoveryCandidateReaderError) {
    const status = cause.code === "RUN_NOT_FOUND" || cause.code === "TASK_NOT_FOUND" || cause.code === "CANDIDATE_NOT_FOUND" ? 404 : 409;
    return error(status, cause.code, "The requested discovery candidate is unavailable.");
  }
  if (cause instanceof DiscoveryOpportunityIntakeError) {
    const status = cause.code === "DISCOVERY_INTAKE_ASSET_NOT_FOUND" ? 404 : cause.code === "DISCOVERY_INTAKE_CANDIDATE_INVALID" || cause.code === "DISCOVERY_INTAKE_URL_INVALID" ? 400 : 409;
    return error(status, cause.code, "The discovery candidate cannot be intaken.");
  }
  return error(500, "DISCOVERY_INTAKE_FAILED", "The discovery opportunity intake failed.");
}
export async function POST(request: NextRequest) {
  const context = await getRequestUserAndWorkspace(request);
  if (context.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context.status === "workspace_forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isAdminPrivateEmail(context.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = parse(await request.json().catch(() => null));
  if (body === null) return error(400, "INVALID_INPUT", "Invalid discovery opportunity intake input");
  try {
    const result = await intakeBacklinkDiscoveryOpportunity({
      readCandidate: (input) => readBacklinkDiscoveryCandidate({ getRunById: (value) => getAutomationRunById(context.client, value), getTaskByIdInRun: (value) => getAutomationTaskByIdInRun(context.client, value) }, input),
      async getAssetById(input) { try { const asset = await getBacklinkAssetById(context.client, input.workspaceId, input.assetId); return { id: asset.id, workspaceId: asset.workspace_id, lifecycleStatus: asset.lifecycle_status }; } catch (cause) { if (cause instanceof BacklinkRepositoryError && cause.code === "NOT_FOUND") return null; throw cause; } },
      resolveDomainOpportunity: (input) => resolveBacklinkDomainOpportunityTransaction(context.client, input),
    }, { workspaceId: context.workspace.id, requestedBy: context.user.id, ...body });
    return NextResponse.json({ ok: true, result });
  } catch (cause) { return failure(cause); }
}

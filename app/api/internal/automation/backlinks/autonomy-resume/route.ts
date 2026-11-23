import { NextRequest, NextResponse } from "next/server";

import type { BacklinkAutonomyTerminalRunResumeResult } from "@/lib/automation/backlink-autonomy-terminal-run-resume";

/**
 * BACKLINKS-LIVE-18: explicit, human-triggered continuation of exactly one
 * `completed` backlinks autonomy run, at exactly the `contact_validation`
 * stage. It never claims, creates, or scans runs on its own — see
 * lib/automation/backlink-autonomy-terminal-run-resume.ts for the full
 * eligibility and idempotency contract this route only exposes.
 *
 * Not wired to any cron, scheduler, or production composition tick: calling
 * it is always a deliberate, single, authenticated administrative action.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESUMABLE_STAGE = "contact_validation" as const;

type RouteContext =
  | { status: "ok"; user: { id: string }; workspace: { id: string }; client: unknown }
  | { status: "unauthenticated" }
  | { status: "workspace_forbidden" };

type AutonomyResumeRouteDependencies = {
  getContext: (request: NextRequest) => Promise<RouteContext>;
  resume: (input: {
    sessionClient: unknown;
    workspaceId: string;
    sourceRunId: string;
    requestedBy: string;
    scheduledAt: string;
  }) => Promise<BacklinkAutonomyTerminalRunResumeResult>;
  now: () => Date;
};

type ParsedBody = { sourceRunId: string; stage: typeof RESUMABLE_STAGE };

/** Rejects any unexpected field rather than silently ignoring it. */
function parseBody(value: unknown): ParsedBody | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "sourceRunId" || keys[1] !== "stage") return null;
  const { sourceRunId, stage } = value as Record<string, unknown>;
  if (typeof sourceRunId !== "string" || !UUID.test(sourceRunId)) return null;
  if (stage !== RESUMABLE_STAGE) return null;
  return { sourceRunId, stage };
}

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function createBacklinkAutonomyResumeHandler(deps: AutonomyResumeRouteDependencies) {
  return async function POST(request: NextRequest) {
    const context = await deps.getContext(request);
    if (context.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (context.status === "workspace_forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = parseBody(await request.json().catch(() => null));
    if (body === null) return failure(400, "INVALID_INPUT", "Invalid autonomy resume input.");

    try {
      // workspaceId and requestedBy come exclusively from the authenticated
      // context, never from the request body — even if the body claimed
      // either, parseBody above already rejected any field beyond
      // sourceRunId/stage.
      const result = await deps.resume({
        sessionClient: context.client,
        workspaceId: context.workspace.id,
        sourceRunId: body.sourceRunId,
        requestedBy: context.user.id,
        scheduledAt: deps.now().toISOString(),
      });

      if (result.outcome === "not_eligible") {
        return NextResponse.json({ ok: false, outcome: "not_eligible", reasonCodes: result.reasonCodes, sourceRunId: result.sourceRunId, runId: result.runId }, { status: 409 });
      }
      return NextResponse.json({ ok: true, outcome: "resumed", runId: result.runId, taskId: result.taskId, sourceRunId: result.sourceRunId, sourceTaskId: result.sourceTaskId });
    } catch {
      console.error("[automation/backlinks/autonomy-resume] request failed");
      return failure(500, "AUTONOMY_RESUME_FAILED", "Unable to resume the run.");
    }
  };
}

export const POST = createBacklinkAutonomyResumeHandler({
  // Loaded on demand: routeAuth reaches a module-level client at import time.
  getContext: async (request) => {
    const { getRequestUserAndWorkspace } = await import("@/lib/server/routeAuth");
    const context = await getRequestUserAndWorkspace(request);
    if (context.status !== "ok") return context as RouteContext;
    return { status: "ok", user: { id: context.user.id }, workspace: { id: context.workspace.id }, client: context.client };
  },
  resume: async (input) => {
    const [{ resumeBacklinkAutonomyCompletedRun }, { createBacklinkAutonomyTerminalRunResumeDependencies }] = await Promise.all([
      import("@/lib/automation/backlink-autonomy-terminal-run-resume"),
      import("@/lib/automation/repositories/backlinkAutonomyTerminalRunResumeRepository"),
    ]);
    const deps = createBacklinkAutonomyTerminalRunResumeDependencies(
      input.sessionClient as Parameters<typeof createBacklinkAutonomyTerminalRunResumeDependencies>[0],
      input.workspaceId,
    );
    return resumeBacklinkAutonomyCompletedRun(deps, {
      workspaceId: input.workspaceId,
      sourceRunId: input.sourceRunId,
      stage: RESUMABLE_STAGE,
      requestedBy: input.requestedBy,
      scheduledAt: input.scheduledAt,
    });
  },
  now: () => new Date(),
});

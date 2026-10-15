import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import type { ResumeBacklinksDryRunInput, ResumeBacklinksDryRunResult } from "@/lib/automation/run-resume";

/**
 * Guarded continuation of an EXISTING running dry-run preview run (qualification and
 * promotion-preview tasks only). It cannot start a run, run discovery, call Brave, promote,
 * resolve contacts or send anything. See lib/automation/run-resume.ts for the full guard list.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESUME_WORKER_ID = "norixo-automation-backlinks-resume";
const LEASE_DURATION_SECONDS = 120;

type RouteContext =
  | { status: "ok"; user: { email?: string | null }; workspace: { id: string } }
  | { status: "unauthenticated" }
  | { status: "workspace_forbidden" };

type ResumeRouteDependencies = {
  getContext: (request: NextRequest) => Promise<RouteContext>;
  isAdmin: (email: string | null | undefined) => boolean;
  resume: (input: ResumeBacklinksDryRunInput) => Promise<ResumeBacklinksDryRunResult>;
  now: () => Date;
};

function parseBody(value: unknown): { runId: string } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  const runId = (value as Record<string, unknown>).runId;
  if (keys.length !== 1 || keys[0] !== "runId" || typeof runId !== "string" || !UUID.test(runId)) return null;
  return { runId };
}

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function createBacklinkRunResumeHandler(deps: ResumeRouteDependencies) {
  return async function POST(request: NextRequest) {
    const context = await deps.getContext(request);
    if (context.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (context.status === "workspace_forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!deps.isAdmin(context.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = parseBody(await request.json().catch(() => null));
    if (body === null) return failure(400, "INVALID_INPUT", "Invalid run resume input");

    try {
      // The workspace comes from the authenticated context, never from the request body.
      const result = await deps.resume({
        workspaceId: context.workspace.id,
        runId: body.runId,
        workerId: RESUME_WORKER_ID,
        now: deps.now().toISOString(),
        leaseDurationSeconds: LEASE_DURATION_SECONDS,
      });

      if (result.kind === "rejected") {
        if (result.reason === "run_not_found") return failure(404, "RUN_NOT_FOUND", "The run was not found.");
        if (result.reason === "resume_in_progress") return failure(409, "RESUME_IN_PROGRESS", "A task of this run is already executing.");
        return failure(409, "RUN_NOT_RESUMABLE", "This run cannot be resumed.");
      }
      return NextResponse.json({ ok: true, result });
    } catch {
      console.error("[automation/backlinks/runs/resume] request failed");
      return failure(500, "RUN_RESUME_FAILED", "Unable to resume the run.");
    }
  };
}

export const POST = createBacklinkRunResumeHandler({
  // Loaded on demand for the same reason as the composition below: routeAuth reaches a module-level client.
  getContext: async (request) => {
    const { getRequestUserAndWorkspace } = await import("@/lib/server/routeAuth");
    return (await getRequestUserAndWorkspace(request)) as RouteContext;
  },
  isAdmin: isAdminPrivateEmail,
  // Loaded on demand: the composition module builds database clients at import time, which would make this
  // route impossible to import (and authorization impossible to test) without a configured environment.
  resume: async (input) => {
    const { createAutomationProductionComposition } = await import("@/lib/automation/production-composition");
    return createAutomationProductionComposition().resumeBacklinksDryRun(input);
  },
  now: () => new Date(),
});

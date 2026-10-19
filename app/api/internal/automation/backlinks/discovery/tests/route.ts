import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { ManualDiscoveryTestError, type ManualDiscoveryTestInput, type ManualDiscoveryTestResult } from "@/lib/automation/manual-discovery-test";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORKER_ID = "norixo-automation-backlinks-manual-discovery-test";
const LEASE_DURATION_SECONDS = 120;

type Context = { status: "ok"; user: { id: string; email?: string | null }; workspace: { id: string } } | { status: "unauthenticated" } | { status: "workspace_forbidden" };
type Dependencies = {
  getContext: (request: NextRequest) => Promise<Context>;
  isAdmin: (email: string | null | undefined) => boolean;
  run: (input: ManualDiscoveryTestInput) => Promise<ManualDiscoveryTestResult>;
  now: () => Date;
};

function parseBody(value: unknown): { testId: string; query: string } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 2 || !Object.hasOwn(body, "testId") || !Object.hasOwn(body, "query") || typeof body.testId !== "string" || typeof body.query !== "string" || !UUID.test(body.testId) || body.query.trim().length === 0 || body.query.trim().length > 500) return null;
  return { testId: body.testId, query: body.query.trim() };
}

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function createManualDiscoveryTestHandler(dependencies: Dependencies) {
  return async (request: NextRequest) => {
    const context = await dependencies.getContext(request);
    if (context.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (context.status === "workspace_forbidden" || !dependencies.isAdmin(context.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = parseBody(await request.json().catch(() => null));
    if (body === null) return failure(400, "INVALID_INPUT", "Invalid manual Discovery test input.");
    try {
      const result = await dependencies.run({ workspaceId: context.workspace.id, requestedBy: context.user.id, testId: body.testId, query: body.query, workerId: WORKER_ID, now: dependencies.now().toISOString(), leaseDurationSeconds: LEASE_DURATION_SECONDS });
      return NextResponse.json({ ok: true, result });
    } catch (error) {
      if (error instanceof ManualDiscoveryTestError && error.code === "CONFLICT") return failure(409, "MANUAL_DISCOVERY_TEST_EXISTS", "This manual Discovery test has already been started.");
      if (error instanceof ManualDiscoveryTestError && error.code === "INVALID_INPUT") return failure(400, "INVALID_INPUT", "Invalid manual Discovery test input.");
      if (error instanceof ManualDiscoveryTestError && error.code === "WORKSPACE_NOT_ELIGIBLE") return failure(409, "MANUAL_DISCOVERY_TEST_NOT_ELIGIBLE", "This workspace is not eligible for a manual Discovery test.");
      console.error("[automation/backlinks/discovery/tests] request failed");
      return failure(500, "MANUAL_DISCOVERY_TEST_FAILED", "Unable to start the manual Discovery test.");
    }
  };
}

export const POST = createManualDiscoveryTestHandler({
  getContext: async (request) => {
    const { getRequestUserAndWorkspace } = await import("@/lib/server/routeAuth");
    return await getRequestUserAndWorkspace(request) as Context;
  },
  isAdmin: isAdminPrivateEmail,
  run: async (input) => {
    const { createAutomationProductionComposition } = await import("@/lib/automation/production-composition");
    return createAutomationProductionComposition().runManualDiscoveryTest(input);
  },
  now: () => new Date(),
});

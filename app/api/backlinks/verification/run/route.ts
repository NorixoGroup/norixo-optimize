import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createBacklinkVerificationProductionComposition } from "@/lib/backlinks/verification/production-composition";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

type SchedulerTickRequestBody = {
  workerId: string;
  scheduledAt: string;
  leaseDurationSeconds: number;
  maxIterations: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function parseSchedulerTickRequestBody(
  value: unknown,
): SchedulerTickRequestBody | null {
  if (!isRecord(value)) {
    return null;
  }

  const expectedKeys = [
    "workerId",
    "scheduledAt",
    "leaseDurationSeconds",
    "maxIterations",
  ];
  const keys = Object.keys(value);
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key) => expectedKeys.includes(key))
  ) {
    return null;
  }

  const { workerId, scheduledAt, leaseDurationSeconds, maxIterations } = value;
  if (
    typeof workerId !== "string" ||
    workerId.trim().length === 0 ||
    typeof scheduledAt !== "string" ||
    scheduledAt.trim().length === 0 ||
    !Number.isFinite(Date.parse(scheduledAt)) ||
    typeof leaseDurationSeconds !== "number" ||
    !Number.isInteger(leaseDurationSeconds) ||
    leaseDurationSeconds < 30 ||
    leaseDurationSeconds > 3600 ||
    typeof maxIterations !== "number" ||
    !Number.isInteger(maxIterations) ||
    maxIterations < 1
  ) {
    return null;
  }

  return { workerId, scheduledAt, leaseDurationSeconds, maxIterations };
}

export async function POST(request: NextRequest) {
  const { user, workspace } = await getRequestUserAndWorkspace(request);
  if (!user || !workspace) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminPrivateEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const input = parseSchedulerTickRequestBody(body);
  if (input == null) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message:
            "workerId, scheduledAt, leaseDurationSeconds, and maxIterations are invalid.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const composition = createBacklinkVerificationProductionComposition();
    const result = await composition.runSchedulerTick({
      workspaceId: workspace.id,
      workerId: input.workerId,
      scheduledAt: input.scheduledAt,
      leaseDurationSeconds: input.leaseDurationSeconds,
      maxIterations: input.maxIterations,
    });
    return NextResponse.json({ ok: true, result });
  } catch {
    console.error("[backlinks/verification/run] execution failed");
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BACKLINK_VERIFICATION_EXECUTION_FAILED",
          message: "Backlink verification execution failed",
        },
      },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createAutomationProductionComposition } from "@/lib/automation/production-composition";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import type { Json } from "@/types/database.types";

type AutomationTickRequestBody = {
  idempotencyKey: string;
  scheduledAt: string;
  discoveryInput: Record<string, Json>;
  qualificationInput: Record<string, Json>;
};

const AUTOMATION_WORKER_ID = "norixo-automation-backlinks-dry-run";
const AUTOMATION_LEASE_DURATION_SECONDS = 120;
const AUTOMATION_MAX_WORKER_INVOCATIONS = 10;

function isJson(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJson);
  }

  return (
    typeof value === "object" &&
    value != null &&
    Object.values(value).every(isJson)
  );
}

function isJsonObject(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value != null && !Array.isArray(value) && isJson(value);
}

function parseAutomationTickRequestBody(
  value: unknown,
): AutomationTickRequestBody | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const expectedKeys = [
    "idempotencyKey",
    "scheduledAt",
    "discoveryInput",
    "qualificationInput",
  ];
  const keys = Object.keys(value);
  if (
    keys.length !== expectedKeys.length ||
    !keys.every((key) => expectedKeys.includes(key))
  ) {
    return null;
  }

  const { idempotencyKey, scheduledAt, discoveryInput, qualificationInput } = value;
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length === 0 ||
    idempotencyKey !== idempotencyKey.trim() ||
    idempotencyKey.length > 255 ||
    typeof scheduledAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(scheduledAt) ||
    !Number.isFinite(Date.parse(scheduledAt)) ||
    !isJsonObject(discoveryInput) ||
    !isJsonObject(qualificationInput)
  ) {
    return null;
  }

  return { idempotencyKey, scheduledAt, discoveryInput, qualificationInput };
}

function invalidInputResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Invalid automation tick input",
      },
    },
    { status: 400 },
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
  const input = parseAutomationTickRequestBody(body);
  if (input == null) {
    return invalidInputResponse();
  }

  const now = new Date().toISOString();

  try {
    const composition = createAutomationProductionComposition();
    const result = await composition.runBacklinksSchedulerTick({
      workspaceId: context.workspace.id,
      requestedBy: context.user.id,
      workerId: AUTOMATION_WORKER_ID,
      idempotencyKey: input.idempotencyKey,
      triggerSource: "manual",
      scheduledAt: input.scheduledAt,
      startedAt: now,
      attemptedAt: now,
      completedAt: now,
      failedAt: now,
      leaseDurationSeconds: AUTOMATION_LEASE_DURATION_SECONDS,
      maxWorkerInvocations: AUTOMATION_MAX_WORKER_INVOCATIONS,
      discoveryInput: input.discoveryInput,
      qualificationInput: input.qualificationInput,
      promotionInput: { source: "automation_qualification", requestedScope: "preview" },
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[automation/backlinks/tick] request failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "AUTOMATION_TICK_FAILED",
          message: "Unable to run automation tick",
        },
      },
      { status: 500 },
    );
  }
}

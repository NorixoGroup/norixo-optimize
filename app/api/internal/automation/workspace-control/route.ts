import { NextRequest, NextResponse } from "next/server";

import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import {
  getOrCreateAutomationWorkspaceControl,
  updateAutomationWorkspaceControl,
} from "@/lib/automation";
import {
  createOrGetAutomationWorkspaceControl as createOrGetAutomationWorkspaceControlRepository,
  updateAutomationWorkspaceControl as updateAutomationWorkspaceControlRepository,
} from "@/lib/automation/repositories/automationWorkspaceControlsRepository";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type UpdateWorkspaceControlRequestBody = {
  backlinksEnabled: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function parseUpdateWorkspaceControlRequestBody(
  value: unknown,
): UpdateWorkspaceControlRequestBody | null {
  if (!isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "backlinksEnabled") {
    return null;
  }

  const { backlinksEnabled } = value;
  return typeof backlinksEnabled === "boolean" ? { backlinksEnabled } : null;
}

function invalidInputResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Invalid automation workspace control input",
      },
    },
    { status: 400 },
  );
}

function failureResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "AUTOMATION_WORKSPACE_CONTROL_FAILED",
        message: "Unable to manage automation workspace control",
      },
    },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
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

  try {
    const client = createSupabaseAdminClient();
    const result = await getOrCreateAutomationWorkspaceControl(
      {
        getOrCreateControl: (input) =>
          createOrGetAutomationWorkspaceControlRepository(client, input),
        updateControl: (input) =>
          updateAutomationWorkspaceControlRepository(client, input),
      },
      { workspaceId: context.workspace.id },
    );

    return NextResponse.json({
      ok: true,
      control: result.control,
      disposition: result.kind,
    });
  } catch {
    console.error("[automation/workspace-control] request failed");
    return failureResponse();
  }
}

export async function PATCH(request: NextRequest) {
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
  const input = parseUpdateWorkspaceControlRequestBody(body);
  if (input == null) {
    return invalidInputResponse();
  }

  try {
    const client = createSupabaseAdminClient();
    const dependencies = {
      getOrCreateControl: (controlInput: { workspaceId: string }) =>
        createOrGetAutomationWorkspaceControlRepository(client, controlInput),
      updateControl: (controlInput: {
        workspaceId: string;
        backlinksEnabled: boolean;
      }) => updateAutomationWorkspaceControlRepository(client, controlInput),
    };
    await getOrCreateAutomationWorkspaceControl(dependencies, {
      workspaceId: context.workspace.id,
    });
    const result = await updateAutomationWorkspaceControl(dependencies, {
      workspaceId: context.workspace.id,
      backlinksEnabled: input.backlinksEnabled,
    });

    return NextResponse.json({ ok: true, control: result.control });
  } catch {
    console.error("[automation/workspace-control] request failed");
    return failureResponse();
  }
}

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  getOrCreateWorkspaceForUser,
  type Workspace,
} from "../workspaces/ensureWorkspaceForUser";

const WORKSPACE_ID_HEADER = "X-Norixo-Workspace-Id";

type RequestSupabaseClient = ReturnType<typeof createRequestSupabaseClient>;

export type RequestUserAndWorkspaceResult =
  | {
      status: "ok";
      client: RequestSupabaseClient;
      user: User;
      workspace: Workspace;
    }
  | {
      status: "unauthenticated";
      client: null;
      user: null;
      workspace: null;
    }
  | {
      status: "workspace_forbidden";
      client: RequestSupabaseClient;
      user: User;
      workspace: null;
    };

function getAccessTokenFromRequest(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

export function createRequestSupabaseClient(request: NextRequest) {
  const accessToken = getAccessTokenFromRequest(request);

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      : undefined
  );
}

async function getRequestedWorkspaceForUser(
  client: RequestSupabaseClient,
  userId: string,
  requestedWorkspaceId: string,
): Promise<Workspace | null> {
  const { data: membership } = await client
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", requestedWorkspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.workspace_id) {
    const { data: workspace } = await client
      .from("workspaces")
      .select("id,name,slug,owner_user_id,created_at,updated_at")
      .eq("id", requestedWorkspaceId)
      .maybeSingle();

    return workspace ?? null;
  }

  const { data: ownedWorkspace } = await client
    .from("workspaces")
    .select("id,name,slug,owner_user_id,created_at,updated_at")
    .eq("id", requestedWorkspaceId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  return ownedWorkspace ?? null;
}

export async function getRequestUserAndWorkspace(
  request: NextRequest,
): Promise<RequestUserAndWorkspaceResult> {
  const accessToken = getAccessTokenFromRequest(request);

  if (!accessToken) {
    return {
      status: "unauthenticated",
      client: null,
      user: null,
      workspace: null,
    };
  }

  const client = createRequestSupabaseClient(request);
  const {
    data: { user },
  } = await client.auth.getUser(accessToken);

  if (!user) {
    return {
      status: "unauthenticated",
      client: null,
      user: null,
      workspace: null,
    };
  }

  const requestedWorkspaceId = request.headers.get(WORKSPACE_ID_HEADER);

  if (requestedWorkspaceId !== null) {
    const workspaceId = requestedWorkspaceId.trim();
    if (!workspaceId) {
      return {
        status: "workspace_forbidden",
        client,
        user,
        workspace: null,
      };
    }

    const workspace = await getRequestedWorkspaceForUser(client, user.id, workspaceId);
    if (!workspace) {
      return {
        status: "workspace_forbidden",
        client,
        user,
        workspace: null,
      };
    }

    return {
      status: "ok",
      client,
      user,
      workspace,
    };
  }

  const workspace = await getOrCreateWorkspaceForUser({
    userId: user.id,
    email: user.email ?? null,
    client,
  });

  if (!workspace) {
    return {
      status: "unauthenticated",
      client: null,
      user: null,
      workspace: null,
    };
  }

  return {
    status: "ok",
    client,
    user,
    workspace,
  };
}

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import {
  getOrCreateWorkspaceForUser,
  type Workspace,
} from "../workspaces/ensureWorkspaceForUser";
import { createSupabaseAdminClient } from "../supabase-admin";

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

function getAccessTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

/**
 * Privileged read-only client for the isAdminPrivateEmail-gated
 * app/api/backlinks/outreach/** route family (G4-M5 fix).
 *
 * Call ONLY after getRequestUserAndWorkspace() returned status "ok" AND
 * isAdminPrivateEmail(user.email) is true: this entire route family's
 * authority is the global staff allow-list, not the caller's
 * workspace_members.role, so a staff caller holding only 'member' on the
 * resolved workspace must still read the same data an 'admin'/'owner'
 * caller would. Every query built with this client must keep filtering
 * explicitly by the already-resolved workspace.id -- it bypasses RLS and
 * provides no tenant isolation by itself. Do not use for write paths
 * (unchanged, still gated by the authenticated client + RLS) or for any
 * customer-facing route outside this family.
 */
export function createStaffOutreachReadClient() {
  return createSupabaseAdminClient();
}

export function createRequestSupabaseClient(request: Request) {
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
  request: Request,
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

import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getOrCreateWorkspaceForUser } from "../workspaces/ensureWorkspaceForUser";

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

export async function getRequestUserAndWorkspace(request: NextRequest) {
  const accessToken = getAccessTokenFromRequest(request);

  if (!accessToken) {
    return { client: null, user: null, workspace: null };
  }

  const client = createRequestSupabaseClient(request);
  const {
    data: { user },
  } = await client.auth.getUser(accessToken);

  if (!user) {
    return { client, user: null, workspace: null };
  }

  const workspace = await getOrCreateWorkspaceForUser({
    userId: user.id,
    email: user.email ?? null,
    client,
  });

  return { client, user, workspace };
}

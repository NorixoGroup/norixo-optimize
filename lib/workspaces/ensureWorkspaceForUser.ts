import { supabase } from "../supabase";

export type Workspace = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};

function buildDefaultWorkspaceName(email: string | null): string {
  if (!email) return "My workspace";
  const prefix = email.split("@")[0] || "workspace";
  return `${prefix}'s workspace`;
}

function buildDefaultWorkspaceSlug(email: string | null): string | null {
  if (!email) return null;
  const prefix = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return prefix ? `${prefix}-workspace` : null;
}

async function ensureMembershipForWorkspace(
  workspaceId: string,
  userId: string,
  client = supabase
) {
  const { data: membership, error: membershipError } = await client
    .from("workspace_members")
    .select("workspace_id,user_id,role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    console.warn("ensureMembershipForWorkspace lookup error", membershipError);
  }

  if (!membership) {
    const { error: insertMembershipError } = await client
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: "owner",
      });

    if (insertMembershipError) {
      console.warn(
        "ensureMembershipForWorkspace insert error",
        insertMembershipError
      );
    }
  }
}

async function ensureSubscriptionForWorkspace(
  workspaceId: string,
  client = supabase
) {
  const { data: existing, error: existingError } = await client
    .from("subscriptions")
    .select("id,workspace_id,plan_code,status,created_at,updated_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existingError) {
    console.warn("ensureSubscriptionForWorkspace lookup error", existingError);
  }

  if (existing) {
    return existing;
  }

  const { data: inserted, error: insertError } = await client
    .from("subscriptions")
    .insert({
      workspace_id: workspaceId,
      plan_code: "free",
      status: "active",
    })
    .select("id,workspace_id,plan_code,status,created_at,updated_at")
    .single();

  if (insertError) {
    console.warn("ensureSubscriptionForWorkspace insert error", insertError);
    return null;
  }

  return inserted;
}

export async function ensureWorkspaceForUser(userId: string): Promise<Workspace | null>;
export async function ensureWorkspaceForUser(params: {
  userId: string;
  email: string | null;
  client?: typeof supabase;
}): Promise<Workspace | null>;
export async function ensureWorkspaceForUser(
  arg: string | { userId: string; email: string | null; client?: typeof supabase }
): Promise<Workspace | null> {
  const userId = typeof arg === "string" ? arg : arg.userId;
  const email = typeof arg === "string" ? null : arg.email;
  const client = typeof arg === "string" ? supabase : arg.client ?? supabase;

  if (!userId) return null;

  // 1) First, resolve directly by owner_user_id
  const { data: ownedWorkspace, error: ownedWorkspaceError } = await client
    .from("workspaces")
    .select("id,name,slug,owner_user_id,created_at,updated_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownedWorkspaceError) {
    console.warn("ensureWorkspaceForUser owned workspace lookup error", ownedWorkspaceError);
  }

  if (ownedWorkspace) {
    const workspace = ownedWorkspace as Workspace;
    await ensureMembershipForWorkspace(workspace.id, userId, client);
    await ensureSubscriptionForWorkspace(workspace.id, client);
    return workspace;
  }

  // 2) Fallback: if a membership exists already, resolve via workspace_members
  const { data: membership, error: membershipError } = await client
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.warn("ensureWorkspaceForUser membership lookup error", membershipError);
  }

  if (membership?.workspace_id) {
    const { data: workspaceFromMembership, error: workspaceFromMembershipError } =
      await client
        .from("workspaces")
        .select("id,name,slug,owner_user_id,created_at,updated_at")
        .eq("id", membership.workspace_id)
        .maybeSingle();

    if (workspaceFromMembershipError) {
      console.warn(
        "ensureWorkspaceForUser workspace-from-membership lookup error",
        workspaceFromMembershipError
      );
    }

    if (workspaceFromMembership) {
      const workspace = workspaceFromMembership as Workspace;
      await ensureMembershipForWorkspace(workspace.id, userId, client);
      await ensureSubscriptionForWorkspace(workspace.id, client);
      return workspace;
    }
  }

  // 3) Nothing exists: create workspace
  const name = buildDefaultWorkspaceName(email);
  const slug = buildDefaultWorkspaceSlug(email);

  const { data: createdWorkspace, error: createWorkspaceError } = await client
    .from("workspaces")
    .insert({
      name,
      slug,
      owner_user_id: userId,
    })
    .select("id,name,slug,owner_user_id,created_at,updated_at")
    .single();

  if (createWorkspaceError || !createdWorkspace) {
    console.warn("ensureWorkspaceForUser create workspace error", createWorkspaceError);
    return null;
  }

  const workspace = createdWorkspace as Workspace;

  await ensureMembershipForWorkspace(workspace.id, userId, client);
  await ensureSubscriptionForWorkspace(workspace.id, client);

  return workspace;
}
import { supabase } from "../supabase";

export type Workspace = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};

type WorkspaceClient = typeof supabase;

type EnsureWorkspaceParams = {
  userId: string;
  email: string | null;
  client?: WorkspaceClient;
  preferredName?: string | null;
};

type LookupWorkspaceMember = {
  workspace_id: string;
};

function buildDefaultWorkspaceName(email: string | null, preferredName?: string | null): string {
  const cleanedPreferredName = preferredName?.trim();
  if (cleanedPreferredName) return cleanedPreferredName;
  if (!email) return "My workspace";
  const prefix = email.split("@")[0] || "workspace";
  return `${prefix}'s workspace`;
}

function buildDefaultWorkspaceSlug(email: string | null, preferredName?: string | null): string | null {
  const slugSource = preferredName?.trim() || email?.split("@")[0] || "";
  const prefix = slugSource
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return prefix ? `${prefix}-workspace` : null;
}

function buildWorkspaceSlugCandidate(baseSlug: string | null, attempt: number): string | null {
  if (!baseSlug) return null;
  if (attempt === 0) return baseSlug;
  return `${baseSlug}-${attempt + 1}`;
}

function isDuplicateWorkspaceError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? error.code : null;
  const status = "status" in error ? error.status : null;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return code === "23505" || status === 409 || message.includes("duplicate key value");
}

function isWorkspaceSlugCollision(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return isDuplicateWorkspaceError(error) && message.includes("workspaces_slug_key");
}

async function loadWorkspaceById(
  workspaceId: string,
  client: WorkspaceClient
): Promise<Workspace | null> {
  const { data, error } = await client
    .from("workspaces")
    .select("id,name,slug,owner_user_id,created_at,updated_at")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    console.warn("loadWorkspaceById error", error);
  }

  return (data as Workspace | null) ?? null;
}

async function ensureMembershipForWorkspace(
  workspaceId: string,
  userId: string,
  client: WorkspaceClient
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

  if (membership) {
    return membership;
  }

  const { data: insertedMembership, error: insertMembershipError } = await client
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: "owner",
    })
    .select("workspace_id,user_id,role")
    .maybeSingle();

  if (insertMembershipError && !isDuplicateWorkspaceError(insertMembershipError)) {
    console.warn("ensureMembershipForWorkspace insert error", insertMembershipError);
  }

  return insertedMembership ?? null;
}

async function ensureSubscriptionForWorkspace(
  workspaceId: string,
  client: WorkspaceClient
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

async function findWorkspaceMembership(
  userId: string,
  client: WorkspaceClient
): Promise<LookupWorkspaceMember | null> {
  const { data, error } = await client
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("findWorkspaceMembership error", error);
  }

  return (data as LookupWorkspaceMember | null) ?? null;
}

async function findOwnedWorkspace(
  userId: string,
  client: WorkspaceClient
): Promise<Workspace | null> {
  const { data, error } = await client
    .from("workspaces")
    .select("id,name,slug,owner_user_id,created_at,updated_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("findOwnedWorkspace error", error);
  }

  return (data as Workspace | null) ?? null;
}

async function resolveWorkspaceForUser(
  userId: string,
  client: WorkspaceClient
): Promise<Workspace | null> {
  if (!userId) return null;

  const membership = await findWorkspaceMembership(userId, client);
  if (membership?.workspace_id) {
    const workspace = await loadWorkspaceById(membership.workspace_id, client);
    if (workspace) {
      console.info("resolveWorkspaceForUser reused workspace from membership", {
        userId,
        workspaceId: workspace.id,
      });
      return workspace;
    }
  }

  const ownedWorkspace = await findOwnedWorkspace(userId, client);
  if (ownedWorkspace) {
    console.info("resolveWorkspaceForUser reused owned workspace", {
      userId,
      workspaceId: ownedWorkspace.id,
    });
    await ensureMembershipForWorkspace(ownedWorkspace.id, userId, client);
    return ownedWorkspace;
  }

  return null;
}

async function createWorkspaceForUser({
  userId,
  email,
  client,
  preferredName,
}: Required<EnsureWorkspaceParams>): Promise<Workspace | null> {
  const name = buildDefaultWorkspaceName(email, preferredName);
  const baseSlug = buildDefaultWorkspaceSlug(email, preferredName);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = buildWorkspaceSlugCandidate(baseSlug, attempt);
    const { data, error } = await client
      .from("workspaces")
      .insert({
        name,
        slug,
        owner_user_id: userId,
      })
      .select("id,name,slug,owner_user_id,created_at,updated_at")
      .single();

    if (!error && data) {
      const workspace = data as Workspace;
      await ensureMembershipForWorkspace(workspace.id, userId, client);
      await ensureSubscriptionForWorkspace(workspace.id, client);
      return workspace;
    }

    lastError = error;

    if (!isWorkspaceSlugCollision(error)) {
      break;
    }
  }

  console.warn("createWorkspaceForUser error", lastError);

  if (isDuplicateWorkspaceError(lastError)) {
    const resolvedWorkspace = await resolveWorkspaceForUser(userId, client);
    if (resolvedWorkspace) {
      await ensureMembershipForWorkspace(resolvedWorkspace.id, userId, client);
      await ensureSubscriptionForWorkspace(resolvedWorkspace.id, client);
      return resolvedWorkspace;
    }
  }

  return null;
}

export async function getWorkspaceForUser(
  userId: string,
  client: WorkspaceClient = supabase
): Promise<Workspace | null> {
  const workspace = await resolveWorkspaceForUser(userId, client);

  if (!workspace) {
    return null;
  }

  await ensureMembershipForWorkspace(workspace.id, userId, client);
  await ensureSubscriptionForWorkspace(workspace.id, client);
  return workspace;
}

export async function getCurrentWorkspaceId(
  userId: string,
  client: WorkspaceClient = supabase
): Promise<string | null> {
  const workspace = await getWorkspaceForUser(userId, client);
  return workspace?.id ?? null;
}

export async function getOrCreateWorkspaceForUser(
  userId: string,
  client?: WorkspaceClient
): Promise<Workspace | null>;
export async function getOrCreateWorkspaceForUser(
  params: EnsureWorkspaceParams
): Promise<Workspace | null>;
export async function getOrCreateWorkspaceForUser(
  arg: string | EnsureWorkspaceParams
): Promise<Workspace | null> {
  const userId = typeof arg === "string" ? arg : arg.userId;
  const email = typeof arg === "string" ? null : arg.email;
  const preferredName = typeof arg === "string" ? null : arg.preferredName ?? null;
  const client = typeof arg === "string" ? supabase : arg.client ?? supabase;

  if (!userId) return null;

  const existingWorkspace = await getWorkspaceForUser(userId, client);
  if (existingWorkspace) {
    return existingWorkspace;
  }

  return createWorkspaceForUser({
    userId,
    email,
    preferredName,
    client,
  });
}

export async function ensureWorkspaceForUser(
  userId: string
): Promise<Workspace | null>;
export async function ensureWorkspaceForUser(
  params: EnsureWorkspaceParams
): Promise<Workspace | null>;
export async function ensureWorkspaceForUser(
  arg: string | EnsureWorkspaceParams
): Promise<Workspace | null> {
  if (typeof arg === "string") {
    return getOrCreateWorkspaceForUser(arg);
  }

  return getOrCreateWorkspaceForUser(arg);
}

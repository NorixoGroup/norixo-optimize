import { getWorkspaceAuditCredits } from "../billing/getWorkspaceAuditCredits";
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

const PAID_SUBSCRIPTION_PLAN_CODES = new Set(["pro", "scale"]);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

type SubscriptionPickRow = {
  workspace_id: string;
  plan_code?: string | null;
  status?: string | null;
};

function isPaidActiveProOrScaleSubscription(row: SubscriptionPickRow | null): boolean {
  if (!row) return false;
  const plan = String(row.plan_code ?? "").toLowerCase();
  const status = String(row.status ?? "").toLowerCase();
  return PAID_SUBSCRIPTION_PLAN_CODES.has(plan) && ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

async function loadCandidateWorkspaceIds(
  userId: string,
  client: WorkspaceClient
): Promise<Map<string, { memberSinceMs: number }>> {
  const earliestByWorkspace = new Map<string, { memberSinceMs: number }>();

  const { data: memberRows, error: memberError } = await client
    .from("workspace_members")
    .select("workspace_id, created_at")
    .eq("user_id", userId);

  if (memberError) {
    console.warn("loadCandidateWorkspaceIds workspace_members error", memberError);
  }

  for (const row of memberRows ?? []) {
    const wid =
      row && typeof row.workspace_id === "string" ? row.workspace_id.trim() : "";
    if (!wid) continue;

    const ts = Date.parse(String(row.created_at ?? ""));
    const ms = Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;

    const prev = earliestByWorkspace.get(wid)?.memberSinceMs ?? Number.POSITIVE_INFINITY;
    if (ms < prev) {
      earliestByWorkspace.set(wid, { memberSinceMs: ms });
    }
  }

  const { data: ownedRows, error: ownedError } = await client
    .from("workspaces")
    .select("id, created_at")
    .eq("owner_user_id", userId);

  if (ownedError) {
    console.warn("loadCandidateWorkspaceIds workspaces error", ownedError);
  }

  for (const row of ownedRows ?? []) {
    const wid = row && typeof row.id === "string" ? row.id.trim() : "";
    if (!wid) continue;

    const ts = Date.parse(String(row.created_at ?? ""));
    const ms = Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;

    if (!earliestByWorkspace.has(wid)) {
      earliestByWorkspace.set(wid, { memberSinceMs: ms });
    }
  }

  return earliestByWorkspace;
}

async function resolveWorkspaceForUser(
  userId: string,
  client: WorkspaceClient
): Promise<Workspace | null> {
  if (!userId) return null;

  const candidates = await loadCandidateWorkspaceIds(userId, client);

  if (!candidates.size) {
    return null;
  }

  const ids = Array.from(candidates.keys());

  const [{ data: subscriptionRows, error: subscriptionsError }, creditResults] = await Promise.all([
    client
      .from("subscriptions")
      .select("workspace_id, plan_code, status")
      .in("workspace_id", ids),
    Promise.all(
      ids.map(async (workspaceId) => {
        const credits = await getWorkspaceAuditCredits(workspaceId, client);
        return { workspaceId, credits };
      })
    ),
  ]);

  if (subscriptionsError) {
    console.warn("resolveWorkspaceForUser subscriptions error", subscriptionsError);
  }

  const subByWorkspace = new Map<string, SubscriptionPickRow>();
  for (const row of (subscriptionRows ?? []) as SubscriptionPickRow[]) {
    const wid = String(row.workspace_id ?? "").trim();
    if (wid) {
      subByWorkspace.set(wid, row);
    }
  }

  const creditsById = new Map(creditResults.map((r) => [r.workspaceId, r.credits.available]));

  type RankedWorkspace = Workspace & {
    availableCredits: number;
    memberSinceMs: number;
    planCode: string;
    sub: SubscriptionPickRow | null;
  };

  const ranked: RankedWorkspace[] = [];

  for (const workspaceId of ids) {
    const workspaceEntity = await loadWorkspaceById(workspaceId, client);
    if (!workspaceEntity) continue;

    const sub = subByWorkspace.get(workspaceId) ?? null;
    const meta = candidates.get(workspaceId);
    ranked.push({
      ...workspaceEntity,
      availableCredits: creditsById.get(workspaceId) ?? 0,
      memberSinceMs: meta?.memberSinceMs ?? Number.MAX_SAFE_INTEGER,
      planCode: String(sub?.plan_code ?? "free"),
      sub,
    });
  }

  if (!ranked.length) {
    return null;
  }

  let chosen: RankedWorkspace = ranked[0]!;
  let reason: string = "workspace_membership_oldest";

  const withCredits = ranked.filter((r) => r.availableCredits > 0);
  if (withCredits.length) {
    chosen = [...withCredits].sort(
      (a, b) =>
        b.availableCredits - a.availableCredits ||
        b.memberSinceMs - a.memberSinceMs ||
        a.id.localeCompare(b.id)
    )[0]!;
    reason = "audit_credits_available";
  } else {
    const paidTier = ranked.filter((r) => isPaidActiveProOrScaleSubscription(r.sub));
    if (paidTier.length) {
      chosen = [...paidTier].sort(
        (a, b) => b.memberSinceMs - a.memberSinceMs || a.id.localeCompare(b.id)
      )[0]!;
      reason = "paid_subscription_pro_scale";
    } else {
      chosen = [...ranked].sort(
        (a, b) => a.memberSinceMs - b.memberSinceMs || a.id.localeCompare(b.id)
      )[0]!;
      reason = "workspace_membership_oldest";
    }
  }

  console.info("[workspace][resolveWorkspaceForUser]", {
    userId,
    selectedWorkspaceId: chosen.id,
    reason,
    availableCredits: chosen.availableCredits,
    planCode: chosen.planCode,
    candidateWorkspaceCount: ranked.length,
  });

  await ensureMembershipForWorkspace(chosen.id, userId, client);
  return {
    id: chosen.id,
    name: chosen.name,
    slug: chosen.slug,
    owner_user_id: chosen.owner_user_id,
    created_at: chosen.created_at,
    updated_at: chosen.updated_at,
  };
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

import { supabase } from "../supabase";

export type InvitationRole = "admin" | "member";

export type CreateWorkspaceInvitationParams = {
  workspaceId: string;
  email: string;
  role: InvitationRole;
  invitedByUserId: string;
  /** Optional explicit expiry; if omitted, rely on DB default or separate cleanup. */
  expiresAt?: string | null;
  client?: typeof supabase;
};

export type CreateWorkspaceInvitationResult = {
  id: string;
  token: string;
};

function generateToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(16);
    (crypto as Crypto).getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback – not ideal for true production, but keeps the helper functional
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export async function createWorkspaceInvitation(
  params: CreateWorkspaceInvitationParams
): Promise<CreateWorkspaceInvitationResult> {
  const { workspaceId, email, role, invitedByUserId, expiresAt = null, client = supabase } =
    params;

  if (!workspaceId) {
    throw new Error("workspaceId is required to create an invitation");
  }
  if (!email) {
    throw new Error("email is required to create an invitation");
  }
  if (role !== "admin" && role !== "member") {
    throw new Error("role must be 'admin' or 'member'");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const token = generateToken();

  const { data, error } = await client
    .from("workspace_invitations")
    .insert({
      workspace_id: workspaceId,
      email: normalizedEmail,
      role,
      invited_by: invitedByUserId,
      token,
      expires_at: expiresAt,
    })
    .select("id, token")
    .single();

  if (error || !data) {
    console.warn("createWorkspaceInvitation error", error);
    throw new Error("Failed to create workspace invitation");
  }

  return {
    id: data.id as string,
    token: data.token as string,
  };
}

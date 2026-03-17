import { supabase } from "../supabase";

export type AcceptWorkspaceInvitationParams = {
  token: string;
  userId: string;
  userEmail: string | null;
  client?: typeof supabase;
};

export type AcceptWorkspaceInvitationResult = {
  success: boolean;
  reason?: string;
  workspaceId?: string;
  role?: string;
};

export async function acceptWorkspaceInvitation(
  params: AcceptWorkspaceInvitationParams
): Promise<AcceptWorkspaceInvitationResult> {
  const { token, userId, userEmail, client = supabase } = params;

  if (!token) {
    return { success: false, reason: "Missing invitation token" };
  }
  if (!userId) {
    return { success: false, reason: "You must be signed in to accept an invitation" };
  }

  const nowIso = new Date().toISOString();

  const { data: invite, error } = await client
    .from("workspace_invitations")
    .select("id, workspace_id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.warn("acceptWorkspaceInvitation load error", error);
    return { success: false, reason: "Unable to load invitation" };
  }

  if (!invite) {
    return { success: false, reason: "Invitation not found" };
  }

  if (invite.status !== "pending") {
    return { success: false, reason: "This invitation is no longer valid" };
  }

  if (invite.expires_at && invite.expires_at < nowIso) {
    return { success: false, reason: "This invitation has expired" };
  }

  const normalizedInviteEmail = (invite.email as string).trim().toLowerCase();
  const normalizedUserEmail = userEmail ? userEmail.trim().toLowerCase() : null;

  if (normalizedUserEmail && normalizedInviteEmail !== normalizedUserEmail) {
    return { success: false, reason: "Invitation email does not match your account" };
  }

  // Check if the user is already a member of this workspace
  const { data: existingMember, error: memberError } = await client
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    console.warn("acceptWorkspaceInvitation membership check error", memberError);
  }

  if (!existingMember) {
    const { error: insertError } = await client.from("workspace_members").insert({
      workspace_id: invite.workspace_id,
      user_id: userId,
      role: invite.role,
    });

    if (insertError) {
      console.warn("acceptWorkspaceInvitation insert member error", insertError);
      return { success: false, reason: "Failed to add you to the workspace" };
    }
  }

  const { error: updateError } = await client
    .from("workspace_invitations")
    .update({
      status: "accepted",
      accepted_at: nowIso,
    })
    .eq("id", invite.id);

  if (updateError) {
    console.warn("acceptWorkspaceInvitation update invite error", updateError);
  }

  return {
    success: true,
    workspaceId: invite.workspace_id as string,
    role: invite.role as string,
  };
}

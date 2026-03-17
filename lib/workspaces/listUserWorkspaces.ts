import { supabase } from "../supabase";
import type { Workspace } from "./getCurrentWorkspace";

export type UserWorkspace = Workspace & {
  role: "owner" | "admin" | "member" | string;
};

/**
 * List all workspaces the given user belongs to, with their role.
 * Requires a Supabase client that can query workspace_members.
 */
export async function listUserWorkspaces(
  userId: string,
  client = supabase
): Promise<UserWorkspace[]> {
  if (!userId) return [];

  const { data, error } = await client
    .from("workspace_members")
    .select(
      "role, workspaces:workspace_id(id,name,slug,owner_user_id,created_at,updated_at)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("listUserWorkspaces error", error);
    return [];
  }

  if (!data) return [];

  return (
    data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => {
        const ws = row.workspaces as Workspace | undefined;
        if (!ws) return null;
        return {
          ...ws,
          role: row.role as UserWorkspace["role"],
        } as UserWorkspace;
      })
      .filter(Boolean) as UserWorkspace[]
  );
}

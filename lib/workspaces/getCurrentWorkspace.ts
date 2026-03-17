import { supabase } from "../supabase";

export type Workspace = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};

export async function getCurrentWorkspace(
  userId: string,
  client = supabase
): Promise<Workspace | null> {
  if (!userId) return null;

  const { data, error } = await client
    .from("workspaces")
    .select("id,name,slug,owner_user_id,created_at,updated_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("getCurrentWorkspace error", error);
    return null;
  }

  return (data as Workspace | null) ?? null;
}
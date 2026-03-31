import { supabase } from "../supabase";
import { getWorkspaceForUser, type Workspace } from "./ensureWorkspaceForUser";

export async function getCurrentWorkspace(
  userId: string,
  client = supabase
): Promise<Workspace | null> {
  if (!userId) return null;

  return getWorkspaceForUser(userId, client);
}

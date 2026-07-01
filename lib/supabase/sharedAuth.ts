import { supabase } from "@/lib/supabase";

type SharedUserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;
type SharedSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;

let sharedUserPromise: Promise<SharedUserResult> | null = null;
let sharedSessionPromise: Promise<SharedSessionResult> | null = null;

export function getSharedUser(): Promise<SharedUserResult> {
  if (!sharedUserPromise) {
    sharedUserPromise = supabase.auth.getUser().finally(() => {
      sharedUserPromise = null;
    });
  }

  return sharedUserPromise;
}

export function getSharedSession(): Promise<SharedSessionResult> {
  if (!sharedSessionPromise) {
    sharedSessionPromise = supabase.auth.getSession().finally(() => {
      sharedSessionPromise = null;
    });
  }

  return sharedSessionPromise;
}

export function clearSharedAuthCache() {
  sharedUserPromise = null;
  sharedSessionPromise = null;
}

// Placeholder Supabase client. Replace with `@supabase/supabase-js` in production.

export type SupabaseClient = unknown;

export function getSupabaseClient(): SupabaseClient {
  console.warn("Supabase client is not configured. This is a placeholder.");
  return {} as SupabaseClient;
}

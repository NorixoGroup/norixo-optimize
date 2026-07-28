import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Request-scoped Supabase client injected by the calling route or service.
 * Repositories must not create clients or bypass row-level security.
 */
export type BacklinkRepositoryClient = SupabaseClient<Database>;

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type StoredMetaConnectionStatus = "connected" | "no_pages" | "error";

export type PersistMetaConnectionInput = {
  provider: "meta";
  status: StoredMetaConnectionStatus;
  facebookPageId: string | null;
  facebookPageName: string | null;
  facebookPageAccessToken: string | null;
  facebookPageTokenObtainedAt: string | null;
  instagramBusinessAccountId: string | null;
  instagramUsername: string | null;
  grantedScopes: string[];
  rawPagesSnapshot: unknown;
  lastConnectedByUserId: string | null;
  lastConnectedByEmail: string | null;
};

export type MetaConnectionStatusView = {
  provider: "meta";
  connected: boolean;
  status: "not_connected" | StoredMetaConnectionStatus;
  facebookPage: {
    id: string;
    name: string;
  } | null;
  instagramBusinessAccount: {
    id: string;
    username: string;
  } | null;
  grantedScopes: string[];
  updatedAt: string | null;
};

type StoredMetaConnectionRow = {
  provider: "meta";
  status: StoredMetaConnectionStatus;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  facebook_page_access_token?: string | null;
  facebook_page_token_obtained_at?: string | null;
  instagram_business_account_id: string | null;
  instagram_username: string | null;
  granted_scopes: string[] | null;
  updated_at: string;
};

export type MetaConnectionPublishRecord = {
  provider: "meta";
  status: StoredMetaConnectionStatus;
  facebookPageId: string | null;
  facebookPageName: string | null;
  facebookPageAccessToken: string | null;
  facebookPageTokenObtainedAt: string | null;
  grantedScopes: string[];
  updatedAt: string | null;
};

export async function persistMetaConnection(input: PersistMetaConnectionInput) {
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("marketing_studio_meta_connections").upsert(
    {
      provider: input.provider,
      status: input.status,
      facebook_page_id: input.facebookPageId,
      facebook_page_name: input.facebookPageName,
      facebook_page_access_token: input.facebookPageAccessToken,
      facebook_page_token_obtained_at: input.facebookPageTokenObtainedAt,
      instagram_business_account_id: input.instagramBusinessAccountId,
      instagram_username: input.instagramUsername,
      granted_scopes: input.grantedScopes,
      raw_pages_snapshot: input.rawPagesSnapshot,
      last_connected_by_user_id: input.lastConnectedByUserId,
      last_connected_by_email: input.lastConnectedByEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" },
  );

  if (error) {
    throw error;
  }
}

export async function readMetaConnectionStatus(): Promise<MetaConnectionStatusView> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("marketing_studio_meta_connections")
    .select(
      "provider,status,facebook_page_id,facebook_page_name,instagram_business_account_id,instagram_username,granted_scopes,updated_at",
    )
    .eq("provider", "meta")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? null) as StoredMetaConnectionRow | null;

  if (!row) {
    return {
      provider: "meta",
      connected: false,
      status: "not_connected",
      facebookPage: null,
      instagramBusinessAccount: null,
      grantedScopes: [],
      updatedAt: null,
    };
  }

  return {
    provider: "meta",
    connected: row.status === "connected" && Boolean(row.facebook_page_id),
    status: row.status,
    facebookPage:
      row.facebook_page_id && row.facebook_page_name
        ? {
            id: row.facebook_page_id,
            name: row.facebook_page_name,
          }
        : null,
    instagramBusinessAccount:
      row.instagram_business_account_id && row.instagram_username
        ? {
            id: row.instagram_business_account_id,
            username: row.instagram_username,
          }
        : null,
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes : [],
    updatedAt: row.updated_at ?? null,
  };
}

export async function readMetaConnectionForPublish(): Promise<MetaConnectionPublishRecord | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("marketing_studio_meta_connections")
    .select(
      "provider,status,facebook_page_id,facebook_page_name,facebook_page_access_token,facebook_page_token_obtained_at,granted_scopes,updated_at",
    )
    .eq("provider", "meta")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? null) as StoredMetaConnectionRow | null;

  if (!row) {
    return null;
  }

  return {
    provider: "meta",
    status: row.status,
    facebookPageId: row.facebook_page_id ?? null,
    facebookPageName: row.facebook_page_name ?? null,
    facebookPageAccessToken: row.facebook_page_access_token ?? null,
    facebookPageTokenObtainedAt: row.facebook_page_token_obtained_at ?? null,
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes : [],
    updatedAt: row.updated_at ?? null,
  };
}

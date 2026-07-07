import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type StoredTikTokConnectionStatus = "connected" | "error";

export type PersistTikTokConnectionInput = {
  provider: "tiktok";
  status: StoredTikTokConnectionStatus;
  openId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  grantedScopes: string[];
  lastConnectedByUserId: string | null;
  lastConnectedByEmail: string | null;
};

type StoredTikTokConnectionRow = {
  provider: "tiktok";
  status: StoredTikTokConnectionStatus;
  open_id: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at: string | null;
  refresh_expires_at: string | null;
  granted_scopes: string[] | null;
  updated_at: string;
};

export type TikTokConnectionStatusView = {
  provider: "tiktok";
  connected: boolean;
  status: "not_connected" | StoredTikTokConnectionStatus;
  openId: string | null;
  grantedScopes: string[];
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  updatedAt: string | null;
};

export type TikTokConnectionUploadRecord = {
  provider: "tiktok";
  status: StoredTikTokConnectionStatus;
  openId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  grantedScopes: string[];
  updatedAt: string | null;
};

export async function persistTikTokConnection(
  input: PersistTikTokConnectionInput,
) {
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("marketing_studio_tiktok_connections")
    .upsert(
      {
        provider: input.provider,
        status: input.status,
        open_id: input.openId,
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
        expires_at: input.expiresAt,
        refresh_expires_at: input.refreshExpiresAt,
        granted_scopes: input.grantedScopes,
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

export async function readTikTokConnectionStatus(): Promise<TikTokConnectionStatusView> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("marketing_studio_tiktok_connections")
    .select(
      "provider,status,open_id,expires_at,refresh_expires_at,granted_scopes,updated_at",
    )
    .eq("provider", "tiktok")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? null) as StoredTikTokConnectionRow | null;

  if (!row) {
    return {
      provider: "tiktok",
      connected: false,
      status: "not_connected",
      openId: null,
      grantedScopes: [],
      expiresAt: null,
      refreshExpiresAt: null,
      updatedAt: null,
    };
  }

  return {
    provider: "tiktok",
    connected: row.status === "connected" && Boolean(row.open_id?.trim()),
    status: row.status,
    openId: row.open_id ?? null,
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes : [],
    expiresAt: row.expires_at ?? null,
    refreshExpiresAt: row.refresh_expires_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function readTikTokConnectionForUpload(): Promise<TikTokConnectionUploadRecord | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("marketing_studio_tiktok_connections")
    .select(
      "provider,status,open_id,access_token,refresh_token,expires_at,refresh_expires_at,granted_scopes,updated_at",
    )
    .eq("provider", "tiktok")
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? null) as StoredTikTokConnectionRow | null;

  if (!row) {
    return null;
  }

  return {
    provider: "tiktok",
    status: row.status,
    openId: row.open_id ?? null,
    accessToken: row.access_token ?? null,
    refreshToken: row.refresh_token ?? null,
    expiresAt: row.expires_at ?? null,
    refreshExpiresAt: row.refresh_expires_at ?? null,
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes : [],
    updatedAt: row.updated_at ?? null,
  };
}

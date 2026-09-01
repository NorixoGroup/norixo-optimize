import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type StoredLinkedInConnectionStatus = "connected" | "error";

export type PersistLinkedInConnectionInput = {
  workspaceId: string;
  provider: "linkedin";
  status: StoredLinkedInConnectionStatus;
  accessToken: string | null;
  expiresAt: string | null;
  organizationUrn: string | null;
  organizationId: string | null;
  grantedScopes: string[];
  lastConnectedByUserId: string | null;
  lastConnectedByEmail: string | null;
};

export type LinkedInConnectionStatusView = {
  provider: "linkedin";
  connected: boolean;
  status: "not_connected" | StoredLinkedInConnectionStatus;
  organization: {
    urn: string;
    id: string | null;
  } | null;
  grantedScopes: string[];
  expiresAt: string | null;
  updatedAt: string | null;
};

type StoredLinkedInConnectionRow = {
  workspace_id: string | null;
  provider: "linkedin";
  status: StoredLinkedInConnectionStatus;
  access_token?: string | null;
  expires_at: string | null;
  organization_urn: string | null;
  organization_id: string | null;
  granted_scopes: string[] | null;
  updated_at: string;
  created_at?: string;
};

export type LinkedInConnectionPublishRecord = {
  provider: "linkedin";
  status: StoredLinkedInConnectionStatus;
  accessToken: string | null;
  expiresAt: string | null;
  organizationUrn: string | null;
  organizationId: string | null;
  grantedScopes: string[];
  updatedAt: string | null;
};

function requireWorkspaceId(workspaceId: string) {
  const value = workspaceId.trim();
  if (!value) throw new Error("workspaceId is required.");
  return value;
}

export async function persistLinkedInConnection(input: PersistLinkedInConnectionInput) {
  const admin = createSupabaseAdminClient();
  const workspaceId = requireWorkspaceId(input.workspaceId);

  const { error } = await admin
    .from("marketing_studio_linkedin_connections")
    .upsert(
      {
        workspace_id: workspaceId,
        provider: input.provider,
        status: input.status,
        access_token: input.accessToken,
        expires_at: input.expiresAt,
        organization_urn: input.organizationUrn,
        organization_id: input.organizationId,
        granted_scopes: input.grantedScopes,
        last_connected_by_user_id: input.lastConnectedByUserId,
        last_connected_by_email: input.lastConnectedByEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,workspace_id" },
    );

  if (error) {
    throw error;
  }
}

export async function readLinkedInConnectionStatus(workspaceId: string): Promise<LinkedInConnectionStatusView> {
  const admin = createSupabaseAdminClient();
  const scopedWorkspaceId = requireWorkspaceId(workspaceId);
  const { data, error } = await admin
    .from("marketing_studio_linkedin_connections")
    .select(
      "provider,status,expires_at,organization_urn,organization_id,granted_scopes,updated_at",
    )
    .eq("provider", "linkedin")
    .eq("workspace_id", scopedWorkspaceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? null) as StoredLinkedInConnectionRow | null;

  if (!row) {
    return {
      provider: "linkedin",
      connected: false,
      status: "not_connected",
      organization: null,
      grantedScopes: [],
      expiresAt: null,
      updatedAt: null,
    };
  }

  return {
    provider: "linkedin",
    connected:
      row.status === "connected" &&
      Boolean(row.organization_urn && row.organization_urn.trim()),
    status: row.status,
    organization: row.organization_urn
      ? {
          urn: row.organization_urn,
          id: row.organization_id ?? null,
        }
      : null,
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes : [],
    expiresAt: row.expires_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function readLinkedInConnectionForPublish(workspaceId: string): Promise<LinkedInConnectionPublishRecord | null> {
  const admin = createSupabaseAdminClient();
  const scopedWorkspaceId = requireWorkspaceId(workspaceId);
  const { data, error } = await admin
    .from("marketing_studio_linkedin_connections")
    .select(
      "provider,status,access_token,expires_at,organization_urn,organization_id,granted_scopes,updated_at",
    )
    .eq("provider", "linkedin")
    .eq("workspace_id", scopedWorkspaceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? null) as StoredLinkedInConnectionRow | null;

  if (!row) {
    return null;
  }

  return {
    provider: "linkedin",
    status: row.status,
    accessToken: row.access_token ?? null,
    expiresAt: row.expires_at ?? null,
    organizationUrn: row.organization_urn ?? null,
    organizationId: row.organization_id ?? null,
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes : [],
    updatedAt: row.updated_at ?? null,
  };
}

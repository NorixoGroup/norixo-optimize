import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  decryptLinkedInAccessToken,
  encryptLinkedInAccessToken,
  isLinkedInEncryptedCredentialUsable,
  type EncryptedLinkedInAccessToken,
} from "./linkedinTokenCrypto";

export type StoredLinkedInConnectionStatus =
  | "connected"
  | "error"
  | "reconnect_required"
  | "disconnected";

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
  access_token_ciphertext: string | null;
  access_token_iv: string | null;
  access_token_auth_tag: string | null;
  access_token_key_version: string | null;
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

export function isLinkedInConnectionExpired(
  expiresAt: string | null,
  now = new Date(),
) {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= now.getTime();
}

export function resolveLinkedInConnectionLifecycle(input: {
  status: StoredLinkedInConnectionStatus;
  expiresAt: string | null;
  credentialComplete: boolean;
  credentialDecryptable: boolean;
  now?: Date;
}): StoredLinkedInConnectionStatus {
  if (input.status === "disconnected" || input.status === "reconnect_required") {
    return input.status;
  }

  if (
    isLinkedInConnectionExpired(input.expiresAt, input.now) ||
    !input.credentialComplete ||
    !input.credentialDecryptable
  ) {
    return "reconnect_required";
  }

  return input.status;
}

function encryptedCredentialFromRow(
  row: Pick<
    StoredLinkedInConnectionRow,
    | "access_token_ciphertext"
    | "access_token_iv"
    | "access_token_auth_tag"
    | "access_token_key_version"
  >,
): EncryptedLinkedInAccessToken | null {
  if (
    !row.access_token_ciphertext ||
    !row.access_token_iv ||
    !row.access_token_auth_tag ||
    !row.access_token_key_version
  ) {
    return null;
  }

  return {
    ciphertext: row.access_token_ciphertext,
    iv: row.access_token_iv,
    authTag: row.access_token_auth_tag,
    keyVersion: row.access_token_key_version,
  };
}

export function decryptStoredLinkedInAccessToken(
  row: Pick<
    StoredLinkedInConnectionRow,
    | "access_token_ciphertext"
    | "access_token_iv"
    | "access_token_auth_tag"
    | "access_token_key_version"
  >,
): string | null {
  const credential = encryptedCredentialFromRow(row);
  if (!credential) {
    return null;
  }

  try {
    return decryptLinkedInAccessToken(credential);
  } catch {
    return null;
  }
}

export function buildLinkedInConnectionCredentialPatch(accessToken: string | null) {
  const encrypted = accessToken ? encryptLinkedInAccessToken(accessToken) : null;

  return {
    access_token: null,
    access_token_ciphertext: encrypted?.ciphertext ?? null,
    access_token_iv: encrypted?.iv ?? null,
    access_token_auth_tag: encrypted?.authTag ?? null,
    access_token_key_version: encrypted?.keyVersion ?? null,
  };
}

export function buildLinkedInConnectionInvalidationPatch() {
  return {
    status: "reconnect_required" as const,
    ...buildLinkedInConnectionCredentialPatch(null),
  };
}

export async function markLinkedInConnectionReconnectRequired(workspaceId: string) {
  const admin = createSupabaseAdminClient();
  const normalizedWorkspaceId = requireWorkspaceId(workspaceId);
  const { error } = await admin
    .from("marketing_studio_linkedin_connections")
    .update({
      ...buildLinkedInConnectionInvalidationPatch(),
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "linkedin")
    .eq("workspace_id", normalizedWorkspaceId)
    .in("status", ["connected", "error"]);

  if (error) {
    throw error;
  }
}

export async function disconnectLinkedInConnection(workspaceId: string) {
  const admin = createSupabaseAdminClient();
  const scopedWorkspaceId = requireWorkspaceId(workspaceId);
  const { error } = await admin
    .from("marketing_studio_linkedin_connections")
    .upsert(
      {
        workspace_id: scopedWorkspaceId,
        provider: "linkedin",
        status: "disconnected",
        ...buildLinkedInConnectionCredentialPatch(null),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,workspace_id" },
    );

  if (error) {
    throw error;
  }
}

export async function persistLinkedInConnection(input: PersistLinkedInConnectionInput) {
  const admin = createSupabaseAdminClient();
  const workspaceId = requireWorkspaceId(input.workspaceId);
  const credential = buildLinkedInConnectionCredentialPatch(input.accessToken);

  const { error } = await admin
    .from("marketing_studio_linkedin_connections")
    .upsert(
      {
        workspace_id: workspaceId,
        provider: input.provider,
        status: input.status,
        ...credential,
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
      "provider,status,access_token_ciphertext,access_token_iv,access_token_auth_tag,access_token_key_version,expires_at,organization_urn,organization_id,granted_scopes,updated_at",
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

  const credential = encryptedCredentialFromRow(row);
  const accessToken =
    row.status === "disconnected" ? null : decryptStoredLinkedInAccessToken(row);
  const status = resolveLinkedInConnectionLifecycle({
    status: row.status,
    expiresAt: row.expires_at ?? null,
    credentialComplete: credential !== null,
    credentialDecryptable: Boolean(accessToken),
  });

  if (status === "reconnect_required" && row.status !== status) {
    await markLinkedInConnectionReconnectRequired(scopedWorkspaceId);
  }

  return {
    provider: "linkedin",
    connected:
      status === "connected" &&
      Boolean(row.organization_urn && row.organization_urn.trim()) &&
      Boolean(accessToken) &&
      isLinkedInEncryptedCredentialUsable(credential),
    status,
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
      "provider,status,access_token_ciphertext,access_token_iv,access_token_auth_tag,access_token_key_version,expires_at,organization_urn,organization_id,granted_scopes,updated_at",
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

  const credential = encryptedCredentialFromRow(row);
  const accessToken =
    row.status === "disconnected" ? null : decryptStoredLinkedInAccessToken(row);
  const status = resolveLinkedInConnectionLifecycle({
    status: row.status,
    expiresAt: row.expires_at ?? null,
    credentialComplete: credential !== null,
    credentialDecryptable: Boolean(accessToken),
  });

  if (status === "reconnect_required" && row.status !== status) {
    await markLinkedInConnectionReconnectRequired(scopedWorkspaceId);
  }

  return {
    provider: "linkedin",
    status,
    accessToken: status === "connected" ? accessToken : null,
    expiresAt: row.expires_at ?? null,
    organizationUrn: row.organization_urn ?? null,
    organizationId: row.organization_id ?? null,
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes : [],
    updatedAt: row.updated_at ?? null,
  };
}

import { createHmac, timingSafeEqual } from "node:crypto";

export const LINKEDIN_MARKETING_STUDIO_SCOPES = [
  "w_organization_social",
] as const;

export type LinkedInOAuthConfig = {
  clientId: string;
  redirectUri: string;
  apiVersion: string;
  organizationUrn?: string;
};

export type LinkedInOAuthServerConfig = LinkedInOAuthConfig & {
  clientSecret: string;
};

export type LinkedInOAuthEnvValidation =
  | {
      ok: true;
      config: LinkedInOAuthConfig;
    }
  | {
      ok: false;
      missing: string[];
    };

export type LinkedInOAuthServerEnvValidation =
  | {
      ok: true;
      config: LinkedInOAuthServerConfig;
    }
  | {
      ok: false;
      missing: string[];
    };

export const LINKEDIN_OAUTH_STATE_COOKIE_NAME =
  "marketing_studio_linkedin_oauth_state";
export const LINKEDIN_OAUTH_FLOW_COOKIE_NAME =
  "marketing_studio_linkedin_oauth_flow";
export const LINKEDIN_OAUTH_FLOW_COOKIE_VALUE =
  "admin_company_page_only";
export const LINKEDIN_OAUTH_ACTOR_COOKIE_NAME = "marketing_studio_linkedin_oauth_actor";

export type LinkedInOAuthActor = {
  userId: string;
  email: string | null;
};

function normalizeLinkedInApiVersion(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/[^0-9]/g, "");
}

function normalizeLinkedInOrganizationUrn(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("urn:li:organization:") ? trimmed : "";
}

export function readLinkedInOAuthEnv(
  env: NodeJS.ProcessEnv = process.env,
): LinkedInOAuthEnvValidation {
  const clientId = env.LINKEDIN_CLIENT_ID?.trim() ?? "";
  const redirectUri = env.LINKEDIN_REDIRECT_URI?.trim() ?? "";
  const apiVersion = normalizeLinkedInApiVersion(
    env.LINKEDIN_API_VERSION?.trim() ?? "",
  );
  const organizationUrn = normalizeLinkedInOrganizationUrn(
    env.LINKEDIN_ORGANIZATION_URN?.trim() ?? "",
  );
  const missing = [
    !clientId ? "LINKEDIN_CLIENT_ID" : null,
    !redirectUri ? "LINKEDIN_REDIRECT_URI" : null,
    !apiVersion ? "LINKEDIN_API_VERSION" : null,
  ].filter((value): value is string => value !== null);

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
    };
  }

  return {
    ok: true,
    config: {
      clientId,
      redirectUri,
      apiVersion,
      organizationUrn: organizationUrn || undefined,
    },
  };
}

export function readLinkedInOAuthServerEnv(
  env: NodeJS.ProcessEnv = process.env,
): LinkedInOAuthServerEnvValidation {
  const baseValidation = readLinkedInOAuthEnv(env);
  const clientSecret = env.LINKEDIN_CLIENT_SECRET?.trim() ?? "";

  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (!clientSecret) {
    return {
      ok: false,
      missing: ["LINKEDIN_CLIENT_SECRET"],
    };
  }

  return {
    ok: true,
    config: {
      ...baseValidation.config,
      clientSecret,
    },
  };
}

export type LinkedInOAuthStateBinding = {
  userId: string;
  workspaceId: string;
};

type LinkedInOAuthStatePayload = LinkedInOAuthStateBinding & {
  nonce: string;
  ts: number;
  intent: "marketing_studio_linkedin_company_page";
  signature: string;
};

function signLinkedInOAuthState(value: Omit<LinkedInOAuthStatePayload, "signature">, signingSecret: string) {
  return createHmac("sha256", signingSecret).update(JSON.stringify(value)).digest("base64url");
}

export function createLinkedInOAuthState(binding: LinkedInOAuthStateBinding, signingSecret: string) {
  const payload = { nonce: crypto.randomUUID(), ts: Date.now(), intent: "marketing_studio_linkedin_company_page" as const, userId: binding.userId.trim(), workspaceId: binding.workspaceId.trim() };
  if (!payload.userId || !payload.workspaceId || !signingSecret.trim()) throw new Error("LinkedIn OAuth state binding is required.");
  return Buffer.from(JSON.stringify({ ...payload, signature: signLinkedInOAuthState(payload, signingSecret) })).toString("base64url");
}

export function parseLinkedInOAuthState(value: string, signingSecret: string): LinkedInOAuthStateBinding | null {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<LinkedInOAuthStatePayload>;
    if (typeof parsed.nonce !== "string" || !parsed.nonce.trim() || typeof parsed.ts !== "number" || !Number.isFinite(parsed.ts) || Date.now() - parsed.ts > 10 * 60 * 1000 || parsed.intent !== "marketing_studio_linkedin_company_page" || typeof parsed.userId !== "string" || !parsed.userId.trim() || typeof parsed.workspaceId !== "string" || !parsed.workspaceId.trim() || typeof parsed.signature !== "string" || !signingSecret.trim()) return null;
    const payload = { nonce: parsed.nonce, ts: parsed.ts, intent: parsed.intent, userId: parsed.userId.trim(), workspaceId: parsed.workspaceId.trim() };
    const expected = signLinkedInOAuthState(payload, signingSecret);
    if (expected.length !== parsed.signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.signature))) return null;
    return { userId: payload.userId, workspaceId: payload.workspaceId };
  } catch {
    return null;
  }
}

export function buildLinkedInOAuthLoginUrl(
  config: LinkedInOAuthConfig,
  state: string,
) {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", LINKEDIN_MARKETING_STUDIO_SCOPES.join(" "));
  url.searchParams.set("state", state);

  return url;
}

export function serializeLinkedInOAuthActor(actor: LinkedInOAuthActor) {
  return Buffer.from(JSON.stringify(actor)).toString("base64url");
}

export function parseLinkedInOAuthActor(
  value: string,
): LinkedInOAuthActor | null {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Record<string, unknown>;

    if (typeof parsed.userId !== "string" || !parsed.userId.trim()) {
      return null;
    }

    return {
      userId: parsed.userId.trim(),
      email:
        typeof parsed.email === "string" && parsed.email.trim()
          ? parsed.email.trim()
          : null,
    };
  } catch {
    return null;
  }
}

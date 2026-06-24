export const META_READ_ONLY_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
] as const;

export type MetaOAuthConfig = {
  appId: string;
  redirectUri: string;
  graphApiVersion: string;
};

export type MetaOAuthServerConfig = MetaOAuthConfig & {
  appSecret: string;
};

export type MetaOAuthEnvValidation =
  | {
      ok: true;
      config: MetaOAuthConfig;
    }
  | {
      ok: false;
      missing: string[];
    };

export type MetaOAuthServerEnvValidation =
  | {
      ok: true;
      config: MetaOAuthServerConfig;
    }
  | {
      ok: false;
      missing: string[];
    };

export const META_OAUTH_STATE_COOKIE_NAME =
  "marketing_studio_meta_oauth_state";
export const META_OAUTH_FLOW_COOKIE_NAME =
  "marketing_studio_meta_oauth_flow";
export const META_OAUTH_FLOW_COOKIE_VALUE =
  "admin_read_only";

function normalizeGraphApiVersion(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

export function readMetaOAuthEnv(
  env: NodeJS.ProcessEnv = process.env,
): MetaOAuthEnvValidation {
  const appId = env.META_APP_ID?.trim() ?? "";
  const redirectUri = env.META_REDIRECT_URI?.trim() ?? "";
  const graphApiVersion = normalizeGraphApiVersion(
    env.META_GRAPH_API_VERSION?.trim() ?? "",
  );
  const missing = [
    !appId ? "META_APP_ID" : null,
    !redirectUri ? "META_REDIRECT_URI" : null,
    !graphApiVersion ? "META_GRAPH_API_VERSION" : null,
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
      appId,
      redirectUri,
      graphApiVersion,
    },
  };
}

export function readMetaOAuthServerEnv(
  env: NodeJS.ProcessEnv = process.env,
): MetaOAuthServerEnvValidation {
  const baseValidation = readMetaOAuthEnv(env);
  const appSecret = env.META_APP_SECRET?.trim() ?? "";

  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (!appSecret) {
    return {
      ok: false,
      missing: ["META_APP_SECRET"],
    };
  }

  return {
    ok: true,
    config: {
      ...baseValidation.config,
      appSecret,
    },
  };
}

export function createMetaOAuthState() {
  return Buffer.from(
    JSON.stringify({
      nonce: crypto.randomUUID(),
      ts: Date.now(),
      intent: "marketing_studio_meta_read_only",
    }),
  ).toString("base64url");
}

export function isMetaOAuthState(value: string) {
  if (!value.trim()) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Record<string, unknown>;

    return (
      typeof parsed.nonce === "string" &&
      parsed.nonce.trim().length > 0 &&
      typeof parsed.ts === "number" &&
      Number.isFinite(parsed.ts) &&
      parsed.intent === "marketing_studio_meta_read_only"
    );
  } catch {
    return false;
  }
}

export function buildMetaOAuthLoginUrl(
  config: MetaOAuthConfig,
  state: string,
) {
  const url = new URL(
    `https://www.facebook.com/${config.graphApiVersion}/dialog/oauth`,
  );

  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", META_READ_ONLY_SCOPES.join(","));
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");

  return url;
}

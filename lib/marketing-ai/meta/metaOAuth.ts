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

export type MetaOAuthEnvValidation =
  | {
      ok: true;
      config: MetaOAuthConfig;
    }
  | {
      ok: false;
      missing: string[];
    };

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

export function createMetaOAuthState() {
  return Buffer.from(
    JSON.stringify({
      nonce: crypto.randomUUID(),
      ts: Date.now(),
      intent: "marketing_studio_meta_read_only",
    }),
  ).toString("base64url");
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

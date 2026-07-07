export const TIKTOK_MARKETING_STUDIO_SCOPES = ["video.upload"] as const;

export type TikTokOAuthConfig = {
  clientKey: string;
  redirectUri: string;
};

export type TikTokOAuthServerConfig = TikTokOAuthConfig & {
  clientSecret: string;
};

export type TikTokOAuthEnvValidation =
  | {
      ok: true;
      config: TikTokOAuthConfig;
    }
  | {
      ok: false;
      missing: string[];
    };

export type TikTokOAuthServerEnvValidation =
  | {
      ok: true;
      config: TikTokOAuthServerConfig;
    }
  | {
      ok: false;
      missing: string[];
    };

export const TIKTOK_OAUTH_STATE_COOKIE_NAME =
  "marketing_studio_tiktok_oauth_state";
export const TIKTOK_OAUTH_FLOW_COOKIE_NAME =
  "marketing_studio_tiktok_oauth_flow";
export const TIKTOK_OAUTH_FLOW_COOKIE_VALUE = "admin_upload_only";
export const TIKTOK_OAUTH_ACTOR_COOKIE_NAME =
  "marketing_studio_tiktok_oauth_actor";

export type TikTokOAuthActor = {
  userId: string;
  email: string | null;
};

export function readTikTokOAuthEnv(
  env: NodeJS.ProcessEnv = process.env,
): TikTokOAuthEnvValidation {
  const clientKey = env.TIKTOK_CLIENT_KEY?.trim() ?? "";
  const redirectUri = env.TIKTOK_REDIRECT_URI?.trim() ?? "";
  const missing = [
    !clientKey ? "TIKTOK_CLIENT_KEY" : null,
    !redirectUri ? "TIKTOK_REDIRECT_URI" : null,
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
      clientKey,
      redirectUri,
    },
  };
}

export function readTikTokOAuthServerEnv(
  env: NodeJS.ProcessEnv = process.env,
): TikTokOAuthServerEnvValidation {
  const baseValidation = readTikTokOAuthEnv(env);
  const clientSecret = env.TIKTOK_CLIENT_SECRET?.trim() ?? "";

  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (!clientSecret) {
    return {
      ok: false,
      missing: ["TIKTOK_CLIENT_SECRET"],
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

export function createTikTokOAuthState() {
  return Buffer.from(
    JSON.stringify({
      nonce: crypto.randomUUID(),
      ts: Date.now(),
      intent: "marketing_studio_tiktok_upload",
    }),
  ).toString("base64url");
}

export function isTikTokOAuthState(value: string) {
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
      parsed.intent === "marketing_studio_tiktok_upload"
    );
  } catch {
    return false;
  }
}

export function buildTikTokOAuthLoginUrl(
  config: TikTokOAuthConfig,
  state: string,
) {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");

  url.searchParams.set("client_key", config.clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TIKTOK_MARKETING_STUDIO_SCOPES.join(","));
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);

  return url;
}

export function serializeTikTokOAuthActor(actor: TikTokOAuthActor) {
  return Buffer.from(JSON.stringify(actor)).toString("base64url");
}

export function parseTikTokOAuthActor(value: string): TikTokOAuthActor | null {
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

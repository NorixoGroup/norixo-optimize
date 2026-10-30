// Configuration du pont local vers le YouTube Agent. Lit uniquement deux noms de
// variables d'environnement ; aucune valeur n'est jamais journalisée ni renvoyée.

export const AGENT_URL_ENV = "YOUTUBE_AGENT_URL";
export const AGENT_TOKEN_ENV = "YOUTUBE_AGENT_BRIDGE_TOKEN";
export const DEFAULT_AGENT_ORIGIN = "http://127.0.0.1:4177";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);
const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{32,200}$/;

export type BridgeConfigOk = { ok: true; origin: string; token: string; urlFromDefault: boolean };
export type BridgeConfig =
  | BridgeConfigOk
  | { ok: false; kind: "not_configured"; missing: string[] }
  | { ok: false; kind: "invalid_config"; reason: "url_not_loopback" | "url_invalid" | "token_format" };

type Env = Record<string, string | undefined>;

// Le pont n'est joignable qu'en loopback : tout autre hôte est refusé (anti-SSRF).
export function parseAgentOrigin(raw: string): { ok: true; origin: string } | { ok: false; reason: "url_not_loopback" | "url_invalid" } {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "url_invalid" };
  }

  if (url.protocol !== "http:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !url.port) {
    return { ok: false, reason: "url_invalid" };
  }

  if (!LOOPBACK_HOSTS.has(url.hostname)) return { ok: false, reason: "url_not_loopback" };

  return { ok: true, origin: url.origin };
}

export function resolveBridgeConfig(env: Env = process.env): BridgeConfig {
  const token = env[AGENT_TOKEN_ENV]?.trim();

  if (!token) return { ok: false, kind: "not_configured", missing: [AGENT_TOKEN_ENV] };
  if (!TOKEN_PATTERN.test(token)) return { ok: false, kind: "invalid_config", reason: "token_format" };

  const rawUrl = env[AGENT_URL_ENV]?.trim();
  const parsed = parseAgentOrigin(rawUrl || DEFAULT_AGENT_ORIGIN);

  if (!parsed.ok) return { ok: false, kind: "invalid_config", reason: parsed.reason };

  return { ok: true, origin: parsed.origin, token, urlFromDefault: !rawUrl };
}

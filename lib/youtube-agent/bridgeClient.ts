// Client du pont local : GET en loopback uniquement, jeton en en-tête, aucune
// redirection, délai court, classification précise des échecs.

import type { BridgeConfigOk } from "./bridgeConfig";
import { BRIDGE_CONTRACT, BRIDGE_VIEWS, type BridgeFailure, type BridgeView } from "./types";

export type BridgeRoute = BridgeView | "health" | "youtube_login";

export type BridgeSuccess<T> = { ok: true; data: T; generatedAt: string; channelId: string | null; latencyMs: number };
export type BridgeResult<T> = BridgeSuccess<T> | { ok: false; failure: BridgeFailure };

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export const BRIDGE_TIMEOUT_MS = 3000;

const ALLOWED_ROUTES: ReadonlySet<string> = new Set<string>([...BRIDGE_VIEWS, "health", "youtube_login"]);

function failure(kind: BridgeFailure["kind"], message: string, extra: Partial<BridgeFailure> = {}): { ok: false; failure: BridgeFailure } {
  return { ok: false, failure: { kind, message, ...extra } };
}

function networkFailure(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const raw = (error as { cause?: { code?: string; errors?: Array<{ code?: string }> } } | null)?.cause;
  const cause = raw?.code ?? raw?.errors?.find((e) => typeof e?.code === "string")?.code;

  if (name === "TimeoutError" || name === "AbortError") {
    return failure("timeout", "L'agent n'a pas répondu dans le délai imparti.", { code: "TIMEOUT" });
  }

  return failure("unreachable", "Impossible de joindre l'agent sur l'adresse configurée.", { code: typeof cause === "string" ? cause : "NETWORK" });
}

export async function bridgeRequest<T>(
  config: BridgeConfigOk,
  route: BridgeRoute,
  options: { query?: Record<string, string>; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<BridgeResult<T>> {
  if (!ALLOWED_ROUTES.has(route)) return failure("agent_error", "Route inconnue.");

  const url = new URL(`/api/v1/${route}`, config.origin);

  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);

  const headers: Record<string, string> = { accept: "application/json" };

  // La route de santé n'a pas besoin du jeton : on ne l'envoie pas.
  if (route !== "health") headers["x-agent-bridge-token"] = config.token;

  const started = Date.now();
  let response: Response;

  try {
    response = await (options.fetchImpl ?? (fetch as FetchLike))(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? BRIDGE_TIMEOUT_MS),
    });
  } catch (error) {
    return networkFailure(error);
  }

  let body: Record<string, unknown>;

  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    return failure("bad_response", "La réponse de l'agent n'est pas du JSON valide.", { httpStatus: response.status });
  }

  const code = typeof body?.error === "string" ? body.error : undefined;
  const status = response.status;

  if (status === 401) return failure("unauthorized", "Le jeton du pont est absent ou refusé par l'agent.", { httpStatus: status, code });
  if (status === 503 && code === "bridge_disabled") return failure("bridge_disabled", "L'agent est en ligne mais son pont est désactivé (aucun jeton valide fourni à l'agent).", { httpStatus: status, code });
  if (status === 403 && code === "host_not_allowed") return failure("host_rejected", "L'agent refuse l'adresse utilisée (Host).", { httpStatus: status, code });
  if (status === 403 && code === "origin_not_allowed") return failure("origin_rejected", "L'agent a reçu un en-tête Origin, interdit sur le pont.", { httpStatus: status, code });
  if (status === 404) return failure("contract_mismatch", "Route absente côté agent : version incompatible.", { httpStatus: status, code });
  if (status >= 400) return failure("agent_error", "L'agent a renvoyé une erreur.", { httpStatus: status, code });

  if (body?.schema !== BRIDGE_CONTRACT || body?.ok !== true) {
    return failure("contract_mismatch", "Le contrat de réponse de l'agent est inattendu.", { httpStatus: status });
  }

  return {
    ok: true,
    data: (route === "health" ? body : body.data) as T,
    generatedAt: typeof body.generated_at === "string" ? body.generated_at : "",
    channelId: typeof body.channel_id === "string" ? body.channel_id : null,
    latencyMs: Date.now() - started,
  };
}

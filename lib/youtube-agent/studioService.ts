// Orchestration côté serveur du Nomad Studio : valide les paramètres, interroge le
// pont (loopback) et renvoie un résultat prêt pour l'interface. L'accès admin est
// vérifié par la route AVANT d'appeler ce service. Aucun moteur n'est appelé ici.

import { bridgeRequest, type FetchLike } from "./bridgeClient";
import { runDiagnostics } from "./diagnostics";
import {
  BRIDGE_VIEWS,
  type BridgeView,
  type OverviewResponse,
  type SectionResult,
  type ViewDataMap,
} from "./types";

type Env = Record<string, string | undefined>;

export const STUDIO_VIEWS = ["overview", "diagnostics", "youtube_login", ...BRIDGE_VIEWS] as const;
export type StudioView = (typeof STUDIO_VIEWS)[number];

const PRODUCTION_PATTERN = /^prod-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{6}$/;

export type StudioResult = { status: number; body: unknown };

export function isStudioView(value: string): value is StudioView {
  return (STUDIO_VIEWS as readonly string[]).includes(value);
}

function parseParams(params: URLSearchParams): { ok: true; query: Record<string, string> } | { ok: false; error: string } {
  // Une seule chaîne : aucun paramètre de chaîne n'est accepté.
  if (params.has("channel")) return { ok: false, error: "unsupported_parameter" };

  const query: Record<string, string> = {};
  const productionId = params.get("production_id");

  if (productionId !== null) {
    if (!PRODUCTION_PATTERN.test(productionId)) return { ok: false, error: "invalid_production_id" };

    query.production_id = productionId;
  }

  if (params.get("include_tests") === "1") query.include_tests = "1";

  const limit = params.get("limit");

  if (limit !== null) {
    const n = Number(limit);

    if (!Number.isInteger(n) || n < 1 || n > 200) return { ok: false, error: "invalid_limit" };

    query.limit = String(n);
  }

  return { ok: true, query };
}

export async function handleStudioRequest(input: {
  view: string;
  params: URLSearchParams;
  env?: Env;
  fetchImpl?: FetchLike;
  now?: Date;
}): Promise<StudioResult> {
  if (!isStudioView(input.view)) return { status: 404, body: { error: "unknown_view" } };

  const parsed = parseParams(input.params);

  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };

  const diag = await runDiagnostics({ env: input.env, fetchImpl: input.fetchImpl, now: input.now });

  if (input.view === "diagnostics") return { status: 200, body: { diagnostics: diag.report } };

  if (!diag.config || diag.report.overall === "blocked") {
    return { status: 200, body: { connected: false, diagnostics: diag.report } satisfies OverviewResponse };
  }

  const config = diag.config;
  const fetchImpl = input.fetchImpl;

  // Connexion Google : l'URL construite par l'agent est relayée telle quelle.
  if (input.view === "youtube_login") {
    const result = await bridgeRequest<{ authorizeUrl: string }>(config, "youtube_login", { fetchImpl });

    return { status: 200, body: { connected: true, result: result.ok ? { ok: true, data: result.data } : { ok: false, failure: result.failure } } };
  }

  const load = async <V extends BridgeView>(view: V): Promise<SectionResult<ViewDataMap[V]>> => {
    const result = await bridgeRequest<ViewDataMap[V]>(config, view, { query: parsed.query, fetchImpl });

    return result.ok ? { ok: true, data: result.data } : { ok: false, failure: result.failure };
  };

  if (input.view !== "overview") {
    return { status: 200, body: { connected: true, result: await load(input.view) } };
  }

  const entries = await Promise.all(BRIDGE_VIEWS.map(async (view) => [view, await load(view)] as const));
  const sections = Object.fromEntries(entries) as Extract<OverviewResponse, { connected: true }>["sections"];

  return { status: 200, body: { connected: true, diagnostics: diag.report, sections } satisfies OverviewResponse };
}

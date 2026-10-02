// Smoke de Nomad Studio (Norixo) : configuration du pont, client, diagnostic,
// service, et garde-fous statiques. Aucun réseau : fetch est injecté.
// Usage : npx tsx scripts/nomad-studio-smoke.ts

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { resolveBridgeConfig, AGENT_TOKEN_ENV, AGENT_URL_ENV, type BridgeConfigOk } from "../lib/youtube-agent/bridgeConfig";
import { bridgeRequest, type FetchLike } from "../lib/youtube-agent/bridgeClient";
import { runDiagnostics } from "../lib/youtube-agent/diagnostics";
import { handleStudioRequest } from "../lib/youtube-agent/studioService";
import { BRIDGE_CONTRACT, BRIDGE_VIEWS, type PlannerEntry, type SettingsData } from "../lib/youtube-agent/types";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyTechnicalFilter, deriveCurrentActivity, remainingApprovals, stagesRemaining, isTechnicalProduction, type Connected } from "../app/(default)/dashboard/nomad-studio/studioState";
import { stepNarrative } from "../app/(default)/dashboard/nomad-studio/diagnosticCopy";
import { NomadStudioView } from "../app/(default)/dashboard/nomad-studio/components/NomadStudioView";
import type { OverviewResponse } from "../lib/youtube-agent/types";

const TOKEN = "smoke-token-0123456789abcdef0123456789abcdef";
const ENV = { [AGENT_TOKEN_ENV]: TOKEN, [AGENT_URL_ENV]: "http://127.0.0.1:4177" };
const NOW = new Date("2026-06-01T10:00:00Z");
let checks = 0;

function ok(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve(fn()).then(() => {
    checks += 1;
  }).catch((error) => {
    console.error(`ECHEC : ${name}\n  ${(error as Error).message}`);
    process.exit(1);
  });
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const envelope = (route: string, data: unknown) => ({ schema: BRIDGE_CONTRACT, ok: true, route, channel_id: "nomade", generated_at: NOW.toISOString(), data });

const SYSTEM = {
  agent: { name: "youtube-agent", phase: "R18.3" },
  channel_id: "nomade",
  data: { channel_dir_exists: true },
  productions: { in_pipeline: 4, readable: 4, inspected: 4 },
  registry: { linked: 1, updated_at: null },
  journal: { last_ts: null },
  engines: { existing: 8, planned: 7, undecided: 1, external_actions_require_approval: 8 },
  integrations: { youtube_api: "not_connected", oauth: "not_connected", network: "loopback_only" },
  safety: { auto_reply: false, human_validation_required: true, engines_executable: 0 },
};

type Call = { url: string; init: RequestInit };

function healthy(calls: Call[] = [], overrides: Record<string, () => Response> = {}): FetchLike {
  return async (url, init) => {
    calls.push({ url, init });
    const route = new URL(url).pathname.replace("/api/v1/", "");

    if (overrides[route]) return overrides[route]();
    if (route === "health") return json(200, { schema: BRIDGE_CONTRACT, ok: true, service: "youtube-agent", bridge_enabled: true, auth_required: true });
    if (route === "system") return json(200, envelope("system", SYSTEM));

    return json(200, envelope(route, { stub: route }));
  };
}

const config = resolveBridgeConfig(ENV) as BridgeConfigOk;

async function main() {
  await ok("configuration : variables manquantes ou invalides", () => {
    assert.deepEqual(resolveBridgeConfig({}), { ok: false, kind: "not_configured", missing: [AGENT_TOKEN_ENV] });
    assert.equal(resolveBridgeConfig({ [AGENT_TOKEN_ENV]: "court" }).ok, false);
    for (const bad of ["http://evil.example:4177", "http://10.0.0.1:4177", "http://127.0.0.1.evil.com:4177", "http://0.0.0.0:4177", "http://[::1]:4177"]) {
      const r = resolveBridgeConfig({ ...ENV, [AGENT_URL_ENV]: bad });
      assert.equal(r.ok, false, bad);
      assert.ok(!r.ok && r.kind === "invalid_config", bad);
    }
    for (const bad of ["https://127.0.0.1:4177", "http://127.0.0.1", "http://127.0.0.1:4177/api", "http://u:p@127.0.0.1:4177", "http://127.0.0.1:4177/?x=1", "nimporte"]) {
      assert.equal(resolveBridgeConfig({ ...ENV, [AGENT_URL_ENV]: bad }).ok, false, bad);
    }
  });

  await ok("configuration : valeurs acceptées (défaut et localhost)", () => {
    const def = resolveBridgeConfig({ [AGENT_TOKEN_ENV]: TOKEN });
    assert.ok(def.ok && def.origin === "http://127.0.0.1:4177" && def.urlFromDefault);
    const local = resolveBridgeConfig({ ...ENV, [AGENT_URL_ENV]: "http://localhost:5000" });
    assert.ok(local.ok && local.origin === "http://localhost:5000" && !local.urlFromDefault);
  });

  await ok("client : requête GET sans redirection, jeton en en-tête, jamais dans l'URL ; santé sans jeton", async () => {
    const calls: Call[] = [];
    const f = healthy(calls);
    const r = await bridgeRequest(config, "system", { fetchImpl: f, query: { channel: "nomade" } });
    assert.ok(r.ok);
    const h = await bridgeRequest(config, "health", { fetchImpl: f });
    assert.ok(h.ok);
    assert.equal(calls[0].init.method, "GET");
    assert.equal(calls[0].init.redirect, "error");
    assert.equal((calls[0].init.headers as Record<string, string>)["x-agent-bridge-token"], TOKEN);
    assert.ok(!calls[0].url.includes(TOKEN));
    assert.equal(new URL(calls[0].url).origin, "http://127.0.0.1:4177");
    assert.equal((calls[1].init.headers as Record<string, string>)["x-agent-bridge-token"], undefined);
    const bad = await bridgeRequest(config, "../etc" as never, { fetchImpl: f });
    assert.ok(!bad.ok);
    assert.equal(calls.length, 2);
  });

  await ok("client : classification précise des échecs", async () => {
    const run = (res: () => Response | Promise<Response>) => bridgeRequest(config, "system", { fetchImpl: async () => res() });
    const kind = async (res: () => Response | Promise<Response>) => { const r = await run(res); return r.ok ? "ok" : r.failure.kind; };
    assert.equal(await kind(() => json(401, { error: "token_invalid" })), "unauthorized");
    assert.equal(await kind(() => json(503, { error: "bridge_disabled" })), "bridge_disabled");
    assert.equal(await kind(() => json(403, { error: "host_not_allowed" })), "host_rejected");
    assert.equal(await kind(() => json(403, { error: "origin_not_allowed" })), "origin_rejected");
    assert.equal(await kind(() => json(404, { error: "not_found" })), "contract_mismatch");
    assert.equal(await kind(() => json(500, { error: "internal_error" })), "agent_error");
    assert.equal(await kind(() => new Response("<html>", { status: 200 })), "bad_response");
    assert.equal(await kind(() => json(200, { schema: "autre", ok: true })), "contract_mismatch");
    const refused = await bridgeRequest(config, "system", { fetchImpl: async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }); } });
    assert.ok(!refused.ok && refused.failure.kind === "unreachable" && refused.failure.code === "ECONNREFUSED");
    const timeout = await bridgeRequest(config, "system", { fetchImpl: async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); } });
    assert.ok(!timeout.ok && timeout.failure.kind === "timeout");
  });

  await ok("diagnostic : chaque cause désigne la bonne étape bloquante, sept étapes ordonnées", async () => {
    const blocking = async (env: Record<string, string>, f: FetchLike) => (await runDiagnostics({ env, fetchImpl: f, now: NOW })).report;
    const none = await blocking({}, healthy());
    assert.equal(none.blocking_step, "configuration");
    assert.equal(none.overall, "blocked");
    assert.deepEqual(none.steps.map((s) => s.id), ["environment", "configuration", "reachability", "bridge", "authentication", "contract", "data"]);
    assert.equal(none.steps[2].status, "skipped");

    const down = await blocking(ENV, async () => { throw Object.assign(new TypeError("x"), { cause: { code: "ECONNREFUSED" } }); });
    assert.equal(down.blocking_step, "reachability");
    assert.match(down.steps[2].hint ?? "", /npm run youtube-agent/);

    const off = await blocking(ENV, healthy([], { health: () => json(200, { schema: BRIDGE_CONTRACT, ok: true, bridge_enabled: false }) }));
    assert.equal(off.blocking_step, "bridge");

    const denied = await blocking(ENV, healthy([], { system: () => json(401, { error: "token_invalid" }) }));
    assert.equal(denied.blocking_step, "authentication");

    const old = await blocking(ENV, healthy([], { system: () => json(404, { error: "not_found" }) }));
    assert.equal(old.blocking_step, "contract");
  });

  await ok("diagnostic : prêt, dégradé (aucune production / Vercel), aucun secret divulgué", async () => {
    const ready = (await runDiagnostics({ env: ENV, fetchImpl: healthy(), now: NOW })).report;
    assert.equal(ready.overall, "ready");
    assert.equal(ready.blocking_step, null);

    const empty = healthy([], { system: () => json(200, envelope("system", { ...SYSTEM, productions: { in_pipeline: 0, readable: 0, inspected: 0 } })) });
    assert.equal((await runDiagnostics({ env: ENV, fetchImpl: empty, now: NOW })).report.overall, "degraded");

    const vercel = (await runDiagnostics({ env: { ...ENV, VERCEL: "1" }, fetchImpl: healthy(), now: NOW })).report;
    assert.equal(vercel.steps[0].status, "warn");

    for (const env of [ENV, {}, { [AGENT_TOKEN_ENV]: TOKEN, [AGENT_URL_ENV]: "http://evil.example:80" }]) {
      const out = JSON.stringify((await runDiagnostics({ env, fetchImpl: healthy(), now: NOW })).report);
      assert.ok(!out.includes(TOKEN), "jeton divulgué");
    }
  });

  await ok("service : paramètres validés avant tout appel, vues inconnues refusées", async () => {
    const calls: Call[] = [];
    const f = healthy(calls);
    const call = (view: string, qs = "") => handleStudioRequest({ view, params: new URLSearchParams(qs), env: ENV, fetchImpl: f, now: NOW });
    assert.equal((await call("nimporte")).status, 404);
    for (const q of ["channel=nomade", "channel=../x", "channel=BAD", "channel="]) {
      const r = await call("overview", q);
      assert.equal(r.status, 400, q);
      assert.deepEqual(r.body, { error: "unsupported_parameter" });
    }
    assert.equal((await call("pipeline", "production_id=../../x")).status, 400);
    assert.equal((await call("journal", "limit=9999")).status, 400);
    assert.equal(calls.length, 0, "appel réseau avant validation");
  });

  await ok("service : bloqué → connected=false ; prêt → neuf sections ; paramètres transmis ; échec partiel isolé", async () => {
    const blocked = await handleStudioRequest({ view: "overview", params: new URLSearchParams(), env: {}, fetchImpl: healthy(), now: NOW });
    assert.equal((blocked.body as { connected: boolean }).connected, false);

    const calls: Call[] = [];
    const partial = healthy(calls, { comments: () => json(500, { error: "internal_error" }) });
    const res = await handleStudioRequest({ view: "overview", params: new URLSearchParams("include_tests=1"), env: ENV, fetchImpl: partial, now: NOW });
    const body = res.body as { connected: boolean; sections: Record<string, { ok: boolean }> };
    assert.equal(body.connected, true);
    assert.deepEqual(Object.keys(body.sections).sort(), [...BRIDGE_VIEWS].sort());
    assert.equal(body.sections.comments.ok, false);
    assert.equal(body.sections.productions.ok, true);
    const productionsCall = calls.find((c) => c.url.includes("/api/v1/productions"));
    assert.ok(productionsCall && productionsCall.url.includes("include_tests=1"));
    for (const c of calls) {
      assert.equal(new URL(c.url).hostname, "127.0.0.1");
      assert.ok(!c.url.includes("channel"), "paramètre de chaîne transmis au pont");
    }

    const single = await handleStudioRequest({ view: "planner", params: new URLSearchParams(), env: ENV, fetchImpl: healthy(), now: NOW });
    assert.equal((single.body as { result: { ok: boolean } }).result.ok, true);
  });

  const read = (p: string) => fs.readFile(path.join(process.cwd(), p), "utf8");
  const walk = async (dir: string): Promise<string[]> => (await fs.readdir(path.join(process.cwd(), dir), { withFileTypes: true }).then((es) => Promise.all(es.map(async (e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))))).flat();

  const studioFiles = [
    ...(await walk("lib/youtube-agent")),
    ...(await walk("app/(default)/dashboard/nomad-studio")),
    ...(await walk("app/api/admin/youtube-agent")),
  ];

  await ok("route : accès admin vérifié avant tout appel au pont, GET seulement", async () => {
    const route = await read("app/api/admin/youtube-agent/[view]/route.ts");
    assert.ok(route.indexOf("isAdminPrivateEmail(user.email)") !== -1);
    assert.ok(route.indexOf("isAdminPrivateEmail(user.email)") < route.indexOf("handleStudioRequest({"), "garde après l'appel");
    assert.match(route, /status: 401/);
    assert.match(route, /status: 403/);
    assert.ok(!/export async function (POST|PUT|PATCH|DELETE)/.test(route));
    assert.ok(!/supabase-admin|createSupabaseAdminClient/.test(route));
  });

  await ok("périmètre : YouTube uniquement, aucune API Google/YouTube, aucun autre réseau", async () => {
    for (const file of studioFiles) {
      const src = await read(file);
      assert.ok(!/tiktok|instagram|facebook|linkedin|pinterest|threads\.net|twitter|\bx\.com/i.test(src), `${file} : autre réseau`);
      assert.ok(!/googleapis|youtube\.com|accounts\.google|oauth2/i.test(src), `${file} : API Google/YouTube`);
      assert.ok(!/dangerouslySetInnerHTML/.test(src), `${file} : HTML brut`);
      assert.ok(!/stripe|@\/lib\/backlinks|@\/lib\/audits|supabase-admin/i.test(src), `${file} : module hors périmètre`);
    }
  });

  await ok("réseau : seul bridgeClient fait un fetch serveur ; l'UI n'appelle que les routes admin", async () => {
    for (const file of studioFiles) {
      const src = await read(file);
      const fetches = src.match(/\bfetch\s*\(/g)?.length ?? 0;
      if (file.endsWith("lib/youtube-agent/bridgeClient.ts")) continue;
      if (file.endsWith("nomad-studio/useNomadStudio.ts")) {
        assert.equal(fetches, 2);
        assert.ok(/\/api\/admin\/youtube-agent/.test(src) && /\/api\/admin\/me/.test(src));
        continue;
      }
      assert.equal(fetches, 0, `${file} : fetch inattendu`);
      if (file.includes("nomad-studio/")) assert.ok(!/127\.0\.0\.1|localhost|4177/.test(src), `${file} : adresse de l'agent codée en dur`);
    }
    for (const file of studioFiles.filter((f) => f.includes("lib/youtube-agent") && f !== "lib/youtube-agent/bridgeConfig.ts")) {
      assert.ok(!/127\.0\.0\.1|localhost/.test(await read(file)) || file.includes("diagnostics"), `${file} : adresse codée en dur`);
    }
  });

  await ok("façade : imports limités à Norixo ; aucun accès au code ou aux moteurs de l'agent", async () => {
    const allowed = [/^react$/, /^lucide-react$/, /^next\//, /^node:/, /^@\/lib\/youtube-agent\//, /^@\/lib\/supabase\/sharedAuth$/, /^@\/lib\/auth\/isAdminEmail$/, /^@\/lib\/server\/routeAuth$/, /^\.\.?\//];
    for (const file of studioFiles) {
      const src = await read(file);
      for (const m of src.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
        assert.ok(allowed.some((re) => re.test(m[1])), `${file} : import non prévu ${m[1]}`);
        assert.ok(!/usine-ia-video|Les-Decouvertes/.test(m[1]), `${file} : import du dépôt agent`);
      }
      assert.ok(!/\/Users\/|Desktop\//.test(src), `${file} : chemin local codé en dur`);
    }
  });

  await ok("commentaires : Valider / Modifier / Ignorer inactifs mais focalisables, raison visible", async () => {
    const board = await read("app/(default)/dashboard/nomad-studio/components/CommentsBoard.tsx");
    const copy = await read("app/(default)/dashboard/nomad-studio/copy.ts");
    assert.match(board, /aria-disabled=\{!enabled \|\| undefined\}/);
    assert.ok(!/(?<![-\w])disabled=\{/.test(board), "bouton réellement disabled");
    assert.match(board, /aria-describedby=\{!enabled \? NOTE_ID/);
    assert.match(board, /COPY\.comments\.actions\.map/);
    for (const label of ["Valider", "Modifier", "Ignorer"]) assert.ok(copy.includes(`"${label}"`), label);
    assert.match(copy, /Aucune réponse automatique/);
    assert.match(copy, /Validation humaine obligatoire/);
    for (const col of ["En attente", "Prioritaires", "Vérification", "Réponses proposées", "Validation", "Terminés"]) assert.ok(copy.includes(`"${col}"`), col);
  });

  await ok("navigation : une seule entrée admin ajoutée, sans toucher aux autres", async () => {
    const shell = await read("components/DashboardShell.tsx");
    assert.equal(shell.split('"/dashboard/nomad-studio"').length - 1, 1);
    assert.ok(!/YouTube Studio|"\/dashboard\/youtube"/.test(shell));
    const block = shell.slice(shell.indexOf("...(isPlatformAdmin"), shell.indexOf(": []", shell.indexOf("...(isPlatformAdmin")));
    for (const label of ["copy.nav.admin", '"Backlinks"', '"Norixo AI"', "🎬 Nomad Studio"]) assert.ok(block.includes(label), label);
    assert.ok(block.indexOf('"Norixo AI"') < block.indexOf("Nomad Studio"));
  });

  const STUDIO = "app/(default)/dashboard/nomad-studio";

  await ok("structure : les composants demandés existent, plus la composition partagée", async () => {
    const names = ["Hero", "SystemStatusCard", "PipelineCard", "ProductionsBoard", "CommentsBoard", "AnalyticsBoard", "PlannerBoard", "LearningBoard", "JournalBoard", "SettingsBoard", "DiagnosticScreen", "CurrentActivityCard", "ResourceUsageCard", "NomadStudioView"];
    for (const n of names) assert.ok((await read(`${STUDIO}/components/${n}.tsx`)).includes(`export function ${n}`), n);
    await assert.rejects(fs.access(path.join(process.cwd(), "app/(default)/dashboard/youtube")), "ancien dossier encore présent");
  });

  await ok("textes imposés : hero, état du système, pipeline, analytiques, apprentissage, planificateur, diagnostic", async () => {
    const copy = await read(`${STUDIO}/copy.ts`);
    const must = [
      "Votre usine de production vidéo par IA",
      "Pilotez l'ensemble de votre chaîne de production vidéo depuis une seule interface.",
      "Nouvelle production", "Relancer la production", "Lancer le diagnostic", "Actualiser les données", "Voir le journal",
      "État du système", "Épisode en cours", "Activité en cours", "Utilisation des ressources", "Dernière synchronisation", "État général",
      "Recherche", "Ressources", "Voix", "Montage", "Contrôle qualité", "Publication",
      "Prévues", "Publiées", "Date prévue", "Durée", "Miniature",
      "Analytiques", "En attente de connexion", "Apprentissage",
      "Éléments de preuve", "Évolution des prompts", "Planificateur", "Fin estimée", "Validations restantes", "Prochaine vidéo", "Blocages",
      "Lecture seule", "Canal", "Sécurité",
      "Nomad Studio indisponible", "Nomad Studio nécessite que l'Usine IA Vidéo soit démarrée sur cet ordinateur.", "Relancer le diagnostic",
      "Pont local", "Authentification", "Configuration", "Afficher les productions techniques",
    ];
    for (const t of must) assert.ok(copy.includes(t), `texte manquant : ${t}`);
    assert.match(copy, /ok: "OK", warn: "Attention", fail: "Erreur", skipped: "Non vérifié"/);
    assert.ok(!/Waiting for connection|YouTube Studio/.test(copy));
  });

  await ok("accessibilité statique : focus visible, actions inactives focalisables, zones tactiles, aucun gris trop clair", async () => {
    const styles = await read(`${STUDIO}/components/shared/styles.ts`);
    assert.match(styles, /focus-visible:ring-2/);
    assert.match(styles, /min-h-\[44px\]/);
    const hero = await read(`${STUDIO}/components/Hero.tsx`);
    assert.match(hero, /aria-disabled=\{inactive \|\| undefined\}/);
    assert.match(hero, /aria-describedby=\{inactive \? NOTE_ID/);
    assert.match(hero, /aria-labelledby="nomad-title"/);
    assert.match(hero, /min-w-0 px-4 py-3/);
    assert.ok(!/(?<![-\w])disabled=\{/.test(hero), "action du hero réellement disabled");
    for (const file of studioFiles.filter((f) => f.includes("nomad-studio/") && /\.(tsx|ts)$/.test(f))) {
      const src = await read(file);
      assert.ok(!/text-slate-(300|400)\b/.test(src), `${file} : gris sous AA`);
    }
  });

  await ok("filtre « productions techniques » : essais et exécutions échouées non liées masqués, épisodes liés conservés", () => {
    const item = (over: Record<string, unknown>) => ({ id: "x", title: "t", type: "real", pipeline_status: "running", linked: false, bucket: "planned", locked: false, ...over });
    assert.equal(isTechnicalProduction(item({ type: "test" }) as never), true);
    assert.equal(isTechnicalProduction(item({ pipeline_status: "failed" }) as never), true);
    assert.equal(isTechnicalProduction(item({ pipeline_status: "failed", linked: true }) as never), false);
    assert.equal(isTechnicalProduction(item({}) as never), false);

    const c = {
      sections: {
        productions: { ok: true, data: { items: [item({ id: "A", pipeline_status: "failed" }), item({ id: "B", bucket: "in_progress" }), item({ id: "C", type: "test" })], counts: { planned: 2, in_progress: 1, published: 0, archived: 0 }, totals: { in_pipeline: 9, shown: 3, hidden_tests: 4, truncated: false }, thumbnails: "not_available" } },
        planner: { ok: true, data: { next: { production_id: "A", blockers: [] }, queue: [{ production_id: "B", blockers: [] }], priority: "not_defined" } },
        pipeline: { ok: true, data: { production: { id: "A", title: "t", workflow_state: "idea" }, stages: [], progress_percent: 40 } },
      },
    } as unknown as Connected;
    const off = applyTechnicalFilter(c, false);
    const prod = off.connected.sections.productions as { ok: true; data: { items: Array<{ id: string }>; counts: Record<string, number> } };
    assert.deepEqual(prod.data.items.map((i) => i.id), ["B"]);
    assert.equal(prod.data.counts.planned, 0);
    assert.equal(prod.data.counts.in_progress, 1);
    assert.equal(off.hidden, 2 + 4);
    const planner = off.connected.sections.planner as { ok: true; data: { next: { production_id: string } | null; queue: unknown[] } };
    assert.equal(planner.data.next?.production_id, "B");
    assert.equal(planner.data.queue.length, 0);
    const pipeline = off.connected.sections.pipeline as { ok: true; data: { production: unknown; progress_percent: number } };
    assert.equal(pipeline.data.production, null);
    assert.equal(pipeline.data.progress_percent, 0);
    const on = applyTechnicalFilter(c, true);
    assert.equal(on.connected, c);
    assert.equal(on.hidden, 0);
  });

  const TEXT_OF = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");
  const ENGLISH = /\b(Waiting|connection|Pending|Priority|Planner|Settings|Learning|Analytics|Comments|Current|Resource|Usage|Overall|Last|Next|Refresh|Retry|Read-only|available|Run|Done|Validated|Applied|Evidence|Episode|Thumbnail|Duration|Target|Unavailable|Connected|Disabled|Running|Failed|Estimated|Remaining|Blockers|Queue|Details?|Cause probable ?:? ?the)\b/;
  const noop = () => undefined;
  const view = (overview: OverviewResponse | null, showTechnical = false) => TEXT_OF(renderToStaticMarkup(React.createElement(NomadStudioView, { overview, loading: false, error: null, showTechnical, onToggleTechnical: noop, onReload: noop })));

  const stage = (key: string, status: string) => ({ key, label: key, engine: key, status, tone: "grey", percent: status === "done" ? 100 : null });
  const connectedFixture = async (): Promise<OverviewResponse> => {
    const diag = (await runDiagnostics({ env: ENV, fetchImpl: healthy(), now: NOW })).report;
    const prodItem = (over: Record<string, unknown>) => ({ id: "prod-2026-05-01T10-00-00-000Z-aaaaaa", title: "Épisode Sahara", type: "real", mode: "full", pipeline_status: "running", workflow_state: "in_production", bucket: "in_progress", progress_percent: 43, video_id: "dQw4w9WgXcQ", target_date: "2026-07-01", linked: true, locked: true, thumbnail: null, ...over });
    return {
      connected: true,
      diagnostics: diag,
      sections: {
        system: { ok: true, data: SYSTEM },
        productions: { ok: true, data: { items: [prodItem({}), prodItem({ id: "prod-2026-05-02T10-00-00-000Z-bbbbbb", title: "Essai technique", linked: false, type: "test", bucket: "planned", workflow_state: "idea", progress_percent: 0 })], counts: { planned: 1, in_progress: 1, published: 0, archived: 0 }, totals: { in_pipeline: 524, shown: 2, hidden_tests: 3, truncated: true }, thumbnails: "not_available" } },
        pipeline: { ok: true, data: { production: { id: "prod-2026-05-01T10-00-00-000Z-aaaaaa", title: "Épisode Sahara", workflow_state: "in_production" }, stages: ["research", "script", "storyboard", "assets", "voice", "assembly", "quality", "publication"].map((k, i) => stage(k, i < 2 ? "done" : i === 2 ? "running" : k === "publication" ? "not_connected" : "pending")), progress_percent: 29 } },
        planner: { ok: true, data: { next: { production_id: "prod-2026-05-01T10-00-00-000Z-aaaaaa", title: "Épisode Sahara", deadline: "2026-07-01", workflow_state: "in_production", bucket: "in_progress", progress_percent: 29, recommendation: { next_engine: "visual", action: "wait", reason: "x", requires_approval: false }, blockers: [{ code: "locked", label: "FR brut du bridge" }, { code: "stage_failed", label: "x" }, { code: "approval_required", label: "x" }, { code: "no_target_date", label: "x" }] }, queue: [], priority: "not_defined" } },
        comments: { ok: true, data: { columns: ["new", "priority", "fact_check", "proposed", "human_review", "published"].map((k) => ({ key: k, label: k, items: k === "proposed" ? [{ ref: "r1", video_id: "dQw4w9WgXcQ", type: "question", priority_score: 82, author_label: "Auteur ab12cd", excerpt: "Super épisode", proposal_text: "Merci !", state: "proposed" }] : [] })), ingestion: "not_connected", untrusted_text: true, auto_reply: false, human_validation_required: true, actions: { enabled: false, reason: "ingestion_unavailable", available: ["validate", "edit", "ignore"] } } },
        analytics: { ok: true, data: { source: "not_connected", reason: "youtube_api_not_connected", cards: [], top_videos: { status: "not_connected", items: [] }, worst_videos: { status: "not_connected", items: [] } } },
        learning: { ok: true, data: { read_only: true, observations: [{ id: "1", ts: NOW.toISOString(), text: "Les intros courtes retiennent mieux" }], validated_learnings: [], prompt_updates: [], knowledge: { status: "empty", documents: 0 } } },
        journal: { ok: true, data: { entries: [
          { ts: NOW.toISOString(), type: "workflow_transition", action: "idea->in_production", engine: "workflow", subject_id: "prod-2026-05-01T10-00-00-000Z-aaaaaa", outcome: "applied", actor: "human_approved", validation: "approved" },
          { ts: NOW.toISOString(), type: "video_linked", action: "link_video", engine: "agent", subject_id: null, outcome: "real", actor: "agent_recorded", validation: "none" },
          { ts: NOW.toISOString(), type: "workflow_refused", action: "to:published", engine: "workflow", subject_id: null, outcome: "approval_missing", actor: "agent_recorded", validation: "none" },
          { ts: NOW.toISOString(), type: "execute_refused", action: "execute", engine: "research", subject_id: null, outcome: "not_executable_in_r18_2", actor: "agent_recorded", validation: "none" },
        ] } },
        settings: { ok: true, data: { read_only: true, channel: { id: "nomade" }, language: "fr", project: { name: "Les Découvertes du Nomade" }, writing_style: { status: "not_defined" }, narration_voice: { kind: "elevenlabs", model_id: "eleven_multilingual_v2", voice_id: "voiceXYZ" }, workflow: { transitions: 15, approval_required_on: ["idea→in_production", "ready_to_publish→published"] }, comments: { human_validation_required: true, auto_reply: false, ingestion: "not_connected" }, publication: { status: "not_connected", approval_required: true } } },
      },
    } as unknown as OverviewResponse;
  };

  await ok("rendu connecté : 100 % français, aucune URL interne, aucun port, aucune valeur parasite", async () => {
    const ov = await connectedFixture();

    for (const showTechnical of [false, true]) {
      const text = view(ov, showTechnical);
      assert.ok(text.length > 1500, "page trop courte");
      assert.ok(!ENGLISH.test(text), `anglais détecté : ${text.match(ENGLISH)?.[0]}`);
      assert.ok(!/127\.0\.0\.1|localhost|https?:\/\/|:\d{4}\b/.test(text), `URL interne : ${text.match(/127\.0\.0\.1|localhost|https?:\/\/\S*|:\d{4}\b/)?.[0]}`);
      assert.ok(!/undefined|NaN|\[object Object\]|FR brut du bridge/.test(text), "valeur parasite ou texte brut du bridge");
      assert.ok(!/\bnomade\b/.test(text), "identifiant interne de chaîne affiché à l'utilisateur");
      for (const must of ["Nomad Studio", "Votre usine de production vidéo par IA", "État du système", "Épisode en cours", "Activité en cours", "Utilisation des ressources", "En attente de connexion", "Contrôle qualité", "Évolution des prompts", "Fin estimée", "Validations restantes", "Afficher les productions techniques", "Valider", "Modifier", "Ignorer", "Lecture seule", "Transition : Idée → En production", "Vidéo liée à une production"]) {
        assert.ok(text.includes(must), `texte absent : ${must}`);
      }
    }
    const off = view(ov, false);
    const on = view(ov, true);
    assert.ok(!off.includes("Essai technique"), "production technique visible par défaut");
    assert.ok(off.includes("(4 masquées)"), "compteur de productions techniques masquées");
    assert.ok(!on.includes("masquées"), "compteur affiché alors que les productions techniques sont visibles");
  });

  await ok("rendu bloqué : chaque scénario est en français, sans URL ni port, avec cause et action", async () => {
    const scenarios: Array<[string, Record<string, string>, FetchLike]> = [
      ["jeton absent", {}, healthy()],
      ["jeton invalide", { [AGENT_TOKEN_ENV]: "court" }, healthy()],
      ["adresse non locale", { ...ENV, [AGENT_URL_ENV]: "http://example.com:4177" }, healthy()],
      ["adresse mal formée", { ...ENV, [AGENT_URL_ENV]: "http://127.0.0.1" }, healthy()],
      ["agent arrêté", ENV, async () => { throw Object.assign(new TypeError("x"), { cause: { code: "ECONNREFUSED" } }); }],
      ["délai dépassé", ENV, async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }],
      ["pont désactivé", ENV, healthy([], { health: () => json(200, { schema: BRIDGE_CONTRACT, ok: true, bridge_enabled: false }) })],
      ["mauvais jeton", ENV, healthy([], { system: () => json(401, { error: "token_invalid" }) })],
      ["hôte refusé", ENV, healthy([], { health: () => json(403, { error: "host_not_allowed" }) })],
      ["version incompatible", ENV, healthy([], { system: () => json(404, { error: "not_found" }) })],
      ["erreur de l'agent", ENV, healthy([], { system: () => json(500, { error: "internal_error" }) })],
      ["Vercel", { ...ENV, VERCEL: "1" }, async () => { throw Object.assign(new TypeError("x"), { cause: { code: "ECONNREFUSED" } }); }],
    ];

    for (const [name, env, f] of scenarios) {
      const { report } = await runDiagnostics({ env, fetchImpl: f, now: NOW });
      assert.equal(report.overall, "blocked", name);
      const text = view({ connected: false, diagnostics: report });
      assert.ok(text.includes("Nomad Studio indisponible") && text.includes("Relancer le diagnostic"), `${name} : écran`);
      assert.ok(text.includes("Cause probable") && text.includes("Action corrective"), `${name} : cause/action`);
      assert.ok(!ENGLISH.test(text), `${name} : anglais « ${text.match(ENGLISH)?.[0]} »`);
      assert.ok(!/127\.0\.0\.1|localhost|https?:\/\/|:\d{4}\b|\.env|YOUTUBE_AGENT/.test(text), `${name} : URL interne ou identifiant technique`);
      assert.ok(!text.includes("Cause non identifiée"), `${name} : cause non traduite`);
      assert.ok(!text.includes(TOKEN), `${name} : jeton`);
      const blocking = report.steps.find((st) => st.id === report.blocking_step);
      const n = stepNarrative(blocking);
      assert.ok(n.cause && n.action && !/[A-Za-z]{4,} (the|is|are|not) /.test(`${n.cause} ${n.action}`), `${name} : traduction`);
    }
  });

  await ok("traductions du diagnostic : toutes les causes et actions du service ont un équivalent français", async () => {
    const src = await read("lib/youtube-agent/diagnostics.ts");
    const strings = [...src.matchAll(/(?:cause|action): ("(?:[^"\\]|\\.)*"|`[^`]*`)/g)].map((m) => m[1].slice(1, -1));
    assert.ok(strings.length >= 25, `trop peu de chaînes trouvées (${strings.length})`);
    for (const raw of strings) {
      const kind = /cause: /.test(src.slice(src.indexOf(raw) - 8, src.indexOf(raw))) ? "cause" : "action";
      const step = { id: "reachability", label: "x", status: "fail", detail: "d", [kind]: raw.replace(/\$\{[^}]+\}/g, "X") } as never;
      const n = stepNarrative(step);
      assert.ok(kind === "cause" ? n.cause !== "Cause non identifiée." : !n.action?.startsWith("Relancez le diagnostic ; si"), `non traduit : ${raw}`);
    }
  });

  await ok("diagnostic : chaque cause racine fournit une cause et une action corrective", async () => {
    const scenarios: Array<[string, Record<string, string>, FetchLike]> = [
      ["configuration", {}, healthy()],
      ["reachability", ENV, async () => { throw Object.assign(new TypeError("x"), { cause: { code: "ECONNREFUSED" } }); }],
      ["bridge", ENV, healthy([], { health: () => json(200, { schema: BRIDGE_CONTRACT, ok: true, bridge_enabled: false }) })],
      ["authentication", ENV, healthy([], { system: () => json(401, { error: "token_invalid" }) })],
      ["contract", ENV, healthy([], { system: () => json(404, { error: "not_found" }) })],
    ];
    for (const [id, env, f] of scenarios) {
      const report = (await runDiagnostics({ env, fetchImpl: f, now: NOW })).report;
      const blocking = report.steps.find((st) => st.id === id);
      assert.equal(report.blocking_step, id);
      assert.ok(blocking?.cause && blocking.cause.length > 20, `${id} : cause manquante`);
      assert.ok(blocking?.action && blocking.action.length > 20, `${id} : action manquante`);
      assert.ok(!/[àâéèêîôùç]/i.test(`${blocking?.cause}${blocking?.action}`), `${id} : texte non anglais`);
      assert.ok(!(blocking?.cause + (blocking?.action ?? "")).includes(TOKEN), "jeton divulgué");
    }
  });

  await ok("dérivations : approbations restantes, étapes restantes, activité courante", () => {
    const settings = { workflow: { transitions: 15, approval_required_on: ["idea→in_production", "paused→in_production", "failed→in_production", "ready_to_publish→published"] } } as unknown as SettingsData;
    const entry = (workflow_state: string, progress_percent: number) => ({ workflow_state, progress_percent }) as unknown as PlannerEntry;
    assert.equal(remainingApprovals(entry("idea", 0), settings), 2);
    assert.equal(remainingApprovals(entry("failed", 14), settings), 2);
    assert.equal(remainingApprovals(entry("in_production", 50), settings), 1);
    assert.equal(remainingApprovals(entry("ready_to_publish", 100), settings), 1);
    assert.equal(remainingApprovals(entry("published", 100), settings), 0);
    assert.equal(remainingApprovals(entry("idea", 0), null), null);
    assert.equal(remainingApprovals(entry("idea", 0), { workflow: { transitions: 0, approval_required_on: [] } } as unknown as SettingsData), 0);
    assert.equal(stagesRemaining(entry("idea", 0)), 7);
    assert.equal(stagesRemaining(entry("idea", 14)), 6);
    assert.equal(stagesRemaining(entry("idea", 100)), 0);

    const base = (over: Record<string, unknown>) => ({ sections: { pipeline: { ok: true, data: { production: { title: "Ep" }, stages: [] } }, productions: { ok: true, data: { items: [] } }, journal: { ok: true, data: { entries: [] } }, ...over } }) as unknown as Connected;
    assert.equal(deriveCurrentActivity(base({})).kind, "idle");
    assert.equal(deriveCurrentActivity(base({ pipeline: { ok: true, data: { production: { title: "Ep" }, stages: [{ status: "running", label: "Voice" }] } } })).kind, "running");
    assert.equal(deriveCurrentActivity(base({ productions: { ok: true, data: { items: [{ locked: true, title: "Ep" }] } } })).kind, "locked");
    assert.equal(deriveCurrentActivity(base({ journal: { ok: true, data: { entries: [{ action: "link_video", ts: "2026-01-01T00:00:00Z" }] } } })).kind, "last_action");
  });

  console.log(`nomad-studio-smoke — ${checks} vérifications OK, aucun appel réseau réel`);
}

void main();

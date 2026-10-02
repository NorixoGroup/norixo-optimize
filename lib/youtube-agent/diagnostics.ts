// Diagnostic de connexion au YouTube Agent : sept étapes ordonnées, chacune avec
// un état, un constat et une piste de correction. Aucune valeur secrète n'y figure.

import { AGENT_TOKEN_ENV, AGENT_URL_ENV, resolveBridgeConfig, type BridgeConfigOk } from "./bridgeConfig";
import { bridgeRequest, type FetchLike } from "./bridgeClient";
import type { BridgeFailure, DiagnosticReport, DiagnosticStep, SystemData } from "./types";

type Env = Record<string, string | undefined>;
type StepId = DiagnosticStep["id"];

const LABELS: Record<StepId, string> = {
  environment: "Environnement d'exécution",
  configuration: "Configuration du pont",
  reachability: "Agent joignable",
  bridge: "Pont activé côté agent",
  authentication: "Authentification",
  contract: "Contrat de version",
  data: "Données de l'agent",
};

const ORDER: StepId[] = ["environment", "configuration", "reachability", "bridge", "authentication", "contract", "data"];
const START_HINT = `Lancez l'agent avec un jeton : ${AGENT_TOKEN_ENV}=<votre_jeton> npm run youtube-agent (dans usine-ia-video).`;

export type DiagnosticOutcome = {
  report: DiagnosticReport;
  config: BridgeConfigOk | null;
  system: SystemData | null;
};

type Guidance = { cause: string; action: string };

function step(id: StepId, status: DiagnosticStep["status"], detail: string, hint?: string, guidance?: Guidance): DiagnosticStep {
  return { id, label: LABELS[id], status, detail, ...(hint ? { hint } : {}), ...(guidance ?? {}) };
}

const START_ACTION = `Start the agent: ${AGENT_TOKEN_ENV}=<token> npm run youtube-agent (in usine-ia-video).`;

function finalize(steps: DiagnosticStep[], endpoint: string | null, latency: number | null, now: Date): DiagnosticReport {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const ordered = ORDER.map((id) => byId.get(id) ?? step(id, "skipped", "Non vérifié : une étape précédente a échoué."));
  const blocking = ordered.find((s) => s.status === "fail") ?? null;
  const degraded = ordered.some((s) => s.status === "warn");

  return {
    overall: blocking ? "blocked" : degraded ? "degraded" : "ready",
    summary: blocking
      ? `Connexion impossible : ${blocking.label.toLowerCase()}.`
      : degraded
        ? "Connecté, avec des points d'attention."
        : "Connecté : le pont local répond correctement.",
    blocking_step: blocking?.id ?? null,
    steps: ordered,
    endpoint,
    latency_ms: latency,
    checked_at: now.toISOString(),
  };
}

function describeFailure(failure: BridgeFailure): { id: StepId; detail: string; hint: string; guidance: Guidance } {
  switch (failure.kind) {
    case "unreachable":
      return { id: "reachability", detail: `Aucune réponse sur l'adresse configurée${failure.code ? ` (${failure.code})` : ""}.`, hint: START_HINT, guidance: { cause: "Nothing is listening at the configured address: the AI Video Factory agent is not running.", action: START_ACTION } };
    case "timeout":
      return { id: "reachability", detail: "L'agent n'a pas répondu dans les 3 secondes.", hint: "Vérifiez que l'agent n'est pas bloqué, puis relancez-le.", guidance: { cause: "The agent did not answer within 3 seconds.", action: "Check that the agent process is not stuck, then restart it." } };
    case "host_rejected":
    case "origin_rejected":
      return { id: "reachability", detail: failure.message, hint: `Utilisez exactement http://127.0.0.1:<port> dans ${AGENT_URL_ENV}.`, guidance: { cause: "The agent rejected the address Norixo used to reach it.", action: `Set ${AGENT_URL_ENV} to exactly http://127.0.0.1:<port>.` } };
    case "bridge_disabled":
      return { id: "bridge", detail: failure.message, hint: START_HINT, guidance: { cause: "The agent is running but its bridge is disabled: it was started without a valid token.", action: `Restart the agent with ${AGENT_TOKEN_ENV} set (32 characters or more).` } };
    case "unauthorized":
      return { id: "authentication", detail: failure.message, hint: `Le jeton de Norixo (${AGENT_TOKEN_ENV}) doit être identique à celui fourni à l'agent.`, guidance: { cause: "The agent refused Norixo's token: the two values are different.", action: `Make ${AGENT_TOKEN_ENV} identical in Norixo's .env.local and in the agent's launch command, then restart both.` } };
    case "contract_mismatch":
    case "bad_response":
      return { id: "contract", detail: failure.message, hint: "Mettez à jour l'agent (usine-ia-video) vers la version du pont attendue par Norixo.", guidance: { cause: "The agent answers with a different bridge version than Norixo expects.", action: "Update usine-ia-video to the version that provides bridge v1, then restart the agent." } };
    default:
      return { id: "data", detail: failure.message, hint: "Consultez la console de l'agent pour le détail.", guidance: { cause: "The agent returned an unexpected error while reading its data.", action: "Open the agent's console for the error detail, fix it, then run the diagnostics again." } };
  }
}

export async function runDiagnostics(options: { env?: Env; fetchImpl?: FetchLike; now?: Date } = {}): Promise<DiagnosticOutcome> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const steps: DiagnosticStep[] = [];

  steps.push(
    env.VERCEL === "1"
      ? step("environment", "warn", "Norixo s'exécute sur Vercel : le pont local (127.0.0.1) n'est pas joignable depuis ce serveur.", "Le Nomad Studio fonctionne en local : lancez Norixo avec « next dev » sur la machine qui exécute l'agent.", { cause: "Norixo is deployed on Vercel, where the local bridge (127.0.0.1) cannot be reached.", action: "Run Norixo locally with `next dev` on the machine that runs the agent." })
      : step("environment", "ok", "Norixo s'exécute localement."),
  );

  const config = resolveBridgeConfig(env);

  if (!config.ok) {
    steps.push(
      config.kind === "not_configured"
        ? step("configuration", "fail", `Variable manquante : ${config.missing.join(", ")}.`, `Ajoutez ${AGENT_TOKEN_ENV} dans le .env.local de Norixo (même valeur que pour l'agent), puis redémarrez Norixo. ${AGENT_URL_ENV} est facultative (défaut : http://127.0.0.1:4177).`, { cause: "The bridge token is not set in Norixo's environment.", action: `Add ${AGENT_TOKEN_ENV} to Norixo's .env.local (same value as the agent), then restart Norixo. ${AGENT_URL_ENV} is optional (default: http://127.0.0.1:4177).` })
        : step("configuration", "fail", config.reason === "token_format" ? "Le jeton configuré a un format invalide (32 à 200 caractères : lettres, chiffres, . _ ~ -)." : config.reason === "url_not_loopback" ? "L'adresse de l'agent n'est pas une adresse locale : seuls 127.0.0.1 et localhost sont autorisés." : "L'adresse de l'agent est invalide (attendu : http://127.0.0.1:<port>).", `Corrigez ${config.reason === "token_format" ? AGENT_TOKEN_ENV : AGENT_URL_ENV} dans .env.local.`, config.reason === "token_format" ? { cause: "The configured bridge token has an invalid format.", action: `Use 32 to 200 characters (letters, digits, . _ ~ -) in ${AGENT_TOKEN_ENV}.` } : config.reason === "url_not_loopback" ? { cause: "The agent URL is not a local address: only 127.0.0.1 and localhost are allowed.", action: `Set ${AGENT_URL_ENV} to http://127.0.0.1:<port>.` } : { cause: "The agent URL is malformed.", action: `Set ${AGENT_URL_ENV} to http://127.0.0.1:<port> (explicit port, no path).` }),
    );

    return { report: finalize(steps, null, null, now), config: null, system: null };
  }

  steps.push(step("configuration", "ok", `Jeton présent. Adresse : ${config.origin}${config.urlFromDefault ? " (valeur par défaut)" : ""}.`));

  const health = await bridgeRequest<{ bridge_enabled?: boolean }>(config, "health", { fetchImpl: options.fetchImpl });

  if (!health.ok) {
    const d = describeFailure(health.failure);

    steps.push(step(d.id, "fail", d.detail, d.hint, d.guidance));

    return { report: finalize(steps, config.origin, null, now), config, system: null };
  }

  steps.push(step("reachability", "ok", `L'agent répond en ${health.latencyMs} ms.`));

  if (health.data.bridge_enabled === false) {
    steps.push(step("bridge", "fail", "L'agent est en ligne mais son pont est désactivé (aucun jeton valide).", START_HINT, { cause: "The agent is running but its bridge is disabled: it was started without a valid token.", action: `Restart the agent with ${AGENT_TOKEN_ENV} set (32 characters or more).` }));

    return { report: finalize(steps, config.origin, health.latencyMs, now), config, system: null };
  }

  steps.push(step("bridge", "ok", "Le pont est activé côté agent."));

  const system = await bridgeRequest<SystemData>(config, "system", { fetchImpl: options.fetchImpl });

  if (!system.ok) {
    const d = describeFailure(system.failure);

    steps.push(step(d.id, "fail", d.detail, d.hint, d.guidance));

    return { report: finalize(steps, config.origin, health.latencyMs, now), config, system: null };
  }

  steps.push(step("authentication", "ok", "Jeton accepté par l'agent."));
  steps.push(step("contract", "ok", `Contrat ${system.data.agent.name} / ${system.data.agent.phase} compatible.`));

  const s = system.data;
  const dataWarnings: string[] = [];

  if (!s.data.channel_dir_exists) dataWarnings.push("aucune donnée locale pour ce canal (normal avant la première écriture)");
  if (s.productions.in_pipeline === 0) dataWarnings.push("aucune production détectée dans le pipeline");

  steps.push(
    dataWarnings.length
      ? step("data", "warn", `Connecté, mais ${dataWarnings.join(" ; ")}.`, undefined, { cause: "The agent is connected but has little or no data yet (no local channel data or no production detected).", action: "Nothing to fix if this is a fresh setup: data appears after the first production or the first registry update." })
      : step("data", "ok", `${s.productions.readable} production(s) lisible(s) sur ${s.productions.in_pipeline}.`),
  );

  return { report: finalize(steps, config.origin, health.latencyMs, now), config, system: s };
}

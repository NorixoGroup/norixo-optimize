// Dérivations de présentation : traduisent les payloads du bridge en points de statut
// et en faits d'affichage, en français. Aucune valeur n'est inventée.

import type { OverviewResponse, PlannerEntry, ProductionItem, SectionResult, SettingsData, ViewDataMap } from "@/lib/youtube-agent/types";

import { COPY, journalActionLabel } from "./copy";

export type Dot = "ok" | "warn" | "error" | "idle";
export type Connected = Extract<OverviewResponse, { connected: true }>;
export type SystemTile = { key: string; label: string; state: Dot; caption: string };

const data = <T,>(r: SectionResult<T>): T | null => (r.ok ? r.data : null);

export function sectionData<K extends keyof ViewDataMap>(c: Connected, key: K): ViewDataMap[K] | null {
  return data(c.sections[key] as SectionResult<ViewDataMap[K]>);
}

function stageDot(c: Connected, key: string): { state: Dot; caption: string } {
  const stage = sectionData(c, "pipeline")?.stages.find((s) => s.key === key);

  switch (stage?.status) {
    case "done": return { state: "ok", caption: COPY.captions.done };
    case "running": return { state: "warn", caption: COPY.captions.running };
    case "failed": return { state: "error", caption: COPY.captions.failed };
    default: return { state: "idle", caption: COPY.captions.pending };
  }
}

export function deriveSystemTiles(c: Connected): SystemTile[] {
  const ok = (key: keyof ViewDataMap) => c.sections[key].ok;
  const comments = sectionData(c, "comments");
  const settings = sectionData(c, "settings");
  const steps = new Map(c.diagnostics.steps.map((s) => [s.id, s.status]));
  const bridgeOk = steps.get("bridge") === "ok" && steps.get("authentication") === "ok";
  const cap = COPY.captions;
  const t = COPY.tiles;

  return [
    { key: "agent", label: t.agent, state: steps.get("reachability") === "ok" ? "ok" : "error", caption: cap.responding },
    { key: "bridge", label: t.bridge, state: bridgeOk ? "ok" : "error", caption: bridgeOk ? cap.authenticated : cap.notAuthenticated },
    { key: "workflow", label: t.workflow, state: ok("system") && ok("productions") ? "ok" : "error", caption: settings ? cap.transitions(settings.workflow.transitions) : cap.unavailable },
    { key: "planner", label: t.planner, state: ok("planner") ? "ok" : "error", caption: ok("planner") ? cap.ready : cap.unavailable },
    { key: "comments", label: t.comments, state: !ok("comments") ? "error" : comments?.ingestion === "not_connected" ? "idle" : "ok", caption: comments?.ingestion === "not_connected" ? cap.notConnected : cap.connected },
    { key: "analytics", label: t.analytics, state: ok("analytics") ? "idle" : "error", caption: cap.notConnected },
    { key: "learning", label: t.learning, state: ok("learning") ? "ok" : "error", caption: ok("learning") ? cap.readOnly : cap.unavailable },
    { key: "voice", label: t.voice, ...stageDot(c, "voice") },
    { key: "assembly", label: t.assembly, ...stageDot(c, "assembly") },
    { key: "quality", label: t.quality, ...stageDot(c, "quality") },
  ];
}

export type HeroFacts = {
  activeVideo: string | null;
  nextProduction: string | null;
  lastRender: null;
  lastSync: string | null;
};

export function deriveHeroFacts(c: Connected): HeroFacts {
  const items = sectionData(c, "productions")?.items ?? [];

  return {
    activeVideo: items.find((i) => i.bucket === "in_progress")?.title ?? null,
    nextProduction: items.find((i) => i.bucket === "planned")?.title ?? null,
    lastRender: null,
    lastSync: c.diagnostics.checked_at,
  };
}

export type ActivityKind = "running" | "locked" | "last_action" | "idle";

export function deriveCurrentActivity(c: Connected): { kind: ActivityKind; text: string; at: string | null } {
  const pipeline = sectionData(c, "pipeline");
  const running = pipeline?.stages.find((s) => s.status === "running");

  if (running) {
    return { kind: "running", text: COPY.activity.running(COPY.pipeline.stages[running.key] ?? running.label, pipeline?.production?.title ?? null), at: null };
  }

  const locked = sectionData(c, "productions")?.items.find((i) => i.locked);

  if (locked) return { kind: "locked", text: COPY.activity.locked(locked.title), at: null };

  const last = sectionData(c, "journal")?.entries[0];

  if (last) return { kind: "last_action", text: journalActionLabel(last), at: last.ts };

  return { kind: "idle", text: "", at: null };
}

// Portes d'approbation connues devant la vidéo, selon son état et la liste fournie par l'agent.
const GATES_AHEAD: Record<string, string[]> = {
  idea: ["idea→in_production", "ready_to_publish→published"],
  paused: ["paused→in_production", "ready_to_publish→published"],
  failed: ["failed→in_production", "ready_to_publish→published"],
  in_production: ["ready_to_publish→published"],
  quality_passed: ["ready_to_publish→published"],
  ready_to_publish: ["ready_to_publish→published"],
};

export function remainingApprovals(entry: PlannerEntry, settings: SettingsData | null): number | null {
  if (!settings) return null;

  const known = new Set(settings.workflow.approval_required_on);

  return (GATES_AHEAD[entry.workflow_state] ?? []).filter((gate) => known.has(gate)).length;
}

const PIPELINE_STAGES = 7;

export function stagesRemaining(entry: PlannerEntry): number {
  return Math.max(0, PIPELINE_STAGES - Math.round((entry.progress_percent / 100) * PIPELINE_STAGES));
}

// Production « technique » : essai ou exécution échouée qui n'est liée à aucune vidéo.
// Règle d'interface uniquement : le bridge et les données ne sont pas modifiés.
export function isTechnicalProduction(item: Pick<ProductionItem, "linked" | "type" | "pipeline_status">): boolean {
  return !item.linked && (item.type === "test" || item.pipeline_status === "failed");
}

// Retourne une vue sans les productions techniques (planificateur, pipeline et compteurs inclus).
export function applyTechnicalFilter(c: Connected, showTechnical: boolean): { connected: Connected; hidden: number } {
  const productions = sectionData(c, "productions");

  if (showTechnical || !productions) return { connected: c, hidden: 0 };

  const technicalIds = new Set(productions.items.filter(isTechnicalProduction).map((i) => i.id));
  const items = productions.items.filter((i) => !technicalIds.has(i.id));
  const counts = { planned: 0, in_progress: 0, published: 0, archived: 0 };

  for (const item of items) counts[item.bucket] += 1;

  const sections: Connected["sections"] = { ...c.sections, productions: { ok: true, data: { ...productions, items, counts } } };

  const planner = sectionData(c, "planner");

  if (planner) {
    const candidates = [planner.next, ...planner.queue].filter((e): e is PlannerEntry => e !== null && !technicalIds.has(e.production_id));

    sections.planner = { ok: true, data: { ...planner, next: candidates[0] ?? null, queue: candidates.slice(1) } };
  }

  const pipeline = sectionData(c, "pipeline");

  if (pipeline?.production && technicalIds.has(pipeline.production.id)) {
    sections.pipeline = { ok: true, data: { ...pipeline, production: null, progress_percent: 0 } };
  }

  return {
    connected: { ...c, sections },
    hidden: technicalIds.size + productions.totals.hidden_tests,
  };
}

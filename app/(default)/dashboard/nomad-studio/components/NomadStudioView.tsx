"use client";

import type { OverviewResponse, SectionResult } from "@/lib/youtube-agent/types";

import { COPY } from "../copy";
import { applyTechnicalFilter, deriveCurrentActivity, deriveHeroFacts, deriveSystemTiles, sectionData } from "../studioState";
import { AnalyticsBoard } from "./AnalyticsBoard";
import { CommentsBoard } from "./CommentsBoard";
import { CurrentActivityCard } from "./CurrentActivityCard";
import { DiagnosticScreen } from "./DiagnosticScreen";
import { Hero, type HeroState } from "./Hero";
import { JournalBoard } from "./JournalBoard";
import { LearningBoard } from "./LearningBoard";
import { PipelineCard } from "./PipelineCard";
import { PlannerBoard } from "./PlannerBoard";
import { ProductionsBoard } from "./ProductionsBoard";
import { ResourceUsageCard } from "./ResourceUsageCard";
import { SettingsBoard } from "./SettingsBoard";
import { SystemStatusCard } from "./SystemStatusCard";
import { Panel } from "./shared/Panel";
import { SectionFallback } from "./shared/SectionFallback";
import { FOCUS_RING, TOUCH_TARGET } from "./shared/styles";

function Section<T>({ result, title, children }: { result: SectionResult<T>; title: string; children: (data: T) => React.ReactNode }) {
  return result.ok ? <>{children(result.data)}</> : <Panel title={title}><SectionFallback failure={result.failure} /></Panel>;
}

// Composition de la page (sans accès réseau ni routeur) : rendue telle quelle par la page et par les tests.
export function NomadStudioView({
  overview,
  loading,
  error,
  showTechnical,
  onToggleTechnical,
  onReload,
  onConnectGoogle,
}: {
  overview: OverviewResponse | null;
  loading: boolean;
  error: string | null;
  showTechnical: boolean;
  onToggleTechnical: (value: boolean) => void;
  onReload: () => void;
  onConnectGoogle: () => void;
}) {
  const raw = overview?.connected === true ? overview : null;
  const filtered = raw ? applyTechnicalFilter(raw, showTechnical) : null;
  const connected = filtered?.connected ?? null;
  const state: HeroState = !overview ? "checking" : connected ? (connected.diagnostics.overall === "degraded" ? "degraded" : "ready") : "blocked";
  const system = connected ? sectionData(connected, "system") : null;
  const settings = connected ? sectionData(connected, "settings") : null;

  const viewJournal = () => {
    document.getElementById("journal")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <Hero state={state} facts={connected ? deriveHeroFacts(connected) : null} busy={loading} connected={Boolean(connected)} onRunDiagnostics={onReload} onRefresh={onReload} onViewJournal={viewJournal} />

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <span>{error}</span>
          <button type="button" onClick={onReload} className={`rounded-full bg-slate-900 px-4 text-sm font-semibold text-white ${TOUCH_TARGET} ${FOCUS_RING}`}>{COPY.errors.retry}</button>
        </div>
      ) : null}

      {overview && !connected ? <DiagnosticScreen report={overview.diagnostics} busy={loading} onRetry={onReload} /> : null}

      {connected ? (
        <>
          <nav aria-label={COPY.navLabel} className="flex flex-wrap gap-2">
            {COPY.anchors.map(([id, label]) => (
              <a key={id} href={`#${id}`} className={`inline-flex items-center rounded-full border border-slate-300 bg-white/90 px-3.5 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-400 ${TOUCH_TARGET} ${FOCUS_RING}`}>{label}</a>
            ))}
          </nav>

          <SystemStatusCard
            tiles={deriveSystemTiles(connected)}
            overall={connected.diagnostics.overall === "degraded" ? "degraded" : "ready"}
            currentEpisode={sectionData(connected, "pipeline")?.production?.title ?? null}
            version={system?.agent.phase ?? null}
            latencyMs={connected.diagnostics.latency_ms}
            lastSync={connected.diagnostics.checked_at}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <CurrentActivityCard activity={deriveCurrentActivity(connected)} />
            <ResourceUsageCard />
          </div>

          <Section title={COPY.pipeline.title} result={connected.sections.pipeline}>{(data) => <PipelineCard data={data} />}</Section>
          <Section title={COPY.planner.title} result={connected.sections.planner}>{(data) => <PlannerBoard data={data} settings={settings} />}</Section>
          <Section title={COPY.productions.title} result={connected.sections.productions}>
            {(data) => <ProductionsBoard data={data} showTechnical={showTechnical} hiddenTechnical={filtered?.hidden ?? 0} busy={loading} onToggleTechnical={onToggleTechnical} />}
          </Section>
          <Section title={COPY.comments.title} result={connected.sections.comments}>{(data) => <CommentsBoard data={data} />}</Section>
          <Section title={COPY.analytics.title} result={connected.sections.analytics}>{(data) => <AnalyticsBoard data={data} />}</Section>
          <Section title={COPY.learning.title} result={connected.sections.learning}>{(data) => <LearningBoard data={data} />}</Section>
          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <Section title={COPY.journal.title} result={connected.sections.journal}>{(data) => <JournalBoard data={data} />}</Section>
            <Section title={COPY.settings.title} result={connected.sections.settings}>{(data) => <SettingsBoard data={data} onConnectGoogle={onConnectGoogle} />}</Section>
          </div>
        </>
      ) : null}

      {!overview && !error ? <p className="text-sm text-slate-700">{COPY.states.checking}</p> : null}
    </div>
  );
}

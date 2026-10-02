import { COPY } from "../copy";
import { formatDateTime } from "../format";
import type { HeroFacts } from "../studioState";
import { StatusBadge, type BadgeTone } from "./shared/StatusBadge";
import { BUTTON_DARK, BUTTON_INACTIVE, KICKER } from "./shared/styles";

export type HeroState = "ready" | "degraded" | "blocked" | "checking";

const STATE_TONE: Record<HeroState, BadgeTone> = { ready: "green", degraded: "amber", blocked: "rose", checking: "slate" };
const NOTE_ID = "hero-actions-note";

function Fact({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="nk-card-soft min-w-0 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${muted ? "text-slate-600" : "text-slate-900"}`} title={value}>{value}</p>
    </div>
  );
}

// Une action non reliée reste focalisable (aria-disabled) et renvoie à la note visible qui explique pourquoi.
function ActionButton({ label, onClick, inactive }: { label: string; onClick?: () => void; inactive?: boolean }) {
  return (
    <button
      type="button"
      aria-disabled={inactive || undefined}
      aria-describedby={inactive ? NOTE_ID : undefined}
      onClick={() => {
        if (!inactive) onClick?.();
      }}
      className={inactive ? BUTTON_INACTIVE : BUTTON_DARK}
    >
      {label}
    </button>
  );
}

export function Hero({
  state,
  facts,
  busy,
  connected,
  onRunDiagnostics,
  onRefresh,
  onViewJournal,
}: {
  state: HeroState;
  facts: HeroFacts | null;
  busy: boolean;
  connected: boolean;
  onRunDiagnostics: () => void;
  onRefresh: () => void;
  onViewJournal: () => void;
}) {
  const na = COPY.hero.notAvailable;
  const none = COPY.hero.none;
  const a = COPY.hero.actions;

  return (
    <section aria-labelledby="nomad-title" className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.12),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.12),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:px-8 xl:px-10 xl:py-9">
      <div className="w-full min-w-0 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl space-y-2.5">
            <p className={KICKER}>{COPY.kicker}</p>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="text-3xl leading-none md:text-4xl">🎬</span>
              <h1 id="nomad-title" className="nk-page-title nk-page-title-dashboard">{COPY.title}</h1>
            </div>
            <p className="text-[15px] leading-7 text-slate-700">{COPY.subtitle}</p>
          </div>
          <div className="text-right">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{COPY.hero.overall}</p>
            <StatusBadge tone={STATE_TONE[state]}>{COPY.states[state]}</StatusBadge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact label={COPY.hero.activeVideo} value={connected ? facts?.activeVideo ?? none : na} muted={!facts?.activeVideo} />
          <Fact label={COPY.hero.nextProduction} value={connected ? facts?.nextProduction ?? none : na} muted={!facts?.nextProduction} />
          <Fact label={COPY.hero.lastRender} value={na} muted />
          <Fact label={COPY.hero.lastSync} value={facts?.lastSync ? formatDateTime(facts.lastSync) : na} muted={!facts?.lastSync} />
        </div>

        <div>
          <div className="flex flex-wrap gap-2.5" role="group" aria-label={COPY.hero.quickActions}>
            <ActionButton label={a.newProduction} inactive />
            <ActionButton label={a.relaunch} inactive />
            <ActionButton label={busy ? COPY.hero.checking : a.diagnostics} onClick={onRunDiagnostics} inactive={busy} />
            <ActionButton label={a.refresh} onClick={onRefresh} inactive={busy || !connected} />
            <ActionButton label={a.journal} onClick={onViewJournal} inactive={!connected} />
          </div>
          <p id={NOTE_ID} className="mt-2.5 text-xs leading-5 text-slate-700">
            {COPY.hero.notePending}
            {connected ? "" : ` ${COPY.hero.noteOffline}`}
          </p>
        </div>
      </div>
    </section>
  );
}

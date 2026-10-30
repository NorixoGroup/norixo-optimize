import { COPY } from "../copy";
import { formatDateTime } from "../format";
import type { SystemTile } from "../studioState";
import { Panel } from "./shared/Panel";
import { StatusBadge, type BadgeTone } from "./shared/StatusBadge";
import { StatusDot } from "./shared/StatusDot";

const OVERALL: Record<"ready" | "degraded", { tone: BadgeTone; label: string }> = {
  ready: { tone: "green", label: COPY.states.ready },
  degraded: { tone: "amber", label: COPY.states.degraded },
};

const LABEL = "text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600";

export function SystemStatusCard({
  tiles,
  overall,
  currentEpisode,
  version,
  latencyMs,
  lastSync,
}: {
  tiles: SystemTile[];
  overall: "ready" | "degraded";
  currentEpisode: string | null;
  version: string | null;
  latencyMs: number | null;
  lastSync: string | null;
}) {
  const state = OVERALL[overall];

  return (
    <Panel id="system" kicker={COPY.system.kicker} title={COPY.system.title} description={COPY.summaries[overall]} aside={<StatusBadge tone={state.tone}>{state.label}</StatusBadge>}>
      <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5" aria-label={COPY.system.subsystems}>
        {tiles.map((tile) => (
          <li key={tile.key} className="nk-card-soft flex min-w-0 items-center gap-3 px-4 py-3">
            <StatusDot state={tile.state} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{tile.label}</p>
              <p className="truncate text-xs text-slate-600">
                {tile.caption}
                {["voice", "assembly", "quality"].includes(tile.key) ? ` · ${COPY.system.latestProduction}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
        <div className="nk-card-soft min-w-0 px-4 py-3 xl:col-span-2">
          <dt className={LABEL}>{COPY.system.currentEpisode}</dt>
          <dd className="mt-1 truncate font-semibold text-slate-900" title={currentEpisode ?? undefined}>{currentEpisode ?? "—"}</dd>
        </div>
        <div className="nk-card-soft min-w-0 px-4 py-3">
          <dt className={LABEL}>{COPY.system.lastSync}</dt>
          <dd className="mt-1 font-semibold text-slate-900">{formatDateTime(lastSync)}</dd>
        </div>
        <div className="nk-card-soft min-w-0 px-4 py-3">
          <dt className={LABEL}>{COPY.system.version}</dt>
          <dd className="mt-1 font-semibold text-slate-900">{version ?? "—"}</dd>
        </div>
        <div className="nk-card-soft min-w-0 px-4 py-3">
          <dt className={LABEL}>{COPY.system.latency}</dt>
          <dd className="mt-1 font-semibold text-slate-900">{latencyMs === null ? "—" : `${latencyMs} ms`}</dd>
        </div>
      </dl>
    </Panel>
  );
}

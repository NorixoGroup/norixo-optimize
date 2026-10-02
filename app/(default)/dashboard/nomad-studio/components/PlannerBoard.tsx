import type { PlannerData, SettingsData } from "@/lib/youtube-agent/types";

import { COPY, WORKFLOW_LABELS } from "../copy";
import { formatDay } from "../format";
import { remainingApprovals, stagesRemaining } from "../studioState";
import { EmptyNote } from "./shared/EmptyNote";
import { Panel } from "./shared/Panel";
import { ProgressBar } from "./shared/ProgressBar";
import { StatusBadge } from "./shared/StatusBadge";

const LABEL = "text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="nk-card-soft min-w-0 px-4 py-3">
      <p className={LABEL}>{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      {note ? <p className="mt-0.5 text-[11px] leading-4 text-slate-700">{note}</p> : null}
    </div>
  );
}

export function PlannerBoard({ data, settings }: { data: PlannerData; settings: SettingsData | null }) {
  const next = data.next;
  const P = COPY.planner;
  const approvals = next ? remainingApprovals(next, settings) : null;

  return (
    <Panel id="planner" kicker={P.kicker} title={P.title} description={P.description}>
      {!next ? (
        <EmptyNote title={P.emptyTitle}>{P.emptyHint}</EmptyNote>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0 space-y-4">
            <div>
              <p className={LABEL}>{P.nextVideo}</p>
              <h3 className="mt-1 break-words text-xl font-semibold tracking-tight text-slate-950">{next.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge tone="blue">{WORKFLOW_LABELS[next.workflow_state] ?? "—"}</StatusBadge>
                <span className="text-sm text-slate-700">{P.actions[next.recommendation.action] ?? "—"}</span>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                <span>{P.progress}</span>
                <span>{next.progress_percent} % · {P.remainingStages(stagesRemaining(next))}</span>
              </div>
              <ProgressBar percent={next.progress_percent} label={P.progress} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label={P.priority} value={P.priorityValue} note={P.priorityNote} />
              <Stat label={P.deadline} value={formatDay(next.deadline)} />
              <Stat label={P.estimated} value="—" note={P.estimatedNote} />
              <Stat label={P.approvals} value={approvals === null ? "—" : String(approvals)} note={P.approvalsNote} />
            </div>

            <div>
              <p className={LABEL}>{P.blockers}</p>
              {next.blockers.length === 0 ? (
                <p className="mt-2 text-sm font-medium text-emerald-800">{P.noBlockers}</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {next.blockers.map((b) => <li key={b.code}><StatusBadge tone={b.code === "stage_failed" || b.code === "locked" ? "rose" : "amber"}>{P.blockerLabels[b.code] ?? P.blockerFallback}</StatusBadge></li>)}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-700">{P.recommendationOnly}</p>
            </div>
          </div>

          <div className="min-w-0">
            <p className={LABEL}>{P.queue}</p>
            {data.queue.length === 0 ? (
              <p className="mt-2 text-sm text-slate-700">{P.queueEmpty}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {data.queue.map((q) => (
                  <li key={q.production_id} className="nk-card-soft min-w-0 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-900" title={q.title}>{q.title}</p>
                    <p className="mt-1 text-xs text-slate-700">{P.queueItem(formatDay(q.deadline), q.blockers.length, q.progress_percent)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

import { Clapperboard, FileText, Image as ImageIcon, Mic, Scissors, Search, Send, ShieldCheck, type LucideIcon } from "lucide-react";

import type { PipelineData, StageView } from "@/lib/youtube-agent/types";

import { COPY } from "../copy";
import { EmptyNote } from "./shared/EmptyNote";
import { Panel } from "./shared/Panel";
import { ProgressBar } from "./shared/ProgressBar";
import { StatusBadge, type BadgeTone } from "./shared/StatusBadge";

const ICONS: Record<string, LucideIcon> = {
  research: Search,
  script: FileText,
  storyboard: Clapperboard,
  assets: ImageIcon,
  voice: Mic,
  assembly: Scissors,
  quality: ShieldCheck,
  publication: Send,
};

const TONE: Record<StageView["status"], { badge: BadgeTone; card: string; icon: string }> = {
  done: { badge: "green", card: "border-emerald-300 bg-emerald-50/60", icon: "text-emerald-700" },
  running: { badge: "amber", card: "border-amber-300 bg-amber-50/60", icon: "text-amber-700" },
  failed: { badge: "rose", card: "border-rose-300 bg-rose-50/60", icon: "text-rose-700" },
  pending: { badge: "slate", card: "border-slate-300 bg-white", icon: "text-slate-600" },
  not_connected: { badge: "slate", card: "border-dashed border-slate-400 bg-slate-50/60", icon: "text-slate-600" },
};

export function PipelineCard({ data }: { data: PipelineData }) {
  return (
    <Panel
      id="pipeline"
      kicker={COPY.pipeline.kicker}
      title={COPY.pipeline.title}
      description={data.production ? COPY.pipeline.showing(data.production.title) : COPY.pipeline.none}
      aside={data.production ? <StatusBadge tone="blue">{COPY.pipeline.complete(data.progress_percent)}</StatusBadge> : undefined}
    >
      {!data.production ? (
        <EmptyNote title={COPY.pipeline.emptyTitle}>{COPY.pipeline.emptyHint}</EmptyNote>
      ) : (
        <>
          <ProgressBar percent={data.progress_percent} label={COPY.pipeline.title} />
          <ol className="mt-5 flex flex-col gap-1 sm:flex-row sm:items-stretch sm:gap-0 sm:overflow-x-auto sm:pb-2" aria-label={COPY.pipeline.ariaStages}>
            {data.stages.map((stage, index) => {
              const tone = TONE[stage.status];
              const Icon = ICONS[stage.key] ?? Search;

              return (
                <li key={stage.key} className="flex flex-col items-center sm:flex-1 sm:flex-row">
                  <div className={`w-full min-w-0 rounded-2xl border px-3 py-3 sm:min-w-[132px] ${tone.card}`}>
                    <div className="flex items-center gap-2">
                      <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${tone.icon}`} strokeWidth={1.8} />
                      <p className="text-sm font-semibold text-slate-900">{COPY.pipeline.stages[stage.key] ?? stage.label}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge tone={tone.badge}>{COPY.pipeline.status[stage.status]}</StatusBadge>
                      <span className="text-xs font-semibold text-slate-700">{stage.percent === null ? "—" : `${stage.percent} %`}</span>
                    </div>
                  </div>
                  {index < data.stages.length - 1 ? (
                    <>
                      <span aria-hidden="true" className="py-0.5 text-xs leading-none text-slate-500 sm:hidden">↓</span>
                      <span aria-hidden="true" className="hidden px-1.5 text-slate-500 sm:block">→</span>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-slate-600">{COPY.pipeline.footnote}</p>
        </>
      )}
    </Panel>
  );
}

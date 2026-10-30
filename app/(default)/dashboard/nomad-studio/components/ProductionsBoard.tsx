"use client";

import { useState } from "react";

import type { ProductionItem, ProductionsData } from "@/lib/youtube-agent/types";

import { COPY, WORKFLOW_LABELS } from "../copy";
import { formatDay, formatDuration } from "../format";
import { isTechnicalProduction } from "../studioState";
import { EmptyNote } from "./shared/EmptyNote";
import { Panel } from "./shared/Panel";
import { ProgressBar } from "./shared/ProgressBar";
import { StatusBadge, type BadgeTone } from "./shared/StatusBadge";
import { FOCUS_RING, TOUCH_TARGET } from "./shared/styles";
import { ThumbnailPlaceholder } from "./shared/ThumbnailPlaceholder";

// La durée n'est pas encore fournie par le bridge : le champ est lu s'il apparaît, sinon « — ».
type EpisodeItem = ProductionItem & { duration_minutes?: number | null };

const BUCKETS = ["planned", "in_progress", "published"] as const;

const STATE_TONE: Record<string, BadgeTone> = {
  idea: "slate",
  in_production: "blue",
  paused: "amber",
  failed: "rose",
  quality_passed: "green",
  ready_to_publish: "green",
  published: "green",
  tracking: "green",
  archived: "slate",
};

const DT = "text-slate-600";
const DD = "font-semibold text-slate-900";

function EpisodeCard({ item }: { item: EpisodeItem }) {
  return (
    <article className="nk-card-soft nk-card-hover flex min-w-0 flex-col gap-3 p-3">
      <ThumbnailPlaceholder />
      <div className="min-w-0 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{COPY.productions.episode}</span>
          {isTechnicalProduction(item) ? <StatusBadge tone="slate">{COPY.productions.technical}</StatusBadge> : null}
          {item.locked ? <StatusBadge tone="amber">{COPY.productions.locked}</StatusBadge> : null}
        </div>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-950" title={item.title}>{item.title}</h3>
        <div className="mt-2"><StatusBadge tone={STATE_TONE[item.workflow_state] ?? "slate"}>{WORKFLOW_LABELS[item.workflow_state] ?? "—"}</StatusBadge></div>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar percent={item.progress_percent} tone={item.workflow_state === "failed" ? "rose" : "green"} label={`${COPY.productions.progress} : ${item.title}`} />
          <span className="w-12 shrink-0 text-right text-xs font-semibold text-slate-800">{item.progress_percent} %</span>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="min-w-0"><dt className={DT}>{COPY.productions.duration}</dt><dd className={DD}>{formatDuration(item.duration_minutes)}</dd></div>
          <div className="min-w-0"><dt className={DT}>{COPY.productions.targetDate}</dt><dd className={DD}>{formatDay(item.target_date)}</dd></div>
          <div className="min-w-0"><dt className={DT}>{COPY.productions.video}</dt><dd className={`${DD} truncate`} title={item.video_id ?? undefined}>{item.video_id ?? COPY.productions.notLinked}</dd></div>
        </dl>
      </div>
    </article>
  );
}

export function ProductionsBoard({
  data,
  showTechnical,
  hiddenTechnical,
  busy,
  onToggleTechnical,
}: {
  data: ProductionsData;
  showTechnical: boolean;
  hiddenTechnical: number;
  busy: boolean;
  onToggleTechnical: (value: boolean) => void;
}) {
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]>("in_progress");
  const visible = (data.items as EpisodeItem[]).filter((item) => item.bucket === bucket);
  const bucketLabel = COPY.productions.tabs[bucket];

  return (
    <Panel
      id="productions"
      kicker={COPY.productions.kicker}
      title={COPY.productions.title}
      description={COPY.productions.description}
      aside={
        <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg text-sm text-slate-800 ${TOUCH_TARGET}`}>
          <input type="checkbox" checked={showTechnical} disabled={busy} onChange={(event) => onToggleTechnical(event.target.checked)} className={`h-5 w-5 rounded border-slate-400 ${FOCUS_RING}`} />
          <span>
            {COPY.productions.technicalSwitch}
            {hiddenTechnical > 0 && !showTechnical ? COPY.productions.technicalHidden(hiddenTechnical) : ""}
          </span>
        </label>
      }
    >
      <div role="tablist" aria-label={COPY.productions.tabsLabel} className="mb-4 flex flex-wrap gap-2">
        {BUCKETS.map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={bucket === key}
            onClick={() => setBucket(key)}
            className={`rounded-full border px-3.5 text-sm font-semibold ${TOUCH_TARGET} ${FOCUS_RING} ${bucket === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"}`}
          >
            {COPY.productions.tabs[key]} <span className="ml-1 opacity-80">{data.counts[key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyNote title={COPY.productions.empty(bucketLabel)}>{showTechnical ? COPY.productions.emptyShown : COPY.productions.emptyHidden}</EmptyNote>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => <EpisodeCard key={item.id} item={item} />)}
        </div>
      )}

      {data.totals.truncated ? <p className="mt-3 text-xs text-amber-900">{COPY.productions.truncated(200, data.totals.in_pipeline)}</p> : null}
    </Panel>
  );
}

import type { AnalyticsData } from "@/lib/youtube-agent/types";

import { COPY } from "../copy";
import { EmptyNote } from "./shared/EmptyNote";
import { Panel } from "./shared/Panel";
import { StatusBadge } from "./shared/StatusBadge";

// Jamais de valeur inventée : une valeur n'apparaît que si le bridge en fournit une.
export function AnalyticsBoard({ data }: { data: AnalyticsData }) {
  return (
    <Panel id="analytics" kicker={COPY.analytics.kicker} title={COPY.analytics.title} description={COPY.analytics.description} aside={<StatusBadge tone="slate">{COPY.analytics.badge}</StatusBadge>}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COPY.analytics.kpis.map(([key, label]) => {
          const value = (data.cards.find((c) => c.key === key) as { value?: unknown } | undefined)?.value;
          const hasValue = typeof value === "number" || typeof value === "string";

          return (
            <article key={key} className="nk-card-soft min-w-0 px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{label}</p>
              <p className={`mt-2 text-2xl font-semibold tracking-tight ${hasValue ? "text-slate-900" : "text-slate-600"}`}>{hasValue ? String(value) : "—"}</p>
              {!hasValue ? <p className="mt-1 text-xs text-slate-700">{COPY.waiting}</p> : null}
            </article>
          );
        })}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[COPY.analytics.top, COPY.analytics.worst].map((title) => (
          <div key={title}>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
            <EmptyNote title={COPY.waiting}>{COPY.analytics.listHint}</EmptyNote>
          </div>
        ))}
      </div>
    </Panel>
  );
}

import type { LearningData, LearningItem } from "@/lib/youtube-agent/types";

import { COPY } from "../copy";
import { formatDateTime } from "../format";
import { Panel } from "./shared/Panel";
import { StatusBadge } from "./shared/StatusBadge";

const LIST_CAP = 20;
const L = COPY.learning;

function count(items: LearningItem[]): string {
  return items.length >= LIST_CAP ? `${LIST_CAP}+` : String(items.length);
}

function List({ id, items }: { id: "observations" | "validated" | "prompts"; items: LearningItem[] }) {
  const [title, empty] = L.lists[id];

  return (
    <div className="nk-card-soft min-w-0 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">{count(items)}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-700">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="text-sm text-slate-800">
              <span className="break-words">{item.text ?? L.noText}</span>
              <span className="ml-2 text-xs text-slate-600">{formatDateTime(item.ts)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LearningBoard({ data }: { data: LearningData }) {
  // Seuls trois jalons ont un comptage réel ; les preuves et les éléments appliqués ne sont pas suivis.
  const values: Array<string | null> = [count(data.observations), null, count(data.validated_learnings), null, count(data.prompt_updates)];

  return (
    <Panel id="learning" kicker={L.kicker} title={L.title} description={L.description} aside={<StatusBadge tone="blue">{L.badge}</StatusBadge>}>
      <ol className="flex flex-col gap-1 sm:flex-row sm:items-stretch sm:overflow-x-auto sm:pb-2" aria-label={L.timelineLabel}>
        {L.stages.map((stage, index) => (
          <li key={stage} className="flex flex-col items-center sm:flex-1 sm:flex-row">
            <div className="nk-card-soft w-full min-w-0 px-4 py-3 sm:min-w-[132px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{index + 1}. {stage}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{values[index] ?? "—"}</p>
              {values[index] === null ? <p className="text-[11px] text-slate-700">{L.notTracked}</p> : null}
            </div>
            {index < L.stages.length - 1 ? (
              <>
                <span aria-hidden="true" className="py-0.5 text-xs text-slate-500 sm:hidden">↓</span>
                <span aria-hidden="true" className="hidden px-1.5 text-slate-500 sm:block">→</span>
              </>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <List id="observations" items={data.observations} />
        <List id="validated" items={data.validated_learnings} />
        <List id="prompts" items={data.prompt_updates} />
        <div className="nk-card-soft min-w-0 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{L.knowledge}</h3>
            <StatusBadge tone={data.knowledge.status === "ok" ? "green" : "slate"}>{data.knowledge.status === "ok" ? L.knowledgeOk(data.knowledge.documents) : L.knowledgeEmpty}</StatusBadge>
          </div>
          <p className="mt-3 text-sm text-slate-700">{data.knowledge.status === "ok" ? L.knowledgeOkText : L.knowledgeEmptyText}</p>
        </div>
      </div>
    </Panel>
  );
}

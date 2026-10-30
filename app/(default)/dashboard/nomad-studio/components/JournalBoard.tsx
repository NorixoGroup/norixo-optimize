import type { JournalData } from "@/lib/youtube-agent/types";

import { COPY, journalActionLabel, journalOutcomeLabel } from "../copy";
import { formatDateTime } from "../format";
import { EmptyNote } from "./shared/EmptyNote";
import { Panel } from "./shared/Panel";
import { StatusBadge } from "./shared/StatusBadge";

const J = COPY.journal;

export function JournalBoard({ data }: { data: JournalData }) {
  return (
    <Panel id="journal" kicker={J.kicker} title={J.title} description={J.description}>
      {data.entries.length === 0 ? (
        <EmptyNote title={J.emptyTitle}>{J.emptyHint}</EmptyNote>
      ) : (
        <ol className="relative space-y-4 border-l border-slate-300 pl-5" aria-label={J.ariaTimeline}>
          {data.entries.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="relative">
              <span aria-hidden="true" className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${e.validation === "approved" ? "bg-emerald-600" : "bg-slate-500"}`} />
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-slate-700">{formatDateTime(e.ts)}</p>
                {e.validation === "approved" ? <StatusBadge tone="green">{J.approved}</StatusBadge> : <StatusBadge tone="slate">{J.noValidation}</StatusBadge>}
                <span className="text-xs text-slate-700">{e.actor === "human_approved" ? J.human : J.agent}</span>
              </div>
              <p className="mt-1 break-words text-sm font-semibold text-slate-900"><span className="sr-only">{J.action} : </span>{journalActionLabel(e)}</p>
              <p className="break-words text-xs text-slate-700">
                {J.result} : {journalOutcomeLabel(e.outcome)}
                {e.subject_id ? <span className="ml-2 font-mono text-[11px] text-slate-600">{e.subject_id.slice(0, 24)}</span> : null}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

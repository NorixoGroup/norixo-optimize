import type { CommentItem, CommentsData } from "@/lib/youtube-agent/types";

import { COPY } from "../copy";
import { EmptyNote } from "./shared/EmptyNote";
import { Panel } from "./shared/Panel";
import { StatusBadge, type BadgeTone } from "./shared/StatusBadge";
import { BUTTON_INACTIVE, TOUCH_TARGET } from "./shared/styles";

// Le bridge n'expose pas encore la date d'un commentaire : champ lu s'il apparaît, sinon « — ».
type BoardComment = CommentItem & { date?: string | null };

const NOTE_ID = "comments-actions-note";

function priorityTone(score: number | null): BadgeTone {
  return score === null ? "slate" : score >= 70 ? "rose" : score >= 40 ? "amber" : "slate";
}

// Le texte d'un commentaire est une donnée non fiable : texte brut uniquement (React échappe).
function CommentCard({ item, enabled }: { item: BoardComment; enabled: boolean }) {
  return (
    <article className="min-w-0 space-y-2 rounded-2xl border border-slate-300 bg-white p-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={priorityTone(item.priority_score)}>{COPY.comments.priority(item.priority_score)}</StatusBadge>
        <StatusBadge tone="blue">{COPY.comments.states[item.state] ?? "—"}</StatusBadge>
        {item.type ? <StatusBadge tone="slate">{item.type}</StatusBadge> : null}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div className="min-w-0"><dt className="text-slate-600">{COPY.comments.author}</dt><dd className="truncate font-semibold text-slate-900">{item.author_label ?? "—"}</dd></div>
        <div className="min-w-0"><dt className="text-slate-600">{COPY.comments.date}</dt><dd className="truncate font-semibold text-slate-900">{item.date ?? "—"}</dd></div>
        <div className="min-w-0"><dt className="text-slate-600">{COPY.comments.video}</dt><dd className="truncate font-semibold text-slate-900">{item.video_id ?? COPY.comments.unknownVideo}</dd></div>
      </dl>
      {item.excerpt ? <p className="whitespace-pre-wrap break-words text-slate-800">« {item.excerpt} »</p> : null}
      {item.proposal_text ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800">{COPY.comments.proposedReply}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-slate-900">{item.proposal_text}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {COPY.comments.actions.map((label) => (
          <button
            key={label}
            type="button"
            aria-disabled={!enabled || undefined}
            aria-describedby={!enabled ? NOTE_ID : undefined}
            onClick={(event) => {
              if (!enabled) event.preventDefault();
            }}
            className={`${BUTTON_INACTIVE} px-3 text-xs ${TOUCH_TARGET}`}
          >
            {label}
          </button>
        ))}
      </div>
    </article>
  );
}

export function CommentsBoard({ data }: { data: CommentsData }) {
  const total = data.columns.reduce((n, c) => n + c.items.length, 0);

  return (
    <Panel id="comments" kicker={COPY.comments.kicker} title={COPY.comments.title} description={COPY.comments.description} aside={<StatusBadge tone="slate">{COPY.comments.ingestion}</StatusBadge>}>
      <ul className="mb-3 flex flex-wrap gap-2" aria-label={COPY.comments.safeguardsLabel}>
        {COPY.comments.safeguards.map((text, i) => <li key={text}><StatusBadge tone={i < 2 ? "green" : "slate"}>{text}</StatusBadge></li>)}
      </ul>
      <p id={NOTE_ID} className="mb-4 text-xs leading-5 text-slate-700">{COPY.comments.actionsNote}</p>

      {total === 0 ? <div className="mb-4"><EmptyNote title={COPY.comments.empty}>{COPY.comments.emptyHint}</EmptyNote></div> : null}

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {data.columns.map((column) => (
          <div key={column.key} className="nk-card-soft w-64 shrink-0 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-700">{COPY.comments.columns[column.key] ?? "—"}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">{column.items.length}</span>
            </div>
            <div className="space-y-2">
              {column.items.length === 0 ? <p className="py-4 text-center text-xs text-slate-600">—</p> : column.items.map((item) => <CommentCard key={item.ref} item={item} enabled={data.actions.enabled} />)}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

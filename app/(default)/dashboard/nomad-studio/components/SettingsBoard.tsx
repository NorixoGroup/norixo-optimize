import type { SettingsData } from "@/lib/youtube-agent/types";

import { COPY } from "../copy";
import { Panel } from "./shared/Panel";
import { StatusBadge } from "./shared/StatusBadge";

type Row = { label: string; value: string; note?: string };

const S = COPY.settings;

function Group({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{title}</h3>
      <dl className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="nk-card-soft px-4 py-3">
            <dt className="text-xs font-semibold text-slate-600">{row.label}</dt>
            <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900">{row.value}</dd>
            {row.note ? <dd className="mt-0.5 break-words text-xs text-slate-700">{row.note}</dd> : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SettingsBoard({ data }: { data: SettingsData }) {
  const voice = data.narration_voice;
  const language = data.language === "fr" ? S.french : data.language ?? S.notDefined;

  return (
    <Panel id="settings" kicker={S.kicker} title={S.title} description={S.description} aside={<StatusBadge tone="blue">{S.badge}</StatusBadge>}>
      <div className="grid gap-5 md:grid-cols-3">
        <Group
          title={S.groups.channel}
          rows={[
            { label: S.rows.channel, value: data.project?.name ?? S.notDefined },
            { label: S.rows.language, value: language },
            { label: S.rows.style, value: S.notDefined },
          ]}
        />
        <Group
          title={S.groups.production}
          rows={[
            { label: S.rows.voice, value: voice?.voice_id ? `ElevenLabs · ${voice.voice_id}` : S.notConfigured, note: voice?.model_id },
            { label: S.rows.workflow, value: S.transitions(data.workflow.transitions), note: S.approvals(data.workflow.approval_required_on.length) },
          ]}
        />
        <Group
          title={S.groups.security}
          rows={[
            { label: S.rows.comments, value: S.commentsValue, note: S.commentsNote },
            { label: S.rows.publication, value: S.publicationNotConnected, note: data.publication.approval_required ? S.publicationNote : undefined },
          ]}
        />
      </div>
    </Panel>
  );
}

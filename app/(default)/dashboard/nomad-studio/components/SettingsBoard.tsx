import type { SettingsData } from "@/lib/youtube-agent/types";

import { COPY } from "../copy";
import { Panel } from "./shared/Panel";
import { StatusBadge } from "./shared/StatusBadge";
import { BUTTON_DARK } from "./shared/styles";
import { formatDateTime } from "../format";

type Row = { label: string; value: string; note?: string };

const S = COPY.settings;
const Y = S.youtube;
const number = (n: number | null) => (n === null ? Y.hidden : n.toLocaleString("fr-FR"));

// Lignes « chaîne YouTube » : valeurs reçues de l'agent, affichées telles quelles.
function channelRows(state: SettingsData["youtube_channel"]): Row[] {
  if (state.status === "not_loaded") return [{ label: Y.name, value: Y.notLoaded }];
  if (state.status === "error") return [{ label: Y.name, value: Y.errors[state.reason] ?? Y.errorFallback }];

  const c = state.channel;

  return [
    { label: Y.name, value: c.title },
    { label: Y.id, value: c.channel_id },
    ...(c.country ? [{ label: Y.country, value: c.country }] : []),
    { label: Y.subscribers, value: number(c.subscriber_count) },
    { label: Y.videos, value: number(c.video_count) },
    { label: Y.views, value: number(c.view_count) },
  ];
}

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

const V = Y.videoList;

function VideoNote({ text }: { text: string }) {
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{V.title}</h3>
      <p className="nk-card-soft px-4 py-3 text-sm font-semibold text-slate-900">{text}</p>
    </div>
  );
}

// Liste des vidéos reçue de l'agent, affichée telle quelle.
function VideoList({ state }: { state: SettingsData["youtube_videos"] }) {
  // Agent antérieur à R20.2 : aucune donnée vidéo, état neutre.
  if (!state) return <VideoNote text={V.unavailable} />;

  if (state.status === "not_loaded") return <VideoNote text={V.notLoaded} />;
  if (state.status === "error") return <VideoNote text={Y.errors[state.reason] ?? V.errorFallback} />;
  if (state.items.length === 0) return <VideoNote text={V.empty} />;

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{V.title}</h3>
      <ul className="space-y-2.5">
        {state.items.map((v) => (
          <li key={v.video_id} className="nk-card-soft flex min-w-0 gap-3 px-4 py-3">
            {v.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- image fournie par l'agent, affichée telle quelle
              <img src={v.thumbnail_url} alt={V.thumbnail} width={80} height={45} referrerPolicy="no-referrer" className="h-[45px] w-20 shrink-0 rounded object-cover" />
            ) : null}
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-slate-900">{v.title}</p>
              <p className="mt-0.5 break-words text-xs text-slate-700">
                {formatDateTime(v.published_at)} · {v.privacy_status ? V.privacy[v.privacy_status] ?? v.privacy_status : V.privacyUnknown} · {v.video_id}
              </p>
            </div>
          </li>
        ))}
        {state.has_more ? <li className="text-xs text-slate-700">{V.more}</li> : null}
      </ul>
    </div>
  );
}

export function SettingsBoard({ data, onConnectGoogle }: { data: SettingsData; onConnectGoogle: () => void }) {
  const voice = data.narration_voice;
  const language = data.language === "fr" ? S.french : data.language ?? S.notDefined;

  return (
    <Panel id="settings" kicker={S.kicker} title={S.title} description={S.description} aside={<StatusBadge tone="blue">{S.badge}</StatusBadge>}>
      <div className="grid gap-5 md:grid-cols-3">
        <div className="min-w-0">
          {data.youtube_channel.status === "ok" && data.youtube_channel.channel.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- image fournie par l'agent, affichée telle quelle
            <img src={data.youtube_channel.channel.thumbnail_url} alt={Y.photo} width={64} height={64} referrerPolicy="no-referrer" className="mb-2.5 h-16 w-16 rounded-full object-cover" />
          ) : null}
          <Group
            title={S.groups.channel}
            rows={[
              ...channelRows(data.youtube_channel),
              { label: S.rows.channel, value: data.project?.name ?? S.notDefined },
              { label: S.rows.language, value: language },
              { label: S.rows.style, value: S.notDefined },
            ]}
          />
          <VideoList state={data.youtube_videos} />
        </div>
        <Group
          title={S.groups.production}
          rows={[
            { label: S.rows.voice, value: voice?.voice_id ? `ElevenLabs · ${voice.voice_id}` : S.notConfigured, note: voice?.model_id },
            { label: S.rows.workflow, value: S.transitions(data.workflow.transitions), note: S.approvals(data.workflow.approval_required_on.length) },
          ]}
        />
        <div className="min-w-0">
          <Group
            title={S.groups.security}
            rows={[
              { label: S.rows.comments, value: S.commentsValue, note: S.commentsNote },
              { label: S.rows.publication, value: S.publicationNotConnected, note: data.publication.approval_required ? S.publicationNote : undefined },
            ]}
          />
          <button type="button" onClick={onConnectGoogle} className={`mt-2.5 ${BUTTON_DARK}`}>
            {S.googleConnect}
          </button>
        </div>
      </div>
    </Panel>
  );
}

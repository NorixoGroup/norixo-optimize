import { Activity } from "lucide-react";

import { COPY } from "../copy";
import { formatDateTime } from "../format";
import type { ActivityKind } from "../studioState";
import { Panel } from "./shared/Panel";
import { StatusBadge } from "./shared/StatusBadge";

export type ActivityView = { kind: ActivityKind; text: string; at: string | null };

export function CurrentActivityCard({ activity }: { activity: ActivityView }) {
  const tone = activity.kind === "running" || activity.kind === "locked" ? "amber" : "slate";

  return (
    <Panel id="activity" title={COPY.activity.title} aside={<StatusBadge tone={tone}>{COPY.activity.badges[activity.kind]}</StatusBadge>}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 text-slate-600">
          <Activity aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-900">{activity.kind === "idle" ? COPY.activity.idle : activity.text}</p>
          {activity.kind === "last_action" ? <p className="mt-1 text-xs text-slate-600">{COPY.activity.lastAction} · {formatDateTime(activity.at)}</p> : null}
        </div>
      </div>
    </Panel>
  );
}

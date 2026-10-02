"use client";

import type { DiagnosticReport, DiagnosticStep } from "@/lib/youtube-agent/types";

import { COPY } from "../copy";
import { stepNarrative } from "../diagnosticCopy";
import { formatDateTime } from "../format";
import { StatusBadge, type BadgeTone } from "./shared/StatusBadge";
import { BUTTON_DARK, KICKER } from "./shared/styles";

const TONE: Record<DiagnosticStep["status"], BadgeTone> = { ok: "green", warn: "amber", fail: "rose", skipped: "slate" };
const D = COPY.diagnostic;
const LABEL = "text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600";

function Row({ label, step }: { label: string; step: DiagnosticStep | undefined }) {
  const status = step?.status ?? "skipped";
  const { cause, action, ok } = stepNarrative(step);

  return (
    <li className="nk-card-soft min-w-0 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <StatusBadge tone={TONE[status]}>{D.states[status]}</StatusBadge>
      </div>
      {ok ? <p className="mt-1 text-xs text-slate-700">{ok}</p> : null}
      {status === "skipped" ? <p className="mt-1 text-xs text-slate-700">{D.skippedNote}</p> : null}
      {cause ? (
        <dl className="mt-2 space-y-1.5 text-xs leading-5">
          <div><dt className="inline font-bold uppercase tracking-[0.1em] text-slate-600">{D.cause} : </dt><dd className="inline text-slate-800">{cause}</dd></div>
          {action ? <div><dt className="inline font-bold uppercase tracking-[0.1em] text-slate-600">{D.action} : </dt><dd className="inline font-medium text-slate-950">{action}</dd></div> : null}
        </dl>
      ) : null}
    </li>
  );
}

export function DiagnosticScreen({ report, busy, onRetry }: { report: DiagnosticReport; busy: boolean; onRetry: () => void }) {
  const byId = new Map(report.steps.map((s) => [s.id, s]));
  const blocking = report.steps.find((s) => s.id === report.blocking_step);
  const blockingText = stepNarrative(blocking);
  const environment = byId.get("environment");
  const environmentText = stepNarrative(environment);
  const reachable = byId.get("reachability")?.status === "ok";

  return (
    <section aria-labelledby="diagnostic-title" className="nk-card nk-border nk-card-lg p-5 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2 text-center">
          <p className={KICKER}>{D.kicker}</p>
          <h2 id="diagnostic-title" className="text-2xl font-semibold tracking-tight text-slate-950"><span aria-hidden="true" className="mr-2">⛔</span>{D.title}</h2>
          <p className="text-sm leading-6 text-slate-700">{D.text}</p>
        </div>

        {blocking && blockingText.cause ? (
          <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50/80 p-4 text-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-800">{D.likelyCause}</p>
            <p className="mt-1 font-semibold text-slate-950">{blockingText.cause}</p>
            {blockingText.action ? <p className="mt-2 text-slate-800"><span className="font-bold">{D.action} : </span>{blockingText.action}</p> : null}
          </div>
        ) : null}

        <ul className="grid gap-3 md:grid-cols-2" aria-label={D.checksLabel}>
          {D.rows.map(([id, label]) => <Row key={id} label={label} step={byId.get(id)} />)}
        </ul>

        {environment && environment.status !== "ok" && environmentText.cause ? (
          <p className="rounded-2xl border border-amber-300 bg-amber-50/80 p-3 text-xs leading-5 text-amber-950">
            <span className="font-bold">{D.environment} : </span>{environmentText.cause} {environmentText.action}
          </p>
        ) : null}

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="nk-card-soft px-4 py-3"><dt className={LABEL}>{D.localAgent}</dt><dd className="mt-1 font-semibold text-slate-900">{reachable ? D.agentConnected : D.agentUnavailable}</dd></div>
          <div className="nk-card-soft px-4 py-3"><dt className={LABEL}>{D.lastCheck}</dt><dd className="mt-1 text-slate-900">{formatDateTime(report.checked_at)}</dd></div>
          <div className="nk-card-soft px-4 py-3"><dt className={LABEL}>{D.latency}</dt><dd className="mt-1 text-slate-900">{report.latency_ms === null ? "—" : `${report.latency_ms} ms`}</dd></div>
        </dl>

        <div className="flex justify-center">
          <button type="button" onClick={onRetry} disabled={busy} className={`${BUTTON_DARK} px-5 disabled:cursor-not-allowed disabled:opacity-60`}>
            {busy ? D.retrying : D.retry}
          </button>
        </div>
      </div>
    </section>
  );
}

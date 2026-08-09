import React from "react";

export type AutomationSummaryProps = {
  heading: string;
  statusLabel: string;
  issueMessage: string | null;
  issueTaskLabel: string | null;
  completedTasks: number;
  retriedTasks: number;
  deadLetterTasks: number;
  workerInvocations: number;
  stoppedBecauseLabel: string;
  runDispositionLabel: string;
  taskDispositionLabels: readonly string[];
};

export default function AutomationSummary({
  heading,
  statusLabel,
  issueMessage,
  issueTaskLabel,
  completedTasks,
  retriedTasks,
  deadLetterTasks,
  workerInvocations,
  stoppedBecauseLabel,
  runDispositionLabel,
  taskDispositionLabels,
}: AutomationSummaryProps) {
  return (
    <>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{heading}</p>
      <p className="mt-2 font-semibold text-slate-900">{statusLabel}</p>

      {issueMessage ? (
        <div className="mt-2 text-slate-600">
          <p>{issueMessage}</p>
          {issueTaskLabel ? <p className="mt-1 text-xs">Tâche concernée : {issueTaskLabel}</p> : null}
        </div>
      ) : null}

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Tâches terminées</dt>
          <dd className="font-semibold">{completedTasks}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Retries</dt>
          <dd className="font-semibold">{retriedTasks}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Dead-letter</dt>
          <dd className="font-semibold">{deadLetterTasks}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Invocations Worker</dt>
          <dd className="font-semibold">{workerInvocations}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Arrêt</dt>
          <dd className="font-semibold">{stoppedBecauseLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Run</dt>
          <dd className="font-semibold">{runDispositionLabel}</dd>
        </div>
      </dl>

      <p className="mt-3 text-slate-600">Tâches : {taskDispositionLabels.join(" · ")}</p>
    </>
  );
}

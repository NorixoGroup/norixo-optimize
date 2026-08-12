import React from "react";

type Props = {
  outreachLabel: string;
  followUpLabel: string;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onClose(): void;
  onConfirm(): void;
};

export default function OutreachFollowUpPrepareDialog({
  outreachLabel,
  followUpLabel,
  submitting,
  error,
  success,
  onClose,
  onConfirm,
}: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="outreach-follow-up-prepare-title" className="fixed inset-0 z-50 bg-slate-950/40 p-4">
      <div className="mx-auto mt-12 max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="outreach-follow-up-prepare-title" className="text-xl font-semibold text-slate-950">Préparer la relance</h2>
        <p className="mt-2 text-sm text-slate-600">{outreachLabel}</p>
        <p className="mt-2 text-sm text-slate-600">{followUpLabel}</p>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Préparer cette relance créera une nouvelle tentative et un brouillon à relire. Aucun email ne sera envoyé.</p>
        {error ? <p role="alert" className="mt-4 text-sm text-rose-800">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-emerald-800">{success}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Fermer</button>
          <button type="button" onClick={onConfirm} disabled={submitting} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Préparation…" : "Préparer la relance"}</button>
        </div>
      </div>
    </div>
  );
}

import React from "react";

type Props = {
  outreach: {
    id: string;
    outreachKey: string;
    contact: string | null;
    channel: string;
  };
  responseKind: "positive" | "negative" | null;
  stopReason: string;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onClose(): void;
  onResponseKindChange(value: "positive" | "negative"): void;
  onStopReasonChange(value: string): void;
  onConfirm(): void;
};

export default function OutreachResponseDialog({
  outreach,
  responseKind,
  stopReason,
  submitting,
  error,
  success,
  onClose,
  onResponseKindChange,
  onStopReasonChange,
  onConfirm,
}: Props) {
  const canConfirm = responseKind === "positive" || (responseKind === "negative" && stopReason.trim() !== "");

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="outreach-response-title" className="fixed inset-0 z-50 bg-slate-950/40 p-4">
      <div className="mx-auto mt-12 max-w-xl rounded-3xl bg-white p-6">
        <h2 id="outreach-response-title">Réponse reçue</h2>
        <p>{outreach.outreachKey}</p>
        <p>{outreach.contact ?? "Contact inconnu"} · {outreach.channel}</p>
        <p>Aucun envoi n’est déclenché par cette action.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={submitting} onClick={() => onResponseKindChange("positive")} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Réponse positive</button>
          <button type="button" disabled={submitting} onClick={() => onResponseKindChange("negative")} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Réponse négative</button>
        </div>
        {responseKind === "negative" ? <label className="mt-4 block"><span className="block text-sm font-semibold text-slate-700">Motif du refus</span><textarea value={stopReason} onChange={(event) => onStopReasonChange(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label> : null}
        {error ? <p role="alert" className="mt-4">{error}</p> : null}
        {success ? <p className="mt-4">{success}</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" disabled={submitting} onClick={onClose} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Annuler</button>
          <button type="button" disabled={submitting || !canConfirm} onClick={onConfirm} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{submitting ? "Enregistrement…" : responseKind === "negative" ? "Confirmer le refus" : "Confirmer la réponse positive"}</button>
        </div>
      </div>
    </div>
  );
}

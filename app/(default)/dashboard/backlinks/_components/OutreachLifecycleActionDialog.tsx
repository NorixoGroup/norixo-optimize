import React from "react";

type LifecycleAction = "mark_no_response" | "open_conversation" | "close";

type Props = {
  outreach: {
    id: string;
    outreachKey: string;
    status: string;
    currentAttempt: number;
    maxAttempts: number;
    closedAt: string | null;
    stopReason: string | null;
  };
  action: LifecycleAction;
  stopReason: string;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onClose(): void;
  onStopReasonChange(value: string): void;
  onConfirm(): void;
};

export default function OutreachLifecycleActionDialog({
  outreach,
  action,
  stopReason,
  submitting,
  error,
  success,
  onClose,
  onStopReasonChange,
  onConfirm,
}: Props) {
  const noResponseEligible = outreach.currentAttempt === outreach.maxAttempts;
  const requiresStopReason = action === "close";
  const canConfirm = !submitting && (action !== "mark_no_response" || noResponseEligible) && (!requiresStopReason || stopReason.trim() !== "");
  const title = action === "mark_no_response" ? "Aucune réponse" : action === "open_conversation" ? "Ouvrir la conversation" : "Clôturer l’outreach";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="outreach-lifecycle-action-title" className="fixed inset-0 z-50 bg-slate-950/40 p-4">
      <div className="mx-auto mt-12 max-w-xl rounded-3xl bg-white p-6">
        <h2 id="outreach-lifecycle-action-title">{title}</h2>
        <p>{outreach.outreachKey}</p>
        {action === "mark_no_response" ? <><p>Confirmer qu’aucune réponse n’a été reçue.</p><p>Tentatives : {outreach.currentAttempt} / {outreach.maxAttempts}</p>{!noResponseEligible ? <p role="alert">Toutes les tentatives autorisées doivent être utilisées avant de confirmer l’absence de réponse.</p> : null}</> : null}
        {action === "open_conversation" ? <p>Cette action indique qu’une réponse positive nécessite maintenant un suivi humain.</p> : null}
        {action === "close" ? <><p>Cette action clôture cet outreach. Aucun nouvel envoi ne sera proposé.</p><label className="mt-4 block"><span className="block text-sm font-semibold text-slate-700">Motif d’arrêt</span><textarea value={stopReason} onChange={(event) => onStopReasonChange(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label></> : null}
        {outreach.closedAt ? <p className="mt-4">Clôturé le : {outreach.closedAt}</p> : null}
        {outreach.stopReason ? <p className="mt-2">Motif d’arrêt : {outreach.stopReason}</p> : null}
        {error ? <p role="alert" className="mt-4">{error}</p> : null}
        {success ? <p className="mt-4">{success}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button type="button" disabled={submitting} onClick={onClose} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Annuler</button>
          <button type="button" disabled={!canConfirm} onClick={onConfirm} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{submitting ? "Enregistrement…" : "Confirmer"}</button>
        </div>
      </div>
    </div>
  );
}

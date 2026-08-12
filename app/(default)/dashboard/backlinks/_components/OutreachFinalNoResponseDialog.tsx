import React from "react";

type Props = {
  outreachLabel: string;
  responseDeadlineAt: string | null;
  currentAttempt: number;
  maxAttempts: number;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onClose(): void;
  onConfirm(): void;
};

export default function OutreachFinalNoResponseDialog({
  outreachLabel,
  responseDeadlineAt,
  currentAttempt,
  maxAttempts,
  submitting,
  error,
  success,
  onClose,
  onConfirm,
}: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="outreach-final-no-response-title" className="fixed inset-0 z-50 bg-slate-950/40 p-4">
      <div className="mx-auto mt-12 max-w-xl rounded-3xl bg-white p-6">
        <h2 id="outreach-final-no-response-title">Marquer sans réponse</h2>
        <p>{outreachLabel}</p>
        <p>Confirmer l’absence de réponse ?</p>
        <p>La fenêtre finale de réponse est expirée. Cette action clôturera l’Outreach comme sans réponse.</p>
        {responseDeadlineAt ? <p>Délai de réponse expiré : {responseDeadlineAt}</p> : null}
        <p>Tentatives : {currentAttempt} / {maxAttempts}</p>
        <p>Aucun message ne sera envoyé.</p>
        {error ? <p role="alert">{error}</p> : null}
        {success ? <p>{success}</p> : null}
        <div className="mt-6 flex gap-3">
          <button type="button" disabled={submitting} onClick={onClose}>Annuler</button>
          <button type="button" disabled={submitting} onClick={onConfirm}>{submitting ? "Validation…" : "Marquer sans réponse"}</button>
        </div>
      </div>
    </div>
  );
}

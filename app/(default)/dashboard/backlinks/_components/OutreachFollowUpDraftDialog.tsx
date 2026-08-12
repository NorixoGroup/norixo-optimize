import React from "react";

type Draft = {
  attemptId: string;
  followUpNumber: number;
  subject: string;
  body: string;
  preparedAt: string;
  updatedAt: string;
};

type Props = {
  outreachLabel: string;
  draft: Draft | null;
  loading: boolean;
  dirty: boolean;
  submitting: boolean;
  sendSubmitting: boolean;
  sendConfirmationOpen: boolean;
  error: string | null;
  success: string | null;
  sendError: string | null;
  sendSuccess: string | null;
  onClose(): void;
  onSubjectChange(value: string): void;
  onBodyChange(value: string): void;
  onSave(): void;
  onRequestSend(): void;
  onCancelSendConfirmation(): void;
  onConfirmSend(): void;
};

export type OutreachFollowUpDraftDialogDraft = Draft;

export default function OutreachFollowUpDraftDialog({
  outreachLabel,
  draft,
  loading,
  dirty,
  submitting,
  sendSubmitting,
  sendConfirmationOpen,
  error,
  success,
  sendError,
  sendSuccess,
  onClose,
  onSubjectChange,
  onBodyChange,
  onSave,
  onRequestSend,
  onCancelSendConfirmation,
  onConfirmSend,
}: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="outreach-follow-up-draft-title" className="fixed inset-0 z-50 bg-slate-950/40 p-4">
      <div className="mx-auto mt-12 max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="outreach-follow-up-draft-title" className="text-xl font-semibold text-slate-950">Relire la relance</h2>
            <p className="mt-1 text-sm text-slate-600">{outreachLabel}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting || sendSubmitting} className="rounded-full px-3 py-1 text-sm font-semibold text-slate-600">Fermer</button>
        </div>
        {loading ? <p className="mt-4 text-sm text-slate-600">Chargement du brouillon canonique…</p> : null}
        {!loading && draft ? (
          <>
            <p className="mt-4 text-sm text-slate-600">Relance #{draft.followUpNumber} · Préparée le {draft.preparedAt}</p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Sujet
                <textarea value={draft.subject} onChange={(event) => onSubjectChange(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Corps
                <textarea value={draft.body} onChange={(event) => onBodyChange(event.target.value)} rows={10} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono whitespace-pre-wrap" />
              </label>
              <p className="text-sm text-slate-600">Le contenu reste en texte brut. Aucune mise en forme riche n’est appliquée.</p>
              <p className="text-sm text-slate-600">Aucun auto-envoi. Enregistrer ne déclenche pas l’envoi.</p>
              <p className="text-sm text-slate-600">Dernière version canonique mise à jour le {draft.updatedAt}.</p>
              {dirty ? <p role="status" className="text-sm text-amber-700">Enregistrez les modifications avant l’envoi.</p> : null}
              {error ? <p role="alert" className="text-sm text-rose-800">{error}</p> : null}
              {success ? <p role="status" className="text-sm text-emerald-800">{success}</p> : null}
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={onSave} disabled={submitting || sendSubmitting} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{submitting ? "Enregistrement…" : "Enregistrer"}</button>
                <button type="button" onClick={onRequestSend} disabled={submitting || sendSubmitting || draft.subject.trim() === "" || draft.body.trim() === ""} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Envoyer la relance</button>
              </div>
              {sendConfirmationOpen ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">Confirmer l’envoi de cette relance ?</p>
                  <p className="mt-2 text-sm text-amber-800">L’email sera envoyé au contact avec le contenu actuellement enregistré.</p>
                  <div className="mt-4 flex justify-end gap-3">
                    <button type="button" onClick={onCancelSendConfirmation} disabled={sendSubmitting} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600">Annuler</button>
                    <button type="button" onClick={onConfirmSend} disabled={sendSubmitting} className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{sendSubmitting ? "Envoi…" : "Envoyer la relance"}</button>
                  </div>
                </div>
              ) : null}
              {sendError ? <p role="alert" className="text-sm text-rose-800">{sendError}</p> : null}
              {sendSuccess ? <p role="status" className="text-sm text-emerald-800">{sendSuccess}</p> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

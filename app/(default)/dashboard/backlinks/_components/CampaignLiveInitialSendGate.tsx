"use client";

import { useState } from "react";

type GateResponse = {
  ok: true;
  campaign: { id: string; liveInitialSendEnabled: boolean };
};

type Props = {
  campaignId: string;
  campaignKey: string;
  campaignName: string;
  enabled: boolean;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  onChanged: (campaignId: string, enabled: boolean) => Promise<void>;
};

export default function CampaignLiveInitialSendGate({
  campaignId,
  campaignKey,
  campaignName,
  enabled,
  request,
  onChanged,
}: Props) {
  const [enableConfirmationOpen, setEnableConfirmationOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = async (nextEnabled: boolean): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await request<GateResponse>(`/api/backlinks/campaigns/${campaignId}/live-initial-send`, {
        method: "PATCH",
        body: JSON.stringify({ liveInitialSendEnabled: nextEnabled }),
      });
      setEnableConfirmationOpen(false);
      await onChanged(campaignId, nextEnabled);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible de modifier l’autorisation d’envoi live.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (nextEnabled: boolean): void => {
    if (submitting) return;
    if (nextEnabled) {
      setError(null);
      setEnableConfirmationOpen(true);
      return;
    }
    void persist(false);
  };

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Autorisation des envois initiaux live">
      <label className="flex items-start gap-3 text-sm font-semibold text-slate-900">
        <input
          type="checkbox"
          checked={enabled}
          disabled={submitting}
          onChange={(event) => handleChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span>
          Autoriser les envois initiaux live
          <span className="mt-1 block text-sm font-normal text-slate-600">Autorise l’envoi initial uniquement lorsqu’un outreach possède une approbation valide. L’activation seule n’envoie aucun email.</span>
        </span>
      </label>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}

      {enableConfirmationOpen ? (
        <div role="dialog" aria-modal="true" aria-labelledby="campaign-live-initial-send-title" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <h2 id="campaign-live-initial-send-title" className="text-xl font-semibold text-slate-950">Activer les envois initiaux live</h2>
            <p className="mt-3 text-sm text-slate-600">Vous allez autoriser les envois initiaux live pour {campaignName} ({campaignKey}). Cette activation n’envoie aucun email. Un outreach doté d’une approbation valide pourra devenir éligible à un envoi explicite ultérieur.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEnableConfirmationOpen(false)} disabled={submitting} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Annuler</button>
              <button type="button" onClick={() => void persist(true)} disabled={submitting} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Activation…" : "Activer les envois live"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

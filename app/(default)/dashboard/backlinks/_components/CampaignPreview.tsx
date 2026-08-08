import React from "react";

type CampaignOption = { id: string; label: string };
type OpportunityOption = { id: string; label: string };

type Props = {
  campaigns: readonly CampaignOption[];
  campaignId: string;
  maxSelectedOpportunities: number;
  maxPerDomain: number;
  opportunities: readonly OpportunityOption[];
  totalOpportunities: number;
  selectedOpportunityIds: readonly string[];
  error: string | null;
  loading: boolean;
  result: unknown | null;
  onCampaignChange: (campaignId: string) => void;
  onMaxSelectedOpportunitiesChange: (value: string) => void;
  onMaxPerDomainChange: (value: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleOpportunity: (opportunityId: string) => void;
  onReset: () => void;
  onRun: () => void;
};

export default function CampaignPreview({
  campaigns,
  campaignId,
  maxSelectedOpportunities,
  maxPerDomain,
  opportunities,
  totalOpportunities,
  selectedOpportunityIds,
  error,
  loading,
  result,
  onCampaignChange,
  onMaxSelectedOpportunitiesChange,
  onMaxPerDomainChange,
  onSelectAll,
  onClearSelection,
  onToggleOpportunity,
  onReset,
  onRun,
}: Props) {
  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4" aria-label="Prévisualisation de campagne">
      <h3 className="font-semibold text-slate-900">Prévisualisation de campagne</h3>
      <p className="mt-1 text-sm text-slate-600">Exécutez une prévisualisation pour une campagne donnée. Aucune action externe n’est réalisée.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">Campagne
          <select value={campaignId} onChange={(event) => onCampaignChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Sélectionner une campagne</option>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Max sélectionnés
          <input type="number" min={1} max={100} value={maxSelectedOpportunities} onChange={(event) => onMaxSelectedOpportunitiesChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-semibold text-slate-700">Max par domaine
          <input type="number" min={1} max={100} value={maxPerDomain} onChange={(event) => onMaxPerDomainChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onSelectAll} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold">Tout sélectionner</button>
          <button type="button" onClick={onClearSelection} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold">Tout déselectionner</button>
          <div className="text-xs text-slate-500">Sélectionnées : {selectedOpportunityIds.length}</div>
        </div>
        <div className="mt-3 grid gap-2">
          {opportunities.map((opportunity) => (
            <label key={opportunity.id} className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selectedOpportunityIds.includes(opportunity.id)} onChange={() => onToggleOpportunity(opportunity.id)} />
              <span className="truncate">{opportunity.label}</span>
            </label>
          ))}
          {totalOpportunities > 50 ? <p className="text-xs text-slate-500">Affichage limité à 50 opportunités. Sélectionnez précisément ou ajustez la liste.</p> : null}
        </div>
      </div>

      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}

      <div className="mt-4 flex items-center justify-end gap-3">
        <button type="button" onClick={onReset} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Réinitialiser</button>
        <button type="button" onClick={onRun} disabled={loading} aria-busy={loading} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Exécution…" : "Lancer la prévisualisation"}</button>
      </div>

      {result ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold">Résultat</p>
          <pre className="mt-2 max-h-48 overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}

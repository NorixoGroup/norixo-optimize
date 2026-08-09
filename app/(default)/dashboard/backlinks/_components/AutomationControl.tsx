import React from "react";

type Props = {
  automationControlLoading: boolean;
  automationControlPresent: boolean;
  automationControlBacklinksEnabled: boolean;
  automationError: string | null;
  workspaceResolved: boolean;
  activeWorkspaceId: string | null;
  automationSaving: boolean;
  automationRunning: boolean;
  discoveryProvider: string;
  discoveryQuery: string;
  discoveryCountryCode: string;
  discoveryLanguageCode: string;
  discoveryMaxResults: number;
  discoveryMaxCandidates: number;
  discoveryConfigurationError: string | null;
  onToggleAutomation: () => void;
  onRunAutomationNow: () => void;
  onDiscoveryProviderChange: (value: string) => void;
  onDiscoveryQueryChange: (value: string) => void;
  onDiscoveryCountryCodeChange: (value: string) => void;
  onDiscoveryLanguageChange: (value: string) => void;
  onDiscoveryMaxResultsChange: (value: number) => void;
  onDiscoveryMaxCandidatesChange: (value: number) => void;
};

export default function AutomationControl({
  automationControlLoading,
  automationControlPresent,
  automationControlBacklinksEnabled,
  automationError,
  workspaceResolved,
  activeWorkspaceId,
  automationSaving,
  automationRunning,
  discoveryProvider,
  discoveryQuery,
  discoveryCountryCode,
  discoveryLanguageCode,
  discoveryMaxResults,
  discoveryMaxCandidates,
  discoveryConfigurationError,
  onToggleAutomation,
  onRunAutomationNow,
  onDiscoveryProviderChange,
  onDiscoveryQueryChange,
  onDiscoveryCountryCodeChange,
  onDiscoveryLanguageChange,
  onDiscoveryMaxResultsChange,
  onDiscoveryMaxCandidatesChange,
}: Props) {
  const toggleDisabled = !workspaceResolved || !activeWorkspaceId?.trim() || automationControlLoading || automationSaving || automationRunning || !automationControlPresent;
  const runDisabled = !workspaceResolved || !activeWorkspaceId?.trim() || !automationControlPresent || !automationControlBacklinksEnabled || automationControlLoading || automationSaving || automationRunning || discoveryConfigurationError !== null;

  const statusText = automationControlLoading
    ? "Chargement…"
    : !automationControlPresent
      ? "Indisponible"
      : automationControlBacklinksEnabled
        ? "Activée"
        : "Désactivée";

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">Automation Backlinks</h2>
            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700">Dry-run</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Prépare et exécute les tâches Backlinks en mode prévisualisation, sans action externe.</p>
          <p className="mt-2 text-sm font-medium text-slate-700">{statusText}</p>
          <p className="mt-1 text-xs text-slate-500">Mode sécurisé : aucune prise de contact ni création réelle de backlink.</p>
          {automationError ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{automationError}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => onToggleAutomation()} disabled={toggleDisabled} aria-busy={automationSaving} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{automationSaving ? "Enregistrement…" : automationControlBacklinksEnabled ? "Désactiver" : "Activer"}</button>
          <button type="button" onClick={() => onRunAutomationNow()} disabled={runDisabled} aria-busy={automationRunning} aria-label="Lancer l’automatisation Backlinks maintenant" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">{automationRunning ? "Exécution…" : "Lancer maintenant"}</button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
        <div>
          <label htmlFor="discovery-provider" className="block text-xs font-semibold text-slate-700">Provider</label>
          <select id="discovery-provider" name="discoveryProvider" value={discoveryProvider} onChange={(event) => onDiscoveryProviderChange(event.target.value)} disabled={automationRunning || automationSaving} aria-label="Provider Discovery" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"><option value="mock">Provider de démonstration</option><option value="brave_search">Brave Search</option></select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="automation-discovery-query" className="block text-xs font-semibold text-slate-700">Requête Discovery</label>
          <input id="automation-discovery-query" name="automation-discovery-query" type="text" autoComplete="off" value={discoveryQuery} onChange={(event) => onDiscoveryQueryChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
        </div>
        <div>
          <label htmlFor="automation-discovery-country" className="block text-xs font-semibold text-slate-700">Pays</label>
          <input id="automation-discovery-country" name="automation-discovery-country" type="text" autoComplete="off" value={discoveryCountryCode} onChange={(event) => onDiscoveryCountryCodeChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
        </div>
        <div>
          <label htmlFor="automation-discovery-language" className="block text-xs font-semibold text-slate-700">Langue</label>
          <input id="automation-discovery-language" name="automation-discovery-language" type="text" autoComplete="off" value={discoveryLanguageCode} onChange={(event) => onDiscoveryLanguageChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
        </div>
        <div>
          <label htmlFor="automation-discovery-max-results" className="block text-xs font-semibold text-slate-700">Résultats maximum</label>
          <input id="automation-discovery-max-results" name="automation-discovery-max-results" type="number" min={1} max={10} value={discoveryMaxResults} onChange={(event) => onDiscoveryMaxResultsChange(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
        </div>
        <div>
          <label htmlFor="automation-discovery-max-candidates" className="block text-xs font-semibold text-slate-700">Candidats maximum</label>
          <input id="automation-discovery-max-candidates" name="automation-discovery-max-candidates" type="number" min={1} max={50} value={discoveryMaxCandidates} onChange={(event) => onDiscoveryMaxCandidatesChange(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
        </div>
        <p className="md:col-span-5 text-xs text-slate-500">{discoveryProvider === "mock" ? "Provider de démonstration — aucun appel réseau." : "Brave Search — appel réseau réel, limité par la configuration serveur."}</p>
        {discoveryConfigurationError ? <p role="alert" className="md:col-span-5 text-sm text-rose-700">{discoveryConfigurationError}</p> : null}
      </div>
    </>
  );
}

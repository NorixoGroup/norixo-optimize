import React from "react";
import { AutomationDiscoveryPreviewView } from "./discovery-preview-types";

type Props = {
  discoveryPreview: AutomationDiscoveryPreviewView | null;
};

export default function DiscoveryPreview({ discoveryPreview }: Props) {
  if (!discoveryPreview) return null;

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4" aria-label="Candidats Discovery">
      <h3 className="font-semibold text-slate-900">Candidats Discovery</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Provider</dt>
          <dd className="font-semibold">{discoveryPreview.provider}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Recherches demandées</dt>
          <dd className="font-semibold">{discoveryPreview.summary.searchesRequested}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Résultats reçus</dt>
          <dd className="font-semibold">{discoveryPreview.summary.resultsReceived}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Candidats retenus</dt>
          <dd className="font-semibold">{discoveryPreview.summary.candidatesAccepted}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Candidats rejetés</dt>
          <dd className="font-semibold">{discoveryPreview.summary.candidatesRejected}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tronqué</dt>
          <dd className="font-semibold">{discoveryPreview.summary.truncated ? "Oui" : "Non"}</dd>
        </div>
      </dl>
      {discoveryPreview.skipped === "no_searches" ? (
        <p className="mt-3 text-slate-600">Aucune recherche Discovery n’a été demandée.</p>
      ) : discoveryPreview.candidates.length === 0 ? (
        <p className="mt-3 text-slate-600">Aucun candidat Discovery trouvé.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {discoveryPreview.candidates.slice(0, 10).map((candidate) => (
            <article key={candidate.candidateKey} className="rounded-lg border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">{candidate.pageTitle ?? "Sans titre"}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{candidate.hostname}</p>
              <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm text-sky-700 underline">
                {candidate.sourceUrl}
              </a>
              <p className="mt-2 text-xs text-slate-600">Rang : {candidate.rank} · Score technique : {candidate.discoveryScore}</p>
              {candidate.countryCode || candidate.languageCode ? (
                <p className="mt-1 text-xs text-slate-600">{[candidate.countryCode, candidate.languageCode].filter(Boolean).join(" / ")}</p>
              ) : null}
              {candidate.snippet ? <p className="mt-2 text-sm text-slate-700">{candidate.snippet}</p> : null}
              <p className="mt-2 text-xs text-slate-600">{candidate.evidenceSummary}</p>
              {candidate.suggestedAssetKey ? <p className="mt-2 text-xs text-slate-600">Asset suggéré : {candidate.suggestedAssetKey}</p> : null}
            </article>
          ))}
          {discoveryPreview.candidates.length > 10 ? (
            <p className="text-xs text-slate-500">{discoveryPreview.candidates.length - 10} candidats supplémentaires non affichés.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}

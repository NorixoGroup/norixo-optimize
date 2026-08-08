import React from "react";
import {
  qualificationConfidenceLabel,
  qualificationDecisionLabel,
  qualificationPageTypeLabel,
} from "../_utils/backlink-labels";
import type { AutomationDiscoveryPreviewView } from "./discovery-preview-types";
import type {
  AutomationQualificationPreviewView,
  QualificationFilter,
} from "./qualification-preview-types";

type Props = {
  qualificationPreview: AutomationQualificationPreviewView;
  qualificationFilter: QualificationFilter;
  visibleQualificationResults: AutomationQualificationPreviewView["results"];
  filteredQualificationResults: AutomationQualificationPreviewView["results"];
  discoveryCandidatesByKey: ReadonlyMap<string, AutomationDiscoveryPreviewView["candidates"][number]>;
  qualificationApplySubmitting: boolean;
  onQualificationFilterChange: (filter: QualificationFilter) => void;
  canRequestApply: (candidateKey: string) => boolean;
  onRequestApply: (result: AutomationQualificationPreviewView["results"][number]) => void;
};

export default function QualificationPreview({
  qualificationPreview,
  qualificationFilter,
  visibleQualificationResults,
  filteredQualificationResults,
  discoveryCandidatesByKey,
  qualificationApplySubmitting,
  onQualificationFilterChange,
  canRequestApply,
  onRequestApply,
}: Props) {
  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4" aria-label="Qualification des candidats">
      <h3 className="font-semibold text-slate-900">Qualification des candidats</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div><dt className="text-slate-500">Candidats évalués</dt><dd className="font-semibold">{qualificationPreview.summary.candidatesEvaluated}</dd></div>
        <div><dt className="text-slate-500">Qualifiés</dt><dd className="font-semibold">{qualificationPreview.summary.qualified}</dd></div>
        <div><dt className="text-slate-500">À revoir</dt><dd className="font-semibold">{qualificationPreview.summary.review}</dd></div>
        <div><dt className="text-slate-500">Rejetés</dt><dd className="font-semibold">{qualificationPreview.summary.rejected}</dd></div>
        <div><dt className="text-slate-500">Policy version</dt><dd className="font-semibold">{qualificationPreview.policyVersion}</dd></div>
      </dl>
      {qualificationPreview.results.length === 0 ? (
        <p className="mt-3 text-slate-600">Aucun candidat à qualifier.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtre de qualification">
            {([
              ["all", "Tous"],
              ["qualified", "Qualifiés"],
              ["review", "À revoir"],
              ["rejected", "Rejetés"],
            ] as const).map(([filter, label]) => (
              <button key={filter} type="button" aria-pressed={qualificationFilter === filter} onClick={() => onQualificationFilterChange(filter)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" >{label}</button>
            ))}
          </div>
          {visibleQualificationResults.length === 0 ? (
            <p className="mt-3 text-slate-600">Aucun résultat pour ce filtre.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {visibleQualificationResults.map((result) => {
                const candidate = discoveryCandidatesByKey.get(result.candidateKey);
                return (
                  <article key={result.candidateKey} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-slate-900">{candidate?.pageTitle ?? "Sans titre"}</p>
                    {candidate ? (
                      <>
                        <p className="mt-1 text-xs font-medium text-slate-500">{candidate.hostname}</p>
                        <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm text-sky-700 underline">{candidate.sourceUrl}</a>
                      </>
                    ) : <p className="mt-1 text-sm text-slate-600">Candidat non disponible dans cette session</p>}
                    <p className="mt-2 text-sm text-slate-700">Décision : {qualificationDecisionLabel(result.decision)} · Score : {result.qualificationScore}/100 · Confiance : {qualificationConfidenceLabel(result.confidence)}</p>
                    {result.proposedOpportunityType ? <p className="mt-1 text-xs text-slate-600">Type d’opportunité : {result.proposedOpportunityType}</p> : null}
                    <p className="mt-1 text-xs text-slate-600">Type de page : {qualificationPageTypeLabel(result.proposedPageType)}</p>
                    {result.flags.length > 0 ? <p className="mt-2 text-xs text-slate-600">Flags : {result.flags.join(" · ")}</p> : null}
                    {result.reasons.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-slate-600">
                        {result.reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.code} · Impact : {reason.impact >= 0 ? "+" : ""}{reason.impact} · {reason.evidence}</li>)}
                      </ul>
                    ) : null}
                    {canRequestApply(result.candidateKey) ? (
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          onClick={() => onRequestApply(result)}
                          disabled={qualificationApplySubmitting}
                          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Apply qualification
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {filteredQualificationResults.length > 10 ? <p className="text-xs text-slate-500">{filteredQualificationResults.length - 10} résultats supplémentaires non affichés.</p> : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}

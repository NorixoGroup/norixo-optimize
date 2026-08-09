import React from "react";
import type { AutomationPromotionPreviewView } from "./promotion-preview-types";
import type { AutomationDiscoveryPreviewView } from "./discovery-preview-types";
import { promotionSkipCodeLabel, qualificationConfidenceLabel } from "../_utils/backlink-labels";

type PromotionFilter = "proposals" | "skipped" | "duplicates";

type Props = {
  promotionPreview: AutomationPromotionPreviewView | null;
  promotionFilter: PromotionFilter;
  setPromotionFilter: (filter: PromotionFilter) => void;
  visiblePromotionProposals: AutomationPromotionPreviewView["proposals"];
  selectedPromotionSkippedItems: AutomationPromotionPreviewView["skippedItems"];
  visiblePromotionSkippedItems: AutomationPromotionPreviewView["skippedItems"];
  appliedPromotionProposalKeys: Readonly<Record<string, "created" | "existing">>;
  promotionApplySubmitting: boolean;
  onOpenPromotionApplyDialog: (proposal: AutomationPromotionPreviewView["proposals"][number]) => void;
  promotionTaskId: string | null | undefined;
  discoveryCandidatesByKey: Map<string, AutomationDiscoveryPreviewView["candidates"][number] | undefined>;
};

export default function PromotionPreview({
  promotionPreview,
  promotionFilter,
  setPromotionFilter,
  visiblePromotionProposals,
  selectedPromotionSkippedItems,
  visiblePromotionSkippedItems,
  appliedPromotionProposalKeys,
  promotionApplySubmitting,
  onOpenPromotionApplyDialog,
  promotionTaskId,
  discoveryCandidatesByKey,
}: Props) {
  if (!promotionPreview) return null;

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4" aria-label="Promotion Preview">
      <h3 className="font-semibold text-slate-900">Promotion Preview</h3>
      <p className="mt-1 text-sm text-slate-600">Aucune opportunité Backlinks n’a été créée. Le preview est uniquement une proposition de travail.</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div><dt className="text-slate-500">Résultats Qualification</dt><dd className="font-semibold">{promotionPreview.summary.qualificationResults}</dd></div>
        <div><dt className="text-slate-500">Éligibles</dt><dd className="font-semibold">{promotionPreview.summary.eligible}</dd></div>
        <div><dt className="text-slate-500">Propositions</dt><dd className="font-semibold">{promotionPreview.summary.proposed}</dd></div>
        <div><dt className="text-slate-500">Ignorés</dt><dd className="font-semibold">{promotionPreview.summary.skipped}</dd></div>
        <div><dt className="text-slate-500">Doublons</dt><dd className="font-semibold">{promotionPreview.summary.duplicates}</dd></div>
        <div><dt className="text-slate-500">Policy version</dt><dd className="font-semibold">{promotionPreview.policyVersion}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtre de promotion">
        {([
          ["proposals", "Propositions"],
          ["skipped", "Ignorés"],
          ["duplicates", "Doublons"],
        ] as const).map(([filter, label]) => (
          <button key={filter} type="button" aria-pressed={promotionFilter === filter} onClick={() => setPromotionFilter(filter)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">{label}</button>
        ))}
      </div>
      {promotionFilter === "proposals" ? (
        promotionPreview.proposals.length === 0 ? <p className="mt-3 text-slate-600">Aucune proposition de promotion.</p> : (
          <div className="mt-3 space-y-3">
            {visiblePromotionProposals.map((proposal) => (
              <article key={proposal.proposalKey} className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-900">{proposal.targetPageTitle} <span className="text-xs font-medium text-slate-500">Brouillon uniquement</span></p>
                <p className="mt-1 text-xs font-medium text-slate-500">{proposal.hostname}</p>
                <a href={proposal.targetPageUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm text-sky-700 underline">{proposal.targetPageUrl}</a>
                <p className="mt-2 text-sm text-slate-700">Type d’opportunité : {proposal.opportunityType} · Type de page : {proposal.pageType}</p>
                <p className="mt-1 text-xs text-slate-600">Priorité : {proposal.priority} · Score Qualification : {proposal.qualificationScore}/100 · Confiance : {qualificationConfidenceLabel(proposal.qualificationConfidence)}</p>
                <p className="mt-2 text-xs text-slate-600">{proposal.evidenceSummary}</p>
                {proposal.suggestedAssetKey ? <p className="mt-2 text-xs text-slate-600">Asset suggéré : {proposal.suggestedAssetKey}</p> : null}
                {appliedPromotionProposalKeys[proposal.proposalKey] ? (
                  <p className="mt-3 text-sm font-semibold text-emerald-700">
                    {appliedPromotionProposalKeys[proposal.proposalKey] === "created"
                      ? "Opportunité créée"
                      : "Opportunité existante"}
                  </p>
                ) : promotionTaskId ? (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => onOpenPromotionApplyDialog(proposal)}
                    disabled={promotionApplySubmitting}
                    className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Créer l’opportunité
                  </button>
                ) : null}
              </article>
            ))}
            {promotionPreview.proposals.length > 10 ? <p className="text-xs text-slate-500">{promotionPreview.proposals.length - 10} éléments supplémentaires non affichés.</p> : null}
          </div>
        )
      ) : (
        selectedPromotionSkippedItems.length === 0 ? <p className="mt-3 text-slate-600">{promotionFilter === "duplicates" ? "Aucun doublon détecté." : "Aucun élément ignoré."}</p> : (
          <div className="mt-3 space-y-3">
            {visiblePromotionSkippedItems.map((item, index) => {
              const candidate = discoveryCandidatesByKey.get(item.candidateKey);
              return (
                <article key={`${item.candidateKey}-${index}`} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">{candidate?.pageTitle ?? "Candidat non disponible dans cette session"}</p>
                  {candidate ? <p className="mt-1 text-xs font-medium text-slate-500">{candidate.hostname}</p> : null}
                  <p className="mt-2 text-sm text-slate-700">Ignoré : {promotionSkipCodeLabel(item.skipCode)}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.evidence}</p>
                </article>
              );
            })}
            {selectedPromotionSkippedItems.length > 10 ? <p className="text-xs text-slate-500">{selectedPromotionSkippedItems.length - 10} éléments supplémentaires non affichés.</p> : null}
          </div>
        )
      )}
    </section>
  );
}

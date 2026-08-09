import React from "react";

type Props = {
  dialog: {
    candidateKey: string;
    pageTitle: string | null;
    hostname: string;
    sourceUrl: string;
  };
  assets: readonly { id: string; label: string }[];
  assetId: string;
  submitting: boolean;
  error: string | null;
  success: {
    opportunityDisposition: "created" | "existing";
    domainDisposition: "created" | "existing";
  } | null;
  onClose: () => void;
  onAssetChange: (assetId: string) => void;
  onConfirm: () => void;
};

export default function DiscoveryOpportunityIntakeDialog({
  dialog,
  assets,
  assetId,
  submitting,
  error,
  success,
  onClose,
  onAssetChange,
  onConfirm,
}: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="discovery-opportunity-intake-title" className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 id="discovery-opportunity-intake-title" className="text-xl font-semibold text-slate-950">Ajouter aux opportunités</h2>
            <p className="mt-1 text-sm text-slate-600">{dialog.pageTitle ?? "Sans titre"}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Fermer</button>
        </div>
        <dl className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <div><dt className="text-slate-500">Domaine</dt><dd className="font-semibold">{dialog.hostname}</dd></div>
          <div><dt className="text-slate-500">URL</dt><dd className="break-all font-semibold">{dialog.sourceUrl}</dd></div>
        </dl>
        <p className="mt-4 text-sm text-slate-600">Cette action créera ou réutilisera le domaine et l’opportunité Backlinks.</p>
        {assets.length === 0 ? (
          <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Aucun asset actif n’est disponible. Créez ou réactivez un asset avant de continuer.</p>
        ) : (
          <label htmlFor="discovery-opportunity-intake-asset" className="mt-5 block text-sm font-semibold text-slate-700">
            Asset cible
            <select id="discovery-opportunity-intake-asset" value={assetId} onChange={(event) => onAssetChange(event.target.value)} disabled={submitting || success !== null} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal">
              <option value="">Sélectionner un asset</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}
            </select>
          </label>
        )}
        {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
        {success ? (
          <div role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <p>{success.opportunityDisposition === "created" ? "Opportunité créée avec succès." : "Cette opportunité existait déjà et a été réutilisée."}</p>
            <p className="mt-1">{success.domainDisposition === "created" ? "Domaine créé automatiquement." : "Domaine existant réutilisé."}</p>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Annuler</button>
          <button type="button" onClick={onConfirm} disabled={submitting || success !== null || !assetId || assets.length === 0} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Ajout…" : "Confirmer l’ajout"}</button>
        </div>
      </div>
    </div>
  );
}

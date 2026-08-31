"use client";

type Props = {
  contactName: string;
  linkedinUrl: string | null;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export default function OutreachManualLinkedInContactDialog({ contactName, linkedinUrl, submitting, error, success, onConfirm, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
      <section aria-modal="true" aria-labelledby="manual-linkedin-contact-title" role="dialog" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="manual-linkedin-contact-title" className="text-lg font-semibold text-slate-950">Enregistrer le contact LinkedIn</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">Norixo n’enverra aucun message LinkedIn. Confirmez uniquement si vous avez déjà envoyé le message manuellement.</p>
        <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <div><dt className="font-semibold text-slate-950">Contact</dt><dd>{contactName}</dd></div>
          <div><dt className="font-semibold text-slate-950">Destination LinkedIn</dt><dd className="break-all">{linkedinUrl ?? "URL LinkedIn indisponible"}</dd></div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-slate-700">L’enregistrement créera la tentative n°1 et marquera l’outreach comme actif. Aucun suivi LinkedIn automatique ne sera envoyé.</p>
        {error ? <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p> : null}
        {success ? <p role="status" className="mt-4 text-sm text-emerald-700">{success}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Annuler</button>
          <button type="button" onClick={onConfirm} disabled={submitting || success != null} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Enregistrement…" : "Confirmer le contact manuel"}</button>
        </div>
      </section>
    </div>
  );
}

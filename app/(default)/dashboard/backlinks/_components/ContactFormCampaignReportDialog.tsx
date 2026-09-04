"use client";

export type ContactFormCampaignReportResult = {
  campaign_id: string;
  generated_at: string;
  semantics: {
    submission_confirmed: string;
    delivery: string;
    reply: string;
    backlink: string;
  };
  summary: {
    total: number;
    approved: number;
    not_approved: number;
    not_queued: number;
    submission_confirmed: number;
    submission_ambiguous: number;
    blocked_captcha: number;
    blocked_policy: number;
    failed_pre_submit: number;
    manual_review: number;
    other_active: number;
  };
  items: Array<{
    outreach_id: string;
    outreach_key: string;
    outreach_status: string;
    approval_state: string;
    run_state: string;
    submit_state: string;
    evidence_state: string;
    delivery_state: "unknown";
    reply_state: "unknown";
    backlink_state: "unknown";
    block_reason: string | null;
    next_action: string;
    updated_at: string | null;
  }>;
};

type Props = {
  campaignLabel: string;
  loading: boolean;
  error: string | null;
  result: ContactFormCampaignReportResult | null;
  onClose: () => void;
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

const NEXT_ACTION_LABELS: Record<string, string> = {
  approve: "Approbation requise",
  worker: "Traitement automatisé en attente",
  manual_review: "Revue manuelle requise",
  submission_complete: "Soumission confirmée — aucune action automatique suivante",
};

function nextActionLabel(input: string | null | undefined) {
  if (!input || !input.trim()) return "—";
  return NEXT_ACTION_LABELS[input] ?? input;
}

export default function ContactFormCampaignReportDialog({
  campaignLabel,
  loading,
  error,
  result,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Reporting formulaires</h2>
            <p className="mt-1 text-sm text-slate-600">{campaignLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold">
            Fermer
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
          Vue de reporting uniquement. Aucun formulaire n’est approuvé, mis en file d’attente,
          soumis ou relancé depuis cette fenêtre.
        </div>

        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Une soumission confirmée signifie uniquement qu’une preuve explicite de soumission a été
          observée par l’automate. Elle ne prouve ni la livraison au destinataire, ni une réponse,
          ni la publication d’un backlink.
        </div>

        {loading ? <p className="mt-6 text-sm text-slate-600">Chargement…</p> : null}
        {error ? <p className="mt-6 text-sm font-semibold text-red-700">{error}</p> : null}

        {result ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total" value={result.summary.total} />
              <Stat label="Approuvés" value={result.summary.approved} />
              <Stat label="Non approuvés" value={result.summary.not_approved} />
              <Stat label="Non mis en file" value={result.summary.not_queued} />
              <Stat label="Soumissions confirmées" value={result.summary.submission_confirmed} />
              <Stat label="Soumissions ambiguës" value={result.summary.submission_ambiguous} />
              <Stat label="CAPTCHA" value={result.summary.blocked_captcha} />
              <Stat label="Policy block" value={result.summary.blocked_policy} />
              <Stat label="Échec pré-submit" value={result.summary.failed_pre_submit} />
              <Stat label="Revue manuelle" value={result.summary.manual_review} />
              <Stat label="Actifs / autres" value={result.summary.other_active} />
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-3 py-2">Outreach</th>
                    <th className="px-3 py-2">Approbation</th>
                    <th className="px-3 py-2">Run</th>
                    <th className="px-3 py-2">Soumission</th>
                    <th className="px-3 py-2">Preuve</th>
                    <th className="px-3 py-2">Livraison</th>
                    <th className="px-3 py-2">Réponse</th>
                    <th className="px-3 py-2">Backlink</th>
                    <th className="px-3 py-2">Suite</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr key={item.outreach_id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3 font-semibold text-slate-900">{item.outreach_key}</td>
                      <td className="px-3 py-3">{item.approval_state}</td>
                      <td className="px-3 py-3">{item.run_state}</td>
                      <td className="px-3 py-3">{item.submit_state}</td>
                      <td className="px-3 py-3">{item.evidence_state}</td>
                      <td className="px-3 py-3">{item.delivery_state}</td>
                      <td className="px-3 py-3">{item.reply_state}</td>
                      <td className="px-3 py-3">{item.backlink_state}</td>
                      <td className="px-3 py-3">
                        {nextActionLabel(item.next_action)}
                        {item.block_reason ? <div className="mt-1 text-xs text-red-700">{item.block_reason}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.items.length === 0 ? (
              <p className="mt-6 text-sm text-slate-600">
                Aucun outreach contact_form dans cette campagne.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

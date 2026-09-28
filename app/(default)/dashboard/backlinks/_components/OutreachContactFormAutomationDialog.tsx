"use client";

import { useState } from "react";

export type ContactFormDashboardView = {
  channel: "contact_form";
  approval_state: string;
  run_state: string;
  last_event: string | null;
  form_url: string | null;
  discovery_state: string;
  mapping_state: string;
  fill_state: string;
  pre_submit_state: string;
  submit_state: string;
  evidence_state: string;
  attempt_state: string;
  delivery_state: "unknown";
  reply_state: "unknown";
  backlink_state: "unknown";
  block_reason: string | null;
  next_action: string;
  approved_at: string | null;
  queued_at: string | null;
  submit_started_at: string | null;
  finished_at: string | null;
  updated_at: string | null;
};

export type ContactFormAutomationEvent = {
  id: string;
  event_type: string;
  state: string;
  occurred_at: string;
  safe_error_code?: string | null;
};

export type ContactFormAutomationResult = {
  dashboard: ContactFormDashboardView;
  events: ContactFormAutomationEvent[];
  finalAttemptId: string | null;
  finalAttemptStatus: string | null;
};

export type ContactFormApprovalInput = {
  senderName: string;
  senderEmail: string;
  senderCompany: string;
  senderWebsite: string;
  senderFirstName: string | null;
  senderLastName: string | null;
};

type Props = {
  outreachKey: string;
  loading: boolean;
  error: string | null;
  result: ContactFormAutomationResult | null;
  approvalSubmitting: boolean;
  approvalError: string | null;
  approvalSuccess: string | null;
  onApprove: (input: ContactFormApprovalInput) => void;
  onClose: () => void;
};

function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("fr-FR");
}

function value(input: string | null | undefined) {
  return input && input.trim() ? input : "—";
}

const NEXT_ACTION_LABELS: Record<string, string> = {
  approve: "Approbation requise",
  worker: "Traitement automatisé en attente",
  manual_review: "Revue manuelle requise",
  submission_complete: "Soumission confirmée — aucune action automatique suivante",
};

function nextActionLabel(input: string | null | undefined) {
  const raw = value(input);
  return raw === "—" ? raw : NEXT_ACTION_LABELS[raw] ?? raw;
}

export default function OutreachContactFormAutomationDialog({
  outreachKey,
  loading,
  error,
  result,
  approvalSubmitting,
  approvalError,
  approvalSuccess,
  onApprove,
  onClose,
}: Props) {
  const dashboard = result?.dashboard ?? null;
  const [senderName, setSenderName] = useState("");
  const [senderFirstName, setSenderFirstName] = useState("");
  const [senderLastName, setSenderLastName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderCompany, setSenderCompany] = useState("");
  const [senderWebsite, setSenderWebsite] = useState("");

  const approvalAvailable =
    dashboard?.next_action === "approve" &&
    dashboard.approval_state !== "approved";

  const approvalReady =
    senderName.trim().length > 0 &&
    senderEmail.trim().length > 0 &&
    senderCompany.trim().length > 0 &&
    senderWebsite.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-form-automation-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="contact-form-automation-title"
              className="text-lg font-semibold text-slate-950"
            >
              Automatisation du formulaire de contact
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {outreachKey}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          >
            Fermer
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          L’approbation ci-dessous enregistre uniquement l’identité d’expéditeur
          confirmée par un administrateur. Elle ne soumet aucun formulaire externe.
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-slate-600">
            Chargement de l’historique…
          </p>
        ) : error ? (
          <p className="mt-5 text-sm text-red-700">{error}</p>
        ) : !dashboard ? (
          <p className="mt-5 text-sm text-slate-600">
            Aucun historique disponible.
          </p>
        ) : (
          <>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Approbation", dashboard.approval_state],
                ["Exécution", dashboard.run_state],
                ["Découverte", dashboard.discovery_state],
                ["Mapping", dashboard.mapping_state],
                ["Remplissage", dashboard.fill_state],
                ["Pré-soumission", dashboard.pre_submit_state],
                ["Soumission", dashboard.submit_state],
                ["Preuve", dashboard.evidence_state],
                ["Tentative", dashboard.attempt_state],
                ["Livraison", dashboard.delivery_state],
                ["Réponse", dashboard.reply_state],
                ["Backlink", dashboard.backlink_state],
              ].map(([label, state]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-slate-900">
                    {value(state)}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <h3 className="font-medium text-slate-950">Détails</h3>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Dernier événement</dt>
                  <dd>{value(dashboard.last_event)}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Prochaine action</dt>
                  <dd>{nextActionLabel(dashboard.next_action)}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Blocage</dt>
                  <dd>{value(dashboard.block_reason)}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Tentative finale</dt>
                  <dd>{value(result?.finalAttemptId)}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Approuvé</dt>
                  <dd>{date(dashboard.approved_at)}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Mis en file</dt>
                  <dd>{date(dashboard.queued_at)}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Soumission commencée</dt>
                  <dd>{date(dashboard.submit_started_at)}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Terminé</dt>
                  <dd>{date(dashboard.finished_at)}</dd>
                </div>
              </dl>

              {dashboard.form_url ? (
                <p className="mt-3 break-all text-sm">
                  <span className="text-slate-500">Formulaire : </span>
                  {dashboard.form_url}
                </p>
              ) : null}
            </div>

            {approvalAvailable ? (
              <div className="mt-5 rounded-xl border border-slate-200 p-4">
                <h3 className="font-medium text-slate-950">
                  Approbation humaine
                </h3>

                <p className="mt-1 text-sm text-slate-600">
                  Vérifiez l’identité utilisée pour remplir le formulaire avant
                  d’autoriser l’automatisation.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    Nom complet *
                    <input
                      type="text"
                      value={senderName}
                      onChange={(event) => setSenderName(event.target.value)}
                      disabled={approvalSubmitting}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    E-mail *
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={(event) => setSenderEmail(event.target.value)}
                      disabled={approvalSubmitting}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    Prénom
                    <input
                      type="text"
                      value={senderFirstName}
                      onChange={(event) => setSenderFirstName(event.target.value)}
                      disabled={approvalSubmitting}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    Nom
                    <input
                      type="text"
                      value={senderLastName}
                      onChange={(event) => setSenderLastName(event.target.value)}
                      disabled={approvalSubmitting}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    Société *
                    <input
                      type="text"
                      value={senderCompany}
                      onChange={(event) => setSenderCompany(event.target.value)}
                      disabled={approvalSubmitting}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    Site web *
                    <input
                      type="url"
                      value={senderWebsite}
                      onChange={(event) => setSenderWebsite(event.target.value)}
                      disabled={approvalSubmitting}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                </div>

                {approvalError ? (
                  <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                    {approvalError}
                  </p>
                ) : null}

                {approvalSuccess ? (
                  <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                    {approvalSuccess}
                  </p>
                ) : null}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={!approvalReady || approvalSubmitting}
                    onClick={() =>
                      onApprove({
                        senderName: senderName.trim(),
                        senderEmail: senderEmail.trim(),
                        senderCompany: senderCompany.trim(),
                        senderWebsite: senderWebsite.trim(),
                        senderFirstName: senderFirstName.trim() || null,
                        senderLastName: senderLastName.trim() || null,
                      })
                    }
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {approvalSubmitting
                      ? "Approbation…"
                      : "Approuver cette identité"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <h3 className="font-medium text-slate-950">
                Historique d’exécution
              </h3>

              {!result?.events.length ? (
                <p className="mt-2 text-sm text-slate-600">
                  Aucun événement enregistré.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {result.events.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-xl border border-slate-200 p-3 text-sm"
                    >
                      <div className="font-medium text-slate-900">
                        {event.event_type}
                      </div>
                      <div className="mt-1 text-slate-600">
                        État : {event.state} · {date(event.occurred_at)}
                      </div>
                      {event.safe_error_code ? (
                        <div className="mt-1 text-red-700">
                          {event.safe_error_code}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm">
              <strong>Limite de preuve :</strong>{" "}
              une soumission confirmée signifie uniquement que l’automate a
              observé une preuve explicite de soumission. Elle ne prouve ni la
              livraison au destinataire, ni une réponse, ni la publication
              d’un backlink.
            </div>
          </>
        )}
      </section>
    </div>
  );
}

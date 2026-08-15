import React from "react";

type Channel = "email" | "linkedin" | "contact_form";

type Props = {
  contacts: readonly { contactId: string; label: string; eligibleChannels: readonly Channel[] }[];
  contactId: string;
  channel: Channel | "";
  subject: string | null;
  body: string | null;
  submitting: boolean;
  error: string | null;
  onContactChange(value: string): void;
  onChannelChange(value: Channel | ""): void;
  onSubjectChange(value: string): void;
  onBodyChange(value: string): void;
  onSave(): void;
  onClose(): void;
};

export default function OutreachDraftEditDialog(props: Props) {
  const contact = props.contacts.find((item) => item.contactId === props.contactId);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="outreach-draft-edit-title" className="fixed inset-0 z-50 bg-slate-950/40 p-4">
      <div className="mx-auto mt-12 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="outreach-draft-edit-title" className="text-xl font-semibold text-slate-950">
              Modifier le brouillon
            </h2>
            <p className="mt-1 text-sm text-slate-600">Préparez le message sans l’envoyer.</p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Fermer
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Contact
            <select
              value={props.contactId}
              onChange={(event) => props.onContactChange(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {props.contacts.map((item) => (
                <option key={item.contactId} value={item.contactId}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Canal
            <select
              value={props.channel}
              onChange={(event) => props.onChannelChange(event.target.value as Channel)}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="" disabled>
                Sélectionnez un canal
              </option>
              {contact?.eligibleChannels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Sujet
            <input
              value={props.subject ?? ""}
              onChange={(event) => props.onSubjectChange(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Corps du message
            <textarea
              value={props.body ?? ""}
              onChange={(event) => props.onBodyChange(event.target.value)}
              rows={12}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>

          {props.error ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {props.error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={props.onClose}
            disabled={props.submitting}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={props.onSave}
            disabled={props.submitting}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {props.submitting ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

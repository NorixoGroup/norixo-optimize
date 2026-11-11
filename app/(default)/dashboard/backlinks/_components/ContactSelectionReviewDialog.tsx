"use client";

import { useMemo, useState } from "react";
import type { ContactEvidenceConfidence, ContactEvidenceKind, ContactSelectionCase, ContactSelectionReasonCode, LinkedInProfileKind } from "@/lib/backlinks/services/contactSelectionReviewService";

type Props = {
  cases: readonly ContactSelectionCase[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onClose: () => void;
  onSubmit: (input: { item: ContactSelectionCase; selectedContactId: string | null; reasonCode: ContactSelectionReasonCode }) => void;
};

const rejectionReasons: Array<{ value: Exclude<ContactSelectionReasonCode, "HUMAN_REVIEW_SELECTED">; label: string }> = [
  { value: "HUMAN_REVIEW_REJECTED_INSUFFICIENT_EVIDENCE", label: "Preuve insuffisante" },
  { value: "HUMAN_REVIEW_REJECTED_NO_APPROPRIATE_CONTACT", label: "Aucun contact approprié" },
  { value: "HUMAN_REVIEW_REJECTED_POLICY_CONSTRAINT", label: "Contrainte de politique" },
];

const evidenceKindLabels: Record<ContactEvidenceKind, string> = {
  mailto: "lien mailto", visible_email: "e-mail visible sur la page", contact_form: "formulaire de contact", linkedin: "lien LinkedIn",
};
const evidenceConfidenceLabels: Record<ContactEvidenceConfidence, string> = { strong: "confiance forte", medium: "confiance moyenne" };
const linkedinProfileKindLabels: Record<LinkedInProfileKind, string> = {
  person: "profil personnel", company: "page d'entreprise (pas une personne)", unknown: "nature indéterminée", not_applicable: "",
};

export default function ContactSelectionReviewDialog(props: Props) {
  const pending = useMemo(() => props.cases.filter((item) => item.decision == null), [props.cases]);
  const [caseId, setCaseId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [rejectionReason, setRejectionReason] = useState<Exclude<ContactSelectionReasonCode, "HUMAN_REVIEW_SELECTED">>("HUMAN_REVIEW_REJECTED_INSUFFICIENT_EVIDENCE");
  const [confirmed, setConfirmed] = useState(false);
  const selectedCase = pending.find((item) => item.sourceResolutionTaskId === caseId) ?? null;
  const canSubmit = selectedCase != null && confirmed && !props.submitting && (selectedContactId === "__reject__" || selectedCase.candidates.some((candidate) => candidate.id === selectedContactId && candidate.selectable));
  return <div role="dialog" aria-modal="true" aria-labelledby="contact-selection-title" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4"><div className="mx-auto mt-8 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="contact-selection-title" className="text-xl font-semibold text-slate-950">Sélection humaine des contacts</h2><p className="mt-1 text-sm text-slate-600">Cette décision est définitive et ne déclenche aucune validation, tâche ou prise de contact.</p></div><button type="button" disabled={props.submitting} onClick={props.onClose} className="rounded-full px-3 py-1 text-sm font-semibold text-slate-600">Fermer</button></div>{props.loading ? <p className="mt-5 text-sm text-slate-600">Chargement des dossiers…</p> : pending.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">Aucun dossier multi-candidats en attente. Les résolutions singleton ne sont pas éligibles à une décision 5F.</p> : <><label className="mt-5 block text-sm font-semibold text-slate-700">Promotion à examiner<select value={caseId} onChange={(event) => { setCaseId(event.target.value); setSelectedContactId(""); setConfirmed(false); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Sélectionner un dossier</option>{pending.map((item, index) => <option key={item.sourceResolutionTaskId} value={item.sourceResolutionTaskId}>Dossier {index + 1} · {item.candidateCount} candidats</option>)}</select></label>{selectedCase ? <><fieldset className="mt-5"><legend className="text-sm font-semibold text-slate-700">Décision</legend><div className="mt-2 space-y-2">{selectedCase.candidates.map((candidate, index) => <label key={candidate.id} className={`block rounded-xl border p-3 text-sm ${candidate.selectable ? "border-slate-200" : "border-slate-200 bg-slate-50 text-slate-500"}`}><input type="radio" name="contact-selection" value={candidate.id} checked={selectedContactId === candidate.id} disabled={!candidate.selectable} onChange={() => { setSelectedContactId(candidate.id); setConfirmed(false); }} /> <span className="ml-2 font-semibold">{candidate.fullName ?? `Candidat ${index + 1} (nom non renseigné)`}</span>{candidate.roleTitle ? <span className="ml-2 text-slate-600">{candidate.roleTitle}</span> : null}<span className="ml-2 text-slate-600">{candidate.channels.email ? "E-mail présent" : ""}{candidate.channels.contactForm ? " · Formulaire" : ""}{candidate.channels.linkedIn ? " · LinkedIn" : ""} · statut {candidate.contactStatus}{candidate.mailboxState === "verified" ? " · mailbox vérifiée" : " · mailbox non vérifiée"}</span>{candidate.channels.linkedIn ? <span className="ml-2 text-slate-600">LinkedIn : {linkedinProfileKindLabels[candidate.linkedinProfileKind]}</span> : null}{candidate.evidenceSummary.length > 0 ? <span className="ml-2 block text-xs text-slate-500">Preuves de provenance (non vérifiées) : {candidate.evidenceSummary.map((item) => `${evidenceKindLabels[item.kind]} ×${item.count} (${evidenceConfidenceLabels[item.confidence]})`).join(", ")}</span> : null}{candidate.blockingCodes.length > 0 ? <span className="ml-2 text-rose-700">{candidate.blockingCodes.join(", ")}</span> : null}</label>)}<label className="block rounded-xl border border-slate-200 p-3 text-sm"><input type="radio" name="contact-selection" value="__reject__" checked={selectedContactId === "__reject__"} onChange={() => { setSelectedContactId("__reject__"); setConfirmed(false); }} /> <span className="ml-2 font-semibold">Rejeter cette promotion</span></label></div></fieldset>{selectedContactId === "__reject__" ? <label className="mt-4 block text-sm font-semibold text-slate-700">Motif<select value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value as Exclude<ContactSelectionReasonCode, "HUMAN_REVIEW_SELECTED">)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">{rejectionReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label> : null}<label className="mt-5 flex gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Je confirme cette décision humaine irréversible ; aucun outreach, e-mail ou contrôle payant ne sera déclenché.</label><button type="button" disabled={!canSubmit} onClick={() => { if (!selectedCase) return; props.onSubmit({ item: selectedCase, selectedContactId: selectedContactId === "__reject__" ? null : selectedContactId, reasonCode: selectedContactId === "__reject__" ? rejectionReason : "HUMAN_REVIEW_SELECTED" }); }} className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{props.submitting ? "Enregistrement…" : "Enregistrer la décision"}</button></> : null}</>}{props.error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{props.error}</p> : null}{props.success ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{props.success}</p> : null}</div></div>;
}

import React from "react";

export type OutreachInboundReplyItem = { id: string; sender: string; subject: string | null; textBody: string | null; occurredAt: string; effectApplied: boolean; classification: { value: "positive" | "negative"; classifiedAt: string } | null };
export type OutreachInboundReplyConfirmation = { messageId: string; classification: "positive" | "negative" } | null;
type Props = {
  open: boolean;
  outreachLabel: string;
  outreachStatus: string;
  outreachLastResponseType: string | null;
  outreachClosedAt: string | null;
  outreachStopReason: string | null;
  outreachNextFollowUpAt: string | null;
  replies: OutreachInboundReplyItem[];
  loading: boolean;
  loadError: string | null;
  submittingMessageId: string | null;
  classificationError: string | null;
  classificationSuccess: string | null;
  pendingConfirmation: OutreachInboundReplyConfirmation;
  onClose(): void;
  onRequestClassification(messageId: string, classification: "positive" | "negative"): void;
  onConfirmClassification(): void;
  onCancelClassification(): void;
};

export default function OutreachInboundRepliesDialog({ open, outreachLabel, outreachStatus, outreachLastResponseType, outreachClosedAt, outreachStopReason, outreachNextFollowUpAt, replies, loading, loadError, submittingMessageId, classificationError, classificationSuccess, pendingConfirmation, onClose, onRequestClassification, onConfirmClassification, onCancelClassification }: Props) {
  if (!open) return null;
  const pendingReply = pendingConfirmation ? replies.find((reply) => reply.id === pendingConfirmation.messageId) : null;
  const exactPositiveConvergence = outreachStatus === "replied" && outreachLastResponseType === "positive" && outreachClosedAt == null && outreachStopReason == null && outreachNextFollowUpAt == null;
  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/40 p-4"><div className="mx-auto mt-12 max-w-2xl rounded-3xl bg-white p-6"><h2>Réponses reçues — {outreachLabel}</h2>{loading ? <p>Chargement des réponses…</p> : null}{loadError ? <p role="alert">{loadError}</p> : null}{classificationError ? <p role="alert">{classificationError}</p> : null}{classificationSuccess ? <p>{classificationSuccess}</p> : null}{!loading && !loadError && replies.length === 0 ? <p>Aucune réponse reçue.</p> : null}{replies.map((reply) => { const classifiable = reply.effectApplied && reply.classification == null && (outreachStatus === "active" || exactPositiveConvergence); const positiveAllowed = reply.effectApplied && reply.classification == null && (outreachStatus === "active" || exactPositiveConvergence); const negativeAllowed = reply.effectApplied && reply.classification == null && outreachStatus === "active"; const submitting = submittingMessageId === reply.id; return <article key={reply.id} className="mt-4 rounded-xl border border-slate-200 p-4"><p className="font-semibold">{reply.sender}</p><p>{reply.occurredAt}</p>{reply.subject ? <p>{reply.subject}</p> : null}<p className="whitespace-pre-wrap">{reply.textBody?.trim() || "Le contenu texte de cette réponse n’est pas disponible."}</p>{reply.classification ? <p>{reply.classification.value === "positive" ? "Positive" : "Négative"}</p> : classifiable ? <div className="flex flex-wrap gap-3">{positiveAllowed ? <button type="button" disabled={submitting} onClick={() => onRequestClassification(reply.id, "positive")} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">Positive</button> : null}{negativeAllowed ? <button type="button" disabled={submitting} onClick={() => onRequestClassification(reply.id, "negative")} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Négative</button> : null}</div> : <p>Classification indisponible pour l’état actuel de l’outreach.</p>}</article>; })}{pendingConfirmation && pendingReply ? <div className="mt-4 rounded-xl border border-amber-300 p-4"><p>{pendingConfirmation.classification === "positive" ? "L’outreach sera marqué comme ayant reçu une réponse positive." : "Cette classification clôturera cet outreach comme refusé."}</p><div className="mt-4 flex flex-wrap justify-end gap-3"><button type="button" disabled={submittingMessageId != null} onClick={onCancelClassification} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Annuler</button><button type="button" disabled={submittingMessageId != null} onClick={onConfirmClassification} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">Confirmer</button></div></div> : null}<button type="button" disabled={submittingMessageId != null} onClick={onClose} className="mt-6 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Fermer</button></div></div>;
}

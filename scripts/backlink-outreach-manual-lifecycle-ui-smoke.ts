import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function handler(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `Missing handler boundaries for ${startMarker}`);
  return source.slice(start, end);
}

async function main() {
  const [page, responseDialog, lifecycleDialog] = await Promise.all([
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/OutreachResponseDialog.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/OutreachLifecycleActionDialog.tsx", "utf8"),
  ]);

  const responseOpen = handler(page, "const openOutreachResponseDialog", "const handleOutreachResponse");
  const responseSubmit = handler(page, "const handleOutreachResponse", "const closeOutreachLifecycleActionDialog");
  const lifecycleOpen = handler(page, "const openOutreachLifecycleActionDialog", "const handleOutreachLifecycleAction");
  const lifecycleSubmit = handler(page, "const handleOutreachLifecycleAction", "const handleSendOutreachEmail");
  const lifecycleActions = handler(page, 'activeSection === "outreach" ? <div className="mt-3 flex flex-wrap gap-2">{pages.outreach.items.map((outreach) => {', "{outreachReadyDialog ?");

  for (const value of [
    'outreach.status === "active"',
    "Réponse reçue",
    "Clôturer",
    'outreach.finalNoResponseEligible === true',
    "Marquer sans réponse",
    'outreach.status === "replied" && outreach.last_response_type === "positive"',
    "Ouvrir la conversation",
  ]) assert(lifecycleActions.includes(value), `Missing lifecycle visibility: ${value}`);
  for (const status of ["draft", "ready", "conversation_open", "declined", "no_response", "paused", "closed"]) assert(!lifecycleActions.includes(`outreach.status === "${status}"`), `Lifecycle action must be absent for ${status}`);
  assert(!lifecycleActions.includes("Aucune réponse"), "Legacy no-response label must not remain exposed in the visible action group.");
  for (const responseType of ["negative", "neutral", "bounced", "unsubscribed"]) assert(!lifecycleActions.includes(`outreach.last_response_type === "${responseType}"`), `Lifecycle action must be absent for replied ${responseType}`);

  for (const value of [
    "<OutreachResponseDialog",
    'responseKind: "positive" | "negative" | null',
    "Réponse positive",
    "Réponse négative",
    "Confirmer la réponse positive",
    "Confirmer le refus",
    'responseKind === "negative" && stopReason.trim() !== ""',
  ]) assert(responseDialog.includes(value) || page.includes(value), `Missing response UI invariant: ${value}`);
  for (const forbidden of ["Neutral", "Adresse invalide", "Désinscription", "fetch(", "apiRequest", "provider", "idempotencyKey", "follow-up", "scheduler"]) assert(!responseDialog.includes(forbidden), `Forbidden response dialog behavior: ${forbidden}`);
  for (const value of ['outreach.status !== "active"', "setOutreachResponseKind(null)", "setOutreachResponseStopReason(\"\")", "outreachResponseSubmitting"]) assert(responseOpen.includes(value) || responseSubmit.includes(value), `Missing response guard: ${value}`);
  for (const value of [
    'JSON.stringify({ confirm: true, action: "mark_replied", responseType: "positive" })',
    'JSON.stringify({ confirm: true, action: "decline", stopReason })',
    'outreachResponseKind === "negative" && !stopReason',
    "Un motif est requis pour confirmer le refus.",
    "La réponse positive a été enregistrée.",
    "Le refus a été enregistré.",
    "await loadDashboard()",
  ]) assert(responseSubmit.includes(value), `Missing response flow invariant: ${value}`);
  assert(!responseSubmit.includes('responseType: "negative"'), "Negative must not use mark_replied.");

  for (const value of [
    "<OutreachLifecycleActionDialog",
    'action === "mark_no_response"',
    'action === "open_conversation"',
    'action === "close"',
    "Confirmer qu’aucune réponse n’a été reçue.",
    "Cette action indique qu’une réponse positive nécessite maintenant un suivi humain.",
    "Cette action clôture cet outreach. Aucun nouvel envoi ne sera proposé.",
  ]) assert(lifecycleDialog.includes(value) || page.includes(value), `Missing lifecycle dialog invariant: ${value}`);
  for (const forbidden of ["pause", "fetch(", "apiRequest", "provider", "idempotencyKey", "follow-up", "scheduler"]) assert(!lifecycleDialog.includes(forbidden), `Forbidden lifecycle dialog behavior: ${forbidden}`);
  for (const value of [
    'outreach.status === "active" && outreach.current_attempt === outreach.max_attempts',
    'outreach.status === "replied" && outreach.last_response_type === "positive"',
    'action === "close" && !stopReason',
    "Un motif est requis pour clôturer l’outreach.",
    'JSON.stringify({ confirm: true, action: "mark_no_response" })',
    'JSON.stringify({ confirm: true, action: "open_conversation" })',
    'JSON.stringify({ confirm: true, action: "close", stopReason })',
    "L’absence de réponse a été enregistrée.",
    "La conversation a été ouverte.",
    "L’outreach a été clôturé.",
    "await loadDashboard()",
  ]) assert(lifecycleOpen.includes(value) || lifecycleSubmit.includes(value), `Missing lifecycle flow invariant: ${value}`);

  for (const source of [responseSubmit, lifecycleSubmit]) {
    for (const forbidden of ["/send", "/resolve", "crypto.randomUUID", "Resend", "outreachEmailProvider", "createBacklinkOutreachAttempt", "follow-up", "scheduler"]) assert(!source.includes(forbidden), `Forbidden lifecycle handler behavior: ${forbidden}`);
  }
  for (const payload of [
    'JSON.stringify({ confirm: true, action: "mark_replied", responseType: "positive" })',
    'JSON.stringify({ confirm: true, action: "decline", stopReason })',
    'JSON.stringify({ confirm: true, action: "mark_no_response" })',
    'JSON.stringify({ confirm: true, action: "open_conversation" })',
    'JSON.stringify({ confirm: true, action: "close", stopReason })',
  ]) {
    assert(responseSubmit.includes(payload) || lifecycleSubmit.includes(payload), `Missing strict lifecycle payload: ${payload}`);
  }
  for (const forbiddenField of ["status", "workspaceId", "actorUserId", "outreachId", "contactId", "currentAttempt", "maxAttempts", "closedAt", "nextFollowUpAt", "idempotencyKey", "provider", "recipient", "subject"]) {
    assert(!responseSubmit.includes(` ${forbiddenField}:`) && !lifecycleSubmit.includes(` ${forbiddenField}:`), `Forbidden lifecycle payload field: ${forbiddenField}`);
  }
  for (const value of ["outreachResponseSubmitting", "outreachLifecycleSubmitting", "L’Outreach a changé. Le dashboard a été rechargé.", "await loadDashboard()"])
    assert(responseSubmit.includes(value) || lifecycleSubmit.includes(value), `Missing concurrency invariant: ${value}`);

  console.log("PASS — Backlink outreach manual lifecycle UI smoke");
}

void main();

import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const [page, dialog] = await Promise.all([
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/OutreachFinalNoResponseDialog.tsx", "utf8"),
  ]);

  const openStart = page.indexOf("const openOutreachFinalNoResponseDialog");
  const submitStart = page.indexOf("const handleOutreachFinalNoResponse");
  assert(openStart >= 0 && submitStart >= 0, "Missing final no-response parent handlers");
  const openHandler = page.slice(openStart, page.indexOf("const handleSendOutreachEmail", openStart));
  const submitHandler = page.slice(submitStart, page.indexOf("const handleSendOutreachEmail", submitStart));

  for (const value of [
    "outreach.finalNoResponseEligible === true",
    "openOutreachFinalNoResponseDialog",
    "outreachFinalNoResponseDialog",
    "outreachFinalNoResponseSubmitting",
    "outreachFinalNoResponseError",
    "outreachFinalNoResponseSuccess",
    "<OutreachFinalNoResponseDialog",
    "Marquer sans réponse",
  ]) assert(page.includes(value), `Missing final no-response page invariant: ${value}`);

  for (const value of [
    "outreach.status !== \"active\"",
    "outreach.finalNoResponseEligible !== true",
    "setOutreachFinalNoResponseDialog(outreach)",
    "setOutreachFinalNoResponseError(null)",
    "setOutreachFinalNoResponseSuccess(null)",
  ]) assert(openHandler.includes(value), `Missing final no-response open guard: ${value}`);

  const payloadStart = submitHandler.indexOf("JSON.stringify({");
  const payloadEnd = submitHandler.indexOf("})", payloadStart) + 2;
  const payload = submitHandler.slice(payloadStart, payloadEnd);
  for (const value of [
    "/api/backlinks/outreach/${outreach.id}/final-no-response",
    "JSON.stringify({ confirm: true })",
    "response.result.disposition === \"existing\"",
    "L’absence de réponse a été enregistrée.",
    "Cet Outreach ne peut plus être marqué sans réponse dans son état actuel.",
    "await loadDashboard()",
  ]) assert(submitHandler.includes(value), `Missing final no-response submit invariant: ${value}`);
  for (const forbidden of ["idempotencyKey", "provider", "recipient", "channel", "status", "workspaceId", "actorUserId"]) assert(!payload.includes(forbidden), `Forbidden final no-response submit payload field: ${forbidden}`);
  for (const forbidden of ["/send", "Resend", "scheduler"]) assert(!submitHandler.includes(forbidden), `Forbidden final no-response submit behavior: ${forbidden}`);

  for (const value of [
    "role=\"dialog\"",
    "Marquer sans réponse",
    "La fenêtre finale de réponse est expirée.",
    "Aucun message ne sera envoyé.",
    "Tentatives :",
    "Confirmer l’absence de réponse ?",
  ]) assert(dialog.includes(value), `Missing final no-response dialog invariant: ${value}`);
  for (const forbidden of ["apiRequest", "fetch(", "provider", "Resend", "scheduler"]) assert(!dialog.includes(forbidden), `Forbidden final no-response dialog behavior: ${forbidden}`);

  assert(!page.includes("Aucune réponse"), "Legacy no-response label must not remain exposed in the visible action group.");

  console.log("PASS — Backlink outreach final no-response UI smoke");
}

void main();

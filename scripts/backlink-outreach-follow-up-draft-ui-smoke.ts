import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [page, dialog] = await Promise.all([
    readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"),
    readFile("app/(default)/dashboard/backlinks/_components/OutreachFollowUpDraftDialog.tsx", "utf8"),
  ]);

  for (const value of [
    "OutreachFollowUpDraftDialog",
    "outreachFollowUpDraftDialog",
    "outreachFollowUpDraftLoading",
    "outreachFollowUpDraftSubject",
    "outreachFollowUpDraftBody",
    "outreachFollowUpDraftSubmitting",
    "outreachFollowUpDraftSendConfirmationOpen",
    "outreachFollowUpDraftSendSubmitting",
    "openOutreachFollowUpDraftDialog",
    "closeOutreachFollowUpDraftDialog",
    "handleSaveOutreachFollowUpDraft",
    "handleRequestOutreachFollowUpSend",
    "handleConfirmOutreachFollowUpSend",
    'outreachFollowUpSummary(row)?.state === "prepared"',
    "/api/backlinks/outreach/${outreach.id}/attempts/${summary.attemptId}/follow-up-draft",
    "/api/backlinks/outreach/${dialog.outreach.id}/attempts/${dialog.attemptId}/follow-up-send",
    'JSON.stringify({ confirm: true })',
    "Relire la relance",
    "Enregistrez les modifications avant l’envoi.",
    "Relance envoyée.",
    "Le brouillon a été modifié ailleurs. Rechargez la version la plus récente.",
    "await loadDashboard()",
  ]) {
    assert(page.includes(value), `Missing follow-up draft UI invariant: ${value}`);
  }

  const preparedBlockStart = page.indexOf('outreachFollowUpSummary(row)?.state === "prepared"');
  const preparedBlockEnd = page.indexOf('outreachFollowUpDraftDialog ? <OutreachFollowUpDraftDialog', preparedBlockStart);
  const preparedBlock = page.slice(preparedBlockStart, preparedBlockEnd);
  for (const forbidden of ["scheduler", "auto-send", "follow-up-send", "provider", "Resend"]) {
    assert(!preparedBlock.includes(forbidden), `Forbidden follow-up draft flow: ${forbidden}`);
  }

  for (const value of [
    'role="dialog"',
    "Relire la relance",
    "Le contenu reste en texte brut. Aucune mise en forme riche n’est appliquée.",
    "Aucun auto-envoi. Enregistrer ne déclenche pas l’envoi.",
    "Enregistrer",
    "Envoyer la relance",
    "Confirmer l’envoi",
    "L’email sera envoyé au contact avec le contenu actuellement enregistré.",
  ]) {
    assert(dialog.includes(value), `Missing follow-up draft dialog invariant: ${value}`);
  }

  for (const forbidden of [
    "Renvoyer",
    "Retry",
    "Resend",
    "sendEmail",
    "provider",
    "scheduler",
    "markdown",
    "html",
  ]) {
    assert(!dialog.includes(forbidden), `Forbidden dialog content: ${forbidden}`);
  }

  console.log("PASS — Backlink follow-up draft UI smoke");
}

void main();

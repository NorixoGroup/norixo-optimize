import { readFile } from "node:fs/promises";
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function main(): Promise<void> {
  const [page, dialog] = await Promise.all([readFile("app/(default)/dashboard/backlinks/page.tsx", "utf8"), readFile("app/(default)/dashboard/backlinks/_components/OutreachDraftPreparationDialog.tsx", "utf8")]);
  for (const required of ["Préparer un outreach", "OutreachDraftPreparationDialog", "openOutreachDraftDialog", "previewOutreachDraft", "applyOutreachDraft", "setOutreachDraftPreview(null)", "await loadDashboard()", "Brouillon créé.", "Brouillon déjà existant."]) assert(page.includes(required), `Missing UI wiring ${required}.`);
  for (const required of ["contacts.map", "eligibleChannels.map", "Prévisualiser", "Créer le brouillon", "disabled={!preview", "email", "linkedin", "contact_form"]) assert(dialog.includes(required), `Missing dialog behavior ${required}.`);
  assert(!dialog.includes("apiRequest") && !dialog.includes("Envoyer") && !dialog.includes("provider") && !dialog.includes("follow-up"), "Dialog must stay presentational and never send.");
  assert(page.includes('body: JSON.stringify({ ...outreachDraftDialog, contactId: outreachDraftContactId, channel: outreachDraftChannel })'), "Preview payload must contain no workspace or actor.");
  assert(page.includes('body: JSON.stringify({ ...outreachDraftDialog, contactId: outreachDraftContactId, channel: outreachDraftChannel, confirm: true })'), "Apply payload must contain only identity and confirmation.");
  console.log("PASS — Backlink outreach draft UI smoke");
}
void main();
